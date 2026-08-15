/** Read a trivia Q&A from a JPEG buffer. Prefers a vision model; falls back to OCR. */

function clip(s, n = 4000) {
  return String(s || "").replace(/\s+/g, " ").trim().slice(0, n);
}

function fromModelText(text) {
  const raw = String(text || "").trim();
  const json = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = json.indexOf("{");
  const end = json.lastIndexOf("}");
  if (start < 0 || end <= start) {
    return { question: "", answer: "", extracted_text: clip(raw), source: "unparsed" };
  }
  const data = JSON.parse(json.slice(start, end + 1));
  return {
    question: clip(data.question, 2000),
    answer: clip(data.answer, 2000),
    extracted_text: clip(data.raw || raw, 8000),
    source: "vision",
  };
}

const PROMPT = `This photo is a trivia question and its answer (a card, screenshot, whiteboard, or handwritten note).
Extract only the trivia question and the answer. Ignore logos, watermarks, page numbers, and decorative marks.
Do not invent, guess, or complete missing words.
Return JSON only, no markdown:
{"question":"","answer":"","raw":""}
raw is the readable trivia text in reading order.
If a field cannot be read, use an empty string.`;

async function parseAnthropic(jpeg) {
  const key = process.env.ANTHROPIC_API_KEY;
  const model = process.env.PARSE_MODEL || "claude-haiku-4-5";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 800,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/jpeg",
                data: jpeg.toString("base64"),
              },
            },
            { type: "text", text: PROMPT },
          ],
        },
      ],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic ${res.status}: ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  const text = data.content?.find((p) => p.type === "text")?.text || "";
  const out = fromModelText(text);
  out.source = "anthropic";
  return out;
}

async function parseOpenAI(jpeg) {
  const key = process.env.OPENAI_API_KEY;
  const model = process.env.PARSE_MODEL || "gpt-4o-mini";
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 800,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: PROMPT },
            {
              type: "image_url",
              image_url: { url: `data:image/jpeg;base64,${jpeg.toString("base64")}` },
            },
          ],
        },
      ],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI ${res.status}: ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  const out = fromModelText(data.choices?.[0]?.message?.content || "");
  out.source = "openai";
  return out;
}

function splitOcr(text) {
  const raw = String(text || "").replace(/\r/g, "").trim();
  const answerMatch = raw.match(/(?:^|\n)\s*(?:answer|ans|a)\s*[:.\-–]\s*(.+)$/im);
  const questionMatch = raw.match(
    /(?:^|\n)\s*(?:question|q)\s*[:.\-–]\s*([\s\S]+?)(?=\n\s*(?:answer|ans|a)\s*[:.\-–]|$)/i
  );
  if (questionMatch || answerMatch) {
    return {
      question: clip(questionMatch?.[1], 2000),
      answer: clip(answerMatch?.[1], 2000),
      extracted_text: clip(raw, 8000),
      source: "ocr",
    };
  }
  const lines = raw.split(/\n+/).map((s) => s.trim()).filter(Boolean);
  if (lines.length >= 2) {
    return {
      question: clip(lines.slice(0, -1).join(" "), 2000),
      answer: clip(lines.at(-1), 2000),
      extracted_text: clip(raw, 8000),
      source: "ocr",
    };
  }
  return {
    question: clip(raw, 2000),
    answer: "",
    extracted_text: clip(raw, 8000),
    source: "ocr",
  };
}

let ocrWorker = null;

async function parseOcr(jpeg) {
  const { createWorker } = await import("tesseract.js");
  if (!ocrWorker) {
    ocrWorker = await createWorker("eng");
  }
  const { data } = await ocrWorker.recognize(jpeg);
  return splitOcr(data?.text || "");
}

export function parseConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY);
}

export async function parseTriviaCard(jpeg) {
  if (process.env.ANTHROPIC_API_KEY) return parseAnthropic(jpeg);
  if (process.env.OPENAI_API_KEY) return parseOpenAI(jpeg);
  // Local OCR produces garbage on most phone photos of cards. Do not
  // save that as the question unless PARSE_OCR=1 is set on purpose.
  if (process.env.PARSE_OCR === "1") {
    try {
      const out = await parseOcr(jpeg);
      if (ocrLooksUsable(out.extracted_text || out.question)) return out;
    } catch (err) {
      console.error("OCR parse failed:", err.message);
    }
  }
  return {
    question: "",
    answer: "",
    extracted_text: "",
    source: "none",
  };
}

function ocrLooksUsable(text) {
  const t = String(text || "");
  const letters = (t.match(/[A-Za-z]/g) || []).length;
  const junk = (t.match(/[^A-Za-z0-9\s.,?'"!:;()\-–—]/g) || []).length;
  return letters >= 12 && letters > junk * 2;
}
