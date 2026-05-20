"""Tests for state.py — CollectionState and observability metrics."""

import time

from refseeker.state import CollectionState


class TestCollectionState:
    def setup_method(self):
        self.state = CollectionState()
        self.state.reset("B-24 Liberator")

    def test_reset_sets_query(self):
        assert self.state.query_name == "B-24 Liberator"
        assert "b-24_liberator" in self.state.output_dir
        assert not self.state.saved_count
        assert not self.state.visited_pages
        assert not self.state.visited_domains
        assert self.state.session_start > 0

    def test_is_full(self):
        self.state.saved_count = 29
        assert not self.state.is_full
        self.state.saved_count = 30
        assert self.state.is_full
        self.state.saved_count = 31
        assert self.state.is_full

    def test_elapsed(self):
        assert self.state.elapsed >= 0
        start = self.state.elapsed
        time.sleep(0.01)
        assert self.state.elapsed > start

    def test_log_metrics_empty(self):
        result = self.state.log_metrics()
        assert "saved=0/30" in result
        assert "sites=0" in result
        assert "filters=" not in result  # no filter stats when empty

    def test_log_metrics_with_stats(self):
        self.state.saved_count = 5
        self.state.total_sites_attempted = 2
        self.state.visited_pages.append("https://example.com")
        self.state.download_attempts = 10
        self.state.gpt_calls = 1
        self.state.filter_stats["too_small"] = 3
        self.state.filter_stats["not_relevant"] = 2

        result = self.state.log_metrics()
        assert "saved=5/30" in result
        assert "sites=2" in result
        assert "downloads=10" in result
        assert "gpt_calls=1" in result
        assert "filters={'too_small': 3, 'not_relevant': 2}" in result

    def test_reset_clears_previous_state(self):
        self.state.saved_count = 5
        self.state.visited_pages.append("https://example.com")
        self.state.filter_stats["corrupt"] += 1

        self.state.reset("New Query")
        assert self.state.saved_count == 0
        assert not self.state.visited_pages
        assert not self.state.filter_stats
        assert self.state.query_name == "New Query"
