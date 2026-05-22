"""Tests for image.py — image validation."""

from refseeker.image import _validate_image


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
