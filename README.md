# PT-Gen Universal

[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2FYunFeng86%2Fpt-gen-universal.svg?type=shield&issueType=license)](https://app.fossa.com/projects/git%2Bgithub.com%2FYunFeng86%2Fpt-gen-universal?ref=badge_shield&issueType=license)

基于 [Rhilip/pt-gen-cfworker](https://github.com/Rhilip/pt-gen-cfworker) 改写，使用 [Hono](https://hono.dev/) 重构为多平台部署版本。

这一版以 `pnpm` 为主，采用 “Edge-first 核心 + 平台薄适配层”：

- Edge 平台：Cloudflare Workers、Vercel Edge、Netlify Edge、EdgeOne Edge Functions
- Node fallback 平台：Railway、Zeabur
- 本地开发：Node.js 为主，Bun 保留兼容入口但不再作为主分发路径

## 平台矩阵

| 平台 | 运行时 | 默认缓存后端 | 状态 |
| --- | --- | --- | --- |
| Cloudflare Workers | Edge | Cloudflare KV | 推荐主平台 |
| Vercel | Edge Runtime | Upstash / Marketplace Redis | 支持 |
| Netlify | Edge Functions | Netlify Blobs | 支持 |
| EdgeOne | Edge Functions | Pages KV | 支持 |
| Railway | Node.js Service | Redis | Node fallback |
| Zeabur | Node.js Service | Redis | Node fallback |

> 注意：Vercel 官方在 2025-12-08 更新的 Edge Runtime 文档中已经更推荐 Node.js runtime。本项目仍提供 Vercel Edge 入口，但 Cloudflare 仍然是首推平台。

## 一键部署

### 立即可用

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/YunFeng86/pt-gen-universal)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FYunFeng86%2Fpt-gen-universal&env=APIKEY,TMDB_API_KEY,UPSTASH_REDIS_REST_URL,UPSTASH_REDIS_REST_TOKEN,DOUBAN_COOKIE,INDIENOVA_COOKIE&envDescription=PT-Gen%20%E8%BF%90%E8%A1%8C%E6%89%80%E9%9C%80%E7%9A%84%20API%20%E5%AF%86%E9%92%A5%E3%80%81Redis%20REST%20%E5%8F%8A%20Cookie&envLink=https%3A%2F%2Fgithub.com%2FYunFeng86%2Fpt-gen-universal%23%E9%85%8D%E7%BD%AE)

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/YunFeng86/pt-gen-universal)

[![Use EdgeOne Pages to deploy](https://cdnstatic.tencentcs.com/edgeone/pages/deploy.svg)](https://edgeone.ai/pages/new?repository-url=https%3A%2F%2Fgithub.com%2FYunFeng86%2Fpt-gen-universal&install-command=corepack%20enable%20%26%26%20pnpm%20install%20--frozen-lockfile&build-command=pnpm%20run%20build%3Aedgeone&output-directory=.&env=APIKEY%2CTMDB_API_KEY%2CDOUBAN_COOKIE%2CINDIENOVA_COOKIE)

### 合并后发布模板再启用

- Railway：仓库内已提供 `nixpacks.toml`，但真正的公开一键模板链接需要在 Railway 控制台创建并发布模板后生成
- Zeabur：仓库内已提供 `zeabur-template.yaml`，Deploy Button 需要在 Zeabur Dashboard 创建模板后复制

### GitHub Template

当前仓库已经开启 GitHub Template，公开页会显示 `Use this template` / `Public template`，可直接作为模板仓库使用。

## 当前交付状态

### 仓库内已完成

- `pnpm` 主导的包管理、锁文件、Node 版本约束与主 CI
- Hono 核心、runtime env 归一化、平台薄适配层与各平台部署配置文件
- Cloudflare KV、Vercel Redis、Netlify Blobs、EdgeOne KV、Node Redis 等缓存适配器
- GitHub 仓库已开启 `Template repository`
- `GET /`、legacy `/?url=`、认证入口、缓存异常降级等本地测试与 `wrangler build` 验证

### 仓库外待执行

- Railway 模板发布并生成真实模板链接
- Zeabur 模板发布并生成真实按钮
- Cloudflare、Vercel、Netlify、EdgeOne 四个平台至少完成一次真实创建与部署 smoke

## 快速开始

### 环境要求

- Node.js `20.18.0+`
- `pnpm 9.15.9`

建议使用 Corepack：

```bash
corepack enable
corepack prepare pnpm@9.15.9 --activate
```

### 本地开发

```bash
git clone https://github.com/YunFeng86/pt-gen-universal.git
cd pt-gen-universal
pnpm install --frozen-lockfile
cp .env.example .env
pnpm run dev
```

默认地址：`http://localhost:3000`

### 本地模拟 Cloudflare

```bash
pnpm run dev:cf
```

默认地址：`http://127.0.0.1:8787`

## 部署说明

### Cloudflare Workers

- 入口：`src/adapters/cloudflare.ts`
- 缓存：默认使用 `PT_GEN_STORE` KV 绑定
- 构建：`pnpm run build`
- 部署：`pnpm run deploy`

Secrets 建议通过 Wrangler 注入：

```bash
pnpm dlx wrangler secret put APIKEY
pnpm dlx wrangler secret put TMDB_API_KEY
pnpm dlx wrangler secret put DOUBAN_COOKIE
pnpm dlx wrangler secret put INDIENOVA_COOKIE
```

### Vercel

- 入口：`api/[[...route]].ts` -> `src/index.ts`
- 路由：由 `vercel.json` 把所有请求重写到 Edge 入口
- 缓存：默认使用 Upstash / Marketplace Redis

至少建议配置：

- `APIKEY`
- `TMDB_API_KEY`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `DOUBAN_COOKIE`
- `INDIENOVA_COOKIE`

### Netlify

- 入口：`netlify/edge-functions/app.ts`
- 路由：由 `netlify.toml` 将 `/*` 全量交给 edge function
- 缓存：默认使用 Netlify Blobs

### EdgeOne

- 入口：`edge-functions/index.ts` 和 `edge-functions/[[default]].ts`
- 缓存：默认使用 `PT_GEN_STORE` Pages KV 绑定
- 构建配置：`edgeone.json`

### Railway

- 运行时：Node.js fallback
- 构建：`nixpacks.toml`
- 启动：`pnpm run start:node`
- 缓存：默认使用 `REDIS_URL`

推荐在 Railway 项目中同时创建：

- 一个应用服务，指向本仓库
- 一个 Redis 服务，并把 `REDIS_URL` 注入应用服务

### Zeabur

- 运行时：Node.js fallback
- 模板文件：`zeabur-template.yaml`
- 启动：`pnpm run start:node`
- 缓存：默认使用 `REDIS_URL`

## 配置

### 通用变量

| 变量 | 说明 |
| --- | --- |
| `APIKEY` | API 访问密钥 |
| `TMDB_API_KEY` | TMDB API 密钥 |
| `DOUBAN_COOKIE` | 豆瓣 Cookie |
| `INDIENOVA_COOKIE` | Indienova Cookie |
| `DISABLE_SEARCH` | 是否禁用搜索 |
| `CACHE_TTL` | 缓存 TTL，单位秒 |
| `STORAGE_PROVIDER` | `auto` / `memory` / `cloudflare-kv` / `vercel-redis` / `netlify-blobs` / `edgeone-kv` / `redis` |
| `CACHE_STORE_NAME` | 逻辑缓存名，默认 `pt-gen-cache` |
| `RATE_LIMIT_MODE` | `off` / `best-effort`；`off` 会强制关闭请求级限流 |
| `RATE_LIMIT_PER_MINUTE` | 请求级限流阈值，仅在 `RATE_LIMIT_MODE=best-effort` 时生效 |
| `REQUEST_TIMEOUT_MS` | 通用抓取超时 |
| `PROXY_URL` | 可选抓取中转 |
| `PROXY_ALLOW_SENSITIVE_HEADERS` | 是否允许转发敏感请求头到中转 |

### 平台存储变量

| 变量 | 平台 | 说明 |
| --- | --- | --- |
| `PT_GEN_STORE` | Cloudflare / EdgeOne | KV 绑定 |
| `UPSTASH_REDIS_REST_URL` | Vercel / 任意支持 REST 的环境 | Upstash REST 地址 |
| `UPSTASH_REDIS_REST_TOKEN` | Vercel / 任意支持 REST 的环境 | Upstash REST Token |
| `KV_REST_API_URL` | Vercel 兼容别名 | REST 地址兼容变量 |
| `KV_REST_API_TOKEN` | Vercel 兼容别名 | REST Token 兼容变量 |
| `REDIS_URL` | Railway / Zeabur / Node | Redis 连接串 |

### 当前默认策略

- `STORAGE_PROVIDER=auto` 时按平台自动选择后端
- `RATE_LIMIT_MODE` 默认 `off`，即使设置了 `RATE_LIMIT_PER_MINUTE` 也不会启用请求级限流
- 只有 `RATE_LIMIT_MODE=best-effort` 且 `RATE_LIMIT_PER_MINUTE > 0` 时，才启用实例内 best-effort 请求级限流
- scraper 内部的 token bucket 仍然只是实例内 best-effort 节流，不是分布式全局限流

## API

### 推荐接口

```bash
GET /api/v2/info?url=https://movie.douban.com/subject/1292052/
GET /api/v2/search?q=肖申克&source=douban
POST /api/v2/info
```

`POST /api/v2/info` 示例：

```bash
curl -X POST "http://localhost:3000/api/v2/info" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "url": "https://movie.douban.com/subject/1292052/",
    "format": "bbcode"
  }'
```

### 兼容入口

以下入口保持兼容：

- `GET /api/v1/search`
- `GET /api/v1/info`
- `GET /api/v1/info/:site/:sid`
- `GET /api/search`
- `GET /api/info`
- `GET /?search=...`
- `GET /?url=...`
- `GET /?site=...&sid=...`

### API Key 传递方式

支持以下三种方式：

- Query：`?apikey=xxx`
- Header：`X-API-Key: xxx`
- Header：`Authorization: Bearer xxx`

## 支持资源站点

| 站点 | 搜索 | 示例 |
| --- | --- | --- |
| douban | ✅ | `https://movie.douban.com/subject/1292052/` |
| imdb | ✅ | `https://www.imdb.com/title/tt0111161/` |
| bangumi | ✅ | `https://bgm.tv/subject/12345` |
| tmdb | ✅ | `https://www.themoviedb.org/movie/278` |
| steam | ✅ | `https://store.steampowered.com/app/730/` |
| indienova | ✅ | `https://indienova.com/game/game-name` |
| gog | ✅ | `https://www.gog.com/game/cyberpunk_2077` |

## 项目结构

```text
src/
  adapters/            # Cloudflare / Node / Bun 入口
  runtime/             # 运行时环境归一化与平台 runtime factory
  storage/             # Memory / KV / Redis / Blobs 存储适配器
  controllers/         # API v1 / v2
  cache/               # 缓存逻辑
  middleware/          # 认证、限流等中间件
lib/
  scrapers/            # 站点抓取
  normalizers/         # 数据归一化
  formatters/          # 输出格式化
api/                   # Vercel Edge 入口
netlify/edge-functions/# Netlify Edge 入口
edge-functions/        # EdgeOne Edge 入口
```

## 开发与验证

```bash
pnpm exec tsc --noEmit
pnpm run test:run
pnpm run build
```

GitHub Actions 已改为使用 `pnpm 9.15.9 + Node 20.18.0`。

## 平台限制

- Cloudflare KV 与 Netlify Blobs 都更适合作为缓存，不适合作为严格一致性的分布式计数器
- Vercel Edge 兼容但官方更推荐 Node.js runtime，因此如果你不强依赖 Edge，就优先考虑 Node runtime
- Railway 与 Zeabur 本轮属于 Node fallback，不承诺 Edge 运行时
- Railway 和 Zeabur 的公开 Deploy Button 需要先在各自平台发布模板后才能生成
- GitHub Template 需要仓库管理员在 Settings 中启用

## 参考文档

- Cloudflare Builds: <https://developers.cloudflare.com/workers/ci-cd/builds/build-image/>
- Cloudflare Node.js compatibility: <https://developers.cloudflare.com/workers/runtime-apis/nodejs/>
- Cloudflare KV FAQ: <https://developers.cloudflare.com/kv/reference/faq/>
- Vercel Edge Runtime: <https://vercel.com/docs/functions/runtimes/edge>
- Vercel Deploy Button: <https://vercel.com/docs/deploy-button>
- Netlify Edge Functions API: <https://docs.netlify.com/build/edge-functions/api/>
- Netlify Blobs: <https://docs.netlify.com/build/data-and-storage/netlify-blobs/>
- Netlify Deploy Button: <https://docs.netlify.com/site-deploys/create-deploys/>
- EdgeOne Deploy Button: <https://pages.edgeone.ai/document/deploy-button>
- EdgeOne Pages KV 集成: <https://pages.edgeone.ai/zh/document/pages-kv-integration>
- Railway Templates: <https://docs.railway.com/guides/templates>
- Zeabur Template Format: <https://zeabur.com/docs/en-US/template/template-in-code>
- Zeabur Deploy Button: <https://zeabur.com/docs/en-US/deploy/deploy-button>
- GitHub Template Repository: <https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-template-repository>
