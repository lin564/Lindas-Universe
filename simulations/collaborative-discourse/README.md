# The Emergent Discussion

*An interactive simulation of collaborative discourse and argumentation, after Keith Sawyer's
"The Creative Classroom."*

**Run it:** open `index.html` from any static web server (or GitHub Pages at
`/simulations/collaborative-discourse/`). One self-contained file — no build step, no
dependencies, no data leaves the page. It also opens fine over `file://`.

---

## The idea it teaches

Sawyer's argument is that a real discussion is **collaboratively emergent**: the idea the group
ends with belongs to the group, and nobody — the teacher included — was carrying it at the start.
That makes facilitation a form of **disciplined improvisation**. You hold the frame and the
objective; you leave the path genuinely open. Too little structure and the talk wanders; too much
and there is nothing left to discover.

The page opens with the honeybee swarm as its anchoring analogy. Scout bees advertise candidate
nest sites by dancing them, other scouts fly out and inspect for themselves rather than taking the
dance on faith, and each scout winds her own dance down on every return so nothing survives on
repetition alone. No bee compares all the options and no bee is in charge, yet the colony chooses
well — because the decision is distributed across the argument. Every talk move in the simulation
is scored against that standard: does it send students out to look, or does it dance on their behalf?

## What you actually do

You facilitate a fourteen-turn eighth-grade discussion of a genuinely generative question: *an acorn
weighs a gram, the oak weighs two tons — where did the rest of it come from?* Four students with
different dispositions are on the floor. Each turn you pick one talk move, and the discourse reacts.

| Move | Construct | What it does |
|------|-----------|--------------|
| Wait, say nothing | wait time (Rowe) | Opens a gap the quiet student can enter on their own terms |
| "Do you agree with ___? Why?" | uptake | Routes students to each other instead of to you — the engine move |
| "What makes you think that?" | press for reasoning | Asks for the warrant; reads as an accusation in a cold room |
| "___, what do you think?" | equitable participation | The bluntest equity instrument, and the most reliable |
| "So you're saying…" | revoicing | Sharpens the idea, and makes you the hub it travels through |
| "We argue with the idea, not the person" | psychological safety | Keeps disagreement coded exploratory instead of disputational |
| van Helmont's willow | a constraint that opens | Real 1648 counter-evidence — useless before there are claims to test |
| "Sum up where we've got to" | consolidation | Turns the argument into something a student can carry out of the room |
| "Exactly right. Good job." | the I-R-E trap | Closes the sequence. It feels good and it costs you the discussion |
| Explain it yourself | direct instruction | Correct, fast, and the end of emergence |

## How the model works

- **Four meters** — uptake, reasoning, safety, participation — plus a **structure dial** with a
  generative band in the middle. Meters decay each turn, so nothing holds without being renewed.
- **Every beat is coded** in the transcript margin using Mercer's registers: `EX` exploratory,
  `CU` cumulative, `DI` disputational, `RE` recitation. The coding is derived from what the
  students actually said — whether a warrant was present, whether a challenge came with reasons.
- **Safety changes the register, not the volume.** Eli's challenge to the "air is nothing" claim
  has two forms carrying identical content. Below a safety threshold he says the dumb-idea version
  and the beat codes `DI`; above it he says the storm-and-fences version and it codes `EX`.
- **The idea map** grows as students put claims on the floor, each chip badged with whose it was.
  The synthesis chip appears only when several students' ideas are load-bearing at once — and if
  you deliver it yourself it still appears, badged `T`, and the debrief says so.
- **Utterances are selected, not scripted.** Each line has phase gates, preconditions, flags and
  weights; your move re-weights the pool. Runs differ, and a discussion can genuinely stall.

The ending distinguishes *the idea emerged* from *the idea arrived* — which is the whole point.

## Sources

R. Keith Sawyer, *The Creative Classroom: Innovative Teaching for 21st-Century Learners*
(Teachers College Press, 2019), and "Creative Teaching: Collaborative Discussion as Disciplined
Improvisation," *Educational Researcher* 33(2), 2004. Honeybee nest-site selection: Thomas D.
Seeley, *Honeybee Democracy* (Princeton, 2010). Talk registers: Neil Mercer, *The Guided
Construction of Knowledge* (1995). Revoicing and accountable talk: Michaels, O'Connor & Resnick
(1993–2008). The I-R-E sequence: Hugh Mehan, *Learning Lessons* (1979). Wait time: Mary Budd Rowe
(1974). The willow experiment: Jan Baptist van Helmont, published 1648.

## Accessibility

Keyboard-operable throughout with visible focus states; the transcript is an `aria-live` log;
discourse codes are carried by letter as well as colour; light and dark themes both defined at
token level; all motion respects `prefers-reduced-motion`.
