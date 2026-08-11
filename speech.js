/** Browser text-to-speech helpers for conversational study readouts. */

const VOICE_KEY = "trivia-helper-voice-uri";
const RATE_KEY = "trivia-helper-voice-rate";
const LOOP_KEY = "trivia-helper-fact-loops";
const DANIEL_DEFAULT_FLAG = "trivia-helper-default-daniel-v1";

let voicesReady = null;

function loadVoices() {
  if (voicesReady) return voicesReady;
  voicesReady = new Promise((resolve) => {
    const grab = () => window.speechSynthesis?.getVoices?.() ?? [];
    const existing = grab();
    if (existing.length) {
      resolve(existing);
      return;
    }
    const onVoices = () => {
      window.speechSynthesis.removeEventListener("voiceschanged", onVoices);
      resolve(grab());
    };
    window.speechSynthesis?.addEventListener?.("voiceschanged", onVoices);
    setTimeout(() => resolve(grab()), 700);
  });
  return voicesReady;
}

function isEnglish(voice) {
  return /^en(-|_)/i.test(voice.lang) || /english/i.test(voice.name);
}

/** Higher score = more natural-sounding for study narration. */
function scoreVoice(voice) {
  const name = voice.name || "";
  let score = 0;

  // Default browser voice preference.
  if (/\bdaniel\b/i.test(name)) score += 500;

  // Prefer neural / enhanced / premium quality packs.
  if (/premium/i.test(name)) score += 120;
  if (/enhanced|neural|natural|superstar/i.test(name)) score += 100;
  if (/siri/i.test(name)) score += 90;

  // Strong modern system voices on macOS / Windows / Chrome.
  if (/\b(ava|zoe|allison|nora|evan|nathan|susan|tom|aaron|nicky|samantha|karen|moira|tessa|fiona|martha|gordon)\b/i.test(name)) {
    score += 70;
  }
  if (/google us english|google uk english|microsoft aria|microsoft jenny|microsoft guy|microsoft davis/i.test(name)) {
    score += 80;
  }

  if (/en-US/i.test(voice.lang)) score += 15;
  else if (/en-GB|en-AU|en-IE|en-ZA/i.test(voice.lang)) score += 8;

  // Local voices usually sound better / more reliable than remote.
  if (voice.localService) score += 10;

  // Avoid novelty / classic robotic Mac voices.
  if (/zarvox|trinoids|bad news|boing|bubbles|cellos|organ|whisper|princess|junior|albert|bruce|fred|junior|ralph|kathy|victoria|pipe organ/i.test(name)) {
    score -= 200;
  }
  if (/compact/i.test(name)) score -= 40;

  return score;
}

export async function listEnglishVoices() {
  const voices = await loadVoices();
  return voices
    .filter(isEnglish)
    .map((v) => ({
      voice: v,
      uri: v.voiceURI,
      name: v.name,
      lang: v.lang,
      score: scoreVoice(v),
      local: Boolean(v.localService),
    }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

export function getSavedVoiceUri() {
  try {
    return localStorage.getItem(VOICE_KEY) || "";
  } catch {
    return "";
  }
}

export function saveVoiceUri(uri) {
  try {
    if (uri) localStorage.setItem(VOICE_KEY, uri);
    else localStorage.removeItem(VOICE_KEY);
  } catch {
    /* ignore */
  }
}

export function getSavedRate() {
  try {
    const n = Number(localStorage.getItem(RATE_KEY));
    if (Number.isFinite(n) && n >= 0.7 && n <= 1.15) return n;
  } catch {
    /* ignore */
  }
  return 0.9;
}

export function saveRate(rate) {
  try {
    localStorage.setItem(RATE_KEY, String(rate));
  } catch {
    /* ignore */
  }
}

export function getSavedLoops() {
  try {
    const n = Number(localStorage.getItem(LOOP_KEY));
    if (Number.isInteger(n) && n >= 1 && n <= 20) return n;
  } catch {
    /* ignore */
  }
  return 1;
}

export function saveLoops(loops) {
  try {
    localStorage.setItem(LOOP_KEY, String(loops));
  } catch {
    /* ignore */
  }
}

function findDaniel(ranked) {
  return ranked.find((v) => /\bdaniel\b/i.test(v.name)) || null;
}

async function resolveVoice(preferredUri) {
  const ranked = await listEnglishVoices();
  if (!ranked.length) return null;
  if (preferredUri) {
    const match = ranked.find((v) => v.uri === preferredUri);
    if (match) return match.voice;
  }
  return (findDaniel(ranked) || ranked[0]).voice;
}

/** Default system voice URI — Daniel when available. */
export async function getDefaultBrowserVoiceUri() {
  const ranked = await listEnglishVoices();
  const daniel = findDaniel(ranked);
  // One-time: switch existing saved preference over to Daniel.
  try {
    if (daniel && !localStorage.getItem(DANIEL_DEFAULT_FLAG)) {
      localStorage.setItem(VOICE_KEY, daniel.uri);
      localStorage.setItem(DANIEL_DEFAULT_FLAG, "1");
    }
  } catch {
    /* ignore */
  }
  return (daniel || ranked[0])?.uri || "";
}

const ONES = [
  "",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function twoDigitWords(n) {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return o ? `${TENS[t]}-${ONES[o]}` : TENS[t];
}

/** Speak calendar years conversationally: 1789 → "seventeen eighty-nine". */
export function yearToWords(year) {
  const y = Number(year);
  if (!Number.isInteger(y) || y < 1000 || y > 2999) return String(year);

  if (y % 1000 === 0) {
    return `${ONES[Math.floor(y / 1000)]} thousand`;
  }

  // 2001–2009: "two thousand one"
  if (y > 2000 && y < 2010) {
    return `two thousand ${ONES[y % 10]}`;
  }

  // 2010–2099: "twenty ten", "twenty twenty-five"
  if (y >= 2010 && y <= 2099) {
    return `twenty ${twoDigitWords(y % 100)}`;
  }

  // 1900, 1800, etc.: "nineteen hundred"
  if (y % 100 === 0) {
    return `${twoDigitWords(Math.floor(y / 100))} hundred`;
  }

  // 1905 → "nineteen oh five"; 1789 → "seventeen eighty-nine"
  const century = Math.floor(y / 100);
  const rest = y % 100;
  if (rest < 10) {
    return `${twoDigitWords(century)} oh ${ONES[rest]}`;
  }
  return `${twoDigitWords(century)} ${twoDigitWords(rest)}`;
}

function isLikelyYear(num, fullText, index, matched) {
  const n = Number(num);
  if (n < 1492 || n > 2099) return false;

  // Don't rewrite money, big counts, or already-marked tokens.
  const before = fullText.slice(Math.max(0, index - 12), index);
  const after = fullText.slice(index + matched.length, index + matched.length + 12);
  if (/\$\s*$/.test(before)) return false;
  if (/^\s*(million|billion|thousand|dollars|people|votes|electors|troops)/i.test(after)) {
    return false;
  }
  // Ordinals are ranks/dates-of-month style, not years: 16th, 22nd
  if (/^(st|nd|rd|th)\b/i.test(after)) return false;
  return true;
}

function replaceYearsForSpeech(text) {
  // Date ranges first: 1861-1865 / 1861–1865 / 1861 to 1865
  let out = text.replace(
    /\b(1[4-9]\d{2}|20[0-9]\d)\s*(?:–|-|to)\s*(1[4-9]\d{2}|20[0-9]\d|present)\b/gi,
    (_, a, b) => {
      const end = /present/i.test(b) ? "present" : yearToWords(b);
      return `${yearToWords(a)} to ${end}`;
    }
  );

  out = out.replace(/\b(1[4-9]\d{2}|20[0-9]\d)\b/g, (match, _y, offset, whole) => {
    if (!isLikelyYear(match, whole, offset, match)) return match;
    return yearToWords(match);
  });

  return out;
}

function smallNumberToWords(n) {
  const num = Number(n);
  if (!Number.isInteger(num) || num < 0 || num > 99) return String(n);
  return twoDigitWords(num);
}

const SIMPLE_ORDINALS = {
  1: "first",
  2: "second",
  3: "third",
  4: "fourth",
  5: "fifth",
  6: "sixth",
  7: "seventh",
  8: "eighth",
  9: "ninth",
  10: "tenth",
  11: "eleventh",
  12: "twelfth",
  13: "thirteenth",
  14: "fourteenth",
  15: "fifteenth",
  16: "sixteenth",
  17: "seventeenth",
  18: "eighteenth",
  19: "nineteenth",
  20: "twentieth",
  21: "twenty-first",
  22: "twenty-second",
  23: "twenty-third",
  24: "twenty-fourth",
  25: "twenty-fifth",
  26: "twenty-sixth",
  27: "twenty-seventh",
  28: "twenty-eighth",
  29: "twenty-ninth",
  30: "thirtieth",
  31: "thirty-first",
  32: "thirty-second",
  33: "thirty-third",
  34: "thirty-fourth",
  35: "thirty-fifth",
  36: "thirty-sixth",
  37: "thirty-seventh",
  38: "thirty-eighth",
  39: "thirty-ninth",
  40: "fortieth",
  41: "forty-first",
  42: "forty-second",
  43: "forty-third",
  44: "forty-fourth",
  45: "forty-fifth",
  46: "forty-sixth",
  47: "forty-seventh",
};

function ordinalToWords(n) {
  const num = Number(n);
  return SIMPLE_ORDINALS[num] || `${smallNumberToWords(num)}th`;
}

function expandForSpeech(text) {
  let out = text
    .replace(/\bU\.S\./g, "United States")
    .replace(/\bUS\b/g, "United States")
    .replace(/\bVP\b/g, "vice president")
    .replace(/\bVPs\b/g, "vice presidents")
    .replace(/\bWWI\b/g, "World War One")
    .replace(/\bWWII\b/g, "World War Two")
    .replace(/\bMLB\b/g, "Major League Baseball")
    .replace(/\bEPA\b/g, "E P A")
    .replace(/\bCIA\b/g, "C I A")
    .replace(/\bFDR\b/g, "F D R")
    .replace(/\bJFK\b/g, "J F K")
    .replace(/\bLBJ\b/g, "L B J")
    .replace(/\bTR\b/g, "T R")
    .replace(/\bD\.C\./g, "D C")
    .replace(/\$([\d,]+)/g, (_, n) => `${n.replace(/,/g, "")} dollars`)
    // Ranks / amendments: "16th", "22nd Amendment"
    .replace(/\b(\d{1,2})(st|nd|rd|th)\b/gi, (_, n) => ordinalToWords(n))
    // President numbers: "#16" / "number 16"
    .replace(/#(\d{1,2})\b/g, (_, n) => `number ${smallNumberToWords(n)}`)
    .replace(/\bnumber\s+(\d{1,2})\b/gi, (_, n) => `number ${smallNumberToWords(n)}`);

  // Years last so ranges and 4-digit dates become "seventeen eighty-nine"
  out = replaceYearsForSpeech(out);
  return out;
}

/** Expand years/abbreviations for either browser or neural TTS. */
export function prepareSpokenLine(line) {
  return expandForSpeech(line).replace(/\s+/g, " ").trim();
}

/** Break a line into short spoken chunks so pacing feels less robotic. */
function chunkForSpeech(line) {
  const cleaned = prepareSpokenLine(line)
    .replace(/—/g, ". ")
    .replace(/–/g, " to ")
    .replace(/\(([^)]+)\)/g, ", $1,")
    .replace(/;\s*/g, ". ")
    .replace(/:\s*/g, ". ")
    .replace(/\s+/g, " ")
    .trim();

  const parts = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .flatMap((sentence) => {
      // Further split long sentences on commas if needed.
      if (sentence.length < 140) return [sentence];
      return sentence.split(/,\s+/).reduce((acc, piece, idx, arr) => {
        const bit = idx < arr.length - 1 ? `${piece},` : piece;
        if (!acc.length) return [bit];
        const last = acc[acc.length - 1];
        if (last.length + bit.length < 120) {
          acc[acc.length - 1] = `${last} ${bit}`;
        } else {
          acc.push(bit);
        }
        return acc;
      }, []);
    })
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .map((p) => (/[.!?]$/.test(p) ? p : `${p}.`));

  return parts.length ? parts : [cleaned];
}

/** Turn a study fact into something that sounds natural spoken aloud. */
export function toConversationalSpeech(president, fact, factNumber) {
  const isShorthand = /^Pub-trivia shorthand:\s*/i.test(fact.trim());
  let text = fact.trim().replace(/^Pub-trivia shorthand:\s*/i, "");

  text = text
    .replace(/—/g, ", ")
    .replace(/–/g, " to ")
    .replace(/\(([^)]+)\)/g, ", $1,")
    .replace(/\s+/g, " ")
    .replace(/\s,/g, ",")
    .replace(/,\s*,/g, ",")
    .trim();

  if (!/[.!?]$/.test(text)) text += ".";

  const name = president.name;
  const number = president.number;
  const served = president.served.replaceAll("–", " to ").replaceAll("-", " to ");
  const factLabel = `Fact ${factNumber}.`;

  if (isShorthand) {
    return `${factLabel} Quick way to remember ${name}. ${text}`;
  }

  if (factNumber === 1) {
    return `President number ${number}. ${name}. Served ${served}. ${factLabel} ${text}`;
  }

  if (new RegExp(`^(${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}|He|She|His|Her|This)`, "i").test(text)) {
    return `${factLabel} ${text}`;
  }

  if (/^Only |^First |^Last |^Youngest |^Oldest /i.test(text)) {
    return `${factLabel} ${name} was the ${text.charAt(0).toLowerCase()}${text.slice(1)}`;
  }

  if (
    /^(Won |Lost |Signed |Created |Issued |Led |Ordered |Appointed |Defeated |Survived |Passed |Asked |Authorized |Became |Took |Had |Ran |Grew |Suspended |Turned |Married |Appears |Nicknamed |Before |After |During |In )/i.test(
      text
    )
  ) {
    return `${factLabel} ${name}. ${text}`;
  }

  return `${factLabel} ${text}`;
}

let browserSpeakSession = 0;

export function speechSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
}

export function stopSpeech() {
  browserSpeakSession += 1;
  if (!speechSupported()) return;
  // Chromium often needs cancel more than once to fully halt speech.
  window.speechSynthesis.cancel();
  window.speechSynthesis.pause();
  window.speechSynthesis.cancel();
  try {
    window.speechSynthesis.resume();
  } catch {
    /* ignore */
  }
  window.speechSynthesis.cancel();
}

function wait(ms, session) {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(session === browserSpeakSession), ms);
    // If stopped quickly, don't block long; interval check
    const check = setInterval(() => {
      if (session !== browserSpeakSession) {
        clearTimeout(t);
        clearInterval(check);
        resolve(false);
      }
    }, 40);
    setTimeout(() => clearInterval(check), ms + 10);
  });
}

function speakUtterance(text, voice, rate, session) {
  return new Promise((resolve, reject) => {
    if (session !== browserSpeakSession) {
      resolve(false);
      return;
    }
    const utter = new SpeechSynthesisUtterance(text);
    if (voice) utter.voice = voice;
    utter.rate = rate;
    utter.pitch = 1.04;
    utter.volume = 1;
    utter.lang = voice?.lang || "en-US";
    utter.onend = () => resolve(session === browserSpeakSession);
    utter.onerror = (event) => {
      if (
        event.error === "interrupted" ||
        event.error === "canceled" ||
        session !== browserSpeakSession
      ) {
        resolve(false);
      } else {
        reject(new Error(event.error || "Speech failed"));
      }
    };
    window.speechSynthesis.speak(utter);
  });
}

/**
 * Speak one or more lines with natural chunking/pauses.
 * @param {string[]} lines
 * @param {{ rate?: number, voiceUri?: string, loops?: number, loopPadMs?: number, onStartLine?: (i:number)=>void, onLoopStart?: (loop:number, total:number)=>void, onStatus?: (msg:string)=>void, onEnd?: ()=>void }} [opts]
 */
export async function speakLines(lines, opts = {}) {
  if (!speechSupported()) {
    throw new Error("Speech is not supported in this browser.");
  }
  stopSpeech();
  const session = browserSpeakSession;

  const voice = await resolveVoice(opts.voiceUri || getSavedVoiceUri());
  if (session !== browserSpeakSession) {
    opts.onEnd?.();
    return;
  }
  const rate = opts.rate ?? getSavedRate();
  const loops = Math.max(1, Math.min(20, Number(opts.loops) || 1));
  const loopPadMs = opts.loopPadMs ?? 7000;

  if (window.speechSynthesis.paused) window.speechSynthesis.resume();

  try {
    for (let loop = 0; loop < loops; loop += 1) {
      if (session !== browserSpeakSession) break;

      if (loop > 0) {
        opts.onStatus?.(
          `Loop ${loop} finished. Waiting 7 seconds before loop ${loop + 1} of ${loops}…`
        );
        const ok = await wait(loopPadMs, session);
        if (!ok) break;
      }

      opts.onLoopStart?.(loop, loops);
      if (loops > 1) {
        opts.onStatus?.(`Playing loop ${loop + 1} of ${loops}…`);
      }

      for (let i = 0; i < lines.length; i += 1) {
        if (session !== browserSpeakSession) break;
        opts.onStartLine?.(i);
        const chunks = chunkForSpeech(lines[i]);
        for (let c = 0; c < chunks.length; c += 1) {
          if (session !== browserSpeakSession) break;
          const keepGoing = await speakUtterance(chunks[c], voice, rate, session);
          if (!keepGoing || session !== browserSpeakSession) break;
          if (c < chunks.length - 1) {
            const ok = await wait(140, session);
            if (!ok) break;
          }
        }
        if (session !== browserSpeakSession) break;
        if (i < lines.length - 1) {
          const ok = await wait(320, session);
          if (!ok) break;
        }
      }
    }
  } finally {
    opts.onEnd?.();
  }
}

export function voiceQualityTip(rankedVoices) {
  const best = rankedVoices[0];
  if (!best) {
    return "No English voices found. Download voices in macOS System Settings → Accessibility → Spoken Content.";
  }
  const daniel = rankedVoices.find((v) => /\bdaniel\b/i.test(v.name));
  if (daniel) {
    return `Default voice is Daniel. Extra loops replay the section with a 7-second pause between passes.`;
  }
  return `Using “${best.name}”. Extra loops replay the section with a 7-second pause between passes.`;
}
