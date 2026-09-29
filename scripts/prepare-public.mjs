import { mkdir, copyFile } from "node:fs/promises";

const destination = new URL("../public/downloads/", import.meta.url);
await mkdir(destination, { recursive: true });
await copyFile(
  new URL("./Collect-RelayDiagnostics.ps1", import.meta.url),
  new URL("Collect-RelayDiagnostics.ps1", destination),
);
