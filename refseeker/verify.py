# ── Gemini 2.5 Flash: vision verification ──────────────────────────

import asyncio
import base64
import io
import json
import os
import shutil

import PIL.Image
import google.generativeai as genai

from .config import (
    GPT_MAX_TOKENS_BASE,
    GPT_MAX_TOKENS_PER_IMAGE,
    GEMINI_API_KEY,
    MISTRAL_API_KEY,
    PROVIDER_CONFIG,
    logger,
)
from .image import (
    _check_disk_space,
    _mime_to_ext,
    _resize_for_api,
)
from .state import state

genai.configure(api_key=GEMINI_API_KEY)
_model = None
_mistral_client = None


def _get_model():
    global _model
    if _model is None:
        _model = genai.GenerativeModel("gemini-2.5-flash")
    return _model


def _get_mistral_client():
    global _mistral_client
    if _mistral_client is None and MISTRAL_API_KEY:
        from mistralai.client import Mistral
        _mistral_client = Mistral(api_key=MISTRAL_API_KEY)
    return _mistral_client


# ── Shared prompt builder ──────────────────────────────────────────

def _build_verification_prompt(candidates):
    """Build prompt text + PIL images + max_tokens for a batch of candidates."""
    blacklist_section = ""
    blacklist_field = ""
    session_blacklist = state.blacklist
    if session_blacklist:
        items = ", ".join(session_blacklist)
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
        resized_bytes, _ = _resize_for_api(image_bytes)
        pil_images.append(PIL.Image.open(io.BytesIO(resized_bytes)))

    max_tokens = min(
        8192,
        GPT_MAX_TOKENS_BASE + len(candidates) * GPT_MAX_TOKENS_PER_IMAGE,
    )

    return prompt, pil_images, max_tokens


# ── Model adapters ─────────────────────────────────────────────────

async def _call_gemini(prompt, pil_images, max_tokens):
    """Call Gemini 2.5 Flash. Returns parsed dict or None on failure."""
    model = _get_model()
    state.gpt_calls += 1
    max_retries = 3

    for attempt in range(max_retries):
        try:
            response = model.generate_content(
                [prompt] + pil_images,
                generation_config=genai.GenerationConfig(
                    response_mime_type="application/json",
                    max_output_tokens=max_tokens,
                ),
            )
            raw = response.text
            if raw and raw.strip():
                return json.loads(raw)
            return None
        except Exception as e:
            err_str = str(e).lower()
            should_retry = (
                "rate_limit" in err_str or "429" in err_str
                or "500" in err_str or "502" in err_str
                or "timeout" in err_str or "quota" in err_str
            )
            if attempt < max_retries - 1 and should_retry:
                wait = 2 ** (attempt + 2)
                logger.warning(
                    "Gemini API error, retrying in %ds (%d/%d): %s",
                    wait, attempt + 2, max_retries, e,
                )
                await asyncio.sleep(wait)
            else:
                logger.warning(
                    "Gemini API call failed (%d/%d): %s",
                    attempt + 1, max_retries, e,
                )
                return None
    return None


async def _call_mistral(prompt, pil_images, max_tokens, model_id):
    """Call a Mistral vision model. Returns parsed dict or None on failure."""
    client = _get_mistral_client()
    if client is None:
        return None

    # Build content block: text + base64 images
    content = [{"type": "text", "text": prompt}]
    for img in pil_images:
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=85)
        b64 = base64.b64encode(buf.getvalue()).decode()
        content.append({
            "type": "image_url",
            "image_url": f"data:image/jpeg;base64,{b64}",
        })

    def _sync_call():
        return client.chat.complete(
            model=model_id,
            messages=[{"role": "user", "content": content}],
            response_format={"type": "json_object"},
            max_tokens=max_tokens,
        )

    max_retries = 2
    for attempt in range(max_retries):
        try:
            response = await asyncio.to_thread(_sync_call)
            raw = response.choices[0].message.content
            if raw and raw.strip():
                return json.loads(raw)
            return None
        except Exception as e:
            err_str = str(e).lower()
            should_retry = (
                "rate_limit" in err_str or "429" in err_str
                or "500" in err_str or "timeout" in err_str
                or "quota" in err_str
            )
            if attempt < max_retries - 1 and should_retry:
                wait = 2 ** (attempt + 2)
                logger.warning(
                    "Mistral %s error, retrying in %ds (%d/%d): %s",
                    model_id, wait, attempt + 2, max_retries, e,
                )
                await asyncio.sleep(wait)
            else:
                logger.warning(
                    "Mistral %s call failed (%d/%d): %s",
                    model_id, attempt + 1, max_retries, e,
                )
                return None
    return None


# ── Evaluation processing (lock-protected) ─────────────────────────

async def _process_evaluations(evaluations, candidates, progress_tracker, lock):
    """Process evaluations from any provider. Lock guards state mutations."""
    log_lines = []
    if not evaluations:
        return log_lines

    seen_indices = set()
    for eval_item in evaluations:
        idx = eval_item.get("index")
        if idx is not None:
            if idx in seen_indices:
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
        unwanted = eval_item.get("unwanted_content", False)
        reason = eval_item.get("reason", "")

        async with lock:
            if not relevant:
                state.filter_stats["not_relevant"] += 1
                log_lines.append(f"  {url}: not relevant — {reason}")
                _cleanup_pending(url)
                if progress_tracker:
                    progress_tracker.image_rejected(url, reason, filter_type="not_relevant")
            elif not high_quality:
                state.filter_stats["low_quality"] += 1
                log_lines.append(f"  {url}: low quality — {reason}")
                _cleanup_pending(url)
                if progress_tracker:
                    progress_tracker.image_rejected(url, reason, filter_type="low_quality")
            elif watermarked:
                state.filter_stats["watermarked"] += 1
                log_lines.append(f"  {url}: watermarked — {reason}")
                _cleanup_pending(url)
                if progress_tracker:
                    progress_tracker.image_rejected(url, reason, filter_type="watermarked")
            elif unwanted:
                state.filter_stats["unwanted_content"] += 1
                log_lines.append(f"  {url}: unwanted content — {reason}")
                _cleanup_pending(url)
                if progress_tracker:
                    progress_tracker.image_rejected(url, reason, filter_type="unwanted_content")
            else:
                if not _check_disk_space(state.output_dir):
                    log_lines.append(f"  {url}: SKIPPED — low disk space")
                    break
                state.saved_count += 1
                ext = _mime_to_ext(mime_type)
                file_name = f"image_{state.saved_count}.{ext}"
                file_path = os.path.join(state.output_dir, file_name)
                pending_filename = state.pending_files.pop(url, None)
                if pending_filename:
                    pending_path = os.path.join(state.output_dir, ".pending", pending_filename)
                    if os.path.exists(pending_path):
                        shutil.move(pending_path, file_path)
                    else:
                        with open(file_path, "wb") as f:
                            f.write(image_bytes)
                else:
                    with open(file_path, "wb") as f:
                        f.write(image_bytes)
                final_path = f"/api/collections/{state.query_folder}/images/{file_name}"
                if progress_tracker:
                    progress_tracker.image_approved(
                        url, final_path, reason, state.saved_count, state.max_images,
                    )
                log_lines.append(
                    f"  {url}: SAVED ({state.saved_count}/{state.max_images}) — {reason}",
                )
                logger.debug(
                    "Saved image %d/%d -> %s", state.saved_count, state.max_images, file_path,
                )

                if state.is_full:
                    break

    return log_lines


# ── Per-provider verification task ─────────────────────────────────

async def _verify_task(candidates, provider_cfg, progress_tracker, lock, fallback_queue):
    """Process a group of candidates through a single provider."""
    if not candidates or state.is_full:
        return

    prompt, pil_images, max_tokens = _build_verification_prompt(candidates)

    if provider_cfg["adapter"] == "gemini":
        parsed = await _call_gemini(prompt, pil_images, max_tokens)
    elif provider_cfg["adapter"] == "mistral":
        parsed = await _call_mistral(prompt, pil_images, max_tokens, provider_cfg["name"])
    else:
        logger.warning("Unknown adapter %s — queuing %d images for fallback", provider_cfg["adapter"], len(candidates))
        fallback_queue.extend(candidates)
        return

    if parsed is None:
        logger.warning("Provider %s returned no result — queuing %d images for fallback", provider_cfg["name"], len(candidates))
        fallback_queue.extend(candidates)
        return

    evaluations = parsed.get("evaluations", parsed if isinstance(parsed, list) else [])
    if not evaluations:
        logger.warning("Provider %s returned empty evaluations — queuing %d images for fallback", provider_cfg["name"], len(candidates))
        fallback_queue.extend(candidates)
        return

    logger.info("Provider %s returned %d evaluations", provider_cfg["name"], len(evaluations))
    await _process_evaluations(evaluations, candidates, progress_tracker, lock)


# ── Parallel orchestrator ──────────────────────────────────────────

async def _verify_parallel(candidates, progress_tracker=None):
    """Distribute candidates across providers in parallel rotation.

    Each provider processes its share independently, streaming results
    via SSE as they become available. Failed items go to fallback.
    """
    if not candidates:
        return

    # Filter to providers that have API keys configured
    active_providers = []
    for cfg in PROVIDER_CONFIG:
        if cfg["adapter"] == "gemini" and GEMINI_API_KEY:
            active_providers.append(cfg)
        elif cfg["adapter"] == "mistral" and MISTRAL_API_KEY:
            active_providers.append(cfg)

    if not active_providers:
        logger.warning("No API keys configured for any provider")
        return

    logger.info(
        "Parallel verification: %d images across %d providers (%s)",
        len(candidates), len(active_providers),
        ", ".join(p["name"] for p in active_providers),
    )

    # Round-robin split across providers
    groups = [[] for _ in active_providers]
    for i, cand in enumerate(candidates):
        groups[i % len(groups)].append(cand)

    lock = asyncio.Lock()
    fallback_queue = []

    # Fire parallel tasks — each provider processes its group immediately
    tasks = []
    for i, (group, cfg) in enumerate(zip(groups, active_providers)):
        if group:
            if progress_tracker:
                progress_tracker.verification_batch_started(
                    batch_num=i + 1, total_batches=len(active_providers), size=len(group),
                )
            tasks.append(_verify_task(group, cfg, progress_tracker, lock, fallback_queue))

    await asyncio.gather(*tasks)

    for i, (group, cfg) in enumerate(zip(groups, active_providers)):
        if group and progress_tracker:
            progress_tracker.verification_batch_complete(
                batch_num=i + 1, total_batches=len(active_providers),
            )

    # Fallback: redistribute failed items to surviving providers
    if fallback_queue and not state.is_full:
        logger.info("Fallback: reprocessing %d images through remaining providers", len(fallback_queue))
        for cfg in active_providers:
            if not fallback_queue or state.is_full:
                break
            batch = list(fallback_queue)
            fallback_queue.clear()
            prompt, pil_images, max_tokens = _build_verification_prompt(batch)

            if cfg["adapter"] == "gemini":
                parsed = await _call_gemini(prompt, pil_images, max_tokens)
            else:
                parsed = await _call_mistral(prompt, pil_images, max_tokens, cfg["name"])

            if parsed:
                evaluations = parsed.get("evaluations", parsed if isinstance(parsed, list) else [])
                if evaluations:
                    await _process_evaluations(evaluations, batch, progress_tracker, lock)
                    continue

            # This provider also failed — put items back for next in line
            fallback_queue.extend(batch)
            logger.warning("Fallback provider %s also failed, %d images remaining", cfg["name"], len(fallback_queue))

        if fallback_queue:
            logger.warning("All providers exhausted, %d images could not be verified", len(fallback_queue))


# ── Public API (backward-compatible signature) ─────────────────────

async def _verify_and_save(candidates: list[tuple], progress_tracker=None) -> list[str]:
    """Verify candidates using parallel rotation across providers.

    Signature preserved for backward compatibility with agent.py.
    Each provider processes its share concurrently; results stream
    via SSE as they arrive. Failed items fall back to the next provider.
    """
    await _verify_parallel(candidates, progress_tracker=progress_tracker)
    return []


def _cleanup_pending(url: str) -> None:
    """Remove a pending file for a rejected image."""
    pending_filename = state.pending_files.pop(url, None)
    if pending_filename:
        pending_path = os.path.join(state.output_dir, ".pending", pending_filename)
        try:
            if os.path.exists(pending_path):
                os.remove(pending_path)
        except OSError:
            pass
