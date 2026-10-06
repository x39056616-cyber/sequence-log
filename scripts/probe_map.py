import re, pathlib
src = pathlib.Path("src/lib/lore/pathways.ts").read_text(encoding="utf-8")
seqs = []
for m in re.finditer(r'\{\s*id: "([^"]+)",\s*name: "([^"]+)"[\s\S]*?names: \[([^\]]+)\]', src):
    names = re.findall(r'"([^"]+)"', m.group(3))
    if len(names) == 10:
        seqs.append((m.group(1), m.group(2), names[0]))   # 途径 id / 途径名 / 序列9名
print("站点 22 途径（id | 途径名 | 序列9名）:")
for pid, pname, s9 in seqs:
    print(f"  {pid:<16} {pname:<6} 序列9={s9}")
print()
print("序列9 名称集合:", " / ".join(s9 for _, _, s9 in seqs))
