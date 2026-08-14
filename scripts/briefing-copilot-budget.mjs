#!/usr/bin/env node
/**
 * Decide whether Haiku should rewrite the clustered briefing.
 *
 * Remaining credits: Copilot's /copilot_internal/user quota (same API the
 * CLI uses), then GitHub's public billing usage report. The public billing
 * URL often 404s for personal Copilot even with a classic PAT.
 *
 * If remaining is 0, skip Copilot and keep the heuristic ranking. Otherwise
 * send the full clustered list with no session credit cap. If Haiku runs
 * out or the rewrite is unusable, the job keeps the heuristic ranking.
 */

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FILE = path.join(ROOT, "data", "current-events", "briefing.json");
const USER = process.env.COPILOT_BILLING_USER || "DSdev901";
const MONTHLY = Math.max(1, Number(process.env.COPILOT_MONTHLY_CREDITS || 1500));
const MODEL = process.env.BRIEFING_MODEL_FULL || "claude-haiku-4.5";

function currentMonth() {
  const now = new Date();
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
}

function tokenKind(token) {
  if (token.startsWith("github_pat_")) return "fine-grained";
  if (token.startsWith("ghp_")) return "classic";
  if (token.startsWith("gho_")) return "oauth";
  return "other";
}

function apiHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "trivia-briefing-budget",
  };
}

async function apiGet(token, pathWithQuery) {
  const res = await fetch(`https://api.github.com${pathWithQuery}`, {
    headers: apiHeaders(token),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return {
    ok: res.ok,
    status: res.status,
    json,
    text: text.replace(/\s+/g, " ").slice(0, 160),
    oauthScopes: res.headers.get("x-oauth-scopes") || "",
    accepted: res.headers.get("x-accepted-github-permissions") || "",
  };
}

function usedFromUsageItems(data) {
  return (data?.usageItems || []).reduce(
    (n, row) => n + Number(row.netQuantity || row.quantity || 0),
    0
  );
}

function remainingFromCopilotUser(data) {
  const snaps = data?.quota_snapshots || {};
  const candidates = [];
  for (const [name, row] of Object.entries(snaps)) {
    if (!row || typeof row !== "object") continue;
    if (row.unlimited) {
      return {
        remaining: MONTHLY,
        used: 0,
        entitlement: MONTHLY,
        via: `copilot ${name} unlimited`,
      };
    }
    const remaining = Number(row.remaining ?? row.quota_remaining);
    const entitlement = Number(row.entitlement);
    if (!Number.isFinite(remaining)) continue;
    candidates.push({
      remaining: Math.max(0, remaining),
      used: Number.isFinite(entitlement)
        ? Math.max(0, entitlement - remaining)
        : null,
      entitlement: Number.isFinite(entitlement) ? entitlement : null,
      via: `copilot ${name}`,
    });
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => b.remaining - a.remaining);
  return candidates[0];
}

async function remainingCredits() {
  const billingToken = String(
    process.env.COPILOT_BILLING_TOKEN || ""
  ).trim();
  const actionsToken = String(process.env.GITHUB_TOKEN || "").trim();
  const { year, month } = currentMonth();
  const probes = [];

  if (billingToken) {
    const who = await apiGet(billingToken, "/user");
    probes.push(
      `PAT ${tokenKind(billingToken)} /user HTTP ${who.status}${
        who.ok && who.json?.login ? ` login=${who.json.login}` : ""
      }${who.oauthScopes ? ` scopes=${who.oauthScopes}` : ""}`
    );
  } else {
    probes.push("no COPILOT_BILLING_TOKEN");
  }

  const tokens = [
    ["actions", actionsToken],
    ["billing", billingToken],
  ].filter(([, t]) => t);

  for (const [label, token] of tokens) {
    const res = await apiGet(token, "/copilot_internal/user");
    probes.push(`${label} /copilot_internal/user HTTP ${res.status}`);
    if (res.ok) {
      const parsed = remainingFromCopilotUser(res.json);
      if (parsed) {
        return { ...parsed, reason: `ok via ${parsed.via} (${label})`, probes };
      }
      probes.push(
        `copilot snapshots: ${Object.keys(res.json?.quota_snapshots || {}).join(",") || "none"}`
      );
    }
  }

  if (billingToken) {
    const paths = [
      `/users/${encodeURIComponent(USER)}/settings/billing/ai_credit/usage?year=${year}&month=${month}`,
      `/users/${encodeURIComponent(USER)}/settings/billing/usage/summary?year=${year}&month=${month}`,
      `/users/${encodeURIComponent(USER)}/settings/billing/premium_request/usage?year=${year}&month=${month}`,
    ];
    for (const p of paths) {
      const res = await apiGet(billingToken, p);
      probes.push(`billing ${p.split("?")[0]} HTTP ${res.status}`);
      if (res.ok) {
        const used = usedFromUsageItems(res.json);
        return {
          remaining: Math.max(0, MONTHLY - used),
          used,
          reason: "ok via billing API",
          probes,
        };
      }
    }
  }

  return {
    remaining: null,
    used: null,
    reason: probes.join("; "),
    probes,
  };
}

const data = JSON.parse(await readFile(FILE, "utf8"));
const total = Array.isArray(data.items) ? data.items.length : 0;
const billed = await remainingCredits().catch((err) => ({
  remaining: null,
  used: null,
  reason: err.message,
  probes: [],
}));

const skip = billed.remaining === 0;
const mode = skip ? "skip" : "full";

const pool = billed.entitlement || MONTHLY;
const remainingLabel =
  billed.remaining == null
    ? `unknown (${billed.reason})`
    : `${billed.remaining} remaining${
        billed.used == null ? "" : ` of ${pool} (used ${billed.used})`
      } — ${billed.reason}`;

const lines = [
  `  [briefing] clustered stories: ${total}`,
  `  [briefing] Copilot credits: ${remainingLabel}`,
  skip
    ? `  [briefing] mode: skip — no credits left; keeping full heuristic ranking`
    : `  [briefing] mode: full — ${MODEL}, ${total} cards, no session credit cap`,
];
console.log(lines.join("\n"));

const githubOut = process.env.GITHUB_OUTPUT;
if (githubOut) {
  await writeFile(
    githubOut,
    [
      `mode=${mode}`,
      `skip=${skip}`,
      `keep=${total}`,
      `model=${MODEL}`,
      `remaining=${billed.remaining == null ? "unknown" : billed.remaining}`,
      "",
    ].join("\n"),
    { flag: "a" }
  );
}
