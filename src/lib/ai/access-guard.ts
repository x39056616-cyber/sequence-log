import { NextResponse } from "next/server";

interface UsageState {
  day: string;
  count: number;
}

const GLOBAL = globalThis as typeof globalThis & { __sequenceAIUsage?: Map<string, UsageState> };

function usageStore() {
  if (!GLOBAL.__sequenceAIUsage) GLOBAL.__sequenceAIUsage = new Map();
  return GLOBAL.__sequenceAIUsage;
}

function utcDay() {
  return new Date().toISOString().slice(0, 10);
}

function clientKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || request.headers.get("x-real-ip") || "local";
  const agent = request.headers.get("user-agent") || "unknown";
  return ip + "|" + agent;
}

/**
 * Optional shared-deployment guard.
 * - SHARE_ACCESS_CODE: require x-share-code on every AI request.
 * - AI_DAILY_LIMIT: per-day, per-client request cap kept in server memory only.
 *
 * The guard never logs or persists the access code, IP, or user agent.
 */
export function guardAIRequest(request: Request): Response | null {
  const requiredCode = process.env.SHARE_ACCESS_CODE?.trim();
  if (requiredCode && request.headers.get("x-share-code") !== requiredCode) {
    return NextResponse.json({ error: "此站点需要访问口令：请在设置里填写分享口令。" }, { status: 401 });
  }

  const limit = Number(process.env.AI_DAILY_LIMIT || 0);
  if (Number.isFinite(limit) && limit > 0) {
    const day = utcDay();
    const key = clientKey(request);
    const store = usageStore();
    const state = store.get(key);
    const count = state?.day === day ? state.count : 0;
    if (count >= limit) {
      return NextResponse.json({ error: `已达到今日 AI 请求上限（${limit} 次）。请明天再试或使用本地功能。` }, { status: 429 });
    }
    store.set(key, { day, count: count + 1 });
  }

  return null;
}

/** Test-only reset; the map is process memory and never persisted. */
export function resetAIAccessUsageForTests() {
  usageStore().clear();
}