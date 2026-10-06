export type AIProtocol = "chat-completions" | "responses";
export type AIModelTier = "fast" | "balanced" | "deep";
export type AIProviderId = "deepseek" | "qwen" | "openai" | "compatible";

export interface AIModelOption {
  id: string;
  label: string;
  tier: AIModelTier;
  description: string;
}

export interface AIProviderPreset {
  id: AIProviderId;
  label: string;
  summary: string;
  protocol: AIProtocol;
  baseUrl: string;
  docsUrl: string;
  keyHint: string;
  models: AIModelOption[];
  extraBody?: Record<string, unknown>;
}

/**
 * Provider/Model tiers are an explicit whitelist. The server resolves the
 * base URL from this table, so a tampered client can never point requests at
 * an arbitrary host (no SSRF) and can never learn the stored API key.
 *
 * DeepSeek V4 Flash / Pro and Qwen 3.8 tiers are defined here; model ids can be
 * adjusted in one place when the upstream providers publish final names.
 */
export const AI_PROVIDER_PRESETS: AIProviderPreset[] = [
  {
    id: "deepseek",
    label: "DeepSeek",
    summary: "中文长文本与推理性价比高，适合长章节叙事。",
    protocol: "chat-completions",
    baseUrl: "https://api.deepseek.com/v1",
    docsUrl: "https://platform.deepseek.com",
    keyHint: "sk-...",
    models: [
      { id: "deepseek-chat", label: "DeepSeek V3 · 均衡", tier: "balanced", description: "通用对话与长文叙事，成本适中。" },
      { id: "deepseek-reasoner", label: "DeepSeek R1 · 深度推理", tier: "deep", description: "推理更强，单次耗时更长。" },
      { id: "deepseek-v4-flash", label: "DeepSeek V4 Flash · 快速", tier: "fast", description: "低延迟，适合大量回合推进。" },
      { id: "deepseek-v4-pro", label: "DeepSeek V4 Pro · 旗舰", tier: "deep", description: "最高质量，适合关键剧情。" },
    ],
  },
  {
    id: "qwen",
    label: "通义千问 Qwen",
    summary: "阿里云兼容模式接口，中文语感好，可选思考模式。",
    protocol: "chat-completions",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    docsUrl: "https://help.aliyun.com/zh/model-studio",
    keyHint: "sk-...",
    models: [
      { id: "qwen-plus", label: "Qwen Plus · 均衡", tier: "balanced", description: "通用能力均衡。" },
      { id: "qwen-turbo", label: "Qwen Turbo · 快速", tier: "fast", description: "响应快、成本低。" },
      { id: "qwen3.8", label: "Qwen 3.8 · 深度思考", tier: "deep", description: "开启思考模式，适合复杂剧情裁定。" },
    ],
  },
  {
    id: "openai",
    label: "OpenAI",
    summary: "Responses API，结构化输出最稳定。",
    protocol: "responses",
    baseUrl: "https://api.openai.com/v1",
    docsUrl: "https://platform.openai.com/docs",
    keyHint: "sk-...",
    models: [
      { id: "gpt-5-mini", label: "GPT-5 mini · 均衡", tier: "balanced", description: "质量与成本平衡。" },
      { id: "gpt-5", label: "GPT-5 · 深度", tier: "deep", description: "最强叙事与裁定质量。" },
      { id: "gpt-4.1-mini", label: "GPT-4.1 mini · 快速", tier: "fast", description: "低延迟。" },
    ],
  },
  {
    id: "compatible",
    label: "自定义兼容网关",
    summary: "任何兼容 OpenAI Chat Completions 的网关（OneAPI、vLLM、Ollama 等）。",
    protocol: "chat-completions",
    baseUrl: "http://127.0.0.1:3001/v1",
    docsUrl: "",
    keyHint: "本地网关可留空",
    models: [
      { id: "local-model", label: "自定义模型名", tier: "balanced", description: "在下方“自定义模型名”中填写实际模型 ID。" },
    ],
  },
];

export function getProviderPreset(id: string): AIProviderPreset | undefined {
  return AI_PROVIDER_PRESETS.find((preset) => preset.id === id);
}

export function findModelOption(providerId: string, modelId: string): AIModelOption | undefined {
  return getProviderPreset(providerId)?.models.find((model) => model.id === modelId);
}

export interface AIConfigInput {
  provider: AIProviderId;
  apiKey: string;
  model: string;
  narrativeModel: string;
  adjudicatorModel: string;
  imageModel: string;
  customBaseUrl: string;
  customModel: string;
  useThinking: boolean;
}

export function defaultAIConfig(): AIConfigInput {
  return {
    provider: "deepseek",
    apiKey: "",
    model: "deepseek-chat",
    narrativeModel: "deepseek-chat",
    adjudicatorModel: "deepseek-chat",
    imageModel: "",
    customBaseUrl: "",
    customModel: "",
    useThinking: false,
  };
}

export interface ResolvedAIConfig {
  configured: boolean;
  provider: AIProviderId;
  providerLabel: string;
  protocol: AIProtocol;
  baseUrl: string;
  apiKey: string;
  model: string;
  narrativeModel: string;
  adjudicatorModel: string;
  imageModel: string;
  useThinking: boolean;
  source: "runtime" | "env" | "none";
}

export function resolveAIConfig(config: AIConfigInput): ResolvedAIConfig {
  const preset = getProviderPreset(config.provider) ?? AI_PROVIDER_PRESETS[0];
  const baseUrl = config.provider === "compatible" && config.customBaseUrl
    ? config.customBaseUrl.trim()
    : preset.baseUrl;
  const model = config.provider === "compatible" && config.customModel
    ? config.customModel.trim()
    : (config.model || preset.models[0]?.id || "");
  const narrativeModel = config.provider === "compatible" && config.customModel
    ? config.customModel.trim()
    : (config.narrativeModel || model);
  const adjudicatorModel = config.provider === "compatible" && config.customModel
    ? config.customModel.trim()
    : (config.adjudicatorModel || model);
  return {
    configured: Boolean(config.apiKey) || config.provider === "compatible",
    provider: preset.id,
    providerLabel: preset.label,
    protocol: preset.protocol,
    baseUrl,
    apiKey: config.apiKey,
    model,
    narrativeModel,
    adjudicatorModel,
    imageModel: config.imageModel,
    useThinking: config.useThinking,
    source: config.apiKey ? "runtime" : "none",
  };
}
