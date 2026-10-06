import re, json, pathlib
idx = json.loads(pathlib.Path("src/lib/lore/evidence.generated.json").read_text(encoding="utf-8"))
seqs = list(idx["sequences"].values())
pat = re.compile(r"能力(?:好像|似乎|大概)?(?:有|是|包括|为)[：:]?([^。！？；\n]{2,80})")
coverage = 0
examples = []
for s in seqs:
    quotes = [e["quote"] for e in s.get("evidence", []) if e.get("kind") == "ability"]
    hit = None
    for q in quotes:
        m = pat.search(q)
        if m:
            hit = m.group(1).strip()
            break
    if hit:
        coverage += 1
        if len(examples) < 10:
            examples.append((s["pathwayName"], s["sequence"], s["name"], hit[:60]))
print("有 ability 证据的序列:", sum(1 for s in seqs if any(e.get("kind")=="ability" for e in s.get("evidence",[]))), "/", len(seqs))
print("其中能用「能力有/是/包括」句式直接抽出列表的:", coverage)
print("样例:")
for e in examples:
    print("  -", e)
