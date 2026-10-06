import re, pathlib
novel = pathlib.Path(r"C:\Users\Administrator\Documents\Codex\2026-10-04\x20-zhu\outputs\《诡秘之主》（精校版全本+番外完）作者：爱潜水的乌贼.md")
lines = novel.read_text(encoding="utf-8", errors="ignore").splitlines()
src = pathlib.Path("src/lib/lore/pathways.ts").read_text(encoding="utf-8")

seqs = []
for m in re.finditer(r'\{\s*id: "([^"]+)",\s*name: "([^"]+)"[\s\S]*?names: \[([^\]]+)\]', src):
    pid, pwname, blob = m.group(1), m.group(2), m.group(3)
    ranks = re.findall(r'"([^"]+)"', blob)
    if len(ranks) != 10:
        continue
    for rank, nm in zip([9,8,7,6,5,4,3,2,1,0], ranks):
        seqs.append((pid, pwname, rank, nm))
print("解析到的序列数:", len(seqs))

pat = re.compile(r"能力(?:好像|似乎|大概|主要)?(?:有|是|包括|为|之一)[：:]?([^。！？；\n]{2,90})")
hits = 0
samples = []
for pid, pwname, rank, nm in seqs:
    found = None
    for idx, line in enumerate(lines):
        if nm not in line:
            continue
        window = "".join(lines[max(0, idx-1): idx+3])
        if "能力" not in window:
            continue
        m = pat.search(window)
        if m:
            found = m.group(1).strip()
            break
    if found:
        hits += 1
        if len(samples) < 14:
            samples.append((pwname, rank, nm, found[:70]))
print("能用「能力有/是/包括」抽到描述的序列:", hits)
for s in samples:
    print("  -", s)
