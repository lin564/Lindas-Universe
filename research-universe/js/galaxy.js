// Builds the 3D galaxy from a universe JSON document.
// Layout: the core study area sits at the origin; each top-level hypothesis
// anchors a spiral arm; every node's distance from the core is (1 - relevance)
// and its radius is its size. Colors encode node type.

import * as THREE from '../vendor/three.module.js';

export const TYPE_COLORS = {
    core: 0xffd27a,
    hypothesis: 0xffb347,
    subhypothesis: 0xff8c69,
    dataset: 0x5bc0eb,
    paper: 0xb18cff,
    organization: 0x6ee7a8,
    concept: 0x86a5d9,
};

export const TYPE_LABELS = {
    core: 'Study area',
    hypothesis: 'Hypothesis',
    subhypothesis: 'Sub-hypothesis',
    dataset: 'Dataset',
    paper: 'Paper',
    organization: 'Organization',
    concept: 'Concept',
};

const MIN_RADIUS = 14;   // most relevant nodes orbit this close
const MAX_RADIUS = 60;   // least relevant nodes drift out here
const ARM_TWIST = 0.035; // radians of spiral per unit radius

// Deterministic per-node jitter so layouts are stable across reloads.
function hashSeed(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
        h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
        h = (h << 13) | (h >>> 19);
    }
    return () => {
        h = Math.imul(h ^ (h >>> 16), 2246822507);
        h = Math.imul(h ^ (h >>> 13), 3266489909);
        return ((h ^= h >>> 16) >>> 0) / 4294967296;
    };
}

function nodeRadius(node) {
    if (node.type === 'core') return 3.2;
    return 0.7 + 1.6 * THREE.MathUtils.clamp(node.size ?? 0.5, 0, 1);
}

// Assign every node a position. Hypotheses get evenly-spaced arm angles;
// descendants stay within their ancestor hypothesis's angular sector.
export function layoutUniverse(universe) {
    const byId = new Map(universe.nodes.map(n => [n.id, n]));
    const positions = new Map();
    positions.set('core', new THREE.Vector3(0, 0, 0));

    const core = universe.nodes.find(n => n.type === 'core') ?? universe.nodes[0];
    const coreId = core.id;
    positions.set(coreId, new THREE.Vector3(0, 0, 0));

    const topLevel = universe.nodes.filter(n => n.parent === coreId && n.id !== coreId);
    const arms = topLevel.filter(n => n.type === 'hypothesis');
    const satellites = topLevel.filter(n => n.type !== 'hypothesis');

    // Which arm (angular sector) does each node belong to?
    const armAngle = new Map();
    arms.forEach((n, i) => armAngle.set(n.id, (i / Math.max(arms.length, 1)) * Math.PI * 2));

    function sectorOf(node) {
        let cur = node;
        for (let depth = 0; cur && depth < 12; depth++) {
            if (armAngle.has(cur.id)) return armAngle.get(cur.id);
            cur = byId.get(cur.parent);
        }
        return null;
    }

    function place(node, baseAngle, spread) {
        const rand = hashSeed(node.id);
        const rel = THREE.MathUtils.clamp(node.relevance ?? 0.5, 0, 1);
        const r = THREE.MathUtils.lerp(MAX_RADIUS, MIN_RADIUS, rel) * (0.92 + rand() * 0.16);
        const angle = baseAngle + (rand() - 0.5) * spread + r * ARM_TWIST;
        const y = (rand() - 0.5) * 7;
        positions.set(node.id, new THREE.Vector3(Math.cos(angle) * r, y, Math.sin(angle) * r));
    }

    arms.forEach(n => place(n, armAngle.get(n.id), 0.18));

    // Core-orbiting satellites (indices, organizations) fill gaps between arms.
    satellites.forEach((n, i) => {
        const angle = ((i + 0.5) / Math.max(satellites.length, 1)) * Math.PI * 2 + 0.4;
        place(n, angle, 0.5);
    });

    // Everything deeper inherits its hypothesis sector, nudged toward the parent.
    universe.nodes.forEach(n => {
        if (positions.has(n.id)) return;
        const sector = sectorOf(n);
        place(n, sector ?? hashSeed(n.id)() * Math.PI * 2, sector == null ? Math.PI * 2 : 0.55);
        const parentPos = positions.get(n.parent);
        if (parentPos) positions.get(n.id).lerp(parentPos, 0.35);
    });

    return { positions, coreId };
}

function makeLabelSprite(text, color) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const font = '500 26px Inter, sans-serif';
    ctx.font = font;
    const w = Math.ceil(ctx.measureText(text).width) + 24;
    canvas.width = w;
    canvas.height = 44;
    ctx.font = font;
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = 8;
    ctx.fillStyle = color;
    ctx.fillText(text, 12, 24);
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: texture, transparent: true, depthWrite: false,
    }));
    sprite.scale.set(w / 32, 44 / 32, 1);
    return sprite;
}

export function buildGalaxy(universe) {
    const group = new THREE.Group();
    const { positions, coreId } = layoutUniverse(universe);
    const meshes = new Map();
    const sphereGeo = new THREE.SphereGeometry(1, 24, 18);

    for (const node of universe.nodes) {
        const color = TYPE_COLORS[node.type] ?? TYPE_COLORS.concept;
        const mat = new THREE.MeshBasicMaterial({ color });
        const mesh = new THREE.Mesh(sphereGeo, mat);
        mesh.position.copy(positions.get(node.id));
        mesh.scale.setScalar(nodeRadius(node));
        mesh.userData.node = node;
        group.add(mesh);
        meshes.set(node.id, mesh);

        // Soft glow billboard behind every star.
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({
            map: glowTexture(),
            color,
            transparent: true,
            opacity: node.type === 'core' ? 0.9 : 0.45,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
        }));
        glow.scale.setScalar(nodeRadius(node) * (node.type === 'core' ? 9 : 5));
        glow.position.copy(mesh.position);
        group.add(glow);
        mesh.userData.glow = glow;

        if (node.type === 'core' || node.type === 'hypothesis') {
            const label = makeLabelSprite(node.label, '#e8edf7');
            label.position.copy(mesh.position);
            label.position.y += nodeRadius(node) + 2.2;
            group.add(label);
        }
    }

    // Edges: parent links (structural) + explicit cross-links.
    const edges = [];
    universe.nodes.forEach(n => {
        if (n.parent && positions.has(n.parent) && n.id !== n.parent) {
            edges.push([n.parent, n.id, 0.22]);
        }
    });
    (universe.links ?? []).forEach(l => {
        if (positions.has(l.source) && positions.has(l.target)) {
            edges.push([l.source, l.target, 0.1]);
        }
    });

    for (const [a, b, opacity] of edges) {
        const geo = new THREE.BufferGeometry().setFromPoints([positions.get(a), positions.get(b)]);
        const line = new THREE.Line(geo, new THREE.LineBasicMaterial({
            color: 0x5bc0eb, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false,
        }));
        group.add(line);
    }

    return { group, meshes, coreId };
}

let _glowTexture = null;
function glowTexture() {
    if (_glowTexture) return _glowTexture;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,0.8)');
    grad.addColorStop(0.4, 'rgba(255,255,255,0.18)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    _glowTexture = new THREE.CanvasTexture(canvas);
    return _glowTexture;
}

export function buildStarfield(count = 2200) {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        // Shell of background stars well outside the galaxy.
        const r = 140 + Math.random() * 260;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = r * Math.cos(phi);
        positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return new THREE.Points(geo, new THREE.PointsMaterial({
        color: 0x9db4d8, size: 0.9, sizeAttenuation: true,
        transparent: true, opacity: 0.7, depthWrite: false,
    }));
}
