import re, pathlib
text = pathlib.Path(r"C:\Users\Administrator\Documents\Codex\2026-10-04\x20-zhu\outputs\《诡秘之主》（精校版全本+番外完）作者：爱潜水的乌贼.md").read_text(encoding="utf-8", errors="ignore")
lines = text.splitlines()
print("=== 含「占卜家」且附近有 主材料/配方 的段落 ===")
shown = 0
for i, l in enumerate(lines):
    if "占卜家" not in l: continue
    window = "\n".join(lines[max(0,i-3): i+6])
    if ("主材料" in window) or ("魔药配方" in window):
        print(f"--- 行 {i+1} ---")
        print(window[:420])
        shown += 1
        if shown >= 4: break
print("\n=== 「愚者途径」相关配方线索 ===")
for kw in ["占卜家魔药配方", "愚者的魔药", "小丑魔药", "魔术师魔药"]:
    print(f"  {kw}: {text.count(kw)}")
