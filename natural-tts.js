/** In-browser Piper TTS (Natural voice). Model downloads once, then OPFS cache. */

export const NATURAL_VOICE_URI = "natural";
const MODEL_ID = "en_US-hfc_male-medium";

let audioEl = null;
let audioCtx = null;
let objectUrl = null;
let playToken = 0;
let playResolve = null;
let modelReady = false;
let modelLoading = null;

function getAudio() {
  if (!audioEl) {
    audioEl = new Audio();
    audioEl.preload = "auto";
    audioEl.setAttribute("playsinline", "");
    audioEl.setAttribute("webkit-playsinline", "");
  }
  return audioEl;
}

function silentWavUrl() {
  const sampleRate = 8000;
  const numSamples = 8;
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

/** Call from a Listen tap before any await so iOS allows later audio.play(). */
export function unlockNaturalAudio() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) {
      if (!audioCtx) audioCtx = new AC();
      if (audioCtx.state === "suspended") void audioCtx.resume();
    }
  } catch {
    /* ignore */
  }
  const el = getAudio();
  const url = silentWavUrl();
  el.src = url;
  el.volume = 0.01;
  el.playbackRate = 1;
  const played = el.play();
  if (played && typeof played.catch === "function") {
    played.catch(() => {});
  }
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function stopNaturalAudio() {
  playToken += 1;
  try {
    audioEl?.pause();
  } catch {
    /* ignore */
  }
  if (audioEl) {
    try {
      audioEl.removeAttribute("src");
      audioEl.load();
    } catch {
      /* ignore */
    }
  }
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
    objectUrl = null;
  }
  if (playResolve) {
    const done = playResolve;
    playResolve = null;
    done(false);
  }
}

function friendlyError(err) {
  const msg = String(err?.message || err || "");
  if (/memory|oom|allocation|wasm/i.test(msg)) {
    return "Natural voice couldn’t run on this device. Try Daniel or On-device voice.";
  }
  if (/download|fetch|network|failed to fetch|status/i.test(msg)) {
    return "Couldn’t download the natural voice. Check your connection and try again.";
  }
  return "Natural voice couldn’t run on this device. Try Daniel or On-device voice.";
}

export async function ensureNaturalModel(onStatus) {
  if (modelReady) return;
  if (modelLoading) return modelLoading;
  modelLoading = (async () => {
    try {
      const { download, stored } = await import("./vendor/vits-web.js");
      let cached = false;
      try {
        cached = (await stored()).includes(MODEL_ID);
      } catch {
        cached = false;
      }
      if (!cached) {
        onStatus?.("Downloading natural voice…");
        await download(MODEL_ID, (prog) => {
          const total = Number(prog?.total) || 0;
          const loaded = Number(prog?.loaded) || 0;
          if (total > 0) {
            const pct = Math.min(99, Math.round((loaded / total) * 100));
            onStatus?.(`Downloading natural voice… ${pct}%`);
          } else if (loaded > 0) {
            const mb = Math.max(1, Math.round(loaded / 1048576));
            onStatus?.(`Downloading natural voice… ${mb} MB`);
          } else {
            onStatus?.("Downloading natural voice…");
          }
        });
      }
      onStatus?.("Preparing natural voice…");
      modelReady = true;
    } catch (err) {
      modelReady = false;
      throw new Error(friendlyError(err));
    }
  })().finally(() => {
    modelLoading = null;
  });
  return modelLoading;
}

function playBlob(blob, rate, shouldContinue) {
  return new Promise((resolve) => {
    if (!shouldContinue()) {
      resolve(false);
      return;
    }
    if (playResolve) {
      const prev = playResolve;
      playResolve = null;
      prev(false);
    }
    const token = playToken;
    playResolve = resolve;
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
    objectUrl = URL.createObjectURL(blob);
    const el = getAudio();
    const finish = (ok) => {
      if (playResolve !== resolve) return;
      playResolve = null;
      el.onended = null;
      el.onerror = null;
      resolve(Boolean(ok) && token === playToken && shouldContinue());
    };
    el.onended = () => finish(true);
    el.onerror = () => finish(false);
    el.src = objectUrl;
    el.volume = 1;
    el.playbackRate = Number.isFinite(rate) && rate > 0 ? rate : 1;
    const played = el.play();
    if (played && typeof played.catch === "function") {
      played.catch(() => finish(false));
    }
  });
}

export async function speakNaturalText(text, { rate = 1, shouldContinue, onStatus } = {}) {
  const spoken = String(text || "").trim();
  if (!spoken) return shouldContinue ? shouldContinue() : true;
  if (shouldContinue && !shouldContinue()) return false;
  try {
    await ensureNaturalModel(onStatus);
    if (shouldContinue && !shouldContinue()) return false;
    const { predict } = await import("./vendor/vits-web.js");
    const blob = await predict({ text: spoken, voiceId: MODEL_ID });
    if (shouldContinue && !shouldContinue()) return false;
    return playBlob(blob, rate, () => !shouldContinue || shouldContinue());
  } catch (err) {
    throw new Error(friendlyError(err));
  }
}
