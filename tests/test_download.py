"""Tests for image.py — data URL parsing and image validation."""

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
        import pytest
        with pytest.raises(ValueError, match="Invalid data URL format"):
            _parse_data_url("not-a-data-url")


class TestValidateImage:
    def test_valid_jpeg(self):
        raw = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00"
        ok, w, h = _validate_image(raw)
        assert isinstance(ok, bool)
        assert isinstance(w, int)
        assert isinstance(h, int)

    def test_non_image_bytes(self):
        ok, w, h = _validate_image(b"<html>not an image</html>")
        assert not ok
        assert w == 0
        assert h == 0
