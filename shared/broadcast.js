window.CICOBroadcast = (() => {
    async function json(url) {
        const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(7000) });
        if (!response.ok) throw new Error(`${response.status}: ${url}`);
        return response.json();
    }

    async function open(onChange) {
        const params = new URLSearchParams(location.search);
        const preview = params.get('preview') === '1';
        const pools = await json(CICO2026.poolSource);
        const pool = CICOMapData.findPool(pools, params.get('round') || CICO2026.defaultRound);
        if (!pool.maps.length) throw new Error('Mappool unavailable');
        const round = Object.keys(pools).find(key => pools[key] === pool) || 'round-of-32';
        const context = { params, preview, pool, round, players: [null, null], points: [null, null], live: { players: [null, null], playing: false, chat: [] }, packet: null, map: null, profiles: [], store: null };
        let matches = {};
        let socket;
        let revision = 0;
        let stale;
        let previewTimer;
        let refreshTimer;
        let stopped = false;
        const configuredMatch = params.get('match') || '';
        const publish = () => { if (context.store) onChange(context); };
        const selectedMatch = () => matches[round]?.find(match => match.id === configuredMatch || match.label === configuredMatch);
        function updatePlayers() {
            const match = selectedMatch();
            context.players = context.live.players.map((player, index) => player || match?.players[index] || null);
            context.store?.usePlayers(context.players);
        }
        const results = await Promise.allSettled([json(CICO2026.match.profileSource), json(CICO2026.match.matchSource)]);
        if (results[0].status === 'fulfilled') context.profiles = results[0].value.players || [];
        if (results[1].status === 'fulfilled') matches = results[1].value;
        context.store = CICOMatchState.create({ round, match: params.get('lobby') || configuredMatch, preview, rules: CICO2026.match, maps: pool.maps, onChange: publish });
        updatePlayers();

        function apply(packet) {
            context.packet = packet;
            context.live = CICOMatchData.normalize(packet);
            context.points = context.live.points;
            context.map = CICOMapData.fromPayload(packet, context.pool.maps);
            updatePlayers();
            publish();
        }

        async function refresh() {
            try {
                const tournament = await json(CICO2026.tournamentSource);
                if (stopped) return;
                const stage = tournament.stages?.find(stage => stage.id === pool.stageId);
                if (!stage) return;
                const updated = CICOMatchData.poolFromStage(stage, context.pool);
                context.pool.maps.splice(0, context.pool.maps.length, ...updated.maps);
                matches[round] = (stage.matches || []).filter(match => !match.softDeleted).map(CICOMatchData.matchFromWybin);
                if (context.packet) context.map = CICOMapData.fromPayload(context.packet, context.pool.maps);
                updatePlayers();
                publish();
            } catch (error) { console.warn('Using bundled Wybin metadata:', error.message); }
        }

        if (preview) {
            let tick = 0;
            const users = [context.profiles.find(player => player.seed === 1), context.profiles.find(player => player.seed === 32)];
            function demo() {
                const map = context.pool.maps[Math.floor(tick / 100) % context.pool.maps.length];
                const mapTick = tick % 100;
                const scoreBase = 740000 + mapTick * 60000;
                const scoreLead = Math.sin(mapTick / 10) * 550000;
                const clients = users.map((user, index) => ({
                    team: index ? 'right' : 'left', user: { id: user?.userId || index + 1, name: user?.username || `Preview player ${index + 1}`, country: user?.country || '' },
                    play: { score: Math.round(scoreBase + (index ? -scoreLead : scoreLead)), accuracy: 98.3 + Math.sin(tick / 9 + index) * .8, hits: { '0': index + 2 }, rank: { current: 'S' }, mods: { number: map.mods || 0, name: '' } },
                    beatmap: { id: map.id, title: map.title, artist: map.artist, version: map.difficulty, stats: {} }
                }));
                apply({ tourney: { clients, points: { left: 3, right: 2 }, ipcState: 3, chat: [{ id: 'preview1', name: 'BanchoBot', message: 'Match started' }, { id: 'preview2', name: users[1]?.username || 'Preview player', message: 'glhf!' }] } });
                tick++;
            }
            demo();
            if (!context.store.state.actions.length) {
                for (const command of [{ type: 'ban', side: 0, slot: 'NM2' }, { type: 'ban', side: 1, slot: 'HD2' }, { type: 'pick', side: 0, slot: 'NM1' }, { type: 'pick', side: 1, slot: 'DT1' }]) context.store.dispatch(command);
            }
            if (params.get('motion') !== '0') previewTimer = setInterval(demo, 200);
        } else {
            const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
            socket = new ReconnectingWebSocket(`${protocol}://${location.host}/websocket/v2`);
            socket.onopen = async () => {
                clearTimeout(stale);
                const current = revision;
                try { const packet = await json('/json/v2'); if (current === revision && !stopped) apply(packet); } catch {}
            };
            socket.onmessage = event => {
                try { const packet = JSON.parse(event.data); revision++; clearTimeout(stale); apply(packet); } catch (error) { console.warn('Could not render tournament packet:', error.message); }
            };
            socket.onclose = () => {
                if (stopped) return;
                revision++;
                clearTimeout(stale);
                stale = setTimeout(() => apply({}), 5000);
            };
            refresh();
            refreshTimer = setInterval(refresh, 120000);
        }
        context.apply = apply;
        context.close = () => { stopped = true; clearTimeout(stale); clearInterval(previewTimer); clearInterval(refreshTimer); context.store.close(); socket?.close(); };
        addEventListener('pagehide', context.close, { once: true });
        publish();
        return context;
    }

    return { open };
})();
