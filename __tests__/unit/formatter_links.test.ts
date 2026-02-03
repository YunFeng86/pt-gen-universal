import { describe, it, expect } from 'vitest';
import { MarkdownFormatter } from '../../lib/formatters/markdown';
import { BBCodeFormatter } from '../../lib/formatters/bbcode';
import type { MediaInfo } from '../../lib/types/schema';

function baseMediaInfo(overrides: Partial<MediaInfo>): MediaInfo {
  return {
    site: 'douban',
    id: '0',
    chinese_title: '',
    foreign_title: '',
    aka: [],
    trans_title: [],
    this_title: [],
    year: '',
    playdate: [],
    region: [],
    genre: [],
    language: [],
    duration: '',
    episodes: '',
    seasons: '',
    poster: '',
    director: [],
    writer: [],
    cast: [],
    introduction: '',
    awards: '',
    tags: [],
    ...overrides,
  };
}

describe('Formatters - show links even when rating missing', () => {
  it('MarkdownFormatter should render douban link without rating', () => {
    const f = new MarkdownFormatter();
    const info = baseMediaInfo({
      site: 'douban',
      id: '1292052',
      douban_link: 'https://movie.douban.com/subject/1292052/',
      // No douban_rating / ratings.douban
      this_title: ['The Shawshank Redemption'],
    });

    const out = f.format(info);
    expect(out).toContain('## 评分');
    expect(out).toContain('[链接](https://movie.douban.com/subject/1292052/)');
  });

  it('MarkdownFormatter should render bangumi link without rating', () => {
    const f = new MarkdownFormatter();
    const info = baseMediaInfo({
      site: 'bangumi',
      id: '1',
      link: 'https://bgm.tv/subject/1',
      this_title: ['Bangumi Title'],
      // No ratings.bangumi
    });

    const out = f.format(info);
    expect(out).toContain('## 评分');
    expect(out).toContain('[链接](https://bgm.tv/subject/1)');
    expect(out).toContain('来源于 [Bangumi](https://bgm.tv/subject/1)');
  });

  it('BBCodeFormatter should render bangumi link without rating', () => {
    const f = new BBCodeFormatter();
    const info = baseMediaInfo({
      site: 'bangumi',
      id: '1',
      link: 'https://bgm.tv/subject/1',
      this_title: ['Bangumi Title'],
    });

    const out = f.format(info);
    expect(out).toContain('◎Bangumi链接');
    expect(out).toContain('https://bgm.tv/subject/1');
  });
});

