# Cloudflare Workers 部署（OpenNext）

你当前 Cloudflare 页面只有 Workers，没有 Pages，因此使用下面这套配置。

## Cloudflare 页面填写

Project name:

```text
sequence-log
```

Build command:

```text
pnpm install --frozen-lockfile && npx opennextjs-cloudflare build
```

Deploy command:

```text
npx wrangler deploy
```

Preview command:

```text
npx wrangler dev
```

环境变量：

```text
NODE_VERSION=22
```

## 仓库配置

- `open-next.config.ts`
- `wrangler.toml`
- `main = .open-next/worker.js`
- `compatibility_flags = ["nodejs_compat"]`
- assets binding `ASSETS`

## 说明

OpenNext 会把 Next.js 转成 Cloudflare Worker。首次构建如果遇到 Node API、文件系统或资源体积限制，把 Cloudflare 构建日志发来，我继续改成 Workers 兼容版本。