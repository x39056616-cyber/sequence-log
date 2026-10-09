export type ChapterTitlePhase = "opening" | "turn";

const OPENING_TITLES = [
  "灰雾中的第一封信",
  "命运递来的名片",
  "煤气灯下的入口",
  "不该存在的访客",
  "雾中来信",
  "第一枚齿轮",
];

function hashText(value: string) {
  let hash = 0;
  for (const char of value) hash = (hash * 31 + char.codePointAt(0)!) | 0;
  return Math.abs(hash);
}

export function normalizeChapterTitle(raw: string | null | undefined) {
  if (!raw) return "";
  const title = raw
    .trim()
    .replace(/^第[零一二三四五六七八九十百千0-9]+章[\s:：·\-—]*/, "")
    .replace(/[《》【】“”"'‘’]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (title.length < 2) return "";
  return title.slice(0, 24);
}

export function fallbackChapterTitle(input: {
  phase?: ChapterTitlePhase;
  userInput?: string;
  location?: string;
}) {
  const seed = `${input.userInput ?? ""}|${input.location ?? ""}`;
  if ((input.phase ?? "turn") === "opening") return OPENING_TITLES[hashText(seed) % OPENING_TITLES.length];
  const text = input.userInput ?? "";
  if (/调查|线索|观察|发现|追查|询问/.test(text)) return "未写完的线索";
  if (/对白|说|问|谈|告诉|回答|开口/.test(text)) return "谈话间的暗流";
  if (/离开|前往|进入|走出|回到/.test(text)) return `通往${input.location || "未知之地"}的路`;
  if (/攻击|伤害|危险|反抗|背叛/.test(text)) return "代价与回声";
  if (/等待|休息|思考|回想/.test(text)) return "雾中的停顿";
  return "灰雾下的新岔路";
}

export function resolveChapterTitle(
  raw: string | null | undefined,
  input: { phase?: ChapterTitlePhase; userInput?: string; location?: string },
) {
  return normalizeChapterTitle(raw) || fallbackChapterTitle(input);
}

export function uniqueChapterTitle(title: string, existing: string[]) {
  const clean = normalizeChapterTitle(title);
  if (!clean) return "";
  if (!existing.includes(clean)) return clean;
  const suffixes = ["·余波", "·回响", "·续", "·夜半"];
  for (const suffix of suffixes) {
    const candidate = `${clean.slice(0, Math.max(2, 24 - suffix.length))}${suffix}`;
    if (!existing.includes(candidate)) return candidate;
  }
  return `${clean.slice(0, 20)}·${existing.length + 1}`;
}
