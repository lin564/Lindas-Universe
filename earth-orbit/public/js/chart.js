// The year-long temperature plot under the readouts.
//
// Draws the annual cycle the energy-balance model settles into for the current
// latitude and tilt, with the real-Earth (23.44°) curve behind it as a ghost so
// the effect of moving the tilt slider is visible rather than merely numeric.

import { monthStarts, TRUE_OBLIQUITY } from './astro.js';

const PAD = { l: 34, r: 10, t: 12, b: 18 };

export function drawChart(canvas, { curve, reference, day, tilt }) {
    const dpr = Math.min(window.devicePixelRatio, 2);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr; canvas.height = h * dpr;
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const plotW = w - PAD.l - PAD.r;
    const plotH = h - PAD.t - PAD.b;

    // Shared vertical range, so the two curves are directly comparable.
    const all = reference ? [...curve, ...reference] : [...curve];
    let lo = Math.min(...all), hi = Math.max(...all);
    const span = Math.max(hi - lo, 8);
    lo -= span * 0.12; hi += span * 0.12;

    const X = d => PAD.l + (d / 365) * plotW;
    const Y = t => PAD.t + (1 - (t - lo) / (hi - lo)) * plotH;

    // --- grid -------------------------------------------------------------
    ctx.font = '9px Inter, system-ui, sans-serif';
    ctx.textBaseline = 'middle';

    const step = niceStep((hi - lo) / 4);
    ctx.strokeStyle = 'rgba(140,165,205,0.14)';
    ctx.fillStyle = 'rgba(154,167,192,0.85)';
    ctx.lineWidth = 1;
    for (let t = Math.ceil(lo / step) * step; t <= hi; t += step) {
        const y = Math.round(Y(t)) + 0.5;
        ctx.beginPath(); ctx.moveTo(PAD.l, y); ctx.lineTo(w - PAD.r, y); ctx.stroke();
        ctx.textAlign = 'right';
        ctx.fillText(`${Math.round(t)}°`, PAD.l - 5, y);
    }

    // Freezing line, when it is in view — the most legible reference there is.
    if (lo < 0 && hi > 0) {
        ctx.strokeStyle = 'rgba(134,165,217,0.5)';
        ctx.setLineDash([3, 3]);
        const y = Math.round(Y(0)) + 0.5;
        ctx.beginPath(); ctx.moveTo(PAD.l, y); ctx.lineTo(w - PAD.r, y); ctx.stroke();
        ctx.setLineDash([]);
    }

    // Month ticks.
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(154,167,192,0.7)';
    monthStarts().forEach(({ day: d, name }, i) => {
        const x = X(d);
        ctx.strokeStyle = 'rgba(140,165,205,0.09)';
        ctx.beginPath(); ctx.moveTo(x, PAD.t); ctx.lineTo(x, h - PAD.b); ctx.stroke();
        if (i % 2 === 0) ctx.fillText(name[0], x + plotW / 24, h - PAD.b + 8);
    });

    // --- curves -----------------------------------------------------------
    const stroke = (data, style, width, dash = []) => {
        ctx.save();
        ctx.setLineDash(dash);
        ctx.strokeStyle = style;
        ctx.lineWidth = width;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        for (let d = 0; d < data.length; d++) {
            const x = X(d), y = Y(data[d]);
            d === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.restore();
    };

    if (reference) stroke(reference, 'rgba(134,165,217,0.5)', 1.2, [4, 3]);

    // Fill under the live curve, warm above freezing and cold below.
    const grad = ctx.createLinearGradient(0, PAD.t, 0, h - PAD.b);
    grad.addColorStop(0, 'rgba(255,59,10,0.30)');
    grad.addColorStop(0.55, 'rgba(255,140,60,0.12)');
    grad.addColorStop(1, 'rgba(91,192,235,0.16)');
    ctx.beginPath();
    ctx.moveTo(X(0), h - PAD.b);
    for (let d = 0; d < curve.length; d++) ctx.lineTo(X(d), Y(curve[d]));
    ctx.lineTo(X(curve.length - 1), h - PAD.b);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    stroke(curve, '#ff7a45', 1.9);

    // --- today ------------------------------------------------------------
    const d0 = ((Math.floor(day) % 365) + 365) % 365;
    const x = X(d0), y = Y(curve[d0]);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, PAD.t); ctx.lineTo(x, h - PAD.b); ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(x, y, 3.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff3b0a';
    ctx.beginPath(); ctx.arc(x, y, 1.8, 0, Math.PI * 2); ctx.fill();

    // Legend, only when the ghost curve is actually distinguishable.
    if (reference) {
        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(154,167,192,0.9)';
        ctx.fillText(`dashed = ${TRUE_OBLIQUITY}° (today's Earth)`, PAD.l + 3, PAD.t + 5);
    }
}

function niceStep(raw) {
    const mag = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1e-6))));
    const n = raw / mag;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag;
}
