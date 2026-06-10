// DOM overlay for the balance mechanisms and the Ferryman's solution-set test.
// All interaction is click-based so it works on Chromebook trackpads and
// touchscreens; the world canvas pauses underneath.

import { BalancePuzzle } from './equation.js';
import * as audio from './audio.js';

export class PuzzleUI {
    constructor() {
        this.modal = document.getElementById('puzzle-modal');
        this.titleEl = document.getElementById('puzzle-title');
        this.flavorEl = document.getElementById('puzzle-flavor');
        this.readout = document.getElementById('equation-readout');
        this.board = document.getElementById('balance-board');
        this.tilesLeft = document.getElementById('tiles-left');
        this.tilesRight = document.getElementById('tiles-right');
        this.relSymbol = document.getElementById('relation-symbol');
        this.message = document.getElementById('puzzle-message');
        this.stepsLog = document.getElementById('steps-log');
        this.successPane = document.getElementById('puzzle-success');
        this.solutionBanner = document.getElementById('solution-banner');

        this.ferryModal = document.getElementById('ferry-modal');
        this.ferryRule = document.getElementById('ferry-rule');
        this.stoneDock = document.getElementById('stone-dock');
        this.ferryMessage = document.getElementById('ferry-message');

        this.puzzles = new Map(); // chamber index -> BalancePuzzle (state survives walking away)
        this.current = null;
        this.chamberIndex = -1;
        this.onSolved = null;

        document.querySelectorAll('.token-btn').forEach(btn =>
            btn.addEventListener('click', () => this.handleToken(btn.dataset.op)));
        document.querySelectorAll('.divide-btn').forEach(btn =>
            btn.addEventListener('click', () => this.handleDivide(parseInt(btn.dataset.k, 10))));

        document.getElementById('hint-btn').addEventListener('click', () => {
            if (!this.current) return;
            this.setMessage(`Axiom whispers: “${this.current.hint()}”`);
        });
        document.getElementById('reset-btn').addEventListener('click', () => {
            if (!this.current) return;
            this.current.reset();
            this.render();
            this.setMessage('The mechanism resets to how you found it.');
        });
        document.getElementById('puzzle-close').addEventListener('click', () => this.close(false));
        document.getElementById('keystone-btn').addEventListener('click', () => this.close(true));
        document.getElementById('launch-btn').addEventListener('click', () => this.launchFerry());

        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !this.modal.classList.contains('hidden')) this.close(false);
        });
    }

    get isOpen() {
        return !this.modal.classList.contains('hidden') || !this.ferryModal.classList.contains('hidden');
    }

    open(index, chamber, onSolved) {
        this.chamberIndex = index;
        this.chamber = chamber;
        this.onSolved = onSolved;
        if (!this.puzzles.has(index)) {
            this.puzzles.set(index, new BalancePuzzle(chamber.puzzle));
        }
        this.current = this.puzzles.get(index);
        this.titleEl.textContent = chamber.name;
        this.flavorEl.textContent = chamber.flavor;
        this.successPane.classList.add('hidden');
        this.setMessage(' ');
        this.modal.classList.remove('hidden');
        this.render();
        if (this.current.solved()) this.showSuccess();
    }

    close(solved) {
        this.modal.classList.add('hidden');
        if (solved && this.chamber.ferry) {
            this.openFerry(this.chamber.ferry);
            return;
        }
        if (solved && this.onSolved) this.onSolved(this.current);
    }

    setMessage(text, warn = false) {
        this.message.innerHTML = text;
        this.message.classList.toggle('warn', warn);
    }

    shake() {
        this.board.classList.remove('shake');
        void this.board.offsetWidth; // restart the animation
        this.board.classList.add('shake');
        audio.sfxError();
    }

    handleToken(op) {
        if (!this.current || this.current.solved()) return;
        const before = this.current.tileCount(this.current.left) + this.current.tileCount(this.current.right);
        const result = this.current.apply(op);
        if (!result.ok) {
            this.shake();
            this.setMessage('The pans groan — they cannot hold more. Cancel some pairs first, or restore the scene.', true);
            return;
        }
        const after = this.current.tileCount(this.current.left) + this.current.tileCount(this.current.right);
        if (after < before + 2) {
            audio.sfxCancel();
            this.setMessage('A pair cancels to nothing — zero takes no room on the pan.');
        } else {
            audio.sfxTile();
            this.setMessage(' ');
        }
        this.render();
        this.checkSolved();
    }

    handleDivide(k) {
        if (!this.current || this.current.solved()) return;
        const result = this.current.divide(k);
        if (!result.ok) {
            this.shake();
            this.setMessage(`The crystals resist — both pans must split into ${k} equal groups, with nothing left over.`, true);
            return;
        }
        audio.sfxCancel();
        this.setMessage(`Both sides split into ${k} equal groups.`);
        this.render();
        this.checkSolved();
    }

    checkSolved() {
        if (this.current.solved()) {
            audio.sfxSolve();
            this.showSuccess();
        }
    }

    showSuccess() {
        this.solutionBanner.textContent = this.current.solutionText();
        this.successPane.classList.remove('hidden');
    }

    render() {
        const p = this.current;
        this.readout.textContent = p.format();
        this.relSymbol.textContent = p.rel;
        this.renderPan(this.tilesLeft, p.left);
        this.renderPan(this.tilesRight, p.right);
        const tilt = p.tilt();
        this.board.classList.toggle('tilt-left', tilt === 'left');
        this.board.classList.toggle('tilt-right', tilt === 'right');
        this.stepsLog.innerHTML = p.steps.slice(-3).map(s => `<div>${s}</div>`).join('');
    }

    renderPan(el, side) {
        el.innerHTML = '';
        const addTiles = (count, posClass, negClass, posText, negText) => {
            for (let i = 0; i < Math.abs(count); i++) {
                const tile = document.createElement('div');
                tile.className = `tile ${count > 0 ? posClass : negClass}`;
                tile.textContent = count > 0 ? posText : negText;
                el.appendChild(tile);
            }
        };
        addTiles(side.x, 'tile-x-pos', 'tile-x-neg', 'x', '−x');
        addTiles(side.u, 'tile-u-pos', 'tile-u-neg', '1', '−1');
    }

    // ---------- Ferry phase (solution sets) ----------

    openFerry(ferry) {
        this.ferry = ferry;
        this.ferryRule.textContent = this.current.solutionText();
        this.stoneDock.innerHTML = '';
        ferry.stones.forEach(value => {
            const stone = document.createElement('button');
            stone.className = 'stone';
            stone.textContent = value;
            stone.dataset.value = value;
            stone.addEventListener('click', () => {
                stone.classList.toggle('loaded');
                stone.classList.remove('offender');
                audio.sfxTile();
            });
            this.stoneDock.appendChild(stone);
        });
        this.ferryMessage.innerHTML = ' ';
        this.ferryModal.classList.remove('hidden');
    }

    launchFerry() {
        const ferry = this.ferry;
        const safe = v => (ferry.inclusive ? v <= ferry.limit : v < ferry.limit);
        const stones = [...this.stoneDock.querySelectorAll('.stone')];
        const offenders = stones.filter(s => s.classList.contains('loaded') && !safe(+s.dataset.value));
        const missed = stones.filter(s => !s.classList.contains('loaded') && safe(+s.dataset.value));

        if (offenders.length) {
            offenders.forEach(s => s.classList.add('offender'));
            this.stoneDock.classList.remove('dip');
            void this.stoneDock.offsetWidth;
            this.stoneDock.classList.add('dip');
            audio.sfxError();
            const v = offenders[0].dataset.value;
            this.ferryMessage.innerHTML = `The ferry dips! The <strong>${v}</strong>‑stone is too heavy — does ${v} keep <strong>${this.current.solutionText()}</strong> true?`;
            this.ferryMessage.classList.add('warn');
            return;
        }
        if (missed.length) {
            audio.sfxError();
            this.ferryMessage.innerHTML = `The Ferryman frowns: “Safe stones still sit on the dock. <em>Every</em> weight that keeps <strong>${this.current.solutionText()}</strong> true must come aboard.”`;
            this.ferryMessage.classList.add('warn');
            return;
        }
        audio.sfxSolve();
        this.ferryModal.classList.add('hidden');
        if (this.onSolved) this.onSolved(this.current);
    }
}
