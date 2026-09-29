# Verification record

## September 30, 2026 — publication preparation

- `npm run check`: 32 tests passed, TypeScript passed, and the Vite production build completed. New checks cover current-year document readiness, unresolved-question blocking, duplicate request rejection, repeated-ticket grouping, work-plan validation, hosted HTTPS routing, and the protected live-call boundary.
- Netlify has a separate serverless handler. Tests verify that a provider key without a reviewer code cannot enable hosted live inference, an invalid code does not call the provider, and API configuration never returns the key.
- The production build includes the gallery, both applications, reviewer case studies, sample files, and the downloadable diagnostic collector. Provider integration tests use controlled synthetic fixtures.

The deployed-site checks are recorded after publication below. Passing local tests does not verify the remote deploy.

## September 27, 2026 — expanded portfolio workflows

- `npm run check`: 28 tests passed, TypeScript passed, and the Vite production build completed. New tests cover multi-client ownership and question lifecycle, employee lifecycle, and directory-to-audit reconciliation. Vite still prints the non-blocking dependency `"use client"` notices noted below.
- `npm run format:check` and `git diff --check`: passed.
- Folio browser flow: added a fourth fictional client, opened a W-2 request, issued it, switched to the client preview, attached a synthetic W-2 response, reviewed the source and added a preparer note, closed the request, then reloaded and confirmed the resolved state persisted. The earlier seeded K-1 flow and wrong-year block remain covered.
- Relay browser flow: added a fictional employee, assigned Slack access and a Windows laptop, marked the employee departed, and saw two additional findings in the directory audit snapshot. Recorded disabled and returned statuses with operator notes, then reran the snapshot and saw those findings clear. Employee preview showed equipment and a linked ticket, and **Request help** prefilled the employee and team. A newly created support ticket survived a reload.
- At a 390px browser viewport, the Folio client workspace and Relay people/queue navigation had no horizontal document overflow. The temporary viewport overrides were reset.

These are synthetic, local workflows. The expanded features were not tested with a real tax packet, HR roster, IdP, MDM, or live Jev invocation from the case room. No external account changes or tax filing occurred.

Checked locally on Windows with Node.js 22.18.0 on September 26, 2026.

## Automated checks

- `npm test`: 15 tests passed. Coverage includes the API boundary, local routing, input validation, mocked direct-TypeSafe and OpenCode-Zen Jev request/response handling, timeouts, diagnostic-report schema validation, and preservation of a manual category change while an asynchronous classification finishes.
- `npm run build`: TypeScript and Vite production build passed. Vite printed non-blocking `"use client"` notices from dependencies.
- `npx tsc --noEmit --noUnusedLocals --noUnusedParameters`: passed.
- `npm run format:check`: passed after formatting the server file.
- `npm run evaluate`: 12/12 on authored synthetic local-rule smoke cases. This is not an independent accuracy benchmark.

## Browser and local workflow checks

- Served the production build on `127.0.0.1:4317` and opened the gallery, Folio, and Relay.
- Folio: classified its synthetic seed packet; uploaded and previewed a real text-layer sample PDF; detected an identical file by SHA-256; adjusted the threshold; recorded a manual review; exported and inspected the manifest. Encrypted and image-only PDFs showed actionable errors. A two-page readable PDF processed. A mixed PDF with a readable first page and blank second page remained in Needs attention with a page-2 error rather than being classified.
- Relay: suggested a remote-desktop route and runbook, created and classified a new MFA ticket, changed ticket status, imported a report produced by the checked-in Windows collector, and exported and inspected an escalation packet. A malformed report was rejected. The collector performed read-only local checks.
- At a narrow mobile viewport, Folio's document workspace and Relay's queue/detail views remained usable without horizontal page overflow. The viewport override was cleared after inspection.
- Configured an OpenCode inference-only key in the ignored local `.env` file, then made live Jev calls with synthetic data. `POST /api/classify` returned `source=jev`, `model=jev-1.13-free`, and `W-2` / `Identity & access` for the synthetic tax / IT cases. Folio's browser UI showed a live W-2 result; Relay's browser UI showed a live Remote desktop result and an OpenCode Zen disclosure.

## Limits of verification

- Direct TypeSafe access was not tested because no TypeSafe key was supplied. Live OpenCode Zen responses verify connectivity and the application path on these synthetic cases, not broader classification accuracy or future model availability.
- Classification scores in local demo mode are illustrative. The shipped cases are synthetic and do not establish tax or IT diagnostic accuracy.
- No IRS filing, identity administration, device management, or remote remediation was performed. The app is a local portfolio demo, not a production system.
