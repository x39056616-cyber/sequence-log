# Zeabur / Render / Railway / Fly.io / VPS 通用部署镜像
FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable

# 依赖层（利用缓存）
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# 构建层
COPY . .
RUN pnpm build

ENV NODE_ENV=production
EXPOSE 3000

# 端口：优先使用平台注入的 $PORT（Zeabur 会自动注入），否则退回 3000
# 不需要任何环境变量：AI 密钥由每位访客在自己的浏览器里填写
CMD ["sh", "-c", "pnpm exec next start -H 0.0.0.0 -p ${PORT:-3000}"]