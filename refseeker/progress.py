import asyncio
import json
import time
from dataclasses import dataclass, field


@dataclass
class PipelineEvent:
    type: str
    data: dict
    timestamp: float = 0.0

    def __post_init__(self):
        if not self.timestamp:
            self.timestamp = time.time()

    def serialize(self) -> str:
        return json.dumps({"type": self.type, "data": self.data, "timestamp": self.timestamp})


class ProgressTracker:
    """Collects pipeline events and streams them via asyncio.Queue for SSE."""

    def __init__(self, session_id: str):
        self.session_id = session_id
        self._queue: asyncio.Queue[PipelineEvent] = asyncio.Queue()
        self._finished = False

    # ── Event producers ──────────────────────────────────────────────────────

    def push(self, event_type: str, **data) -> None:
        if self._finished:
            return
        event = PipelineEvent(type=event_type, data=data)
        self._queue.put_nowait(event)

    def search_started(self, query: str, max_images: int) -> None:
        self.push("search.started", query=query, max_images=max_images)

    def search_complete(self, total: int, unique: int, after_filter: int) -> None:
        self.push("search.complete", total=total, unique=unique, after_filter=after_filter)

    def download_started(self, total: int) -> None:
        self.push("download.started", total=total)

    def download_progress(self, current: int, total: int, url: str, status: str) -> None:
        self.push("download.progress", current=current, total=total, url=url, status=status)

    def download_complete(self, downloaded: int) -> None:
        self.push("download.complete", downloaded=downloaded)

    def verification_batch_started(self, batch_num: int, total_batches: int, size: int) -> None:
        self.push("verification.batch_started", batch=batch_num, total=total_batches, size=size)

    def verification_batch_complete(self, batch_num: int, total_batches: int) -> None:
        self.push("verification.batch_complete", batch=batch_num, total=total_batches)

    def image_approved(self, url: str, reason: str, saved_count: int, max_images: int) -> None:
        self.push("image.approved", url=url, reason=reason, saved=saved_count, max=max_images)

    def image_rejected(self, url: str, reason: str, filter_type: str) -> None:
        self.push("image.rejected", url=url, reason=reason, filter=filter_type)

    def session_complete(self, metrics: dict) -> None:
        self.push("session.complete", metrics=metrics)
        self._finished = True

    def session_error(self, message: str) -> None:
        self.push("session.error", message=message)
        self._finished = True

    # ── SSE consumer ─────────────────────────────────────────────────────────

    async def subscribe(self):
        """Async generator that yields serialized events for SSE streaming.
        Exits when session completes or errors."""
        while not self._finished:
            try:
                event = await asyncio.wait_for(self._queue.get(), timeout=30.0)
                yield event.serialize()
                if event.type in ("session.complete", "session.error"):
                    return
            except asyncio.TimeoutError:
                # Send keepalive comment
                yield ": keepalive\n"
