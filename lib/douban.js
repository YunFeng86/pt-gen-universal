import { jsonp_parser, NONE_EXIST_ERROR, page_parser } from "./common.js";
import { formatMovieInfo } from "./formatter.js";
import { rateLimiter } from "./rate-limiter.js";

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_WARMUP_TIMEOUT_MS = 4_000;
const HAS_GETSETCOOKIE =
  typeof Headers !== "undefined" &&
  typeof Headers.prototype?.getSetCookie === "function";

function normalizeCookie(cookie) {
  if (!cookie) return "";
  return String(cookie).trim().replace(/;+\s*$/, "");
}

function mergeCookies(...cookies) {
  return cookies
    .map(normalizeCookie)
    .filter(Boolean)
    .join("; ");
}

function getSetCookieArray(headers) {
  // undici (Node.js) exposes Headers.getSetCookie(); CF Workers uses get("set-cookie")
  if (HAS_GETSETCOOKIE && headers) return headers.getSetCookie();
  const single = headers?.get?.("set-cookie");
  return single ? [single] : [];
}

function extractBidCookieFromResponse(resp) {
  const setCookies = getSetCookieArray(resp.headers);
  for (const raw of setCookies) {
    const m = String(raw).match(/(?:^|;\s*)bid=([^;]+)/);
    if (m) return `bid=${m[1]}`;
  }
  return "";
}

function buildDoubanHeaders(config = {}) {
  // "Mobile" UA tends to trigger simpler pages and sometimes avoids anti-bot.
  // Users can still override by providing DOUBAN_COOKIE.
  const headers = {
    "User-Agent":
      config.doubanUserAgent ||
      "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
    "Accept":
      "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": config.doubanAcceptLanguage || "zh-CN,zh;q=0.9,en;q=0.8",
    "Referer": "https://movie.douban.com/",
  };

  const cookie = normalizeCookie(config.doubanCookie);
  if (cookie) headers["Cookie"] = cookie;

  return headers;
}

async function fetchWithTimeout(url, init = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function warmupBidCookie(config, baseHeaders) {
  // If user didn't provide a cookie, try to obtain `bid` first.
  // Some Douban endpoints behave better after a "homepage" request.
  try {
    // 频率限制
    await rateLimiter.acquire('douban', 2000);

    const timeoutMs = config.doubanWarmupTimeoutMs || Math.min(config.doubanTimeoutMs || DEFAULT_TIMEOUT_MS, DEFAULT_WARMUP_TIMEOUT_MS);
    const resp = await fetchWithTimeout(
      "https://movie.douban.com/",
      { headers: baseHeaders, redirect: "manual" },
      timeoutMs
    );
    return extractBidCookieFromResponse(resp);
  } catch {
    return "";
  }
}

function looksLikeSecChallenge(resp, bodyText) {
  const finalUrl = resp?.url || "";
  if (finalUrl.includes("sec.douban.com")) return true;
  if (/sec\.douban\.com/.test(bodyText || "")) return true;
  if (/检测到有异常请求|异常请求/.test(bodyText || "")) return true;
  if (/请开启JavaScript|captcha|验证码/.test(bodyText || "")) return true;
  return false;
}

function safeJsonParse(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(String(raw).replace(/(\r\n|\n|\r|\t)/gm, ""));
  } catch {
    return null;
  }
}

function ensureArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function normalizeMaybeArray(value) {
  if (value == null) return "";
  if (Array.isArray(value)) return value.join("/");
  return String(value);
}

function normalizePeople(list) {
  return ensureArray(list)
    .map((x) => {
      if (x == null) return "";
      if (typeof x === "string") return x.trim();
      if (typeof x === "object" && x["name"]) return String(x["name"]).trim();
      return "";
    })
    .filter(Boolean);
}

function extractSortableDateKey(s) {
  // Normalize common patterns like:
  // - "2022-06-10(美国/中国大陆)" -> "2022-06-10"
  // - "2022-06-10" -> "2022-06-10"
  // - "" -> ""
  const m = String(s || "").match(/(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : "";
}

function sortPlaydates(list) {
  const items = ensureArray(list).map((v) => String(v).trim()).filter(Boolean);
  return items
    .map((v, i) => ({ v, i, k: extractSortableDateKey(v) }))
    .sort((a, b) => {
      if (a.k && b.k) {
        const da = new Date(a.k);
        const db = new Date(b.k);
        const diff = da - db;
        if (!Number.isNaN(diff) && diff !== 0) return diff;
      }
      // Stable fallback.
      return a.i - b.i;
    })
    .map((x) => x.v);
}

const DOUBAN_GENRES = new Set([
  "剧情",
  "喜剧",
  "动作",
  "爱情",
  "科幻",
  "动画",
  "悬疑",
  "惊悚",
  "恐怖",
  "犯罪",
  "同性",
  "音乐",
  "歌舞",
  "传记",
  "历史",
  "战争",
  "西部",
  "奇幻",
  "冒险",
  "灾难",
  "武侠",
  "情色",
  "纪录片",
  "短片",
  "家庭",
  "儿童",
  "古装",
  "戏曲",
  "黑色电影",
  "运动",
]);

function fetchAnchorText(anchor) {
  const node = anchor?.[0]?.nextSibling;
  const value = node?.nodeValue;
  return value ? String(value).trim() : "";
}



function setTitles(data, { chinese_title, foreign_title, aka } = {}) {
  const chineseTitle = String(chinese_title || "").trim();
  const foreignTitle = String(foreign_title || "").trim();

  data["chinese_title"] = chineseTitle;
  data["foreign_title"] = foreignTitle;

  const akaStr = String(aka || "").trim();
  if (akaStr) data["aka"] = akaStr.split("/");

  let trans_title;
  let this_title;
  if (foreignTitle) {
    trans_title = chineseTitle + (akaStr ? "/" + akaStr : "");
    this_title = foreignTitle;
  } else {
    trans_title = akaStr ? akaStr : "";
    this_title = chineseTitle;
  }

  // Keep the original behavior: always use `.split("/")` (even if it becomes [""]).
  data["trans_title"] = String(trans_title).split("/");
  data["this_title"] = String(this_title).split("/");
}

function extractAkaFromInfo($) {
  const aka_anchor = $('#info span.pl:contains("又名")');
  if (aka_anchor.length <= 0) return "";
  const aka_raw = fetchAnchorText(aka_anchor);
  if (!aka_raw) return "";
  return aka_raw
    .split(" / ")
    .map((x) => x.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))
    .join("/");
}

function parseDoubanMobileSubjectHtml(douban_page_raw, sid) {
  const douban_link = `https://movie.douban.com/subject/${sid}/`;
  const data = { site: "douban", sid };

  const $ = page_parser(douban_page_raw);

  const chinese_title = $(".sub-title").first().text().trim() || $("title").text().trim();

  // Example: "Jurassic World: Dominion（2022）"
  const original = $(".sub-original-title").first().text().trim();
  const yearMatch = original.match(/(\d{4})/);
  const yearOnly = yearMatch ? yearMatch[1] : "";
  data["year"] = yearOnly ? ` ${yearOnly}` : "";

  const foreign_title = original
    ? original.replace(/[（(]\s*\d{4}.*?[）)]\s*$/, "").trim()
    : "";
  setTitles(data, { chinese_title, foreign_title });

  const poster = $(".sub-cover img").attr("src") || "";
  if (poster) {
    data["poster"] = String(poster)
      .replace(/s(_ratio_poster|pic)/g, "l$1")
      .replace("img3", "img1");
  }

  // Mobile pages expose rating & count via schema.org meta tags.
  const ratingValue = $('meta[itemprop="ratingValue"]').attr("content") || "";
  const reviewCount = $('meta[itemprop="reviewCount"]').attr("content") || "";

  data["douban_rating_average"] = ratingValue || 0;
  data["douban_votes"] = reviewCount || 0;
  data["douban_rating"] = `${data["douban_rating_average"]}/10 from ${data["douban_votes"]} users`;

  // Example meta: "美国 / 马耳他 / 动作 / 科幻 / 冒险 / 2022-06-10(美国/中国大陆)上映 / 片长147分钟(中国大陆)"
  const meta = $(".sub-meta").first().text().replace(/\s+/g, " ").trim();
  // Douban uses " / " as separator; keep "/" inside parentheses (e.g. 美国/中国大陆).
  const parts = meta ? meta.split(" / ").map((s) => s.trim()).filter(Boolean) : [];

  const regions = [];
  const genres = [];
  const playdates = [];
  let duration = "";

  for (const p of parts) {
    if (p.includes("上映")) {
      playdates.push(p.replace(/上映/g, "").trim());
      continue;
    }
    if (p.startsWith("片长")) {
      duration = p.replace(/^片长/, "").trim();
      continue;
    }
    if (DOUBAN_GENRES.has(p)) {
      genres.push(p);
      continue;
    }
    regions.push(p);
  }

  data["region"] = regions;
  data["genre"] = genres;
  data["playdate"] = sortPlaydates(playdates);
  data["duration"] = duration;

  // Introduction on mobile is server-rendered.
  const introP = $("section.subject-intro .bd p").first();
  let introduction = "";
  if (introP.length > 0) {
    const html = introP.html() || "";
    introduction = html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .split("\n")
      .map((a) => a.trim())
      .filter((a) => a.length > 0)
      .join("\n");
  }
  data["introduction"] = introduction || "暂无相关剧情介绍";

  data["douban_link"] = douban_link;
  data["language"] = ""; // mobile page usually does not expose language without extra API calls
  data["format"] = formatMovieInfo(data);

  data["success"] = true;
  return data;
}

export function parseDoubanSubjectHtml(douban_page_raw, sid) {
  const douban_link = `https://movie.douban.com/subject/${sid}/`;
  const data = { site: "douban", sid };

  // Basic error pages.
  if (/你想访问的页面不存在/.test(douban_page_raw)) {
    return { ...data, error: NONE_EXIST_ERROR };
  }
  if (/检测到有异常请求/.test(douban_page_raw)) {
    return {
      ...data,
      error:
        "Blocked by Douban anti-bot. Try setting DOUBAN_COOKIE or running behind a residential IP.",
    };
  }

  const $ = page_parser(douban_page_raw);
  const title = $("title").text().replace("(豆瓣)", "").trim();

  const ld_json = safeJsonParse(
    $('head > script[type="application/ld+json"]').first().html() ||
    $('script[type="application/ld+json"]').first().html()
  );
  if (!ld_json) {
    // m.douban.com pages often do not ship JSON-LD; they are still parseable.
    if ($(".subject-header-wrap").length > 0 || $(".sub-title").length > 0) {
      return parseDoubanMobileSubjectHtml(douban_page_raw, sid);
    }

    return {
      ...data,
      error:
        "Douban page parse failed (JSON-LD not found). The page may be blocked by anti-bot or the structure has changed.",
    };
  }

  // IMDb id (if present on page).
  const imdb_anchor = $('#info span.pl:contains("IMDb")');
  if (imdb_anchor.length > 0) {
    const imdb_id = fetchAnchorText(imdb_anchor);
    if (imdb_id) {
      data["imdb_id"] = imdb_id;
      data["imdb_link"] = `https://www.imdb.com/title/${imdb_id}/`;
    }
  }

  const chinese_title = title;
  const foreign_title = $('span[property="v:itemreviewed"]')
    .text()
    .replace(chinese_title, "")
    .trim();
  const aka = extractAkaFromInfo($);
  setTitles(data, { chinese_title, foreign_title, aka });

  const regions_anchor = $('#info span.pl:contains("制片国家/地区")');
  const language_anchor = $('#info span.pl:contains("语言")');
  const episodes_anchor = $('#info span.pl:contains("集数")');
  const duration_anchor = $('#info span.pl:contains("单集片长")');

  const year_raw = $("#content > h1 > span.year").text();
  data["year"] = year_raw ? " " + year_raw.substr(1, 4) : "";

  const region_raw = regions_anchor[0] ? fetchAnchorText(regions_anchor) : "";
  data["region"] = region_raw ? region_raw.split(" / ") : "";

  data["genre"] = $('#info span[property="v:genre"]')
    .map(function () {
      return $(this).text().trim();
    })
    .toArray();

  const language_raw = language_anchor[0] ? fetchAnchorText(language_anchor) : "";
  data["language"] = language_raw ? language_raw.split(" / ") : "";

  data["playdate"] = sortPlaydates(
    $('#info span[property="v:initialReleaseDate"]')
      .map(function () {
        return $(this).text().trim();
      })
      .toArray()
  );

  data["episodes"] = episodes_anchor[0] ? fetchAnchorText(episodes_anchor) : "";
  data["duration"] = duration_anchor[0]
    ? fetchAnchorText(duration_anchor)
    : $('#info span[property="v:runtime"]').text().trim();

  // 20221201 issue#34: link-report -> link-report-intra
  const introduction_node = $(
    "#link-report-intra > span.all.hidden, #link-report-intra > [property=\"v:summary\"], #link-report > span.all.hidden, #link-report > [property=\"v:summary\"]"
  );
  data["introduction"] = (introduction_node.length > 0
    ? introduction_node.text()
    : "暂无相关剧情介绍"
  )
    .split("\n")
    .map((a) => a.trim())
    .filter((a) => a.length > 0)
    .join("\n");

  data["douban_rating_average"] = ld_json["aggregateRating"]
    ? ld_json["aggregateRating"]["ratingValue"]
    : 0;
  data["douban_votes"] = ld_json["aggregateRating"]
    ? ld_json["aggregateRating"]["ratingCount"]
    : 0;
  data["douban_rating"] = `${data["douban_rating_average"]}/10 from ${data["douban_votes"]} users`;
  data["douban_link"] = douban_link;

  if (ld_json["image"]) {
    data["poster"] = String(ld_json["image"])
      .replace(/s(_ratio_poster|pic)/g, "l$1")
      .replace("img3", "img1");
  }

  data["director"] = ensureArray(ld_json["director"]);
  data["writer"] = ensureArray(ld_json["author"]);
  data["cast"] = ensureArray(ld_json["actor"]);

  const tag_nodes = $('div.tags-body > a[href^="/tag"]');
  if (tag_nodes.length > 0) {
    data["tags"] = tag_nodes
      .map(function () {
        return $(this).text();
      })
      .get();
  }

  data["format"] = formatMovieInfo(data);

  data["success"] = true;
  return data;
}

async function enrichWithAwards(data, sid, config, headers, timeoutMs) {
  if (config.doubanIncludeAwards === false) return;
  const douban_link = `https://movie.douban.com/subject/${sid}/`;

  // 频率限制
  await rateLimiter.acquire('douban', 2000);

  const resp = await fetchWithTimeout(`${douban_link}awards`, { headers }, timeoutMs);
  if (!resp.ok) return;
  const raw = await resp.text();
  if (looksLikeSecChallenge(resp, raw)) return;

  const awards_page = page_parser(raw);
  const awards_html = awards_page("#content > div > div.article").html() || "";
  if (!awards_html) return;

  data["awards"] = awards_html
    .replace(/[ \n]/g, "")
    .replace(/<\/li><li>/g, "</li> <li>")
    .replace(/<\/a><span/g, "</a> <span")
    .replace(/<(div|ul)[^>]*>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/ +\n/g, "\n")
    .trim();
}

async function enrichWithImdbRating(data, config, timeoutMs) {
  if (config.doubanIncludeImdb === false) return;
  if (!data?.imdb_id) return;

  const imdb_id = data.imdb_id;
  const resp = await fetchWithTimeout(
    `https://p.media-imdb.com/static-content/documents/v1/title/${imdb_id}/ratings%3Fjsonp=imdb.rating.run:imdb.api.title.ratings/data.json`,
    {},
    timeoutMs
  );
  if (!resp.ok) return;
  const raw = await resp.text();
  const imdb_json = jsonp_parser(raw);
  if (!imdb_json?.resource) return;

  const imdb_average_rating = imdb_json.resource.rating || 0;
  const imdb_votes = imdb_json.resource.ratingCount || 0;
  data["imdb_rating_average"] = imdb_average_rating;
  data["imdb_votes"] = imdb_votes;
  data["imdb_rating"] = `${imdb_average_rating}/10 from ${imdb_votes} users`;
}

async function fetchDoubanSubjectHtml(sid, headers, timeoutMs) {
  const douban_link = `https://movie.douban.com/subject/${sid}/`;

  // Try desktop first, then mobile URL as fallback (some regions / anti-bot rules differ).
  const candidateUrls = [
    douban_link,
    `https://m.douban.com/movie/subject/${sid}/`,
  ];

  let lastResp = null;
  let lastText = "";

  for (const url of candidateUrls) {
    try {
      // 频率限制
      await rateLimiter.acquire('douban', 3000);

      const resp = await fetchWithTimeout(url, { headers }, timeoutMs);
      const text = await resp.text();
      lastResp = resp;
      lastText = text;

      if (!looksLikeSecChallenge(resp, text)) {
        return { html: text, resp, blocked: false, url };
      }
    } catch {
      // Keep trying fallbacks; if all fail we'll return an empty html.
      lastResp = null;
      lastText = "";
    }
  }

  const blocked = !!lastText && looksLikeSecChallenge(lastResp, lastText);
  return { html: lastText, resp: lastResp, blocked, url: candidateUrls[candidateUrls.length - 1] };
}

export async function search_douban(query, config = {}) {
  const timeoutMs = config.doubanTimeoutMs || DEFAULT_TIMEOUT_MS;
  const baseHeaders = buildDoubanHeaders(config);
  const cfgCookie = normalizeCookie(config.doubanCookie);
  const bid = /(?:^|;\s*)bid=/.test(cfgCookie) ? "" : await warmupBidCookie(config, baseHeaders);
  const cookieHeader = mergeCookies(cfgCookie, bid);
  const headers = cookieHeader ? { ...baseHeaders, Cookie: cookieHeader } : baseHeaders;

  try {
    // 频率限制
    await rateLimiter.acquire('douban', 3000);

    const douban_search = await fetchWithTimeout(
      `https://movie.douban.com/j/subject_suggest?q=${encodeURIComponent(query)}`,
      { headers },
      timeoutMs
    );
    const douban_search_json = await douban_search.json();

    return {
      data: douban_search_json.map((d) => {
        return {
          year: d.year,
          subtype: d.type,
          title: d.title,
          subtitle: d.sub_title,
          link: `https://movie.douban.com/subject/${d.id}/`,
        };
      }),
    };
  } catch (e) {
    return {
      error:
        "Failed to search Douban (network error/timeout or blocked). Try setting DOUBAN_COOKIE.",
    };
  }
}

export async function gen_douban(sid, config = {}) {
  const timeoutMs = config.doubanTimeoutMs || DEFAULT_TIMEOUT_MS;

  const baseHeaders = buildDoubanHeaders(config);
  const cfgCookie = normalizeCookie(config.doubanCookie);
  const bid = /(?:^|;\s*)bid=/.test(cfgCookie) ? "" : await warmupBidCookie(config, baseHeaders);
  const cookieHeader = mergeCookies(cfgCookie, bid);
  const headers = cookieHeader ? { ...baseHeaders, Cookie: cookieHeader } : baseHeaders;

  const data = { site: "douban", sid };
  const douban_link = `https://movie.douban.com/subject/${sid}/`;

  const { html: douban_page_raw, blocked } = await fetchDoubanSubjectHtml(
    sid,
    headers,
    timeoutMs
  );

  if (!douban_page_raw) {
    return {
      ...data,
      error:
        "Failed to fetch Douban page (network error/timeout). If you are self-hosting in a restricted network, consider setting DOUBAN_COOKIE.",
    };
  }

  if (blocked) {
    return {
      ...data,
      error:
        "Blocked by Douban anti-bot (sec.douban.com). Try setting DOUBAN_COOKIE or switching to Cloudflare Workers/Bun runtime.",
    };
  }

  // Parse main page (never throw here: return structured error instead).
  const parsed = parseDoubanSubjectHtml(douban_page_raw, sid);
  if (parsed.error) return parsed;

  // Fetch awards/imdb (best-effort). Only swallow network failures, not logic errors.
  try {
    await enrichWithAwards(parsed, sid, config, headers, timeoutMs);
  } catch {
    // ignore awards network failures
  }

  try {
    await enrichWithImdbRating(parsed, config, timeoutMs);
  } catch {
    // ignore imdb network failures
  }

  // Rebuild format now that awards/imdb may have been filled.
  parsed["douban_link"] = parsed["douban_link"] || douban_link;
  parsed["format"] = formatMovieInfo(parsed);

  return parsed;
}
