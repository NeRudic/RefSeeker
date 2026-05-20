---
name: refseeker-project
description: RefSeeker — Python-утилита для автоматического сбора референсных изображений через browser-use агента
metadata:
  type: project
---

# RefSeeker

Собирает референсные изображения через browser-use агента, используя **DeepSeek (deepseek-chat)** для reasoning/навигации и **GPT-4o mini** только для vision-верификации изображений.

## Текущее состояние (2026-05-20, после фиксов)

**Основные проблемы на момент коммита 85ed998:**
1. Google Images блокирует автоматизированные браузеры (антибот)
2. Bing не выполняет поиск при открытии новой вкладки с URL-параметром
3. Агент сдаётся после 2 неудач, не доходя до preferred sites

**Что было исправлено (коммит 85ed998):**
- `_is_likely_image_url` переписан на negative filtering — CDN-URL без расширения не отбрасываются
- Добавлен таймаут 600с на `agent.run()` — агент не зависает бесконечно
- Починен краш `extract_subpage_links` при возврате не-list из json.loads
- Добавлена Content-Type проверка в Python fallback — HTML не сохраняется как JPEG
- Промпт агента переписан: preferred sites сначала, поисковики — fallback
- Добавлены метрики сессии: visited_pages, domains, gpt_calls, download_attempts, elapsed
- 28 тестов для image.py, state.py, download.py

**Нерешённые проблемы:**
- Google Images блокирует бота (антибот-защита)
- Bing не выполняет поиск при открытии новой вкладки с URL
- Нет browser warming / stealth / fingerprint рандомизации
- Нет circuit breaker для GPT API
- background-image парсинг через querySelectorAll('*') — слив производительности
- URL manipulation для full-resolution (удаление размерных суффиксов) — не реализовано

**Решённые проблемы (2026-05-20, второй раунд фиксов):**
- `_sanitize_folder_name` теперь делает `.lower()`, чистит точки (блокировка path traversal), обрезает до 40 символов, падает на `..` → `other`
- Промпт категоризации (verify.py) переписан: убраны авиа-примеры (`landing_gear`, `cockpit`, etc.), добавлен generic guidance: "5-10 категорий, консистентность, конкретные имена, lowercase_with_underscores"
- Категоризация без закрытого enum: GPT генерирует свободные категории, Python только санитизирует формат — максимальная универсальность

## Структура
- `agent.py` — создание агента, DeepSeek LLM, промпт, query expansion
- `controller.py` — экшены `get_page_image_urls`, `extract_subpage_links`
- `download.py` — скачивание через CDP fetch + Python fallback
- `verify.py` — GPT-4o mini vision верификация и категоризация
- `image.py` — утилиты: URL validation, MIME detection, resize
- `state.py` — CollectionState + observability метрики
- `config.py` — константы: MAX_IMAGES=30, AGENT_TIMEOUT=600, etc.
- `client.py` — OpenAI + DeepSeek клиенты

**Why:** DeepSeek для reasoning, GPT только для vision, чтобы разделить стоимость и использовать сильную модель для навигации.
