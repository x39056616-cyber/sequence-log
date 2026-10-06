import re, pathlib
text = pathlib.Path(r"C:\Users\Administrator\Desktop\黑皇帝”途径能力.md").read_text(encoding="utf-8", errors="ignore")
i = text.find("黑皇帝”途径魔药配方")
print("=== 配方段落样例 ===")
print(text[i:i+900])
