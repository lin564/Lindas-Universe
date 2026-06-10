// The Balance Keeper — game orchestration.
// State flow: intro → explore ⇄ (dialogue | puzzle) → … → finale.

import * as THREE from 'three';
import { World } from './world.js';
import { Player } from './player.js';
import { PuzzleUI } from './puzzleUI.js';
import { Dialogue } from './dialogue.js';
import { CHAMBERS } from './chambers.js';
import * as audio from './audio.js';

// ---------- renderer / scene ----------

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 400);

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

const world = new World(scene);
const player = new Player(scene, camera);
const puzzleUI = new PuzzleUI();
const dialogue = new Dialogue();

// ---------- UI refs ----------

const introScreen = document.getElementById('intro-screen');
const endScreen = document.getElementById('end-screen');
const endStats = document.getElementById('end-stats');
const hud = document.getElementById('hud');
const objectiveText = document.getElementById('objective-text');
const interactPrompt = document.getElementById('interact-prompt');
const muteBtn = document.getElementById('mute-btn');

// ---------- game state ----------

const state = {
    stage: 'intro',           // intro | explore | dialogue | puzzle | end
    chamber: 0,               // next unsolved chamber index
    solved: new Array(CHAMBERS.length).fill(false),
    introducedChamber: -1,    // last chamber whose intro lines have played
    startTime: 0,
    totalSteps: 0,
};

function setObjective(text) {
    objectiveText.textContent = text;
}

function litGems(n) {
    document.querySelectorAll('#progress-card .gem').forEach((gem, i) => {
        gem.classList.toggle('lit', i < n);
    });
}

// ---------- intro ----------

document.getElementById('begin-btn').addEventListener('click', () => {
    introScreen.classList.add('hidden');
    hud.classList.remove('hidden');
    state.stage = 'dialogue';
    state.startTime = performance.now();
    audio.sfxBridge();
    dialogue.say([
        'You came! I am <strong>Axiom</strong> — the old Keeper’s wisp. The isle is going dark, and you are all that is left of the Order of Balance.',
        'Each mechanism out here is a great balance. The law is simple and absolute: <em>whatever you do to one side, you must do to the other.</em>',
        'The first mechanism waits across the old bridge. Walk with <strong>WASD</strong> or the <strong>arrow keys</strong>!',
    ], () => {
        state.stage = 'explore';
        setObjective(CHAMBERS[0].objective);
    });
});

muteBtn.addEventListener('click', () => {
    muteBtn.classList.toggle('muted', audio.toggleMute());
});

document.getElementById('replay-btn').addEventListener('click', () => location.reload());

// ---------- chamber flow ----------

function nearPedestal() {
    if (state.chamber >= CHAMBERS.length) return false;
    const pos = world.pedestalPosition(state.chamber);
    return player.position.distanceTo(pos) < 5.0;
}

function tryInteract() {
    if (state.stage !== 'explore' || !nearPedestal()) return;
    const idx = state.chamber;
    if (state.introducedChamber < idx) {
        state.introducedChamber = idx;
        state.stage = 'dialogue';
        dialogue.say(CHAMBERS[idx].intro, () => {
            state.stage = 'puzzle';
            puzzleUI.open(idx, CHAMBERS[idx], (puzzle) => onChamberSolved(idx, puzzle));
        });
    } else {
        state.stage = 'puzzle';
        puzzleUI.open(idx, CHAMBERS[idx], (puzzle) => onChamberSolved(idx, puzzle));
    }
}

function onChamberSolved(idx, puzzle) {
    state.solved[idx] = true;
    state.totalSteps += puzzle.steps.length;
    state.stage = 'dialogue';
    litGems(idx + 1);

    const islandIndex = idx + 1;
    world.solvePedestal(idx);
    world.restoreIsland(islandIndex);

    const isFinale = idx === CHAMBERS.length - 1;
    if (isFinale) {
        world.igniteHeart();
        audio.sfxFinale();
        dialogue.say([CHAMBERS[idx].success, 'Look — the Heart! The whole isle is waking up. You truly are the Balance Keeper now.'], () => {
            endGame();
        });
        return;
    }

    audio.sfxBridge();
    world.growBridge(islandIndex);
    state.chamber = idx + 1;
    dialogue.say([CHAMBERS[idx].success, 'The way is open — onward!'], () => {
        state.stage = 'explore';
        setObjective(CHAMBERS[state.chamber].objective);
    });
}

function endGame() {
    state.stage = 'end';
    const minutes = Math.max(1, Math.round((performance.now() - state.startTime) / 60000));
    const hints = totalHints();
    endStats.innerHTML = `You restored <strong>7 mechanisms</strong> in about <strong>${minutes} minute${minutes === 1 ? '' : 's'}</strong>, `
        + `using <strong>${state.totalSteps} balanced moves</strong> and <strong>${hints} hint${hints === 1 ? '' : 's'}</strong> from Axiom.`;
    setTimeout(() => {
        hud.classList.add('hidden');
        endScreen.classList.remove('hidden');
    }, 1400);
}

function totalHints() {
    let n = 0;
    puzzleUI.puzzles.forEach(p => { n += p.hintsUsed; });
    return n;
}

// puzzle closed without solving → back to exploring
const puzzleModal = document.getElementById('puzzle-modal');
const observer = new MutationObserver(() => {
    if (state.stage === 'puzzle' && puzzleModal.classList.contains('hidden')
        && document.getElementById('ferry-modal').classList.contains('hidden')) {
        if (!state.solved[state.chamber]) {
            state.stage = 'explore';
        }
    }
});
observer.observe(puzzleModal, { attributes: true, attributeFilter: ['class'] });

// ---------- input ----------

window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'e') tryInteract();
});
interactPrompt.addEventListener('click', tryInteract);

// ---------- main loop ----------

// handle for automated playtesting; not used by the game itself
window.__balanceKeeper = { state, player, world };

const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);

    const frozen = state.stage !== 'explore';
    player.update(dt, world, frozen);
    world.update(dt);

    const showPrompt = state.stage === 'explore' && nearPedestal();
    interactPrompt.classList.toggle('hidden', !showPrompt);

    renderer.render(scene, camera);
}

animate();
