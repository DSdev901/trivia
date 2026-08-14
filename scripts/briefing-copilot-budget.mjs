#!/usr/bin/env node
/**
 * Decide which Copilot model to use and how many clustered briefing
 * cards it should rewrite.
 *
 * Remaining credits: Copilot's /copilot_internal/user quota (same API the
 * CLI uses), then GitHub's public billing usage report. The public billing
 * URL often 404s for personal Copilot even with a classic PAT.
 *
 * BRIEFING_PASS=full|slim overrides the automatic size.
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
const PASS = String(process.env.BRIEFING_PASS || "auto").toLowerCase();

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
  const preferred = [
    "premium_interactions",
    "premium",
    "chat",
    "ai_credits",
    "credits",
  ];
  const names = [
    ...preferred.filter((k) => snaps[k]),
    ...Object.keys(snaps).filter((k) => !preferred.includes(k)),
  ];
  for (const name of names) {
    const row = snaps[name];
    if (!row || typeof row !== "object") continue;
    if (row.unlimited) {
      return { remaining: MONTHLY, used: 0, via: `copilot ${name} unlimited` };
    }
    const remaining = Number(row.remaining ?? row.quota_remaining);
    const entitlement = Number(row.entitlement);
    if (Number.isFinite(remaining)) {
      const used = Number.isFinite(entitlement)
        ? Math.max(0, entitlement - remaining)
        : null;
      return { remaining: Math.max(0, remaining), used, via: `copilot ${name}` };
    }
  }
  return null;
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

function capCredits(desired, remaining) {
  if (remaining == null) return desired;
  return Math.max(0, Math.min(desired, remaining));
}

const data = JSON.parse(await readFile(FILE, "utf8"));
const total = Array.isArray(data.items) ? data.items.length : 0;
const billed = await remainingCredits().catch((err) => ({
  remaining: null,
  used: null,
  reason: err.message,
  probes: [],
}));

let mode = "slim";
let model = MODEL_FULL;
if (PASS === "full") {
  mode = "full";
  model = MODEL_FULL;
} else if (PASS === "slim") {
  mode = "slim";
  model = MODEL_FULL;
} else if (billed.remaining != null && billed.remaining >= FULL_NEED) {
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
    : `${billed.remaining} remaining${
        billed.used == null ? "" : ` of ${MONTHLY} (used ${billed.used})`
      } — ${billed.reason}`;

const lines = [
  `  [briefing] clustered stories: ${total}`,
  `  [briefing] Copilot credits: ${remainingLabel}`,
  `  [briefing] pass override: ${PASS}`,
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
