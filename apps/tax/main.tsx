import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
} from "@tanstack/react-query";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCheck,
  ChevronRight,
  Compass,
  Clock3,
  FileText,
  Files,
  FolderOpen,
  History,
  LayoutGrid,
  LoaderCircle,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Upload,
  X,
  AlertCircle,
  ExternalLink,
  MessageSquareText,
} from "lucide-react";
import * as pdfjs from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import {
  classify,
  downloadJson,
  getConfig,
  TAX_CATEGORIES,
  type Decision,
  type Mode,
} from "../../src/shared/api";
import ClientWorkspace from "./ClientWorkspace";
import LiveAccess from "../../src/shared/LiveAccess";
import "../../src/shared/demo.css";
import "./style.css";
import "./theme.css";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;
type Doc = {
  id: string;
  name: string;
  text: string;
  size: number;
  hash?: string;
  file?: File;
  url?: string;
  synthetic: boolean;
  processing: boolean;
  error?: string;
  duplicateOf?: string;
  decision?: Decision;
  override?: string;
  reviewed: boolean;
  received: string;
};
type Event = { id: string; at: string; document: string; message: string };
type Filter =
  "All documents" | "Needs review" | "Ready" | "Reviewed" | "Duplicates";
type Page = "case" | "documents" | "activity" | "about";
const pageCopy: Record<
  Page,
  { breadcrumb: string; eyebrow: string; title: string; subtitle: string }
> = {
  case: {
    breadcrumb: "Clients & requests",
    eyebrow: "PREPARER ↔ CLIENT",
    title: "Clients & requests",
    subtitle:
      "Ask a client for a document, answer as the client, then review what came back. The guide below always shows the next step.",
  },
  documents: {
    breadcrumb: "Batch triage",
    eyebrow: "SANDBOX",
    title: "Batch document triage",
    subtitle:
      "A sandbox: drop a mixed packet of PDFs and let Jev or local rules sort it into W-2, 1099, K-1 and the rest. You confirm each one.",
  },
  activity: {
    breadcrumb: "Activity log",
    eyebrow: "AUDIT TRAIL",
    title: "A clear trail of decisions.",
    subtitle:
      "Follow the suggestions, corrections, and reviews behind your packet.",
  },
  about: {
    breadcrumb: "How it works",
    eyebrow: "START HERE",
    title: "Collect the right documents, first time.",
    subtitle:
      "Folio is the loop between a tax preparer and their client: ask for a specific document, receive it, let Jev route it, and verify it before the return moves on.",
  },
};
const samples = [
  {
    name: "2025_W2_Maple_Studio.txt",
    text: "SYNTHETIC DEMO DOCUMENT — NOT FOR FILING\n\nForm W-2 · Wage and Tax Statement\nTax year: 2025\nEmployer: Maple Studio (fictional)\nEmployee: Alex Sample (fictional)\n\nBox 1 — Wages, tips, other compensation: $68,400.00\nBox 2 — Federal income tax withheld: $7,100.00\n\nThis is a small invented text fixture, not an official tax form.\nNo real personal or taxpayer information is included.",
  },
  {
    name: "2025_1099_Orchard_Bank.txt",
    text: "SYNTHETIC DEMO DOCUMENT — NOT FOR FILING\n\nForm 1099-INT · Interest Income\nTax year: 2025\nPayer: Orchard Bank (fictional)\nRecipient: Alex Sample (fictional)\n\nBox 1 — Interest income: $245.60\n\nInvented text fixture. No real accounts or taxpayer information.",
  },
  {
    name: "2025_K1_Fieldwork.txt",
    text: "SYNTHETIC DEMO DOCUMENT — NOT FOR FILING\n\nSchedule K-1 (Form 1065)\nPartner’s Share of Income, Deductions, Credits, etc.\nTax year: 2025\nPartnership: Fieldwork Partners (fictional)\nPartner: Alex Sample (fictional)\n\nOrdinary business income: $3,400.00\n\nInvented fixture. This is not an official filing document.",
  },
  {
    name: "receipt_office_supplies.txt",
    text: "SYNTHETIC DEMO DOCUMENT — NOT FOR FILING\n\nRECEIPT\nPaper & Pine Office Supply (fictional)\nDate: August 12, 2025\nPrinter paper: $18.00\nNotebook: $12.00\nTotal paid: $30.00\n\nThis fixture does not establish deductibility.",
  },
  {
    name: "client_notes.txt",
    text: "SYNTHETIC DEMO DOCUMENT\n\nHi, here are my documents for this year.\nI moved in September and started a new job.\nThere may be another statement coming next week.\n\nPlease let me know what is missing.\nAlex Sample (fictional)",
  },
];
const initialDocs: Doc[] = samples.map((s, i) => ({
  ...s,
  id: `sample-${i}`,
  size: new TextEncoder().encode(s.text).length,
  synthetic: true,
  processing: false,
  reviewed: false,
  received: new Date().toISOString(),
}));
const uid = () => crypto.randomUUID();
const sizeLabel = (size: number) =>
  size > 1024 * 1024
    ? `${(size / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(size / 1024))} KB`;
function PdfPreview({ url, name }: { url: string; name: string }) {
  const [pdf, setPdf] = useState<pdfjs.PDFDocumentProxy | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [width, setWidth] = useState(300);
  const [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(true);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasHost = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let disposed = false;
    setLoading(true);
    setError("");
    setPdf(null);
    setPageNumber(1);
    const task = pdfjs.getDocument({ url });
    void task.promise
      .then((document) => {
        if (!disposed) {
          setPdf(document);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!disposed) {
          setError(
            "The original PDF could not be opened. Retry the preview or use the Source text tab.",
          );
          setLoading(false);
        }
      });
    return () => {
      disposed = true;
      void task.destroy().catch(() => {});
    };
  }, [url, attempt]);
  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const next = Math.floor(entries[0].contentRect.width);
      if (next > 0) setWidth(next);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!pdf || !canvasHost.current) return;
    let disposed = false;
    let task: pdfjs.RenderTask | undefined;
    const canvas = document.createElement("canvas");
    canvas.setAttribute("role", "img");
    canvas.setAttribute(
      "aria-label",
      `Original PDF ${name}, page ${pageNumber} of ${pdf.numPages}. Readable text is available in the Source text tab.`,
    );
    canvasHost.current.replaceChildren(canvas);
    setRendering(true);
    setError("");
    void (async () => {
      try {
        const page = await pdf.getPage(pageNumber);
        if (disposed) return;
        const base = page.getViewport({ scale: 1 });
        const displayWidth = Math.max(140, width - 16) * zoom;
        const density = Math.min(window.devicePixelRatio || 1, 2);
        const viewport = page.getViewport({
          scale: (displayWidth / base.width) * density,
        });
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        canvas.style.width = `${viewport.width / density}px`;
        canvas.style.height = `${viewport.height / density}px`;
        task = page.render({ canvas, viewport });
        await task.promise;
        if (!disposed) setRendering(false);
      } catch (problem) {
        if (!disposed) {
          setRendering(false);
          setError(
            problem instanceof Error &&
              problem.name === "RenderingCancelledException"
              ? "Preview was interrupted. Retry to display this page."
              : "This page could not be rendered. Retry the preview or use Source text.",
          );
        }
      }
    })();
    return () => {
      disposed = true;
      task?.cancel();
      canvas.remove();
    };
  }, [pdf, pageNumber, width, zoom, name]);
  return (
    <div className="pdf-viewer">
      <div className="pdf-controls">
        <button
          className="icon-button"
          aria-label="Previous PDF page"
          disabled={!pdf || pageNumber <= 1}
          onClick={() => setPageNumber((p) => p - 1)}
        >
          <ArrowLeft size={14} />
        </button>
        <span aria-live="polite">
          {pdf ? `${pageNumber} / ${pdf.numPages}` : "— / —"}
        </span>
        <button
          className="icon-button"
          aria-label="Next PDF page"
          disabled={!pdf || pageNumber >= pdf.numPages}
          onClick={() => setPageNumber((p) => p + 1)}
        >
          <ArrowRight size={14} />
        </button>
        <select
          aria-label="PDF zoom"
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
        >
          <option value={1}>Fit width</option>
          <option value={1.5}>150%</option>
          <option value={2}>200%</option>
        </select>
      </div>
      <div
        className="pdf-canvas-viewport"
        ref={viewportRef}
        aria-busy={loading || rendering}
      >
        {(loading || rendering) && (
          <div className="pdf-loading" role="status">
            <LoaderCircle className="spin" size={17} />
            {loading ? "Opening original PDF…" : "Rendering page…"}
          </div>
        )}
        {error && (
          <div className="pdf-error" role="alert">
            <AlertCircle size={19} />
            <p>{error}</p>
            <button
              className="text-button"
              onClick={() => setAttempt((n) => n + 1)}
            >
              Retry PDF preview
            </button>
          </div>
        )}
        <div className="pdf-canvas-host" ref={canvasHost} />
      </div>
      <p className="pdf-footnote">
        Original document · rendered locally with PDF.js
      </p>
    </div>
  );
}
function pageFromHash(): Page {
  const hash = location.hash.slice(1);
  return hash in pageCopy ? (hash as Page) : "about";
}
function App() {
  const [docs, setDocs] = useState<Doc[]>(initialDocs);
  const [selected, setSelected] = useState("sample-0");
  const [threshold, setThreshold] = useState(85);
  const [filter, setFilter] = useState<Filter>("All documents");
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<Mode>("demo");
  const [events, setEvents] = useState<Event[]>([
    {
      id: "initial",
      at: new Date().toISOString(),
      document: "Sample packet",
      message:
        "Loaded five synthetic text documents. No real taxpayer information.",
    },
  ]);
  const [page, setPageState] = useState<Page>(pageFromHash);
  const setPage = (next: Page) => {
    setPageState(next);
    history.replaceState(
      null,
      "",
      next === "about" ? location.pathname : `#${next}`,
    );
    window.scrollTo(0, 0);
  };
  useEffect(() => {
    const onHash = () => setPageState(pageFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const [preview, setPreview] = useState<"source" | "pdf">("source");
  const [notice, setNotice] = useState("");
  const [dragging, setDragging] = useState(false);
  const [mobileDetail, setMobileDetail] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const controllers = useRef(new Map<string, AbortController>());
  const jobs = useRef(new Map<string, number>());
  const hashes = useRef(new Map<string, string>());
  const pendingUploads = useRef<Promise<void>>(Promise.resolve());
  const started = useRef(false);
  const config = useQuery({ queryKey: ["config"], queryFn: getConfig });
  const mutation = useMutation({
    mutationFn: ({
      text,
      requestMode,
      signal,
    }: {
      text: string;
      requestMode: Mode;
      signal: AbortSignal;
    }) => classify("tax", text, requestMode, signal),
  });
  function patch(id: string, fields: Partial<Doc>) {
    setDocs((all) => all.map((d) => (d.id === id ? { ...d, ...fields } : d)));
  }
  function log(document: string, message: string) {
    setEvents((all) => [
      { id: uid(), at: new Date().toISOString(), document, message },
      ...all,
    ]);
  }
  function releaseHash(id: string) {
    for (const [hash, owner] of hashes.current)
      if (owner === id) hashes.current.delete(hash);
    setDocs((all) =>
      all.map((d) =>
        d.duplicateOf === id
          ? {
              ...d,
              duplicateOf: undefined,
              text: "",
              error:
                "The original could not be processed. Retry this document to read it independently.",
            }
          : d,
      ),
    );
  }
  function cancel(doc: Doc) {
    jobs.current.set(doc.id, (jobs.current.get(doc.id) || 0) + 1);
    controllers.current.get(doc.id)?.abort();
    controllers.current.delete(doc.id);
    if (!doc.text) releaseHash(doc.id);
    patch(doc.id, {
      processing: false,
      error: "Processing cancelled. Retry when you are ready.",
    });
    log(doc.name, "Processing cancelled by reviewer.");
  }
  async function triage(doc: Doc, requestMode: Mode = mode) {
    controllers.current.get(doc.id)?.abort();
    const controller = new AbortController();
    controllers.current.set(doc.id, controller);
    const job = (jobs.current.get(doc.id) || 0) + 1;
    jobs.current.set(doc.id, job);
    patch(doc.id, { processing: true, error: undefined });
    try {
      const decision = await mutation.mutateAsync({
        text: doc.text,
        requestMode,
        signal: controller.signal,
      });
      if (jobs.current.get(doc.id) !== job) return;
      patch(doc.id, {
        decision,
        processing: false,
        error: undefined,
        reviewed: false,
        override: undefined,
      });
      log(
        doc.name,
        `${decision.source === "jev" ? "Jev" : "Local demo rules"} suggested ${decision.category} (${Math.round(decision.confidence * 100)}% score).`,
      );
    } catch (error) {
      if (jobs.current.get(doc.id) !== job) return;
      patch(doc.id, {
        processing: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to classify. Retry this document.",
      });
    } finally {
      if (jobs.current.get(doc.id) === job) controllers.current.delete(doc.id);
    }
  }
  useEffect(() => {
    if (!started.current) {
      started.current = true;
      initialDocs.forEach((d) => {
        void (async () => {
          const data = new TextEncoder().encode(d.text);
          const hash = Array.from(
            new Uint8Array(await crypto.subtle.digest("SHA-256", data)),
          )
            .map((x) => x.toString(16).padStart(2, "0"))
            .join("");
          hashes.current.set(hash, d.id);
          patch(d.id, { hash });
          await triage(d, "demo");
        })();
      });
    }
  }, []);
  async function ingest(file: File, existing?: Doc) {
    const id = existing?.id || uid();
    const doc: Doc = existing || {
      id,
      name: file.name,
      text: "",
      size: file.size,
      file,
      synthetic: false,
      processing: true,
      reviewed: false,
      received: new Date().toISOString(),
    };
    if (!existing) {
      setDocs((all) => [...all, doc]);
      setSelected(id);
      setMobileDetail(true);
      setPreview("source");
    } else patch(id, { processing: true, error: undefined });
    const job = (jobs.current.get(id) || 0) + 1;
    jobs.current.set(id, job);
    const current = () => jobs.current.get(id) === job;
    try {
      if (file.size > 10 * 1024 * 1024)
        throw new Error(
          "This file exceeds 10 MB. Split the document or upload a smaller file.",
        );
      if (!/\.(pdf|txt|csv)$/i.test(file.name))
        throw new Error(
          "Unsupported file. Choose a PDF, TXT, or CSV document.",
        );
      const data = await file.arrayBuffer();
      if (!current()) return;
      const hash = Array.from(
        new Uint8Array(await crypto.subtle.digest("SHA-256", data)),
      )
        .map((x) => x.toString(16).padStart(2, "0"))
        .join("");
      if (!current()) return;
      const duplicateOf = hashes.current.get(hash);
      if (duplicateOf && duplicateOf !== id) {
        patch(id, {
          hash,
          duplicateOf,
          processing: false,
          error: undefined,
          text: "This file is byte-for-byte identical to an existing upload. Open the original document to review its source.",
        });
        log(
          file.name,
          "Duplicate upload detected by SHA-256; excluded from automatic routing.",
        );
        return;
      }
      hashes.current.set(hash, id);
      let text = "";
      let url = existing?.url;
      if (/\.pdf$/i.test(file.name)) {
        const task = pdfjs.getDocument({ data: new Uint8Array(data) });
        const stop = setInterval(() => {
          if (!current()) void task.destroy();
        }, 150);
        try {
          const pdf = await task.promise;
          if (pdf.numPages > 150)
            throw new Error(
              "This PDF exceeds 150 pages. Split it into smaller documents.",
            );
          for (let p = 1; p <= pdf.numPages; p++) {
            if (!current()) return;
            const page = await pdf.getPage(p);
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
                `Page ${p} has little or no readable text. Run OCR or remove blank pages, then upload the searchable PDF.`,
              );
            text += `\n— Page ${p} —\n${pageText}`;
            if (text.length > 60000)
              throw new Error(
                "Extracted text exceeds 60,000 characters. Split the PDF into smaller documents.",
              );
          }
          url = url || URL.createObjectURL(file);
        } finally {
          clearInterval(stop);
          await task.destroy();
        }
      } else {
        try {
          text = new TextDecoder("utf-8", { fatal: true }).decode(data);
        } catch {
          throw new Error(
            "This file is not readable UTF-8 text. Save it as UTF-8 TXT or CSV and try again.",
          );
        }
      }
      if (!current()) return;
      if (!text.trim())
        throw new Error(
          "The document is empty. Upload a file containing readable text.",
        );
      if (text.length > 60000)
        throw new Error(
          "Text exceeds 60,000 characters. Split it into smaller documents.",
        );
      hashes.current.set(hash, id);
      const parsed = { ...doc, text, hash, url, processing: false };
      patch(id, parsed);
      log(file.name, "Source extracted locally in the browser.");
      await triage(parsed, mode);
    } catch (error) {
      if (!current()) return;
      releaseHash(id);
      const message =
        error instanceof Error
          ? error.message
          : "Unable to read this document.";
      patch(id, {
        processing: false,
        error: /password/i.test(message)
          ? "This PDF is encrypted. Upload an unlocked copy that you are authorized to access."
          : message,
      });
      log(file.name, "Document processing failed. Source needs attention.");
    }
  }
  function upload(files: FileList | File[] | null) {
    if (!files) return;
    const batch = Array.from(files);
    if (batch.length > 20) {
      setNotice("Choose at most 20 documents at a time.");
      return;
    }
    setNotice(
      `${batch.length} document${batch.length === 1 ? "" : "s"} queued. Files are processed one at a time.`,
    );
    batch.forEach((file) => {
      pendingUploads.current = pendingUploads.current.then(() => ingest(file));
    });
  }
  function state(d: Doc): string {
    if (d.processing) return "Processing";
    if (d.error) return "Needs attention";
    if (d.duplicateOf) return "Duplicate";
    if (d.reviewed) return "Reviewed";
    if (!d.decision) return "Not classified";
    if (d.override) return "Needs review";
    if (
      d.decision.category === "Other" ||
      d.decision.attention >= 0.5 ||
      d.decision.confidence * 100 < threshold
    )
      return "Needs review";
    return "Ready";
  }
  const needs = docs.filter((d) =>
    ["Needs review", "Needs attention", "Not classified"].includes(state(d)),
  ).length;
  const ready = docs.filter((d) => state(d) === "Ready").length;
  const reviewed = docs.filter((d) => d.reviewed).length;
  const visible = docs.filter(
    (d) =>
      (!search ||
        `${d.name} ${d.override || d.decision?.category || ""}`
          .toLowerCase()
          .includes(search.toLowerCase())) &&
      (filter === "All documents" ||
        (filter === "Needs review" &&
          ["Needs review", "Needs attention", "Not classified"].includes(
            state(d),
          )) ||
        (filter === "Ready" && state(d) === "Ready") ||
        (filter === "Reviewed" && d.reviewed) ||
        (filter === "Duplicates" && !!d.duplicateOf)),
  );
  const active = docs.find((d) => d.id === selected);
  function select(d: Doc) {
    setSelected(d.id);
    setPreview(d.url ? "pdf" : "source");
    setMobileDetail(true);
  }
  function exportManifest() {
    downloadJson("folio-review-manifest.json", {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      project: "Folio portfolio demonstration",
      threshold,
      disclaimer:
        "Classification is document routing only, not tax advice or filing readiness. Demo scores are illustrative, not calibrated.",
      documents: docs.map(
        ({
          id,
          name,
          hash,
          synthetic,
          decision,
          override,
          reviewed,
          duplicateOf,
          error,
          received,
        }) => ({
          id,
          name,
          sha256: hash,
          synthetic,
          decision,
          reviewerCategory: override,
          reviewed,
          duplicateOf,
          error,
          received,
          status: state(docs.find((d) => d.id === id)!),
        }),
      ),
      audit: events,
    });
    log(
      "Review manifest",
      "Exported classification metadata and audit history. Document contents excluded.",
    );
    setNotice("Review manifest downloaded. Source text is excluded.");
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/apps/tax/">
          <span className="brand-icon">
            <Files size={22} />
          </span>
          folio<span className="brand-dot">.</span>
        </a>
        <nav aria-label="Main navigation">
          <p className="nav-section">Start</p>
          <button
            className={page === "about" ? "nav-item active" : "nav-item"}
            aria-current={page === "about" ? "page" : undefined}
            onClick={() => setPage("about")}
          >
            <Compass size={18} />
            <span>How Folio works</span>
          </button>
          <p className="nav-section">Client work</p>
          <button
            className={page === "case" ? "nav-item active" : "nav-item"}
            aria-current={page === "case" ? "page" : undefined}
            onClick={() => setPage("case")}
          >
            <MessageSquareText size={18} />
            <span>
              Clients & requests
              <span className="nav-hint">Preparer ↔ client loop</span>
            </span>
          </button>
          <button
            className={page === "activity" ? "nav-item active" : "nav-item"}
            aria-current={page === "activity" ? "page" : undefined}
            onClick={() => setPage("activity")}
          >
            <History size={18} />
            <span>Activity log</span>
          </button>
          <p className="nav-section">Sandbox</p>
          <button
            className={page === "documents" ? "nav-item active" : "nav-item"}
            aria-current={page === "documents" ? "page" : undefined}
            onClick={() => setPage("documents")}
          >
            <LayoutGrid size={18} />
            <span>
              Batch triage
              <span className="nav-hint">Sort a mixed packet</span>
            </span>
            <span className="nav-count">{docs.length}</span>
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div
            className="engine-switch"
            role="group"
            aria-label="Routing engine"
          >
            <span>Routing engine</span>
            <div>
              <button
                className={mode === "demo" ? "selected" : ""}
                onClick={() => setMode("demo")}
              >
                Local rules
              </button>
              <button
                className={mode === "live" ? "selected" : ""}
                onClick={() => setMode("live")}
                disabled={!config.data?.liveAvailable}
                title={
                  config.data?.liveAvailable
                    ? `Jev model ${config.data.model}`
                    : "No Jev key configured on this server"
                }
              >
                Jev live
              </button>
            </div>
            <small>
              {mode === "live"
                ? `Documents go to ${config.data?.model || "Jev"} via the server.`
                : config.data?.liveAvailable
                  ? "Transparent keyword rules. Switch to try Jev."
                  : "Transparent keyword rules. Jev needs a server key."}
            </small>
          </div>
          <a href="/" className="portfolio-link">
            <ArrowLeft size={15} />
            All projects
          </a>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <div>
            Workspace <ChevronRight size={14} />
            <strong>{pageCopy[page].breadcrumb}</strong>
          </div>
          <span className="project-tag">
            SYNTHETIC DEMO · NOT AFFILIATED WITH RIVET
          </span>
        </header>
        <div className="content">
          <div className="heading-row">
            <div>
              <p className="eyebrow">{pageCopy[page].eyebrow}</p>
              <h1>{pageCopy[page].title}</h1>
              <p className="subtitle">{pageCopy[page].subtitle}</p>
            </div>
            {page === "documents" && (
              <button
                className="button primary"
                onClick={() => input.current?.click()}
              >
                <Plus size={17} />
                Add documents
              </button>
            )}
          </div>
          <input
            ref={input}
            type="file"
            className="sr-only"
            accept=".pdf,.txt,.csv"
            multiple
            aria-label="Upload tax documents"
            onChange={(e) => {
              upload(e.target.files);
              e.target.value = "";
            }}
          />
          {notice && (
            <div className="notice" role="status">
              {notice}
              <button
                aria-label="Dismiss notification"
                onClick={() => setNotice("")}
              >
                <X size={15} />
              </button>
            </div>
          )}
          {config.data?.liveRequiresToken && <LiveAccess />}
          {page === "case" ? (
            <ClientWorkspace
              provider={config.data?.provider || null}
              mode={mode}
            />
          ) : page === "documents" ? (
            <>
              <section className="stats" aria-label="Packet summary">
                <div>
                  <span>In this packet</span>
                  <strong>
                    {String(docs.length).padStart(2, "0")}
                    <Files size={22} />
                  </strong>
                  <small>Documents, all together</small>
                </div>
                <div>
                  <span>Needs your eye</span>
                  <strong>
                    {String(needs).padStart(2, "0")}
                    <span className="stat-dot amber" />
                  </strong>
                  <small>Uncertain or waiting for a decision</small>
                </div>
                <div>
                  <span>Ready for review</span>
                  <strong>
                    {String(ready).padStart(2, "0")}
                    <span className="stat-dot green" />
                  </strong>
                  <small>Passed your routing threshold</small>
                </div>
                <div>
                  <span>Reviewed by you</span>
                  <strong>
                    {String(reviewed).padStart(2, "0")}
                    <CheckCheck size={22} />
                  </strong>
                  <small>A human made the final call</small>
                </div>
              </section>
              <section className="control-panel">
                <div className="engine-control">
                  <Sparkles size={20} />
                  <div>
                    <strong>Decision engine</strong>
                    <div className="mode-buttons">
                      <button
                        aria-pressed={mode === "demo"}
                        className={mode === "demo" ? "selected" : ""}
                        onClick={() => setMode("demo")}
                      >
                        Demo rules
                      </button>
                      <button
                        aria-pressed={mode === "live"}
                        disabled={!config.data?.liveAvailable}
                        className={mode === "live" ? "selected" : ""}
                        onClick={() => setMode("live")}
                      >
                        Jev live {!config.data?.liveAvailable && "· key needed"}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="threshold">
                  <div>
                    <label htmlFor="threshold">Routing threshold</label>
                    <strong>{threshold}%</strong>
                  </div>
                  <input
                    id="threshold"
                    type="range"
                    min="50"
                    max="99"
                    value={threshold}
                    onChange={(e) => setThreshold(Number(e.target.value))}
                    onPointerUp={() =>
                      log(
                        "Workspace",
                        `Routing threshold set to ${threshold}%.`,
                      )
                    }
                  />
                  <span>Below this score? A human takes a look.</span>
                </div>
                <p className="engine-note">
                  {mode === "demo"
                    ? "Deterministic local rules. Scores are illustrative, not calibrated probabilities."
                    : `Live classification sends source text to ${config.data?.provider || "the Jev provider"} when you upload or reclassify. Use synthetic documents for this demo.`}
                  {config.isError && (
                    <button
                      className="text-button"
                      onClick={() => void config.refetch()}
                    >
                      Connection settings unavailable · Retry
                    </button>
                  )}
                </p>
              </section>
              <section
                className={`review-workspace ${mobileDetail ? "show-detail" : ""}`}
              >
                <div className="document-list">
                  <div className="list-title">
                    <div>
                      <h2>Document inbox</h2>
                      <span>
                        {visible.length} of {docs.length} documents
                      </span>
                    </div>
                    <button
                      className="icon-button"
                      aria-label="Add documents"
                      onClick={() => input.current?.click()}
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                  <div className="search">
                    <Search size={16} />
                    <input
                      aria-label="Search documents"
                      placeholder="Search name or category…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <div className="filter-row">
                    <SlidersHorizontal size={15} />
                    <select
                      aria-label="Filter documents"
                      value={filter}
                      onChange={(e) => setFilter(e.target.value as Filter)}
                    >
                      {(
                        [
                          "All documents",
                          "Needs review",
                          "Ready",
                          "Reviewed",
                          "Duplicates",
                        ] as Filter[]
                      ).map((f) => (
                        <option key={f}>{f}</option>
                      ))}
                    </select>
                    <span>{visible.length}</span>
                  </div>
                  <div className="document-items">
                    {visible.map((d) => (
                      <button
                        key={d.id}
                        className={`document-item ${selected === d.id ? "selected" : ""}`}
                        onClick={() => select(d)}
                      >
                        <span
                          className={`file-icon ${d.reviewed ? "reviewed" : ""}`}
                        >
                          {d.processing ? (
                            <LoaderCircle size={19} className="spin" />
                          ) : d.reviewed ? (
                            <Check size={19} />
                          ) : (
                            <FileText size={19} />
                          )}
                        </span>
                        <span className="document-meta">
                          <strong>{d.name}</strong>
                          <span>
                            {d.override ||
                              d.decision?.category ||
                              "Awaiting triage"}{" "}
                            <i /> {sizeLabel(d.size)}
                          </span>
                          <span
                            className={`status-label status-${state(d).toLowerCase().replaceAll(" ", "-")}`}
                          >
                            {state(d)}
                          </span>
                        </span>
                        <ChevronRight size={15} />
                      </button>
                    ))}
                    {!visible.length && (
                      <div className="empty">
                        <FolderOpen size={28} />
                        <strong>No documents here yet</strong>
                        <p>Try a different filter or add a document.</p>
                        <button
                          className="text-button"
                          onClick={() => {
                            setSearch("");
                            setFilter("All documents");
                          }}
                        >
                          Clear filters
                        </button>
                      </div>
                    )}
                  </div>
                  <button
                    className={`drop-zone ${dragging ? "dragging" : ""}`}
                    onClick={() => input.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragging(false);
                      upload(e.dataTransfer.files);
                    }}
                  >
                    <Upload size={19} />
                    <strong>Drop documents here</strong>
                    <span>PDF, TXT, CSV · up to 10 MB each</span>
                  </button>
                </div>
                {active ? (
                  <div className="review-detail">
                    <div className="detail-header">
                      <button
                        className="mobile-back icon-button"
                        onClick={() => setMobileDetail(false)}
                        aria-label="Back to document list"
                      >
                        <ArrowLeft size={18} />
                      </button>
                      <div>
                        <div className="detail-eyebrow">
                          DOCUMENT REVIEW{" "}
                          <span>
                            {active.synthetic
                              ? "SYNTHETIC SAMPLE"
                              : "LOCAL UPLOAD"}
                          </span>
                        </div>
                        <h2>{active.name}</h2>
                      </div>
                      <button
                        className="icon-button"
                        disabled={active.processing || !!active.duplicateOf}
                        aria-label="Reclassify selected document"
                        title="Reclassify with selected engine"
                        onClick={() =>
                          active.text
                            ? void triage(active)
                            : active.file && void ingest(active.file, active)
                        }
                      >
                        <RotateCcw size={17} />
                      </button>
                    </div>
                    {active.processing && (
                      <div className="processing-banner" role="status">
                        <LoaderCircle size={16} className="spin" />
                        Reading and classifying your document…
                        <button onClick={() => cancel(active)}>Cancel</button>
                      </div>
                    )}
                    {active.error && (
                      <div className="error-banner" role="alert">
                        <AlertCircle size={18} />
                        <div>
                          <strong>This document needs attention</strong>
                          <p>{active.error}</p>
                          <button
                            className="text-button"
                            onClick={() =>
                              active.text
                                ? void triage(active)
                                : active.file &&
                                  void ingest(active.file, active)
                            }
                          >
                            Retry processing <ArrowRight size={13} />
                          </button>
                        </div>
                      </div>
                    )}
                    {active.duplicateOf ? (
                      <div className="duplicate-card">
                        <Files size={32} />
                        <h3>Already in your packet.</h3>
                        <p>
                          This file matches an existing upload byte for byte. We
                          keep it out of the routing queue.
                        </p>
                        <button
                          className="button"
                          onClick={() => {
                            const original = docs.find(
                              (d) => d.id === active.duplicateOf,
                            );
                            if (original) select(original);
                          }}
                        >
                          Open original <ArrowRight size={16} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="review-columns">
                          <div className="source-panel">
                            <div className="source-tabs">
                              <button
                                className={preview === "source" ? "active" : ""}
                                onClick={() => setPreview("source")}
                              >
                                Source text
                              </button>
                              {active.url && (
                                <button
                                  className={preview === "pdf" ? "active" : ""}
                                  onClick={() => setPreview("pdf")}
                                >
                                  Original PDF
                                </button>
                              )}
                              <span>{active.url ? "PDF" : "TEXT"}</span>
                            </div>
                            {preview === "pdf" && active.url ? (
                              <PdfPreview
                                key={active.id}
                                url={active.url}
                                name={active.name}
                              />
                            ) : (
                              <div className="source-paper">
                                <div className="paper-brand">
                                  <span>F / SOURCE</span>
                                  <FileText size={18} />
                                </div>
                                <pre>
                                  {active.text ||
                                    "Readable source text will appear here after extraction."}
                                </pre>
                                <div className="paper-footer">
                                  {active.synthetic
                                    ? "FICTIONAL DATA · FOR DEMONSTRATION ONLY"
                                    : "EXTRACTED IN YOUR BROWSER · VERIFY AGAINST ORIGINAL"}
                                </div>
                              </div>
                            )}
                            <div className="source-caption">
                              <ShieldCheck size={13} />
                              Source content stays in memory. No automatic
                              storage.
                              {active.url && (
                                <a
                                  href={active.url}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Open PDF <ExternalLink size={12} />
                                </a>
                              )}
                            </div>
                          </div>
                          <aside className="decision-panel">
                            <p className="eyebrow">THE SUGGESTION</p>
                            <h3>
                              {active.override ||
                                active.decision?.category ||
                                "Awaiting triage"}
                            </h3>
                            <p className="decision-description">
                              {active.reviewed
                                ? "Your document category is confirmed and recorded in the activity log."
                                : active.override
                                  ? "Your category correction is ready for a final review."
                                  : active.decision?.category === "Other"
                                    ? "The document does not have a recognized route. A reviewer should decide what comes next."
                                    : "A suggested document type, with the original source close at hand."}
                            </p>
                            {active.decision && (
                              <>
                                <div className="score-label">
                                  <span>
                                    {active.override
                                      ? "Original suggestion: " +
                                        active.decision.category
                                      : "Classifier score"}
                                  </span>
                                  <strong>
                                    {Math.round(
                                      active.decision.confidence * 100,
                                    )}
                                    %
                                  </strong>
                                </div>
                                <div className="score-track">
                                  <div
                                    style={{
                                      width: `${active.decision.confidence * 100}%`,
                                    }}
                                  />
                                </div>
                                <p className="score-note">
                                  {active.decision.source === "local-rules"
                                    ? "Illustrative demo score · local rules"
                                    : "Jev model score · not a guarantee of accuracy"}
                                </p>
                                <div
                                  className={`review-callout ${state(active) === "Ready" || active.reviewed ? "pass" : ""}`}
                                >
                                  <span>
                                    {active.reviewed ? (
                                      <CheckCheck size={17} />
                                    ) : state(active) === "Ready" ? (
                                      <Check size={17} />
                                    ) : (
                                      <Clock3 size={17} />
                                    )}
                                  </span>
                                  <div>
                                    <strong>
                                      {active.reviewed
                                        ? "Reviewed by you"
                                        : state(active) === "Ready"
                                          ? "Passed routing threshold"
                                          : "Human review needed"}
                                    </strong>
                                    <p>
                                      {active.reviewed
                                        ? "Your decision is recorded in the activity log."
                                        : active.decision.category === "Other"
                                          ? "Unknown types always stay in the review queue."
                                          : active.decision.attention >= 0.5
                                            ? "Potential missing, conflicting, or incomplete information was flagged. Review the source."
                                            : active.override
                                              ? "Confirm your corrected category below."
                                              : `${Math.round(active.decision.confidence * 100)}% score · ${threshold}% threshold`}
                                    </p>
                                  </div>
                                </div>
                              </>
                            )}
                            <div className="category-control">
                              <label htmlFor="category">
                                Document category
                              </label>
                              <select
                                id="category"
                                disabled={active.processing || !active.decision}
                                value={
                                  active.override ||
                                  active.decision?.category ||
                                  "Other"
                                }
                                onChange={(e) => {
                                  patch(active.id, {
                                    override: e.target.value,
                                    reviewed: false,
                                  });
                                  log(
                                    active.name,
                                    `Reviewer changed category to ${e.target.value}.`,
                                  );
                                }}
                              >
                                {TAX_CATEGORIES.map((c) => (
                                  <option key={c}>{c}</option>
                                ))}
                              </select>
                              <small>
                                Correct the suggestion before marking reviewed.
                              </small>
                            </div>
                            <button
                              className="button primary review-button"
                              disabled={
                                active.processing ||
                                !active.decision ||
                                !!active.error ||
                                active.reviewed
                              }
                              onClick={() => {
                                patch(active.id, { reviewed: true });
                                log(
                                  active.name,
                                  `Reviewer confirmed ${active.override || active.decision?.category}.`,
                                );
                                setNotice(`${active.name} marked reviewed.`);
                              }}
                            >
                              <Check size={17} />
                              {active.reviewed ? "Reviewed" : "Mark reviewed"}
                            </button>
                            <div className="model-info">
                              <Sparkles size={13} />
                              <span>
                                {active.decision
                                  ? `${active.decision.source === "jev" ? "Jev" : "Demo rules"} · ${active.decision.latencyMs} ms`
                                  : "No decision yet"}
                              </span>
                            </div>
                            <p className="review-disclaimer">
                              Review confirms the document category only. It
                              does not establish tax correctness or filing
                              readiness.
                            </p>
                          </aside>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="empty">
                    <FileText size={32} />
                    <h2>Select a document</h2>
                    <p>Its source and classification will appear here.</p>
                  </div>
                )}
              </section>
              <footer className="workspace-footer">
                <span>
                  <ShieldCheck size={15} />A clear source. A visible decision. A
                  human in control.
                </span>
                <button className="button" onClick={exportManifest}>
                  <ArrowDownToLine size={16} />
                  Export review manifest
                </button>
              </footer>
            </>
          ) : page === "activity" ? (
            <section className="activity-page">
              <div className="section-heading">
                <h2>
                  Workspace activity <span>{events.length} events</span>
                </h2>
                <button className="button" onClick={exportManifest}>
                  <ArrowDownToLine size={16} />
                  Export manifest
                </button>
              </div>
              <div className="activity-list">
                {events.map((e) => (
                  <div className="activity-event" key={e.id}>
                    <span className="event-dot" />
                    <div>
                      <strong>{e.document}</strong>
                      <p>{e.message}</p>
                    </div>
                    <time dateTime={e.at}>
                      {new Date(e.at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </time>
                  </div>
                ))}
              </div>
            </section>
          ) : (
            <section className="about-page start-here">
              <div className="start-try">
                <div>
                  <span className="eyebrow">TRY IT IN ONE MINUTE</span>
                  <p>
                    Open <strong>Clients & requests</strong>. Alex sent a 2024
                    K-1 for a 2025 return. Request the right year, answer as
                    Alex with the synthetic sample, then review Jev’s routing
                    and close it.
                  </p>
                </div>
                <button
                  className="button primary"
                  onClick={() => setPage("case")}
                >
                  Open Clients & requests <ArrowRight size={16} />
                </button>
              </div>
              <section className="start-flow">
                <div className="start-flow-head">
                  <h2>One document request, end to end</h2>
                  <p>
                    Two people, one question. The guide on the Clients page
                    highlights where you are in this loop.
                  </p>
                </div>
                <ol className="journey" style={{ ["--steps" as string]: 5 }}>
                  {[
                    [
                      "Preparer",
                      "Pick a client",
                      "Tick the documents you expect this year. Missing ones show up immediately.",
                    ],
                    [
                      "Preparer",
                      "Request a document",
                      "Write a specific ask, e.g. “your 2025 K-1”, and issue it.",
                    ],
                    [
                      "Client",
                      "Upload",
                      "The client attaches a PDF or TXT in their portal. Text is read in the browser with PDF.js.",
                    ],
                    [
                      "Jev + code",
                      "Route & check",
                      "Jev (or local rules) names the form; code compares the tax year. Neither decides alone.",
                    ],
                    [
                      "Preparer",
                      "Verify & close",
                      "Record how you checked it. Only then does the checklist count it as verified.",
                    ],
                  ].map(([who, title, body], i) => (
                    <li key={title} style={{ display: "contents" }}>
                      <button
                        className="journey-step"
                        onClick={() => setPage("case")}
                      >
                        <em>{who}</em>
                        <strong>
                          <b>{i + 1}</b> {title}
                        </strong>
                        <small>{body}</small>
                      </button>
                    </li>
                  ))}
                </ol>
              </section>
              <div className="about-grid">
                <article>
                  <span>WHERE JEV FITS</span>
                  <h3>A bounded question, not a free-form answer</h3>
                  <p>
                    The server asks Jev two structured questions: which of W-2,
                    1099, K-1, Receipt or Other this is, and whether it needs a
                    person’s attention. The answer is validated before anything
                    changes; the tax-year check is plain code.
                  </p>
                </article>
                <article>
                  <span>HUMAN REVIEW</span>
                  <h3>The preparer makes the call</h3>
                  <p>
                    A routing suggestion never closes a request. The preparer
                    writes how they verified it, and that note lives in the
                    request’s trail.
                  </p>
                </article>
                <article>
                  <span>SANDBOX</span>
                  <h3>Batch triage</h3>
                  <p>
                    Have a pile of PDFs instead? Batch triage sorts a mixed
                    packet, flags duplicates and uncertain items, and exports a
                    manifest without document text.
                  </p>
                </article>
                <article>
                  <span>BOUNDARIES</span>
                  <h3>Synthetic by design</h3>
                  <p>
                    Everything saves in this browser. Live Jev sends document
                    text to {config.data?.provider || "the Jev provider"}. Not
                    affiliated with Rivet; it does not prepare or file taxes.
                  </p>
                </article>
              </div>
            </section>
          )}
          <div className="site-footer">
            <span>FOLIO · A PORTFOLIO PROJECT BY HEMANT SARTHAK</span>
            <span>Synthetic data · not affiliated with Rivet</span>
          </div>
        </div>
      </main>
    </div>
  );
}
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>,
);
