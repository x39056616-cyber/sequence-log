import { defaultAIConfig, getProviderPreset, type AIConfigInput, type AIProviderId } from "@/lib/ai/config";

const STORAGE_KEY = "sequence-ai-config-v1";
const SHARE_CODE_KEY = "sequence-share-code-v1";

/**
 * 每个访客自己的 AI 配置，只保存在他自己的浏览器里。
 * 共享部署时不使用站长（部署者）的密钥，避免所有人都消耗同一个额度。
 */
export function loadClientAIConfig(): AIConfigInput {
  if (typeof window === "undefined") return defaultAIConfig();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultAIConfig();
    const parsed = JSON.parse(raw) as Partial<AIConfigInput>;
    const provider = (parsed.provider && getProviderPreset(parsed.provider) ? parsed.provider : "deepseek") as AIProviderId;
    return { ...defaultAIConfig(), ...parsed, provider };
  } catch {
    return defaultAIConfig();
  }
}

export function loadShareCode() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(SHARE_CODE_KEY)?.trim() ?? "";
}

export function saveShareCode(code: string) {
  if (typeof window === "undefined") return;
  const value = code.trim();
  if (value) window.localStorage.setItem(SHARE_CODE_KEY, value);
  else window.localStorage.removeItem(SHARE_CODE_KEY);
}

export function saveClientAIConfig(config: AIConfigInput) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function clearClientAIConfig() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

/** 把访客配置随请求发给服务端；服务端只做转发，不落盘、不记日志。 */
export function clientAIConfigHeader(): Record<string, string> {
  const config = loadClientAIConfig();
  const headers: Record<string, string> = {};
  const shareCode = loadShareCode();
  if (shareCode) headers["x-share-code"] = shareCode;
  if (!config.apiKey && config.provider !== "compatible") return headers;
  try {
    const payload = JSON.stringify(config);
    const encoded = typeof window === "undefined"
      ? Buffer.from(payload, "utf8").toString("base64")
      : window.btoa(unescape(encodeURIComponent(payload)));
    headers["x-sequence-ai"] = encoded;
    return headers;
  } catch {
    return headers;
  }
}
