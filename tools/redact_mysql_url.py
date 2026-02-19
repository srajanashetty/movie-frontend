import re
from pathlib import Path


def main() -> None:
    p = Path("server.js")
    if not p.exists():
        return

    s = p.read_text(encoding="utf-8", errors="ignore")
    s2 = re.sub(r"mysql://([^:]+):([^@]+)@", r"mysql://\1:REDACTED@", s)
    if s2 != s:
        p.write_text(s2, encoding="utf-8")


if __name__ == "__main__":
    main()

