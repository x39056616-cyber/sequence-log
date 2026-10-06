import re, collections, pathlib
f = pathlib.Path(r"C:\Users\Administrator\Desktop\黑皇帝”途径能力.md")
text = f.read_text(encoding="utf-8", errors="ignore")
lines = text.splitlines()

# 途径名称（## 标题里出现的 “X”途径 / X途径）
pathways = collections.Counter()
for m in re.finditer(r"##+\s*[“\"]?([\u4e00-\u9fa5]{2,6})[”\"]?\s*途径", text):
    pathways[m.group(1)] += 1
print("文件中出现的途径数:", len(pathways))
print("途径列表:", " / ".join(p for p, _ in pathways.most_common()))

# 站点 22 途径名称
src = pathlib.Path("src/lib/lore/pathways.ts").read_text(encoding="utf-8")
site = re.findall(r'\{ id: "([^"]+)", name: "([^"]+)"', src)
site_names = {n for _, n in site}
matched = [p for p in pathways if p in site_names]
print(f"\n与站点 22 途径重合: {len(matched)} → " + " / ".join(matched))

# 某途径下的序列条目数
for target in ["黑皇帝","审判者","命运","太阳"]:
    seg = re.split(r"\n##\s", text)
    count = 0
    for block in seg:
        if block.strip().startswith("“" + target + "”途径能力") or block.strip().startswith(target + "”途径能力"):
            count = len(re.findall(r"^###\s*序列", block, re.M))
    print(f"  {target} 途径能力段落中的序列小节数: {count}")
