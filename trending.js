/** Trending category — cliff notes for what’s in the cultural air right now. */

import { crumbsHtml, href } from "./routes.js";

const INDEX_PATH = "data/trending/index.json";

const tr = {
  root: null,
  index: null,
  show: null,
  showId: "",
};

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function loadJSON(path) {
  const res = await fetch(path, { credentials: "omit", cache: "no-cache" });
  if (!res.ok) throw new Error(`Could not load ${path}`);
  return res.json();
}

function factionLabel(show, factionId) {
  return (
    (show.factions || []).find((f) => f.id === factionId)?.label ||
    factionId ||
    ""
  );
}

function portraitHtml(name, image, kind = "person") {
  if (image) {
    return `<img class="tr-portrait" src="${escapeHtml(image)}" alt="" loading="lazy" width="120" height="120" />`;
  }
  const initials = String(name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return `<div class="tr-portrait tr-portrait-empty tr-portrait-${kind}" aria-hidden="true">${escapeHtml(
    initials || "?"
  )}</div>`;
}

function characterCard(c, show) {
  const faction = factionLabel(show, c.faction);
  const dragon = c.dragon;
  return `
    <article class="tr-card">
      <div class="tr-card-main">
        ${portraitHtml(c.name, c.image, "person")}
        <div class="tr-card-copy">
          <div class="tr-card-head">
            <h3>${escapeHtml(c.name)}</h3>
            ${
              faction
                ? `<span class="tr-chip tr-chip-${escapeHtml(c.faction || "")}">${escapeHtml(
                    faction
                  )}</span>`
                : ""
            }
          </div>
          <p class="tr-role">${escapeHtml(c.role || "")}</p>
          <p class="tr-plot">${escapeHtml(c.plot || "")}</p>
        </div>
      </div>
      ${
        dragon
          ? `<div class="tr-dragon">
        ${portraitHtml(dragon.name, dragon.image, "dragon")}
        <div class="tr-dragon-copy">
          <p class="tr-dragon-name">${escapeHtml(dragon.name)}</p>
          <p class="tr-dragon-note">${escapeHtml(dragon.note || "Their dragon.")}</p>
        </div>
      </div>`
          : `<p class="tr-no-dragon">No dragon</p>`
      }
    </article>`;
}

function weeklyHtml(weekly) {
  if (!weekly) return "";
  const episodes = weekly.episodes || [];
  const status = weekly.status
    ? `<p class="tr-weekly-status">${escapeHtml(weekly.status)}</p>`
    : weekly.active
      ? `<p class="tr-weekly-status">Season ${escapeHtml(
          String(weekly.season || "")
        )} — updated while new episodes air.</p>`
      : "";
  if (!episodes.length && !status) return "";
  return `
    <section class="tr-section" aria-label="Weekly updates">
      <h2 class="tr-section-title">Season ${escapeHtml(
        String(weekly.season || "")
      )} recap</h2>
      ${status}
      <ol class="tr-episode-list">
        ${episodes
          .map(
            (ep) => `
          <li class="tr-episode">
            <div class="tr-episode-head">
              <span class="tr-episode-n">Ep ${escapeHtml(String(ep.n))}</span>
              <strong>${escapeHtml(ep.title || "")}</strong>
              ${
                ep.aired
                  ? `<time datetime="${escapeHtml(ep.aired)}">${escapeHtml(
                      ep.aired
                    )}</time>`
                  : ""
              }
            </div>
            <p>${escapeHtml(ep.recap || "")}</p>
          </li>`
          )
          .join("")}
      </ol>
    </section>`;
}

function factsHtml(topic) {
  const facts = topic.facts || [];
  return `
    ${crumbsHtml(
      [
        { label: "Trending", href: href(["trending"]) },
        {
          label: topic.title,
          href: href(["trending", topic.id]),
        },
      ],
      escapeHtml
    )}
    <header class="tr-show-head">
      <p class="tr-kicker">${escapeHtml(
        topic.kicker || topic.network || "Trending"
      )}</p>
      <h2 class="section-title">${escapeHtml(topic.title)}</h2>
      <p class="lede">${escapeHtml(topic.overview || "")}</p>
      ${
        topic.spoilerNote
          ? `<p class="tr-spoiler">${escapeHtml(topic.spoilerNote)}</p>`
          : ""
      }
    </header>
    <section class="tr-section" aria-label="Trivia facts">
      <h2 class="tr-section-title">${escapeHtml(
        String(facts.length)
      )} pub-trivia facts</h2>
      <ol class="tr-fact-list">
        ${facts
          .map(
            (f, i) => `
          <li class="tr-fact">
            <span class="tr-fact-n" aria-hidden="true">${escapeHtml(
              String(f.n ?? i + 1)
            )}</span>
            <p>${escapeHtml(f.fact || "")}</p>
          </li>`
          )
          .join("")}
      </ol>
    </section>
  `;
}

function castShowHtml(show) {
  const blacks = (show.characters || []).filter((c) => c.faction === "blacks");
  const greens = (show.characters || []).filter((c) => c.faction === "greens");
  const other = (show.characters || []).filter(
    (c) => c.faction !== "blacks" && c.faction !== "greens"
  );
  const block = (title, list) =>
    list.length
      ? `
      <section class="tr-section" aria-label="${escapeHtml(title)}">
        <h2 class="tr-section-title">${escapeHtml(title)}</h2>
        <div class="tr-grid">${list.map((c) => characterCard(c, show)).join("")}</div>
      </section>`
      : "";

  return `
    ${crumbsHtml(
      [
        { label: "Trending", href: href(["trending"]) },
        {
          label: show.title,
          href: href(["trending", show.id]),
        },
      ],
      escapeHtml
    )}
    <header class="tr-show-head">
      <p class="tr-kicker">${escapeHtml(show.network || "TV")}</p>
      <h2 class="section-title">${escapeHtml(show.title)}</h2>
      <p class="lede">${escapeHtml(show.overview || "")}</p>
      ${
        show.spoilerNote
          ? `<p class="tr-spoiler">${escapeHtml(show.spoilerNote)}</p>`
          : ""
      }
    </header>
    ${weeklyHtml(show.weekly)}
    ${block("The Blacks", blacks)}
    ${block("The Greens", greens)}
    ${block("Others", other)}
  `;
}

function showHtml(show) {
  if (show.type === "facts" || (show.facts && !show.characters)) {
    return factsHtml(show);
  }
  return castShowHtml(show);
}

function indexHtml(index) {
  const shows = index.shows || [];
  return `
    ${crumbsHtml([{ label: "Trending", href: href(["trending"]) }], escapeHtml)}
    <h2 class="section-title">Trending</h2>
    <p class="lede">Short cliff notes for what people are actually talking about.</p>
    <div class="tr-show-list">
      ${shows
        .map(
          (s) => `
        <a class="tr-show-link" href="${href(["trending", s.id])}">
          <h3>${escapeHtml(s.title)}</h3>
          <p>${escapeHtml(s.blurb || "")}</p>
          <span class="meta">${escapeHtml(s.network || "Topic")}</span>
        </a>`
        )
        .join("")}
    </div>
  `;
}

function bind() {
  /* links are real hash hrefs */
}

export async function renderTrending({ els, showId = "" } = {}) {
  tr.root = els.trending;
  if (!tr.root) return;
  tr.showId = showId || "";

  try {
    if (!tr.index) tr.index = await loadJSON(INDEX_PATH);
    if (!tr.showId) {
      tr.show = null;
      tr.root.innerHTML = indexHtml(tr.index);
      bind();
      return;
    }
    const entry = (tr.index.shows || []).find((s) => s.id === tr.showId);
    if (!entry?.path) throw new Error(`Unknown show: ${tr.showId}`);
    tr.show = await loadJSON(entry.path);
    tr.root.innerHTML = showHtml(tr.show);
    bind();
  } catch (err) {
    tr.root.innerHTML = `<p class="error">${escapeHtml(err.message)}</p>`;
  }
}
