import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchWithTimeout } from '../../lib/utils/fetch'

describe('fetchWithTimeout proxy', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('should not proxy when Cookie is present by default', async () => {
    const spy = vi.fn(async () => new Response('ok'))
    globalThis.fetch = spy as any

    await fetchWithTimeout(
      'https://example.com/a',
      { headers: { Cookie: 'a=b' } },
      50,
      { proxyUrl: 'https://proxy.example/?url=' }
    )

    expect(spy).toHaveBeenCalledWith(
      'https://example.com/a',
      expect.objectContaining({ signal: expect.anything() })
    )
  })

  it('should proxy when Cookie is present and explicitly allowed', async () => {
    const spy = vi.fn(async () => new Response('ok'))
    globalThis.fetch = spy as any

    await fetchWithTimeout(
      'https://example.com/a',
      { headers: { Cookie: 'a=b' } },
      50,
      {
        proxyUrl: 'https://proxy.example/?url=',
        proxyAllowSensitiveHeaders: true
      }
    )

    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('https://proxy.example/?url='),
      expect.objectContaining({ signal: expect.anything() })
    )
  })

  it('should not treat trailing "=" as implicit url= parameter', async () => {
    const spy = vi.fn(async () => new Response('ok'))
    globalThis.fetch = spy as any

    await fetchWithTimeout(
      'https://example.com/a?x=1',
      {},
      50,
      { proxyUrl: 'https://proxy.example/fetch?token=' }
    )

    const calledUrl = (spy.mock.calls[0] as any)[0] as string
    expect(calledUrl).toContain('token=')
    expect(calledUrl).toContain('&url=')
  })
})

