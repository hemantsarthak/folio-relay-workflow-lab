# Netlify deployment

The published repository contains only this project. The original workspace remains available in `PP/rivet-portfolio`; the standalone Git checkout is `C:/Users/heman/OneDrive/Desktop/Code/Codex/folio-relay-workflow-lab`.

## Build and routes

The live demo is https://folio-relay-workflow-lab.netlify.app. It was published with Netlify CLI from the checked and built standalone checkout. The GitHub repository is `hemantsarthak/folio-relay-workflow-lab`, branch `main`. Netlify is currently a manual CLI deployment, not connected to GitHub for automatic deployments.

`netlify.toml` runs `npm run check`, publishes `dist`, and bundles `netlify/functions/api.mjs` with esbuild on Node 22. To publish an update from this checkout, run `npm run check`, `npm run format:check`, then `npx netlify-cli deploy --prod --no-build --dir dist --functions netlify/functions`.

- `/` — project gallery
- `/case-study.html` — reviewer walkthroughs and code links
- `/apps/tax/` — Folio
- `/apps/it/` — Relay
- `/api/config` and `/api/classify` — Netlify function paths
- `/api/collector` — download redirect to the checked-in PowerShell collector, copied to the public output at build time

The localhost Express server stays local. The hosted handler checks the request origin, validates input through the same decision module, returns provider errors explicitly, and applies a Netlify edge rate limit of 60 function requests per IP per minute. No frontend API key is used.

## Optional protected Jev

The public site works in Local rules mode without environment secrets. To enable protected live Jev, set `OPENCODE_API_KEY` (or `TYPESAFE_API_KEY`) and a separate `LIVE_DEMO_ACCESS_CODE` in Netlify's server environment, then redeploy. Set `OPENCODE_MODEL` only if changing the provider model. Do not commit `.env` or put keys in `VITE_` variables.

The reviewer enters the access code in either app's **Have a reviewer code? Unlock live Jev** control, then chooses **Jev live** in the sidebar. It is sent as `X-Demo-Access` only for live calls and stored in tab session storage. The function verifies it before contacting the provider. A server key alone never enables public live inference. This shared code is a demo quota gate, not multi-user authentication.

Live OpenCode Zen is enabled on the published demo. The private reviewer code is saved in the ignored `private/reviewer-access.txt` file; share it privately. Neither the provider key nor reviewer code is in Git or the public assets. The existing Netlify Free account does not allow selecting individual variable scopes, so the production variables use its default scopes. They are not `VITE_` variables and are never included in the frontend. Netlify account administrators can read these environment values; paid-plan secret masking is not enabled.

## Data boundaries

Each visitor receives synthetic seed data and a separate browser workspace. Browser reload preserves clients, employee records, and tickets. Imported document queue and audit exports remain session-scoped. There is no central database or cross-device synchronization. Use synthetic data for the portfolio; the applications simulate role views and administrative changes.

Use `npm run check` and `npm run format:check` before a push. GitHub Actions repeats them. Use the CLI command above to publish separately after a push.
