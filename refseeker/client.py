import os
import sys

from openai import OpenAI

from .config import DEEPSEEK_BASE_URL, logger


def _build_openai_client() -> OpenAI:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        logger.critical("OPENAI_API_KEY is not set. Add it to your .env file.")
        sys.exit(1)
    return OpenAI(api_key=api_key)


_openai_client: OpenAI | None = None


def get_openai_client() -> OpenAI:
    global _openai_client
    if _openai_client is None:
        _openai_client = _build_openai_client()
    return _openai_client


# ── DeepSeek (agent reasoning, NOT vision) ────────────────────────────────────

_deepseek_client: OpenAI | None = None


def get_deepseek_client() -> OpenAI:
    """OpenAI-compatible client pointed at DeepSeek API for text-only tasks."""
    global _deepseek_client
    if _deepseek_client is None:
        api_key = os.getenv("DEEPSEEK_API_KEY")
        if not api_key:
            logger.critical(
                "DEEPSEEK_API_KEY is not set. Add it to your .env file."
            )
            sys.exit(1)
        _deepseek_client = OpenAI(api_key=api_key, base_url=DEEPSEEK_BASE_URL)
    return _deepseek_client
