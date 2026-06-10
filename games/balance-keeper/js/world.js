// The Isle of Equilibria: a chain of low-poly floating islands. Each carries
// a balance mechanism; solving it relights the island and grows the bridge
// onward. Everything is procedural geometry — no model downloads.

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

const ISLAND_HUES = [0x4f8a5b, 0x4f8a5b, 0x55955e, 0x4a8568, 0x55955e, 0x4f8a5b, 0x4a8568, 0x3f9d7a];

function jitterGeometry(geo, amount, yAmount = amount * 0.5) {
    // Geometries duplicate vertices at seams (cap centers, cap/side edges);
    // co-located vertices must receive the same offset or the surface tears.
    // yAmount 0 keeps a surface planar — used for island tops, where vertical
    // jitter tilts cap triangles into shadow and reads as cracks.
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
        this.bridges = [];      // bridge i connects island i -> i+1
        this.pedestals = [];    // pedestal i on island i+1 (chamber i)
        this.tweens = [];
        this.particles = [];
        this.time = 0;

        this.buildSky();
        ISLAND_DEFS.forEach((def, i) => this.buildIsland(def, i));
        for (let i = 0; i < ISLAND_DEFS.length - 1; i++) this.buildBridge(i);
        this.setBridgeProgress(0, 1); // the old bridge to the first mechanism still stands
        this.bridges[0].active = true;
        for (let c = 0; c < 7; c++) this.buildPedestal(c);
        this.buildHeart();
    }

    // ---------- sky ----------

    buildSky() {
        const canvas = document.createElement('canvas');
        canvas.width = 2; canvas.height = 256;
        const g = canvas.getContext('2d');
        const grad = g.createLinearGradient(0, 0, 0, 256);
        grad.addColorStop(0, '#0a1c3a');
        grad.addColorStop(0.55, '#16365c');
        grad.addColorStop(1, '#3c2c58');
        g.fillStyle = grad;
        g.fillRect(0, 0, 2, 256);
        const tex = new THREE.CanvasTexture(canvas);
        this.scene.background = tex;
        this.scene.fog = new THREE.Fog(0x16365c, 60, 220);

        // stars
        const starGeo = new THREE.BufferGeometry();
        const n = 700;
        const positions = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 700 + 90;
            positions[i * 3 + 1] = 20 + Math.random() * 160;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 700;
        }
        starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
            color: 0xcfe8ff, size: 0.8, sizeAttenuation: true, transparent: true, opacity: 0.85, fog: false,
        }));
        this.scene.add(stars);

        const hemi = new THREE.HemisphereLight(0x9db9e8, 0x2c2440, 0.85);
        this.scene.add(hemi);
        const sun = new THREE.DirectionalLight(0xfff1d6, 1.0);
        sun.position.set(-40, 80, 40);
        this.scene.add(sun);
    }

    // ---------- islands ----------

    buildIsland(def, index) {
        const group = new THREE.Group();
        group.position.set(def.x, 0, def.z);

        const grassMat = new THREE.MeshStandardMaterial({ color: ISLAND_HUES[index], flatShading: true });
        const top = new THREE.Mesh(
            jitterGeometry(new THREE.CylinderGeometry(def.r, def.r * 0.92, 1.6, 11, 1), 0.45, 0),
            grassMat
        );
        top.position.y = -0.8;
        group.add(top);

        const rockMat = new THREE.MeshStandardMaterial({ color: 0x4d4660, flatShading: true });
        const under = new THREE.Mesh(
            jitterGeometry(new THREE.ConeGeometry(def.r * 0.92, def.r * 1.4, 9, 3), 0.9),
            rockMat
        );
        under.rotation.x = Math.PI;
        under.position.y = -1.6 - def.r * 0.7;
        group.add(under);

        const island = {
            def, group, restored: index === 0,
            crystals: [], beaconLight: null, baseY: 0,
            bobPhase: Math.random() * Math.PI * 2,
        };

        // decor: crystals (dark until restored) and simple trees
        const crystalMat = new THREE.MeshStandardMaterial({
            color: 0x223a4d, emissive: 0x000000, flatShading: true,
        });
        const nCrystals = index === 0 ? 3 : 4;
        for (let i = 0; i < nCrystals; i++) {
            const a = (i / nCrystals) * Math.PI * 2 + index;
            const rad = def.r * (0.55 + Math.random() * 0.3);
            const h = 1.2 + Math.random() * 1.8;
            const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(h * 0.45, 0), crystalMat.clone());
            crystal.position.set(Math.cos(a) * rad, h * 0.35, Math.sin(a) * rad);
            crystal.scale.y = 2.2;
            crystal.rotation.y = Math.random() * Math.PI;
            group.add(crystal);
            island.crystals.push(crystal);
        }

        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5d4a3a, flatShading: true });
        const leafMat = new THREE.MeshStandardMaterial({ color: 0x3a6b4f, flatShading: true });
        const nTrees = 2 + (index % 3);
        for (let i = 0; i < nTrees; i++) {
            const a = (i / nTrees) * Math.PI * 2 + index * 1.7 + 0.9;
            const rad = def.r * (0.6 + Math.random() * 0.25);
            const tree = new THREE.Group();
            const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, 1.4, 5), trunkMat);
            trunk.position.y = 0.7;
            const leaves = new THREE.Mesh(new THREE.ConeGeometry(1.1, 2.6, 6), leafMat);
            leaves.position.y = 2.6;
            tree.add(trunk, leaves);
            tree.position.set(Math.cos(a) * rad, 0, Math.sin(a) * rad);
            tree.scale.setScalar(0.8 + Math.random() * 0.6);
            group.add(tree);
        }

        // dormant beacon light, lit on restore
        const beacon = new THREE.PointLight(0x3fd6c0, 0, 26);
        beacon.position.set(0, 5, 0);
        group.add(beacon);
        island.beaconLight = beacon;

        if (index === 0) {
            island.crystals.forEach(c => {
                c.material.color.set(0x3fd6c0);
                c.material.emissive.set(0x1d8a78);
            });
            beacon.intensity = 1.6;
        }

        this.scene.add(group);
        this.islands.push(island);
    }

    // ---------- bridges ----------

    buildBridge(i) {
        const a = ISLAND_DEFS[i];
        const b = ISLAND_DEFS[i + 1];
        const start = new THREE.Vector3(a.x, 0, a.z);
        const end = new THREE.Vector3(b.x, 0, b.z);
        const dir = end.clone().sub(start);
        const len = dir.length();
        dir.normalize();
        // Walkable corridor runs island-center to island-center, so walking
        // toward the next mechanism naturally rides the corridor onto the
        // bridge; the visible planks span just the gap.
        const walkStart = start.clone();
        const walkEnd = end.clone();
        const startEdge = start.clone().add(dir.clone().multiplyScalar(a.r - 1.5));
        const endEdge = end.clone().sub(dir.clone().multiplyScalar(b.r - 1.5));
        const span = endEdge.clone().sub(startEdge);
        const spanLen = span.length();

        const group = new THREE.Group();
        const plankMat = new THREE.MeshStandardMaterial({ color: 0x8a6c3f, flatShading: true });
        const planks = [];
        const nPlanks = Math.round(spanLen / 1.15);
        for (let p = 0; p < nPlanks; p++) {
            const t = (p + 0.5) / nPlanks;
            const plank = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.22, 1.0), plankMat);
            const pos = startEdge.clone().add(span.clone().multiplyScalar(t));
            plank.position.copy(pos);
            plank.position.y = -0.1 + Math.sin(t * Math.PI) * 0.35; // gentle arc
            plank.lookAt(endEdge.x, plank.position.y, endEdge.z);
            plank.scale.setScalar(0.001);
            plank.visible = false;
            group.add(plank);
            planks.push(plank);
        }
        this.scene.add(group);
        this.bridges.push({ group, planks, startEdge: walkStart, endEdge: walkEnd, active: false });
        void len;
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
        bridge.active = true; // walkable as soon as it starts growing
        this.tweens.push({
            t: 0, dur: 1.8,
            fn: (k) => this.setBridgeProgress(i, k),
            onDone,
        });
    }

    // ---------- pedestals (mechanisms) ----------

    buildPedestal(chamberIndex) {
        const island = this.islands[chamberIndex + 1];
        const group = new THREE.Group();

        const stoneMat = new THREE.MeshStandardMaterial({ color: 0x6b6478, flatShading: true });
        const column = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.0, 2.2, 7), stoneMat);
        column.position.y = 1.1;
        group.add(column);

        const beamMat = new THREE.MeshStandardMaterial({ color: 0xb08d3e, flatShading: true, metalness: 0.4, roughness: 0.5 });
        const beam = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.32, 0.5), beamMat);
        beam.position.y = 2.8;
        beam.rotation.z = 0.18; // out of balance until solved
        group.add(beam);

        const panMat = new THREE.MeshStandardMaterial({ color: 0x8f7434, flatShading: true, metalness: 0.4, roughness: 0.6 });
        const chainMat = new THREE.MeshStandardMaterial({ color: 0x5e4a22, flatShading: true });
        const makePan = () => {
            const pan = new THREE.Group();
            const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.8, 5), chainMat);
            chain.position.y = -0.4;
            const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.55, 0.25, 8), panMat);
            dish.position.y = -0.85;
            pan.add(chain, dish);
            return pan;
        };
        const panL = makePan();
        const panR = makePan();
        group.add(panL, panR);

        const gem = new THREE.Mesh(
            new THREE.OctahedronGeometry(0.5, 0),
            new THREE.MeshStandardMaterial({ color: 0x2c3e50, emissive: 0x000000, flatShading: true })
        );
        gem.position.y = 3.9;
        group.add(gem);

        const glow = new THREE.PointLight(0xf5c95c, 0.35, 10);
        glow.position.y = 3.2;
        group.add(glow);

        group.position.set(island.def.x, 0, island.def.z);
        this.scene.add(group);
        const ped = { group, beam, panL, panR, gem, glow, solved: false, wobblePhase: Math.random() * 6 };
        this.hangPans(ped);
        this.pedestals.push(ped);
    }

    // pans hang plumb from the beam ends, wherever the beam tilts
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
                ped.gem.material.emissive.setRGB(0.05 + 0.6 * k, 0.5 * k + 0.2, 0.45 * k + 0.1);
                ped.gem.material.color.lerpColors(new THREE.Color(0x2c3e50), new THREE.Color(0x3fd6c0), k);
                ped.glow.intensity = 0.35 + 1.4 * k;
            },
        });
    }

    restoreIsland(index) {
        const island = this.islands[index];
        if (island.restored) return;
        island.restored = true;
        const dim = new THREE.Color(0x223a4d);
        const live = new THREE.Color(0x3fd6c0);
        this.tweens.push({
            t: 0, dur: 1.6,
            fn: (k) => {
                island.crystals.forEach(c => {
                    c.material.color.lerpColors(dim, live, k);
                    c.material.emissive.setRGB(0.11 * k, 0.54 * k, 0.47 * k);
                });
                island.beaconLight.intensity = 1.8 * k;
            },
        });
        this.burstParticles(new THREE.Vector3(island.def.x, 3, island.def.z), 0x3fd6c0);
    }

    // ---------- the Heart ----------

    buildHeart() {
        const island = this.islands[this.islands.length - 1];
        const heart = new THREE.Mesh(
            new THREE.IcosahedronGeometry(2.2, 0),
            new THREE.MeshStandardMaterial({ color: 0x33284d, emissive: 0x0a0618, flatShading: true })
        );
        heart.position.set(island.def.x, 6.5, island.def.z - 4);
        this.scene.add(heart);
        this.heart = heart;
        this.heartLight = new THREE.PointLight(0xff7b4d, 0.2, 50);
        this.heartLight.position.copy(heart.position);
        this.scene.add(this.heartLight);

        // orbiting shards
        this.shards = [];
        for (let i = 0; i < 7; i++) {
            const shard = new THREE.Mesh(
                new THREE.TetrahedronGeometry(0.5),
                new THREE.MeshStandardMaterial({ color: 0x86a5d9, emissive: 0x1a2a4a, flatShading: true })
            );
            this.scene.add(shard);
            this.shards.push({ mesh: shard, phase: (i / 7) * Math.PI * 2, radius: 5 + (i % 3) });
        }
    }

    igniteHeart() {
        this.tweens.push({
            t: 0, dur: 2.4,
            fn: (k) => {
                this.heart.material.emissive.setRGB(0.85 * k, 0.32 * k, 0.16 * k);
                this.heart.material.color.lerpColors(new THREE.Color(0x33284d), new THREE.Color(0xff8a5c), k);
                this.heartLight.intensity = 0.2 + 3.2 * k;
            },
        });
        this.burstParticles(this.heart.position.clone(), 0xffa46b);
    }

    // ---------- particles ----------

    burstParticles(origin, color) {
        const n = 60;
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
        const mat = new THREE.PointsMaterial({ color, size: 0.35, transparent: true, opacity: 1 });
        const points = new THREE.Points(geo, mat);
        this.scene.add(points);
        this.particles.push({ points, velocities, life: 1.6 });
    }

    // ---------- walkability ----------

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
            // half-width just inside the planks (1.3) so feet stay on wood
            if (closest.distanceTo(new THREE.Vector2(pos.x, pos.z)) < 1.25) return true;
        }
        return false;
    }

    // For movement assist: the desired-but-unwalkable point clamped onto each
    // walkable region (island discs and active bridge corridors).
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

    update(dt) {
        this.time += dt;

        // tweens
        for (let i = this.tweens.length - 1; i >= 0; i--) {
            const tw = this.tweens[i];
            tw.t += dt;
            const k = Math.min(tw.t / tw.dur, 1);
            tw.fn(1 - Math.pow(1 - k, 3)); // ease-out cubic
            if (k >= 1) {
                this.tweens.splice(i, 1);
                if (tw.onDone) tw.onDone();
            }
        }

        // islands bob gently
        this.islands.forEach((island) => {
            island.group.position.y = Math.sin(this.time * 0.5 + island.bobPhase) * 0.35;
        });

        // unsolved beams wobble; gems on solved ones spin slowly
        this.pedestals.forEach((ped) => {
            if (!ped.solved) {
                ped.beam.rotation.z = 0.18 + Math.sin(this.time * 1.7 + ped.wobblePhase) * 0.06;
                this.hangPans(ped);
            }
            ped.gem.rotation.y += dt * (ped.solved ? 1.4 : 0.3);
        });

        // heart pulse + shards
        if (this.heart) {
            const s = 1 + Math.sin(this.time * 2.2) * 0.05;
            this.heart.scale.setScalar(s);
            this.heart.rotation.y += dt * 0.4;
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

        // particles
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
