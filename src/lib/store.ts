import { randomUUID } from "node:crypto";
import { connectDB } from "@/lib/db";
import {
  AiCacheModel,
  AttemptModel,
  CompletionModel,
  ConversationModel,
  DayModel,
  DayStateModel,
  MessageModel,
  NoteModel,
  PreferenceModel,
  QuestionModel,
  RevisionModel,
  SessionModel,
} from "@/lib/models";
import { conceptsOf, interviewPrompts, ROADMAP, buildSeedQuestions, topicItems, type RoadmapDay } from "@/lib/roadmap";
import { examples } from "@/data/examples";
import type { QuizQuestion } from "@/lib/domain/quiz";
import { scoreQuiz, topicAccuracy } from "@/lib/domain/quiz";
import { parseBackup, type BackupFile } from "@/lib/domain/backup";
import {
  addDays,
  buildReminders,
  checklistProgress,
  defaultPreferences,
  displayDate,
  elapsedSeconds,
  finishClock,
  greeting,
  localToday,
  nextOpenDate,
  pauseClock,
  plannedMinutes,
  resumeClock,
  revisionPriority,
  revisionSchedule,
  roadmapProgress,
  studyStreak,
  type Preferences,
  type SessionClock,
} from "@/lib/domain/study";

let seeded = false;

export async function ensureReady() {
  await connectDB();
  if (seeded) return;
  await DayModel.bulkWrite(
    ROADMAP.map((day) => ({
      updateOne: { filter: { _id: day.id }, update: { $set: day }, upsert: true },
    })),
  );
  const questions = buildSeedQuestions();
  await QuestionModel.bulkWrite(
    questions.map((question) => ({
      updateOne: { filter: { _id: question.id }, update: { $set: question }, upsert: true },
    })),
  );
  await PreferenceModel.updateOne(
    { _id: "user" },
    { $setOnInsert: { data: defaultPreferences, updatedAt: new Date().toISOString() } },
    { upsert: true },
  );
  seeded = true;
}

async function rows<T extends Record<string, unknown>>(query: Promise<unknown>): Promise<(T & { id: string })[]> {
  const docs = (await query) as ({ _id: string } & T)[];
  return docs.map((doc) => ({ ...doc, id: String(doc._id) }));
}

export async function getPrefs(): Promise<Preferences> {
  await ensureReady();
  const doc = await PreferenceModel.findById("user").lean<{ data?: Partial<Preferences> }>();
  return {
    ...defaultPreferences,
    ...doc?.data,
    notificationTypes: { ...defaultPreferences.notificationTypes, ...doc?.data?.notificationTypes },
  };
}

export async function savePrefs(patch: Partial<Preferences>) {
  const current = await getPrefs();
  const next = {
    ...current,
    ...patch,
    notificationTypes: { ...current.notificationTypes, ...patch.notificationTypes },
  };
  await PreferenceModel.updateOne(
    { _id: "user" },
    { $set: { data: next, updatedAt: new Date().toISOString() } },
    { upsert: true },
  );
  return next;
}

export async function listCompletions() {
  await ensureReady();
  return rows<{ dayId: string; completedAt: string | null; updatedAt: string }>(CompletionModel.find().lean());
}

export async function listStates() {
  await ensureReady();
  return rows<{
    completedAt: string | null;
    skippedAt: string | null;
    scheduledDate: string | null;
    personalNotes: string;
    updatedAt: string;
  }>(DayStateModel.find().lean());
}

function dayViews(prefs: Preferences, completed: Set<string>, states: Awaited<ReturnType<typeof listStates>>, today: string) {
  return ROADMAP.map((day) => {
    const state = states.find((item) => item.id === day.id);
    const shown = displayDate(day.date, state?.scheduledDate, prefs);
    const items = topicItems(day);
    const progress = checklistProgress(items.map((item) => item.id), completed);
    return {
      day,
      items,
      shown,
      progress,
      state,
      missed: shown < today && !progress.complete && !state?.skippedAt,
      skipped: Boolean(state?.skippedAt),
    };
  });
}

export async function getDashboard(now = new Date()) {
  await ensureReady();
  const prefs = await getPrefs();
  const today = localToday(now);
  const completions = await listCompletions();
  const states = await listStates();
  const completed = new Set(completions.filter((item) => item.completedAt).map((item) => item.id));
  const views = dayViews(prefs, completed, states, today);
  const todayView = views.find((view) => view.shown === today) ?? null;
  const nextView = views.find((view) => view.shown > today && !view.progress.complete) ?? null;
  const sessions = await rows<{
    dayId: string;
    plannedSeconds: number;
    elapsedSeconds: number;
    status: "running" | "paused" | "finished";
    lastResumedAt: string | null;
    finishedAt: string | null;
    startedAt: string;
  }>(SessionModel.find().lean());
  const activity = new Set<string>();
  for (const view of views) if (view.progress.complete) activity.add(view.shown);
  for (const session of sessions) {
    if (session.status === "finished" && session.finishedAt) activity.add(localToday(new Date(session.finishedAt)));
  }
  const notes = await rows<{ title: string; dayId: string | null; updatedAt: string; pinned: boolean }>(
    NoteModel.find().sort({ pinned: -1, updatedAt: -1 }).limit(4).lean(),
  );
  const revisions = await rows<{
    dayId: string | null;
    noteId: string | null;
    title: string;
    dueDate: string;
    status: string;
    confidence: number | null;
  }>(RevisionModel.find({ status: "pending" }).lean());
  const attempts = await rows<{ score: number; total: number; weakTopics: string[]; dayId: string }>(AttemptModel.find().lean());
  const questions = await rows<{ topic: string; dayId: string }>(QuestionModel.find().lean());
  const topicByDay = new Map(questions.map((question) => [question.dayId, question.topic]));
  const flat = attempts.flatMap((attempt) =>
    (attempt.weakTopics ?? []).map((topic) => ({ topic, correct: false as const })),
  );
  const accuracy = topicAccuracy([
    ...flat,
    ...attempts.map((attempt) => ({
      topic: topicByDay.get(attempt.dayId) ?? "General",
      correct: attempt.total > 0 && attempt.score === attempt.total,
    })),
  ]);
  const ranked = revisions
    .map((item) => ({
      ...item,
      href: item.noteId ? `/notes/${item.noteId}` : item.dayId ? `/roadmap/${item.dayId}` : "/roadmap",
      priority: revisionPriority({
        dueDate: item.dueDate,
        today,
        confidence: item.confidence,
        topicAccuracy: item.dayId ? (accuracy[topicByDay.get(item.dayId) ?? ""] ?? null) : null,
      }),
    }))
    .sort((a, b) => b.priority - a.priority);
  const studySeconds = sessions.reduce((sum, session) => sum + elapsedSeconds(session, now), 0);
  const plannedToDate = views
    .filter((view) => view.shown <= today)
    .reduce((sum, view) => sum + plannedMinutes(view.shown, view.day.holiday, prefs), 0);
  const quizScore = attempts.reduce((sum, attempt) => sum + attempt.score, 0);
  const quizTotal = attempts.reduce((sum, attempt) => sum + attempt.total, 0);
  const week = todayView?.day.weekId ?? nextView?.day.weekId ?? "week-1";
  const weekViews = views.filter((view) => view.day.weekId === week);
  const reminders = buildReminders({
    now,
    today,
    prefs,
    studyTitle: (todayView ?? nextView)?.day.title ?? null,
    studyHref: (todayView ?? nextView) ? `/roadmap/${(todayView ?? nextView)!.day.id}` : null,
    revisions: ranked.filter((item) => item.dueDate <= today).map((item) => ({ id: item.id, title: item.title, href: item.href, dueDate: item.dueDate })),
    unfinishedCount: views.filter((view) => view.missed).length,
    weekDone: weekViews.filter((view) => view.progress.complete).length,
    weekTotal: weekViews.length,
  });
  const weakTopics = [...new Set(attempts.flatMap((attempt) => attempt.weakTopics ?? []))].slice(0, 5);
  return {
    today,
    greeting: greeting(now),
    prefs,
    todayView,
    nextView,
    views,
    roadmap: roadmapProgress(views.map((view) => ({ complete: view.progress.complete }))),
    streak: studyStreak([...activity], today),
    notes,
    revisions: ranked.slice(0, 5),
    reminders,
    studyMinutes: Math.round(studySeconds / 60),
    plannedToDate,
    quizAccuracy: quizTotal === 0 ? null : quizScore / quizTotal,
    weakTopics,
    weekly: ["week-1", "week-2", "week-3", "week-4", "final-weekend"].map((weekId) => {
      const group = views.filter((view) => view.day.weekId === weekId);
      return {
        weekId,
        title: group[0]?.day.weekTitle ?? weekId,
        done: group.filter((view) => view.progress.complete).length,
        total: group.length,
      };
    }),
    missed: views.filter((view) => view.missed),
    anchorNeeded: today > "2026-10-17" && prefs.anchorChoice == null,
    sessionsThisWeek: sessions.filter((session) => {
      const date = localToday(new Date(session.startedAt));
      return views.some((view) => view.day.weekId === week && view.shown === date);
    }).length,
  };
}

export async function getDayDetail(dayId: string, now = new Date()) {
  const dashboard = await getDashboard(now);
  const view = dashboard.views.find((item) => item.day.id === dayId);
  if (!view) return null;
  const questions = await rows<QuizQuestion>(QuestionModel.find({ dayId, source: "seed" }).lean());
  const cachedInterview = await getAiCache<{ prompts: string[] }>(`interview:${dayId}`);
  return {
    ...view,
    example: examples[dayId] ?? null,
    interview: cachedInterview?.prompts?.length ? cachedInterview.prompts : interviewPrompts(view.day),
    interviewIsAi: Boolean(cachedInterview?.prompts?.length),
    concepts: conceptsOf(view.day),
    questionCount: questions.length,
    prefs: dashboard.prefs,
  };
}

export async function setItemComplete(itemId: string, dayId: string, complete: boolean) {
  await ensureReady();
  const now = new Date().toISOString();
  await CompletionModel.updateOne(
    { _id: itemId },
    { $set: { dayId, completedAt: complete ? now : null, updatedAt: now } },
    { upsert: true },
  );
  const day = ROADMAP.find((item) => item.id === dayId);
  if (!day) return;
  const items = topicItems(day);
  const completions = await CompletionModel.find({ dayId }).lean<{ _id: string; completedAt: string | null }[]>();
  const done = new Set(completions.filter((item) => item.completedAt).map((item) => item._id));
  const progress = checklistProgress(items.map((item) => item.id), done);
  const state = await DayStateModel.findById(dayId).lean<{ personalNotes?: string; skippedAt?: string | null; scheduledDate?: string | null }>();
  await DayStateModel.updateOne(
    { _id: dayId },
    {
      $set: {
        completedAt: progress.complete ? now : null,
        personalNotes: state?.personalNotes ?? "",
        skippedAt: state?.skippedAt ?? null,
        scheduledDate: state?.scheduledDate ?? null,
        updatedAt: now,
      },
    },
    { upsert: true },
  );
}

export async function saveDayNotes(dayId: string, personalNotes: string) {
  await ensureReady();
  const now = new Date().toISOString();
  await DayStateModel.updateOne(
    { _id: dayId },
    { $set: { personalNotes: personalNotes.slice(0, 20_000), updatedAt: now } },
    { upsert: true },
  );
}

export async function appendDayNotes(dayId: string, addition: string) {
  await ensureReady();
  const doc = await DayStateModel.findById(dayId).lean<{ personalNotes?: string }>();
  const merged = [doc?.personalNotes?.trim() ?? "", addition.trim()].filter(Boolean).join("\n\n").slice(0, 20_000);
  await saveDayNotes(dayId, merged);
}

export async function skipDay(dayId: string) {
  await ensureReady();
  const now = new Date().toISOString();
  await DayStateModel.updateOne(
    { _id: dayId },
    { $set: { skippedAt: now, completedAt: null, updatedAt: now } },
    { upsert: true },
  );
}

export async function moveDay(dayId: string, today: string) {
  const dashboard = await getDashboard();
  const occupied = new Set(dashboard.views.filter((view) => view.day.id !== dayId).map((view) => view.shown));
  const slot = nextOpenDate(today, occupied, dashboard.prefs.holidays);
  const now = new Date().toISOString();
  await DayStateModel.updateOne(
    { _id: dayId },
    { $set: { scheduledDate: slot, updatedAt: now } },
    { upsert: true },
  );
  return slot;
}

export async function listNotes(query: { q?: string; tag?: string; pinned?: boolean; revision?: boolean }) {
  await ensureReady();
  const notes = await rows<{
    title: string;
    body: string;
    dayId: string | null;
    tags: string[];
    pinned: boolean;
    forRevision: boolean;
    createdAt: string;
    updatedAt: string;
  }>(NoteModel.find().sort({ pinned: -1, updatedAt: -1 }).lean());
  return notes.filter((note) => {
    if (query.pinned && !note.pinned) return false;
    if (query.revision && !note.forRevision) return false;
    if (query.tag && !note.tags.includes(query.tag)) return false;
    if (query.q) {
      const haystack = `${note.title} ${note.body} ${note.tags.join(" ")}`.toLowerCase();
      if (!haystack.includes(query.q.toLowerCase())) return false;
    }
    return true;
  });
}

export async function getNote(id: string) {
  await ensureReady();
  const doc = await NoteModel.findById(id).lean<{
    _id: string;
    title: string;
    body: string;
    dayId: string | null;
    tags: string[];
    pinned: boolean;
    forRevision: boolean;
    createdAt: string;
    updatedAt: string;
  }>();
  return doc ? { ...doc, id: doc._id } : null;
}

export async function saveNote(input: {
  id?: string;
  title: string;
  body: string;
  dayId: string | null;
  tags: string[];
  pinned: boolean;
  forRevision: boolean;
}) {
  await ensureReady();
  const now = new Date().toISOString();
  const id = input.id || randomUUID();
  const existing = await NoteModel.findById(id).lean<{ createdAt?: string }>();
  await NoteModel.updateOne(
    { _id: id },
    {
      $set: {
        title: input.title.slice(0, 200),
        body: input.body.slice(0, 100_000),
        dayId: input.dayId,
        tags: input.tags.slice(0, 20),
        pinned: input.pinned,
        forRevision: input.forRevision,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      },
    },
    { upsert: true },
  );
  return id;
}

export async function deleteNote(id: string) {
  await ensureReady();
  await NoteModel.deleteOne({ _id: id });
}

export async function listConversations() {
  await ensureReady();
  return rows<{ title: string; dayId: string | null; style: string; updatedAt: string }>(
    ConversationModel.find().sort({ updatedAt: -1 }).lean(),
  );
}

export async function getMessages(conversationId: string) {
  await ensureReady();
  return rows<{ conversationId: string; role: "user" | "assistant"; content: string; helpful: boolean | null; createdAt: string }>(
    MessageModel.find({ conversationId }).sort({ createdAt: 1 }).lean(),
  );
}

export async function createConversation(input: { title: string; dayId: string | null; style: string }) {
  await ensureReady();
  const now = new Date().toISOString();
  const id = randomUUID();
  await ConversationModel.create({ _id: id, ...input, createdAt: now, updatedAt: now });
  return id;
}

export async function addMessage(input: { conversationId: string; role: "user" | "assistant"; content: string }) {
  await ensureReady();
  const now = new Date().toISOString();
  const id = randomUUID();
  await MessageModel.create({ _id: id, ...input, helpful: null, createdAt: now });
  await ConversationModel.updateOne({ _id: input.conversationId }, { $set: { updatedAt: now } });
  return id;
}

export async function setHelpful(messageId: string, helpful: boolean) {
  await ensureReady();
  await MessageModel.updateOne({ _id: messageId }, { $set: { helpful } });
}

export async function deleteMessage(id: string) {
  await ensureReady();
  await MessageModel.deleteOne({ _id: id });
}

export async function deleteConversation(id: string) {
  await ensureReady();
  await MessageModel.deleteMany({ conversationId: id });
  await ConversationModel.deleteOne({ _id: id });
}

export async function clearChats() {
  await ensureReady();
  await MessageModel.deleteMany({});
  await ConversationModel.deleteMany({});
}

export async function deleteAllNotes() {
  await ensureReady();
  await NoteModel.deleteMany({});
}

export async function resetProgress() {
  await ensureReady();
  await CompletionModel.deleteMany({});
  await DayStateModel.deleteMany({});
  await SessionModel.deleteMany({});
  await AttemptModel.deleteMany({});
  await RevisionModel.deleteMany({});
}

export async function getSession(dayId: string) {
  await ensureReady();
  const doc = await SessionModel.findOne({ dayId, status: { $ne: "finished" } }).sort({ updatedAt: -1 }).lean<{
    _id: string;
    dayId: string;
    plannedSeconds: number;
    elapsedSeconds: number;
    status: "running" | "paused" | "finished";
    startedAt: string;
    lastResumedAt: string | null;
    finishedAt: string | null;
    notes: string;
    breakReminder: boolean;
    updatedAt: string;
  }>();
  return doc ? { ...doc, id: doc._id } : null;
}

export async function saveSession(input: {
  id?: string;
  dayId: string;
  plannedSeconds: number;
  clock: SessionClock;
  notes: string;
  breakReminder: boolean;
  startedAt?: string;
}) {
  await ensureReady();
  const now = new Date().toISOString();
  const id = input.id || randomUUID();
  await SessionModel.updateOne(
    { _id: id },
    {
      $set: {
        dayId: input.dayId,
        plannedSeconds: input.plannedSeconds,
        elapsedSeconds: input.clock.elapsedSeconds,
        status: input.clock.status,
        lastResumedAt: input.clock.lastResumedAt,
        finishedAt: input.clock.status === "finished" ? now : null,
        notes: input.notes.slice(0, 20_000),
        breakReminder: input.breakReminder,
        startedAt: input.startedAt ?? now,
        updatedAt: now,
      },
    },
    { upsert: true },
  );
  return id;
}

export { pauseClock, resumeClock, finishClock };

export async function listRevisions() {
  await ensureReady();
  return rows<{
    dayId: string | null;
    noteId: string | null;
    title: string;
    dueDate: string;
    intervalDays: number;
    stage: number;
    status: "pending" | "done";
    confidence: number | null;
    createdAt: string;
    updatedAt: string;
  }>(RevisionModel.find().sort({ dueDate: 1 }).lean());
}

export async function scheduleRevision(input: { dayId: string | null; noteId: string | null; title: string; from: string; intervalDays: number }) {
  await ensureReady();
  const now = new Date().toISOString();
  const dates = revisionSchedule(input.from, [input.intervalDays]);
  const id = randomUUID();
  await RevisionModel.create({
    _id: id,
    dayId: input.dayId,
    noteId: input.noteId,
    title: input.title.slice(0, 200),
    dueDate: dates[0],
    intervalDays: input.intervalDays,
    stage: 0,
    status: "pending",
    confidence: null,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function reviewRevision(id: string, confidence: number) {
  await ensureReady();
  const item = await RevisionModel.findById(id).lean<{ dueDate: string; stage: number; intervalDays: number }>();
  if (!item) return;
  const prefs = await getPrefs();
  const nextInterval = prefs.revisionIntervals[item.stage + 1];
  const now = new Date().toISOString();
  if (!nextInterval) {
    await RevisionModel.updateOne({ _id: id }, { $set: { status: "done", confidence, updatedAt: now } });
    return;
  }
  await RevisionModel.updateOne(
    { _id: id },
    {
      $set: {
        stage: item.stage + 1,
        dueDate: addDays(item.dueDate, nextInterval),
        intervalDays: nextInterval,
        confidence,
        status: "pending",
        updatedAt: now,
      },
    },
  );
}

export async function rescheduleRevision(id: string, dueDate: string) {
  await ensureReady();
  await RevisionModel.updateOne({ _id: id }, { $set: { dueDate, updatedAt: new Date().toISOString() } });
}

export async function questionsForDay(dayId: string) {
  await ensureReady();
  const docs = await rows<QuizQuestion>(QuestionModel.find({ dayId }).lean());
  return docs;
}

export async function publicQuestions(dayId: string) {
  const questions = await questionsForDay(dayId);
  return questions.map((question) => ({
    id: question.id,
    dayId: question.dayId,
    kind: question.kind,
    prompt: question.prompt,
    choices: question.choices ?? [],
    topic: question.topic,
    source: question.source,
  }));
}

export async function gradeQuiz(dayId: string, answers: Record<string, string>, startedAt: string) {
  const questions = await questionsForDay(dayId);
  const result = scoreQuiz(questions, answers);
  const now = new Date().toISOString();
  await AttemptModel.create({
    _id: randomUUID(),
    dayId,
    startedAt,
    finishedAt: now,
    score: result.score,
    total: result.total,
    durationSeconds: Math.max(0, Math.round((Date.parse(now) - Date.parse(startedAt)) / 1000)),
    answers,
    weakTopics: result.weakTopics,
  });
  if (result.weakTopics.length > 0) {
    await scheduleWeakTopicRevisions(dayId, result.weakTopics, localToday());
  }
  return result;
}

/** Create pending revision cards for missed quiz topics (deduped per day + topic). */
export async function scheduleWeakTopicRevisions(dayId: string, topics: string[], from: string) {
  await ensureReady();
  const prefs = await getPrefs();
  const interval = prefs.revisionIntervals[0] ?? 1;
  const existing = await rows<{ title: string }>(RevisionModel.find({ dayId, status: "pending" }).lean());
  const seen = new Set(existing.map((item) => item.title.toLowerCase()));
  for (const topic of topics.slice(0, 6)) {
    const title = `Quiz: ${topic}`.slice(0, 200);
    if (seen.has(title.toLowerCase())) continue;
    seen.add(title.toLowerCase());
    await scheduleRevision({ dayId, noteId: null, title, from, intervalDays: interval });
  }
}

export async function getAiCache<T>(id: string): Promise<T | null> {
  await ensureReady();
  const doc = await AiCacheModel.findById(id).lean<{ expiresAt?: string; payload?: T }>();
  if (!doc?.payload) return null;
  if (doc.expiresAt && doc.expiresAt < new Date().toISOString()) return null;
  return doc.payload;
}

export async function setAiCache(id: string, kind: string, payload: unknown, ttlHours: number, dayId: string | null = null) {
  await ensureReady();
  const now = new Date();
  const expires = new Date(now.getTime() + ttlHours * 60 * 60 * 1000).toISOString();
  await AiCacheModel.updateOne(
    { _id: id },
    {
      $set: {
        kind,
        dayId,
        payload,
        expiresAt: expires,
        updatedAt: now.toISOString(),
        createdAt: now.toISOString(),
      },
    },
    { upsert: true },
  );
}

export async function clearAiCache(id: string) {
  await ensureReady();
  await AiCacheModel.deleteOne({ _id: id });
}

export async function saveGeneratedQuestions(dayId: string, questions: Omit<QuizQuestion, "id" | "dayId" | "source" | "keywords">[]) {
  await ensureReady();
  const saved = questions.map((question, index) => ({
    ...question,
    keywords: [],
    id: `${dayId}:ai:${randomUUID()}`,
    dayId,
    source: "ai" as const,
    sort: index,
  }));
  await QuestionModel.insertMany(saved.map((question) => ({ ...question, _id: question.id })));
  return saved;
}

export async function exportData(): Promise<BackupFile> {
  await ensureReady();
  const prefs = await getPrefs();
  const [notes, completions, dayStates, sessions, quizAttempts, revisionItems] = await Promise.all([
    listNotes({}),
    listCompletions(),
    listStates(),
    rows<{
      dayId: string;
      plannedSeconds: number;
      elapsedSeconds: number;
      status: "running" | "paused" | "finished";
      startedAt: string;
      lastResumedAt: string | null;
      finishedAt: string | null;
      notes: string;
      updatedAt: string;
    }>(SessionModel.find().lean()),
    rows<{
      dayId: string;
      startedAt: string;
      finishedAt: string | null;
      score: number;
      total: number;
      durationSeconds: number;
      answers: Record<string, string>;
      weakTopics: string[];
    }>(AttemptModel.find().lean()),
    listRevisions(),
  ]);
  return {
    format: "studyos-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    notes: notes.map((note) => ({ ...note, dayId: note.dayId })),
    completions: completions.map((item) => ({ id: item.id, dayId: item.dayId, completedAt: item.completedAt, updatedAt: item.updatedAt })),
    dayStates: dayStates.map((item) => ({
      id: item.id,
      completedAt: item.completedAt,
      skippedAt: item.skippedAt,
      scheduledDate: item.scheduledDate,
      personalNotes: item.personalNotes ?? "",
      updatedAt: item.updatedAt,
    })),
    sessions,
    quizAttempts,
    revisionItems,
    preferences: prefs,
  };
}

export async function importData(input: unknown, replace: boolean) {
  const parsed = parseBackup(input);
  if (!parsed.ok) return parsed;
  await ensureReady();
  const noteIds = parsed.data.notes.map((note) => note.id);
  const existing = noteIds.length ? await NoteModel.countDocuments({ _id: { $in: noteIds } }) : 0;
  if (existing > 0 && !replace) {
    return { ok: false as const, error: `${existing} notes already exist. Confirm replace to overwrite them.` };
  }
  const now = new Date().toISOString();
  for (const note of parsed.data.notes) {
    await NoteModel.updateOne({ _id: note.id }, { $set: note }, { upsert: true });
  }
  for (const item of parsed.data.completions) {
    await CompletionModel.updateOne({ _id: item.id }, { $set: item }, { upsert: true });
  }
  for (const item of parsed.data.dayStates) {
    await DayStateModel.updateOne({ _id: item.id }, { $set: item }, { upsert: true });
  }
  for (const item of parsed.data.sessions) {
    await SessionModel.updateOne({ _id: item.id }, { $set: item }, { upsert: true });
  }
  for (const item of parsed.data.quizAttempts) {
    await AttemptModel.updateOne({ _id: item.id }, { $set: item }, { upsert: true });
  }
  for (const item of parsed.data.revisionItems) {
    await RevisionModel.updateOne({ _id: item.id }, { $set: item }, { upsert: true });
  }
  if (parsed.data.preferences && replace) {
    await PreferenceModel.updateOne({ _id: "user" }, { $set: { data: parsed.data.preferences, updatedAt: now } }, { upsert: true });
  }
  return { ok: true as const, error: "" };
}

export function dayOptions() {
  return ROADMAP.map((day) => ({ id: day.id, label: `${day.date} ${day.title}` }));
}

export type { RoadmapDay };
