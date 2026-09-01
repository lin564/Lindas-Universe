// App wiring: controls, camera, readouts, animation loop.

import * as THREE from '../vendor/three.module.js';
import * as astro from './astro.js';
import { buildScene, updateScene, SCALE } from './scene.js';
import { drawChart } from './chart.js';

const $ = id => document.getElementById(id);

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const LOCATIONS = [
    { name: 'Chapel Hill, NC',   lat:  35.9132, lon:  -79.0558 },
    { name: 'Anchorage, AK',     lat:  61.2181, lon: -149.9003 },
    { name: 'Belém, Brazil',     lat:  -1.4558, lon:  -48.4902 },
    { name: 'Reykjavík, Iceland',lat:  64.1466, lon:  -21.9426 },
    { name: 'Nairobi, Kenya',    lat:  -1.2921, lon:   36.8219 },
    { name: 'Sydney, Australia', lat: -33.8688, lon:  151.2093 },
    { name: 'Longyearbyen, Svalbard', lat: 78.2232, lon: 15.6267 },
    { name: 'McMurdo, Antarctica',    lat: -77.8419, lon: 166.6863 },
    { name: 'Singapore',         lat:   1.3521, lon:  103.8198 },
    { name: 'Reims, France',     lat:  49.2583, lon:    4.0317 },
];

const state = {
    day: 172.35,          // start near the June solstice, mid-afternoon
    tilt: astro.TRUE_OBLIQUITY,
    lat: LOCATIONS[0].lat,
    lon: LOCATIONS[0].lon,
    speed: 0.6,           // simulated days per real second
    playing: true,
    view: 'system',       // 'system' | 'earth'
    showOrbits: true,
};

// Cached model output, recomputed only when its inputs change.
const cache = { curve: null, reference: null, diurnal: null, key: '', dayKey: -1 };

function refreshClimate() {
    const key = `${state.lat.toFixed(4)}|${state.tilt.toFixed(3)}`;
    if (cache.key !== key) {
        cache.curve = Array.from(astro.annualTemperatureCurve(state.lat, state.tilt));
        cache.reference = Math.abs(state.tilt - astro.TRUE_OBLIQUITY) < 0.05
            ? null
            : Array.from(astro.annualTemperatureCurve(state.lat, astro.TRUE_OBLIQUITY));
        cache.key = key;
        cache.dayKey = -1;
    }
    const d = ((Math.floor(state.day) % 365) + 365) % 365;
    if (cache.dayKey !== d) {
        cache.diurnal = astro.diurnalCycle(state.lat, d + 0.5, state.tilt, cache.curve[d]);
        cache.dayKey = d;
    }
}

// ---------------------------------------------------------------------------
// Scene + camera
// ---------------------------------------------------------------------------

const canvas = $('sky');
const s = buildScene(canvas);
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 3000);

const cam = {
    theta: 0.9, phi: 1.05,
    dist: 150, targetDist: 150,
    target: new THREE.Vector3(),
    goal: new THREE.Vector3(),
};
let dragging = false, lastX = 0, lastY = 0;

canvas.addEventListener('pointerdown', e => {
    dragging = true; lastX = e.clientX; lastY = e.clientY;
    canvas.classList.add('dragging');
    canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', e => {
    if (!dragging) return;
    cam.theta -= (e.clientX - lastX) * 0.005;
    cam.phi = astro.clamp(cam.phi - (e.clientY - lastY) * 0.005, 0.08, Math.PI - 0.08);
    lastX = e.clientX; lastY = e.clientY;
});
const endDrag = () => { dragging = false; canvas.classList.remove('dragging'); };
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);
canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const lim = state.view === 'earth' ? [3.2, 70] : [20, 900];
    cam.targetDist = astro.clamp(cam.targetDist * (1 + e.deltaY * 0.0012), lim[0], lim[1]);
}, { passive: false });

function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    s.renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

function setView(view) {
    state.view = view;
    cam.targetDist = view === 'earth' ? 9 : 150;
    if (view === 'earth') {
        // Swing around to the sunlit face, offset far enough to keep the
        // terminator in shot — opening on the night side shows nothing.
        const p = s.earthGroup.position;
        const toSun = Math.atan2(-p.z, -p.x);
        cam.theta = toSun + 0.75;
        cam.phi = 1.32;
    }
    $('view-system').classList.toggle('active', view === 'system');
    $('view-earth').classList.toggle('active', view === 'earth');
}

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------

const TILT_PRESETS = [
    { label: 'Upright (0°)', tilt: 0 },
    { label: "Earth (23.4°)", tilt: astro.TRUE_OBLIQUITY },
    { label: 'Mars (25.2°)', tilt: 25.19 },
    { label: 'Saturn (26.7°)', tilt: 26.73 },
    { label: 'Uranus (82.2°)', tilt: 82.23 },
];

function bind() {
    const loc = $('location');
    LOCATIONS.forEach((l, i) => {
        const o = document.createElement('option');
        o.value = String(i); o.textContent = l.name;
        loc.appendChild(o);
    });
    const custom = document.createElement('option');
    custom.value = 'custom'; custom.textContent = 'Custom…';
    loc.appendChild(custom);

    loc.addEventListener('change', () => {
        if (loc.value === 'custom') return;
        const l = LOCATIONS[+loc.value];
        state.lat = l.lat; state.lon = l.lon;
        $('lat').value = l.lat.toFixed(4);
        $('lon').value = l.lon.toFixed(4);
        refreshClimate();
    });

    const onCoord = () => {
        state.lat = astro.clamp(parseFloat($('lat').value) || 0, -89.5, 89.5);
        state.lon = ((parseFloat($('lon').value) || 0) + 540) % 360 - 180;
        loc.value = 'custom';
        refreshClimate();
    };
    $('lat').addEventListener('change', onCoord);
    $('lon').addEventListener('change', onCoord);

    $('tilt').addEventListener('input', e => {
        state.tilt = parseFloat(e.target.value);
        refreshClimate();
    });

    const presets = $('tilt-presets');
    TILT_PRESETS.forEach(p => {
        const b = document.createElement('button');
        b.className = 'chip';
        b.textContent = p.label;
        b.addEventListener('click', () => {
            state.tilt = p.tilt;
            $('tilt').value = String(p.tilt);
            refreshClimate();
        });
        presets.appendChild(b);
    });

    $('date').addEventListener('input', e => {
        state.day = Math.floor(state.day / 365) * 365 + parseFloat(e.target.value);
    });
    $('speed').addEventListener('input', e => {
        // Logarithmic: the useful range spans an hour per second to a month.
        state.speed = Math.pow(10, parseFloat(e.target.value));
    });
    $('play').addEventListener('click', () => {
        state.playing = !state.playing;
        $('play').textContent = state.playing ? '❚❚ Pause' : '▶ Play';
        $('play').classList.toggle('btn-accent', !state.playing);
    });
    $('orbits').addEventListener('change', e => { state.showOrbits = e.target.checked; });
    $('view-system').addEventListener('click', () => setView('system'));
    $('view-earth').addEventListener('click', () => setView('earth'));

    $('lat').value = state.lat.toFixed(4);
    $('lon').value = state.lon.toFixed(4);
    $('tilt').value = String(state.tilt);
    $('speed').value = String(Math.log10(state.speed));

    // Collapse the panels on small screens.
    document.querySelectorAll('[data-toggle]').forEach(btn => {
        btn.addEventListener('click', () => {
            $(btn.dataset.toggle).classList.toggle('collapsed');
        });
    });
}

// ---------------------------------------------------------------------------
// Readouts
// ---------------------------------------------------------------------------

const fmt = (v, d = 1) => (v >= 0 ? '' : '') + v.toFixed(d);

// Astronomical seasons, bounded by the equinoxes and solstices. Within about
// a day of one of those four instants, name the event instead — otherwise the
// solstice itself reads as "Spring", which is true by a few hours and looks
// like a bug.
const EVENTS = [[0, 'March equinox'], [90, 'June solstice'], [180, 'September equinox'], [270, 'December solstice']];

function seasonName(sunLongitude, lat) {
    const deg = sunLongitude * astro.RAD;
    for (const [at, name] of EVENTS) {
        const diff = Math.abs(((deg - at + 540) % 360) - 180);
        if (diff < 1.1) return name;
    }
    const q = Math.floor(deg / 90) % 4;
    const north = ['Spring', 'Summer', 'Autumn', 'Winter'];
    const south = ['Autumn', 'Winter', 'Spring', 'Summer'];
    return (lat >= 0 ? north : south)[q];
}

// Latitude at which the annual-mean sunlight equals the pole's. Above this
// tilt the poles are the sunniest place on the planet over a year, which is
// the single most surprising consequence of turning the slider up.
function polesBeatEquator(tilt) {
    let pole = 0, eq = 0;
    for (let d = 0; d < 365; d += 5) {
        pole += astro.dailyInsolation(89.9, d, tilt);
        eq += astro.dailyInsolation(0, d, tilt);
    }
    return pole > eq;
}

let lastFacts = '';

function updateReadouts(d) {
    const dayIdx = ((Math.floor(state.day) % 365) + 365) % 365;
    const seasonalT = cache.curve[dayIdx];
    const nowT = seasonalT + cache.diurnal(d.solarTime);

    // Daily extremes from the diurnal cycle.
    let hi = -1e9, lo = 1e9;
    for (let h = 0; h < 24; h += 0.25) {
        const t = seasonalT + cache.diurnal(h);
        if (t > hi) hi = t;
        if (t < lo) lo = t;
    }
    const annualHi = Math.max(...cache.curve);
    const annualLo = Math.min(...cache.curve);
    const annualMean = cache.curve.reduce((a, b) => a + b, 0) / cache.curve.length;

    $('temp-now').textContent = `${fmt(nowT)}°C`;
    $('temp-f').textContent = `${fmt(nowT * 9 / 5 + 32)} °F`;
    $('temp-range').textContent = `${fmt(lo)}° / ${fmt(hi)}°`;
    $('temp-annual').textContent = `${fmt(annualLo)}° … ${fmt(annualHi)}°`;
    $('temp-mean').textContent = `${fmt(annualMean)}°C`;

    $('r-date').textContent = astro.dayLabel(state.day);
    const hh = Math.floor(d.solarTime);
    const mm = Math.floor((d.solarTime - hh) * 60);
    $('r-time').textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    $('r-season').textContent = seasonName(d.sunLongitude, state.lat);
    $('r-elev').textContent = `${fmt(d.elevation)}°`;
    $('r-daylen').textContent = d.dayLength >= 23.99 ? '24 h (midnight sun)'
        : d.dayLength <= 0.01 ? '0 h (polar night)'
        : `${fmt(d.dayLength, 2)} h`;
    $('r-dec').textContent = `${fmt(d.declination, 2)}°`;
    $('r-insol').textContent = `${Math.round(d.insolation)} W/m²`;
    $('r-dist').textContent = `${d.distance.toFixed(4)} AU`;
    $('r-moon').textContent = `${Math.round(d.moonIllumination * 100)}% lit`;
    $('r-subsolar').textContent = `${fmt(d.subsolar.lat)}°, ${fmt(d.subsolar.lon)}°`;

    $('sun-state').textContent = d.elevation > 0 ? 'Sun is up' : 'Sun is down';
    $('sun-state').className = 'pill ' + (d.elevation > 0 ? 'pill-day' : 'pill-night');

    // Consequences of the current tilt, in plain language.
    const t = state.tilt;
    const facts = [];
    facts.push(`Tropics sit at ±${t.toFixed(1)}°; polar circles at ±${(90 - t).toFixed(1)}°.`);
    if (Math.abs(state.lat) <= t) {
        facts.push(`At ${Math.abs(state.lat).toFixed(1)}° you are inside the tropics — the Sun passes directly overhead twice a year.`);
    }
    if (Math.abs(state.lat) >= 90 - t && t > 0.5) {
        facts.push(`You are inside the polar circle: months of midnight sun, and months with no sunrise at all.`);
    }
    if (t < 0.5) {
        facts.push(`With no tilt there are no seasons — only the slight warmth of the January perihelion.`);
    }
    if (polesBeatEquator(t)) {
        facts.push(`Past roughly 54° the poles receive more sunlight over a year than the equator does. Yours do.`);
    }
    const html = facts.map(f => `<li>${f}</li>`).join('');
    if (html !== lastFacts) { $('facts').innerHTML = html; lastFacts = html; }
}

// ---------------------------------------------------------------------------
// Loop
// ---------------------------------------------------------------------------

let last = performance.now();
let chartTick = 0;

function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;

    if (state.playing) state.day += state.speed * dt;
    refreshClimate();

    const derived = updateScene(s, state);

    // Camera target: the Sun in system view, the Earth in Earth view.
    cam.goal.copy(state.view === 'earth' ? s.earthGroup.position : new THREE.Vector3());
    cam.target.lerp(cam.goal, state.view === 'earth' ? 0.12 : 0.08);
    cam.dist += (cam.targetDist - cam.dist) * 0.1;

    const sp = Math.sin(cam.phi);
    camera.position.set(
        cam.target.x + cam.dist * sp * Math.cos(cam.theta),
        cam.target.y + cam.dist * Math.cos(cam.phi),
        cam.target.z + cam.dist * sp * Math.sin(cam.theta),
    );
    camera.lookAt(cam.target);

    updateReadouts(derived);
    $('date').value = String(((state.day % 365) + 365) % 365);
    $('tilt-value').textContent = `${state.tilt.toFixed(1)}°`;
    $('speed-value').textContent = speedLabel(state.speed);

    // The chart only changes with the day, so redraw it a few times a second.
    if (now - chartTick > 180) {
        chartTick = now;
        drawChart($('chart'), {
            curve: cache.curve, reference: cache.reference,
            day: state.day, tilt: state.tilt,
        });
    }

    s.renderer.render(s.scene, camera);
    requestAnimationFrame(frame);
}

function speedLabel(v) {
    if (v < 0.05) return `${(v * 24).toFixed(1)} h / s`;
    if (v < 1.2) return `${(v * 24).toFixed(0)} h / s`;
    if (v < 45) return `${v.toFixed(1)} days / s`;
    return `${(v / 30.44).toFixed(1)} months / s`;
}

bind();
refreshClimate();
updateScene(s, state);   // seed body positions so setView can aim the camera
setView('system');
requestAnimationFrame(frame);
