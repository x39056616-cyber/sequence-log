#!/usr/bin/env python3
"""从已建好的全文段落索引里挑选风格范例（few-shot 锚点）。

每类场景挑若干段，带章节 + 段落序号，用于把「原著的写法」直接喂给模型。
输出 src/lib/lore/style-anchors.generated.json
"""
from __future__ import annotations
import argparse, json, pathlib, re

SCENES = {
    "divination":   {"label": "占卜与仪式", "must": ["占卜"], "any": ["仪式", "灵摆", "梦境", "纸牌", "灵性"]},
    "sealed":       {"label": "封印物与编号", "must": ["封印物"], "any": ["0-", "1-", "2-", "编号", "失控"]},
    "tarot":        {"label": "塔罗会与代号", "must": ["塔罗会"], "any": ["聚会", "先生", "代号", "愚者"]},
    "daily":        {"label": "拮据日常", "must": ["便士"], "any": ["苏勒", "房租", "面包", "马车"]},
    "cost":         {"label": "失控与代价", "must": ["失控"], "any": ["代价", "污染", "理智", "危险"]},
    "institution":  {"label": "教会与机构", "must": ["值夜者"], "any": ["小队", "调查", "教会", "任务"]},
    "divination-failure": {"label": "占卜失败的代价", "must": ["占卜"], "any": ["失败", "反噬", "代价", "危险", "疯狂", "失控"]},
    "tarot-secret": {"label": "塔罗会密谈", "must": ["塔罗会"], "any": ["密谈", "交易", "情报", "代号", "命运", "先生", "女士"]},
    "church-interrogation": {"label": "教会审讯", "must": ["教会"], "any": ["审讯", "审判", "调查", "询问", "审判庭", "值夜者"]},
    "poor-quarter": {"label": "贫民区日常", "must": ["贫民"], "any": ["面包", "便士", "房租", "工人", "街", "马车"]},
    "characteristic-transfer": {"label": "非凡特性转移", "must": ["非凡特性"], "any": ["转移", "交换", "魔药", "仪式", "封印", "失控"]},
    "ritual-preparation": {"label": "仪式准备", "must": ["仪式"], "any": ["材料", "蜡烛", "精油", "银", "符咒", "准备"]},
}
MIN_LEN, MAX_LEN = 90, 520
PER_SCENE = 5


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--index", required=True)
    ap.add_argument("--output", required=True)
    args = ap.parse_args()

    data = json.loads(pathlib.Path(args.index).read_text(encoding="utf-8"))
    picked: dict[str, list[dict]] = {key: [] for key in SCENES}
    used: set[str] = set()

    for chapter in data["chapters"]:
        for idx, para in enumerate(chapter["paras"]):
            if not (MIN_LEN <= len(para) <= MAX_LEN):
                continue
            if para in used:
                continue
            for key, scene in SCENES.items():
                if len(picked[key]) >= PER_SCENE:
                    continue
                if not all(word in para for word in scene["must"]):
                    continue
                if not any(word in para for word in scene["any"]):
                    continue
                picked[key].append({"chapter": chapter["title"], "para": idx, "scene": key, "label": scene["label"], "text": para})
                used.add(para)
                break

    anchors = [item for key in SCENES for item in picked[key]]
    payload = {
        "schemaVersion": 1,
        "note": "从原文挑选的风格范例（few-shot），用于让生成文字贴近原著语感；每次按情境注入 4–6 段。",
        "coverage": {key: len(picked[key]) for key in SCENES},
        "total": len(anchors),
        "anchors": anchors,
    }
    out = pathlib.Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps(payload["coverage"], ensure_ascii=False), "total=", len(anchors))


if __name__ == "__main__":
    main()

