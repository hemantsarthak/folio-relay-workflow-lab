# Two application walkthroughs

## Frontend role: Folio

1. Open **Clients**. Show three clients with distinct request states. Search for a client, then use **Add client** to create a fictional fourth record and edit its profile.
2. Open a **New request** for that client. Choose W-2, 1099, or K-1 and a tax year. Issue the request as the preparer; switch to **Client view** to show the exact message. No actual message is sent.
3. Upload a text-layer PDF or TXT file, or use the generated synthetic sample. Back in **Preparer view**, inspect the year excerpt, routing source (local rules or Jev), and audit trail. Add a review note and close the question.
4. Reload to show that clients and requests persist locally. Export the client workspace or a request packet; raw document text is omitted. The original **Document workspace** remains a separate packet-triage sandbox.
5. Show the seeded Alex case: a 2024 K-1 in a 2025 case cannot resolve without a correct response. Explain the validation and human decision boundary.

Suggested opening: “I built a multi-client workspace that takes a document request from a preparer to a client response and a source-backed review. The role switch is a demo preview, not a production portal.”

## IT role: Relay

1. Open **People & access**. Search the synthetic directory, add a fictional employee, and record an application and laptop assignment with operator notes.
2. Use **Employee view** to show that person's equipment and linked support requests. **Request help** opens a ticket with their name and team prefilled; the queue then carries the ticket through triage and status changes.
3. Back in **IT admin view**, record a departure. The worklist shows active access and assigned hardware. Choose **Audit directory snapshot** to see those items as separate findings.
4. Change the simulated app to disabled and the device to returned, each with an operator note. Run **Audit directory snapshot** again: those findings clear from the new local snapshot. Explain that no real IdP, Slack, or MDM action was executed.
5. Demonstrate the independent **Access audit** CSV import for normalized external exports, and the support queue's runbooks and optional Jev routing. Export a profile, audit packet, or ticket as needed.

Suggested opening: “I built a small first-IT-hire workflow: maintain a people directory, document provisioning and departures, surface offboarding gaps, and connect employees to support without pretending to automate admin systems.”

## Be precise about your contribution

These projects were built with AI assistance. Before presenting them, run the demos yourself, inspect the code, change a rule, reproduce an error, and explain the result. Both are local synthetic simulations with no real authentication or organization integrations. Do not describe simulated changes or unmeasured time savings as production achievements.
