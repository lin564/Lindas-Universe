# Deploy shim — safe to delete after fixing Cloudflare settings

This directory exists only because the Cloudflare Workers build for
`healthsimai` has its **Root directory** set to `/claude/modest-lovelace-4r0li1`
(a branch name entered by mistake). It mirrors `/healthsimai` so the build
succeeds with the current settings.

**To clean up:** in the Cloudflare dashboard, set the Worker's
Settings → Build → Root directory to `/healthsimai`, then delete this
entire `claude/` directory from the repo. The canonical site source lives
in `/healthsimai`.
