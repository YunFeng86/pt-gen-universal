
import { describe, it, expect } from 'vitest';
import { GogNormalizer } from '../../lib/normalizers/gog';
import { GogRawData } from '../../lib/types/raw-data';

describe('GogNormalizer', () => {
    const normalizer = new GogNormalizer();
    const config = {};

    it('should normalize gog data correctly', () => {
        const rawData: GogRawData = {
            site: 'gog',
            success: true,
            sid: '1207658924',
            gog_id: '1207658924',
            api_data: {
                title: 'The Witcher 3: Wild Hunt',
                slug: 'the_witcher_3_wild_hunt',
                languages: { en: 'English', cn: 'Chinese' },
                content_system_compatibility: { windows: true },
                description: { lead: 'This is a game.' }
            },
            store_page_html: `
                <html>
                <script>
                    window.gogData = {
                        cardProduct: {
                            "boxArtImage": "https://example.com/cover.jpg",
                            "screenshots": [
                                "https://example.com/s1.jpg"
                            ],
                        "supportedOperatingSystems": [
                            {
                                "operatingSystem": { "name": "windows", "versions": "10/11" },
                                "systemRequirements": [
                                    {
                                        "type": "minimum",
                                        "requirements": [ { "id": "os", "description": "Win 10" } ]
                                    }
                                ]
                            }
                        ]
                    },
                    dummy: 1
                    };
                </script>
                </html>
            `
        };

        const result = normalizer.normalize(rawData, config);

        expect(result.site).toBe('gog');
        expect(result.title).toBe('The Witcher 3: Wild Hunt');
        expect(result.poster).toBe('https://example.com/cover.jpg');
        expect((result.extra as any).platforms).toContain('Windows');
        expect((result.extra as any).system_requirements.windows).toBeDefined();
        // expect(result.extra.system_requirements.windows.requirements.minimum.os).toBe('Win 10');
        expect(result.introduction).toBe('This is a game.');
    });
});
