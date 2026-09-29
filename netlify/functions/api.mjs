import { timingSafeEqual } from "node:crypto";
import { decide } from "../../server/decisions.mjs";

export const config = {
  path: ["/api/config", "/api/classify"],
  rateLimit: {
    action: "rate_limit",
    windowLimit: 60,
    windowSize: 60,
    aggregateBy: "ip",
  },
};

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export function createHostedHandler(env = process.env, decideImpl = decide) {
  return async (request) => {
    const url = new URL(request.url);
    const origin = request.headers.get("origin");
    if (origin && origin !== url.origin)
      return json({ error: "Cross-origin requests are not allowed." }, 403);

    const openCodeKey = env.OPENCODE_API_KEY;
    const apiKey = openCodeKey || env.TYPESAFE_API_KEY;
    const accessCode = env.LIVE_DEMO_ACCESS_CODE;
    const liveAvailable = Boolean(apiKey && accessCode);
    const options = {
      apiKey,
      provider: openCodeKey ? "OpenCode Zen" : "TypeSafe",
      model: openCodeKey
        ? env.OPENCODE_MODEL || "jev-1.13-free"
        : env.TYPESAFE_MODEL || "jev-latest",
      endpoint: openCodeKey
        ? "https://opencode.ai/zen/v1/systemone"
        : "https://api.typesafe.ai/v1/systemone",
    };

    if (url.pathname === "/api/config" && request.method === "GET")
      return json({
        liveAvailable,
        liveRequiresToken: liveAvailable,
        model: options.model,
        provider: liveAvailable ? options.provider : null,
        deployment: "netlify",
      });
    if (url.pathname !== "/api/classify")
      return json({ error: "Unknown API route." }, 404);
    if (request.method !== "POST")
      return json({ error: "Use POST to classify." }, 405);
    if (!request.headers.get("content-type")?.startsWith("application/json"))
      return json({ error: "Send JSON to this endpoint." }, 415);

    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > 300_000)
      return json({ error: "This request is too large." }, 413);
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      return json({ error: "The request is not valid JSON." }, 400);
    }
    if (body?.mode === "live") {
      if (!liveAvailable)
        return json(
          {
            error:
              "Live Jev is not enabled on this public demo. Choose Local rules.",
          },
          503,
        );
      const supplied = Buffer.from(request.headers.get("x-demo-access") || "");
      const expected = Buffer.from(accessCode);
      if (
        supplied.length !== expected.length ||
        !timingSafeEqual(supplied, expected)
      )
        return json(
          { error: "Enter the reviewer access code to use live Jev." },
          401,
        );
    }
    try {
      return json(await decideImpl(body, options));
    } catch (error) {
      return json(
        {
          error: error.status
            ? error.message
            : "The decision service could not complete this request.",
        },
        error.status || 500,
      );
    }
  };
}

export default createHostedHandler();
