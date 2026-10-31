const view = CICOMatchView;
const ui = document.querySelector('#match-ui');
const slots = [];
const playerPanels = [];
const scoreCards = [];
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const mapPanel = view.mapPanel();
const logPanel = view.logPanel();
const gameChat = view.chatPanel('IN-GAME CHAT', 'game-chat');
const twitchChat = view.chatPanel('TWITCH CHAT', 'twitch-chat');
const renderChat = view.gameChatFeed(gameChat);
let context;
let toastTimer;
let twitch;
let previewChat;

function scale() {
    document.documentElement.style.setProperty('--scale', Math.min(innerWidth / 1920, innerHeight / 1080));
}

function dispatch(command) {
    const result = context?.store.dispatch(command);
    if (!result?.error) return;
    const toast = document.querySelector('#toast');
    toast.textContent = result.error;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 2200);
}

function svgRect(attributes, parent) {
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    for (const [key, value] of Object.entries(attributes)) rect.setAttribute(key, value);
    parent.append(rect);
    return rect;
}

function setupClients() {
    const styles = getComputedStyle(document.documentElement);
    const border = parseFloat(styles.getPropertyValue('--panel-border'));
    const outline = parseFloat(styles.getPropertyValue('--panel-outline'));
    const depth = parseFloat(styles.getPropertyValue('--panel-depth'));
    CICO2026.gameplayClients.forEach((rect, index) => {
        const cutout = svgRect({ x: rect.x, y: rect.y, width: rect.width, height: rect.height, rx: rect.radius, fill: 'black', display: 'none' }, document.querySelector('#cutouts'));
        for (const [offset, y, color, stroke] of [[border / 2, depth, 'var(--caramel)', border], [border / 2, 0, 'var(--cream)', border], [border + outline / 2, 0, 'var(--caramel)', outline]]) {
            svgRect({ x: rect.x - offset, y: rect.y - offset + y, width: rect.width + offset * 2, height: rect.height + offset * 2, rx: rect.radius + offset, fill: 'none', stroke: color, 'stroke-width': stroke }, document.querySelector('#client-frames'));
        }
        const placeholder = view.node('div', 'capture-placeholder');
        placeholder.style.left = `${rect.x}px`;
        placeholder.style.top = `${rect.y}px`;
        placeholder.style.width = `${rect.width}px`;
        placeholder.style.height = `${rect.height}px`;
        placeholder.append(view.node('span', 'candy-mark'));
        document.querySelector('#clients').append(placeholder);
        slots.push({ cutout, placeholder });
        const player = view.playerPanel(index, dispatch);
        const score = view.node('section', `score-card side-${index}`);
        score.innerHTML = '<strong class="score-number">—</strong><div class="score-metric"><span>MISSES</span><strong class="misses">—</strong></div>';
        playerPanels.push(player);
        scoreCards.push(score);
        ui.append(player, score);
    });
}

function counter(node, value, decimals, suffix = '') {
    if (value === null || value === undefined || !Number.isFinite(value)) {
        if (node.counter) cancelAnimationFrame(node.counter.rAF);
        node.counter = null;
        view.setText(node, '—');
        return;
    }
    CICOPlaceholders.toggle(node, false);
    if (reduced.matches) {
        if (node.counter) cancelAnimationFrame(node.counter.rAF);
        node.counter = null;
        view.setText(node, value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix);
        return;
    }
    if (!node.counter) node.counter = new CountUp(node, value, value, decimals, .22, { useEasing: true, useGrouping: true, separator: ',', suffix });
    else if (node.counter.endVal !== value) node.counter.update(value);
}

function render(data) {
    context = data;
    const state = data.store.state;
    playerPanels.forEach((panel, index) => {
        const manual = state.points[index] !== null;
        view.updatePlayer(panel, data.players[index], { value: state.points[index] ?? data.points[index], manual }, state.actions.find(action => action.type === 'ban' && action.side === index));
        const live = data.live.players[index];
        const occupied = Boolean(live);
        slots[index].cutout.setAttribute('display', occupied ? '' : 'none');
        slots[index].placeholder.hidden = occupied && !data.preview;
        slots[index].placeholder.classList.toggle('demo', data.preview && occupied);
        counter(scoreCards[index].querySelector('.score-number'), live?.score, 0);
        counter(scoreCards[index].querySelector('.misses'), live?.misses, 0, '×');
    });
    const [left, right] = data.live.players.map(player => player?.score);
    const valid = left !== null && left !== undefined && right !== null && right !== undefined;
    const sum = valid ? left + right : 0;
    const difference = valid ? Math.abs(left - right) : 0;
    const fill = document.querySelector('.difference-fill');
    const extent = sum > 0 ? Math.min(50, difference / sum * 100) : 0;
    fill.style.width = `${extent}%`;
    fill.style.left = `${valid && left > right ? 50 - extent : 50}%`;
    fill.classList.toggle('left-lead', valid && left > right);
    fill.classList.toggle('right-lead', valid && right > left);
    counter(document.querySelector('#score-gap'), valid ? difference : null, 0);
    scoreCards.forEach((card, index) => card.classList.toggle('leading', data.live.playing && valid && (index === 0 ? left > right : right > left)));
    view.updateMap(mapPanel, data.map);
    view.updateLog(logPanel, state.actions, data.pool.maps);
    renderChat(data.live.chat);
}

async function start() {
    scale();
    setupClients();
    ui.append(mapPanel, logPanel, gameChat, twitchChat);
    const casters = view.node('section', 'caster-space panel');
    casters.append(view.node('h2', '', 'CASTERS'));
    ui.append(casters);
    try {
        context = await CICOBroadcast.open(render);
        ui.prepend(view.header('Gameplay', context.pool.round, () => dispatch({ type: 'reset' })));
        if (context.preview) {
            view.appendChat(twitchChat, 'catch_fan', 'This match is so close!', {}, true);
            if (context.params.get('motion') !== '0') previewChat = setInterval(() => view.appendChat(twitchChat, 'viewer', 'Kappa', { emotes: '25:0-4' }, true), 5500);
        } else twitch = CICOTwitch.connect(CICO2026.match.channel, (name, message, tags) => view.appendChat(twitchChat, name, message, tags, true));
        window.CICOScene = { get context() { return context; }, dispatch };
    } catch (error) {
        ui.prepend(view.header('Gameplay', CICO2026.round));
        document.querySelector('#toast').textContent = error.message;
        document.querySelector('#toast').hidden = false;
    }
}

addEventListener('resize', scale);
addEventListener('pagehide', () => { clearInterval(previewChat); clearTimeout(toastTimer); twitch?.close(); });
start();
