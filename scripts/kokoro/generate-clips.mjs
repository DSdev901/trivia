#!/usr/bin/env node
/**
 * Record Kokoro "Heart" clips for read-aloud, one MP3 per spoken chunk.
 *
 *   cd scripts/kokoro && npm install          # once
 *   node scripts/kokoro/generate-clips.mjs --pack lord-of-the-rings
 *   node scripts/kokoro/generate-clips.mjs --presidents
 *   node scripts/kokoro/generate-clips.mjs --pack lord-of-the-rings --workers 4
 *
 * Text comes from the app's own speech helpers (speech.js), so clip names
 * match exactly what the browser will ask for. Existing clips are skipped;
 * the manifest lists every clip on disk. Needs ffmpeg.
 */
import { spawn, execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const VOICE = "af_heart";
const OUT_DIR = path.join(ROOT, "data/audio/kokoro", VOICE);
const MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX";

// speech.js is a browser module; give it just enough of a window to import.
function stubBrowser() {
  const mem = new Map();
  globalThis.window = globalThis;
  globalThis.localStorage = {
    getItem: (k) => mem.get(k) ?? null,
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k),
  };
  Object.defineProperty(globalThis, "navigator", {
    value: { userAgent: "node", language: "en-US", platform: "node", maxTouchPoints: 0 },
    configurable: true,
  });
  globalThis.speechSynthesis = { getVoices: () => [], addEventListener() {}, removeEventListener() {} };
  globalThis.document = { visibilityState: "visible", addEventListener() {} };
}

async function speechHelpers() {
  stubBrowser();
  const speech = await import(pathToFileURL(path.join(ROOT, "speech.js")).href);
  const clips = await import(pathToFileURL(path.join(ROOT, "kokoro-clips.js")).href);
  return { ...speech, kokoroClipKey: clips.kokoroClipKey };
}

const readJson = (rel) => JSON.parse(readFileSync(path.join(ROOT, rel), "utf8"));
const pad2 = (n) => String(n).padStart(2, "0");

/** Raw read-aloud lines, exactly as app.js builds them per study page. */
function linesForPack(id, h) {
  const cat = readJson("data/categories.json").categories.find((c) => c.id === id);
  if (!cat) throw new Error(`no category "${id}"`);
  const pages = [];
  for (const b of cat.batches || []) {
    const batch = readJson(cat.batchPath.replace("{n}", pad2(b.n)));
    pages.push(batch.questions.map((q, i) => h.toMovieQuestionSpeech(q, i + 1)));
  }
  return pages;
}

function linesForPresidents(h) {
  const cat = readJson("data/categories.json").categories.find((c) => c.id === "presidents");
  const pages = [];
  for (const b of cat.batches || []) {
    const batch = readJson(cat.batchPath.replace("{n}", pad2(b.n)));
    pages.push(batch.presidents.map((p) => h.toPresidentRosterSpeech(p)));
    for (const p of batch.presidents) {
      pages.push(p.trivia.map((fact, i) => h.toConversationalSpeech(p, fact, i + 1)));
    }
  }
  return pages;
}

function writeManifest() {
  const keys = readdirSync(OUT_DIR)
    .filter((f) => /^[0-9a-f]{14}\.mp3$/.test(f))
    .map((f) => f.slice(0, -4))
    .sort();
  writeFileSync(
    path.join(OUT_DIR, "manifest.json"),
    `${JSON.stringify({ voice: VOICE, model: MODEL_ID, count: keys.length, keys })}\n`
  );
  return keys.length;
}

/* ---- worker: record a list of {key, text} ---- */
async function runWorker(jobFile) {
  const jobs = JSON.parse(readFileSync(jobFile, "utf8"));
  const { KokoroTTS } = await import("kokoro-js");
  const tts = await KokoroTTS.from_pretrained(MODEL_ID, { dtype: "fp32", device: "cpu" });
  const tmp = path.join(os.tmpdir(), `kokoro-${process.pid}.wav`);
  for (const { key, text } of jobs) {
    const out = path.join(OUT_DIR, `${key}.mp3`);
    if (existsSync(out)) continue;
    const audio = await tts.generate(text, { voice: VOICE });
    await audio.save(tmp);
    execFileSync("ffmpeg", [
      "-loglevel", "error", "-y", "-i", tmp,
      "-ac", "1", "-codec:a", "libmp3lame", "-b:a", "48k", `${out}.part.mp3`,
    ]);
    execFileSync("mv", [`${out}.part.mp3`, out]);
    process.stdout.write("."); // progress tick for the parent
  }
  rmSync(tmp, { force: true });
}

/* ---- main ---- */
async function main() {
  const args = process.argv.slice(2);
  if (args[0] === "--worker") return runWorker(args[1]);

  const h = await speechHelpers();
  const pages = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--pack") pages.push(...linesForPack(args[++i], h));
    if (args[i] === "--presidents") pages.push(...linesForPresidents(h));
  }
  const workersArg = args.indexOf("--workers");
  const workers = workersArg >= 0 ? Math.max(1, Number(args[workersArg + 1]) || 1) : 3;
  if (!pages.length) {
    console.log("Nothing selected. Use --pack <id> and/or --presidents.");
    return;
  }
  mkdirSync(OUT_DIR, { recursive: true });

  const byKey = new Map();
  for (const lines of pages) {
    for (const text of h.spokenChunksForLines(lines)) byKey.set(h.kokoroClipKey(text, VOICE), text);
  }
  const todo = [...byKey].filter(([key]) => !existsSync(path.join(OUT_DIR, `${key}.mp3`)));
  console.log(`${byKey.size} chunks, ${todo.length} to record with ${workers} workers`);

  if (todo.length) {
    // Download/verify the model in one worker first; parallel first-time
    // downloads into the shared cache corrupt it. (Not in this process: the
    // browser stubs for speech.js confuse transformers.js.)
    const warmJobs = path.join(os.tmpdir(), `kokoro-warm-${process.pid}.json`);
    writeFileSync(warmJobs, "[]");
    execFileSync(process.execPath, [fileURLToPath(import.meta.url), "--worker", warmJobs], {
      cwd: HERE,
      stdio: "inherit",
    });
    rmSync(warmJobs, { force: true });
    const started = Date.now();
    let done = 0;
    const lanes = Array.from({ length: workers }, () => []);
    todo.forEach(([key, text], i) => lanes[i % workers].push({ key, text }));
    await Promise.all(
      lanes.filter((l) => l.length).map((lane, w) => {
        const jobFile = path.join(os.tmpdir(), `kokoro-jobs-${process.pid}-${w}.json`);
        writeFileSync(jobFile, JSON.stringify(lane));
        return new Promise((resolve, reject) => {
          const child = spawn(process.execPath, [fileURLToPath(import.meta.url), "--worker", jobFile], {
            cwd: HERE,
            stdio: ["ignore", "pipe", "inherit"],
          });
          child.stdout.on("data", (buf) => {
            done += String(buf).split(".").length - 1;
            const mins = ((Date.now() - started) / 60000).toFixed(1);
            process.stdout.write(`\r  recorded ${done}/${todo.length} (${mins} min)`);
          });
          child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`worker ${w} exited ${code}`))));
        }).finally(() => rmSync(jobFile, { force: true }));
      })
    );
    process.stdout.write("\n");
  }
  console.log(`manifest: ${writeManifest()} clips in ${path.relative(ROOT, OUT_DIR)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
