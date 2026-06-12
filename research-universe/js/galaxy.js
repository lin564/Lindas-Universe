// Builds the 3D galaxy from a universe JSON document.
//
// Visual encoding:
//   distance from core = relevance (closer = more central to the question)
//   size of the light  = information (data volume / influence / scope)
//   glow intensity     = research interest (how much attention the area has)
//
// Nodes render as warm-white pinpoints of light — a sharp point plus soft
// additive glow halos — with an invisible sphere for picking. Type is shown
// in the UI (tooltip, panel badge, sources list), not by star color.

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
const ARM_TWIST = 0.05;  // radians of spiral per unit radius

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

function nodeInterest(node) {
    return THREE.MathUtils.clamp(node.interest ?? 0.5, 0, 1);
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
        const y = (rand() - 0.5) * 4.5; // keep the data in the galactic plane
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

    return { positions, coreId, armAngles: [...armAngle.values()] };
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

// --- light textures ---------------------------------------------------------

function radialTexture(stops) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    stops.forEach(([offset, color]) => grad.addColorStop(offset, color));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(canvas);
}

let _pinTex = null, _coreTex = null, _haloTex = null;
// Sharp pinpoint: nearly all the energy in a tiny center, fast falloff.
function pinTexture() {
    return _pinTex ??= radialTexture([
        [0, 'rgba(255,255,255,1)'],
        [0.12, 'rgba(255,248,235,0.95)'],
        [0.28, 'rgba(255,238,210,0.3)'],
        [0.55, 'rgba(255,232,196,0.06)'],
        [1, 'rgba(255,232,196,0)'],
    ]);
}
function coreTexture() {
    return _coreTex ??= radialTexture([
        [0, 'rgba(255,255,255,1)'],
        [0.22, 'rgba(255,255,255,0.65)'],
        [0.55, 'rgba(255,255,255,0.14)'],
        [1, 'rgba(255,255,255,0)'],
    ]);
}
function haloTexture() {
    return _haloTex ??= radialTexture([
        [0, 'rgba(255,255,255,0.32)'],
        [0.45, 'rgba(255,255,255,0.1)'],
        [1, 'rgba(255,255,255,0)'],
    ]);
}

function lightSprite(texture, color, opacity, scale) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: texture,
        color,
        transparent: true,
        opacity,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    }));
    sprite.scale.setScalar(scale);
    return sprite;
}

// --- galactic scenery --------------------------------------------------------
// What makes it read as a real galaxy: a smooth painted nebular glow for the
// disk and arms (no particle "rings"), tens of thousands of mostly-faint
// stars with an exponential disk profile, and a bright bulge that blends
// into the arms. Pure scenery — not pickable, not searchable.

function gauss() {
    return (Math.random() + Math.random() + Math.random() + Math.random() - 2) / 1.2;
}

let _dustTex = null;
function dustTexture() {
    return _dustTex ??= radialTexture([
        [0, 'rgba(255,255,255,1)'],
        [0.3, 'rgba(255,255,255,0.5)'],
        [1, 'rgba(255,255,255,0)'],
    ]);
}

// Paint the disk's nebular light — central glow plus blurred spiral arm
// lanes — once, into a canvas draped over the galactic plane. This gives the
// smooth luminosity of long-exposure galaxy photos that particles can't.
function makeDiskGlowTexture(arms, rim) {
    const S = 1024;
    const c = S / 2;
    const scale = (c - 24) / rim;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = S;
    const ctx = canvas.getContext('2d');
    ctx.globalCompositeOperation = 'lighter';

    const blob = (x, y, radius, alpha, color = '255,232,200') => {
        const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
        g.addColorStop(0, `rgba(${color},${alpha})`);
        g.addColorStop(1, `rgba(${color},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    };

    // Bulge: layered warm core.
    blob(c, c, 90, 0.55, '255,224,178');
    blob(c, c, 200, 0.22, '255,219,170');
    blob(c, c, 420, 0.1, '235,212,190');

    // Arms: overlapping soft blobs along each spiral, fading and widening out.
    for (const arm of arms) {
        for (let r = 8; r <= rim; r += 1.5) {
            const a = arm + r * ARM_TWIST;
            // canvas y runs opposite to world z after the plane's -PI/2 x-rotation
            const x = c + Math.cos(a) * r * scale;
            const y = c - Math.sin(a) * r * scale;
            const t = r / rim;
            blob(x, y, (30 + 26 * t) * (scale / 7), 0.05 * (1 - t * 0.75), '240,228,210');
        }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    return tex;
}

// Sample one scenery-star position on the galaxy: dense bulge, exponential
// disk, most disk stars gathered into the spiral arms.
function sampleGalaxyPoint(arms, rim) {
    const roll = Math.random();
    let r, a, thickness;
    if (roll < 0.32) {
        // bulge
        r = Math.abs(gauss()) * 8;
        a = Math.random() * Math.PI * 2;
        thickness = Math.max(1.4, 4 - r * 0.2);
    } else {
        // exponential disk profile — dense inside, smooth fade, no hard rim
        do { r = -Math.log(1 - Math.random()) * (rim * 0.35); } while (r > rim);
        r += 4;
        if (roll < 0.55) {
            a = Math.random() * Math.PI * 2;              // inter-arm field stars
        } else {
            const arm = arms[(Math.random() * arms.length) | 0];
            a = arm + r * ARM_TWIST + gauss() * (0.1 + r * 0.0042);
        }
        thickness = Math.max(0.7, 2.4 - r * 0.02);
    }
    return { x: Math.cos(a) * r, y: gauss() * thickness, z: Math.sin(a) * r, r };
}

function buildDust(armAngles) {
    const group = new THREE.Group();
    const arms = armAngles.length >= 2 ? armAngles : [0, Math.PI * 2 / 3, Math.PI * 4 / 3];
    const rim = MAX_RADIUS + 10;

    // Star layers: lots of tiny faint stars, a few bright ones.
    const layers = [
        { count: 26000, size: 0.45, opacity: 0.5 },
        { count: 9000, size: 0.8, opacity: 0.5 },
        { count: 800, size: 1.5, opacity: 0.65 },
    ];

    for (const { count, size, opacity } of layers) {
        const pos = new Float32Array(count * 3);
        const col = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            const p = sampleGalaxyPoint(arms, rim);
            pos.set([p.x, p.y, p.z], i * 3);

            // Mostly faint stars (steep brightness distribution); warm in the
            // bulge, drifting cooler and dimmer toward the rim.
            const tRim = Math.min(p.r / rim, 1);
            const b = 0.18 + 0.82 * Math.pow(Math.random(), 2.2);
            col[i * 3] = b * (1.0 - 0.22 * tRim);
            col[i * 3 + 1] = b * (0.9 - 0.04 * tRim);
            col[i * 3 + 2] = b * (0.72 + 0.28 * tRim);
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
        group.add(new THREE.Points(geo, new THREE.PointsMaterial({
            map: dustTexture(),
            size,
            sizeAttenuation: true,
            vertexColors: true,
            transparent: true,
            opacity,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
        })));
    }

    // The painted nebular disk (bulge glow + arm lanes), in the galactic plane.
    const disk = new THREE.Mesh(
        new THREE.CircleGeometry(rim + 8, 64),
        new THREE.MeshBasicMaterial({
            map: makeDiskGlowTexture(arms, rim + 8),
            transparent: true,
            opacity: 0.85,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
        }),
    );
    disk.rotation.x = -Math.PI / 2;
    group.add(disk);

    // A modest vertical bulge glow so the core isn't flat when seen edge-on.
    group.add(lightSprite(haloTexture(), 0xffdfb0, 0.35, 34));

    return group;
}

// --- galaxy -----------------------------------------------------------------

const WARM_WHITE = 0xffe7c2;
const pickGeo = new THREE.SphereGeometry(1, 8, 6);
const pickMat = new THREE.MeshBasicMaterial();
pickMat.visible = false; // never rendered; raycasting still hits the geometry

export function buildGalaxy(universe) {
    const group = new THREE.Group();
    const { positions, coreId, armAngles } = layoutUniverse(universe);
    group.add(buildDust(armAngles));
    const meshes = new Map();   // id -> invisible pick mesh (raycast targets)
    const holders = new Map();  // id -> per-node group (position + pulse scale)

    for (const node of universe.nodes) {
        const r = nodeRadius(node);
        const interest = nodeInterest(node);
        const isCore = node.type === 'core';

        const holder = new THREE.Group();
        holder.position.copy(positions.get(node.id));

        const pick = new THREE.Mesh(pickGeo, pickMat);
        pick.scale.setScalar(Math.max(r * 1.5, 1.4));
        pick.userData.node = node;
        holder.add(pick);

        // A warm-white pinpoint (sized by `size`) inside a soft aura, wrapped
        // in an outer halo whose reach and brightness encode `interest`.
        const pin = lightSprite(pinTexture(), 0xffffff, 1, r * (isCore ? 2.6 : 1.7));
        const aura = lightSprite(coreTexture(), WARM_WHITE, 0.45, r * (isCore ? 4.5 : 2.6));
        const haloOpacity = 0.06 + 0.45 * interest;
        const halo = lightSprite(haloTexture(), WARM_WHITE, haloOpacity, r * (4 + 8 * interest) * (isCore ? 1.5 : 1));
        holder.add(pin, aura, halo);

        holder.userData = {
            node,
            sprites: [pin, aura, halo],
            baseOpacities: [1, 0.45, haloOpacity],
            halo,
            // Hot areas shimmer faster; quiet ones barely breathe.
            pulseRate: 0.6 + 2.6 * interest,
            pulsePhase: hashSeed(node.id)() * Math.PI * 2,
            dim: 1,
        };

        group.add(holder);
        holders.set(node.id, holder);
        meshes.set(node.id, pick);

        if (isCore || node.type === 'hypothesis') {
            const label = makeLabelSprite(node.label, '#e8edf7');
            label.position.copy(holder.position);
            label.position.y += r + 2.2;
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
            color: WARM_WHITE, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false,
        }));
        group.add(line);
    }

    return { group, meshes, holders, coreId };
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
