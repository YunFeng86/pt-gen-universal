
import { describe, it, expect } from 'vitest';
import { SteamNormalizer } from '../../lib/normalizers/steam';
import { SteamRawData } from '../../lib/types/raw-data';

// Mock html2bbcode logic as we cannot import legacy util easily in test without proper setup?
// Or we rely on it working if legacy-utils imported correctly.
// But legacy-utils uses `html2bbcode` module. Tests might fail if module not found.
// Vitest environment is node, so it should find node_modules.

describe('SteamNormalizer', () => {
    const normalizer = new SteamNormalizer();
    const config = {};

    it('should normalize steam data correctly', () => {
        const rawData: SteamRawData = {
            site: 'steam',
            success: true,
            sid: '100',
            main_html: `
                <div class="apphub_AppName">Black Myth: Wukong</div>
                <img class="game_header_image_full" src="https://example.com/cover.jpg?t=123" />
                <div class="details_block">
                    <b>名称:</b> Black Myth: Wukong<br>
                    <b>类型:</b> Action, RPG<br>
                    <b>开发者:</b> Game Science<br>
                    <b>发行商:</b> Game Science<br>
                    <b>发行日期:</b> 2024 年 8 月 20 日<br>
                </div>
                <div id="game_area_description">
                    <h2>关于这款游戏</h2>
                    Introduction text.
                </div>
                <div class="sysreq_contents">
                    <div class="game_area_sys_req" data-os="win">
                        <strong>最低配置:</strong><br>
                        OS: Windows 10
                    </div>
                </div>
                <a class="app_tag">Action</a>
                <a class="app_tag">Role-Playing</a>
            `,
            steamcn_data: { name_cn: '黑神话：悟空' }
        };

        const result = normalizer.normalize(rawData, config);

        expect(result.site).toBe('steam');
        expect(result.id).toBe('100');
        expect(result.title).toBe('黑神话：悟空');
        expect(result.original_title).toBe('Black Myth: Wukong');
        expect(result.poster).toBe('https://example.com/cover.jpg');
        expect(result.director).toEqual(['Game Science']);
        expect(result.writer).toEqual(['Game Science']);
        expect(result.playdate).toContain('2024 年 8 月 20 日');
        expect(result.genre).toEqual(['Action', 'Role-Playing']);

        expect((result.extra as any).sysreq).toBeDefined();
        // expect(result.extra.sysreq[0]).toContain('Windows');
    });
});
