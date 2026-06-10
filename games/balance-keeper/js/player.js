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

        const robe = new THREE.Mesh(
            new THREE.ConeGeometry(0.55, 1.5, 7),
            new THREE.MeshStandardMaterial({ color: 0x2b4a7a, flatShading: true })
        );
        robe.position.y = 0.75;
        this.group.add(robe);

        const head = new THREE.Mesh(
            new THREE.SphereGeometry(0.32, 8, 6),
            new THREE.MeshStandardMaterial({ color: 0xe8c39a, flatShading: true })
        );
        head.position.y = 1.7;
        this.group.add(head);

        const hood = new THREE.Mesh(
            new THREE.ConeGeometry(0.42, 0.6, 7),
            new THREE.MeshStandardMaterial({ color: 0x1c3458, flatShading: true })
        );
        hood.position.y = 1.95;
        this.group.add(hood);

        const staff = new THREE.Group();
        const pole = new THREE.Mesh(
            new THREE.CylinderGeometry(0.05, 0.05, 1.9, 5),
            new THREE.MeshStandardMaterial({ color: 0x6b4f33, flatShading: true })
        );
        pole.position.y = 0.95;
        const staffGem = new THREE.Mesh(
            new THREE.OctahedronGeometry(0.16, 0),
            new THREE.MeshStandardMaterial({ color: 0x3fd6c0, emissive: 0x1d8a78, flatShading: true })
        );
        staffGem.position.y = 2.0;
        staff.add(pole, staffGem);
        staff.position.set(0.55, 0, 0.1);
        this.group.add(staff);
        this.staffGem = staffGem;

        const staffLight = new THREE.PointLight(0x3fd6c0, 0.9, 9);
        staffLight.position.set(0.55, 2.0, 0.1);
        this.group.add(staffLight);

        scene.add(this.group);

        // Axiom the wisp
        this.axiom = new THREE.Group();
        const wisp = new THREE.Mesh(
            new THREE.IcosahedronGeometry(0.28, 0),
            new THREE.MeshStandardMaterial({ color: 0x9fdcf5, emissive: 0x2f93c2, flatShading: true })
        );
        const wispLight = new THREE.PointLight(0x5bc0eb, 1.1, 8);
        this.axiom.add(wisp, wispLight);
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
                    if (reach < step * 0.25 || offTarget > 3.5) continue;
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

        // damped follow camera
        const camTarget = new THREE.Vector3(this.position.x, 9.5, this.position.z + 12.5);
        this.camera.position.lerp(camTarget, Math.min(dt * 3, 1));
        this.camera.lookAt(this.position.x, 1.6, this.position.z);
    }

    snapCamera() {
        this.camera.position.set(this.position.x, 9.5, this.position.z + 12.5);
        this.camera.lookAt(this.position.x, 1.6, this.position.z);
    }
}
