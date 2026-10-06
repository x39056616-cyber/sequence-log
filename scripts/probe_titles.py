import pathlib, json, re
novel = pathlib.Path(r"C:\Users\Administrator\Documents\Codex\2026-10-04\x20-zhu\outputs\《诡秘之主》（精校版全本+番外完）作者：爱潜水的乌贼.md").read_text(encoding="utf-8", errors="ignore")
candidates = {
    "风暴教会": ["代罚者","惩戒骑士","风暴主教"],
    "黑夜教会": ["红手套","值夜者","大主教"],
    "黑夜女神教会": ["红手套","值夜者"],
    "蒸汽与机械之神教会": ["机械之心","蒸汽主教"],
    "大地母神教会": ["丰收祭司","大主教"],
    "知识与智慧之神教会": ["学者","智慧主教"],
    "战神教会": ["战争骑士","战神主教"],
    "永恒烈阳教会": ["太阳圣者","太阳主教"],
    "塔罗会": ["愚者","倒吊人","正义","太阳","魔术师","世界","月亮","隐者","审判","死神","战车","皇后","皇帝","教皇","恋人","力量","命运之轮","女祭司","塔","恶魔","星星","节制"],
    "玫瑰学派": ["恩赐","玫瑰学派成员"],
    "生命学派": ["生命学派成员"],
    "值夜者": ["值夜者"],
    "机械之心": ["机械之心成员","专员"],
    "心理炼金会": ["心理炼金会成员"],
    "摩斯苦修会": ["苦修者"],
    "极光会": ["极光会成员"],
    "黑荆棘安保公司": ["探员","专员"],
    "鲁恩王国": ["王国探员","议员"],
    "安提哥努斯家族": ["家族成员"],
    "亚伯拉罕家族": ["家族成员"],
}
out = {}
for faction, titles in candidates.items():
    verified = [t for t in titles if novel.count(t) > 0]
    out[faction] = {"verified": verified, "dropped": [t for t in titles if t not in verified]}
    print(f"{faction}: " + (" / ".join(verified) if verified else "（无核验职阶）"))
pathlib.Path("_titles.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
