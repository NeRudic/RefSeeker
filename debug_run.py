"""
Debug runner — запускает main.py, логирует всё в logs/last-run.log,
в консоль выводит только ключевые строки и итог.

Запуск:
  .venv/Scripts/python debug_run.py
"""

import os
import subprocess
from datetime import datetime

LOG_DIR = os.path.join(os.path.dirname(__file__), "logs")
LOG_FILE = os.path.join(LOG_DIR, "last-run.log")
MAIN_PY = os.path.join(os.path.dirname(__file__), "main.py")
VENV_PYTHON = os.path.join(os.path.dirname(__file__), ".venv", "Scripts", "python.exe")

# Ключевые паттерны, которые показываем в консоль
KEYWORDS = ("ERROR", "done()", "whitelist", "сайт", "site", "success", "fail")


def main():
    os.makedirs(LOG_DIR, exist_ok=True)

    proc = subprocess.Popen(
        [VENV_PYTHON, MAIN_PY],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
        cwd=os.path.dirname(__file__),
        encoding="utf-8",
        errors="replace",
        stdin=subprocess.PIPE,
    )

    proc.stdin.write("Tu-160\n")
    proc.stdin.write("100\n")
    proc.stdin.flush()
    proc.stdin.close()

    all_lines: list[str] = []

    with open(LOG_FILE, "w", encoding="utf-8") as log:
        log.write(f"=== RefSeeker debug run: {datetime.now():%Y-%m-%d %H:%M:%S} ===\n\n")
        log.flush()

        assert proc.stdout is not None
        for line in proc.stdout:
            stripped = line.rstrip("\n\r")
            log.write(stripped + "\n")
            log.flush()
            all_lines.append(stripped)

            if any(kw in stripped for kw in KEYWORDS):
                print(stripped, flush=True)

    returncode = proc.wait()

    print("\n=== ИТОГ ===")
    print(f"Exit code: {returncode}")
    for line in all_lines[-20:]:
        print(line)
    print(f"\nПолный лог: {LOG_FILE}")


if __name__ == "__main__":
    main()
