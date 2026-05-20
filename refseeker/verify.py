# ── GPT-4o mini: vision verification + categorisation (ONLY image work) ──────
# NOTE: agent navigation / planning uses DeepSeek (see agent.py).
#       This module stays on GPT-4o mini because DeepSeek does not support vision.

import asyncio
import base64
import json
import os

import httpx

from .client import get_openai_client
from .config import (
    GPT_MAX_TOKENS_BASE,
    GPT_MAX_TOKENS_PER_IMAGE,
    GPT_MODEL,
    GPT_TIMEOUT,
    MAX_IMAGES,
    logger,
)
from .image import (
    _check_disk_space,
    _mime_to_ext,
    _resize_for_api,
    _sanitize_folder_name,
)
from .state import state


async def _verify_and_save(candidates: list[tuple]) -> list[str]:
    """Send candidates to GPT-4o mini, save approved images, return log lines."""
    log_lines: list[str] = []

    if not candidates:
        return log_lines

    logger.info(
        "Sending %d images to GPT-4o mini for verification ...", len(candidates)
    )
    client = get_openai_client()

    prompt = (
        f'You are checking if images are suitable as high-quality reference photos for: '
        f'"{state.query_name}".\n\n'
        f'There are {len(candidates)} images attached. For EACH image, determine:\n'
        f'1. Is it relevant to "{state.query_name}"?\n'
        f'2. Is it high quality (sharp, detailed, not blurry, not pixelated)?\n'
        f'3. Is it watermarked or does it contain prominent text overlays '
        f'(excluding tiny photographer signatures)?\n'
        f'4. Based on the content of the image, assign it to a logical category '
        f'describing what part or aspect of the subject is shown '
        f'(e.g. "landing_gear", "cockpit", "wing", "engine", "overview"). '
        f'Be specific but concise — use lowercase_latin_with_underscores. '
        f'If unsure, use "other".\n\n'
        f'Respond ONLY with a JSON object containing an "evaluations" array. '
        f'One object per image, in the SAME order:\n\n'
        f'{{"evaluations": [{{"index": 0, "relevant": true, "high_quality": true, '
        f'"watermarked": false, "category": "landing_gear", '
        f'"reason": "clear shot of landing gear struts and wheel"}}]}}'
    )

    content: list[dict] = [{"type": "text", "text": prompt}]
    for _, mime_type, image_bytes, _, _ in candidates:
        api_bytes, api_mime = _resize_for_api(image_bytes)
        b64 = base64.b64encode(api_bytes).decode("utf-8")
        content.append({
            "type": "image_url",
            "image_url": {"url": f"data:{api_mime};base64,{b64}"},
        })

    max_tokens = min(
        4096,
        GPT_MAX_TOKENS_BASE + len(candidates) * GPT_MAX_TOKENS_PER_IMAGE,
    )
    max_retries = 3

    state.gpt_calls += 1
    for attempt in range(max_retries):
        try:
            response = client.chat.completions.create(
                model=GPT_MODEL,
                messages=[{"role": "user", "content": content}],
                max_tokens=max_tokens,
                response_format={"type": "json_object"},
                timeout=GPT_TIMEOUT,
            )
            break
        except Exception as e:
            err_str = str(e).lower()
            should_retry = (
                "rate_limit" in err_str
                or "429" in err_str
                or "500" in err_str
                or "502" in err_str
                or "timeout" in err_str
            )
            if attempt < max_retries - 1 and should_retry:
                wait = 2 ** (attempt + 2)
                logger.warning(
                    "GPT API error, retrying in %ds (%d/%d): %s",
                    wait,
                    attempt + 2,
                    max_retries,
                    e,
                )
                await asyncio.sleep(wait)
            else:
                logger.warning(
                    "GPT API call failed (%d/%d): %s",
                    attempt + 1, max_retries, e,
                )
                log_lines.append(f"  GPT API call failed: {e}")
                return log_lines

    raw_content = response.choices[0].message.content  # type: ignore[union-attr]
    if not raw_content or not raw_content.strip():
        log_lines.append("  GPT returned empty response")
        return log_lines

    try:
        parsed = json.loads(raw_content)
    except json.JSONDecodeError as e:
        logger.error("GPT returned invalid JSON: %s", e)
        log_lines.append(f"  GPT returned invalid JSON: {e}")
        return log_lines

    evaluations = parsed.get("evaluations", parsed if isinstance(parsed, list) else [])
    if not evaluations:
        log_lines.append("  GPT returned no evaluations")
        return log_lines

    seen_indices: set[int] = set()
    for eval_item in evaluations:
        idx = eval_item.get("index")
        if idx is not None:
            if idx in seen_indices:
                logger.warning("Duplicate index %d in GPT evaluations — skipping", idx)
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
        else:
            if not _check_disk_space(state.output_dir):
                log_lines.append(f"  {url}: SKIPPED — low disk space")
                break
            state.saved_count += 1
            category = (eval_item.get("category") or "other").strip()
            if not category:
                category = "other"
            category_dir = os.path.join(state.output_dir, _sanitize_folder_name(category))
            try:
                os.makedirs(category_dir, exist_ok=True)
                ext = _mime_to_ext(mime_type)
                file_name = f"image_{state.saved_count}.{ext}"
                file_path = os.path.join(category_dir, file_name)
                with open(file_path, "wb") as f:
                    f.write(image_bytes)
                log_lines.append(
                    f"  {url}: SAVED ({state.saved_count}/{MAX_IMAGES}) "
                    f"[{category}] — {reason}"
                )
                logger.info("Saved image %d/%d -> %s", state.saved_count, MAX_IMAGES, file_path)
            except OSError as e:
                logger.error("Failed to save image %d: %s", state.saved_count + 1, e)
                log_lines.append(f"  {url}: FAILED TO SAVE — {e}")
                state.saved_count -= 1

            if state.is_full:
                break

    return log_lines
