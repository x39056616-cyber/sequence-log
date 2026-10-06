import { calculateStatusAverage } from "@/lib/domain/digestion";
import { getSequence } from "@/lib/lore/pathways";
import type { AdventureEvent, Attribute, FateProfile, NarrativeChoice, PersonalProfile, Quest, QuestCompletion, SequenceRank, Settings, StoryFlag, TaskProposal } from "@/lib/types";
import { uid } from "@/lib/utils";

interface PlannerInput {
  localDate: string;
  kind: "daily" | "manual";
  profile: PersonalProfile;
  quests: Quest[];
  completions: QuestCompletion[];
  attributes: Attribute[];
  settings: Settings;
  pathwayId: string | null;
  sequence: SequenceRank;
  flags: StoryFlag[];
  fate?: FateProfile | null;
}

interface Template {
  domain: string;
  action: string;
  criteria: string;
  tags: string[];
}

const TEMPLATES: Record<string, Template[]> = {
  intellect: [
    { domain: "intellect", action: "完成 30 分钟无干扰阅读，并在纸上写下三个可复述的观点。", criteria: "完成阅读并获得至少三条自己的记录。", tags: ["阅读", "理解"] },
    { domain: "intellect", action: "选择一个正在学习的主题，用自己的话制作一页简洁笔记。", criteria: "不照抄原文，能解释核心概念和例子。", tags: ["学习", "整理"] },
  ],
  body: [
    { domain: "body", action: "完成 25 分钟低到中等强度活动，并按身体感受随时调整。", criteria: "完成活动且没有疼痛或明显不适。", tags: ["运动", "体能"] },
    { domain: "body", action: "进行一次 10 分钟拉伸和呼吸练习。", criteria: "结束时不追求极限，只记录身体变化。", tags: ["恢复", "呼吸"] },
  ],
  focus: [
    { domain: "focus", action: "设置 25 分钟计时器，只处理一个明确的小问题。", criteria: "计时结束前不切换到无关页面。", tags: ["专注", "深度工作"] },
    { domain: "focus", action: "清理当前任务的第一小步，并立即完成它。", criteria: "能说明下一步是什么，且已完成第一步。", tags: ["启动", "推进"] },
  ],
  social: [
    { domain: "social", action: "主动联系一位让你感到安全的人，进行一次简短而真诚的交流。", criteria: "表达自己的近况或感谢，不强迫对方回应。", tags: ["联系", "边界"] },
    { domain: "social", action: "在合适的场合提出一个具体问题，练习清晰表达需求。", criteria: "问题明确、尊重对方，并以对方意愿为边界。", tags: ["沟通", "表达"] },
  ],
  creativity: [
    { domain: "creativity", action: "进行 20 分钟自由创作，不先追求完整成品。", criteria: "留下可继续修改的草稿。", tags: ["创作", "草稿"] },
    { domain: "creativity", action: "把一个模糊想法拆成三个可测试的小方向。", criteria: "至少写出三个差异明确的实现路径。", tags: ["构思", "设计"] },
  ],
  execution: [
    { domain: "execution", action: "从待办中选一个拖延任务，把它缩到 15 分钟内可完成的第一步。", criteria: "完成第一步并更新任务状态。", tags: ["启动", "执行"] },
    { domain: "execution", action: "写下今天最重要的三件事，并完成其中一件。", criteria: "优先级明确，至少一项产生可见结果。", tags: ["计划", "完成"] },
  ],
  will: [
    { domain: "will", action: "在预设时间内完成一个不想做但重要的小任务，并在结束后休息。", criteria: "不通过羞辱或透支迫使自己完成。", tags: ["坚持", "边界"] },
    { domain: "will", action: "删除或暂停一个与你当前目标无关的低价值承诺。", criteria: "做出减少负担的明确决定。", tags: ["取舍", "减负"] },
  ],
  life: [
    { domain: "life", action: "整理一个只用 15 分钟就能改善的生活区域。", criteria: "完成后该区域更容易使用或维护。", tags: ["整理", "生活"] },
    { domain: "life", action: "检查一项即将到期的生活事务，并完成下一步操作。", criteria: "事项状态发生实际更新。", tags: ["事务", "计划"] },
  ],
};

function pickIndex(seed: string, length: number) {
  let value = 0;
  for (const char of seed) value = (value * 31 + char.charCodeAt(0)) >>> 0;
  return value % Math.max(1, length);
}

function safeMinutes(profile: PersonalProfile, average: number) {
  const weekend = [0, 6].includes(new Date().getDay());
  const base = weekend ? profile.weekendMinutes : profile.weekdayMinutes;
  return Math.max(15, Math.min(90, average < 30 ? Math.min(base, 35) : base));
}

export function planAdventure(input: PlannerInput): AdventureEvent {
  const average = calculateStatusAverage(input.settings.status);
  const budget = safeMinutes(input.profile, average);
  const sequence = getSequence(input.pathwayId, input.sequence);
  const preferred = input.profile.preferredDomains.length ? input.profile.preferredDomains : input.profile.goals.map((goal) => goal.title);
  const domains = [...new Set([...preferred.map((item) => item.toLowerCase()), "intellect", "focus", "execution", "life"])].filter((domain) => TEMPLATES[domain]);
  const selectedDomains = domains.slice(0, 6);
  const proposals: TaskProposal[] = [];
  for (let index = 0; index < 3; index += 1) {
    const domain = selectedDomains[index % selectedDomains.length] ?? ["intellect", "focus", "life"][index];
    const candidates = TEMPLATES[domain];
    const fateSeed = input.fate?.attributes.map((attribute) => attribute.optionId).join("-") ?? "";
    const template = candidates[pickIndex(input.localDate + "-" + index + "-" + domain + "-" + fateSeed, candidates.length)];
    const isMain = index === 0;
    const minutes = isMain ? Math.max(15, Math.min(45, Math.round(budget * 0.6))) : Math.max(10, Math.min(30, Math.round(budget * 0.35)));
    const difficulty = Math.max(1, Math.min(input.profile.difficultyPreference, average < 30 ? 2 : 3)) as TaskProposal["difficulty"];
    proposals.push({
      id: uid(),
      proposalStatus: "pending",
      title: template.action.replace(/[。.]$/, "").slice(0, 50),
      narrativeTitle: isMain ? "灰雾回响 · 第一项仪式" : "支线观测 · 命运分岔",
      narrativeDescription: "灰雾之上，一条与现实相连的细线微微震颤。它不是预言，只是一条等待你确认的行动路径。",
      realityAction: template.action,
      successCriteria: template.criteria,
      type: isMain ? "main" : "side",
      difficulty,
      priority: isMain ? 3 : 2,
      estimatedMinutes: minutes,
      actingFit: isMain ? 1 : 0.5,
      attributeIds: [domain === "body" ? "body" : domain === "social" ? "social" : domain === "creativity" ? "creativity" : domain === "life" ? "life" : "focus"],
      tags: ["现实委托", ...template.tags],
      safetyNotes: input.profile.constraints.filter((item) => item.category === "health" || item.category === "time").map((item) => item.summary),
      sourceChoiceId: null,
    });
  }
  const choices: NarrativeChoice[] = [
    { id: uid(), label: "签署委托", description: "把主线任务带回现实，完成标准保持清晰。", tone: "action", effects: { flags: { resolve: 1 }, riskBand: "low" }, proposalIds: [proposals[0].id] },
    { id: uid(), label: "谨慎调查", description: "选择一项短支线，先观察行动带来的变化。", tone: "caution", effects: { flags: { insight: 1 }, riskBand: "low" }, proposalIds: [proposals[1].id] },
    { id: uid(), label: "保留余力", description: "选择低负荷任务，把恢复也视为有效行动。", tone: "rest", effects: { flags: { stability: 1 }, riskBand: "low" }, proposalIds: [proposals[2].id] },
  ];
  proposals.forEach((proposal, index) => { proposal.sourceChoiceId = choices[index].id; });
  const chapterNumber = Math.max(1, Math.floor(input.completions.filter((item) => !item.revokedAt).length / 7) + 1);
  const fate = input.fate && input.fate.status === "active" ? input.fate : null;
  const fateLine = fate ? fate.attributes.map((attribute) => attribute.categoryLabel + "：" + attribute.optionLabel).join("｜") : "";
  return {
    id: uid(), localDate: input.localDate, kind: input.kind, status: "presented",
    chapter: "第 " + chapterNumber + " 章",
    title: fate ? "命运转盘 · " + (fate.attributes.find((attribute) => attribute.categoryId === "event")?.optionLabel ?? "新的分岔") : (sequence?.name ? "序列 " + input.sequence + " · " + sequence.name + "的低语" : "灰雾之上的第一封信"),
    opening: fate
      ? "【灰雾之上】转盘停下时，指针落在这一组命运上 —— " + fateLine + "。现实仍按自己的规则运转，但今天的行动会在某条途径上留下痕迹。"
      : "【灰雾之上】你听见灰雾深处传来纸张翻动的声音。现实仍按自己的规则运转，但今天的行动会在某条途径上留下痕迹。",
    systemMessages: ["事件已接入当前序列", "现实任务可拒绝、可编辑", "不产生隐藏奖励或惩罚"],
    sceneMood: "grey-fog-victorian",
    choices, proposals, chosenChoiceId: null, imageAssetId: null,
    provider: "local", model: "local-planner", fateProfileId: fate?.id ?? null, createdAt: new Date().toISOString(), resolvedAt: null,
  };
}





