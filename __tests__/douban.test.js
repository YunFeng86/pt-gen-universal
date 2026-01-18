import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseDoubanSubjectHtml } from '../lib/douban.js'

const desktopHtml = readFileSync(new URL('./fixtures/douban.html', import.meta.url), 'utf-8')
const mobileHtml = readFileSync(new URL('./fixtures/douban_m.html', import.meta.url), 'utf-8')

describe('Douban HTML parsing', () => {
  it('parses desktop HTML sample', () => {
    const data = parseDoubanSubjectHtml(desktopHtml, '1292052')

    expect(data.success).toBe(true)
    expect(data.site).toBe('douban')
    expect(data.douban_link).toBe('https://movie.douban.com/subject/1292052/')
    expect(data.year.trim()).toBe('1994')
    expect(data.trans_title).toContain('肖申克的救赎')
    expect(data.this_title).toContain('The Shawshank Redemption')
    expect(String(data.douban_rating_average)).toBe('9.7')
    expect(String(data.douban_rating)).toContain('9.7/10')
    expect(data.genre).toContain('剧情')
  })

  it('parses mobile HTML sample', () => {
    const data = parseDoubanSubjectHtml(mobileHtml, '1292052')

    expect(data.success).toBe(true)
    expect(data.site).toBe('douban')
    expect(data.year.trim()).toBe('1994')
    expect(data.region).toEqual(['美国'])
    expect(data.genre).toEqual(['剧情', '犯罪'])
    expect(data.playdate).toContain('1994-09-10(多伦多电影节)')
    expect(data.duration).toBe('142分钟')
    expect(String(data.douban_rating_average)).toBe('9.7')
    expect(data.introduction).toContain('一场谋杀案使银行家安迪')
  })
})
