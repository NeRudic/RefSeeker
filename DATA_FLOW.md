# Data Flow Diagram — RefSeeker

> Как данные перемещаются от пользовательского ввода к конечному результату.

```mermaid
flowchart TB
    %% Styles
    classDef input fill:#e1f5fe,stroke:#0288d1
    classDef process fill:#fff3e0,stroke:#f57c00
    classDef external fill:#f3e5f5,stroke:#7b1fa2
    classDef storage fill:#e8f5e9,stroke:#388e3c
    classDef output fill:#fce4ec,stroke:#c62828
    classDef event fill:#fff8e1,stroke:#f9a825

    %% === ENTRY POINTS ===
    subgraph Entry["Точки входа"]
        CLI["main.py<br/>input() → query + max_images"]:::input
        API["run_api.py → uvicorn<br/>POST /api/sessions {query}"]:::input
    end

    %% === ORCHESTRATOR ===
    subgraph Orchestrator["Оркестратор"]
        Agent["agent.py : run_agent()<br/>Сброс state, запуск pipeline"]:::process
        State["state.py : CollectionState<br/>Глобальный singleton<br/>query, counters, файлы"]:::storage
    end

    %% === SEARCH ===
    subgraph Search["Фаза 1: Поиск изображений"]
        direction TB
        Searcher["searcher.py : search_images()<br/>Формирует 2 запроса:<br/>• '{query} walkaround'<br/>• '{query} reference photos'"]:::process
        Serper["Внешний API<br/>google.serper.dev/images<br/>POST с X-API-KEY"]:::external
        Dedup["agent.py<br/>Дедупликация URL<br/>(lowercase, убрать /)"]:::process
        PreFilter["image.py<br/>Предфильтрация:<br/>• _has_null_byte()<br/>• _is_likely_image_url()<br/>→ CSS/JS/JSON/PDF/Font → rejected"]:::process
    end

    %% === DOWNLOAD ===
    subgraph Download["Фаза 2: Загрузка"]
        direction TB
        Semaphore["Семафор CONCURRENCY=5<br/>httpx.AsyncClient"]:::process
        Resolve["image.py<br/>_resolve_full_resolution_url()<br/>• WordPress: -300x200 → full<br/>• /thumb/ → убрать thumb<br/>• ?w=300 → удалить"]:::process
        HTTP["HTTP GET → следуем редиректам<br/>User-Agent браузера"]:::external
        Validate["Валидация:<br/>1. Content-Type: image/*<br/>2. _detect_mime_type() по сигнатуре<br/>3. _validate_image() через Pillow"]:::process
        Pending["Сохранение в .pending/<br/>Сразу доступно для UI<br/>state.pending_files[url] = path"]:::storage
        Buffer["Буфер candidates_buffer<br/>При batch=15*n → flush"]:::process
    end

    %% === VERIFICATION ===
    subgraph Verification["Фаза 3: AI-верификация"]
        direction TB
        Flush["agent.py: _flush()<br/>→ _verify_and_save(batch)"]:::process
        RoundRobin["verify.py: _verify_parallel()<br/>Round-robin split по провайдерам"]:::process
        Mistral["Провайдеры Mistral:<br/>• mistral-large-2512<br/>• pixtral-large-2411<br/>• ministral-14b-2512<br/>• ministral-8b-2512"]:::external
        Gemini["Провайдер Gemini:<br/>• gemini-2.5-flash<br/>(отключён, quota limit)"]:::external
        Resize["image.py: _resize_for_api()<br/>max 768px, JPEG<br/>base64 (Mistral) / PIL (Gemini)"]:::process
        Prompt["verify.py: _build_verification_prompt()<br/>JSON-формат:<br/>{evaluations: [{index, relevant,<br/>high_quality, watermarked, reason}]}"]:::process
        APICall["API call с retry<br/>2-3 попытки, эксп. backoff<br/>8 images максимум per call"]:::external
        Parse["Парсинг JSON ответа"]:::process
        Fallback["Fallback queue:<br/>Failed → reprocess<br/>через выжившие providers"]:::process
    end

    %% === EVALUATION ===
    subgraph Evaluation["Фаза 4: Оценка и сохранение"]
        direction TB
        Lock["asyncio.Lock<br/>Защита state mutations"]:::process
        Check["Проверка каждого image:<br/>• relevant? → нет → not_relevant<br/>• high_quality? → нет → low_quality<br/>• watermarked? → да → watermarked<br/>• unwanted_content? → да → unwanted"]:::process
        Move["ACCEPTED:<br/>move .pending/img →<br/>references/{query}/image_N.ext"]:::storage
        Delete["REJECTED:<br/>delete .pending/ file"]:::process
        FullCheck["state.is_full?<br/>(saved_count >= max_images)<br/>→ stop pipeline"]:::process
    end

    %% === EVENTS ===
    subgraph Events["SSE Events (progress.py)"]
        direction TB
        E1["search.started"]:::event
        E2["search.complete"]:::event
        E3["download.started"]:::event
        E4["download.progress"]:::event
        E5["download.image_downloaded"]:::event
        E6["download.complete"]:::event
        E7["verification.batch_started"]:::event
        E8["image.approved"]:::event
        E9["image.rejected"]:::event
        E10["verification.batch_complete"]:::event
        E11["session.complete"]:::event
        E12["session.error"]:::event
    end

    %% === OUTPUT ===
    subgraph Output["Конечный результат"]
        FinalDir["references/{query}/<br/>image_1.jpg ... image_N.jpg"]:::output
        Metrics["state.log_metrics()<br/>Финальный лог:<br/>saved, attempts,<br/>gpt_calls, elapsed, filters"]:::output
        SSE_Stream["GET /api/sessions/{id}/stream<br/>SSE → JSON → Frontend"]:::output
        Cleanup["Очистка .pending/"]:::process
    end

    %% === CONNECTIONS ===

    %% Entry → Orchestrator
    CLI -->|"query, max_images"| Agent
    API -->|"query, max_images"| Agent
    Agent -->|"state.reset()"| State

    %% Orchestrator → Search
    Agent -->|"search_images()"| Searcher
    Searcher -->|"HTTP POST"| Serper
    Serper -->|"imageUrl[]"| Searcher
    Searcher -->|"URLs raw"| Dedup
    Dedup -->|"unique URLs"| PreFilter

    %% Search → Download
    PreFilter -->|"filtered_urls[]"| Semaphore

    %% Download flow
    Semaphore -->|"for each URL"| Resolve
    Resolve -->|"full-res URL"| HTTP
    HTTP -->|"image bytes"| Validate
    Validate -->|"passed"| Pending
    Validate -->|"failed"-->|"skip"| Semaphore
    Pending -->|"(url, mime, bytes, w, h)"| Buffer

    %% Download → Verification
    Buffer -->|"batch ready"| Flush

    %% Verification flow
    Flush --> RoundRobin
    RoundRobin -->|"group 1"| Mistral
    RoundRobin -->|"group 2"| Gemini
    Mistral -->|"chunk ≤8 images"| Resize
    Gemini --> Resize
    Resize --> Prompt
    Prompt -->|"base64/PIL"| APICall
    APICall -->|"JSON response"| Parse
    Parse -->|"success"| Lock
    Parse -->|"failure"| Fallback
    Fallback -->|"retry other provider"| APICall

    %% Evaluation
    Lock --> Check
    Check -->|"ACCEPTED"| Move
    Check -->|"REJECTED"| Delete
    Move --> FullCheck
    Delete --> FullCheck
    FullCheck -->|"not full → continue"| Buffer
    FullCheck -->|"full → stop"| Cleanup

    %% Events emitted throughout
    Searcher -.->|"search.started<br/>search.complete"| E1
    Searcher -.->|"search.complete"| E2
    Semaphore -.->|"download.started"| E3
    Validate -.->|"download.progress<br/>download.image_downloaded"| E4
    Validate -.->|"download.image_downloaded"| E5
    Buffer -.->|"download.complete"| E6
    Flush -.->|"verification.batch_started"| E7
    Move -.->|"image.approved"| E8
    Delete -.->|"image.rejected"| E9
    Parse -.->|"verification.batch_complete"| E10

    %% Final output
    Move --> FinalDir
    FullCheck --> Metrics
    FullCheck --> Cleanup
    Cleanup -->|"session.complete"| SSE_Stream
    Metrics --> SSE_Stream
    FinalDir --> SSE_Stream
    E11 -.-> SSE_Stream
    E12 -.-> SSE_Stream

    %% API endpoints (additional)
    API -.->|"GET /api/collections"| FinalDir
    API -.->|"GET /api/collections/{name}/images/{filename}"| FinalDir
    API -.->|"GET /api/sessions/{id}"| State
```

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
