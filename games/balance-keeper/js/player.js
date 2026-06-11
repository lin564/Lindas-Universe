// The apprentice Keeper: a low-poly robed figure with a glowing staff,
// keyboard-driven with a damped follow camera (no mouse-look needed —
// trackpad/Chromebook friendly). Axiom the wisp trails behind.

import * as THREE from 'three';

export class Player {
    constructor(scene, camera) {
        this.camera = camera;
        this.position = new THREE.Vector3(0, 0, 4);
        this.speed = 9;
        this.facing = 0;
        this.time = 0;

        this.group = new THREE.Group();

        // layered robe with golden trim
        const robe = new THREE.Mesh(
            new THREE.ConeGeometry(0.55, 1.5, 8),
            new THREE.MeshStandardMaterial({ color: 0x33567f, flatShading: true, roughness: 0.85 })
        );
        robe.position.y = 0.75;
        this.group.add(robe);

        const skirtTrim = new THREE.Mesh(
            new THREE.ConeGeometry(0.58, 0.32, 8),
            new THREE.MeshStandardMaterial({ color: 0xc9a14b, metalness: 0.5, roughness: 0.45, flatShading: true })
        );
        skirtTrim.position.y = 0.16;
        this.group.add(skirtTrim);

        const shoulders = new THREE.Mesh(
            new THREE.ConeGeometry(0.42, 0.55, 8),
            new THREE.MeshStandardMaterial({ color: 0x274569, flatShading: true, roughness: 0.85 })
        );
        shoulders.position.y = 1.38;
        this.group.add(shoulders);

        const belt = new THREE.Mesh(
            new THREE.TorusGeometry(0.34, 0.045, 5, 10),
            new THREE.MeshStandardMaterial({ color: 0xc9a14b, metalness: 0.5, roughness: 0.45, flatShading: true })
        );
        belt.rotation.x = Math.PI / 2;
        belt.position.y = 0.95;
        this.group.add(belt);

        const satchel = new THREE.Mesh(
            new THREE.BoxGeometry(0.26, 0.22, 0.12),
            new THREE.MeshStandardMaterial({ color: 0x7a5a36, flatShading: true, roughness: 0.9 })
        );
        satchel.position.set(-0.42, 0.92, 0.12);
        satchel.rotation.y = 0.4;
        this.group.add(satchel);

        const head = new THREE.Mesh(
            new THREE.SphereGeometry(0.32, 10, 8),
            new THREE.MeshStandardMaterial({ color: 0xe8c39a, flatShading: true, roughness: 0.8 })
        );
        head.position.y = 1.7;
        this.group.add(head);

        const hood = new THREE.Mesh(
            new THREE.ConeGeometry(0.42, 0.62, 8),
            new THREE.MeshStandardMaterial({ color: 0x1d3a63, flatShading: true, roughness: 0.85 })
        );
        hood.position.y = 1.96;
        this.group.add(hood);

        const staff = new THREE.Group();
        const pole = new THREE.Mesh(
            new THREE.CylinderGeometry(0.05, 0.06, 1.9, 6),
            new THREE.MeshStandardMaterial({ color: 0x6b4f33, flatShading: true, roughness: 0.9 })
        );
        pole.position.y = 0.95;
        const staffGem = new THREE.Mesh(
            new THREE.OctahedronGeometry(0.16, 0),
            new THREE.MeshStandardMaterial({
                color: 0x3fd6c0, emissive: 0x25c4a8, emissiveIntensity: 2.2, flatShading: true,
            })
        );
        staffGem.position.y = 2.0;
        staff.add(pole, staffGem);
        staff.position.set(0.55, 0, 0.1);
        this.group.add(staff);
        this.staffGem = staffGem;

        const staffLight = new THREE.PointLight(0x3fd6c0, 2.4, 10);
        staffLight.position.set(0.55, 2.0, 0.1);
        this.group.add(staffLight);

        this.group.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
        scene.add(this.group);

        // Axiom the wisp, with an additive halo that blooms
        this.axiom = new THREE.Group();
        const wisp = new THREE.Mesh(
            new THREE.IcosahedronGeometry(0.28, 0),
            new THREE.MeshStandardMaterial({
                color: 0x9fdcf5, emissive: 0x4fb8e8, emissiveIntensity: 2.4, flatShading: true,
            })
        );
        const haloCanvas = (() => {
            const c = document.createElement('canvas');
            c.width = c.height = 128;
            const g = c.getContext('2d');
            const grad = g.createRadialGradient(64, 64, 4, 64, 64, 62);
            grad.addColorStop(0, 'rgba(190,235,255,1)');
            grad.addColorStop(1, 'rgba(190,235,255,0)');
            g.fillStyle = grad;
            g.fillRect(0, 0, 128, 128);
            const tex = new THREE.CanvasTexture(c);
            tex.colorSpace = THREE.SRGBColorSpace;
            return tex;
        })();
        const halo = new THREE.Sprite(new THREE.SpriteMaterial({
            map: haloCanvas, color: 0x9fdcf5, transparent: true, opacity: 0.6,
            depthWrite: false, blending: THREE.AdditiveBlending,
        }));
        halo.scale.setScalar(1.8);
        const wispLight = new THREE.PointLight(0x5bc0eb, 2.6, 9);
        this.axiom.add(wisp, halo, wispLight);
        this.axiom.position.set(1.6, 2.6, 1.0);
        scene.add(this.axiom);
        this.wispMesh = wisp;

        this.keys = new Set();
        window.addEventListener('keydown', (e) => this.keys.add(e.key.toLowerCase()));
        window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
        window.addEventListener('blur', () => this.keys.clear());

        this.snapCamera();
    }

    inputVector() {
        const v = new THREE.Vector2(0, 0);
        if (this.keys.has('w') || this.keys.has('arrowup')) v.y -= 1;
        if (this.keys.has('s') || this.keys.has('arrowdown')) v.y += 1;
        if (this.keys.has('a') || this.keys.has('arrowleft')) v.x -= 1;
        if (this.keys.has('d') || this.keys.has('arrowright')) v.x += 1;
        if (v.lengthSq() > 0) v.normalize();
        return v;
    }

    update(dt, world, frozen) {
        this.time += dt;
        const input = frozen ? new THREE.Vector2() : this.inputVector();
        const step = this.speed * dt;
        let moving = false;

        if (input.lengthSq() > 0) {
            // try the full move, then slide along each axis with input —
            // a zero-input axis candidate would equal the current position
            // and "succeed" without moving, masking the glide assist below
            const candidates = [
                new THREE.Vector3(this.position.x + input.x * step, 0, this.position.z + input.y * step),
            ];
            if (input.x !== 0 && input.y !== 0) {
                candidates.push(
                    new THREE.Vector3(this.position.x + input.x * step, 0, this.position.z),
                    new THREE.Vector3(this.position.x, 0, this.position.z + input.y * step),
                );
            }
            for (const c of candidates) {
                if (world.isWalkable(c)) {
                    this.position.copy(c);
                    moving = true;
                    break;
                }
            }

            // Blocked: glide toward the nearest walkable region instead of
            // sticking — lets players curve around island rims and funnel
            // onto bridges without pixel-perfect steering.
            if (!moving) {
                const desired = candidates[0];
                let best = null;
                let bestScore = 0;
                for (const q of world.clampCandidates(desired)) {
                    const reach = q.distanceTo(this.position);
                    const offTarget = q.distanceTo(desired);
                    // must actually move us, and stay near where the player
                    // aimed; among those, prefer the most progress (so the
                    // bridge corridor beats a micro-step along the rim)
                    if (reach < step * 0.25 || offTarget > 4.6) continue;
                    if (reach > bestScore) {
                        bestScore = reach;
                        best = q;
                    }
                }
                if (best) {
                    const dir = best.clone().sub(this.position);
                    const len = dir.length();
                    dir.multiplyScalar(Math.min(step, len) / len);
                    let cand = this.position.clone().add(dir);
                    if (!world.isWalkable(cand)) {
                        // step strayed off the walkable space — clamp it back
                        let nearest = null;
                        let nd = Infinity;
                        for (const q of world.clampCandidates(cand)) {
                            const d = q.distanceTo(cand);
                            if (d < nd) { nd = d; nearest = q; }
                        }
                        cand = nearest;
                    }
                    if (cand && cand.distanceTo(this.position) >= step * 0.2) {
                        this.position.copy(cand);
                        moving = true;
                    }
                }
            }
            const target = Math.atan2(input.x, input.y);
            let diff = target - this.facing;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            this.facing += diff * Math.min(dt * 12, 1);
        }

        this.group.position.copy(this.position);
        this.group.position.y = Math.sin(this.time * (moving ? 9 : 2)) * (moving ? 0.12 : 0.05);
        this.group.rotation.y = this.facing;
        this.staffGem.rotation.y += dt * 2;

        // Axiom drifts to a point beside the player's shoulder
        const wispTarget = new THREE.Vector3(
            this.position.x + Math.sin(this.facing + 2.4) * 1.6,
            2.6 + Math.sin(this.time * 2.1) * 0.25,
            this.position.z + Math.cos(this.facing + 2.4) * 1.6
        );
        this.axiom.position.lerp(wispTarget, Math.min(dt * 3.5, 1));
        this.wispMesh.rotation.y += dt * 1.5;
        this.wispMesh.rotation.x += dt * 0.8;

        // damped follow camera, gaze lifted so sky and vista stay in frame
        const camTarget = new THREE.Vector3(this.position.x, 8.6, this.position.z + 12.5);
        this.camera.position.lerp(camTarget, Math.min(dt * 3, 1));
        this.camera.lookAt(this.position.x, 3.4, this.position.z);
    }

    snapCamera() {
        this.camera.position.set(this.position.x, 8.6, this.position.z + 12.5);
        this.camera.lookAt(this.position.x, 3.4, this.position.z);
    }
}
