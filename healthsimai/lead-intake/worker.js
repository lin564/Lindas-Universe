/**
 * HealthSimAI — lead-intake + document-management Worker
 *
 * Routes:
 *   POST /                          Lead intake (contact form + gated downloads)
 *   GET  /doc/:slug                 Download a document (streams from R2)
 *
 *   GET  /admin/documents           List documents          [admin]
 *   POST /admin/documents           Upload a document       [admin]
 *   DELETE /admin/documents/:slug   Deactivate a document   [admin]
 *   PUT    /admin/documents/:slug   Reactivate a document   [admin]
 *
 *   GET  /admin/users               List admin users        [admin]
 *   POST /admin/users               Create admin user       [admin]
 *   DELETE /admin/users/:id         Deactivate user         [admin]
 *   PUT    /admin/users/:id         Reactivate user         [admin]
 *
 * Auth: Bearer token checked against env.ADMIN_TOKEN (master) or
 *       SHA-256 hash in admin_users table.
 *
 * Secrets (npx wrangler secret put <NAME> --name healthsimai-lead-intake):
 *   ADMIN_TOKEN    — master bootstrap token (always works)
 *   RIKOH_TOKEN    — Ri Koh CRM auth
 *   RESEND_API_KEY — email delivery via resend.com
 */

const FREE_EMAIL = /@(gmail|yahoo|outlook|hotmail|live|icloud|aol|proton(mail)?|gmx|mail)\./i;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status, headers: { 'Content-Type': 'application/json', ...CORS }
  });
}

async function hashToken(token) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function requireAdmin(request, env) {
  const auth = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!auth) return false;
  // Master bootstrap token
  if (env.ADMIN_TOKEN && auth === env.ADMIN_TOKEN) return true;
  // Named user token — check hashed value in D1
  const hash = await hashToken(auth);
  const row = await env.LEADS_DB.prepare(
    `SELECT id FROM admin_users WHERE token_hash = ? AND active = 1`
  ).bind(hash).first();
  return !!row;
}

// ── Lead scoring (mirrors client-side in script.js) ───────────────────────────

function scoreLead(d) {
  let s = 0;
  const email = (d.email || '').trim();
  if (email && !FREE_EMAIL.test(email)) s += 40;
  if ((d.organization || '').trim()) s += 20;
  const role = (d.role || '').toLowerCase();
  if (/chief|c[-\s]?level|\bceo\b|\bcio\b|\bcfo\b|\bcmo\b|\bcoo\b|president|vp|vice president|head of|director|officer|administrator/.test(role)) s += 25;
  else if (/manager|lead|principal/.test(role)) s += 10;
  if ((d.interest || '').trim()) s += 10;
  s += Math.min((parseInt(d.downloads_count, 10) || 0) * 5, 20);
  const tier = s >= 70 ? 'hot' : s >= 40 ? 'warm' : 'cold';
  return { score: s, tier };
}

// ── Email via Resend ──────────────────────────────────────────────────────────

async function sendResourceEmail(env, toEmail, toName, slug, displayName) {
  if (!env.RESEND_API_KEY) return false;
  const downloadUrl = `https://healthsimai-lead-intake.ultisim.workers.dev/doc/${slug}`;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.EMAIL_FROM || 'HealthSimAI <info@healthsimai.com>',
      to: [toEmail],
      subject: `Your HealthSimAI resource: ${displayName}`,
      html: `<p>Hi ${toName || 'there'},</p>
<p>Thanks for your interest in HealthSimAI. Here is the resource you requested:</p>
<p style="margin:24px 0">
  <a href="${downloadUrl}"
     style="background:#0d4f8c;color:#fff;padding:12px 28px;text-decoration:none;border-radius:4px;font-weight:600;">
    Download ${displayName}
  </a>
</p>
<p>Questions? Reach us at <a href="mailto:info@healthsimai.com">info@healthsimai.com</a>.</p>
<p style="color:#666;font-size:13px">— The HealthSimAI Team</p>`
    })
  });
  return res.ok;
}

// ── Lead intake ───────────────────────────────────────────────────────────────

async function handleLead(request, env) {
  let d;
  try { d = await request.json(); } catch { return json({ error: 'bad json' }, 400); }
  if (!d.email || !/.+@.+\..+/.test(d.email)) return json({ error: 'valid email required' }, 400);

  const { score, tier } = scoreLead(d);
  const domain = (d.email.split('@')[1] || '').toLowerCase();
  const country = request.headers.get('cf-ipcountry') || '';

  const res = await env.LEADS_DB.prepare(
    `INSERT INTO leads (name,email,email_domain,organization,role,interest,message,
       source,asset_requested,downloads_count,qualification_score,qualification_tier,user_agent,ip_country)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(
    d.name || null, d.email, domain, d.organization || null, d.role || null,
    d.interest || null, d.message || null, d.source || 'contact', d.asset || null,
    parseInt(d.downloads_count, 10) || 0, score, tier, d.user_agent || null, country
  ).run();

  const leadId = res.meta.last_row_id;
  await env.LEADS_DB.prepare(
    `INSERT INTO lead_events (lead_id,event_type,detail) VALUES (?,?,?)`
  ).bind(leadId, d.source || 'form', d.asset || d.interest || '').run();

  if (env.RIKOH_ENDPOINT && env.RIKOH_TOKEN) {
    try {
      await fetch(env.RIKOH_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.RIKOH_TOKEN}` },
        body: JSON.stringify({ pipeline: 'healthsimai', lead_id: leadId, score, tier, ...d })
      });
      await env.LEADS_DB.prepare(`UPDATE leads SET synced_to_rikoh = 1 WHERE id = ?`).bind(leadId).run();
    } catch { /* retry job */ }
  }

  let emailed = false;
  if (d.source === 'download' && d.asset && env.DOCS) {
    const doc = await env.LEADS_DB.prepare(
      `SELECT slug, display_name FROM documents WHERE slug = ? AND active = 1`
    ).bind(d.asset).first();
    if (doc) emailed = await sendResourceEmail(env, d.email, d.name, doc.slug, doc.display_name);
  }

  return json({ ok: true, lead_id: leadId, tier, emailed });
}

// ── Document serving ──────────────────────────────────────────────────────────

async function handleServeDoc(slug, env) {
  const doc = await env.LEADS_DB.prepare(
    `SELECT * FROM documents WHERE slug = ? AND active = 1`
  ).bind(slug).first();
  if (!doc) return json({ error: 'not found' }, 404);
  if (!env.DOCS) return json({ error: 'storage not configured' }, 503);

  const object = await env.DOCS.get(doc.r2_key);
  if (!object) return json({ error: 'file not in storage' }, 404);

  await env.LEADS_DB.prepare(
    `UPDATE documents SET download_count = download_count + 1 WHERE slug = ?`
  ).bind(slug).run();

  const ext = doc.r2_key.split('.').pop() || 'pdf';
  return new Response(object.body, {
    headers: {
      'Content-Type': doc.mime_type || 'application/pdf',
      'Content-Disposition': `attachment; filename="${doc.slug}.${ext}"`,
      'Cache-Control': 'no-store',
      ...CORS
    }
  });
}

// ── Admin: documents ──────────────────────────────────────────────────────────

async function handleListDocs(env) {
  const { results } = await env.LEADS_DB.prepare(
    `SELECT id, slug, display_name, description, mime_type, active, created_at, download_count
     FROM documents ORDER BY created_at DESC`
  ).all();
  return json({ documents: results || [] });
}

async function handleUploadDoc(request, env) {
  if (!env.DOCS) return json({ error: 'R2 not bound — deploy with updated wrangler.jsonc' }, 503);

  let form;
  try { form = await request.formData(); } catch { return json({ error: 'expected multipart/form-data' }, 400); }

  const file        = form.get('file');
  const displayName = (form.get('display_name') || '').trim();
  let   slug        = (form.get('slug') || '').trim().toLowerCase().replace(/\s+/g, '-');
  const description = (form.get('description') || '').trim();

  if (!file || !file.size) return json({ error: 'file is required' }, 400);
  if (!displayName)         return json({ error: 'display_name is required' }, 400);
  if (!slug) slug = displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (!/^[a-z0-9-]+$/.test(slug)) return json({ error: 'slug: lowercase letters, numbers, hyphens only' }, 400);

  const ext      = (file.name || 'document.pdf').split('.').pop().toLowerCase();
  const r2Key    = `docs/${slug}.${ext}`;
  const mimeType = file.type || 'application/pdf';

  await env.DOCS.put(r2Key, await file.arrayBuffer(), { httpMetadata: { contentType: mimeType } });

  await env.LEADS_DB.prepare(
    `INSERT INTO documents (slug, display_name, r2_key, mime_type, description) VALUES (?,?,?,?,?)
     ON CONFLICT(slug) DO UPDATE SET
       display_name = excluded.display_name,
       r2_key       = excluded.r2_key,
       mime_type    = excluded.mime_type,
       description  = excluded.description,
       active       = 1`
  ).bind(slug, displayName, r2Key, mimeType, description || null).run();

  return json({ ok: true, slug, r2_key: r2Key, display_name: displayName });
}

async function handleToggleDoc(slug, active, env) {
  await env.LEADS_DB.prepare(`UPDATE documents SET active = ? WHERE slug = ?`).bind(active, slug).run();
  return json({ ok: true, slug, active: Boolean(active) });
}

// ── Admin: users ──────────────────────────────────────────────────────────────

async function handleListUsers(env) {
  const { results } = await env.LEADS_DB.prepare(
    `SELECT id, name, email, active, created_at FROM admin_users ORDER BY created_at ASC`
  ).all();
  return json({ users: results || [] });
}

async function handleCreateUser(request, env) {
  let body;
  try { body = await request.json(); } catch { return json({ error: 'bad json' }, 400); }

  const name  = (body.name  || '').trim();
  const email = (body.email || '').trim().toLowerCase();

  if (!name)                              return json({ error: 'name is required' }, 400);
  if (!email || !/.+@.+\..+/.test(email)) return json({ error: 'valid email required' }, 400);

  const token = generateToken();
  const hash  = await hashToken(token);

  try {
    await env.LEADS_DB.prepare(
      `INSERT INTO admin_users (name, email, token_hash) VALUES (?, ?, ?)`
    ).bind(name, email, hash).run();
  } catch (e) {
    if (String(e).includes('UNIQUE')) return json({ error: 'email already exists' }, 409);
    throw e;
  }

  return json({ ok: true, name, email, token });
}

async function handleToggleUser(id, active, env) {
  await env.LEADS_DB.prepare(`UPDATE admin_users SET active = ? WHERE id = ?`).bind(active, id).run();
  return json({ ok: true, id, active: Boolean(active) });
}

// ── Router ────────────────────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    const path   = new URL(request.url).pathname.replace(/\/$/, '') || '/';
    const method = request.method;

    if (path.startsWith('/doc/') && method === 'GET') {
      return handleServeDoc(path.slice(5), env);
    }

    if (path.startsWith('/admin/')) {
      if (!await requireAdmin(request, env)) return json({ error: 'unauthorized' }, 401);

      // Documents
      if (path === '/admin/documents') {
        if (method === 'GET')  return handleListDocs(env);
        if (method === 'POST') return handleUploadDoc(request, env);
      }
      const docMatch = path.match(/^\/admin\/documents\/([^/]+)$/);
      if (docMatch) {
        if (method === 'DELETE') return handleToggleDoc(docMatch[1], 0, env);
        if (method === 'PUT')    return handleToggleDoc(docMatch[1], 1, env);
      }

      // Users
      if (path === '/admin/users') {
        if (method === 'GET')  return handleListUsers(env);
        if (method === 'POST') return handleCreateUser(request, env);
      }
      const userMatch = path.match(/^\/admin\/users\/(\d+)$/);
      if (userMatch) {
        if (method === 'DELETE') return handleToggleUser(parseInt(userMatch[1]), 0, env);
        if (method === 'PUT')    return handleToggleUser(parseInt(userMatch[1]), 1, env);
      }

      return json({ error: 'not found' }, 404);
    }

    if (method === 'POST') return handleLead(request, env);
    return json({ error: 'not found' }, 404);
  }
};
