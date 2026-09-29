import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createCase,
  extractTaxYear,
  issueRequest,
  receiveResponse,
  resolveCase,
  exportCase,
} from "../apps/tax/case.ts";

const at = "2026-09-27T00:00:00.000Z";
const correct = {
  name: "2025-k1.txt",
  text: "Schedule K-1 (Form 1065)\nTax year: 2025\nPartnership: Fieldwork Partners",
  category: "K-1",
  source: "local-rules",
  model: "local-rules-v1",
};

test("extracts an explicit tax year with source evidence and rejects conflicts", () => {
  assert.deepEqual(extractTaxYear("Tax year: 2025\nOther text"), {
    year: 2025,
    excerpt: "Tax year: 2025",
    page: 1,
    problem: null,
  });
  assert.equal(extractTaxYear("Tax year: 2024\nTax year: 2025").year, null);
  assert.equal(extractTaxYear("Schedule K-1 without a year").year, null);
});

test("question stays open until a matching attachment receives human review", () => {
  const seeded = createCase(at);
  assert.equal(seeded.initial.year, 2024);
  assert.equal(seeded.expectedYear, 2025);
  assert.throws(() => resolveCase(seeded, "Checked source", at));
  const requested = issueRequest(
    seeded,
    "Please upload your 2025 K-1 from Fieldwork Partners.",
    at,
  );
  const responded = receiveResponse(requested, correct, at);
  assert.equal(responded.status, "response-received");
  assert.equal(responded.response.year, 2025);
  const resolved = resolveCase(responded, "Verified the 2025 K-1", at);
  assert.equal(resolved.status, "resolved");
  assert.equal(resolved.events.length, 4);
  assert.equal(exportCase(resolved).response.text, undefined);
  assert.equal(exportCase(resolved).resolution.note, "Verified the 2025 K-1");
});

test("wrong-year response cannot close and can be requested again", () => {
  const requested = issueRequest(createCase(at), "Need the 2025 K-1", at);
  const wrong = receiveResponse(
    requested,
    { ...correct, text: correct.text.replace("2025", "2024") },
    at,
  );
  assert.equal(wrong.response.year, 2024);
  assert.throws(() => resolveCase(wrong, "Looks fine", at));
  const again = issueRequest(wrong, "Please send the 2025 version", at);
  assert.equal(again.status, "awaiting-client");
  assert.equal(again.response, null);
});

test("unsupported route and ambiguous year remain for review", () => {
  const requested = issueRequest(createCase(at), "Need a 2025 K-1", at);
  const wrongType = receiveResponse(
    requested,
    { ...correct, category: "1099" },
    at,
  );
  assert.throws(() => resolveCase(wrongType, "Checked", at));
  const ambiguous = receiveResponse(
    requested,
    { ...correct, text: "Tax year: 2024\nTax year: 2025" },
    at,
  );
  assert.equal(ambiguous.response.year, null);
  assert.throws(() => resolveCase(ambiguous, "Checked", at));
});
