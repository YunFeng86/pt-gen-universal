import { page_parser, NONE_EXIST_ERROR } from "./common.js";

export async function search_bangumi(query) {
  const tp_dict = {1: "漫画/小说", 2: "动画/二次元番", 3: "音乐", 4: "游戏", 6: "三次元番"};
  let bgm_search = await fetch(`https://api.bgm.tv/search/subject/${encodeURIComponent(query)}?responseGroup=large`)
  let bgm_search_json = await bgm_search.json();
  const list = Array.isArray(bgm_search_json.list) ? bgm_search_json.list : [];
  return {
    data: list.map(d => {
      const year = d['air_date'] ? d['air_date'].slice(0, 4) : '';
      return {
        year: year,
        subtype: tp_dict[d['type']],
        title: d['name_cn'] !== '' ? d['name_cn'] : d['name'],
        subtitle: d['name'],
        link: d['url']
      }
    })
  }
}

export async function gen_bangumi(sid) {
  let data = {
    site: "bangumi",
    sid: sid
  };

  // 请求页面
  let bangumi_link = `https://bgm.tv/subject/${sid}`;
  let bangumi_page_resp = await fetch(bangumi_link);
  let bangumi_page_raw = await bangumi_page_resp.text();
  if (bangumi_page_raw.match(/呜咕，出错了/)) {
    return Object.assign(data, {
      error: NONE_EXIST_ERROR
    });
  }

  data["alt"] = bangumi_link;

  // 立即请求附加资源
  let bangumi_characters_req = fetch(`${bangumi_link}/characters`)

  let $ = page_parser(bangumi_page_raw);

  // 对页面进行划区
  let cover_staff_another = $("div#bangumiInfo");
  let cover_another = cover_staff_another.find("a.thickbox.cover");
  let info_another = cover_staff_another.find("ul#infobox");
  let story_another = $("div#subject_summary");
  // let cast_another = $('div#browserItemList');

  /*  data['cover'] 为向前兼容项，之后均用 poster 表示海报
   *  这里有个问题，就是仍按 img.attr('src') 会取不到值因为 cf-worker中fetch 返回的html片段如下 ： https://pastebin.com/0wPLAf8t
   *  暂时不明白是因为 cf-worker 的问题还是 cf-CDN 的问题，因为直接源代码审查未发现该片段。
   */
  data["cover"] = data["poster"] = cover_another.length ? ("https:" + cover_another.attr("href")).replace(/\/cover\/[lcmsg]\//, "/cover/l/") : "";
  data["story"] = story_another.length ? story_another.text().trim() : "";

  // 中文名、话数、放送开始、放送星期等信息 不视为staff列表项，将其转存进info项中
  let info = info_another.find("li").map(function () {
    return $(this).text();
  }).get();
  data["staff"] = info.filter(d => {
    return !/^(中文名|话数|放送开始|放送星期|别名|官方网站|播放电视台|其他电视台|Copyright)/.test(d)
  });
  data["info"] = info.filter(d => !(data["staff"].includes(d)));

  // ---其他页面信息，但是暂未放入format中

  // 评分信息
  data["bangumi_votes"] = $('span[property="v:votes"]').text();
  data["bangumi_rating_average"] = $('div.global_score > span[property="v:average"]').text();

  // 标签
  data["tags"] = $('#subject_detail > div.subject_tag_section > div > a > span').map(function () {
    return $(this).text()
  }).get()

  // ---其他暂未放入format的页面信息结束

  // 角色信息
  let bangumi_characters_resp = await bangumi_characters_req;
  let bangumi_characters_page_raw = await bangumi_characters_resp.text();
  let bangumi_characters_page = page_parser(bangumi_characters_page_raw);
  let cast_actors = bangumi_characters_page("div#columnInSubjectA > div.light_odd > div.clearit");

  data["cast"] = cast_actors.map(function () {
    let tag = bangumi_characters_page(this);
    let h2 = tag.find("h2");
    let tip = h2.find("span.tip");
    let char = (tip.length ? tip.text() : h2.find("a").text()).replace(/\//, "").trim();
    let cv = tag.find("div.clearit > p").map(function () {
      let p = bangumi_characters_page(this);
      let small = p.find("small");
      return (small.length ? small : p.find("a")).text().trim();
    }).get().join("，");
    return `${char}: ${cv}`;
  }).get();

  // 生成format
  let descr = (data["poster"] && data["poster"].length > 0) ? `[img]${data["poster"]}[/img]\n\n` : "";

  // 解析info信息，按类型分组展示
  const infoMap = {};
  if (data["info"] && data["info"].length > 0) {
    data["info"].forEach(item => {
      const match = item.match(/^([\u4e00-\u9fa5]+|[A-Za-z]+)[:：]\s*(.+)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim();
        infoMap[key] = value;
      }
    });
  }

  // 按照豆瓣格式组织输出内容，将中文名和别名都作为译名
  let aliases = [];

  // 添加中文名
  if (infoMap["中文名"]) aliases.push(infoMap["中文名"]);

  // 处理别名 - 这里是问题所在
  if (infoMap["别名"]) {
    // 原代码分割错误，只使用了 '/' 作为分隔符，而实际上是用空格和斜杠的组合分隔的
    // 修改为能识别 "BTR / Bocchi the Rock! / Bocchi the \"Guitar Hero\" Rock Story" 这样的格式
    const aliasText = infoMap["别名"];
    // 使用正则表达式处理引号内的特殊情况
    let inQuote = false;
    let currentAlias = '';
    let processedAliases = [];
    
    for (let i = 0; i < aliasText.length; i++) {
      const char = aliasText[i];
      
      // 处理引号
      if (char === '"') {
        inQuote = !inQuote;
        currentAlias += char;
      }
      // 如果遇到分隔符且不在引号内，则结束当前别名
      else if (char === '/' && !inQuote) {
        processedAliases.push(currentAlias.trim());
        currentAlias = '';
      }
      // 否则添加到当前别名
      else {
        currentAlias += char;
      }
    }
    
    // 添加最后一个别名
    if (currentAlias.trim()) {
      processedAliases.push(currentAlias.trim());
    }
    
    // 过滤空值并添加到别名列表
    processedAliases.filter(a => a).forEach(alias => {
      if (!aliases.includes(alias)) {
        aliases.push(alias);
      }
    });
  }

  // 如果有任何译名，就输出
  if (aliases.length > 0) {
    descr += `◎译　　名　${aliases.join(' / ')}\n`;
  }

  descr += `◎片　　名　${$('h1.nameSingle > a').text().trim()}\n`;
  descr += `◎年　　代　${$('#infobox li:contains("放送开始")').text().replace("放送开始: ", "").trim().substring(0, 4)}\n`;
  descr += data["tags"] && data["tags"].length > 0 ? `◎类　　别　${data["tags"].join(" / ")}\n` : "";
  descr += infoMap["放送开始"] ? `◎上映日期　${infoMap["放送开始"]}\n` : "";
  descr += data["bangumi_rating_average"] && data["bangumi_votes"] ? `◎Bangumi评分　${data["bangumi_rating_average"]}/10 from ${data["bangumi_votes"]} users\n` : "";
  descr += data["alt"] ? `◎Bangumi链接　${data["alt"]}\n` : "";
  descr += infoMap["话数"] ? `◎话　　数　${infoMap["话数"]}\n` : "";

  // 添加Staff信息（类似于豆瓣的导演和编剧）
  if (data["staff"] && data["staff"].length > 0) {
    const directors = data["staff"].filter(s => s.includes("监督") || s.includes("导演")).slice(0, 2);
    const writers = data["staff"].filter(s => s.includes("脚本") || s.includes("系列构成")).slice(0, 2);
    
    if (directors.length > 0) {
      descr += `◎导　　演　${directors.map(d => d.split(": ")[1]).join(" / ")}\n`;
    }
    
    if (writers.length > 0) {
      descr += `◎编　　剧　${writers.map(w => w.split(": ")[1]).join(" / ")}\n`;
    }
  }

  // 添加Cast信息（类似于豆瓣的主演）
  if (data["cast"] && data["cast"].length > 0) {
    descr += `◎主　　演　${data["cast"].slice(0, 9).join("\n" + "　".repeat(4) + "  　").trim()}\n`;
  }

  // 添加其他Staff信息（除了已经作为导演和编剧显示的）
  if (data["staff"] && data["staff"].length > 0) {
    const otherStaff = data["staff"].filter(s => 
      !s.includes("监督") && !s.includes("导演") && 
      !s.includes("脚本") && !s.includes("系列构成")
    ).slice(0, 15);
    
    if (otherStaff.length > 0) {
      descr += `\n◎制作人员\n\n　　${otherStaff.join("\n　　")}\n`;
    }
  }

    // 添加剧情简介
    if (data["story"] && data["story"].length > 0) {
      descr += `\n◎简　　介\n\n　　${data["story"].replace(/\n/g, "\n" + "　".repeat(2))}\n\n`;
    }  

    // 添加来源
    descr += (data["alt"] && data["alt"].length > 0) ? `(来源于 ${data["alt"]} )\n` : "";

  data["format"] = descr.trim();
  data["success"] = true; // 更新状态为成功
  return data;
}
