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

    max_input = input("Max images to collect (default 50, enter 0 for unlimited): ").strip()
    try:
        max_images = int(max_input) if max_input else 50
    except ValueError:
        max_images = 50

    try:
        asyncio.run(run_agent(query, max_images))
    except KeyboardInterrupt:
        logger.info("Process interrupted by user.")


if __name__ == "__main__":
    main()
