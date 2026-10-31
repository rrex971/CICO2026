(function (root) {
    const fps = 60;
    const duration = 2600;
    const switchPoint = 1300;
    const exitStart = 1770;
    const clamp = value => Math.max(0, Math.min(1, value));
    const circularOut = value => Math.sqrt(1 - (clamp(value) - 1) ** 2);
    const circularIn = value => 1 - Math.sqrt(1 - clamp(value) ** 2);

    function travel(time) {
        const coralIn = circularOut(time / 550);
        const creamIn = circularOut((time - 230) / 550);
        const coralOut = circularIn((time - exitStart - 185) / 550);
        const creamOut = circularIn((time - exitStart) / 550);
        return {
            coral: -800 * (1 - coralIn + coralOut),
            cream: 800 * (1 - creamIn + creamOut)
        };
    }

    const motion = [{ phase: 0, energy: 0 }];
    let previous = travel(0);
    for (let frame = 1; frame <= Math.ceil(duration * fps / 1000); frame++) {
        const position = travel(frame * 1000 / fps);
        const speed = Math.max(Math.abs(position.coral - previous.coral), Math.abs(position.cream - previous.cream)) * fps / 800;
        const target = Math.min(1, speed / 2.2);
        const last = motion.at(-1);
        const energy = last.energy + (target - last.energy) * (1 - Math.exp(-12 / fps));
        motion.push({ energy, phase: last.phase + (1.4 + energy * 5) / fps });
        previous = position;
    }

    function sample(time) {
        const bounded = Math.max(0, Math.min(duration, time));
        const frame = bounded * fps / 1000;
        const first = motion[Math.floor(frame)];
        const next = motion[Math.min(motion.length - 1, Math.floor(frame) + 1)];
        const blend = frame % 1;
        return {
            ...travel(bounded),
            phase: first.phase + (next.phase - first.phase) * blend,
            energy: first.energy + (next.energy - first.energy) * blend
        };
    }

    const timeline = { fps, duration, switchPoint, sample };
    root.CICOStingerTimeline = timeline;
    if (typeof module !== 'undefined') module.exports = timeline;
})(globalThis);
