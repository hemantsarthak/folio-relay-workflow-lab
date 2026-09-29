import { useEffect, useState } from "react";
import {
  ArrowDownToLine,
  Check,
  CircleAlert,
  FileSpreadsheet,
  LoaderCircle,
  Play,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { downloadJson } from "../../src/shared/api";
import {
  exportAccessAudit,
  runAccessAudit,
  recordFindingNote,
  type AccessAuditResult,
} from "./access-audit";
import "./AccessAudit.css";

type Source = "roster" | "accounts" | "devices";
type SourceFile = { text: string; name: string };
const SOURCES: {
  key: Source;
  title: string;
  columns: string;
  file: string;
}[] = [
  {
    key: "roster",
    title: "Employee roster",
    columns: "email, employment_status, exit_date",
    file: "audit-roster.csv",
  },
  {
    key: "accounts",
    title: "SaaS accounts",
    columns: "email, system, account_status",
    file: "audit-accounts.csv",
  },
  {
    key: "devices",
    title: "Device inventory",
    columns: "email, asset_id, device_status",
    file: "audit-devices.csv",
  },
];
const FINDINGS_PAGE_SIZE = 30;

export type AuditSnapshot = {
  id: string;
  roster: string;
  accounts: string;
  devices: string;
};

export default function AccessAudit({
  snapshot,
}: {
  snapshot?: AuditSnapshot | null;
}) {
  const [sourceFiles, setSourceFiles] = useState<Record<Source, SourceFile>>({
    roster: { text: "", name: "" },
    accounts: { text: "", name: "" },
    devices: { text: "", name: "" },
  });
  const [result, setResult] = useState<AccessAuditResult | null>(null);
  const [visibleFindings, setVisibleFindings] = useState(FINDINGS_PAGE_SIZE);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!snapshot) return;
    try {
      const audit = runAccessAudit(snapshot);
      setSourceFiles({
        roster: { text: snapshot.roster, name: "Directory roster" },
        accounts: { text: snapshot.accounts, name: "Directory accounts" },
        devices: { text: snapshot.devices, name: "Directory devices" },
      });
      setResult(audit);
      setVisibleFindings(FINDINGS_PAGE_SIZE);
      setNotes({});
      setError("");
      setNotice(
        "Current simulated directory compared. Confirm real systems separately.",
      );
    } catch (caught) {
      setResult(null);
      setError((caught as Error).message);
    }
  }, [snapshot]);

  const importFile = async (source: Source, file?: File) => {
    if (!file) return;
    try {
      if (file.size > 1024 * 1024)
        throw new Error("Each inventory CSV must be smaller than 1 MB.");
      if (!/\.csv$/i.test(file.name))
        throw new Error("Choose a CSV file for this inventory.");
      const text = new TextDecoder("utf-8", { fatal: true }).decode(
        await file.arrayBuffer(),
      );
      setSourceFiles((current) => ({
        ...current,
        [source]: { text, name: file.name },
      }));
      setResult(null);
      setError("");
      setNotice(
        `${file.name} loaded locally. Run the audit when all three sources are ready.`,
      );
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const run = (
    data = {
      roster: sourceFiles.roster.text,
      accounts: sourceFiles.accounts.text,
      devices: sourceFiles.devices.text,
    },
  ) => {
    try {
      const audit = runAccessAudit(data);
      setResult(audit);
      setVisibleFindings(FINDINGS_PAGE_SIZE);
      setNotes({});
      setError("");
      setNotice(
        `${audit.findings.length} finding${audit.findings.length === 1 ? "" : "s"} ready for operator review.`,
      );
    } catch (e) {
      setResult(null);
      setError((e as Error).message);
    }
  };

  const loadSample = async () => {
    setBusy(true);
    setError("");
    try {
      const contents = await Promise.all(
        SOURCES.map(async ({ file }) => {
          const response = await fetch(`/samples/${file}`);
          if (!response.ok) throw new Error(`Could not load ${file}.`);
          return response.text();
        }),
      );
      const data = {
        roster: contents[0],
        accounts: contents[1],
        devices: contents[2],
      };
      setSourceFiles({
        roster: { text: data.roster, name: SOURCES[0].file },
        accounts: { text: data.accounts, name: SOURCES[1].file },
        devices: { text: data.devices, name: SOURCES[2].file },
      });
      run(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const recordNote = (id: string) => {
    if (!result) return;
    try {
      setResult(recordFindingNote(result, id, notes[id] || ""));
      setError("");
      setNotice(
        "Operator note recorded. Re-import updated exports to confirm the finding has cleared.",
      );
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const recordedCount =
    result?.findings.filter((finding) => finding.operatorNote).length || 0;
  return (
    <section className="access-audit" aria-label="Offboarding access audit">
      <div className="audit-intro">
        <div>
          <span className="audit-eyebrow">OFFLINE ACCESS RECONCILIATION</span>
          <h2>Know what is still open after departure.</h2>
          <p>
            Compare a roster, SaaS account list, and device inventory. Relay
            flags access and equipment that need an IT owner’s verification.
          </p>
        </div>
        <div className="audit-intro-icon">
          <ShieldCheck size={29} />
        </div>
      </div>

      <div className="audit-sources">
        {SOURCES.map((source, index) => (
          <article className="audit-source" key={source.key}>
            <span className="audit-source-number">0{index + 1}</span>
            <FileSpreadsheet size={22} />
            <h3>{source.title}</h3>
            <p>
              Columns: <code>{source.columns}</code>
            </p>
            <label className="audit-upload">
              <Upload size={15} />
              {sourceFiles[source.key].name || "Choose CSV"}
              <input
                type="file"
                accept=".csv,text/csv"
                aria-label={`Import ${source.title} CSV`}
                onChange={(e) => {
                  void importFile(source.key, e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
          </article>
        ))}
      </div>
      <div className="audit-controls">
        <button className="audit-primary" onClick={() => run()} disabled={busy}>
          <Play size={16} /> Run audit
        </button>
        <button
          className="audit-secondary"
          onClick={() => void loadSample()}
          disabled={busy}
        >
          {busy ? (
            <LoaderCircle className="audit-spin" size={16} />
          ) : (
            <FileSpreadsheet size={16} />
          )}
          {busy ? "Loading sample…" : "Run synthetic example"}
        </button>
        <span>
          Input stays in this browser session. No admin APIs are called.
        </span>
      </div>

      {error && (
        <div className="audit-alert error" role="alert">
          <CircleAlert size={18} />
          {error}
        </div>
      )}
      {notice && (
        <div className="audit-alert" role="status">
          {notice}
        </div>
      )}

      {result ? (
        <>
          <div className="audit-summary">
            <div>
              <span>Departed employees</span>
              <strong>{result.departedEmployees}</strong>
              <small>of {result.employees} in roster</small>
            </div>
            <div>
              <span>Snapshot findings</span>
              <strong>{result.findings.length}</strong>
              <small>{recordedCount} operator notes recorded</small>
            </div>
            <div>
              <span>Records checked</span>
              <strong>{result.accounts + result.devices}</strong>
              <small>
                {result.accounts} accounts · {result.devices} devices
              </small>
            </div>
          </div>
          <div className="audit-results-title">
            <div>
              <span className="audit-eyebrow">OPERATOR WORKLIST</span>
              <h3>Findings that need a person</h3>
            </div>
            <button
              className="audit-secondary"
              onClick={() =>
                downloadJson(
                  "relay-offboarding-audit.json",
                  exportAccessAudit(result),
                )
              }
            >
              <ArrowDownToLine size={16} /> Export audit packet
            </button>
          </div>
          {result.findings.length === 0 ? (
            <div className="audit-empty">
              No active accounts or assigned devices were found for departed
              employees in these three files. Check export completeness before
              treating this as clearance.
            </div>
          ) : (
            <div className="audit-findings">
              {result.findings.slice(0, visibleFindings).map((finding) => (
                <article
                  className={`audit-finding ${finding.operatorNote ? "noted" : ""}`}
                  key={finding.id}
                >
                  <div className="audit-finding-head">
                    <span className="audit-finding-type">
                      {finding.type === "active-account"
                        ? "ACTIVE ACCOUNT"
                        : "ASSIGNED DEVICE"}
                    </span>
                    <span className="audit-finding-state">
                      {finding.operatorNote ? (
                        <>
                          <Check size={14} /> Action noted
                        </>
                      ) : (
                        "Needs action"
                      )}
                    </span>
                  </div>
                  <h4>{finding.system}</h4>
                  <p className="audit-person">{finding.email}</p>
                  <p>{finding.detail}</p>
                  <div className="audit-next">
                    <strong>Next action</strong>
                    {finding.action}
                  </div>
                  <small>Evidence: {finding.source}</small>
                  {finding.operatorNote ? (
                    <div className="audit-recorded-note">
                      {finding.operatorNote}
                      <small>
                        {new Date(finding.notedAt || "").toLocaleString()}
                      </small>
                    </div>
                  ) : (
                    <div className="audit-note-row">
                      <label>
                        Action taken / follow-up note
                        <textarea
                          value={notes[finding.id] || ""}
                          onChange={(e) =>
                            setNotes((current) => ({
                              ...current,
                              [finding.id]: e.target.value,
                            }))
                          }
                          rows={2}
                          placeholder="Confirmed in the admin console or asset record…"
                        />
                      </label>
                      <button onClick={() => recordNote(finding.id)}>
                        <Check size={15} /> Record operator note
                      </button>
                    </div>
                  )}
                </article>
              ))}
              {visibleFindings < result.findings.length && (
                <button
                  className="audit-secondary audit-show-more"
                  onClick={() =>
                    setVisibleFindings((count) => count + FINDINGS_PAGE_SIZE)
                  }
                >
                  Show next{" "}
                  {Math.min(
                    FINDINGS_PAGE_SIZE,
                    result.findings.length - visibleFindings,
                  )}{" "}
                  of {result.findings.length} findings
                </button>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="audit-empty">
          <ShieldCheck size={28} />
          <strong>Your comparison starts here.</strong>
          <p>
            Import all three normalized CSVs, or run the synthetic example to
            see a complete offboarding review.
          </p>
        </div>
      )}
      <p className="audit-disclaimer">
        This is a local portfolio workflow. CSV completeness and account status
        must be confirmed in the source systems. A note does not clear a source
        finding; re-import current exports to confirm the change. Relay does not
        disable accounts, wipe devices, or prove that offboarding is complete.
      </p>
    </section>
  );
}
