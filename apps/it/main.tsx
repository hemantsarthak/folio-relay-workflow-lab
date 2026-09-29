import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
} from "@tanstack/react-query";
import {
  Activity,
  ArrowDownToLine,
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock3,
  FileJson,
  Inbox,
  Layers3,
  LoaderCircle,
  Monitor,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Upload,
  Users,
  X,
} from "lucide-react";
import {
  classify,
  downloadJson,
  getConfig,
  IT_CATEGORIES,
  type Mode,
} from "../../src/shared/api";
import {
  applyRoutingDecision,
  parseReport,
  runbooks,
  seedTickets,
  type Status,
  type Ticket,
} from "./data";
import AccessAudit, { type AuditSnapshot } from "./AccessAudit";
import PeopleAdmin from "./PeopleAdmin";
import LiveAccess from "../../src/shared/LiveAccess";
import Operations from "./OperationsReview";
import TicketWork from "./TicketWork";
import { loadIncidentDrill } from "./operations";
import "../../src/shared/demo.css";
import "./style.css";

const queryClient = new QueryClient();
const statuses: Status[] = ["Open", "In progress", "Resolved"];
const TICKETS_STORAGE_KEY = "relay-tickets-v1";
function loadTickets(): Ticket[] {
  try {
    const saved = localStorage.getItem(TICKETS_STORAGE_KEY);
    if (saved) {
      const parsed: unknown = JSON.parse(saved);
      if (
        Array.isArray(parsed) &&
        parsed.length > 0 &&
        parsed.length <= 200 &&
        parsed.every(
          (ticket) =>
            ticket &&
            typeof ticket.id === "string" &&
            /^RLY-\d+$/.test(ticket.id) &&
            typeof ticket.title === "string" &&
            typeof ticket.description === "string" &&
            typeof ticket.employee === "string" &&
            (ticket.employeeId === undefined ||
              typeof ticket.employeeId === "string") &&
            typeof ticket.team === "string" &&
            statuses.includes(ticket.status) &&
            Array.isArray(ticket.audit),
        )
      )
        return (parsed as Ticket[]).map((ticket) => {
          if (ticket.employeeId) return ticket;
          const seededEmployeeIds: Record<string, [string, string]> = {
            "RLY-1042": ["Maya Chen", "person-maya"],
            "RLY-1044": ["Jordan Lee", "person-jordan"],
            "RLY-1047": ["Taylor Kim", "person-taylor"],
          };
          const match = seededEmployeeIds[ticket.id];
          return match && ticket.employee === match[0]
            ? { ...ticket, employeeId: match[1] }
            : ticket;
        });
    }
  } catch {
    // Fall back to seed tickets when browser storage is unavailable.
  }
  return seedTickets();
}
const dateTime = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
const initials = (name: string) =>
  name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

function App() {
  const [tickets, setTickets] = useState<Ticket[]>(loadTickets);
  const [selectedId, setSelectedId] = useState(() =>
    tickets.some((ticket) => ticket.id === "RLY-1042")
      ? "RLY-1042"
      : tickets[0].id,
  );
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("Active");
  const [view, setView] = useState<
    "queue" | "runbooks" | "access" | "people" | "operations"
  >("people");
  const [mode, setMode] = useState<Mode>("demo");
  const [creating, setCreating] = useState(false);
  const [ticketPerson, setTicketPerson] = useState<{
    id: string;
    name: string;
    team: string;
  } | null>(null);
  const [auditSnapshot, setAuditSnapshot] = useState<AuditSnapshot | null>(
    null,
  );
  const [notice, setNotice] = useState("");
  const [ticketStorageIssue, setTicketStorageIssue] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [mobileDetail, setMobileDetail] = useState(false);
  const reportInput = useRef<HTMLInputElement>(null);
  const config = useQuery({
    queryKey: ["config"],
    queryFn: getConfig,
    retry: 1,
  });
  const selected = tickets.find((t) => t.id === selectedId)!;
  const visible = tickets.filter(
    (t) =>
      (filter === "All tickets" ||
        (filter === "Active"
          ? t.status !== "Resolved"
          : t.status === filter)) &&
      `${t.id} ${t.title} ${t.employee} ${t.team} ${t.category} ${t.owner || ""}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const active = tickets.filter((t) => t.status !== "Resolved");
  const update = (id: string, patch: Partial<Ticket>, message: string) =>
    setTickets((old) =>
      old.map((t) =>
        t.id === id
          ? {
              ...t,
              ...patch,
              audit: [
                { at: new Date().toISOString(), text: message },
                ...t.audit,
              ],
            }
          : t,
      ),
    );
  useEffect(() => {
    try {
      localStorage.setItem(TICKETS_STORAGE_KEY, JSON.stringify(tickets));
      setTicketStorageIssue("");
    } catch {
      setTicketStorageIssue(
        "Queue changes could not be saved in this browser. Export important tickets before closing the tab.",
      );
    }
  }, [tickets]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(timer);
  }, [notice]);
  const triage = useMutation({
    mutationFn: ({
      text,
      mode: requestMode,
    }: {
      id: string;
      text: string;
      mode: Mode;
      routingRevision: number;
    }) => classify("it", text, requestMode),
    onMutate: ({ id }) => setErrors((old) => ({ ...old, [id]: "" })),
    onSuccess: (decision, { id, routingRevision }) => {
      setTickets((old) =>
        old.map((ticket) =>
          ticket.id === id
            ? applyRoutingDecision(
                ticket,
                decision,
                routingRevision,
                new Date().toISOString(),
              )
            : ticket,
        ),
      );
      setNotice(`${id} routing suggestion is ready for review.`);
    },
    onError: (error, { id }) =>
      setErrors((old) => ({ ...old, [id]: error.message })),
  });
  const runTriage = () => {
    const text = `${selected.title}\n\n${selected.description}`;
    if (text.length > 60000) {
      setErrors((old) => ({
        ...old,
        [selected.id]: "Ticket text exceeds the 60,000-character limit.",
      }));
      return;
    }
    triage.mutate({
      id: selected.id,
      text,
      mode,
      routingRevision: selected.routingRevision || 0,
    });
  };
  const importReport = async (file?: File) => {
    const ticketId = selected.id;
    if (!file) return;
    try {
      if (file.size > 1024 * 1024)
        throw new Error("Choose a JSON report smaller than 1 MB.");
      const report = parseReport(JSON.parse(await file.text()));
      update(
        ticketId,
        { report },
        `Imported Windows diagnostic report collected ${dateTime(report.collectedAt)}.`,
      );
      setErrors((old) => ({ ...old, [ticketId]: "" }));
      setNotice(`Diagnostic report attached to ${ticketId}.`);
    } catch (error) {
      setErrors((old) => ({
        ...old,
        [ticketId]:
          error instanceof SyntaxError
            ? "That file is not valid JSON. Export a report using the Relay collector."
            : (error as Error).message,
      }));
    } finally {
      if (reportInput.current) reportInput.current.value = "";
    }
  };
  const exportTicket = () => {
    downloadJson(`${selected.id.toLowerCase()}-escalation.json`, {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      application: "Relay portfolio prototype",
      ticket: selected,
      routingNote:
        "Routing is a suggestion, not a verified diagnosis. Local rules scores are illustrative.",
      runbook: runbooks[selected.category] || null,
    });
    setNotice(
      "Escalation packet exported. Review device details before sharing.",
    );
  };
  const rb = runbooks[selected.category];
  const busy = triage.isPending && triage.variables.id === selected.id;
  return (
    <div className="relay-app">
      <aside className="sidebar">
        <a className="wordmark" href="/apps/it/" aria-label="Relay home">
          <span className="brand-icon">
            <Layers3 size={22} />
          </span>
          relay<span className="brand-dot">.</span>
        </a>
        <div className="workspace-label">
          <span className="workspace-avatar">HS</span>
          <div>
            Hemant’s workspace<small>IT operations demo</small>
          </div>
        </div>
        <p className="nav-caption">WORKSPACE</p>
        <nav aria-label="Main navigation">
          <button
            className={view === "people" ? "nav-link selected" : "nav-link"}
            onClick={() => setView("people")}
          >
            <Users size={18} />
            People & access
          </button>
          <button
            className={view === "queue" ? "nav-link selected" : "nav-link"}
            onClick={() => setView("queue")}
          >
            <Inbox size={18} />
            Support queue<span className="nav-count">{active.length}</span>
          </button>
          <button
            className={view === "runbooks" ? "nav-link selected" : "nav-link"}
            onClick={() => setView("runbooks")}
          >
            <BookOpen size={18} />
            Runbook library<span className="nav-mini">6</span>
          </button>
          <button
            className={view === "access" ? "nav-link selected" : "nav-link"}
            onClick={() => setView("access")}
          >
            <ShieldCheck size={18} />
            Access audit
          </button>
          <button
            className={view === "operations" ? "nav-link selected" : "nav-link"}
            onClick={() => setView("operations")}
          >
            <Activity size={18} /> Operations review
          </button>
          <a className="nav-link" href="/api/collector" download>
            <Monitor size={18} />
            Windows collector
            <ArrowDownToLine size={15} />
          </a>
        </nav>
        <div className="sidebar-note">
          <span className="small-status-dot" /> Built for the human side of IT
          <p>
            Understand the issue.
            <br />
            Make the next step clear.
          </p>
        </div>
        <div className="sidebar-bottom">
          <div className="connection">
            <span
              className={
                config.data?.liveAvailable
                  ? "connection-dot ready"
                  : "connection-dot"
              }
            />
            <div>
              {config.data?.liveAvailable
                ? "Jev key configured"
                : "Local demo available"}
              <small>
                {config.data?.liveAvailable
                  ? config.data.model
                  : "No API key required"}
              </small>
            </div>
          </div>
          <a href="/">
            Portfolio projects
            <ArrowUpRight size={15} />
          </a>
        </div>
      </aside>
      <main className="workspace">
        <div className="topbar">
          <span>
            WORKSPACE <ChevronRight size={12} />{" "}
            {view === "queue"
              ? "SUPPORT QUEUE"
              : view === "people"
                ? "PEOPLE & ACCESS"
                : view === "access"
                  ? "ACCESS AUDIT"
                  : view === "operations"
                    ? "OPERATIONS REVIEW"
                    : "RUNBOOK LIBRARY"}
          </span>
          <div className="prototype-pill">
            <span />
            PORTFOLIO PROTOTYPE
          </div>
        </div>
        <header className="page-header">
          <div>
            <div className="eyebrow">A LITTLE LESS FRICTION</div>
            <h1>
              {view === "queue"
                ? "Good support starts here."
                : view === "people"
                  ? "The people behind the systems."
                  : view === "access"
                    ? "Offboarding with evidence."
                    : view === "operations"
                      ? "From tickets to better operations."
                      : "A clear next step."}
            </h1>
            <p>
              {view === "queue"
                ? "Turn a blocked workday into a clear, actionable next step."
                : view === "people"
                  ? "Follow the employee lifecycle from profile to access review."
                  : view === "access"
                    ? "Compare roster, SaaS access, and devices before declaring an exit complete."
                    : view === "operations"
                      ? "Assign ownership, document follow-through, and investigate repeated reports."
                      : "Six curated guides for investigating common employee issues."}
            </p>
          </div>
          {view === "queue" && (
            <div className="queue-header-actions">
              <button
                className="outline-button"
                onClick={() => {
                  if (
                    !window.confirm(
                      "Reset the synthetic support queue and remove locally saved ticket changes?",
                    )
                  )
                    return;
                  const seed = seedTickets();
                  setTickets(seed);
                  setSelectedId(seed[0].id);
                  setNotice("Synthetic support queue reset.");
                }}
              >
                Reset queue
              </button>
              <button
                className="primary-button"
                onClick={() => {
                  setTicketPerson(null);
                  setCreating(true);
                }}
              >
                <Plus size={17} />
                New ticket
              </button>
            </div>
          )}
        </header>
        {config.data?.liveRequiresToken && <LiveAccess />}
        {ticketStorageIssue && view === "queue" && (
          <p className="inline-error" role="alert">
            {ticketStorageIssue}
          </p>
        )}
        {view === "people" ? (
          <PeopleAdmin
            tickets={tickets}
            onOpenTicket={(id) => {
              setSelectedId(id);
              setView("queue");
              setFilter("All tickets");
              setSearch("");
              setMobileDetail(true);
            }}
            onRequestHelp={(person) => {
              setTicketPerson(person);
              setCreating(true);
            }}
            onAudit={(sources) => {
              setAuditSnapshot({ ...sources, id: crypto.randomUUID() });
              setView("access");
            }}
          />
        ) : view === "access" ? (
          <AccessAudit snapshot={auditSnapshot} />
        ) : view === "operations" ? (
          <Operations
            tickets={tickets}
            onOpenTicket={(id) => {
              setSelectedId(id);
              setView("queue");
              setFilter("All tickets");
              setSearch("");
              setMobileDetail(true);
            }}
            onLoadDrill={() => {
              setTickets((current) => loadIncidentDrill(current));
              setNotice(
                "Synthetic shared-session reports added. Review the pattern and record a work plan.",
              );
            }}
          />
        ) : view === "runbooks" ? (
          <section className="runbook-library">
            {Object.entries(runbooks).map(([category, book], i) => (
              <article className="library-card" key={category}>
                <div className="library-number">0{i + 1}</div>
                <span className="eyebrow">{category}</span>
                <h2>{book.title}</h2>
                <p>{book.note}</p>
                <ol>
                  {book.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
                <div className="escalation">
                  <ArrowUpRight size={16} />
                  <span>{book.escalate}</span>
                </div>
              </article>
            ))}
            <p className="library-disclaimer">
              Illustrative support guidance. Use your organization’s policies
              and authorized administrators. Relay does not execute changes.
            </p>
          </section>
        ) : (
          <>
            <section className="stats" aria-label="Queue summary">
              <div>
                <span className="stat-icon">
                  <Inbox size={19} />
                </span>
                <div>
                  <span className="stat-label">ACTIVE REQUESTS</span>
                  <strong>{active.length.toString().padStart(2, "0")}</strong>
                </div>
                <span className="stat-caption">People to help</span>
              </div>
              <div>
                <span className="stat-icon orange">
                  <Clock3 size={19} />
                </span>
                <div>
                  <span className="stat-label">AWAITING TRIAGE</span>
                  <strong>
                    {active
                      .filter((t) => t.category === "Untriaged")
                      .length.toString()
                      .padStart(2, "0")}
                  </strong>
                </div>
                <span className="stat-caption">Find the right next step</span>
              </div>
              <div>
                <span className="stat-icon green">
                  <CheckCircle2 size={19} />
                </span>
                <div>
                  <span className="stat-label">RESOLVED</span>
                  <strong>
                    {tickets
                      .filter((t) => t.status === "Resolved")
                      .length.toString()
                      .padStart(2, "0")}
                  </strong>
                </div>
                <span className="stat-caption">Back to work</span>
              </div>
            </section>
            <section
              className={`queue-shell ${mobileDetail ? "show-detail" : ""}`}
            >
              <div className="ticket-queue">
                <div className="queue-heading">
                  <h2>
                    Inbox <span>{visible.length}</span>
                  </h2>
                  <label className="sr-only" htmlFor="status-filter">
                    Filter tickets
                  </label>
                  <select
                    id="status-filter"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  >
                    {["Active", "All tickets", ...statuses].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div className="search-box">
                  <Search size={16} />
                  <input
                    aria-label="Search tickets"
                    placeholder="Search tickets, people…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div className="ticket-list">
                  {visible.map((t) => (
                    <button
                      key={t.id}
                      className={`ticket-row ${selectedId === t.id ? "active" : ""}`}
                      onClick={() => {
                        setSelectedId(t.id);
                        setMobileDetail(true);
                      }}
                    >
                      <div className="row-meta">
                        <span>{t.id}</span>
                        {t.priority === "High" ? (
                          <span className="priority">
                            <span />
                            HIGH PRIORITY
                          </span>
                        ) : (
                          <span>{t.status}</span>
                        )}
                      </div>
                      <h3>{t.title}</h3>
                      <p>{t.description}</p>
                      <div className="row-footer">
                        <span className="person">
                          <span className="avatar small">
                            {initials(t.employee)}
                          </span>
                          {t.employee}
                        </span>
                        <span
                          className={`category-dot ${t.category !== "Untriaged" ? "routed" : ""}`}
                          title={t.category}
                        />
                      </div>
                    </button>
                  ))}
                  {visible.length === 0 && (
                    <div className="empty-search">
                      <Search size={26} />
                      <h3>No matching tickets</h3>
                      <p>Try another search or filter.</p>
                      <button
                        className="text-button"
                        onClick={() => {
                          setSearch("");
                          setFilter("All tickets");
                        }}
                      >
                        Clear filters
                      </button>
                    </div>
                  )}
                </div>
                <div className="queue-footnote">
                  <ShieldCheck size={14} />
                  Saved in this browser · reset queue to clear
                </div>
              </div>
              <article className="ticket-detail">
                <button
                  className="mobile-back text-button"
                  onClick={() => setMobileDetail(false)}
                >
                  <ArrowLeft size={15} />
                  Back to queue
                </button>
                <div className="detail-id">
                  <span>
                    {selected.id}
                    <span className="id-divider">/</span>EMPLOYEE SUPPORT
                  </span>
                  <button className="export-button" onClick={exportTicket}>
                    <ArrowDownToLine size={15} />
                    Export packet
                  </button>
                </div>
                <h2>{selected.title}</h2>
                <div className="ticket-subhead">
                  <div className="person">
                    <span className="avatar">
                      {initials(selected.employee)}
                    </span>
                    <div>
                      <strong>{selected.employee}</strong>
                      <small>{selected.team}</small>
                    </div>
                  </div>
                  <label
                    className={`status-control ${selected.status === "Resolved" ? "resolved" : ""}`}
                  >
                    <span className="status-dot" />
                    <span className="sr-only">Ticket status</span>
                    <select
                      value={selected.status}
                      onChange={(e) => {
                        if (
                          e.target.value === "Resolved" &&
                          !selected.nextStep
                        ) {
                          setNotice(
                            "Record an owner and a resolution note in the work plan before resolving this ticket.",
                          );
                          return;
                        }
                        update(
                          selected.id,
                          { status: e.target.value as Status },
                          `Status changed to ${e.target.value}.`,
                        );
                      }}
                    >
                      {statuses.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="request-description">
                  <div className="section-label">
                    THE REQUEST<span>{dateTime(selected.createdAt)}</span>
                  </div>
                  <p>{selected.description}</p>
                  <span className="synthetic-label">
                    {selected.audit.some((a) => a.text.startsWith("Synthetic"))
                      ? "SYNTHETIC EXAMPLE"
                      : "MANUALLY CREATED"}
                  </span>
                </div>
                <TicketWork
                  key={selected.id}
                  ticket={selected}
                  onSave={(patch) => {
                    update(
                      selected.id,
                      patch,
                      `Work plan updated. Owner: ${patch.owner}. Note: ${patch.nextStep}`,
                    );
                    setNotice("Owner and work plan saved to this ticket.");
                  }}
                />
                <section className="triage-card">
                  <div className="card-title">
                    <span className="spark-icon">
                      <Sparkles size={18} />
                    </span>
                    <div>
                      <h3>A second set of eyes</h3>
                      <p>Structured routing. Human judgment.</p>
                    </div>
                    <span className="tiny-label">TRIAGE</span>
                  </div>
                  <div className="triage-controls">
                    <label>
                      Decision engine
                      <select
                        aria-label="Decision engine"
                        value={mode}
                        onChange={(e) => setMode(e.target.value as Mode)}
                      >
                        <option value="demo">Local rules · demo</option>
                        <option
                          value="live"
                          disabled={!config.data?.liveAvailable}
                        >
                          Jev · live
                          {!config.data?.liveAvailable ? " (key needed)" : ""}
                        </option>
                      </select>
                    </label>
                    <button
                      className="dark-button"
                      onClick={runTriage}
                      disabled={
                        triage.isPending ||
                        (mode === "live" && !config.data?.liveAvailable)
                      }
                    >
                      {busy ? (
                        <LoaderCircle className="spinning" size={16} />
                      ) : (
                        <Sparkles size={16} />
                      )}{" "}
                      {busy
                        ? "Routing…"
                        : selected.decision
                          ? "Run again"
                          : "Suggest routing"}
                    </button>
                  </div>
                  <p className="engine-note">
                    {mode === "demo"
                      ? "Demo uses deterministic local rules. Scores are illustrative, not calibrated confidence."
                      : `Sends this ticket’s title and description to ${config.data?.provider || "the Jev provider"}. Diagnostic reports are not sent.`}
                  </p>
                  {config.isError && (
                    <p className="inline-error">
                      Connection settings could not load. Live mode is
                      unavailable.
                    </p>
                  )}
                  {errors[selected.id] && (
                    <div className="inline-error" role="alert">
                      {errors[selected.id]}
                    </div>
                  )}
                  {selected.decision && (
                    <div className="decision-result">
                      <div className="result-top">
                        <span className="result-label">ROUTING SUGGESTION</span>
                        <span className="result-source">
                          {selected.decision.source === "jev"
                            ? `LIVE · JEV / ${selected.decision.model}`
                            : "DEMO · LOCAL RULES"}
                        </span>
                      </div>
                      <div className="decision-main">
                        <strong>{selected.decision.category}</strong>
                        <span>
                          {Math.round(selected.decision.confidence * 100)}%{" "}
                          <small>
                            {selected.decision.source === "jev"
                              ? "model confidence"
                              : "rule score"}
                          </small>
                        </span>
                      </div>
                      <div className="confidence-track">
                        <span
                          style={{
                            width: `${Math.round(selected.decision.confidence * 100)}%`,
                          }}
                        />
                      </div>
                      <p className="confidence-note">
                        {selected.decision.confidence < 0.75
                          ? "Uncertain routing: review the ticket before assigning an owner."
                          : "Review this suggestion against the employee’s report."}{" "}
                        {selected.decision.source === "local-rules"
                          ? "This score is for demonstration only."
                          : "Model confidence is not verified accuracy."}
                      </p>
                      <div
                        className={`attention-signal ${selected.decision.attention >= 0.65 ? "elevated" : ""}`}
                      >
                        <Clock3 size={14} />
                        <div>
                          <strong>
                            {selected.decision.attention >= 0.65
                              ? "Review urgency with the employee"
                              : "Check the reported business impact"}
                          </strong>
                          <p>
                            {selected.decision.attention >= 0.65
                              ? "The text may indicate a security concern, multiple affected people, or a time-sensitive interruption."
                              : "This result does not establish that the issue is low priority."}{" "}
                            Signal:{" "}
                            {Math.round(selected.decision.attention * 100)}%
                            {selected.decision.source === "local-rules"
                              ? " · illustrative rule score"
                              : " · model assessment"}
                            . Reported priority remains{" "}
                            {selected.priority.toLowerCase()}.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="manual-routing">
                    <label htmlFor="category-select">
                      Working category
                      <small>You can always correct the route.</small>
                    </label>
                    <select
                      id="category-select"
                      value={selected.category}
                      onChange={(e) =>
                        update(
                          selected.id,
                          {
                            category: e.target.value,
                            routingRevision:
                              (selected.routingRevision || 0) + 1,
                          },
                          `Working category manually set to ${e.target.value}.`,
                        )
                      }
                    >
                      <option>Untriaged</option>
                      {IT_CATEGORIES.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </section>
                <section className="evidence-section">
                  <div className="section-heading">
                    <div>
                      <h3>
                        <Activity size={17} />
                        Observed facts
                      </h3>
                      <p>Evidence from a read-only Windows collector.</p>
                    </div>
                    <button
                      className="outline-button"
                      onClick={() => reportInput.current?.click()}
                    >
                      <Upload size={14} />
                      Import JSON
                    </button>
                    <input
                      ref={reportInput}
                      type="file"
                      accept=".json,application/json"
                      aria-label="Import diagnostic report"
                      className="file-input"
                      onChange={(e) => void importReport(e.target.files?.[0])}
                    />
                  </div>
                  {selected.report ? (
                    <div className="diagnostic-report">
                      <div className="report-header">
                        <span>
                          <Monitor size={15} />
                          Windows · {dateTime(selected.report.collectedAt)}
                        </span>
                        <button
                          className="text-button"
                          onClick={() =>
                            update(
                              selected.id,
                              { report: undefined },
                              "Removed attached diagnostic report.",
                            )
                          }
                        >
                          Remove
                        </button>
                      </div>
                      <p>{selected.report.summary}</p>
                      <div className="checks">
                        {selected.report.checks.map((check, i) => (
                          <div className="check-row" key={`${check.name}-${i}`}>
                            <span className={`check-status ${check.status}`}>
                              {check.status === "pass" ? (
                                <Check size={13} />
                              ) : (
                                <Circle size={11} />
                              )}
                            </span>
                            <div>
                              <strong>{check.name}</strong>
                              <p>{check.detail}</p>
                            </div>
                            <div className="check-value">
                              {check.value}
                              <small>{check.status}</small>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="report-note">
                        Imported observations, not verified by Relay. Device
                        details may be sensitive; inspect the packet before
                        sharing.
                      </div>
                    </div>
                  ) : (
                    <div className="evidence-empty">
                      <div className="file-icon">
                        <FileJson size={25} />
                      </div>
                      <div>
                        <strong>No diagnostic report attached</strong>
                        <p>
                          Collect locally, inspect the report, then attach it
                          here.
                        </p>
                        <a href="/api/collector" download>
                          Download Windows collector{" "}
                          <ArrowDownToLine size={13} />
                        </a>
                      </div>
                      <span className="format-tag">JSON · ≤ 1 MB</span>
                    </div>
                  )}
                </section>
                <section className="runbook-section">
                  <div className="section-heading">
                    <div>
                      <h3>
                        <BookOpen size={17} />
                        Suggested next steps
                      </h3>
                      <p>Curated guidance, selected by the working category.</p>
                    </div>
                  </div>
                  {rb ? (
                    <div className="runbook">
                      <span className="runbook-tag">
                        RUNBOOK / {selected.category.toUpperCase()}
                      </span>
                      <h4>{rb.title}</h4>
                      <p>{rb.note}</p>
                      <ol>
                        {rb.steps.map((step, i) => (
                          <li key={step}>
                            <span>{i + 1}</span>
                            {step}
                          </li>
                        ))}
                      </ol>
                      <div className="escalation">
                        <ArrowUpRight size={16} />
                        <span>
                          <strong>Escalate to</strong> {rb.escalate}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="runbook-placeholder">
                      <BookOpen size={20} />
                      <p>
                        Suggest a route or choose a working category to see a
                        relevant runbook.
                      </p>
                    </div>
                  )}
                </section>
                <section className="audit-section">
                  <h3>
                    Activity trail<span>{selected.audit.length}</span>
                  </h3>
                  <ol>
                    {selected.audit.map((event, i) => (
                      <li key={`${event.at}-${i}`}>
                        <span className="audit-dot" />
                        <p>
                          {event.text}
                          <time>{dateTime(event.at)}</time>
                        </p>
                      </li>
                    ))}
                  </ol>
                </section>
                <footer className="detail-footer">
                  <ShieldCheck size={14} />
                  Relay suggests. You decide. No remediation runs automatically.
                </footer>
              </article>
            </section>
          </>
        )}
        <footer className="workspace-footer">
          A portfolio concept by Hemant Sarthak
          <span>Independent project · not affiliated with Rivet</span>
        </footer>
      </main>
      {notice && (
        <div className="toast" role="status">
          <CheckCircle2 size={17} />
          {notice}
          <button
            aria-label="Dismiss notification"
            onClick={() => setNotice("")}
          >
            <X size={14} />
          </button>
        </div>
      )}
      {creating && (
        <NewTicket
          initialPerson={ticketPerson}
          onClose={() => {
            setCreating(false);
            setTicketPerson(null);
          }}
          onCreate={(fields) => {
            const ticket: Ticket = {
              ...fields,
              id: `RLY-${Math.max(...tickets.map((t) => Number(t.id.slice(4)))) + 1}`,
              status: "Open",
              category: "Untriaged",
              createdAt: new Date().toISOString(),
              audit: [
                {
                  at: new Date().toISOString(),
                  text: "Ticket created manually in this browser.",
                },
              ],
            };
            setTickets((old) => [ticket, ...old]);
            setSelectedId(ticket.id);
            setCreating(false);
            setTicketPerson(null);
            setView("queue");
            setFilter("Active");
            setSearch("");
            setMobileDetail(true);
            setNotice(`${ticket.id} added to the queue.`);
          }}
        />
      )}
    </div>
  );
}

function NewTicket({
  initialPerson,
  onClose,
  onCreate,
}: {
  initialPerson?: { id: string; name: string; team: string } | null;
  onClose: () => void;
  onCreate: (
    fields: Pick<
      Ticket,
      "title" | "description" | "employee" | "employeeId" | "team" | "priority"
    >,
  ) => void;
}) {
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && dialog.current) {
        const focusable = dialog.current.querySelectorAll<HTMLElement>(
          "button, input, textarea, select",
        );
        const first = focusable[0],
          last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div
      className="modal-scrim"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal"
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-ticket-title"
      >
        <div className="modal-heading">
          <div>
            <span className="eyebrow">MAKE ROOM FOR GOOD SUPPORT</span>
            <h2 id="new-ticket-title">What’s getting in the way?</h2>
          </div>
          <button
            aria-label="Close new ticket"
            className="icon-button"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        <p>
          Use fictional details for this portfolio demo. Tickets save locally in
          this browser.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            const fields = {
              title: String(form.get("title")).trim(),
              description: String(form.get("description")).trim(),
              employee: String(form.get("employee")).trim(),
              employeeId: initialPerson?.id,
              team: String(form.get("team")).trim(),
              priority: String(form.get("priority")) as Ticket["priority"],
            };
            if (
              !fields.title ||
              !fields.description ||
              !fields.employee ||
              !fields.team
            ) {
              setError("Please complete each field.");
              return;
            }
            if (`${fields.title}\n\n${fields.description}`.length > 60000) {
              setError(
                "Keep the title and description under 60,000 characters together.",
              );
              return;
            }
            onCreate(fields);
          }}
        >
          <label>
            Short summary
            <input
              autoFocus
              name="title"
              required
              maxLength={200}
              placeholder="e.g. Remote desktop freezes during client reviews"
            />
          </label>
          <div className="form-row">
            <label>
              Employee
              <input
                name="employee"
                defaultValue={initialPerson?.name || ""}
                readOnly={Boolean(initialPerson)}
                required
                maxLength={100}
                placeholder="Full name"
              />
            </label>
            <label>
              Team
              <input
                name="team"
                defaultValue={initialPerson?.team || ""}
                readOnly={Boolean(initialPerson)}
                required
                maxLength={100}
                placeholder="e.g. Tax operations"
              />
            </label>
          </div>
          <label>
            What happened?
            <textarea
              name="description"
              required
              rows={5}
              maxLength={59000}
              placeholder="Describe the issue, who is affected, and the impact on their work. Never include passwords or recovery codes."
            />
          </label>
          <label>
            Reported priority
            <select name="priority">
              <option>Normal</option>
              <option>High</option>
            </select>
          </label>
          {error && (
            <p role="alert" className="inline-error">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <button className="outline-button" type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="primary-button" type="submit">
              <Plus size={16} />
              Create ticket
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);
