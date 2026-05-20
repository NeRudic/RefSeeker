"""Tests for image.py — URL validation, MIME detection, extension mapping."""

import pytest

from refseeker.image import (
    _detect_mime_type,
    _has_null_byte,
    _is_likely_image_url,
    _mime_to_ext,
    _parse_data_url,
    _resolve_full_resolution_url,
    _validate_image,
)


class TestIsLikelyImageUrl:
    """_is_likely_image_url uses negative filtering — rejects non-image extensions,
    lets everything else (incl. CDN URLs without extensions) pass through."""

    def test_cdn_url_without_extension(self):
        """Google CDN / imgur URLs have no file extension in path."""
        assert _is_likely_image_url(
            "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT123"
        )
        assert _is_likely_image_url(
            "https://i.imgur.com/abc123def"
        )

    def test_standard_image_urls(self):
        """Normal image URLs with .jpg, .png, .webp extensions."""
        assert _is_likely_image_url("https://example.com/photo.jpg")
        assert _is_likely_image_url("https://example.com/photo.png")
        assert _is_likely_image_url("https://example.com/photo.jpeg?w=800")
        assert _is_likely_image_url("https://example.com/photo.webp?v=2#anchor")
        assert _is_likely_image_url("https://example.com/photo.avif")
        assert _is_likely_image_url("https://example.com/photo.JPG")
        assert _is_likely_image_url("https://example.com/asset.PNG?param=1")

    def test_rejects_non_image_extensions(self):
        """CSS, JS, JSON, XML, fonts should be rejected."""
        assert not _is_likely_image_url("https://example.com/style.css")
        assert not _is_likely_image_url("https://example.com/app.js")
        assert not _is_likely_image_url("https://example.com/data.json")
        assert not _is_likely_image_url("https://example.com/font.woff2")
        assert not _is_likely_image_url("https://example.com/font.otf")
        assert not _is_likely_image_url("https://example.com/file.pdf")

    def test_rejects_too_short_path(self):
        """Paths of length <= 3 with no query params are too short to be images."""
        assert not _is_likely_image_url("https://example.com/a")
        assert not _is_likely_image_url("https://example.com/ab")
        assert not _is_likely_image_url("https://example.com/")   # empty-ish path

    def test_accepts_short_path_with_query(self):
        """Short path + query params = likely CDN image URL."""
        assert _is_likely_image_url("https://example.com/img?id=12345")

    def test_relative_urls(self):
        """Relative URLs should also be parseable."""
        assert not _is_likely_image_url("/style.css")
        assert _is_likely_image_url("/photo.jpg")
        assert not _is_likely_image_url("script.js")

    def test_invalid_url_is_rejected(self):
        """Completely invalid URL should return False."""
        assert not _is_likely_image_url("")
        assert not _is_likely_image_url("\x00\x00\x00")


class TestDetectMimeType:
    def test_jpeg(self):
        assert _detect_mime_type(b"\xff\xd8\xff\xe0") == "image/jpeg"

    def test_png(self):
        assert _detect_mime_type(b"\x89PNG\r\n\x1a\n") == "image/png"

    def test_gif(self):
        assert _detect_mime_type(b"GIF89a") == "image/gif"
        assert _detect_mime_type(b"GIF87a") == "image/gif"

    def test_webp(self):
        assert _detect_mime_type(b"RIFF\x00\x00\x00\x00WEBPVP8 ") == "image/webp"

    def test_unknown_bytes_defaults_to_jpeg(self):
        """Backwards-compatible: unknown bytes still default to image/jpeg
        since _detect_mime_type was never intended as a security gate."""
        assert _detect_mime_type(b"<html>") == "image/jpeg"


class TestHasNullByte:
    def test_detects_null_byte(self):
        assert _has_null_byte("https://example.com/img\x00.jpg")
        assert _has_null_byte("\x00")

    def test_clean_url(self):
        assert not _has_null_byte("https://example.com/photo.jpg")


class TestMimeToExt:
    def test_known_types(self):
        assert _mime_to_ext("image/jpeg") == "jpg"
        assert _mime_to_ext("image/png") == "png"
        assert _mime_to_ext("image/webp") == "webp"
        assert _mime_to_ext("image/gif") == "gif"

    def test_unknown_type(self):
        assert _mime_to_ext("application/octet-stream") == "bin"
        assert _mime_to_ext("") == "bin"


class TestValidateImage:
    def test_invalid_bytes(self):
        ok, w, h = _validate_image(b"not an image")
        assert not ok
        assert w == 0
        assert h == 0


class TestResolveFullResolution:
    """_resolve_full_resolution_url derives full-size URLs from thumbnail patterns."""

    def test_strips_wordpress_size_suffix(self):
        url = "https://example.com/photo-300x200.jpg"
        assert _resolve_full_resolution_url(url) == "https://example.com/photo.jpg"

    def test_strips_wordpress_size_suffix_webp(self):
        url = "https://example.com/image-768x576.webp"
        assert _resolve_full_resolution_url(url) == "https://example.com/image.webp"

    def test_strips_wordpress_size_suffix_with_path(self):
        url = "https://example.com/2025/07/consolidated-b-24m-01-800x450.webp"
        expected = "https://example.com/2025/07/consolidated-b-24m-01.webp"
        assert _resolve_full_resolution_url(url) == expected

    def test_strips_thumb_directory(self):
        url = "https://example.com/thumb/photo.jpg"
        assert _resolve_full_resolution_url(url) == "https://example.com/photo.jpg"

    def test_strips_thumb_directory_with_full_path(self):
        url = "https://example.com/gallery/thumb/subdir/photo.jpg"
        expected = "https://example.com/gallery/thumb/subdir/photo.jpg"
        # Only /thumb/ is replaced, not the full path — single segment
        assert _resolve_full_resolution_url(url) == expected.replace("/thumb/", "/")

    def test_strips_standalone_size_query_param(self):
        url = "https://example.com/photo.jpg?w=300"
        assert _resolve_full_resolution_url(url) == "https://example.com/photo.jpg"

    def test_strips_standalone_height_query_param(self):
        url = "https://example.com/photo.jpg?h=200"
        assert _resolve_full_resolution_url(url) == "https://example.com/photo.jpg"

    def test_does_not_strip_query_with_other_params(self):
        """Query with non-size params should not be stripped."""
        url = "https://example.com/photo.jpg?w=300&page=2"
        assert _resolve_full_resolution_url(url) is None

    def test_returns_none_for_plain_url(self):
        url = "https://example.com/photo.jpg"
        assert _resolve_full_resolution_url(url) is None

    def test_returns_none_for_cdn_url_without_extension(self):
        url = "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT123"
        assert _resolve_full_resolution_url(url) is None

    def test_returns_none_for_data_url(self):
        url = "data:image/png;base64,abc"
        assert _resolve_full_resolution_url(url) is None

    def test_combined_patterns(self):
        """Both thumb/ dir and size suffix should be stripped."""
        url = "https://example.com/thumb/photo-150x150.jpg"
        expected = "https://example.com/photo.jpg"
        assert _resolve_full_resolution_url(url) == expected
