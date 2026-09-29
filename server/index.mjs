import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import { createApi } from "./app.mjs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const openCodeKey = process.env.OPENCODE_API_KEY;
const apiKey = openCodeKey || process.env.TYPESAFE_API_KEY;
const app = createApi({
  apiKey,
  provider: openCodeKey ? "OpenCode Zen" : "TypeSafe",
  model: openCodeKey
    ? process.env.OPENCODE_MODEL || "jev-1.13-free"
    : process.env.TYPESAFE_MODEL || "jev-latest",
  endpoint: openCodeKey
    ? "https://opencode.ai/zen/v1/systemone"
    : "https://api.typesafe.ai/v1/systemone",
});
if (process.argv.includes("--production"))
  app.use(express.static(`${root}/dist`, { index: "index.html" }));
else {
  const vite = await createViteServer({
    root,
    server: { middlewareMode: true },
    appType: "mpa",
  });
  app.use(vite.middlewares);
}
app.use((_req, res) =>
  res.status(404).send("Page not found. Open / for the project gallery."),
);
const port = Number(process.env.PORT || 4317);
const server = app.listen(port, "127.0.0.1", () =>
  console.log(
    `Portfolio running at http://127.0.0.1:${port}\nFolio: /apps/tax/\nRelay: /apps/it/\nJev: ${apiKey ? `configured (${openCodeKey ? "OpenCode Zen" : "TypeSafe"})` : "not configured; local demo available"}`,
  ),
);
server.on("error", (error) => {
  console.error(`Cannot start local server: ${error.code}`);
  process.exitCode = 1;
});
