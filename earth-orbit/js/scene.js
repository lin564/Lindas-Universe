// Builds and updates the Three.js scene: Sun, Earth, Moon, orbits, and the
// marker for the chosen surface location.
//
// NOT TO SCALE. At true scale the Earth would be a quarter of a pixel across
// with the Sun 23,500 Earth-radii away, which shows you nothing. Distances and
// radii are compressed independently; the angles — tilt, declination, phase,
// the terminator — are the parts that are honest, and they are the parts the
// simulation is actually about.

import * as THREE from '../vendor/three.module.js';
import { earthDayTexture, earthNightTexture, moonTexture } from './texture.js';
import * as astro from './astro.js';

export const SCALE = {
    orbit: 64,      // scene units for the Earth's semi-major axis
    sun: 7.0,
    earth: 2.1,
    moonOrbit: 7.0,
    moon: 0.57,
};

function canvasTexture(canvas) {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    t.wrapS = THREE.RepeatWrapping;
    return t;
}

// ---------------------------------------------------------------------------
// Earth material — day/night blend across a soft terminator
// ---------------------------------------------------------------------------

function earthMaterial() {
    return new THREE.ShaderMaterial({
        uniforms: {
            dayMap: { value: canvasTexture(earthDayTexture(2048)) },
            nightMap: { value: canvasTexture(earthNightTexture(1024)) },
            sunDir: { value: new THREE.Vector3(1, 0, 0) },
        },
        vertexShader: /* glsl */`
            varying vec2 vUv;
            varying vec3 vNormalW;
            varying vec3 vViewDir;
            void main() {
                vUv = uv;
                vNormalW = normalize(mat3(modelMatrix) * normal);
                vec4 wp = modelMatrix * vec4(position, 1.0);
                vViewDir = normalize(cameraPosition - wp.xyz);
                gl_Position = projectionMatrix * viewMatrix * wp;
            }
        `,
        fragmentShader: /* glsl */`
            uniform sampler2D dayMap;
            uniform sampler2D nightMap;
            uniform vec3 sunDir;
            varying vec2 vUv;
            varying vec3 vNormalW;
            varying vec3 vViewDir;

            void main() {
                vec3 n = normalize(vNormalW);
                float d = dot(n, normalize(sunDir));

                // Soft terminator — the real one is blurred by the atmosphere
                // over a few degrees, so a hard line reads as wrong.
                float lit = smoothstep(-0.14, 0.20, d);

                vec3 day = texture2D(dayMap, vUv).rgb;
                vec3 night = texture2D(nightMap, vUv).rgb;

                // Lambert falloff, with a floor so the day side never goes flat.
                vec3 dayLit = day * (0.10 + 0.95 * max(d, 0.0));
                vec3 col = mix(night * 1.4, dayLit, lit);

                // Atmospheric limb: strongest where we look edge-on, and
                // brightest on the sunward side.
                float rim = pow(1.0 - max(dot(n, normalize(vViewDir)), 0.0), 2.6);
                col += vec3(0.28, 0.48, 0.92) * rim * (0.25 + 0.85 * max(d, -0.1));

                gl_FragColor = vec4(col, 1.0);
                #include <colorspace_fragment>
            }
        `,
    });
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

function buildStarfield(count = 3200, radius = 700) {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        // Uniform on the sphere.
        const u = Math.random() * 2 - 1;
        const th = Math.random() * Math.PI * 2;
        const s = Math.sqrt(1 - u * u);
        const r = radius * (0.75 + Math.random() * 0.25);
        pos[i * 3] = r * s * Math.cos(th);
        pos[i * 3 + 1] = r * u;
        pos[i * 3 + 2] = r * s * Math.sin(th);
        // A little colour spread — most stars white, some warm, some blue.
        const t = Math.random();
        const c = t < 0.15 ? [1.0, 0.82, 0.65] : t > 0.88 ? [0.75, 0.85, 1.0] : [1, 1, 1];
        const b = 0.5 + Math.random() * 0.5;
        col[i * 3] = c[0] * b; col[i * 3 + 1] = c[1] * b; col[i * 3 + 2] = c[2] * b;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return new THREE.Points(g, new THREE.PointsMaterial({
        size: 1.5, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.9,
    }));
}

// A soft radial falloff, used as the sprite for the corona.
function glowSprite(color, size) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 256;
    const ctx = cv.getContext('2d');
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0.00, `rgba(${color},0.85)`);
    g.addColorStop(0.18, `rgba(${color},0.42)`);
    g.addColorStop(0.42, `rgba(${color},0.13)`);
    g.addColorStop(0.72, `rgba(${color},0.03)`);
    g.addColorStop(1.00, `rgba(${color},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);

    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: new THREE.CanvasTexture(cv),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
    }));
    sprite.scale.setScalar(size);
    return sprite;
}

function buildSun() {
    const group = new THREE.Group();

    const core = new THREE.Mesh(
        new THREE.SphereGeometry(SCALE.sun, 48, 32),
        new THREE.MeshBasicMaterial({ color: 0xfff6dc }),
    );
    group.add(core);

    // Corona: two overlapping sprites, a tight white-hot one inside a broad
    // amber one. Sprites always face the camera, so it reads as a glow from
    // any angle instead of as a shell.
    group.add(glowSprite('255,236,190', SCALE.sun * 5.5));
    group.add(glowSprite('255,150,60', SCALE.sun * 12));

    // decay 0 keeps the Earth evenly lit despite the compressed distances.
    const light = new THREE.PointLight(0xfff4e0, 3.0, 0, 0);
    group.add(light);
    return group;
}

function ring(radius, color, opacity = 0.5, segments = 256) {
    const pts = [];
    for (let i = 0; i <= segments; i++) {
        const a = (i / segments) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
    }
    return new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color, transparent: true, opacity }),
    );
}

// The Earth's orbit, drawn as the true ellipse with the Sun at a focus.
function buildOrbitPath() {
    const pts = [];
    for (let i = 0; i <= 512; i++) {
        const { earthLongitude, distance } = astro.earthOrbit((i / 512) * astro.TROPICAL_YEAR);
        const d = astro.eclipticDir(earthLongitude);
        pts.push(new THREE.Vector3(d.x, d.y, d.z).multiplyScalar(distance * SCALE.orbit));
    }
    return new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: 0x5bc0eb, transparent: true, opacity: 0.30 }),
    );
}

// A latitude circle drawn on the globe — equator, tropics, polar circles.
function latitudeRing(latDeg, color, opacity) {
    const lat = latDeg * astro.DEG;
    const r = SCALE.earth * 1.002 * Math.cos(lat);
    const y = SCALE.earth * 1.002 * Math.sin(lat);
    const l = ring(r, color, opacity, 128);
    l.position.y = y;
    return l;
}

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

export function buildScene(canvas) {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x03050c);
    scene.add(buildStarfield());
    scene.add(new THREE.AmbientLight(0x2a3550, 0.6));

    const sun = buildSun();
    scene.add(sun);

    const orbitPath = buildOrbitPath();
    scene.add(orbitPath);

    // --- Earth ------------------------------------------------------------
    // earthGroup carries the orbital position; earthSpin carries tilt + spin,
    // so everything fixed to the planet (globe, axis, rings, marker) inherits
    // the orientation automatically.
    const earthGroup = new THREE.Group();
    scene.add(earthGroup);

    const earthSpin = new THREE.Group();
    earthGroup.add(earthSpin);

    const earthMat = earthMaterial();
    const earth = new THREE.Mesh(new THREE.SphereGeometry(SCALE.earth, 96, 64), earthMat);
    earthSpin.add(earth);

    // The rotation axis, drawn well past the poles so the tilt is legible.
    const axisLen = SCALE.earth * 2.4;
    const axis = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, -axisLen, 0), new THREE.Vector3(0, axisLen, 0),
        ]),
        new THREE.LineBasicMaterial({ color: 0xff3b0a, transparent: true, opacity: 0.9 }),
    );
    earthSpin.add(axis);

    const northCap = new THREE.Mesh(
        new THREE.ConeGeometry(SCALE.earth * 0.07, SCALE.earth * 0.22, 12),
        new THREE.MeshBasicMaterial({ color: 0xff3b0a }),
    );
    northCap.position.y = axisLen;
    earthSpin.add(northCap);

    const equator = latitudeRing(0, 0xffffff, 0.55);
    earthSpin.add(equator);

    // Tropics and polar circles are *defined by* the tilt, so they move when
    // the slider moves. That link is one of the things worth seeing.
    const tropicN = latitudeRing(0, 0xffd27a, 0.5);
    const tropicS = latitudeRing(0, 0xffd27a, 0.5);
    const polarN = latitudeRing(0, 0x86a5d9, 0.5);
    const polarS = latitudeRing(0, 0x86a5d9, 0.5);
    earthSpin.add(tropicN, tropicS, polarN, polarS);

    // --- Location marker --------------------------------------------------
    const marker = new THREE.Group();
    const pin = new THREE.Mesh(
        new THREE.SphereGeometry(SCALE.earth * 0.035, 16, 12),
        new THREE.MeshBasicMaterial({ color: 0xff3b0a }),
    );
    const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(SCALE.earth * 0.008, SCALE.earth * 0.008, SCALE.earth * 0.42, 8),
        new THREE.MeshBasicMaterial({ color: 0xff3b0a, transparent: true, opacity: 0.65 }),
    );
    beam.position.y = SCALE.earth * 0.21;
    const halo = new THREE.Mesh(
        new THREE.SphereGeometry(SCALE.earth * 0.075, 16, 12),
        new THREE.MeshBasicMaterial({
            color: 0xff8a5c, transparent: true, opacity: 0.35,
            blending: THREE.AdditiveBlending, depthWrite: false,
        }),
    );
    marker.add(pin, beam, halo);
    earthSpin.add(marker);

    // --- Moon -------------------------------------------------------------
    // Parented to earthGroup, NOT earthSpin: the Moon's orbit is inclined to
    // the ecliptic, so it is unaffected by the Earth's axial tilt.
    const moonSystem = new THREE.Group();
    earthGroup.add(moonSystem);

    const moonOrbitRing = ring(SCALE.moonOrbit, 0xb9c4dc, 0.22, 128);
    moonSystem.add(moonOrbitRing);

    const moon = new THREE.Mesh(
        new THREE.SphereGeometry(SCALE.moon, 48, 32),
        new THREE.MeshStandardMaterial({
            map: canvasTexture(moonTexture(512)), roughness: 0.95, metalness: 0.0,
        }),
    );
    moonSystem.add(moon);

    // Sunlight direction line from the Sun through the Earth, so "which way is
    // the Sun" stays obvious when zoomed in on the planet.
    const sunRay = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
        new THREE.LineBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.35 }),
    );
    scene.add(sunRay);

    return {
        renderer, scene, sun,
        earthGroup, earthSpin, earth, earthMat,
        axis, northCap, equator, tropicN, tropicS, polarN, polarS,
        marker, moon, moonSystem, moonOrbitRing, orbitPath, sunRay,
    };
}

// ---------------------------------------------------------------------------
// Per-frame update
// ---------------------------------------------------------------------------

const _v = new THREE.Vector3();

// Places every body for the given simulation state and returns the derived
// quantities the UI needs, so the readouts can never drift from the render.
export function updateScene(s, { day, tilt, lat, lon, showOrbits }) {
    const { sunLongitude, earthLongitude, distance } = astro.earthOrbit(day);

    // Earth on its orbit.
    const dir = astro.eclipticDir(earthLongitude);
    s.earthGroup.position.set(dir.x, dir.y, dir.z).multiplyScalar(distance * SCALE.orbit);

    // Tilt about +X, then spin about the (tilted) polar axis. Matches
    // astro.surfaceNormal exactly, so the marker and the numbers agree.
    const spinPhase = astro.wrapAngle(2 * Math.PI * (day / astro.SIDEREAL_DAY));
    s.earthSpin.rotation.set(-tilt * astro.DEG, spinPhase, 0, 'XYZ');

    // Unit vector from the Earth toward the Sun.
    const toSun = astro.eclipticDir(sunLongitude);
    s.earthMat.uniforms.sunDir.value.set(toSun.x, toSun.y, toSun.z);

    // Tropics and polar circles follow the tilt.
    const setLat = (r, latDeg) => {
        const la = latDeg * astro.DEG;
        r.position.y = SCALE.earth * 1.002 * Math.sin(la);
        r.scale.setScalar(Math.max(Math.cos(la), 1e-3));
        r.visible = showOrbits && Math.abs(latDeg) < 89.5;
    };
    setLat(s.tropicN, tilt);
    setLat(s.tropicS, -tilt);
    setLat(s.polarN, 90 - tilt);
    setLat(s.polarS, -(90 - tilt));
    s.equator.visible = showOrbits;
    s.moonOrbitRing.visible = showOrbits;
    s.orbitPath.visible = showOrbits;

    // Marker, in the Earth's own (untilted, unspun) frame — the parent group
    // applies tilt and spin for us.
    const la = lat * astro.DEG, lo = lon * astro.DEG;
    const mx = Math.cos(la) * Math.cos(lo);
    const my = Math.sin(la);
    const mz = -Math.cos(la) * Math.sin(lo);
    s.marker.position.set(mx, my, mz).multiplyScalar(SCALE.earth);
    // Stand the pin up along the local vertical.
    s.marker.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), _v.set(mx, my, mz).normalize());

    // Moon.
    const mp = astro.moonPosition(day);
    s.moon.position.set(mp.x, mp.y, mp.z).multiplyScalar(SCALE.moonOrbit);
    // Tidally locked: the same face points at the Earth, always.
    s.moon.rotation.y = -Math.atan2(-mp.z, mp.x) + Math.PI;

    // Sun ray, from the Sun to just short of the Earth.
    const ep = s.earthGroup.position;
    s.sunRay.geometry.setFromPoints([
        new THREE.Vector3(0, 0, 0),
        _v.copy(ep).multiplyScalar(1 - SCALE.earth / ep.length()),
    ]);
    s.sunRay.visible = showOrbits;

    // --- derived quantities for the UI ------------------------------------
    const dec = astro.declination(sunLongitude, tilt);
    const normal = astro.surfaceNormal(lat, lon, tilt, spinPhase);
    const cosZ = astro.cosZenith(normal, toSun);
    const sub = astro.subsolarPoint(tilt, spinPhase, toSun);
    const hourAngle = ((lon - sub.lon + 540) % 360) - 180;

    return {
        sunLongitude, distance, spinPhase,
        declination: dec * astro.RAD,
        elevation: Math.asin(astro.clamp(cosZ, -1, 1)) * astro.RAD,
        cosZenith: cosZ,
        subsolar: sub,
        hourAngle,
        solarTime: ((12 + hourAngle / 15) % 24 + 24) % 24,
        dayLength: astro.dayLength(lat, dec),
        insolation: astro.dailyInsolation(lat, day, tilt),
        moonIllumination: astro.moonIllumination(mp, toSun),
        moonDistance: mp.r,
    };
}
