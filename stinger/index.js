const timeline = CICOStingerTimeline;
const params = new URLSearchParams(location.search);
const cream = document.querySelector('.wave-cream');
const coral = document.querySelector('.wave-coral');

function scaleScene() {
    document.documentElement.style.setProperty('--scale', Math.min(innerWidth / 1920, innerHeight / 1080));
}

function render(time) {
    const state = timeline.sample(time);
    cream.style.transform = `translateY(${state.cream}px)`;
    coral.style.transform = `translateY(${state.coral}px)`;
    CICOWaveShape.paint(document.getElementById('overlay'), state.phase, state.energy);
}

window.CICOStinger = { ...timeline, render };
window.addEventListener('resize', scaleScene);
scaleScene();
render(Number(params.get('frame') || 0) * 1000 / timeline.fps);

if (!params.has('frame')) {
    Promise.all([document.fonts.ready, document.querySelector('.mascot').decode()]).then(() => {
        const start = performance.now();
        const draw = now => {
            const elapsed = now - start;
            render(params.has('preview') ? elapsed % (timeline.duration + 800) : elapsed);
            if (elapsed < timeline.duration || params.has('preview')) requestAnimationFrame(draw);
        };
        requestAnimationFrame(draw);
    });
}
