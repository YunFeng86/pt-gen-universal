import * as cheerio from "cheerio"; // HTML页面解析
import html2bbcodeModule from "html2bbcode";
const { HTML2BBCode } = html2bbcodeModule;

// 常量定义（支持通过 globalThis 覆盖）
export const AUTHOR = globalThis['AUTHOR'] || "YunFeng";
export const VERSION = "2.0.0";

export const NONE_EXIST_ERROR = "The corresponding resource does not exist.";

// 游戏安装信息模板
export const GAME_INSTALL_TEMPLATE = `【安装信息】

1. 解压缩
2. 载入镜像
3. 安装游戏
4. 复制镜像中的Crack文件夹(也可能是RUNE、TENOKE、SKIDROW等小组名称的文件夹)内的未加密补丁到游戏目录中覆盖
5. 运行游戏`;

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

