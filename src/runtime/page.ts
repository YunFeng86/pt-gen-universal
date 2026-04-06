import type { StorageProvider } from '../../lib/types/config';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function createHomePage(platform: string, storageProvider: StorageProvider): string {
  const platformLabel = escapeHtml(platform);
  const storageLabel = escapeHtml(storageProvider);

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>PT-Gen Universal</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f4f1ea;
        --card: rgba(255, 255, 255, 0.9);
        --text: #1d211f;
        --muted: #56605a;
        --accent: #0f766e;
        --border: rgba(29, 33, 31, 0.1);
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        font-family: "IBM Plex Sans", "PingFang SC", "Hiragino Sans GB", sans-serif;
        color: var(--text);
        background:
          radial-gradient(circle at top left, rgba(15, 118, 110, 0.18), transparent 36%),
          radial-gradient(circle at bottom right, rgba(180, 83, 9, 0.14), transparent 30%),
          var(--bg);
      }
      main {
        max-width: 860px;
        margin: 0 auto;
        padding: 48px 20px 72px;
      }
      .card {
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: 24px;
        padding: 32px;
        box-shadow: 0 16px 48px rgba(29, 33, 31, 0.08);
        backdrop-filter: blur(18px);
      }
      h1 {
        margin: 0 0 12px;
        font-size: clamp(2rem, 4vw, 3.4rem);
        line-height: 1.05;
      }
      p {
        margin: 0;
        color: var(--muted);
        line-height: 1.7;
      }
      .pill-list {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin: 24px 0 28px;
      }
      .pill {
        padding: 10px 14px;
        border-radius: 999px;
        border: 1px solid var(--border);
        background: rgba(255, 255, 255, 0.7);
        font-size: 0.95rem;
      }
      code {
        font-family: "SFMono-Regular", "Consolas", monospace;
        font-size: 0.92em;
      }
      .grid {
        display: grid;
        gap: 14px;
        margin-top: 28px;
      }
      .section {
        border: 1px solid var(--border);
        border-radius: 18px;
        padding: 18px 20px;
        background: rgba(255, 255, 255, 0.72);
      }
      .section strong {
        display: block;
        margin-bottom: 8px;
      }
      a {
        color: var(--accent);
        text-decoration: none;
      }
      a:hover { text-decoration: underline; }
    </style>
  </head>
  <body>
    <main>
      <div class="card">
        <h1>PT-Gen Universal</h1>
        <p>面向多平台部署的 PT-Gen 服务入口，保持 Web 标准优先与 Hono 核心一致。</p>
        <div class="pill-list">
          <span class="pill">当前运行时：<code>${platformLabel}</code></span>
          <span class="pill">缓存后端：<code>${storageLabel}</code></span>
          <span class="pill">推荐接口：<code>/api/v2/info</code></span>
        </div>
        <div class="grid">
          <div class="section">
            <strong>快速测试</strong>
            <p><code>/api/v2/info?url=https://movie.douban.com/subject/1292052/</code></p>
          </div>
          <div class="section">
            <strong>兼容旧入口</strong>
            <p><code>/?url=...</code>、<code>/?search=...</code>、<code>/?site=...&amp;sid=...</code> 仍然可用。</p>
          </div>
          <div class="section">
            <strong>项目文档</strong>
            <p>查看仓库中的 <code>README.md</code> 获取 Cloudflare、Vercel、Netlify、EdgeOne、Railway、Zeabur 的部署说明。</p>
          </div>
        </div>
      </div>
    </main>
  </body>
</html>`;
}
