import { NextResponse } from "next/server";
import { z } from "zod";
import { buildTutorPrompt, responseStyles, splitFollowUps } from "@/lib/domain/ai";
import { conceptsOf, ROADMAP } from "@/lib/roadmap";
import { generateText } from "@/lib/gemini";
import { aiFailure, authorized, readJson, rejectUnauthorized } from "@/lib/http";

const schema = z.object({
  text: z.string().min(1).max(8000),
  style: z.enum(responseStyles).default("beginner"),
  dayId: z.string().nullable().optional(),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) })).max(8).default([]),
  notes: z.array(z.object({ title: z.string().max(200), body: z.string().max(4000) })).max(3).default([]),
});

export async function POST(request: Request) {
  if (!authorized(request)) return rejectUnauthorized();
  const body = await readJson(request, schema);
  if (!body.ok) return body.response;
  const day = body.data.dayId ? ROADMAP.find((item) => item.id === body.data.dayId) : undefined;
  const prompt = buildTutorPrompt({
    style: body.data.style,
    day: day ? { date: day.date, title: day.title, objective: day.doneWhen, concepts: conceptsOf(day) } : null,
    notes: body.data.notes,
    history: body.data.history,
    userText: body.data.text,
  });
  try {
    const text = await generateText({ system: prompt.system, contents: prompt.contents, key: request.headers.get("x-forwarded-for") ?? "api" });
    const split = splitFollowUps(text);
    return NextResponse.json(split);
  } catch (error) {
    return aiFailure(error);
  }
}
