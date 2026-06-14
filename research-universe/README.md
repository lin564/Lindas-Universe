# Research Universe — 3D Galaxy Knowledge Graph

Describe a study area and your hypotheses; explore them as a galaxy. The core
star is your study area, spiral arms are your hypotheses, and the points of
light in orbit are sub-hypotheses, datasets, papers, and organizations.

Visual encoding:

- **distance from the core** = relevance to the study area
- **size of the light** = information content (data volume, influence, scope)
- **glow** = current research interest — hot areas blaze and shimmer fast,
  quiet ones barely breathe
- **color** = node type

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

## Pulling real data from NASA's DAACs

Select any node (a hypothesis, the core, a sub-hypothesis, or an existing
dataset) and click **🛰 Find NASA DAAC datasets**. The app queries NASA's
[CMR](https://cmr.earthdata.nasa.gov) — the public catalog that indexes every
DAAC's collections — using the node's label and tags, and drops the best
matches into the universe as new dataset stars:

- **relevance (distance)** — placed near the node they were attached to, easing
  outward by match rank
- **size (information)** — temporal coverage of the record (longer / ongoing =
  bigger)
- **glow (interest)** — community-usage rank (CMR `sort_key=-usage_score`)

Each star is tagged with its DAAC (PO.DAAC, GES DISC, NSIDC DAAC, LP DAAC, …)
and links to the collection in Earthdata Search (or its DOI). Collection search
needs no key and runs entirely in your browser — nothing is proxied. Results
merge into the current universe, so they export and persist like any other node.

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
    "size": 0.6,                 // 0-1 → size of the light (data volume / influence / scope)
    "interest": 0.8,             // 0-1 → glow: current research attention/momentum
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
