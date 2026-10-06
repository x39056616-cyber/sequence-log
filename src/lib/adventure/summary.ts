export const SUMMARY_INTERVAL = 6;

export function shouldPersistSummary(turnCount: number, interval = SUMMARY_INTERVAL) {
  return turnCount > 0 && turnCount % interval === 0;
}

export function buildRollingSummary(input: {
  previous?: string;
  delta?: string;
  knownFacts?: string[];
  openThreads?: Array<{ title: string; status: "open" | "resolved" }>;
  maxChars?: number;
}) {
  const maxChars = input.maxChars ?? 6000;
  const facts = (input.knownFacts ?? []).slice(-5).map((fact) => `事实：${fact}`);
  const threads = (input.openThreads ?? []).filter((thread) => thread.status === "open").slice(-5).map((thread) => `线索：${thread.title}`);
  const pieces = [input.previous, input.delta, facts.join("；"), threads.join("；")].filter((item) => item && item.trim().length > 0);
  return pieces.join("\n").slice(-maxChars);
}