import { describe, it, expect } from 'vitest'
import { formatMovieInfo, BBCodeFormatter, MarkdownFormatter } from '../lib/formatter.js'

describe('Formatter 模块', () => {
    describe('BBCodeFormatter', () => {
        it('应该正确格式化基本电影信息', () => {
            const mockData = {
                poster: 'https://example.com/poster.jpg',
                trans_title: '肖申克的救赎',
                this_title: 'The Shawshank Redemption',
                year: '1994',
                region: ['美国'],
                genre: ['剧情', '犯罪'],
                language: ['英语'],
                playdate: ['1994-09-10(多伦多电影节)', '1994-10-14(美国)'],
                douban_rating: '9.7/10 from 2900000 users',
                douban_link: 'https://movie.douban.com/subject/1292052/',
                duration: '142分钟',
                director: ['弗兰克·德拉邦特'],
                writer: ['弗兰克·德拉邦特', '斯蒂芬·金'],
                cast: ['蒂姆·罗宾斯', '摩根·弗里曼'],
                tags: ['经典', '励志'],
                introduction: '20世纪40年代末，小有成就的青年银行家安迪（蒂姆·罗宾斯 Tim Robbins 饰）因涉嫌杀害妻子及她的情人而锒铛入狱。'
            }

            const result = formatMovieInfo(mockData, 'bbcode')

            expect(result).toContain('[img]https://example.com/poster.jpg[/img]')
            expect(result).toContain('◎译　　名　肖申克的救赎')
            expect(result).toContain('◎片　　名　The Shawshank Redemption')
            expect(result).toContain('◎年　　代　1994')
            expect(result).toContain('◎类　　别　剧情 / 犯罪')
            expect(result).toContain('◎导　　演　弗兰克·德拉邦特')
            expect(result).toContain('◎豆瓣评分　9.7/10 from 2900000 users')
        })

        it('应该处理缺失数据', () => {
            const mockData = {
                this_title: 'Test Movie'
            }

            const result = formatMovieInfo(mockData, 'bbcode')

            expect(result).toContain('◎片　　名　Test Movie')
            expect(result).not.toContain('◎译　　名')
            expect(result).not.toContain('◎导　　演')
        })

        it('应该正确处理剧集信息', () => {
            const mockData = {
                this_title: 'Test Series',
                seasons: '3',
                episodes: '24',
                duration: '45分钟'
            }

            const result = formatMovieInfo(mockData, 'bbcode')

            expect(result).toContain('◎季　　数　3')
            expect(result).toContain('◎集　　数　24')
            expect(result).toContain('◎片　　长　45分钟')
        })
    })

    describe('MarkdownFormatter', () => {
        it('应该正确格式化为 Markdown', () => {
            const mockData = {
                poster: 'https://example.com/poster.jpg',
                trans_title: '肖申克的救赎',
                this_title: 'The Shawshank Redemption',
                year: '1994',
                director: ['弗兰克·德拉邦特']
            }

            const result = formatMovieInfo(mockData, 'markdown')

            expect(result).toContain('![海报](https://example.com/poster.jpg)')
            expect(result).toContain('## 基本信息')
            expect(result).toContain('- **译名**: 肖申克的救赎')
            expect(result).toContain('- **片名**: The Shawshank Redemption')
            expect(result).toContain('## 制作人员')
            expect(result).toContain('- **导演**: 弗兰克·德拉邦特')
        })
    })

    describe('formatMovieInfo 函数', () => {
        it('默认使用 BBCode 格式', () => {
            const mockData = { this_title: 'Test' }
            const result = formatMovieInfo(mockData)

            expect(result).toContain('◎片　　名　Test')
        })

        it('可以指定 Markdown 格式', () => {
            const mockData = { this_title: 'Test' }
            const result = formatMovieInfo(mockData, 'markdown')

            expect(result).toContain('- **片名**: Test')
        })
    })
})
