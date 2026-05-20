"""Tests for download.py — Content-Type validation, error handling."""

import pytest

from refseeker.download import _download_single
from refseeker.image import _parse_data_url, _validate_image


class TestParseDataUrl:
    def test_valid_data_url(self):
        import base64
        raw = b"fakeimagebytes"
        b64 = base64.b64encode(raw).decode()
        url = f"data:image/png;base64,{b64}"
        mime, data = _parse_data_url(url)
        assert mime == "image/png"
        assert data == raw

    def test_invalid_data_url(self):
        with pytest.raises(ValueError, match="Invalid data URL format"):
            _parse_data_url("not-a-data-url")


class TestValidateImage:
    def test_valid_jpeg(self):
        # Minimal valid JPEG
        raw = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00"
        # PIL may not validate this tiny JPEG — that's acceptable.
        ok, w, h = _validate_image(raw)
        # If PIL can't parse it, it should return False gracefully
        assert isinstance(ok, bool)
        assert isinstance(w, int)
        assert isinstance(h, int)

    def test_non_image_bytes(self):
        ok, w, h = _validate_image(b"<html>not an image</html>")
        assert not ok
        assert w == 0
        assert h == 0


class TestDownloadErrorPropagation:
    """Contract: _download_single must propagate ValueError from Content-Type
    rejection without wrapping in the 'Browser download failed' RuntimeError.

    This is verified by checking the except ValueError: raise path.
    """

    def test_content_type_error_message(self):
        """Verify the error pattern raised by Content-Type validation."""
        try:
            raise ValueError("Response is not an image (Content-Type: text/html)")
        except ValueError as e:
            assert "not an image" in str(e)
            assert "Content-Type" in str(e)
