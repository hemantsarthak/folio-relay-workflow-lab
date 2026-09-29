import { test } from "node:test";
import assert from "node:assert/strict";
import { createHostedHandler } from "../netlify/functions/api.mjs";

const request = (path, body, headers = {}) =>
  new Request(`https://demo.netlify.app${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json", ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

test("hosted demo works over HTTPS without secrets and blocks cross-origin traffic", async () => {
  const handler = createHostedHandler({});
  const config = await (await handler(request("/api/config"))).json();
  assert.equal(config.liveAvailable, false);
  const response = await handler(
    request("/api/classify", {
      kind: "tax",
      mode: "demo",
      text: "Form W-2 Tax year: 2025",
    }),
  );
  assert.equal(response.status, 200);
  assert.equal((await response.json()).category, "W-2");
  assert.equal(
    (
      await handler(
        request(
          "/api/classify",
          { kind: "tax", mode: "demo", text: "Form W-2" },
          { Origin: "https://other.example" },
        ),
      )
    ).status,
    403,
  );
});

test("hosted live calls require a server key and valid reviewer code", async () => {
  let calls = 0;
  const handler = createHostedHandler(
    {
      OPENCODE_API_KEY: "synthetic-key",
      LIVE_DEMO_ACCESS_CODE: "synthetic-code",
    },
    async (_body, options) => {
      calls++;
      assert.equal(options.apiKey, "synthetic-key");
      return { source: "jev", category: "W-2" };
    },
  );
  const body = { kind: "tax", mode: "live", text: "Synthetic W-2" };
  assert.equal((await handler(request("/api/classify", body))).status, 401);
  assert.equal(calls, 0);
  assert.equal(
    (
      await handler(
        request("/api/classify", body, { "X-Demo-Access": "synthetic-code" }),
      )
    ).status,
    200,
  );
  assert.equal(calls, 1);
  assert.equal(
    (await (await handler(request("/api/config"))).text()).includes(
      "synthetic-key",
    ),
    false,
  );
  assert.equal(
    (
      await createHostedHandler({ OPENCODE_API_KEY: "synthetic-key" })(
        request("/api/classify", body),
      )
    ).status,
    503,
  );
});
