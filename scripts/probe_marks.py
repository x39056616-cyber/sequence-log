import re, pathlib
text = pathlib.Path(r"C:\Users\Administrator\Desktop\黑皇帝”途径能力.md").read_text(encoding="utf-8", errors="ignore")
pat = re.compile(r"^#{1,6}\s*序列\s*([0-9])\s*[：:、]?\s*([^\n（(]*)", re.M)
marks = list(pat.finditer(text))
print("marks:", len(marks))
print("first 6:", [(m.group(1), m.group(2).strip()) for m in marks[:6]])
sec = [m.start() for m in re.finditer(r"^##\s", text, re.M)]
print("section marks:", len(sec))
# 统计每个 mark 的归属
import collections
head = [(m.start(), m.group(1).strip()) for m in re.finditer(r"^#{1,6}\s*(.+)$", text, re.M)]
kinds = collections.Counter()
for i, m in enumerate(marks):
    nearest = None
    for p, t in head:
        if p < m.start(): nearest = t
        else: break
    kinds["formula" if nearest and "配方" in nearest else ("ability" if nearest and "能力" in nearest else "other")] += 1
print("归属统计:", dict(kinds))
print("无归属样例:", [ (m.group(1), m.group(2).strip()) for m in marks[:3] if True ][:3])
