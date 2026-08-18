import "./load-env.js";
import cors from "cors";
import express from "express";
import multer from "multer";
import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { migrate, query } from "./db.js";
import { parseConfigured, parseTriviaCard } from "./parse-photo.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.resolve(HERE, "..");

const PORT = Number(process.env.PORT) || 8787;
const UPLOAD_PIN = String(process.env.UPLOAD_PIN || "").trim();
const SERVE_FRONTEND = ["1", "true", "on"].includes(
  String(
    process.env.SERVE_FRONTEND || (process.env.NODE_ENV === "production" ? "0" : "1")
  ).toLowerCase()
);
const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
const ALLOWED_ORIGINS = String(process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is missing — photo routes will fail until it is set");
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
});

const HIT_SKIP_IPS = new Set(
  String(process.env.HIT_SKIP_IPS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
);

function originAllowed(origin) {
  if (!origin) return true;
  if (!ALLOWED_ORIGINS.length) return true;
  return ALLOWED_ORIGINS.includes(origin);
}

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(
  cors({
    origin(origin, cb) {
      cb(null, originAllowed(origin));
    },
    allowedHeaders: ["Content-Type", "X-Trivia-Pin"],
  })
);
app.use(express.json({ limit: "32kb" }));

function pinOk(req) {
  if (!UPLOAD_PIN) return process.env.NODE_ENV !== "production";
  return req.get("x-trivia-pin") === UPLOAD_PIN;
}

function requirePin(req, res, next) {
  if (pinOk(req)) return next();
  res.status(401).json({ error: "PIN required" });
}

app.get("/api/health", async (_req, res) => {
  try {
    await query("SELECT 1");
    res.json({ ok: true, pin: Boolean(UPLOAD_PIN), parse: parseConfigured() });
  } catch (err) {
    res.status(503).json({ ok: false, error: err.message });
  }
});

function clientIp(req) {
  const fwd = String(req.get("x-forwarded-for") || "")
    .split(",")[0]
    .trim();
  let ip = fwd || req.ip || req.socket?.remoteAddress || "unknown";
  if (ip.startsWith("::ffff:")) ip = ip.slice(7);
  return ip.slice(0, 64);
}

function skipHitIp(ip) {
  if (!ip || ip === "unknown") return false;
  return HIT_SKIP_IPS.has(ip) || HIT_SKIP_IPS.has(`::ffff:${ip}`);
}

async function currentHitCount() {
  const { rows } = await query(
    `SELECT value FROM site_stats WHERE key = 'hits'`
  );
  const n = Number(rows[0]?.value);
  return Number.isFinite(n) && n >= 901 ? n : 901;
}

async function bumpHitCount(ip) {
  if (skipHitIp(ip)) {
    return { count: await currentHitCount(), incremented: false };
  }
  const { rowCount } = await query(
    `INSERT INTO hit_rate (ip, last_at) VALUES ($1, NOW())
     ON CONFLICT (ip) DO UPDATE
       SET last_at = NOW()
       WHERE hit_rate.last_at < NOW() - INTERVAL '30 minutes'`,
    [ip]
  );
  if (!rowCount) {
    return { count: await currentHitCount(), incremented: false };
  }
  const { rows } = await query(
    `INSERT INTO site_stats (key, value) VALUES ('hits', 901)
     ON CONFLICT (key) DO UPDATE SET value = site_stats.value + 1
     RETURNING value`
  );
  return { count: Number(rows[0].value), incremented: true };
}

app.get("/api/hits", async (_req, res) => {
  try {
    res.json({ count: await currentHitCount() });
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
});

app.post("/api/hits", async (req, res) => {
  try {
    res.json(await bumpHitCount(clientIp(req)));
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
});

if (!SERVE_FRONTEND) {
  app.get("/", (_req, res) => {
    res.json({ ok: true, service: "trivia-photo-api" });
  });
}

const PHOTO_COLS = `id, created_at, original_name, mime_type, width, height,
            byte_size, note, extracted_text, question, answer,
            trivia_date::text AS trivia_date`;

function parseTriviaDate(value) {
  if (value == null || String(value).trim() === "") return null;
  const s = String(value).trim();
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  let year;
  let month;
  let day;
  if (iso) {
    year = Number(iso[1]);
    month = Number(iso[2]);
    day = Number(iso[3]);
  } else if (us) {
    month = Number(us[1]);
    day = Number(us[2]);
    year = Number(us[3]);
  } else {
    return undefined;
  }
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (
    dt.getUTCFullYear() !== year ||
    dt.getUTCMonth() !== month - 1 ||
    dt.getUTCDate() !== day
  ) {
    return undefined;
  }
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

app.get("/api/photos", async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (q) {
    const like = `%${q.replace(/[%_]/g, "\\$&")}%`;
    const { rows } = await query(
      `SELECT ${PHOTO_COLS}
       FROM photos
       WHERE question ILIKE $1 ESCAPE '\\'
          OR answer ILIKE $1 ESCAPE '\\'
          OR note ILIKE $1 ESCAPE '\\'
          OR extracted_text ILIKE $1 ESCAPE '\\'
          OR trivia_date::text ILIKE $1 ESCAPE '\\'
          OR to_char(trivia_date, 'FMMM/FMDD/YYYY') ILIKE $1 ESCAPE '\\'
       ORDER BY trivia_date DESC NULLS LAST, created_at DESC`,
      [like]
    );
    res.json({ items: rows });
    return;
  }
  const { rows } = await query(
    `SELECT ${PHOTO_COLS}
     FROM photos
     ORDER BY trivia_date DESC NULLS LAST, created_at DESC`
  );
  res.json({ items: rows });
});

app.get("/api/photos/:id", async (req, res) => {
  const thumb = req.query.size === "thumb";
  const { rows } = await query(
    thumb
      ? `SELECT mime_type, COALESCE(thumb, image) AS bytes FROM photos WHERE id = $1`
      : `SELECT mime_type, image AS bytes FROM photos WHERE id = $1`,
    [req.params.id]
  );
  const row = rows[0];
  if (!row?.bytes) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const body = Buffer.isBuffer(row.bytes) ? row.bytes : Buffer.from(row.bytes);
  res.setHeader("Content-Type", row.mime_type || "image/jpeg");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.send(body);
});

app.patch("/api/photos/:id", requirePin, async (req, res) => {
  const sets = [];
  const vals = [req.params.id];
  const add = (col, value, max) => {
    vals.push(value == null ? null : String(value).slice(0, max));
    sets.push(`${col} = $${vals.length}`);
  };
  if (req.body?.note !== undefined) add("note", req.body.note, 2000);
  if (req.body?.question !== undefined) add("question", req.body.question, 2000);
  if (req.body?.answer !== undefined) add("answer", req.body.answer, 2000);
  if (req.body?.trivia_date !== undefined) {
    const parsed = parseTriviaDate(req.body.trivia_date);
    if (parsed === undefined) {
      res.status(400).json({ error: "trivia_date must be a date like 8/11/2026" });
      return;
    }
    vals.push(parsed);
    sets.push(`trivia_date = $${vals.length}`);
  }
  if (!sets.length) {
    res.status(400).json({ error: "Nothing to update" });
    return;
  }
  const { rows } = await query(
    `UPDATE photos SET ${sets.join(", ")} WHERE id = $1 RETURNING ${PHOTO_COLS}`,
    vals
  );
  if (!rows[0]) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(rows[0]);
});

app.delete("/api/photos/:id", requirePin, async (req, res) => {
  const { rowCount } = await query(`DELETE FROM photos WHERE id = $1`, [req.params.id]);
  if (!rowCount) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({ ok: true });
});

app.post("/api/photos/:id/parse", requirePin, async (req, res) => {
  const { rows: found } = await query(`SELECT image FROM photos WHERE id = $1`, [req.params.id]);
  if (!found[0]?.image) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const jpeg = Buffer.isBuffer(found[0].image) ? found[0].image : Buffer.from(found[0].image);
  try {
    const parsed = await parseTriviaCard(jpeg);
    const { rows } = await query(
      `UPDATE photos
       SET question = $2, answer = $3, extracted_text = $4
       WHERE id = $1
       RETURNING ${PHOTO_COLS}`,
      [req.params.id, parsed.question || null, parsed.answer || null, parsed.extracted_text || null]
    );
    res.json({ ...rows[0], parse_source: parsed.source });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

async function prepareImage(buffer) {
  const full = await sharp(buffer, { failOn: "none" })
    .rotate()
    .resize({
      width: 1600,
      height: 1600,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
  const sized = await sharp(full).metadata();
  const thumb = await sharp(full)
    .resize({ width: 480, height: 480, fit: "inside" })
    .jpeg({ quality: 72 })
    .toBuffer();
  return {
    full,
    thumb,
    width: sized.width || null,
    height: sized.height || null,
  };
}

app.put("/api/photos/:id/image", requirePin, upload.single("photo"), async (req, res) => {
  if (!req.file?.buffer) {
    res.status(400).json({ error: "Choose a photo to upload" });
    return;
  }
  if (!req.file.mimetype.startsWith("image/")) {
    res.status(400).json({ error: "File must be an image" });
    return;
  }
  try {
    const prepared = await prepareImage(req.file.buffer);
    const { rows } = await query(
      `UPDATE photos
       SET mime_type = 'image/jpeg', width = $2, height = $3, byte_size = $4,
           image = $5, thumb = $6
       WHERE id = $1
       RETURNING ${PHOTO_COLS}`,
      [
        req.params.id,
        prepared.width,
        prepared.height,
        prepared.full.length,
        prepared.full,
        prepared.thumb,
      ]
    );
    if (!rows[0]) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: "Could not read that image" });
  }
});

app.post("/api/photos", requirePin, upload.single("photo"), async (req, res) => {
  if (!req.file?.buffer) {
    res.status(400).json({ error: "Choose a photo to upload" });
    return;
  }
  if (!req.file.mimetype.startsWith("image/")) {
    res.status(400).json({ error: "File must be an image" });
    return;
  }
  try {
    const prepared = await prepareImage(req.file.buffer);
    const { full, thumb, width, height } = prepared;
    const note = req.body?.note ? String(req.body.note).slice(0, 2000) : null;
    const triviaDate = parseTriviaDate(req.body?.trivia_date);
    if (req.body?.trivia_date !== undefined && req.body?.trivia_date !== "" && triviaDate === undefined) {
      res.status(400).json({ error: "trivia_date must be a date like 8/11/2026" });
      return;
    }
    let parsed = { question: "", answer: "", extracted_text: "", source: "none" };
    try {
      parsed = await parseTriviaCard(full);
    } catch (err) {
      console.error("Parse failed:", err.message);
    }
    const { rows } = await query(
      `INSERT INTO photos
        (original_name, mime_type, width, height, byte_size, image, thumb, note,
         extracted_text, question, answer, trivia_date)
       VALUES ($1, 'image/jpeg', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING ${PHOTO_COLS}`,
      [
        req.file.originalname || null,
        width,
        height,
        full.length,
        full,
        thumb,
        note,
        parsed.extracted_text || null,
        parsed.question || null,
        parsed.answer || null,
        triviaDate,
      ]
    );
    res.status(201).json({ ...rows[0], parse_source: parsed.source });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: "Could not read that image" });
  }
});

app.use((err, _req, res, next) => {
  if (err instanceof multer.MulterError) {
    res.status(400).json({
      error: err.code === "LIMIT_FILE_SIZE" ? "Photo is too large (12 MB max)" : err.message,
    });
    return;
  }
  next(err);
});

if (SERVE_FRONTEND) {
  app.use("/server", (_req, res) => {
    res.status(404).end();
  });
  app.use(express.static(APP_ROOT));
}

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`Photo API on port ${PORT}`);
});

migrate()
  .then(() => console.log("Postgres schema ready"))
  .catch((err) => {
    console.error("Postgres migrate failed:", err.message);
  });
