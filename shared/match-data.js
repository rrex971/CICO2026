(function (root) {
    const number = value => value === null || value === undefined || value === '' ? null : Number.isFinite(Number(value)) ? Number(value) : null;
    const modNames = { None: 'NM', Hidden: 'HD', HardRock: 'HR', DoubleTime: 'DT', FreeMod: 'FM', Freemod: 'FM', Tiebreaker: 'TB' };

    function player(client) {
        if (client?.user && !client.user.name && !(number(client.user.id) > 0)) return null;
        if (!client?.user?.name && !client?.play?.playerName) return null;
        return {
            id: number(client.user?.id), name: client.user?.name || client.play.playerName,
            country: client.user?.country || '', score: number(client.play?.score),
            accuracy: number(client.play?.accuracy), misses: number(client.play?.hits?.['0']),
            rank: client.play?.rank?.current || '', client
        };
    }

    function normalize(data) {
        const tourney = data?.tourney || {};
        const clients = tourney.clients || tourney.ipcClients || [];
        const hasTeams = clients.some(client => ['left', 'right'].includes(String(client.team).toLowerCase()));
        const sides = ['left', 'right'].map((side, index) => player(hasTeams ? clients.find(client => String(client.team).toLowerCase() === side) : clients[index]));
        return { players: sides, points: [number(tourney.points?.left), number(tourney.points?.right)], playing: Number(tourney.ipcState ?? tourney.manager?.ipcState) === 3, chat: tourney.chat || tourney.manager?.chat || [] };
    }

    function poolFromStage(stage, previous) {
        const maps = [];
        for (const bracket of stage.modBrackets || []) {
            const mod = modNames[bracket.mods] || (/tie\s*breaker/i.test(bracket.name) ? 'TB' : '');
            if (!mod) continue;
            const ordered = [...(bracket.beatmaps || [])].sort((a, b) => a.beatmapOrder - b.beatmapOrder);
            ordered.forEach((map, index) => {
                if (map.placeholder) return;
                const slot = mod === 'TB' ? 'TB' : `${mod}${index + 1}`;
                const old = previous.maps.find(entry => entry.slot === slot) || {};
                const split = map.name.indexOf(' [');
                const song = split < 0 ? map.name : map.name.slice(0, split);
                const separator = song.indexOf(' - ');
                const badge = old.badge || (map.originalSong ? 'original' : map.customMap ? 'custom' : /CICO (Edit|Ver\.)/i.test(map.name) ? 'edit' : '');
                maps.push({ ...old, slot, id: map.beatmapId, beatmapsetId: map.beatmapsetId,
                    ...(old.id && old.id !== map.beatmapId ? { ids: [...new Set([...(old.ids || []), old.id])] } : {}),
                    artist: separator < 0 ? '' : song.slice(0, separator), title: separator < 0 ? song : song.slice(separator + 3),
                    difficulty: split < 0 ? '' : map.name.slice(split + 2, -1), mapper: map.creator,
                    badge, background: map.beatmapsetId ? `https://assets.ppy.sh/beatmaps/${map.beatmapsetId}/covers/cover.jpg` : old.background,
                    sr: map.starRating, cs: map.circleSize, ar: map.approachRate, od: map.overallDifficulty,
                    hp: map.hpDrain, bpm: map.bpm, length: number(map.totalLength) === null ? old.length : map.totalLength * 1000, mods: map.mods
                });
            });
        }
        return maps.length ? { ...previous, maps } : previous;
    }

    function matchFromWybin(match) {
        const players = [match.playerOne, match.playerTwo].map(entry => {
            const user = entry?.user?.userOsu;
            return user ? { id: user.id, name: user.username, country: user.flag, score: null, accuracy: null, misses: null } : null;
        });
        return { id: String(match.id), label: String(match.label || match.id), players };
    }

    function winner(players, points, bestOf) {
        const target = Math.ceil(Number(bestOf) / 2);
        if (!Number.isFinite(target) || target < 1) return null;
        const totals = [0, 1].map(side => number(points?.[side]));
        const finished = [0, 1].filter(side => totals[side] !== null && totals[side] >= target);
        if (finished.length !== 1) return null;
        const side = finished[0];
        const player = players?.[side];
        if (!player?.name) return null;
        return { side, player, opponent: players?.[1 - side] || null, points: totals, target };
    }

    function columns(maps) {
        const order = ['NM', 'HD', 'HR', 'DT', 'FM', 'TB'];
        const groups = order.map(mod => ({ mod, maps: maps.filter(map => map.slot.slice(0, 2) === mod) })).filter(group => group.maps.length);
        const count = Math.min(groups.length, 4);
        let best = [];
        let bestCost = Infinity;
        function partition(start, remaining, parts) {
            if (remaining === 1) {
                const candidate = [...parts, groups.slice(start)];
                const weights = candidate.map(column => column.reduce((sum, group) => sum + group.maps.length + .6, 0));
                const cost = Math.max(...weights) * 100 + weights.reduce((sum, weight) => sum + weight * weight, 0);
                if (cost < bestCost) { bestCost = cost; best = candidate; }
                return;
            }
            for (let end = start + 1; end <= groups.length - remaining + 1; end++) partition(end, remaining - 1, [...parts, groups.slice(start, end)]);
        }
        if (count) partition(0, count, []);
        return best;
    }

    const api = { number, player, normalize, poolFromStage, matchFromWybin, winner, columns };
    if (typeof module !== 'undefined') module.exports = api;
    else root.CICOMatchData = api;
})(typeof window === 'undefined' ? globalThis : window);
