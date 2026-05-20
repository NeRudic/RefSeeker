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

## Пакет правок: стабильность загрузки и токен-экономия

### 1. `page.evaluate` — убран async (CDP-совместимость)

**Проблема:** browser-use использует CDP-сессию, `page.evaluate()` принимает только не-async функции вида `(...args) =>`. Оригинальный код с `async (targetUrl) => { await fetch(...); }` всегда падал с `ValueError: JavaScript code must start with (...args) => format`, и загрузка шла через медленный Python-fallback.

**Решение:** Переписан на цепочку `.then()`:
```js
(targetUrl) => fetch(targetUrl)
    .then(response => { if (!response.ok) throw Error(...); return response.blob(); })
    .then(blob => new Promise((resolve, reject) => { ... }))
```

### 2. Resize изображений перед отправкой в GPT

**Проблема:** Полноразмерные изображения (50-100 KB каждое) в base64 съедали ~200k TPM за один батч, вызывая rate limit на GPT-4o mini и блокируя всю сессию.

**Решение:** Новая функция `resize_for_api()` — ресайзит изображение до 768px по большей стороне перед отправкой в API. Оригинальные full-res байты сохраняются на диск нетронутыми.

### 3. Retry при rate limit

**Проблема:** При превышении TPM API вызов падал без повторной попытки.

**Решение:** Добавлен retry-цикл (3 попытки) с экспоненциальной задержкой (4s → 8s → 16s) при ошибках 429/rate_limit.

### 4. Ужесточение промпта агента

**Проблема:** Агент тратил 5-8 шагов на скроллинг и обновление страницы вместо вызова `get_page_image_urls`, потому что его LLM-рассуждение решало, что страница "ещё не загрузилась" (skeleton).

**Решение:** В п. 3 инструкции добавлено `**CRITICAL:**` с явным запретом скроллить/ждать/рефрешить — вызывать `get_page_image_urls` немедленно на каждой новой странице.

---

## Пакет правок v2: устранение игнорирования batch_download_and_verify агентом

### 1. `get_page_image_urls` теперь самодостаточен (extract → download → verify → save)

**Проблема:** Агент на GPT-4o-mini последовательно игнорировал вызов `batch_download_and_verify` после `get_page_image_urls`. В сессии из 21 шага агент ни разу не вызвал batch, хотя исправно извлекал URL и ссылки. Вся собранная коллекция URL оставалась нескачанной.

**Решение:** Логика скачивания, проверки разрешения, верификации через GPT-4o mini и сохранения встроена прямо в `get_page_image_urls`. Теперь одно действие делает всё:
1. Извлекает все URL изображений со страницы
2. Скачивает каждое (до 50, с дедупликацией)
3. Проверяет разрешение (мин. 300×300 px)
4. Отправляет батч в GPT-4o mini одной vision-проверкой
5. Сохраняет одобренные изображения в категорийные подпапки

Агенту больше не нужно вызывать второе действие — достаточно одного вызова `get_page_image_urls` на каждой странице.

### 2. Радикальное упрощение промпта агента

**Проблема:** Длинный многострочный промпт (20+ строк с 8 пунктами правил) приводил к тому, что критически важные инструкции "тонули" и игнорировались агентом. Вместо следования шагу 3 (вызвать batch) агент уходил в свободное исследование подстраниц.

**Решение:** Промпт сокращён до ~15 строк с чётким пронумерованным порядком действий. Убраны:
- Подробные описания работы `batch_download_and_verify` (теперь не нужны)
- Размытые формулировки ("prioritize sites that...")
- Дублирующиеся инструкции про popup-ы

Добавлено:
- Явная команда начать с Google и ввести поисковый запрос
- Чёткий пошаговый протокол: `get_page_image_urls` → `extract_subpage_links` → повторить
- Конкретный критерий остановки: 10+ изображений → `done`

### 3. Сброс `downloaded_urls` между запусками

**Проблема:** `downloaded_urls` не очищался между запусками агента, что могло вызывать ложную дедупликацию URL между сессиями.

**Решение:** Добавлен `downloaded_urls.clear()` при инициализации `run_agent`.

---
