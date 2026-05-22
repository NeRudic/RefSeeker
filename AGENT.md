# RefSeeker — агент поиска референсных изображений

**Что делает:** Ищет изображения по запросу через Serper API (Google Images), скачивает, верифицирует через Gemini 2.5 Flash.

## Стек

- Python 3.10+
- FastAPI 0.136.x — REST API + SSE
- Serper API — поиск изображений
- Gemini 2.5 Flash — vision-верификация
- httpx — асинхронная загрузка
- React 19 + Vite 8 + TypeScript 5.9 + Tailwind CSS 4 — фронтенд
- Framer Motion 12 — анимации
- TanStack Query 5 — управление состоянием

## Быстрый старт

### Бэкенд (API сервер)

```bash
cd "D:/Рабочий стол/Antigravity/RefSeeker"
.venv/Scripts/python run_api.py
# → http://127.0.0.1:8000
```

### Фронтенд (dev-режим)

```bash
cd web
npm run dev
# → http://localhost:5173 (проксирует /api → 8000)
```

### CLI-режим (без веба)

```bash
.venv/Scripts/python main.py
```

### Debug

```bash
.venv/Scripts/python debug_run.py
```

## Структура проекта

### Бэкенд (`refseeker/`)

| Файл | Назначение |
|---|---|
| `main.py` | Точка входа (CLI), ввод запроса, event loop |
| `run_api.py` | Запуск FastAPI сервера |
| `refseeker/agent.py` | `run_agent()` — оркестрация всего пайплайна |
| `refseeker/api.py` | FastAPI сервер: REST + SSE эндпоинты |
| `refseeker/progress.py` | `ProgressTracker` — asyncio-очередь событий для SSE |
| `refseeker/searcher.py` | Поиск изображений через Serper API |
| `refseeker/verify.py` | Gemini 2.5 Flash — верификация, сохранение одобренных |
| `refseeker/state.py` | Состояние сессии (`CollectionState` dataclass) |
| `refseeker/config.py` | Константы, логгер, загрузка `image_blacklist` из config.json |
| `refseeker/image.py` | MIME-детекция, фильтрация URL, full-res resolution, resize для API |

### Фронтенд (`web/`)

```
web/
├── src/
│   ├── main.tsx              # Точка входа
│   ├── index.css             # Tailwind + глобальные стили
│   ├── app/
│   │   └── App.tsx           # Провайдеры (QueryClient, Router), роутинг
│   ├── pages/
│   │   ├── HomePage.tsx      # Поисковый экран с премиальным UI
│   │   ├── SearchPage.tsx    # Результаты: real-time пайплайн + галерея
│   │   ├── GalleryPage.tsx   # Список коллекций
│   │   └── CollectionPage.tsx # Детальный просмотр коллекции
│   ├── widgets/
│   │   ├── navbar/           # Навигация
│   │   ├── search-form/      # Форма поиска
│   │   ├── pipeline-timeline/ # Визуализация пайплайна
│   │   ├── image-grid/       # Сетка изображений / коллекций
│   │   └── lightbox/         # Полноэкранный просмотр
│   ├── shared/
│   │   ├── ui/               # UI-kit (Button, Input, Card, Badge)
│   │   ├── lib/              # Утилиты (cn, etc.)
│   │   └── api/              # API-клиент + типы
│   └── entities/             # Типы предметной области
```

## API Endpoints

| Метод | Путь | Описание |
|---|---|---|
| POST | `/api/sessions` | Создать сессию поиска |
| GET | `/api/sessions/{id}/stream` | SSE-поток прогресса |
| GET | `/api/sessions/{id}` | Состояние сессии |
| GET | `/api/collections` | Список коллекций |
| GET | `/api/collections/{name}` | Изображения коллекции |
| GET | `/api/collections/{name}/images/{file}` | Файл изображения |
| DELETE | `/api/collections/{name}` | Удалить коллекцию |
| GET | `/api/health` | Health check |

## Пайплайн

```
запрос → Serper API (2 variants: "query walkaround", "query reference photos")
       → дедупликация
       → пре-фильтр URL (_is_likely_image_url + _has_null_byte)
       → full-res резолюция (_resolve_full_resolution_url + fallback)
       → скачивание (5 concurrent, httpx)
       → resize до 768px для Gemini API
       → верификация Gemini 2.5 Flash (батчи по 15)
       → сохранение в references/<query>/
```

## Ключевые параметры (config.py)

| Параметр | Значение | Описание |
|---|---|---|
| `BATCH_SIZE` | 15 | макс. изображений в батче на верификацию |
| `DOWNLOAD_CONCURRENCY` | 5 | одновременных загрузок |
| `MIN_IMAGE_DIM` | 300 | мин. разрешение (пикселей) |
| `RESIZE_DIM` | 768 | макс. размер перед отправкой в Gemini |

## Фильтрация изображений

Каждое изображение проходит пять этапов проверки:

1. **Пре-фильтр URL** — отбрасываются URL с null-байтами, непохожие на изображения
2. **Разрешение** — не менее 300×300 пикселей
3. **Релевантность** — Gemini 2.5 Flash определяет, относится ли изображение к запросу
4. **Качество** — проверка на резкость, водяные знаки, текстовые наложения
5. **Нежелательный контент** — опционально, `image_blacklist` в `config.json`

Перед отправкой в Gemini изображения ресайзятся до 768px для экономии токенов. Оригиналы сохраняются на диск без изменений.
