# Текущая задача: агент тратит ~20 шагов на cybermodeler.com пытаясь достать full-size JPG через thumbnails

**Корень:** `get_page_image_urls` возвращает только thumbnail URL (150x100px), агент не получает full-size ссылки.

**Файл для изучения:** `refseeker/controller.py` — функция `get_page_image_urls`

**Критерий успеха:** на странице cybermodeler.com/airplanes/a20/a20.html функция возвращает хотя бы 5 URL полноразмерных JPG (не thumbnails)

**Таймаут сессии:** 600s — поднять до 900s как отдельный шаг после основной задачи
