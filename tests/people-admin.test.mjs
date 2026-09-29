import { test } from "node:test";
import assert from "node:assert/strict";
import { runAccessAudit } from "../apps/it/access-audit.ts";
import {
  addAccount,
  addPerson,
  assignDevice,
  createPeopleWorkspace,
  departPerson,
  editPerson,
  setAccountStatus,
  setDeviceStatus,
  toAuditInputs,
} from "../apps/it/people-admin.ts";

const at = "2026-09-27T00:00:00.000Z";
const person = {
  name: "Casey Example",
  email: "casey@example.com",
  team: "Operations",
  role: "Coordinator",
  startDate: "2026-01-05",
};

test("directory lifecycle feeds access audit and simulated remediation changes the next snapshot", () => {
  let workspace = createPeopleWorkspace(at);
  assert.equal(runAccessAudit(toAuditInputs(workspace), at).findings.length, 2);
  workspace = addPerson(workspace, person, "casey", at);
  workspace = addAccount(
    workspace,
    "casey",
    "Slack",
    "Approved for operations work.",
    at,
  );
  workspace = assignDevice(
    workspace,
    "casey",
    "WIN-2001",
    "Laptop handed to employee.",
    at,
  );
  workspace = departPerson(
    workspace,
    "casey",
    "2026-09-26",
    "Departure confirmed with People Ops.",
    at,
  );
  assert.equal(runAccessAudit(toAuditInputs(workspace), at).findings.length, 4);
  workspace = setAccountStatus(
    workspace,
    "casey",
    "Slack",
    "disabled",
    "Confirmed disabled in admin console.",
    at,
  );
  workspace = setDeviceStatus(
    workspace,
    "casey",
    "returned",
    "Laptop received by the IT desk.",
    at,
  );
  assert.equal(runAccessAudit(toAuditInputs(workspace), at).findings.length, 2);
  assert.equal(
    workspace.people.find((entry) => entry.id === "casey").events.length,
    6,
  );
});

test("admin operations validate identity, dates, notes, and departed access", () => {
  let workspace = createPeopleWorkspace(at);
  workspace = addPerson(workspace, person, "casey", at);
  assert.throws(
    () =>
      addPerson(
        workspace,
        { ...person, email: "CASEY@example.com" },
        "duplicate",
        at,
      ),
    /already/,
  );
  assert.throws(
    () =>
      editPerson(
        workspace,
        "casey",
        { ...person, startDate: "2026-02-30" },
        at,
      ),
    /valid/,
  );
  assert.throws(
    () =>
      departPerson(
        workspace,
        "casey",
        "2025-01-01",
        "Departure confirmed.",
        at,
      ),
    /precede/,
  );
  assert.throws(
    () => addAccount(workspace, "casey", "Slack", "short", at),
    /note/,
  );
  workspace = departPerson(
    workspace,
    "casey",
    "2026-09-26",
    "Departure confirmed with People Ops.",
    at,
  );
  assert.throws(
    () =>
      addAccount(
        workspace,
        "casey",
        "Slack",
        "Access was approved before departure.",
        at,
      ),
    /departed/,
  );
});
