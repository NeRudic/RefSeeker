import json
import logging
import os
from logging.handlers import RotatingFileHandler

from dotenv import load_dotenv

load_dotenv()

# ── API Keys (from .env) ──────────────────────────────────────────
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
MISTRAL_API_KEY = os.getenv("MISTRAL_API_KEY")
SERPER_API_KEY = os.getenv("SERPER_API_KEY")

# ── Database ──────────────────────────────────────────────────────
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/refseeker")

# ── JWT ───────────────────────────────────────────────────────────
JWT_SECRET = os.getenv("JWT_SECRET", "change-me-in-production")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_DAYS = 7

# ── Config file ───────────────────────────────────────────────────
_CONFIG_PATH = os.path.join(os.path.dirname(__file__), "..", "config.json")


def _load_config() -> dict:
    try:
        with open(_CONFIG_PATH, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


_CONFIG: dict = _load_config()

# ── Image blacklist ───────────────────────────────────────────────
IMAGE_BLACKLIST: list[str] = _CONFIG.get("image_blacklist", [])


def update_image_blacklist(items: list[str]) -> None:
    """Persist a new blacklist to config.json and reload the in-memory list."""
    global IMAGE_BLACKLIST
    try:
        with open(_CONFIG_PATH, encoding="utf-8") as f:
            cfg = json.load(f)
    except Exception:
        cfg = {}
    cfg["image_blacklist"] = items
    with open(_CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(cfg, f, indent=4, ensure_ascii=False)
    IMAGE_BLACKLIST.clear()
    IMAGE_BLACKLIST.extend(items)


# ── Verification prompt template ──────────────────────────────────
VERIFICATION_PROMPT_TEMPLATE: str = _CONFIG.get(
    "verification_prompt",
    (
        'You are checking if images are suitable as high-quality reference photos for: "{query}".\n\n'
        "There are {count} images attached. For EACH image, determine:\n"
        '1. Is it relevant to "{query}"?\n'
        "2. Is it high quality (sharp, detailed, not blurry, not pixelated)?\n"
        "3. Is it watermarked or does it contain prominent text overlays "
        "(excluding tiny photographer signatures)?\n"
        "{blacklist_section}"
        'Respond ONLY with a JSON object containing an "evaluations" array. '
        "One object per image, in the SAME order. "
        "Keep each reason under 5 words.\n\n"
        '{{"evaluations": [{{"index": 0, "relevant": true, "high_quality": true, '
        '"watermarked": false, '
        "{blacklist_field}"
        '"reason": "clear side view"}}]}}'
    ),
)

# ── Provider config (parallel rotation) ───────────────────────────
_DEFAULT_PROVIDERS = [
    {"name": "mistral-large-2512", "adapter": "mistral", "max_tokens_base": 500, "max_tokens_per_image": 150},
    {"name": "pixtral-large-2411", "adapter": "mistral", "max_tokens_base": 500, "max_tokens_per_image": 150},
    {"name": "ministral-14b-2512", "adapter": "mistral", "max_tokens_base": 500, "max_tokens_per_image": 150},
    {"name": "ministral-8b-2512", "adapter": "mistral", "max_tokens_base": 500, "max_tokens_per_image": 150},
]

_models = _CONFIG.get("models", {})
PROVIDER_CONFIG: list[dict] = _models.get("providers", _DEFAULT_PROVIDERS)
MISTRAL_MAX_IMAGES: int = _models.get("mistral_max_images", 8)
RETRIES_GEMINI: int = _models.get("retries_gemini", 3)
RETRIES_MISTRAL: int = _models.get("retries_mistral", 2)
MAX_TOKENS_BASE: int = _models.get("max_tokens_base", 500)
MAX_TOKENS_PER_IMAGE: int = _models.get("max_tokens_per_image", 150)
MAX_TOKENS_CAP: int = _models.get("max_tokens_cap", 8192)

# ── Pipeline settings ─────────────────────────────────────────────
_pipeline = _CONFIG.get("pipeline", {})

BATCH_SIZE: int = _pipeline.get("batch_size", 15)
VERIFY_BATCH_SIZE: int = _pipeline.get("verify_batch_size", 32)
DOWNLOAD_CONCURRENCY: int = _pipeline.get("download_concurrency", 15)
URLLIB_TIMEOUT: int = _pipeline.get("download_timeout", 10)
DOWNLOAD_USER_AGENT: str = _pipeline.get(
    "download_user_agent",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
)
MIN_IMAGE_DIM: int = _pipeline.get("min_image_dim", 300)
RESIZE_DIM: int = _pipeline.get("resize_dim", 768)
JPEG_QUALITY: int = _pipeline.get("jpeg_quality", 85)
MIN_DISK_MB: int = _pipeline.get("min_disk_mb", 100)
SERPER_URL: str = _pipeline.get("serper_url", "https://google.serper.dev/images")
SERPER_COUNT: int = _pipeline.get("serper_count", 100)
SEARCH_QUERY_VARIANTS: list[str] = _pipeline.get(
    "search_query_variants",
    ["{query} walkaround", "{query} reference photos"],
)
MAX_IMAGES_DEFAULT: int = _pipeline.get("max_images", 50)
COLLECTION_FOLDER_MAX_LENGTH: int = _pipeline.get("collection_folder_max_length", 40)
SSE_QUEUE_TIMEOUT: int = _pipeline.get("sse_queue_timeout", 30)
RATE_LIMITS: dict[str, int] = _pipeline.get(
    "rate_limits",
    {
        "unauthenticated": 1,
        "free": 2,
        "pro": 100,
        "premium": 1100,
        "admin": -1,
    },
)

# ── Admin ─────────────────────────────────────────────────────────
DEFAULT_USAGE_DAYS: int = 30

# ── HTTP ──────────────────────────────────────────────────────────
LOG_FILE = "refseeker.log"
LOG_MAX_BYTES = 5 * 1024 * 1024  # 5 MB
LOG_BACKUP_COUNT = 3

# ── Logging setup ─────────────────────────────────────────────────
logger = logging.getLogger("refseeker")
logger.setLevel(logging.INFO)
logger.propagate = False

_fmt = logging.Formatter("%(asctime)s [%(levelname)s] %(message)s")

_ch = logging.StreamHandler()
_ch.setFormatter(_fmt)
logger.addHandler(_ch)

_fh = RotatingFileHandler(LOG_FILE, mode="a", encoding="utf-8", maxBytes=LOG_MAX_BYTES, backupCount=LOG_BACKUP_COUNT)
_fh.setFormatter(_fmt)
logger.addHandler(_fh)
