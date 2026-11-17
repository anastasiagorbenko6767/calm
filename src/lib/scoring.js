// Подсчёт баллов. Используется и в браузере, и на сервере,
// чтобы результат считался одинаково и его нельзя было подделать запросом.

export function validAnswers(quiz, answers) {
  if (!Array.isArray(answers) || answers.length !== quiz.questions.length) return false;
  return quiz.questions.every((q, i) => {
    const options = q.options || quiz.options;
    return options.some((o) => o.value === answers[i]);
  });
}

// Значение ответа с учётом обратного подсчёта (reverse): минимум + максимум - ответ
function itemValue(quiz, q, v) {
  const min = quiz.minOption ?? 0;
  return q.reverse ? min + quiz.maxOption - v : v;
}

// Границы уровней в процентах: меньше bands[0] - низкий, до bands[1] включительно - средний, выше - высокий
function bandText(scale, percent) {
  const [lowEnd, midEnd] = scale.bands || [40, 60];
  if (percent < lowEnd) return scale.lowText;
  if (percent <= midEnd) return scale.midText;
  return scale.highText;
}

export function computeResult(quiz, answers) {
  // Тест с несколькими шкалами (например, Big Five)
  if (quiz.scales) {
    const min = quiz.minOption ?? 0;
    const scales = quiz.scales.map((scale) => {
      const items = quiz.questions.map((q, i) => ({ q, v: answers[i] })).filter(({ q }) => q.scale === scale.id);
      const sum = items.reduce((s, { q, v }) => s + itemValue(quiz, q, v), 0);
      const lo = items.length * min;
      const hi = items.length * quiz.maxOption;
      const percent = Math.round(((sum - lo) / (hi - lo)) * 100);
      return { id: scale.id, title: scale.title, low: scale.low, high: scale.high, percent, text: bandText(scale, percent) };
    });
    return { score: 0, maxScore: 0, level: quiz.summary, scales };
  }

  // Обычный тест: сумма баллов и расшифровка по диапазонам
  const mult = quiz.multiplier ?? 1;
  const scored = quiz.questions.map((q, i) => ({ q, v: answers[i] })).filter(({ q }) => q.scored !== false);
  const score = scored.reduce((sum, { q, v }) => sum + itemValue(quiz, q, v), 0) * mult;
  const maxScore = scored.length * quiz.maxOption * mult;
  const level = quiz.levels.find((l) => score >= l.min && score <= l.max);
  return { score, maxScore, level };
}
