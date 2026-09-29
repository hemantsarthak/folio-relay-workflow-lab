export type AccountStatus = "active" | "suspended" | "disabled";
export type DeviceStatus = "assigned" | "returned" | "wiped";
export type AdminEvent = { at: string; action: string; note: string };
export type AdminPerson = {
  id: string;
  name: string;
  email: string;
  team: string;
  role: string;
  startDate: string;
  exitDate: string;
  status: "active" | "departed";
  accounts: { system: string; status: AccountStatus }[];
  device: { assetId: string; status: DeviceStatus } | null;
  events: AdminEvent[];
};
export type PeopleWorkspace = {
  schemaVersion: 1;
  people: AdminPerson[];
  selectedPersonId: string;
};
export type PersonInput = Pick<
  AdminPerson,
  "name" | "email" | "team" | "role" | "startDate"
>;

function date(value: string, label: string) {
  const parsed = new Date(`${value}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  )
    throw new Error(`${label} must be a valid YYYY-MM-DD date.`);
  return value;
}
function validatePerson(
  input: PersonInput,
  others: AdminPerson[],
  selfId?: string,
) {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const team = input.team.trim();
  const role = input.role.trim();
  if (name.length < 2 || name.length > 100)
    throw new Error("Employee name must be 2–100 characters.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 150)
    throw new Error("Enter a valid work email.");
  if (others.some((person) => person.id !== selfId && person.email === email))
    throw new Error("That work email is already in the directory.");
  if (!team || !role || team.length > 100 || role.length > 100)
    throw new Error("Team and role are required, up to 100 characters each.");
  return {
    name,
    email,
    team,
    role,
    startDate: date(input.startDate, "Start date"),
  };
}
function note(value: string) {
  const trimmed = value.trim();
  if (trimmed.length < 8 || trimmed.length > 500)
    throw new Error("Record an operator note between 8 and 500 characters.");
  return trimmed;
}
function changePerson(
  workspace: PeopleWorkspace,
  id: string,
  action: (person: AdminPerson) => AdminPerson,
): PeopleWorkspace {
  if (!workspace.people.some((person) => person.id === id))
    throw new Error("Employee was not found.");
  return {
    ...workspace,
    people: workspace.people.map((person) =>
      person.id === id ? action(person) : person,
    ),
  };
}
function event(
  person: AdminPerson,
  action: string,
  operatorNote: string,
  at: string,
): AdminPerson {
  return {
    ...person,
    events: [{ at, action, note: operatorNote }, ...person.events],
  };
}

export function createPeopleWorkspace(
  at = new Date().toISOString(),
): PeopleWorkspace {
  return {
    schemaVersion: 1,
    selectedPersonId: "person-jordan",
    people: [
      {
        id: "person-jordan",
        name: "Jordan Lee",
        email: "jordan.lee@example.com",
        team: "Tax operations",
        role: "Tax associate",
        startDate: "2024-04-08",
        exitDate: "2026-09-24",
        status: "departed",
        accounts: [
          { system: "Google Workspace", status: "suspended" },
          { system: "Slack", status: "active" },
        ],
        device: { assetId: "WIN-1428", status: "assigned" },
        events: [
          {
            at,
            action: "Departure recorded; access review required.",
            note: "Synthetic example only.",
          },
        ],
      },
      {
        id: "person-maya",
        name: "Maya Chen",
        email: "maya.chen@example.com",
        team: "Tax operations",
        role: "Tax manager",
        startDate: "2023-01-16",
        exitDate: "",
        status: "active",
        accounts: [
          { system: "Google Workspace", status: "active" },
          { system: "Slack", status: "active" },
        ],
        device: { assetId: "WIN-1562", status: "assigned" },
        events: [
          {
            at,
            action: "Profile added to demo directory.",
            note: "Synthetic example only.",
          },
        ],
      },
      {
        id: "person-taylor",
        name: "Taylor Kim",
        email: "taylor.kim@example.com",
        team: "Operations",
        role: "Operations coordinator",
        startDate: "2025-03-03",
        exitDate: "",
        status: "active",
        accounts: [{ system: "Google Workspace", status: "active" }],
        device: null,
        events: [
          {
            at,
            action: "Profile added to demo directory.",
            note: "Synthetic example only.",
          },
        ],
      },
    ],
  };
}

export function addPerson(
  workspace: PeopleWorkspace,
  input: PersonInput,
  id: string,
  at = new Date().toISOString(),
): PeopleWorkspace {
  if (!id || workspace.people.some((person) => person.id === id))
    throw new Error("Could not create a unique employee record.");
  if (workspace.people.length >= 100)
    throw new Error("This demo supports up to 100 people.");
  const fields = validatePerson(input, workspace.people);
  return {
    ...workspace,
    people: [
      ...workspace.people,
      {
        id,
        ...fields,
        status: "active",
        exitDate: "",
        accounts: [],
        device: null,
        events: [
          {
            at,
            action: "Employee record created.",
            note: "Local demo only; no account was provisioned.",
          },
        ],
      },
    ],
    selectedPersonId: id,
  };
}

export function editPerson(
  workspace: PeopleWorkspace,
  id: string,
  input: PersonInput,
  at = new Date().toISOString(),
): PeopleWorkspace {
  const fields = validatePerson(input, workspace.people, id);
  return changePerson(workspace, id, (person) =>
    event(
      { ...person, ...fields },
      "Profile updated.",
      "Local directory edit.",
      at,
    ),
  );
}

export function departPerson(
  workspace: PeopleWorkspace,
  id: string,
  exitDate: string,
  operatorNote: string,
  at = new Date().toISOString(),
): PeopleWorkspace {
  const checkedDate = date(exitDate, "Exit date");
  const checkedNote = note(operatorNote);
  return changePerson(workspace, id, (person) => {
    if (person.status === "departed")
      throw new Error("This person is already marked departed.");
    if (checkedDate < person.startDate)
      throw new Error("Exit date cannot precede the start date.");
    return event(
      { ...person, status: "departed", exitDate: checkedDate },
      "Departure recorded; review access and device.",
      checkedNote,
      at,
    );
  });
}

export function addAccount(
  workspace: PeopleWorkspace,
  id: string,
  system: string,
  operatorNote: string,
  at = new Date().toISOString(),
): PeopleWorkspace {
  const name = system.trim();
  const checkedNote = note(operatorNote);
  if (name.length < 2 || name.length > 100)
    throw new Error("Application name must be 2–100 characters.");
  return changePerson(workspace, id, (person) => {
    if (person.status !== "active")
      throw new Error("Do not grant access to a departed person.");
    if (
      person.accounts.some(
        (account) => account.system.toLowerCase() === name.toLowerCase(),
      )
    )
      throw new Error("This application is already listed.");
    return event(
      {
        ...person,
        accounts: [...person.accounts, { system: name, status: "active" }],
      },
      `${name} marked active in the demo.`,
      checkedNote,
      at,
    );
  });
}

export function setAccountStatus(
  workspace: PeopleWorkspace,
  id: string,
  system: string,
  status: AccountStatus,
  operatorNote: string,
  at = new Date().toISOString(),
): PeopleWorkspace {
  if (!["active", "suspended", "disabled"].includes(status))
    throw new Error("Choose a valid account status.");
  const checkedNote = note(operatorNote);
  return changePerson(workspace, id, (person) => {
    const account = person.accounts.find((item) => item.system === system);
    if (!account) throw new Error("Application was not found on this profile.");
    if (account.status === status)
      throw new Error("Choose a different account status.");
    if (person.status === "departed" && status === "active")
      throw new Error("Do not reactivate access for a departed person.");
    return event(
      {
        ...person,
        accounts: person.accounts.map((item) =>
          item.system === system ? { ...item, status } : item,
        ),
      },
      `${system} marked ${status} in the demo.`,
      checkedNote,
      at,
    );
  });
}

export function assignDevice(
  workspace: PeopleWorkspace,
  id: string,
  assetId: string,
  operatorNote: string,
  at = new Date().toISOString(),
): PeopleWorkspace {
  const asset = assetId.trim().toUpperCase();
  const checkedNote = note(operatorNote);
  if (asset.length < 3 || asset.length > 60)
    throw new Error("Enter a 3–60 character asset ID.");
  if (
    workspace.people.some(
      (person) =>
        person.id !== id &&
        person.device?.assetId.toLowerCase() === asset.toLowerCase(),
    )
  )
    throw new Error("This device is assigned to another employee.");
  return changePerson(workspace, id, (person) => {
    if (person.status !== "active")
      throw new Error("Do not assign a device to a departed person.");
    if (person.device?.status === "assigned")
      throw new Error("Return the current device before assigning another.");
    return event(
      { ...person, device: { assetId: asset, status: "assigned" } },
      `${asset} assigned in the demo.`,
      checkedNote,
      at,
    );
  });
}

export function setDeviceStatus(
  workspace: PeopleWorkspace,
  id: string,
  status: DeviceStatus,
  operatorNote: string,
  at = new Date().toISOString(),
): PeopleWorkspace {
  if (!["assigned", "returned", "wiped"].includes(status))
    throw new Error("Choose a valid device status.");
  const checkedNote = note(operatorNote);
  return changePerson(workspace, id, (person) => {
    if (!person.device)
      throw new Error("No device is recorded for this employee.");
    if (person.device.status === status)
      throw new Error("Choose a different device status.");
    if (person.status === "departed" && status === "assigned")
      throw new Error("Do not assign a device to a departed person.");
    return event(
      { ...person, device: { ...person.device, status } },
      `${person.device.assetId} marked ${status} in the demo.`,
      checkedNote,
      at,
    );
  });
}

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}
export function toAuditInputs(workspace: PeopleWorkspace) {
  const roster = [
    "email,employment_status,exit_date",
    ...workspace.people.map((person) =>
      [person.email, person.status, person.exitDate].map(csvCell).join(","),
    ),
  ].join("\n");
  const accounts = [
    "email,system,account_status",
    ...workspace.people.flatMap((person) =>
      person.accounts.map((account) =>
        [person.email, account.system, account.status].map(csvCell).join(","),
      ),
    ),
  ].join("\n");
  const devices = [
    "email,asset_id,device_status",
    ...workspace.people.flatMap((person) =>
      person.device
        ? [
            [person.email, person.device.assetId, person.device.status]
              .map(csvCell)
              .join(","),
          ]
        : [],
    ),
  ].join("\n");
  return { roster, accounts, devices };
}

export function isPeopleWorkspace(value: unknown): value is PeopleWorkspace {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<PeopleWorkspace>;
  return (
    item.schemaVersion === 1 &&
    Array.isArray(item.people) &&
    item.people.length > 0 &&
    item.people.length <= 100 &&
    typeof item.selectedPersonId === "string" &&
    item.people.some((person) => person.id === item.selectedPersonId) &&
    item.people.every(
      (person) =>
        person &&
        typeof person.id === "string" &&
        typeof person.name === "string" &&
        typeof person.email === "string" &&
        Array.isArray(person.accounts) &&
        Array.isArray(person.events) &&
        ["active", "departed"].includes(person.status),
    )
  );
}
