#!/usr/bin/env python3
"""Verify curated wheel entity candidates against the local novel text.

Only names that actually appear in the source text are emitted, together with
chapter/line references and a short quote. Nothing is invented: a candidate that
cannot be found is reported as unverified and omitted from the output.

Usage:
    python scripts/extract_entities.py --source <novel.txt> --output src/lib/lore/entities.generated.json
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path

CHAPTER_RE = re.compile(r"^第[一二三四五六七八九十百千万零〇两0-9]+[章节卷部]")

# Candidate names for the Fate Wheel presets. Curated, then verified against the text.
PLACE_CANDIDATES = [
    "廷根", "廷根市", "贝克兰德", "拜亚姆", "普利兹港", "康斯顿", "白银之城",
    "迷雾海", "南大陆", "苏尼亚岛", "罗斯德群岛", "霍伊大学", "圣赛琳娜教堂",
]
FACTION_CANDIDATES = [
    "风暴之主教会", "蒸汽与机械之神教会", "黑夜女神教会", "大地母神教会",
    "知识与智慧之神教会", "战神教会", "太阳神教会", "塔罗会", "值夜者",
    "机械之心", "心理炼金会", "生命学派", "摩斯苦修会", "极光会",
]
PER_ENTITY = 2
EXCERPT_LIMIT = 160


def chapter_at(chapters: list[tuple[int, str]], line_number: int) -> str:
    value = "序章"
    for start, title in chapters:
        if start > line_number:
            break
        value = title
    return value


def excerpt(line: str, term: str, limit: int = EXCERPT_LIMIT) -> str:
    index = line.find(term)
    if index < 0:
        return line[:limit]
    start = max(0, index - limit // 2)
    end = min(len(line), index + len(term) + limit // 2)
    value = line[start:end].strip()
    return value if len(value) <= limit else value[:limit]


def collect(lines: list[str], chapters: list[tuple[int, str]], candidates: list[str]) -> list[dict]:
    results: list[dict] = []
    for name in candidates:
        matches: list[dict] = []
        seen: set[str] = set()
        for index, line in enumerate(lines):
            if name not in line:
                continue
            quote = excerpt(line, name)
            if len(quote) < 8 or quote in seen:
                continue
            seen.add(quote)
            matches.append({
                "chapter": chapter_at(chapters, index + 1),
                "line": index + 1,
                "quote": quote,
                "source": "novel-local-reference",
            })
            if len(matches) >= PER_ENTITY:
                break
        results.append({"name": name, "verified": bool(matches), "citations": matches})
    return results


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    source = Path(args.source)
    raw = source.read_bytes()
    text = raw.decode("utf-8-sig")
    lines = text.splitlines()
    chapters = [(index + 1, line.strip()) for index, line in enumerate(lines) if CHAPTER_RE.match(line.strip())]

    places = collect(lines, chapters, PLACE_CANDIDATES)
    factions = collect(lines, chapters, FACTION_CANDIDATES)
    verified_places = [item for item in places if item["verified"]]
    verified_factions = [item for item in factions if item["verified"]]

    output = {
        "schemaVersion": 1,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "source": {
            "title": "《诡秘之主》精校版全本及番外",
            "author": "爱潜水的乌贼",
            "fileName": source.name,
            "sha256": hashlib.sha256(raw).hexdigest(),
            "note": "全文仅作本地核验，不进入仓库；本文件只保存经核验的名称与短引文。",
        },
        "coverage": {
            "placeCandidates": len(PLACE_CANDIDATES),
            "placeVerified": len(verified_places),
            "factionCandidates": len(FACTION_CANDIDATES),
            "factionVerified": len(verified_factions),
        },
        "places": verified_places,
        "factions": verified_factions,
        "unverified": {
            "places": [item["name"] for item in places if not item["verified"]],
            "factions": [item["name"] for item in factions if not item["verified"]],
        },
    }
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(output["coverage"], ensure_ascii=False))


if __name__ == "__main__":
    main()
