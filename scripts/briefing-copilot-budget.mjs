#!/usr/bin/env node
/**
 * Decide which Copilot model to use and how many clustered briefing
 * cards it should rewrite.
 *
 * Tries GitHub's AI-credit usage API (needs a PAT with Plan: read — the
 * default Actions GITHUB_TOKEN cannot see personal Copilot quota).
 *
 * - remaining >= FULL_NEED → Haiku, every clustered card
 * - remaining low → cheaper Flash model, still the full clustered list
 * - remaining very low → cheaper model, top 50 only
 * - remaining empty → skip Copilot (keep the full heuristic list)
 * - remaining unknown → Haiku, top 50
 */

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FILE = path.join(ROOT, "data", "current-events", "briefing.json");
const USER = process.env.COPILOT_BILLING_USER || "DSdev901";
const MONTHLY = Math.max(1, Number(process.env.COPILOT_MONTHLY_CREDITS || 1500));
const FULL_NEED = Math.max(1, Number(process.env.BRIEFING_FULL_CREDITS || 400));
const CHEAP_NEED = Math.max(1, Number(process.env.BRIEFING_CHEAP_CREDITS || 80));
const SLIM_NEED = Math.max(1, Number(process.env.BRIEFING_SLIM_CREDITS || 25));
const SLIM_KEEP = Math.max(10, Number(process.env.BRIEFING_SLIM_KEEP || 50));
const SLIM_CAP = Math.max(50, Number(process.env.BRIEFING_SLIM_MAX_CREDITS || 250));
const FULL_CAP = Math.max(SLIM_CAP, Number(process.env.BRIEFING_FULL_MAX_CREDITS || 800));
const MODEL_FULL = process.env.BRIEFING_MODEL_FULL || "claude-haiku-4.5";
const MODEL_LOW = process.env.BRIEFING_MODEL_LOW || "gemini-3.6-flash";

function currentMonth() {
  const now = new Date();
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
}

async function remainingCredits(token) {
  if (!token) return { remaining: null, used: null, reason: "no token" };
  const { year, month } = currentMonth();
  const url = new URL(
    `https://api.github.com/users/${encodeURIComponent(USER)}/settings/billing/ai_credit/usage`
  );
  url.searchParams.set("year", String(year));
  url.searchParams.set("month", String(month));
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2026-03-10",
      "User-Agent": "trivia-briefing-budget",
    },
  });
  if (!res.ok) {
    const body = await res.text();
    return {
      remaining: null,
      used: null,
      reason: `HTTP ${res.status} ${body.replace(/\s+/g, " ").slice(0, 180)}`,
    };
  }
  const data = await res.json();
  const used = (data.usageItems || []).reduce(
    (n, row) => n + Number(row.netQuantity || 0),
    0
  );
  return {
    remaining: Math.max(0, MONTHLY - used),
    used,
    reason: "ok",
  };
}

function capCredits(desired, remaining) {
  if (remaining == null) return desired;
  return Math.max(0, Math.min(desired, remaining));
}

const data = JSON.parse(await readFile(FILE, "utf8"));
const total = Array.isArray(data.items) ? data.items.length : 0;
const token =
  process.env.COPILOT_BILLING_TOKEN || process.env.GITHUB_TOKEN || "";
const billed = await remainingCredits(token).catch((err) => ({
  remaining: null,
  used: null,
  reason: err.message,
}));

let mode = "slim";
let model = MODEL_FULL;
if (billed.remaining != null && billed.remaining >= FULL_NEED) {
  mode = "full";
  model = MODEL_FULL;
} else if (billed.remaining != null && billed.remaining >= CHEAP_NEED) {
  mode = "full";
  model = MODEL_LOW;
} else if (billed.remaining != null && billed.remaining >= SLIM_NEED) {
  mode = "slim";
  model = MODEL_LOW;
} else if (billed.remaining != null) {
  mode = "skip";
  model = MODEL_LOW;
}

const keep = mode === "slim" ? Math.min(SLIM_KEEP, total) : total;
const maxCredits = capCredits(mode === "full" ? FULL_CAP : SLIM_CAP, billed.remaining);

if (mode === "slim" && keep < total) {
  data.items = data.items.slice(0, keep);
  await writeFile(FILE, `${JSON.stringify(data, null, 2)}\n`);
}

const remainingLabel =
  billed.remaining == null
    ? `unknown (${billed.reason})`
    : `${billed.remaining} remaining of ${MONTHLY} (used ${billed.used})`;

const lines = [
  `  [briefing] clustered stories: ${total}`,
  `  [briefing] Copilot credits: ${remainingLabel}`,
  mode === "skip"
    ? `  [briefing] mode: skip — not enough credits for Copilot; keeping full heuristic ranking`
    : `  [briefing] mode: ${mode} — ${model}, ${keep} cards, session cap ${maxCredits}`,
];
console.log(lines.join("\n"));

const out = process.env.GITHUB_OUTPUT;
if (out) {
  await writeFile(
    out,
    [
      `mode=${mode}`,
      `skip=${mode === "skip"}`,
      `keep=${keep}`,
      `max_credits=${maxCredits}`,
      `model=${model}`,
      `remaining=${billed.remaining == null ? "unknown" : billed.remaining}`,
      "",
    ].join("\n"),
    { flag: "a" }
  );
}
