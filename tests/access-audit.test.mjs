import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  parseCsv,
  runAccessAudit,
  recordFindingNote,
  exportAccessAudit,
} from "../apps/it/access-audit.ts";

const sample = (name) =>
  readFileSync(new URL(`../public/samples/${name}`, import.meta.url), "utf8");

test("sample offboarding audit finds active Slack and assigned device", () => {
  const result = runAccessAudit({
    roster: sample("audit-roster.csv"),
    accounts: sample("audit-accounts.csv"),
    devices: sample("audit-devices.csv"),
  });
  assert.equal(result.departedEmployees, 1);
  assert.equal(result.findings.length, 2);
  assert.deepEqual(result.findings.map((finding) => finding.type).sort(), [
    "active-account",
    "assigned-device",
  ]);
  assert.ok(
    result.findings.every(
      (finding) => finding.email === "jordan.lee@example.com",
    ),
  );
  assert.ok(result.findings.every((finding) => !finding.operatorNote));
});

test("email joins are case insensitive and suspended accounts are not flagged", () => {
  const result = runAccessAudit({
    roster:
      "email,employment_status,exit_date\nJordan.Lee@Example.com,departed,2026-09-24",
    accounts:
      "email,system,account_status\njordan.lee@example.com,Google Workspace,suspended\nJORDAN.LEE@EXAMPLE.COM,Slack,active",
    devices:
      "email,asset_id,device_status\njordan.lee@example.com,MBP-01,returned",
  });
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].system, "Slack");
});

test("quoted CSV fields and line endings parse without splitting commas", () => {
  assert.deepEqual(
    parseCsv('email,system\r\na@example.com,"Slack, Enterprise"\r\n'),
    [
      ["email", "system"],
      ["a@example.com", "Slack, Enterprise"],
    ],
  );
  assert.throws(() => parseCsv('email,system\na@example.com,"unclosed'));
});

test("invalid headers, duplicate roster emails, and bad statuses are rejected", () => {
  const valid = {
    roster:
      "email,employment_status,exit_date\na@example.com,departed,2026-09-24",
    accounts: "email,system,account_status\na@example.com,Slack,active",
    devices: "email,asset_id,device_status\na@example.com,PC-1,assigned",
  };
  assert.throws(
    () =>
      runAccessAudit({
        ...valid,
        roster: "email,status\na@example.com,departed",
      }),
    /employment_status/,
  );
  assert.throws(
    () =>
      runAccessAudit({
        ...valid,
        roster: valid.roster + "\na@example.com,departed,2026-09-24",
      }),
    /duplicate/i,
  );
  assert.throws(
    () =>
      runAccessAudit({
        ...valid,
        accounts: valid.accounts.replace("active", "maybe"),
      }),
    /account_status/,
  );
});

test("finding needs an operator note and export keeps it distinct from source status", () => {
  const result = runAccessAudit({
    roster: sample("audit-roster.csv"),
    accounts: sample("audit-accounts.csv"),
    devices: sample("audit-devices.csv"),
  });
  assert.throws(() =>
    recordFindingNote(
      result,
      result.findings[0].id,
      "done",
      "2026-09-27T00:00:00Z",
    ),
  );
  const noted = recordFindingNote(
    result,
    result.findings[0].id,
    "Confirmed disabled in the admin console",
    "2026-09-27T00:00:00Z",
  );
  assert.equal(
    noted.findings[0].operatorNote,
    "Confirmed disabled in the admin console",
  );
  assert.equal(
    exportAccessAudit(noted).findings[0].notedAt,
    "2026-09-27T00:00:00Z",
  );
  assert.equal(exportAccessAudit(noted).findings[0].type, "active-account");
  assert.equal(exportAccessAudit(noted).rawCsv, undefined);
});
