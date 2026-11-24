/**
 * Pre-recorded Kokoro voice clips ("Heart"). Clips are generated offline by
 * scripts/kokoro/generate-clips.mjs, one MP3 per spoken chunk, named by a
 * hash of the voice and the exact chunk text. The browser only plays files;
 * it never runs the model.
 */

export const KOKORO_VOICE_URI = "kokoro:af_heart";
export const KOKORO_VOICE_LABEL = "Heart (natural voice)";
const KOKORO_VOICE_ID = "af_heart";
const CLIP_DIR = `data/audio/kokoro/${KOKORO_VOICE_ID}`;

/** cyrb53: small, fast, deterministic string hash (same in Node and browser). */
function cyrb53(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i += 1) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (2097152 * (h2 >>> 0) + (h1 >>> 0)).toString(16).padStart(14, "0");
}

/** File key for one spoken chunk. */
export function kokoroClipKey(text, voiceId = KOKORO_VOICE_ID) {
  return cyrb53(`${voiceId}\n${String(text)}`);
}

export function kokoroClipUrl(text) {
  return `${CLIP_DIR}/${kokoroClipKey(text)}.mp3`;
}

let manifest = null; // Set of clip keys
let manifestLoading = null;

/** Load the list of recorded clips (cheap; safe to call often). */
export function loadKokoroManifest() {
  if (manifest) return Promise.resolve(manifest);
  if (manifestLoading) return manifestLoading;
  manifestLoading = fetch(`${CLIP_DIR}/manifest.json`, { cache: "no-cache" })
    .then((r) => (r.ok ? r.json() : { keys: [] }))
    .catch(() => ({ keys: [] }))
    .then((data) => {
      manifest = new Set(Array.isArray(data?.keys) ? data.keys : []);
      return manifest;
    })
    .finally(() => {
      manifestLoading = null;
    });
  return manifestLoading;
}

/** true/false once the manifest is loaded; null if it has not loaded yet. */
export function kokoroHasAllClipsNow(chunks) {
  if (!manifest) return null;
  return chunks.length > 0 && chunks.every((c) => manifest.has(kokoroClipKey(c)));
}

export async function kokoroHasAllClips(chunks) {
  await loadKokoroManifest();
  return kokoroHasAllClipsNow(chunks);
}

/* Fetch-ahead so the next clip is ready the moment the current one ends. */
const prefetched = new Map(); // url -> Promise<Blob|null>

export function prefetchKokoroClip(text) {
  const url = kokoroClipUrl(text);
  if (!prefetched.has(url)) {
    prefetched.set(
      url,
      fetch(url)
        .then((r) => (r.ok ? r.blob() : null))
        .catch(() => null)
    );
    if (prefetched.size > 12) prefetched.delete(prefetched.keys().next().value);
  }
  return prefetched.get(url);
}

export async function kokoroClipBlob(text) {
  const url = kokoroClipUrl(text);
  const blob = await prefetchKokoroClip(text);
  prefetched.delete(url);
  return blob;
}
