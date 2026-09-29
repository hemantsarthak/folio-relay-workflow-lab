# Folio & Relay — Hemant's workflow lab

Two working portfolio projects inspired by Rivet's frontend and IT roles. Independent concepts, not Rivet products. Folio manages multiple client records and document requests through review; Relay manages a simulated employee directory, support queue, and offboarding audit. Both retain their original triage workspaces. Built with React, TypeScript, TanStack Query, Vite, Express, PDF.js and a server-side Jev adapter.

## Run both

Requires Node.js 22.18+ (tested on 22.18) and npm.

```powershell
npm ci
npm run dev
```

Open **http://127.0.0.1:4317** for the gallery.

- **Folio:** http://127.0.0.1:4317/apps/tax/
- **Relay:** http://127.0.0.1:4317/apps/it/

The server binds only to loopback. To test a production build locally:

```powershell
npm run build
npm start
```

Stop the dev server before starting production on the same port. Override `PORT` in `.env` if needed.

## Enable real Jev

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Edit `.env` locally to set `OPENCODE_API_KEY` to an OpenCode Zen key. The default OpenCode model is `jev-1.13-free` at `POST https://opencode.ai/zen/v1/systemone`. Alternatively, set `TYPESAFE_API_KEY` for direct TypeSafe access with `jev-latest` at `POST https://api.typesafe.ai/v1/systemone`. OpenCode takes priority if both keys are set. Restart the server, then select **Jev live** in either app. Never put a key in frontend code or a `VITE_` variable. `.env` is ignored by Git.

The adapter asks two independent questions: a Choice category and a Noul attention flag. The application validates the response and chooses workflow behavior in code. Sources: https://opencode.ai/docs/en/zen/ and https://docs.typesafe.ai/api

**Without a key, local demo mode is fully usable.** It uses inspectable keyword rules and illustrative scores, not AI predictions or calibrated probabilities. Live mode never silently falls back to rules. A provider account/key and available quota are required for actual Jev calls; no paid account is created by this project.

## Folio: client workspace and document review

The per-client **Document readiness** checklist lets the preparer choose expected document types for the client's current tax year. It derives missing, drafted, awaiting-client, needs-review, and verified states from requests. Only reviewed current-year evidence satisfies the checklist, and all open questions for that year must be resolved before handoff. Changing the client's year makes older evidence insufficient. Duplicate open requests for the same client, form, and year are rejected.

The **Clients** view starts with three synthetic client records and separate requests at different stages. Search or filter the directory, add and edit a client, archive or restore a profile, and open a W-2, 1099, or K-1 request for that client and tax year. Each request keeps its own status, source evidence, client response, and activity trail. The seeded Alex case has a 2024 K-1 in a 2025 packet.

In **Preparer view**, issue a specific request inside the local demo. Switch to **Client view**, attach a text-layer PDF or UTF-8 TXT file (or use a generated synthetic sample), and return to the preparer to review the extracted year and routing suggestion before closing the question with a note. No message is sent to anyone. The route is suggested by local rules or live Jev; the year comparison is deterministic and the preparer confirms the result.

The client workspace saves automatically in this browser and can be reset or exported. The workspace export and individual question-resolution exports exclude raw document text and file bytes. Local storage does contain extracted response text, so use synthetic documents only. The included K-1 replacement file is `public/samples/case-2025-k1.txt`. The preparer/client switch is a role preview, not authentication or a real client portal.

The original **Document workspace** is still available:

Upload a text-layer PDF, TXT or CSV (up to 10 MB/file and 60,000 extracted characters); inspect the source; classify; adjust the review threshold; correct a category and record a human review; export the classification manifest. Identical file bytes are detected as duplicates. Seeded examples are synthetic. Each PDF page must contain readable text; scanned or blank pages need OCR or removal before upload. Password-protected files must be unlocked first. Documents are triaged, not validated for tax accuracy, and no IRS filing happens.

Sample files are under `public/samples` and available at `/samples/sample-w2.pdf` and `/samples/sample-1099.txt`. Use the same PDF twice to demonstrate duplicate detection.

## Relay: people, offboarding, and support operations

The **People & access** view starts with three synthetic employee records. An IT admin can add and edit people, record a departure, list app access and a device, and change their simulated statuses with an operator note. The worklist shows access or equipment still open after departure. **Audit directory snapshot** feeds the current roster, app, and device state into the existing audit without uploading CSVs. An employee-view preview shows one person's equipment and matching tickets, and pre-fills a new support request. This view does not enforce permissions: it is a local workflow demonstration, not an identity or MDM console.

The **Access audit** view compares three normalized CSVs: roster (`email,employment_status,exit_date`), SaaS accounts (`email,system,account_status`), and devices (`email,asset_id,device_status`). Run the synthetic example or import your own approved, sanitized exports in that shape. It flags active SaaS accounts and assigned devices for people marked departed. Record an operator note and export the audit packet. Notes do not clear the source finding; re-import updated exports to confirm the status changed. The app never calls admin APIs or changes accounts/devices. Inputs live in browser session memory only.

The original **Support queue** is still available:

**Operations review** derives ownership gaps and repeated reports from the support queue. Load the shared-session drill to add two synthetic Remote desktop reports, inspect the category/team pattern, and open a ticket to record its owner and next step. Tickets require a work plan before changing to Resolved. Groups update as tickets resolve; they signal an investigation, not a common root cause.

Create or inspect a ticket, classify its category, use a curated runbook, import real read-only diagnostic observations, and export an escalation packet. Track manual changes and ticket status in the local browser queue. Recommendations are suggestions, not proven root causes. No Slack messages, identity changes, device enrollment, or automatic fixes are executed.

### Collect Windows diagnostics

Download the collector inside Relay or run the checked-in script:

```powershell
.\scripts\Collect-RelayDiagnostics.ps1 -OutputPath .\relay-diagnostics.json
```

Optionally check TCP reachability to an endpoint you administer:

```powershell
.\scripts\Collect-RelayDiagnostics.ps1 -TargetHost desktop.example.com -Port 3389 -OutputPath .\relay-diagnostics.json
```

The collector observes OS, available memory, disk space, network adapter availability and a DNS lookup. TCP reachability is optional; it does not test remote login or Drake itself. Read the report, then import the JSON manually. It does not upload anything, change settings, or include usernames, device names, IP addresses, credentials or file contents. Query failures are reported as unknown/warnings. Respect your organization's script execution policy. macOS is not supported by this collector.

A synthetic diagnostic report is included at `/samples/sample-diagnostics.json` for demonstrations on other operating systems.

## Data and deployment boundaries

- Browser local storage holds the Folio client workspace, Relay people directory, and support tickets across reloads; each has a reset control. Local storage can contain extracted document text, ticket details, and diagnostic reports. The original Folio document queue and imported Relay audit CSVs remain in session memory. There is no server database, real multi-user synchronization, or access control.
- File parsing happens in the browser. Classification sends text to the local Node server. **Live mode forwards submitted text to the configured provider (OpenCode Zen or TypeSafe).** Use synthetic documents for the public portfolio demonstration.
- Keys stay server-side. No document content is logged by the application. No analytics, remote fonts, or tracking are included.
- The local server rejects cross-origin requests and non-local Host headers, limits input size, caps live requests, and times out provider calls.
- Netlify hosting uses a separate serverless API, configured by `netlify.toml`; the loopback Express server stays local. The hosted demo works without keys. Optional live Jev requires a server key and a separate reviewer access code. See `DEPLOYMENT.md`. Production multi-user use would require authentication, authorization, durable audited storage, and organization integrations.

## Checks and evaluation

```powershell
npm test
npm run build
node scripts/evaluate.mjs
# Optional: sends the included synthetic cases to the configured Jev provider and may consume API quota.
node scripts/evaluate.mjs --live
```

Tests exercise Folio client records and question state, Relay employee lifecycle and CSV reconciliation, local routing, ambiguous packets, validation, HTTP behavior, provider contract validation, timeouts and explicit live-mode failures. Provider responses in automated tests are controlled fixtures. The evaluation script reports results on 12 synthetic smoke cases, not an independent benchmark or a claim of production accuracy. A live provider smoke check is recorded in `VERIFICATION.md`.

## Architecture and ownership

`apps/tax` and `apps/it` are separate React entry points. `apps/tax/client-workspace.ts` and `case.ts` own client and request transitions; `apps/it/people-admin.ts` and `access-audit.ts` own employee lifecycle and audit findings. `src/shared/api.ts` is their typed client. `server/decisions.mjs` contains the provider adapter and local rules. `server/app.mjs` handles the API boundary. `scripts/Collect-RelayDiagnostics.ps1` produces the diagnostic schema.

See `/case-study.html` and `PORTFOLIO-NOTES.md` for reviewer walkthroughs and project reasoning, `DEPLOYMENT.md` for Netlify settings, and `VERIFICATION.md` for the checks actually performed.
