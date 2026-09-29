# Rivet application portfolio

Two independently usable React/TypeScript apps, with one local Node API and one install. Portfolio concepts by Hemant Sarthak, not affiliated with Rivet. Implementation follows the two ideas selected in the conversation. No real filings, account changes, ticket messages, or device remediations.

## Shared contract

- `/apps/tax/` -> tax document triage and review.
- `/apps/it/` -> IT support triage and diagnostics.
- `/api/config` returns `{liveAvailable, model}`; no credentials.
- `POST /api/classify` receives `{kind:'tax'|'it', text, mode:'demo'|'live'}` and returns shared `Decision` type in `src/shared/api.ts`.
- Text maximum: 60,000 characters, enforced client and server. Demo is deterministic local rules, explicitly labeled, scores are illustrative and not calibrated. Live uses Jev server-side only and never silently falls back.
- Frontends use TanStack Query for API requests, lucide-react icons, normal CSS, no external images or font dependency. Shared file is coordinator-owned.
- No automatic disk persistence of documents/tickets. Files stay browser-side; only text explicitly submitted in live mode goes to TypeSafe.

## Independent units and file ownership

1. Tax app: owns only `apps/tax/**`. Upload PDFs/TXT/CSV (10 MB/file), parse PDFs browser-side with pdfjs-dist, real source preview, content-hash duplicate detection, seeded synthetic samples, classification and threshold review gating, manual category override, mark reviewed, export JSON manifest, meaningful errors/retry/cancel. Text-only scanned/encrypted PDF limitations must be explicit. Responsive editorial UI: cream, forest green, fine borders, warm typographic title, generous whitespace. Name: Folio.
2. IT app: owns only `apps/it/**`. Seeded synthetic tickets, create ticket, search/filter/select, Jev/rules classification, suggestions chosen from curated runbooks, manual category override, status lifecycle, audit history, import collector JSON and attach it to a ticket, export escalation packet, download collector. Responsive UI: dark ink navigation, light work surface, orange accent. Name: Relay. Collector schema below.
3. Coordinator: owns everything else. Server, Jev adapter, Windows collector, tests, gallery, docs, install, authoritative build/browser verification. No worker edits shared configs or runs installs/builds/git.

## Collector schema

`{schemaVersion:1, collectedAt:ISODate, platform:'Windows', checks:[{name:string,status:'pass'|'warn'|'fail'|'unknown',value:string,detail:string}], summary:string}`. Import validation should reject malformed or oversized input. Collector URL `/api/collector` downloads `Collect-RelayDiagnostics.ps1`. UI observes facts and suggests next steps; it must not claim to have diagnosed root cause or executed remediation.

## Verification

Coordinator runs API tests for validation, unavailable credentials, malformed upstream answers, timeout/error handling, demo routing, review boundaries, plus build/typecheck. Browser verifies both apps at desktop and mobile, file upload, duplicate detection, review/edit/export and IT create/triage/import/status/export. Collector runs locally as read-only checks without uploading reports. Live provider calls require an API key and are explicitly unverified until one is configured. Preserve all pre-existing workspace files.
