import os
import re
import sys
import json
import base64
import asyncio
import logging
import urllib.parse
import urllib.request
from io import BytesIO

from dotenv import load_dotenv
from PIL import Image
from openai import OpenAI
from browser_use.llm.openai.chat import ChatOpenAI
from browser_use import Agent, Browser, Controller, ActionResult, BrowserSession

# Load environment variables
load_dotenv()

# Logging setup
class _ImmediateFileHandler(logging.FileHandler):
    """File handler that flushes immediately after every log record."""
    def emit(self, record):
        super().emit(record)
        self.flush()

logger = logging.getLogger("refseeker")
logger.setLevel(logging.INFO)
logger.propagate = False  # don't duplicate to root logger

_fmt = logging.Formatter("%(asctime)s [%(levelname)s] %(message)s")

_ch = logging.StreamHandler()
_ch.setFormatter(_fmt)
logger.addHandler(_ch)

_fh = _ImmediateFileHandler("refseeker.log", mode="a", encoding="utf-8")
_fh.setFormatter(_fmt)
logger.addHandler(_fh)

# Initialize OpenAI client
api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    logger.critical("OPENAI_API_KEY environment variable is not set. Please add it to your .env file.")
    sys.exit(1)

openai_client = OpenAI(api_key=api_key)

# Global variables to track the state
query_name = ""
query_folder = ""
output_dir = ""
saved_count = 0
downloaded_urls = set()

# Initialize custom Controller
controller = Controller()

def sanitize_folder_name(name: str) -> str:
    """Sanitize the search query to create a valid folder name."""
    clean = re.sub(r'[\\/*?:"<>| ]', '_', name)
    clean = re.sub(r'_+', '_', clean)
    return clean.strip('_')

def detect_mime_type(image_bytes: bytes) -> str:
    """Detect image MIME type from magic numbers."""
    if image_bytes.startswith(b'\xff\xd8\xff'):
        return 'image/jpeg'
    elif image_bytes.startswith(b'\x89PNG\r\n\x1a\n'):
        return 'image/png'
    elif image_bytes.startswith(b'RIFF') and image_bytes[8:12] == b'WEBP':
        return 'image/webp'
    elif image_bytes.startswith(b'GIF87a') or image_bytes.startswith(b'GIF89a'):
        return 'image/gif'
    return 'image/jpeg'

def mime_to_ext(mime_type: str) -> str:
    """Map MIME type to file extension."""
    mapping = {
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
        'image/gif': 'gif',
    }
    return mapping.get(mime_type.lower(), 'jpg')


def resize_for_api(image_bytes: bytes, max_dim: int = 768) -> tuple[bytes, str]:
    """Resize image to max_dim on longest side for API calls.

    Returns (resized_bytes, 'image/jpeg'). Keeps original bytes for saving untouched.
    If already small enough, returns original bytes (caller should use original mime type).
    """
    img = Image.open(BytesIO(image_bytes))
    w, h = img.size
    if w <= max_dim and h <= max_dim:
        return image_bytes, 'image/jpeg'
    if w > h:
        new_w, new_h = max_dim, int(h * max_dim / w)
    else:
        new_h, new_w = max_dim, int(w * max_dim / h)
    img = img.resize((new_w, new_h), Image.LANCZOS)
    buf = BytesIO()
    img.save(buf, format='JPEG', quality=85)
    return buf.getvalue(), 'image/jpeg'

def parse_data_url(data_url: str) -> tuple[str, bytes]:
    """Parse base64 data URL to mime type and bytes."""
    match = re.match(r'^data:([^;]+);base64,(.+)$', data_url)
    if not match:
        raise ValueError("Invalid data URL format")
    mime_type = match.group(1)
    base64_data = match.group(2)
    image_bytes = base64.b64decode(base64_data)
    return mime_type, image_bytes

async def download_image_bytes(page, url: str) -> tuple[str, bytes]:
    """Download image bytes from relative/absolute URL or data URL."""
    if url.startswith("data:"):
        return parse_data_url(url)

    # Get current page URL for resolving relative URLs
    try:
        base_url = await page.evaluate("() => window.location.href")
    except Exception:
        base_url = ""
    absolute_url = urllib.parse.urljoin(base_url, url)

    # Method A: Download inside browser page (bypasses CORS)
    try:
        data_url = await page.evaluate("""
            (targetUrl) => fetch(targetUrl)
                .then(response => {
                    if (!response.ok) throw new Error('HTTP error! status: ' + response.status);
                    return response.blob();
                })
                .then(blob => new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.onerror = () => reject(new Error('Failed to read blob as data URL'));
                    reader.readAsDataURL(blob);
                }))
        """, absolute_url)
        return parse_data_url(data_url)
    except Exception as browser_err:
        # Method B: Fallback using Python standard library
        try:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
            req = urllib.request.Request(absolute_url, headers=headers)
            with urllib.request.urlopen(req, timeout=10) as response:
                image_bytes = response.read()
                mime_type = response.headers.get('Content-Type', '')
                if not mime_type or not mime_type.startswith('image/'):
                    mime_type = detect_mime_type(image_bytes)
                return mime_type, image_bytes
        except Exception as python_err:
            raise RuntimeError(f"Browser download failed: {browser_err}. Python fallback failed: {python_err}")

@controller.action('Collect all images from current page: extract URLs, download, verify via GPT, and save approved')
async def get_page_image_urls(browser_session: BrowserSession) -> ActionResult:
    """Extracts all image URLs from the current page, auto-downloads, verifies quality via GPT, and saves approved images."""
    global saved_count, downloaded_urls, output_dir, query_name

    if saved_count >= 30:
        return ActionResult(extracted_content="Target of 30 images already reached.")

    try:
        page = await browser_session.must_get_current_page()
    except Exception as e:
        return ActionResult(error=f"Failed to access page: {e}")

    # Resolve base URL for relative links
    try:
        current_base_url = await page.evaluate("() => window.location.href")
    except Exception:
        current_base_url = ""

    # Step 1: Extract all image URLs (handles lazy-load, srcset, picture, CSS bg)
    await page.evaluate('() => window.scrollTo(0, document.body.scrollHeight)')
    await asyncio.sleep(0.5)
    await page.evaluate('() => window.scrollTo(0, 0)')

    raw = await page.evaluate(r'''() => {
        const result = new Set();
        document.querySelectorAll('img').forEach(img => {
            const c = [img.src, img.getAttribute('src'), img.dataset.src, img.dataset.lazySrc, img.dataset.original, img.dataset.url, img.dataset.image];
            c.forEach(s => { if (s && !s.startsWith('data:image/svg')) result.add(s); });
            if (img.srcset) img.srcset.split(',').forEach(s => { const u = s.trim().split(/\s+/)[0]; if (u) result.add(u); });
        });
        document.querySelectorAll('source').forEach(el => {
            if (el.srcset) el.srcset.split(',').forEach(s => { const u = s.trim().split(/\s+/)[0]; if (u) result.add(u); });
            if (el.src) result.add(el.src);
            if (el.dataset.src) result.add(el.dataset.src);
            if (el.dataset.srcset) el.dataset.srcset.split(',').forEach(s => { const u = s.trim().split(/\s+/)[0]; if (u) result.add(u); });
        });
        document.querySelectorAll('*').forEach(el => {
            try { const bg = window.getComputedStyle(el).backgroundImage;
                if (bg && bg !== 'none') bg.match(/url\(["']?([^"')]+)["']?\)/g)?.forEach(m => { const u = m.replace(/url\(["']?|["']?\)/g, ''); if (u && !u.startsWith('data:')) result.add(u); });
            } catch(e) {}
        });
        return Array.from(result);
    }''')

    urls = json.loads(raw) if raw else []
    unique_urls = list(dict.fromkeys(urls))
    if not unique_urls:
        return ActionResult(extracted_content="No image URLs found on this page.")

    logger.info(f"Found {len(unique_urls)} image URLs on page. Auto-downloading and verifying...")

    # Step 2: Download and check resolution
    candidates = []
    results = []

    for url in unique_urls[:50]:
        if saved_count >= 30:
            break
        if url in downloaded_urls:
            continue

        absolute_url = urllib.parse.urljoin(current_base_url, url)
        logger.info(f"[Auto] Downloading: {absolute_url}...")
        try:
            mime_type, image_bytes = await download_image_bytes(page, absolute_url)
        except Exception as e:
            results.append(f"  download failed: {absolute_url} — {e}")
            continue

        try:
            img = Image.open(BytesIO(image_bytes))
            width, height = img.size
            if width < 300 or height < 300:
                results.append(f"  too small: {absolute_url} ({width}x{height} px)")
                continue
        except Exception as e:
            results.append(f"  invalid image: {absolute_url} — {e}")
            continue

        candidates.append((absolute_url, mime_type, image_bytes, width, height))
        downloaded_urls.add(url)

    if not candidates:
        return ActionResult(extracted_content="No valid candidates after filtering.\n" + "\n".join(results))

    # Step 3: Send ALL candidates to GPT-4o mini in a single vision call
    logger.info(f"Sending {len(candidates)} images to GPT-4o mini for verification...")

    prompt = f"""You are checking if images are suitable as high-quality reference photos for: "{query_name}".

There are {len(candidates)} images attached. For EACH image, determine:
1. Is it relevant to "{query_name}"?
2. Is it high quality (sharp, detailed, not blurry, not pixelated)?
3. Is it watermarked or does it contain prominent text overlays (excluding tiny photographer signatures)?
4. Based on the content of the image, assign it to a logical category describing what part or aspect of the subject is shown (e.g. "landing_gear", "cockpit", "wing", "engine", "overview"). Be specific but concise — use lowercase_latin_with_underscores. If unsure, use "other".

Respond ONLY with a JSON object containing an "evaluations" array. One object per image, in the SAME order:

{{
    "evaluations": [
        {{
            "index": 0,
            "relevant": true,
            "high_quality": true,
            "watermarked": false,
            "category": "landing_gear",
            "reason": "clear shot of landing gear struts and wheel"
        }}
    ]
}}"""

    content = [{"type": "text", "text": prompt}]
    for _, mime_type, image_bytes, _, _ in candidates:
        api_bytes, api_mime = resize_for_api(image_bytes)
        b64 = base64.b64encode(api_bytes).decode('utf-8')
        content.append({
            "type": "image_url",
            "image_url": {"url": f"data:{api_mime};base64,{b64}"}
        })

    # Retry with exponential backoff on rate limit
    max_retries = 3
    response = None
    for attempt in range(max_retries):
        try:
            response = openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": content}],
                max_tokens=2000,
                response_format={"type": "json_object"}
            )
            break
        except Exception as e:
            if attempt < max_retries - 1 and ("rate_limit" in str(e).lower() or "429" in str(e)):
                wait = 2 ** (attempt + 2)
                logger.warning(f"GPT rate limited, retrying in {wait}s ({attempt + 2}/{max_retries})...")
                await asyncio.sleep(wait)
            else:
                raise

    if response is None:
        return ActionResult(error="GPT API call failed after all retries")

    # Step 4: Process GPT evaluation and save approved images
    try:
        raw_content = response.choices[0].message.content
        if not raw_content or not raw_content.strip():
            return ActionResult(error="GPT returned empty response")

        parsed = json.loads(raw_content)
        evaluations = parsed.get("evaluations", parsed if isinstance(parsed, list) else [])
        if not evaluations:
            return ActionResult(extracted_content="GPT returned no evaluations.\n" + "\n".join(results))

        saved_this_batch = 0
        for eval_item in evaluations:
            idx = eval_item.get("index")
            if idx is None or idx >= len(candidates):
                continue

            url, mime_type, image_bytes, width, height = candidates[idx]
            relevant = eval_item.get("relevant", False)
            high_quality = eval_item.get("high_quality", False)
            watermarked = eval_item.get("watermarked", False)
            reason = eval_item.get("reason", "")

            if not relevant:
                results.append(f"  {url}: not relevant — {reason}")
            elif not high_quality:
                results.append(f"  {url}: low quality — {reason}")
            elif watermarked:
                results.append(f"  {url}: watermarked — {reason}")
            else:
                saved_count += 1
                saved_this_batch += 1
                category = eval_item.get("category", "other") or "other"
                category_dir = os.path.join(output_dir, sanitize_folder_name(category))
                try:
                    os.makedirs(category_dir, exist_ok=True)
                    ext = mime_to_ext(mime_type)
                    file_name = f"image_{saved_count}.{ext}"
                    file_path = os.path.join(category_dir, file_name)
                    with open(file_path, 'wb') as f:
                        f.write(image_bytes)
                    results.append(f"  {url}: SAVED ({saved_count}/30) [{category}] — {reason}")
                    logger.info(f"Saved image {saved_count}/30 -> {file_path}")
                except OSError as e:
                    results.append(f"  {url}: FAILED TO SAVE — {e}")
                    saved_count -= 1
                    saved_this_batch -= 1
                if saved_count >= 30:
                    break

        return ActionResult(
            extracted_content=f"Collected {len(candidates)} candidates, saved {saved_this_batch} new images (total {saved_count}/30):\n"
            + "\n".join(results)
        )

    except json.JSONDecodeError as e:
        logger.error(f"GPT returned invalid JSON: {e}")
        return ActionResult(error=f"GPT returned invalid JSON: {e}")
    except Exception as e:
        logger.error(f"Image collection failed: {e}", exc_info=True)
        return ActionResult(error=f"Image collection failed: {e}")

@controller.action('Extract links to sub-pages that may contain images')
async def extract_subpage_links(browser_session: BrowserSession) -> ActionResult:
    """Finds links on the current page pointing to sub-pages likely containing images."""
    try:
        page = await browser_session.must_get_current_page()
        raw = await page.evaluate('''() => {
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
        }''')
        links = json.loads(raw) if raw else []
        if not links:
            return ActionResult(extracted_content="No sub-page links found on this page.")
        text = "Sub-pages found:\n" + "\n".join(f"  {l['href']} ({l['text']})" for l in links)
        logger.info(f"Found {len(links)} sub-page links on current page")
        return ActionResult(extracted_content=text)
    except Exception as e:
        logger.error(f"Failed to extract sub-page links: {e}")
        return ActionResult(error=f"Failed to extract sub-page links: {e}")

@controller.action('Download and verify multiple images in batch')
async def batch_download_and_verify(image_urls_json: str, browser_session: BrowserSession) -> ActionResult:
    """Downloads multiple images, checks resolution, sends ALL to GPT-4o mini in one call, saves approved."""
    global saved_count, downloaded_urls, output_dir, query_name

    if saved_count >= 30:
        return ActionResult(extracted_content="Target of 30 images already reached. No more images needed.")

    try:
        image_urls = json.loads(image_urls_json)
        if not isinstance(image_urls, list):
            return ActionResult(error="Expected a JSON array of URL strings.")
    except json.JSONDecodeError as e:
        return ActionResult(error=f"Invalid JSON array: {e}")

    if not image_urls:
        return ActionResult(extracted_content="No URLs provided.")

    try:
        page = await browser_session.must_get_current_page()
    except Exception as e:
        return ActionResult(error=f"Failed to access active page context: {e}")

    try:
        current_base_url = await page.evaluate("() => window.location.href")
    except Exception:
        current_base_url = ""
        logger.warning("Could not get current page URL, relative URLs may not resolve correctly")

    candidates = []
    results = []

    for url in image_urls[:50]:
        if saved_count >= 30:
            break
        if url in downloaded_urls:
            continue

        absolute_url = urllib.parse.urljoin(current_base_url, url)
        logger.info(f"[Batch] Downloading: {absolute_url}...")

        try:
            mime_type, image_bytes = await download_image_bytes(page, absolute_url)
        except Exception as e:
            logger.error(f"[Batch] Download failed: {absolute_url} — {e}")
            results.append(f"  {absolute_url}: download failed — {e}")
            continue

        try:
            img = Image.open(BytesIO(image_bytes))
            width, height = img.size
            if width < 300 or height < 300:
                logger.warning(f"[Batch] Too small: {absolute_url} ({width}x{height} px)")
                results.append(f"  {absolute_url}: too small ({width}x{height} px)")
                continue
        except Exception as e:
            logger.warning(f"[Batch] Invalid image data: {absolute_url} — {e}")
            results.append(f"  {absolute_url}: invalid image data")
            continue

        candidates.append((absolute_url, mime_type, image_bytes, width, height))
        downloaded_urls.add(url)

    if not candidates:
        return ActionResult(extracted_content="No valid candidates after filtering.\n" + "\n".join(results))

    logger.info(f"Sending {len(candidates)} images (resized to 768px) to GPT-4o mini in one call...")

    prompt = f"""You are checking if images are suitable as high-quality reference photos for: "{query_name}".

There are {len(candidates)} images attached. For EACH image, determine:
1. Is it relevant to "{query_name}"?
2. Is it high quality (sharp, detailed, not blurry, not pixelated)?
3. Is it watermarked or does it contain prominent text overlays (excluding tiny photographer signatures)?
4. Based on the content of the image, assign it to a logical category describing what part or aspect of the subject is shown (e.g. "landing_gear", "cockpit", "wing", "engine", "overview"). Be specific but concise — use lowercase_latin_with_underscores. If unsure, use "other".

Respond ONLY with a JSON object containing an "evaluations" array. One object per image, in the SAME order:

{{
    "evaluations": [
        {{
            "index": 0,
            "relevant": true,
            "high_quality": true,
            "watermarked": false,
            "category": "landing_gear",
            "reason": "clear shot of landing gear struts and wheel"
        }}
    ]
}}"""

    content = [{"type": "text", "text": prompt}]
    for _, mime_type, image_bytes, _, _ in candidates:
        api_bytes, api_mime = resize_for_api(image_bytes)
        b64 = base64.b64encode(api_bytes).decode('utf-8')
        content.append({
            "type": "image_url",
            "image_url": {"url": f"data:{api_mime};base64,{b64}"}
        })

    max_retries = 3
    response = None
    for attempt in range(max_retries):
        try:
            response = openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": content}],
                max_tokens=2000,
                response_format={"type": "json_object"}
            )
            break
        except Exception as e:
            if attempt < max_retries - 1 and ("rate_limit" in str(e).lower() or "429" in str(e)):
                wait = 2 ** (attempt + 2)
                logger.warning(f"GPT API rate limited, retrying in {wait}s (attempt {attempt + 2}/{max_retries})...")
                await asyncio.sleep(wait)
            else:
                raise

    if response is None:
        return ActionResult(error="GPT API call failed after all retries")

    try:
        raw_content = response.choices[0].message.content
        if not raw_content or not raw_content.strip():
            logger.error("GPT returned empty response")
            return ActionResult(error="GPT returned empty response")

        parsed = json.loads(raw_content)
        evaluations = parsed.get("evaluations", parsed if isinstance(parsed, list) else [])

        if not evaluations:
            logger.warning("GPT returned no evaluations — all images rejected or response malformed")
            return ActionResult(extracted_content="GPT returned no evaluations.\n" + "\n".join(results))

        seen_indices = set()
        for eval_item in evaluations:
            idx = eval_item.get("index")
            if idx is not None:
                if idx in seen_indices:
                    logger.warning(f"Duplicate index {idx} in GPT evaluations — skipping")
                    continue
                seen_indices.add(idx)

        for eval_item in evaluations:
            idx = eval_item.get("index")
            if idx is None or idx >= len(candidates):
                logger.debug(f"Skipping evaluation with missing/out-of-range index: {eval_item}")
                continue

            url, mime_type, image_bytes, width, height = candidates[idx]
            relevant = eval_item.get("relevant", False)
            high_quality = eval_item.get("high_quality", False)
            watermarked = eval_item.get("watermarked", False)
            reason = eval_item.get("reason", "")

            if not isinstance(relevant, bool) or not isinstance(high_quality, bool) or not isinstance(watermarked, bool):
                logger.warning(f"Unexpected types in GPT evaluation for index {idx}")

            if not relevant:
                results.append(f"  {url}: not relevant — {reason}")
            elif not high_quality:
                results.append(f"  {url}: low quality — {reason}")
            elif watermarked:
                results.append(f"  {url}: watermarked — {reason}")
            else:
                saved_count += 1
                category = eval_item.get("category", "other") or "other"
                category_dir = os.path.join(output_dir, sanitize_folder_name(category))
                try:
                    os.makedirs(category_dir, exist_ok=True)
                    ext = mime_to_ext(mime_type)
                    file_name = f"image_{saved_count}.{ext}"
                    file_path = os.path.join(category_dir, file_name)
                    with open(file_path, 'wb') as f:
                        f.write(image_bytes)
                    results.append(f"  {url}: SAVED ({saved_count}/30) [{category}] — {reason}")
                    logger.info(f"Saved image {saved_count}/30 to {file_path}")
                except OSError as e:
                    logger.error(f"Failed to save image {saved_count} to {category_dir}: {e}")
                    results.append(f"  {url}: FAILED TO SAVE — {e}")
                    saved_count -= 1
                if saved_count >= 30:
                    break

        return ActionResult(extracted_content="Batch complete:\n" + "\n".join(results))

    except json.JSONDecodeError as e:
        logger.error(f"GPT returned invalid JSON: {e}")
        return ActionResult(error=f"GPT returned invalid JSON: {e}")
    except Exception as e:
        logger.error(f"Batch verification failed: {e}", exc_info=True)
        return ActionResult(error=f"Batch verification failed: {e}")

async def run_agent(query: str):
    global query_name, query_folder, output_dir, saved_count

    query_name = query
    query_folder = sanitize_folder_name(query)
    output_dir = os.path.join(".", "references", query_folder)
    os.makedirs(output_dir, exist_ok=True)
    # Reset downloaded_urls for each run
    downloaded_urls.clear()
    saved_count = 0

    # Configure Browser
    browser = Browser(headless=False, disable_security=True, enable_default_extensions=True)
    llm = ChatOpenAI(model="gpt-4o-mini")

    # Ask user if they want to improve the search query
    base_search_query = f"{query}"
    logger.info(f"Original search query: \"{base_search_query}\"")
    print("Do you want to improve/expand the search query, or keep it as-is?")
    choice = input("Enter 'y' to improve, anything else to keep as-is: ").strip().lower()

    search_query = base_search_query
    if choice == 'y':
        logger.info("Asking GPT-4o mini to improve the search query...")
        try:
            resp = openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{
                    "role": "user",
                    "content": (
                        f"I am searching for reference photos of \"{query}\". "
                        f"Improve and expand this search query to get better, more diverse results. "
                        f"Return ONLY the improved search query string, nothing else. "
                        f"The original format is: \"{query} reference photos high quality\". "
                        f"Make it better for finding diverse, high-quality reference images."
                    )
                }],
                max_tokens=100
            )
            improved = resp.choices[0].message.content.strip().strip('"\'')
            if improved:
                logger.info(f"Improved query: \"{improved}\"")
                search_query = improved
            else:
                logger.warning("Got empty response from GPT, using original query.")
        except Exception as e:
            logger.error(f"Failed to improve query: {e}. Using original.")

    logger.info(f"Final search query: \"{search_query}\"")

    # Load whitelist and blacklist from config
    whitelist = []
    blacklist = []
    try:
        with open("config.json", "r") as f:
            config = json.load(f)
            whitelist = [d.strip().lower() for d in config.get("whitelist", []) if d.strip()]
            blacklist = [d.strip().lower() for d in config.get("blacklist", []) if d.strip()]
    except FileNotFoundError:
        logger.warning("config.json not found, no site filters applied.")
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse config.json: {e}")

    site_instructions = ""
    if whitelist:
        site_instructions += f"\nPREFERRED SITES (search these first, prioritize them): {', '.join(whitelist)}"
    if blacklist:
        site_instructions += f"\nBLACKLIST (STRICTLY AVOID these sites): {', '.join(blacklist)}"

    task = f"""Search for: "{search_query}"
Goal: Collect 10-30 high-quality reference images of "{query}".

EXECUTION ORDER (follow exactly on every page):
1. Start at google.com, search for "{search_query}". Click through to image results.
2. On EVERY page: call `get_page_image_urls` IMMEDIATELY. Do NOT scroll, wait, or refresh first. This one action extracts all URLs, downloads, checks resolution, verifies via GPT-4o vision, and saves approved images with categories.
3. Then call `extract_subpage_links`. If sub-pages exist, visit each and repeat step 2.
4. Blacklisted sites (NEVER visit): {', '.join(blacklist) if blacklist else 'none'}
{site_instructions}
5. Stop once 10+ images are saved. Call `done` with a summary of what was found and saved.
6. If a page has no images or errors occur 3+ times in a row, leave and try a different site.
7. Dismiss any popup/cookie banners that block page content."""

    logger.info(f"Starting reference downloader agent...")
    logger.info(f"Query: {query}")
    logger.info(f"Target directory: {output_dir}")
    logger.info(f"Formatted Search Query: {search_query}")

    agent = Agent(
        task=task,
        llm=llm,
        browser=browser,
        controller=controller,
        use_vision=False,
        max_history_items=10,
        flash_mode=True
    )

    try:
        await agent.run()
    except Exception as e:
        logger.error(f"Agent run failed: {e}", exc_info=True)
    finally:
        await browser.close()
        logger.info(f"Finished. Total images saved: {saved_count}")

def main():
    try:
        query = input("Enter search query for reference images (e.g., 'vintage typewriter'): ").strip()
        if not query:
            logger.error("Search query cannot be empty.")
            sys.exit(1)

        asyncio.run(run_agent(query))
    except KeyboardInterrupt:
        logger.info("Process interrupted by user.")
    except Exception as e:
        logger.critical(f"Unexpected error: {e}", exc_info=True)

if __name__ == "__main__":
    main()
