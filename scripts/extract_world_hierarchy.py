#!/usr/bin/env python3
"""Build the era -> region -> locality hierarchy, verified against the local novel.

Every name must appear in the text; a locality is also required to co-occur with its
parent region nearby, otherwise it is dropped (and reported as unverified).

Usage:
    python scripts/extract_world_hierarchy.py --source "<novel>.md" --output src/lib/lore/world.generated.json
"""
from __future__ import annotations

import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path

ERAS = ["第一纪", "第二纪", "第三纪", "第四纪", "第五纪"]

# 纪元 -> 大地点候选（全部需在文中出现）
REGIONS: dict[str, list[str]] = {
    "第一纪": ["混沌海", "神弃之地"],
    "第二纪": ["混沌海", "神弃之地", "白银城"],
    "第三纪": ["神弃之地", "白银城"],
    "第四纪": ["所罗门帝国", "图铎帝国", "特伦索斯特帝国", "白银城"],
    "第五纪": ["鲁恩王国", "因蒂斯共和国", "弗萨克帝国", "南大陆", "北大陆", "罗思德群岛", "间海郡"],
}

# 大地点 -> 小地点候选（需与该大地点在邻近文本中共现）
LOCALITIES: dict[str, list[str]] = {
    "鲁恩王国": ["贝克兰德", "廷根市", "普利兹港", "康斯顿", "乔伍德区", "皇后区", "明斯克街", "希尔斯顿区", "伯克伦德街", "大桥南区", "霍伊大学", "圣赛琳娜教堂"],
    "因蒂斯共和国": ["特里尔", "因蒂斯港", "塞莱斯特"],
    "弗萨克帝国": ["加尔加斯群岛", "苏尼亚海"],
    "南大陆": ["拜亚姆", "普利兹港"],
    "北大陆": ["廷根市", "贝克兰德"],
    "罗思德群岛": ["拜亚姆", "慷慨之城"],
    "神弃之地": ["白银城"],
    }

EXCERPT = 150


def excerpt(line: str, term: str, limit: int = EXCERPT) -> str:
    index = line.find(term)
    start = max(0, index - limit // 2) if index >= 0 else 0
    end = min(len(line), start + limit)
    return line[start:end].strip()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    lines = Path(args.source).read_text(encoding="utf-8", errors="ignore").splitlines()
    chapter_re = re.compile(r"^#{1,6}\s*(第[一二三四五六七八九十百千万零〇两0-9]+[章节卷部].*)$")
    chapters = [(index + 1, m.group(1).strip()) for index, line in enumerate(lines) if (m := chapter_re.match(line.strip()))]

    def chapter_at(line_number: int) -> str:
        value = "序章"
        for start, title in chapters:
            if start > line_number:
                break
            value = title
        return value

    unverified: dict[str, list[str]] = {}

    def first_hit(term: str, near: str | None = None, window: int = 200) -> dict | None:
        for index, line in enumerate(lines):
            if term not in line:
                continue
            if near:
                chunk = "\n".join(lines[max(0, index - window): index + window])
                if near not in chunk:
                    continue
            return {"chapter": chapter_at(index + 1), "line": index + 1, "quote": excerpt(line, term)}
        return None

    eras = []
    regions = []
    localities = []
    region_parents: dict[str, list[str]] = {}

    for era in ERAS:
        hit = first_hit(era)
        if hit:
            eras.append({"name": era, "citation": hit})
        else:
            unverified.setdefault("eras", []).append(era)

    for era, candidates in REGIONS.items():
        for name in candidates:
            hit = first_hit(name, near=era if era not in ("第一纪", "第二纪", "第三纪") else None)
            hit = hit or first_hit(name)
            if hit:
                if all(region["name"] != name for region in regions):
                    regions.append({"name": name, "era": era, "citation": hit})
                region_parents.setdefault(name, []).append(era)
            else:
                unverified.setdefault("regions", []).append(name)

    for parent, candidates in LOCALITIES.items():
        for name in candidates:
            if name == parent:
                continue
            hit = first_hit(name, near=parent)
            if hit:
                localities.append({"name": name, "parent": parent, "citation": hit})
            else:
                unverified.setdefault("localities", []).append(f"{parent}→{name}")

    payload = {
        "schemaVersion": 1,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "note": "纪元/大地点/小地点全部经全文核验；小地点必须与其大地点在邻近文本中共现。",
        "coverage": {"eras": len(eras), "regions": len(regions), "localities": len(localities)},
        "eras": eras,
        "regions": [{"name": r["name"], "eras": region_parents.get(r["name"], [r["era"]]), "citation": r["citation"]} for r in regions],
        "localities": localities,
        "unverified": unverified,
    }
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(payload["coverage"], ensure_ascii=False))
    print("unverified:", json.dumps(unverified, ensure_ascii=False))


if __name__ == "__main__":
    main()



