import os
import re
import time
from collections import Counter
from dataclasses import dataclass, field


def _sanitize_folder_name(name: str) -> str:
    name = name.strip().lower()
    clean = re.sub(r'[\\/*?:"<>| .]', '_', name)
    clean = re.sub(r'_+', '_', clean)
    clean = clean.strip('_')
    if not clean or clean in ('', '.', '..', '__'):
        return 'other'
    return clean[:40]


@dataclass
class CollectionState:
    query_name: str = ""
    query_folder: str = ""
    output_dir: str = ""
    saved_count: int = 0
    max_images: int = 50
    downloaded_urls: set[str] = field(default_factory=set)
    filter_stats: Counter = field(default_factory=Counter)
    pending_files: dict[str, str] = field(default_factory=dict)

    # Observability
    session_start: float = 0.0
    gpt_calls: int = 0
    download_attempts: int = 0

    def reset(self, query: str, max_images: int = 50) -> None:
        self.query_name = query
        self.query_folder = _sanitize_folder_name(query)
        self.output_dir = os.path.join(".", "references", self.query_folder)
        self.saved_count = 0
        self.max_images = max_images
        self.downloaded_urls.clear()
        self.filter_stats.clear()
        self.pending_files.clear()
        self.session_start = time.time()
        self.gpt_calls = 0
        self.download_attempts = 0

    @property
    def is_full(self) -> bool:
        return self.max_images > 0 and self.saved_count >= self.max_images

    @property
    def elapsed(self) -> float:
        return time.time() - self.session_start if self.session_start else 0.0

    def log_metrics(self) -> str:
        """Return a one-line metrics summary for logging."""
        parts = [
            f"saved={self.saved_count}/{self.max_images if self.max_images > 0 else '∞'}",
            f"downloads={self.download_attempts}",
            f"gpt_calls={self.gpt_calls}",
            f"elapsed={self.elapsed:.0f}s",
        ]
        stats = dict(self.filter_stats)
        if stats:
            parts.append(f"filters={stats}")
        return " | ".join(parts)


state = CollectionState()