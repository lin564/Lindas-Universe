# HealthSimAI Website

Single-page marketing site for **HealthSimAI.com** — hospital digital twin intelligence, a venture of UltiSim Inc.

## Contents

- `index.html` — full single-page site (hero, solutions, platform, proof, resources, leadership, contact)
- `styles.css` — all styling, responsive down to mobile
- `script.js` — tabs, case-study carousel, interactive ROI calculator, animated counters, mobile nav
- `favicon.svg` — hospital digital twin mark

No build step, no dependencies — pure static HTML/CSS/JS. Fonts load from Google Fonts.

## Preview locally

```bash
cd healthsimai
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploying to HealthSimAI.com (domain at Hover)

Host the static files anywhere, then point Hover DNS at the host:

1. **Pick a host** (all have free tiers): Cloudflare Pages, Netlify, Vercel, or GitHub Pages. Upload or connect this `healthsimai/` folder as the site root.
2. **In Hover** (hover.com → your domain → DNS):
   - Add the records your host gives you — typically an **A record** on `@` and a **CNAME** on `www` pointing to the host's domain.
   - Remove Hover's default parking A records.
3. **Add the custom domain** in the host's dashboard so it provisions HTTPS automatically.

DNS changes usually propagate within an hour.

## Notes

- The contact form opens the visitor's mail client addressed to `info@healthsimai.com`. For a real lead pipeline, swap it for a form service (Formspree, Basin) or the host's form handling — only the `<form>` action and the submit handler in `script.js` need changing.
- ROI calculator benchmarks live in `calcROI()` in `script.js` and are easy to tune.
