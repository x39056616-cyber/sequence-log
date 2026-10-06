#!/usr/bin/env python3
"""Build a paragraph-level index of the novel for server-side retrieval.

Output: public/lore/novel-index.json
    { schemaVersion, source, chapters: [ { title, paras: [ "...", ... ] } ] }

Only used locally: retrieval pulls whole paragraphs at generation time so the AI
has real source material instead of free improvisation.
"""
from __future__ import annotations
import argparse, hashlib, json, re
from datetime import datetime, timezone
from pathlib import Path

CHAPTER_RE = re.compile(r"^#{1,6}\s*(第[一二三四五六七八九十百千万零〇两0-9]+[章节卷部].*)$")
MAX_PARA = 800


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", required=True)
    ap.add_argument("--output", required=True)
    args = ap.parse_args()

    raw = Path(args.source).read_bytes()
    text = raw.decode("utf-8-sig", errors="ignore")
    lines = text.splitlines()

    chapters: list[dict] = []
    current = {"title": "序章", "paras": []}
    chapters.append(current)
    buffer: list[str] = []

    def flush() -> None:
        if not buffer:
            return
        para = "".join(buffer).strip()
        buffer.clear()
        if len(para) < 10:
            return
        # 过长的段落切分，保证检索粒度可用
        for i in range(0, len(para), MAX_PARA):
            chunk = para[i:i + MAX_PARA].strip()
            if chunk:
                current["paras"].append(chunk)

    for line in lines:
        stripped = line.strip()
        m = CHAPTER_RE.match(stripped)
        if m:
            flush()
            current = {"title": m.group(1).strip(), "paras": []}
            chapters.append(current)
            continue
        if not stripped:
            flush()
            continue
        buffer.append(stripped)

    flush()
    chapters = [c for c in chapters if c["paras"]]
    payload = {
        "schemaVersion": 1,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "source": {"title": "《诡秘之主》精校版全本及番外", "sha256": hashlib.sha256(raw).hexdigest(),
                   "note": "本地检索用；生成时只把检索到的段落发给模型。"},
        "coverage": {"chapters": len(chapters), "paragraphs": sum(len(c["paras"]) for c in chapters)},
        "chapters": chapters,
    }
    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(json.dumps(payload["coverage"], ensure_ascii=False), "sizeMB=", round(out.stat().st_size / 1048576, 1))


if __name__ == "__main__":
    main()
