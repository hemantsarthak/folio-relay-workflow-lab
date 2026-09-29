import { useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  CircleAlert,
  FileText,
  LoaderCircle,
  Upload,
} from "lucide-react";
import * as pdfjs from "pdfjs-dist";
import { classify, downloadJson, type Mode } from "../../src/shared/api";
import {
  exportCase,
  issueRequest,
  receiveResponse,
  resolveCase,
  responseIssue,
  type QuestionCase,
} from "./case";
import "./CaseRoom.css";

function requestTemplate(caseData: QuestionCase) {
  return `Please upload your ${caseData.expectedYear} ${caseData.expectedForm}.${caseData.context ? ` ${caseData.context}` : ""}`;
}

function sampleResponse(caseData: QuestionCase) {
  const header =
    caseData.expectedForm === "K-1"
      ? "Schedule K-1 (Form 1065)"
      : caseData.expectedForm === "W-2"
        ? "Form W-2 Wage and Tax Statement"
        : "Form 1099-INT Interest Income";
  return `SYNTHETIC DEMO DOCUMENT — NOT FOR FILING\n${header}\nTax year: ${caseData.expectedYear}\nRecipient: ${caseData.client} (fictional)\nThis is an invented fixture.`;
}

async function readAttachment(file: File): Promise<string> {
  if (file.size > 10 * 1024 * 1024)
    throw new Error("This file exceeds 10 MB. Use a smaller, searchable file.");
  if (!/\.(pdf|txt)$/i.test(file.name))
    throw new Error("Choose a text-layer PDF or UTF-8 TXT file.");
  if (/\.txt$/i.test(file.name)) {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(
      await file.arrayBuffer(),
    );
    if (!text.trim()) throw new Error("The attachment is empty.");
    if (text.length > 60000)
      throw new Error("This file contains too much text for the demo.");
    return text;
  }
  const task = pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
  });
  try {
    const pdf = await task.promise;
    if (pdf.numPages > 150)
      throw new Error("This PDF exceeds 150 pages. Split it before upload.");
    let text = "";
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item) =>
          "str" in item
            ? item.str + ("hasEOL" in item && item.hasEOL ? "\n" : " ")
            : "",
        )
        .join("");
      if (pageText.trim().length < 15)
        throw new Error(
          `Page ${pageNumber} has no readable text. Run OCR first.`,
        );
      text += `\n— Page ${pageNumber} —\n${pageText}`;
      if (text.length > 60000)
        throw new Error("This PDF contains too much text for the demo.");
    }
    return text;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not read PDF.";
    if (/password/i.test(message))
      throw new Error("This PDF is encrypted. Upload an unlocked copy.");
    throw error;
  } finally {
    await task.destroy();
  }
}

export default function CaseRoom({
  caseData,
  onChange,
  provider,
  mode,
  role,
  onRoleChange: setRole,
}: {
  caseData: QuestionCase;
  onChange: (next: QuestionCase) => void;
  provider: string | null;
  mode: Mode;
  role: "preparer" | "client";
  onRoleChange: (role: "preparer" | "client") => void;
}) {
  const [draft, setDraft] = useState(() => requestTemplate(caseData));
  const [reply, setReply] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const update = (next: QuestionCase) => {
    onChange(next);
    setError("");
    setNotice("");
  };
  const mismatch = responseIssue(caseData);

  const sendRequest = () => {
    try {
      update(issueRequest(caseData, draft));
      setNotice(
        "Request issued. Switch to “Client” at the top to answer it as the client. No real message was sent.",
      );
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const submit = async (attachment: File | null) => {
    if (!attachment) {
      setError("Choose an attachment or use the synthetic sample response.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const text = await readAttachment(attachment);
      const decision = await classify("tax", text, mode);
      update(
        receiveResponse(caseData, {
          name: attachment.name,
          text,
          category: decision.category,
          source: decision.source,
          model: decision.model,
          reply,
        }),
      );
      setFile(null);
      setReply("");
      if (fileInput.current) fileInput.current.value = "";
      setRole("preparer");
      setNotice(
        `Response received and routed by ${decision.source === "jev" ? `Jev (${decision.model})` : "local rules"}. Now review it below.`,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const closeQuestion = () => {
    try {
      update(resolveCase(caseData, reviewNote));
      setNotice(
        "Question closed by the preparer; the decision is in the audit trail.",
      );
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <section className="case-room" aria-label="Client question case room">
      <div className="case-room-top">
        <div>
          <span className="case-kicker">CASE {caseData.id} · SYNTHETIC</span>
          <h2>
            {caseData.client} · {caseData.expectedYear} {caseData.expectedForm}
          </h2>
          <p>
            {caseData.initial
              ? `${caseData.initial.year} source on file for a ${caseData.expectedYear} request.`
              : caseData.context ||
                `Request a ${caseData.expectedYear} ${caseData.expectedForm} and review the response.`}
          </p>
        </div>
        <span className={`case-status ${caseData.status}`}>
          {caseData.status.replaceAll("-", " ")}
        </span>
      </div>

      <div className="case-toolbar">
        <span className="case-role-label">
          {role === "preparer" ? "Preparer’s view" : "What the client sees"}
        </span>
        <div className="case-actions">
          <span>Saved with client workspace</span>
          <button
            onClick={() =>
              downloadJson(
                "folio-question-resolution.json",
                exportCase(caseData),
              )
            }
          >
            <ArrowDownToLine size={16} /> Export
          </button>
        </div>
      </div>

      {error && (
        <div className="case-alert error" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="case-alert" role="status">
          {notice}
        </div>
      )}

      {role === "preparer" ? (
        <div className="case-grid">
          <div className="case-main-stack">
            <article className="case-card">
              <span className="case-step">01 / SOURCE</span>
              <h3>
                {caseData.initial
                  ? "Year mismatch in the packet"
                  : "Document needed"}
              </h3>
              <p>
                Expected: {caseData.expectedYear} {caseData.expectedForm} for{" "}
                {caseData.client}
              </p>
              {caseData.initial ? (
                <div className="case-evidence">
                  <FileText size={20} />
                  <div>
                    <strong>{caseData.initial.name}</strong>
                    <code>{caseData.initial.excerpt}</code>
                    <small>
                      Page {caseData.initial.page} · received for{" "}
                      {caseData.initial.year}
                    </small>
                  </div>
                </div>
              ) : (
                <div className="case-evidence">
                  <FileText size={20} />
                  <div>
                    <strong>No {caseData.expectedForm} on file yet</strong>
                    <small>
                      {caseData.context ||
                        "Open a request to collect the document."}
                    </small>
                  </div>
                </div>
              )}
              {caseData.initial && (
                <details className="case-source-text">
                  <summary>Read original source text</summary>
                  <pre>{caseData.initial.text}</pre>
                </details>
              )}
              <p className="case-explain">
                {caseData.initial
                  ? "A deterministic year check found the mismatch. No tax conclusion was made from the income amount."
                  : "This request starts with no source document. The preparer will check the client's response before closing it."}
              </p>
            </article>

            <article className="case-card">
              <span className="case-step">02 / QUESTION</span>
              <h3>Ask for the right document</h3>
              {caseData.status === "needs-request" ||
              caseData.status === "response-received" ? (
                <>
                  <label htmlFor="case-request">
                    Request shown to the client
                  </label>
                  <textarea
                    id="case-request"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    rows={3}
                  />
                  <button className="case-primary" onClick={sendRequest}>
                    {caseData.status === "response-received"
                      ? "Request another copy"
                      : "Issue request in demo"}
                    <ArrowRight size={16} />
                  </button>
                </>
              ) : (
                <div className="case-message">
                  <strong>{caseData.request?.text}</strong>
                  <small>
                    Visible in the client view. Nothing was sent externally.
                  </small>
                </div>
              )}
            </article>

            <article className="case-card">
              <span className="case-step">03 / REVIEW</span>
              <h3>Verify the response</h3>
              {caseData.response ? (
                <>
                  <div className="case-evidence response">
                    <FileText size={20} />
                    <div>
                      <strong>{caseData.response.name}</strong>
                      <code>
                        {caseData.response.excerpt ||
                          "No tax-year excerpt found"}
                      </code>
                      <small>
                        {caseData.response.year ?? "Unknown year"} ·{" "}
                        {caseData.response.category} suggested by{" "}
                        {caseData.response.source === "jev"
                          ? `Jev (${caseData.response.model})`
                          : "local demonstration rules"}
                      </small>
                    </div>
                  </div>
                  <details className="case-source-text">
                    <summary>Read response source text</summary>
                    <pre>{caseData.response.text}</pre>
                  </details>
                  {caseData.response.reply && (
                    <p className="case-client-reply">
                      Client note: {caseData.response.reply}
                    </p>
                  )}
                  {mismatch ? (
                    <div className="case-inline-warning">
                      <CircleAlert size={18} />
                      {mismatch}
                    </div>
                  ) : caseData.status === "resolved" ? (
                    <div className="case-inline-success">
                      <Check size={18} />
                      Resolved: {caseData.resolution?.note}
                    </div>
                  ) : (
                    <>
                      <div className="case-inline-success">
                        <Check size={18} />
                        Year and route match. You still make the final call.
                      </div>
                      <label htmlFor="case-review-note">
                        How did you verify it?
                      </label>
                      <textarea
                        id="case-review-note"
                        value={reviewNote}
                        onChange={(e) => setReviewNote(e.target.value)}
                        rows={2}
                        placeholder="I checked the tax year and form header on the source."
                      />
                      <button className="case-primary" onClick={closeQuestion}>
                        <Check size={16} /> Confirm and close question
                      </button>
                    </>
                  )}
                </>
              ) : (
                <p className="case-empty">
                  A client response will appear here with its source evidence
                  and routing provenance.
                </p>
              )}
            </article>
          </div>
          <aside className="case-side-stack">
            <article className="case-card case-timeline">
              <span className="case-step">CASE TRAIL</span>
              <h3>What happened</h3>
              <ol>
                {caseData.events.map((event, index) => (
                  <li key={`${event.at}-${index}`}>
                    <strong>{event.actor}</strong>
                    <span>{event.action}</span>
                    <time>{new Date(event.at).toLocaleString()}</time>
                  </li>
                ))}
              </ol>
            </article>
            <div className="case-privacy">
              Synthetic files only for this portfolio demo. The client workspace
              stores extracted case text in this browser; Export excludes raw
              file contents. Live Jev sends attachment text to{" "}
              {provider || "the configured provider"}.
            </div>
          </aside>
        </div>
      ) : (
        <div className="case-client-layout">
          <article className="case-card">
            <span className="case-step">CLIENT PORTAL VIEW · SYNTHETIC</span>
            <h3>Your tax team needs one document</h3>
            {caseData.request ? (
              <div className="case-message">
                <strong>{caseData.request.text}</strong>
                <small>Requested by the preparer in this local demo.</small>
              </div>
            ) : (
              <p className="case-empty">
                The preparer hasn’t issued this request yet. Switch to the
                preparer view to send it.
              </p>
            )}
            {caseData.status === "awaiting-client" && (
              <>
                <div className="case-upload-box">
                  <Upload size={23} />
                  <div>
                    <strong>
                      {file?.name || `Choose the ${caseData.expectedForm}`}
                    </strong>
                    <small>
                      Text-layer PDF or TXT, up to 10 MB. Scans need OCR first.
                    </small>
                  </div>
                  <button onClick={() => fileInput.current?.click()}>
                    Choose file
                  </button>
                  <input
                    ref={fileInput}
                    type="file"
                    accept=".pdf,.txt"
                    aria-label={`Choose ${caseData.expectedForm} attachment`}
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                </div>
                <label htmlFor="case-client-reply">
                  Note to preparer (optional)
                </label>
                <textarea
                  id="case-client-reply"
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  rows={2}
                  placeholder="This is the corrected 2025 copy."
                />
                <div className="case-submit-row">
                  <button
                    className="case-primary"
                    onClick={() => void submit(file)}
                    disabled={busy}
                  >
                    {busy ? (
                      <LoaderCircle className="case-spin" size={16} />
                    ) : (
                      <Upload size={16} />
                    )}
                    {busy ? "Reading and routing…" : "Submit attachment"}
                  </button>
                  <button
                    className="case-sample-button"
                    onClick={() =>
                      void submit(
                        new File(
                          [sampleResponse(caseData)],
                          `sample-${caseData.expectedYear}-${caseData.expectedForm.toLowerCase()}.txt`,
                          {
                            type: "text/plain",
                          },
                        ),
                      )
                    }
                    disabled={busy}
                  >
                    Use synthetic sample
                  </button>
                </div>
              </>
            )}
            {caseData.status === "response-received" && (
              <p className="case-inline-success">
                <Check size={18} />
                Your response is with the preparer for review.
              </p>
            )}
            {caseData.status === "resolved" && (
              <p className="case-inline-success">
                <Check size={18} />
                The preparer closed this question.
              </p>
            )}
          </article>
        </div>
      )}
    </section>
  );
}
