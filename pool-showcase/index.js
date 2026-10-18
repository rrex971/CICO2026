const config = window.CICO2026;
const params = new URLSearchParams(location.search);
const preview = params.get('preview') === '1';
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const byId = id => document.getElementById(id);
const ui = Object.fromEntries(['round', 'pick', 'artist', 'title', 'difficulty', 'mapper', 'replayer', 'length'].map(id => [id, byId(id)]));
const coverLayers = [...document.querySelectorAll('.cover-layer')];
const counters = {};
const valueAnimations = new Map();
const easeOut = 'cubic-bezier(.16, 1, .3, 1)';
let maps = config.maps;
let activeSlot = '';
let copySignature = '';
let titleAnimation;
let copyAnimation;
let copyTimer;
let copyRequest = 0;
let badgeType = '';
let badgeRequest = 0;
let badgeAnimation;
let poolAnimation;
let poolOffset = 0;
let hasRendered = false;
let coverRequest = 0;
let requestedCover = null;
let activeCover = 0;
let staleTimer;
let socket;
let packetRevision = 0;

function scaleScene() {
    document.documentElement.style.setProperty('--scale', Math.min(innerWidth / 1920, innerHeight / 1080));
}

function position(element, rect) {
    for (const key of ['x', 'y', 'width', 'height']) {
        element.style[{ x: 'left', y: 'top', width: 'width', height: 'height' }[key]] = `${rect[key]}px`;
    }
}

function setupGeometry() {
    const rect = config.client;
    const styles = getComputedStyle(document.documentElement);
    const border = parseFloat(styles.getPropertyValue('--panel-border'));
    const outline = parseFloat(styles.getPropertyValue('--panel-outline'));
    const bottomDepth = parseFloat(styles.getPropertyValue('--panel-depth'));
    for (const [id, offset, depth, stroke] of [
        ['client-cutout', 0, 0, 0],
        ['client-frame', border / 2, 0, border],
        ['client-depth', border / 2, bottomDepth, border],
        ['client-outline', border + outline / 2, 0, outline]
    ]) {
        const node = byId(id);
        const attributes = { x: rect.x - offset, y: rect.y - offset + depth, width: rect.width + offset * 2, height: rect.height + offset * 2, rx: rect.radius + offset };
        for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
        if (stroke) node.setAttribute('stroke-width', stroke);
    }
    position(byId('capture-preview'), rect);
    position(byId('casters'), config.caster);
    byId('capture-preview').hidden = !preview;
    ui.round.textContent = config.round;
    ui.round.classList.toggle('long-round', config.round.length > 17);
}

function updateTitleMotion() {
    titleAnimation?.cancel();
    titleAnimation = null;
    const viewport = byId('title-window');
    viewport.classList.remove('scrolling');
    if (reducedMotion.matches) return;
    const distance = ui.title.scrollWidth - viewport.clientWidth + 4;
    if (distance <= 4) return;
    viewport.classList.add('scrolling');
    const end = distance + 28;
    const travel = Math.max(3500, distance / 38 * 1000);
    const duration = 3000 + travel * 2;
    const pause = 1500 / duration;
    titleAnimation = ui.title.animate([
        { transform: 'translateX(0)', offset: 0 },
        { transform: 'translateX(0)', offset: pause },
        { transform: `translateX(-${end}px)`, offset: .5 },
        { transform: `translateX(-${end}px)`, offset: .5 + pause },
        { transform: 'translateX(0)', offset: 1 }
    ], { duration, iterations: Infinity, easing: 'linear' });
}

function colorForSlot(slot) {
    return config.modColors[String(slot).slice(0, 2).toUpperCase()] || '#f4e9c4';
}

function depthForSlot(slot) {
    return config.modDepthColors[String(slot).slice(0, 2).toUpperCase()] || '#b88e66';
}

function renderPool() {
    byId('pool-track').replaceChildren(...maps.map((map, index) => {
        const chip = document.createElement('span');
        chip.className = 'pool-chip';
        chip.textContent = map.slot;
        chip.dataset.index = index;
        chip.style.setProperty('--mod-color', colorForSlot(map.slot));
        chip.style.setProperty('--mod-depth', depthForSlot(map.slot));
        return chip;
    }));
    byId('pool-empty').hidden = maps.length > 0;
    syncPool();
}

function syncPool() {
    const index = maps.findIndex(map => map.slot === activeSlot);
    const chips = [...byId('pool-track').children];
    chips.forEach((chip, position) => {
        chip.classList.toggle('active', position === index);
        chip.classList.toggle('passed', index >= 0 && position < index);
        if (position === index) chip.setAttribute('aria-current', 'true');
        else chip.removeAttribute('aria-current');
    });
    byId('pool-position').textContent = `${index < 0 ? '—' : String(index + 1).padStart(2, '0')} / ${maps.length ? String(maps.length).padStart(2, '0') : '—'}`;
    const track = byId('pool-track');
    const viewport = byId('pool-viewport');
    const selected = chips[index];
    const offset = selected ? selected.offsetLeft : 0;
    viewport.classList.toggle('has-overflow', track.scrollWidth - offset > viewport.clientWidth + 1);
    track.style.transform = `translateX(-${offset}px)`;
    if (offset !== poolOffset) {
        poolAnimation?.cancel();
        if (hasRendered && !reducedMotion.matches) {
            poolAnimation = track.animate([
                { filter: 'blur(2px)', opacity: .7 },
                { filter: 'blur(0px)', opacity: 1 }
            ], { duration: 320, easing: easeOut });
        }
    }
    poolOffset = offset;
}

function animateValue(node) {
    valueAnimations.get(node)?.cancel();
    if (!hasRendered || reducedMotion.matches) return;
    valueAnimations.set(node, node.animate([
        { opacity: .25, filter: 'blur(3px)', transform: 'translateY(2px)' },
        { opacity: 1, filter: 'blur(0px)', transform: 'translateY(0)' }
    ], { duration: 260, easing: easeOut }));
}

function updateCounter(name, value) {
    const node = byId(name);
    const next = CICOMapData.number(value);
    if (next === null) {
        if (counters[name]) cancelAnimationFrame(counters[name].rAF);
        delete counters[name];
        if (node.textContent !== '—') {
            node.textContent = '—';
            animateValue(node);
        }
        return;
    }
    if (reducedMotion.matches) {
        if (counters[name]) cancelAnimationFrame(counters[name].rAF);
        delete counters[name];
        node.textContent = name === 'sr' ? next.toFixed(2) : Number(next.toFixed(2)).toString();
        return;
    }
    if (!counters[name]) {
        counters[name] = new CountUp(node, next, next, 2, .3, {
            useEasing: true,
            useGrouping: false,
            formattingFn: number => name === 'sr' ? number.toFixed(2) : Number(number.toFixed(2)).toString()
        });
        animateValue(node);
        return;
    }
    if (counters[name].endVal !== next) {
        counters[name].update(next);
        animateValue(node);
    }
}

function setCover(url) {
    const next = url || '';
    if (next === requestedCover) return;
    requestedCover = next;
    const request = ++coverRequest;
    const clear = () => {
        coverLayers.forEach(layer => layer.classList.remove('active'));
    };
    if (!next) {
        clear();
        return;
    }
    const image = new Image();
    image.onload = () => {
        if (request !== coverRequest) return;
        const incomingIndex = activeCover === 0 ? 1 : 0;
        const incoming = coverLayers[incomingIndex];
        incoming.style.transition = 'none';
        incoming.classList.remove('active');
        incoming.src = next;
        incoming.getBoundingClientRect();
        incoming.style.removeProperty('transition');
        incoming.classList.add('active');
        coverLayers[activeCover].classList.remove('active');
        activeCover = incomingIndex;
    };
    image.onerror = () => { if (request === coverRequest) clear(); };
    image.src = next;
}

function setMapCopy(value) {
    const keys = ['artist', 'title', 'difficulty', 'mapper', 'replayer'];
    const signature = keys.map(key => value[key]).join('\u0000');
    if (signature === copySignature) return;
    const first = !copySignature;
    copySignature = signature;
    const request = ++copyRequest;
    clearTimeout(copyTimer);
    copyAnimation?.cancel();
    const apply = () => {
        for (const key of keys) ui[key].textContent = value[key] || '—';
        requestAnimationFrame(updateTitleMotion);
    };
    if (first || reducedMotion.matches) {
        apply();
        return;
    }
    const element = byId('map-copy');
    copyAnimation = element.animate([
        { opacity: 1, filter: 'blur(0px)', transform: 'translateY(0)' },
        { opacity: 0, filter: 'blur(4px)', transform: 'translateY(-3px)' }
    ], { duration: 85, easing: easeOut, fill: 'forwards' });
    copyTimer = setTimeout(() => {
        if (request !== copyRequest) return;
        apply();
        copyAnimation.cancel();
        copyAnimation = element.animate([
            { opacity: 0, filter: 'blur(4px)', transform: 'translateY(4px)' },
            { opacity: 1, filter: 'blur(0px)', transform: 'translateY(0)' }
        ], { duration: 220, easing: easeOut });
    }, 85);
}

async function setMapBadge(value) {
    const nextType = ['edit', 'custom'].includes(value) ? value : '';
    if (nextType === badgeType) return;
    badgeType = nextType;
    const request = ++badgeRequest;
    const element = byId('map-badge');
    badgeAnimation?.cancel();
    if (!element.hidden && !reducedMotion.matches) {
        badgeAnimation = element.animate([
            { transform: 'translateY(0)', filter: 'blur(0px)', opacity: 1 },
            { transform: 'translateY(-3px)', filter: 'blur(3px)', opacity: 0 }
        ], { duration: 140, easing: easeOut, fill: 'forwards' });
        try { await badgeAnimation.finished; } catch {}
        if (request !== badgeRequest) return;
    }
    badgeAnimation?.cancel();
    element.hidden = !nextType;
    element.dataset.type = nextType;
    element.querySelector('span').textContent = nextType === 'edit' ? 'CICO EDIT' : nextType === 'custom' ? 'CUSTOM' : '';
    if (!nextType || reducedMotion.matches) return;
    badgeAnimation = element.animate([
        { transform: 'translateY(3px)', filter: 'blur(3px)', opacity: 0 },
        { transform: 'translateY(0)', filter: 'blur(0px)', opacity: 1 }
    ], { duration: 250, easing: easeOut });
}

function renderMap(map) {
    const value = map || {
        slot: '—', artist: '—', title: '—', difficulty: '—', mapper: '—', replayer: '—', length: '—'
    };
    if (activeSlot !== value.slot) {
        activeSlot = value.slot;
        ui.pick.textContent = value.slot;
        ui.pick.style.setProperty('--mod-color', colorForSlot(value.slot));
        animateValue(ui.pick);
        syncPool();
    }
    setMapCopy(value);
    setMapBadge(value.badgeType);
    setCover(value.cover);
    for (const key of ['sr', 'cs', 'ar', 'od', 'hp', 'bpm']) updateCounter(key, value[key]);
    if (ui.length.textContent !== (value.length || '—')) {
        ui.length.textContent = value.length || '—';
        animateValue(ui.length);
    }
    hasRendered = true;
}

function applyPayload(data) {
    packetRevision++;
    clearTimeout(staleTimer);
    renderMap(CICOMapData.fromPayload(data, maps));
}

function connect() {
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
    socket = new ReconnectingWebSocket(`${protocol}://${location.host}/websocket/v2`);
    socket.onopen = async () => {
        const revision = packetRevision;
        try {
            const response = await fetch('/json/v2', { cache: 'no-store' });
            if (response.ok) {
                const data = await response.json();
                if (revision === packetRevision) applyPayload(data);
            }
        } catch {}
    };
    socket.onmessage = event => {
        try { applyPayload(JSON.parse(event.data)); } catch {}
    };
    socket.onclose = () => {
        packetRevision++;
        clearTimeout(staleTimer);
        staleTimer = setTimeout(() => renderMap(null), 5000);
    };
}

async function start() {
    scaleScene();
    if (config.poolSource) {
        try {
            const response = await fetch(config.poolSource, { cache: 'no-store' });
            if (!response.ok) throw new Error('Mappool unavailable');
            const pool = await response.json();
            maps = Array.isArray(pool.maps) ? pool.maps : [];
            if (typeof pool.round === 'string' && pool.round.trim()) config.round = pool.round;
        } catch { maps = []; }
    }
    setupGeometry();
    renderPool();
    if (preview) {
        const script = document.createElement('script');
        script.src = 'preview.js';
        script.onload = () => {
            CICOPreview.start(applyPayload, params, maps);
        };
        document.body.append(script);
    } else {
        renderMap(null);
        connect();
    }
    await document.fonts.ready;
    updateTitleMotion();
}

addEventListener('resize', scaleScene);
addEventListener('pagehide', () => socket?.close());
reducedMotion.addEventListener('change', updateTitleMotion);
start();
