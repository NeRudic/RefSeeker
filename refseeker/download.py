import asyncio
import urllib.parse
import urllib.request

from .config import (
    BATCH_SIZE,
    DOWNLOAD_CONCURRENCY,
    FETCH_TIMEOUT,
    MIN_IMAGE_DIM,
    URLLIB_TIMEOUT,
    logger,
)
from .image import (
    _detect_mime_type,
    _has_null_byte,
    _is_likely_image_url,
    _parse_data_url,
    _validate_image,
)
from .state import state


async def _download_single(page, absolute_url: str) -> tuple[str, bytes]:
    """Download one image via browser fetch (CDP) with Python fallback."""
    if _has_null_byte(absolute_url):
        raise ValueError("URL contains null byte")

    try:
        data_url = await page.evaluate("""
            (targetUrl) => {
                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), """ + str(int(FETCH_TIMEOUT * 1000)) + """);
                return fetch(targetUrl, { signal: controller.signal })
                    .then(response => {
                        clearTimeout(timer);
                        if (!response.ok) throw new Error('HTTP error! status: ' + response.status);
                        return response.blob();
                    })
                    .then(blob => new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result);
                        reader.onerror = () => reject(new Error('Failed to read blob as data URL'));
                        reader.readAsDataURL(blob);
                    }));
            }
        """, absolute_url)
        return _parse_data_url(data_url)
    except Exception as browser_err:
        headers = {
            'User-Agent': ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
                           'AppleWebKit/537.36 (KHTML, like Gecko) '
                           'Chrome/120.0.0.0 Safari/537.36')
        }
        req = urllib.request.Request(absolute_url, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=URLLIB_TIMEOUT) as response:
                image_bytes = response.read()
                mime_type = response.headers.get('Content-Type', '')
                if not mime_type or not mime_type.startswith('image/'):
                    mime_type = _detect_mime_type(image_bytes)
                return mime_type, image_bytes
        except Exception as python_err:
            raise RuntimeError(
                f"Browser download failed: {browser_err}. "
                f"Python fallback failed: {python_err}"
            )


async def _download_candidates(
    page, urls: list[str], base_url: str
) -> tuple[list[tuple], list[str]]:
    """Download up to BATCH_SIZE images, filter by resolution & validity.

    Returns (candidates, log_lines).  Each candidate is
    (absolute_url, mime_type, image_bytes, width, height).
    """
    candidates: list[tuple] = []
    log_lines: list[str] = []
    sem = asyncio.Semaphore(DOWNLOAD_CONCURRENCY)
    lock = asyncio.Lock()

    async def _try_download(url: str):
        # Defense-in-depth: skip URLs that don't look like images
        if not _is_likely_image_url(url):
            return

        async with lock:
            if state.is_full or url in state.downloaded_urls:
                return
        absolute_url = urllib.parse.urljoin(base_url, url)
        async with sem:
            logger.info("Downloading: %s", absolute_url)
            try:
                mime_type, image_bytes = await _download_single(page, absolute_url)
            except Exception as e:
                log_lines.append(f"  {absolute_url}: download failed — {e}")
                return

            is_valid, width, height = _validate_image(image_bytes)
            if not is_valid:
                log_lines.append(f"  {absolute_url}: corrupted or invalid image")
                state.filter_stats["corrupt"] += 1
                return

            if width < MIN_IMAGE_DIM or height < MIN_IMAGE_DIM:
                log_lines.append(
                    f"  {absolute_url}: too small ({width}x{height} px)"
                )
                state.filter_stats["too_small"] += 1
                return

            async with lock:
                if state.is_full:
                    return
                state.downloaded_urls.add(url)
                candidates.append((absolute_url, mime_type, image_bytes, width, height))

    tasks = [_try_download(url) for url in urls[:BATCH_SIZE]]
    await asyncio.gather(*tasks)
    return candidates, log_lines
