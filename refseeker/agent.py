import asyncio
import json
import os

import httpx
from browser_use import Agent, Browser
from browser_use.llm.deepseek.chat import ChatDeepSeek

from .client import get_deepseek_client
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

    base_search_query = query
    logger.info("Original search query: \"%s\"", base_search_query)

    print(f"\nSearch query: \"{base_search_query}\"")
    print("Do you want to improve/expand the search query with DeepSeek?")
    print("Note: this will consume additional tokens (estimated < 200 tokens).")
    choice = input("Enter 'y' to improve, anything else to keep as-is: ").strip().lower()

    search_query = base_search_query
    if choice == "y":
        logger.info("Asking DeepSeek to improve the search query ...")
        try:
            resp = get_deepseek_client().chat.completions.create(
                model=DEEPSEEK_MODEL,
                messages=[{
                    "role": "user",
                    "content": (
                        f'I am searching for reference photos of "{query}". '
                        f"Improve and expand this search query to get better, "
                        f"more diverse results. "
                        f"Return ONLY the improved search query string, nothing else. "
                        f'The original format is: "{query} reference photos high quality". '
                        f"Make it better for finding diverse, high-quality reference images."
                    ),
                }],
                max_tokens=100,
                timeout=httpx.Timeout(15.0),
            )
            improved = resp.choices[0].message.content.strip().strip("\"'")
            if improved:
                logger.info("Improved query: \"%s\"", improved)
                search_query = improved
            else:
                logger.warning("Got empty response from GPT, using original query.")
        except Exception as e:
            logger.error("Failed to improve query: %s. Using original.", e)

    logger.info("Final search query: \"%s\"", search_query)

    whitelist: list[str] = []
    blacklist: list[str] = []
    try:
        with open("config.json") as f:
            config = json.load(f)
        whitelist = [d.strip().lower() for d in config.get("whitelist", []) if d.strip()]
        blacklist = [d.strip().lower() for d in config.get("blacklist", []) if d.strip()]
    except FileNotFoundError:
        logger.warning("config.json not found, no site filters applied.")
    except json.JSONDecodeError as e:
        logger.error("Failed to parse config.json: %s", e)

    site_instructions = ""
    if whitelist:
        site_instructions += (
            f"\nPREFERRED SITES (search these first, prioritize them): "
            f"{', '.join(whitelist)}"
        )

    task = (
        f'Search for: "{search_query}"\n'
        f"Goal: Collect {MAX_IMAGES} high-quality reference images of \"{query}\".\n\n"
        f"EXECUTION ORDER:\n"
        f"1. Go DIRECTLY to each PREFERRED SITE one by one. "
        f"Do NOT use Google or Bing unless all preferred sites have been exhausted.\n"
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
        f"- Never visit: {', '.join(blacklist) if blacklist else 'none'}\n"
        f"- After typing into a search field, press Enter to submit.\n"
        f"- Only call `done` after ALL preferred sites have been attempted.\n"
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
        await asyncio.wait_for(agent.run(), timeout=AGENT_TIMEOUT)
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
