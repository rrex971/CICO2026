const config = window.CICO2026;
const params = new URLSearchParams(location.search);
const byId = id => document.getElementById(id);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const waveStops = [];
const waveExitStops = [];
for (let step = 0; step <= 40; step++) {
    const progress = step / 40;
    const circular = Math.sqrt(1 - (progress - 1) ** 2);
    waveStops.push(`${circular.toFixed(5)} ${progress * 100}%`);
    const circularIn = 1 - Math.sqrt(1 - progress ** 2);
    waveExitStops.push(`${circularIn.toFixed(5)} ${progress * 100}%`);
}
const waveEase = `linear(${waveStops.join(', ')})`;
const waveExitEase = `linear(${waveExitStops.join(', ')})`;
const formatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const countries = new Intl.DisplayNames(['en'], { type: 'region' });
const countryNames = { HK: 'Hong Kong', RU: 'Russian Federation' };
let screens = [];
let slots = [];
let pool = [];
let cursor = -1;
let busy = false;
let scoreCounter;
let percentCounter;
let sequence = 0;
let animations = [];
let autoTimer;
let waveFrame = 0;
let waveEnergy = 0;
const waveTravel = new Map();

function scaleScene() {
    document.documentElement.style.setProperty('--scale', Math.min(innerWidth / 1920, innerHeight / 1080));
}

function element(tag, className, text) {
    const node = document.createElement(tag);
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

function avatar(player, className) {
    const frame = element('div', `${className} avatar`);
    const image = document.createElement('img');
    image.alt = '';
    setAvatar(image, player);
    frame.append(image);
    return frame;
}

function setAvatar(image, player) {
    image.classList.remove('failed');
    image.onerror = () => image.classList.add('failed');
    image.draggable = false;
    image.src = `https://a.ppy.sh/${player.userId}`;
}

function setFlag(image, country) {
    image.hidden = false;
    image.onerror = () => {
        if (image.dataset.fallback === '1') { image.hidden = true; return; }
        image.dataset.fallback = '1';
        image.src = `https://assets.ppy.sh/old-flags/${country}.png`;
    };
    image.dataset.fallback = '0';
    image.alt = country;
    image.draggable = false;
    image.src = CICOSeeds.flagUrl(country);
}

function renderEliminated(screen) {
    byId('seed-range').textContent = `SEEDS ${screen.players[0].seed}–${screen.players.at(-1).seed}`;
    byId('player-grid').replaceChildren(...screen.players.map(player => {
        const card = element('article', 'player-card panel');
        card.dataset.seed = player.seed;
        const copy = element('div', 'player-copy');
        const name = element('div', 'player-name', player.username);
        name.title = player.username;
        const flag = element('img', 'country-flag');
        setFlag(flag, player.country);
        const nameRow = element('div', 'player-name-row');
        nameRow.append(flag, name);
        copy.append(element('div', 'player-seed', `#${player.seed}`), nameRow);
        card.append(avatar(player, 'player-avatar'), copy);
        return card;
    }));
    fitNames('.player-name', 29, 19);
}

function renderModCards(player) {
    byId('mod-grid').replaceChildren(...['NM', 'HD', 'HR', 'DT'].map(mod => {
        const card = element('section', 'mod-card panel');
        card.style.setProperty('--mod-color', config.modColors[mod]);
        card.style.setProperty('--mod-depth', config.modDepthColors[mod]);
        const heading = element('div', 'mod-heading');
        const standing = element('div', 'mod-standing');
        standing.append(element('span', '', 'MOD SEED'), element('strong', '', `#${player.modSeeds[mod]}`));
        heading.append(element('h2', '', mod), standing);
        const rows = element('div', 'map-rows');
        for (const [index, slot] of slots.entries()) {
            if (!slot.startsWith(mod)) continue;
            const map = pool.find(map => map.slot === slot);
            const row = element('div', 'map-row');
            const performance = element('div', 'map-performance');
            const title = [map?.artist, map?.title].filter(Boolean).join(' - ') || '—';
            const titleNode = element('div', 'map-title', title);
            titleNode.title = title;
            performance.append(element('div', 'map-score', formatter.format(player.scores[index])), titleNode);
            row.append(element('div', 'slot-label', slot), performance, element('div', 'map-seed', `#${player.ranks[index]}`));
            rows.append(row);
        }
        card.append(heading, rows);
        return card;
    }));
}

function updateSummaries(player) {
    if (reducedMotion.matches) {
        scoreCounter?.reset();
        percentCounter?.reset();
        byId('average-score').textContent = formatter.format(player.averageScore);
        byId('percent-max').textContent = player.percentMaxSum.toFixed(3);
        return;
    }
    if (!scoreCounter) {
        scoreCounter = new CountUp(byId('average-score'), player.averageScore, player.averageScore, 0, .45, { useGrouping: true, separator: ',' });
        percentCounter = new CountUp(byId('percent-max'), player.percentMaxSum, player.percentMaxSum, 3, .45, { useGrouping: false });
        scoreCounter.start();
        percentCounter.start();
    } else {
        scoreCounter.update(player.averageScore);
        percentCounter.update(player.percentMaxSum);
    }
}

function renderDetail(player) {
    setAvatar(byId('avatar'), player);
    byId('seed-number').textContent = `#${player.seed}`;
    byId('username').textContent = player.username;
    setFlag(byId('flag'), player.country);
    byId('country').textContent = countryNames[player.country] || countries.of(player.country);
    byId('rank').textContent = player.rank ? `#${formatter.format(player.rank)}` : '—';
    renderModCards(player);
    updateSummaries(player);
    fitNames('.username', 48, 32);
}

function fitNames(selector, maximum, minimum) {
    for (const node of document.querySelectorAll(selector)) {
        node.style.fontSize = `${maximum}px`;
        for (let size = maximum; node.scrollWidth > node.clientWidth && size > minimum; size--) node.style.fontSize = `${size - 1}px`;
    }
}

function renderScreen(index) {
    if (index === -1) {
        cursor = -1;
        byId('detail').hidden = true;
        byId('eliminated').hidden = true;
        byId('overlay').dataset.screen = '-1';
        return;
    }
    const screen = screens[index];
    if (!screen) return;
    cursor = index;
    byId('detail').hidden = screen.type !== 'detail';
    byId('eliminated').hidden = screen.type !== 'eliminated';
    byId('overlay').dataset.screen = String(index);
    if (screen.type === 'detail') renderDetail(screen.player);
    else renderEliminated(screen);
    preload(index + 1);
}

function animate(node, frames, options) {
    const animation = node.animate(frames, { fill: 'both', ...options });
    animations.push(animation);
    if (node.classList.contains('wave-layer')) waveTravel.set(node, { animation, progress: 0 });
    return animation;
}

function updateWaveShape(phase, energy = 0) {
    CICOWaveShape.paint(byId('reveal'), phase, energy);
}

function stopWaveMotion() {
    cancelAnimationFrame(waveFrame);
    waveFrame = 0;
    waveEnergy = 0;
    waveTravel.clear();
}

function startWaveMotion() {
    stopWaveMotion();
    let previousTime = performance.now();
    let phase = 0;
    const draw = now => {
        if (reducedMotion.matches || byId('reveal').hidden) { waveFrame = 0; return; }
        const elapsed = Math.max(.001, Math.min(.05, (now - previousTime) / 1000));
        previousTime = now;
        let speed = 0;
        for (const travel of waveTravel.values()) {
            const progress = travel.animation.effect.getComputedTiming().progress ?? travel.progress;
            speed = Math.max(speed, Math.abs(progress - travel.progress) / elapsed);
            travel.progress = progress;
        }
        const targetEnergy = Math.min(1, speed / 2.2);
        waveEnergy += (targetEnergy - waveEnergy) * (1 - Math.exp(-elapsed * 12));
        phase += elapsed * (1.4 + waveEnergy * 5);
        updateWaveShape(phase, waveEnergy);
        waveFrame = requestAnimationFrame(draw);
    };
    draw(previousTime);
}

async function changeScreen(index) {
    if (index === -1 && !busy) { renderScreen(-1); return; }
    if (busy || !screens[index] || index === cursor) return;
    if (reducedMotion.matches) { renderScreen(index); return; }
    busy = true;
    const request = ++sequence;
    const screen = screens[index];
    const reveal = byId('reveal');
    const cream = document.querySelector('.wave-cream');
    const coral = document.querySelector('.wave-coral');
    const seedCopy = document.querySelector('.reveal-seed-copy');
    const playerCopy = byId('reveal-player');
    const statusCopy = byId('reveal-status');
    statusCopy.hidden = screen.type !== 'detail';
    byId('reveal-seed').textContent = screen.type === 'detail' ? `#${screen.player.seed}` : 'ELIMINATED';
    if (screen.type === 'detail') byId('reveal-name').textContent = screen.player.username;
    else byId('reveal-name').replaceChildren(element('strong', 'reveal-range', `#${screen.players[0].seed}–#${screen.players.at(-1).seed}`));
    seedCopy.classList.toggle('eliminated-copy', screen.type !== 'detail');
    playerCopy.classList.toggle('eliminated-copy', screen.type !== 'detail');
    if (screen.type === 'detail') {
        setAvatar(byId('reveal-avatar'), screen.player);
        setFlag(byId('reveal-flag'), screen.player.country);
    }
    reveal.hidden = false;
    startWaveMotion();
    try {
        await Promise.all([
            animate(coral, [{ transform: 'translateY(-800px)' }, { transform: 'translateY(0)' }], { duration: 550, easing: waveEase }).finished,
            animate(cream, [{ transform: 'translateY(800px)' }, { transform: 'translateY(0)' }], { duration: 550, delay: 230, easing: waveEase }).finished,
            animate(seedCopy, [{ transform: 'translateY(-120px)' }, { transform: 'translateY(0)' }], { duration: 690, delay: 70, easing: waveEase }).finished,
            animate(playerCopy, [{ transform: 'translateY(120px)' }, { transform: 'translateY(0)' }], { duration: 690, delay: 300, easing: waveEase }).finished,
            animate(statusCopy, [{ transform: 'translateY(-120px)' }, { transform: 'translateY(0)' }], { duration: 690, delay: 70, easing: waveEase }).finished
        ]);
        if (request !== sequence) return;
        renderScreen(index);
        await new Promise(resolve => setTimeout(resolve, 780));
        if (request !== sequence) return;
        await Promise.all([
            animate(cream, [{ transform: 'translateY(0)' }, { transform: 'translateY(800px)' }], { duration: 550, easing: waveExitEase }).finished,
            animate(coral, [{ transform: 'translateY(0)' }, { transform: 'translateY(-800px)' }], { duration: 550, delay: 185, easing: waveExitEase }).finished,
            animate(playerCopy, [{ transform: 'translateY(0)' }, { transform: 'translateY(-120px)' }], { duration: 600, easing: waveExitEase }).finished,
            animate(seedCopy, [{ transform: 'translateY(0)' }, { transform: 'translateY(120px)' }], { duration: 600, delay: 185, easing: waveExitEase }).finished,
            animate(statusCopy, [{ transform: 'translateY(0)' }, { transform: 'translateY(120px)' }], { duration: 600, delay: 185, easing: waveExitEase }).finished
        ]);
    } catch {}
    finally {
        if (request === sequence) {
            stopWaveMotion();
            reveal.hidden = true;
            animations.forEach(animation => animation.cancel());
            animations = [];
            busy = false;
        }
    }
}

function step(direction) {
    changeScreen(cursor + direction);
}

function preload(index) {
    const screen = screens[index];
    for (const player of screen ? (screen.players || [screen.player]) : []) {
        const image = new Image();
        image.src = `https://a.ppy.sh/${player.userId}`;
    }
}

async function start() {
    scaleScene();
    try {
        const responses = await Promise.all([fetch('../qualifier-seeds.json', { cache: 'no-store' }), fetch(config.poolSource, { cache: 'no-store' })]);
        if (responses.some(response => !response.ok)) throw new Error('Seed data unavailable');
        const [data, pools] = await Promise.all(responses.map(response => response.json()));
        if (!Array.isArray(data.players) || !data.players.length) throw new Error('No seed data');
        slots = data.slots;
        pool = pools.qualifiers.maps;
        screens = CICOSeeds.screens(data.players, config.seedReveal.qualifiedSeeds, config.seedReveal.eliminatedPageSize, params.get('eliminated') !== '0');
        let index = -1;
        if (params.has('page')) index = screens.findIndex(screen => screen.type === 'eliminated' && screen.page === Number(params.get('page')));
        if (params.has('seed')) index = screens.findIndex(screen => screen.player?.seed === Number(params.get('seed')) || screen.players?.some(player => player.seed === Number(params.get('seed'))));
        await document.fonts.ready;
        renderScreen(index);
        preload(index + 1);
        if (params.get('preview') === '1' && params.get('motion') !== '0') {
            autoTimer = setInterval(() => changeScreen((cursor + 1) % screens.length), 6500);
        }
    } catch (error) {
        byId('detail').hidden = true;
        byId('eliminated').hidden = true;
        byId('empty').hidden = false;
        console.error(error.message);
    }
}

document.body.addEventListener('click', () => step(1));
addEventListener('keydown', event => {
    if (['Space', 'Enter', 'ArrowRight', 'PageDown'].includes(event.code)) { event.preventDefault(); step(1); }
    if (['ArrowLeft', 'PageUp'].includes(event.code)) { event.preventDefault(); step(-1); }
    if (event.code === 'Home') { event.preventDefault(); changeScreen(-1); }
    if (event.code === 'End') { event.preventDefault(); changeScreen(screens.length - 1); }
});
addEventListener('resize', scaleScene);
addEventListener('pagehide', () => { sequence++; clearInterval(autoTimer); stopWaveMotion(); animations.forEach(animation => animation.cancel()); });
reducedMotion.addEventListener('change', () => {
    sequence++;
    stopWaveMotion();
    animations.forEach(animation => animation.cancel());
    animations = [];
    byId('reveal').hidden = true;
    busy = false;
    renderScreen(cursor);
});
start();
