import json
import os

import httpx
from browser_use import Agent, Browser
from browser_use.llm.openai.chat import ChatOpenAI

from .client import get_openai_client
from .config import GPT_MODEL, MAX_IMAGES, logger
from .controller import controller
from .state import state


async def run_agent(query: str):
    state.reset(query)
    os.makedirs(state.output_dir, exist_ok=True)

    browser = Browser(headless=False, enable_default_extensions=False)
    llm = ChatOpenAI(model=GPT_MODEL)

    base_search_query = query
    logger.info("Original search query: \"%s\"", base_search_query)

    print(f"\nSearch query: \"{base_search_query}\"")
    print("Do you want to improve/expand the search query with GPT-4o mini?")
    print("Note: this will consume additional tokens (estimated < 200 tokens).")
    choice = input("Enter 'y' to improve, anything else to keep as-is: ").strip().lower()

    search_query = base_search_query
    if choice == "y":
        logger.info("Asking GPT-4o mini to improve the search query ...")
        try:
            resp = get_openai_client().chat.completions.create(
                model=GPT_MODEL,
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
        f"EXECUTION ORDER (follow exactly on every page):\n"
        f'1. Try google.com first — search for "{search_query}" and click through to image results. '
        f"If Google is unresponsive (timeout / blank page) after 2 attempts, "
        f"switch to Bing Images. Do NOT use DuckDuckGo — it has the same bot protection.\n"
        f"   If both Google and Bing fail, go directly to the PREFERRED SITES listed below.\n"
        f"2. On EVERY page: call `get_page_image_urls` IMMEDIATELY after landing. "
        f"This action extracts all URLs, "
        f"downloads, checks resolution, verifies via GPT-4o vision, and saves approved "
        f"images with categories.\n"
        f"3. Then call `extract_subpage_links`. If sub-pages exist, "
        f"visit each and repeat step 2.\n"
        f"4. Blacklisted sites (NEVER visit): "
        f"{', '.join(blacklist) if blacklist else 'none'}\n"
        f"{site_instructions}\n"
        f"5. Stop once {MAX_IMAGES} images are saved (or at least 10 if fewer are available). "
        f"Call `done` with a summary of what was found and saved.\n"
        f"6. If a page has no images or errors occur 3+ times in a row, "
        f"leave and try a different site. If the same error repeats 2+ times on different sites, "
        f"change your search approach entirely.\n"
        f"7. Dismiss any popup/cookie banners IMMEDIATELY when they appear, "
        f"before interacting with any other element on the page.\n"
        f"8. After typing into a search/input field, press Enter to submit the form. "
        f"Do NOT click on the form element — use the Enter key or click a submit button.\n"
        f"9. Wait for each page to fully load before interacting (at least 3-5 seconds "
        f"after navigation). If a page does not respond within 10 seconds, "
        f"refresh it once and wait again.\n"
        f"10. After typing text into a field, briefly check that the field actually contains "
        f"what you typed. If the text did not register, click the field and retype.\n"
        f"11. IMPORTANT: Only call `get_page_image_urls` on a page that actually SHOWS image results "
        f"(search result grid, gallery, etc.). If the page is still a blank/loading state, "
        f"wait for it to fully render first."
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
        await agent.run()
    except Exception as e:
        logger.error("Agent run failed: %s", e, exc_info=True)
    finally:
        await browser.close()
        stats = dict(state.filter_stats)
        logger.info(
            "Finished. Total images saved: %d/%d. Filter stats: %s",
            state.saved_count,
            MAX_IMAGES,
            stats,
        )
