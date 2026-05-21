# RefSeeker — агент поиска референсных изображений

**Что делает:** Ищет изображения по запросу через Serper API (Google Images), скачивает, верифицирует через Gemini 2.5 Flash.

## Стек

- Python 3.10+
- Serper API — поиск изображений
- Gemini 2.5 Flash — vision-верификация
- httpx — асинхронная загрузка

## Точка входа

`main.py` — запрашивает поисковый запрос и лимит изображений, запускает `refseeker.agent.run_agent()`.

## Как запустить

```bash
cd "D:/Рабочий стол/Antigravity/RefSeeker"
.venv/Scripts/python main.py
```

## Структура проекта

| Файл | Назначение |
|---|---|
| `main.py` | Точка входа, ввод запроса, event loop |
| `refseeker/searcher.py` | Поиск изображений через Serper API |
| `refseeker/download.py` | Асинхронное скачивание кандидатов (httpx) |
| `refseeker/verify.py` | Gemini 2.5 Flash — верификация |
| `refseeker/state.py` | Состояние сессии (CollectionState dataclass) |
| `refseeker/config.py` | Константы, logger |
| `refseeker/image.py` | MIME-детекция, фильтрация URL, full-res resolution |
| `config.json` | whitelist + blacklist сайтов |

## Пайплайн

```
запрос → Serper API (2 variants: "query walkaround", "query reference photos")
       → скачивание (5 concurrent, httpx)
       → верификация Gemini 2.5 Flash (батчи по 25)
       → сохранение в references/<query>/
```

## Ключевые параметры (config.py)

| Параметр | Значение | Описание |
|---|---|---|
| `BATCH_SIZE` | 25 | макс. изображений в батче на скачивание |
| `DOWNLOAD_CONCURRENCY` | 5 | одновременных загрузок |
| `MIN_IMAGE_DIM` | 300 | мин. разрешение (пикселей) |
| `AGENT_TIMEOUT` | 600 | таймаут сессии (сек) |
