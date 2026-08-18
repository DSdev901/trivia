/** Browser text-to-speech helpers for conversational study readouts. */

import {
  NATURAL_VOICE_URI,
  stopNaturalAudio,
  unlockNaturalAudio,
  speakNaturalText,
} from "./natural-tts.js";

const VOICE_KEY = "trivia-helper-voice-uri";
const RATE_KEY = "trivia-helper-voice-rate";
const LOOP_KEY = "trivia-helper-fact-loops";
const DANIEL_DEFAULT_FLAG = "trivia-helper-default-daniel-v1";
export const ON_DEVICE_VOICE_URI = "on-device";
export { NATURAL_VOICE_URI };

let voicesReady = null;
let cachedVoices = [];

function snapshotVoices() {
  const live = window.speechSynthesis?.getVoices?.() ?? [];
  if (live.length) cachedVoices = live;
  return live.length ? live : cachedVoices;
}

function loadVoices() {
  const grab = () => snapshotVoices();
  const existing = grab();
  if (existing.length) {
    voicesReady = Promise.resolve(existing);
    return voicesReady;
  }
  if (voicesReady) return voicesReady;
  voicesReady = new Promise((resolve) => {
    const onVoices = () => {
      const list = grab();
      if (!list.length) return;
      window.speechSynthesis.removeEventListener("voiceschanged", onVoices);
      resolve(list);
    };
    window.speechSynthesis?.addEventListener?.("voiceschanged", onVoices);
    setTimeout(() => {
      window.speechSynthesis.removeEventListener("voiceschanged", onVoices);
      resolve(grab());
    }, 1500);
  }).then((list) => {
    if (!list.length) voicesReady = null;
    return list;
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

function rankedEnglishNow() {
  return snapshotVoices()
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

export async function listEnglishVoices() {
  await loadVoices();
  return rankedEnglishNow();
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

function voiceLabel(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function matchRankedVoice(ranked, preferredUri) {
  if (!preferredUri || !ranked.length) return null;
  const exact = ranked.find((v) => v.uri === preferredUri);
  if (exact) return exact;
  if (/\bdaniel\b/i.test(preferredUri)) return findDaniel(ranked);
  const want = voiceLabel(preferredUri);
  return ranked.find((v) => voiceLabel(v.name) === want) || null;
}

function systemDefaultVoice() {
  const all = snapshotVoices().filter(isEnglish);
  // Keep On-device distinct from the app’s Daniel default.
  const pool = all.filter((v) => !/\bdaniel\b/i.test(v.name));
  const candidates = pool.length ? pool : all;
  if (!candidates.length) return null;
  const flagged = candidates.filter((v) => v.default);
  const navLang = String(navigator.language || "en-US").replace("_", "-").toLowerCase();
  const navBase = navLang.slice(0, 2);
  return (
    flagged.find((v) => String(v.lang || "").replace("_", "-").toLowerCase().startsWith(navLang)) ||
    flagged.find((v) => String(v.lang || "").toLowerCase().startsWith(navBase)) ||
    flagged[0] ||
    candidates.find((v) => v.localService) ||
    candidates[0]
  );
}

function listedVoiceOrDefault(ranked, preferredUri) {
  if (preferredUri === NATURAL_VOICE_URI) return null;
  if (preferredUri === ON_DEVICE_VOICE_URI) return systemDefaultVoice();
  if (!ranked.length) return null;
  return (matchRankedVoice(ranked, preferredUri) || findDaniel(ranked) || ranked[0]).voice;
}

function pickVoiceNow(preferredUri) {
  return listedVoiceOrDefault(rankedEnglishNow(), preferredUri);
}

async function resolveVoice(preferredUri) {
  return listedVoiceOrDefault(await listEnglishVoices(), preferredUri);
}

function pickListedFallbackVoice(failedVoice) {
  const ranked = rankedEnglishNow();
  const failedUri = failedVoice?.voiceURI;
  const usable = ranked.filter((v) => {
    if (v.uri === failedUri) return false;
    if (/premium|enhanced|neural|superstar|siri/i.test(v.name)) return false;
    return true;
  });
  return (usable.find((v) => v.local) || usable[0])?.voice || null;
}

/** Default system voice URI — Daniel when available. */
export async function getDefaultBrowserVoiceUri() {
  const ranked = await listEnglishVoices();
  const daniel = findDaniel(ranked);
  try {
    if (!isIOSWebKit() && daniel && !localStorage.getItem(DANIEL_DEFAULT_FLAG)) {
      localStorage.setItem(VOICE_KEY, daniel.uri);
      localStorage.setItem(DANIEL_DEFAULT_FLAG, "1");
    }
  } catch {
    /* ignore */
  }
  return (daniel || ranked[0])?.uri || "";
}

export function isUsableVoiceUri(ranked, uri) {
  if (!uri) return false;
  if (uri === ON_DEVICE_VOICE_URI || uri === NATURAL_VOICE_URI) return true;
  return ranked.some((v) => v.uri === uri);
}

function escapeOption(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

/** Daniel first (default), then Natural, then the device’s system voice, then the rest. */
export function voiceSelectOptionsHtml(ranked, selectedUri) {
  const daniel = findDaniel(ranked);
  const others = ranked.filter((v) => v !== daniel);
  const choices = [];
  if (daniel) {
    choices.push({ uri: daniel.uri, label: `${daniel.name} (default)` });
  }
  choices.push({
    uri: NATURAL_VOICE_URI,
    label: "Natural voice (requires brief load time on first use)",
  });
  choices.push({
    uri: ON_DEVICE_VOICE_URI,
    label: "On-device voice",
  });
  for (const v of others) {
    choices.push({ uri: v.uri, label: v.name });
  }
  if (!choices.length) return `<option>No voices found</option>`;
  return choices
    .map((c) => {
      const selected = c.uri === selectedUri ? " selected" : "";
      return `<option value="${escapeOption(c.uri)}"${selected}>${escapeOption(c.label)}</option>`;
    })
    .join("");
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
    .replace(/\bMCU\b/g, "Marvel Cinematic Universe")
    .replace(/\bIMF\b/g, "I M F")
    .replace(/\bA24\b/g, "A twenty-four")
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

/** Read a film pub-quiz item as question, then answer. */
export function toMovieQuestionSpeech(item, questionNumber) {
  const n = Number(questionNumber) || 1;
  let question = String(item.question || "")
    .trim()
    .replace(/—/g, ", ")
    .replace(/–/g, " to ")
    .replace(/\s+/g, " ");
  if (question && !/[?!.]$/.test(question)) question += "?";

  const answer = String(item.answer || "")
    .trim()
    .replace(/—/g, ", ")
    .replace(/\bMjolnir\b/g, "Meeol-neer");

  let line = `Question ${n}. ${question} The answer is ${answer}.`;
  const note = String(item.note || "")
    .trim()
    .replace(/—/g, ", ")
    .replace(/–/g, " to ");
  if (note) {
    const extra = /[.!?]$/.test(note) ? note : `${note}.`;
    line += ` ${extra}`;
  }
  return line;
}

let browserSpeakSession = 0;
let wakeLockSentinel = null;
let speechKeepaliveActive = false;
let speechKeepaliveOwner = 0;
let naturalPlaybackActive = false;
let keepaliveAudio = null;
let keepaliveAudioUrl = null;
let keepaliveAudioContext = null;
let keepaliveBufferSource = null;

function isIOSWebKit() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  // iPadOS desktop UA
  return navigator.platform === "MacIntel" && (navigator.maxTouchPoints || 0) > 1;
}

function wakeLockSupported() {
  return typeof navigator !== "undefined" && "wakeLock" in navigator;
}

function synthIsBusy() {
  try {
    return Boolean(window.speechSynthesis?.speaking || window.speechSynthesis?.pending);
  } catch {
    return false;
  }
}

/**
 * WebKit (Safari / Brave / Chrome on iOS) only starts TTS inside a user
 * gesture. Call this synchronously from Listen taps before any await.
 * Do not queue a dummy utterance — a space-only speak can stall iOS forever.
 */
export function unlockSpeech() {
  if (getSavedVoiceUri() === NATURAL_VOICE_URI) {
    unlockNaturalAudio();
    return;
  }
  if (!speechSupported()) return;
  try {
    window.speechSynthesis.resume();
  } catch {
    /* ignore */
  }
  if (isIOSWebKit()) return;
  try {
    const warm = new SpeechSynthesisUtterance(".");
    warm.volume = 0.01;
    warm.rate = 1;
    warm.pitch = 1;
    window.speechSynthesis.speak(warm);
  } catch {
    /* ignore */
  }
}

/** Tiny silent WAV so the OS treats us as active media while speaking. */
function silentWavObjectUrl(seconds = 2) {
  const sampleRate = 8000;
  const numSamples = Math.max(1, Math.floor(sampleRate * seconds));
  const dataSize = numSamples * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeStr = (offset, str) => {
    for (let i = 0; i < str.length; i += 1) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);
  return URL.createObjectURL(new Blob([buffer], { type: "audio/wav" }));
}

function setMediaSessionPlaying(playing) {
  if (!navigator.mediaSession) return;
  try {
    navigator.mediaSession.playbackState = playing ? "playing" : "none";
    if (playing) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: "General Trivia",
        artist: "Reading aloud",
        album: "Study",
      });
    }
  } catch {
    /* ignore */
  }
}

function startWebAudioKeepalive() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  try {
    if (!keepaliveAudioContext) keepaliveAudioContext = new AC();
    if (keepaliveAudioContext.state === "suspended") {
      void keepaliveAudioContext.resume();
    }
    stopWebAudioKeepalive();
    const buffer = keepaliveAudioContext.createBuffer(
      1,
      keepaliveAudioContext.sampleRate,
      keepaliveAudioContext.sampleRate
    );
    const source = keepaliveAudioContext.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = keepaliveAudioContext.createGain();
    // Non-zero so some mobile browsers keep the audio session alive.
    gain.gain.value = 0.0001;
    source.connect(gain);
    gain.connect(keepaliveAudioContext.destination);
    source.start();
    keepaliveBufferSource = source;
  } catch {
    /* ignore */
  }
}

function stopWebAudioKeepalive() {
  try {
    keepaliveBufferSource?.stop();
  } catch {
    /* ignore */
  }
  keepaliveBufferSource = null;
}

async function startPlaybackKeepalive() {
  setMediaSessionPlaying(true);
  // Silent HTML/Web Audio fights speechSynthesis on iOS (Brave/Safari).
  if (isIOSWebKit()) return;
  try {
    if (!keepaliveAudio) {
      keepaliveAudioUrl = silentWavObjectUrl(2);
      keepaliveAudio = new Audio(keepaliveAudioUrl);
      keepaliveAudio.loop = true;
      keepaliveAudio.preload = "auto";
      // Near-silent; volume 0 is ignored as "not playing" on some phones.
      keepaliveAudio.volume = 0.001;
    }
    keepaliveAudio.currentTime = 0;
    await keepaliveAudio.play();
  } catch {
    /* Autoplay / policy — fall through to Web Audio. */
  }
  startWebAudioKeepalive();
}

function stopPlaybackKeepalive() {
  try {
    keepaliveAudio?.pause();
    if (keepaliveAudio) keepaliveAudio.currentTime = 0;
  } catch {
    /* ignore */
  }
  stopWebAudioKeepalive();
  setMediaSessionPlaying(false);
}

async function ensureKeepalivePlaying() {
  if (!speechKeepaliveActive) return;
  if (naturalPlaybackActive) {
    setMediaSessionPlaying(true);
    return;
  }
  try {
    if (window.speechSynthesis?.paused) window.speechSynthesis.resume();
  } catch {
    /* ignore */
  }
  if (isIOSWebKit()) {
    setMediaSessionPlaying(true);
    return;
  }
  try {
    if (keepaliveAudioContext?.state === "suspended") {
      await keepaliveAudioContext.resume();
    }
  } catch {
    /* ignore */
  }
  try {
    if (keepaliveAudio?.paused) await keepaliveAudio.play();
  } catch {
    /* ignore */
  }
  if (!keepaliveBufferSource) startWebAudioKeepalive();
  setMediaSessionPlaying(true);
}

/** Keep the screen awake while facts are spoken (phones especially). */
async function acquireWakeLock(owner) {
  if (!wakeLockSupported()) return;
  speechKeepaliveOwner = owner;
  try {
    if (wakeLockSentinel && !wakeLockSentinel.released) return;
    wakeLockSentinel = await navigator.wakeLock.request("screen");
    wakeLockSentinel.addEventListener("release", () => {
      if (wakeLockSentinel?.released) wakeLockSentinel = null;
    });
  } catch {
    /* Denied, low power, or unsupported context — speech still works. */
  }
}

async function releaseWakeLock(owner = null) {
  if (owner != null && owner !== speechKeepaliveOwner) return;
  const lock = wakeLockSentinel;
  wakeLockSentinel = null;
  if (!lock || lock.released) return;
  try {
    await lock.release();
  } catch {
    /* ignore */
  }
}

async function beginSpeechKeepalive(owner) {
  speechKeepaliveActive = true;
  speechKeepaliveOwner = owner;
  await startPlaybackKeepalive();
  await acquireWakeLock(owner);
}

async function endSpeechKeepalive(owner = null) {
  if (owner != null && owner !== speechKeepaliveOwner) return;
  speechKeepaliveActive = false;
  speechKeepaliveOwner = 0;
  stopPlaybackKeepalive();
  await releaseWakeLock();
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (!speechKeepaliveActive) return;
    if (document.visibilityState === "visible") {
      void acquireWakeLock(speechKeepaliveOwner || browserSpeakSession);
      void ensureKeepalivePlaying();
    } else {
      // Manual lock / app switch: try to keep TTS + media session alive.
      void ensureKeepalivePlaying();
    }
  });
  document.addEventListener("freeze", () => {
    if (speechKeepaliveActive) void ensureKeepalivePlaying();
  });
  document.addEventListener("resume", () => {
    if (speechKeepaliveActive) void ensureKeepalivePlaying();
  });
}

export function speechSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
}

export function stopSpeech() {
  browserSpeakSession += 1;
  naturalPlaybackActive = false;
  stopNaturalAudio();
  void endSpeechKeepalive();
  if (!speechSupported()) return;
  const synth = window.speechSynthesis;
  // cancel() while idle, or pause(), can leave iOS unable to speak until reload.
  if (isIOSWebKit()) {
    try {
      if (synthIsBusy()) synth.cancel();
    } catch {
      /* ignore */
    }
    try {
      synth.resume();
    } catch {
      /* ignore */
    }
    return;
  }
  synth.cancel();
  // Chromium often needs cancel more than once to fully halt speech.
  synth.pause();
  synth.cancel();
  try {
    synth.resume();
  } catch {
    /* ignore */
  }
  synth.cancel();
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

function speakUtterance(text, voice, rate, session, { allowVoice = true, triedFallback = false } = {}) {
  return new Promise((resolve, reject) => {
    if (session !== browserSpeakSession) {
      resolve(false);
      return;
    }
    const utter = new SpeechSynthesisUtterance(text);
    const resolvedFromSystem = Boolean(allowVoice && !voice);
    let voiceToUse = voice;
    if (resolvedFromSystem) voiceToUse = systemDefaultVoice();
    if (allowVoice && voiceToUse) {
      utter.voice = voiceToUse;
      const followDevice = resolvedFromSystem || Boolean(voiceToUse.default);
      if (voiceToUse.lang && (!isIOSWebKit() || followDevice)) {
        utter.lang = voiceToUse.lang;
      }
    } else if (isIOSWebKit()) {
      // Unset voice on iOS reuses the last spoken voice (often Daniel).
      utter.lang = String(navigator.language || "en-US").replace("_", "-");
    }
    utter.rate = rate;
    utter.pitch = 1;
    utter.volume = 1;
    let settled = false;
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      clearInterval(watchdog);
      clearTimeout(safety);
      resolve(ok);
    };
    utter.onend = () => finish(session === browserSpeakSession);
    utter.onerror = (event) => {
      const err = event.error || "";
      if (
        allowVoice &&
        voice &&
        isIOSWebKit() &&
        session === browserSpeakSession &&
        err !== "interrupted" &&
        err !== "canceled"
      ) {
        settled = true;
        clearInterval(watchdog);
        clearTimeout(safety);
        const fallback = triedFallback ? null : pickListedFallbackVoice(voice);
        speakUtterance(text, fallback || voice, rate, session, {
          allowVoice: Boolean(fallback),
          triedFallback: true,
        }).then(resolve, reject);
        return;
      }
      if (
        err === "interrupted" ||
        err === "canceled" ||
        err === "not-allowed" ||
        session !== browserSpeakSession
      ) {
        finish(false);
      } else {
        settled = true;
        clearInterval(watchdog);
        clearTimeout(safety);
        reject(new Error(err || "Speech failed"));
      }
    };
    try {
      if (window.speechSynthesis.paused) window.speechSynthesis.resume();
      window.speechSynthesis.speak(utter);
      if (window.speechSynthesis.paused) window.speechSynthesis.resume();
    } catch (err) {
      finish(false);
      return;
    }
    // iOS pauses speechSynthesis after ~15s; only resume when actually paused.
    const watchdog = setInterval(() => {
      if (session !== browserSpeakSession) {
        finish(false);
        return;
      }
      try {
        if (window.speechSynthesis.paused) window.speechSynthesis.resume();
      } catch {
        /* ignore */
      }
    }, 4000);
    // onend sometimes never fires on WebKit.
    const ms = Math.min(60000, Math.max(2500, String(text).length * (90 / Math.max(0.5, rate))));
    const safety = setTimeout(() => finish(session === browserSpeakSession), ms);
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
  const preferred = opts.voiceUri || getSavedVoiceUri();
  const usingNatural = preferred === NATURAL_VOICE_URI;
  // Must run in the same tap as Listen — Brave/Safari iOS drop audio after await.
  if (usingNatural) unlockNaturalAudio();
  else unlockSpeech();

  naturalPlaybackActive = usingNatural;
  if (isIOSWebKit() || usingNatural) {
    speechKeepaliveActive = true;
    speechKeepaliveOwner = session;
    void acquireWakeLock(session);
    if (usingNatural) setMediaSessionPlaying(true);
  } else {
    void beginSpeechKeepalive(session);
  }

  const rate = opts.rate ?? getSavedRate();
  const loops = Math.max(1, Math.min(20, Number(opts.loops) || 1));
  const loopPadMs = opts.loopPadMs ?? 7000;
  const stillThis = () => session === browserSpeakSession;

  if (!usingNatural && window.speechSynthesis.paused) window.speechSynthesis.resume();

  const speakChunk = usingNatural
    ? (text) =>
        speakNaturalText(text, {
          rate,
          shouldContinue: stillThis,
          onStatus: opts.onStatus,
        })
    : (text, voice) => speakUtterance(text, voice, rate, session);

  let voice = null;
  if (!usingNatural) {
    voice = isIOSWebKit() ? pickVoiceNow(preferred) : await resolveVoice(preferred);
    if (!stillThis()) {
      opts.onEnd?.();
      return;
    }
  }

  try {
    for (let loop = 0; loop < loops; loop += 1) {
      if (!stillThis()) break;

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
        if (!stillThis()) break;
        opts.onStartLine?.(i);
        const chunks = chunkForSpeech(lines[i]);
        for (let c = 0; c < chunks.length; c += 1) {
          if (!stillThis()) break;
          const backgrounded =
            typeof document !== "undefined" && document.visibilityState === "hidden";
          if (backgrounded) {
            void ensureKeepalivePlaying();
          }
          const keepGoing = await speakChunk(chunks[c], voice);
          if (!keepGoing || !stillThis()) break;
          if (c < chunks.length - 1) {
            const gap = backgrounded ? 40 : 140;
            const ok = await wait(gap, session);
            if (!ok) break;
          }
        }
        if (!stillThis()) break;
        if (i < lines.length - 1) {
          const backgrounded =
            typeof document !== "undefined" && document.visibilityState === "hidden";
          const gap = backgrounded ? 60 : 320;
          const ok = await wait(gap, session);
          if (!ok) break;
        }
      }
    }
  } finally {
    if (usingNatural) naturalPlaybackActive = false;
    opts.onEnd?.();
    await endSpeechKeepalive(session);
    if (usingNatural) stopNaturalAudio();
  }
}

export function voiceQualityTip(rankedVoices) {
  if (getSavedVoiceUri() === NATURAL_VOICE_URI) {
    return isIOSWebKit()
      ? "Natural voice requires a brief load time the first time you Listen. Turn the silent switch off and use the volume buttons."
      : "Natural voice requires a brief load time the first time you Listen, then it stays in this browser.";
  }
  if (isIOSWebKit()) {
    return "On iPhone, turn the silent switch off and use the media volume buttons. If Brave stays quiet, try Safari.";
  }
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
