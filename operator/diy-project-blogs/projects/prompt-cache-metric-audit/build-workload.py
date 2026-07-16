import hashlib
import json
import pathlib
import subprocess

import tiktoken


ROOT = pathlib.Path(__file__).resolve().parents[4]
PROJECT = pathlib.Path(__file__).resolve().parent
CONFIG = json.loads((PROJECT / "config.json").read_text())


def git(*args: str) -> str:
    return subprocess.check_output(
        ["git", *args],
        cwd=ROOT,
        text=True,
    )


revision = CONFIG["revision"]
paths = [
    line
    for line in git("ls-tree", "-r", "--name-only", revision, "content/articles").splitlines()
    if line.endswith(".md")
]
encoder = tiktoken.get_encoding(CONFIG["tokenizer"])
records = []

for path in sorted(paths):
    markdown = git("show", f"{revision}:{path}")
    body = markdown.split("---", 2)[-1].strip()
    records.append(
        {
            "slug": pathlib.Path(path).stem,
            "path": path,
            "tokens": len(encoder.encode(body)),
            "bytes": len(body.encode("utf-8")),
            "sha256": hashlib.sha256(markdown.encode("utf-8")).hexdigest(),
        }
    )

payload = {
    "revision": revision,
    "tokenizer": CONFIG["tokenizer"],
    "articleCount": len(records),
    "articles": records,
}
(PROJECT / "workload.json").write_text(json.dumps(payload, indent=2) + "\n")
print(
    f"wrote workload.json revision={revision} articles={len(records)} "
    f"tokens={sum(record['tokens'] for record in records)}"
)
