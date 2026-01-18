import {NONE_EXIST_ERROR, html2bbcode, GAME_INSTALL_TEMPLATE} from "./common.js";

/**
 * 解析 GOG ID：如果是数字直接返回，如果是 slug 则通过 API 转换
 */
async function resolveGogId(sid) {
  // 纯数字 → 直接返回
  if (/^\d+$/.test(sid)) {
    return sid;
  }

  // slug → 通过 Catalog API 转换
  let catalog_resp = await fetch(`https://catalog.gog.com/v1/catalog?query=${encodeURIComponent(sid)}`);

  if (!catalog_resp.ok) {
    throw new Error(`GOG Catalog API returned status ${catalog_resp.status}`);
  }

  let catalog_json = await catalog_resp.json();

  if (!catalog_json.products || catalog_json.products.length === 0) {
    throw new Error(NONE_EXIST_ERROR);
  }

  // 精确匹配 slug
  let matched = catalog_json.products.find(p => p.slug === sid);
  if (!matched) {
    throw new Error(NONE_EXIST_ERROR);
  }

  return matched.id;
}

export async function gen_gog(sid) {
  let data = {
    site: "gog",
    sid: sid
  };

  // 解析 GOG ID
  let gog_id;
  try {
    gog_id = await resolveGogId(sid);
  } catch (e) {
    return Object.assign(data, { error: e.message });
  }

  // 请求 GOG API
  let gog_api_resp = await fetch(`https://api.gog.com/products/${gog_id}?expand=description,screenshots,videos`);

  if (gog_api_resp.status === 404) {
    return Object.assign(data, {
      error: NONE_EXIST_ERROR
    });
  }

  if (!gog_api_resp.ok) {
    return Object.assign(data, {
      error: `GOG API returned status ${gog_api_resp.status}`
    });
  }

  let gog_api_json = await gog_api_resp.json();

  data["gog_id"] = gog_id;
  data["name"] = gog_api_json["title"] || "";
  data["slug"] = gog_api_json["slug"] || "";

  // 封面和海报
  data["cover"] = "";
  data["poster"] = "";

  // 游戏简介
  let description = gog_api_json["description"] || {};
  let descr_html = description["full"] || description["lead"] || "";
  if (descr_html) {
    let descr_bbcode = html2bbcode(descr_html);
    // 清理 HTML 标签残留
    descr_bbcode = descr_bbcode
      .replace(/\[img\][\s\S]*?\[\/img\]/ig, "") // 删除图片
      .replace(/\[h2\][\s\S]*?\[\/h2\]/ig, "") // 删除标题
      .replace(/\[hr\]/ig, ""); // 删除分隔线

    data["descr"] = descr_bbcode
      .split("\n")
      .map(x => x.trim())
      .filter(x => x.length > 0)
      .join("\n")
      .trim();
  } else {
    data["descr"] = "";
  }

  // 支持语言
  let languages = gog_api_json["languages"] || {};
  data["language"] = Object.values(languages);

  // 平台支持
  let platforms = gog_api_json["content_system_compatibility"] || {};
  data["platforms"] = [];
  if (platforms["windows"]) data["platforms"].push("Windows");
  if (platforms["osx"]) data["platforms"].push("Mac OS X");
  if (platforms["linux"]) data["platforms"].push("Linux");

  // 截图（临时从 API 获取，后续从页面 JSON 更新）
  data["screenshot"] = [];

  // 爬取页面获取系统需求
  data["system_requirements"] = {};
  try {
    let page_url = `https://www.gog.com/en/game/${data["slug"]}`;
    let page_resp = await fetch(page_url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (page_resp.ok) {
      let page_html = await page_resp.text();

      // 提取 cardProduct JSON 数据（使用正则表达式）
      // 匹配 cardProduct: {...} 直到下一个顶层属性
      let card_match = page_html.match(/cardProduct:\s*(\{[\s\S]*?\})\s*(?:,\s*\w+:|$)/);
      if (!card_match) {
        // 如果上面的正则失败，尝试更宽松的匹配
        card_match = page_html.match(/cardProduct:\s*(\{[\s\S]*?\n\s*\})/);
      }

      if (card_match) {
        let card_product = JSON.parse(card_match[1]);

        // 更新竖屏海报
        if (card_product.boxArtImage) {
          data["poster"] = card_product.boxArtImage;
        }

        // 更新截图
        if (card_product.screenshots && card_product.screenshots.length > 0) {
          data["screenshot"] = card_product.screenshots.map(s => {
            let url = s.imageUrl || s;
            // 确保 URL 格式正确
            if (!url.startsWith('http')) {
              url = `https:${url}`;
            }
            // 添加高清后缀
            if (!url.includes('_ggvgl')) {
              url = `${url}_ggvgl_2x.jpg`;
            }
            return url;
          });
        }

        let supported_os = card_product.supportedOperatingSystems || [];

        // 解析系统需求（扁平化处理）
        for (let os_info of supported_os) {
          let os_name = os_info.operatingSystem?.name || "";
          let os_versions = os_info.operatingSystem?.versions || "";
          let sys_reqs = os_info.systemRequirements || [];

          if (!os_name || sys_reqs.length === 0) continue;

          data["system_requirements"][os_name] = {
            versions: os_versions,
            requirements: {}
          };

          // 处理每个需求组（minimum/recommended）
          for (let req_group of sys_reqs) {
            let req_type = req_group.type;
            let requirements = req_group.requirements || [];

            if (!req_type || requirements.length === 0) continue;

            // 使用 Object.fromEntries 一次性构建对象
            data["system_requirements"][os_name]["requirements"][req_type] = Object.fromEntries(
              requirements
                .filter(req => req.id && req.description)
                .map(req => [req.id, req.description])
            );
          }
        }
      }
    }
  } catch (e) {
    // 系统需求获取失败不影响主流程
    console.error('Failed to fetch system requirements:', e.message);
  }

  // 生成 format
  let poster_img = data["poster"];

  let descr = "";
  if (poster_img) descr += `[img]${poster_img}[/img]\n\n`;

  descr += "【基本信息】\n\n";
  if (data["name"]) {
    descr += `名称: ${data["name"]}\n`;
  }
  if (data["platforms"] && data["platforms"].length > 0) {
    descr += `平台: ${data["platforms"].join("、")}\n`;
  }
  if (data["gog_id"]) {
    descr += `GOG页面: https://www.gog.com/game/${data["slug"] || data["gog_id"]}\n`;
  }
  if (data["language"] && data["language"].length > 0) {
    descr += `游戏语种: ${data["language"].join("、")}\n`;
  }

  descr += "\n【游戏简介】\n\n";
  if (data["descr"]) {
    descr += `${data["descr"]}\n\n`;
  }

  // 系统需求
  if (Object.keys(data["system_requirements"]).length > 0) {
    descr += "【系统需求】\n\n";

    for (let [os_name, os_data] of Object.entries(data["system_requirements"])) {
      let os_display_name = os_name === "windows" ? "Windows" :
                            os_name === "osx" ? "Mac OS X" :
                            os_name === "linux" ? "Linux" : os_name;

      descr += `${os_display_name}`;
      if (os_data.versions) {
        descr += ` (${os_data.versions})`;
      }
      descr += ":\n\n";

      let reqs = os_data.requirements || {};

      // 最低配置
      if (reqs.minimum) {
        descr += "最低配置:\n";
        for (let [req_id, req_desc] of Object.entries(reqs.minimum)) {
          let req_name = req_id.charAt(0).toUpperCase() + req_id.slice(1);
          descr += `  ${req_name}: ${req_desc}\n`;
        }
        descr += "\n";
      }

      // 推荐配置
      if (reqs.recommended) {
        descr += "推荐配置:\n";
        for (let [req_id, req_desc] of Object.entries(reqs.recommended)) {
          let req_name = req_id.charAt(0).toUpperCase() + req_id.slice(1);
          descr += `  ${req_name}: ${req_desc}\n`;
        }
        descr += "\n";
      }
    }
  }

  // 安装信息为固定模板
  descr += GAME_INSTALL_TEMPLATE + "\n\n";

  if (data["screenshot"] && data["screenshot"].length > 0) {
    descr += "【游戏截图】\n\n";
    descr += data["screenshot"].map(x => `[img]${x}[/img]`).join("\n") + "\n\n";
  }

  data["format"] = descr.trim();
  data["success"] = true;
  return data;
}
