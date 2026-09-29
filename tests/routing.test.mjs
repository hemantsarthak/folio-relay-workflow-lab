import { test } from "node:test";
import assert from "node:assert/strict";
import { applyRoutingDecision, seedTickets } from "../apps/it/data.ts";
const decision = {
  category: "Network",
  confidence: 0.9,
  probabilities: { Network: 1 },
  attention: 0.1,
  source: "local-rules",
  model: "local-rules-v1",
  latencyMs: 0,
};
test("a delayed model response preserves a newer manual routing decision", () => {
  const ticket = {
    ...seedTickets()[0],
    category: "Device",
    routingRevision: 1,
  };
  const updated = applyRoutingDecision(
    ticket,
    decision,
    0,
    "2026-09-22T00:00:00Z",
  );
  assert.equal(updated.category, "Device");
  assert.equal(updated.decision.category, "Network");
  assert.match(updated.audit[0].text, /kept/i);
});
test("a response updates the working category when no intervening manual edit occurred", () => {
  const ticket = seedTickets()[0];
  const updated = applyRoutingDecision(
    ticket,
    decision,
    0,
    "2026-09-22T00:00:00Z",
  );
  assert.equal(updated.category, "Network");
  assert.equal(updated.status, ticket.status);
  assert.equal(updated.id, ticket.id);
});
