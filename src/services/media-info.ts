import { BBCodeFormatter } from '../../lib/formatters/bbcode';
import { MarkdownFormatter } from '../../lib/formatters/markdown';
import { Orchestrator } from '../../lib/orchestrator';
import { AppError, ErrorCode } from '../../lib/errors';
import type { MediaInfo } from '../../lib/types/schema';

export interface MediaLocator {
  url?: string;
  site?: string;
  sid?: string;
}

export type MediaInfoFormat = 'json' | 'bbcode' | 'markdown';

export interface MediaResolveResult {
  site: string;
  sid: string;
  info: MediaInfo;
}

export class MediaInfoService {
  private readonly bbcodeFormatter = new BBCodeFormatter();
  private readonly markdownFormatter = new MarkdownFormatter();

  constructor(private readonly orchestrator: Orchestrator) {}

  async resolve(locator: MediaLocator): Promise<MediaResolveResult> {
    if (locator.url) {
      const { site, sid } = this.orchestrator.matchUrl(locator.url);
      const info = await this.orchestrator.getMediaInfo(site, sid);
      return { site, sid, info };
    }

    if (locator.site && locator.sid) {
      const info = await this.orchestrator.getMediaInfo(locator.site, locator.sid);
      return {
        site: locator.site,
        sid: locator.sid,
        info,
      };
    }

    throw new AppError(ErrorCode.INVALID_PARAM, "Missing 'url' or 'site/sid' parameters");
  }

  renderFormats(info: MediaInfo): { bbcode: string; markdown: string; json: string } {
    return {
      bbcode: this.bbcodeFormatter.format(info),
      markdown: this.markdownFormatter.format(info),
      json: JSON.stringify(info, null, 2),
    };
  }

  renderFormat(info: MediaInfo, format: MediaInfoFormat): string | undefined {
    if (format === 'json') return undefined;
    if (format === 'markdown') return this.markdownFormatter.format(info);
    return this.bbcodeFormatter.format(info);
  }
}
