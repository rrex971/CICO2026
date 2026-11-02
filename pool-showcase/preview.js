window.CICOPreview = (() => {
    let maps = [];
    const examples = [
        { artist: 'Preview artist', title: 'Preview map 01', difficulty: 'Preview difficulty', mapper: 'Preview mapper', replayer: 'Preview player' },
        { artist: 'Preview artist with a much longer credit', title: 'Preview map with a long title for scrolling and overflow checks', difficulty: 'A long difficulty name that stays on one line', mapper: 'AnExceptionallyLongMapperName', replayer: 'AnExceptionallyLongReplayName' },
        { artist: 'Preview artist', title: 'Preview map 03', difficulty: 'Preview difficulty', mapper: 'Preview mapper', replayer: 'Preview player' }
    ];
    function payload(index) {
        const entry = maps[index];
        if (!entry) return {};
        const example = examples[index % examples.length];
        return {
            beatmap: {
                id: entry.id || 0, artist: entry.artist || '', title: entry.title || '', version: entry.difficulty || '', mapper: entry.mapper || '',
                time: { firstObject: 0, lastObject: entry.length },
                stats: { stars: { total: entry.sr }, cs: { converted: entry.cs }, ar: { converted: entry.ar }, od: { converted: entry.od }, hp: { converted: entry.hp }, bpm: { common: entry.bpm } }
            },
            play: { playerName: example.replayer, mods: { number: 0, name: '' } }
        };
    }
    function start(apply, params, pool) {
        maps = pool;
        if (!maps.length) {
            apply({});
            return;
        }
        const requested = params.get('pick') || '';
        let index = maps.findIndex(map => map.slot.toUpperCase() === requested.toUpperCase());
        if (index < 0) index = Math.max(0, Math.min(maps.length - 1, (Number(requested) || 1) - 1));
        apply(payload(index));
        if (params.get('motion') === '0') return;
        setInterval(() => {
            index = (index + 1) % maps.length;
            apply(payload(index));
        }, 8500);
    }
    return { get maps() { return maps; }, payload, start };
})();
