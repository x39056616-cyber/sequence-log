import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 自包含打包：产出 .next-build/standalone，可直接拷给别人运行
  output: "standalone",
  distDir: ".next-build",
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

