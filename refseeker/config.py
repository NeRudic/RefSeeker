import logging
import os
from logging.handlers import RotatingFileHandler

import httpx
from dotenv import load_dotenv

# ── Constants ────────────────────────────────────────────────────────────────
MAX_IMAGES = 30
BATCH_SIZE = 50
RESIZE_DIM = 768
MIN_IMAGE_DIM = 300
GPT_MAX_TOKENS_BASE = 500
GPT_MAX_TOKENS_PER_IMAGE = 50
GPT_MODEL = "gpt-4o-mini"
GPT_TIMEOUT = httpx.Timeout(120.0, connect=10.0, read=90.0)
DOWNLOAD_CONCURRENCY = 5
URLLIB_TIMEOUT = 10
JPEG_QUALITY = 85
SCROLL_STEPS = 4
SCROLL_DELAY = 0.5
FETCH_TIMEOUT = 10  # seconds, for browser-side image fetch
LOG_FILE = "refseeker.log"
LOG_MAX_BYTES = 5 * 1024 * 1024  # 5 MB
LOG_BACKUP_COUNT = 3

load_dotenv()

# ── Logging setup ────────────────────────────────────────────────────────────
logger = logging.getLogger("refseeker")
logger.setLevel(logging.INFO)
logger.propagate = False

_fmt = logging.Formatter("%(asctime)s [%(levelname)s] %(message)s")

_ch = logging.StreamHandler()
_ch.setFormatter(_fmt)
logger.addHandler(_ch)

_fh = RotatingFileHandler(LOG_FILE, mode="a", encoding="utf-8",
                          maxBytes=LOG_MAX_BYTES, backupCount=LOG_BACKUP_COUNT)
_fh.setFormatter(_fmt)
logger.addHandler(_fh)
