// NASA DAAC integration via CMR (Common Metadata Repository).
//
// CMR — https://cmr.earthdata.nasa.gov — is the single public catalog that
// indexes every NASA DAAC's data collections. Collection search needs no auth
// and is CORS-enabled, so we query it straight from the browser and turn the
// matching collections into dataset nodes in the universe.
//
// Encoding choices for the new stars:
//   relevance (distance) — near the node they were attached to, easing out by rank
//   size (information)    — temporal coverage of the record (longer / ongoing = bigger)
//   interest (glow)       — community-usage rank (CMR sort=-usage_score)

const CMR_URL = 'https://cmr.earthdata.nasa.gov/search/collections.json';

// CMR data_center / archive_center short names -> friendly DAAC labels.
const DAACS = {
    PODAAC: 'PO.DAAC', POCLOUD: 'PO.DAAC', OBPG: 'OB.DAAC', OB_DAAC: 'OB.DAAC', 'OB.DAAC': 'OB.DAAC',
    GES_DISC: 'GES DISC', GESDISC: 'GES DISC',
    LPDAAC_ECS: 'LP DAAC', LPCLOUD: 'LP DAAC',
    NSIDC_ECS: 'NSIDC DAAC', NSIDCV0: 'NSIDC DAAC', NSIDC_CPRD: 'NSIDC DAAC', NSIDC_ECS_CPRD: 'NSIDC DAAC',
    ORNL_DAAC: 'ORNL DAAC', ORNL_CLOUD: 'ORNL DAAC',
    LAADS: 'LAADS DAAC',
    GHRC_DAAC: 'GHRC DAAC', GHRC_CLOUD: 'GHRC DAAC', GHRC: 'GHRC DAAC',
    ASF: 'ASF DAAC',
    SEDAC: 'SEDAC',
    LARC_ASDC: 'ASDC', ASDC: 'ASDC', LARC: 'ASDC',
    CDDIS: 'CDDIS',
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Figure out which DAAC a collection belongs to (or null if it's not a DAAC).
function daacOf(entry) {
    const candidates = [entry.data_center, entry.archive_center, ...(entry.organizations ?? [])];
    for (const c of candidates) {
        if (!c) continue;
        if (DAACS[c]) return DAACS[c];
        const token = String(c).toUpperCase().replace(/[^A-Z]/g, '');
        for (const [key, name] of Object.entries(DAACS)) {
            if (token.includes(key.replace(/[^A-Z]/g, ''))) return name;
        }
        if (/DAAC/i.test(c)) return c.replace(/^NASA\//, '');
    }
    return null;
}

function landingUrl(entry) {
    const links = entry.links ?? [];
    const doi = links.find(l => /doi\.org/.test(l.href ?? ''));
    if (doi) return doi.href;
    // Earthdata Search opens the exact collection and is always reachable.
    return `https://search.earthdata.nasa.gov/search/granules?p=${encodeURIComponent(entry.id)}`;
}

function coverageText(entry) {
    const start = entry.time_start ? entry.time_start.slice(0, 4) : null;
    const end = entry.time_end ? entry.time_end.slice(0, 4) : (start ? 'present' : null);
    return start ? `${start}–${end}` : null;
}

// Longer (and ongoing) records carry more information -> bigger light.
function coverageSize(entry) {
    const start = Date.parse(entry.time_start);
    if (!start) return 0.5;
    const end = entry.time_end ? Date.parse(entry.time_end) : Date.now();
    const years = (end - start) / (365.25 * 24 * 3600 * 1000);
    let s = 0.35 + clamp(years / 50, 0, 1) * 0.5;
    if (!entry.time_end) s += 0.1; // ongoing mission
    return clamp(s, 0.25, 1);
}

function tidy(text, max = 280) {
    const s = (text ?? '').replace(/\s+/g, ' ').trim();
    return s.length > max ? s.slice(0, max - 1).trimEnd() + '…' : s;
}

// Build a CMR keyword query from the node and its universe context.
function queryFor(node, universe) {
    if (node.type === 'core') {
        return (universe.meta.title || node.label).replace(/\s*\(.*?\)\s*/g, ' ').trim();
    }
    const label = node.label.replace(/^[A-Za-z]+\d*[a-z]?:\s*/, ''); // strip "H1: "
    const tags = (node.tags ?? []).slice(0, 3).join(' ');
    return `${label} ${tags}`.trim();
}

// Search NASA's DAACs for collections relevant to `node` and return new
// dataset nodes (already scored and parented to the node).
export async function searchDAAC(node, universe, { limit = 6, signal } = {}) {
    const params = new URLSearchParams({
        keyword: queryFor(node, universe),
        page_size: '40',
        sort_key: '-usage_score', // most-used collections first -> drives glow
    });

    const ctrl = signal ? null : new AbortController();
    const timer = ctrl ? setTimeout(() => ctrl.abort(), 20000) : null;
    let res;
    try {
        res = await fetch(`${CMR_URL}?${params}`, { signal: signal ?? ctrl.signal });
    } catch (err) {
        throw new Error(err.name === 'AbortError' ? 'NASA CMR request timed out.' : `Could not reach NASA CMR: ${err.message}`);
    } finally {
        if (timer) clearTimeout(timer);
    }
    if (!res.ok) throw new Error(`NASA CMR returned HTTP ${res.status}.`);

    const data = await res.json();
    const entries = data?.feed?.entry ?? [];

    const existingIds = new Set(universe.nodes.map(n => n.id));
    const existingUrls = new Set(universe.nodes.map(n => n.url).filter(Boolean));
    const parentRel = node.relevance ?? 0.7;

    const out = [];
    for (const entry of entries) {
        if (out.length >= limit) break;
        const daac = daacOf(entry);
        if (!daac) continue; // keep it to genuine NASA DAAC collections

        const id = 'nasa-' + String(entry.id).toLowerCase();
        const url = landingUrl(entry);
        if (existingIds.has(id) || existingUrls.has(url)) continue;
        existingIds.add(id);
        existingUrls.add(url);

        const rank = out.length;
        const coverage = coverageText(entry);
        out.push({
            id,
            label: tidy(entry.dataset_id || entry.title || entry.short_name, 80),
            type: 'dataset',
            summary: (coverage ? `Coverage ${coverage}. ` : '') + tidy(entry.summary),
            url,
            relevance: clamp(parentRel - 0.05 - rank * 0.025, 0.3, 0.95),
            size: coverageSize(entry),
            interest: clamp(0.85 - rank * 0.07, 0.3, 0.95),
            parent: node.id,
            tags: [daac, 'NASA DAAC', ...(entry.short_name ? [entry.short_name] : [])],
        });
    }

    if (!out.length) {
        throw new Error('No NASA DAAC collections matched this node.');
    }
    return out;
}
