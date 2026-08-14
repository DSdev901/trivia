#!/usr/bin/env node
/**
 * Rewrite the top clustered briefing cards with Copilot Haiku. Chunks stay
 * under Haiku's output cap. A failed chunk keeps heuristic summaries for
 * that slice; if every chunk fails, restore the fallback file.
 */

import { spawnSync } from "node:child_process";
import { copyFile, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { BRIEFING_FEATURED } from "../briefing.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FILE = path.join(ROOT, "data", "current-events", "briefing.json");
const PROMPT = path.join(ROOT, "scripts", "briefing-copilot-prompt.mjs");
const APPLY = path.join(ROOT, "scripts", "apply-briefing-rewrite.mjs");
const APPLY_MERGES = path.join(ROOT, "scripts", "apply-briefing-merges.mjs");
const VALIDATE = path.join(ROOT, "scripts", "validate-briefing.mjs");
const FALLBACK = process.env.BRIEFING_FALLBACK || "/tmp/briefing.fallback.json";
const INPUT = process.env.BRIEFING_INPUT || "/tmp/briefing.input.json";
const CHUNK = Math.max(40, Number(process.env.BRIEFING_CHUNK_SIZE || 200));
const TOP = Math.max(10, Number(process.env.BRIEFING_TOP_N || BRIEFING_FEATURED));
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

const original = JSON.parse(await readFile(INPUT, "utf8"));
const total = Array.isArray(original.items) ? original.items.length : 0;
if (total < 10) {
  throw new Error(`briefing input had too few items (${total})`);
}

await copyFile(FALLBACK, FILE);

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

{
  const mergeUntil = Math.min(TOP, total);
  console.log(
    `  [briefing] Copilot combover on top ${mergeUntil} for same-story merges`
  );
  const mergePrompt = runNode(
    PROMPT,
    [],
    {
      BRIEFING_INPUT: INPUT,
      BRIEFING_OFFSET: "0",
      BRIEFING_LIMIT: String(mergeUntil),
      BRIEFING_MERGE: "1",
      COPILOT_MODEL: MODEL,
    }
  );
  if (mergePrompt.status === 0 && mergePrompt.stdout) {
    const mergeOut = "/tmp/briefing.copilot.merges.txt";
    const copilot = runCopilot(mergePrompt.stdout);
    await writeFile(mergeOut, copilot.stdout || "");
    if (copilot.stdout) {
      const applied = runNode(
        APPLY_MERGES,
        [mergeOut, INPUT],
        { BRIEFING_TOP_N: String(TOP), COPILOT_MODEL: MODEL },
        "inherit"
      );
      if (applied.status !== 0) {
        console.log("  [briefing] combover unusable — keeping clustered cards");
      }
    } else {
      console.log("  [briefing] combover was empty — keeping clustered cards");
    }
  } else {
    console.log("  [briefing] combover prompt failed — keeping clustered cards");
  }
}

const rewriteUntil = Math.min(TOP, JSON.parse(await readFile(INPUT, "utf8")).items.length);
let chunksOk = 0;
for (let offset = 0; offset < rewriteUntil; offset += CHUNK) {
  const limit = Math.min(CHUNK, rewriteUntil - offset);
  console.log(
    `  [briefing] Copilot chunk ${offset + 1}–${offset + limit} of top ${rewriteUntil} (${total} ranked)`
  );
  const prompt = runNode(
    PROMPT,
    [],
    {
      BRIEFING_INPUT: INPUT,
      BRIEFING_OFFSET: String(offset),
      BRIEFING_LIMIT: String(limit),
      COPILOT_MODEL: MODEL,
    }
  );
  if (prompt.status !== 0) {
    console.error(prompt.stderr || prompt.stdout || "prompt failed");
    continue;
  }

  const copilot = runCopilot(prompt.stdout);
  const outPath = `/tmp/briefing.copilot.${offset}.txt`;
  await writeFile(outPath, copilot.stdout || "");
  if (!copilot.stdout) {
    console.log(`  [briefing] chunk at ${offset} was empty — keeping heuristic`);
    continue;
  }

  const apply = runNode(
    APPLY,
    [outPath, INPUT],
    {
      BRIEFING_OFFSET: String(offset),
      BRIEFING_LIMIT: String(limit),
      COPILOT_MODEL: MODEL,
    },
    "inherit"
  );
  if (apply.status === 0) chunksOk += 1;
  else {
    console.log(
      `  [briefing] chunk at ${offset} was unusable — keeping heuristic for this slice`
    );
  }
}

if (!chunksOk) {
  await copyFile(FALLBACK, FILE);
  console.log(
    "  [briefing] all Copilot chunks failed — keeping full heuristic ranking"
  );
  process.exit(1);
}

const validate = runNode(VALIDATE, [], { COPILOT_MODEL: MODEL }, "inherit");
if (validate.status !== 0) {
  await copyFile(FALLBACK, FILE);
  console.log(
    "  [briefing] Copilot briefing was invalid — keeping full heuristic ranking"
  );
  process.exit(1);
}

console.log(`  [briefing] Copilot finished ${chunksOk} chunk(s)`);
