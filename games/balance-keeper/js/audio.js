// Tiny procedural audio — no asset downloads, school-network friendly.

let ctx = null;
let muted = false;

function ensureCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
}

export function toggleMute() {
    muted = !muted;
    return muted;
}

function tone(freq, start, dur, type = 'sine', peak = 0.12) {
    const ac = ensureCtx();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, ac.currentTime + start);
    gain.gain.exponentialRampToValueAtTime(peak, ac.currentTime + start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + start + dur);
    osc.connect(gain).connect(ac.destination);
    osc.start(ac.currentTime + start);
    osc.stop(ac.currentTime + start + dur + 0.05);
}

export function sfxTile() {
    if (muted) return;
    tone(520 + Math.random() * 120, 0, 0.12, 'triangle', 0.07);
}

export function sfxCancel() {
    if (muted) return;
    tone(740, 0, 0.1, 'sine', 0.06);
    tone(988, 0.06, 0.12, 'sine', 0.05);
}

export function sfxError() {
    if (muted) return;
    tone(160, 0, 0.22, 'sawtooth', 0.06);
    tone(120, 0.08, 0.25, 'sawtooth', 0.05);
}

export function sfxSolve() {
    if (muted) return;
    [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.4, 'sine', 0.1));
}

export function sfxBridge() {
    if (muted) return;
    [262, 330, 392, 523].forEach((f, i) => tone(f, i * 0.07, 0.3, 'triangle', 0.07));
}

export function sfxFinale() {
    if (muted) return;
    [392, 494, 587, 784, 988, 1175].forEach((f, i) => tone(f, i * 0.13, 0.6, 'sine', 0.09));
}
