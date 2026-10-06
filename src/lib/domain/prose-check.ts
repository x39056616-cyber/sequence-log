import { STYLE_LEXICON } from "@/lib/lore/style-lexicon";

export interface ProseIssue {
  /** 第几句（从 1 开始） */
  index: number;
  sentence: string;
  kind: "ai-tone" | "modern" | "divine-pronoun" | "sealed-number" | "sealed-format" | "low-terminology" | "long-sentence" | "repetitive" | "appellation-drift" | "currency-mix" | "terminology-mix";
  label: string;
  hint: string;
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[。！？…；])/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

const SEALED_RE = /[0-3]-\d{2,3}/;
const BAD_SEALED_RE = /封印物\s*[0-3]\s*[-－]\s*\d(?!\d)/;
const VICTORIAN_CURRENCY_RE = /(镑|苏勒|便士)/;
const MODERN_CURRENCY_RE = /(美元|人民币|欧元|日元|块钱)/;

/**
 * 本地规则校验：完全不调用模型，纯字符串检查。
 * 目的是把「读起来不像原著」的地方指出来，供人工决定是否重写。
 */
export function checkProse(text: string): ProseIssue[] {
  const issues: ProseIssue[] = [];
  if (!text.trim()) return issues;
  const sentences = splitSentences(text);

  sentences.forEach((sentence, i) => {
    const hitBanned = STYLE_LEXICON.banned.find((word) => sentence.includes(word));
    if (hitBanned) {
      issues.push({ index: i + 1, sentence, kind: "ai-tone", label: `AI 腔用词「${hitBanned}」`, hint: "换成具体动作或直接删除这句过渡。" });
    }
    const hitModern = STYLE_LEXICON.modernBanned.find((word) => sentence.includes(word));
    if (hitModern) {
      issues.push({ index: i + 1, sentence, kind: "modern", label: `现代词「${hitModern}」`, hint: "换成维多利亚时代的说法（马车、煤气灯、电报、报纸等）。" });
    }
  });

  const divineContext = /(真神|旧日|神灵|神明|主 |祂|造物主|支配者)/.test(text);
  if (divineContext && !text.includes("祂")) {
    const sentence = sentences.find((item) => /(真神|旧日|神灵|神明|造物主|支配者)/.test(item)) ?? sentences[0] ?? "";
    issues.push({ index: sentences.indexOf(sentence) + 1 || 1, sentence, kind: "divine-pronoun", label: "指神性存在却没有用「祂」", hint: "用「祂」指神，用「他」指凡人——这是原著的硬习惯。" });
  }

  const badSealed = sentences.find((sentence) => BAD_SEALED_RE.test(sentence));
  if (badSealed) {
    issues.push({ index: sentences.indexOf(badSealed) + 1, sentence: badSealed, kind: "sealed-format", label: "封印物编号格式错误", hint: "编号应为 0-08、1-42、2-049 这类两位或三位数字。" });
  } else if (text.includes("封印物") && !SEALED_RE.test(text)) {
    const sentence = sentences.find((item) => item.includes("封印物")) ?? "";
    issues.push({ index: sentences.indexOf(sentence) + 1 || 1, sentence, kind: "sealed-number", label: "提到封印物但没有编号", hint: "写成「封印物 0-08」这样的编号形式。" });
  }

  const honorifics = new Map<string, Set<string>>();
  const honorificRe = /([\u4e00-\u9fa5]{2,4})(先生|女士|小姐|阁下|大人)/g;
  let match: RegExpExecArray | null;
  while ((match = honorificRe.exec(text)) !== null) {
    const name = match[1];
    const title = match[2];
    const titles = honorifics.get(name) ?? new Set<string>();
    titles.add(title);
    honorifics.set(name, titles);
  }
  for (const [name, titles] of honorifics) {
    if (titles.size > 1) {
      const sentence = sentences.find((item) => item.includes(name)) ?? sentences[0] ?? "";
      issues.push({ index: sentences.indexOf(sentence) + 1 || 1, sentence, kind: "appellation-drift", label: `「${name}」的称谓前后不一致`, hint: `同一人物只使用一种称谓；当前出现：${[...titles].join("、")}。` });
    }
  }

  if (VICTORIAN_CURRENCY_RE.test(text) && MODERN_CURRENCY_RE.test(text)) {
    const sentence = sentences.find((item) => VICTORIAN_CURRENCY_RE.test(item) || MODERN_CURRENCY_RE.test(item)) ?? sentences[0] ?? "";
    issues.push({ index: sentences.indexOf(sentence) + 1 || 1, sentence, kind: "currency-mix", label: "英镑世界与人民币/美元混用", hint: "统一使用镑、苏勒、便士。" });
  }

  if ((/精神力|精神值/.test(text)) && /灵性/.test(text)) {
    const sentence = sentences.find((item) => /精神力|精神值/.test(item)) ?? sentences[0] ?? "";
    issues.push({ index: sentences.indexOf(sentence) + 1 || 1, sentence, kind: "terminology-mix", label: "灵性与精神力术语混用", hint: "统一使用「灵性」；「精神力」不是这套体系的写法。" });
  }

  if (text.length >= 800) {
    const termCount = STYLE_LEXICON.terms.reduce((sum, term) => sum + (text.split(term).length - 1), 0);
    if (termCount < 4) {
      issues.push({ index: 1, sentence: sentences[0] ?? "", kind: "low-terminology", label: `术语只出现 ${termCount} 次（建议 ≥4）`, hint: "补上序列／途径／魔药／灵性／占卜这类原著术语。" });
    }
  }

  const longSentences = sentences.filter((item) => item.length > 60);
  if (sentences.length >= 6 && longSentences.length / sentences.length > 0.5) {
    const sentence = longSentences[0];
    issues.push({ index: sentences.indexOf(sentence) + 1, sentence, kind: "long-sentence", label: "长句比例过高", hint: "拆成短句，长短交错更像原著。" });
  }

  for (let i = 2; i < sentences.length; i += 1) {
    const head = (s: string) => s.slice(0, 2);
    if (head(sentences[i]) === head(sentences[i - 1]) && head(sentences[i]) === head(sentences[i - 2])) {
      issues.push({ index: i + 1, sentence: sentences[i], kind: "repetitive", label: "连续三句同构开头", hint: "改掉其中一句的开头，避免排比堆砌。" });
      break;
    }
  }

  return issues.slice(0, 12);
}