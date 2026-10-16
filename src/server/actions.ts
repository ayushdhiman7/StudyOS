"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { conceptsOf, interviewPrompts, ROADMAP } from "@/lib/roadmap";
import {
  aiBriefSchema,
  aiExampleVariantSchema,
  aiInterviewPromptsSchema,
  aiInterviewScoreSchema,
  aiNotesSchema,
  aiPracticeTaskSchema,
  aiQuizSchema,
  aiSessionCheckSchema,
  aiSessionRecapSchema,
  aiWeeklyReviewSchema,
  buildTutorPrompt,
  parseStructured,
  responseStyles,
  splitFollowUps,
  type ResponseStyle,
} from "@/lib/domain/ai";
import { finishClock, localToday, pauseClock, resumeClock, type Preferences } from "@/lib/domain/study";
import { AiError, generateText } from "@/lib/gemini";
import {
  addMessage,
  clearChats,
  createConversation,
  deleteAllNotes,
  deleteConversation,
  deleteNote,
  deleteMessage,
  getAiCache,
  getDashboard,
  getMessages,
  getNote,
  getPrefs,
  getSession,
  gradeQuiz,
  importData,
  moveDay,
  resetProgress,
  reviewRevision,
  appendDayNotes,
  saveDayNotes,
  saveGeneratedQuestions,
  saveNote,
  savePrefs,
  saveSession,
  scheduleRevision,
  setAiCache,
  setHelpful,
  setItemComplete,
  skipDay,
  rescheduleRevision,
} from "@/lib/store";

function styleOf(value: FormDataEntryValue | null): ResponseStyle {
  const style = String(value ?? "beginner");
  return responseStyles.includes(style as ResponseStyle) ? (style as ResponseStyle) : "beginner";
}

export async function toggleItem(formData: FormData) {
  const itemId = String(formData.get("itemId") ?? "");
  const dayId = String(formData.get("dayId") ?? "");
  const complete = formData.get("complete") === "1";
  if (!itemId || !dayId) return;
  await setItemComplete(itemId, dayId, complete);
  revalidatePath("/");
  revalidatePath("/roadmap");
  revalidatePath(`/roadmap/${dayId}`);
}

export async function savePersonalNotes(formData: FormData) {
  const dayId = String(formData.get("dayId") ?? "");
  await saveDayNotes(dayId, String(formData.get("notes") ?? ""));
  revalidatePath(`/roadmap/${dayId}`);
}

export async function skipDayAction(formData: FormData) {
  const dayId = String(formData.get("dayId") ?? "");
  await skipDay(dayId);
  revalidatePath("/");
  revalidatePath("/roadmap");
  revalidatePath(`/roadmap/${dayId}`);
}

export async function moveDayAction(formData: FormData) {
  const dayId = String(formData.get("dayId") ?? "");
  const today = String(formData.get("today") ?? "");
  await moveDay(dayId, today);
  revalidatePath("/");
  revalidatePath("/roadmap");
  revalidatePath(`/roadmap/${dayId}`);
}

export async function chooseAnchor(formData: FormData) {
  const choice = formData.get("choice") === "restart" ? "restart" : "keep";
  const anchorDate = choice === "restart" ? String(formData.get("today") ?? "") : null;
  await savePrefs({ anchorChoice: choice, anchorDate });
  revalidatePath("/");
}

export async function saveNoteAction(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "");
  if (!title) return;
  const tags = String(formData.get("tags") ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  const id = await saveNote({
    id: String(formData.get("id") ?? "") || undefined,
    title,
    body,
    dayId: String(formData.get("dayId") ?? "") || null,
    tags,
    pinned: formData.get("pinned") === "on",
    forRevision: formData.get("forRevision") === "on",
  });
  revalidatePath("/notes");
  redirect(`/notes/${id}`);
}

export async function deleteNoteAction(formData: FormData) {
  if (formData.get("confirm") !== "yes") return;
  await deleteNote(String(formData.get("id") ?? ""));
  revalidatePath("/notes");
  redirect("/notes");
}

export async function scheduleRevisionAction(formData: FormData) {
  const interval = Number(formData.get("interval") ?? 1);
  await scheduleRevision({
    dayId: String(formData.get("dayId") ?? "") || null,
    noteId: String(formData.get("noteId") ?? "") || null,
    title: String(formData.get("title") ?? "Revision"),
    from: String(formData.get("from") ?? ""),
    intervalDays: Number.isFinite(interval) && interval > 0 ? interval : 1,
  });
  revalidatePath("/");
  revalidatePath("/profile");
}

export async function reviewRevisionAction(formData: FormData) {
  const confidence = Number(formData.get("confidence") ?? 3);
  await reviewRevision(String(formData.get("id") ?? ""), Math.min(5, Math.max(1, confidence)));
  revalidatePath("/");
}

export async function rescheduleRevisionAction(formData: FormData) {
  await rescheduleRevision(String(formData.get("id") ?? ""), String(formData.get("dueDate") ?? ""));
  revalidatePath("/");
}

export async function startOrUpdateSession(formData: FormData) {
  const dayId = String(formData.get("dayId") ?? "");
  const intent = String(formData.get("intent") ?? "start");
  const plannedSeconds = Number(formData.get("plannedSeconds") ?? 1500);
  const notes = String(formData.get("notes") ?? "");
  const breakReminder = formData.get("breakReminder") === "on";
  const existing = await getSession(dayId);
  const now = new Date();
  const base = existing ?? {
    id: undefined,
    status: "paused" as const,
    elapsedSeconds: 0,
    lastResumedAt: null,
    startedAt: now.toISOString(),
  };
  const clock =
    intent === "pause"
      ? pauseClock(base, now)
      : intent === "finish"
        ? finishClock(base, now)
        : resumeClock(base, now);
  await saveSession({
    id: existing?.id,
    dayId,
    plannedSeconds: existing?.plannedSeconds || plannedSeconds,
    clock,
    notes,
    breakReminder: existing?.breakReminder || breakReminder,
    startedAt: existing?.startedAt,
  });
  revalidatePath(`/session/${dayId}`);
  revalidatePath("/");
}

export async function gradeQuizAction(dayId: string, answers: Record<string, string>, startedAt: string) {
  const result = await gradeQuiz(dayId, answers, startedAt);
  revalidatePath("/");
  revalidatePath(`/quiz/${dayId}`);
  return result;
}

export async function saveSettings(formData: FormData) {
  const officeDays = formData.getAll("officeDays").map((value) => Number(value)).filter((value) => value >= 0 && value <= 6);
  const holidays = String(formData.get("holidays") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value));
  const intervals = String(formData.get("revisionIntervals") ?? "1,3,7")
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value) && value > 0);
  const patch: Partial<Preferences> = {
    theme: (["light", "dark", "system"].includes(String(formData.get("theme"))) ? String(formData.get("theme")) : "system") as Preferences["theme"],
    officeDays: officeDays.length ? officeDays : [1, 2, 3, 4, 5],
    workHours: String(formData.get("workHours") ?? "09:00-18:00"),
    studyStart: String(formData.get("studyStart") ?? "20:00"),
    officeMinutes: Number(formData.get("officeMinutes") ?? 120),
    weekendMinutes: Number(formData.get("weekendMinutes") ?? 360),
    holidayMinutes: Number(formData.get("holidayMinutes") ?? 330),
    holidays,
    reminderTime: String(formData.get("reminderTime") ?? "20:00"),
    notificationsEnabled: formData.get("notificationsEnabled") === "on",
    notificationTypes: {
      study: formData.get("notifyStudy") === "on",
      upcoming: formData.get("notifyUpcoming") === "on",
      session: formData.get("notifySession") === "on",
      revision: formData.get("notifyRevision") === "on",
      incomplete: formData.get("notifyIncomplete") === "on",
      weekly: formData.get("notifyWeekly") === "on",
    },
    revisionIntervals: intervals.length ? intervals : [1, 3, 7],
    aiStyle: styleOf(formData.get("aiStyle")),
  };
  await savePrefs(patch);
  revalidatePath("/");
  revalidatePath("/profile");
}

export async function saveTheme(theme: Preferences["theme"]) {
  if (theme !== "light" && theme !== "dark" && theme !== "system") return;
  await savePrefs({ theme });
}

export async function destructiveAction(formData: FormData) {
  if (formData.get("confirm") !== "yes") return;
  const kind = String(formData.get("kind") ?? "");
  if (kind === "chats") await clearChats();
  if (kind === "notes") await deleteAllNotes();
  if (kind === "progress") await resetProgress();
  revalidatePath("/");
  redirect("/profile");
}

export async function importBackupAction(raw: string, replace: boolean) {
  try {
    const result = await importData(JSON.parse(raw) as unknown, replace);
    if (result.ok) revalidatePath("/");
    return result;
  } catch {
    return { ok: false as const, error: "The file is not valid JSON." };
  }
}

async function tutorReply(input: { conversationId: string; text: string; style: ResponseStyle; dayId: string | null; noteIds: string[] }) {
  const day = input.dayId ? ROADMAP.find((item) => item.id === input.dayId) : undefined;
  const notes = [];
  for (const noteId of input.noteIds) {
    const note = await getNote(noteId);
    if (note) notes.push({ title: note.title, body: note.body });
  }
  const history = await getMessages(input.conversationId);
  const prompt = buildTutorPrompt({
    style: input.style,
    day: day ? { date: day.date, title: day.title, objective: day.doneWhen, concepts: conceptsOf(day) } : null,
    notes,
    history: history.slice(0, -1).map((message) => ({ role: message.role, content: message.content })),
    userText: input.text,
  });
  const raw = await generateText({ system: prompt.system, contents: prompt.contents, key: "tutor" });
  const split = splitFollowUps(raw);
  const content = split.followUps.length
    ? `${split.answer}\n\nFollow-ups:\n${split.followUps.map((item) => `- ${item}`).join("\n")}`
    : split.answer;
  await addMessage({ conversationId: input.conversationId, role: "assistant", content });
  return { error: null as string | null, followUps: split.followUps };
}

export async function sendChat(
  _prev: { error: string | null; followUps: string[]; conversationId: string },
  formData: FormData,
) {
  const text = String(formData.get("text") ?? "").trim();
  if (!text) return { error: "Write a question first.", followUps: [] as string[], conversationId: "" };
  const style = styleOf(formData.get("style"));
  const dayId = String(formData.get("dayId") ?? "") || null;
  const noteIds = formData.getAll("noteId").map(String).filter(Boolean);
  let conversationId = String(formData.get("conversationId") ?? "");
  try {
    if (!conversationId) conversationId = await createConversation({ title: text.slice(0, 80), dayId, style });
    await addMessage({ conversationId, role: "user", content: text });
    const result = await tutorReply({ conversationId, text, style, dayId, noteIds });
    revalidatePath("/tutor");
    return { ...result, conversationId };
  } catch (error) {
    const message = error instanceof AiError ? error.message : "The AI service is unavailable right now.";
    return { error: message, followUps: [] as string[], conversationId };
  }
}

export async function regenerateChat(formData: FormData) {
  const conversationId = String(formData.get("conversationId") ?? "");
  const messages = await getMessages(conversationId);
  const last = messages.at(-1);
  if (last?.role === "assistant") await deleteMessage(last.id);
  const user = [...messages].reverse().find((message) => message.role === "user");
  if (!user) return;
  const prefs = await getPrefs();
  try {
    await tutorReply({
      conversationId,
      text: user.content,
      style: prefs.aiStyle,
      dayId: String(formData.get("dayId") ?? "") || null,
      noteIds: formData.getAll("noteId").map(String),
    });
  } catch (error) {
    if (error instanceof AiError) return;
  }
  revalidatePath("/tutor");
}

export async function newChat() {
  const prefs = await getPrefs();
  const id = await createConversation({ title: "New chat", dayId: null, style: prefs.aiStyle });
  redirect(`/tutor?chat=${id}`);
}

export async function clearChat(formData: FormData) {
  if (formData.get("confirm") !== "yes") return;
  await deleteConversation(String(formData.get("conversationId") ?? ""));
  revalidatePath("/tutor");
  redirect("/tutor");
}

export async function feedbackAction(formData: FormData) {
  await setHelpful(String(formData.get("messageId") ?? ""), formData.get("helpful") === "yes");
  revalidatePath("/tutor");
}

export async function saveAnswerNote(formData: FormData) {
  const content = String(formData.get("content") ?? "");
  const dayId = String(formData.get("dayId") ?? "") || null;
  const id = await saveNote({
    title: String(formData.get("title") ?? "AI note").slice(0, 200),
    body: content,
    dayId,
    tags: ["ai"],
    pinned: false,
    forRevision: false,
  });
  revalidatePath("/notes");
  redirect(`/notes/${id}`);
}

export async function generateQuizAction(dayId: string, weakTopics: string[] = []) {
  const day = ROADMAP.find((item) => item.id === dayId);
  if (!day) return { ok: false as const, error: "That day is not in the plan.", questions: [] };
  const focus = weakTopics.filter(Boolean).slice(0, 6);
  const topicLine = focus.length
    ? `Focus ONLY on these weak topics: ${focus.join("; ")}. Write 4 questions that drill these gaps.`
    : "Use only this day's topics. 4 questions.";
  const prompt = buildTutorPrompt({
    style: "quiz",
    day: { date: day.date, title: day.title, objective: day.doneWhen, concepts: conceptsOf(day) },
    history: [],
    userText: `Return JSON only: {"questions":[{"kind":"mcq","prompt":"...","choices":["a","b","c","d"],"answer":"a","explanation":"...","topic":"..."}]}. ${topicLine}`,
  });
  try {
    const text = await generateText({ system: prompt.system, contents: prompt.contents, json: true, key: "quiz" });
    const parsed = parseStructured(aiQuizSchema, text);
    if (!parsed.ok) return { ok: false as const, error: parsed.error, questions: [] };
    const invalid = parsed.data.questions.some((question) => question.kind === "mcq" && !question.choices.includes(question.answer));
    if (invalid) return { ok: false as const, error: "The quiz had a choice that did not match its answer.", questions: [] };
    return { ok: true as const, error: "", questions: parsed.data.questions };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Quiz generation failed.", questions: [] };
  }
}

export async function confirmQuizAction(dayId: string, questions: { kind: "mcq" | "short" | "output" | "coding" | "system"; prompt: string; choices: string[]; answer: string; explanation: string; topic: string }[]) {
  await saveGeneratedQuestions(dayId, questions);
  revalidatePath(`/quiz/${dayId}`);
  return { ok: true as const };
}

export async function generateNotesAction(dayId: string) {
  const day = ROADMAP.find((item) => item.id === dayId);
  if (!day) return { ok: false as const, error: "That day is not in the plan.", note: null };
  const prompt = buildTutorPrompt({
    style: "revision",
    day: { date: day.date, title: day.title, objective: day.doneWhen, concepts: conceptsOf(day) },
    history: [],
    userText: "Return JSON only: {\"title\":\"...\",\"body\":\"...\",\"tags\":[\"revision\"]}. Body is plain text revision notes for this day.",
  });
  try {
    const text = await generateText({ system: prompt.system, contents: prompt.contents, json: true, key: "notes" });
    const parsed = parseStructured(aiNotesSchema, text);
    if (!parsed.ok) return { ok: false as const, error: parsed.error, note: null };
    return { ok: true as const, error: "", note: parsed.data };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Note generation failed.", note: null };
  }
}

export async function confirmNotesAction(dayId: string, note: { title: string; body: string; tags: string[] }) {
  const id = await saveNote({ ...note, dayId, pinned: false, forRevision: true });
  revalidatePath("/notes");
  return id;
}

export async function explainConceptAction(dayId: string, concept: string) {
  const day = ROADMAP.find((item) => item.id === dayId);
  const topic = concept.trim().slice(0, 500);
  if (!topic) return { ok: false as const, error: "Nothing to explain.", text: "" };
  const prompt = buildTutorPrompt({
    style: "beginner",
    day: day
      ? { date: day.date, title: day.title, objective: day.doneWhen, concepts: conceptsOf(day) }
      : null,
    history: [],
    userText: `Explain this checklist item or concept in plain language with one short example:\n${topic}`,
  });
  try {
    const raw = await generateText({ system: prompt.system, contents: prompt.contents, key: "explain-ui" });
    const split = splitFollowUps(raw);
    return { ok: true as const, error: "", text: split.answer };
  } catch (error) {
    return { ok: false as const, error: error instanceof AiError ? error.message : "Explain failed.", text: "" };
  }
}

export async function getDailyBriefAction() {
  const today = localToday();
  const cacheId = `brief:${today}`;
  const cached = await getAiCache<{ focus: string; reason: string; cta: string; dayId: string | null }>(cacheId);
  if (cached) return { ok: true as const, error: "", brief: cached, cached: true };
  const data = await getDashboard();
  const focus = data.todayView ?? data.nextView;
  if (!focus) {
    return {
      ok: true as const,
      error: "",
      brief: {
        focus: "No study day is scheduled right now. Open the roadmap when you are ready.",
        reason: "The 30-day plan is outside today.",
        cta: "Open roadmap",
        dayId: null as string | null,
      },
      cached: false,
    };
  }
  const streakDays = data.streak.current;
  const fallback = {
    focus: `Focus on ${focus.day.title}. Finish the checklist and one practice item.`,
    reason: data.weakTopics.length
      ? `Recent weak topics: ${data.weakTopics.slice(0, 3).join(", ")}.`
      : `Streak ${streakDays} day${streakDays === 1 ? "" : "s"}.`,
    cta: "Ask AI about today",
    dayId: focus.day.id,
  };
  const prompt = buildTutorPrompt({
    style: "revision",
    day: {
      date: focus.day.date,
      title: focus.day.title,
      objective: focus.day.doneWhen,
      concepts: conceptsOf(focus.day),
    },
    history: [],
    userText: `Return JSON only: {"focus":"...","reason":"...","cta":"..."}. focus is one short paragraph (max 2 sentences) for today's study. reason mentions streak ${streakDays} and weak topics [${data.weakTopics.join(", ")}] if any. cta is a short button label.`,
  });
  try {
    const text = await generateText({ system: prompt.system, contents: prompt.contents, json: true, key: "brief" });
    const parsed = parseStructured(aiBriefSchema, text);
    if (!parsed.ok) {
      await setAiCache(cacheId, "brief", fallback, 24, focus.day.id);
      return { ok: true as const, error: "", brief: fallback, cached: false };
    }
    const brief = { ...parsed.data, dayId: focus.day.id };
    await setAiCache(cacheId, "brief", brief, 24, focus.day.id);
    return { ok: true as const, error: "", brief, cached: false };
  } catch {
    await setAiCache(cacheId, "brief", fallback, 6, focus.day.id);
    return { ok: true as const, error: "", brief: fallback, cached: false };
  }
}

export async function startMockInterviewAction(dayId: string) {
  const day = ROADMAP.find((item) => item.id === dayId);
  if (!day) return { ok: false as const, error: "That day is not in the plan.", conversationId: "", prompt: "" };
  const prompts = interviewPrompts(day);
  const first = prompts[0] ?? `Explain ${day.title} as in a junior interview.`;
  const conversationId = await createConversation({
    title: `Mock interview · ${day.title}`.slice(0, 80),
    dayId,
    style: "interview",
  });
  await addMessage({
    conversationId,
    role: "assistant",
    content: `Mock interview for ${day.title}.\n\nQuestion 1: ${first}`,
  });
  revalidatePath("/tutor");
  return { ok: true as const, error: "", conversationId, prompt: first };
}

export async function scoreMockAnswerAction(conversationId: string, dayId: string, answer: string) {
  const day = ROADMAP.find((item) => item.id === dayId);
  if (!day) return { ok: false as const, error: "That day is not in the plan.", feedback: null };
  const text = answer.trim();
  if (!text) return { ok: false as const, error: "Write an answer first.", feedback: null };
  const history = await getMessages(conversationId);
  const lastAssistant = [...history].reverse().find((message) => message.role === "assistant");
  const promptAsked = lastAssistant?.content ?? interviewPrompts(day)[0] ?? day.title;
  await addMessage({ conversationId, role: "user", content: text });
  const remaining = interviewPrompts(day).filter((item) => !history.some((message) => message.content.includes(item)));
  const prompt = buildTutorPrompt({
    style: "interview",
    day: { date: day.date, title: day.title, objective: day.doneWhen, concepts: conceptsOf(day) },
    history: [],
    userText: `Score this interview answer. Question was:\n${promptAsked}\n\nCandidate answer:\n${text}\n\nReturn JSON only: {"score":0-5,"gaps":["..."],"betterAnswer":"...","nextPrompt":"optional next question"}. Prefer nextPrompt from: ${remaining.slice(0, 3).join(" | ") || "a related follow-up"}.`,
  });
  try {
    const raw = await generateText({ system: prompt.system, contents: prompt.contents, json: true, key: "mock" });
    const parsed = parseStructured(aiInterviewScoreSchema, raw);
    if (!parsed.ok) return { ok: false as const, error: parsed.error, feedback: null };
    const next = parsed.data.nextPrompt?.trim();
    const content = [
      `Score: ${parsed.data.score}/5`,
      parsed.data.gaps.length ? `Gaps:\n${parsed.data.gaps.map((gap) => `- ${gap}`).join("\n")}` : "Gaps: none major.",
      "",
      "Stronger answer:",
      parsed.data.betterAnswer,
      next ? `\nNext question: ${next}` : "\nThat wraps this mock round.",
    ].join("\n");
    await addMessage({ conversationId, role: "assistant", content });
    revalidatePath("/tutor");
    return { ok: true as const, error: "", feedback: parsed.data };
  } catch (error) {
    return { ok: false as const, error: error instanceof AiError ? error.message : "Scoring failed.", feedback: null };
  }
}

export async function sessionCheckAction(dayId: string) {
  const day = ROADMAP.find((item) => item.id === dayId);
  if (!day) return { ok: false as const, error: "Unknown day.", check: null };
  const prompt = buildTutorPrompt({
    style: "quiz",
    day: { date: day.date, title: day.title, objective: day.doneWhen, concepts: conceptsOf(day) },
    history: [],
    userText: 'Return JSON only: {"question":"...","hint":"..."}. One short check question for a mid-session pause. Hint only, not the full answer.',
  });
  try {
    const text = await generateText({ system: prompt.system, contents: prompt.contents, json: true, key: "session-check" });
    const parsed = parseStructured(aiSessionCheckSchema, text);
    if (!parsed.ok) return { ok: false as const, error: parsed.error, check: null };
    return { ok: true as const, error: "", check: parsed.data };
  } catch (error) {
    return { ok: false as const, error: error instanceof AiError ? error.message : "Check failed.", check: null };
  }
}

export async function sessionRecapAction(dayId: string, notes: string) {
  const day = ROADMAP.find((item) => item.id === dayId);
  if (!day) return { ok: false as const, error: "Unknown day.", noteId: null };
  const prompt = buildTutorPrompt({
    style: "revision",
    day: { date: day.date, title: day.title, objective: day.doneWhen, concepts: conceptsOf(day) },
    history: [],
    userText: `Return JSON only: {"title":"...","bullets":["...","...","..."]}. 3 bullet recap of this study session. Session notes from the learner:\n${notes.slice(0, 2000) || "(none)"}`,
  });
  try {
    const text = await generateText({ system: prompt.system, contents: prompt.contents, json: true, key: "session-recap" });
    const parsed = parseStructured(aiSessionRecapSchema, text);
    if (!parsed.ok) return { ok: false as const, error: parsed.error, noteId: null };
    const body = parsed.data.bullets.map((bullet) => `• ${bullet}`).join("\n");
    const noteId = await saveNote({
      title: parsed.data.title.slice(0, 200),
      body,
      dayId,
      tags: ["session", "ai"],
      pinned: false,
      forRevision: true,
    });
    revalidatePath("/notes");
    revalidatePath("/");
    return { ok: true as const, error: "", noteId };
  } catch (error) {
    return { ok: false as const, error: error instanceof AiError ? error.message : "Recap failed.", noteId: null };
  }
}

export async function getWeeklyReviewAction(force = false) {
  const today = localToday();
  const weekKey = today.slice(0, 8) + String(Math.ceil(Number(today.slice(8, 10)) / 7));
  const cacheId = `weekly:${weekKey}`;
  if (!force) {
    const cached = await getAiCache<{ summary: string; weakTopics: string[]; catchUp: { dayId: string; title: string; why: string }[] }>(cacheId);
    if (cached) return { ok: true as const, error: "", review: cached, cached: true };
  }
  const data = await getDashboard();
  const missed = data.missed.slice(0, 6).map((view) => ({ id: view.day.id, title: view.day.title }));
  const fallback = {
    summary: `You have completed ${data.roadmap.done} of ${data.roadmap.total} days. Quiz accuracy ${data.quizAccuracy == null ? "n/a" : `${Math.round(data.quizAccuracy * 100)}%`}.`,
    weakTopics: data.weakTopics.slice(0, 5),
    catchUp: missed.map((item) => ({ dayId: item.id, title: item.title, why: "Missed or incomplete" })),
  };
  const prompt = buildTutorPrompt({
    style: "revision",
    day: null,
    history: [],
    userText: `Return JSON only: {"summary":"...","weakTopics":["..."],"catchUp":[{"dayId":"...","title":"...","why":"..."}]}. Progress: ${data.roadmap.done}/${data.roadmap.total}. Streak ${data.streak.current}. Weak topics: ${data.weakTopics.join(", ") || "none"}. Missed days: ${missed.map((item) => `${item.id}:${item.title}`).join("; ") || "none"}. Suggest catch-up order.`,
  });
  try {
    const text = await generateText({ system: prompt.system, contents: prompt.contents, json: true, key: "weekly" });
    const parsed = parseStructured(aiWeeklyReviewSchema, text);
    const review = parsed.ok ? parsed.data : fallback;
    await setAiCache(cacheId, "weekly", review, 48);
    return { ok: true as const, error: "", review, cached: false };
  } catch {
    await setAiCache(cacheId, "weekly", fallback, 12);
    return { ok: true as const, error: "", review: fallback, cached: false };
  }
}

export async function generateInterviewPromptsAction(dayId: string) {
  const day = ROADMAP.find((item) => item.id === dayId);
  if (!day) return { ok: false as const, error: "Unknown day.", prompts: [] as string[] };
  const cacheId = `interview:${dayId}`;
  const cached = await getAiCache<{ prompts: string[] }>(cacheId);
  if (cached?.prompts?.length) return { ok: true as const, error: "", prompts: cached.prompts };
  const fallback = interviewPrompts(day);
  const prompt = buildTutorPrompt({
    style: "interview",
    day: { date: day.date, title: day.title, objective: day.doneWhen, concepts: conceptsOf(day) },
    history: [],
    userText: 'Return JSON only: {"prompts":["...","...","..."]}. 3 to 5 junior interview questions for this day.',
  });
  try {
    const text = await generateText({ system: prompt.system, contents: prompt.contents, json: true, key: "interview-prompts" });
    const parsed = parseStructured(aiInterviewPromptsSchema, text);
    const prompts = parsed.ok ? parsed.data.prompts : fallback;
    await setAiCache(cacheId, "interview", { prompts }, 168, dayId);
    return { ok: true as const, error: "", prompts };
  } catch {
    return { ok: true as const, error: "", prompts: fallback };
  }
}

export async function confirmInterviewPromptsAction(dayId: string, prompts: string[]) {
  await setAiCache(`interview:${dayId}`, "interview", { prompts }, 168, dayId);
  revalidatePath(`/roadmap/${dayId}`);
  return { ok: true as const };
}

export async function generatePracticeTaskAction(dayId: string) {
  const day = ROADMAP.find((item) => item.id === dayId);
  if (!day) return { ok: false as const, error: "Unknown day.", task: null };
  const prompt = buildTutorPrompt({
    style: "example",
    day: { date: day.date, title: day.title, objective: day.doneWhen, concepts: conceptsOf(day) },
    history: [],
    userText: 'Return JSON only: {"title":"...","task":"...","acceptance":"..."}. One concrete coding practice task for today. task is the assignment; acceptance is how to know it is done.',
  });
  try {
    const text = await generateText({ system: prompt.system, contents: prompt.contents, json: true, key: "practice" });
    const parsed = parseStructured(aiPracticeTaskSchema, text);
    if (!parsed.ok) return { ok: false as const, error: parsed.error, task: null };
    return { ok: true as const, error: "", task: parsed.data };
  } catch (error) {
    return { ok: false as const, error: error instanceof AiError ? error.message : "Practice task failed.", task: null };
  }
}

export async function confirmPracticeTaskAction(dayId: string, task: { title: string; task: string; acceptance: string }) {
  const body = `${task.task}\n\nDone when: ${task.acceptance}`;
  const id = await saveNote({
    title: task.title.slice(0, 200),
    body,
    dayId,
    tags: ["practice", "ai"],
    pinned: false,
    forRevision: false,
  });
  await appendDayNotes(dayId, `Practice task (${task.title}):\n${body}`);
  revalidatePath(`/roadmap/${dayId}`);
  revalidatePath("/notes");
  return id;
}

export async function explainExampleAction(dayId: string, code: string, caption: string) {
  const day = ROADMAP.find((item) => item.id === dayId);
  const prompt = buildTutorPrompt({
    style: "example",
    day: day
      ? { date: day.date, title: day.title, objective: day.doneWhen, concepts: conceptsOf(day) }
      : null,
    history: [],
    userText: `Explain this example line by line.\nCaption: ${caption}\nCode:\n${code.slice(0, 6000)}`,
  });
  try {
    const raw = await generateText({ system: prompt.system, contents: prompt.contents, key: "example-explain" });
    return { ok: true as const, error: "", text: splitFollowUps(raw).answer };
  } catch (error) {
    return { ok: false as const, error: error instanceof AiError ? error.message : "Explain failed.", text: "" };
  }
}

export async function harderExampleAction(dayId: string, code: string, caption: string) {
  const day = ROADMAP.find((item) => item.id === dayId);
  const prompt = buildTutorPrompt({
    style: "example",
    day: day
      ? { date: day.date, title: day.title, objective: day.doneWhen, concepts: conceptsOf(day) }
      : null,
    history: [],
    userText: `Return JSON only: {"caption":"...","code":"...","explanation":"..."}. Show a harder TypeScript/JavaScript variant of this example without replacing the original.\nCaption: ${caption}\nCode:\n${code.slice(0, 4000)}`,
  });
  try {
    const text = await generateText({ system: prompt.system, contents: prompt.contents, json: true, key: "example-harder" });
    const parsed = parseStructured(aiExampleVariantSchema, text);
    if (!parsed.ok) return { ok: false as const, error: parsed.error, variant: null };
    return { ok: true as const, error: "", variant: parsed.data };
  } catch (error) {
    return { ok: false as const, error: error instanceof AiError ? error.message : "Variant failed.", variant: null };
  }
}
