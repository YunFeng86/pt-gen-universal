import * as cheerio from "cheerio"; // HTML页面解析
import html2bbcodeModule from "html2bbcode";
const { HTML2BBCode } = html2bbcodeModule;

// 常量定义（支持通过 globalThis 覆盖）
export const AUTHOR = globalThis['AUTHOR'] || "YunFeng";
export const VERSION = "2.0.0";

export const NONE_EXIST_ERROR = "The corresponding resource does not exist.";

// 解析HTML页面
export function page_parser(responseText) {
  return cheerio.load(responseText, {
    decodeEntities: false
  });
}

// 解析JSONP返回
export function jsonp_parser(responseText) {
  try {
    responseText = responseText.replace(/\n/ig, '').match(/[^(]+\((.+)\)/)[1];
    return JSON.parse(responseText);
  } catch (e) {
    return {}
  }
}

// Html2bbcode
export function html2bbcode(html) {
  let converter = new HTML2BBCode();
  let bbcode = converter.feed(html);
  return bbcode.toString();
}

