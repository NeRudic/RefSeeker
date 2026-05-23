# Data Flow Diagram — RefSeeker

## Краткое описание шагов

| Шаг | Что происходит | Ключевой файл |
|---|---|---|
| **0** | Пользователь вводит запрос (CLI или API) | `main.py` / `api.py` |
| **1** | Поиск URL изображений через Serper API (2 запроса по 100 результатов) | `searcher.py` |
| **2** | Дедупликация и предфильтрация URL (отсев CSS/JS/PDF и т.д.) | `agent.py` + `image.py` |
| **3** | Параллельная загрузка (5 конкурентных) с резолюцией полного разрешения | `agent.py:_download_one()` |
| **4** | Валидация Content-Type + Pillow decode | `image.py` |
| **5** | Сохранение в `.pending/` (сразу доступно UI) | `agent.py` |
| **6** | Буферизация батча → AI-верификация (round-robin по Mistral/Gemini) | `verify.py:_verify_parallel()` |
| **7** | Оценка: relevant, high_quality, watermarked, unwanted_content | `verify.py:_process_evaluations()` |
| **8** | Принятые → `references/{query}/`, отклонённые → удалены | `verify.py` + `state.py` |
| **9** | SSE события транслируются через `ProgressTracker` | `progress.py` + `api.py` |
| **10** | Финальные метрики + очистка `.pending/` | `agent.py` |
