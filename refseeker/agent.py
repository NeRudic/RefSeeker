import asyncio
import hashlib
import os

import httpx

from .config import BATCH_SIZE, DOWNLOAD_CONCURRENCY, MIN_IMAGE_DIM, PROVIDER_CONFIG, URLLIB_TIMEOUT, logger
from .image import (
    _detect_mime_type,
    _has_null_byte,
    _is_likely_image_url,
    _mime_to_ext,
    _resolve_full_resolution_url,
    _validate_image,
)
from .searcher import search_images
from .state import state
from .verify import _verify_and_save

_DOWNLOAD_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
}

_HTTP_CLIENT = httpx.AsyncClient(
    timeout=httpx.Timeout(URLLIB_TIMEOUT, connect=5.0),
    headers=_DOWNLOAD_HEADERS,
    follow_redirects=True,
)


async def _download_one(url: str, sem: asyncio.Semaphore, progress_tracker=None) -> tuple | None:
    """Download a single image via HTTP, validate, return candidate tuple or None."""
    async with sem:
        if state.is_full or url in state.downloaded_urls:
            return None
        state.download_attempts += 1

        resolved = _resolve_full_resolution_url(url)
        download_urls = [resolved, url] if resolved else [url]

        image_bytes = None
        content_type = ""
        for attempt_url in download_urls:
            logger.debug("Downloading: %s", attempt_url)
            try:
                resp = await _HTTP_CLIENT.get(attempt_url)
                resp.raise_for_status()
                image_bytes = resp.content
                content_type = resp.headers.get("Content-Type", "")
                break
            except Exception as e:
                logger.debug("Download failed: %s — %s", attempt_url, e)
                continue

        if image_bytes is None:
            if progress_tracker:
                progress_tracker.download_progress(
                    current=state.download_attempts, total=len(state.downloaded_urls) + 1,
                    url=url, status="failed",
                )
            return None

        if content_type and not content_type.startswith("image/"):
            logger.debug("Not an image (Content-Type: %s): %s", content_type, url)
            state.filter_stats["not_image"] += 1
            return None

        mime_type = content_type if content_type.startswith("image/") else _detect_mime_type(image_bytes)
        is_valid, width, height = _validate_image(image_bytes)
        if not is_valid:
            logger.debug("Corrupt image: %s", url)
            state.filter_stats["corrupt"] += 1
            return None

        if width < MIN_IMAGE_DIM or height < MIN_IMAGE_DIM:
            logger.debug("Image too small (%dx%d): %s", width, height, url)
            state.filter_stats["too_small"] += 1
            return None

        state.downloaded_urls.add(url)

        # Save to pending directory for verification pipeline
        pending_ext = _mime_to_ext(mime_type)
        url_hash = hashlib.md5(url.encode()).hexdigest()[:8]
        pending_filename = f"img_{url_hash}.{pending_ext}"
        pending_dir = os.path.join(state.output_dir, ".pending")
        os.makedirs(pending_dir, exist_ok=True)
        pending_path = os.path.join(pending_dir, pending_filename)
        with open(pending_path, "wb") as f:
            f.write(image_bytes)
        state.pending_files[url] = pending_filename

        if progress_tracker:
            progress_tracker.download_progress(
                current=state.download_attempts,
                total=len(state.downloaded_urls),
                url=url,
                status="downloaded",
            )

        return (url, mime_type, image_bytes, width, height)


async def run_agent(query: str, max_images: int = 50, progress_tracker=None, blacklist: list[str] | None = None) -> None:
    state.reset(query, max_images, blacklist)
    os.makedirs(state.output_dir, exist_ok=True)

    if progress_tracker:
        progress_tracker.search_started(query=query, max_images=max_images)

    # 1. Search multiple variants for broader coverage
    search_queries = [
        f"{query} walkaround",
        f"{query} reference photos",
    ]

    all_urls: list[str] = []
    for q in search_queries:
        urls = search_images(q, count=100)
        all_urls.extend(urls)

    # 2. Deduplicate preserving order
    seen: set[str] = set()
    unique_urls: list[str] = []
    for url in all_urls:
        normalized = url.rstrip("/").lower()
        if normalized not in seen:
            seen.add(normalized)
            unique_urls.append(url)

    logger.info("Total unique image URLs: %d", len(unique_urls))

    # 2b. Pre-filter: reject invalid URLs before downloading
    pre_filtered: list[str] = []
    for url in unique_urls:
        if _has_null_byte(url):
            logger.debug("Rejected (null byte): %s", url)
            state.filter_stats["invalid_url"] += 1
            continue
        if not _is_likely_image_url(url):
            logger.debug("Rejected (not an image URL): %s", url)
            state.filter_stats["invalid_url"] += 1
            continue
        pre_filtered.append(url)
    unique_urls = pre_filtered
    logger.info("After pre-filter: %d image URLs", len(unique_urls))

    if progress_tracker:
        progress_tracker.search_complete(total=len(all_urls), unique=len(seen), after_filter=len(unique_urls))

    if not unique_urls:
        logger.warning("No image URLs found for query: %s", query)
        logger.info("Session finished. %s", state.log_metrics())
        return

    # 3. Pipeline: download + verify concurrently
    sem = asyncio.Semaphore(DOWNLOAD_CONCURRENCY)
    total_to_download = len(unique_urls)
    if progress_tracker:
        progress_tracker.download_started(total=total_to_download)

    download_tasks = [_download_one(url, sem, progress_tracker=progress_tracker) for url in unique_urls]

    candidates_buffer: list = []
    verify_tasks: list[asyncio.Task] = []
    total_downloaded = 0

    # Flush buffer to verification when we have enough for efficient provider round-robin
    # 4 providers × 8 images each = 32 total
    _VERIFY_BATCH = BATCH_SIZE * 2 + 2

    async def _flush():
        nonlocal candidates_buffer
        if not candidates_buffer:
            return
        batch = list(candidates_buffer)
        candidates_buffer.clear()
        task = asyncio.create_task(_verify_and_save(batch, progress_tracker))
        verify_tasks.append(task)

    for coro in asyncio.as_completed(download_tasks):
        result = await coro
        if result is None:
            continue
        total_downloaded += 1
        candidates_buffer.append(result)
        if len(candidates_buffer) >= _VERIFY_BATCH:
            await _flush()

    logger.info("Downloaded %d valid candidates", total_downloaded)
    if progress_tracker:
        progress_tracker.download_complete(downloaded=total_downloaded)

    if not total_downloaded:
        logger.warning("No valid images could be downloaded.")
        logger.info("Session finished. %s", state.log_metrics())
        return

    # Flush remaining candidates to verification
    await _flush()

    # Wait for all in-flight verification tasks
    if verify_tasks:
        await asyncio.gather(*verify_tasks, return_exceptions=True)

    logger.info("Session finished. %s", state.log_metrics())
