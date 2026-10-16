import { describe, expect, it } from "vitest";
import { parseBackup, mergeByUpdatedAt } from "./backup";
import { buildTutorPrompt, mapGeminiError, modelCandidates, parseStructured, splitFollowUps, aiQuizSchema } from "./ai";
import { answerIsCorrect, scoreQuiz, type QuizQuestion } from "./quiz";
import {
  addDays,
  buildReminders,
  checklistProgress,
  defaultPreferences,
  displayDate,
  elapsedSeconds,
  finishClock,
  localToday,
  nextDueDate,
  nextOpenDate,
  pauseClock,
  plannedMinutes,
  revisionPriority,
  revisionSchedule,
  roadmapProgress,
  studyStreak,
  zonedTimeToUtc,
} from "./study";
import { buildSeedQuestions, ROADMAP, topicItems } from "../roadmap";

describe("roadmap", () => {
  it("keeps all 30 dated days from the plan", () => {
    expect(ROADMAP).toHaveLength(30);
    expect(ROADMAP[0]).toMatchObject({ id: "day-2026-10-17", date: "2026-10-17", title: "HTML" });
    expect(ROADMAP.at(-1)).toMatchObject({ date: "2026-11-15", title: "Final revision and mock interview" });
    expect(ROADMAP.find((day) => day.date === "2026-10-20")?.holiday).toBe(true);
    expect(new Set(ROADMAP.map((day) => day.id)).size).toBe(30);
  });

  it("gives every concept a stable id", () => {
    const items = topicItems(ROADMAP[0]);
    expect(items[0].id).toBe("day-2026-10-17:b0:c0");
    expect(items.some((item) => item.kind === "practice")).toBe(true);
    expect(buildSeedQuestions().length).toBeGreaterThan(60);
  });
});

describe("progress and streak", () => {
  it("calculates checklist and roadmap ratios from records", () => {
    const progress = checklistProgress(["a", "b", "c"], new Set(["a"]));
    expect(progress).toMatchObject({ done: 1, total: 3, complete: false });
    expect(roadmapProgress([{ complete: true }, { complete: false }]).ratio).toBe(0.5);
  });

  it("counts a calendar day once", () => {
    const streak = studyStreak(["2026-10-17", "2026-10-17", "2026-10-18"], "2026-10-18");
    expect(streak.current).toBe(2);
    expect(studyStreak(["2026-10-17"], "2026-10-19").current).toBe(0);
  });
});

describe("timer", () => {
  it("adds wall-clock time once while running and freezes when paused", () => {
    const start = new Date("2026-10-17T14:30:00.000Z");
    const running = { status: "running" as const, elapsedSeconds: 10, lastResumedAt: start.toISOString() };
    const later = new Date(start.getTime() + 30_000);
    expect(elapsedSeconds(running, later)).toBe(40);
    const paused = pauseClock(running, later);
    expect(elapsedSeconds(paused, new Date(later.getTime() + 60_000))).toBe(40);
    expect(finishClock(paused, later).status).toBe("finished");
  });
});

describe("revision and schedule", () => {
  it("spaces reviews one, three, and seven days apart", () => {
    expect(revisionSchedule("2026-10-17")).toEqual(["2026-10-18", "2026-10-21", "2026-10-28"]);
    expect(nextDueDate("2026-10-17", 1)).toBe("2026-10-18");
  });

  it("ranks an overdue low-confidence topic higher", () => {
    const overdue = revisionPriority({ dueDate: "2026-10-16", today: "2026-10-18", confidence: 1, topicAccuracy: 0.2 });
    const later = revisionPriority({ dueDate: "2026-10-20", today: "2026-10-18", confidence: 5, topicAccuracy: 1 });
    expect(overdue).toBeGreaterThan(later);
  });

  it("uses office, weekend, and holiday durations", () => {
    expect(plannedMinutes("2026-10-19", false, defaultPreferences)).toBe(120);
    expect(plannedMinutes("2026-10-17", false, defaultPreferences)).toBe(360);
    expect(plannedMinutes("2026-10-20", true, defaultPreferences)).toBe(330);
  });

  it("keeps the original calendar unless the user restarts", () => {
    expect(displayDate("2026-10-17", null, defaultPreferences)).toBe("2026-10-17");
    expect(displayDate("2026-10-17", null, { anchorChoice: "restart", anchorDate: "2026-10-20" })).toBe("2026-10-20");
    expect(displayDate("2026-10-17", "2026-11-16", defaultPreferences)).toBe("2026-11-16");
  });

  it("does not place a moved topic on an occupied date", () => {
    expect(nextOpenDate("2026-10-18", new Set(["2026-10-18", "2026-10-19"]), [])).toBe("2026-10-20");
  });

  it("maps 20:00 in India to 14:30 UTC", () => {
    expect(zonedTimeToUtc("2026-10-17", "20:00").toISOString()).toBe("2026-10-17T14:30:00.000Z");
  });

  it("returns no reminders when notifications are off", () => {
    const reminders = buildReminders({
      now: new Date("2026-10-17T10:00:00.000Z"),
      today: "2026-10-17",
      prefs: { ...defaultPreferences, notificationsEnabled: false },
      studyTitle: "HTML",
      studyHref: "/roadmap/day-2026-10-17",
      revisions: [],
      unfinishedCount: 3,
      weekDone: 0,
      weekTotal: 7,
    });
    expect(reminders).toEqual([]);
  });
});

describe("quiz scoring", () => {
  const questions: QuizQuestion[] = [
    {
      id: "q1",
      dayId: "day-2026-10-22",
      kind: "output",
      prompt: "order",
      choices: [],
      answer: "A D C B",
      keywords: [],
      explanation: "microtasks first",
      topic: "Event loop",
      source: "seed",
    },
    {
      id: "q2",
      dayId: "day-2026-10-22",
      kind: "short",
      prompt: "why",
      choices: [],
      answer: "retry",
      keywords: ["retry"],
      explanation: "retries",
      topic: "Promises",
      source: "seed",
    },
  ];

  it("scores output exactly and keywords loosely", () => {
    expect(answerIsCorrect(questions[0], "a d c b")).toBe(true);
    expect(answerIsCorrect(questions[0], "A B C D")).toBe(false);
    const result = scoreQuiz(questions, { q1: "A D C B", q2: "a retry can happen" });
    expect(result.score).toBe(2);
    const missed = scoreQuiz(questions, { q1: "nope", q2: "" });
    expect(missed.weakTopics).toEqual(["Event loop", "Promises"]);
  });
});

describe("backup and AI parsing", () => {
  it("rejects an unknown backup file", () => {
    expect(parseBackup({ hello: true }).ok).toBe(false);
  });

  it("keeps the newer copy when timestamps differ", () => {
    const merged = mergeByUpdatedAt(
      [{ id: "n1", updatedAt: "2026-10-17T00:00:00.000Z", title: "old" }],
      [{ id: "n1", updatedAt: "2026-10-18T00:00:00.000Z", title: "new" }],
    );
    expect(merged[0].title).toBe("new");
  });

  it("rejects a malformed quiz payload", () => {
    expect(parseStructured(aiQuizSchema, "sure, here you go").ok).toBe(false);
    const parsed = parseStructured(aiQuizSchema, JSON.stringify({
      questions: [{ kind: "mcq", prompt: "What is HTML?", choices: ["a language", "a database"], answer: "a language", explanation: "HTML describes a document.", topic: "HTML" }],
    }));
    expect(parsed.ok).toBe(true);
  });

  it("sends only the selected day and attached notes", () => {
    const prompt = buildTutorPrompt({
      style: "beginner",
      day: { date: "2026-10-17", title: "HTML", objective: "Explain semantic tags", concepts: ["main"] },
      notes: [{ title: "Mine", body: "alt text" }],
      history: Array.from({ length: 12 }, (_, index) => {
        const role: "user" | "assistant" = index % 2 === 0 ? "user" : "assistant";
        return { role, content: `m${index}` };
      }),
      userText: "Explain main",
    });
    expect(prompt.system).toContain("HTML");
    expect(prompt.system).toContain("alt text");
    expect(prompt.contents.length).toBe(9);
  });

  it("maps quota and model errors without leaking a body", () => {
    expect(mapGeminiError(429).code).toBe("quota");
    expect(mapGeminiError(404).message).not.toContain("API_KEY");
    expect(modelCandidates("gemini-2.5-flash")[0]).toBe("gemini-2.5-flash");
    expect(modelCandidates(undefined)).toEqual(["gemini-3.5-flash", "gemini-3.6-flash"]);
    expect(splitFollowUps("Hello\nFOLLOW_UPS: One | Two").followUps).toEqual(["One", "Two"]);
  });
});

describe("local date", () => {
  it("uses the India calendar", () => {
    expect(localToday(new Date("2026-10-16T18:31:00.000Z"))).toBe("2026-10-17");
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
  });
});
