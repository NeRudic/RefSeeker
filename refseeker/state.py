import os
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

    def reset(self, query: str) -> None:
        self.query_name = query
        self.query_folder = _sanitize_folder_name(query)
        self.output_dir = os.path.join(".", "references", self.query_folder)
        self.saved_count = 0
        self.downloaded_urls.clear()
        self.filter_stats.clear()

    @property
    def is_full(self) -> bool:
        return self.saved_count >= MAX_IMAGES


state = CollectionState()
