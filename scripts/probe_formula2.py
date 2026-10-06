import re, pathlib, collections
text = pathlib.Path(r"C:\Users\Administrator\Desktop\黑皇帝”途径能力.md").read_text(encoding="utf-8", errors="ignore")
lines = text.splitlines()
# 找出所有出现「主材料」的行，看它前面最近的 1-3 个标题
hits = [i for i, l in enumerate(lines) if "主材料" in l]
print("主材料行数:", len(hits))
titles = collections.Counter()
sample = []
for i in hits[:12]:
    back = []
    for j in range(i, max(0, i-40), -1):
        if lines[j].startswith("#"):
            back.append(lines[j].strip())
        if len(back) >= 3: break
    titles[" | ".join(back[:2])] += 1
    sample.append((i+1, back[:3]))
print("\n样例（行号 → 最近标题）:")
for line_no, back in sample:
    print(f"  {line_no}: " + " ⟵ ".join(back))
print("\n各标题前缀出现次数（前 12）:")
for t, n in titles.most_common(12):
    print(f"  {n:>3}  {t}")
