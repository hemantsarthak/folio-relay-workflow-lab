# Relay

An independent IT operations portfolio concept by Hemant Sarthak. Not affiliated with Rivet.

Open `/apps/it/` using the repository's shared development server. Relay uses React, TypeScript, TanStack Query, Lucide icons, and the shared `/api/classify` service.

## People and access walkthrough

Open **People & access**. Search the synthetic directory, add or edit an employee, record an app or device assignment, and document status changes with operator notes. Use **See … Help portal** to open the employee side for that person: their equipment, their requests with progress, and a request form that creates a routed ticket in the Support queue. The preview is for demonstration; it does not authenticate a person or enforce roles.

Mark an employee departed to open an offboarding worklist. **Audit directory snapshot** passes the simulated roster, account, and device state to the access audit. Active access and assigned equipment appear as findings; record disabled/returned states in the directory and take another snapshot to see the new simulated result. No IdP, SaaS, or MDM API is called. The directory and tickets persist in this browser's local storage and can be reset separately.

## Offboarding access audit

Open **Access audit** and run the synthetic example, or import normalized roster, account, and device CSVs. The example flags an active Slack account and an assigned laptop for a departed employee. Notes are operator attestations; updated exports are needed to confirm the finding has cleared. Relay makes no admin changes. The action packet is a local JSON download.

## Support-queue walkthrough

1. Open the synthetic remote-workstation ticket and choose **Suggest routing**. Local demo mode uses deterministic rules and clearly labels illustrative scores. Live Jev mode becomes available when the server reports API configuration; it sends the selected ticket's title and description to the configured provider (OpenCode Zen or TypeSafe).
2. Read the recommended runbook, then change **Working category** to demonstrate a human correction. Suggestions remain visible separately from the working category.
3. Download the Windows collector, inspect and run it locally, and import its JSON output. An import must conform to the version 1 schema in `BUILD-BRIEF.md`, contain 1–100 valid checks, and be no larger than 1 MB. Imported checks are observations, not a verified diagnosis.
4. Move the ticket to **In progress** or **Resolved**. The activity trail records changes.
5. Export an escalation packet containing the ticket, decision metadata, diagnostic observations, relevant runbook, and activity trail. Inspect device details before sharing it.
6. Create a ticket with fictional details, or search/filter the queue. Each ticket retains its own results and attached report across reloads in this browser until the queue is reset.

## Deliberate limits

- No Slack, MDM, identity-provider, or remote-desktop integration is claimed. Runbooks are curated illustrative guidance; the app does not execute remediation.
- Local rule scores are not calibrated confidence. Jev model confidence is not measured accuracy. Low scores are highlighted for manual review.
- Imported audit CSVs remain in session memory. The simulated directory and support tickets use browser local storage. Export is an explicit download. Report contents and audit CSVs are not included in classification requests. Use synthetic data; local storage is not secure audited storage.
- Remote diagnosis, account recovery, device administration, and identity verification require actual authorized operators and organization-specific policies.
- The UI supports mobile queue/detail navigation, keyboard operation, and reduced motion. See `../../VERIFICATION.md` for the checks actually performed.
