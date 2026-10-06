import re, pathlib, collections
text = pathlib.Path(r"C:\Users\Administrator\Desktop\黑皇帝”途径能力.md").read_text(encoding="utf-8", errors="ignore")
heads = collections.Counter(re.findall(r"^(#{2,4})\s*(.+)$", text, re.M))
by_level = collections.Counter(lvl for lvl, _ in heads)
print("标题层级统计:", dict(by_level))
print("\n=== 所有 二级 标题（去重后前 40） ===")
seen = []
for lvl, title in heads:
    if lvl == "##" and title not in seen:
        seen.append(title)
for t in seen[:40]: print("  " + t)
print("\n=== 三级/四级标题样例（含序列字样的前 25） ===")
seq_titles = [t for lvl, t in heads if "序列" in t]
print("含「序列」的标题总数:", len(seq_titles))
for t in seq_titles[:25]: print("  " + t)
print("\n=== 配方字段变体 ===")
for pat in ["主材料","辅助材料","魔药外观","非凡特性外观","神话生物形态","辅助"]:
    print(f"  {pat}: {text.count(pat)}")
