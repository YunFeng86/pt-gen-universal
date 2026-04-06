# PT-Gen 跨平台版

[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2FYunFeng86%2Fpt-gen-universal.svg?type=shield&issueType=license)](https://app.fossa.com/projects/git%2Bgithub.com%2FYunFeng86%2Fpt-gen-universal?ref=badge_shield&issueType=license)

基于 [Rhilip/pt-gen-cfworker](https://github.com/Rhilip/pt-gen-cfworker) 改写，使用 [Hono](https://hono.dev/) 框架重构为跨平台架构。

## 特性

- **跨平台支持**：Cloudflare Workers / Node.js / Bun 三种运行时
- **开发体验提升**：本地秒启动，支持热重载
- **API V2**：标准化的 JSON 响应，原生支持 JSON/BBCode/Markdown 多种输出格式
- **TypeScript 重构**：核心逻辑完全采用 TypeScript 编写，类型安全
- **三层架构**：Scraper / Normalizer / Formatter 解耦设计

## 快速开始

### 一键部署到 Cloudflare Workers（推荐）

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/YunFeng86/pt-gen-universal)

点击上方 **Deploy to Cloudflare** 按钮，按照提示完成部署：

1. 授权 GitHub 仓库访问
2. 连接 Cloudflare 账号
3. 自动创建 KV 命名空间并部署

部署完成后，你的服务将立即可用。

### 部署到 Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FYunFeng86%2Fpt-gen-universal&env=APIKEY,TMDB_API_KEY,DOUBAN_COOKIE,INDIENOVA_COOKIE&envDescription=PT-Gen%20%E9%85%8D%E7%BD%AE%E5%8F%98%E9%87%8F&envLink=https%3A%2F%2Fgithub.com%2FYunFeng86%2Fpt-gen-universal%23%25E9%2585%258D%25E7%25BD%25AE)

点击上方 **Deploy with Vercel** 按钮，按照提示完成部署：

1. 授权并克隆 GitHub 仓库到你的账号
2. 配置环境变量（可选，也可部署后在 Vercel Dashboard 中添加）
3. 自动构建并部署

> **注意**：Vercel 部署使用内存缓存，函数实例回收后缓存会丢失。如需持久化缓存，推荐使用 Cloudflare Workers 部署。

### 手动部署 Cloudflare Workers

**环境要求：Node.js v18.0.0+**（Wrangler 支持 Node.js Current/Active/Maintenance 版本）

```bash
# 克隆仓库
git clone https://github.com/YunFeng86/pt-gen-universal.git
cd pt-gen-universal

# 安装依赖
npm install

# 本地开发
npm run dev:cf

# 部署到生产
npm run deploy
```

本地开发默认访问：`http://127.0.0.1:8787`

### Node.js（本地开发/VPS 部署）

**环境要求：Node.js v20.6.0+**（需要支持 `--env-file` 和顶级 await）

```bash
# 克隆仓库
git clone https://github.com/YunFeng86/pt-gen-universal.git
cd pt-gen-universal

# 安装依赖
npm install

# 配置环境变量（可选）
cp .env.example .env
# 编辑 .env 文件填入配置

# 启动服务器
npm run start:node

# 开发模式（热重载）
npm run dev:node
```

开发模式默认访问：`http://localhost:3000`

> **注意**：本项目已全面迁移至 TypeScript，直接运行 `node` 命令无法启动。请使用 `npm run` 脚本，它们会自动调用 `tsx` 加载器。

### Bun（高性能本地开发/VPS 部署）

**环境要求：Bun v1.0.0+**

```bash
# 克隆仓库
git clone https://github.com/YunFeng86/pt-gen-universal.git
cd pt-gen-universal

# 安装依赖
bun install

# 配置环境变量（可选）
cp .env.example .env
# 编辑 .env 文件填入配置

# 启动服务器
npm run start:bun

# 开发模式（热重载）
npm run dev:bun
```

开发模式默认访问：`http://localhost:3000`

## API 使用

### 测试站点

- 暂无

### API 端点

#### API v2（推荐）

提供更规范的 JSON 响应和原生多格式支持。

**简介生成（URL 模式）：**

```
GET /api/v2/info?url=https://movie.douban.com/subject/1292052/
```

**简介生成（POST 模式）：**

```bash
POST /api/v2/info
Content-Type: application/json
# 如果设置了 APIKEY，也可以用 header 传递（推荐用于 POST）
# X-API-Key: your-api-key
# Authorization: Bearer your-api-key

{
  "url": "https://movie.douban.com/subject/1292052/",
  "format": "bbcode"
}
```

**简介生成（RESTful 模式）：**

```
GET /api/v2/info/douban/1292052
```

**资源搜索：**

```
GET /api/v2/search?q=肖申克&source=douban
```

**参数说明：**

- `url`: 资源链接
- `format`: 输出格式，可选 `json` (默认), `bbcode`, `markdown`
- `q`: 搜索关键词
- `source`: 搜索源 (默认 `douban`)

#### API v1（遗留/兼容）

> **注意**：建议新集成的应用使用 API v2。

**资源搜索：**

```
GET /api/v1/search?q=肖申克&source=douban
```

**简介生成（URL 模式）：**

```
GET /api/v1/info?url=https://movie.douban.com/subject/1292052/
```

**简介生成（RESTful 模式）：**

```
GET /api/v1/info/douban/1292052
```

#### 便捷别名

为了方便使用，提供了无版本号的便捷别名，自动指向最新稳定版（当前为 v1）：

```
GET /api/search?q=肖申克&source=douban
GET /api/info?url=https://movie.douban.com/subject/1292052/
GET /api/info/douban/1292052
```

#### 旧 API 格式（兼容）

```
GET /?search=肖申克&source=douban
GET /?url=https://movie.douban.com/subject/1292052/
GET /?site=douban&sid=1292052
```

旧 API 会自动重定向到 v1 API。

### 请求参数

**资源搜索：**

- `q` / `search`：搜索关键词
- `source`：资源来源站点（见下表），默认 `douban`

**简介生成（方法1，推荐）：**

- `url`：资源链接（见下表支持格式）

**简介生成（方法2）：**

- `site`：资源来源站点
- `sid`：资源在对应站点的唯一 ID

## 支持资源站点

|     站点      | 搜索 | 链接格式示例                                |
| :-----------: | :--: | :------------------------------------------ |
|  **douban**   |  ✅  | `https://movie.douban.com/subject/1292052/` |
|   **imdb**    |  ✅  | `https://www.imdb.com/title/tt0111161/`     |
|  **bangumi**  |  ✅  | `https://bgm.tv/subject/12345`              |
|   **tmdb**    |  ✅  | `https://www.themoviedb.org/movie/278`      |
|   **steam**   |  ✅  | `https://store.steampowered.com/app/730/`   |
| **indienova** |  ✅  | `https://indienova.com/game/game-name`      |
|    **gog**    |  ✅  | `https://www.gog.com/game/cyberpunk_2077`   |

> **注意**：Steam 服务器限制 CF Worker 访问，使用CF Worker时相关功能可用性将下降。

## 配置

### Cloudflare Workers

#### 敏感信息配置（Secrets）

**重要：** 敏感信息（API 密钥、Cookie）必须使用 [Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)，不要写在 `wrangler.toml` 的 `[vars]` 中。

**方式一：通过 Wrangler CLI（推荐）**

```bash
# 设置 API 密钥
npx wrangler secret put APIKEY

# 设置豆瓣 Cookie
npx wrangler secret put DOUBAN_COOKIE

# 设置 indienova Cookie
npx wrangler secret put INDIENOVA_COOKIE
```

执行后会提示输入值，输入的内容不会显示在终端。

**方式二：通过 Cloudflare Dashboard**

1. 进入 **Workers & Pages** 页面
2. 选择你的 Worker > **Settings**
3. 在 **Variables and Secrets** 下选择 **Add**
4. 类型选择 **Secret**，输入变量名和值
5. 点击 **Deploy** 使更改生效

**本地开发时的 Secrets**

创建 `.dev.vars` 文件（已在 `.gitignore` 中）：

```bash
# .dev.vars（不要提交到 git）
APIKEY=your-local-api-key
DOUBAN_COOKIE=your-local-douban-cookie
INDIENOVA_COOKIE=your-local-indienova-cookie
```

运行 `npm run dev:cf` 时会自动加载此文件。

#### 非敏感变量配置

在 `wrangler.toml` 中配置：

```toml
[vars]
DISABLE_SEARCH = "false"
```

#### KV 命名空间配置

一键部署会自动创建 KV 命名空间。手动部署时：

```bash
# 创建 KV 命名空间
npx wrangler kv:namespace create "PT_GEN_STORE"

# 将返回的 ID 填入 wrangler.toml
# kv_namespaces = [
#   { binding = "PT_GEN_STORE", id = "your-kv-namespace-id" }
# ]
```

### Node.js / Bun

复制 `.env.example` 为 `.env` 并填入配置：

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```bash
APIKEY=your-api-key
DISABLE_SEARCH=false
PORT=3000
PROXY_URL=
PROXY_ALLOW_SENSITIVE_HEADERS=false
DOUBAN_COOKIE=your-douban-cookie
INDIENOVA_COOKIE=your-indienova-cookie
```

### 环境变量说明

|              变量               | 说明                                                                                                                      |
| :-----------------------------: | :------------------------------------------------------------------------------------------------------------------------ |
|            `APIKEY`             | API 访问密钥。可用 query `?apikey={APIKEY}`，或 header `X-API-Key: {APIKEY}` / `Authorization: Bearer {APIKEY}`           |
|        `DISABLE_SEARCH`         | 设置为 `"true"` 时禁用搜索功能                                                                                            |
|           `CACHE_TTL`           | 缓存过期时间（秒），默认 172800（2天）。设置为 0 禁用缓存（仅缓存 GET /api/\*）                                           |
|           `PROXY_URL`           | 可选：抓取中转（URL relay），用于网络受限环境。支持前缀模式或模板模式（`{url}` / `{urlEncoded}`），详见 `.env.example`    |
| `PROXY_ALLOW_SENSITIVE_HEADERS` | 可选：允许在使用 `PROXY_URL` 时转发敏感请求头（Cookie/Authorization）。默认 `false` 更安全；仅在你完全信任/自建中转时开启 |
|         `TMDB_API_KEY`          | TMDB API 密钥，用于访问 TMDB 资源。获取地址：https://www.themoviedb.org/settings/api                                      |
|         `DOUBAN_COOKIE`         | 豆瓣 Cookie，用于访问登录可见资源                                                                                         |
|       `INDIENOVA_COOKIE`        | indienova Cookie（[#15](https://github.com/Rhilip/pt-gen-universal/issues/15)）                                           |
|             `PORT`              | Node.js/Bun 服务器端口（默认 3000）                                                                                       |
|         `PT_GEN_STORE`          | KV 存储命名空间（仅 CF Workers，在 wrangler.toml 配置）                                                                   |

### 安全最佳实践

**Cloudflare Workers：**

- ✅ 使用 Secrets 存储敏感信息（APIKEY、Cookie）
- ✅ 本地开发使用 `.dev.vars`（已在 `.gitignore`）
- ❌ 不要在 `wrangler.toml` 的 `[vars]` 中写敏感信息
- ❌ 不要提交 `.dev.vars` 到 git

**Node.js / Bun：**

- ✅ 使用 `.env` 文件存储配置（已在 `.gitignore`）
- ✅ 参考 `.env.example` 创建你的 `.env`
- ❌ 不要提交 `.env` 到 git
- ❌ 不要在代码中硬编码敏感信息

## 技术架构

### 技术栈

- **框架**：[Hono](https://hono.dev/) - 轻量级 Web 框架
- **运行时**：Cloudflare Workers / Node.js / Bun
- **存储**：Cloudflare KV（Serverless）/ Memory（Server）
- **模块系统**：ES Module
- **依赖**：cheerio 1.1.2、html2bbcode、@hono/node-server

### 项目结构

```
pt-gen-universal/
├── src/
│   ├── app.ts                 # 核心业务逻辑（平台无关）
│   ├── storage/               # 存储抽象层
│   │   ├── interface.ts       # 存储接口定义
│   │   ├── cloudflare.ts      # CF KV 适配器
│   │   └── memory.ts          # 内存适配器（Node.js/Bun）
│   ├── adapters/              # 平台适配器
│   │   ├── cloudflare.ts      # CF Workers 入口
│   │   ├── node.ts            # Node.js 入口
│   │   └── bun.ts             # Bun 入口
│   └── controllers/           # API 控制器
│       ├── v1.ts              # V1 接口逻辑
│       └── v2.ts              # V2 接口逻辑
├── lib/                       # 站点处理模块
│   ├── scrapers/              # 数据抓取层
│   ├── normalizers/           # 数据清洗层
│   ├── formatters/            # 数据格式化层
│   ├── orchestrator.ts        # 核心控制器
│   ├── types/                 # 类型定义
│   ├── const.ts               # 常量定义
│   ├── errors.ts              # 错误处理
│   └── utils/                 # 工具函数
├── index.html                 # Web UI
├── package.json
└── wrangler.toml              # CF Workers 配置
```

### 核心特性

1. **平台无关性**：核心业务逻辑与运行时解耦
2. **存储抽象**：统一的存储接口，支持 KV 和内存两种实现
3. **路由优化**：使用 Map 替代 if-else，消除重复代码
4. **中间件架构**：统一处理缓存、CORS、APIKEY 验证

## License

[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2FYunFeng86%2Fpt-gen-universal.svg?type=large&issueType=license)](https://app.fossa.com/projects/git%2Bgithub.com%2FYunFeng86%2Fpt-gen-universal?ref=badge_large&issueType=license)
