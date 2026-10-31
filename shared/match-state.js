(function (root) {
    function empty() {
        return { actions: [], points: [null, null] };
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
        let players = [null, null];
        let key = '';
        let serialized = '';
        let state = empty();
        function usePlayers(value) {
            players = value;
            const ids = players.map(player => player?.id || player?.name || '-').join(':');
            const nextKey = `cico2026:match:v1:${preview ? 'preview' : 'live'}:${round}:${match || 'lobby'}:${ids}`;
            if (key === nextKey) return false;
            key = nextKey;
            serialized = '';
            state = empty();
            read();
            return true;
        }
        function read() {
            let value;
            try { value = storage.getItem(key) || ''; } catch { return; }
            if (value === serialized) return;
            serialized = value;
            try {
                const saved = value ? JSON.parse(value) : empty();
                let valid = empty();
                for (const action of Array.isArray(saved.actions) ? saved.actions : []) {
                    const result = update(valid, action, rules, maps);
                    if (result.state) valid = result.state;
                }
                [0, 1].forEach(side => { valid = update(valid, { type: 'points', side, value: saved.points?.[side] ?? null }, rules, maps).state; });
                state = valid;
            } catch { state = empty(); }
            onChange(state);
        }
        function dispatch(command) {
            read();
            const result = update(state, command, rules, maps);
            if (!result.state) return result;
            state = result.state;
            serialized = JSON.stringify(state);
            try { storage.setItem(key, serialized); } catch {}
            onChange(state);
            return result;
        }
        usePlayers(players);
        const interval = setInterval(read, 500);
        root.addEventListener?.('storage', read);
        return { get state() { return state; }, get key() { return key; }, usePlayers, dispatch, close() { clearInterval(interval); root.removeEventListener?.('storage', read); } };
    }

    const api = { empty, update, create };
    if (typeof module !== 'undefined') module.exports = api;
    else root.CICOMatchState = api;
})(typeof window === 'undefined' ? globalThis : window);
