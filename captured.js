/** Captured trivia photos stored on the Postgres API. */

const PIN_KEY = "trivia.uploadPin";
const API_KEY = "trivia.apiBase";
const blobUrls = new Set();

const cap = {
  root: null,
  items: [],
  notice: "",
  error: "",
  uploading: false,
  selectedId: null,
  configured: false,
};

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function revokeBlobs() {
  for (const url of blobUrls) URL.revokeObjectURL(url);
  blobUrls.clear();
}

function savedPin() {
  return localStorage.getItem(PIN_KEY) || "";
}

function savedApiBase() {
  return (localStorage.getItem(API_KEY) || "").replace(/\/$/, "");
}

async function configuredBase() {
  const fromStorage = savedApiBase();
  if (fromStorage) return fromStorage;
  try {
    const res = await fetch("data/api.json");
    if (res.ok) {
      const cfg = await res.json();
      if (cfg.baseUrl) return String(cfg.baseUrl).replace(/\/$/, "");
    }
  } catch {
    /* use same origin */
  }
  return "";
}

function apiHeaders(extra = {}) {
  const pin = savedPin();
  return {
    ...(pin ? { "X-Trivia-Pin": pin } : {}),
    ...extra,
  };
}

async function apiFetch(base, path, options = {}) {
  const { json, headers, ...rest } = options;
  const res = await fetch(`${base}${path}`, {
    ...rest,
    headers: {
      ...apiHeaders(headers || {}),
      ...(json ? { "Content-Type": "application/json" } : {}),
    },
    body: json ? JSON.stringify(json) : rest.body,
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (data.error) message = data.error;
    } catch {
      /* keep status message */
    }
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  const type = res.headers.get("content-type") || "";
  if (type.includes("application/json")) return res.json();
  return res;
}

async function loadImageUrl(base, id, size) {
  const qs = size === "thumb" ? "?size=thumb" : "";
  const res = await apiFetch(base, `/api/photos/${id}${qs}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  blobUrls.add(url);
  return url;
}

function fmtWhen(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function settingsHtml(base) {
  return `
    <details class="cap-settings">
      <summary>API connection</summary>
      <p class="lede">GitHub Pages talks to the Railway (or local) Express API. The PIN is not stored in the repo.</p>
      <form id="cap-settings-form" class="cap-form">
        <label class="voice-field">
          <span>API URL</span>
          <input type="url" id="cap-api-url" placeholder="http://localhost:8787" value="${escapeHtml(
            savedApiBase() || base
          )}" />
        </label>
        <label class="voice-field">
          <span>Upload PIN</span>
          <input type="password" id="cap-pin" autocomplete="current-password" value="${escapeHtml(
            savedPin()
          )}" />
        </label>
        <div class="setup-actions">
          <button type="submit" class="secondary-btn">Save connection</button>
        </div>
      </form>
    </details>`;
}

function cardHtml(item) {
  return `
    <button type="button" class="cap-card" data-id="${escapeHtml(item.id)}">
      ${
        item.thumbUrl
          ? `<img class="cap-thumb" src="${escapeHtml(item.thumbUrl)}" alt="" />`
          : `<div class="cap-thumb cap-thumb-empty" aria-hidden="true"></div>`
      }
      <span class="cap-card-meta">
        <span class="cap-card-date">${escapeHtml(fmtWhen(item.created_at))}</span>
        ${item.note ? `<span class="cap-card-note">${escapeHtml(item.note)}</span>` : ""}
      </span>
    </button>`;
}

function detailHtml(item) {
  if (!item) return "";
  return `
    <section class="cap-detail">
      <img class="cap-full" src="${escapeHtml(item.fullUrl || item.thumbUrl || "")}" alt="Original photo" />
      <form id="cap-note-form" class="cap-form">
        <label class="voice-field">
          <span>Note</span>
          <textarea id="cap-note" rows="3" maxlength="2000" placeholder="Question, answer, or where this card is from">${escapeHtml(
            item.note || ""
          )}</textarea>
        </label>
        ${
          item.extracted_text
            ? `<p class="lede"><strong>Extracted text</strong> ${escapeHtml(item.extracted_text)}</p>`
            : `<p class="lede">Text parsing from photos is not wired up yet. The original image is stored in Postgres.</p>`
        }
        <div class="setup-actions">
          <button type="submit" class="primary-btn">Save note</button>
          <button type="button" class="secondary-btn" id="cap-close">Back to grid</button>
          <button type="button" class="text-btn" id="cap-delete">Delete photo</button>
        </div>
      </form>
    </section>`;
}

function render() {
  if (!cap.root) return;
  const selected = cap.items.find((i) => i.id === cap.selectedId) || null;
  cap.root.innerHTML = `
    <div class="cap-head">
      <div>
        <h2 class="section-title">Captured</h2>
        <p class="lede">Photos of trivia questions and answers. Compressed copies are stored in Postgres so you can reopen the original here.</p>
      </div>
    </div>
    ${settingsHtml(cap.base || "")}
    ${cap.error ? `<p class="error">${escapeHtml(cap.error)}</p>` : ""}
    ${cap.notice ? `<p class="ce-notice">${escapeHtml(cap.notice)}</p>` : ""}
    ${
      selected
        ? detailHtml(selected)
        : `
    <form id="cap-upload" class="cap-upload">
      <label class="cap-file">
        <span>Add a photo</span>
        <input id="cap-file" type="file" accept="image/*" capture="environment" ${
          cap.uploading ? "disabled" : ""
        } />
      </label>
      <label class="voice-field">
        <span>Note (optional)</span>
        <input type="text" id="cap-upload-note" maxlength="2000" placeholder="e.g. Jeopardy board — sports" />
      </label>
      <button type="submit" class="primary-btn" ${cap.uploading ? "disabled" : ""}>${
          cap.uploading ? "Uploading…" : "Upload"
        }</button>
    </form>
    ${
      cap.items.length
        ? `<div class="cap-grid">${cap.items.map(cardHtml).join("")}</div>`
        : `<p class="lede">No photos yet.</p>`
    }`
    }
  `;
  bind();
}

function bind() {
  document.getElementById("cap-settings-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const url = document.getElementById("cap-api-url")?.value.trim() || "";
    const pin = document.getElementById("cap-pin")?.value || "";
    if (url) localStorage.setItem(API_KEY, url.replace(/\/$/, ""));
    else localStorage.removeItem(API_KEY);
    if (pin) localStorage.setItem(PIN_KEY, pin);
    else localStorage.removeItem(PIN_KEY);
    cap.notice = "Connection saved.";
    cap.error = "";
    void loadItems();
  });

  document.getElementById("cap-upload")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const file = document.getElementById("cap-file")?.files?.[0];
    const note = document.getElementById("cap-upload-note")?.value || "";
    if (!file) {
      cap.error = "Choose a photo first.";
      render();
      return;
    }
    void uploadFile(file, note);
  });

  cap.root.querySelectorAll(".cap-card").forEach((btn) => {
    btn.addEventListener("click", () => {
      cap.selectedId = btn.dataset.id;
      cap.error = "";
      cap.notice = "";
      void openDetail(cap.selectedId);
    });
  });

  document.getElementById("cap-close")?.addEventListener("click", () => {
    cap.selectedId = null;
    render();
  });

  document.getElementById("cap-note-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const note = document.getElementById("cap-note")?.value || "";
    void saveNote(cap.selectedId, note);
  });

  document.getElementById("cap-delete")?.addEventListener("click", () => {
    if (!cap.selectedId) return;
    if (!confirm("Delete this photo from Postgres?")) return;
    void deletePhoto(cap.selectedId);
  });
}

async function openDetail(id) {
  const item = cap.items.find((i) => i.id === id);
  if (!item) return;
  render();
  try {
    if (!item.fullUrl) item.fullUrl = await loadImageUrl(cap.base, id);
    render();
  } catch (err) {
    cap.error = err.message;
    render();
  }
}

async function loadItems() {
  cap.base = await configuredBase();
  cap.error = "";
  if (!cap.base && /\.github\.io$/i.test(location.hostname)) {
    cap.items = [];
    cap.configured = false;
    cap.error =
      "Set the Railway API URL and PIN under API connection. GitHub Pages cannot store photos itself.";
    render();
    return;
  }
  try {
    const data = await apiFetch(cap.base, "/api/photos");
    revokeBlobs();
    cap.items = data.items || [];
    cap.configured = true;
    for (const item of cap.items) {
      try {
        item.thumbUrl = await loadImageUrl(cap.base, item.id, "thumb");
      } catch {
        item.thumbUrl = "";
      }
    }
  } catch (err) {
    cap.items = [];
    cap.configured = false;
    cap.error =
      err.status === 401
        ? "PIN did not match. Open API connection and save the upload PIN."
        : `Could not reach the photo API. Start it locally or set the Railway URL. ${err.message}`;
  }
  render();
}

async function uploadFile(file, note) {
  cap.uploading = true;
  cap.error = "";
  cap.notice = "";
  render();
  try {
    const body = new FormData();
    body.append("photo", file);
    if (note) body.append("note", note);
    await apiFetch(cap.base, "/api/photos", { method: "POST", body });
    cap.notice = "Photo stored in Postgres.";
    cap.uploading = false;
    await loadItems();
  } catch (err) {
    cap.uploading = false;
    cap.error = err.message;
    render();
  }
}

async function saveNote(id, note) {
  try {
    const row = await apiFetch(cap.base, `/api/photos/${id}`, {
      method: "PATCH",
      json: { note },
    });
    const item = cap.items.find((i) => i.id === id);
    if (item) Object.assign(item, row);
    cap.notice = "Note saved.";
    render();
  } catch (err) {
    cap.error = err.message;
    render();
  }
}

async function deletePhoto(id) {
  try {
    await apiFetch(cap.base, `/api/photos/${id}`, { method: "DELETE" });
    cap.selectedId = null;
    cap.notice = "Photo deleted.";
    await loadItems();
  } catch (err) {
    cap.error = err.message;
    render();
  }
}

export async function renderCaptured({ els }) {
  cap.root = els.captured;
  cap.selectedId = null;
  cap.notice = "";
  cap.error = "";
  cap.root.innerHTML = `<p class="lede">Loading captured photos…</p>`;
  await loadItems();
}

export function capturedCanGoBack() {
  return Boolean(cap.selectedId);
}

export function capturedGoBack() {
  if (!cap.selectedId) return false;
  cap.selectedId = null;
  cap.error = "";
  render();
  return true;
}

export function cleanupCaptured() {
  revokeBlobs();
  cap.root = null;
  cap.items = [];
  cap.selectedId = null;
}
