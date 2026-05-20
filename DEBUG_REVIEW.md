# DEBUG_ANALYSIS Review

## Verdict: Analysis partially correct, missed the root cause of problems B/C

---

## Problem A: Google blocks automated browser — CORRECT

| Hypothesis | Verdict |
|------------|---------|
| A1: `disable_security=True` signals automation | **Correct** — flag removed |
| A2: timeout 8s/3s too low | **Correct** — but fix requires patching browser_use (hardcoded in session.py:1001) |
| A3: loop detection doesn't override task prompt | **Correct** — fixed prompt (step 1 now says "after 2 attempts, switch") |

**Analysis recommendation** to remove `disable_security=True` — done.

---

## Problem B: get_page_image_urls returns individual characters — INCORRECT

The debugger looked for causes in:
- CDP corruption (B2)
- CSS regex (B1)
- DOM manipulation (B3)
- Shared proxy/CDN (C2)

**Actual root cause: `page.evaluate()` return type mismatch.**

`browser_use/actor/page.py:148` — `page.evaluate()` **always returns `str`**:
```python
async def evaluate(self, page_function: str, *args) -> str:
    ...
    return json.dumps(value) if isinstance(value, (dict, list)) else str(value)
```

JS returns `["url1", "url2"]` → CDP delivers Python list → `json.dumps` converts to `'["url1","url2"]'`.

In `main.py`:
```python
raw = await page.evaluate(...)   # str: '["url1","url2"]'
urls: list[str] = raw if raw else []  # TypeError: str assigned to list[str]
```

Iterating over a string yields `[`, `"`, `u`, `r`, `l`, `1`, `"`, `,`, `"`, `u`, `r`, `l`, `2`, `"`, `]`. Each character passes through `urljoin(base_url, char)` → `https://bing.com/images/h`.

**Fix:** `json.loads(raw)` instead of `raw`.

### Why the debugger missed it

- Analysis looked at JS code, CDP, DOM — but never checked what `page.evaluate` actually returns and how the caller processes it.
- `page.evaluate` return type isn't visible in logs — needed to either read browser_use source or add `logger.debug(type(raw))`.

---

## Problem C: Same characters on net-maquettes.com — INCORRECT

Identical pattern across different sites is a key signal: the cause is in the **code**, not the site. The debugger assumed CDN/proxy, but the actual cause is the same type mismatch (`json.dumps` + string iteration works identically on every page).

---

## Changes made

### Critical fix
- `page.evaluate()` result now parsed via `json.loads(raw)` with try/except

### Defense-in-depth
- Removed `disable_security=True`
- Added `_is_likely_image_url()` — filters by extension and path length
- Filter applied twice: after URL dedup and inside `_download_candidates`
- Added `logger.debug` of raw URLs for future diagnostics

### Prompt engineering
- Google: "if unresponsive after 2 attempts, switch to alternatives"
- `max_history_items` increased from 10 to 20
- Added warning: don't call `get_page_image_urls` on blank/loading pages

### Not done (requires patching browser_use)
- Increasing lifecycle timeout (hardcoded 8s/3s in `session.py:1001`)
- These timeouts only trigger warnings, they don't block execution
