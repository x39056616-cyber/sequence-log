# Cloudflare Pages 部署（参考视频做法）

视频作者的做法是：GitHub 仓库连接 Cloudflare，之后本地推送 GitHub，Cloudflare 自动构建和更新网站。

## 在 Cloudflare 控制台操作

1. 登录 Cloudflare。
2. 进入 `Workers & Pages`。
3. 点击 `Create` → `Pages` → `Connect to Git`。
4. 选择 GitHub 仓库：

```text
x39056616-cyber/sequence-log
```

5. 构建配置填写：

```text
Framework preset: Next.js
Build command: pnpm build && npx @cloudflare/next-on-pages@1
Build output directory: .vercel/output/static
```

6. 环境变量添加：

```text
NODE_VERSION=22
```

7. 点击 `Save and Deploy`。

部署完成后 Cloudflare 会给你一个固定地址，类似：

```text
https://sequence-log.pages.dev
```

以后你只需要把修改推送到 GitHub，Cloudflare 会在几分钟内自动重新部署。

## 当前项目注意

本项目包含 Next.js 服务端 API、IndexedDB 本地数据和较大的原著检索索引。Cloudflare Pages 构建如果因为 `node:fs` 或索引体积失败，有两种处理：

1. 保留当前 Cloudflare Tunnel 版本；
2. 改为把原文检索改成静态资源/D1 查询后再完整迁移。

先按上面的步骤连接 GitHub，观察 Cloudflare 构建日志；如果失败，把日志发给我，我继续修。

## 本地命令

```powershell
pnpm install --frozen-lockfile
pnpm build
npx @cloudflare/next-on-pages@1
```