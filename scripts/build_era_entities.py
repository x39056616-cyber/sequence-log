#!/usr/bin/env python3
"""统计每个转盘实体在原文里与各纪元共现的情况，据此判定它属于哪些纪元。

输出 public/lore/era-entities.generated.json
    { "第一纪": { "figures": [..], "factions": [..], "places": [..], "items": [..] }, ... }
判定规则：实体名与该纪元名在 ±WINDOW 行内共现 ≥ MIN_HITS 次，才算「该实体出现在这个纪元」。
"""
from __future__ import annotations
import argparse, json, pathlib, re, collections

ERAS = ["第一纪", "第二纪", "第三纪", "第四纪", "第五纪"]
WINDOW = 0
MIN_HITS = 3  # 同一行共现 ≥3 次才算有据，避免把「讨论历史」误判为「存在于该纪元」
# 时代断言词：只有句子里带了这些词，才说明「该实体存在于那个纪元」，而不是在讨论历史。
ERA_ASSERTIONS = ("第一纪", "第二纪", "第三纪", "第四纪", "第五纪", "纪时", "纪的", "纪初", "纪末", "纪元", "时代", "时期", "远古", "古神", "诞生于", "起源于")

def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", required=True)
    ap.add_argument("--entities", required=True)
    ap.add_argument("--output", required=True)
    args = ap.parse_args()

    lines = pathlib.Path(args.source).read_text(encoding="utf-8", errors="ignore").splitlines()
    ent = json.loads(pathlib.Path(args.entities).read_text(encoding="utf-8"))
    groups = {k: [item["name"] for item in ent.get(k, [])] for k in ("figures", "factions", "places", "items")}

    # 先记下每个纪元名的行号
    era_lines = {era: [i for i, l in enumerate(lines) if era in l] for era in ERAS}

    out: dict[str, dict[str, list[str]]] = {era: {g: [] for g in groups} for era in ERAS}
    stats: dict[str, dict[str, int]] = {}
    for group, names in groups.items():
        for name in names:
            hits = {era: 0 for era in ERAS}
            for i, line in enumerate(lines):
                if name not in line:
                    continue
                # 必须同一行同时出现「实体名 + 纪元名 + 时代断言词」，
                # 否则只是在第五纪的叙述里讨论历史，不能算该实体存在于那个纪元。
                window = "".join(lines[max(0, i - WINDOW): i + WINDOW + 1])
                if not any(word in window for word in ERA_ASSERTIONS):
                    continue
                for era in ERAS:
                    if era in line:
                        hits[era] += 1
            stats[f"{group}:{name}"] = hits
            for era, count in hits.items():
                if count >= MIN_HITS:
                    out[era][group].append(name)

    payload = {
        "schemaVersion": 1,
        "note": "实体与纪元名在原文 ±25 行内共现，才判定该实体属于该纪元。",
        "coverage": {era: {g: len(v) for g, v in groups_.items()} for era, groups_ in out.items()},
        "eras": out,
        "stats": stats,
    }
    p = pathlib.Path(args.output)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps(payload["coverage"], ensure_ascii=False))


if __name__ == "__main__":
    main()


