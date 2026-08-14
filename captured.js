/** Captured trivia photos stored on the Postgres API. */

const PIN_KEY = "trivia.uploadPin";
const API_KEY = "trivia.apiBase";

const cap = {
  root: null,
  items: [],
  notice: "",
  error: "",
  uploading: false,
  selectedId: null,
  configured: false,
  base: "",
};

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function savedPin() {
  return localStorage.getItem(PIN_KEY) || "";
}

function canWrite() {
  return Boolean(savedPin());
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

function photoUrl(base, id, size) {
  const qs = size === "thumb" ? "?size=thumb" : "";
  return `${base}/api/photos/${id}${qs}`;
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
      <summary>Add or remove photos</summary>
      <p class="lede">Anyone can view the photos. The PIN is only for uploading, editing, or deleting.</p>
      <form id="cap-settings-form" class="cap-form">
        <label class="voice-field">
          <span>API URL</span>
          <input type="url" id="cap-api-url" placeholder="https://your-app.up.railway.app" value="${escapeHtml(
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
          <button type="submit" class="secondary-btn">Save</button>
        </div>
      </form>
    </details>`;
}

function cardHtml(item) {
  return `
    <button type="button" class="cap-card" data-id="${escapeHtml(item.id)}">
      <img class="cap-thumb" src="${escapeHtml(item.thumbUrl)}" alt="" />
      <span class="cap-card-meta">
        <span class="cap-card-date">${escapeHtml(fmtWhen(item.created_at))}</span>
        ${item.note ? `<span class="cap-card-note">${escapeHtml(item.note)}</span>` : ""}
      </span>
    </button>`;
}

function detailHtml(item) {
  if (!item) return "";
  const write = canWrite();
  return `
    <section class="cap-detail">
      <img class="cap-full" src="${escapeHtml(item.fullUrl)}" alt="Original photo" />
      ${
        write
          ? `<form id="cap-note-form" class="cap-form">
        <label class="voice-field">
          <span>Note</span>
          <textarea id="cap-note" rows="3" maxlength="2000" placeholder="Question, answer, or where this card is from">${escapeHtml(
            item.note || ""
          )}</textarea>
        </label>
        ${
          item.extracted_text
            ? `<p class="lede"><strong>Extracted text</strong> ${escapeHtml(item.extracted_text)}</p>`
            : ""
        }
        <div class="setup-actions">
          <button type="submit" class="primary-btn">Save note</button>
          <button type="button" class="secondary-btn" id="cap-close">Back to grid</button>
          <button type="button" class="text-btn" id="cap-delete">Delete photo</button>
        </div>
      </form>`
          : `<div class="setup-actions">
        ${item.note ? `<p class="lede">${escapeHtml(item.note)}</p>` : ""}
        <button type="button" class="secondary-btn" id="cap-close">Back to grid</button>
      </div>`
      }
    </section>`;
}

function uploadHtml() {
  if (!canWrite()) {
    return `<p class="lede">Photos are public. Open <strong>Add or remove photos</strong> and enter the PIN if you need to upload.</p>`;
  }
  return `
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
    </form>`;
}

function render() {
  if (!cap.root) return;
  const selected = cap.items.find((i) => i.id === cap.selectedId) || null;
  cap.root.innerHTML = `
    <div class="cap-head">
      <div>
        <h2 class="section-title">Captured</h2>
        <p class="lede">Photos of trivia questions and answers. Anyone can view them; adding or deleting needs the PIN.</p>
      </div>
    </div>
    ${settingsHtml(cap.base || "")}
    ${cap.error ? `<p class="error">${escapeHtml(cap.error)}</p>` : ""}
    ${cap.notice ? `<p class="ce-notice">${escapeHtml(cap.notice)}</p>` : ""}
    ${
      selected
        ? detailHtml(selected)
        : `
    ${uploadHtml()}
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
    cap.notice = "Saved.";
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
      render();
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

async function loadItems() {
  cap.base = await configuredBase();
  cap.error = "";
  if (!cap.base && /\.github\.io$/i.test(location.hostname)) {
    cap.items = [];
    cap.configured = false;
    cap.error = "The photo API URL is not set.";
    render();
    return;
  }
  try {
    const data = await apiFetch(cap.base, "/api/photos");
    cap.items = (data.items || []).map((item) => ({
      ...item,
      thumbUrl: photoUrl(cap.base, item.id, "thumb"),
      fullUrl: photoUrl(cap.base, item.id),
    }));
    cap.configured = true;
  } catch (err) {
    cap.items = [];
    cap.configured = false;
    cap.error = `Could not load photos. ${err.message}`;
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
    cap.error =
      err.status === 401
        ? "Upload PIN is missing or wrong. Save it under Add or remove photos."
        : err.message;
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
    if (item) Object.assign(item, row, {
      thumbUrl: photoUrl(cap.base, id, "thumb"),
      fullUrl: photoUrl(cap.base, id),
    });
    cap.notice = "Note saved.";
    render();
  } catch (err) {
    cap.error =
      err.status === 401
        ? "Upload PIN is missing or wrong."
        : err.message;
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
    cap.error =
      err.status === 401
        ? "Upload PIN is missing or wrong."
        : err.message;
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
  cap.root = null;
  cap.items = [];
  cap.selectedId = null;
}
