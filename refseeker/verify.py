# ── Gemini 2.5 Flash: vision verification ──────────────────────────

import asyncio
import io
import json
import os

import PIL.Image
import google.generativeai as genai

from .config import (
    GPT_MAX_TOKENS_BASE,
    GPT_MAX_TOKENS_PER_IMAGE,
    GEMINI_API_KEY,
    IMAGE_BLACKLIST,
    logger,
)
from .image import (
    _check_disk_space,
    _mime_to_ext,
)
from .state import state

genai.configure(api_key=GEMINI_API_KEY)
_model = None


def _get_model():
    global _model
    if _model is None:
        _model = genai.GenerativeModel("gemini-2.5-flash")
    return _model


async def _verify_and_save(candidates: list[tuple]) -> list[str]:
    """Send candidates to Gemini 2.5 Flash, save approved images, return log lines."""
    log_lines: list[str] = []

    if not candidates:
        return log_lines

    logger.info(
        "Sending %d images to Gemini 2.5 Flash for verification ...", len(candidates)
    )
    model = _get_model()

    # Build prompt with optional image content blacklist
    blacklist_section = ""
    blacklist_field = ""
    if IMAGE_BLACKLIST:
        items = ", ".join(IMAGE_BLACKLIST)
        blacklist_section = (
            f'4. Does it contain any of the following unwanted content: {items}?\n'
        )
        blacklist_field = f'"unwanted_content": false, '

    prompt = (
        f'You are checking if images are suitable as high-quality reference photos for: '
        f'"{state.query_name}".\n\n'
        f'There are {len(candidates)} images attached. For EACH image, determine:\n'
        f'1. Is it relevant to "{state.query_name}"?\n'
        f'2. Is it high quality (sharp, detailed, not blurry, not pixelated)?\n'
        f'3. Is it watermarked or does it contain prominent text overlays '
        f'(excluding tiny photographer signatures)?\n'
        f'{blacklist_section}'
        f'Respond ONLY with a JSON object containing an "evaluations" array. '
        f'One object per image, in the SAME order. '
        f'Keep each reason under 5 words.\n\n'
        f'{{"evaluations": [{{"index": 0, "relevant": true, "high_quality": true, '
        f'"watermarked": false, '
        f'{blacklist_field}'
        f'"reason": "clear side view"}}]}}'
    )

    pil_images = []
    for _, _, image_bytes, _, _ in candidates:
        pil_images.append(PIL.Image.open(io.BytesIO(image_bytes)))

    max_tokens = min(
        8192,
        GPT_MAX_TOKENS_BASE + len(candidates) * GPT_MAX_TOKENS_PER_IMAGE,
    )
    max_retries = 3

    state.gpt_calls += 1
    for attempt in range(max_retries):
        try:
            response = model.generate_content(
                [prompt] + pil_images,
                generation_config=genai.GenerationConfig(
                    response_mime_type="application/json",
                    max_output_tokens=max_tokens,
                ),
            )
            raw_content = response.text
            break
        except Exception as e:
            err_str = str(e).lower()
            should_retry = (
                "rate_limit" in err_str
                or "429" in err_str
                or "500" in err_str
                or "502" in err_str
                or "timeout" in err_str
                or "quota" in err_str
            )
            if attempt < max_retries - 1 and should_retry:
                wait = 2 ** (attempt + 2)
                logger.warning(
                    "Gemini API error, retrying in %ds (%d/%d): %s",
                    wait,
                    attempt + 2,
                    max_retries,
                    e,
                )
                await asyncio.sleep(wait)
            else:
                logger.warning(
                    "Gemini API call failed (%d/%d): %s",
                    attempt + 1, max_retries, e,
                )
                log_lines.append(f"  Gemini API call failed: {e}")
                return log_lines

    print("Gemini RAW:", raw_content[:500], flush=True)

    if not raw_content or not raw_content.strip():
        log_lines.append("  Gemini returned empty response")
        return log_lines

    try:
        parsed = json.loads(raw_content)
    except json.JSONDecodeError as e:
        logger.error("Gemini returned invalid JSON: %s", e)
        log_lines.append(f"  Gemini returned invalid JSON: {e}")
        return log_lines

    evaluations = parsed.get("evaluations", parsed if isinstance(parsed, list) else [])
    if not evaluations:
        log_lines.append("  Gemini returned no evaluations")
        return log_lines

    seen_indices: set[int] = set()
    for eval_item in evaluations:
        idx = eval_item.get("index")
        if idx is not None:
            if idx in seen_indices:
                logger.warning("Duplicate index %d in Gemini evaluations — skipping", idx)
                continue
            seen_indices.add(idx)

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
            state.filter_stats["not_relevant"] += 1
            log_lines.append(f"  {url}: not relevant — {reason}")
        elif not high_quality:
            state.filter_stats["low_quality"] += 1
            log_lines.append(f"  {url}: low quality — {reason}")
        elif watermarked:
            state.filter_stats["watermarked"] += 1
            log_lines.append(f"  {url}: watermarked — {reason}")
        elif eval_item.get("unwanted_content", False):
            state.filter_stats["unwanted_content"] += 1
            log_lines.append(f"  {url}: unwanted content — {reason}")
        else:
            if not _check_disk_space(state.output_dir):
                log_lines.append(f"  {url}: SKIPPED — low disk space")
                break
            state.saved_count += 1
            try:
                ext = _mime_to_ext(mime_type)
                file_name = f"image_{state.saved_count}.{ext}"
                file_path = os.path.join(state.output_dir, file_name)
                with open(file_path, "wb") as f:
                    f.write(image_bytes)
                log_lines.append(
                    f"  {url}: SAVED ({state.saved_count}/{state.max_images}) — {reason}"
                )
                logger.info("Saved image %d/%d -> %s", state.saved_count, state.max_images, file_path)
            except OSError as e:
                logger.error("Failed to save image %d: %s", state.saved_count + 1, e)
                log_lines.append(f"  {url}: FAILED TO SAVE — {e}")
                state.saved_count -= 1

            if state.is_full:
                break

    return log_lines
