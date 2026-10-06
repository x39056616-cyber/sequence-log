# SEQUENCE · 序列日志部署说明

这是一个清理过的 GitHub/部署目录，不包含 `.env.local`、`.sequence-ai.json`、API Key、日志和临时探针。

## 本地运行

```powershell
pnpm install --frozen-lockfile
pnpm build
pnpm exec next start -H 0.0.0.0 -p 3000
```

浏览器打开 `http://127.0.0.1:3000`。

## 分享给异地用户（Cloudflare Tunnel）

先安装 Cloudflare 官方 `cloudflared`：  
https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/

然后在服务器已启动的前提下执行：

```powershell
cloudflared tunnel --url http://127.0.0.1:3000 --no-autoupdate
```

终端会输出一个 `https://*.trycloudflare.com` 地址。把这个地址发给别人即可。  
这个模式要求本机持续开机；临时隧道地址不可长期固定。

长期使用可登录并创建命名隧道：

```powershell
cloudflared tunnel login
cloudflared tunnel create sequence-log
cloudflared tunnel route dns sequence-log sequence.example.com
cloudflared tunnel run sequence-log
```

## GitHub

1. 在 GitHub 创建空仓库 `sequence-log`。
2. 在本目录执行：

```powershell
git init
git add .
git commit -m "feat: SEQUENCE sequence-log"
git branch -M main
git remote add origin https://github.com/<你的用户名>/sequence-log.git
git push -u origin main
```

3. 如使用 Cloudflare Pages，请先确认 `@cloudflare/next-on-pages` 能处理 `public/lore/novel-index.json` 的 Node `fs` 读取；当前项目默认更适合 Cloudflare Tunnel 或 Node 容器部署。

## 公开分享保护

服务端可设置：

```env
SHARE_ACCESS_CODE=你的分享口令
AI_DAILY_LIMIT=30
```

访客在「幕后控制台 → AI 接口与模型强度」填写分享口令。AI Key 仍由每位访客自带，服务端不保存访客密钥。