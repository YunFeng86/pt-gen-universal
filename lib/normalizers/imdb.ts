
import { Normalizer } from '../interfaces/normalizer';
import { ImdbRawData } from '../types/raw-data';
import { MediaInfo } from '../types/schema';
import { AppConfig } from '../types/config';

export class ImdbNormalizer implements Normalizer {
    normalize(rawData: ImdbRawData, config: AppConfig): MediaInfo {
        const data = rawData;
        const jsonLd = data.json_ld || {};

        // Parse Next Data for extra metrics
        const nextDataRaw = data.next_data || {};
        const totalData: any = {};

        try {
            if (nextDataRaw?.props?.urqlState) {
                for (const [_, value] of Object.entries(nextDataRaw.props.urqlState)) {
                    if ((value as any)?.data?.title?.id === data.imdb_id) {
                        Object.assign(totalData, (value as any).data.title);
                    }
                }
            }
        } catch { }

        // Extract extra metrics
        let metascore = '';
        if (totalData.metacritic?.metascore?.score) metascore = totalData.metacritic.metascore.score;

        let reviews = '';
        if (totalData.reviews?.total) reviews = totalData.reviews.total;

        // Standardize People
        const mapPeople = (item: any) => {
            if (!item) return [];
            const arr = Array.isArray(item) ? item : [item];
            return arr.filter((p: any) => p['@type'] === 'Person').map((p: any) => p.name);
        };

        const directors = mapPeople(jsonLd.director);
        const creators = mapPeople(jsonLd.creator);
        const actors = mapPeople(jsonLd.actor);

        // Basic Info
        const name = jsonLd.name || '';
        const keywords = jsonLd.keywords ? jsonLd.keywords.split(',') : [];
        const datePublished = jsonLd.datePublished || '';
        const rating = jsonLd.aggregateRating?.ratingValue || 0;
        const votes = jsonLd.aggregateRating?.ratingCount || 0;

        const imdbLink = `https://www.imdb.com/title/${data.imdb_id}/`;
        const poster = jsonLd.image || '';
        const description = jsonLd.description || '';
        const duration = jsonLd.duration || '';

        const info: MediaInfo = {
            site: 'imdb',
            id: data.imdb_id,

            title: name,
            original_title: name,
            chinese_title: '',
            foreign_title: name,
            aka: (data.aka || []).map(a => a.title),
            trans_title: [], // Populated from AKAs? 
            this_title: [name],

            year: datePublished ? datePublished.substring(0, 4) : '',
            playdate: (data.release_date || []).map(r => `${r.date}(${r.country})`),
            region: [],
            genre: Array.isArray(jsonLd.genre) ? jsonLd.genre : (jsonLd.genre ? [jsonLd.genre] : []),
            language: [],
            duration: duration,
            episodes: '',
            seasons: '',

            poster: poster,

            director: directors,
            writer: creators,
            cast: actors,

            introduction: description,
            awards: '',
            tags: keywords,

            imdb_id: data.imdb_id,
            imdb_link: imdbLink,
            imdb_rating_average: rating || 0,
            imdb_votes: votes || 0,

            extra: {
                details: data.details,
                reviews: reviews,
                metascore: metascore
            }
        };

        return info;
    }
}
