(function (root) {
    function curve(phase, energy = 0) {
        const amplitude = 18 + energy * 70;
        const offset = (value, shift) => (value + Math.sin(phase + shift) * amplitude).toFixed(2);
        const drift = (value, shift) => (value + Math.sin(phase * .8 + shift) * energy * 64).toFixed(2);
        return `M-24 ${offset(120, 0)} C${drift(200, 0)} ${offset(230, .7)} ${drift(295, .7)} ${offset(-28, 1.3)} 520 ${offset(72, 1.9)} C${drift(745, 1.4)} ${offset(172, 2.5)} ${drift(850, 2.1)} ${offset(212, 3.1)} 1080 ${offset(100, 3.7)} C${drift(1310, 2.8)} ${offset(-12, 4.3)} ${drift(1440, 3.5)} ${offset(-16, 4.9)} 1600 ${offset(78, 5.5)} C${drift(1760, 4.2)} ${offset(172, 6.1)} ${drift(1850, 4.9)} ${offset(186, 6.7)} 1944 ${offset(76, 7.3)}`;
    }

    function paint(container, phase, energy = 0) {
        const shape = curve(phase, energy);
        for (const path of container.querySelectorAll('.wave-cream .wave-surface, .wave-cream .wave-clip')) path.setAttribute('d', `${shape} V924 H-24Z`);
        for (const path of container.querySelectorAll('.wave-coral .wave-surface, .wave-coral .wave-clip')) path.setAttribute('d', `${shape} V-684 H-24Z`);
    }

    root.CICOWaveShape = { curve, paint };
})(globalThis);
