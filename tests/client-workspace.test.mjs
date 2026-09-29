import { test } from "node:test";
import assert from "node:assert/strict";
import {
  issueRequest,
  receiveResponse,
  resolveCase,
} from "../apps/tax/case.ts";
import {
  addClient,
  addClientRequest,
  createClientWorkspace,
  editClient,
  exportClientWorkspace,
  replaceClientCase,
  setClientArchived,
} from "../apps/tax/client-workspace.ts";

const at = "2026-09-27T00:00:00.000Z";
const person = {
  name: "Dana Example",
  email: "Dana@example.com",
  organization: "Individual return",
  taxYear: 2025,
  notes: "Synthetic test client",
};

test("client directory separates cases and completes a new client's document request", () => {
  let workspace = createClientWorkspace(at);
  assert.equal(workspace.clients.length, 3);
  assert.equal(workspace.cases.length, 3);
  workspace = addClient(workspace, person, "client-dana", at);
  assert.equal(workspace.selectedClientId, "client-dana");
  assert.equal(workspace.selectedCaseId, null);
  workspace = addClientRequest(
    workspace,
    {
      clientId: "client-dana",
      expectedYear: 2025,
      expectedForm: "W-2",
      context: "Need the wage statement.",
    },
    "FOL-DANA",
    at,
  );
  const opened = workspace.cases.find((entry) => entry.id === "FOL-DANA");
  assert.equal(opened.initial, null);
  const requested = issueRequest(opened, "Please upload the 2025 W-2.", at);
  const responded = receiveResponse(
    requested,
    {
      name: "w2.txt",
      text: "Form W-2\nTax year: 2025\nEmployee: Dana Example",
      category: "W-2",
      source: "local-rules",
      model: "demo",
    },
    at,
  );
  workspace = replaceClientCase(
    workspace,
    resolveCase(responded, "Checked year and form header.", at),
  );
  assert.equal(
    workspace.cases.find((entry) => entry.id === "FOL-DANA").status,
    "resolved",
  );
  assert.equal(
    workspace.cases.find((entry) => entry.id === "FOL-2025-ALEX").status,
    "needs-request",
  );
  const exported = exportClientWorkspace(workspace);
  assert.equal(
    exported.requests.find((entry) => entry.caseId === "FOL-DANA").response
      .text,
    undefined,
  );
});

test("client validation, edit, and archive preserve request ownership", () => {
  let workspace = addClient(
    createClientWorkspace(at),
    person,
    "client-dana",
    at,
  );
  assert.throws(
    () =>
      addClient(
        workspace,
        { ...person, email: "dana@EXAMPLE.com" },
        "duplicate",
        at,
      ),
    /already exists/,
  );
  workspace = addClientRequest(
    workspace,
    {
      clientId: "client-dana",
      expectedYear: 2025,
      expectedForm: "1099",
      context: "",
    },
    "FOL-NEW",
    at,
  );
  workspace = editClient(workspace, "client-dana", {
    ...person,
    name: "Dana Updated",
  });
  assert.equal(
    workspace.cases.find((entry) => entry.id === "FOL-NEW").client,
    "Dana Updated",
  );
  workspace = setClientArchived(workspace, "client-dana", true);
  assert.throws(
    () =>
      addClientRequest(
        workspace,
        {
          clientId: "client-dana",
          expectedYear: 2025,
          expectedForm: "1099",
          context: "",
        },
        "FOL-NEXT",
        at,
      ),
    /active client/,
  );
});
