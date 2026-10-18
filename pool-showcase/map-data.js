window.CICOMapData = (() => {
    function number(...values) {
        for (const value of values) {
            if (value === null || value === undefined || value === '' || typeof value === 'boolean' || typeof value === 'object') continue;
            const result = Number(value);
            if (Number.isFinite(result)) return result;
        }
        return null;
    }

    function text(value, fallback = '—') {
        return typeof value === 'string' && value.trim() ? value.trim() : fallback;
    }

    function normalized(value) {
        return text(value, '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    }

    function resolve(maps, beatmap) {
        const id = number(beatmap.id);
        const exact = id > 0 && maps.find(map => number(map.id) === id);
        if (exact) return exact;
        const title = normalized(beatmap.title);
        const difficulty = normalized(beatmap.version);
        return maps.find(map => Array.isArray(map.keywords) && map.keywords.length && map.keywords.every(keyword => {
            const fragment = normalized(keyword);
            const source = map.matchField === 'difficulty' ? difficulty : `${title} ${difficulty}`;
            return fragment && ` ${source} `.includes(` ${fragment} `);
        })) || {};
    }

    function clockRate(mods) {
        const explicit = number(mods?.rate, mods?.clockRate);
        if (explicit > 0) return explicit;
        const name = String(mods?.name || '').toUpperCase();
        const bits = number(mods?.number) || 0;
        if ((bits & 64) || (bits & 512) || /DT|NC/.test(name)) return 1.5;
        if ((bits & 256) || /HT|DC/.test(name)) return .75;
        return 1;
    }

    function duration(value) {
        if (typeof value === 'string' && /^\d{1,3}:[0-5]\d$/.test(value)) return value.padStart(5, '0');
        const milliseconds = number(value);
        if (milliseconds === null || milliseconds < 0) return '—';
        const seconds = Math.round(milliseconds / 1000);
        return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    }

    function fromPayload(data, maps) {
        const clients = data?.tourney?.clients || data?.tourney?.ipcClients || [];
        const source = clients.find(client => client.beatmap?.title || number(client.beatmap?.id) > 0) || data || {};
        const beatmap = source.beatmap || {};
        if (!beatmap.title && !(number(beatmap.id) > 0)) return null;
        const entry = resolve(maps, beatmap);
        const stats = beatmap.stats || {};
        const mods = source.play?.mods || {};
        const modded = Boolean(number(mods.number) || text(mods.name, '').replace(/NM|NONE/gi, '') || clockRate(mods) !== 1);
        const stat = name => number(stats[name]?.converted, entry[name], !modded ? stats[name]?.original : null, !modded ? stats[name] : null);
        const first = number(beatmap.time?.firstObject) || 0;
        const last = number(beatmap.time?.lastObject);
        const length = last !== null && last >= first ? (last - first) / clockRate(mods) : null;
        const direct = source.directPath?.beatmapBackground || beatmap.directPath?.beatmapBackground;
        let cover = text(entry.background, '');
        if (direct) cover = `/files/beatmap/${encodeURIComponent(direct)}`;
        const folder = source.folders?.beatmap;
        const file = source.files?.background;
        if (!cover && folder && file) cover = `/Songs/${encodeURIComponent(folder).replace(/%2F/gi, '/')}/${encodeURIComponent(file)}`;
        return {
            id: number(beatmap.id),
            slot: text(entry.slot, 'MAP'),
            badge: entry.badge === 'edit' ? 'CICO EDIT' : entry.badge === 'custom' ? 'CUSTOM' : '',
            badgeType: ['edit', 'custom'].includes(entry.badge) ? entry.badge : '',
            artist: text(entry.artist, text(beatmap.artist)),
            title: text(entry.title, text(beatmap.title)),
            difficulty: text(entry.difficulty, text(beatmap.version)),
            mapper: text(entry.mapper, text(beatmap.mapper)),
            replayer: text(entry.replayer, text(source.play?.playerName)),
            cover,
            sr: number(stats.stars?.total, entry.sr),
            cs: stat('cs'), ar: stat('ar'), od: stat('od'), hp: stat('hp'),
            bpm: number(stats.bpm?.common, entry.bpm),
            length: duration(length ?? entry.length)
        };
    }

    return { number, resolve, fromPayload, duration };
})();
