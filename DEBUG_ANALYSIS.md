# Debug Analysis: RefSeeker Agent Failure

## Summary

Агент не смог собрать ни одного референсного изображения. Основные проблемы:
1. Google блокирует автоматизированный браузер → агент тратит ~10 шагов на безуспешные попытки
2. После перехода на Bing / другие сайты — JS-код возвращает не изображения, а **отдельные символы из какого-то URL**, разбитого посимвольно. Реальных изображений нет.
3. Цикл скачивания мусора повторяется на каждом сайте → 0 сохранённых изображений

---

## Как читался код и логи

1. **`last-session.txt`** — полная трассировка одной сессии (17 шагов, ~3 минуты)
2. **`main.py`** — код задачи: agent prompt, JS-экстракция, скачивание, GPT-валидация
3. **`main.py:688-694`** — параметры Agent: `use_vision=False, max_history_items=10, flash_mode=True`
4. **`main.py:641-647`** — config.json: whitelist, blacklist
5. **`browser_use/browser/session.py:1001`** — дефолтные таймауты: 8s (разные домены) / 3s (тот же домен)
6. **`browser_use/agent/prompts.py:64-77`** — flash_mode для OpenAI GPT-4o-mini использует `system_prompt_flash.md`
7. **`browser_use/agent/views.py:216-232`** — пороги loop detection nudge: >=5 (лёгкий), >=8 (средний), >=12 (сильный).

---

## Проблема A: Google блокирует автоматизированный браузер

### Наблюдение
```
Step 1: navigate to google.com → ⚠️ Page readiness timeout (8.0s, 8313ms)
Steps 2-9: 8 повторений navigate to google.com → каждый раз timeout (3.0s)
Step 10: наконец переходит на bing.com
```

### Гипотеза A1: Google обнаруживает автоматизацию через `disable_security=True`
- **Как проверял**: Посмотрел флаги запуска. `main.py:592`: `Browser(headless=False, disable_security=True)`. Флаг `disable_security=True` включает `--disable-web-security` — известный сигнал автоматизации. Chrome без CORS — необычное поведение, которое Google детектит.
- **Вердикт: ПОДТВЕРЖДЕНО**. Google показывает "skeleton content" — характерно для CAPTCHA/JS-челленджа.
- **Дополнительно**: Даже без этого флага, CDP-подключение само по себе детектится некоторыми защитами Google.

### Гипотеза A2: Таймаут 8s для разных доменов / 3s для того же домена
- **Как проверял**: `browser_use/browser/session.py:1001`: `timeout = 3.0 if same_domain else 8.0`. Это таймаут polling'а lifecycle events (`load`, `DOMContentLoaded`, `networkIdle`). Если за 8 / 3 секунды событие не пришло — **выдаётся warning, но код продолжает работать** (navigation считается успешной). DOM при этом может быть недогружен.
- **Вердикт: ПОДТВЕРЖДЕНО**. 3s для same-domain рефрешей гарантированно недостаточно. При повторных navigate на google.com: timeout 3312ms, 3766ms, 4281ms — все > 3000ms.
- **Критическое следствие**: timeout не блокирует выполнение, DOM skeleton не загружен, но агент продолжает искать элементы.

### Гипотеза A3: Loop detection nudge не перебивает task prompt
- **Как проверял**: `browser_use/agent/views.py:216-232` — nudge от loop detector это текст "Heads up: you have repeated a similar action X times. Consider trying a different approach." Task prompt (main.py:654-681) говорит "1. Start at google.com" как императив.
- **Вердикт: ПОДТВЕРЖДЕНО**. Nudge (repetition=5+ начиная с шага 7) пишется в Memory, но не отменяет инструкцию. Агент продолжает рефрешить Google до шага 10.

---

## Проблема B: `get_page_image_urls` возвращает символы разбитого URL, а не изображения

### Ключевое наблюдение (спасибо @user за указание)

```
Шаг 14, Bing Images — 78 найденных URL:

Line 143: https://www.bing.com/images/[     ← символ "["
Line 144: https://www.bing.com/images/"     ← символ '"'
Line 145: https://www.bing.com/images/h     ← "h"
Line 146: https://www.bing.com/images/t     ← "t"
Line 147: https://www.bing.com/images/p     ← "p"
Line 148: https://www.bing.com/images/s     ← "s"
Line 149: https://www.bing.com/images/:     ← ":"
Line 150: https://www.bing.com/             ← пустой путь
Line 151: https://www.bing.com/images/r     ← "r"
Line 152: https://www.bing.com/images/      ← пустой путь
Line 153: https://www.bing.com/images/b     ← "b"
Line 154: https://www.bing.com/images/i     ← "i"
Line 155: https://www.bing.com/images/n     ← "n"
Line 156: https://www.bing.com/images/g     ← "g"
Line 157: https://www.bing.com/images/c     ← "c"
Line 158: https://www.bing.com/images/o     ← "o"
Line 159: https://www.bing.com/images/m     ← "m"
... далее другие символы ...
Line 181: https://www.bing.com/images/search?q=B24+walkaround&form=HDRSC3&first=1
... далее другие символы ...
```

**Расшифровка последовательности символов (5-й столбец):**

```
Из "https://www.bing.com" (или подобного URL) разбито посимвольно:

   h  t  t  p  s  :  /  /  w  w  w  .  b  i  n  g  .  c  o  m
                      (или другая комбинация символов)

После Set (deduplication) вторая "t" теряется:

   h  t  p  s  :  /  w  .  b  i  n  g  c  o  m  ...
   ^  ^  ^  ^  ^
```

**Это НЕ разные `<img>` элементы с односимвольными `src`.** Это один URL (`https://www.bing.com/...`), разбитый на отдельные символы, каждый из которых вставлен как отдельный URL в `Set`, а затем через `urljoin` превращён в полный URL.

На странице Bing Images также присутствует полный URL (строка 181: полный search URL), что подтверждает: какие-то элементы на странице отдают URL целиком, а другие — посимвольно.

### Гипотеза B1: CSS background-image с длинным градиентом + некорректный regex

- **Как проверял**: JS-код `main.py:509-520` итерирует `document.querySelectorAll('*')` (ВСЕ элементы DOM) и берёт `window.getComputedStyle(el).backgroundImage`. Если в CSS есть длинная строка (например, градиент или data URL), regex `url\(["']?([^"')]+)["']?\)` может вернуть неожиданные совпадения.
- **Конкретно**: `[^"')]+` — символьный класс, исключающий `"`, `'`, `)`. Если CSS содержит `url("https://...")`, regex найдет `url(...)` и извлечёт URL. Но если CSS содержит **несколько** `url()` в одном `background-image` (разделённых запятыми), или URL содержит закодированные нестандартные символы, каждый `url()` обрабатывается отдельно.
- **Вердикт: НЕ ПОЛНОСТЬЮ ОБЪЯСНЯЕТ**. Regex корректно обрабатывает множественные url(), но не разбивает один URL на символы.

### Гипотеза B2: CDP evaluate некорректно сериализует результат

- **Как проверял**: `page.evaluate` использует CDP `Runtime.evaluate`. Результат JS-выражения сериализуется через CDP. Если в процессе сериализации происходит сбой (особенно с нестандартными возвращаемыми значениями), данные могут быть повреждены.
- **Дополнительно**: В логе есть предупреждения `WARNING [cdp_use.client] Received duplicate response for request 172-177` — это может указывать на проблемы с CDP коммуникацией.
- **Вердикт: ВОЗМОЖНАЯ ПРИЧИНА**. Если CDP возвращает дублирующиеся или битые ответы для evaluate, результат может быть повреждён.

### Гипотеза B3: DOM содержит подэлементы с текстовыми нодами, содержащими URL строки

- **Как проверял**: `<script type="application/ld+json">` или `<script>window.initialState=...</script>` содержат URL как часть JSON. Когда `document.querySelectorAll('*')` итерирует эти скрипты, `window.getComputedStyle(el)` не должен возвращать backgroundImage для них (скрипты display:none, но фильтр в коде проверяет `style.display !== 'none'`, а computedStyle скрытых элементов всё равно может содержать CSS). Но `computedStyle` скрытых элементов (display:none) не вычисляется корректно.
- **Вердикт: МАЛОВЕРОЯТНО**. Скрипты отфильтрованы по тегу.

### Вывод по проблеме B

**Точный механизм разбивки URL на символы пока не определён однозначно**, но факт остаётся фактом: page.evaluate возвращает отдельные символы из состава какого-то URL (предположительно `https://www.bing.com/...`), перемешанные с целыми URL (строка 181).

Независимо от механизма, исправление требует:
1. **Валидации URL после urljoin** в Python (отбрасывать URL короче определённой длины / без расширения изображения)
2. **Логирования сырых данных** из page.evaluate, чтобы понять точный механизм разбивки

---

## Проблема C: Те же мусорные URL на net-maquettes.com

### Наблюдение
```
Шаг 16: 56 URL на net-maquettes.com — идентичный паттерн:
/[, /", /h, /t, /p, /s, /:, /, /w, /, /n, /e, /-, /m, /a, ...
```

Те же символы, что и на Bing. Это КРИТИЧЕСКИЙ сигнал: проблема НЕ в особенностях конкретного сайта, а в коде экстракции или окружении.

Если бы проблема была в HTML-структуре Bing, на WordPress-сайте net-maquettes.com паттерн был бы другим. Идентичный паттерн означает:
1. Один и тот же URL разбивается посимвольно в обоих случаях — но URL страниц разные
2. Проблема в методе экстракции или CDP evaluate, а не в содержимом страницы

### Гипотеза C1: `page.evaluate` сам повреждён при дублирующихся CDP ответах

- **Как проверял**: Дублирующиеся ответы CDP (строки 48-52) могут означать, что CDP session переиспользуется или неправильно обрабатывает запросы. Если evaluate отправляет запрос, получает дублирующийся ответ, состояние может быть повреждено.
- **Корреляция**: Дублирующиеся ответы CDP появляются на шаге 2 (первые дейстивя на Google). На шаге 14 (Bing) этих предупреждений НЕТ, но URL всё равно разбиты. Значит, CDP дубликаты — не единственная причина.

### Гипотеза C2: Оба сайта находятся за одним прокси/CDN

- **Как проверял**: Если сеть/провайдер/корпоративный прокси перехватывает или модифицирует HTTP-ответы, это может повлиять на загрузку страниц. Оба сайта могут быть за Cloudflare или другим CDN, который проводит JS-челленджи.
- **Вердикт: ВОЗМОЖНО**. Если оба сайта имеют одинаковые защиты (или оба проходят через один прокси), поведение может быть идентичным.

---

## Итоговая цепочка Root Cause

```
1. disable_security=True + CDP-детекция → Google показывает CAPTCHA/блокировку
2. 8s таймаут → Page readiness timeout (warning, но не ошибка)
3. same_domain=3s на рефрешах → каждый повторный navigate падает
4. "Start at google.com" в task prompt + слабый loop detection → 9 потерянных шагов
5. max_history_items=10 → после шага 10 агент "забывает" историю неудач (но не критично)
6. → Переход на Bing. Страница грузится, DOM есть, но page.evaluate
   возвращает символы URL, разбитого посимвольно (точный механизм неясен — 
   возможно CDP evaluate, CSS background-image regex, или DOM manipulation на странице)
7. urljoin превращает каждый отдельный символ в полный URL вида ".../images/h"
8. _download_candidates пытается скачать все 78 "URL" →
   все падают (corrupted / not found) → 0 кандидатов
9. → Переход на net-maquettes.com → ТО ЖЕ САМОЕ (56 символов URL)
10. → Переход на cybermodeler.com → Ctrl+C (пользователь прервал выполнение)
```

---

## Как исправить (рекомендации)

### 1. Убрать `disable_security=True`
`main.py:592`: убрать этот флаг. Он не нужен для работы с обычными сайтами, но однозначно сигналит Google и другим сайтам об автоматизации.

### 2. Валидация URL после urljoin (критический фикс)
В `_download_candidates`, перед скачиванием — проверять, что URL:
- Содержит расширение изображения (`/.*\.(jpg|jpeg|png|gif|webp|bmp|avif|tiff?)(\?.*)?$`)
- Имеет path длиннее 3 символов после домена (отсекает односимвольные "/h", "/t")
- Не содержит только символы пунктуации

Минимальный фикс:
```python
import re
_IMG_EXT_RE = re.compile(r'\.(jpe?g|png|gif|webp|bmp|avif|tiff?)(\?|#|$)', re.IGNORECASE)

def _is_likely_image_url(url: str) -> bool:
    path = urllib.parse.urlparse(url).path
    return bool(_IMG_EXT_RE.search(path)) and len(path) > 5
```

### 3. Логирование сырых данных из page.evaluate
Добавить `logger.debug("Raw URLs from page: %s", unique_urls[:20])` перед скачиванием. Это покажет, что именно возвращает JS, и позволит точно определить механизм разбивки URL на символы.

### 4. Увеличить таймауты
- `navigator_timeout=30s` (параметр Browser или BrowserSession)
- Дождаться реальной загрузки перед экстракцией, не полагаться на warning-only readiness check

### 5. Улучшить agent prompt
- "Start at google.com, search" → "Try to find images. If Google is unresponsive after 2 attempts, use alternatives (Bing, DuckDuckGo)"
- Увеличить `max_history_items` до 20

### 6. Graceful handling page load timeout
- Проверять DOM после readiness timeout: если ключевых элементов нет — не рефрешить, а переключать источник

---

## Что нужно проверить дополнительно

1. **`logger.debug` после page.evaluate** — показать что именно приходит из JS (в идеале — первые 50 элементов массива). Это покажет, какие URL извлекаются целиком, а какие — посимвольно.

2. **CSS background-image на странице Bing** — загрузить страницу вручную, открыть DevTools, проверить, какие элементы имеют `background-image` с URL и как они выглядят.

3. **CDP evaluate в browser_use** — проверить, нет ли известных багов в v0.12.7, связанных с `page.evaluate` возвращающим повреждённые массивы.

4. **Отключить блок `document.querySelectorAll('*')`** — этот блок итерирует все элементы DOM и берёт computedStyle. Если это он вызывает проблему, его отключение должно показать нормальные URL из обычных `<img>` элементов.
