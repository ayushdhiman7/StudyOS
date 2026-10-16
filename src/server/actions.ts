"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { conceptsOf, ROADMAP } from "@/lib/roadmap";
import { buildTutorPrompt, parseStructured, responseStyles, splitFollowUps, aiNotesSchema, aiQuizSchema, type ResponseStyle } from "@/lib/domain/ai";
import { finishClock, pauseClock, resumeClock, type Preferences } from "@/lib/domain/study";
import { AiError, generateText } from "@/lib/gemini";
import {
  addMessage,
  clearChats,
  createConversation,
  deleteAllNotes,
  deleteConversation,
  deleteNote,
  deleteMessage,
  getMessages,
  getNote,
  getPrefs,
  getSession,
  gradeQuiz,
  importData,
  moveDay,
  resetProgress,
  reviewRevision,
  saveDayNotes,
  saveGeneratedQuestions,
  saveNote,
  savePrefs,
  saveSession,
  scheduleRevision,
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

export async function generateQuizAction(dayId: string) {
  const day = ROADMAP.find((item) => item.id === dayId);
  if (!day) return { ok: false as const, error: "That day is not in the plan.", questions: [] };
  const prompt = buildTutorPrompt({
    style: "quiz",
    day: { date: day.date, title: day.title, objective: day.doneWhen, concepts: conceptsOf(day) },
    history: [],
    userText: "Return JSON only: {\"questions\":[{\"kind\":\"mcq\",\"prompt\":\"...\",\"choices\":[\"a\",\"b\",\"c\",\"d\"],\"answer\":\"a\",\"explanation\":\"...\",\"topic\":\"...\"}]}. Use only this day's topics. 4 questions.",
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
