import express from "express";
import { fileURLToPath } from "node:url";
import { decide } from "./decisions.mjs";

export function createApi(options = {}) {
  const app = express();
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    res.set("X-Content-Type-Options", "nosniff");
    res.set("Referrer-Policy", "no-referrer");
    // This is a local portfolio server. Restrict Host to prevent DNS rebinding.
    if (!["localhost", "127.0.0.1", "[::1]"].includes(req.hostname))
      return res
        .status(403)
        .json({ error: "This demo accepts local connections only." });
    const origin = req.get("origin");
    if (origin && origin !== `http://${req.get("host")}`)
      return res
        .status(403)
        .json({ error: "Cross-origin requests are not allowed." });
    next();
  });
  app.use(express.json({ limit: "300kb" }));
  app.get("/api/config", (_req, res) =>
    res.json({
      liveAvailable: Boolean(options.apiKey),
      model: options.model || "jev-latest",
      provider: options.apiKey ? options.provider || "TypeSafe" : null,
    }),
  );
  app.get("/api/collector", (_req, res) =>
    res.download(
      fileURLToPath(
        new URL("../scripts/Collect-RelayDiagnostics.ps1", import.meta.url),
      ),
      "Collect-RelayDiagnostics.ps1",
    ),
  );
  const calls = new Map();
  app.post("/api/classify", async (req, res, next) => {
    if (!req.is("application/json"))
      return res.status(415).json({ error: "Send JSON to this endpoint." });
    if (req.body?.mode === "live") {
      const now = Date.now();
      const key = req.ip;
      const recent = (calls.get(key) || []).filter(
        (time) => now - time < 60000,
      );
      if (recent.length >= 30)
        return res.status(429).json({
          error: "Local live-call limit reached. Wait one minute and retry.",
        });
      calls.set(key, [...recent, now]);
    }
    try {
      res.json(await decide(req.body, options));
    } catch (error) {
      next(error);
    }
  });
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "Unknown API route." }),
  );
  app.use((error, _req, res, _next) => {
    if (error.type === "entity.too.large")
      return res.status(413).json({
        error: "This request is too large. Use at most 60,000 characters.",
      });
    if (error.type === "entity.parse.failed")
      return res.status(400).json({ error: "The request is not valid JSON." });
    res.status(error.status || 500).json({
      error: error.status
        ? error.message
        : "The local service could not complete this request.",
    });
  });
  return app;
}
