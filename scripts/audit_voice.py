import re, pathlib, collections
text = pathlib.Path(r"C:\Users\Administrator\Documents\Codex\2026-10-04\x20-zhu\outputs\《诡秘之主》（精校版全本+番外完）作者：爱潜水的乌贼.md").read_text(encoding="utf-8", errors="ignore")

print("=== 1. 署名/称谓指纹 ===")
for t in ["祂","先生","女士","小姐","阁下","大人","神父","牧师","先生们"]:
    print(f"  {t}: {text.count(t)}")

print("\n=== 2. 货币与世俗细节（这是原著的'生活质感'）===")
for t in ["便士","苏勒","镑","铜便士","金镑","面包","黑啤酒","啤酒","煤油灯","煤气灯","马车","呢帽","手杖","左轮"]:
    print(f"  {t}: {text.count(t)}")

print("\n=== 3. 封印物编号格式（资深读者一眼认出）===")
nums = re.findall(r"[\"'“]?([0-9]-[0-9]{2,3})[\"'”]?", text)
print("  出现次数:", len(nums), " 不同编号:", len(set(nums)), " 样例:", sorted(set(nums))[:12])

print("\n=== 4. 核心术语密度 ===")
for t in ["序列","魔药","扮演","消化","失控","封印物","灰雾","灵性","占卜","仪式","非凡者","途径","直觉","灵界","污染","隐秘","代价"]:
    print(f"  {t}: {text.count(t)}")

print("\n=== 5. 官方机构（世界观骨架）===")
for t in ["值夜者","代罚者","机械之心","警察厅","军情九处","教会","塔罗会","密修会","心理炼金会"]:
    print(f"  {t}: {text.count(t)}")

print("\n=== 6. 典型句式：省略号与克制表达 ===")
print("  …… 出现:", text.count("……"))
for t in ["沉默","犹豫","谨慎","克制","不安","压抑","低声","深吸一口气","警惕"]:
    print(f"  {t}: {text.count(t)}")
