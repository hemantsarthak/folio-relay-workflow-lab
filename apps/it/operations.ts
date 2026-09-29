import type { Ticket } from "./data.ts";

export function summarizeOperations(tickets: Ticket[]) {
  const active = tickets.filter((ticket) => ticket.status !== "Resolved");
  const groups = new Map<string, Ticket[]>();
  for (const ticket of active) {
    if (ticket.category === "Untriaged" || ticket.category === "Other")
      continue;
    const key = `${ticket.category} · ${ticket.team}`;
    groups.set(key, [...(groups.get(key) || []), ticket]);
  }
  return {
    active: active.length,
    unowned: active.filter((ticket) => !ticket.owner).length,
    missingNextStep: active.filter((ticket) => !ticket.nextStep).length,
    worklist: [...active].sort(
      (a, b) =>
        Number(b.priority === "High") - Number(a.priority === "High") ||
        a.createdAt.localeCompare(b.createdAt),
    ),
    patterns: [...groups]
      .filter(([, items]) => items.length > 1)
      .map(([label, items]) => ({ label, tickets: items })),
  };
}

export function loadIncidentDrill(
  tickets: Ticket[],
  at = new Date().toISOString(),
): Ticket[] {
  if (tickets.some((ticket) => ticket.scenario === "shared-session-drill"))
    return tickets;
  let next = Math.max(
    1041,
    ...tickets.map((ticket) => Number(ticket.id.slice(4))),
  );
  const examples = [
    {
      employee: "Priya Example",
      title: "Remote session stalls during packet review",
      description:
        "My remote Windows session freezes when I open the tax app and PDFs. A colleague sees the same pause. Local apps work. We have a client review this afternoon.",
    },
    {
      employee: "Morgan Example",
      title: "Tax team's RDP session becomes unresponsive",
      description:
        "The RDP session pauses for about 15 seconds when switching between the tax app and a PDF. Two people on our team reported similar behavior this morning.",
    },
  ];
  return [
    ...examples.map((entry): Ticket => ({
      ...entry,
      id: `RLY-${++next}`,
      team: "Tax operations",
      priority: "High",
      status: "Open",
      category: "Remote desktop",
      scenario: "shared-session-drill",
      createdAt: at,
      audit: [
        {
          at,
          text: "Synthetic shared-session drill loaded. Category is scenario data, not a diagnosis.",
        },
      ],
    })),
    ...tickets,
  ];
}

export function recordTicketWork(
  ticket: Ticket,
  owner: string,
  nextStep: string,
): Partial<Ticket> {
  const checkedOwner = owner.trim();
  const checkedStep = nextStep.trim();
  if (checkedOwner.length < 2 || checkedOwner.length > 100)
    throw new Error("Record an owner between 2 and 100 characters.");
  if (checkedStep.length < 8 || checkedStep.length > 1000)
    throw new Error(
      "Record a next step or resolution note between 8 and 1,000 characters.",
    );
  if (ticket.owner === checkedOwner && ticket.nextStep === checkedStep)
    throw new Error("The work plan is already up to date.");
  return { owner: checkedOwner, nextStep: checkedStep };
}
