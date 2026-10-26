window.CICOSeeds = (() => {
    function flagUrl(country) {
        const code = String(country || '').toUpperCase();
        if (!/^[A-Z]{2}$/.test(code)) return '';
        const identifier = [...code].map(letter => (0x1f1e6 + letter.charCodeAt(0) - 65).toString(16)).join('-');
        return `https://osu.ppy.sh/assets/images/flags/${identifier}.svg`;
    }

    function screens(players, qualifiedSeeds, pageSize, includeEliminated = true) {
        const ordered = [...players].sort((left, right) => right.seed - left.seed);
        const eliminated = ordered.filter(player => player.seed > qualifiedSeeds);
        const result = [];
        if (includeEliminated) {
            const pageCount = Math.ceil(eliminated.length / pageSize);
            for (let index = 0; index < pageCount; index++) {
                result.push({ type: 'eliminated', page: index + 1, pageCount, players: eliminated.slice(index * pageSize, (index + 1) * pageSize) });
            }
        }
        for (const player of ordered.filter(player => player.seed <= qualifiedSeeds)) result.push({ type: 'detail', player });
        return result;
    }

    return { flagUrl, screens };
})();
