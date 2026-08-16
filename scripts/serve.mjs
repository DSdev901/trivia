#!/usr/bin/env node
/**
 * Zero-dependency static server for the trivia app, plus one extra route:
 *
 *   POST /api/refresh-current-events  → runs scripts/refresh-current-events.mjs
 *                                       and returns the fresh JSON payloads.
 *
 * Usage:  node scripts/serve.mjs [port]     (default 8000)
 */

import http from "node:http";
import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.argv[2]) || 8000;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".geojson": "application/geo+json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

let refreshing = null;

function runRefresh() {
  if (refreshing) return refreshing;
  refreshing = new Promise((resolve) => {
    execFile(
      process.execPath,
      [path.join(ROOT, "scripts", "refresh-current-events.mjs")],
      { cwd: ROOT, timeout: 120000 },
      async (err, stdout, stderr) => {
        process.stdout.write(stdout || "");
        if (stderr) process.stderr.write(stderr);
        const out = { ok: !err, sections: {} };
        for (const s of ["netflix", "sports", "entertainment", "world", "briefing"]) {
          try {
            out.sections[s] = JSON.parse(
              await readFile(path.join(ROOT, "data", "current-events", `${s}.json`), "utf8")
            );
          } catch {
            out.sections[s] = null;
          }
        }
        refreshing = null;
        resolve(out);
      }
    );
  });
  return refreshing;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/api/refresh-current-events" && req.method === "POST") {
    const out = await runRefresh();
    res.writeHead(out.ok ? 200 : 502, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        ok: out.ok,
        netflix: out.sections.netflix,
        sports: out.sections.sports,
        entertainment: out.sections.entertainment,
        world: out.sections.world,
        briefing: out.sections.briefing,
      })
    );
    return;
  }

  let filePath = path.normalize(decodeURIComponent(url.pathname));
  if (filePath === "/" || filePath === "\\") filePath = "/index.html";
  const abs = path.join(ROOT, filePath);
  if (!abs.startsWith(ROOT)) {
    res.writeHead(403).end("Forbidden");
    return;
  }
  try {
    const body = await readFile(abs);
    const ext = path.extname(abs).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      ...(ext === ".json" || ext === ".geojson"
        ? { "Cache-Control": "no-cache" }
        : {}),
    });
    res.end(body);
  } catch {
    res.writeHead(404).end("Not found");
  }
});

server.listen(PORT, () => {
  console.log(`Trivia app:  http://localhost:${PORT}`);
  console.log("One-click Current Events refresh is enabled on this server.");
});
