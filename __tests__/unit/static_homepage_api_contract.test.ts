import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createHomePage } from '../../src/runtime/page';

describe('static homepage api contract', () => {
  const html = readFileSync(fileURLToPath(new URL('../../index.html', import.meta.url)), 'utf8');
  const createStaticHomePage = (searchEnabled = true) =>
    createHomePage({
      platform: 'node',
      storageProvider: 'memory',
      searchEnabled,
    });

  it('keeps every runtime homepage aligned with the checked-in static ui', () => {
    expect(
      createHomePage({
        platform: 'node',
        storageProvider: 'memory',
        searchEnabled: true,
      })
    ).toBe(html);
    expect(
      createHomePage({
        platform: 'bun',
        storageProvider: 'memory',
        searchEnabled: true,
      })
    ).toBe(html);
    expect(
      createHomePage({
        platform: 'cloudflare',
        storageProvider: 'memory',
        searchEnabled: true,
      })
    ).toBe(html);
  });

  it('injects runtime bootstrap config when search is disabled', () => {
    const disabledHomePage = createStaticHomePage(false);

    expect(html).toContain(
      '<script id="ptgen-home-config" type="application/json">{"searchEnabled":true}</script>'
    );
    expect(disabledHomePage).toContain('{"searchEnabled":false}');
    expect(disabledHomePage).not.toBe(html);
  });

  it('uses explicit v1 api endpoints instead of the root path redirect', () => {
    expect(html).toMatch(/\/api\/v1\/info/);
    expect(html).toMatch(/\/api\/v1\/search/);
    expect(html).not.toContain('let apiUrl = "/"');
  });

  it('shows a readable error when the api returns html instead of json', () => {
    expect(html).toContain('接口返回了 HTML 页面');
  });

  it('renders search results without interpolating upstream html into innerHTML', () => {
    expect(html).not.toContain('${item.title}');
    expect(html).not.toContain('${item.subtitle ||');
    expect(html).not.toContain('${item.subtype}');
    expect(html).not.toContain('<div class="item-tag">${item.subtype}</div>');
  });

  it('guards optional result metadata before rendering tags', () => {
    expect(html).toContain('if (hasDisplayText(item.year))');
    expect(html).toContain('if (hasDisplayText(item.subtitle))');
    expect(html).toContain('if (hasDisplayText(item.subtype))');
  });
});
