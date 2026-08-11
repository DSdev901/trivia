/**
 * Lightweight SM-2-style spaced repetition for geography cards.
 * Evidence basis: retrieval practice + spaced intervals + difficulty ratings.
 */

const STORAGE_KEY = "trivia-geo-srs-v1";

export const RATINGS = [
  { id: "again", label: "Again", hint: "Missed — show soon", grade: 1 },
  { id: "hard", label: "Hard", hint: "Got it with struggle", grade: 3 },
  { id: "good", label: "Good", hint: "Solid recall", grade: 4 },
  { id: "easy", label: "Easy", hint: "Instant — space out", grade: 5 },
];

function now() {
  return Date.now();
}

function loadAll() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveAll(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function defaultCard() {
  return {
    ease: 2.5,
    interval: 0,
    repetitions: 0,
    due: 0,
    lapses: 0,
    seen: 0,
    correctStreak: 0,
  };
}

export function getCard(cardId) {
  const all = loadAll();
  return { ...defaultCard(), ...(all[cardId] || {}) };
}

export function listDueCardIds(cardIds, at = now()) {
  return cardIds.filter((id) => getCard(id).due <= at);
}

export function schedule(cardId, grade) {
  const all = loadAll();
  const card = { ...defaultCard(), ...(all[cardId] || {}) };
  card.seen += 1;

  if (grade < 3) {
    card.repetitions = 0;
    card.interval = 0;
    card.lapses += 1;
    card.correctStreak = 0;
    card.ease = Math.max(1.3, card.ease - 0.2);
    card.due = now() + 60 * 1000; // 1 minute
  } else {
    card.correctStreak += 1;
    if (card.repetitions === 0) {
      card.interval = grade === 5 ? 3 : 1; // days
    } else if (card.repetitions === 1) {
      card.interval = grade === 5 ? 6 : 3;
    } else {
      const mult = grade === 3 ? 1.2 : grade === 5 ? card.ease * 1.3 : card.ease;
      card.interval = Math.max(1, Math.round(card.interval * mult));
    }
    card.repetitions += 1;
    if (grade === 3) card.ease = Math.max(1.3, card.ease - 0.15);
    if (grade === 5) card.ease = card.ease + 0.15;
    card.due = now() + card.interval * 24 * 60 * 60 * 1000;
  }

  all[cardId] = card;
  saveAll(all);
  return card;
}

export function progressSummary(cardIds) {
  const at = now();
  let due = 0;
  let newCount = 0;
  let learning = 0;
  let mature = 0;
  for (const id of cardIds) {
    const c = getCard(id);
    if (c.seen === 0) newCount += 1;
    else if (c.interval >= 21) mature += 1;
    else learning += 1;
    if (c.due <= at) due += 1;
  }
  return { due, newCount, learning, mature, total: cardIds.length };
}

/** Order: due first (oldest due), then unseen, shuffle lightly within bands. */
export function orderQueue(cardIds, at = now()) {
  const due = [];
  const fresh = [];
  const later = [];
  for (const id of cardIds) {
    const c = getCard(id);
    if (c.seen === 0) fresh.push(id);
    else if (c.due <= at) due.push({ id, due: c.due });
    else later.push({ id, due: c.due });
  }
  due.sort((a, b) => a.due - b.due);
  // Interleave: take due, then inject some new for encoding variety
  const queue = due.map((x) => x.id);
  const shuffledFresh = shuffle(fresh);
  const out = [];
  let fi = 0;
  for (let i = 0; i < queue.length; i += 1) {
    out.push(queue[i]);
    if (fi < shuffledFresh.length && (i + 1) % 3 === 0) {
      out.push(shuffledFresh[fi]);
      fi += 1;
    }
  }
  while (fi < shuffledFresh.length) {
    out.push(shuffledFresh[fi]);
    fi += 1;
  }
  // Cap session later cards only if queue empty
  if (!out.length) {
    later.sort((a, b) => a.due - b.due);
    return later.slice(0, 12).map((x) => x.id);
  }
  return out;
}

function shuffle(items) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
