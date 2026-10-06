#!/usr/bin/env python3
"""Exploratory frequency scan over the local novel to discover real entity candidates."""
from __future__ import annotations
import re, collections, pathlib

SRC = pathlib.Path(r"C:\Users\Administrator\Documents\Codex\2026-10-04\x20-zhu\outputs\《诡秘之主》（精校版全本+番外完）作者：爱潜水的乌贼.md")
text = SRC.read_text(encoding="utf-8", errors="ignore")

def top(pattern: str, n: int = 25, min_len: int = 2, max_len: int = 12, group: int = 0):
    c = collections.Counter()
    for m in re.finditer(pattern, text):
        v = m.group(group)
        if min_len <= len(v) <= max_len:
            c[v] += 1
    return c.most_common(n)

print("=== 组织/教会 (…教会 / …会 / …团 / …家族 / …学派 / …议会) ===")
for k, v in top(r"([\u4e00-\u9fa5]{2,8}(?:教会|学派|议会|家族|公国|王国|公司|委员会|基金会))", 28):
    print(f"{v:>6}  {k}")

print()
print("=== 地名 (…市/港/岛/海/城/街/区/大陆/王国/帝国) ===")
for k, v in top(r"([\u4e00-\u9fa5]{2,7}(?:市|港|岛|海|城|街|区|大陆|王国|帝国|山脉|平原|小镇))", 30):
    print(f"{v:>6}  {k}")

print()
print("=== 高频专名（3-6字，出现>200，排除常见词） ===")
stop = set("一个 我们 你们 他们 自己 什么 这个 那个 没有 已经 可以 就是 但是 如果 因为 所以 现在 时候 知道 觉得 看见 听到 感觉 似乎 仿佛 应该 一定 当然 同时 然后 于是 而且 不过 只是 还是 或者 一直 非常 十分 有些 很多 所有 整个 全部 任何 其他 另外 其中 之后 之前 之后 这里 那里 怎么 为什么 因为".split())
c = collections.Counter(re.findall(r"[\u4e00-\u9fa5]{3,5}", text))
rows = [(k, v) for k, v in c.most_common(4000) if v > 200 and k not in stop]
for k, v in rows[:60]:
    print(f"{v:>6}  {k}")
