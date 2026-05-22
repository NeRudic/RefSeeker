import json
import logging
import os
from logging.handlers import RotatingFileHandler

from dotenv import load_dotenv

load_dotenv()

# ── Constants ────────────────────────────────────────────────────────────────
BATCH_SIZE = 15
RESIZE_DIM = 768
MIN_IMAGE_DIM = 300
GPT_MAX_TOKENS_BASE = 500
GPT_MAX_TOKENS_PER_IMAGE = 150
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# ── Config file ─────────────────────────────────────────────────────────────
_CONFIG_PATH = os.path.join(os.path.dirname(__file__), "..", "config.json")


def _load_image_blacklist() -> list[str]:
    try:
        with open(_CONFIG_PATH, encoding="utf-8") as f:
            cfg = json.load(f)
        return cfg.get("image_blacklist", [])
    except Exception:
        return []


IMAGE_BLACKLIST: list[str] = _load_image_blacklist()

# ── HTTP ─────────────────────────────────────────────────────────────────────
DOWNLOAD_CONCURRENCY = 5
URLLIB_TIMEOUT = 10
JPEG_QUALITY = 85
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
