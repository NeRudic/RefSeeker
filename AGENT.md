# RefSeeker — AI-агент для поиска референсов 3D-дизайнерам

**Что делает:** AI-агент, который автоматически ищет референсные изображения по запросу. Использует browser-use для навигации по whitelist-сайтам, извлекает изображения и верифицирует их через GPT-4o mini (вижн).

## Стек

- Python
- browser-use 0.12.7
- OpenAI API (GPT-4o mini — верификация)
- DeepSeek API (планирование/навигация)

## Точка входа

`main.py` — запрашивает поисковый запрос, запускает `refseeker.agent.run_agent()`.

## Как запустить

```bash
cd "D:/Рабочий стол/Antigravity/RefSeeker"
.venv/Scripts/python main.py
```

## Структура проекта

| Файл | Назначение |
|---|---|
| `main.py` | Точка входа, ввод запроса, event loop |
| `refseeker/agent.py` | Сборка Agent (browser-use), формирование task prompt |
| `refseeker/controller.py` | Кастомные actions: `get_page_image_urls`, `extract_subpage_links`, `done` |
| `refseeker/state.py` | Состояние сессии (CollectionState dataclass) |
| `refseeker/config.py` | Константы, logger |
| `refseeker/client.py` | Клиент OpenAI/DeepSeek |
| `refseeker/download.py` | Скачивание кандидатов |
| `refseeker/image.py` | Фильтрация URL, _sanitize_folder_name |
| `refseeker/verify.py` | GPT-4o mini верификация изображений |
| `config.json` | whitelist + blacklist сайтов |
| `refseeker.log` | Лог последнего запуска |

## Текущая критическая проблема

Агент вызывает `done()` после первого неудачного сайта, не пробуя остальные из whitelist. В `config.json` прописано 5 сайтов, но агент сдаётся после первого же "Nothing Found".

## Что уже пробовали

Кастомный `controller.action(done)` с гардом — имплементирован в `refseeker/controller.py` (строка 179). Проверяет `state.preferred_sites` vs `state.total_sites_attempted` и возвращает `ActionResult(error=...)` с требованием продолжить. В uncommitted changes есть, но в живую не протестирован.

## Открытый вопрос

Переопределяет ли browser-use 0.12.7 встроенный `done()`, если зарегистрирован кастомный через `controller.action()`? В коде импорт `DoneAction` из `browser_use.tools.views`, и action называется `done` — может ли browser-use подменить его своим встроенным обработчиком?
