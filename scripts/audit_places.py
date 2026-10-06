import re, collections, pathlib
text = pathlib.Path(r"C:\Users\Administrator\Documents\Codex\2026-10-04\x20-zhu\outputs\《诡秘之主》（精校版全本+番外完）作者：爱潜水的乌贼.md").read_text(encoding="utf-8", errors="ignore")

def top(pattern, n=30, minfreq=15):
    c = collections.Counter(re.findall(pattern, text))
    return [(k, v) for k, v in c.most_common(n) if v >= minfreq]

print("=== 大陆/洲 ===")
for k, v in top(r"([\u4e00-\u9fa5]{2,4}大陆)", 12, 10): print(f"  {v:>5}  {k}")
print("=== 国家/帝国/王国/共和国 ===")
for k, v in top(r"([\u4e00-\u9fa5]{2,6}(?:王国|帝国|共和国|联邦|公国))", 25, 8): print(f"  {v:>5}  {k}")
print("=== 城市类（市/城/港） ===")
for k, v in top(r"([\u4e00-\u9fa5]{2,5}(?:市|城|港))", 30, 12): print(f"  {v:>5}  {k}")
print("=== 岛屿/海域 ===")
for k, v in top(r"([\u4e00-\u9fa5]{2,5}(?:群岛|岛|海))", 25, 12): print(f"  {v:>5}  {k}")
print("=== 街区/地标 ===")
for k, v in top(r"([\u4e00-\u9fa5]{2,5}(?:区|街|郡|大学|教堂|广场))", 25, 12): print(f"  {v:>5}  {k}")
