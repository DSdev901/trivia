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
