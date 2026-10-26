const settings = window.CICO2026.startingSoon;
const params = new URLSearchParams(location.search);
const overlay = document.getElementById('overlay');
const background = document.getElementById('background-video');
const countdown = document.getElementById('countdown');
const feed = document.getElementById('twitch-chat');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const preview = params.get('preview') === '1';
const requestedMinutes = Number(params.get('minutes') ?? settings.minutes);
const duration = (Number.isFinite(requestedMinutes) ? Math.max(0, requestedMinutes) : settings.minutes) * 60000;
let deadline = Date.now() + duration;
let paused = null;
let connection;
let previewTimer;

function fitOverlay() {
    overlay.style.setProperty('--scale', Math.min(innerWidth / 1920, innerHeight / 1080));
}

function updateTimer() {
    const seconds = Math.max(0, Math.ceil((paused ?? deadline - Date.now()) / 1000));
    const value = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    if (countdown.textContent !== value) countdown.textContent = value;
}

function appendMessage(name, message, tags = {}) {
    feed.getAnimations().forEach(animation => animation.cancel());
    const anchor = feed.lastElementChild;
    const previousTop = anchor?.getBoundingClientRect().top;
    const row = document.createElement('div');
    row.className = 'chat-message entering';
    const label = document.createElement('strong');
    label.textContent = name;
    row.append(label, document.createTextNode(' '), CICOTwitch.fragment(message, tags));
    feed.append(row);
    while (feed.children.length > 30) feed.firstElementChild.remove();
    row.addEventListener('animationend', () => row.classList.remove('entering'), {once: true});
    if (!anchor?.isConnected || reducedMotion.matches) return;
    const scale = overlay.getBoundingClientRect().width / overlay.offsetWidth;
    const shift = (previousTop - anchor.getBoundingClientRect().top) / scale;
    feed.animate([{transform: `translateY(${shift}px)`}, {transform: 'translateY(0)'}], {
        duration: 180,
        easing: 'cubic-bezier(.16, 1, .3, 1)'
    });
}

function startChat() {
    if (!preview) {
        connection = CICOTwitch.connect(settings.channel, appendMessage);
        return;
    }
    const messages = [
        ['catch_fan', 'Ready for the next round!'],
        ['a_very_long_viewer_username', 'Good luck everyone'],
        ['fruitcatcher', 'Kappa', {emotes: '25:0-4'}],
        ['spectator', 'The stream is looking sweet'],
        ['another_viewer', 'CICO2026 lets go!']
    ];
    for (const message of messages) appendMessage(...message);
    let index = 0;
    previewTimer = setInterval(() => appendMessage(...messages[index++ % messages.length]), 4200);
}

window.addEventListener('resize', fitOverlay);
window.addEventListener('keydown', event => {
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.code === 'KeyR') {
        paused = null;
        deadline = Date.now() + duration;
    } else if (event.code === 'Space') {
        event.preventDefault();
        if (paused === null) paused = Math.max(0, deadline - Date.now());
        else { deadline = Date.now() + paused; paused = null; }
    } else if (event.key === '+' || event.key === '=') {
        if (paused === null) deadline += 60000;
        else paused += 60000;
    } else if (event.key === '-') {
        if (paused === null) deadline -= 60000;
        else paused = Math.max(0, paused - 60000);
    }
    updateTimer();
});

fitOverlay();
background.src = settings.video;
background.play().catch(() => {});
updateTimer();
const timerInterval = setInterval(updateTimer, 100);
startChat();
window.addEventListener('pagehide', () => {
    clearInterval(timerInterval);
    clearInterval(previewTimer);
    connection?.close();
});
