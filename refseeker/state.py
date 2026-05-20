import os
import time
from collections import Counter
from dataclasses import dataclass, field

from .config import MAX_IMAGES
from .image import _sanitize_folder_name


@dataclass
class CollectionState:
    query_name: str = ""
    query_folder: str = ""
    output_dir: str = ""
    saved_count: int = 0
    downloaded_urls: set[str] = field(default_factory=set)
    filter_stats: Counter = field(default_factory=Counter)

    # Observability
    session_start: float = 0.0
    visited_pages: list[str] = field(default_factory=list)
    visited_domains: set[str] = field(default_factory=set)
    current_page_url: str = ""
    total_sites_attempted: int = 0
    total_pages_scrolled: int = 0
    gpt_calls: int = 0
    download_attempts: int = 0

    def reset(self, query: str) -> None:
        self.query_name = query
        self.query_folder = _sanitize_folder_name(query)
        self.output_dir = os.path.join(".", "references", self.query_folder)
        self.saved_count = 0
        self.downloaded_urls.clear()
        self.filter_stats.clear()
        self.session_start = time.time()
        self.visited_pages.clear()
        self.visited_domains.clear()
        self.current_page_url = ""
        self.total_sites_attempted = 0
        self.total_pages_scrolled = 0
        self.gpt_calls = 0
        self.download_attempts = 0

    @property
    def is_full(self) -> bool:
        return self.saved_count >= MAX_IMAGES

    @property
    def elapsed(self) -> float:
        return time.time() - self.session_start if self.session_start else 0.0

    def log_metrics(self) -> str:
        """Return a one-line metrics summary for logging."""
        parts = [
            f"saved={self.saved_count}/{MAX_IMAGES}",
            f"sites={self.total_sites_attempted}",
            f"pages={len(self.visited_pages)}",
            f"downloads={self.download_attempts}",
            f"gpt_calls={self.gpt_calls}",
            f"elapsed={self.elapsed:.0f}s",
        ]
        stats = dict(self.filter_stats)
        if stats:
            parts.append(f"filters={stats}")
        return " | ".join(parts)


state = CollectionState()
