const view = CICOMatchView;
const ui = document.querySelector('#match-ui');
const mapsElement = document.querySelector('#maps');
const playerPanels = [];
const mapPanel = view.mapPanel();
const logPanel = view.logPanel();
const gameChat = view.chatPanel('IN-GAME CHAT', 'game-chat');
const twitchChat = view.chatPanel('TWITCH CHAT', 'twitch-chat');
const renderChat = view.gameChatFeed(gameChat);
let context;
let signature;
let previousPickCount = -1;
let twitch;
let previewChat;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const easeOut = 'cubic-bezier(.16, 1, .3, 1)';
const pulseEase = 'cubic-bezier(0, .55, .45, 1)';

function scale() { document.documentElement.style.setProperty('--scale', Math.min(innerWidth / 1920, innerHeight / 1080)); }

function dispatch(command) {
    const result = context?.store.dispatch(command);
    if (!result?.error) return;
    console.info(result.error);
}

function mapClick(map, event) {
    event.preventDefault();
    if (event.altKey) return;
    if (event.ctrlKey || event.metaKey) { dispatch({ type: 'clear', slot: map.slot }); return; }
    const side = event.type === 'contextmenu' || event.button === 2 ? 1 : 0;
    dispatch({ type: event.shiftKey ? 'ban' : 'pick', slot: map.slot, side });
}

function createMap(map) {
    const card = view.node('article', 'map-card panel');
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `${map.slot}: ${map.title}`);
    card.dataset.slot = map.slot;
    const art = view.node('div', 'card-art');
    art.append(view.node('span', 'candy-mark'));
    if (map.background) {
        const image = view.node('img', '');
        image.alt = '';
        image.draggable = false;
        image.src = map.background;
        image.addEventListener('error', () => image.remove(), { once: true });
        art.append(image);
    }
    const slot = view.node('span', 'slot-tag', map.slot);
    slot.classList.toggle('long-slot', map.slot.length > 3);
    slot.style.setProperty('--mod-color', CICO2026.modColors[map.slot.slice(0, 2)] || 'var(--caramel)');
    slot.style.setProperty('--mod-depth', CICO2026.modDepthColors[map.slot.slice(0, 2)] || 'var(--chocolate)');
    const copy = view.node('div', 'card-copy');
    copy.append(view.node('div', 'card-title', map.title || '—'), view.node('div', 'card-artist', map.artist || '—'), view.node('div', 'card-difficulty', CICOMapData.difficultyLabel(map.difficulty)));
    const stats = view.node('div', 'card-stats');
    stats.append(view.node('span', '', '★'), view.node('strong', '', CICOMapData.number(map.sr) === null ? '—' : Number(map.sr).toFixed(2)));
    copy.append(stats);
    const status = view.node('div', 'card-status');
    status.innerHTML = '<svg class="status-icon" viewBox="0 0 24 24" aria-hidden="true"><path/></svg><span>—</span>';
    const wash = view.node('span', 'ban-wash');
    const stamp = view.node('span', 'ban-stamp');
    stamp.innerHTML = '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="18" fill="none" stroke="currentColor" stroke-width="4"/><path d="m12 12 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></svg>';
    card.append(art, slot, copy, status, wash, stamp, view.node('span', 'pick-flash'), view.node('span', 'pick-halo'));
    card.addEventListener('click', event => mapClick(map, event));
    card.addEventListener('contextmenu', event => mapClick(map, event));
    card.addEventListener('keydown', event => { if (['Enter', 'Space'].includes(event.code)) mapClick(map, event); });
    return card;
}

function render(data) {
    context = data;
    const state = data.store.state;
    const next = JSON.stringify(data.pool.maps);
    if (signature !== next) {
        signature = next;
        mapsElement.dataset.count = data.pool.maps.length;
        const columns = CICOMatchData.columns(data.pool.maps);
        mapsElement.style.gridTemplateColumns = `repeat(${columns.length}, minmax(0, 1fr))`;
        const heights = columns.map(groups => {
            const cards = groups.reduce((sum, group) => sum + group.maps.length, 0);
            const spacing = (cards - groups.length) * 14 + (groups.length - 1) * 18;
            return (mapsElement.clientHeight - spacing) / cards;
        });
        const cardHeight = Math.min(170, ...heights);
        mapsElement.style.setProperty('--map-card-height', `${cardHeight}px`);
        mapsElement.replaceChildren(...columns.map(groups => {
            const column = view.node('div', 'mod-column');
            column.classList.toggle('dense', cardHeight < 155);
            column.classList.toggle('compact', cardHeight < 125);
            for (const group of groups) {
                const section = view.node('section', 'mod-group');
                section.dataset.mod = group.mod;
                const cards = view.node('div', 'mod-maps');
                cards.style.gridTemplateRows = `repeat(${group.maps.length}, var(--map-card-height))`;
                cards.append(...group.maps.map(createMap));
                section.append(cards);
                column.append(section);
            }
            return column;
        }));
    }
    playerPanels.forEach((panel, index) => view.updatePlayer(panel, data.players[index], { value: state.points[index] ?? data.points[index], manual: state.points[index] !== null }, state.actions.find(action => action.type === 'ban' && action.side === index)));
    const picks = state.actions.filter(action => action.type === 'pick');
    const latest = picks.at(-1);
    const pulse = picks.length > previousPickCount;
    for (const card of mapsElement.querySelectorAll('.map-card')) {
        const action = state.actions.find(action => action.slot === card.dataset.slot);
        const actionKey = action ? `${action.type}:${action.side}` : '';
        const changed = card.actionKey !== undefined && card.actionKey !== actionKey;
        card.actionKey = actionKey;
        card.classList.toggle('picked', action?.type === 'pick');
        card.classList.toggle('banned', action?.type === 'ban');
        card.classList.toggle('side-0', action?.side === 0);
        card.classList.toggle('side-1', action?.side === 1);
        card.classList.toggle('side-neutral', Boolean(action && action.side === null));
        card.classList.toggle('latest', latest?.slot === card.dataset.slot);
        const status = card.querySelector('.card-status');
        const path = status.querySelector('path');
        const badgeType = data.pool.maps.find(map => map.slot === card.dataset.slot)?.badge;
        const badgeLabel = CICOMapData.badgeLabels[badgeType];
        if (action) {
            path.setAttribute('d', action.type === 'ban' ? 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20ZM5 5l14 14' : 'm4 12 5 5L20 6');
            path.setAttribute('fill', 'none');
            path.setAttribute('stroke', 'currentColor');
            path.setAttribute('stroke-width', '2.5');
            path.setAttribute('stroke-linecap', 'round');
        } else if (badgeLabel) view.badgeIcon(path, badgeType);
        status.querySelector('svg').toggleAttribute('hidden', !action && !badgeLabel);
        const playerName = action ? data.players[action.side]?.name || '—' : '';
        const actionLabel = action ? `${action.type === 'ban' ? 'BANNED' : 'PICKED'}${action.side === null ? '' : ` BY ${playerName}`}` : '';
        view.setText(status.querySelector('span'), actionLabel || badgeLabel || '—');
        if (changed && !reducedMotion.matches) {
            card.stateAnimation?.cancel();
            const target = action?.type === 'ban' ? card.querySelector('.ban-stamp') : status;
            card.stateAnimation = target.animate(action?.type === 'ban' ? [
                { transform: 'scale(1.65) rotate(-20deg)', opacity: 0, filter: 'blur(5px)' },
                { transform: 'scale(1) rotate(-8deg)', opacity: 1, filter: 'blur(0)' }
            ] : [
                { transform: 'translateY(9px)', opacity: .15, filter: 'blur(3px)' },
                { transform: 'translateY(0)', opacity: 1, filter: 'blur(0)' }
            ], { duration: 380, easing: easeOut });
        }
        if (latest?.slot !== card.dataset.slot || !action) card.pulseAnimation?.cancel();
        if (action?.type !== 'pick') card.flashAnimation?.cancel();
        if (pulse && latest?.slot === card.dataset.slot && !reducedMotion.matches) {
            card.pulseAnimation?.cancel();
            card.pulseAnimation = card.querySelector('.pick-halo').animate([
                { opacity: .8, transform: 'scale(1)' },
                { opacity: 0, transform: 'scale(1.055, 1.12)' }
            ], { duration: 1000, iterations: 3, easing: pulseEase });
            if (changed) {
                card.flashAnimation?.cancel();
                card.flashAnimation = card.querySelector('.pick-flash').animate([
                    { opacity: .55 },
                    { opacity: 0 }
                ], { duration: 1000, iterations: 3, easing: pulseEase });
            }
        }
    }
    previousPickCount = picks.length;
    view.updateMap(mapPanel, data.map);
    view.updateLog(logPanel, state.actions, data.pool.maps);
    renderChat(data.live.chat);
}

async function start() {
    scale();
    [0, 1].forEach(side => { const player = view.playerPanel(side, dispatch); playerPanels.push(player); ui.append(player); });
    const casters = view.node('section', 'caster-space panel');
    casters.append(view.node('h2', '', 'CASTERS'));
    ui.append(mapPanel, logPanel, casters, gameChat, twitchChat);
    try {
        context = await CICOBroadcast.open(render);
        ui.prepend(view.header('Mappool', context.pool.round));
        document.querySelector('#round').addEventListener('contextmenu', event => { event.preventDefault(); if (event.ctrlKey) dispatch({ type: 'reset' }); });
        if (context.preview) {
            view.appendChat(twitchChat, 'catch_fan', 'Ready for the next pick!', {}, true);
            view.appendChat(twitchChat, 'viewer', 'Kappa', { emotes: '25:0-4' }, true);
            if (context.params.get('motion') !== '0') previewChat = setInterval(() => view.appendChat(twitchChat, 'viewer', 'Kappa', { emotes: '25:0-4' }, true), 5500);
        } else twitch = CICOTwitch.connect(CICO2026.match.channel, (name, message, tags) => view.appendChat(twitchChat, name, message, tags, true));
        window.CICOScene = { get context() { return context; }, dispatch };
    } catch (error) {
        ui.prepend(view.header('Mappool', CICO2026.round));
        document.querySelector('#toast').textContent = error.message;
        document.querySelector('#toast').hidden = false;
    }
}

addEventListener('resize', scale);
addEventListener('pagehide', () => { clearInterval(previewChat); twitch?.close(); });
start();
