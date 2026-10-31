const view = CICOMatchView;
const resultElement = document.querySelector('#result');
const nameElement = document.querySelector('#winner-name');
const avatarElement = document.querySelector('#winner-avatar');
const flagElement = document.querySelector('#winner-flag');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let context;
let signature = '';

function scale() {
    document.documentElement.style.setProperty('--scale', Math.min(innerWidth / 1920, innerHeight / 1080));
}

function renderHeader(round) {
    const header = view.header('Winner', round);
    header.classList.remove('match-header');
    document.querySelector('#branding').append(header);
}

function fitName() {
    if (resultElement.hidden) return;
    nameElement.style.fontSize = '';
    const size = parseFloat(getComputedStyle(nameElement).fontSize);
    if (nameElement.scrollWidth > nameElement.clientWidth) {
        nameElement.style.fontSize = `${Math.max(36, size * nameElement.clientWidth / nameElement.scrollWidth)}px`;
    }
}

function updateAvatar(player) {
    const id = Number(player.id) > 0 ? String(player.id) : '';
    avatarElement.alt = player.name;
    if (avatarElement.dataset.user === id) return;
    avatarElement.dataset.user = id;
    avatarElement.hidden = true;
    if (!id) {
        avatarElement.removeAttribute('src');
        return;
    }
    avatarElement.onload = () => { if (avatarElement.dataset.user === id) avatarElement.hidden = false; };
    avatarElement.onerror = () => { avatarElement.hidden = true; };
    avatarElement.src = `https://a.ppy.sh/${id}`;
}

function updateFlag(country) {
    const code = /^[A-Z]{2}$/.test(country || '') ? country : '';
    flagElement.hidden = !code;
    flagElement.alt = code;
    if (flagElement.dataset.country === code) return;
    flagElement.dataset.country = code;
    if (!code) {
        flagElement.removeAttribute('src');
        return;
    }
    flagElement.onerror = () => {
        flagElement.onerror = () => { flagElement.hidden = true; };
        flagElement.src = `https://assets.ppy.sh/old-flags/${code}.png`;
    };
    flagElement.src = `https://osu.ppy.sh/assets/images/flags/${[...code].map(char => (char.charCodeAt(0) + 127397).toString(16)).join('-')}.svg`;
}

function render(data) {
    const points = [0, 1].map(side => data.store.state.points[side] ?? data.points[side]);
    if (data.preview && data.params.get('winner') !== 'none') {
        const side = data.params.get('winner') === '2' ? 1 : 0;
        points[side] = Math.ceil(CICO2026.match.bestOf / 2);
        points[1 - side] = Math.max(0, points[side] - 2);
    }
    const winner = CICOMatchData.winner(data.players, points, CICO2026.match.bestOf);
    const profile = winner ? data.profiles.find(player => Number(player.userId) === Number(winner.player.id)) : null;
    const country = winner?.player.country || profile?.country || '';
    const next = winner ? JSON.stringify([winner.side, winner.player.id, winner.player.name, country]) : '';
    if (signature === next) return;
    signature = next;
    resultElement.getAnimations({ subtree: true }).forEach(animation => animation.cancel());
    resultElement.hidden = !winner;
    if (!winner) {
        nameElement.textContent = '';
        return;
    }
    resultElement.className = `side-${winner.side}`;
    nameElement.textContent = winner.player.name;
    updateAvatar(winner.player);
    updateFlag(country);
    fitName();
    if (!reducedMotion.matches) {
        for (const [index, element] of [document.querySelector('.winner-mascot'), document.querySelector('.winner-heading'), document.querySelector('.winner-card')].entries()) {
            element.animate([
                { opacity: 0, transform: 'translateY(24px)', filter: 'blur(7px)' },
                { opacity: 1, transform: 'translateY(0)', filter: 'blur(0)' }
            ], { duration: 520, delay: index * 65, easing: 'cubic-bezier(.16, 1, .3, 1)', fill: 'backwards' });
        }
    }
}

async function start() {
    scale();
    await document.fonts.ready;
    try {
        context = await CICOBroadcast.open(render);
        renderHeader(context.pool.round);
        window.CICOScene = { get context() { return context; } };
    } catch (error) {
        renderHeader(CICO2026.round);
        console.error('Winner scene unavailable:', error.message);
    }
}

addEventListener('resize', () => { scale(); fitName(); });
start();
