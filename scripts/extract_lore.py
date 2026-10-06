#!/usr/bin/env python3
"""Build a compact evidence index from a local Lord of the Mysteries text.

The source novel is never copied into the repository. Only chapter/line references and
short evidence fragments are emitted for personal lore verification.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path

RANKS = [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
CHAPTER_RE = re.compile(r"^第[一二三四五六七八九十百千万零〇两0-9]+[章节卷部]")
CONTEXT_WORDS = ("序列", "魔药", "配方", "扮演", "晋升", "非凡者", "途径", "能力")
PUNCTUATION = re.compile(r"(?<=[。！？；])")


def load_pathways(path: Path) -> list[dict]:
    text = path.read_text(encoding="utf-8")
    pattern = re.compile(
        r'\{ id: "(?P<id>[^"]+)", name: "(?P<name>[^"]+)".*?names: \[(?P<names>.*?)\] \}',
        re.S,
    )
    pathways = []
    for match in pattern.finditer(text):
        names = re.findall(r'"([^"]+)"', match.group("names"))
        if len(names) != 10:
            raise ValueError(f"Expected 10 names for {match.group('id')}, got {len(names)}")
        pathways.append({"id": match.group("id"), "name": match.group("name"), "names": names})
    if len(pathways) != 22:
        raise ValueError(f"Expected 22 pathways, got {len(pathways)}")
    return pathways


def chapter_at(chapters: list[tuple[int, str]], line_number: int) -> str:
    value = "序章"
    for start, title in chapters:
        if start > line_number:
            break
        value = title
    return value


def kind_for(text: str) -> str:
    if "晋升仪式" in text or "仪式" in text:
        return "ritual"
    if "扮演" in text:
        return "acting"
    if "主材料" in text or "辅助材料" in text or "配方" in text:
        return "formula"
    if "能力" in text or "非凡能力" in text:
        return "ability"
    return "mention"


def excerpt(line: str, term: str, limit: int = 220) -> str:
    line = re.sub(r"\s+", "", line)
    position = line.find(term)
    if position < 0:
        return line[:limit]
    start_sentences = PUNCTUATION.split(line[:position])
    start = max(0, position - len(start_sentences[-1]) if start_sentences else position - 80)
    tail = line[position:]
    end = min(len(line), position + limit)
    for marker in ("。", "！", "？", "；"):
        found = tail.find(marker, len(term))
        if found > 0:
            end = min(end, position + found + 1)
            break
    return line[start:end][:limit]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--per-sequence", type=int, default=6)
    args = parser.parse_args()

    source = Path(args.source)
    raw = source.read_bytes()
    text = raw.decode("utf-8-sig")
    lines = text.splitlines()
    pathways = load_pathways(Path("src/lib/lore/pathways.ts"))
    chapters = [(index + 1, line.strip()) for index, line in enumerate(lines) if CHAPTER_RE.match(line.strip())]

    sequence_entries: dict[str, dict] = {}
    total_evidence = 0
    for pathway in pathways:
        for rank, name in zip(RANKS, pathway["names"], strict=True):
            key = f"{pathway['id']}-{rank}"
            matches: list[dict] = []
            seen: set[str] = set()
            for index, line in enumerate(lines):
                if name not in line:
                    continue
                window = "".join(lines[max(0, index - 1): min(len(lines), index + 2)])
                rank_pattern = rf"序列\s*(?:{rank}|{'零一二三四五六七八九'[rank] if rank < 10 else str(rank)})"
                if not re.search(rank_pattern, window) and not any(word in window for word in CONTEXT_WORDS):
                    continue
                quote = excerpt(line, name)
                if len(quote) < 12 or quote in seen:
                    continue
                seen.add(quote)
                matches.append({
                    "chapter": chapter_at(chapters, index + 1),
                    "line": index + 1,
                    "kind": kind_for(window),
                    "quote": quote,
                    "source": "novel-local-reference",
                })
                if len(matches) >= args.per_sequence:
                    break
            sequence_entries[key] = {
                "pathwayId": pathway["id"],
                "pathwayName": pathway["name"],
                "sequence": rank,
                "name": name,
                "evidence": matches,
            }
            total_evidence += len(matches)

    covered = sum(1 for value in sequence_entries.values() if value["evidence"])
    output = {
        "schemaVersion": 1,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "source": {
            "title": "《诡秘之主》精校版全本及番外",
            "author": "爱潜水的乌贼",
            "fileName": source.name,
            "sha256": hashlib.sha256(raw).hexdigest(),
            "characters": len(text),
            "lines": len(lines),
            "chapters": len(chapters),
            "note": "全文仅作本地核验，不进入仓库；本文件只保存章节、行号和短证据片段。",
        },
        "coverage": {"sequences": len(sequence_entries), "withEvidence": covered, "evidenceItems": total_evidence},
        "sequences": sequence_entries,
    }
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(output["coverage"], ensure_ascii=False))


if __name__ == "__main__":
    main()
