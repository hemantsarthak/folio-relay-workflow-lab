import {
  createCase,
  createClientCase,
  exportCase,
  isQuestionCase,
  issueRequest,
  receiveResponse,
  resolveCase,
  type QuestionCase,
} from "./case.ts";

export type ClientRecord = {
  id: string;
  name: string;
  email: string;
  organization: string;
  taxYear: number;
  status: "active" | "archived";
  notes: string;
  createdAt: string;
  requiredForms?: QuestionCase["expectedForm"][];
};

export type ClientWorkspaceData = {
  schemaVersion: 1;
  clients: ClientRecord[];
  cases: QuestionCase[];
  selectedClientId: string;
  selectedCaseId: string | null;
};

export type ClientInput = Pick<
  ClientRecord,
  "name" | "email" | "organization" | "taxYear" | "notes"
>;

function validateClient(
  input: ClientInput,
  others: ClientRecord[],
  selfId?: string,
) {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const organization = input.organization.trim();
  const notes = input.notes.trim();
  if (name.length < 2 || name.length > 100)
    throw new Error("Client name must be 2–100 characters.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 150)
    throw new Error("Enter a valid client email address.");
  if (others.some((client) => client.id !== selfId && client.email === email))
    throw new Error("A client with this email already exists.");
  if (organization.length > 100 || notes.length > 1000)
    throw new Error("Organization or notes are too long for this demo.");
  if (
    !Number.isInteger(input.taxYear) ||
    input.taxYear < 2000 ||
    input.taxYear > 2100
  )
    throw new Error("Choose a valid tax year between 2000 and 2100.");
  return { name, email, organization, taxYear: input.taxYear, notes };
}

export function createClientWorkspace(
  at = new Date().toISOString(),
): ClientWorkspaceData {
  const alex = createCase(at);
  const priya = issueRequest(
    createClientCase(
      {
        id: "FOL-2025-PRIYA",
        clientId: "client-priya",
        client: "Priya Chen",
        expectedYear: 2025,
        expectedForm: "W-2",
        context: "A wage statement has not arrived yet.",
      },
      at,
    ),
    "Please upload your 2025 W-2. We need the wage statement to complete the document review.",
    at,
  );
  const morganOpened = issueRequest(
    createClientCase(
      {
        id: "FOL-2025-MORGAN",
        clientId: "client-morgan",
        client: "Morgan Rivera",
        expectedYear: 2025,
        expectedForm: "1099",
        context: "The interest statement was missing from the packet.",
      },
      at,
    ),
    "Please upload your 2025 Form 1099-INT from the bank.",
    at,
  );
  const morgan = resolveCase(
    receiveResponse(
      morganOpened,
      {
        name: "morgan-2025-1099.txt",
        text: "SYNTHETIC DEMO DOCUMENT\nForm 1099-INT\nTax year: 2025\nRecipient: Morgan Rivera",
        category: "1099",
        source: "local-rules",
        model: "demo",
      },
      at,
    ),
    "Checked the year and document header against the source.",
    at,
  );
  return {
    schemaVersion: 1,
    clients: [
      {
        id: "client-alex",
        name: "Alex Sample",
        email: "alex.sample@example.com",
        organization: "Fieldwork Partners",
        taxYear: 2025,
        status: "active",
        notes: "Waiting on a current-year partnership statement.",
        createdAt: at,
        requiredForms: ["W-2", "K-1"],
      },
      {
        id: "client-priya",
        name: "Priya Chen",
        email: "priya.chen@example.com",
        organization: "Individual return",
        taxYear: 2025,
        status: "active",
        notes: "W-2 request is with the client.",
        createdAt: at,
        requiredForms: ["W-2", "1099"],
      },
      {
        id: "client-morgan",
        name: "Morgan Rivera",
        email: "morgan.rivera@example.com",
        organization: "Individual return",
        taxYear: 2025,
        status: "active",
        notes: "Interest statement reviewed.",
        createdAt: at,
        requiredForms: ["1099"],
      },
    ],
    cases: [alex, priya, morgan],
    selectedClientId: "client-alex",
    selectedCaseId: alex.id,
  };
}

export function addClient(
  workspace: ClientWorkspaceData,
  input: ClientInput,
  id: string,
  at = new Date().toISOString(),
): ClientWorkspaceData {
  if (!id || workspace.clients.some((client) => client.id === id))
    throw new Error("Could not create a unique client record.");
  if (workspace.clients.length >= 100)
    throw new Error("This demo supports up to 100 clients.");
  const client: ClientRecord = {
    id,
    ...validateClient(input, workspace.clients),
    status: "active",
    createdAt: at,
    requiredForms: [],
  };
  return {
    ...workspace,
    clients: [...workspace.clients, client],
    selectedClientId: id,
    selectedCaseId: null,
  };
}

export function editClient(
  workspace: ClientWorkspaceData,
  id: string,
  input: ClientInput,
): ClientWorkspaceData {
  if (!workspace.clients.some((client) => client.id === id))
    throw new Error("Client record was not found.");
  const fields = validateClient(input, workspace.clients, id);
  return {
    ...workspace,
    clients: workspace.clients.map((client) =>
      client.id === id ? { ...client, ...fields } : client,
    ),
    cases: workspace.cases.map((caseData) =>
      caseData.clientId === id
        ? { ...caseData, client: fields.name }
        : caseData,
    ),
  };
}

export function setClientArchived(
  workspace: ClientWorkspaceData,
  id: string,
  archived: boolean,
): ClientWorkspaceData {
  if (!workspace.clients.some((client) => client.id === id))
    throw new Error("Client record was not found.");
  return {
    ...workspace,
    clients: workspace.clients.map((client) =>
      client.id === id
        ? { ...client, status: archived ? "archived" : "active" }
        : client,
    ),
  };
}

export function addClientRequest(
  workspace: ClientWorkspaceData,
  input: {
    clientId: string;
    expectedYear: number;
    expectedForm: QuestionCase["expectedForm"];
    context: string;
  },
  id: string,
  at = new Date().toISOString(),
): ClientWorkspaceData {
  const client = workspace.clients.find(
    (person) => person.id === input.clientId,
  );
  if (!client || client.status !== "active")
    throw new Error("Choose an active client for this request.");
  if (workspace.cases.some((caseData) => caseData.id === id))
    throw new Error("Could not create a unique request.");
  if (workspace.cases.length >= 500)
    throw new Error("This demo supports up to 500 requests.");
  if (
    workspace.cases.some(
      (entry) =>
        entry.clientId === input.clientId &&
        entry.expectedYear === input.expectedYear &&
        entry.expectedForm === input.expectedForm &&
        entry.status !== "resolved",
    )
  )
    throw new Error(
      "An open request already exists for this client, form, and year. Continue that request.",
    );
  const next = createClientCase({ ...input, id, client: client.name }, at);
  return {
    ...workspace,
    cases: [...workspace.cases, next],
    selectedClientId: client.id,
    selectedCaseId: id,
  };
}

export function replaceClientCase(
  workspace: ClientWorkspaceData,
  next: QuestionCase,
): ClientWorkspaceData {
  const previous = workspace.cases.find((caseData) => caseData.id === next.id);
  if (!previous || previous.clientId !== next.clientId)
    throw new Error("Request does not belong to this client workspace.");
  return {
    ...workspace,
    cases: workspace.cases.map((caseData) =>
      caseData.id === next.id ? next : caseData,
    ),
  };
}

export function exportClientWorkspace(workspace: ClientWorkspaceData) {
  return {
    application: "Folio independent portfolio demo",
    exportedAt: new Date().toISOString(),
    clients: workspace.clients,
    requests: workspace.cases.map(exportCase),
    readiness: workspace.clients.map((client) =>
      getClientReadiness(workspace, client.id),
    ),
    note: "Synthetic local workspace; exports omit raw document text.",
  };
}

export const REQUIRED_FORMS = ["W-2", "1099", "K-1"] as const;

export function setClientRequirements(
  workspace: ClientWorkspaceData,
  clientId: string,
  forms: QuestionCase["expectedForm"][],
): ClientWorkspaceData {
  const client = workspace.clients.find((entry) => entry.id === clientId);
  if (!client || client.status !== "active")
    throw new Error("Choose an active client to change the checklist.");
  if (
    new Set(forms).size !== forms.length ||
    forms.some((form) => !REQUIRED_FORMS.includes(form))
  )
    throw new Error("Choose distinct supported document types.");
  return {
    ...workspace,
    clients: workspace.clients.map((entry) =>
      entry.id === clientId ? { ...entry, requiredForms: forms } : entry,
    ),
  };
}

export function getClientReadiness(
  workspace: ClientWorkspaceData,
  clientId: string,
) {
  const client = workspace.clients.find((entry) => entry.id === clientId);
  if (!client) throw new Error("Client was not found.");
  const cases = workspace.cases.filter(
    (entry) =>
      entry.clientId === clientId && entry.expectedYear === client.taxYear,
  );
  const forms = client.requiredForms ?? [
    ...new Set(cases.map((entry) => entry.expectedForm)),
  ];
  const items = forms.map((form) => {
    const matching = cases.filter((entry) => entry.expectedForm === form);
    const current =
      [...matching].reverse().find((entry) => entry.status !== "resolved") ||
      matching.at(-1);
    const state = !current
      ? "Missing"
      : current.status === "resolved"
        ? "Verified"
        : current.status === "response-received"
          ? "Needs review"
          : current.status === "awaiting-client"
            ? "Awaiting client"
            : "Request drafted";
    return { form, state, requestId: current?.id || null };
  });
  const verified = items.filter((item) => item.state === "Verified").length;
  const openRequests = cases.filter(
    (entry) => entry.status !== "resolved",
  ).length;
  return {
    clientId,
    year: client.taxYear,
    items,
    verified,
    openRequests,
    ready: items.length > 0 && verified === items.length && openRequests === 0,
  };
}

export function isClientWorkspace(
  value: unknown,
): value is ClientWorkspaceData {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<ClientWorkspaceData>;
  if (
    item.schemaVersion !== 1 ||
    !Array.isArray(item.clients) ||
    !Array.isArray(item.cases)
  )
    return false;
  if (item.clients.length > 100 || item.cases.length > 500) return false;
  return (
    item.clients.every(
      (client) =>
        client &&
        typeof client.id === "string" &&
        typeof client.name === "string" &&
        typeof client.email === "string" &&
        typeof client.taxYear === "number" &&
        (client.requiredForms === undefined ||
          (Array.isArray(client.requiredForms) &&
            client.requiredForms.every((form) =>
              REQUIRED_FORMS.includes(form),
            ))) &&
        ["active", "archived"].includes(client.status),
    ) &&
    item.cases.every(
      (caseData) =>
        isQuestionCase(caseData) && typeof caseData.clientId === "string",
    ) &&
    typeof item.selectedClientId === "string" &&
    (item.selectedCaseId === null || typeof item.selectedCaseId === "string") &&
    item.clients.some((client) => client.id === item.selectedClientId) &&
    (item.selectedCaseId === null ||
      item.cases.some((caseData) => caseData.id === item.selectedCaseId))
  );
}
