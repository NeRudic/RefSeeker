import logging
import os
from logging.handlers import RotatingFileHandler

from dotenv import load_dotenv

load_dotenv()

# ── Constants ────────────────────────────────────────────────────────────────
BATCH_SIZE = 25
RESIZE_DIM = 768
MIN_IMAGE_DIM = 300
GPT_MAX_TOKENS_BASE = 500
GPT_MAX_TOKENS_PER_IMAGE = 150
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# ── HTTP ─────────────────────────────────────────────────────────────────────
DOWNLOAD_CONCURRENCY = 5
URLLIB_TIMEOUT = 10
JPEG_QUALITY = 85
SCROLL_STEPS = 4
SCROLL_DELAY = 0.5
FETCH_TIMEOUT = 10  # seconds, for browser-side image fetch
AGENT_TIMEOUT = 600  # seconds, max total agent runtime before forced stop
LOG_FILE = "refseeker.log"
LOG_MAX_BYTES = 5 * 1024 * 1024  # 5 MB
LOG_BACKUP_COUNT = 3

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
