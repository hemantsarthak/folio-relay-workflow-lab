import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseReport } from "../apps/it/data.ts";

const valid = JSON.parse(
  readFileSync(
    new URL("../public/samples/sample-diagnostics.json", import.meta.url),
    "utf8",
  ),
);
test("collector schema accepts valid data and strips unrecognized fields", () => {
  const report = parseReport({ ...valid, secret: "ignored" });
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.checks.length, 4);
  assert.equal(report.secret, undefined);
});
test("malformed reports are rejected before reaching the UI", () => {
  for (const value of [
    null,
    {},
    { ...valid, platform: "macOS" },
    { ...valid, collectedAt: "not-a-date" },
    { ...valid, checks: [] },
    { ...valid, checks: [{ ...valid.checks[0], status: ["pass"] }] },
    { ...valid, checks: [{ ...valid.checks[0], name: "" }] },
  ]) {
    assert.throws(() => parseReport(value));
  }
});
