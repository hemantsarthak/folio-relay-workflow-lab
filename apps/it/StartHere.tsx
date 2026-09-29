import { ArrowRight } from "lucide-react";

export type RelayView =
  | "start"
  | "portal"
  | "queue"
  | "runbooks"
  | "access"
  | "people"
  | "operations";

type Step = { who: string; title: string; body: string; view: RelayView };

const support: Step[] = [
  {
    who: "Employee",
    title: "Raise a request",
    body: "Pick what’s wrong in the Help portal and describe it. No IT jargon needed.",
    view: "portal",
  },
  {
    who: "Jev / rules",
    title: "Route it automatically",
    body: "The server asks Jev for a category and a “needs attention now?” flag. Code validates the answer.",
    view: "portal",
  },
  {
    who: "IT",
    title: "Own it in the queue",
    body: "Assign an owner and next step, follow the runbook, attach Windows diagnostics.",
    view: "queue",
  },
  {
    who: "Employee",
    title: "See progress",
    body: "Status and the IT update appear back in the employee’s portal.",
    view: "portal",
  },
  {
    who: "IT",
    title: "Spot patterns",
    body: "Operations review groups repeat reports so a shared outage isn’t fixed five times.",
    view: "operations",
  },
];

const lifecycle: Step[] = [
  {
    who: "IT",
    title: "Onboard",
    body: "Add the person, record their apps and laptop.",
    view: "people",
  },
  {
    who: "IT",
    title: "Record a departure",
    body: "Set an exit date. Relay lists everything still switched on.",
    view: "people",
  },
  {
    who: "IT",
    title: "Audit the snapshot",
    body: "Compare roster, app accounts and devices. Findings need an operator note.",
    view: "access",
  },
  {
    who: "IT",
    title: "Close the gaps",
    body: "Disable access, collect the laptop, re-run the audit to confirm it’s clean.",
    view: "people",
  },
];

function Flow({
  title,
  lede,
  steps,
  go,
}: {
  title: string;
  lede: string;
  steps: Step[];
  go: (view: RelayView) => void;
}) {
  return (
    <section className="start-flow">
      <div className="start-flow-head">
        <h2>{title}</h2>
        <p>{lede}</p>
      </div>
      <ol className="journey" style={{ ["--steps" as string]: steps.length }}>
        {steps.map((step, i) => (
          <li key={step.title} style={{ display: "contents" }}>
            <button className="journey-step" onClick={() => go(step.view)}>
              <em>{step.who}</em>
              <strong>
                <b>{i + 1}</b> {step.title}
              </strong>
              <small>{step.body}</small>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

export default function StartHere({ go }: { go: (view: RelayView) => void }) {
  return (
    <div className="start-here">
      <div className="start-try">
        <div>
          <span className="eyebrow">TRY IT IN ONE MINUTE</span>
          <p>
            Open the <strong>Help portal</strong> as Maya, report that remote
            desktop freezes and colleagues are affected, then open the{" "}
            <strong>Support queue</strong> to pick it up as IT.
          </p>
        </div>
        <button className="primary-button" onClick={() => go("portal")}>
          Open the Help portal <ArrowRight size={16} />
        </button>
      </div>
      <Flow
        title="A support request, end to end"
        lede="Two sides of the same ticket: the employee who is blocked, and the IT person who owns the fix."
        steps={support}
        go={go}
      />
      <Flow
        title="An employee’s lifecycle"
        lede="The first-IT-hire job nobody sees until it goes wrong: making sure access ends when employment does."
        steps={lifecycle}
        go={go}
      />
      <p className="start-boundary">
        Everything here is a local simulation with synthetic people. No real
        identity provider, Slack message or device-management action runs.
      </p>
    </div>
  );
}
