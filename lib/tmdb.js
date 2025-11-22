import {jsonp_parser, NONE_EXIST_ERROR, page_parser} from "./common.js";

/* global TMDB_API_KEY */

// 如果设置了TMDB_API_KEY环境变量，则使用它，否则保持为空
let api_key = '';
if (globalThis['TMDB_API_KEY']) {
  api_key = globalThis['TMDB_API_KEY'];
}

// TMDB搜索函数，用于搜索电影
export async function search_tmdb(query) {
  // 检查是否有API密钥
  if (!api_key) {
    return {
      error: "需要TMDB API密钥。请在环境变量中设置TMDB_API_KEY。"
    };
  }

  try {
    let tmdb_search_url = `https://api.themoviedb.org/3/search/multi?api_key=${api_key}&query=${encodeURIComponent(query)}&language=zh-CN`;
    let tmdb_search = await fetch(tmdb_search_url);
    
    if (!tmdb_search.ok) {
      return {
        error: `TMDB API请求失败: ${tmdb_search.status} ${tmdb_search.statusText}`
      };
    }
    
    let tmdb_search_json = await tmdb_search.json();

    if (tmdb_search_json.success === false) {
      return {
        error: tmdb_search_json.status_message || "搜索失败"
      };
    }

    return {
      data: tmdb_search_json.results
        .filter(item => item.media_type === 'movie' || item.media_type === 'tv')
        .map(item => {
          const year = item.release_date 
            ? item.release_date.substring(0, 4) 
            : (item.first_air_date ? item.first_air_date.substring(0, 4) : '');
          return {
            year: year,
            subtype: item.media_type === 'movie' ? '电影' : '剧集',
            title: item.title || item.name,
            subtitle: item.original_title || item.original_name,
            link: `https://www.themoviedb.org/${item.media_type}/${item.id}`,
            id: item.id,
            media_type: item.media_type
          }
        })
    }
  } catch (error) {
    console.error("TMDB搜索错误:", error);
    return {
      error: `搜索过程中出现错误: ${error.message}`
    };
  }
}

// 生成TMDB详细信息
export async function gen_tmdb(sid) {
  console.log(`开始处理 TMDB 输入: ${sid}`);
  
  // 处理完整的 TMDB URL
  if (sid.startsWith('http')) {
    try {
      const url = new URL(sid);
      const pathSegments = url.pathname.split('/').filter(segment => segment);
      
      if (pathSegments.length >= 2) {
        const media_type = pathSegments[0]; // 'movie' 或 'tv'
        let idPart = pathSegments[1]; // '1197306-a-working-man'
        
        // 如果 ID 包含连字符和标题，只取连字符前面的部分
        if (idPart.includes('-')) {
          idPart = idPart.split('-')[0]; // 提取 '1197306'
        }
        
        console.log(`从 URL 解析: 类型=${media_type}, ID=${idPart}`);
        sid = `${media_type}-${idPart}`;
      } else {
        return {
          site: "tmdb",
          sid: sid,
          error: "无效的 TMDB URL 格式",
          success: false
        };
      }
    } catch (e) {
      console.error("URL 解析错误:", e);
      return {
        site: "tmdb",
        sid: sid,
        error: "URL 解析失败: " + e.message,
        success: false
      };
    }
  }
  
  // 如果sid包含类型前缀（如movie-123或tv-456），则分离它们
  let media_type = 'movie';
  let id = sid;
  
  if (sid.includes('-')) {
    const parts = sid.split('-');
    media_type = parts[0];
    id = parts[1];
  }

  let data = {
    site: "tmdb",
    sid: sid
  };

  if (!api_key) {
    return Object.assign(data, {
      error: "TMDB API key is required. Please set TMDB_API_KEY in your environment variables."
    });
  }

  // 构造TMDB API URL
  let tmdb_url = `https://api.themoviedb.org/3/${media_type}/${id}?api_key=${api_key}&language=zh-CN&append_to_response=credits,external_ids,images,keywords,release_dates,content_ratings,videos`;
  let tmdb_link = `https://www.themoviedb.org/${media_type}/${id}`;
  
  // 请求TMDB API获取详细信息
  let tmdb_resp = await fetch(tmdb_url);
  let tmdb_json = await tmdb_resp.json();

  // 处理可能的错误
  if (tmdb_json.success === false || tmdb_resp.status === 404) {
    return Object.assign(data, {
      error: NONE_EXIST_ERROR
    });
  }

  // 存储TMDB链接
  data["tmdb_link"] = tmdb_link;
  
  // 基础信息
  data["title"] = tmdb_json.title || tmdb_json.name;
  data["original_title"] = tmdb_json.original_title || tmdb_json.original_name;
  data["year"] = tmdb_json.release_date 
    ? tmdb_json.release_date.substring(0, 4) 
    : (tmdb_json.first_air_date ? tmdb_json.first_air_date.substring(0, 4) : '');
  
  // 处理海报
  if (tmdb_json.poster_path) {
    data["poster"] = `https://image.tmdb.org/t/p/original${tmdb_json.poster_path}`;
  }

  // 处理评分信息
  data["tmdb_rating_average"] = tmdb_json.vote_average || 0;
  data["tmdb_votes"] = tmdb_json.vote_count || 0;
  data["tmdb_rating"] = `${data["tmdb_rating_average"]}/10 from ${data["tmdb_votes"]} users`;
  
  // 处理类型
  data["genre"] = tmdb_json.genres ? tmdb_json.genres.map(g => g.name) : [];
  
  // 处理发布日期和国家/地区
  data["region"] = tmdb_json.production_countries ? tmdb_json.production_countries.map(c => c.name) : [];
  data["playdate"] = tmdb_json.release_date || tmdb_json.first_air_date || '';

  // 处理语言
  data["language"] = tmdb_json.spoken_languages ? tmdb_json.spoken_languages.map(l => l.name) : [];
  
  // 处理剧集信息（如果是电视剧）
  if (media_type === 'tv') {
    data["episodes"] = tmdb_json.number_of_episodes ? tmdb_json.number_of_episodes.toString() : "";
    data["seasons"] = tmdb_json.number_of_seasons ? tmdb_json.number_of_seasons.toString() : "";
  }
  
  // 处理片长（电影）或单集片长（剧集）
  data["duration"] = tmdb_json.runtime ? `${tmdb_json.runtime} 分钟` : 
    (tmdb_json.episode_run_time && tmdb_json.episode_run_time.length > 0 ? 
      `${tmdb_json.episode_run_time[0]} 分钟` : "");

  // 处理简介
  data["introduction"] = tmdb_json.overview || '暂无相关剧情介绍';

  // 处理导演、编剧和演员信息
  if (tmdb_json.credits) {
    // 导演（电影）或创作者（剧集）
    const directors = media_type === 'movie' 
      ? tmdb_json.credits.crew.filter(p => p.job === 'Director')
      : tmdb_json.created_by || [];
    
    data["director"] = directors.map(d => ({ name: d.name }));
    
    // 编剧
    const writers = tmdb_json.credits.crew.filter(p => 
      p.job === 'Writer' || p.job === 'Screenplay' || p.job === 'Story');
    data["writer"] = writers.map(w => ({ name: w.name }));
    
    // 演员
    data["cast"] = tmdb_json.credits.cast
      .slice(0, 20)
      .map(c => ({ name: c.name }));
  }
  
  // 处理外部ID
  if (tmdb_json.external_ids) {
    if (tmdb_json.external_ids.imdb_id) {
      data["imdb_id"] = tmdb_json.external_ids.imdb_id;
      data["imdb_link"] = `https://www.imdb.com/title/${tmdb_json.external_ids.imdb_id}/`;
    }
  }
  
  // 处理关键词
  if (tmdb_json.keywords) {
    const keywordList = tmdb_json.keywords.keywords || tmdb_json.keywords.results || [];
    data["tags"] = keywordList.map(k => k.name);
  }

  // 处理别名
  data["aka"] = [];
  if (tmdb_json.alternative_titles && tmdb_json.alternative_titles.titles) {
    data["aka"] = tmdb_json.alternative_titles.titles.map(t => t.title);
  }

  // 检查原始标题是否是中文
  const isChineseTitle = /[\u4e00-\u9fa5]/.test(data["original_title"]);

  // 如果是TV剧集或者没有获取到别名，则额外请求别名
  if ((media_type === 'tv' || data["aka"].length === 0)) {
    try {
      console.log(`获取 ${media_type} 的别名信息...`);
      const alt_titles_url = `https://api.themoviedb.org/3/${media_type}/${id}/alternative_titles?api_key=${api_key}`;
      const alt_titles_resp = await fetch(alt_titles_url);
      const alt_titles_json = await alt_titles_resp.json();
      
      if (alt_titles_json && (alt_titles_json.titles || alt_titles_json.results)) {
        const titles = alt_titles_json.titles || alt_titles_json.results;
        
        if (isChineseTitle) {
          // 如果原始标题是中文，获取英文译名
          console.log("原标题为中文，获取英文译名");
          const englishTitles = titles
            .filter(t => t.iso_3166_1 === 'US' || t.iso_3166_1 === 'GB' || t.iso_639_1 === 'en')
            .map(t => t.title);
          
          if (englishTitles.length > 0) {
            data["aka"] = englishTitles;
          } else {
            // 如果没有找到特定的英文译名，使用所有非中文区域的译名
            data["aka"] = titles
              .filter(t => t.iso_3166_1 !== 'CN' && t.iso_3166_1 !== 'TW' && t.iso_3166_1 !== 'HK')
              .map(t => t.title);
          }
        } else {
          // 如果原始标题是非中文，获取中文译名
          console.log("原标题为非中文，获取中文译名");
          const chineseTitles = titles
            .filter(t => t.iso_3166_1 === 'CN' || t.iso_3166_1 === 'TW' || t.iso_3166_1 === 'HK')
            .map(t => t.title);
          
          if (chineseTitles.length > 0) {
            data["aka"] = chineseTitles;
          }
        }
        
        console.log(`获取到 ${data["aka"].length} 个译名`);
      }
    } catch (error) {
      console.error("获取译名失败:", error);
    }
  }

  // 生成BBCode格式的描述
  let descr = data["poster"] ? `[img]${data["poster"]}[/img]\n\n` : "";
  
  // 构建译名（使用中文标题和别名）
  let trans_title = '';
  if (data["title"] !== data["original_title"]) {
    trans_title = data["title"];
    if (data["aka"] && data["aka"].length > 0) {
      trans_title += " / " + data["aka"].join(" / ");
    }
    descr += trans_title ? `◎译　　名　${trans_title}\n` : "";
  } else if (data["aka"] && data["aka"].length > 0) {
    // 如果标题和原始标题相同但有别名，也显示别名作为译名
    trans_title = data["aka"].join(" / ");
    descr += `◎译　　名　${trans_title}\n`;
  }
  
  // 原始标题
  descr += data["original_title"] ? `◎片　　名　${data["original_title"]}\n` : "";
  
  // 年代
  descr += data["year"] ? `◎年　　代　${data["year"]}\n` : "";
  
  // 产地
  descr += data["region"] && data["region"].length > 0 ? `◎产　　地　${data["region"].join(" / ")}\n` : "";
  
  // 类别
  descr += data["genre"] && data["genre"].length > 0 ? `◎类　　别　${data["genre"].join(" / ")}\n` : "";
  
  // 语言
  descr += data["language"] && data["language"].length > 0 ? `◎语　　言　${data["language"].join(" / ")}\n` : "";
  
  // 上映日期
  descr += data["playdate"] ? `◎上映日期　${data["playdate"]}\n` : "";
  
  // IMDB评分
  if (data["imdb_rating"]) {
    descr += `◎IMDb评分  ${data["imdb_rating"]}\n`;
  }
  
  // IMDB链接
  if (data["imdb_link"]) {
    descr += `◎IMDb链接  ${data["imdb_link"]}\n`;
  }
  
  // TMDB评分
  descr += `◎TMDB评分　${data["tmdb_rating"]}\n`;
  
  // TMDB链接
  descr += `◎TMDB链接　${data["tmdb_link"]}\n`;
  
  // 集数（如果是剧集）
  if (data["episodes"]) {
    descr += `◎集　　数　${data["episodes"]}\n`;
  }
  
  // 季数（如果是剧集）
  if (data["seasons"]) {
    descr += `◎季　　数　${data["seasons"]}\n`;
  }
  
  // 片长
  descr += data["duration"] ? `◎片　　长　${data["duration"]}\n` : "";
  
  // 导演
  descr += data["director"] && data["director"].length > 0 ? 
    `◎导　　演　${data["director"].map(x => x['name']).join(" / ")}\n` : "";
  
  // 编剧
  descr += data["writer"] && data["writer"].length > 0 ? 
    `◎编　　剧　${data["writer"].map(x => x['name']).join(" / ")}\n` : "";
  
  // 主演
  descr += data["cast"] && data["cast"].length > 0 ? 
    `◎主　　演　${data["cast"].map(x => x['name']).join("\n" + "　".repeat(4) + "  　").trim()}\n` : "";
  
  // 标签
  descr += data["tags"] && data["tags"].length > 0 ? 
    `\n◎标　　签　${data["tags"].join(" | ")}\n` : "";
  
  // 简介
  descr += data["introduction"] ? 
    `\n◎简　　介\n\n　　${data["introduction"].replace(/\n/g, "\n" + "　".repeat(2))}\n` : "";

  data["format"] = descr.trim();
  data["success"] = true; // 更新状态为成功
  return data;
}