export type TaxYearEvidence = {
  year: number | null;
  excerpt: string;
  page: number | null;
  problem: string | null;
};

export type CaseDocument = TaxYearEvidence & {
  name: string;
  text: string;
  category: string;
  source: string;
  model: string;
};

export type CaseEvent = {
  actor: "system" | "preparer" | "client";
  at: string;
  action: string;
};

export type QuestionCase = {
  schemaVersion: 1;
  id: string;
  clientId: string;
  client: string;
  expectedYear: number;
  expectedForm: "K-1" | "W-2" | "1099";
  context: string;
  status:
    "needs-request" | "awaiting-client" | "response-received" | "resolved";
  initial: CaseDocument | null;
  request: { text: string; at: string } | null;
  response: (CaseDocument & { reply: string; at: string }) | null;
  resolution: { note: string; at: string } | null;
  events: CaseEvent[];
};

const seedText =
  "SYNTHETIC DEMO DOCUMENT — NOT FOR FILING\nSchedule K-1 (Form 1065)\nTax year: 2024\nPartnership: Fieldwork Partners (fictional)\nPartner: Alex Sample (fictional)\nOrdinary business income: $3,400.00";

export function extractTaxYear(text: string): TaxYearEvidence {
  const matches = [...text.matchAll(/tax\s*year\s*[:—-]?\s*(20\d{2})/gi)];
  if (matches.length === 0)
    return {
      year: null,
      excerpt: "",
      page: null,
      problem: "No explicit tax year was found in the readable text.",
    };
  const years = new Set(matches.map((match) => Number(match[1])));
  if (years.size !== 1)
    return {
      year: null,
      excerpt: "",
      page: null,
      problem: "Conflicting tax years appear in this document.",
    };
  const index = matches[0].index || 0;
  const lineStart = Math.max(text.lastIndexOf("\n", index) + 1, index - 40);
  const lineEnd = Math.min(
    text.indexOf("\n", index) === -1 ? text.length : text.indexOf("\n", index),
    index + 120,
  );
  const pageMarkers = [...text.slice(0, index).matchAll(/— Page (\d+) —/g)];
  return {
    year: [...years][0],
    excerpt: text.slice(lineStart, lineEnd).trim(),
    page: pageMarkers.length ? Number(pageMarkers.at(-1)?.[1]) : 1,
    problem: null,
  };
}

export function createCase(at = new Date().toISOString()): QuestionCase {
  return {
    schemaVersion: 1,
    id: "FOL-2025-ALEX",
    clientId: "client-alex",
    client: "Alex Sample",
    expectedYear: 2025,
    expectedForm: "K-1",
    context: "The 2024 K-1 on file does not answer the 2025 request.",
    status: "needs-request",
    initial: {
      name: "2024_K1_Fieldwork.txt",
      text: seedText,
      category: "K-1",
      source: "synthetic-fixture",
      model: "none",
      ...extractTaxYear(seedText),
    },
    request: null,
    response: null,
    resolution: null,
    events: [
      { actor: "system", at, action: "Synthetic wrong-year K-1 received." },
    ],
  };
}

export function createClientCase(
  input: {
    id: string;
    clientId: string;
    client: string;
    expectedYear: number;
    expectedForm: QuestionCase["expectedForm"];
    context: string;
  },
  at = new Date().toISOString(),
): QuestionCase {
  if (!input.id || !input.clientId || !input.client.trim())
    throw new Error("Choose a client before creating a request.");
  if (
    !Number.isInteger(input.expectedYear) ||
    input.expectedYear < 2000 ||
    input.expectedYear > 2100
  )
    throw new Error("Choose a valid tax year between 2000 and 2100.");
  if (!["K-1", "W-2", "1099"].includes(input.expectedForm))
    throw new Error("Choose a supported document type.");
  if (input.context.trim().length > 500)
    throw new Error("Keep the request context under 500 characters.");
  return {
    schemaVersion: 1,
    id: input.id,
    clientId: input.clientId,
    client: input.client.trim(),
    expectedYear: input.expectedYear,
    expectedForm: input.expectedForm,
    context: input.context.trim(),
    status: "needs-request",
    initial: null,
    request: null,
    response: null,
    resolution: null,
    events: [
      {
        actor: "preparer",
        at,
        action: `Opened a ${input.expectedYear} ${input.expectedForm} request.`,
      },
    ],
  };
}

export function issueRequest(
  current: QuestionCase,
  text: string,
  at = new Date().toISOString(),
): QuestionCase {
  const message = text.trim();
  if (message.length < 10 || message.length > 2000)
    throw new Error(
      "Write a specific request between 10 and 2,000 characters.",
    );
  if (current.status === "resolved")
    throw new Error("Reopen this case before sending another request.");
  return {
    ...current,
    status: "awaiting-client",
    request: { text: message, at },
    response: null,
    events: [
      ...current.events,
      {
        actor: "preparer",
        at,
        action: `Requested a ${current.expectedYear} ${current.expectedForm}.`,
      },
    ],
  };
}

export function receiveResponse(
  current: QuestionCase,
  input: {
    name: string;
    text: string;
    category: string;
    source: string;
    model: string;
    reply?: string;
  },
  at = new Date().toISOString(),
): QuestionCase {
  if (current.status !== "awaiting-client")
    throw new Error("The preparer must issue a request before a response.");
  if (!input.name.trim() || !input.text.trim() || input.text.length > 60000)
    throw new Error(
      "Attach a readable document with no more than 60,000 characters.",
    );
  return {
    ...current,
    status: "response-received",
    response: {
      name: input.name,
      text: input.text,
      category: input.category,
      source: input.source,
      model: input.model,
      reply: (input.reply || "").trim(),
      at,
      ...extractTaxYear(input.text),
    },
    events: [
      ...current.events,
      { actor: "client", at, action: `Responded with ${input.name}.` },
    ],
  };
}

export function responseIssue(current: QuestionCase): string | null {
  const response = current.response;
  if (!response) return "No replacement document has been received.";
  if (response.problem) return response.problem;
  if (response.year !== current.expectedYear)
    return `This document says ${response.year}; the case needs ${current.expectedYear}.`;
  if (response.category !== current.expectedForm)
    return `The routing suggestion is ${response.category}, not ${current.expectedForm}. Review the attachment before closing.`;
  return null;
}

export function resolveCase(
  current: QuestionCase,
  note: string,
  at = new Date().toISOString(),
): QuestionCase {
  if (current.status !== "response-received" || responseIssue(current))
    throw new Error(responseIssue(current) || "A client response is required.");
  if (note.trim().length < 8)
    throw new Error("Record how you verified the replacement document.");
  return {
    ...current,
    status: "resolved",
    resolution: { note: note.trim(), at },
    events: [
      ...current.events,
      {
        actor: "preparer",
        at,
        action: "Verified response and closed the question.",
      },
    ],
  };
}

export function exportCase(current: QuestionCase) {
  const initial = current.initial
    ? (({ text: _initialText, ...rest }) => rest)(current.initial)
    : null;
  const response = current.response
    ? (({ text: _responseText, ...rest }) => rest)(current.response)
    : null;
  return {
    schemaVersion: 1,
    application: "Folio independent portfolio demo",
    caseId: current.id,
    clientId: current.clientId,
    client: current.client,
    expectedYear: current.expectedYear,
    expectedForm: current.expectedForm,
    context: current.context,
    status: current.status,
    initial,
    request: current.request,
    response,
    resolution: current.resolution,
    events: current.events,
    note: "This is a synthetic review record, not a tax determination or filing.",
  };
}

export function isQuestionCase(value: unknown): value is QuestionCase {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<QuestionCase>;
  return (
    item.schemaVersion === 1 &&
    typeof item.id === "string" &&
    item.id.length < 100 &&
    typeof item.client === "string" &&
    item.client.length < 150 &&
    Number.isInteger(item.expectedYear) &&
    ["K-1", "W-2", "1099"].includes(item.expectedForm || "") &&
    [
      "needs-request",
      "awaiting-client",
      "response-received",
      "resolved",
    ].includes(item.status || "") &&
    (item.initial === null ||
      (!!item.initial &&
        typeof item.initial.text === "string" &&
        item.initial.text.length <= 60000)) &&
    Array.isArray(item.events) &&
    item.events.length <= 100
  );
}
