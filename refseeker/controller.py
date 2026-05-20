import asyncio
import json
import re
import urllib.parse

from browser_use import ActionResult, BrowserSession, Controller

from .config import MAX_IMAGES, SCROLL_DELAY, SCROLL_STEPS, logger
from .download import _download_candidates
from .image import _is_likely_image_url
from .state import state
from .verify import _verify_and_save

# Skip downloads for known junk URLs before they hit the pipeline
_JUNK_URL_RE = re.compile(
    r'ebayimg\.com|amazon\.|paypal|banner|placeholder|'
    r'pixel[^s]|spacer|beacon|data:image/gif',
    re.IGNORECASE,
)

controller = Controller()


@controller.action(
    "Collect all images from current page: extract URLs, download, verify via GPT, and save approved"
)
async def get_page_image_urls(browser_session: BrowserSession) -> ActionResult:
    if state.is_full:
        return ActionResult(
            extracted_content=f"Target of {MAX_IMAGES} images already reached."
        )

    try:
        page = await browser_session.must_get_current_page()
    except Exception as e:
        return ActionResult(error=f"Failed to access page: {e}")

    try:
        current_base_url = await page.evaluate("() => window.location.href")
    except Exception:
        current_base_url = ""

    if current_base_url:
        state.current_page_url = current_base_url
        state.visited_pages.append(current_base_url)
        logger.info("Page URL: %s", current_base_url)
        domain = urllib.parse.urlparse(current_base_url).netloc
        if domain not in state.visited_domains:
            state.visited_domains.add(domain)
            state.total_sites_attempted += 1

    for _ in range(SCROLL_STEPS):
        await page.evaluate("() => window.scrollBy(0, document.body.scrollHeight / 4)")
        await asyncio.sleep(SCROLL_DELAY)
    state.total_pages_scrolled += SCROLL_STEPS
    await page.evaluate("() => window.scrollTo(0, 0)")

    raw = await page.evaluate(r"""() => {
        const result = new Set();
        document.querySelectorAll('img').forEach(img => {
            const c = [img.src, img.getAttribute('src'), img.dataset.src,
                       img.dataset.lazySrc, img.dataset.original,
                       img.dataset.url, img.dataset.image];
            c.forEach(s => { if (s && !s.startsWith('data:image/svg')) result.add(s); });
            if (img.srcset) img.srcset.split(',').forEach(s => {
                const u = s.trim().split(/\s+/)[0]; if (u) result.add(u);
            });
        });
        document.querySelectorAll('source').forEach(el => {
            if (el.srcset) el.srcset.split(',').forEach(s => {
                const u = s.trim().split(/\s+/)[0]; if (u) result.add(u);
            });
            if (el.src) result.add(el.src);
            if (el.dataset.src) result.add(el.dataset.src);
            if (el.dataset.srcset) el.dataset.srcset.split(',').forEach(s => {
                const u = s.trim().split(/\s+/)[0]; if (u) result.add(u);
            });
        });
        document.querySelectorAll('*').forEach(el => {
            try {
                const tag = el.tagName.toLowerCase();
                if (['script','style','meta','link','noscript','iframe'].includes(tag)) return;
                const style = window.getComputedStyle(el);
                if (style.display === 'none' || style.visibility === 'hidden') return;
                const bg = style.backgroundImage;
                if (bg && bg !== 'none') bg.match(/url\(["']?([^"')]+)["']?\)/g)?.forEach(m => {
                    const u = m.replace(/url\(["']?|["']?\)/g, '');
                    if (u && !u.startsWith('data:')) result.add(u);
                });
            } catch(e) {}
        });
        return Array.from(result).filter(u => u.length > 5 && (u.includes('.') || u.includes('/')));
    }""")

    # page.evaluate returns str (JSON-stringified for arrays).
    try:
        urls: list[str] = json.loads(raw) if raw else []
    except (json.JSONDecodeError, TypeError) as e:
        logger.warning("Failed to parse page.evaluate result as JSON: %s", e)
        logger.debug("Raw evaluate result (first 200 chars): %s", raw[:200])
        urls = []

    unique_urls = list(dict.fromkeys(urls))
    image_urls = [u for u in unique_urls if _is_likely_image_url(u) and not _JUNK_URL_RE.search(u)]
    skipped = len(unique_urls) - len(image_urls)
    if skipped:
        logger.info("Filtered out %d non-image URLs (missing extension / too short)", skipped)
        logger.debug("Skipped URLs: %s", unique_urls[:min(skipped, 10)])
    logger.debug("Extracted %d image candidate URLs: %s", len(image_urls), image_urls[:15])
    if not image_urls:
        return ActionResult(extracted_content="No image URLs found on this page.")

    logger.info("Found %d image URLs on page. Auto-downloading and verifying ...", len(image_urls))

    candidates, download_log = await _download_candidates(page, image_urls, current_base_url)
    results = list(download_log)

    if not candidates:
        return ActionResult(
            extracted_content="No valid candidates after filtering.\n" + "\n".join(results)
        )

    save_log = await _verify_and_save(candidates)
    results.extend(save_log)

    return ActionResult(
        extracted_content=f"Collected {len(candidates)} candidates"
        + (f", saved {state.saved_count}/{MAX_IMAGES}" if state.saved_count else "")
        + ":\n" + "\n".join(results)
    )


@controller.action("Extract links to sub-pages that may contain images")
async def extract_subpage_links(browser_session: BrowserSession) -> ActionResult:
    try:
        page = await browser_session.must_get_current_page()
    except Exception as e:
        return ActionResult(error=f"Failed to access page: {e}")

    try:
        raw = await page.evaluate("""() => {
            const isImageExt = path => /\\.(jpg|jpeg|png|gif|webp|svg|bmp|ico|pdf|zip|rar)$/i.test(path);
            const result = [];
            for (const a of document.querySelectorAll('a[href]')) {
                try {
                    const url = new URL(a.href, window.location.href);
                    if (url.hostname === window.location.hostname &&
                        url.href !== window.location.href &&
                        !isImageExt(url.pathname)) {
                        const text = (a.innerText || a.title || '').trim().substring(0, 60);
                        result.push({href: url.href, text: text});
                    }
                } catch(e) {}
            }
            return result;
        }""")
        # page.evaluate returns str (JSON-stringified). Parse it back to a list.
        try:
            links = json.loads(raw) if raw else []
        except (json.JSONDecodeError, TypeError) as e:
            logger.warning("Failed to parse sub-page links result: %s", e)
            links = []
        if not isinstance(links, list):
            logger.warning("Sub-page links result is not a list (%s), skipping", type(links).__name__)
            links = []
        if not links:
            return ActionResult(extracted_content="No sub-page links found on this page.")
        text = "Sub-pages found:\n" + "\n".join(
            f"  {l['href']} ({l['text']})" for l in links
        )
        logger.info("Found %d sub-page links on current page", len(links))
        return ActionResult(extracted_content=text)
    except Exception as e:
        logger.error("Failed to extract sub-page links: %s", e)
        return ActionResult(error=f"Failed to extract sub-page links: {e}")
