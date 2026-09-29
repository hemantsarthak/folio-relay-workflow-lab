import { test } from "node:test";
import assert from "node:assert/strict";
import { createApi } from "../server/app.mjs";

test("HTTP flow: config, classification, validation, credential failure and origin restriction", async () => {
  const server = createApi().listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const config = await (await fetch(`${base}/api/config`)).json();
    assert.equal(config.liveAvailable, false);
    assert.equal(config.apiKey, undefined);
    const post = (body, headers = {}) =>
      fetch(`${base}/api/classify`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: typeof body === "string" ? body : JSON.stringify(body),
      });
    const response = await post({
      kind: "tax",
      text: "Form 1099-NEC",
      mode: "demo",
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).category, "1099");
    assert.equal((await post("{oops")).status, 400);
    assert.equal(
      (await post({ kind: "tax", text: "W-2", mode: "live" })).status,
      503,
    );
    assert.equal(
      (
        await post(
          { kind: "tax", text: "W-2", mode: "demo" },
          { Origin: "https://untrusted.example" },
        )
      ).status,
      403,
    );
    assert.equal(
      (await post({ kind: "tax", text: "x".repeat(60001), mode: "demo" }))
        .status,
      400,
    );
    assert.equal((await fetch(`${base}/api/missing`)).status, 404);
    const collector = await fetch(`${base}/api/collector`);
    assert.equal(collector.status, 200);
    assert.match(collector.headers.get("content-disposition"), /attachment/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
