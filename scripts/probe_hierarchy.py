import re, pathlib, collections
text = pathlib.Path(r"C:\Users\Administrator\Documents\Codex\2026-10-04\x20-zhu\outputs\《诡秘之主》（精校版全本+番外完）作者：爱潜水的乌贼.md").read_text(encoding="utf-8", errors="ignore")
lines = text.splitlines()

countries = ["鲁恩王国","因蒂斯共和国","弗萨克帝国","费内波特王国","马赛","鲁恩","因蒂斯","弗萨克","南大陆","北大陆"]
# 地点后缀词表（原名候选）
place_pat = re.compile(r"([\u4e00-\u9fa5]{2,6}(?:市|城|港|岛|镇|郡|区|街|大道|大学|教堂|王国|帝国|共和国|山脉|海|平原))")

print("=== 每个大地点附近出现的小地点（±300 行窗口） ===")
for c in ["鲁恩王国","因蒂斯共和国","弗萨克帝国"]:
    counter = collections.Counter()
    idxs = [i for i, l in enumerate(lines) if c in l][:120]
    for i in idxs:
        window = "\n".join(lines[max(0,i-120): i+120])
        for m in place_pat.finditer(window):
            name = m.group(1)
            if name != c and len(name) >= 3:
                counter[name] += 1
    print(f"\n{c}:")
    for name, n in counter.most_common(12):
        print(f"   {n:>4}  {name}")

print("\n=== 早期纪元的可用地点线索 ===")
for era in ["第一纪","第二纪","第三纪"]:
    idxs = [i for i, l in enumerate(lines) if era in l][:40]
    counter = collections.Counter()
    for i in idxs:
        window = "\n".join(lines[max(0,i-4): i+4])
        for m in place_pat.finditer(window):
            counter[m.group(1)] += 1
    print(f"{era}: " + " / ".join(f"{n}·{p}" for p, n in counter.most_common(6)))
