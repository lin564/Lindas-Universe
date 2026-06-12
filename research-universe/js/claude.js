// Claude integration: turn a free-text study-area description into a universe
// document, and expand any node into sub-hypotheses + data sources.
//
// Calls run directly from the browser with the user's own API key via the
// official SDK (dangerouslyAllowBrowser). The SDK is loaded lazily from a CDN
// so the rest of the app works fully offline / keyless.

const SDK_URL = 'https://esm.sh/@anthropic-ai/sdk@0.65.0';
const KEY_STORAGE = 'research-universe.anthropic-key';
const MODEL_STORAGE = 'research-universe.model';

export function getApiKey() { return localStorage.getItem(KEY_STORAGE) ?? ''; }
export function setApiKey(key) {
    if (key) localStorage.setItem(KEY_STORAGE, key);
    else localStorage.removeItem(KEY_STORAGE);
}
export function getModel() { return localStorage.getItem(MODEL_STORAGE) ?? 'claude-opus-4-8'; }
export function setModel(model) { localStorage.setItem(MODEL_STORAGE, model); }

let clientPromise = null;
async function getClient() {
    const key = getApiKey();
    if (!key) throw new Error('No API key set. Open “API settings…” in the ⋯ menu, or use “Copy prompt instead”.');
    if (!clientPromise) {
        clientPromise = import(SDK_URL).then(m => m.default);
    }
    const Anthropic = await clientPromise;
    return new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true });
}

// ---------------------------------------------------------------------------
// Universe JSON schema (structured outputs)
// ---------------------------------------------------------------------------

const NODE_SCHEMA = {
    type: 'object',
    properties: {
        id: { type: 'string', description: 'Short unique slug, e.g. "h1", "d-era5"' },
        label: { type: 'string', description: 'Display name, <= 70 chars' },
        type: { type: 'string', enum: ['core', 'hypothesis', 'subhypothesis', 'dataset', 'paper', 'organization', 'concept'] },
        summary: { type: 'string', description: '1-3 sentences: what it is and why it matters to the study area' },
        url: { type: 'string', description: 'Real, stable URL (agency landing page, DOI, data portal). Empty string if none.' },
        relevance: { type: 'number', description: '0-1 relevance to the core study area. Controls distance from the galactic core.' },
        size: { type: 'number', description: '0-1. Datasets: data volume/coverage. Papers: influence. Hypotheses: scope. Controls the size of the light.' },
        interest: { type: 'number', description: '0-1 current research interest: publication/funding momentum, community attention, public salience. Controls how brightly the star glows and pulses.' },
        parent: { type: 'string', description: 'id of the parent node ("core" for top-level). Empty string for the core itself.' },
        status: { type: 'string', enum: ['supported', 'contested', 'untested'], description: 'For hypotheses only' },
        tags: { type: 'array', items: { type: 'string' } },
    },
    required: ['id', 'label', 'type', 'summary', 'relevance', 'size', 'interest', 'parent'],
    additionalProperties: false,
};

const LINK_SCHEMA = {
    type: 'object',
    properties: {
        source: { type: 'string' },
        target: { type: 'string' },
        relation: { type: 'string', description: 'Short phrase, e.g. "computed from", "operated by"' },
    },
    required: ['source', 'target', 'relation'],
    additionalProperties: false,
};

const UNIVERSE_SCHEMA = {
    type: 'object',
    properties: {
        meta: {
            type: 'object',
            properties: {
                title: { type: 'string' },
                subtitle: { type: 'string' },
                description: { type: 'string', description: 'A paragraph introducing the study area and how this universe is organized' },
            },
            required: ['title', 'subtitle', 'description'],
            additionalProperties: false,
        },
        nodes: { type: 'array', items: NODE_SCHEMA },
        links: { type: 'array', items: LINK_SCHEMA },
    },
    required: ['meta', 'nodes', 'links'],
    additionalProperties: false,
};

const EXPANSION_SCHEMA = {
    type: 'object',
    properties: {
        nodes: { type: 'array', items: NODE_SCHEMA },
        links: { type: 'array', items: LINK_SCHEMA },
    },
    required: ['nodes', 'links'],
    additionalProperties: false,
};

const SYSTEM_PROMPT = `You are a research cartographer. You turn a researcher's description of their study area into a "research universe": a knowledge graph rendered as a 3D galaxy.

Structure:
- Exactly one node of type "core" with id "core": the study area itself.
- 3-6 top-level "hypothesis" nodes (parent: "core"). Use the researcher's own hypotheses where given, sharpened into testable statements; add complementary ones they missed.
- Each hypothesis gets 2-3 "subhypothesis" children: narrower, testable claims that would support or undermine it.
- 8-16 "dataset", "paper", and "organization" nodes attached to whichever hypothesis they bear on most (or to "core" for field-wide resources like indices and review papers).
- "links" holds cross-connections beyond the parent tree (an index computed from a dataset, two sub-hypotheses sharing a mechanism), with a short relation phrase.

Scoring (these drive the rendering — score them thoughtfully and use the full range):
- relevance (0.3-1.0): how central the node is to the core question. Distance from the galactic core.
- size (0.2-1.0): datasets by data volume and coverage; papers by influence; hypotheses by scope. The size of the light.
- interest (0.1-1.0): how much research attention the area has right now — publication and funding momentum, conference buzz, public salience. The glow: hot areas blaze and shimmer, quiet backwaters barely flicker. A foundational 1990s theory paper may be high-size but low-interest; a contested new ML approach may be the reverse.

Data sources are the point of this tool. Prefer authoritative, long-lived sources: national agencies (NOAA, NASA, ECMWF, USGS...), data portals (Copernicus, ESGF, ICPSR...), DOI links for papers. URLs must be real and likely to resolve — if you are not confident in a deep link, use the organization's main domain or a well-known landing page instead. Never invent plausible-looking URLs.

Write summaries for a smart colleague from a neighboring field: concrete, specific, no filler.`;

function extractJson(message) {
    if (message.stop_reason === 'refusal') {
        throw new Error('Claude declined this request' + (message.stop_details?.explanation ? `: ${message.stop_details.explanation}` : '.'));
    }
    const text = message.content.find(b => b.type === 'text')?.text;
    if (!text) throw new Error('Empty response from the API.');
    return JSON.parse(text);
}

async function runStructured({ system, prompt, schema, maxTokens, onStatus }) {
    const client = await getClient();
    const stream = client.messages.stream({
        model: getModel(),
        max_tokens: maxTokens,
        system,
        thinking: { type: 'adaptive' },
        output_config: { format: { type: 'json_schema', schema } },
        messages: [{ role: 'user', content: prompt }],
    });
    let chars = 0;
    stream.on('text', delta => {
        chars += delta.length;
        onStatus?.(`Building… ${(chars / 1000).toFixed(1)}k characters`);
    });
    return extractJson(await stream.finalMessage());
}

export async function generateUniverse(description, onStatus) {
    onStatus?.('Asking Claude to chart the universe…');
    const universe = await runStructured({
        system: SYSTEM_PROMPT,
        prompt: `Build a research universe for the following study area. Today's date is ${new Date().toISOString().slice(0, 10)}.\n\n<study_area>\n${description}\n</study_area>`,
        schema: UNIVERSE_SCHEMA,
        maxTokens: 32000,
        onStatus,
    });
    universe.meta.created = new Date().toISOString().slice(0, 10);
    return universe;
}

export async function expandNode(universe, node, onStatus) {
    onStatus?.(`Generating sub-hypotheses for “${node.label}”…`);
    const existingIds = universe.nodes.map(n => n.id);
    const context = {
        study_area: universe.meta,
        node,
        ancestors: ancestorChain(universe, node),
        existing_ids: existingIds,
    };
    const result = await runStructured({
        system: SYSTEM_PROMPT,
        prompt: `Within the research universe described below, expand one node: generate 3-5 NEW child nodes for it — sub-hypotheses that sharpen or challenge it, plus the 1-3 most useful datasets or papers for testing them. Every new node's parent must be "${node.id}" (or a new sub-hypothesis id you introduce). New ids must not collide with existing_ids. Do not repeat existing nodes.\n\n${JSON.stringify(context, null, 2)}`,
        schema: EXPANSION_SCHEMA,
        maxTokens: 16000,
        onStatus,
    });
    // Merge, dropping anything that collides or dangles.
    const ids = new Set(existingIds);
    const added = result.nodes.filter(n => !ids.has(n.id) && n.type !== 'core');
    added.forEach(n => ids.add(n.id));
    added.forEach(n => { if (!ids.has(n.parent)) n.parent = node.id; });
    universe.nodes.push(...added);
    universe.links.push(...result.links.filter(l => ids.has(l.source) && ids.has(l.target)));
    return added.length;
}

function ancestorChain(universe, node) {
    const byId = new Map(universe.nodes.map(n => [n.id, n]));
    const chain = [];
    let cur = byId.get(node.parent);
    while (cur && chain.length < 10) {
        chain.push({ id: cur.id, label: cur.label, type: cur.type });
        cur = byId.get(cur.parent);
    }
    return chain;
}

// For users without an API key: a prompt to paste into claude.ai whose answer
// can be saved and imported via “Import universe JSON”.
export function buildCopyPrompt(description) {
    return `${SYSTEM_PROMPT}

Respond with ONLY a JSON document (no prose, no code fences) matching this JSON Schema:

${JSON.stringify(UNIVERSE_SCHEMA, null, 2)}

Build a research universe for the following study area:

${description}`;
}
