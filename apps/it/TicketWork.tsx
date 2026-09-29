import { useState } from "react";
import type { Ticket } from "./data";
import { recordTicketWork } from "./operations";

export default function TicketWork({
  ticket,
  onSave,
}: {
  ticket: Ticket;
  onSave: (patch: Partial<Ticket>) => void;
}) {
  const [owner, setOwner] = useState(ticket.owner || "");
  const [nextStep, setNextStep] = useState(ticket.nextStep || "");
  const [error, setError] = useState("");
  return (
    <section
      className="ticket-work"
      aria-label="Ticket ownership and next step"
    >
      <h3>Own the follow-through</h3>
      <p>
        Record a responsible person and the next investigation, handoff, or
        resolution note.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          try {
            onSave(recordTicketWork(ticket, owner, nextStep));
            setError("");
          } catch (caught) {
            setError((caught as Error).message);
          }
        }}
      >
        <label>
          Owner
          <input
            value={owner}
            onChange={(event) => setOwner(event.target.value)}
            maxLength={100}
            placeholder="e.g. Hemant · IT"
            required
          />
        </label>
        <label>
          Next step / resolution note
          <textarea
            value={nextStep}
            onChange={(event) => setNextStep(event.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="Compare affected remote sessions and ask the platform team to review host metrics…"
            required
          />
        </label>
        <button type="submit">Save work plan</button>
        {error && <p role="alert">{error}</p>}
      </form>
    </section>
  );
}
