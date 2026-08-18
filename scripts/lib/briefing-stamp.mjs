import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const BRIEFING_STAMP_PATH = path.join(
  ROOT,
  "data",
  "current-events",
  "briefing-stamp.json"
);

export async function writeBriefingStamp(generatedAt) {
  const iso = String(generatedAt || "").trim();
  if (!iso) return;
  await writeFile(
    BRIEFING_STAMP_PATH,
    `${JSON.stringify({ generatedAt: iso }, null, 2)}\n`
  );
}
