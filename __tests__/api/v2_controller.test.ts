import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { V2Controller } from '../../src/controllers/v2'
import { AppError } from '../../lib/errors'

function makeTestApp(v2: V2Controller) {
  const app = new Hono()

  // Match src/app.ts error shape for v2.
  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json(
        {
          error: {
            code: err.code,
            message: err.message,
          },
        },
        err.httpStatus as any
      )
    }

    return c.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: (err as any)?.message || 'Internal Server Error',
        },
      },
      500
    )
  })

  app.get('/api/v2/info', (c) => v2.handleInfo(c))
  app.get('/api/v2/info/:site/:sid', (c) => v2.handleInfo(c))
  app.post('/api/v2/info', (c) => v2.handleInfo(c))
  app.get('/api/v2/search', (c) => v2.handleSearch(c))

  return app
}

describe('API v2 controller contract', () => {
  const fakeInfo: any = {
    site: 'douban',
    id: '1292052',
    title: 'The Shawshank Redemption',
    trans_title: '肖申克的救赎',
    this_title: 'The Shawshank Redemption',
    year: '1994',
    region: ['美国'],
    genre: ['剧情'],
    language: ['英语'],
    playdate: ['1994-09-10'],
    introduction: 'test intro',
  }

  it('supports query site/sid (previously broken) and defaults format=json', async () => {
    const v2 = new V2Controller(
      {
        getMediaInfo: async () => fakeInfo,
        search: async () => [],
      } as any,
      {}
    )
    const app = makeTestApp(v2)

    const res = await app.request(
      'http://localhost/api/v2/info?site=douban&sid=1292052'
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.site).toBe('douban')
    // Default is json, so no formatted output should be present.
    expect('format' in json.data).toBe(false)
  })

  it('reads format from query (bbcode) and includes formatted output', async () => {
    const v2 = new V2Controller(
      {
        getMediaInfo: async () => fakeInfo,
        search: async () => [],
      } as any,
      {}
    )
    const app = makeTestApp(v2)

    const res = await app.request(
      'http://localhost/api/v2/info?site=douban&sid=1292052&format=bbcode'
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(typeof json.data.format).toBe('string')
    expect(json.data.format).toContain('◎译')
  })

  it('reads format from query for RESTful path routes', async () => {
    const v2 = new V2Controller(
      {
        getMediaInfo: async () => fakeInfo,
        search: async () => [],
      } as any,
      {}
    )
    const app = makeTestApp(v2)

    const res = await app.request(
      'http://localhost/api/v2/info/douban/1292052?format=markdown'
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(typeof json.data.format).toBe('string')
    expect(json.data.format).toContain('## 基本信息')
  })

  it('enforces disableSearch in v2', async () => {
    const v2 = new V2Controller(
      {
        getMediaInfo: async () => fakeInfo,
        search: async () => [],
      } as any,
      { disableSearch: true }
    )
    const app = makeTestApp(v2)

    const res = await app.request(
      'http://localhost/api/v2/search?q=test&source=douban'
    )
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error.code).toBe('FEATURE_DISABLED')
  })

  it('maps unknown sources as INVALID_PARAM (400) instead of 500', async () => {
    const v2 = new V2Controller(
      {
        getMediaInfo: async () => {
          throw new Error('Scraper not found: unknown')
        },
        search: async () => [],
      } as any,
      {}
    )
    const app = makeTestApp(v2)

    const res = await app.request(
      'http://localhost/api/v2/info?site=unknown&sid=1'
    )
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('INVALID_PARAM')
  })
})

