import { useState } from "react";
import {
  AppWindow,
  Check,
  KeyRound,
  Laptop,
  LifeBuoy,
  Send,
  ShieldCheck,
  Wifi,
} from "lucide-react";
import type { Ticket } from "./data";
import type { AdminPerson } from "./people-admin";

export type PortalRequest = {
  person: Pick<AdminPerson, "id" | "name" | "team">;
  type: string;
  title: string;
  details: string;
  blocked: boolean;
  othersAffected: boolean;
};

const requestTypes = [
  {
    id: "Sign-in or MFA problem",
    icon: KeyRound,
    hint: "Locked out, new phone, password reset",
  },
  {
    id: "Access to an app or folder",
    icon: ShieldCheck,
    hint: "Onboarding, new tool, shared drive",
  },
  {
    id: "Laptop or hardware",
    icon: Laptop,
    hint: "Slow, broken, disk full, battery",
  },
  {
    id: "Software install or error",
    icon: AppWindow,
    hint: "Missing app, license, update fails",
  },
  {
    id: "Remote desktop, VPN or Wi-Fi",
    icon: Wifi,
    hint: "Can’t connect, freezing, drops",
  },
  {
    id: "Something else",
    icon: LifeBuoy,
    hint: "Not sure — describe it",
  },
];

const stages = ["Submitted", "Routed", "In progress", "Resolved"] as const;
function stageIndex(ticket: Ticket) {
  if (ticket.status === "Resolved") return 3;
  if (ticket.status === "In progress") return 2;
  return ticket.decision || ticket.category !== "Untriaged" ? 1 : 0;
}

export default function HelpPortal({
  people,
  personId,
  onPersonChange,
  tickets,
  routingIds,
  engineLabel,
  onSubmit,
}: {
  people: AdminPerson[];
  personId: string;
  onPersonChange: (id: string) => void;
  tickets: Ticket[];
  routingIds: string[];
  engineLabel: string;
  onSubmit: (request: PortalRequest) => string;
}) {
  const person = people.find((p) => p.id === personId) || people[0];
  const [type, setType] = useState(requestTypes[0].id);
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [blocked, setBlocked] = useState(false);
  const [others, setOthers] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState<string | null>(null);
  const mine = tickets.filter(
    (t) =>
      t.employeeId === person.id ||
      (!t.employeeId && t.employee.toLowerCase() === person.name.toLowerCase()),
  );
  const departed = person.status === "departed";

  return (
    <section className="portal" aria-label="Employee help portal">
      <div className="portal-bar">
        <label>
          <span>Signed in as (demo)</span>
          <select
            value={person.id}
            onChange={(e) => {
              onPersonChange(e.target.value);
              setSubmitted(null);
              setError("");
            }}
          >
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.team}
                {p.status === "departed" ? " (departed)" : ""}
              </option>
            ))}
          </select>
        </label>
        <p>
          This is what an employee sees. Requests land in the IT{" "}
          <strong>Support queue</strong>, routed by {engineLabel}.
        </p>
      </div>

      <div className="portal-grid">
        <div className="portal-main">
          {departed ? (
            <div className="portal-card portal-blocked">
              <h2>{person.name}’s account is marked departed.</h2>
              <p>
                Departed employees can’t raise requests. Pick an active employee
                above, or review their open access in People & access.
              </p>
            </div>
          ) : submitted ? (
            <div className="portal-card portal-done" role="status">
              <span className="portal-done-icon">
                <Check size={22} />
              </span>
              <h2>Request {submitted} is with IT.</h2>
              <p>
                You’ll see status changes below as IT picks it up. Nothing else
                to do right now.
              </p>
              <button
                className="primary-button"
                onClick={() => setSubmitted(null)}
              >
                Raise another request
              </button>
            </div>
          ) : (
            <form
              className="portal-card portal-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (!title.trim() || !details.trim()) {
                  setError("Add a short summary and a few details.");
                  return;
                }
                if (`${title}\n\n${details}`.length > 60000) {
                  setError("Keep the request under 60,000 characters.");
                  return;
                }
                const id = onSubmit({
                  person,
                  type,
                  title: title.trim(),
                  details: details.trim(),
                  blocked,
                  othersAffected: others,
                });
                setSubmitted(id);
                setTitle("");
                setDetails("");
                setBlocked(false);
                setOthers(false);
                setError("");
              }}
            >
              <span className="eyebrow">
                HI {person.name.split(" ")[0].toUpperCase()}
              </span>
              <h2>What do you need help with?</h2>
              <fieldset className="portal-types">
                <legend className="sr-only">Request type</legend>
                {requestTypes.map(({ id, icon: Icon, hint }) => (
                  <label key={id} className={type === id ? "selected" : ""}>
                    <input
                      type="radio"
                      name="type"
                      value={id}
                      checked={type === id}
                      onChange={() => setType(id)}
                    />
                    <Icon size={18} />
                    <strong>{id}</strong>
                    <small>{hint}</small>
                  </label>
                ))}
              </fieldset>
              <label>
                Short summary
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={200}
                  placeholder="e.g. Remote desktop freezes when I open PDFs"
                />
              </label>
              <label>
                What happened?
                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  rows={4}
                  maxLength={59000}
                  placeholder="What were you trying to do, what happened instead, and since when? Never include passwords or MFA codes."
                />
              </label>
              <div className="portal-checks">
                <label>
                  <input
                    type="checkbox"
                    checked={blocked}
                    onChange={(e) => setBlocked(e.target.checked)}
                  />
                  I can’t work until this is fixed
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={others}
                    onChange={(e) => setOthers(e.target.checked)}
                  />
                  Colleagues have the same problem
                </label>
              </div>
              {error && (
                <p className="inline-error" role="alert">
                  {error}
                </p>
              )}
              <button className="primary-button portal-submit" type="submit">
                <Send size={16} /> Send to IT
              </button>
            </form>
          )}
        </div>

        <aside className="portal-side">
          <div className="portal-card">
            <span className="eyebrow">MY REQUESTS</span>
            {mine.length === 0 ? (
              <p className="portal-empty">No requests yet.</p>
            ) : (
              <ul className="portal-requests">
                {mine.map((t) => {
                  const stage = stageIndex(t);
                  const routing = routingIds.includes(t.id);
                  return (
                    <li key={t.id}>
                      <div className="portal-request-head">
                        <strong>{t.title}</strong>
                        <small>
                          {t.id}
                          {t.category !== "Untriaged" && ` · ${t.category}`}
                          {routing && " · routing…"}
                        </small>
                      </div>
                      <ol className="portal-stages" aria-label="Progress">
                        {stages.map((label, i) => (
                          <li
                            key={label}
                            className={
                              i < stage ? "done" : i === stage ? "current" : ""
                            }
                          >
                            {label}
                          </li>
                        ))}
                      </ol>
                      {(t.owner || t.nextStep) && (
                        <p className="portal-update">
                          {t.owner && <b>{t.owner}</b>}
                          {t.owner && t.nextStep && " · "}
                          {t.nextStep}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="portal-card">
            <span className="eyebrow">MY EQUIPMENT & APPS</span>
            <p className="portal-kit">
              <Laptop size={16} />
              {person.device
                ? `${person.device.assetId} · ${person.device.status}`
                : "No device recorded"}
            </p>
            <p className="portal-kit">
              <AppWindow size={16} />
              {person.accounts.length
                ? person.accounts.map((a) => a.system).join(", ")
                : "No apps recorded"}
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}
