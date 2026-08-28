#!/usr/bin/env node
/**
 * Launch, doctor, and cleanup a disposable trivia static server.
 *
 *   node .cursor/skills/verify-trivia/scripts/run.mjs launch
 *   node .cursor/skills/verify-trivia/scripts/run.mjs doctor
 *   node .cursor/skills/verify-trivia/scripts/run.mjs cleanup
 *
 * Run from the trivia repo root (or anywhere; walks up to index.html).
 * Does not kill unrelated node processes. Does not POST to the Railway API.
 */
import { createServer } from "node:net";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RUN_DIR = process.env.TRIVIA_VERIFY_DIR || "/tmp/trivia-verify";
const RUN_FILE = path.join(RUN_DIR, "run.json");

function findRoot(start) {
  let dir = start;
  for (let i = 0; i < 12; i++) {
    if (existsSync(path.join(dir, "index.html")) && existsSync(path.join(dir, "data", "categories.json"))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error("Could not find trivia repo root (index.html + data/categories.json).");
}

const ROOT = findRoot(path.dirname(fileURLToPath(import.meta.url)));

function freePort() {
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close((err) => (err ? reject(err) : resolve(port)));
    });
    s.on("error", reject);
  });
}

async function waitReady(url, ms = 8000) {
  const end = Date.now() + ms;
  let last = "";
  while (Date.now() < end) {
    try {
      const res = await fetch(url, { redirect: "manual" });
      if (res.ok) return;
      last = `HTTP ${res.status}`;
    } catch (err) {
      last = err.message;
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`Server not ready at ${url}: ${last}`);
}

async function readRun() {
  try {
    return JSON.parse(await readFile(RUN_FILE, "utf8"));
  } catch {
    return null;
  }
}

async function launch() {
  const existing = await readRun();
  if (existing?.pid) {
    try {
      process.kill(existing.pid, 0);
      throw new Error(
        `A verify instance is already running (pid ${existing.pid} at ${existing.url}). Run cleanup first.`
      );
    } catch (err) {
      if (err.code !== "ESRCH") throw err;
    }
  }

  const port = Number(process.env.TRIVIA_VERIFY_PORT) || (await freePort());
  const url = `http://127.0.0.1:${port}/`;
  await mkdir(RUN_DIR, { recursive: true });

  const child = spawn(process.execPath, [path.join(ROOT, "scripts", "serve.mjs"), String(port)], {
    cwd: ROOT,
    stdio: "ignore",
    detached: true,
  });
  child.unref();

  const run = {
    pid: child.pid,
    port,
    url,
    root: ROOT,
    startedAt: new Date().toISOString(),
  };
  await writeFile(RUN_FILE, JSON.stringify(run, null, 2));

  try {
    await waitReady(url);
  } catch (err) {
    try {
      process.kill(child.pid);
    } catch {
      /* already gone */
    }
    throw err;
  }

  process.stdout.write(`${url}\n`);
  return run;
}

async function doctor() {
  const run = await readRun();
  if (!run?.url || !run?.pid) {
    throw new Error(`No verify instance. Expected ${RUN_FILE}. Run launch first.`);
  }
  try {
    process.kill(run.pid, 0);
  } catch {
    throw new Error(`Recorded pid ${run.pid} is not running. Run cleanup, then launch.`);
  }

  const home = await fetch(run.url);
  const html = await home.text();
  if (!home.ok) throw new Error(`Home HTTP ${home.status}`);
  if (!html.includes("General Trivia") && !html.includes("trivia-general-logo")) {
    throw new Error("Home HTML did not contain the General Trivia mark.");
  }

  const cats = await fetch(new URL("data/categories.json", run.url));
  const data = await cats.json();
  const ids = (data.categories || []).map((c) => c.id);
  for (const id of ["movies", "presidents", "geography", "current-events", "themed", "harrison-ford"]) {
    if (!ids.includes(id)) throw new Error(`categories.json missing ${id}`);
  }

  const out = {
    ok: true,
    pid: run.pid,
    url: run.url,
    port: run.port,
    categoryCount: ids.length,
  };
  process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
  return out;
}

async function cleanup() {
  const run = await readRun();
  if (run?.pid) {
    try {
      process.kill(run.pid);
    } catch (err) {
      if (err.code !== "ESRCH") throw err;
    }
  }
  await rm(RUN_FILE, { force: true });
  process.stdout.write("cleaned\n");
}

const cmd = process.argv[2];
const cmds = { launch, doctor, cleanup };
if (!cmds[cmd]) {
  process.stderr.write("Usage: run.mjs launch|doctor|cleanup\n");
  process.exit(2);
}
cmds[cmd]().catch((err) => {
  process.stderr.write(`${err.message}\n`);
  process.exit(1);
});
