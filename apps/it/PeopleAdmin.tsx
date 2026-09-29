import { useEffect, useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  Laptop,
  Plus,
  Search,
  ShieldCheck,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { downloadJson } from "../../src/shared/api";
import type { Ticket } from "./data";
import {
  addAccount,
  addPerson,
  assignDevice,
  createPeopleWorkspace,
  departPerson,
  editPerson,
  isPeopleWorkspace,
  setAccountStatus,
  setDeviceStatus,
  toAuditInputs,
  type PersonInput,
  type PeopleWorkspace,
  type AccountStatus,
  type DeviceStatus,
} from "./people-admin";
import "./PeopleAdmin.css";

const STORAGE_KEY = "relay-people-workspace-v1";
const now = new Date();
const today = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  .toISOString()
  .slice(0, 10);
const blankPerson: PersonInput = {
  name: "",
  email: "",
  team: "",
  role: "",
  startDate: today,
};
function loadWorkspace(): PeopleWorkspace {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed: unknown = JSON.parse(saved);
      if (isPeopleWorkspace(parsed)) return parsed;
    }
  } catch {
    // The local demo still works when browser storage is unavailable.
  }
  return createPeopleWorkspace();
}

export default function PeopleAdmin({
  tickets,
  onOpenTicket,
  onRequestHelp,
  onAudit,
}: {
  tickets: Ticket[];
  onOpenTicket: (id: string) => void;
  onRequestHelp: (person: { id: string; name: string; team: string }) => void;
  onAudit: (sources: ReturnType<typeof toAuditInputs>) => void;
}) {
  const [workspace, setWorkspace] = useState<PeopleWorkspace>(loadWorkspace);
  const [mode, setMode] = useState<"admin" | "employee">("admin");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "departed">("all");
  const [personForm, setPersonForm] = useState<"add" | "edit" | null>(null);
  const [draft, setDraft] = useState<PersonInput>(blankPerson);
  const [departOpen, setDepartOpen] = useState(false);
  const [exitDate, setExitDate] = useState(today);
  const [operatorNote, setOperatorNote] = useState("");
  const [newApp, setNewApp] = useState("");
  const [newAsset, setNewAsset] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [storageIssue, setStorageIssue] = useState("");

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
      setStorageIssue("");
    } catch {
      setStorageIssue(
        "Browser storage is unavailable. Export a profile before closing this tab.",
      );
    }
  }, [workspace]);

  const selected = workspace.people.find(
    (person) => person.id === workspace.selectedPersonId,
  )!;
  const visible = workspace.people.filter(
    (person) =>
      (filter === "all" || person.status === filter) &&
      `${person.name} ${person.email} ${person.team}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const personTickets = tickets.filter(
    (ticket) =>
      ticket.employeeId === selected.id ||
      (!ticket.employeeId &&
        ticket.employee.toLowerCase() === selected.name.toLowerCase()),
  );
  const activeCount = workspace.people.filter(
    (person) => person.status === "active",
  ).length;
  const exposureCount = workspace.people
    .filter((person) => person.status === "departed")
    .reduce(
      (count, person) =>
        count +
        person.accounts.filter((account) => account.status === "active")
          .length +
        (person.device?.status === "assigned" ? 1 : 0),
      0,
    );

  const apply = (change: () => PeopleWorkspace, message: string) => {
    try {
      setWorkspace(change());
      setNotice(message);
      setError("");
      setOperatorNote("");
      return true;
    } catch (caught) {
      setError((caught as Error).message);
      return false;
    }
  };
  const select = (id: string) => {
    setWorkspace((current) => ({ ...current, selectedPersonId: id }));
    setPersonForm(null);
    setDepartOpen(false);
    setError("");
    setOperatorNote("");
  };
  const startAdd = () => {
    setDraft({ ...blankPerson });
    setPersonForm("add");
    setError("");
  };
  const startEdit = () => {
    setDraft({
      name: selected.name,
      email: selected.email,
      team: selected.team,
      role: selected.role,
      startDate: selected.startDate,
    });
    setPersonForm("edit");
    setError("");
  };
  const savePerson = () => {
    try {
      const next =
        personForm === "add"
          ? addPerson(workspace, draft, `person-${crypto.randomUUID()}`)
          : editPerson(workspace, selected.id, draft);
      setWorkspace(next);
      setNotice(
        personForm === "add"
          ? "Employee added to the demo directory. No account was provisioned."
          : "Employee profile updated.",
      );
      setError("");
      setPersonForm(null);
    } catch (caught) {
      setError((caught as Error).message);
    }
  };
  const reset = () => {
    if (
      !window.confirm(
        "Reset the synthetic Relay directory and remove locally saved admin changes?",
      )
    )
      return;
    setWorkspace(createPeopleWorkspace());
    setPersonForm(null);
    setError("");
    setNotice("Synthetic directory reset.");
  };

  return (
    <section className="people-admin" aria-label="People and access workspace">
      <div className="people-intro">
        <div>
          <span>PEOPLE & ACCESS · LOCAL SIMULATION</span>
          <h2>Know who has what.</h2>
          <p>
            Manage employee records, inspect access and devices, and hand off a
            current snapshot for review. No real identity or MDM action runs
            here.
          </p>
        </div>
        <Users size={30} />
      </div>
      <div className="people-stats">
        <div>
          <span>ACTIVE EMPLOYEES</span>
          <strong>{activeCount}</strong>
        </div>
        <div>
          <span>DEPARTED</span>
          <strong>{workspace.people.length - activeCount}</strong>
        </div>
        <div>
          <span>OPEN EXPOSURES</span>
          <strong>{exposureCount}</strong>
          <small>In this simulated directory</small>
        </div>
      </div>
      <div className="people-toolbar">
        <div className="people-role-switch" aria-label="View as">
          <button
            className={mode === "admin" ? "selected" : ""}
            onClick={() => setMode("admin")}
          >
            IT admin view
          </button>
          <button
            className={mode === "employee" ? "selected" : ""}
            onClick={() => setMode("employee")}
          >
            Employee view
          </button>
        </div>
        <div>
          <button onClick={() => onAudit(toAuditInputs(workspace))}>
            <ShieldCheck size={15} /> Audit directory snapshot{" "}
            <ArrowRight size={14} />
          </button>
          <button onClick={reset}>Reset demo</button>
        </div>
      </div>
      {storageIssue && (
        <div className="people-alert error" role="alert">
          {storageIssue}
        </div>
      )}
      {error && (
        <div className="people-alert error" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="people-alert" role="status">
          {notice}
        </div>
      )}
      <div className="people-layout">
        <aside className="people-directory">
          <div className="people-directory-head">
            <div>
              <span>DIRECTORY</span>
              <h3>Employees</h3>
            </div>
            {mode === "admin" && (
              <button onClick={startAdd}>
                <Plus size={15} /> Add
              </button>
            )}
          </div>
          <label className="people-search">
            <Search size={15} />
            <input
              aria-label="Search employees"
              placeholder="Search people"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <div className="people-filters">
            {(["all", "active", "departed"] as const).map((option) => (
              <button
                key={option}
                className={filter === option ? "selected" : ""}
                onClick={() => setFilter(option)}
              >
                {option}
              </button>
            ))}
          </div>
          <div className="people-list">
            {visible.length === 0 && <p>No employees match.</p>}
            {visible.map((person) => (
              <button
                key={person.id}
                className={person.id === selected.id ? "selected" : ""}
                onClick={() => select(person.id)}
              >
                <span className="people-avatar">
                  {person.name
                    .split(" ")
                    .map((part) => part[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()}
                </span>
                <span>
                  <strong>{person.name}</strong>
                  <small>{person.team}</small>
                </span>
                <em className={person.status}>{person.status}</em>
              </button>
            ))}
          </div>
        </aside>
        <div className="people-detail">
          {personForm && mode === "admin" ? (
            <section
              className="people-panel people-form"
              aria-label={
                personForm === "add" ? "Add employee" : "Edit employee"
              }
            >
              <div className="people-section-head">
                <div>
                  <span>DIRECTORY RECORD</span>
                  <h3>
                    {personForm === "add"
                      ? "Add employee"
                      : `Edit ${selected.name}`}
                  </h3>
                </div>
                <button
                  onClick={() => setPersonForm(null)}
                  aria-label="Close employee form"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="people-form-grid">
                <label>
                  Full name
                  <input
                    value={draft.name}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Work email
                  <input
                    type="email"
                    value={draft.email}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Team
                  <input
                    value={draft.team}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        team: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Role
                  <input
                    value={draft.role}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        role: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Start date
                  <input
                    type="date"
                    value={draft.startDate}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        startDate: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>
              <button className="people-primary" onClick={savePerson}>
                {personForm === "add" ? "Create employee" : "Save profile"}
              </button>
              <p>Creating a record does not provision a real account.</p>
            </section>
          ) : (
            <>
              <section className="people-panel people-profile">
                <div className="people-section-head">
                  <div>
                    <span>
                      {mode === "admin" ? "IT ADMIN VIEW" : "EMPLOYEE VIEW"} ·{" "}
                      {selected.status.toUpperCase()}
                    </span>
                    <h3>{selected.name}</h3>
                    <p>
                      {selected.role} · {selected.team}
                    </p>
                  </div>
                  <div className="people-profile-actions">
                    {mode === "admin" && (
                      <button onClick={startEdit}>Edit profile</button>
                    )}
                    <button
                      onClick={() =>
                        downloadJson(`${selected.id}-profile.json`, {
                          application: "Relay local demo",
                          person: selected,
                          note: "Simulated directory record. No admin system was changed.",
                        })
                      }
                    >
                      <ArrowDownToLine size={15} /> Export
                    </button>
                  </div>
                </div>
                <div className="people-meta">
                  <div>
                    <small>WORK EMAIL</small>
                    <strong>{selected.email}</strong>
                  </div>
                  <div>
                    <small>START DATE</small>
                    <strong>{selected.startDate}</strong>
                  </div>
                  <div>
                    <small>
                      {selected.status === "departed" ? "EXIT DATE" : "STATUS"}
                    </small>
                    <strong>
                      {selected.status === "departed"
                        ? selected.exitDate
                        : "Active"}
                    </strong>
                  </div>
                </div>
              </section>
              {mode === "employee" ? (
                <>
                  <section className="people-panel">
                    <div className="people-section-head">
                      <div>
                        <span>MY WORKSPACE</span>
                        <h3>Help and equipment</h3>
                      </div>
                      <button
                        className="people-primary"
                        disabled={selected.status === "departed"}
                        onClick={() =>
                          onRequestHelp({
                            id: selected.id,
                            name: selected.name,
                            team: selected.team,
                          })
                        }
                      >
                        <Plus size={15} /> Request help
                      </button>
                    </div>
                    <div className="people-access-summary">
                      <div>
                        <UserRound size={19} />
                        <strong>{selected.accounts.length} applications</strong>
                        <small>
                          {selected.accounts
                            .map(
                              (account) =>
                                `${account.system} (${account.status})`,
                            )
                            .join(", ") || "No applications recorded"}
                        </small>
                      </div>
                      <div>
                        <Laptop size={19} />
                        <strong>
                          {selected.device?.assetId || "No device"}
                        </strong>
                        <small>
                          {selected.device?.status || "No assignment recorded"}
                        </small>
                      </div>
                    </div>
                    <p className="people-note">
                      This is a read-only employee perspective of the synthetic
                      directory. For access changes, contact an authorized IT
                      admin.
                    </p>
                  </section>
                  <section className="people-panel">
                    <div className="people-section-head">
                      <div>
                        <span>SUPPORT</span>
                        <h3>My requests</h3>
                      </div>
                    </div>
                    {personTickets.length ? (
                      <div className="people-tickets">
                        {personTickets.map((ticket) => (
                          <button
                            key={ticket.id}
                            onClick={() => onOpenTicket(ticket.id)}
                          >
                            <span>
                              <strong>{ticket.title}</strong>
                              <small>{ticket.id}</small>
                            </span>
                            <em>{ticket.status}</em>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="people-note">
                        No support tickets are linked to this employee name.
                      </p>
                    )}
                  </section>
                </>
              ) : (
                <>
                  <section className="people-panel">
                    <div className="people-section-head">
                      <div>
                        <span>ACCESS & DEVICES</span>
                        <h3>Provisioning record</h3>
                      </div>
                    </div>
                    <p className="people-note">
                      Set an operator note before changing a simulated status.
                      Refresh the audit snapshot to see the effect.
                    </p>
                    <label className="people-operator-note">
                      Operator note
                      <input
                        value={operatorNote}
                        onChange={(event) =>
                          setOperatorNote(event.target.value)
                        }
                        placeholder="What did you check or change? (8+ characters)"
                      />
                    </label>
                    <div className="people-access-grid">
                      <div>
                        <h4>Applications</h4>
                        {selected.accounts.length === 0 && (
                          <p>No applications recorded.</p>
                        )}
                        {selected.accounts.map((account) => (
                          <div
                            className="people-access-row"
                            key={account.system}
                          >
                            <span>
                              <strong>{account.system}</strong>
                              <small>Current demo status</small>
                            </span>
                            <select
                              aria-label={`${account.system} status`}
                              value={account.status}
                              onChange={(event) =>
                                apply(
                                  () =>
                                    setAccountStatus(
                                      workspace,
                                      selected.id,
                                      account.system,
                                      event.target.value as AccountStatus,
                                      operatorNote,
                                    ),
                                  `${account.system} status updated locally.`,
                                )
                              }
                            >
                              <option value="active">Active</option>
                              <option value="suspended">Suspended</option>
                              <option value="disabled">Disabled</option>
                            </select>
                          </div>
                        ))}
                        {selected.status === "active" && (
                          <div className="people-add-row">
                            <input
                              aria-label="Application name"
                              placeholder="Application name"
                              value={newApp}
                              onChange={(event) =>
                                setNewApp(event.target.value)
                              }
                            />
                            <button
                              onClick={() => {
                                if (
                                  apply(
                                    () =>
                                      addAccount(
                                        workspace,
                                        selected.id,
                                        newApp,
                                        operatorNote,
                                      ),
                                    "Application added to the simulated record.",
                                  )
                                )
                                  setNewApp("");
                              }}
                            >
                              Add app
                            </button>
                          </div>
                        )}
                      </div>
                      <div>
                        <h4>Device</h4>
                        {selected.device ? (
                          <div className="people-access-row">
                            <span>
                              <strong>{selected.device.assetId}</strong>
                              <small>Recorded asset</small>
                            </span>
                            <select
                              aria-label="Device status"
                              value={selected.device.status}
                              onChange={(event) =>
                                apply(
                                  () =>
                                    setDeviceStatus(
                                      workspace,
                                      selected.id,
                                      event.target.value as DeviceStatus,
                                      operatorNote,
                                    ),
                                  "Device status updated locally.",
                                )
                              }
                            >
                              <option value="assigned">Assigned</option>
                              <option value="returned">Returned</option>
                              <option value="wiped">Wiped</option>
                            </select>
                          </div>
                        ) : (
                          <p>No device recorded.</p>
                        )}
                        {selected.status === "active" &&
                          selected.device?.status !== "assigned" && (
                            <div className="people-add-row">
                              <input
                                aria-label="Asset ID"
                                placeholder="Asset ID"
                                value={newAsset}
                                onChange={(event) =>
                                  setNewAsset(event.target.value)
                                }
                              />
                              <button
                                onClick={() => {
                                  if (
                                    apply(
                                      () =>
                                        assignDevice(
                                          workspace,
                                          selected.id,
                                          newAsset,
                                          operatorNote,
                                        ),
                                      "Device assigned in the simulated record.",
                                    )
                                  )
                                    setNewAsset("");
                                }}
                              >
                                Assign
                              </button>
                            </div>
                          )}
                      </div>
                    </div>
                  </section>
                  <section className="people-panel people-lifecycle">
                    <div className="people-section-head">
                      <div>
                        <span>LIFECYCLE</span>
                        <h3>
                          {selected.status === "active"
                            ? "Departure handoff"
                            : "Offboarding worklist"}
                        </h3>
                      </div>
                      {selected.status === "active" && (
                        <button
                          onClick={() => {
                            setDepartOpen(true);
                            setError("");
                          }}
                        >
                          Start offboarding
                        </button>
                      )}
                    </div>
                    {selected.status === "active" ? (
                      <p className="people-note">
                        Marking a departure leaves the current access and device
                        statuses visible for follow-up. It does not disable
                        anything.
                      </p>
                    ) : (
                      <div className="people-checklist">
                        <div
                          className={
                            selected.accounts.some(
                              (account) => account.status === "active",
                            )
                              ? "open"
                              : "done"
                          }
                        >
                          {selected.accounts.some(
                            (account) => account.status === "active",
                          )
                            ? "Open"
                            : "Checked"}{" "}
                          · SaaS access{" "}
                          {
                            selected.accounts.filter(
                              (account) => account.status === "active",
                            ).length
                          }{" "}
                          active
                        </div>
                        <div
                          className={
                            selected.device?.status === "assigned"
                              ? "open"
                              : "done"
                          }
                        >
                          {selected.device?.status === "assigned"
                            ? "Open"
                            : "Checked"}{" "}
                          · Device {selected.device?.status || "not recorded"}
                        </div>
                        <p>
                          These checks reflect this local record only. Confirm
                          the source systems before completing real offboarding.
                        </p>
                      </div>
                    )}
                    {departOpen && (
                      <div className="people-depart-form">
                        <label>
                          Exit date
                          <input
                            type="date"
                            value={exitDate}
                            onChange={(event) =>
                              setExitDate(event.target.value)
                            }
                          />
                        </label>
                        <label>
                          Operator note
                          <textarea
                            value={operatorNote}
                            onChange={(event) =>
                              setOperatorNote(event.target.value)
                            }
                            rows={2}
                            placeholder="Departure confirmed with People Ops…"
                          />
                        </label>
                        <div>
                          <button
                            className="people-primary"
                            onClick={() => {
                              try {
                                setWorkspace(
                                  departPerson(
                                    workspace,
                                    selected.id,
                                    exitDate,
                                    operatorNote,
                                  ),
                                );
                                setDepartOpen(false);
                                setOperatorNote("");
                                setError("");
                                setNotice(
                                  "Departure recorded. Run the access audit to identify open items.",
                                );
                              } catch (caught) {
                                setError((caught as Error).message);
                              }
                            }}
                          >
                            Record departure
                          </button>
                          <button onClick={() => setDepartOpen(false)}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </section>
                  <section className="people-panel">
                    <div className="people-section-head">
                      <div>
                        <span>ACTIVITY</span>
                        <h3>Admin record</h3>
                      </div>
                    </div>
                    <ol className="people-history">
                      {selected.events.map((entry, index) => (
                        <li key={`${entry.at}-${index}`}>
                          <strong>{entry.action}</strong>
                          <span>{entry.note}</span>
                          <small>{new Date(entry.at).toLocaleString()}</small>
                        </li>
                      ))}
                    </ol>
                  </section>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
