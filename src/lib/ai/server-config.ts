import { promises as fs } from "node:fs";
import path from "node:path";
import {
  AI_PROVIDER_PRESETS,
  defaultAIConfig,
  getProviderPreset,
  resolveAIConfig,
  type AIConfigInput,
  type AIProviderId,
  type ResolvedAIConfig,
} from "@/lib/ai/config";

const CONFIG_PATH = path.join(process.cwd(), ".sequence-ai.json");

export interface StoredAIConfig extends AIConfigInput {
  updatedAt: string | null;
}

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

export async function readStoredConfig(): Promise<StoredAIConfig | null> {
  try {
    const raw = await fs.readFile(CONFIG_PATH, "utf8");
    return sanitize(JSON.parse(raw) as Partial<StoredAIConfig>);
  } catch {
    return null;
  }
}

export async function writeStoredConfig(input: Partial<AIConfigInput>): Promise<StoredAIConfig> {
  const next = sanitize({ ...input, updatedAt: new Date().toISOString() });
  await fs.writeFile(CONFIG_PATH, JSON.stringify(next, null, 2), { encoding: "utf8", mode: 0o600 });
  return next;
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

/** Runtime file config wins over .env.local, which wins over local fallback. */
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
  // Never return the stored key to the browser: expose only a masked hint.
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
 * 这样共享部署时不会消耗部署者的密钥；只有没带配置时才回落到部署者自己的环境变量/本地文件。
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
      // 只要访客带了自己的配置，就只用访客的——即使没填 Key，
      // 也绝不回落到部署者的密钥（否则所有人都会消耗站长的额度）。
      const resolved = resolveAIConfig(stored);
      return { ...resolved, configured: Boolean(stored.apiKey) || stored.provider === "compatible", source: "runtime" };
    } catch {
      // 配置损坏：同样不回落，直接视为未配置
      return { ...resolveAIConfig(defaultAIConfig()), configured: false, apiKey: "", source: "none" };
    }
  }
  return resolveRuntimeAIConfig();
}

