# HealthSimAI Website

Single-page marketing site for **HealthSimAI.com** — hospital digital twin intelligence, a venture of UltiSim Inc.

## Contents

- `public/index.html` — main site (dashboard hero, solutions/department twins, platform, outcomes, resources, contact)
- `public/about.html` — company page (mission, roadmap targets, two twin modes, leadership)
- `public/styles.css` — all styling, responsive down to mobile
- `public/script.js` — tabs, case-study carousel, interactive ROI calculator, animated counters, mobile nav
- `public/favicon.svg` — hospital digital twin mark
- `wrangler.jsonc` — Cloudflare Workers config (serves `public/` as static assets)

No build step, no dependencies — pure static HTML/CSS/JS. Fonts load from Google Fonts.

## Preview locally

```bash
cd healthsimai/public
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploying to Cloudflare

This folder is set up for Cloudflare Workers static assets. With the repo
connected in the Cloudflare dashboard (Workers & Pages → Create →
Connect to Git), use these build settings:

- **Root directory:** `/healthsimai`
- **Build command:** none
- **Deploy command:** `npx wrangler deploy`

Or deploy manually from a machine with Cloudflare credentials:

```bash
cd healthsimai
npx wrangler deploy
```

### Pointing HealthSimAI.com at it (domain at Hover)

1. In the Worker's **Domains** tab, add `healthsimai.com` and `www.healthsimai.com` as custom domains.
2. If the domain isn't on Cloudflare yet, Cloudflare will prompt to add the zone — it then gives you two **nameservers** to set at Hover (hover.com → domain → Nameservers). Using Cloudflare nameservers is simplest; HTTPS is automatic.

DNS/nameserver changes usually propagate within an hour.

## Notes

- The contact form opens the visitor's mail client addressed to `info@healthsimai.com`. For a real lead pipeline, swap it for a form service (Formspree, Basin) or the host's form handling — only the `<form>` action and the submit handler in `script.js` need changing.
- Impact estimator benchmarks live in `calcROI()` in `script.js` and are easy to tune.
- Leadership photos: drop `bob-kleinhample.jpg` (square crop works best) into `public/` and his card picks it up automatically; until then it shows "BK" initials. Other leaders use placeholder silhouettes — add `<img>` tags the same way when photos are available.

Deploys run automatically via GitHub Actions (.github/workflows/deploy-healthsimai.yml) on pushes to main.
