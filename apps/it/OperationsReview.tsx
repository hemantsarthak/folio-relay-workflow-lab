import { downloadJson } from "../../src/shared/api";
import type { Ticket } from "./data";
import { summarizeOperations } from "./operations";
import "./Operations.css";

export default function Operations({
  tickets,
  onOpenTicket,
  onLoadDrill,
}: {
  tickets: Ticket[];
  onOpenTicket: (id: string) => void;
  onLoadDrill: () => void;
}) {
  const summary = summarizeOperations(tickets);
  return (
    <section className="relay-operations" aria-label="Operations review">
      <div className="operations-stats">
        <div>
          <span>OPEN WORK</span>
          <strong>{summary.active}</strong>
        </div>
        <div>
          <span>NEEDS AN OWNER</span>
          <strong>{summary.unowned}</strong>
        </div>
        <div>
          <span>NEEDS A NEXT STEP</span>
          <strong>{summary.missingNextStep}</strong>
        </div>
      </div>
      <div className="operations-actions">
        <p>
          Turn individual tickets into a documented worklist and investigate
          repeated reports.
        </p>
        <button onClick={onLoadDrill}>Load shared-session drill</button>
        <button
          onClick={() =>
            downloadJson("relay-operations-review.json", {
              application: "Relay independent demo",
              exportedAt: new Date().toISOString(),
              ...summary,
              note: "Patterns group working categories and teams. They do not establish a shared root cause.",
            })
          }
        >
          Export review
        </button>
      </div>
      <section className="operations-panel">
        <span>REPEATED REPORTS</span>
        <h2>Signals worth investigating</h2>
        <p>
          Two or more open tickets with the same working category and team.
          Check timestamps and source evidence before treating them as one
          incident.
        </p>
        {!summary.patterns.length && (
          <p className="operations-empty">
            No repeated categorized reports yet. Load the synthetic drill or
            triage more tickets.
          </p>
        )}
        {summary.patterns.map((pattern) => (
          <div className="operations-pattern" key={pattern.label}>
            <strong>{pattern.label}</strong>
            <span>{pattern.tickets.length} open reports</span>
            <div>
              {pattern.tickets.map((ticket) => (
                <button key={ticket.id} onClick={() => onOpenTicket(ticket.id)}>
                  {ticket.id} · {ticket.employee}
                </button>
              ))}
            </div>
            <p>
              Next investigation: compare affected sessions, start times, and
              shared services. Record your observations on the tickets.
            </p>
          </div>
        ))}
      </section>
      <section className="operations-panel">
        <span>WORK OWNERSHIP</span>
        <h2>Priority worklist</h2>
        <p>
          High priority first, then oldest first. All counts come from this
          browser's queue.
        </p>
        <div className="operations-worklist">
          {summary.worklist.map((ticket) => (
            <button key={ticket.id} onClick={() => onOpenTicket(ticket.id)}>
              <div>
                <strong>{ticket.title}</strong>
                <small>
                  {ticket.id} · {ticket.priority} priority · {ticket.status}
                </small>
              </div>
              <div>
                <span>{ticket.owner || "Unassigned"}</span>
                <small>{ticket.nextStep || "No next step recorded"}</small>
              </div>
            </button>
          ))}
        </div>
        {!summary.active && (
          <p className="operations-empty">All tickets are resolved.</p>
        )}
      </section>
    </section>
  );
}
