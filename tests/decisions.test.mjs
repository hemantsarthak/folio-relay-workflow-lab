import { test } from "node:test";
import assert from "node:assert/strict";
import { decide, buildQuestions } from "../server/decisions.mjs";

test("demo classifies clear tax forms but leaves ambiguous text uncertain", async () => {
  const answer = await decide({
    kind: "tax",
    text: "Form W-2 Wage and Tax Statement 2025",
    mode: "demo",
  });
  assert.equal(answer.category, "W-2");
  assert.equal(answer.source, "local-rules");
  assert.ok(answer.confidence > 0.8);
  const unknown = await decide({
    kind: "tax",
    text: "Dear team, attached are my documents.",
    mode: "demo",
  });
  assert.equal(unknown.category, "Other");
  assert.ok(unknown.confidence < 0.5);
});
test("conflicting form headers do not receive high confidence", async () => {
  const result = await decide({
    kind: "tax",
    text: "Form W-2 and Form 1099-NEC combined packet",
    mode: "demo",
  });
  assert.equal(result.category, "Other");
  assert.ok(result.confidence < 0.5);
});
test("IT routes remote desktop and access issues without running actions", async () => {
  assert.equal(
    (
      await decide({
        kind: "it",
        text: "Remote desktop freezes and RDP disconnects",
        mode: "demo",
      })
    ).category,
    "Remote desktop",
  );
  assert.equal(
    (
      await decide({
        kind: "it",
        text: "My MFA authenticator login fails",
        mode: "demo",
      })
    ).category,
    "Identity & access",
  );
});
test("bad inputs are rejected before a provider call", async () => {
  for (const input of [
    { kind: "invalid", text: "Hello", mode: "demo" },
    { kind: "tax", text: " ", mode: "demo" },
    { kind: "tax", text: "x".repeat(60001), mode: "demo" },
    { kind: "tax", text: "hello", mode: "oops" },
  ]) {
    await assert.rejects(decide(input), (e) => e.status === 400);
  }
});
test("live missing key is a clear failure and does not masquerade as demo", async () => {
  await assert.rejects(
    decide({ kind: "tax", text: "W-2", mode: "live" }, { apiKey: "" }),
    (e) => e.status === 503,
  );
});
test("live adapter sends documented typed questions and validates the response", async () => {
  let sent;
  const fetchImpl = async (url, init) => {
    assert.equal(url, "https://api.typesafe.ai/v1/systemone");
    sent = JSON.parse(init.body);
    assert.equal(init.headers.Authorization, "Bearer test-secret");
    return new Response(
      JSON.stringify({
        model: "jev-test",
        answers: {
          category: {
            type: "choice",
            choice: "W-2",
            confidence: 0.9,
            probabilities: {
              "W-2": 0.92,
              1099: 0.02,
              "K-1": 0.02,
              Receipt: 0.02,
              Other: 0.02,
            },
          },
          attention: { type: "noul", noul: 0.2 },
        },
      }),
      { status: 200 },
    );
  };
  const result = await decide(
    { kind: "tax", text: "Form W-2", mode: "live" },
    { apiKey: "test-secret", fetchImpl },
  );
  assert.equal(sent.questions.category.type, "choice");
  assert.equal(sent.questions.attention.type, "noul");
  assert.equal(sent.state.content, "Form W-2");
  assert.equal(result.source, "jev");
  assert.equal(result.confidence, 0.9);
});
test("live adapter can route Jev through OpenCode Zen", async () => {
  let seen;
  const result = await decide(
    { kind: "it", text: "Synthetic MFA sign-in issue", mode: "live" },
    {
      apiKey: "test-secret",
      model: "jev-1.13-free",
      endpoint: "https://opencode.ai/zen/v1/systemone",
      fetchImpl: async (url, init) => {
        seen = { url, body: JSON.parse(init.body) };
        return new Response(
          JSON.stringify({
            model: "jev-1.13-free",
            answers: {
              category: {
                type: "choice",
                choice: "Identity & access",
                confidence: 0.9,
                probabilities: {
                  "Remote desktop": 0.02,
                  "Identity & access": 0.9,
                  Network: 0.02,
                  Device: 0.02,
                  Software: 0.02,
                  Other: 0.02,
                },
              },
              attention: { type: "noul", noul: 0.1 },
            },
          }),
        );
      },
    },
  );
  assert.equal(seen.url, "https://opencode.ai/zen/v1/systemone");
  assert.equal(seen.body.model, "jev-1.13-free");
  assert.equal(result.source, "jev");
  assert.equal(result.category, "Identity & access");
});
test("malformed upstream choices and HTTP failures stay visible", async () => {
  for (const fetchImpl of [
    async () => new Response("{}"),
    async () => new Response("secret provider payload", { status: 401 }),
    async () =>
      new Response(
        JSON.stringify({
          answers: {
            category: { choice: "HACK", confidence: 1, probabilities: {} },
            attention: { noul: 0 },
          },
        }),
      ),
  ]) {
    await assert.rejects(
      decide(
        { kind: "tax", text: "Form W-2", mode: "live" },
        { apiKey: "test", fetchImpl },
      ),
      (e) => e.status === 502 && !e.message.includes("secret provider payload"),
    );
  }
});
test("provider timeouts produce an actionable retry error", async () => {
  const fetchImpl = async () => {
    throw new DOMException("timeout", "TimeoutError");
  };
  await assert.rejects(
    decide(
      { kind: "it", text: "login fails", mode: "live" },
      { apiKey: "test", fetchImpl },
    ),
    (e) => e.status === 504,
  );
});
test("tax and IT question options match the UI vocabulary", () => {
  assert.deepEqual(
    Object.keys(buildQuestions("tax").category.criteria).sort(),
    ["W-2", "1099", "K-1", "Receipt", "Other"].sort(),
  );
  assert.ok(
    Object.hasOwn(buildQuestions("it").category.criteria, "Identity & access"),
  );
});
