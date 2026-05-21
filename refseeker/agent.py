import asyncio
import json
import os

from browser_use import Agent, Browser
from browser_use.llm.deepseek.chat import ChatDeepSeek

from .config import DEEPSEEK_BASE_URL, DEEPSEEK_MODEL, MAX_IMAGES, logger, AGENT_TIMEOUT
from .controller import controller
from .state import state


async def run_agent(query: str):
    state.reset(query)
    os.makedirs(state.output_dir, exist_ok=True)

    browser = Browser(headless=False, enable_default_extensions=False)
    # ── DeepSeek: agent reasoning / navigation / planning ──────────────────
    # NOTE: fallback to GPT-4o-mini possible via ChatOpenAI(model=GPT_MODEL)
    llm = ChatDeepSeek(
        model=DEEPSEEK_MODEL,
        api_key=os.getenv("DEEPSEEK_API_KEY"),
        base_url=DEEPSEEK_BASE_URL,
    )

    logger.info("Search query: \"%s\"", query)

    whitelist: list[str] = []
    blacklist: list[str] = []
    try:
        with open("config.json") as f:
            config = json.load(f)
        whitelist = [d.strip().lower() for d in config.get("whitelist", []) if d.strip()]
        blacklist = [d.strip().lower() for d in config.get("blacklist", []) if d.strip()]
        state.preferred_sites = whitelist.copy()
    except FileNotFoundError:
        logger.warning("config.json not found, no site filters applied.")
    except json.JSONDecodeError as e:
        logger.error("Failed to parse config.json: %s", e)

    site_instructions = ""
    if whitelist:
        numbered_sites = "\n".join(f"  {i+1}. {s}" for i, s in enumerate(whitelist))
        site_instructions += (
            f"\nPREFERRED SITES (search these first, in this order):\n"
            f"{numbered_sites}\n\n"
            f"IMPORTANT — You MUST attempt ALL {len(whitelist)} sites above.\n"
            f"If a site returns no results or is unreachable, mark it as failed and "
            f"IMMEDIATELY move to the next site on the list.\n"
            f"A single site returning 'Nothing Found' is NOT a reason to stop the entire task.\n"
            f"The `done` tool will REJECT your call if you haven't attempted all sites."
        )

    task = (
        f'Search for: "{query}"\n'
        f"Goal: Collect {MAX_IMAGES} high-quality reference images of \"{query}\".\n\n"
        f"EXECUTION ORDER:\n"
        f"1. Go DIRECTLY to each PREFERRED SITE one by one (numbered list above).\n"
        f"   Do NOT use Google or Bing unless all preferred sites have been exhausted.\n"
        f"2. On EVERY page you land: call `get_page_image_urls` immediately. "
        f"This extracts, downloads, verifies via GPT-4o vision, and saves approved images.\n"
        f"3. Then call `extract_subpage_links`. If sub-pages exist, visit each and repeat step 2.\n"
        f"4. Once all preferred sites are done and fewer than 10 images collected, "
        f"try Bing Images. Avoid Google — it blocks automated browsers.\n"
        f"5. Stop once {MAX_IMAGES} images are saved (or at least 10 if fewer available). "
        f"Call `done` with a summary.\n\n"
        f"RULES:\n"
        f"- Wait 3-5 seconds after each navigation for the page to fully load.\n"
        f"- Dismiss any popup/cookie banners immediately.\n"
        f"- If a page has no images or 3+ errors occur in a row, move to the next site.\n"
        f"- If a site returns 'Nothing Found' or a search error: do NOT stop. "
        f"Immediately go to the next preferred site on the list.\n"
        f"- Never visit: {', '.join(blacklist) if blacklist else 'none'}\n"
        f"- After every navigation or click, immediately check the current URL. "
        f"If it redirected to an unrelated page, call go_back() and retry.\n"
        f"- After typing into a search field, press Enter to submit.\n"
        f"- Only call `done` after ALL preferred sites have been attempted. "
        f"The `done` tool checks this and will REJECT early calls.\n"
        f"- If fewer than {MAX_IMAGES} images were found, still pass success=True "
        f"and report the actual count (e.g. 'collected 25/{MAX_IMAGES}') in text.\n"
        f"{site_instructions}"
    )

    logger.info("Starting reference downloader agent ...")
    logger.info("Query: %s", query)
    logger.info("Target directory: %s", state.output_dir)

    agent = Agent(
        task=task,
        llm=llm,
        browser=browser,
        controller=controller,
        use_vision=False,
        max_history_items=20,
        flash_mode=False,
    )

    try:
        await asyncio.wait_for(agent.run(max_steps=60), timeout=AGENT_TIMEOUT)
    except asyncio.TimeoutError:
        logger.error("Agent run timed out after %ds", AGENT_TIMEOUT)
    except Exception as e:
        logger.error("Agent run failed: %s", e, exc_info=True)
    finally:
        await browser.close()
        logger.info(
            "Session finished. %s",
            state.log_metrics(),
        )
