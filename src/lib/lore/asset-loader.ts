import { getCloudflareContext } from "@opennextjs/cloudflare";

type AssetFetcher = {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
};

type CloudflareEnv = {
  ASSETS?: AssetFetcher;
};

/**
 * 读取 public 下的静态资料。
 *
 * Cloudflare Workers 没有本地文件系统，因此优先走 OpenNext 注入的 ASSETS 绑定。
 * 本地 Next.js / 测试环境无法拿到 Cloudflare 绑定时，再回退到相对于当前请求的同源 fetch。
 * 两条路径都不再把 13MB 原作文本打进 Worker 脚本。
 */
export async function fetchPublicAsset(pathname: string, request?: Request): Promise<Response | null> {
  const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;

  try {
    const context = await getCloudflareContext({ async: true });
    const env = context.env as CloudflareEnv;
    if (env.ASSETS) {
      const assetUrl = new Request(new URL(normalized, "https://sequence-log.internal"));
      const response = await env.ASSETS.fetch(assetUrl);
      if (response.ok) return response;
    }
  } catch {
    // 本地 Next.js、Vitest 或非 Cloudflare 运行时没有 ASSETS 绑定，继续回退。
  }

  if (request) {
    try {
      const response = await fetch(new URL(normalized, request.url), {
        headers: { accept: "application/json" },
      });
      if (response.ok) return response;
    } catch {
      // 静态资源不可用时由调用方决定是否降级。
    }
  }

  return null;
}
