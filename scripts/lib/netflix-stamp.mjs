import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const NETFLIX_STAMP_PATH = path.join(
  ROOT,
  "data",
  "current-events",
  "netflix-stamp.json"
);

export async function writeNetflixStamp(generatedAt) {
  const iso = String(generatedAt || "").trim();
  if (!iso) return;
  await writeFile(
    NETFLIX_STAMP_PATH,
    `${JSON.stringify({ generatedAt: iso }, null, 2)}\n`
  );
}
