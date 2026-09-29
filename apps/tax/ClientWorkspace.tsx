import { useEffect, useState } from "react";
import {
  ArrowDownToLine,
  Archive,
  FolderPlus,
  Plus,
  Search,
  Users,
  X,
} from "lucide-react";
import { downloadJson } from "../../src/shared/api";
import CaseRoom from "./CaseRoom";
import { isQuestionCase } from "./case";
import {
  addClient,
  addClientRequest,
  createClientWorkspace,
  editClient,
  exportClientWorkspace,
  isClientWorkspace,
  replaceClientCase,
  setClientArchived,
  setClientRequirements,
  getClientReadiness,
  REQUIRED_FORMS,
  type ClientInput,
  type ClientWorkspaceData,
} from "./client-workspace";
import "./ClientWorkspace.css";

const STORAGE_KEY = "folio-client-workspace-v1";
const LEGACY_KEY = "folio-demo-case-v1";
const emptyClient: ClientInput = {
  name: "",
  email: "",
  organization: "",
  taxYear: 2025,
  notes: "",
};

function loadWorkspace(): ClientWorkspaceData {
  const seed = createClientWorkspace();
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed: unknown = JSON.parse(saved);
      if (isClientWorkspace(parsed)) return parsed;
    }
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const parsed: unknown = JSON.parse(legacy);
      if (isQuestionCase(parsed)) {
        seed.cases[0] = {
          ...parsed,
          clientId: "client-alex",
          context: "The 2024 K-1 on file does not answer the 2025 request.",
        };
      }
    }
  } catch {
    // The synthetic workspace remains usable when browser storage is blocked.
  }
  return seed;
}

export default function ClientWorkspace({
  liveAvailable,
  provider,
}: {
  liveAvailable: boolean;
  provider: string | null;
}) {
  const [workspace, setWorkspace] =
    useState<ClientWorkspaceData>(loadWorkspace);
  const [storageIssue, setStorageIssue] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "archived">("all");
  const [formMode, setFormMode] = useState<"add" | "edit" | null>(null);
  const [clientDraft, setClientDraft] = useState<ClientInput>(emptyClient);
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestDraft, setRequestDraft] = useState<{
    year: number;
    form: "K-1" | "W-2" | "1099";
    context: string;
  }>({ year: 2025, form: "K-1", context: "" });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
      localStorage.removeItem(LEGACY_KEY);
      setStorageIssue("");
    } catch {
      setStorageIssue(
        "Browser storage is unavailable. Export your work before closing this tab.",
      );
    }
  }, [workspace]);

  const selectedClient = workspace.clients.find(
    (client) => client.id === workspace.selectedClientId,
  )!;
  const clientCases = workspace.cases.filter(
    (caseData) => caseData.clientId === selectedClient.id,
  );
  const selectedCase =
    clientCases.find((caseData) => caseData.id === workspace.selectedCaseId) ||
    null;
  const visibleClients = workspace.clients.filter(
    (client) =>
      (filter === "all" || client.status === filter) &&
      `${client.name} ${client.email} ${client.organization}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const openCases = workspace.cases.filter(
    (caseData) => caseData.status !== "resolved",
  ).length;
  const awaiting = workspace.cases.filter(
    (caseData) => caseData.status === "awaiting-client",
  ).length;
  const readiness = getClientReadiness(workspace, selectedClient.id);

  const selectClient = (id: string) => {
    const first =
      workspace.cases.find(
        (caseData) =>
          caseData.clientId === id && caseData.status !== "resolved",
      ) || workspace.cases.find((caseData) => caseData.clientId === id);
    setWorkspace((current) => ({
      ...current,
      selectedClientId: id,
      selectedCaseId: first?.id || null,
    }));
    setFormMode(null);
    setRequestOpen(false);
    setError("");
  };

  const startAdd = () => {
    setClientDraft({ ...emptyClient, taxYear: 2025 });
    setFormMode("add");
    setRequestOpen(false);
    setError("");
  };
  const startEdit = () => {
    setClientDraft({
      name: selectedClient.name,
      email: selectedClient.email,
      organization: selectedClient.organization,
      taxYear: selectedClient.taxYear,
      notes: selectedClient.notes,
    });
    setFormMode("edit");
    setRequestOpen(false);
    setError("");
  };
  const saveClient = () => {
    try {
      const next =
        formMode === "add"
          ? addClient(workspace, clientDraft, `client-${crypto.randomUUID()}`)
          : editClient(workspace, selectedClient.id, clientDraft);
      setWorkspace(next);
      setNotice(
        formMode === "add"
          ? "Client added to the local workspace."
          : "Client profile updated.",
      );
      setFormMode(null);
      setError("");
    } catch (caught) {
      setError((caught as Error).message);
    }
  };
  const createRequest = () => {
    try {
      const next = addClientRequest(
        workspace,
        {
          clientId: selectedClient.id,
          expectedYear: requestDraft.year,
          expectedForm: requestDraft.form,
          context: requestDraft.context,
        },
        `FOL-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      );
      setWorkspace(next);
      setRequestOpen(false);
      setError("");
      setNotice(
        "Document request opened. Issue it from the preparer view below.",
      );
    } catch (caught) {
      setError((caught as Error).message);
    }
  };
  const reset = () => {
    if (
      !window.confirm(
        "Reset the synthetic Folio workspace and remove locally saved clients and requests?",
      )
    )
      return;
    setWorkspace(createClientWorkspace());
    setFormMode(null);
    setRequestOpen(false);
    setError("");
    setNotice("Synthetic workspace reset.");
  };

  return (
    <section className="client-workspace" aria-label="Client workspace">
      <div className="client-overview">
        <div>
          <span>CLIENT PORTFOLIO</span>
          <strong>
            {
              workspace.clients.filter((client) => client.status === "active")
                .length
            }
          </strong>
          <small>Active clients</small>
        </div>
        <div>
          <span>OPEN REQUESTS</span>
          <strong>{openCases}</strong>
          <small>Need a preparer or client</small>
        </div>
        <div>
          <span>AWAITING CLIENT</span>
          <strong>{awaiting}</strong>
          <small>Requests already issued</small>
        </div>
      </div>
      <div className="client-workspace-actions">
        <p>
          Synthetic client records and extracted documents save in this browser.
          Nothing is sent to a client.
        </p>
        <div>
          <button
            onClick={() =>
              downloadJson(
                "folio-client-workspace.json",
                exportClientWorkspace(workspace),
              )
            }
          >
            <ArrowDownToLine size={15} /> Export workspace
          </button>
          <button onClick={reset}>Reset demo</button>
        </div>
      </div>
      {storageIssue && (
        <div className="client-alert error" role="alert">
          {storageIssue}
        </div>
      )}
      {error && (
        <div className="client-alert error" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="client-alert" role="status">
          {notice}
        </div>
      )}
      <div className="client-workspace-shell">
        <aside className="client-directory" aria-label="Clients">
          <div className="client-directory-head">
            <div>
              <span>DIRECTORY</span>
              <h2>Clients</h2>
            </div>
            <button onClick={startAdd}>
              <Plus size={16} /> Add client
            </button>
          </div>
          <label className="client-search">
            <Search size={16} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search clients"
              aria-label="Search clients"
            />
          </label>
          <div className="client-filters" aria-label="Client status filter">
            {(["all", "active", "archived"] as const).map((option) => (
              <button
                key={option}
                className={filter === option ? "selected" : ""}
                onClick={() => setFilter(option)}
              >
                {option}
              </button>
            ))}
          </div>
          <div className="client-list">
            {visibleClients.length === 0 && (
              <p className="client-empty">No clients match this filter.</p>
            )}
            {visibleClients.map((client) => {
              const requests = workspace.cases.filter(
                (caseData) =>
                  caseData.clientId === client.id &&
                  caseData.status !== "resolved",
              ).length;
              return (
                <button
                  key={client.id}
                  className={`client-row ${client.id === selectedClient.id ? "selected" : ""}`}
                  onClick={() => selectClient(client.id)}
                >
                  <span className="client-avatar">
                    {client.name
                      .split(" ")
                      .map((part) => part[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()}
                  </span>
                  <span>
                    <strong>{client.name}</strong>
                    <small>{client.organization || client.email}</small>
                  </span>
                  <em>{requests}</em>
                </button>
              );
            })}
          </div>
        </aside>
        <div className="client-detail">
          {formMode ? (
            <section
              className="client-panel client-form"
              aria-label={formMode === "add" ? "Add client" : "Edit client"}
            >
              <div className="client-section-head">
                <div>
                  <span>CLIENT RECORD</span>
                  <h2>
                    {formMode === "add"
                      ? "Add a client"
                      : `Edit ${selectedClient.name}`}
                  </h2>
                </div>
                <button
                  onClick={() => {
                    setFormMode(null);
                    setError("");
                  }}
                  aria-label="Close client form"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="client-form-grid">
                <label>
                  Full name
                  <input
                    value={clientDraft.name}
                    onChange={(event) =>
                      setClientDraft((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    required
                  />
                </label>
                <label>
                  Email
                  <input
                    type="email"
                    value={clientDraft.email}
                    onChange={(event) =>
                      setClientDraft((current) => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                    required
                  />
                </label>
                <label>
                  Organization or matter
                  <input
                    value={clientDraft.organization}
                    onChange={(event) =>
                      setClientDraft((current) => ({
                        ...current,
                        organization: event.target.value,
                      }))
                    }
                    placeholder="Individual return"
                  />
                </label>
                <label>
                  Tax year
                  <input
                    type="number"
                    min="2000"
                    max="2100"
                    value={clientDraft.taxYear}
                    onChange={(event) =>
                      setClientDraft((current) => ({
                        ...current,
                        taxYear: Number(event.target.value),
                      }))
                    }
                  />
                </label>
              </div>
              <label>
                Internal notes
                <textarea
                  value={clientDraft.notes}
                  onChange={(event) =>
                    setClientDraft((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                  rows={3}
                />
              </label>
              <button className="client-primary" onClick={saveClient}>
                {formMode === "add" ? "Create client" : "Save profile"}
              </button>
            </section>
          ) : (
            <>
              <section className="client-panel client-profile">
                <div className="client-section-head">
                  <div>
                    <span>
                      {selectedClient.status.toUpperCase()} CLIENT ·{" "}
                      {selectedClient.taxYear} TAX YEAR
                    </span>
                    <h2>{selectedClient.name}</h2>
                    <p>{selectedClient.organization || "Individual return"}</p>
                  </div>
                  <div className="client-profile-actions">
                    <button onClick={startEdit}>Edit profile</button>
                    <button
                      onClick={() => {
                        setWorkspace((current) =>
                          setClientArchived(
                            current,
                            selectedClient.id,
                            selectedClient.status === "active",
                          ),
                        );
                        setNotice(
                          selectedClient.status === "active"
                            ? "Client archived; existing requests remain for review."
                            : "Client restored to active work.",
                        );
                      }}
                    >
                      <Archive size={15} />{" "}
                      {selectedClient.status === "active"
                        ? "Archive"
                        : "Restore"}
                    </button>
                  </div>
                </div>
                <div className="client-profile-meta">
                  <div>
                    <small>CONTACT</small>
                    <strong>{selectedClient.email}</strong>
                  </div>
                  <div>
                    <small>OPEN REQUESTS</small>
                    <strong>
                      {
                        clientCases.filter(
                          (caseData) => caseData.status !== "resolved",
                        ).length
                      }
                    </strong>
                  </div>
                  <div>
                    <small>INTERNAL NOTE</small>
                    <strong>{selectedClient.notes || "No note yet"}</strong>
                  </div>
                </div>
              </section>
              <section
                className="client-panel client-readiness"
                aria-label="Document readiness checklist"
              >
                <div className="client-section-head">
                  <div>
                    <span>{readiness.year} · DOCUMENT READINESS</span>
                    <h2>
                      {readiness.ready
                        ? "Ready for preparer handoff"
                        : "What still needs attention"}
                    </h2>
                  </div>
                  <strong>
                    {readiness.verified}/{readiness.items.length} verified
                  </strong>
                </div>
                <p>
                  Choose the document types expected for this client's current
                  year. Handoff requires a reviewed response for every selected
                  type.
                </p>
                <div className="client-requirements">
                  {REQUIRED_FORMS.map((form) => (
                    <label key={form}>
                      <input
                        type="checkbox"
                        checked={readiness.items.some(
                          (item) => item.form === form,
                        )}
                        disabled={selectedClient.status === "archived"}
                        onChange={(event) =>
                          setWorkspace((current) =>
                            setClientRequirements(
                              current,
                              selectedClient.id,
                              event.target.checked
                                ? [
                                    ...readiness.items.map((item) => item.form),
                                    form,
                                  ]
                                : readiness.items
                                    .filter((item) => item.form !== form)
                                    .map((item) => item.form),
                            ),
                          )
                        }
                      />{" "}
                      Expected {form}
                    </label>
                  ))}
                </div>
                {!readiness.items.length && (
                  <p>Select an expected type to begin the checklist.</p>
                )}
                <ul className="client-checklist">
                  {readiness.items.map((item) => (
                    <li key={item.form}>
                      <div>
                        <strong>
                          {readiness.year} {item.form}
                        </strong>
                        <span
                          className={
                            item.state === "Verified" ? "verified" : ""
                          }
                        >
                          {item.state}
                        </span>
                      </div>
                      <button
                        disabled={
                          !item.requestId &&
                          selectedClient.status === "archived"
                        }
                        onClick={() => {
                          if (item.requestId)
                            setWorkspace((current) => ({
                              ...current,
                              selectedCaseId: item.requestId,
                            }));
                          else {
                            setRequestDraft({
                              year: readiness.year,
                              form: item.form,
                              context: `The ${readiness.year} ${item.form} is missing from the expected document checklist.`,
                            });
                            setRequestOpen(true);
                            setError("");
                          }
                        }}
                      >
                        {item.requestId ? "Open request" : "Request document"}
                      </button>
                    </li>
                  ))}
                </ul>
                {readiness.openRequests > 0 && (
                  <p>
                    {readiness.openRequests} open request(s) for this year must
                    be resolved before handoff.
                  </p>
                )}
                {readiness.ready && (
                  <p className="client-ready-note">
                    All selected document questions are resolved. Tax
                    calculations and filing still require the preparer's
                    separate review.
                  </p>
                )}
              </section>
              <section className="client-panel client-requests">
                <div className="client-section-head">
                  <div>
                    <span>DOCUMENT WORK</span>
                    <h2>Requests</h2>
                  </div>
                  <button
                    className="client-primary"
                    disabled={selectedClient.status === "archived"}
                    onClick={() => {
                      setRequestDraft({
                        year: selectedClient.taxYear,
                        form: "K-1",
                        context: "",
                      });
                      setRequestOpen(true);
                      setError("");
                    }}
                  >
                    <FolderPlus size={16} /> New request
                  </button>
                </div>
                {requestOpen && (
                  <div
                    className="client-request-form"
                    aria-label="New document request"
                  >
                    <div className="client-form-grid">
                      <label>
                        Tax year
                        <input
                          type="number"
                          min="2000"
                          max="2100"
                          value={requestDraft.year}
                          onChange={(event) =>
                            setRequestDraft((current) => ({
                              ...current,
                              year: Number(event.target.value),
                            }))
                          }
                        />
                      </label>
                      <label>
                        Document type
                        <select
                          value={requestDraft.form}
                          onChange={(event) =>
                            setRequestDraft((current) => ({
                              ...current,
                              form: event.target.value as typeof current.form,
                            }))
                          }
                        >
                          <option>K-1</option>
                          <option>W-2</option>
                          <option>1099</option>
                        </select>
                      </label>
                    </div>
                    <label>
                      Why is it needed?
                      <textarea
                        rows={2}
                        value={requestDraft.context}
                        onChange={(event) =>
                          setRequestDraft((current) => ({
                            ...current,
                            context: event.target.value,
                          }))
                        }
                        placeholder="The current-year document is missing from the packet."
                      />
                    </label>
                    <div>
                      <button
                        className="client-primary"
                        onClick={createRequest}
                      >
                        Create request
                      </button>
                      <button onClick={() => setRequestOpen(false)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
                <div className="client-request-list">
                  {clientCases.length === 0 ? (
                    <div className="client-empty">
                      <Users size={23} />
                      <strong>No requests yet</strong>
                      <p>
                        Open a document request for this client to begin the
                        review loop.
                      </p>
                    </div>
                  ) : (
                    clientCases.map((caseData) => (
                      <button
                        key={caseData.id}
                        className={
                          caseData.id === selectedCase?.id ? "selected" : ""
                        }
                        onClick={() =>
                          setWorkspace((current) => ({
                            ...current,
                            selectedCaseId: caseData.id,
                          }))
                        }
                      >
                        <span>
                          <strong>
                            {caseData.expectedYear} {caseData.expectedForm}
                          </strong>
                          <small>{caseData.id}</small>
                        </span>
                        <em>{caseData.status.replaceAll("-", " ")}</em>
                      </button>
                    ))
                  )}
                </div>
              </section>
              {selectedCase && (
                <CaseRoom
                  key={selectedCase.id}
                  caseData={selectedCase}
                  onChange={(next) =>
                    setWorkspace((current) => replaceClientCase(current, next))
                  }
                  liveAvailable={liveAvailable}
                  provider={provider}
                />
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
