# RefSeeker — Claude Code instructions

## Rules

1. **Keep AGENT.md accurate** — after any change to the codebase structure, config, pipeline, or dependencies, update AGENT.md to reflect the current state.

2. **Always commit after changes** — after completing any task that modifies files, create a commit with a clear message describing what was changed and why.

3. **No co-authorship or attribution trailers in commits** — never add lines like `Co-Authored-By`, `Signed-off-by`, or any other automated attribution trailer to commit messages. Commit messages must only contain the human-written description of changes.

## Project context

- Python 3.10+ project for automated reference image collection
- Entry point: `main.py` → runs `refseeker.agent.run_agent()`
- Debug runner: `debug_run.py` (feeds "Tu-160" query automatically)
- Test command: `.venv/Scripts/python -m pytest tests/ -q`
- Python path: `.venv/Scripts/python`
- Key files: `refseeker/` package, `config.json`, `.env`

## Project structure

```
RefSeeker/
├── main.py                    # CLI entry point
├── run_api.py                 # FastAPI server launcher
├── debug_run.py               # Debug runner (auto-fills Tu-160)
├── requirements.txt           # Python dependencies
├── config.json                # Image blacklist config
├── .env                       # API keys + DB + JWT secrets
│
├── refseeker/                 # Backend package
│   ├── api.py                 # FastAPI: REST + SSE + auth + admin
│   ├── agent.py               # Pipeline orchestrator
│   ├── auth.py                # bcrypt, JWT, FastAPI deps
│   ├── config.py              # Constants, logger, blacklist loader
│   ├── database.py            # SQLAlchemy async engine + session
│   ├── image.py               # MIME detection, URL filter, resize
│   ├── models.py              # ORM: User, RequestLog
│   ├── progress.py            # SSE event tracker (asyncio.Queue)
│   ├── rate_limit.py          # Role limits + atomic upsert + 429
│   ├── schemas.py             # Pydantic models for auth/admin
│   ├── searcher.py            # Serper API image search
│   ├── state.py               # CollectionState dataclass
│   ├── verify.py              # Parallel vision verification
│   └── admin.py               # Admin router (users, roles)
│
├── alembic/                   # DB migrations
│   ├── env.py                 # Async Alembic config
│   └── versions/
│       └── 0001_initial.py    # Initial: users + request_logs
├── alembic.ini
│
├── tests/                     # Pytest tests
│   ├── conftest.py
│   ├── test_state.py
│   ├── test_image.py
│   └── test_download.py
│
├── web/                       # Frontend (React 19 + Vite 8)
│   ├── package.json
│   ├── vite.config.ts
│   └── src/
│       ├── main.tsx
│       ├── index.css
│       ├── app/
│       │   ├── App.tsx           # Router + providers
│       │   └── auth-context.tsx   # AuthProvider + useAuth
│       ├── pages/
│       │   ├── HomePage.tsx
│       │   ├── SearchPage.tsx
│       │   ├── GalleryPage.tsx
│       │   ├── CollectionPage.tsx
│       │   ├── LoginPage.tsx
│       │   ├── RegisterPage.tsx
│       │   └── AdminPage.tsx
│       ├── widgets/
│       │   ├── navbar/
│       │   ├── search-form/
│       │   ├── rate-limit-banner/
│       │   ├── pipeline-timeline/
│       │   ├── image-grid/
│       │   └── lightbox/
│       ├── shared/
│       │   ├── ui/            # Button, Input, Card, Badge
│       │   ├── lib/           # Utilities (cn, etc.)
│       │   └── api/           # Client + auth client
│       └── entities/          # TypeScript types
└── references/                # Saved collections (gitignored)
```

## API endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | Public | Registration |
| POST | `/api/auth/login` | Public | Login |
| POST | `/api/auth/refresh` | Public | Token refresh |
| GET | `/api/auth/me` | Optional | Current user + usage |
| POST | `/api/sessions` | Optional | Search (rate-limited) |
| GET | `/api/sessions/{id}/stream` | Public | SSE progress |
| GET | `/api/sessions/{id}` | Public | Session state |
| GET | `/api/collections` | Public | List collections |
| GET | `/api/collections/{name}` | Public | Collection detail |
| DELETE | `/api/collections/{name}` | Public | Delete collection |
| GET | `/api/admin/users` | Admin | List users |
| PATCH | `/api/admin/users/{id}/role` | Admin | Change role |
| GET | `/api/health` | Public | Health check |

## Rate limits

| Role | Requests/day |
|------|-------------|
| Unauthenticated | 1 |
| free | 2 |
| pro | 100 |
| premium | 1100 |
| admin | ∞ |
