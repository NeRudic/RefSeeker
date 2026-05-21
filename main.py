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
        asyncio.run(run_agent(query))
    except KeyboardInterrupt:
        logger.info("Process interrupted by user.")


if __name__ == "__main__":
    main()
