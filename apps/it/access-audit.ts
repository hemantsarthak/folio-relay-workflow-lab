export type AuditFinding = {
  id: string;
  type: "active-account" | "assigned-device";
  email: string;
  system: string;
  detail: string;
  action: string;
  source: string;
  operatorNote: string | null;
  notedAt: string | null;
};

export type AccessAuditResult = {
  schemaVersion: 1;
  generatedAt: string;
  employees: number;
  departedEmployees: number;
  accounts: number;
  devices: number;
  findings: AuditFinding[];
};

export function parseCsv(input: string): string[][] {
  const text = input.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let closedQuote = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        cell += '"';
        index++;
      } else if (char === '"') {
        quoted = false;
        closedQuote = true;
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      if (cell || closedQuote)
        throw new Error(
          "Malformed CSV: a quote appears outside a quoted field.",
        );
      quoted = true;
    } else if (char === ",") {
      row.push(cell.trim());
      cell = "";
      closedQuote = false;
    } else if (char === "\n") {
      row.push(cell.trim());
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      cell = "";
      closedQuote = false;
    } else if (char === "\r") {
      if (text[index + 1] !== "\n")
        throw new Error("Malformed CSV: unsupported line ending.");
    } else {
      if (closedQuote && !/\s/.test(char))
        throw new Error("Malformed CSV: text follows a closing quote.");
      if (!closedQuote) cell += char;
    }
  }
  if (quoted) throw new Error("Malformed CSV: quoted field was not closed.");
  if (cell || row.length) {
    row.push(cell.trim());
    if (row.some((value) => value !== "")) rows.push(row);
  }
  return rows;
}

function records(text: string, required: string[], label: string) {
  const rows = parseCsv(text);
  const headers = rows.shift()?.map((value) => value.toLowerCase());
  if (!headers)
    throw new Error(
      `${label} CSV is empty. Required headers: ${required.join(", ")}.`,
    );
  const missing = required.filter((name) => !headers.includes(name));
  if (missing.length)
    throw new Error(
      `${label} CSV needs header${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}.`,
    );
  if (new Set(headers).size !== headers.length)
    throw new Error(`${label} CSV has duplicate headers.`);
  return rows.map((row, index) => {
    if (row.length !== headers.length)
      throw new Error(
        `${label} CSV row ${index + 2} has ${row.length} columns; expected ${headers.length}.`,
      );
    return Object.fromEntries(
      headers.map((header, column) => [header, row[column]]),
    );
  });
}

function emailKey(value: string, label: string): string {
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new Error(`${label} has an invalid email address.`);
  return email;
}

function oneOf(value: string, options: string[], label: string): string {
  const normalized = value.trim().toLowerCase();
  if (!options.includes(normalized))
    throw new Error(`${label} must be one of: ${options.join(", ")}.`);
  return normalized;
}

export function runAccessAudit(
  inputs: { roster: string; accounts: string; devices: string },
  generatedAt = new Date().toISOString(),
): AccessAuditResult {
  const roster = records(
    inputs.roster,
    ["email", "employment_status", "exit_date"],
    "Roster",
  );
  const accounts = records(
    inputs.accounts,
    ["email", "system", "account_status"],
    "Accounts",
  );
  const devices = records(
    inputs.devices,
    ["email", "asset_id", "device_status"],
    "Devices",
  );
  const people = new Map<string, string>();
  for (const item of roster) {
    const email = emailKey(item.email, "Roster");
    if (people.has(email))
      throw new Error(`Roster contains duplicate email ${email}.`);
    const status = oneOf(
      item.employment_status,
      ["active", "departed"],
      "employment_status",
    );
    if (status === "departed" && !/^\d{4}-\d{2}-\d{2}$/.test(item.exit_date))
      throw new Error(
        `Roster exit_date is required for departed employee ${email}.`,
      );
    people.set(email, status);
  }
  const findings: AuditFinding[] = [];
  const seenAccounts = new Set<string>();
  for (const item of accounts) {
    const email = emailKey(item.email, "Accounts");
    const system = item.system.trim();
    if (!system) throw new Error("Accounts system cannot be empty.");
    const key = `${email}:${system.toLowerCase()}`;
    if (seenAccounts.has(key))
      throw new Error(
        `Accounts contains duplicate row for ${email} / ${system}.`,
      );
    seenAccounts.add(key);
    const status = oneOf(
      item.account_status,
      ["active", "suspended", "disabled", "deleted"],
      "account_status",
    );
    if (people.get(email) === "departed" && status === "active") {
      findings.push({
        id: `account:${key}`,
        type: "active-account",
        email,
        system,
        detail: `${system} is still marked active after departure.`,
        action: `Confirm ${system} access is disabled in its admin console.`,
        source: "Accounts CSV: account_status=active",
        operatorNote: null,
        notedAt: null,
      });
    }
  }
  const seenDevices = new Set<string>();
  for (const item of devices) {
    const email = emailKey(item.email, "Devices");
    const asset = item.asset_id.trim();
    if (!asset) throw new Error("Devices asset_id cannot be empty.");
    if (seenDevices.has(asset.toLowerCase()))
      throw new Error(`Devices contains duplicate asset_id ${asset}.`);
    seenDevices.add(asset.toLowerCase());
    const status = oneOf(
      item.device_status,
      ["assigned", "returned", "wiped"],
      "device_status",
    );
    if (people.get(email) === "departed" && status === "assigned") {
      findings.push({
        id: `device:${email}:${asset.toLowerCase()}`,
        type: "assigned-device",
        email,
        system: asset,
        detail: `${asset} remains assigned after departure.`,
        action:
          "Confirm return and device disposition in the MDM/asset record.",
        source: "Devices CSV: device_status=assigned",
        operatorNote: null,
        notedAt: null,
      });
    }
  }
  return {
    schemaVersion: 1,
    generatedAt,
    employees: people.size,
    departedEmployees: [...people.values()].filter(
      (status) => status === "departed",
    ).length,
    accounts: accounts.length,
    devices: devices.length,
    findings,
  };
}

export function recordFindingNote(
  audit: AccessAuditResult,
  id: string,
  note: string,
  at = new Date().toISOString(),
): AccessAuditResult {
  if (!audit.findings.some((finding) => finding.id === id))
    throw new Error("Finding no longer exists in this audit.");
  if (note.trim().length < 10)
    throw new Error(
      "Record at least 10 characters describing the action taken.",
    );
  return {
    ...audit,
    findings: audit.findings.map((finding) =>
      finding.id === id
        ? { ...finding, operatorNote: note.trim(), notedAt: at }
        : finding,
    ),
  };
}

export function exportAccessAudit(audit: AccessAuditResult) {
  return {
    ...audit,
    application: "Relay independent portfolio demo",
    note: "Offline comparison only. Operator notes do not clear findings; no account or device action was executed.",
  };
}
