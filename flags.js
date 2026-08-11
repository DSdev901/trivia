const STORAGE_KEY = "trivia-helper-flags-v1";

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(flags) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(flags));
}

export function listFlags(categoryId = null) {
  const flags = readAll();
  if (!categoryId) return flags;
  return flags.filter((f) => f.categoryId === categoryId);
}

export function flagCount(categoryId = null) {
  return listFlags(categoryId).length;
}

export function isFlagged(id) {
  return readAll().some((f) => f.id === id);
}

export function factFlagId(categoryId, presidentNumber, factIndex) {
  return `${categoryId}:fact:${presidentNumber}:${factIndex}`;
}

export function quizFlagId(categoryId, questionId) {
  return `${categoryId}:quiz:${questionId}`;
}

export function toggleFlag(entry) {
  const flags = readAll();
  const idx = flags.findIndex((f) => f.id === entry.id);
  if (idx >= 0) {
    flags.splice(idx, 1);
    writeAll(flags);
    return false;
  }
  flags.unshift({ ...entry, flaggedAt: new Date().toISOString() });
  writeAll(flags);
  return true;
}

export function removeFlag(id) {
  writeAll(readAll().filter((f) => f.id !== id));
}

export function clearFlags(categoryId = null) {
  if (!categoryId) {
    writeAll([]);
    return;
  }
  writeAll(readAll().filter((f) => f.categoryId !== categoryId));
}

export function flagsAsText(categoryId = null) {
  const flags = listFlags(categoryId);
  if (!flags.length) return "No flagged items.";
  return flags
    .map((f, i) => {
      const where =
        f.type === "fact"
          ? `#${f.presidentNumber} ${f.presidentName} · fact ${f.factIndex + 1}`
          : `Quiz · ${f.questionId}`;
      return `${i + 1}. [${f.type}] ${where}\n   ${f.text}`;
    })
    .join("\n\n");
}
