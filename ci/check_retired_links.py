"""Fail if retired support channels reappear in this editor's source.

Each entry was removed deliberately and cannot be reinstated by accident:

* the guide iframe pointed at `tryslang.com`, whose hostnames now redirect to
  the product website, so the frame rendered a redirect rather than a guide;
* the Slack workspace invitation is a dead shared-invite link;
* the feedback form posted visitor email addresses and messages to a retired
  `bitspark.de` endpoint.

This checks source only. Deployment code elsewhere legitimately mentions the old
guide URL in order to rewrite it inside the already-released bundle.
"""
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
SEARCHED = ("src", "e2e", "README.md")
SUFFIXES = {".ts", ".html", ".scss", ".css", ".json", ".md"}

RETIRED = {
    "tryslang.com": "retired guide/website URL - link to slang.bitspark.com instead",
    "join.slack.com": "retired Slack invitation - link to the GitHub issue tracker instead",
    "bitspark.de/send-email": "retired feedback endpoint - use the GitHub issue tracker instead",
}


def sources():
    for name in SEARCHED:
        target = ROOT / name
        if target.is_file():
            yield target
        for path in target.rglob("*") if target.is_dir() else []:
            if path.is_file() and path.suffix in SUFFIXES:
                yield path


def main():
    failures = []
    for path in sources():
        text = path.read_text(encoding="utf-8", errors="replace")
        for line_number, line in enumerate(text.splitlines(), 1):
            for needle, reason in RETIRED.items():
                if needle in line:
                    relative = path.relative_to(ROOT).as_posix()
                    failures.append(f"{relative}:{line_number}: {needle} - {reason}")
    for failure in failures:
        print(failure)
    print(f"Checked retired support channels in {len(SEARCHED)} source locations: "
          f"{'FAILED' if failures else 'clean'}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
