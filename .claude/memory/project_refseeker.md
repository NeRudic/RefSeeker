---
name: refseeker-project
description: RefSeeker — Python-утилита для автоматического сбора референсных изображений через Serper API
metadata:
  type: project
---

# RefSeeker

Собирает референсные изображения: **Serper API** (Google Images) → скачивание (httpx) → верификация **Gemini 2.5 Flash**.

## Актуальная архитектура

- `agent.py` — `run_agent()`, `_download_one()` — оркестрация и скачивание
- `searcher.py` — поиск через Serper API
- `verify.py` — Gemini 2.5 Flash vision-верификация
- `image.py` — утилиты: URL validation, MIME detection, full-res resolution
- `state.py` — CollectionState + observability метрики
- `config.py` — константы, logger

## История изменений (Serper API архитектура, коммит 202c06c+)

- Переход с browser-use + Playwright на Serper API
- Замена GPT-4o mini на Gemini 2.5 Flash для верификации
- Удалены: controller.py (browser-use actions), client.py (OpenAI), download.py (CDP fetch)
