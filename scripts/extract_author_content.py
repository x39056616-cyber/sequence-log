#!/usr/bin/env python3
"""Parse the author's supplementary material (abilities + potion formulas).

Strategy: split the source on `序列N：名称` headings, then for each block look back to
the nearest `## ... 途径...` heading to learn (a) the pathway and (b) whether the block
belongs to an ability section or a potion-formula section. Deciding by block content
(presence of 主材料/辅助材料) makes the parse robust against the source's mixed
quote styles, duplicated sections and pseudo-headings.
"""
from __future__ import annotations

import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path

NAME_TO_ID = {
    "愚者": "fool", "门": "door", "学徒": "door", "错误": "error", "偷盗者": "error",
    "空想家": "visionary", "观众": "visionary", "太阳": "sun", "暴君": "tyrant",
    "白塔": "white-tower", "阅读者": "white-tower", "倒吊人": "hanged-man",
    "黑暗": "darkness", "不眠者": "darkness", "死神": "death", "收尸人": "death",
    "黄昏巨人": "twilight-giant", "巨人": "twilight-giant", "原初魔女": "demoness", "刺客": "demoness",
    "红祭司": "red-priest", "猎人": "red-priest", "隐者": "hermit", "窥秘人": "hermit",
    "完美者": "paragon", "通识者": "paragon", "命运之轮": "wheel-of-fortune", "命运": "wheel-of-fortune",
    "母亲": "mother", "大地母神": "mother", "月亮": "moon", "深渊": "abyss",
    "被缚者": "chained", "囚犯": "chained", "黑皇帝": "black-emperor", "审判者": "justiciar", "仲裁人": "justiciar",
}

SEQ_SPLIT = re.compile(r"^#{1,6}\s*序列\s*([0-9])\s*[：:、]?\s*([^\n（(]*)", re.M)
HEADING = re.compile(r"^##\s+(.+)$", re.M)
FIELDS = {
    "main": re.compile(r"主材料\s*[：:]\s*(.+)"),
    "aux": re.compile(r"辅助材料\s*[：:]\s*(.+)"),
    "potion": re.compile(r"魔药外观\s*[：:]\s*(.+)"),
    "trait": re.compile(r"非凡特性外观\s*[：:]\s*(.+)"),
    "myth": re.compile(r"神话生物形态\s*[：:]\s*(.+)"),
}


def clean(text: str) -> str:
    text = re.sub(r"\*\*|^[-•]\s*", "", text or "")
    return re.sub(r"\s+", " ", text).strip()


def pathway_name(title: str) -> str | None:
    normalized = re.sub(r"[“”\"'\s（）()]", "", title)
    m = re.match(r"^([\u4e00-\u9fa5]{2,6}?)(?:途径|配方|能力)", normalized)
    return m.group(1) if m else None


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True)
    parser.add_argument("--pathways", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    site = Path(args.pathways).read_text(encoding="utf-8")
    site_names = {m.group(2): m.group(1) for m in re.finditer(r'\{\s*id: "([^"]+)",\s*name: "([^"]+)"', site)}

    text = Path(args.source).read_text(encoding="utf-8", errors="ignore")
    headings = [(m.start(), m.group(1).strip()) for m in HEADING.finditer(text)]
    section_marks = [m.start() for m in re.finditer(r"^##\s", text, re.M)]
    marks = list(SEQ_SPLIT.finditer(text))

    abilities: dict[str, dict] = {}
    formulas: dict[str, dict] = {}

    for index, match in enumerate(marks):
        rank = int(match.group(1))
        seq_name = clean(match.group(2))
        # 块的终点：下一个「序列」标题 或 下一个二级段落标题，取更近的那个（否则会读进下一个段落）
        next_seq = marks[index + 1].start() if index + 1 < len(marks) else len(text)
        next_section = next((position for position in section_marks if position > match.start()), len(text))
        end = min(next_seq, next_section)
        body = text[match.end():end]

        # 该块之前最近的「途径」标题决定归属
        nearest = None
        for position, title in headings:
            if position < match.start():
                nearest = title
            else:
                break
        if not nearest or "途径" not in nearest:
            continue
        file_name = pathway_name(nearest)
        pathway_id = (NAME_TO_ID.get(file_name or "") or site_names.get(file_name or "")) if file_name else None
        if not pathway_id:
            continue

        # 源文件里的字段写作 `**主材料**：`，先把粗体标记去掉再匹配。
        flat = body.replace("**", "")
        is_formula = any(pattern.search(flat) for pattern in (FIELDS["main"], FIELDS["aux"]))
        if is_formula:
            fields = {k: (clean(m.group(1)) if (m := pattern.search(flat)) else "") for k, pattern in FIELDS.items()}
            formulas[f"{pathway_id}-{rank}"] = {
                "pathwayId": pathway_id, "fileName": file_name, "sequence": rank, "sequenceName": seq_name,
                "main": fields["main"], "aux": fields["aux"], "potionLook": fields["potion"],
                "traitLook": fields["trait"], "mythicForm": fields["myth"],
            }
        else:
            # 能力块去掉尾部空行，保留原始列表结构
            cleaned = "\n".join(line.rstrip() for line in body.strip().splitlines() if line.strip())
            if not cleaned:
                continue
            key = f"{pathway_id}-{rank}"
            entry = abilities.get(key)
            if not entry or len(cleaned) > len(entry["text"]):
                abilities[key] = {"pathwayId": pathway_id, "fileName": file_name, "sequence": rank, "sequenceName": seq_name, "text": cleaned}

    covered = sorted({v["pathwayId"] for v in abilities.values()} | {v["pathwayId"] for v in formulas.values()})
    payload = {
        "schemaVersion": 1,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "source": {"title": "作者（爱潜水的乌贼）发布的途径能力与魔药配方补充设定", "fileName": Path(args.source).name, "kind": "author-supplement"},
        "coverage": {"pathways": len(covered), "abilities": len(abilities), "formulas": len(formulas)},
        "pathways": covered,
        "abilities": list(abilities.values()),
        "formulas": list(formulas.values()),
    }
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(payload["coverage"], ensure_ascii=False))
    print("pathways:", " / ".join(covered))


if __name__ == "__main__":
    main()



