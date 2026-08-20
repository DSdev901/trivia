import { crumbsHtml, href } from "./routes.js";
import { chastiseGuestbook, guestbookHasVulgar } from "./server/guestbook-filter.js";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function apiBaseUrl() {
  try {
    const res = await fetch("data/api.json");
    if (!res.ok) return "";
    const cfg = await res.json();
    return String(cfg.baseUrl || "").replace(/\/$/, "");
  } catch {
    return "";
  }
}

function formatGuestDay(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function netscapeBadgeHtml() {
  return `<span class="web-badge web-badge--netscape" role="img" aria-label="Netscape Site of the Day">
    <svg viewBox="0 0 88 31" width="88" height="31" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" aria-hidden="true">
      <rect width="88" height="31" fill="#000"/>
      <rect x="1" y="1" width="86" height="29" fill="#1a1048"/>
      <rect x="2" y="2" width="84" height="1" fill="#6e5cb8"/>
      <rect x="2" y="28" width="84" height="1" fill="#09041c"/>
      <rect x="3" y="5" width="20" height="21" fill="#4b1d7a"/>
      <rect x="4" y="6" width="18" height="1" fill="#7b3aad"/>
      <text x="13" y="20" text-anchor="middle" fill="#fff8d4" font-family="Georgia, Times, serif" font-size="15" font-weight="700">N</text>
      <text x="27" y="14" fill="#e8c04a" font-family="Tahoma, Geneva, sans-serif" font-size="7" font-weight="700">NETSCAPE</text>
      <text x="27" y="24" fill="#f4f0ff" font-family="Tahoma, Geneva, sans-serif" font-size="5.4" font-weight="700">SITE OF THE DAY</text>
    </svg>
  </span>`;
}

function guestbookBadgeHtml() {
  return `<a class="web-badge web-badge--gb" href="${href(["guestbook"])}" aria-label="Sign the guestbook">
    <svg viewBox="0 0 88 31" width="88" height="31" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" aria-hidden="true">
      <rect width="88" height="31" fill="#06281f"/>
      <rect x="1" y="1" width="86" height="29" fill="#0b5f4b"/>
      <rect x="2" y="2" width="84" height="1" fill="#3d9a80"/>
      <rect x="2" y="28" width="84" height="1" fill="#05281f"/>
      <text x="44" y="13" text-anchor="middle" fill="#fff8d4" font-family="Tahoma, Geneva, sans-serif" font-size="7" font-weight="700">SIGN OUR</text>
      <text x="44" y="23" text-anchor="middle" fill="#e8c04a" font-family="Tahoma, Geneva, sans-serif" font-size="7.2" font-weight="700">GUESTBOOK</text>
    </svg>
  </a>`;
}

function y2kBadgeHtml() {
  return `<span class="web-badge web-badge--y2k" role="img" aria-label="Y2K compliant">
    <svg viewBox="0 0 88 31" width="88" height="31" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" aria-hidden="true">
      <rect width="88" height="31" fill="#1a1400"/>
      <rect x="1" y="1" width="86" height="29" fill="#3d3208"/>
      <rect x="2" y="2" width="84" height="1" fill="#e8c04a"/>
      <text x="44" y="13" text-anchor="middle" fill="#e8c04a" font-family="Tahoma, Geneva, sans-serif" font-size="8" font-weight="700">Y2K</text>
      <text x="44" y="24" text-anchor="middle" fill="#f7f3eb" font-family="Tahoma, Geneva, sans-serif" font-size="6.2" font-weight="700">COMPLIANT</text>
    </svg>
  </span>`;
}

export function homeWebBadgesHtml() {
  return `<div class="web-badges">${netscapeBadgeHtml()}${guestbookBadgeHtml()}${y2kBadgeHtml()}</div>`;
}

function entryHtml(entry) {
  const when = formatGuestDay(entry.createdAt);
  const where = entry.location
    ? ` from ${escapeHtml(entry.location)}`
    : "";
  return `<li class="gb-entry">
    <p class="gb-entry-meta"><strong>${escapeHtml(entry.name)}</strong>${where}${
      when ? ` <time datetime="${escapeHtml(String(entry.createdAt || ""))}">${escapeHtml(when)}</time>` : ""
    }</p>
    <p class="gb-entry-msg">${escapeHtml(entry.message)}</p>
  </li>`;
}

function renderList(entries) {
  if (!entries.length) {
    return `<p class="gb-empty">Be the first to sign.</p>`;
  }
  return `<ol class="gb-list">${entries.map(entryHtml).join("")}</ol>`;
}

export async function renderGuestbook({ els }) {
  const root = els.guestbook;
  if (!root) return;
  root.innerHTML = `
    ${crumbsHtml(
      [
        { label: "Home", href: href([]) },
        { label: "Guestbook", href: href(["guestbook"]) },
      ],
      escapeHtml
    )}
    <h2 class="section-title">Guestbook</h2>
    <p class="lede">Thanks for stopping by. Sign the book — a name, a hometown if you like, and a short note.</p>
    <div class="gb-page">
      <form class="gb-form" id="gb-form" autocomplete="on">
        <label class="gb-hp" aria-hidden="true">Homepage<input type="text" name="homepage" tabindex="-1" autocomplete="off"></label>
        <label>Name <input type="text" name="name" maxlength="28" required></label>
        <label>Hometown <input type="text" name="location" maxlength="32" placeholder="optional"></label>
        <label>Message <textarea name="message" rows="3" maxlength="240" required></textarea></label>
        <div class="gb-form-actions">
          <button type="submit" class="primary-btn" id="gb-submit">Sign the book</button>
          <p class="gb-status" id="gb-status" hidden></p>
        </div>
      </form>
      <div class="gb-book" id="gb-book"><p class="gb-empty">Opening the book…</p></div>
    </div>
  `;

  const form = root.querySelector("#gb-form");
  const status = root.querySelector("#gb-status");
  const book = root.querySelector("#gb-book");
  const submit = root.querySelector("#gb-submit");

  const setStatus = (text, kind) => {
    if (!status) return;
    status.hidden = !text;
    status.textContent = text || "";
    status.classList.toggle("is-error", kind === "error");
  };

  const loadEntries = async () => {
    const base = await apiBaseUrl();
    if (!base || !book) {
      book.innerHTML = `<p class="gb-empty">The book is out for polishing. Try again later.</p>`;
      return;
    }
    try {
      const res = await fetch(`${base}/api/guestbook`);
      if (!res.ok) throw new Error("bad");
      const data = await res.json();
      book.innerHTML = renderList(Array.isArray(data.entries) ? data.entries : []);
    } catch {
      book.innerHTML = `<p class="gb-empty">Could not open the guestbook just now.</p>`;
    }
  };

  form?.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const base = await apiBaseUrl();
    if (!base) {
      setStatus("The book is out for polishing. Try again later.", "error");
      return;
    }
    const data = new FormData(form);
    const payload = {
      homepage: String(data.get("homepage") || ""),
      name: String(data.get("name") || "").trim(),
      location: String(data.get("location") || "").trim(),
      message: String(data.get("message") || "").trim(),
    };
    const signed = `${payload.name} ${payload.location} ${payload.message}`;
    if (guestbookHasVulgar(signed)) {
      setStatus(chastiseGuestbook(signed), "error");
      return;
    }
    if (submit) submit.disabled = true;
    setStatus("Signing…");
    try {
      const res = await fetch(`${base}/api/guestbook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus(body.error || "Could not sign just now.", "error");
        return;
      }
      form.reset();
      setStatus("You're in the book. Thanks for visiting.");
      await loadEntries();
    } catch {
      setStatus("Could not sign just now.", "error");
    } finally {
      if (submit) submit.disabled = false;
    }
  });

  await loadEntries();
}
