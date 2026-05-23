import os

import httpx

from .config import logger

SERPER_URL = "https://google.serper.dev/images"

_SERPER_CLIENT = httpx.Client(timeout=httpx.Timeout(15.0, connect=5.0))


def _get_serper_api_key() -> str:
    api_key = os.getenv("SERPER_API_KEY")
    if not api_key:
        logger.critical("SERPER_API_KEY is not set. Add it to your .env file.")
        raise RuntimeError("SERPER_API_KEY is not set")
    return api_key


def search_images(query: str, count: int = 100) -> list[str]:
    """Search for images via Serper API and return a list of image URLs.

    Args:
        query: Search query string.
        count: Number of results to request (max 100).

    Returns:
        List of image URLs returned by the API.
    """
    api_key = _get_serper_api_key()
    headers = {
        "X-API-KEY": api_key,
        "Content-Type": "application/json",
    }
    payload = {"q": query, "num": min(count, 100)}

    logger.info("Searching Serper images for: \"%s\" (num=%d)", query, count)

    try:
        resp = _SERPER_CLIENT.post(SERPER_URL, json=payload, headers=headers)
        resp.raise_for_status()
        data = resp.json()
    except httpx.HTTPError as e:
        logger.error("Serper API request failed: %s", e)
        return []

    items = data.get("images", [])
    urls = [item["imageUrl"] for item in items if item.get("imageUrl")]

    logger.info("Serper returned %d image URLs for \"%s\"", len(urls), query)
    return urls
