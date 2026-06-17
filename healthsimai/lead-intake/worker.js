/**
 * HealthSimAI — lead-intake Worker
 *
 * Receives lead submissions from the website (contact form + gated downloads),
 * scores them for qualification, stores them in the `healthsimai-leads` D1
 * database (the "HealthSimAI pipeline" leads store), and optionally forwards
 * them to Ri Koh's CRM and emails the requested resource.
 *
 * Deploy: see README.md.  Nothing here runs until you deploy it and point the
 * site's LEAD_ENDPOINT (public/script.js) at this Worker's URL.
 */

const FREE_EMAIL = /@(gmail|yahoo|outlook|hotmail|live|icloud|aol|proton(mail)?|gmx|mail)\./i;
const CORS = {
  'Access-Control-Allow-Origin': '*',          // tighten to https://healthsimai.com in prod
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

function scoreLead(d) {
  let s = 0;
  const email = (d.email || '').trim();
  if (email && !FREE_EMAIL.test(email)) s += 40;            // work email
  if ((d.organization || '').trim()) s += 20;
  const role = (d.role || '').toLowerCase();
  if (/chief|c[-\s]?level|\bceo\b|\bcio\b|\bcfo\b|\bcmo\b|\bcoo\b|president|vp|vice president|head of|director|officer|administrator/.test(role)) s += 25;
  else if (/manager|lead|principal/.test(role)) s += 10;
  if ((d.interest || '').trim()) s += 10;
  s += Math.min((parseInt(d.downloads_count, 10) || 0) * 5, 20);
  const tier = s >= 70 ? 'hot' : s >= 40 ? 'warm' : 'cold';
  return { score: s, tier };
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (request.method !== 'POST') return json({ error: 'POST only' }, 405);

    let d;
    try { d = await request.json(); } catch { return json({ error: 'bad json' }, 400); }
    if (!d.email || !/.+@.+\..+/.test(d.email)) return json({ error: 'valid email required' }, 400);

    const { score, tier } = scoreLead(d);
    const domain = (d.email.split('@')[1] || '').toLowerCase();
    const country = request.headers.get('cf-ipcountry') || '';

    // 1) Store in the HealthSimAI pipeline (D1)
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

    // 2) Forward to Ri Koh CRM (only if configured)
    if (env.RIKOH_ENDPOINT && env.RIKOH_TOKEN) {
      try {
        await fetch(env.RIKOH_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.RIKOH_TOKEN}` },
          body: JSON.stringify({ pipeline: 'healthsimai', lead_id: leadId, score, tier, ...d })
        });
        await env.LEADS_DB.prepare(`UPDATE leads SET synced_to_rikoh = 1 WHERE id = ?`).bind(leadId).run();
      } catch (e) { /* leave synced_to_rikoh = 0 for a retry job */ }
    }

    // 3) Email the requested resource (gated download). Docs live in R2 (env.DOCS).
    //    Wire an email provider (MailChannels / Resend / SES) here and send a
    //    short-lived signed link to env.DOCS.get(<asset>). Stubbed for now.
    let emailed = false;
    if (d.source === 'download' && d.asset && env.EMAIL_FROM) {
      // emailed = await sendResourceEmail(env, d.email, d.asset);
    }

    return json({ ok: true, lead_id: leadId, tier, emailed });
  }
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status, headers: { 'Content-Type': 'application/json', ...CORS }
  });
}
