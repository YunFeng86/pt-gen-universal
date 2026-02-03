
import { describe, it, expect } from 'vitest';
import { IndienovaNormalizer } from '../../lib/normalizers/indienova';
import { IndienovaRawData } from '../../lib/types/raw-data';

describe('IndienovaNormalizer', () => {
    const normalizer = new IndienovaNormalizer();
    const config = {};

    it('should normalize indienova data correctly', () => {
        const html = `
            <div class="cover-image"><img src="https://example.com/cover.jpg"></div>
            <title>黑神话：悟空 - Title | Indienova</title>
            <div class="title-holder">
                <h1>
                    <span>Black Myth: Wukong</span>
                    <small>Black Myth</small>
                </h1>
                <p class="gamedb-release">2024-08-20</p>
            </div>
            <div id="tabs-intro">
                <div class="bottommargin-sm">Intro text.</div>
                <p class="single-line">Action</p>
            </div>
            <div id="scores"><text>8</text><text>0</text><text>9</text><text>0</text></div>
            <div id="tabs-devpub">
                <ul class="db-companies">Game Science</ul>
                <ul class="db-companies">Game Science</ul>
            </div>
            <ul class="db-stores">
                <li><a><div>Steam</div><div></div><div>$60</div></a></li>
            </ul>
        `;

        const rawData: IndienovaRawData = {
            site: 'indienova',
            success: true,
            sid: '123',
            html: html
        };

        const result = normalizer.normalize(rawData, config);

        expect(result.site).toBe('indienova');
        expect(result.title).toBe('黑神话：悟空');
        expect(result.original_title).toBe('Black Myth: Wukong');
        expect(result.director).toEqual(['Game Science']);
        expect((result.extra as any).price).toHaveLength(1);
        expect((result.extra as any).price[0]).toContain('Steam：$60');
    });
});
