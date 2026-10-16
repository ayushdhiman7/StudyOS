export type QuizKind = "mcq" | "short" | "output" | "coding" | "system";

export type QuizQuestion = {
  id: string;
  dayId: string;
  kind: QuizKind;
  prompt: string;
  choices: string[];
  answer: string;
  keywords: string[];
  explanation: string;
  topic: string;
  source: "seed" | "ai";
};

export function normalizeAnswer(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function answerIsCorrect(question: Pick<QuizQuestion, "kind" | "answer" | "keywords">, response: string): boolean {
  const given = normalizeAnswer(response);
  if (!given) return false;
  if (question.kind === "mcq" || question.kind === "output") {
    return given === normalizeAnswer(question.answer);
  }
  const keywords = question.keywords ?? [];
  if (keywords.length > 0) {
    return keywords.every((word) => given.includes(normalizeAnswer(word)));
  }
  return given === normalizeAnswer(question.answer);
}

export function scoreQuiz(questions: QuizQuestion[], responses: Record<string, string>) {
  const incorrect: {
    id: string;
    topic: string;
    prompt: string;
    response: string;
    answer: string;
    explanation: string;
  }[] = [];
  let score = 0;
  for (const question of questions) {
    const response = responses[question.id] ?? "";
    if (answerIsCorrect(question, response)) score += 1;
    else {
      incorrect.push({
        id: question.id,
        topic: question.topic,
        prompt: question.prompt,
        response,
        answer: question.answer,
        explanation: question.explanation,
      });
    }
  }
  const total = questions.length;
  const byTopic = new Map<string, { wrong: number; total: number }>();
  for (const question of questions) {
    const bucket = byTopic.get(question.topic) ?? { wrong: 0, total: 0 };
    bucket.total += 1;
    if (incorrect.some((item) => item.id === question.id)) bucket.wrong += 1;
    byTopic.set(question.topic, bucket);
  }
  const weakTopics = [...byTopic.entries()]
    .filter(([, bucket]) => bucket.wrong > 0)
    .sort((a, b) => b[1].wrong / b[1].total - a[1].wrong / a[1].total)
    .map(([topic]) => topic);
  return {
    score,
    total,
    accuracy: total === 0 ? 0 : score / total,
    weakTopics,
    incorrect,
  };
}

export function topicAccuracy(attempts: { topic: string; correct: boolean }[]): Record<string, number> {
  const buckets = new Map<string, { correct: number; total: number }>();
  for (const attempt of attempts) {
    const bucket = buckets.get(attempt.topic) ?? { correct: 0, total: 0 };
    bucket.total += 1;
    if (attempt.correct) bucket.correct += 1;
    buckets.set(attempt.topic, bucket);
  }
  return Object.fromEntries([...buckets.entries()].map(([topic, bucket]) => [topic, bucket.correct / bucket.total]));
}
