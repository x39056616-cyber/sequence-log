import re, pathlib, collections
text = pathlib.Path(r"C:\Users\Administrator\Documents\Codex\2026-10-04\x20-zhu\outputs\《诡秘之主》（精校版全本+番外完）作者：爱潜水的乌贼.md").read_text(encoding="utf-8", errors="ignore")
print("=== 纪元词频 ===")
for term in ["第一纪","第二纪","第三纪","第四纪","第五纪","纪元"]:
    print(f"  {term}: {text.count(term)}")
print("=== 第X纪 + 年份 ===")
years = collections.Counter(re.findall(r"第[一二三四五]纪\s*[0-9]{1,4}\s*年", text))
for k, v in years.most_common(10): print(f"  {v:>5}  {k}")
print("  单写年份样例:", [f"{k}({v})" for k, v in collections.Counter(re.findall(r"(?<![第纪])([0-9]{3,4})年", text)).most_common(8)])
print("=== 大地点（国家/帝国） ===")
for term in ["因蒂斯共和国","因蒂斯","鲁恩王国","鲁恩","弗萨克帝国","弗萨克","所罗门帝国","图铎帝国","特伦索斯特帝国","罗塞尔帝国","北大陆","南大陆"]:
    print(f"  {term}: {text.count(term)}")
print("=== 小地点（城市/地标） ===")
for term in ["特里尔","贝克兰德","廷根","拜亚姆","普利兹港","康斯顿","白银城","迷雾海","圣赛琳娜教堂","霍伊大学"]:
    print(f"  {term}: {text.count(term)}")
