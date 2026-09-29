import type { Decision } from "../../src/shared/api";

export type Status = "Open" | "In progress" | "Resolved";
export type DiagnosticReport = {
  schemaVersion: 1;
  collectedAt: string;
  platform: "Windows";
  checks: {
    name: string;
    status: "pass" | "warn" | "fail" | "unknown";
    value: string;
    detail: string;
  }[];
  summary: string;
};
export type Ticket = {
  id: string;
  title: string;
  description: string;
  employee: string;
  employeeId?: string;
  owner?: string;
  nextStep?: string;
  scenario?: string;
  team: string;
  priority: "High" | "Normal";
  status: Status;
  category: string;
  routingRevision?: number;
  createdAt: string;
  decision?: Decision;
  report?: DiagnosticReport;
  audit: { at: string; text: string }[];
};
export function applyRoutingDecision(
  ticket: Ticket,
  decision: Decision,
  requestRevision: number,
  at: string,
): Ticket {
  const manualEdit = (ticket.routingRevision || 0) !== requestRevision;
  const source =
    decision.source === "jev"
      ? `Jev (${decision.model})`
      : "local demonstration rules";
  return {
    ...ticket,
    decision,
    category: manualEdit ? ticket.category : decision.category,
    audit: [
      {
        at,
        text: `Routing suggested by ${source}: ${decision.category}.${manualEdit ? " Your newer manual category was kept." : ""}`,
      },
      ...ticket.audit,
    ],
  };
}
const initial = [
  {
    title: "Remote tax workstation keeps freezing",
    description:
      "My remote Windows desktop (RDP) freezes for 10–15 seconds when I switch between the tax application and a PDF. Two colleagues mentioned a similar slowdown this morning. I have a client review this afternoon. Local applications are working normally.",
    employee: "Maya Chen",
    employeeId: "person-maya",
    team: "Tax operations",
    priority: "High" as const,
  },
  {
    title: "New laptop is missing the PDF application",
    description:
      "I received my replacement Windows laptop, but the approved PDF editor is missing. I can sign in and open my email. I need to combine client document packets before my first meeting.",
    employee: "Alex Rivera",
    team: "Client services",
    priority: "Normal" as const,
  },
  {
    title: "Authenticator moved to a new phone",
    description:
      "I replaced my phone and cannot complete MFA for my work account. My old phone is no longer available. I still have my company laptop but cannot sign into Google Workspace.",
    employee: "Jordan Lee",
    employeeId: "person-jordan",
    team: "Tax operations",
    priority: "High" as const,
  },
  {
    title: "Company VPN disconnects during calls",
    description:
      "The company VPN disconnects every few minutes from my home network. Video calls also stutter. I have tried reconnecting once. Other websites appear to work, but I have not tested a wired connection.",
    employee: "Sam Patel",
    team: "Engineering",
    priority: "Normal" as const,
  },
  {
    title: "Laptop disk is almost full",
    description:
      "Windows reports less than 2 GB of free disk space. Saving PDFs is slow and an update will not install. I do not know which files are safe to remove.",
    employee: "Avery Brooks",
    team: "Tax operations",
    priority: "Normal" as const,
  },
  {
    title: "Shared calendar access confirmed",
    description:
      "The shared operations calendar was missing from my account. The owner confirmed membership and I can now see the calendar after signing in again.",
    employee: "Taylor Kim",
    employeeId: "person-taylor",
    team: "Operations",
    priority: "Normal" as const,
  },
];
export function seedTickets(): Ticket[] {
  return initial.map((ticket, i) => ({
    ...ticket,
    id: `RLY-${1042 + i}`,
    status: i === 5 ? "Resolved" : i === 3 ? "In progress" : "Open",
    category: i === 5 ? "Identity & access" : "Untriaged",
    createdAt: new Date(Date.now() - (i + 1) * 3600000).toISOString(),
    audit: [
      {
        at: new Date(Date.now() - (i + 1) * 3600000).toISOString(),
        text: "Synthetic example loaded into the local queue.",
      },
    ],
  }));
}
export const runbooks: Record<
  string,
  { title: string; note: string; steps: string[]; escalate: string }
> = {
  "Remote desktop": {
    title: "Remote session performance",
    note: "A frozen session can have several causes. A ticket description alone cannot establish which one.",
    steps: [
      "Confirm the affected users, start time, remote platform, and whether local apps are also slow.",
      "Compare local network and DNS checks with the remote service’s known status. A passing check does not prove the remote session is healthy.",
      "Collect a timestamp and a reproducible example; have the remote platform owner review host capacity and session metrics.",
    ],
    escalate:
      "Remote platform owner, with timestamps, scope, and diagnostic checks.",
  },
  "Identity & access": {
    title: "Account access and MFA recovery",
    note: "Never request passwords, recovery codes, or MFA approvals in a ticket.",
    steps: [
      "Verify the employee’s identity through the organization’s established recovery procedure.",
      "Check account status, approved access, and the identity provider’s sign-in logs with an authorized administrator.",
      "Use the approved recovery process, then confirm the user can sign in and record the access change.",
    ],
    escalate:
      "Identity administrator when verification or privileged access is required.",
  },
  Network: {
    title: "Connection and VPN investigation",
    note: "DNS and reachability checks show observations at one moment; they do not establish the root cause.",
    steps: [
      "Establish scope: one app or all apps, one person or several, Wi-Fi or wired.",
      "Review the collector’s DNS and endpoint checks; compare an approved alternate connection if available.",
      "Record VPN error text and timestamps and check the service status with the network owner.",
    ],
    escalate:
      "Network owner with the affected endpoint, time, and reproduction steps.",
  },
  Device: {
    title: "Windows device health",
    note: "Do not delete files or change security settings as a first response.",
    steps: [
      "Review disk capacity and operating system observations from a fresh diagnostic report.",
      "Confirm which applications and work are affected; identify a safe workaround with the employee.",
      "Follow approved device-management procedures for updates or cleanup; verify improvement with the employee.",
    ],
    escalate:
      "Device administrator if remediation requires elevated privileges or policy changes.",
  },
  Software: {
    title: "Application availability",
    note: "Confirm the approved application and licensing before attempting an installation.",
    steps: [
      "Capture the application name, version, exact error, and whether colleagues are affected.",
      "Check the approved software catalog and assigned license with the application owner.",
      "Use the managed installation or support process, then verify the original task can be completed.",
    ],
    escalate:
      "Application owner with version, error text, license status, and business impact.",
  },
  Other: {
    title: "Clarify the request",
    note: "There is not enough routing information to select a more specific runbook.",
    steps: [
      "Ask what the employee was trying to accomplish and what happened instead.",
      "Capture scope, business impact, timestamps, and exact error text without collecting credentials.",
      "Assign an owner, agree on the next update, and choose a more specific category when evidence permits.",
    ],
    escalate: "IT owner for manual assessment.",
  },
};
export function parseReport(input: unknown): DiagnosticReport {
  if (!input || typeof input !== "object")
    throw new Error("This is not a diagnostic report.");
  const r = input as Record<string, unknown>;
  if (
    r.schemaVersion !== 1 ||
    r.platform !== "Windows" ||
    typeof r.collectedAt !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T/.test(r.collectedAt) ||
    !Number.isFinite(Date.parse(r.collectedAt)) ||
    typeof r.summary !== "string" ||
    r.summary.length > 10000 ||
    !Array.isArray(r.checks) ||
    r.checks.length < 1 ||
    r.checks.length > 100
  )
    throw new Error(
      "Expected a version 1 Windows report with a timestamp, summary, and 1–100 checks.",
    );
  const checks = r.checks.map((c: unknown) => {
    if (!c || typeof c !== "object")
      throw new Error("A diagnostic check is malformed.");
    const row = c as Record<string, unknown>;
    if (
      typeof row.name !== "string" ||
      !row.name.trim() ||
      row.name.length > 300 ||
      typeof row.value !== "string" ||
      row.value.length > 10000 ||
      typeof row.detail !== "string" ||
      row.detail.length > 10000 ||
      typeof row.status !== "string" ||
      !["pass", "warn", "fail", "unknown"].includes(row.status)
    )
      throw new Error(
        "Each check needs a name, a valid status, and text value and detail.",
      );
    return {
      name: row.name,
      status: row.status as DiagnosticReport["checks"][number]["status"],
      value: row.value,
      detail: row.detail,
    };
  });
  return {
    schemaVersion: 1,
    platform: "Windows",
    collectedAt: r.collectedAt,
    summary: r.summary,
    checks,
  };
}
