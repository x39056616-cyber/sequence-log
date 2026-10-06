import re, collections, pathlib
for name in ["黑皇帝”途径能力.md", "黑皇帝”途径能力.txt"]:
    p = pathlib.Path(r"C:\Users\Administrator\Desktop") / name
    if not p.exists():
        print(name, "NOT FOUND"); continue
    text = p.read_text(encoding="utf-8", errors="ignore")
    print(f"=== {name} ===  chars={len(text)}")
    print("  ## 段:", len(re.findall(r"^##\s", text, re.M)), " ### 段:", len(re.findall(r"^###\s", text, re.M)))
    print("  含配方标题:", len(re.findall(r"途径魔药配方|途径的魔药配方|配方和能力", text)))
    print("  主材料字段:", text.count("主材料"), " 辅助材料:", text.count("辅助材料"))
    print("  序列标题:", len(re.findall(r"^###\s*序列", text, re.M)))
    print("  样例标题:", [t for t in re.findall(r"^##\s*(.+)$", text, re.M)][:6])
