import re, pathlib, json
SRC = pathlib.Path(r"C:\Users\Administrator\Documents\Codex\2026-10-04\x20-zhu\outputs\《诡秘之主》（精校版全本+番外完）作者：爱潜水的乌贼.md")
text = SRC.read_text(encoding="utf-8", errors="ignore")

figures = ["阿蒙","克莱恩","齐林格斯","罗塞尔","天尊","上帝","安提哥努斯","查拉图","亚当","阿尔杰","奥黛丽","因斯·赞格威尔","邓恩","梅丽莎","班森","莎伦","艾弥留斯","伯特利","弗雷格拉","阿兹克","伦纳德","戴莉","佛尔思","休","艾德雯娜","纳尔逊","洛薇雅","乌洛琉斯","罗塞尔·古斯塔夫","索伦","罗恩","希伯特","霍纳奇斯","格罗塞尔","因蒂斯","凯撒","罗伊","玛丽"]
events = ["失控","封印物","污染","梦境","契约","诅咒","占卜","邪神","降临","通缉","悬赏","密修","追查","晋升仪式","失控边缘","畸变","异变","神降","窥视","隐秘存在","非凡特性","灵界","集体潜意识大海","锁闭","失忆","穿越","预言","仪式"]
items = ["怀表","日记","单片眼镜","手杖","左轮","符文","十字架","圣徽","魔药","太阳符咒","止血药","黄铜","银币"]
print("== FIGURES ==")
rows = []
for f in figures:
    n = text.count(f)
    if n: rows.append((n, f))
for n, f in sorted(rows, reverse=True): print(f"{n:>7}  {f}")
print()
print("== EVENTS ==")
rows = []
for f in events:
    n = text.count(f)
    if n: rows.append((n, f))
for n, f in sorted(rows, reverse=True): print(f"{n:>7}  {f}")
print()
print("== ITEMS ==")
rows = []
for f in items:
    n = text.count(f)
    if n: rows.append((n, f))
for n, f in sorted(rows, reverse=True): print(f"{n:>7}  {f}")
