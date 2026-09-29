// Reproducible one-page, text-layer PDF fixture. Not an IRS form or filing document.
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const target = fileURLToPath(new URL("../public/samples/", import.meta.url));
mkdirSync(target, { recursive: true });
const content =
  "BT /F1 18 Tf 50 740 Td (SYNTHETIC PORTFOLIO SAMPLE) Tj 0 -45 Td /F1 14 Tf (Form W-2 - Wage and Tax Statement) Tj 0 -35 Td /F1 11 Tf (Tax year: 2025) Tj 0 -25 Td (Employee: Avery Stone - fictional) Tj 0 -25 Td (Employer: Northstar Example Studio - fictional) Tj 0 -25 Td (Wages: 72000.00 - invented demonstration value) Tj 0 -40 Td (For document-classification testing only. Not valid for filing.) Tj ET";
const objects = [
  "<< /Type /Catalog /Pages 2 0 R >>",
  "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
  "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
  "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
];
let pdf = "%PDF-1.4\n";
const offsets = [0];
for (const [index, obj] of objects.entries()) {
  offsets.push(Buffer.byteLength(pdf));
  pdf += `${index + 1} 0 obj\n${obj}\nendobj\n`;
}
const xref = Buffer.byteLength(pdf);
pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
for (const offset of offsets.slice(1))
  pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
writeFileSync(`${target}/sample-w2.pdf`, pdf);
writeFileSync(
  `${target}/sample-1099.txt`,
  "SYNTHETIC PORTFOLIO SAMPLE\nForm 1099-NEC\nTax year 2025\nPayer: Northstar Example Studio (fictional)\nRecipient: Avery Stone (fictional)\nNonemployee compensation: 4500.00 (invented)\nNot valid for filing.\n",
);
writeFileSync(
  `${target}/sample-diagnostics.json`,
  JSON.stringify(
    {
      schemaVersion: 1,
      collectedAt: "2026-09-22T09:00:00Z",
      platform: "Windows",
      checks: [
        {
          name: "Available memory",
          status: "warn",
          value: "6% free",
          detail:
            "Synthetic example. A snapshot only; does not establish a root cause.",
        },
        {
          name: "System disk space",
          status: "pass",
          value: "34% free",
          detail: "Synthetic example.",
        },
        {
          name: "DNS resolution",
          status: "pass",
          value: "Resolved",
          detail: "Synthetic example. No network request was made.",
        },
        {
          name: "Configured endpoint",
          status: "unknown",
          value: "Not requested",
          detail: "Synthetic example. Endpoint health was not tested.",
        },
      ],
      summary:
        "Synthetic sample report. One check needs review; no remediation performed.",
    },
    null,
    2,
  ),
);
console.log("Generated three synthetic sample files in public/samples.");
