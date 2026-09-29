# Netlify deployment

The published repository contains only this project. The original workspace remains available in `PP/rivet-portfolio`; the standalone Git checkout is `C:/Users/heman/OneDrive/Desktop/Code/Codex/folio-relay-workflow-lab`.

## Build and routes

Import `hemantsarthak/folio-relay-workflow-lab` into Netlify, use `main`, and allow `netlify.toml` to provide the build settings. It runs `npm run check`, publishes `dist`, and bundles `netlify/functions/api.mjs` with esbuild on Node 22.

- `/` — project gallery
- `/case-study.html` — reviewer walkthroughs and code links
- `/apps/tax/` — Folio
- `/apps/it/` — Relay
- `/api/config` and `/api/classify` — Netlify function paths
- `/api/collector` — download redirect to the checked-in PowerShell collector, copied to the public output at build time

The localhost Express server stays local. The hosted handler checks the request origin, validates input through the same decision module, returns provider errors explicitly, and applies a Netlify edge rate limit of 60 function requests per IP per minute. No frontend API key is used.

## Optional protected Jev

The public site works in Local rules mode without environment secrets. To enable protected live Jev, set `OPENCODE_API_KEY` (or `TYPESAFE_API_KEY`) and a separate `LIVE_DEMO_ACCESS_CODE` in Netlify's server environment, then redeploy. Set `OPENCODE_MODEL` only if changing the provider model. Do not commit `.env` or put keys in `VITE_` variables.

The reviewer enters the access code in either app's **Reviewer live access** control. It is sent as `X-Demo-Access` only for live calls and stored in tab session storage. The function verifies it before contacting the provider. A server key alone never enables public live inference. This shared code is a demo quota gate, not multi-user authentication.

## Data boundaries

Each visitor receives synthetic seed data and a separate browser workspace. Browser reload preserves clients, employee records, and tickets. Imported document queue and audit exports remain session-scoped. There is no central database or cross-device synchronization. Use synthetic data for the portfolio; the applications simulate role views and administrative changes.

Use `npm run check` and `npm run format:check` before a push. GitHub Actions repeats them. Netlify redeploys the connected production branch after a push.
