// The algebra engine behind every mechanism on the isle.
// An equation/inequality is two pans of tiles: x-crystals and unit stones,
// each a signed integer count. Every legal move acts on BOTH sides, so the
// relation is preserved by construction — the game's core teaching idea.

const OPS = {
    '+1': { key: 'u', delta: 1, label: '+1 to both sides' },
    '-1': { key: 'u', delta: -1, label: '−1 to both sides' },
    '+x': { key: 'x', delta: 1, label: '+x to both sides' },
    '-x': { key: 'x', delta: -1, label: '−x to both sides' },
};

const FLIP = { '=': '=', '<': '>', '>': '<', '≤': '≥', '≥': '≤' };

export class BalancePuzzle {
    constructor({ left, right, rel = '=', maxTiles = 14 }) {
        this.initial = { left: { ...left }, right: { ...right } };
        this.rel = rel;
        // The overload cap must leave room above the starting layout, or a
        // tile-heavy puzzle would reject every move.
        this.maxTiles = Math.max(maxTiles, this.tileCount(left) + 2, this.tileCount(right) + 2);
        this.hintsUsed = 0;
        this.reset();
    }

    reset() {
        this.left = { ...this.initial.left };
        this.right = { ...this.initial.right };
        this.steps = [];
    }

    tileCount(side) {
        return Math.abs(side.x) + Math.abs(side.u);
    }

    apply(op) {
        const spec = OPS[op];
        if (!spec) return { ok: false, reason: 'unknown' };
        const nl = { ...this.left };
        const nr = { ...this.right };
        nl[spec.key] += spec.delta;
        nr[spec.key] += spec.delta;
        if (this.tileCount(nl) > this.maxTiles || this.tileCount(nr) > this.maxTiles) {
            return { ok: false, reason: 'overload' };
        }
        this.left = nl;
        this.right = nr;
        this.steps.push(spec.label);
        return { ok: true };
    }

    divide(k) {
        if (!Number.isInteger(k) || k < 2) return { ok: false, reason: 'badk' };
        const vals = [this.left.x, this.left.u, this.right.x, this.right.u];
        if (vals.every(v => v === 0)) return { ok: false, reason: 'empty' };
        if (vals.some(v => v % k !== 0)) return { ok: false, reason: 'indivisible' };
        this.left.x /= k; this.left.u /= k;
        this.right.x /= k; this.right.u /= k;
        this.steps.push(`÷${k} both sides`);
        return { ok: true };
    }

    solved() {
        return this.isIsolated(this.left, this.right) || this.isIsolated(this.right, this.left);
    }

    isIsolated(xSide, otherSide) {
        return xSide.x === 1 && xSide.u === 0 && otherSide.x === 0;
    }

    // Only valid once solved(). Returns e.g. "x = 4" or "x ≤ 6".
    solutionText() {
        if (this.isIsolated(this.left, this.right)) {
            return `x ${this.rel} ${this.right.u}`;
        }
        // x ended up on the right: read the relation mirrored (6 ≥ x means x ≤ 6).
        return `x ${FLIP[this.rel]} ${this.left.u}`;
    }

    solutionValue() {
        return this.isIsolated(this.left, this.right) ? this.right.u : this.left.u;
    }

    formatSide(side) {
        const parts = [];
        if (side.x !== 0) {
            if (side.x === 1) parts.push('x');
            else if (side.x === -1) parts.push('−x');
            else parts.push(`${side.x < 0 ? '−' : ''}${Math.abs(side.x)}x`);
        }
        if (side.u !== 0) {
            if (parts.length) parts.push(side.u > 0 ? `+ ${side.u}` : `− ${Math.abs(side.u)}`);
            else parts.push(side.u < 0 ? `−${Math.abs(side.u)}` : `${side.u}`);
        }
        if (!parts.length) parts.push('0');
        return parts.join(' ');
    }

    format() {
        return `${this.formatSide(this.left)} ${this.rel} ${this.formatSide(this.right)}`;
    }

    // Which way the board should lean, for inequalities: the "heavier"
    // (greater) side dips. Equations stay level — both-sides moves keep them so.
    tilt() {
        if (this.rel === '<' || this.rel === '≤') return 'right';
        if (this.rel === '>' || this.rel === '≥') return 'left';
        return 'level';
    }

    hint() {
        this.hintsUsed += 1;
        const L = this.left, R = this.right;
        if (this.solved()) return 'The balance is restored — set the keystone!';
        if (L.x > 0 && R.x > 0) {
            const n = Math.min(L.x, R.x);
            return `Both pans hold x‑crystals. Add −x to both sides ${n === 1 ? 'once' : n + ' times'} to clear one pan.`;
        }
        if (L.x < 0 || R.x < 0) {
            return 'A pan holds void‑crystals (−x). Add +x to both sides to cancel them away.';
        }
        if (L.x === 0 && R.x === 0) {
            return 'No x‑crystals remain on either pan. Restore the scene and keep at least one x.';
        }
        const xSide = L.x !== 0 ? L : R;
        if (xSide.u > 0) {
            return `Loose stones sit beside the x‑crystals. Add −1 to both sides ${xSide.u === 1 ? 'once' : xSide.u + ' times'} — the pairs will cancel.`;
        }
        if (xSide.u < 0) {
            const n = -xSide.u;
            return `Void‑stones weigh down the x‑pan. Add +1 to both sides ${n === 1 ? 'once' : n + ' times'} to cancel them.`;
        }
        if (xSide.x > 1) {
            return `${xSide.x} crystals share their pan equally — divide both sides into ${xSide.x} groups.`;
        }
        return 'Look at the pan holding the x‑crystals. What is keeping x from standing alone?';
    }
}
