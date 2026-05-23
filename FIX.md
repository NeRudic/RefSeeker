# Code Review: Issues Found

## HIGH

### 1. `MIN_IMAGE_DIM` defined but never used

`config.py:13` defines `MIN_IMAGE_DIM = 300`, but it is never imported or referenced anywhere in the codebase. The pipeline downloads images of ANY size — tiny icons, avatars, thumbnails down to 16×16 pixels pass through to the vision model, burning tokens and API quota on garbage.

**Fix:** Check `width`/`height` from `_validate_image()` against `MIN_IMAGE_DIM` in `agent.py:_download_one()` before saving to `.pending/`.

### 2. Verification batch is too large — pipeline is sequential for small queries

`agent.py:171` computes `_VERIFY_BATCH = BATCH_SIZE * len(PROVIDER_CONFIG)` = 15 × 4 = **60 images**. Verification only starts when 60 candidates are buffered. For queries that yield 50–70 unique image URLs, **all downloads finish before any verification starts**, defeating the concurrent pipeline design entirely.

For a query like "A-20G wheels" (32 saved), verification only begins after the last download completes.

**Fix:** Lower `_VERIFY_BATCH` to `BATCH_SIZE * 2` (30) or trigger verification periodically based on time as well as count.

### 3. Race condition on `state.is_full` — can overshoot `max_images`

`verify.py:295-302` checks `state.is_full` and `state.saved_count` **without holding `lock`**. With 4 providers running in parallel, they can all pass the guard simultaneously and each save an image past the limit:

| Time | Provider A | Provider B |
|------|-----------|-----------|
| T1 | checks `is_full` → False | — |
| T2 | — | checks `is_full` → False |
| T3 | saves image #51 | — |
| T4 | — | saves image #52 |

With 4 providers, overshoot can reach `max_images + N` where `N ≤ provider_count`. The `if state.is_full: break` inside the lock in `_process_evaluations` mitigates intra-loop overshoot but does not prevent this initial race.

**Fix:** Move the `is_full` check inside the lock-protected section in `_process_evaluations` and remove the pre-check from `_verify_task`.

### 4. No HTTP connection pooling

`agent.py:44-46` creates a **new `httpx.AsyncClient`** for every single download (up to 200 times per session). Each one opens a fresh TCP connection with TLS handshake. Similarly, `searcher.py:38` creates a new `httpx.Client` per search call.

This adds 100–300 ms of connection overhead per image, adding seconds to every session.

**Fix:** Create a shared `httpx.AsyncClient` at module level in `agent.py` and a shared `httpx.Client` in `searcher.py`.

---

## MEDIUM

### 5. README is severely outdated

`README.md` describes an architecture that no longer exists:
- Mentions "browser-based" search (project is browserless, uses Serper API)
- References `whitelist`/`blacklist` domain filtering (removed, only `image_blacklist` remains)
- Shows `FIXES.md` in the project structure (file doesn't exist)
- Claims Gemini 2.5 Flash is the only verifier (now 4 parallel Mistral models)
- Mentions "query enhancement via AI" (not in current code)

Anyone reading the README to understand the project will get a completely wrong picture.

### 6. AGENT.md conflicts with config.py

`AGENT.md` lists `gemini-2.5-flash` as an active provider in the pipeline diagram and provider table, but `config.py:52-53` has it commented out: `# gemini-2.5-flash disabled due to daily quota limit`.

The AGENT.md pipeline diagram shows 5 providers including Gemini, while only 4 Mistral models are actually active.

### 7. Mistral adapter double-encodes images as JPEG

`verify.py:_build_verification_prompt()` resizes images and returns JPEG bytes, then opens them as `PIL.Image` objects. `_call_mistral()` (line 148-152) converts each `PIL.Image` **back to JPEG bytes and base64**. The resize step already produced JPEG bytes — the round-trip through `PIL.Image.open(io.BytesIO(resized_bytes))` → save-as-JPEG is wasted CPU on 50+ images per session.

**Fix:** Pass raw JPEG bytes from resize directly to `_call_mistral` and encode them there, skipping the PIL detour.

### 8. `_verify_and_save` always returns `[]`

`verify.py:424-431` declares it returns `list[str]` but always returns `[]`. The caller (`agent.py`) ignores the return value entirely. Dead code path.

---

## LOW

### 9. Frontend filenames use lowercase, AGENT.md references PascalCase

Files like `lightbox.tsx`, `image-grid.tsx`, `pipeline-timeline.tsx` are all lowercase, while AGENT.md documents them as `Lightbox.tsx`, `ImageGrid.tsx`, `PipelineTimeline.tsx`. This causes confusion when navigating between docs and filesystem.

### 10. Gemini client doesn't guard missing API key

`verify.py:_get_gemini_client()` always creates a `genai.Client(api_key=GEMINI_API_KEY)` even when `GEMINI_API_KEY` is `None`. It will fail at call time with an opaque API error rather than failing fast. Compare with `_get_mistral_client()` which checks `MISTRAL_API_KEY` first.

(Non-critical since Gemini is currently disabled, but would surface as a confusing error if re-enabled without a key.)

### 11. `_validate_image` opens the file twice

`image.py:139-144` calls `Image.open().verify()`, then opens the same bytes again. This is a known PIL pattern (`.verify()` closes the file), but the second open could be avoided by using `truncated=False` or directly reading width/height from headers.

### 12. No tests for verify.py, agent.py, progress.py, searcher.py

Only `state.py` and `image.py` have meaningful test coverage. The core pipeline (`agent.py`), all vision verification logic (`verify.py`), SSE streaming (`progress.py`), and search (`searcher.py`) have zero tests. Changes to these modules rely entirely on manual testing.

### 13. `test_download.py` uses a minimal JPEG byte sequence

The "valid JPEG" test (`test_download.py:8`) uses a 20-byte JPEG header. PIL may accept it, but this is a fragile test — it tests that PIL doesn't throw on the header bytes rather than testing real image validation.

---

## INFO (not actionable, good to know)

### A. API keys in `.env` are gitignored — OK

`.env` is listed in `.gitignore`. No risk of accidental commit.

### B. `refseeker.log` is gitignored

The log file is in `.gitignore` and correctly excluded from version control.
