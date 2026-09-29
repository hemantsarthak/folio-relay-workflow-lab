import "dotenv/config";
import { decide } from "../server/decisions.mjs";

const mode = process.argv.includes("--live") ? "live" : "demo";
if (mode === "live" && !process.env.TYPESAFE_API_KEY) {
  console.error("Set TYPESAFE_API_KEY in .env before a live evaluation.");
  process.exit(1);
}
const cases = [
  ["tax", "Wage and Tax Statement, Form W-2, synthetic example.", "W-2"],
  ["tax", "Form 1099-NEC Nonemployee compensation.", "1099"],
  ["tax", "Schedule K-1 Partner share of income.", "K-1"],
  ["tax", "Office supplies receipt. Paid by card.", "Receipt"],
  ["tax", "Dear team, here are some notes about the attachment.", "Other"],
  ["tax", "Combined packet: Form W-2 and 1099-INT.", "Other"],
  ["it", "My remote desktop freezes after reconnecting.", "Remote desktop"],
  ["it", "MFA authenticator codes fail at login.", "Identity & access"],
  ["it", "VPN and DNS resolution stopped working.", "Network"],
  ["it", "My laptop battery is swollen.", "Device"],
  ["it", "The software license needs renewal.", "Software"],
  ["it", "Something is wrong. Can someone help?", "Other"],
];
const results = [];
for (const [kind, text, expected] of cases) {
  const answer = await decide(
    { kind, text, mode },
    {
      apiKey: process.env.TYPESAFE_API_KEY,
      model: process.env.TYPESAFE_MODEL || "jev-latest",
    },
  );
  results.push({
    kind,
    expected,
    actual: answer.category,
    correct: answer.category === expected,
    review:
      answer.category === "Other" ||
      answer.confidence < 0.85 ||
      answer.attention >= 0.5,
    latencyMs: answer.latencyMs,
  });
}
console.table(results);
console.log(
  `${results.filter((r) => r.correct).length}/${results.length} correct on these synthetic smoke cases. Mode: ${mode}.`,
);
console.log(
  "This tiny authored set is a smoke check, not an independent accuracy benchmark. Local-rule scores are illustrative; latency is this machine/run only.",
);
