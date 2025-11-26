import {jsonp_parser, NONE_EXIST_ERROR, page_parser, html2bbcode, GAME_INSTALL_TEMPLATE} from "./common.js";

export async function gen_steam(sid) {
  let data = {
    site: "steam",
    sid: sid
  };

  let steam_page_resp = await fetch(`https://store.steampowered.com/app/${sid}/?l=schinese`, {
    redirect: "manual",
    headers: { // 使用Cookies绕过年龄检查和成人内容提示，并强制中文
      "Cookie": "lastagecheckage=1-January-1975; birthtime=157737601; mature_content=1; wants_mature_content=1; Steam_Language=schinese"
    }
  });

  // 不存在的资源会被302到首页，故检查标题
  if (steam_page_resp.status === 302) {
    return Object.assign(data, {
      error: NONE_EXIST_ERROR
    });
  } else if (steam_page_resp.status === 403) {
    return Object.assign(data, {
      error: "GenHelp was temporary banned by Steam Server, Please wait...."
    });
  }

  data["steam_id"] = sid;

  // 立即请求附加资源
  let steamcn_api_req = fetch(`https://steamdb.keylol.com/app/${sid}/data.js?v=38`);
  let $ = page_parser(await steam_page_resp.text());

  // 从网页中定位数据
  let name_anchor = $("div.apphub_AppName") || $("span[itemprop=\"name\"]"); // 游戏名
  let cover_anchor = $("img.game_header_image_full[src]"); // 游戏封面图
  let detail_anchor = $("div.details_block"); // 游戏基本信息
  let linkbar_anchor = $("a.linkbar"); // 官网
  let language_anchor = $("table.game_language_options tr[class!=unsupported]"); // 支持语言
  let tag_anchor = $("a.app_tag"); // 标签
  let rate_anchor = $("div.user_reviews_summary_row"); // 游戏评价
  let descr_anchor = $("div#game_area_description"); // 游戏简介
  let sysreq_anchor = $("div.sysreq_contents > div.game_area_sys_req"); // 系统需求
  let screenshot_anchor = $("div.screenshot_holder a"); // 游戏截图
  let screenshot_props_div = $("div.gamehighlight_desktopcarousel[data-props]"); // 新版页面中的截图数据

  data["cover"] = data["poster"] = cover_anchor ? cover_anchor.attr("src").replace(/^(.+?)(\?t=\d+)?$/, "$1") : "";
  data["name"] = name_anchor ? name_anchor.text().trim() : "";
  data["detail"] = detail_anchor ?
    detail_anchor.eq(0).text()
      .replace(/:[ 	\n]+/g, ": ")
      .split("\n")
      .map(x => x.trim())
      .filter(x => x.length > 0)
      .join("\n") : "";
  data["tags"] = tag_anchor ? tag_anchor.map(function () {
    return $(this).text().trim();
  }).get() : [];
  data["review"] = rate_anchor ? rate_anchor.map(function () {
    return $(this).text().replace("：", ":").replace(/[ 	\n]{2,}/ig, " ").trim();
  }).get() : [];
  if (linkbar_anchor && linkbar_anchor.length > 0) {
    let href = linkbar_anchor.attr("href") || "";
    // 提取真实目标地址并进行解码
    let match = href.match(/url=([^&]+)/);
    if (match) {
      try {
        href = decodeURIComponent(match[1]);
      } catch (e) {
        href = match[1];
      }
    }
    data["linkbar"] = href;
  }

  const lag_checkcol_list = ["界面", "完全音频", "字幕"];
  data["language"] = language_anchor ?
    language_anchor
      .slice(1) // 跳过表头行，处理所有语言
      .map(function () {
        let tag = $(this);
        let tag_td_list = tag.find("td");
        let lag_support_checkcol = [];
        let lag = tag_td_list.eq(0).text().trim();

        for (let i = 0; i < lag_checkcol_list.length; i++) {
          let j = tag_td_list.eq(i + 1);
          if (j.text().includes("✔")) {
            lag_support_checkcol.push(lag_checkcol_list[i]);
          }
        }

        return `${lag}${lag_support_checkcol.length > 0 ? ` (${lag_support_checkcol.join(", ")})` : ""}`;
      }).get() : [];

  // 去除描述中的标题和图片，保留纯文本说明
  if (descr_anchor) {
    let descr_bbcode = html2bbcode(descr_anchor.html() || "");

    // 清理 h2 / 图片
    descr_bbcode = descr_bbcode
      // 删除特定引导标题
      .replace(/\[h2\]关于这款游戏\[\/h2\]/ig, "")
      .replace(/\[h2\]关于此游戏\[\/h2\]/ig, "")
      // 删除空的 h2 块
      .replace(/\[h2\]\s*\[\/h2\]/ig, "")
      // 其它 h2 保留内容，去掉标签
      .replace(/\[h2\]([\s\S]*?)\[\/h2\]/ig, "$1")
      // 删除所有图片
      .replace(/\[img\][\s\S]*?\[\/img\]/ig, "");

    // 将 [ul]/[ol]/[list] 结构转换为 [*] 列表项
    descr_bbcode = descr_bbcode
      .replace(/\[\/?(ul|ol|list)\]/ig, "")
      .replace(/\[li\]/ig, "[*]")
      .replace(/\[\/li\]/ig, "");

    // 去掉多余空行
    data["descr"] = descr_bbcode
      .split("\n")
      .map(x => x.trim())
      .filter(x => x.length > 0)
      .join("\n")
      .trim();
  } else {
    data["descr"] = "";
  }

  // 截图处理：优先从新版 data-props 中解析，其次兼容旧版 screenshot_holder 结构
  function normalizeScreenshotUrl(url) {
    if (!url) return "";
    url = url.replace(/&amp;/g, "&");
    url = url.replace(/\?t=\d+$/, "");
    let m = url.match(/^https?:\/\/[^\/]+(\/store_item_assets\/steam\/apps\/.+)$/);
    if (m) {
      return "https://shared.akamai.steamstatic.com" + m[1];
    }
    return url;
  }

  data["screenshot"] = [];

  if (screenshot_props_div && screenshot_props_div.length > 0) {
    let props_raw = screenshot_props_div.attr("data-props") || "";
    if (props_raw.length > 0) {
      try {
        let json_text = props_raw.replace(/&quot;/g, '"');
        let props = JSON.parse(json_text);
        if (props && Array.isArray(props.screenshots)) {
          data["screenshot"] = props.screenshots.map(s => {
            return normalizeScreenshotUrl(s.full || s.standard || s.thumbnail);
          }).filter(x => x && x.length > 0);
        }
      } catch (e) {
        // ignore parse error, fallback to old method
      }
    }
  }

  if ((!data["screenshot"] || data["screenshot"].length === 0) && screenshot_anchor && screenshot_anchor.length > 0) {
    data["screenshot"] = screenshot_anchor.map(function () {
      let dic = $(this);
      let href = dic.attr("href") || "";
      let cleaned = href.replace(/^.+?url=(http.+?)\.[\dx]+(.+?)(\?t=\d+)?$/, "$1$2");
      return normalizeScreenshotUrl(cleaned);
    }).get();
  }

  const os_dict = {
    "win": "Windows",
    "mac": "Mac OS X",
    "linux": "SteamOS + Linux"
  };
  data["sysreq"] = sysreq_anchor ? sysreq_anchor.map(function () {
    let tag = $(this);
    let os_type = os_dict[tag.attr("data-os")];

    let clone_tag = tag.clone();
    clone_tag.html(tag.html().replace(/<br>/ig, "[br]"));

    let sysreq_content = clone_tag
      .text()
      .split("\n").map(x => x.trim()).filter(x => x.length > 0).join("\n\n") // 处理最低配置和最高配置之间的空白行
      .split("[br]").map(x => x.trim()).filter(x => x.length > 0).join("\n"); // 处理配置内的分行

    return `${os_type}\n${sysreq_content}`;
  }).get() : [];

  // 处理附加资源
  let steamcn_api_resp = await steamcn_api_req;
  let steamcn_api_jsonp = await steamcn_api_resp.text();
  let steamcn_api_json = jsonp_parser(steamcn_api_jsonp);
  if (steamcn_api_json["name_cn"]) data["name_chs"] = steamcn_api_json["name_cn"];

  // 解析 detail 中的关键信息
  let name_line = "";
  let type_line = "";
  let dev_line = "";
  let pub_line = "";
  let release_line = "";
  if (data["detail"]) {
    let detail_lines = data["detail"].split("\n").map(x => x.trim()).filter(x => x.length > 0);
    detail_lines.forEach(line => {
      if (line.startsWith("名称:")) name_line = line;
      else if (line.startsWith("类型:")) type_line = line;
      else if (line.startsWith("开发者:")) dev_line = line;
      else if (line.startsWith("发行商:")) pub_line = line;
      else if (line.startsWith("发行日期:")) release_line = line;
    });
  }

  // 名称优先使用中文名
  let display_name = "";
  if (data["name_chs"]) {
    display_name = data["name_chs"].trim();
  } else if (name_line) {
    display_name = name_line.replace(/^名称:\s*/, "").trim();
  } else if (data["name"]) {
    display_name = data["name"].trim();
  }

  // 语言按“界面和字幕 / 完全音频”进行归类
  let ui_and_sub_langs = [];
  let full_audio_langs = [];
  if (data["language"] && data["language"].length > 0) {
    data["language"].forEach(l => {
      let name = l;
      let caps = [];
      let m = l.match(/^(.+?)\s*\((.+)\)$/);
      if (m) {
        name = m[1].trim();
        caps = m[2].split(/\s*,\s*/);
      }
      if (caps.includes("界面") && caps.includes("字幕")) {
        ui_and_sub_langs.push(name);
      }
      if (caps.includes("完全音频")) {
        full_audio_langs.push(name);
      }
    });
  }

  // 处理系统配置（仅输出 Windows，并转为带列表的格式）
  let windows_min = [];
  let windows_rec = [];
  if (data["sysreq"] && data["sysreq"].length > 0) {
    let win_block = data["sysreq"].find(x => x.startsWith("Windows"));
    if (win_block) {
      let lines = win_block.split("\n").slice(1); // 去掉首行 Windows
      let section = "";
      lines.forEach(line => {
        line = line.trim();
        if (!line) return;
        if (line.startsWith("最低配置")) {
          section = "min";
          return;
        }
        if (line.startsWith("推荐配置")) {
          section = "rec";
          return;
        }
        if (section === "min") {
          windows_min.push(line);
        } else if (section === "rec") {
          windows_rec.push(line);
        }
      });
    }
  }

  function formatSysLines(lines) {
    return lines.map(line => {
      let m = line.match(/^([^:：]+)\s*[:：]\s*(.+)$/);
      if (m) {
        return `[*][b]${m[1]}[/b]: ${m[2]}`;
      } else {
        return `[*]${line}`;
      }
    }).join("\n");
  }

  // 生成 format
  let header_img = `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${sid}/header.jpg`;
  let library_img = `https://steamcdn-a.akamaihd.net/steam/apps/${sid}/library_600x900_2x.jpg`;

  let descr = "";
  descr += `[img]${header_img}[/img]\n\n`;
  descr += `[img]${library_img}[/img]\n\n`;

  descr += "【基本信息】\n\n";
  if (display_name) {
    descr += `名称: ${display_name}\n`;
  }
  if (type_line) descr += `${type_line}\n`;
  if (dev_line) descr += `${dev_line}\n`;
  if (pub_line) descr += `${pub_line}\n`;
  if (release_line) descr += `${release_line}\n`;
  if (data["linkbar"]) descr += `官方网站: ${data["linkbar"]}\n`;
  if (data["steam_id"]) descr += `Steam页面: https://store.steampowered.com/app/${data["steam_id"]}\n`;

  if (ui_and_sub_langs.length > 0 || full_audio_langs.length > 0) {
    descr += "游戏语种: ";
    if (ui_and_sub_langs.length > 0) {
      descr += `[b]界面和字幕语言[/b]: ${ui_and_sub_langs.join("、")}\n`;
    }
    if (full_audio_langs.length > 0) {
      // 使用全角空格做缩进，对齐示例
      descr += "　　　　  [b]完全音频语言[/b]: " + full_audio_langs.join("、") + "\n";
    }
  }

  descr += "\n【游戏简介】\n\n";
  if (data["descr"]) {
    descr += `${data["descr"]}\n\n`;
  }

  // 安装信息为固定模板
  descr += GAME_INSTALL_TEMPLATE + "\n\n";

  if (windows_min.length > 0 || windows_rec.length > 0) {
    descr += "【配置需求】\n\n";
    descr += "Windows\n\n";
    if (windows_min.length > 0) {
      descr += "[b]最低配置[/b]\n";
      descr += formatSysLines(windows_min) + "\n";
    }
    if (windows_rec.length > 0) {
      descr += "[b]推荐配置[/b]\n";
      descr += formatSysLines(windows_rec) + "\n";
    }
    descr += "\n";
  }

  if (data["screenshot"] && data["screenshot"].length > 0) {
    descr += "【游戏截图】\n\n";
    descr += data["screenshot"].map(x => `[img]${x}[/img]`).join("\n") + "\n\n";
  }

  data["format"] = descr.trim();
  data["success"] = true; // 更新状态为成功
  return data;
}
