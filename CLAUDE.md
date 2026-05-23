# RefSeeker — Claude Code instructions

## Rules

1. **Keep AGENT.md accurate** — after any change to the codebase structure, config, pipeline, or dependencies, update AGENT.md to reflect the current state.

2. **Always commit after changes** — after completing any task that modifies files, create a commit with a clear message describing what was changed and why.

3. **No co-authorship or attribution trailers in commits** — never add lines like `Co-Authored-By`, `Signed-off-by`, or any other automated attribution trailer to commit messages. Commit messages must only contain the human-written description of changes.

4. **Don't describe the project when asked to "ознакомиться с проектом"** — I ask AI to read the codebase to understand what we're working with. Don't waste tokens explaining what RefSeeker is back to me. Just read the necessary files and acknowledge readiness.

## Project context

- Python 3.10+ project for automated reference image collection
- Entry point: `main.py` → runs `refseeker.agent.run_agent()`
- Debug runner: `debug_run.py` (feeds "Tu-160" query automatically)
- Test command: `.venv/Scripts/python -m pytest tests/ -q`
- Python path: `.venv/Scripts/python`
- Key files: `refseeker/` package, `config.json`, `.env`
