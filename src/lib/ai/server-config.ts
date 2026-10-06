import {
  AI_PROVIDER_PRESETS,
  defaultAIConfig,
  getProviderPreset,
  resolveAIConfig,
  type AIConfigInput,
  type AIProviderId,
  type ResolvedAIConfig,
} from "@/lib/ai/config";

export interface StoredAIConfig extends AIConfigInput {
  updatedAt: string | null;
}

type RuntimeStore = { value: StoredAIConfig | null };

const globalStore = globalThis as typeof globalThis & { __sequenceAIConfig?: RuntimeStore };
const memoryStore: RuntimeStore = globalStore.__sequenceAIConfig ?? { value: null };
globalStore.__sequenceAIConfig = memoryStore;

function sanitize(input: Partial<StoredAIConfig> | null | undefined): StoredAIConfig {
  const base = defaultAIConfig();
  const provider = (input?.provider && getProviderPreset(input.provider) ? input.provider : base.provider) as AIProviderId;
  const str = (value: unknown, fallback: string) => (typeof value === "string" ? value : fallback);
  return {
    provider,
    apiKey: str(input?.apiKey, base.apiKey),
    model: str(input?.model, base.model),
    narrativeModel: str(input?.narrativeModel, base.narrativeModel),
    adjudicatorModel: str(input?.adjudicatorModel, base.adjudicatorModel),
    imageModel: str(input?.imageModel, base.imageModel),
    customBaseUrl: str(input?.customBaseUrl, base.customBaseUrl),
    customModel: str(input?.customModel, base.customModel),
    useThinking: Boolean(input?.useThinking),
    updatedAt: typeof (input as { updatedAt?: unknown } | undefined)?.updatedAt === "string"
      ? (input as { updatedAt: string }).updatedAt
      : null,
  };
}

/**
 * 共享部署采用 BYOK：API Key 只保存在访客浏览器，并通过请求头随单次请求发送。
 * 服务端只保留 isolate 内内存副本，绝不再写服务器文件，也不会把 Key 作为公开配置返回。
 */
export async function readStoredConfig(): Promise<StoredAIConfig | null> {
  return memoryStore.value;
}

export async function writeStoredConfig(input: Partial<AIConfigInput>): Promise<StoredAIConfig> {
  const next = sanitize({ ...input, updatedAt: new Date().toISOString() });
  memoryStore.value = next;
  return next;
}

export function clearStoredConfig() {
  memoryStore.value = null;
}

function envConfig(): StoredAIConfig | null {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) return null;
  const baseUrl = process.env.AI_BASE_URL || "https://api.openai.com/v1";
  const preset = AI_PROVIDER_PRESETS.find((item) => item.baseUrl === baseUrl)
    ?? (process.env.AI_PROVIDER ? getProviderPreset(process.env.AI_PROVIDER) : undefined)
    ?? AI_PROVIDER_PRESETS[0];
  const model = process.env.AI_MODEL || preset.models[0]?.id || "";
  return sanitize({
    provider: preset.id,
    apiKey,
    model,
    narrativeModel: process.env.AI_NARRATIVE_MODEL || model,
    adjudicatorModel: process.env.AI_ADJUDICATOR_MODEL || model,
    imageModel: process.env.AI_IMAGE_MODEL || "",
    customBaseUrl: preset.id === "compatible" ? baseUrl : "",
    customModel: preset.id === "compatible" ? model : "",
    useThinking: false,
    updatedAt: null,
  });
}

/** Runtime memory config wins over .env, which wins over local fallback. */
export async function resolveRuntimeAIConfig(): Promise<ResolvedAIConfig> {
  const stored = await readStoredConfig();
  if (stored && (stored.apiKey || stored.provider === "compatible")) {
    return { ...resolveAIConfig(stored), source: "runtime" };
  }
  const env = envConfig();
  if (env) return { ...resolveAIConfig(env), source: "env" };
  return {
    configured: false,
    provider: stored?.provider ?? "deepseek",
    providerLabel: getProviderPreset(stored?.provider ?? "deepseek")?.label ?? "DeepSeek",
    protocol: getProviderPreset(stored?.provider ?? "deepseek")?.protocol ?? "chat-completions",
    baseUrl: getProviderPreset(stored?.provider ?? "deepseek")?.baseUrl ?? "https://api.deepseek.com/v1",
    apiKey: "",
    model: stored?.model ?? "deepseek-chat",
    narrativeModel: stored?.narrativeModel ?? "deepseek-chat",
    adjudicatorModel: stored?.adjudicatorModel ?? "deepseek-chat",
    imageModel: stored?.imageModel ?? "",
    useThinking: stored?.useThinking ?? false,
    source: "none",
  };
}

/** Public shape: never includes the API key. */
export async function publicAIConfig() {
  const stored = await readStoredConfig();
  const resolved = await resolveRuntimeAIConfig();
  const safeSelection = {
    provider: stored?.provider ?? resolved.provider,
    model: stored?.model ?? resolved.model,
    narrativeModel: stored?.narrativeModel ?? resolved.narrativeModel,
    adjudicatorModel: stored?.adjudicatorModel ?? resolved.adjudicatorModel,
    imageModel: stored?.imageModel ?? resolved.imageModel,
    customBaseUrl: stored?.customBaseUrl ?? "",
    customModel: stored?.customModel ?? "",
    useThinking: stored?.useThinking ?? resolved.useThinking,
    updatedAt: stored?.updatedAt ?? null,
  };
  return {
    providers: AI_PROVIDER_PRESETS,
    selection: safeSelection,
    status: {
      configured: resolved.configured,
      provider: resolved.provider,
      providerLabel: resolved.providerLabel,
      protocol: resolved.protocol,
      baseUrl: resolved.baseUrl,
      model: resolved.model,
      narrativeModel: resolved.narrativeModel,
      adjudicatorModel: resolved.adjudicatorModel,
      imageModel: resolved.imageModel,
      useThinking: resolved.useThinking,
      source: resolved.source,
    },
    hasApiKey: Boolean(resolved.apiKey),
    keyMasked: resolved.apiKey ? resolved.apiKey.slice(0, 5) + "…" + resolved.apiKey.slice(-4) : "",
  };
}

/**
 * 优先使用「访客自带」的配置（请求头 x-sequence-ai，base64 JSON）。
 * 这样共享部署时不会消耗部署者的密钥；只有没带配置时才回落到部署者自己的环境变量。
 * baseUrl 仍然来自服务端白名单预设，访客无法把请求指向任意地址（防 SSRF）。
 */
export async function resolveRequestAIConfig(request: Request): Promise<ResolvedAIConfig> {
  const header = request.headers.get("x-sequence-ai");
  if (header) {
    try {
      const json = typeof atob === "function"
        ? decodeURIComponent(escape(atob(header)))
        : Buffer.from(header, "base64").toString("utf8");
      const parsed = JSON.parse(json) as Partial<AIConfigInput>;
      const stored = sanitize(parsed);
      const resolved = resolveAIConfig(stored);
      return { ...resolved, configured: Boolean(stored.apiKey) || stored.provider === "compatible", source: "runtime" };
    } catch {
      return { ...resolveAIConfig(defaultAIConfig()), configured: false, apiKey: "", source: "none" };
    }
  }
  return resolveRuntimeAIConfig();
}
