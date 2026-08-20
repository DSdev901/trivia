#!/usr/bin/env node
/**
 * Rewrite Netflix synopses into one-line blurbs with Copilot Haiku.
 * A failed run leaves netflix.json as it was (including any earlier briefs).
 */

import { spawnSync } from "node:child_process";
import { copyFile, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FILE = path.join(ROOT, "data", "current-events", "netflix.json");
const PROMPT = path.join(ROOT, "scripts", "netflix-brevity-prompt.mjs");
const APPLY = path.join(ROOT, "scripts", "apply-netflix-briefs.mjs");
const VALIDATE = path.join(ROOT, "scripts", "validate-netflix-briefs.mjs");
const FALLBACK = process.env.NETFLIX_FALLBACK || "/tmp/netflix.fallback.json";
const INPUT = process.env.NETFLIX_INPUT || "/tmp/netflix.input.json";
const CHUNK = Math.max(20, Number(process.env.NETFLIX_CHUNK_SIZE || 80));
const MODEL = process.env.COPILOT_MODEL || "claude-haiku-4.5";

function runNode(script, args, extraEnv, stdio) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: ROOT,
    env: { ...process.env, ...extraEnv },
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    stdio: stdio || "pipe",
  });
}

function runCopilot(promptText) {
  return spawnSync(
    "copilot",
    [
      `--model=${MODEL}`,
      "-s",
      "--no-ask-user",
      "--available-tools=view",
      "--excluded-tools=create,edit,apply_patch,bash,powershell",
      "--deny-tool=write",
      "--deny-tool=shell",
    ],
    {
      cwd: ROOT,
      input: promptText,
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
      stdio: ["pipe", "pipe", "inherit"],
    }
  );
}

const original = JSON.parse(await readFile(FILE, "utf8"));
const withCopy = (original.items || []).filter((item) =>
  String(item.synopsis || "").replace(/\s+/g, " ").trim()
);
if (withCopy.length < 3) {
  throw new Error(`netflix input had too few synopses (${withCopy.length})`);
}

await copyFile(FILE, FALLBACK);
await copyFile(FILE, INPUT);

let chunksOk = 0;
for (let offset = 0; offset < withCopy.length; offset += CHUNK) {
  const limit = Math.min(CHUNK, withCopy.length - offset);
  console.log(
    `  [netflix] Copilot briefs ${offset + 1}–${offset + limit} of ${withCopy.length}`
  );
  const prompt = runNode(
    PROMPT,
    [],
    {
      NETFLIX_INPUT: INPUT,
      NETFLIX_OFFSET: String(offset),
      NETFLIX_LIMIT: String(limit),
      COPILOT_MODEL: MODEL,
    }
  );
  if (prompt.status !== 0) {
    console.error(prompt.stderr || prompt.stdout || "prompt failed");
    continue;
  }

  const copilot = runCopilot(prompt.stdout);
  const outPath = `/tmp/netflix.copilot.${offset}.txt`;
  await writeFile(outPath, copilot.stdout || "");
  if (!copilot.stdout) {
    console.log(`  [netflix] chunk at ${offset} was empty — keeping existing briefs`);
    continue;
  }

  const apply = runNode(
    APPLY,
    [outPath, FILE],
    { COPILOT_MODEL: MODEL },
    "inherit"
  );
  if (apply.status === 0) chunksOk += 1;
  else {
    console.log(
      `  [netflix] chunk at ${offset} was unusable — keeping existing briefs for this slice`
    );
  }
}

if (!chunksOk) {
  await copyFile(FALLBACK, FILE);
  console.log("  [netflix] all Copilot chunks failed — keeping file as-is");
  process.exit(1);
}

const validate = runNode(VALIDATE, [FILE], { COPILOT_MODEL: MODEL }, "inherit");
if (validate.status !== 0) {
  await copyFile(FALLBACK, FILE);
  console.log("  [netflix] Copilot briefs were invalid — keeping file as-is");
  process.exit(1);
}

console.log(`  [netflix] Copilot finished ${chunksOk} brief chunk(s)`);
