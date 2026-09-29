import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createClientWorkspace,
  getClientReadiness,
  setClientRequirements,
  addClientRequest,
} from "../apps/tax/client-workspace.ts";
import {
  summarizeOperations,
  loadIncidentDrill,
  recordTicketWork,
} from "../apps/it/operations.ts";

test("readiness requires reviewed current-year evidence and cannot hide open requests", () => {
  let workspace = createClientWorkspace("2026-09-30T00:00:00Z");
  assert.equal(getClientReadiness(workspace, "client-morgan").ready, true);
  assert.deepEqual(
    getClientReadiness(workspace, "client-alex").items.map(
      (item) => item.state,
    ),
    ["Missing", "Request drafted"],
  );
  workspace = setClientRequirements(workspace, "client-morgan", [
    "1099",
    "W-2",
  ]);
  assert.equal(getClientReadiness(workspace, "client-morgan").ready, false);
  workspace = addClientRequest(
    workspace,
    {
      clientId: "client-morgan",
      expectedYear: 2025,
      expectedForm: "W-2",
      context: "Missing wages",
    },
    "FOL-WAGES",
  );
  workspace = setClientRequirements(workspace, "client-morgan", ["1099"]);
  assert.equal(getClientReadiness(workspace, "client-morgan").ready, false);
  assert.throws(
    () =>
      addClientRequest(
        workspace,
        {
          clientId: "client-morgan",
          expectedYear: 2025,
          expectedForm: "W-2",
          context: "",
        },
        "FOL-DUPLICATE",
      ),
    /already exists/,
  );
  workspace = {
    ...workspace,
    clients: workspace.clients.map((client) =>
      client.id === "client-morgan" ? { ...client, taxYear: 2026 } : client,
    ),
  };
  assert.equal(
    getClientReadiness(workspace, "client-morgan").items[0].state,
    "Missing",
  );
});

test("operations groups repeated open reports and work plans change the worklist", () => {
  const tickets = loadIncidentDrill([], "2026-09-30T00:00:00Z");
  assert.equal(loadIncidentDrill(tickets).length, 2);
  let summary = summarizeOperations(tickets);
  assert.equal(summary.patterns.length, 1);
  assert.equal(summary.unowned, 2);
  const patch = recordTicketWork(
    tickets[0],
    "Hemant",
    "Compare remote hosts with platform team.",
  );
  const updated = tickets.map((ticket, index) =>
    index === 0 ? { ...ticket, ...patch, status: "Resolved" } : ticket,
  );
  summary = summarizeOperations(updated);
  assert.equal(summary.patterns.length, 0);
  assert.equal(summary.active, 1);
  assert.throws(() => recordTicketWork(tickets[0], "", "Check"), /owner/);
});
