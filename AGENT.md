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
| `refseeker/agent.py` | `run_agent()` — оркестрация: поиск → дедупликация → скачивание → батчи на верификацию |
| `refseeker/searcher.py` | Поиск изображений через Serper API |
| `refseeker/verify.py` | Gemini 2.5 Flash — верификация, сохранение одобренных |
| `refseeker/state.py` | Состояние сессии (CollectionState dataclass) |
| `refseeker/config.py` | Константы, logger, загрузка image_blacklist из config.json |
| `refseeker/image.py` | MIME-детекция, фильтрация URL, full-res resolution, resize для API |
| `config.json` | whitelist + blacklist сайтов, image_blacklist контента |
| `debug_run.py` | Запуск main.py с жёстко заданным запросом "Tu-160", лог в `logs/last-run.log` |

## Пайплайн

```
запрос → Serper API (2 variants: "query walkaround", "query reference photos")
       → скачивание (5 concurrent, httpx)
       → верификация Gemini 2.5 Flash (батчи по 15)
       → сохранение в references/<query>/
```

## Ключевые параметры (config.py)

| Параметр | Значение | Описание |
|---|---|---|
| `BATCH_SIZE` | 15 | макс. изображений в батче на верификацию |
| `DOWNLOAD_CONCURRENCY` | 5 | одновременных загрузок |
| `MIN_IMAGE_DIM` | 300 | мин. разрешение (пикселей) |
| `AGENT_TIMEOUT` | 600 | таймаут сессии (сек) |

## Фильтрация изображений

Каждое изображение проходит четыре этапа проверки:

1. **Разрешение** — не менее 300×300 пикселей (проверяется до вызова Gemini)
2. **Релевантность** — Gemini 2.5 Flash определяет, относится ли изображение к запросу
3. **Качество** — проверка на резкость, водяные знаки, текстовые наложения
4. **Нежелательный контент** — опционально, если заполнен `image_blacklist` в `config.json`. Gemini отбраковывает изображения, содержащие перечисленные объекты (например, `"people"`, `"diagrams"`, `"screenshots"`)
