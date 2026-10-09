export type UUID = string;
export type SequenceRank = 9 | 8 | 7 | 6 | 5 | 4 | 3 | 2 | 1 | 0;
export type QuestStatus = "inbox" | "today" | "active" | "completed";
export type QuestType = "main" | "side" | "daily" | "weekly" | "oneoff" | "habit" | "boss";
export type Difficulty = 1 | 2 | 3 | 4 | 5;
export type Quality = "missed" | "done" | "good" | "excellent";
export type ActingFit = 0 | 0.5 | 1 | 1.5;
export type PotionStage = "formula" | "materials" | "acting" | "ritual" | "ready";

export interface LoreSource {
  title: string;
  url: string;
  retrievedAt: string;
}

export interface PathwayDefinition {
  id: string;
  name: string;
  sequence0: string;
  tarot: string;
  sefirah: string;
  adjacentIds: string[];
  symbol: string;
  source: LoreSource;
  sequences: SequenceDefinition[];
}

export interface SequenceDefinition {
  id: string;
  pathwayId: string;
  pathwayName: string;
  sequence: SequenceRank;
  name: string;
  abilities: string[];
  mainIngredients: string[];
  auxiliaryIngredients: string[];
  actingPrinciples: string[];
  advancementRitual: string | null;
  loreStatus: "indexed" | "partial" | "verified";
  sources: LoreSource[];
}

export interface UserProfile {
  id: "me";
  name: string;
  title: string;
  totalSpirituality: number;
  createdAt: string;
  updatedAt: string;
}

export interface Attribute {
  id: string;
  key: string;
  name: string;
  description: string;
  color: string;
  xp: number;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface SequenceState {
  id: "active";
  pathwayId: string | null;
  sequence: SequenceRank;
  digestion: number;
  stage: PotionStage;
  createdAt: string;
  updatedAt: string;
}

export interface RealityRequirement {
  id: string;
  pathwayId: string;
  sequence: SequenceRank;
  kind: "material" | "acting" | "anchor" | "ritual";
  title: string;
  description: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Quest {
  id: string;
  title: string;
  description: string;
  status: QuestStatus;
  type: QuestType;
  difficulty: Difficulty;
  priority: 1 | 2 | 3 | 4;
  estimatedMinutes: number;
  dueAt: string | null;
  xpOverride: number | null;
  actingFit: ActingFit;
  attributeIds: string[];
  tags: string[];
  notes: string;
  narrativeTitle?: string;
  narrativeDescription?: string;
  realityAction?: string;
  successCriteria?: string;
  originEventId?: string;
  branchChoiceId?: string;
  storyTags?: string[];
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface QuestCompletion {
  id: string;
  questId: string;
  questTitle: string;
  quality: Quality;
  qualityMultiplier: number;
  baseDigestion: number;
  statusMultiplier: number;
  actingFit: ActingFit;
  digestionAwarded: number;
  spiritualityAwarded: number;
  attributeAllocations: Record<string, number>;
  actualMinutes: number;
  completedAt: string;
  revokedAt: string | null;
  sequenceAtCompletion: SequenceRank;
}

export interface XPEvent {
  id: string;
  kind: "quest" | "reversal" | "adjustment" | "promotion" | "loss" | "transfer";
  sourceId: string;
  amount: number;
  digestion: number;
  attributeAllocations: Record<string, number>;
  reason: string;
  createdAt: string;
  reversesEventId: string | null;
}

export interface Habit {
  id: string;
  title: string;
  description: string;
  frequency: "daily" | "weekly" | "custom";
  targetPerWeek: number;
  actingFit: ActingFit;
  graceDays: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface HabitLog {
  id: string;
  habitId: string;
  localDate: string;
  status: "completed" | "skipped" | "rest" | "backfilled";
  note: string;
  createdAt: string;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  unlockedAt: string | null;
  rule: string;
}

export type InventoryCategory = "beyond" | "sealed" | "common";

export interface Item {
  id: string;
  name: string;
  description: string;
  rarity: "common" | "rare" | "unique";
  equipped: boolean;
  category?: InventoryCategory;
  notes?: string;
  source?: string;
  acquiredAt?: string;
  unlockedAt: string | null;
}

export interface StabilityEvent {
  id: string;
  average: number;
  san: number;
  energy: number;
  focus: number;
  motivation: number;
  eventType: "checkin" | "loss_of_control";
  note: string;
  createdAt: string;
}

export interface PathwayTransfer {
  id: string;
  fromPathwayId: string;
  toPathwayId: string;
  sequence: SequenceRank;
  createdAt: string;
}

export interface Settings {
  id: "app";
  timezone: string;
  weekStartsOn: 0 | 1;
  digestionBase: number;
  digestionLinear: number;
  digestionQuadratic: number;
  theme: "dark" | "light";
  animations: boolean;
  chapterLength: "brief" | "standard" | "long";
  /** 是否允许转盘上出现明确标注的“非原作地名”。 */
  allowNonCanonGeo?: boolean;
  status: {
    san: number;
    energy: number;
    focus: number;
    motivation: number;
  };
  updatedAt: string;
}

export interface AdventureBaseBackup {
  exportedAt: string;
  profile: UserProfile;
  sequenceState: SequenceState;
  settings: Settings;
  attributes: Attribute[];
  quests: Quest[];
  completions: QuestCompletion[];
  xpEvents: XPEvent[];
  habits: Habit[];
  habitLogs: HabitLog[];
  realityRequirements: RealityRequirement[];
  stabilityEvents: StabilityEvent[];
  achievements: Achievement[];
  items: Item[];
  pathwayTransfers: PathwayTransfer[];
}

export interface BackupSnapshotV1 extends AdventureBaseBackup { schemaVersion: 1; }

export interface BackupSnapshotV2 extends AdventureBaseBackup {
  schemaVersion: 2;
  personalProfile: PersonalProfile;
  adventureEvents: AdventureEvent[];
  storyFlags: StoryFlag[];
  storyActors: StoryActor[];
  sceneAssets: SceneAsset[];
  aiRequestLogs: AIRequestLog[];
}

export interface BackupSnapshot extends AdventureBaseBackup {
  schemaVersion: 3;
  personalProfile: PersonalProfile;
  adventureEvents: AdventureEvent[];
  storyFlags: StoryFlag[];
  storyActors: StoryActor[];
  sceneAssets: SceneAsset[];
  aiRequestLogs: AIRequestLog[];
  storyThreads: StoryThread[];
  storyTurns: StoryTurn[];
  storyCheckpoints: StoryCheckpoint[];
  worldStates: WorldState[];
  storyItems: StoryItem[];
  storySummaries: StorySummary[];
}

export interface BackupSnapshotV4 extends AdventureBaseBackup {
  schemaVersion: 4;
  personalProfile: PersonalProfile;
  adventureEvents: AdventureEvent[];
  storyFlags: StoryFlag[];
  storyActors: StoryActor[];
  sceneAssets: SceneAsset[];
  aiRequestLogs: AIRequestLog[];
  storyThreads: StoryThread[];
  storyTurns: StoryTurn[];
  storyCheckpoints: StoryCheckpoint[];
  worldStates: WorldState[];
  storyItems: StoryItem[];
  storySummaries: StorySummary[];
  wheelCategories: WheelCategory[];
  wheelOptions: WheelOption[];
  fateProfiles: FateProfile[];
  wheelSpins: WheelSpin[];
}

export interface BackupSnapshotV5 extends AdventureBaseBackup {
  schemaVersion: 5;
  personalProfile: PersonalProfile;
  adventureEvents: AdventureEvent[];
  storyFlags: StoryFlag[];
  storyActors: StoryActor[];
  sceneAssets: SceneAsset[];
  aiRequestLogs: AIRequestLog[];
  storyThreads: StoryThread[];
  storyTurns: StoryTurn[];
  storyCheckpoints: StoryCheckpoint[];
  worldStates: WorldState[];
  storyItems: StoryItem[];
  storySummaries: StorySummary[];
  wheelCategories: WheelCategory[];
  wheelOptions: WheelOption[];
  fateProfiles: FateProfile[];
  wheelSpins: WheelSpin[];
  characterBackgrounds: CharacterBackground[];
}

export interface BackupSnapshotV6 extends AdventureBaseBackup {
  schemaVersion: 6;
  personalProfile: PersonalProfile;
  adventureEvents: AdventureEvent[];
  storyFlags: StoryFlag[];
  storyActors: StoryActor[];
  sceneAssets: SceneAsset[];
  aiRequestLogs: AIRequestLog[];
  storyThreads: StoryThread[];
  storyTurns: StoryTurn[];
  storyCheckpoints: StoryCheckpoint[];
  worldStates: WorldState[];
  storyItems: StoryItem[];
  storySummaries: StorySummary[];
  wheelCategories: WheelCategory[];
  wheelOptions: WheelOption[];
  fateProfiles: FateProfile[];
  wheelSpins: WheelSpin[];
  characterBackgrounds: CharacterBackground[];
  skills: Skill[];
  skillEvents: SkillEvent[];
}

export interface BackupSnapshotV7 extends AdventureBaseBackup {
  schemaVersion: 7;
  personalProfile: PersonalProfile;
  adventureEvents: AdventureEvent[];
  storyFlags: StoryFlag[];
  storyActors: StoryActor[];
  sceneAssets: SceneAsset[];
  aiRequestLogs: AIRequestLog[];
  storyThreads: StoryThread[];
  storyTurns: StoryTurn[];
  storyCheckpoints: StoryCheckpoint[];
  worldStates: WorldState[];
  storyItems: StoryItem[];
  storySummaries: StorySummary[];
  wheelCategories: WheelCategory[];
  wheelOptions: WheelOption[];
  fateProfiles: FateProfile[];
  wheelSpins: WheelSpin[];
  characterBackgrounds: CharacterBackground[];
  skills: Skill[];
  skillEvents: SkillEvent[];
  formulas: Formula[];
}

export type ImportableBackup = BackupSnapshotV1 | BackupSnapshotV2 | BackupSnapshot | BackupSnapshotV4 | BackupSnapshotV5 | BackupSnapshotV6 | BackupSnapshotV7;

export type SharingPolicy = "local" | "summary" | "full";
export type GoalHorizon = "30d" | "90d" | "year" | "long";

export interface Goal {
  id: string;
  title: string;
  description: string;
  horizon: GoalHorizon;
  priority: 1 | 2 | 3 | 4;
  active: boolean;
}

export interface LifeConstraint {
  id: string;
  category: "health" | "budget" | "social" | "time" | "environment" | "equipment";
  summary: string;
  detail: string;
  sharing: SharingPolicy;
}

export interface PersonalProfile {
  id: "me";
  summary: string;
  interests: string[];
  preferredDomains: string[];
  avoidedTasks: string[];
  goals: Goal[];
  constraints: LifeConstraint[];
  weekdayMinutes: number;
  weekendMinutes: number;
  preferredTime: "morning" | "afternoon" | "evening" | "flexible";
  energyPattern: "morning-peak" | "afternoon-peak" | "evening-peak" | "variable";
  environment: string[];
  equipment: string[];
  socialPreference: "solo" | "small-group" | "either";
  difficultyPreference: 1 | 2 | 3 | 4 | 5;
  consentVersion: number;
  updatedAt: string;
}

export interface NarrativeEffects {
  flags: Record<string, number>;
  riskBand: "low" | "medium" | "high";
}

export interface NarrativeChoice {
  id: string;
  label: string;
  description: string;
  tone: "caution" | "action" | "insight" | "rest";
  effects: NarrativeEffects;
  proposalIds: string[];
}

export interface TaskProposal {
  id: string;
  proposalStatus: "pending" | "accepted" | "rejected";
  title: string;
  narrativeTitle: string;
  narrativeDescription: string;
  realityAction: string;
  successCriteria: string;
  type: Quest["type"];
  difficulty: Quest["difficulty"];
  priority: Quest["priority"];
  estimatedMinutes: number;
  actingFit: ActingFit;
  attributeIds: string[];
  tags: string[];
  safetyNotes: string[];
  sourceChoiceId: string | null;
}

export interface AdventureEvent {
  id: string;
  threadId?: string;
  currentTurnId?: string;
  localDate: string;
  kind: "daily" | "manual";
  status: "draft" | "presented" | "resolved";
  chapter: string;
  title: string;
  opening: string;
  systemMessages: string[];
  sceneMood: string;
  choices: NarrativeChoice[];
  proposals: TaskProposal[];
  chosenChoiceId: string | null;
  imageAssetId: string | null;
  provider: "local" | "openai-responses" | "openai-compatible";
  model: string;
  fateProfileId?: string | null;
  backgroundId?: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface StoryFlag {
  id: string;
  threadId?: string;
  key: string;
  value: number;
  label: string;
  description: string;
  updatedAt: string;
}

export type RelationshipAttitude = "敌对" | "警惕" | "中立" | "友好" | "信任";

export interface StoryActor {
  id: string;
  threadId?: string;
  name: string;
  role: string;
  relationship: number;
  faction?: string;
  attitude?: RelationshipAttitude;
  tags?: string[];
  lastInteractionAt?: string;
  notes: string;
  updatedAt: string;
}

export interface SceneAsset {
  id: string;
  eventId: string;
  mimeType: string;
  dataUrl: string;
  promptHash: string;
  createdAt: string;
}

export interface AIRequestLog {
  id: string;
  provider: string;
  protocol: string;
  model: string;
  endpoint: string;
  contextHash: string;
  contextPreview: string;
  status: "success" | "fallback" | "error";
  error: string;
  /** 本地估算，不代表供应商标单。 */
  promptChars?: number;
  outputChars?: number;
  elapsedMs?: number;
  createdAt: string;
}

export type StoryInputMode = "auto" | "action" | "dialogue" | "observe" | "thought";

export interface StoryThread {
  id: string;
  eventId: string;
  title: string;
  parentCheckpointId: string | null;
  currentTurnId: string | null;
  providerResponseId: string | null;
  provider: string;
  model: string;
  status: "active" | "paused" | "completed" | "archived";
  canonDivergent: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StoryTurn {
  id: string;
  threadId: string;
  parentTurnId: string | null;
  inputMode: StoryInputMode;
  userInput: string;
  chapterTitle?: string;
  chapterText: string;
  operations: TurnOperation[];
  suggestedChoices: Array<{ id: string; label: string; description: string }>;
  providerResponseId: string | null;
  provider: string;
  model: string;
  status: "streaming" | "complete" | "failed" | "undone";
  createdAt: string;
}

export interface StoryCheckpoint {
  id: string;
  threadId: string;
  turnId: string | null;
  label: string;
  automatic: boolean;
  worldState: WorldState;
  flags: StoryFlag[];
  actors: StoryActor[];
  items: StoryItem[];
  summary: string;
  providerResponseId: string | null;
  createdAt: string;
}

export interface WorldState {
  id: string;
  threadId: string;
  chapter: number;
  timeLabel: string;
  location: string;
  knownFacts: string[];
  openThreads: Array<{ id: string; title: string; description: string; status: "open" | "resolved" }>;
  canonDivergence: string[];
  threatLevel: number;
  protagonistState: "alive" | "injured" | "missing" | "dead" | "resurrected";
  summary: string;
  updatedAt: string;
}

export interface StoryItem {
  id: string;
  threadId: string;
  name: string;
  description: string;
  rarity: "common" | "rare" | "unique";
  status: "held" | "lost" | "consumed";
  equipped?: boolean;
  category?: InventoryCategory;
  updatedAt: string;
}

export interface StorySummary {
  id: string;
  threadId: string;
  throughTurnId: string;
  text: string;
  createdAt: string;
}

export type TurnOperation =
  | { type: "set_location"; location: string }
  | { type: "advance_time"; value: string }
  | { type: "adjust_flag"; key: string; label: string; delta: number; description?: string }
  | { type: "add_fact"; fact: string }
  | { type: "open_thread"; title: string; description: string }
  | { type: "resolve_thread"; title: string }
  | { type: "upsert_actor"; name: string; role: string; relationshipDelta: number; notes: string; faction?: string; attitude?: RelationshipAttitude; tags?: string[] }
  | { type: "add_item"; name: string; description: string; rarity: "common" | "rare" | "unique" }
  | { type: "remove_item"; name: string }
  | { type: "canon_divergence"; description: string }
  | { type: "set_protagonist_state"; state: WorldState["protagonistState"]; description: string }
  | { type: "add_task_proposal"; proposal: TaskProposal };



// ---------------------------------------------------------------------------
// 命运转盘（Fate Wheel）
// ---------------------------------------------------------------------------

export type WheelPool = "default" | "transmigrator" | "oldOne" | "special";

export type WheelSourceKind = "video-preset" | "canon-tarot" | "canon-reference" | "canon-figure" | "canon-item" | "authored";

export interface WheelCitation {
  chapter: string;
  line: number;
  quote: string;
}

export interface WheelCategory {
  id: string;
  label: string;
  description: string;
  order: number;
  builtIn: boolean;
  gate: boolean;
  /** Only these categories may carry reality-task affinity. */
  taskAffinityAllowed: boolean;
  sourceKind: WheelSourceKind;
  sourceNote: string;
  createdAt: string;
  updatedAt: string;
}

export interface WheelOption {
  id: string;
  categoryId: string;
  label: string;
  description: string;
  order: number;
  enabled: boolean;
  pool: WheelPool;
  /** Pools unlocked in other categories when this option is drawn. */
  unlocks: Exclude<WheelPool, "default">[];
  taskAffinity: boolean;
  /** 层级约束：小地点绑定大地点，代号绑定阵营。 */
  parentId?: string;
  /** 纪元约束：大地点只在指定纪元出现。 */
  eraIds?: string[];
  /** 非原作内容（AI 按风格补写），界面需标注。 */
  nonCanon?: boolean;
  /** 抽取权重（默认 1，用于「第五纪优先」这类规则）。 */
  weight?: number;
  sourceKind: WheelSourceKind;
  sourceNote: string;
  citations: WheelCitation[];
  builtIn: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FateAttribute {
  categoryId: string;
  categoryLabel: string;
  optionId: string;
  optionLabel: string;
  optionDescription: string;
  pool: WheelPool;
  /** Special pools this attribute opens for other categories. */
  unlocks: Array<Exclude<WheelPool, "default">>;
  taskAffinity: boolean;
  sourceKind: WheelSourceKind;
  sourceNote: string;
}

export interface FateProfile {
  id: string;
  /** 用户可选的命运档案名称。 */
  name?: string;
  status: "active" | "superseded";
  attributes: FateAttribute[];
  unlockedPools: Exclude<WheelPool, "default">[];
  seed: string;
  note: string;
  spunAt: string;
  supersededAt: string | null;
}

export interface WheelSpin {
  id: string;
  fateProfileId: string | null;
  categoryId: string;
  categoryLabel: string;
  optionId: string;
  optionLabel: string;
  pool: WheelPool;
  poolSnapshot: string[];
  poolSize: number;
  rngBytes: string;
  isRespin: boolean;
  respinIndex: number;
  createdAt: string;
}



// ---------------------------------------------------------------------------
// 人物档案（Character Background）——命运转盘产出的人物背景
// ---------------------------------------------------------------------------

export interface BackgroundFields {
  name: string;
  age: string;
  occupation: string;
  origin: string;
  appearance: string;
  personality: string;
  motive: string;
  secret: string;
  keepsake: string;
  weakness: string;
}

export interface CharacterBackground {
  id: string;
  status: "active" | "superseded";
  fields: BackgroundFields;
  backgroundText: string;
  fateProfileId: string | null;
  seed: string;
  provider: string;
  model: string;
  createdAt: string;
  supersededAt: string | null;
}



// ---------------------------------------------------------------------------
// 技能（Skill）
// ---------------------------------------------------------------------------

export type SkillStatus = "canon" | "undisclosed" | "manual" | "author";
export type SkillLevel = "入门" | "熟练" | "精通" | "大师";

export interface Skill {
  id: string;
  pathwayId: string | null;
  sequence: number | null;
  name: string;
  status: SkillStatus;
  /** 作者（乌贼）发布的补充设定原文，优先级最高。 */
  authorText: string;
  evidenceText: string;
  citations: WheelCitation[];
  proficiency: number;
  peakProficiency: number;
  level: SkillLevel;
  manual: boolean;
  unlockedAt: string;
  lastTrainedAt: string;
  /** Anchor for lazy, idempotent decay settlement (advances only by whole decay periods). */
  decaySettledAt: string;
  updatedAt: string;
}

export interface SkillEvent {
  id: string;
  skillId: string;
  kind: "grant" | "train" | "decay" | "manual";
  amount: number;
  reason: string;
  sourceId: string | null;
  createdAt: string;
  reversesEventId: string | null;
}



// ---------------------------------------------------------------------------
// 魔药配方（作者补充设定）
// ---------------------------------------------------------------------------

export interface Formula {
  id: string;
  pathwayId: string;
  sequence: number;
  sequenceName: string;
  main: string;
  auxiliary: string;
  potionLook: string;
  traitLook: string;
  mythicForm: string;
  sourceKind: "author";
}



