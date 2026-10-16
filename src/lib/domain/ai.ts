import { z } from "zod";

export const responseStyles = ["beginner", "deep", "interview", "example", "quiz", "revision"] as const;
export type ResponseStyle = (typeof responseStyles)[number];

const styleGuide: Record<ResponseStyle, string> = {
  beginner: "Explain as if the reader is new to this idea. Use plain language and a small example.",
  deep: "Explain the internal steps, trade-offs, and failure cases. Stay concrete.",
  interview: "Give an interview-ready answer: definition, how it works, a trade-off, and a short example.",
  example: "Lead with a short TypeScript or JavaScript example, then explain why each part exists.",
  quiz: "Ask five questions. Give hints, not full solutions, unless the user asks for the answer.",
  revision: "Summarize into short revision notes: definition, how it works, mistakes, and what to practise.",
};

export function buildTutorPrompt(input: {
  style: ResponseStyle;
  day?: { date: string; title: string; objective: string; concepts: string[] } | null;
  notes?: { title: string; body: string }[];
  history: { role: "user" | "assistant"; content: string }[];
  userText: string;
}): { system: string; contents: { role: "user" | "model"; parts: { text: string }[] }[] } {
  const lines = [
    "You are StudyOS, a personal software-engineering tutor.",
    styleGuide[input.style],
    "Prefer TypeScript or JavaScript examples unless the user asks for another language.",
    "Explain why the code works. Do not claim the code was run or tested.",
    "If you are unsure of an API, say so instead of inventing it.",
    "For algorithms, state time and space complexity and distinguish a correct solution from a faster one.",
    "When the user is practising, give a hint before a full solution.",
    "Use the roadmap context below when the question is about the plan. Do not ignore it for a generic answer.",
    "End with a line FOLLOW_UPS: and three short follow-up questions separated by |.",
  ];
  if (input.day) {
    lines.push(
      `Roadmap day ${input.day.date}: ${input.day.title}.`,
      `Objective: ${input.day.objective}`,
      `Subtopics: ${input.day.concepts.slice(0, 12).join("; ")}`,
    );
  }
  if (input.notes && input.notes.length > 0) {
    lines.push("The user explicitly attached these notes:");
    for (const note of input.notes.slice(0, 3)) {
      lines.push(`Note "${note.title}": ${note.body.slice(0, 1500)}`);
    }
  }
  const contents = input.history.slice(-8).map((message) => ({
    role: message.role === "assistant" ? ("model" as const) : ("user" as const),
    parts: [{ text: message.content.slice(0, 4000) }],
  }));
  contents.push({ role: "user", parts: [{ text: input.userText.slice(0, 8000) }] });
  return { system: lines.join("\n"), contents };
}

export function splitFollowUps(text: string): { answer: string; followUps: string[] } {
  const marker = text.lastIndexOf("FOLLOW_UPS:");
  if (marker === -1) return { answer: text.trim(), followUps: [] };
  const answer = text.slice(0, marker).trim();
  const followUps = text
    .slice(marker + "FOLLOW_UPS:".length)
    .split("|")
    .map((item) => item.replace(/^[\s\-*]+/, "").trim())
    .filter(Boolean)
    .slice(0, 3);
  return { answer, followUps };
}

export function mapGeminiError(status: number): { code: string; message: string } {
  if (status === 429) {
    return { code: "quota", message: "Gemini quota or rate limit was reached. Wait before trying again." };
  }
  if (status === 401 || status === 403) {
    return { code: "auth", message: "The Gemini API key was rejected. Check the server environment." };
  }
  if (status === 404) return { code: "model", message: "The configured Gemini model was not found." };
  if (status === 408) return { code: "timeout", message: "The AI request timed out." };
  return { code: "unavailable", message: "The AI service is unavailable right now." };
}

export const aiQuizSchema = z.object({
  questions: z
    .array(
      z.object({
        kind: z.enum(["mcq", "short", "output", "coding", "system"]),
        prompt: z.string().min(8).max(2000),
        choices: z.array(z.string().min(1).max(500)).max(6).default([]),
        answer: z.string().min(1).max(2000),
        explanation: z.string().min(8).max(2000),
        topic: z.string().min(2).max(120),
      }),
    )
    .min(1)
    .max(8),
});

export const aiNotesSchema = z.object({
  title: z.string().min(3).max(160),
  body: z.string().min(20).max(20_000),
  tags: z.array(z.string().min(1).max(40)).max(8).default([]),
});

export const aiBriefSchema = z.object({
  focus: z.string().min(20).max(600),
  reason: z.string().min(8).max(400),
  cta: z.string().min(4).max(80),
});

export const aiWeeklyReviewSchema = z.object({
  summary: z.string().min(20).max(1200),
  weakTopics: z.array(z.string().min(1).max(80)).max(8).default([]),
  catchUp: z
    .array(
      z.object({
        dayId: z.string().min(1).max(80),
        title: z.string().min(1).max(160),
        why: z.string().min(4).max(200),
      }),
    )
    .max(8)
    .default([]),
});

export const aiInterviewScoreSchema = z.object({
  score: z.number().min(0).max(5),
  gaps: z.array(z.string().min(2).max(200)).max(5).default([]),
  betterAnswer: z.string().min(20).max(4000),
  nextPrompt: z.string().min(8).max(500).optional(),
});

export const aiSessionCheckSchema = z.object({
  question: z.string().min(8).max(500),
  hint: z.string().min(4).max(400),
});

export const aiSessionRecapSchema = z.object({
  title: z.string().min(3).max(160),
  bullets: z.array(z.string().min(4).max(300)).min(2).max(5),
});

export const aiInterviewPromptsSchema = z.object({
  prompts: z.array(z.string().min(8).max(300)).min(3).max(5),
});

export const aiPracticeTaskSchema = z.object({
  title: z.string().min(3).max(160),
  task: z.string().min(20).max(4000),
  acceptance: z.string().min(8).max(600),
});

export const aiExampleVariantSchema = z.object({
  caption: z.string().min(4).max(200),
  code: z.string().min(10).max(8000),
  explanation: z.string().min(20).max(4000),
});

export function parseStructured<T>(schema: z.ZodType<T>, text: string): { ok: true; data: T } | { ok: false; error: string } {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return { ok: false, error: "The AI response was not valid JSON." };
  try {
    const data: unknown = JSON.parse(text.slice(start, end + 1));
    const parsed = schema.safeParse(data);
    if (!parsed.success) return { ok: false, error: "The AI response did not match the expected shape." };
    return { ok: true, data: parsed.data };
  } catch {
    return { ok: false, error: "The AI response was not valid JSON." };
  }
}

export function modelCandidates(configured: string | undefined): string[] {
  const values = [configured, "gemini-3.5-flash", "gemini-3.6-flash"].filter((value): value is string => Boolean(value));
  return [...new Set(values)];
}
