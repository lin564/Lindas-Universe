# Research Universe — 3D Galaxy Knowledge Graph

Describe a study area and your hypotheses; explore them as a galaxy. The core
star is your study area, spiral arms are your hypotheses, and the stars in
orbit are sub-hypotheses, datasets, papers, and organizations — positioned by
relevance (distance from the core), sized by data volume or influence, and
colored by type.

Ships with a fully curated **El Niño / ENSO** universe: 4 working hypotheses,
sub-hypotheses for each, and 12 real data sources (NOAA ONI, ERSSTv5, OISST,
TAO/TRITON, Argo, ERA5, ORAS5, CMIP6, IRI forecast plume, SOI, and key papers)
ranked by relevance and size, each linking to its live portal.

## Using it

Serve the repo root with any static server and open `research-universe/`:

```sh
cd Lindas-Universe
python3 -m http.server 8000
# → http://localhost:8000/research-universe/
```

(Opening `index.html` directly via `file://` won't work — ES modules and
`fetch` need HTTP.)

- **Drag** to orbit, **scroll** to zoom, **click** a star for details and its
  source link, **search** to spotlight matching nodes.
- **Data Sources** lists every dataset/paper/organization ranked by relevance,
  with relevance/size bars and direct links.
- **Import / Export** round-trips universes as JSON, and the current universe
  is kept in localStorage between visits.

## Generating your own universe

Two paths:

1. **With an Anthropic API key** (⋯ → API settings): click **+ New Universe**,
   describe your study area and hypotheses in plain prose, and Claude
   (Opus 4.8 by default) builds the whole graph via structured outputs —
   hypotheses, sub-hypotheses, ranked real data sources, and cross-links.
   Selecting any hypothesis then offers **Generate sub-hypotheses with
   Claude**, which grows that arm of the galaxy in place. The key lives only
   in your browser's localStorage and calls go directly to
   `api.anthropic.com` (the official SDK with `dangerouslyAllowBrowser`).
2. **Without a key**: **Copy prompt instead** puts a complete prompt (schema
   included) on your clipboard. Paste it into claude.ai, save the JSON reply
   to a file, and import it.

## Universe JSON format

```jsonc
{
  "meta": { "title", "subtitle", "description" },
  "nodes": [{
    "id": "h1",                  // unique slug
    "label": "…",
    "type": "core | hypothesis | subhypothesis | dataset | paper | organization | concept",
    "summary": "…",
    "url": "https://…",          // optional; real sources only
    "relevance": 0.9,            // 0-1 → distance from the galactic core
    "size": 0.6,                 // 0-1 → star size (data volume / influence / scope)
    "parent": "core",            // structural edge
    "status": "supported | contested | untested",  // hypotheses only
    "tags": ["…"]
  }],
  "links": [{ "source", "target", "relation" }]   // cross-links beyond the tree
}
```

Exactly one node has `type: "core"` and `id: "core"`. Layout is deterministic
per node id, so the same universe always renders the same galaxy.

## Stack

Plain ES modules, no build step. Three.js (vendored, same copy as
`games/balance-keeper`), `@anthropic-ai/sdk` loaded lazily from a CDN only
when a generation is requested.
