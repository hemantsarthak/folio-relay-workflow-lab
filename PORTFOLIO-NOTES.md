# Why these projects

## Folio: frontend engineering

The working unit is a client and tax year, with multiple document questions. A preparer chooses expected document types, issues a request, receives a source document through the client preview, reviews its year and routing suggestion, and records a resolution. The readiness checklist derives its state from those questions: a missing file or unreviewed response cannot count as verified. Open questions for that year still block handoff even if an expected type is removed.

Useful demonstration: choose Alex, observe the missing W-2 and wrong-year K-1, create the missing request, then resolve it with synthetic evidence. Choose Morgan to see an already reviewed document. Change Morgan's tax year and observe that prior-year evidence cannot satisfy the new year's checklist.

Engineering decisions: explicit transitions, typed data, a separate human-review boundary, independent client ownership, source excerpts, graceful parsing errors, browser persistence, mobile layout, and provider failures that remain visible.

## Relay: first IT hire

The working unit is a person, their access and equipment, and their support requests. A departure creates follow-up work; current simulated statuses feed an audit snapshot. Tickets need ownership and a recorded next step or resolution note. The operations review counts open work and groups repeated categorized reports by team so an operator can investigate shared services.

Useful demonstration: load the shared-session drill in Operations review, open one of its tickets, record an owner and investigation plan, then resolve it. The worklist and repeated-report group update from the queue. This grouping is a signal to investigate; it is not a diagnosis.

Engineering decisions: operator notes, CSV reconciliation, repeatable synthetic scenarios, a read-only diagnostics collector, traceable ticket changes, and explicit boundaries around identity and device actions.

## Portfolio positioning

Two finished workflows provide more useful evidence than a third generic AI dashboard. A future project could automate an onboarding checklist against an actual Google Workspace or Entra sandbox, with a dry-run preview, idempotent provisioning, approval, rollback, and evidence. That requires a real authorized sandbox to demonstrate credibly.

These applications were built with AI assistance. Present the code and decisions you understand; practise explaining the state transitions, reproducing a failure, and making a small change yourself. No production use, measured time savings, or tax accuracy is claimed.
