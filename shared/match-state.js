(function (root) {
    function empty() {
        return { actions: [], points: [null, null], players: [null, null], livePoints: [null, null], winner: null, resetPoints: null, resetCount: 0 };
    }

    function identity(player) {
        if (!player?.id && !player?.name) return null;
        return { id: Number(player.id) || null, name: player.name || '', country: player.country || '' };
    }

    function totals(values) {
        return [0, 1].map(side => {
            const value = values?.[side];
            if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value))) return null;
            return Math.max(0, Math.floor(Number(value)));
        });
    }

    function samePlayer(left, right) {
        return left?.id && right?.id ? left.id === right.id : Boolean(left?.name && left.name === right?.name);
    }

    function retainWinner(state, rules) {
        if (state.winner) return;
        const target = Math.ceil(rules.bestOf / 2);
        const points = state.points.map((value, side) => value ?? state.livePoints[side]);
        const finished = [0, 1].filter(side => points[side] !== null && points[side] >= target);
        if (finished.length !== 1 || !state.players[finished[0]]?.name) return;
        const side = finished[0];
        state.winner = { side, player: { ...state.players[side] }, points, target };
    }

    function update(state, command, rules, maps) {
        const next = JSON.parse(JSON.stringify(state));
        if (command.type === 'reset') return { state: empty() };
        if (command.type === 'points') {
            if (![0, 1].includes(command.side)) return { error: 'Unknown player' };
            next.points[command.side] = command.value === null ? null : Math.min(Math.ceil(rules.bestOf / 2), Math.max(0, Math.floor(Number(command.value) || 0)));
            return { state: next };
        }
        if (!maps.some(map => map.slot === command.slot)) return { error: 'Unknown map' };
        if (command.type === 'clear') {
            next.actions = next.actions.filter(action => action.slot !== command.slot);
            return { state: next };
        }
        const neutralTiebreaker = command.slot === 'TB' && command.type === 'pick' && command.side === null;
        if (!['pick', 'ban'].includes(command.type) || ![0, 1].includes(command.side) && !neutralTiebreaker) return { error: 'Unknown action' };
        const existing = next.actions.find(action => action.slot === command.slot);
        if (existing) return { error: 'Clear this map before changing its pick or ban' };
        if (command.type === 'ban') {
            if (command.slot === 'TB') return { error: 'The tiebreaker cannot be banned' };
            if (next.actions.filter(action => action.type === 'ban' && action.side === command.side).length >= rules.bans) return { error: `Player ${command.side + 1} has already used their ban` };
        }
        next.actions.push({ slot: command.slot, type: command.type, side: command.slot === 'TB' ? null : command.side });
        return { state: next };
    }

    function create({ round, match, preview, rules, maps, storage = localStorage, onChange = () => {} }) {
        const scope = `${preview ? 'preview' : 'live'}:${round}:${match || 'lobby'}`;
        const key = `cico2026:match:v2:${scope}`;
        let serialized = '';
        let state = empty();
        let currentPlayers = [null, null];
        let currentPoints = [null, null];
        let legacyPending = true;
        function restore(saved) {
            let valid = empty();
            for (const action of Array.isArray(saved.actions) ? saved.actions : []) {
                const result = update(valid, action, rules, maps);
                if (result.state) valid = result.state;
            }
            [0, 1].forEach(side => { valid = update(valid, { type: 'points', side, value: saved.points?.[side] ?? null }, rules, maps).state; });
            valid.players = [0, 1].map(side => identity(saved.players?.[side]));
            valid.livePoints = totals(saved.livePoints);
            valid.resetPoints = Array.isArray(saved.resetPoints) ? totals(saved.resetPoints) : null;
            valid.resetCount = Math.max(0, Math.floor(Number(saved.resetCount) || 0));
            if ([0, 1].includes(saved.winner?.side) && saved.winner.player?.name) {
                valid.winner = { side: saved.winner.side, player: identity(saved.winner.player), points: totals(saved.winner.points), target: Math.ceil(rules.bestOf / 2) };
            }
            return valid;
        }
        function read() {
            let value;
            try { value = storage.getItem(key) || ''; } catch { return; }
            if (value === serialized) return;
            serialized = value;
            try {
                state = restore(value ? JSON.parse(value) : empty());
            } catch { state = empty(); }
            onChange(state);
        }
        function save() {
            const value = JSON.stringify(state);
            if (value === serialized) return;
            serialized = value;
            try { storage.setItem(key, serialized); } catch {}
            onChange(state);
        }
        function observe(players, points = currentPoints) {
            read();
            currentPlayers = [0, 1].map(side => identity(players?.[side]));
            currentPoints = totals(points);
            if (legacyPending && currentPlayers.some(Boolean)) {
                legacyPending = false;
                const ids = currentPlayers.map(player => player?.id || player?.name || '-').join(':');
                try {
                    const untouched = !state.actions.length && state.points.every(value => value === null) && state.players.every(player => !player) && !state.resetCount;
                    const legacy = untouched && storage.getItem(`cico2026:match:v1:${scope}:${ids}`);
                    if (legacy) state = restore(JSON.parse(legacy));
                } catch {}
            }
            const changedPlayers = currentPlayers.some((player, side) => player && state.players[side] && !samePlayer(player, state.players[side]));
            currentPlayers.forEach((player, side) => {
                const previous = state.players[side];
                if (player && (!previous || samePlayer(player, previous))) state.players[side] = { ...player, country: player.country || previous?.country || '' };
            });
            if (!changedPlayers && state.resetPoints) {
                const fresh = currentPlayers.every(Boolean) && currentPoints.every(value => value !== null && value < Math.ceil(rules.bestOf / 2));
                const changed = currentPoints.some((value, side) => value !== state.resetPoints[side]);
                if (fresh && (changed || currentPoints.every(value => value === 0))) state.resetPoints = null;
            }
            if (!changedPlayers && !state.resetPoints) {
                currentPoints.forEach((value, side) => {
                    if (value !== null && (currentPlayers.every(Boolean) || state.livePoints[side] === null || value > state.livePoints[side])) state.livePoints[side] = value;
                });
            }
            retainWinner(state, rules);
            save();
        }
        function dispatch(command) {
            read();
            const result = update(state, command, rules, maps);
            if (!result.state) return result;
            legacyPending = false;
            if (command.type === 'reset') {
                result.state.resetCount = state.resetCount + 1;
                result.state.players = currentPlayers.map(identity);
                result.state.resetPoints = currentPoints.some(value => value !== null) ? [...currentPoints] : [...state.livePoints];
                result.state.livePoints = [0, 0];
            } else retainWinner(result.state, rules);
            state = result.state;
            save();
            return result;
        }
        read();
        const interval = setInterval(read, 500);
        root.addEventListener?.('storage', read);
        return { get state() { return state; }, get key() { return key; }, observe, usePlayers: observe, dispatch, close() { clearInterval(interval); root.removeEventListener?.('storage', read); } };
    }

    const api = { empty, update, create };
    if (typeof module !== 'undefined') module.exports = api;
    else root.CICOMatchState = api;
})(typeof window === 'undefined' ? globalThis : window);
