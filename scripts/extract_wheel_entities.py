#!/usr/bin/env python3
"""Build the Fate Wheel entity index from the local novel text.

Only names that actually appear in the source are emitted, each with chapter/line
references and a short quote. A candidate that cannot be found is dropped and
reported under "unverified" — nothing is invented.

Usage:
    python scripts/extract_wheel_entities.py \
      --source "<novel>.md" \
      --output src/lib/lore/entities.generated.json
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path

CHAPTER_RE = re.compile(r"^#{1,6}\s*(第[一二三四五六七八九十百千万零〇两0-9]+[章节卷部].*)$")
PER_ENTITY = 2
EXCERPT_LIMIT = 150

# Candidate pools curated from a frequency scan over the whole novel, then verified here.
FIGURES = [
    "克莱恩", "奥黛丽", "阿尔杰", "佛尔思", "伦纳德", "阿蒙", "阿兹克", "邓恩",
    "罗塞尔", "莎伦", "梅丽莎", "查拉图", "亚当", "安提哥努斯", "班森", "戴莉",
    "齐林格斯", "洛薇雅", "艾德雯娜", "乌洛琉斯", "天尊", "因斯·赞格威尔", "格罗塞尔",
    "嘉德丽雅", "贝尔纳黛", "阿罗德斯", "帕列斯·索罗亚斯德", "威尔·昂赛汀",
    "蕾妮特·缇尼科尔", "马里奇", "伊丽娅", "埃姆林·怀特", "卡特琳娜", "弗兰克·李",
    "安德森·胡德", "达尼兹", "艾弥留斯", "特莉丝", "休·德弗罗", "娜亚",
    "科塔尔", "老尼尔", "路易斯·维恩", "海柔尔", "塔利姆", "卡西米", "欧内斯",
]
FACTIONS = [
    "风暴教会", "黑夜教会", "黑夜女神教会", "大地母神教会", "永恒烈阳教会", "战神教会",
    "蒸汽与机械之神教会", "玫瑰学派", "生命学派", "塔罗会", "值夜者", "机械之心",
    "心理炼金会", "摩斯苦修会", "极光会", "密修会", "黑荆棘安保公司", "鲁恩王国",
    "安提哥努斯家族", "亚伯拉罕家族", "因蒂斯共和国", "弗萨克帝国", "所罗门帝国",
    "图铎帝国", "特伦索斯特帝国", "拜朗帝国", "索罗亚斯德家族", "阿蒙家族",
    "塔玛拉家族", "雅各家族", "军情九处", "警察厅", "皇家海军", "鲁恩军方",
    "因蒂斯军方", "铁血十字会", "黄昏隐士会", "救赎蔷薇", "知识与智慧之神教会",
    "蒸汽教会", "风暴教会审判庭", "拜朗王国",
]
PLACES = [
    "廷根市", "贝克兰德", "拜亚姆", "普利兹港", "康斯顿", "白银城", "迷雾海", "南大陆",
    "苏尼亚岛", "罗思德群岛", "班西港", "狂暴海", "混沌海", "皇后区", "乔伍德区",
    "希尔斯顿区", "伯克伦德街", "明斯克街", "大桥南区", "所罗门帝国", "廷根", "霍伊大学",
    "铁十字街", "恶龙酒吧", "圣乔治区", "西区", "东区", "北区", "贝克兰德桥",
    "夜色镇", "廷根大学", "勇敢者酒吧", "佐特兰街", "圣赛琳娜教堂", "阿霍瓦郡",
    "南威尔郡", "迪西海湾", "加尔加斯群岛", "奥拉维岛", "巨人王庭", "神弃之地",
    "永暗之河", "灵界", "星界", "灰雾之上", "罗塞尔纪念宫", "蒸汽教堂",
    "风暴教堂", "黑夜教堂", "大地母神教堂", "智慧教堂", "战神教堂", "永恒烈阳教堂",
    "贝克兰德大学", "间海郡", "康斯顿港", "拜朗王国", "黄金之城",
]
EVENTS = [
    "占卜", "封印物", "梦境", "失控", "污染", "诅咒", "降临", "邪神", "灵界",
    "非凡特性", "契约", "悬赏", "通缉", "追查", "晋升仪式", "集体潜意识大海",
    "隐秘存在", "异变", "预言", "穿越", "魔药消化", "扮演法", "神话生物形态",
    "心灵岛屿", "潜意识海洋", "灵性直觉", "灵摆占卜", "仪式魔法", "献祭", "召唤",
    "封印", "净除", "谋杀", "失踪", "调查", "探险", "航海", "海难", "战争",
    "政变", "实验", "复活", "神降", "灾难", "末日", "阴谋", "背叛", "贵族舞会",
    "拍卖会", "交易", "委托", "晋升", "猎杀", "狩猎", "追捕", "审讯", "审判",
    "处决", "传送",
]
ITEMS = [
    "魔药", "日记", "手杖", "左轮", "单片眼镜", "十字架", "怀表", "圣徽", "黄铜", "符咒",
    "星水晶", "拉瓦章鱼的血液结晶", "安曼达纯露", "金色肉瘤", "黑渊魔鱼血液", "精灵之泉",
    "千年古树心", "夜香草", "深眠花", "白色太阳花", "龙血", "巨人血液", "银白战熊",
    "迷失香", "迷幻草", "罗勒", "薄荷", "鸦片", "面包", "啤酒", "咖啡", "茶叶",
    "金镑", "苏勒", "便士", "煤气灯", "左轮手枪", "猎魔子弹", "塔罗牌", "铜哨",
    "青铜门", "阿罗德斯镜", "罗塞尔日记", "灵摆", "占卜棒", "银制小刀", "蜡烛",
    "精油", "望远镜", "航海图", "船票", "手套", "面具", "绷带", "药剂", "毒药",
    "魔药配方", "航海日记", "契约书", "仪式材料", "圣物", "银币", "0-08", "1-42", "2-049",
]
# Tarot Club codenames; only accepted when the surrounding lines mention the club / codename context.
CODENAMES = [
    "愚者", "魔术师", "女祭司", "皇后", "皇帝", "教皇", "恋人", "战车", "力量", "隐者", "命运之轮",
    "正义", "倒吊人", "死神", "节制", "恶魔", "塔", "星星", "月亮", "太阳", "审判", "世界",
]
CODENAME_CONTEXT = ("代号", "塔罗会", "聚会", "先生", "女士")


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
        results.append({"name": name, "verified": bool(matches), "mentions": len(matches), "citations": matches})
    return results


def collect_contextual(lines: list[str], chapters: list[tuple[int, str]], candidates: list[str], context_words: tuple[str, ...]) -> list[dict]:
    results: list[dict] = []
    for name in candidates:
        matches: list[dict] = []
        seen: set[str] = set()
        for index, line in enumerate(lines):
            if name not in line:
                continue
            window = "".join(lines[max(0, index - 2): min(len(lines), index + 3)])
            if not any(word in window for word in context_words):
                continue
            quote = excerpt(line, name)
            if len(quote) < 8 or quote in seen:
                continue
            seen.add(quote)
            matches.append({"chapter": chapter_at(chapters, index + 1), "line": index + 1, "quote": quote, "source": "novel-local-reference"})
            if len(matches) >= PER_ENTITY:
                break
        results.append({"name": name, "verified": bool(matches), "mentions": len(matches), "citations": matches})
    return results

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    source = Path(args.source)
    raw = source.read_bytes()
    text = raw.decode("utf-8-sig", errors="ignore")
    lines = text.splitlines()
    chapters = [(index + 1, match.group(1).strip()) for index, line in enumerate(lines) if (match := CHAPTER_RE.match(line.strip()))]

    groups = {
        "figures": FIGURES,
        "factions": FACTIONS,
        "places": PLACES,
        "events": EVENTS,
        "items": ITEMS,
    }
    out: dict[str, list[dict]] = {}
    coverage: dict[str, int] = {}
    unverified: dict[str, list[str]] = {}
    for key, candidates in groups.items():
        collected = collect(lines, chapters, candidates)
        out[key] = [item for item in collected if item["verified"]]
        coverage[key] = len(out[key])
        coverage[key + "Candidates"] = len(candidates)
        unverified[key] = [item["name"] for item in collected if not item["verified"]]

    codename_rows = collect_contextual(lines, chapters, CODENAMES, CODENAME_CONTEXT)
    codenames = [item for item in codename_rows if item["verified"]]
    coverage["codenames"] = len(codenames)
    coverage["codenamesCandidates"] = len(CODENAMES)
    unverified["codenames"] = [item["name"] for item in codename_rows if not item["verified"]]

    payload = {
        "schemaVersion": 2,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "source": {
            "title": "《诡秘之主》精校版全本及番外",
            "author": "爱潜水的乌贼",
            "fileName": source.name,
            "sha256": hashlib.sha256(raw).hexdigest(),
            "lines": len(lines),
            "chapters": len(chapters),
            "note": "全文仅作本地核验，不进入仓库；本文件只保存经核验的名称、章节行号与短引文。",
        },
        "coverage": coverage,
        "figures": out["figures"],
        "factions": out["factions"],
        "places": out["places"],
        "events": out["events"],
        "items": out["items"],
        "codenames": codenames,
        "unverified": unverified,
    }
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(coverage, ensure_ascii=False))


if __name__ == "__main__":
    main()

