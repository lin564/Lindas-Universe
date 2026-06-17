# HealthSimAI — Lead Intake & CRM Pipeline

This is the backend for website lead capture: the demo/contact form and the
gated resource downloads. It stores every lead in a Cloudflare D1 database
(the **HealthSimAI pipeline** leads store), scores how qualified each lead is,
and can forward leads into Ri Koh's CRM.

## Status

- ✅ **Leads store created** — D1 database `healthsimai-leads`
  (`049281a1-15ca-4845-a4d9-0f53dbf3e2f8`), schema applied (`leads`, `lead_events`).
- ✅ **Worker written** (`worker.js`) — store + score + Ri Koh forwarder + email stub.
- ✅ **Site forms ready** — contact form and gated-download modal collect
  name / work email / organization / role and post JSON.
- ⏳ **Not yet wired live.** The Worker isn't deployed and the site's
  `LEAD_ENDPOINT` is empty, so the site currently falls back to an email link.
  Flip it on with the two steps below.

## Go live in 3 steps

1. **Deploy the Worker** (from a machine with Cloudflare access):
   ```bash
   cd healthsimai/lead-intake
   npx wrangler deploy
   ```
   This binds the existing `healthsimai-leads` D1. Note the deployed URL.

2. **Point the site at it.** In `healthsimai/public/script.js` set:
   ```js
   const LEAD_ENDPOINT = 'https://healthsimai-lead-intake.<your-subdomain>.workers.dev';
   ```
   (or add a route so it's reachable at `/api/lead` on the main domain). Commit —
   the site auto-deploys via GitHub Actions.

3. **Test:** submit the demo form and confirm a row appears (see queries below).

## How lead qualification works

Each lead is scored 0–100 (same formula client- and server-side):

| Signal | Points |
| --- | --- |
| Work email (not gmail/yahoo/etc.) | +40 |
| Organization provided | +20 |
| Senior role (chief/VP/director/head/officer/admin) | +25 (manager/lead +10) |
| Stated area of interest | +10 |
| Resources requested | +5 each, up to +20 |

Tier: **hot ≥ 70**, **warm ≥ 40**, else **cold**. Stored on each lead as
`qualification_score` / `qualification_tier`, so the pipeline can be sorted by
who they are, who they work for, and how many downloads they've requested.

View the pipeline:
```sql
SELECT created_at, name, organization, role, email_domain,
       downloads_count, qualification_score, qualification_tier, status
FROM leads ORDER BY qualification_score DESC, created_at DESC;
```

## Where the documents live (gated downloads)

The recommended pattern: store the PDFs in a **private R2 bucket**
(`healthsimai-docs`); they are never publicly linked. When a lead submits the
download form, the Worker emails them a **short-lived signed link** to the file.
That keeps the assets behind the "email wall" while still being self-serve.

To enable: create the bucket, drop the real PDFs in, uncomment the `r2_buckets`
binding in `wrangler.jsonc`, and implement `sendResourceEmail()` with an email
provider (MailChannels, Resend, or SES). Until then the modal confirms "we've
emailed you the link" and the lead is captured for manual follow-up.

## Connecting Ri Koh's CRM

Ri Koh is multi-tenant (per-tenant D1s + the `rikoh-unified-api` Worker). To
push site leads into a **HealthSimAI pipeline** there, we need from the Ri Koh team:

1. The lead-ingest endpoint on `rikoh-unified-api` (or confirmation to add one).
2. An auth token, and the HealthSimAI tenant/pipeline id.
3. The field mapping for their leads/pipeline schema.

Then set `RIKOH_ENDPOINT` (var) and `RIKOH_TOKEN` (secret) and the Worker
forwards every lead automatically, marking `synced_to_rikoh = 1`. Until that's
provided, leads accumulate in `healthsimai-leads`, which Ri Koh can also read
directly since it's in the same Cloudflare account.
