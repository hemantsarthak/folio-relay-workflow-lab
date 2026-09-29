export type Mode = "demo" | "live";
export type Kind = "tax" | "it";
export type Decision = {
  category: string;
  confidence: number;
  probabilities: Record<string, number>;
  attention: number;
  source: "local-rules" | "jev";
  model: string;
  latencyMs: number;
};
export type Config = {
  liveAvailable: boolean;
  model: string;
  provider: string | null;
  liveRequiresToken?: boolean;
  deployment?: string;
};
export async function getConfig(): Promise<Config> {
  const r = await fetch("/api/config");
  if (!r.ok) throw new Error("Could not load connection settings.");
  return r.json();
}
export async function classify(
  kind: Kind,
  text: string,
  mode: Mode,
  signal?: AbortSignal,
): Promise<Decision> {
  const r = await fetch("/api/classify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(mode === "live" && sessionStorage.getItem("portfolio-live-access")
        ? { "X-Demo-Access": sessionStorage.getItem("portfolio-live-access")! }
        : {}),
    },
    body: JSON.stringify({ kind, text, mode }),
    signal,
  });
  const data = await r.json();
  if (!r.ok)
    throw new Error(
      data.error || "The decision service could not complete this request.",
    );
  return data;
}
export function downloadJson(name: string, data: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const TAX_CATEGORIES = [
  "W-2",
  "1099",
  "K-1",
  "Receipt",
  "Other",
] as const;
export const IT_CATEGORIES = [
  "Remote desktop",
  "Identity & access",
  "Network",
  "Device",
  "Software",
  "Other",
] as const;
