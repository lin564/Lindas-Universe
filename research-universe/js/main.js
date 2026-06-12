import * as THREE from '../vendor/three.module.js';
import { buildGalaxy, buildStarfield, TYPE_COLORS, TYPE_LABELS } from './galaxy.js';
import * as claude from './claude.js';

const $ = id => document.getElementById(id);

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------

const canvas = $('space');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x04060f);
scene.fog = new THREE.FogExp2(0x04060f, 0.0035);
scene.add(buildStarfield());

const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 1000);

// Simple inertial orbit controls (drag to rotate, wheel/pinch to zoom).
const orbit = { theta: 0.6, phi: 1.15, dist: 95, vTheta: 0, vPhi: 0 };
let dragging = false, lastX = 0, lastY = 0, downAt = null;

canvas.addEventListener('pointerdown', e => {
    dragging = true; lastX = e.clientX; lastY = e.clientY;
    downAt = { x: e.clientX, y: e.clientY };
    canvas.classList.add('dragging');
    canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', e => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    mouseClient = { x: e.clientX, y: e.clientY };
    if (!dragging) return;
    orbit.vTheta = (e.clientX - lastX) * 0.005;
    orbit.vPhi = (e.clientY - lastY) * 0.005;
    orbit.theta -= orbit.vTheta;
    orbit.phi = THREE.MathUtils.clamp(orbit.phi - orbit.vPhi, 0.15, Math.PI - 0.15);
    lastX = e.clientX; lastY = e.clientY;
});
canvas.addEventListener('pointerup', e => {
    dragging = false;
    canvas.classList.remove('dragging');
    // Treat as a click only if the pointer barely moved.
    if (downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 5) pickNode();
    downAt = null;
});
canvas.addEventListener('wheel', e => {
    e.preventDefault();
    orbit.dist = THREE.MathUtils.clamp(orbit.dist * (1 + e.deltaY * 0.001), 18, 320);
}, { passive: false });

function resize() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ---------------------------------------------------------------------------
// Universe state
// ---------------------------------------------------------------------------

let universe = null;
let galaxy = null;        // { group, meshes, coreId }
let selected = null;      // node object
let hovered = null;
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2(-2, -2);
let mouseClient = { x: 0, y: 0 };

function setUniverse(u) {
    universe = u;
    if (galaxy) scene.remove(galaxy.group);
    galaxy = buildGalaxy(u);
    scene.add(galaxy.group);
    selected = null;
    hovered = null;
    $('node-panel').classList.add('hidden');
    $('universe-title').textContent = u.meta.title;
    $('universe-subtitle').textContent = u.meta.subtitle ?? '';
    document.title = `${u.meta.title} — Research Universe`;
    renderLegend();
    renderSources();
    try { localStorage.setItem('research-universe.current', JSON.stringify(u)); } catch { /* quota */ }
}

function nodeById(id) { return universe.nodes.find(n => n.id === id); }

// ---------------------------------------------------------------------------
// Picking, hover, selection
// ---------------------------------------------------------------------------

function intersectNode() {
    if (!galaxy) return null;
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects([...galaxy.meshes.values()], false);
    return hits.length ? hits[0].object.userData.node : null;
}

function pickNode() {
    const node = intersectNode();
    if (node) selectNode(node);
}

function selectNode(node, fly = true) {
    selected = node;
    renderNodePanel(node);
    if (fly && galaxy.holders.has(node.id)) {
        flyTarget = galaxy.holders.get(node.id).position.clone();
    }
}

let flyTarget = null;
const lookAt = new THREE.Vector3(0, 0, 0);

function renderNodePanel(node) {
    const colorHex = '#' + (TYPE_COLORS[node.type] ?? TYPE_COLORS.concept).toString(16).padStart(6, '0');
    const badge = $('node-type');
    badge.textContent = TYPE_LABELS[node.type] ?? node.type;
    badge.style.color = colorHex;
    $('node-label').textContent = node.label;
    $('node-summary').textContent = node.summary ?? '';

    const meters = $('node-meta');
    meters.innerHTML = '';
    if (node.type !== 'core') {
        meters.append(
            meter('Relevance — distance from core', node.relevance),
            meter('Information — size of the light', node.size),
            meter('Research interest — glow', node.interest ?? 0.5),
        );
        if (node.status) {
            const s = document.createElement('p');
            s.className = 'panel-hint';
            s.textContent = `Status: ${node.status}`;
            meters.append(s);
        }
    }

    const tags = $('node-tags');
    tags.innerHTML = '';
    (node.tags ?? []).forEach(t => {
        const el = document.createElement('span');
        el.className = 'tag';
        el.textContent = t;
        tags.append(el);
    });

    const url = $('node-url');
    if (node.url) { url.href = node.url; url.classList.remove('hidden'); }
    else url.classList.add('hidden');

    const expandable = ['core', 'hypothesis', 'subhypothesis', 'concept'].includes(node.type);
    $('btn-expand').classList.toggle('hidden', !expandable);

    const childrenBox = $('node-children');
    childrenBox.innerHTML = '';
    const children = universe.nodes.filter(n => n.parent === node.id);
    const crossLinks = (universe.links ?? []).filter(l => l.source === node.id || l.target === node.id);
    if (children.length) {
        childrenBox.insertAdjacentHTML('beforeend', '<h3>In orbit</h3>');
        children.forEach(c => childrenBox.append(childButton(c)));
    }
    if (crossLinks.length) {
        childrenBox.insertAdjacentHTML('beforeend', '<h3>Connections</h3>');
        crossLinks.forEach(l => {
            const other = nodeById(l.source === node.id ? l.target : l.source);
            if (other) childrenBox.append(childButton(other, l.relation));
        });
    }
    $('node-panel').classList.remove('hidden');
}

function childButton(node, relation) {
    const btn = document.createElement('button');
    btn.className = 'child-item';
    btn.innerHTML = `${escapeHtml(node.label)}${relation ? `<span class="child-relation">${escapeHtml(relation)}</span>` : ''}`;
    btn.addEventListener('click', () => selectNode(node));
    return btn;
}

function meter(label, value) {
    const v = Math.round(THREE.MathUtils.clamp(value ?? 0, 0, 1) * 100);
    const el = document.createElement('div');
    el.className = 'meter';
    el.innerHTML = `<div class="meter-label"><span>${label}</span><span>${v}%</span></div>
        <div class="meter-track"><div class="meter-fill" style="width:${v}%"></div></div>`;
    return el;
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------------------------------------------------------------------------
// Sources panel + legend + search
// ---------------------------------------------------------------------------

function renderSources() {
    const list = $('sources-list');
    list.innerHTML = '';
    universe.nodes
        .filter(n => ['dataset', 'paper', 'organization'].includes(n.type))
        .sort((a, b) => (b.relevance ?? 0) - (a.relevance ?? 0) || (b.size ?? 0) - (a.size ?? 0))
        .forEach(n => {
            const li = document.createElement('li');
            li.className = 'source-item';
            li.innerHTML = `<div class="src-name">${escapeHtml(n.label)}</div>
                ${n.url ? `<a href="${escapeHtml(n.url)}" target="_blank" rel="noopener">${escapeHtml(shortUrl(n.url))} ↗</a>` : ''}
                <div class="src-bars">
                    <span class="src-bar rel" style="width:${(n.relevance ?? 0) * 56}px"></span>
                    <span class="src-bar-label">rel</span>
                    <span class="src-bar siz" style="width:${(n.size ?? 0) * 56}px"></span>
                    <span class="src-bar-label">size</span>
                    <span class="src-bar glow" style="width:${(n.interest ?? 0.5) * 56}px"></span>
                    <span class="src-bar-label">glow</span>
                </div>`;
            li.addEventListener('click', e => {
                if (e.target.tagName !== 'A') selectNode(n);
            });
            list.append(li);
        });
}

function shortUrl(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

function renderLegend() {
    // Stars are uniform warm white; type shows in the tooltip and panels.
    $('legend').innerHTML =
        '<span class="legend-key">distance = relevance · size = information · glow = research interest</span>';
}

$('search').addEventListener('input', e => {
    const q = e.target.value.trim().toLowerCase();
    if (!galaxy) return;
    for (const holder of galaxy.holders.values()) {
        const u = holder.userData;
        const n = u.node;
        const hit = !q || `${n.label} ${n.summary} ${(n.tags ?? []).join(' ')}`.toLowerCase().includes(q);
        u.dim = hit ? 1 : 0.06;
        u.sprites.forEach((s, i) => { s.material.opacity = u.baseOpacities[i] * u.dim; });
    }
});
$('search').addEventListener('keydown', e => {
    if (e.key !== 'Enter' || !galaxy) return;
    const q = e.target.value.trim().toLowerCase();
    if (!q) return;
    const match = universe.nodes.find(n => `${n.label} ${n.summary}`.toLowerCase().includes(q));
    if (match) selectNode(match);
});

// ---------------------------------------------------------------------------
// Menus, modals, import/export
// ---------------------------------------------------------------------------

function openModal(id) {
    $('modal-backdrop').classList.remove('hidden');
    document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
    $(id).classList.remove('hidden');
}
function closeModals() { $('modal-backdrop').classList.add('hidden'); }

document.querySelectorAll('[data-close-modal]').forEach(b => b.addEventListener('click', closeModals));
$('modal-backdrop').addEventListener('click', e => { if (e.target === $('modal-backdrop')) closeModals(); });
document.querySelectorAll('.panel-close').forEach(b =>
    b.addEventListener('click', () => $(b.dataset.close).classList.add('hidden')));

$('btn-menu').addEventListener('click', () => $('menu-popover').classList.toggle('hidden'));
document.addEventListener('click', e => {
    if (!$('menu-popover').contains(e.target) && e.target !== $('btn-menu')) {
        $('menu-popover').classList.add('hidden');
    }
});

$('btn-sources').addEventListener('click', () => $('sources-panel').classList.toggle('hidden'));
$('btn-new').addEventListener('click', () => { openModal('modal-generate'); $('gen-model').value = claude.getModel(); });
$('btn-settings').addEventListener('click', () => { openModal('modal-settings'); $('api-key').value = claude.getApiKey(); });
$('btn-about').addEventListener('click', () => {
    $('about-title').textContent = universe.meta.title;
    $('about-description').textContent = universe.meta.description ?? '';
    openModal('modal-about');
});

$('btn-export').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(universe, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${(universe.meta.title || 'universe').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
});

$('btn-import').addEventListener('click', () => $('file-input').click());
$('file-input').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
        const u = JSON.parse(await file.text());
        if (!Array.isArray(u.nodes) || !u.meta?.title) throw new Error('not a universe document');
        u.links ??= [];
        setUniverse(u);
    } catch (err) {
        alert(`Could not import: ${err.message}`);
    }
    e.target.value = '';
});

$('btn-sample').addEventListener('click', loadSample);

$('key-save').addEventListener('click', () => { claude.setApiKey($('api-key').value.trim()); closeModals(); });
$('key-clear').addEventListener('click', () => { claude.setApiKey(''); $('api-key').value = ''; });

// ---------------------------------------------------------------------------
// Generate & expand with Claude
// ---------------------------------------------------------------------------

function setStatus(msg, isError = false) {
    const el = $('gen-status');
    el.textContent = msg;
    el.classList.toggle('error', isError);
}

$('gen-go').addEventListener('click', async () => {
    const description = $('gen-description').value.trim();
    if (!description) { setStatus('Describe your study area first.', true); return; }
    claude.setModel($('gen-model').value);
    $('gen-go').disabled = true;
    try {
        const u = await claude.generateUniverse(description, setStatus);
        setUniverse(u);
        setStatus('');
        closeModals();
    } catch (err) {
        setStatus(err.message, true);
    } finally {
        $('gen-go').disabled = false;
    }
});

$('gen-copy-prompt').addEventListener('click', async () => {
    const description = $('gen-description').value.trim();
    if (!description) { setStatus('Describe your study area first.', true); return; }
    await navigator.clipboard.writeText(claude.buildCopyPrompt(description));
    setStatus('Prompt copied. Paste it into claude.ai, save the JSON reply as a .json file, then use “Import universe JSON”.');
});

$('btn-expand').addEventListener('click', async () => {
    if (!selected) return;
    const node = selected;
    const btn = $('btn-expand');
    btn.disabled = true;
    const original = btn.textContent;
    try {
        const added = await claude.expandNode(universe, node, msg => { btn.textContent = msg; });
        setUniverse(universe);          // rebuild galaxy with the new nodes
        selectNode(nodeById(node.id) ?? universe.nodes[0], false);
        btn.textContent = `Added ${added} new nodes ✓`;
    } catch (err) {
        btn.textContent = original;
        alert(err.message);
    } finally {
        btn.disabled = false;
        setTimeout(() => { btn.textContent = original; }, 2500);
    }
});

// ---------------------------------------------------------------------------
// Boot + render loop
// ---------------------------------------------------------------------------

async function loadSample() {
    const res = await fetch('data/el-nino.json');
    setUniverse(await res.json());
}

(async function boot() {
    const saved = localStorage.getItem('research-universe.current');
    if (saved) {
        try { setUniverse(JSON.parse(saved)); return; } catch { /* fall through */ }
    }
    await loadSample();
})();

const tooltip = $('tooltip');
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const dt = clock.getDelta();
    const t = clock.elapsedTime;

    if (galaxy && !dragging) galaxy.group.rotation.y += dt * 0.015;

    // Inertia after drag release.
    if (!dragging) {
        orbit.theta -= orbit.vTheta;
        orbit.phi = THREE.MathUtils.clamp(orbit.phi - orbit.vPhi, 0.15, Math.PI - 0.15);
        orbit.vTheta *= 0.94;
        orbit.vPhi *= 0.94;
    }

    // Glide the look-at point toward the selected node.
    if (flyTarget) {
        const world = flyTarget.clone();
        if (galaxy) galaxy.group.localToWorld(world.copy(flyTarget));
        lookAt.lerp(world, 0.06);
        if (lookAt.distanceTo(world) < 0.2) flyTarget = null;
    } else if (!selected) {
        lookAt.lerp(new THREE.Vector3(0, 0, 0), 0.04);
    }

    camera.position.set(
        lookAt.x + orbit.dist * Math.sin(orbit.phi) * Math.cos(orbit.theta),
        lookAt.y + orbit.dist * Math.cos(orbit.phi),
        lookAt.z + orbit.dist * Math.sin(orbit.phi) * Math.sin(orbit.theta),
    );
    camera.lookAt(lookAt);

    // Hover tooltip + selected-node pulse.
    if (galaxy) {
        const node = dragging ? null : intersectNode();
        if (node !== hovered) {
            hovered = node;
            canvas.style.cursor = node ? 'pointer' : dragging ? 'grabbing' : 'grab';
            if (node) {
                tooltip.innerHTML = `<div class="tooltip-type">${TYPE_LABELS[node.type] ?? node.type}</div>${escapeHtml(node.label)}`;
                tooltip.classList.remove('hidden');
            } else {
                tooltip.classList.add('hidden');
            }
        }
        if (hovered) { tooltip.style.left = `${mouseClient.x}px`; tooltip.style.top = `${mouseClient.y}px`; }

        // Dust is galaxy context: full when zoomed out, gone when zoomed
        // into a cluster so the working view is pure data.
        const dustFade = THREE.MathUtils.clamp((orbit.dist - 40) / 70, 0, 1);
        for (const m of galaxy.dustMaterials) m.opacity = m.userData.baseOpacity * dustFade;

        for (const [id, holder] of galaxy.holders) {
            const u = holder.userData;
            const isSel = selected && id === selected.id;
            const pulse = isSel ? 1 + 0.15 * Math.sin(t * 4) : 1;
            holder.scale.setScalar(pulse * (hovered && id === hovered.id ? 1.25 : 1));
            // Interest shimmer: hotter areas of research breathe faster and brighter.
            u.halo.material.opacity = u.haloBase * u.dim * (0.82 + 0.28 * Math.sin(t * u.pulseRate + u.pulsePhase));
        }
    }

    renderer.render(scene, camera);
}
animate();
