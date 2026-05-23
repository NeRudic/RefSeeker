# RefSeeker — агент поиска референсных изображений

**Что делает:** Ищет изображения по запросу через Serper API (Google Images), скачивает, верифицирует через несколько vision-моделей параллельно.

## Стек

- Python 3.10+
- FastAPI 0.136.x — REST API + SSE
- PostgreSQL + SQLAlchemy async + asyncpg — база данных
- Alembic — миграции БД
- Serper API — поиск изображений
- **Parallel rotation:** Mistral Large 3 + Pixtral Large + Ministral 14B + Ministral 8B
- JWT + bcrypt — аутентификация
- httpx — асинхронная загрузка
- React 19 + Vite 8 + TypeScript 5.9 + Tailwind CSS 4 — фронтенд
- Framer Motion 12 — анимации
- TanStack Query 5 — управление состоянием

## Быстрый старт

### База данных

```bash
# Создать БД PostgreSQL
createdb refseeker

# Применить миграции
.venv/Scripts/python -m alembic upgrade head
```

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
| `refseeker/api.py` | FastAPI сервер: REST + SSE + auth + admin эндпоинты |
| `refseeker/auth.py` | Password hashing (bcrypt), JWT create/decode, FastAPI deps |
| `refseeker/schemas.py` | Pydantic модели для auth/admin/rate-limit |
| `refseeker/models.py` | SQLAlchemy ORM модели: User, RequestLog |
| `refseeker/database.py` | Async engine, session factory, Base |
| `refseeker/rate_limit.py` | Ролевые лимиты, атомарный upsert, 429 |
| `refseeker/admin.py` | Админ-роутер: список пользователей, смена роли |
| `refseeker/progress.py` | `ProgressTracker` — asyncio-очередь событий для SSE |
| `refseeker/searcher.py` | Поиск изображений через Serper API |
| `refseeker/verify.py` | Parallel vision verification: Mistral models (round-robin), fallback queue |
| `refseeker/state.py` | Состояние сессии (`CollectionState` dataclass) |
| `refseeker/config.py` | Константы, логгер, загрузка image_blacklist из config.json |
| `refseeker/image.py` | MIME-детекция, фильтрация URL, full-res resolution, resize для API |

### Фронтенд (`web/`)

```
web/
├── src/
│   ├── main.tsx              # Точка входа
│   ├── index.css             # Tailwind + глобальные стили
│   ├── app/
│   │   ├── App.tsx           # Провайдеры (QueryClient, Auth, Router), роутинг
│   │   └── auth-context.tsx  # AuthProvider + useAuth hook
│   ├── pages/
│   │   ├── HomePage.tsx      # Поисковый экран + rate limit banner
│   │   ├── LoginPage.tsx     # Вход
│   │   ├── RegisterPage.tsx  # Регистрация
│   │   ├── SearchPage.tsx    # Результаты: real-time пайплайн + галерея
│   │   ├── GalleryPage.tsx   # Список коллекций
│   │   ├── CollectionPage.tsx # Детальный просмотр коллекции
│   │   └── AdminPage.tsx     # Управление пользователями (admin only)
│   ├── widgets/
│   │   ├── navbar/           # Навигация + UserMenu
│   │   ├── search-form/      # Форма поиска (с rate limit handling)
│   │   ├── rate-limit-banner/ # Баннер лимитов
│   │   ├── pipeline-timeline/ # Визуализация пайплайна
│   │   ├── image-grid/       # Сетка изображений / коллекций
│   │   └── lightbox/         # Полноэкранный просмотр
│   ├── shared/
│   │   ├── ui/               # UI-kit (Button, Input, Card, Badge)
│   │   ├── lib/              # Утилиты (cn, etc.)
│   │   └── api/              # API-клиент + auth + типы
│   └── entities/
│       └── user.ts           # Типы пользователя
```

## API Endpoints

| Метод | Путь | Auth | Описание |
|---|---|---|---|
| POST | `/api/auth/register` | Public | Регистрация |
| POST | `/api/auth/login` | Public | Вход |
| POST | `/api/auth/refresh` | Public | Обновление токенов |
| GET | `/api/auth/me` | Optional | Текущий пользователь + usage |
| POST | `/api/sessions` | Optional | Создать сессию поиска (rate-limited) |
| GET | `/api/sessions/{id}/stream` | Public | SSE-поток прогресса |
| GET | `/api/sessions/{id}` | Public | Состояние сессии |
| GET | `/api/collections` | Public | Список коллекций |
| GET | `/api/collections/{name}` | Public | Изображения коллекции |
| GET | `/api/collections/{name}/images/{file}` | Public | Файл изображения |
| DELETE | `/api/collections/{name}` | Public | Удалить коллекцию |
| GET | `/api/admin/users` | Admin | Список пользователей |
| PATCH | `/api/admin/users/{id}/role` | Admin | Смена роли |
| GET | `/api/health` | Public | Health check |

## Система ролей и лимитов

| Роль | Лимит/день |
|---|---|
| Неаутентифицированный | 1 |
| free | 2 |
| pro | 100 |
| premium | 1100 |
| admin | ∞ |

Лимиты сбрасываются в UTC midnight. Атомарный upsert через PostgreSQL `INSERT ... ON CONFLICT`. JWT access token живет 15 мин, refresh — 7 дней.

## Пайплайн

```
запрос → Serper API (2 variants: "query walkaround", "query reference photos")
       → дедупликация
       → пре-фильтр URL (_is_likely_image_url + _has_null_byte)
       → full-res резолюция (_resolve_full_resolution_url + fallback)
       ┌──────────────────────────────────────────────────────────┐
       │  Конвейер: скачивание (15 concurrent, httpx) + верификация│
       │                                                          │
       │  По мере загрузки каждого изображения:                   │
       │  1. Сохраняется в .pending/                              │
       │  2. Добавляется в буфер                                   │
       │  3. При накоплении 32+ → параллельная верификация:       │
       │     ├── Mistral Large 3    → SSE (image_approved/rejected)│
       │     ├── Pixtral Large      → SSE (image_approved/rejected)│
       │     ├── Ministral 3 14B    → SSE (image_approved/rejected)│
       │     └── Ministral 8B       → SSE (image_approved/rejected)│
       │     (Gemini 2.5 Flash временно отключён из-за квоты)      │
       │  4. Fallback: выжившие провайдеры (упавшие исключаются)   │
       │  5. Одобренные → сохранение в references/<query>/         │
       └──────────────────────────────────────────────────────────┘
```

Загрузка и верификация работают параллельно — первая партия изображений
уходит на проверку, не дожидаясь окончания скачивания остальных.

## Ключевые параметры (config.py)

| Параметр | Значение | Описание |
|---|---|---|
| `BATCH_SIZE` | 15 | макс. изображений в батче на провайдера |
| `DOWNLOAD_CONCURRENCY` | 15 | одновременных загрузок |
| `MIN_IMAGE_DIM` | 300 | мин. разрешение (пикселей) |
| `RESIZE_DIM` | 768 | макс. размер перед отправкой в модели |
| `PROVIDER_CONFIG` | 4 провайдера | параллельная очередь |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | 15 | время жизни JWT access token |
| `REFRESH_TOKEN_EXPIRE_DAYS` | 7 | время жизни refresh token |

## Провайдеры верификации

Батчи изображений распределяются round-robin между провайдерами и
отправляются одновременно. Каждый провайдер стримит результаты через SSE
по мере готовности. При ошибке провайдера его батч уходит в fallback.

| Провайдер | Модель | Адаптер |
|---|---|---|
| Mistral | `mistral-large-2512` (Mistral Large 3) | mistral |
| Mistral | `pixtral-large-2411` (Pixtral Large) | mistral |
| Mistral | `ministral-14b-2512` (Ministral 3 14B) | mistral |
| Mistral | `ministral-8b-2512` | mistral |
| ~~Google~~ | ~~`gemini-2.5-flash`~~ | ~~gemini (отключён — квота)~~ |

Mistral API принимает изображения как base64. SDK синхронный — вызов
обёрнут в `asyncio.to_thread()`.

`state.saved_count` и `state.filter_stats` защищены `asyncio.Lock`.

## Падение провайдеров

Если провайдер не отвечает или возвращает ошибку, его изображения
уходят в fallback. Fallback распределяет их между **выжившими**
провайдерами параллельно. Провайдер, упавший в фазе 1, исключается
из фазы 2. Если ни один провайдер не ответил успешно — изображения
логируются как потерянные, pending-файлы удаляются.

## Фильтрация изображений

Каждое изображение проходит пять этапов проверки:

1. **Пре-фильтр URL** — отбрасываются URL с null-байтами, непохожие на изображения
2. **Разрешение** — не менее 300×300 пикселей
3. **Релевантность** — vision-модели определяют, относится ли изображение к запросу
4. **Качество** — проверка на резкость, водяные знаки, текстовые наложения
5. **Нежелательный контент** — опционально, `image_blacklist` в `config.json`

Перед отправкой в vision-модели изображения ресайзятся до 768px для экономии токенов. Оригиналы сохраняются на диск без изменений.

## Миграции БД

```bash
# Создать новую миграцию
.venv/Scripts/python -m alembic revision --autogenerate -m "description"

# Применить
.venv/Scripts/python -m alembic upgrade head

# Откатить
.venv/Scripts/python -m alembic downgrade -1
```
