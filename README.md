# RefSeeker — автоматический сбор референсных изображений

**RefSeeker** — утилита для поиска и отбора качественных референсных изображений через Serper API (Google Images) с параллельной верификацией через несколько vision-моделей.

## Возможности

- **Поиск через Serper API** — два запроса на сессию для максимального покрытия
- **Параллельная верификация** — изображения проверяются одновременно 4 моделями (Mistral Large 3, Pixtral Large, Ministral 14B, Ministral 8B) с round-robin распределением
- **Real-time прогресс** — SSE-поток событий, изображения появляются в UI сразу после загрузки
- **Авто-фильтрация** — отсев по размеру, релевантности, качеству, водяным знакам и нежелательному контенту
- **Fallback-механизм** — при ошибке провайдера его батч уходит к следующему
- **REST API + Web UI** — FastAPI бэкенд с React фронтендом

## Установка

### Требования

- Python 3.10+
- API-ключи: Serper и хотя бы один из vision-провайдеров

### Шаги

```bash
# 1. Клонировать репозиторий
git clone <url>
cd RefSeeker

# 2. Создать виртуальное окружение
python -m venv .venv

# 3. Активировать окружение
# Windows:
.venv\Scripts\activate
# Linux/macOS:
source .venv/bin/activate

# 4. Установить зависимости
pip install -r requirements.txt

# 5. Настроить API-ключи
echo "SERPER_API_KEY=your-serper-key" > .env
echo "MISTRAL_API_KEY=your-mistral-key" >> .env
```

## Настройка

### `.env`

```
SERPER_API_KEY=your-serper-key-here
MISTRAL_API_KEY=your-mistral-key-here
GEMINI_API_KEY=your-gemini-key-here  # опционально, пока отключён
```

### `config.json`

```json
{
    "image_blacklist": ["graphic_nudity", "violence"]
}
```

`image_blacklist` — опциональный список ключевых слов для фильтрации нежелательного контента.

## Использование

### CLI

```bash
python main.py
```

Введите поисковый запрос (например, `Tu-160`) и желаемое количество изображений.

### API сервер

```bash
.venv/Scripts/python run_api.py
# → http://127.0.0.1:8000
```

### Web UI

```bash
cd web
npm run dev
# → http://localhost:5173 (проксирует /api → 8000)
```

### Debug

```bash
.venv/Scripts/python debug_run.py
# Авто-запрос "Tu-160", лог в logs/last-run.log
```

## Структура проекта

```
RefSeeker/
├── main.py                 # CLI точка входа
├── run_api.py              # FastAPI сервер
├── debug_run.py            # Debug-раннер
├── config.json             # image_blacklist
├── .env                    # API-ключи
├── requirements.txt
├── AGENT.md                # Документация для Claude
├── refseeker/              # Пакет бэкенда
│   ├── agent.py            # Оркестрация пайплайна
│   ├── api.py              # FastAPI: REST + SSE
│   ├── config.py           # Константы, логгер, провайдеры
│   ├── image.py            # MIME-детекция, resize, валидация
│   ├── progress.py         # SSE-очередь событий
│   ├── searcher.py         # Поиск через Serper API
│   ├── state.py            # Состояние сессии
│   └── verify.py           # Параллельная верификация
├── web/                    # React фронтенд
├── tests/                  # Тесты
└── references/             # Сохранённые коллекции
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
| GET | `/api/settings/blacklist` | Текущий blacklist |
| POST | `/api/settings/blacklist` | Обновить blacklist |

## Как это работает

### Пайплайн

```
запрос → Serper API (2 variants: "query walkaround", "query reference photos")
       → дедупликация
       → пре-фильтр URL (null-байты, не-image расширения)
       → full-res резолюция (WordPress/thumb паттерны)
       ┌──────────────────────────────────────────────────────┐
       │  Скачивание (5 concurrent, httpx) + верификация      │
       │                                                      │
       │  1. Сохраняется в .pending/ (сразу в UI)             │
       │  2. Добавляется в буфер                              │
       │  3. При накоплении 30+ → параллельная верификация:   │
       │     ├── Mistral Large 3    → SSE (approved/rejected)  │
       │     ├── Pixtral Large      → SSE (approved/rejected)  │
       │     ├── Ministral 14B      → SSE (approved/rejected)  │
       │     └── Ministral 8B       → SSE (approved/rejected)  │
       │  4. Fallback при ошибке провайдера                    │
       │  5. Одобренные → references/<query>/                  │
       └──────────────────────────────────────────────────────┘
```

### Фильтрация

Каждое изображение проходит этапы:

1. **Пре-фильтр URL** — null-байты, непохожие на изображения URL
2. **Разрешение** — не менее 300×300 пикселей
3. **Релевантность** — vision-модели определяют соответствие запросу
4. **Качество** — проверка на резкость, водяные знаки, текстовые наложения
5. **Нежелательный контент** — `image_blacklist` в `config.json`

### Провайдеры

| Провайдер | Модель |
|---|---|
| Mistral | `mistral-large-2512` (Mistral Large 3) |
| Mistral | `pixtral-large-2411` (Pixtral Large) |
| Mistral | `ministral-14b-2512` (Ministral 3 14B) |
| Mistral | `ministral-8b-2512` |

Батчи изображений распределяются round-robin. Каждый провайдер стримит результаты через SSE. При ошибке — fallback на следующий.

## Зависимости

- `httpx` — HTTP-клиент
- `google-genai` — Gemini API (отключён)
- `mistralai` — Mistral API
- `Pillow` — обработка изображений
- `python-dotenv` — загрузка .env
- `fastapi` + `uvicorn` — API сервер

## Тесты

```bash
.venv/Scripts/python -m pytest tests/ -q
```

## Примечания

- `.env` и `refseeker.log` в `.gitignore` — ключи и логи не попадают в репозиторий
- Расход токенов зависит от количества и размера изображений
- При повторном запросе создаётся новая коллекция, файлы не перезаписываются
- Gemini 2.5 Flash временно отключён в `config.py` из-за дневной квоты
