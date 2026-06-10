# The Balance Keeper

*A QuestSim algebra adventure — vertical slice*

A 3D, browser-based learning game that teaches solving **linear equations and
inequalities** (Algebra 1 / grades 7–9) through a fantasy quest where the math
literally is the world's machinery.

**Play it:** open `index.html` from any static web server (or GitHub Pages at
`/games/balance-keeper/`). No installs, no accounts, no downloads — it runs on
Chromebooks in the browser. Three.js is vendored locally so it works behind
school firewalls that block CDNs.

---

## The premise

The Isle of Equilibria is a chain of floating islands held aloft by the Great
Balance — and it is failing. The student is the new apprentice Keeper. Every
mechanism on the isle is a giant balance scale governed by one law:

> **Whatever you do to one side, you must do to the other.**

Restoring each mechanism (solving its equation) relights the island and grows
the bridge to the next one, ending at the Heart of Equilibria.

## How the math works

Students don't type answers — they **manipulate the equation directly**,
algebra-tiles style:

- **x-crystals** (teal diamonds) are x-terms; **void-crystals** (violet) are −x
- **stones** (amber) are +1 units; **void-stones** (dark) are −1
- Every palette action applies to **both pans at once** — it is impossible to
  make an unbalanced move, which is the point
- **+1 / −1 / +x / −x** add a token to both sides; zero pairs cancel with a
  chime ("zero takes no room on the pan")
- **÷2 … ÷5** split both sides into equal groups — and the crystals *resist*
  if either side won't divide evenly
- A live symbolic readout (e.g. `2x + 3 = 11`) updates with every move,
  connecting the concrete tiles to abstract notation, plus a step log

**Mistakes never punish.** No lives, no points lost: the world simply reacts
(pans groan when overloaded, crystals resist uneven splits, the ferry dips
under a too-heavy stone) and the student retries freely. Axiom, the Keeper's
wisp, gives **state-aware hints on demand** — the hint engine reads the
student's current board, not the original problem, so it always addresses
where they actually are.

## The seven mechanisms (teaching sequence)

| # | Mechanism | Equation | Concept |
|---|-----------|----------|---------|
| 1 | Gate of First Steps | x + 3 = 7 | One-step: subtract from both sides |
| 2 | Splitting Stones | 3x = 12 | One-step: divide both sides |
| 3 | Twin-Lock Door | 2x + 3 = 11 | Two-step equations |
| 4 | Void Lantern | 4x − 2 = 10 | Negative constants, zero pairs |
| 5 | Mirror Bridge | 5x + 2 = 2x + 14 | Variables on both sides |
| 6 | The Floodgate | x + 4 ≤ 10 | Inequalities — then the **Ferryman's Test**: pick every stone satisfying x ≤ 6 (solution as a *set*, boundary value included) |
| 7 | Heart of Equilibria | 3x − 4 = x + 6 | Synthesis of all skills |

**Playtime:** ~15–25 minutes, designed for a single class sitting after a
mini-lesson, with the end screen reporting moves, hints used, and time — good
fodder for a closing discussion.

## Standards alignment

- **CCSS 7.EE.B.4a** — solve word problems leading to px + q = r
- **CCSS 7.EE.B.4b** — solve inequalities of the form px + q > r, graph/interpret the solution set
- **CCSS 8.EE.C.7b** — solve linear equations with rational coefficients, including terms on both sides
- **CCSS HSA-REI.A.1** — *explain each step in solving an equation* (the balance metaphor makes every step a justified, reversible move)
- **CCSS HSA-REI.B.3** — solve linear equations and inequalities in one variable

## Controls & accessibility

- **Move:** WASD or arrow keys · **Interact:** E or click the prompt
- All puzzle interaction is click/tap only (trackpad-friendly); no mouse-look
- Tiles are distinguished by **shape and label**, not color alone
- Sound is procedural (WebAudio chimes) and mutable; no audio is required to play
- Walking away from a puzzle saves its state; there is no fail state

## Tech

- **Three.js r160** (vendored, MIT — see `vendor/THREE-LICENSE.md`), vanilla ES modules, no build step
- All geometry procedural (low-poly flat-shaded) — total payload ≈ 700 KB, renders well on Chromebooks
- Equation engine (`js/equation.js`) is pure logic, unit-testable in Node

## Roadmap ideas (beyond the slice)

- Multiplying both sides; dividing/multiplying inequalities by negatives (the "balances that tip and flip" teased in the ending)
- Distributive property as "unpacking crystal clusters"
- Progress save (localStorage) and a teacher dashboard with per-step misconception data — the engine already logs every move
- Adaptive difficulty: extra practice pedestals appear when a student leans on hints
- Paired "navigator/solver" mode for shared devices
