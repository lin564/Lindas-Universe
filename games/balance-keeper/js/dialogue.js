// Axiom's dialogue bar: a simple click/Enter-advanced line queue.

export class Dialogue {
    constructor() {
        this.bar = document.getElementById('dialogue-bar');
        this.text = document.getElementById('dialogue-text');
        this.queue = [];
        this.onDone = null;
        this.active = false;

        this.bar.addEventListener('click', () => this.advance());
        window.addEventListener('keydown', (e) => {
            if (this.active && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                this.advance();
            }
        });
    }

    say(lines, onDone = null) {
        this.queue = Array.isArray(lines) ? [...lines] : [lines];
        this.onDone = onDone;
        this.active = true;
        this.bar.classList.remove('hidden');
        this.advance(true);
    }

    advance(first = false) {
        if (!first && this.queue.length === 0) {
            this.close();
            return;
        }
        const line = this.queue.shift();
        if (line === undefined) {
            this.close();
            return;
        }
        this.text.innerHTML = line;
    }

    close() {
        this.active = false;
        this.bar.classList.add('hidden');
        const cb = this.onDone;
        this.onDone = null;
        if (cb) cb();
    }
}
