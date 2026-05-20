import asyncio
import sys

from refseeker.agent import run_agent
from refseeker.config import logger


def main():
    query = input(
        "Enter search query for reference images (e.g., 'vintage typewriter'): "
    ).strip()
    if not query:
        logger.error("Search query cannot be empty.")
        sys.exit(1)

    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(run_agent(query))
        except KeyboardInterrupt:
            logger.info("Process interrupted by user.")
        finally:
            for task in asyncio.all_tasks(loop):
                task.cancel()
            loop.run_until_complete(
                asyncio.gather(*asyncio.all_tasks(loop), return_exceptions=True)
            )
            loop.close()
    except KeyboardInterrupt:
        logger.info("Process interrupted by user.")


if __name__ == "__main__":
    main()
