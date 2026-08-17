/** Captured trivia questions parsed from photos. */

import { crumbsHtml, href } from "./routes.js";

const PIN_KEY = "trivia.uploadPin";
const API_KEY = "trivia.apiBase";

const cap = {
  root: null,
  mode: "browse", // "browse" | "upload"
  items: [],
  notice: "",
  error: "",
  uploading: false,
  uploadProgress: "",
  parseReady: null,
  base: "",
  search: "",
  photoOpen: new Set(),
  editingId: null,
};

function sitePrefix() {
  return /question_upload/.test(location.pathname) ? "../" : "";
}

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
    const res = await fetch(`${sitePrefix()}data/api.json`);
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

function withUrls(item) {
  return {
    ...item,
    thumbUrl: photoUrl(cap.base, item.id, "thumb"),
    fullUrl: photoUrl(cap.base, item.id),
  };
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

function visibleItems() {
  const q = cap.search.trim().toLowerCase();
  if (!q) return cap.items;
  return cap.items.filter((item) =>
    [item.question, item.answer, item.note, item.extracted_text, formatTriviaDate(item.trivia_date)].some(
      (s) => String(s || "").toLowerCase().includes(q)
    )
  );
}

function settingsHtml(base) {
  return `
    <form id="cap-settings-form" class="cap-form cap-pin-form">
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
        <button type="submit" class="secondary-btn">Save PIN</button>
      </div>
    </form>`;
}

function formatTriviaDate(value) {
  const iso = String(value || "").slice(0, 10);
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "";
  return `${Number(match[2])}/${Number(match[3])}/${match[1]}`;
}

function dateInputValue(value) {
  const iso = String(value || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : "";
}

function uploadHtml() {
  if (!canWrite()) {
    return `<p class="lede">Save the upload PIN above, then you can add photos from your phone.</p>`;
  }
  return `
    <form id="cap-upload" class="cap-upload">
      <label class="cap-file">
        <span>Photos</span>
        <input id="cap-file" type="file" accept="image/*" multiple ${
          cap.uploading ? "disabled" : ""
        } />
      </label>
      <label class="voice-field">
        <span>Trivia date</span>
        <input type="date" id="cap-upload-date" />
      </label>
      <label class="voice-field">
        <span>Note for this batch (optional)</span>
        <input type="text" id="cap-upload-note" maxlength="2000" placeholder="e.g. Jeopardy sports, pub quiz week 12" />
      </label>
      <button type="submit" class="primary-btn" ${cap.uploading ? "disabled" : ""}>${
        cap.uploading ? escapeHtml(cap.uploadProgress || "Uploading…") : "Upload and parse"
      }</button>
    </form>`;
}

function cardHtml(item) {
  const write = cap.mode === "upload" && canWrite();
  const showPhoto = cap.photoOpen.has(item.id);
  const editing = write && cap.editingId === item.id;
  const question = item.question || "Question not read yet";
  const answer = item.answer || "";
  const triviaDate = formatTriviaDate(item.trivia_date);
  return `
    <article class="ce-card cap-qa" data-id="${escapeHtml(item.id)}">
      ${
        editing
          ? `<form class="cap-form cap-edit-form">
        <label class="voice-field">
          <span>Question</span>
          <textarea name="question" rows="3" maxlength="2000">${escapeHtml(item.question || "")}</textarea>
        </label>
        <label class="voice-field">
          <span>Answer</span>
          <textarea name="answer" rows="2" maxlength="2000">${escapeHtml(item.answer || "")}</textarea>
        </label>
        <label class="voice-field">
          <span>Trivia date</span>
          <input type="date" name="trivia_date" value="${escapeHtml(dateInputValue(item.trivia_date))}" />
        </label>
        <label class="voice-field">
          <span>Note</span>
          <input type="text" name="note" maxlength="2000" value="${escapeHtml(item.note || "")}" />
        </label>
        <div class="setup-actions">
          <button type="submit" class="primary-btn">Save</button>
          <button type="button" class="secondary-btn" data-cancel-edit>Cancel</button>
          <button type="button" class="text-btn" data-reparse>Re-parse photo</button>
        </div>
      </form>`
          : `<h3 class="cap-question">${escapeHtml(question)}</h3>
      ${
        answer
          ? `<p class="cap-answer"><span class="cap-answer-label">Answer</span> ${escapeHtml(answer)}</p>`
          : `<p class="cap-answer cap-answer-missing">No answer parsed yet.</p>`
      }
      ${triviaDate ? `<p class="cap-date">${escapeHtml(triviaDate)}</p>` : ""}
      ${item.note ? `<p class="cap-card-note">${escapeHtml(item.note)}</p>` : ""}`
      }
      ${
        showPhoto
          ? `<img class="cap-full" src="${escapeHtml(item.fullUrl)}" alt="Original photo" />`
          : ""
      }
      <div class="setup-actions cap-card-actions">
        <button type="button" class="text-btn" data-toggle-photo>${
          showPhoto ? "Hide photo" : "Show photo"
        }</button>
        ${
          write && !editing
            ? `<button type="button" class="text-btn" data-edit>Edit</button>
        <button type="button" class="text-btn" data-delete>Delete</button>`
            : ""
        }
      </div>
    </article>`;
}

function listHtml() {
  const items = visibleItems();
  if (!cap.items.length) return `<p class="lede">No cards yet.</p>`;
  if (!items.length) return `<p class="lede">No cards match that search.</p>`;
  return `<div class="ce-list" id="cap-list">${items.map(cardHtml).join("")}</div>`;
}

function render() {
  if (!cap.root) return;
  if (cap.mode === "upload") {
    cap.root.innerHTML = `
    <div class="cap-head">
      <div>
        <h2 class="section-title">Upload questions</h2>
        <p class="lede">Add photos of trivia questions and answers. They are parsed, then shown in Prior Saucer Trivia.${
          cap.parseReady === false
            ? " Parsing is off until you add <strong>ANTHROPIC_API_KEY</strong> on the Railway GitHub service — until then, upload the photo and type the question and answer with Edit."
            : ""
        }</p>
      </div>
    </div>
    ${settingsHtml(cap.base || "")}
    ${cap.error ? `<p class="error">${escapeHtml(cap.error)}</p>` : ""}
    ${cap.notice ? `<p class="ce-notice">${escapeHtml(cap.notice)}</p>` : ""}
    ${uploadHtml()}
    <p class="lede"><a class="ce-link" href="../">Back to trivia home</a></p>
    ${listHtml()}`;
    bind();
    return;
  }
  cap.root.innerHTML = `
    ${crumbsHtml(
      [{ label: "Prior Saucer Trivia", href: href(["prior-saucer"]) }],
      escapeHtml
    )}
    <div class="cap-head">
      <div>
        <h2 class="section-title">Prior Saucer Trivia</h2>
        <p class="lede">Search the questions and answers. The original photo stays hidden unless you choose Show photo.</p>
      </div>
    </div>
    ${cap.error ? `<p class="error">${escapeHtml(cap.error)}</p>` : ""}
    ${cap.notice ? `<p class="ce-notice">${escapeHtml(cap.notice)}</p>` : ""}
    <label class="voice-field cap-search">
      <span>Search</span>
      <input type="search" id="cap-search" placeholder="Question or answer" value="${escapeHtml(
        cap.search
      )}" />
    </label>
    ${listHtml()}
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
    const files = [...(document.getElementById("cap-file")?.files || [])];
    const note = document.getElementById("cap-upload-note")?.value || "";
    const triviaDate = document.getElementById("cap-upload-date")?.value || "";
    if (!files.length) {
      cap.error = "Choose one or more photos first.";
      render();
      return;
    }
    void uploadFiles(files, note, triviaDate);
  });

  const search = document.getElementById("cap-search");
  search?.addEventListener("input", () => {
    cap.search = search.value;
    const after = search.closest(".cap-search")?.nextElementSibling;
    if (after) after.outerHTML = listHtml();
    bindList();
  });

  bindList();
}

function bindList() {
  cap.root.querySelectorAll("[data-toggle-photo]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.closest("[data-id]")?.dataset.id;
      if (!id) return;
      if (cap.photoOpen.has(id)) cap.photoOpen.delete(id);
      else cap.photoOpen.add(id);
      render();
    });
  });
  cap.root.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      cap.editingId = btn.closest("[data-id]")?.dataset.id || null;
      render();
    });
  });
  cap.root.querySelectorAll("[data-cancel-edit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      cap.editingId = null;
      render();
    });
  });
  cap.root.querySelectorAll("[data-delete]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.closest("[data-id]")?.dataset.id;
      if (!id || !confirm("Delete this card?")) return;
      void deletePhoto(id);
    });
  });
  cap.root.querySelectorAll("[data-reparse]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.closest("[data-id]")?.dataset.id;
      if (id) void reparsePhoto(id);
    });
  });
  cap.root.querySelectorAll(".cap-edit-form").forEach((form) => {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const id = form.closest("[data-id]")?.dataset.id;
      if (!id) return;
      const data = new FormData(form);
      void saveCard(id, {
        question: data.get("question") || "",
        answer: data.get("answer") || "",
        note: data.get("note") || "",
        trivia_date: data.get("trivia_date") || "",
      });
    });
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
    const health = await apiFetch(cap.base, "/api/health");
    cap.parseReady = Boolean(health.parse);
    const data = await apiFetch(cap.base, "/api/photos");
    cap.items = (data.items || []).map(withUrls);
    cap.configured = true;
  } catch (err) {
    cap.items = [];
    cap.configured = false;
    cap.error = `Could not load cards. ${err.message}`;
  }
  render();
}

async function uploadFiles(files, note, triviaDate) {
  cap.uploading = true;
  cap.error = "";
  cap.notice = "";
  let ok = 0;
  const failed = [];
  for (let i = 0; i < files.length; i += 1) {
    cap.uploadProgress = `Uploading and parsing ${i + 1} of ${files.length}…`;
    render();
    try {
      const body = new FormData();
      body.append("photo", files[i]);
      if (note) body.append("note", note);
      if (triviaDate) body.append("trivia_date", triviaDate);
      await apiFetch(cap.base, "/api/photos", { method: "POST", body });
      ok += 1;
    } catch (err) {
      failed.push(files[i].name || `photo ${i + 1}`);
      if (err.status === 401) {
        cap.uploading = false;
        cap.uploadProgress = "";
        cap.error = "Upload PIN is missing or wrong.";
        render();
        return;
      }
    }
  }
  cap.uploading = false;
  cap.uploadProgress = "";
  cap.notice =
    failed.length === 0
      ? `Parsed ${ok} card${ok === 1 ? "" : "s"}.`
      : `Parsed ${ok}. Could not upload: ${failed.join(", ")}.`;
  await loadItems();
}

async function saveCard(id, fields) {
  try {
    const row = await apiFetch(cap.base, `/api/photos/${id}`, {
      method: "PATCH",
      json: fields,
    });
    const item = cap.items.find((i) => i.id === id);
    if (item) Object.assign(item, withUrls(row));
    cap.editingId = null;
    cap.notice = "Card saved.";
    render();
  } catch (err) {
    cap.error =
      err.status === 401 ? "Upload PIN is missing or wrong." : err.message;
    render();
  }
}

async function reparsePhoto(id) {
  cap.notice = "Re-reading the photo…";
  render();
  try {
    const row = await apiFetch(cap.base, `/api/photos/${id}/parse`, { method: "POST" });
    const item = cap.items.find((i) => i.id === id);
    if (item) Object.assign(item, withUrls(row));
    cap.editingId = null;
    cap.notice = "Question and answer updated from the photo.";
    render();
  } catch (err) {
    cap.error = err.message;
    render();
  }
}

async function deletePhoto(id) {
  try {
    await apiFetch(cap.base, `/api/photos/${id}`, { method: "DELETE" });
    cap.items = cap.items.filter((i) => i.id !== id);
    cap.photoOpen.delete(id);
    if (cap.editingId === id) cap.editingId = null;
    cap.notice = "Card deleted.";
    render();
  } catch (err) {
    cap.error =
      err.status === 401 ? "Upload PIN is missing or wrong." : err.message;
    render();
  }
}

export async function renderCaptured({ els }) {
  cap.root = els.captured;
  cap.mode = "browse";
  cap.editingId = null;
  cap.notice = "";
  cap.error = "";
  cap.root.innerHTML = `<p class="lede">Loading Prior Saucer Trivia…</p>`;
  await loadItems();
}

export async function renderQuestionUpload({ root }) {
  cap.root = root;
  cap.mode = "upload";
  cap.editingId = null;
  cap.notice = "";
  cap.error = "";
  cap.root.innerHTML = `<p class="lede">Loading upload…</p>`;
  await loadItems();
}

export function capturedCanGoBack() {
  if (cap.editingId) return true;
  if (cap.photoOpen.size) return true;
  return false;
}

export function capturedGoBack() {
  if (cap.editingId) {
    cap.editingId = null;
    render();
    return true;
  }
  if (cap.photoOpen.size) {
    cap.photoOpen.clear();
    render();
    return true;
  }
  return false;
}

export function cleanupCaptured() {
  cap.root = null;
  cap.items = [];
  cap.editingId = null;
  cap.photoOpen.clear();
}
