import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { guardAIRequest, resetAIAccessUsageForTests } from "@/lib/ai/access-guard";
import { clientAIConfigHeader, loadShareCode, saveShareCode } from "@/lib/ai/client-config";

const OLD_CODE = process.env.SHARE_ACCESS_CODE;
const OLD_LIMIT = process.env.AI_DAILY_LIMIT;

function request(headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/adventure/turn", { headers });
}

beforeEach(() => {
  resetAIAccessUsageForTests();
  delete process.env.SHARE_ACCESS_CODE;
  delete process.env.AI_DAILY_LIMIT;
  window.localStorage.clear();
});

afterEach(() => {
  if (OLD_CODE === undefined) delete process.env.SHARE_ACCESS_CODE; else process.env.SHARE_ACCESS_CODE = OLD_CODE;
  if (OLD_LIMIT === undefined) delete process.env.AI_DAILY_LIMIT; else process.env.AI_DAILY_LIMIT = OLD_LIMIT;
  window.localStorage.clear();
});

describe("shared AI access guard", () => {
  it("allows private local use when no shared code is configured", () => {
    expect(guardAIRequest(request())).toBeNull();
  });

  it("requires the configured share code", () => {
    process.env.SHARE_ACCESS_CODE = "grey-fog";
    expect(guardAIRequest(request())?.status).toBe(401);
    expect(guardAIRequest(request({ "x-share-code": "wrong" }))?.status).toBe(401);
    expect(guardAIRequest(request({ "x-share-code": "grey-fog" }))).toBeNull();
  });

  it("enforces an in-memory daily cap without identity storage", () => {
    process.env.AI_DAILY_LIMIT = "1";
    expect(guardAIRequest(request({ "x-forwarded-for": "10.0.0.1", "user-agent": "test-agent" }))).toBeNull();
    expect(guardAIRequest(request({ "x-forwarded-for": "10.0.0.1", "user-agent": "test-agent" }))?.status).toBe(429);
  });

  it("sends the share code from the visitor browser without persisting it in AI config", () => {
    saveShareCode("grey-fog");
    expect(loadShareCode()).toBe("grey-fog");
    expect(clientAIConfigHeader()["x-share-code"]).toBe("grey-fog");
  });
});