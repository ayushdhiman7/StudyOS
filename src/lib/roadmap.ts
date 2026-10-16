import raw from "@/data/roadmap.json";
import { curatedQuestions } from "@/data/quiz-bank";
import type { QuizQuestion } from "@/lib/domain/quiz";

export type RoadmapBlock = { title: string; concepts: string[] };

export type RoadmapDay = {
  id: string;
  date: string;
  weekday: string;
  weekId: string;
  weekTitle: string;
  title: string;
  targetLabel: string;
  targetMinutes: number;
  holiday: boolean;
  doneWhen: string;
  blocks: RoadmapBlock[];
  practice: string[];
};

export type TopicItem = {
  id: string;
  dayId: string;
  kind: "concept" | "practice";
  blockTitle: string | null;
  title: string;
  sortOrder: number;
};

export const ROADMAP: RoadmapDay[] = raw.days;

export function topicItems(day: RoadmapDay): TopicItem[] {
  const items: TopicItem[] = [];
  let order = 0;
  day.blocks.forEach((block, blockIndex) => {
    block.concepts.forEach((concept, conceptIndex) => {
      items.push({
        id: `${day.id}:b${blockIndex}:c${conceptIndex}`,
        dayId: day.id,
        kind: "concept",
        blockTitle: block.title,
        title: concept,
        sortOrder: order,
      });
      order += 1;
    });
  });
  day.practice.forEach((task, index) => {
    items.push({
      id: `${day.id}:p${index}`,
      dayId: day.id,
      kind: "practice",
      blockTitle: "Practice",
      title: task,
      sortOrder: order,
    });
    order += 1;
  });
  return items;
}

export function conceptsOf(day: RoadmapDay): string[] {
  return day.blocks.flatMap((block) => block.concepts);
}

function keywordsFrom(text: string): string[] {
  const stop = new Set(["which", "their", "there", "about", "would", "could", "should", "with", "from", "that", "this", "your", "into", "than"]);
  return text
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/)
    .filter((word) => word.length > 4 && !stop.has(word))
    .slice(0, 2);
}

function rotate<T>(items: T[], seed: string): T[] {
  if (items.length === 0) return items;
  const shift = [...seed].reduce((sum, char) => sum + char.charCodeAt(0), 0) % items.length;
  return [...items.slice(shift), ...items.slice(0, shift)];
}

export function buildSeedQuestions(days: RoadmapDay[] = ROADMAP): QuizQuestion[] {
  const pool = days.flatMap((day) => conceptsOf(day));
  const questions: QuizQuestion[] = [];
  for (const day of days) {
    const concepts = conceptsOf(day);
    const correct = concepts[0] ?? day.title;
    const distractors = pool.filter((concept) => !concepts.includes(concept)).slice(0, 8);
    const choices = rotate([correct, ...distractors].slice(0, 4), day.id);
    questions.push({
      id: `${day.id}:q:0`,
      dayId: day.id,
      kind: "mcq",
      prompt: `Which item is part of ${day.title}?`,
      choices,
      answer: correct,
      keywords: [],
      explanation: `${correct} is one of the ${day.title} subtopics in the plan.`,
      topic: day.title,
      source: "seed",
    });
    const practice = day.practice[0] ?? day.doneWhen;
    questions.push({
      id: `${day.id}:q:1`,
      dayId: day.id,
      kind: "short",
      prompt: `How would you complete this practice task: ${practice}`,
      choices: [],
      answer: practice,
      keywords: keywordsFrom(practice),
      explanation: `The plan asks you to: ${practice}`,
      topic: day.title,
      source: "seed",
    });
    for (const extra of curatedQuestions[day.date] ?? []) {
      questions.push({
        ...extra,
        id: `${day.id}:q:${questions.filter((question) => question.dayId === day.id).length}`,
        dayId: day.id,
        source: "seed",
      });
    }
  }
  return questions;
}

export function interviewPrompts(day: RoadmapDay): string[] {
  return conceptsOf(day)
    .slice(0, 3)
    .map((concept) => `Explain ${concept}. Include one trade-off or common mistake.`);
}
