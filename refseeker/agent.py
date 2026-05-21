import asyncio
import os

import httpx

from .config import DOWNLOAD_CONCURRENCY, URLLIB_TIMEOUT, logger
from .image import _detect_mime_type, _validate_image
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


async def _download_one(url: str, sem: asyncio.Semaphore) -> tuple | None:
    """Download a single image via HTTP, validate, return candidate tuple or None."""
    async with sem:
        if state.is_full or url in state.downloaded_urls:
            return None
        state.download_attempts += 1
        logger.info("Downloading: %s", url)
        try:
            async with httpx.AsyncClient(
                timeout=httpx.Timeout(URLLIB_TIMEOUT, connect=5.0)
            ) as client:
                resp = await client.get(url, headers=_DOWNLOAD_HEADERS, follow_redirects=True)
                resp.raise_for_status()
                image_bytes = resp.content
                content_type = resp.headers.get("Content-Type", "")
        except Exception as e:
            logger.debug("Download failed: %s — %s", url, e)
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

        state.downloaded_urls.add(url)
        return (url, mime_type, image_bytes, width, height)


async def run_agent(query: str, max_images: int = 50) -> None:
    state.reset(query, max_images)
    os.makedirs(state.output_dir, exist_ok=True)

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

    if not unique_urls:
        logger.warning("No image URLs found for query: %s", query)
        logger.info("Session finished. %s", state.log_metrics())
        return

    # 3. Download with concurrency
    sem = asyncio.Semaphore(DOWNLOAD_CONCURRENCY)
    download_tasks = [_download_one(url, sem) for url in unique_urls]
    results = await asyncio.gather(*download_tasks)

    candidates = [r for r in results if r is not None]
    logger.info("Downloaded %d valid candidates", len(candidates))

    if not candidates:
        logger.warning("No valid images could be downloaded.")
        logger.info("Session finished. %s", state.log_metrics())
        return

    # 4. Verify in batches via GPT-4o mini
    batch_size = 25
    for i in range(0, len(candidates), batch_size):
        if state.is_full:
            break
        batch = candidates[i : i + batch_size]
        logger.info(
            "Verifying batch %d/%d (%d images)...",
            i // batch_size + 1,
            (len(candidates) + batch_size - 1) // batch_size,
            len(batch),
        )
        await _verify_and_save(batch)

        if state.saved_count % 10 == 0 and state.saved_count > 0:
            logger.info("Progress: %s", state.log_metrics())

    logger.info("Session finished. %s", state.log_metrics())
