// The Isle of Equilibria — high-fidelity edition.
// Stylized-painterly look: golden-hour sun with soft shadows, gradient sky
// dome with drifting clouds, vertex-colored terrain, instanced grass and
// flowers, classical ruins, glowing crystal clusters, rope bridges and
// fireflies. Everything remains procedural — no asset downloads.

import * as THREE from 'three';

const ISLAND_DEFS = [
    { x: 0, z: 0, r: 10 },        // spawn
    { x: 26, z: -7, r: 9 },       // chambers 0..5 live on islands 1..6
    { x: 52, z: 5, r: 9 },
    { x: 78, z: -7, r: 9 },
    { x: 104, z: 5, r: 9 },
    { x: 130, z: -7, r: 9 },
    { x: 156, z: 5, r: 9 },
    { x: 184, z: -2, r: 12 },     // the Heart
];

// ---------- procedural textures ----------

function radialGlowTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(64, 64, 4, 64, 64, 62);
    grad.addColorStop(0, inner);
    grad.addColorStop(1, outer);
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

function cloudTexture() {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 128;
    const g = c.getContext('2d');
    g.clearRect(0, 0, 256, 128);
    for (let i = 0; i < 26; i++) {
        const x = 40 + Math.random() * 176;
        const y = 50 + Math.random() * 40;
        const r = 14 + Math.random() * 26;
        const grad = g.createRadialGradient(x, y, 1, x, y, r);
        grad.addColorStop(0, 'rgba(255,250,242,0.55)');
        grad.addColorStop(1, 'rgba(255,250,242,0)');
        g.fillStyle = grad;
        g.fillRect(0, 0, 256, 128);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

function jitterGeometry(geo, amount, yAmount = amount * 0.5) {
    const pos = geo.attributes.position;
    const offsets = new Map();
    for (let i = 0; i < pos.count; i++) {
        const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
        let off = offsets.get(key);
        if (!off) {
            off = [
                (Math.random() - 0.5) * amount,
                (Math.random() - 0.5) * yAmount,
                (Math.random() - 0.5) * amount,
            ];
            offsets.set(key, off);
        }
        pos.setXYZ(i, pos.getX(i) + off[0], pos.getY(i) + off[1], pos.getZ(i) + off[2]);
    }
    geo.computeVertexNormals();
    return geo;
}

export class World {
    constructor(scene) {
        this.scene = scene;
        this.islands = [];
        this.bridges = [];
        this.pedestals = [];
        this.tweens = [];
        this.particles = [];
        this.swayers = [];        // { object, phase, amp } gently rocking
        this.clouds = [];
        this.time = 0;

        this.glowTex = radialGlowTexture();
        this.warmGlowTex = radialGlowTexture('rgba(255,214,150,1)', 'rgba(255,214,150,0)');

        this.buildSky();
        this.buildLights();
        ISLAND_DEFS.forEach((def, i) => this.buildIsland(def, i));
        for (let i = 0; i < ISLAND_DEFS.length - 1; i++) this.buildBridge(i);
        this.setBridgeProgress(0, 1);
        this.bridges[0].active = true;
        this.bridges[0].ropes.forEach(r => { r.visible = true; });
        for (let c = 0; c < 7; c++) this.buildPedestal(c);
        this.buildHeart();
        this.buildFireflies();
    }

    // ---------- sky & light ----------

    buildSky() {
        const skyGeo = new THREE.SphereGeometry(420, 24, 16);
        const skyMat = new THREE.ShaderMaterial({
            side: THREE.BackSide,
            depthWrite: false,
            fog: false,
            uniforms: {
                topColor: { value: new THREE.Color(0x23508f) },
                midColor: { value: new THREE.Color(0x6f9cd1) },
                lowColor: { value: new THREE.Color(0xefc28e) },
                belowColor: { value: new THREE.Color(0x46639c) },
            },
            vertexShader: `
                varying vec3 vPos;
                void main() {
                    vPos = position;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }`,
            fragmentShader: `
                uniform vec3 topColor; uniform vec3 midColor; uniform vec3 lowColor; uniform vec3 belowColor;
                varying vec3 vPos;
                void main() {
                    float h = normalize(vPos).y;
                    // warm glow hugs the horizon; blue above, cool depths below
                    vec3 col;
                    if (h > 0.02) {
                        col = mix(midColor, topColor, smoothstep(0.02, 0.42, h));
                    } else if (h > -0.05) {
                        col = mix(lowColor, midColor, smoothstep(-0.01, 0.02, h));
                    } else {
                        col = mix(lowColor, belowColor, smoothstep(-0.05, -0.38, h));
                    }
                    gl_FragColor = vec4(col, 1.0);
                }`,
        });
        const sky = new THREE.Mesh(skyGeo, skyMat);
        sky.position.set(92, 0, 0);
        this.scene.add(sky);
        this.scene.fog = new THREE.Fog(0x9fb6d8, 95, 380);

        // visible sun with halo
        const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
            map: this.warmGlowTex, color: 0xfff2d0, transparent: true,
            opacity: 0.75, fog: false, depthWrite: false,
            blending: THREE.AdditiveBlending,
        }));
        sunSprite.scale.setScalar(85);
        sunSprite.position.set(-180, 150, -160);
        this.scene.add(sunSprite);

        // drifting clouds
        const cTex = cloudTexture();
        for (let i = 0; i < 16; i++) {
            const mat = new THREE.SpriteMaterial({
                map: cTex, transparent: true, depthWrite: false, fog: false,
                opacity: 0.5 + Math.random() * 0.4,
            });
            const cloud = new THREE.Sprite(mat);
            const s = 50 + Math.random() * 80;
            cloud.scale.set(s, s * 0.42, 1);
            cloud.position.set(
                -120 + Math.random() * 440,
                34 + Math.random() * 60,
                -190 + Math.random() * 120 * (Math.random() < 0.5 ? 1 : -1) - 40
            );
            this.scene.add(cloud);
            this.clouds.push({ sprite: cloud, speed: 0.6 + Math.random() * 1.1 });
        }

        // faint high stars for the dusk-magic feel
        const starGeo = new THREE.BufferGeometry();
        const n = 320;
        const positions = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 700 + 90;
            positions[i * 3 + 1] = 120 + Math.random() * 200;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 700;
        }
        starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        this.scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({
            color: 0xeaf2ff, size: 1.0, transparent: true, opacity: 0.5, fog: false,
        })));
    }

    buildLights() {
        // golden-hour key light with soft shadows; the shadow camera follows
        // the player (set each frame in update) so the map stays sharp
        this.sun = new THREE.DirectionalLight(0xffe2b0, 2.1);
        this.sun.castShadow = true;
        this.sun.shadow.mapSize.set(2048, 2048);
        this.sun.shadow.camera.near = 10;
        this.sun.shadow.camera.far = 160;
        this.sun.shadow.camera.left = -34;
        this.sun.shadow.camera.right = 34;
        this.sun.shadow.camera.top = 34;
        this.sun.shadow.camera.bottom = -34;
        this.sun.shadow.bias = -0.0006;
        this.sun.shadow.radius = 3;
        this.scene.add(this.sun, this.sun.target);

        this.scene.add(new THREE.HemisphereLight(0xa8c4ee, 0x4a3b55, 0.75));
        this.scene.add(new THREE.AmbientLight(0xffd9b0, 0.12));
    }

    // ---------- islands ----------

    buildIsland(def, index) {
        const group = new THREE.Group();
        group.position.set(def.x, 0, def.z);

        // grass plateau with vertex colors: lush core -> dry rim -> earth side
        const topGeo = jitterGeometry(new THREE.CylinderGeometry(def.r, def.r * 0.9, 2.0, 22, 2), 0.4, 0);
        const grass = new THREE.Color(0x57a05a);
        const grassDry = new THREE.Color(0x90a653);
        const earth = new THREE.Color(0x6d5544);
        const colors = [];
        const pos = topGeo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            const y = pos.getY(i);
            const rad = Math.hypot(pos.getX(i), pos.getZ(i)) / def.r;
            let col;
            if (y > 0.9) {
                col = grass.clone().lerp(grassDry, THREE.MathUtils.clamp((rad - 0.55) / 0.45, 0, 1));
                col.offsetHSL(0, 0, (Math.random() - 0.5) * 0.05);
            } else {
                col = earth.clone().offsetHSL(0, 0, (Math.random() - 0.5) * 0.08);
            }
            colors.push(col.r, col.g, col.b);
        }
        topGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        const top = new THREE.Mesh(topGeo, new THREE.MeshStandardMaterial({
            vertexColors: true, flatShading: true, roughness: 0.95,
        }));
        top.position.y = -1.0;
        top.receiveShadow = true;
        group.add(top);

        // rocky underside, darkening toward the tip
        const underGeo = jitterGeometry(new THREE.ConeGeometry(def.r * 0.9, def.r * 1.5, 12, 4), 0.9);
        const rockHi = new THREE.Color(0x5d566f);
        const rockLo = new THREE.Color(0x2c2438);
        const uCols = [];
        const uPos = underGeo.attributes.position;
        const uH = def.r * 1.5;
        for (let i = 0; i < uPos.count; i++) {
            const t = THREE.MathUtils.clamp((uPos.getY(i) / uH) + 0.5, 0, 1);
            const col = rockLo.clone().lerp(rockHi, t).offsetHSL(0, 0, (Math.random() - 0.5) * 0.05);
            uCols.push(col.r, col.g, col.b);
        }
        underGeo.setAttribute('color', new THREE.Float32BufferAttribute(uCols, 3));
        const under = new THREE.Mesh(underGeo, new THREE.MeshStandardMaterial({
            vertexColors: true, flatShading: true, roughness: 1,
        }));
        under.rotation.x = Math.PI;
        under.position.y = -2.0 - def.r * 0.75;
        group.add(under);

        const island = {
            def, group, restored: index === 0,
            crystals: [], glowSprites: [], beaconLight: null,
            bobPhase: Math.random() * Math.PI * 2,
        };

        this.scatterGrass(group, def, index);
        this.scatterRocks(group, def);
        this.buildRuins(group, def, index);
        this.buildTrees(group, def, index);
        this.buildCrystals(group, def, index, island);

        const beacon = new THREE.PointLight(0x3fd6c0, 0, 30);
        beacon.position.set(0, 6, 0);
        group.add(beacon);
        island.beaconLight = beacon;

        if (index === 0) {
            beacon.intensity = 14;
            island.crystals.forEach(c => {
                c.material.color.set(0x49e8cf);
                c.material.emissive.set(0x1fd0b0);
                c.material.emissiveIntensity = 1.4;
            });
            island.glowSprites.forEach(s => { s.material.opacity = 0.55; });
        }

        this.scene.add(group);
        this.islands.push(island);
    }

    scatterGrass(group, def, index) {
        // crossed-blade tufts, instanced per island
        const blade = new THREE.ConeGeometry(0.05, 0.55, 4);
        blade.translate(0, 0.27, 0);
        const count = 170;
        const mesh = new THREE.InstancedMesh(blade, new THREE.MeshStandardMaterial({
            color: 0xffffff, flatShading: true, roughness: 1,
        }), count);
        const m = new THREE.Matrix4();
        const q = new THREE.Quaternion();
        const eu = new THREE.Euler();
        const s = new THREE.Vector3();
        const base = new THREE.Color(0x62b25e);
        for (let i = 0; i < count; i++) {
            const a = Math.random() * Math.PI * 2;
            const rad = Math.sqrt(Math.random()) * (def.r - 1.4);
            eu.set((Math.random() - 0.5) * 0.4, Math.random() * Math.PI, (Math.random() - 0.5) * 0.4);
            q.setFromEuler(eu);
            const sc = 0.7 + Math.random() * 1.1;
            s.set(sc, sc * (0.8 + Math.random() * 0.7), sc);
            m.compose(new THREE.Vector3(Math.cos(a) * rad, 0, Math.sin(a) * rad), q, s);
            mesh.setMatrixAt(i, m);
            mesh.setColorAt(i, base.clone().offsetHSL((Math.random() - 0.5) * 0.04, 0, (Math.random() - 0.5) * 0.12));
        }
        mesh.castShadow = false;
        group.add(mesh);

        // wildflowers
        const flower = new THREE.OctahedronGeometry(0.09, 0);
        flower.translate(0, 0.34, 0);
        const fCount = 8 + (index % 3) * 6;
        const flowers = new THREE.InstancedMesh(flower, new THREE.MeshStandardMaterial({
            color: 0xffffff, flatShading: true, emissiveIntensity: 0.25, emissive: 0x332211,
        }), fCount);
        const palette = [0xf7f4ec, 0xf2a0a0, 0x9cc3f5, 0xf5d76b];
        for (let i = 0; i < fCount; i++) {
            const a = Math.random() * Math.PI * 2;
            const rad = Math.sqrt(Math.random()) * (def.r - 1.8);
            m.compose(
                new THREE.Vector3(Math.cos(a) * rad, 0, Math.sin(a) * rad),
                q.setFromEuler(eu.set(0, Math.random() * 3, 0)),
                s.setScalar(0.8 + Math.random() * 0.6)
            );
            flowers.setMatrixAt(i, m);
            flowers.setColorAt(i, new THREE.Color(palette[i % palette.length]));
        }
        group.add(flowers);
    }

    scatterRocks(group, def) {
        const rockGeo = jitterGeometry(new THREE.DodecahedronGeometry(0.5, 0), 0.18);
        const n = 5;
        const rocks = new THREE.InstancedMesh(rockGeo, new THREE.MeshStandardMaterial({
            color: 0x8e8a99, flatShading: true, roughness: 1,
        }), n);
        const m = new THREE.Matrix4();
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2;
            const rad = def.r * (0.45 + Math.random() * 0.45);
            const sc = 0.4 + Math.random() * 0.9;
            m.compose(
                new THREE.Vector3(Math.cos(a) * rad, sc * 0.15, Math.sin(a) * rad),
                new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random(), Math.random() * 3, Math.random())),
                new THREE.Vector3(sc, sc * 0.8, sc)
            );
            rocks.setMatrixAt(i, m);
        }
        rocks.castShadow = true;
        rocks.receiveShadow = true;
        group.add(rocks);
    }

    buildRuins(group, def, index) {
        // weathered classical columns — a nod to the old Keepers
        if (index === 0) return;
        const marble = new THREE.MeshStandardMaterial({ color: 0xd9d2c0, flatShading: true, roughness: 0.85 });
        const marbleDark = new THREE.MeshStandardMaterial({ color: 0xb9b2a2, flatShading: true, roughness: 0.9 });
        const nCols = 2 + (index % 2);
        for (let i = 0; i < nCols; i++) {
            const a = (i / nCols) * Math.PI * 2 + index * 2.1 + 0.6;
            const rad = def.r * 0.72;
            const col = new THREE.Group();
            const base = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.3, 1.0), marbleDark);
            base.position.y = 0.15;
            col.add(base);
            const h = 1.2 + Math.random() * 2.2;
            const shaft = new THREE.Mesh(
                jitterGeometry(new THREE.CylinderGeometry(0.3, 0.34, h, 9, 2), 0.05),
                marble
            );
            shaft.position.y = 0.3 + h / 2;
            col.add(shaft);
            if (Math.random() < 0.55) {
                const cap = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.22, 0.85), marbleDark);
                cap.position.y = 0.3 + h + 0.11;
                col.add(cap);
            }
            col.position.set(Math.cos(a) * rad, 0, Math.sin(a) * rad);
            col.rotation.y = Math.random() * Math.PI;
            col.rotation.z = (Math.random() - 0.5) * 0.08;
            col.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
            group.add(col);
        }
    }

    buildTrees(group, def, index) {
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4f37, flatShading: true, roughness: 1 });
        const nTrees = 2 + (index % 3);
        for (let i = 0; i < nTrees; i++) {
            const a = (i / nTrees) * Math.PI * 2 + index * 1.7 + 0.9;
            const rad = def.r * (0.55 + Math.random() * 0.3);
            const tree = new THREE.Group();
            const scale = 0.9 + Math.random() * 0.8;
            const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.3, 1.6, 6), trunkMat);
            trunk.position.y = 0.8;
            tree.add(trunk);
            const hue = (Math.random() - 0.5) * 0.07;
            const lobes = 3;
            for (let l = 0; l < lobes; l++) {
                const leafCol = new THREE.Color(0x3e7d52).offsetHSL(hue, 0.04, l * 0.035);
                const r0 = 1.35 - l * 0.34;
                const lobe = new THREE.Mesh(
                    jitterGeometry(new THREE.ConeGeometry(r0, 1.5, 7), 0.12),
                    new THREE.MeshStandardMaterial({ color: leafCol, flatShading: true, roughness: 1 })
                );
                lobe.position.y = 1.7 + l * 0.95;
                tree.add(lobe);
            }
            tree.position.set(Math.cos(a) * rad, 0, Math.sin(a) * rad);
            tree.scale.setScalar(scale);
            tree.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
            group.add(tree);
            this.swayers.push({ object: tree, phase: Math.random() * 6, amp: 0.016 + Math.random() * 0.012 });
        }
    }

    buildCrystals(group, def, index, island) {
        const nCrystals = index === 0 ? 3 : 4;
        for (let i = 0; i < nCrystals; i++) {
            const a = (i / nCrystals) * Math.PI * 2 + index;
            const rad = def.r * (0.5 + Math.random() * 0.3);
            const h = 1.2 + Math.random() * 1.8;
            const cluster = new THREE.Group();
            const mat = new THREE.MeshStandardMaterial({
                color: 0x2a4358, emissive: 0x000000, emissiveIntensity: 1,
                flatShading: true, roughness: 0.35, metalness: 0.1,
            });
            const main = new THREE.Mesh(new THREE.OctahedronGeometry(h * 0.45, 0), mat);
            main.scale.y = 2.2;
            main.position.y = h * 0.35;
            main.rotation.y = Math.random() * Math.PI;
            main.castShadow = true;
            cluster.add(main);
            for (let k = 0; k < 2; k++) {
                const small = new THREE.Mesh(new THREE.OctahedronGeometry(h * 0.18, 0), mat);
                small.scale.y = 2.0;
                small.position.set((Math.random() - 0.5) * 0.9, h * 0.12, (Math.random() - 0.5) * 0.9);
                small.rotation.set(0, Math.random() * 3, (Math.random() - 0.5) * 0.5);
                cluster.add(small);
            }
            const glow = new THREE.Sprite(new THREE.SpriteMaterial({
                map: this.glowTex, color: 0x4fe3cc, transparent: true, opacity: 0.0,
                depthWrite: false, blending: THREE.AdditiveBlending,
            }));
            glow.scale.setScalar(h * 3.2);
            glow.position.y = h * 0.5;
            cluster.add(glow);
            cluster.position.set(Math.cos(a) * rad, 0, Math.sin(a) * rad);
            group.add(cluster);
            island.crystals.push(main);
            island.glowSprites.push(glow);
        }
    }

    // ---------- bridges ----------

    buildBridge(i) {
        const a = ISLAND_DEFS[i];
        const b = ISLAND_DEFS[i + 1];
        const start = new THREE.Vector3(a.x, 0, a.z);
        const end = new THREE.Vector3(b.x, 0, b.z);
        const dir = end.clone().sub(start).normalize();
        const walkStart = start.clone();
        const walkEnd = end.clone();
        const startEdge = start.clone().add(dir.clone().multiplyScalar(a.r - 1.5));
        const endEdge = end.clone().sub(dir.clone().multiplyScalar(b.r - 1.5));
        const span = endEdge.clone().sub(startEdge);
        const spanLen = span.length();
        const side = new THREE.Vector3(-dir.z, 0, dir.x);

        const group = new THREE.Group();
        const plankMat = new THREE.MeshStandardMaterial({ color: 0x9b7948, flatShading: true, roughness: 0.9 });
        const plankMatDark = new THREE.MeshStandardMaterial({ color: 0x84653b, flatShading: true, roughness: 0.9 });
        const planks = [];
        const nPlanks = Math.round(spanLen / 1.15);
        for (let p = 0; p < nPlanks; p++) {
            const t = (p + 0.5) / nPlanks;
            const plank = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.22, 1.0), p % 2 ? plankMat : plankMatDark);
            const pPos = startEdge.clone().add(span.clone().multiplyScalar(t));
            plank.position.copy(pPos);
            plank.position.y = -0.1 + Math.sin(t * Math.PI) * 0.35;
            plank.lookAt(endEdge.x, plank.position.y, endEdge.z);
            plank.rotation.z += (Math.random() - 0.5) * 0.04;
            plank.scale.setScalar(0.001);
            plank.visible = false;
            plank.castShadow = true;
            plank.receiveShadow = true;
            group.add(plank);
            planks.push(plank);
        }

        // posts and sagging rope rails
        const ropes = [];
        const postMat = new THREE.MeshStandardMaterial({ color: 0x6e5232, flatShading: true, roughness: 1 });
        const ropeMat = new THREE.MeshStandardMaterial({ color: 0xae8d5a, roughness: 1 });
        for (const sgn of [-1, 1]) {
            const off = side.clone().multiplyScalar(sgn * 1.35);
            const p0 = startEdge.clone().add(off).setY(0);
            const p1 = endEdge.clone().add(off).setY(0);
            for (const pp of [p0, p1]) {
                const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 1.5, 6), postMat);
                post.position.set(pp.x, 0.75, pp.z);
                post.castShadow = true;
                post.visible = false;
                group.add(post);
                ropes.push(post);
            }
            const mid = p0.clone().lerp(p1, 0.5);
            const curve = new THREE.CatmullRomCurve3([
                new THREE.Vector3(p0.x, 1.4, p0.z),
                new THREE.Vector3(mid.x, 1.05 + Math.sin(Math.PI / 2) * 0.0, mid.z),
                new THREE.Vector3(p1.x, 1.4, p1.z),
            ]);
            const rope = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.05, 5), ropeMat);
            rope.visible = false;
            group.add(rope);
            ropes.push(rope);
        }

        this.scene.add(group);
        this.bridges.push({ group, planks, ropes, startEdge: walkStart, endEdge: walkEnd, active: false });
    }

    setBridgeProgress(i, t) {
        const bridge = this.bridges[i];
        bridge.planks.forEach((plank, idx) => {
            const local = THREE.MathUtils.clamp(t * bridge.planks.length - idx, 0, 1);
            plank.scale.setScalar(Math.max(0.001, local));
            plank.visible = local > 0.02;
        });
    }

    growBridge(i, onDone) {
        const bridge = this.bridges[i];
        bridge.active = true;
        this.tweens.push({
            t: 0, dur: 1.8,
            fn: (k) => this.setBridgeProgress(i, k),
            onDone: () => {
                bridge.ropes.forEach(r => { r.visible = true; });
                if (onDone) onDone();
            },
        });
    }

    // ---------- pedestals ----------

    buildPedestal(chamberIndex) {
        const island = this.islands[chamberIndex + 1];
        const group = new THREE.Group();

        const marble = new THREE.MeshStandardMaterial({ color: 0xd5cdbb, flatShading: true, roughness: 0.8 });
        const goldMat = new THREE.MeshStandardMaterial({ color: 0xc9a14b, metalness: 0.65, roughness: 0.35, flatShading: true });

        const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.7, 0.5, 9), marble);
        plinth.position.y = 0.25;
        group.add(plinth);
        const column = new THREE.Mesh(jitterGeometry(new THREE.CylinderGeometry(0.65, 0.85, 2.0, 9, 2), 0.04), marble);
        column.position.y = 1.5;
        group.add(column);
        const trim = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.07, 6, 14), goldMat);
        trim.rotation.x = Math.PI / 2;
        trim.position.y = 2.45;
        group.add(trim);

        const beam = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.32, 0.5), goldMat);
        beam.position.y = 2.9;
        beam.rotation.z = 0.18;
        beam.castShadow = true;
        group.add(beam);

        const panMat = new THREE.MeshStandardMaterial({ color: 0xb08a3e, metalness: 0.55, roughness: 0.5, flatShading: true });
        const chainMat = new THREE.MeshStandardMaterial({ color: 0x6e552a, flatShading: true });
        const makePan = () => {
            const pan = new THREE.Group();
            const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.8, 5), chainMat);
            chain.position.y = -0.4;
            const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.55, 0.25, 8), panMat);
            dish.position.y = -0.85;
            dish.castShadow = true;
            pan.add(chain, dish);
            return pan;
        };
        const panL = makePan();
        const panR = makePan();
        group.add(panL, panR);

        const gem = new THREE.Mesh(
            new THREE.OctahedronGeometry(0.5, 0),
            new THREE.MeshStandardMaterial({
                color: 0x2c3e50, emissive: 0x000000, emissiveIntensity: 1,
                flatShading: true, roughness: 0.3,
            })
        );
        gem.position.y = 4.3;
        group.add(gem);

        const gemGlow = new THREE.Sprite(new THREE.SpriteMaterial({
            map: this.glowTex, color: 0x5ff0d8, transparent: true, opacity: 0,
            depthWrite: false, blending: THREE.AdditiveBlending,
        }));
        gemGlow.scale.setScalar(3.6);
        gemGlow.position.y = 4.3;
        group.add(gemGlow);

        const glow = new THREE.PointLight(0xf5c95c, 2.2, 12);
        glow.position.y = 3.4;
        group.add(glow);

        group.traverse(o => { if (o.isMesh) o.receiveShadow = true; });
        group.position.set(island.def.x, 0, island.def.z);
        this.scene.add(group);
        const ped = { group, beam, panL, panR, gem, gemGlow, glow, solved: false, wobblePhase: Math.random() * 6 };
        this.hangPans(ped);
        this.pedestals.push(ped);
    }

    hangPans(ped) {
        const a = ped.beam.rotation.z;
        const armX = 1.9 * Math.cos(a);
        const armY = 1.9 * Math.sin(a);
        ped.panL.position.set(-armX, ped.beam.position.y - armY, 0);
        ped.panR.position.set(armX, ped.beam.position.y + armY, 0);
    }

    solvePedestal(chamberIndex) {
        const ped = this.pedestals[chamberIndex];
        ped.solved = true;
        this.tweens.push({
            t: 0, dur: 1.0,
            fn: (k) => {
                ped.beam.rotation.z = 0.18 * (1 - k);
                this.hangPans(ped);
                ped.gem.material.emissive.setRGB(0.1 + 0.5 * k, 0.6 * k + 0.2, 0.55 * k + 0.1);
                ped.gem.material.emissiveIntensity = 1 + 1.6 * k;
                ped.gem.material.color.lerpColors(new THREE.Color(0x2c3e50), new THREE.Color(0x3fd6c0), k);
                ped.gemGlow.material.opacity = 0.7 * k;
                ped.glow.intensity = 2.2 + 9 * k;
            },
        });
    }

    restoreIsland(index) {
        const island = this.islands[index];
        if (island.restored) return;
        island.restored = true;
        const dim = new THREE.Color(0x2a4358);
        const live = new THREE.Color(0x49e8cf);
        this.tweens.push({
            t: 0, dur: 1.6,
            fn: (k) => {
                island.crystals.forEach(c => {
                    c.material.color.lerpColors(dim, live, k);
                    c.material.emissive.setRGB(0.12 * k, 0.82 * k, 0.69 * k);
                    c.material.emissiveIntensity = 1 + 0.5 * k;
                });
                island.glowSprites.forEach(s => { s.material.opacity = 0.55 * k; });
                island.beaconLight.intensity = 15 * k;
            },
        });
        this.burstParticles(new THREE.Vector3(island.def.x, 3, island.def.z), 0x3fd6c0);
    }

    // ---------- the Heart ----------

    buildHeart() {
        const island = this.islands[this.islands.length - 1];
        const heart = new THREE.Mesh(
            new THREE.IcosahedronGeometry(2.2, 0),
            new THREE.MeshStandardMaterial({
                color: 0x33284d, emissive: 0x0a0618, emissiveIntensity: 1,
                flatShading: true, roughness: 0.4,
            })
        );
        heart.position.set(island.def.x, 7.0, island.def.z - 4);
        this.scene.add(heart);
        this.heart = heart;

        this.heartGlow = new THREE.Sprite(new THREE.SpriteMaterial({
            map: this.warmGlowTex, color: 0xff9a66, transparent: true, opacity: 0.12,
            depthWrite: false, blending: THREE.AdditiveBlending,
        }));
        this.heartGlow.scale.setScalar(10);
        this.heartGlow.position.copy(heart.position);
        this.scene.add(this.heartGlow);

        this.heartLight = new THREE.PointLight(0xff7b4d, 1.2, 60);
        this.heartLight.position.copy(heart.position);
        this.scene.add(this.heartLight);

        this.shards = [];
        for (let i = 0; i < 7; i++) {
            const shard = new THREE.Mesh(
                new THREE.TetrahedronGeometry(0.5),
                new THREE.MeshStandardMaterial({
                    color: 0x86a5d9, emissive: 0x2a3f6e, emissiveIntensity: 0.8, flatShading: true,
                })
            );
            this.scene.add(shard);
            this.shards.push({ mesh: shard, phase: (i / 7) * Math.PI * 2, radius: 5 + (i % 3) });
        }
    }

    igniteHeart() {
        this.tweens.push({
            t: 0, dur: 2.4,
            fn: (k) => {
                this.heart.material.emissive.setRGB(0.95 * k, 0.4 * k, 0.2 * k);
                this.heart.material.emissiveIntensity = 1 + 1.4 * k;
                this.heart.material.color.lerpColors(new THREE.Color(0x33284d), new THREE.Color(0xff8a5c), k);
                this.heartLight.intensity = 1.2 + 16 * k;
                this.heartGlow.material.opacity = 0.12 + 0.65 * k;
            },
        });
        this.burstParticles(this.heart.position.clone(), 0xffa46b);
    }

    // ---------- ambient life ----------

    buildFireflies() {
        const n = 110;
        const geo = new THREE.BufferGeometry();
        const positions = new Float32Array(n * 3);
        this.fireflySeeds = [];
        for (let i = 0; i < n; i++) {
            const island = ISLAND_DEFS[i % ISLAND_DEFS.length];
            const a = Math.random() * Math.PI * 2;
            const rad = Math.random() * island.r * 1.2;
            positions[i * 3] = island.x + Math.cos(a) * rad;
            positions[i * 3 + 1] = 0.5 + Math.random() * 4;
            positions[i * 3 + 2] = island.z + Math.sin(a) * rad;
            this.fireflySeeds.push({
                x: positions[i * 3], y: positions[i * 3 + 1], z: positions[i * 3 + 2],
                p1: Math.random() * 6, p2: Math.random() * 6, sp: 0.4 + Math.random() * 0.8,
            });
        }
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        this.fireflies = new THREE.Points(geo, new THREE.PointsMaterial({
            map: this.warmGlowTex, color: 0xffe8a3, size: 0.55, transparent: true,
            opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
        }));
        this.scene.add(this.fireflies);
    }

    // ---------- particles ----------

    burstParticles(origin, color) {
        const n = 80;
        const geo = new THREE.BufferGeometry();
        const positions = new Float32Array(n * 3);
        const velocities = [];
        for (let i = 0; i < n; i++) {
            positions[i * 3] = origin.x;
            positions[i * 3 + 1] = origin.y;
            positions[i * 3 + 2] = origin.z;
            velocities.push(new THREE.Vector3(
                (Math.random() - 0.5) * 7,
                Math.random() * 8,
                (Math.random() - 0.5) * 7
            ));
        }
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const mat = new THREE.PointsMaterial({
            map: this.glowTex, color, size: 0.6, transparent: true, opacity: 1,
            depthWrite: false, blending: THREE.AdditiveBlending,
        });
        const points = new THREE.Points(geo, mat);
        this.scene.add(points);
        this.particles.push({ points, velocities, life: 1.6 });
    }

    // ---------- walkability (unchanged contract) ----------

    isWalkable(pos) {
        for (const island of this.islands) {
            const dx = pos.x - island.def.x;
            const dz = pos.z - island.def.z;
            if (dx * dx + dz * dz < (island.def.r - 1.0) ** 2) return true;
        }
        for (const bridge of this.bridges) {
            if (!bridge.active) continue;
            const a = bridge.startEdge, b = bridge.endEdge;
            const ab = new THREE.Vector2(b.x - a.x, b.z - a.z);
            const ap = new THREE.Vector2(pos.x - a.x, pos.z - a.z);
            const t = THREE.MathUtils.clamp(ap.dot(ab) / ab.lengthSq(), 0, 1);
            const closest = new THREE.Vector2(a.x + ab.x * t, a.z + ab.y * t);
            if (closest.distanceTo(new THREE.Vector2(pos.x, pos.z)) < 1.25) return true;
        }
        return false;
    }

    clampCandidates(pos) {
        const out = [];
        for (const island of this.islands) {
            const R = island.def.r - 1.05;
            const dx = pos.x - island.def.x;
            const dz = pos.z - island.def.z;
            const dist = Math.hypot(dx, dz) || 0.001;
            const k = Math.min(dist, R) / dist;
            out.push(new THREE.Vector3(island.def.x + dx * k, 0, island.def.z + dz * k));
        }
        for (const bridge of this.bridges) {
            if (!bridge.active) continue;
            const a = bridge.startEdge, b = bridge.endEdge;
            const ab = new THREE.Vector2(b.x - a.x, b.z - a.z);
            const ap = new THREE.Vector2(pos.x - a.x, pos.z - a.z);
            const t = THREE.MathUtils.clamp(ap.dot(ab) / ab.lengthSq(), 0, 1);
            const cx = a.x + ab.x * t, cz = a.z + ab.y * t;
            const dx = pos.x - cx, dz = pos.z - cz;
            const dist = Math.hypot(dx, dz) || 0.001;
            const k = Math.min(dist, 1.15) / dist;
            out.push(new THREE.Vector3(cx + dx * k, 0, cz + dz * k));
        }
        return out;
    }

    pedestalPosition(chamberIndex) {
        const island = this.islands[chamberIndex + 1];
        return new THREE.Vector3(island.def.x, 0, island.def.z);
    }

    // ---------- per-frame ----------

    update(dt, playerPos) {
        this.time += dt;

        for (let i = this.tweens.length - 1; i >= 0; i--) {
            const tw = this.tweens[i];
            tw.t += dt;
            const k = Math.min(tw.t / tw.dur, 1);
            tw.fn(1 - Math.pow(1 - k, 3));
            if (k >= 1) {
                this.tweens.splice(i, 1);
                if (tw.onDone) tw.onDone();
            }
        }

        // shadow camera follows the player
        if (playerPos) {
            this.sun.position.set(playerPos.x - 38, 60, playerPos.z + 26);
            this.sun.target.position.set(playerPos.x, 0, playerPos.z);
        }

        this.islands.forEach((island) => {
            island.group.position.y = Math.sin(this.time * 0.5 + island.bobPhase) * 0.35;
        });

        this.swayers.forEach((sw) => {
            sw.object.rotation.z = Math.sin(this.time * 0.9 + sw.phase) * sw.amp;
        });

        this.clouds.forEach((c) => {
            c.sprite.position.x += c.speed * dt;
            if (c.sprite.position.x > 330) c.sprite.position.x = -150;
        });

        this.pedestals.forEach((ped) => {
            if (!ped.solved) {
                ped.beam.rotation.z = 0.18 + Math.sin(this.time * 1.7 + ped.wobblePhase) * 0.06;
                this.hangPans(ped);
            }
            ped.gem.rotation.y += dt * (ped.solved ? 1.4 : 0.3);
        });

        if (this.heart) {
            const s = 1 + Math.sin(this.time * 2.2) * 0.05;
            this.heart.scale.setScalar(s);
            this.heart.rotation.y += dt * 0.4;
            this.heartGlow.scale.setScalar(10 * s);
            this.shards.forEach((sh, i) => {
                const a = this.time * 0.5 + sh.phase;
                sh.mesh.position.set(
                    this.heart.position.x + Math.cos(a) * sh.radius,
                    this.heart.position.y + Math.sin(this.time + i) * 1.2,
                    this.heart.position.z + Math.sin(a) * sh.radius
                );
                sh.mesh.rotation.x += dt;
                sh.mesh.rotation.y += dt * 0.7;
            });
        }

        if (this.fireflies) {
            const pos = this.fireflies.geometry.attributes.position;
            for (let i = 0; i < this.fireflySeeds.length; i++) {
                const f = this.fireflySeeds[i];
                pos.setXYZ(
                    i,
                    f.x + Math.sin(this.time * f.sp + f.p1) * 1.6,
                    f.y + Math.sin(this.time * f.sp * 1.4 + f.p2) * 0.9,
                    f.z + Math.cos(this.time * f.sp * 0.8 + f.p1) * 1.6
                );
            }
            pos.needsUpdate = true;
        }

        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life -= dt;
            const pos = p.points.geometry.attributes.position;
            for (let j = 0; j < p.velocities.length; j++) {
                const v = p.velocities[j];
                v.y -= 6 * dt;
                pos.setXYZ(j, pos.getX(j) + v.x * dt, pos.getY(j) + v.y * dt, pos.getZ(j) + v.z * dt);
            }
            pos.needsUpdate = true;
            p.points.material.opacity = Math.max(p.life / 1.6, 0);
            if (p.life <= 0) {
                this.scene.remove(p.points);
                p.points.geometry.dispose();
                p.points.material.dispose();
                this.particles.splice(i, 1);
            }
        }
    }
}
