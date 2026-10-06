import { z } from "zod";

const proposalSchema = z.object({
  id: z.string(),
  proposalStatus: z.literal("pending").default("pending"),
  title: z.string().min(4).max(80),
  narrativeTitle: z.string().min(4).max(80),
  narrativeDescription: z.string().min(20).max(500),
  realityAction: z.string().min(8).max(500),
  successCriteria: z.string().min(4).max(300),
  type: z.enum(["main", "side", "daily", "weekly", "oneoff", "habit", "boss"]),
  difficulty: z.number().int().min(1).max(5),
  priority: z.number().int().min(1).max(4),
  estimatedMinutes: z.number().int().min(5).max(120),
  actingFit: z.union([z.literal(0), z.literal(0.5), z.literal(1), z.literal(1.5)]),
  attributeIds: z.array(z.string()).min(1).max(4),
  tags: z.array(z.string()).max(8),
  safetyNotes: z.array(z.string()).max(5),
  sourceChoiceId: z.string().nullable(),
});

const operationSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("set_location"), location: z.string().min(2).max(120) }),
  z.object({ type: z.literal("advance_time"), value: z.string().min(2).max(120) }),
  z.object({ type: z.literal("adjust_flag"), key: z.string().min(2).max(40), label: z.string().min(2).max(40), delta: z.number().min(-5).max(5), description: z.string().max(160).optional() }),
  z.object({ type: z.literal("add_fact"), fact: z.string().min(4).max(300) }),
  z.object({ type: z.literal("open_thread"), title: z.string().min(2).max(80), description: z.string().min(4).max(300) }),
  z.object({ type: z.literal("resolve_thread"), title: z.string().min(2).max(80) }),
  z.object({ type: z.literal("upsert_actor"), name: z.string().min(2).max(60), role: z.string().min(2).max(80), relationshipDelta: z.number().min(-5).max(5), notes: z.string().max(300), faction: z.string().max(60).optional(), attitude: z.enum(["敌对", "警惕", "中立", "友好", "信任"]).optional(), tags: z.array(z.string().max(24)).max(6).optional() }),
  z.object({ type: z.literal("add_item"), name: z.string().min(2).max(80), description: z.string().max(300), rarity: z.enum(["common", "rare", "unique"]) }),
  z.object({ type: z.literal("remove_item"), name: z.string().min(2).max(80) }),
  z.object({ type: z.literal("canon_divergence"), description: z.string().min(4).max(300) }),
  z.object({ type: z.literal("set_protagonist_state"), state: z.enum(["alive", "injured", "missing", "dead", "resurrected"]), description: z.string().max(300) }),
  z.object({ type: z.literal("add_task_proposal"), proposal: proposalSchema }),
]);

export const turnAdjudicationSchema = z.object({
  operations: z.array(operationSchema).max(12),
  suggestedChoices: z.array(z.object({ id: z.string(), label: z.string().min(2).max(40), description: z.string().max(180) })).min(1).max(4),
  summaryDelta: z.string().max(500).default(""),
});

export type TurnAdjudication = z.infer<typeof turnAdjudicationSchema>;

export const TURN_ADJUDICATION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["operations", "suggestedChoices", "summaryDelta"],
  properties: {
    operations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: true,
        required: ["type"],
        properties: { type: { type: "string" } },
      },
    },
    suggestedChoices: {
      type: "array",
      items: { type: "object", additionalProperties: false, required: ["id", "label", "description"], properties: { id: { type: "string" }, label: { type: "string" }, description: { type: "string" } } },
    },
    summaryDelta: { type: "string" },
  },
} as const;


