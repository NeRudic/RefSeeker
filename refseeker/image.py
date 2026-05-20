import base64
import os
import re
import shutil
import urllib.parse
from io import BytesIO

from PIL import Image

from .config import JPEG_QUALITY, RESIZE_DIM, logger


def _sanitize_folder_name(name: str) -> str:
    clean = re.sub(r'[\\/*?:"<>| ]', '_', name)
    clean = re.sub(r'_+', '_', clean)
    return clean.strip('_')


def _detect_mime_type(image_bytes: bytes) -> str:
    if image_bytes.startswith(b'\xff\xd8\xff'):
        return 'image/jpeg'
    elif image_bytes.startswith(b'\x89PNG\r\n\x1a\n'):
        return 'image/png'
    elif image_bytes.startswith(b'RIFF') and image_bytes[8:12] == b'WEBP':
        return 'image/webp'
    elif image_bytes.startswith(b'GIF87a') or image_bytes.startswith(b'GIF89a'):
        return 'image/gif'
    elif image_bytes.startswith(b'BM'):
        return 'image/bmp'
    elif image_bytes.startswith(b'II*\x00') or image_bytes.startswith(b'MM\x00*'):
        return 'image/tiff'
    elif image_bytes.startswith(b'\x00\x00\x00 ftypay') or image_bytes.startswith(b'\x00\x00\x00 ftyp'):
        return 'image/avif'
    return 'image/jpeg'


MIME_TO_EXT = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/bmp': 'bmp',
    'image/tiff': 'tif',
    'image/avif': 'avif',
}

_IMG_EXT_RE = re.compile(r'\.(jpe?g|png|gif|webp|bmp|avif|tiff?)(\?|#|$)', re.IGNORECASE)


def _is_likely_image_url(url: str) -> bool:
    try:
        parsed = urllib.parse.urlparse(url)
        path = parsed.path
    except Exception:
        return False
    if len(path) <= 3:
        return False
    return bool(_IMG_EXT_RE.search(path))


def _mime_to_ext(mime_type: str) -> str:
    return MIME_TO_EXT.get(mime_type.lower(), 'bin')


def _resize_for_api(image_bytes: bytes) -> tuple[bytes, str]:
    img = Image.open(BytesIO(image_bytes))
    w, h = img.size
    if w <= RESIZE_DIM and h <= RESIZE_DIM:
        return image_bytes, _detect_mime_type(image_bytes)
    if w > h:
        new_w, new_h = RESIZE_DIM, int(h * RESIZE_DIM / w)
    else:
        new_h, new_w = RESIZE_DIM, int(w * RESIZE_DIM / h)
    img = img.resize((new_w, new_h), Image.LANCZOS)

    if img.mode in ('RGBA', 'LA', 'P'):
        if img.mode == 'P':
            img = img.convert('RGBA')
        background = Image.new('RGB', img.size, (255, 255, 255))
        background.paste(img, mask=img.split()[3])
        img = background
    elif img.mode != 'RGB':
        img = img.convert('RGB')

    buf = BytesIO()
    img.save(buf, format='JPEG', quality=JPEG_QUALITY)
    return buf.getvalue(), 'image/jpeg'


def _parse_data_url(data_url: str) -> tuple[str, bytes]:
    match = re.match(r'^data:([^;]+);base64,(.+)$', data_url)
    if not match:
        raise ValueError("Invalid data URL format")
    return match.group(1), base64.b64decode(match.group(2))


def _has_null_byte(url: str) -> bool:
    return '\x00' in url


def _validate_image(image_bytes: bytes) -> tuple[bool, int, int]:
    try:
        img = Image.open(BytesIO(image_bytes))
        img.verify()
        img = Image.open(BytesIO(image_bytes))
        return True, img.width, img.height
    except Exception:
        return False, 0, 0


def _check_disk_space(path: str, min_free_mb: int = 100) -> bool:
    try:
        usage = shutil.disk_usage(path)
        return usage.free >= min_free_mb * 1024 * 1024
    except Exception:
        return True
