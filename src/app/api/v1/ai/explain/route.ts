import { NextResponse } from "next/server";
import { z } from "zod";
import { buildTutorPrompt, responseStyles, splitFollowUps } from "@/lib/domain/ai";
import { conceptsOf, ROADMAP } from "@/lib/roadmap";
import { generateText } from "@/lib/gemini";
import { aiFailure, authorized, readJson, rejectUnauthorized } from "@/lib/http";

const schema = z.object({
  dayId: z.string().min(1),
  style: z.enum(responseStyles).default("beginner"),
  text: z.string().max(4000).optional(),
});

export async function POST(request: Request) {
  if (!authorized(request)) return rejectUnauthorized();
  const body = await readJson(request, schema);
  if (!body.ok) return body.response;
  const day = ROADMAP.find((item) => item.id === body.data.dayId);
  if (!day) return NextResponse.json({ error: "Unknown day." }, { status: 404 });
  const prompt = buildTutorPrompt({
    style: body.data.style,
    day: { date: day.date, title: day.title, objective: day.doneWhen, concepts: conceptsOf(day) },
    history: [],
    userText: body.data.text || `Explain ${day.title}.`,
  });
  try {
    const text = await generateText({ system: prompt.system, contents: prompt.contents, key: "explain" });
    return NextResponse.json(splitFollowUps(text));
  } catch (error) {
    return aiFailure(error);
  }
}
