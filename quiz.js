function shuffle(items) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function ordinal(n) {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

function uniqueBy(items, keyFn) {
  const seen = new Set();
  return items.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function pickDistractors(pool, correct, count, keyFn = (x) => x) {
  const correctKey = keyFn(correct);
  const candidates = shuffle(
    uniqueBy(
      pool.filter((item) => keyFn(item) !== correctKey),
      keyFn
    )
  );
  return candidates.slice(0, count);
}

function makeChoices(correct, distractors) {
  return shuffle([correct, ...distractors]);
}

/** Build multiple-choice questions from president records in selected batches. */
export function buildPresidentQuestions(presidents) {
  const pool = presidents;
  const names = pool.map((p) => p.name);
  const served = pool.map((p) => p.served);
  const numbers = pool.map((p) => String(p.number));
  const questions = [];

  for (const p of pool) {
    const nameDistractors = pickDistractors(names, p.name, 3);
    if (nameDistractors.length === 3) {
      questions.push({
        id: `who-${p.number}`,
        prompt: `Who was the ${ordinal(p.number)} president of the United States?`,
        choices: makeChoices(p.name, nameDistractors),
        correct: p.name,
        batch: p._batch,
      });
    }

    const servedDistractors = pickDistractors(served, p.served, 3);
    if (servedDistractors.length === 3) {
      questions.push({
        id: `served-${p.number}-${p.served}`,
        prompt: `When did ${p.name} serve as president?`,
        choices: makeChoices(p.served, servedDistractors),
        correct: p.served,
        batch: p._batch,
      });
    }

    const numberDistractors = pickDistractors(numbers, String(p.number), 3);
    if (numberDistractors.length === 3) {
      questions.push({
        id: `number-${p.number}`,
        prompt: `What number president was ${p.name}?`,
        choices: makeChoices(String(p.number), numberDistractors),
        correct: String(p.number),
        batch: p._batch,
      });
    }

    p.trivia.forEach((fact, index) => {
      const distractors = pickDistractors(names, p.name, 3);
      if (distractors.length < 3) return;
      questions.push({
        id: `fact-${p.number}-${index}`,
        prompt: `Which president does this describe?\n“${fact}”`,
        choices: makeChoices(p.name, distractors),
        correct: p.name,
        batch: p._batch,
      });
    });
  }

  return shuffle(questions);
}

/** Build multiple-choice questions from film pub-quiz rounds. */
export function buildMovieQuestions(items) {
  const questions = [];
  for (const item of items) {
    const correct = String(item.answer || "").trim();
    if (!correct || !item.question) continue;
    const raw = (item.choices || []).map((c) => String(c).trim()).filter(Boolean);
    const unique = [];
    for (const c of raw) {
      if (!unique.includes(c)) unique.push(c);
    }
    if (!unique.includes(correct)) unique.unshift(correct);
    const distractors = shuffle(unique.filter((c) => c !== correct)).slice(0, 3);
    if (distractors.length < 3) continue;
    questions.push({
      id: item.id,
      prompt: item.question,
      choices: makeChoices(correct, distractors),
      correct,
      batch: item._batch,
    });
  }
  return shuffle(questions);
}

/**
 * Element quiz mix (retrieval practice):
 * 1. Lean ID — symbol ↔ name, Z ↔ name (core)
 * 2. Property → element — one fact, no Z/group dumped in
 * 3. Position → element — family + Z, or period + group
 * 4. Name → family / period (reverse direction)
 * Distractors come from `allElements` so small groups still work.
 */
export function buildElementQuestions(focusElements, allElements, categoryLabels = {}) {
  const targets = focusElements || [];
  const pool = allElements?.length ? allElements : targets;
  if (targets.length < 1 || pool.length < 4) return [];

  const names = pool.map((e) => e.name);
  const symbols = pool.map((e) => e.symbol);
  const numbers = pool.map((e) => String(e.Z));
  const categories = [
    ...new Set(pool.map((e) => categoryLabels[e.category] || e.category)),
  ];
  const questions = [];

  for (const el of targets) {
    const catLabel = categoryLabels[el.category] || el.category;
    const sameFamily = pool.filter((e) => e.category === el.category);
    const sameFamilyNames = sameFamily.map((e) => e.name);

    // --- Lean ID (core) ---
    const nameD = pickDistractors(names, el.name, 3);
    if (nameD.length === 3) {
      questions.push({
        id: `el-sym-${el.Z}`,
        prompt: `What element has the symbol ${el.symbol}?`,
        choices: makeChoices(el.name, nameD),
        correct: el.name,
      });
      questions.push({
        id: `el-zname-${el.Z}`,
        prompt: `Which element has atomic number ${el.Z}?`,
        choices: makeChoices(el.name, nameD),
        correct: el.name,
      });
    }

    const symD = pickDistractors(symbols, el.symbol, 3);
    if (symD.length === 3) {
      questions.push({
        id: `el-name-sym-${el.Z}`,
        prompt: `What is the chemical symbol for ${el.name}?`,
        choices: makeChoices(el.symbol, symD),
        correct: el.symbol,
      });
    }

    const numD = pickDistractors(numbers, String(el.Z), 3);
    if (numD.length === 3) {
      questions.push({
        id: `el-name-z-${el.Z}`,
        prompt: `What is the atomic number of ${el.name}?`,
        choices: makeChoices(String(el.Z), numD),
        correct: String(el.Z),
      });
    }

    // --- Name → position ---
    if (categories.length >= 4) {
      const catD = pickDistractors(categories, catLabel, 3);
      if (catD.length === 3) {
        questions.push({
          id: `el-cat-${el.Z}`,
          prompt: `Which family does ${el.name} belong to?`,
          choices: makeChoices(catLabel, catD),
          correct: catLabel,
        });
      }
    }

    const periodPool = [...new Set(pool.map((e) => String(e.period)))];
    if (periodPool.length >= 4) {
      const periodD = pickDistractors(periodPool, String(el.period), 3);
      if (periodD.length === 3) {
        questions.push({
          id: `el-period-${el.Z}`,
          prompt: `Which period is ${el.name} in?`,
          choices: makeChoices(String(el.period), periodD),
          correct: String(el.period),
        });
      }
    }

    // --- Position → element (sparse: family+Z, or period+group — not a full dossier) ---
    const familyNameD =
      sameFamilyNames.length >= 4
        ? pickDistractors(sameFamilyNames, el.name, 3)
        : pickDistractors(names, el.name, 3);
    if (familyNameD.length === 3) {
      questions.push({
        id: `el-family-z-${el.Z}`,
        prompt: `Which ${catLabel.toLowerCase()} has atomic number ${el.Z}?`,
        choices: makeChoices(el.name, familyNameD),
        correct: el.name,
      });
    }

    if (el.group != null && el.period != null) {
      const posKey = `${el.period}:${el.group}`;
      const posUnique =
        pool.filter((e) => `${e.period}:${e.group}` === posKey).length === 1;
      if (posUnique) {
        const posD = pickDistractors(names, el.name, 3);
        if (posD.length === 3) {
          questions.push({
            id: `el-pos-${el.Z}`,
            prompt: `Which element sits in period ${el.period}, group ${el.group}?`,
            choices: makeChoices(el.name, posD),
            correct: el.name,
          });
        }
      }
    }

    // --- Property → element (one fact, no Z/group in the prompt; skip name leaks) ---
    const usableFacts = (el.facts || []).filter(
      (fact) => !factMentionsName(fact, el.name)
    );
    if (usableFacts.length) {
      const fact = usableFacts[0];
      const factD = pickDistractors(names, el.name, 3);
      if (factD.length === 3) {
        questions.push({
          id: `el-fact-${el.Z}-0`,
          prompt: `Which element does this describe?\n“${fact}”`,
          choices: makeChoices(el.name, factD),
          correct: el.name,
        });
      }
    }
  }

  return shuffle(questions);
}

/**
 * Easy mode: one question per element with a full clue sheet
 * (Z, family, period/group, discovery, naming, facts) — pick the name.
 * Omits symbol and any fact that names the element.
 */
export function buildEasyElementQuestions(
  focusElements,
  allElements,
  categoryLabels = {}
) {
  const targets = focusElements || [];
  const pool = allElements?.length ? allElements : targets;
  if (targets.length < 1 || pool.length < 4) return [];

  const names = pool.map((e) => e.name);
  const questions = [];

  for (const el of targets) {
    const nameD = pickDistractors(names, el.name, 3);
    if (nameD.length < 3) continue;

    const catLabel = categoryLabels[el.category] || el.category;
    const lines = [
      `Atomic number: ${el.Z}`,
      `Family: ${catLabel}`,
    ];
    if (el.period != null) lines.push(`Period: ${el.period}`);
    if (el.group != null && Number(el.group) > 0) {
      lines.push(`Group: ${el.group}`);
    }
    if (el.atomicMass) lines.push(`Atomic mass: ${el.atomicMass}`);
    if (el.discoveredBy) {
      const when = el.discoveredYear ? ` (${el.discoveredYear})` : "";
      lines.push(`Discovered / first noted: ${el.discoveredBy}${when}`);
    }
    if (el.namedAfter) lines.push(`Name origin: ${el.namedAfter}`);

    const facts = (el.facts || []).filter(
      (fact) => !factMentionsName(fact, el.name)
    );
    if (facts.length) {
      lines.push("Facts:");
      for (const fact of facts) lines.push(`• ${fact}`);
    }

    questions.push({
      id: `el-easy-${el.Z}`,
      prompt: `Which element matches this profile?\n\n${lines.join("\n")}`,
      choices: makeChoices(el.name, nameD),
      correct: el.name,
    });
  }

  return shuffle(questions);
}

function factMentionsName(fact, name) {
  const escaped = String(name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i").test(fact);
}

export function createRotation(questions) {
  return {
    remaining: shuffle(questions),
    answered: 0,
    removed: 0,
    kept: 0,
    correctCount: 0,
    wrongCount: 0,
  };
}

export function currentQuestion(rotation) {
  return rotation.remaining[0] ?? null;
}

export function recordAnswer(rotation, choice) {
  const question = currentQuestion(rotation);
  if (!question) return null;
  const isCorrect = choice === question.correct;
  rotation.answered += 1;
  if (isCorrect) rotation.correctCount += 1;
  else rotation.wrongCount += 1;
  return { question, isCorrect, choice };
}

export function keepInRotation(rotation) {
  if (rotation.remaining.length === 0) return;
  const [q, ...rest] = rotation.remaining;
  rotation.remaining = shuffle([...rest, q]);
  rotation.kept += 1;
}

export function removeFromRotation(rotation) {
  if (rotation.remaining.length === 0) return;
  rotation.remaining = rotation.remaining.slice(1);
  rotation.removed += 1;
}
