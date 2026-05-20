## План: прогрессивное сохранение + авто-сортировка по категориям

### 1. Прогрессивное сохранение (картинки сразу в папку)

**Проблема:** Сейчас агент сначала обходит ВСЕ страницы и подстраницы, собирает URL, и только потом вызывает `batch_download_and_verify`. Папка пустая 10+ минут.

**Решение:** Изменить п. 3–4 в task prompt агента (`main.py` ~строка 381).

Было:
```
3. Once on a target page, get image URLs using `get_page_image_urls`. Then use `extract_subpage_links` to check for sub-page links...
4. After collecting ALL image URLs from the main page and any sub-pages, call `batch_download_and_verify`...
```

Стало:
```
3. Once on a target page, get image URLs using `get_page_image_urls`. Immediately call `batch_download_and_verify` with those URLs.
4. Then use `extract_subpage_links` to check for sub-page links... visit each sub-page, collect their URLs, and call `batch_download_and_verify` for each one.
```

Суть: агент вызывает `batch_download_and_verify` сразу после каждого сбора URL, а не копит всё в конце.

---

### 2. Динамическая классификация по категориям

**Проблема:** Все картинки сваливаются в одну папку.

**Решение:** Добавить поле `category` в ответ GPT внутри `batch_download_and_verify` и сохранять в соответствующую подпапку.

#### 2a. Промпт GPT (`main.py` ~строка 229)

Добавить четвёртый пункт:
```
4. Based on the content of the image, assign it to a logical category describing what part or aspect of the subject is shown (e.g. "landing_gear", "cockpit", "wing", "engine", "overview"). Be specific but concise — use lowercase_latin_with_underscores. If unsure, use "other".
```

Обновить структуру JSON-ответа — добавить поле `category`:
```json
{
    "evaluations": [
        {
            "index": 0,
            "relevant": true,
            "high_quality": true,
            "watermarked": false,
            "category": "landing_gear",
            "reason": "clear shot of landing gear struts and wheel"
        }
    ]
}
```

#### 2b. Сохранение в подпапку (`main.py` ~строка 287–295)

Было:
```python
file_path = os.path.join(output_dir, file_name)
```

Стало:
```python
category = eval_item.get("category", "other") or "other"
category_dir = os.path.join(output_dir, sanitize_folder_name(category))
os.makedirs(category_dir, exist_ok=True)
file_path = os.path.join(category_dir, file_name)
```

`sanitize_folder_name` уже существует — используется для имени папки запроса.

---

### Итоговый поток

```
1. Ввод запроса: "A-20G"
2. Улучшить запрос? [y/n]
3. Агент переходит на сайт → собирает URL → batch_download_and_verify
   → картинки сразу в папках landing_gear/, cockpit/, wing/
4. Агент идёт на подстраницы → снова batch → ещё картинки
5. Папка наполняется с первых минут, а не в конце
```
