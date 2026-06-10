// The seven mechanisms of the isle, in teaching order:
// one-step (subtract), one-step (divide), two-step, two-step with negatives,
// variables on both sides, an inequality with a solution-set check, and a
// finale that combines everything.

export const CHAMBERS = [
    {
        name: 'The Gate of First Steps',
        flavor: 'Three loose stones crowd the crystal. Whatever leaves one pan must leave the other.',
        puzzle: { left: { x: 1, u: 3 }, right: { x: 0, u: 7 } },
        objective: 'Restore the Gate of First Steps.',
        intro: [
            'Here — the first mechanism. One x‑crystal, but stones crowd its pan.',
            'The law of the isle: <em>whatever you do to one side, you must do to the other.</em> Add −1 stones to both pans and watch the pairs cancel.',
        ],
        success: 'The gate remembers its weight! x was 4 all along.',
    },
    {
        name: 'The Splitting Stones',
        flavor: 'Three identical crystals share one pan. Equal crystals carry equal weight.',
        puzzle: { left: { x: 3, u: 0 }, right: { x: 0, u: 12 } },
        objective: 'Restore the Splitting Stones.',
        intro: [
            'Three crystals, perfectly alike. If three of them weigh 12, the pans can be split into three equal groups.',
            'Use the ÷ runes — but the stones only split when every pile divides evenly.',
        ],
        success: 'Split fair and square — each crystal weighs 4.',
    },
    {
        name: 'The Twin-Lock Door',
        flavor: 'Two crystals and three stones. This lock takes two turns of the key.',
        puzzle: { left: { x: 2, u: 3 }, right: { x: 0, u: 11 } },
        objective: 'Restore the Twin-Lock Door.',
        intro: [
            'A two‑step lock. The old Keeper always cleared the loose stones first, <em>then</em> split the crystals.',
        ],
        success: 'Two steps, one open door. x = 4.',
    },
    {
        name: 'The Void Lantern',
        flavor: 'Void-stones drag the pan down with negative weight. Light cancels shadow.',
        puzzle: { left: { x: 4, u: -2 }, right: { x: 0, u: 10 } },
        objective: 'Relight the Void Lantern.',
        intro: [
            'Careful — those dark tiles are <em>void‑stones</em>, weight below zero.',
            'A +1 stone and a void‑stone cancel to nothing. Feed both pans light until the shadows are gone.',
        ],
        success: 'Shadow and light cancel to nothing — the lantern burns again.',
    },
    {
        name: 'The Mirror Bridge',
        flavor: 'Crystals sit on BOTH pans, mirroring each other. Clear one side of x first.',
        puzzle: { left: { x: 5, u: 2 }, right: { x: 2, u: 14 } },
        objective: 'Restore the Mirror Bridge.',
        intro: [
            'This mechanism is strange — x‑crystals on <em>both</em> pans.',
            'Add −x to both sides until one pan holds no crystals at all. Then it is a lock you already know.',
        ],
        success: 'The mirror clears. Beneath the reflections, x = 4.',
    },
    {
        name: 'The Floodgate',
        flavor: 'The pans need not be equal here — the gate holds while the left stays UNDER the right.',
        puzzle: { left: { x: 1, u: 4 }, right: { x: 0, u: 10 }, rel: '≤' },
        objective: 'Tame the Floodgate and pass the Ferryman’s Test.',
        intro: [
            'Not every balance is equal. This gate holds as long as the left pan weighs <em>no more than</em> the right: x + 4 ≤ 10.',
            'Solve it the same way — the ≤ rune survives every move you make to both sides.',
        ],
        success: 'So any x of weight 6 or less is safe. The Ferryman will test you on it…',
        ferry: {
            stones: [3, 8, 6, 9, 2, 7, 5],
            limit: 6,
            inclusive: true,
        },
    },
    {
        name: 'The Heart of Equilibria',
        flavor: 'Every law you have learned, in a single mechanism.',
        puzzle: { left: { x: 3, u: -4 }, right: { x: 1, u: 6 } },
        objective: 'Restore the Heart of Equilibria.',
        intro: [
            'The Heart itself. Crystals on both pans, void‑stones in the shadows — everything the isle has taught you.',
            'Steady hands, Keeper. Both sides, always both sides.',
        ],
        success: 'The Heart beats! x = 5 — and the Great Balance is whole.',
    },
];
