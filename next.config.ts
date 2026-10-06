import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // OpenNext/Cloudflare 需要标准 .next/standalone 目录；本地仍可用 NEXT_DIST_DIR 覆盖。
  output: "standalone",
  distDir: process.env.NEXT_DIST_DIR || ".next",
  typescript: { ignoreBuildErrors: true },
  experimental: { cpus: 1, workerThreads: true },
  async headers() {
    return [
      {
        source: "/",
        headers: [{ key: "Cache-Control", value: "no-store, must-revalidate" }],
      },
      {
        source: "/:path*",
        has: [{ type: "header", key: "sec-fetch-dest", value: "document" }],
        headers: [{ key: "Cache-Control", value: "no-store, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
