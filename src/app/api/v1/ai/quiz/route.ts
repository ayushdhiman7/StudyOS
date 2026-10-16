import { NextResponse } from "next/server";
import { z } from "zod";
import { aiQuizSchema, buildTutorPrompt } from "@/lib/domain/ai";
import { parseStructured } from "@/lib/domain/ai";
import { conceptsOf, ROADMAP } from "@/lib/roadmap";
import { generateText } from "@/lib/gemini";
import { aiFailure, authorized, readJson, rejectUnauthorized } from "@/lib/http";

const schema = z.object({ dayId: z.string().min(1) });

export async function POST(request: Request) {
  if (!authorized(request)) return rejectUnauthorized();
  const body = await readJson(request, schema);
  if (!body.ok) return body.response;
  const day = ROADMAP.find((item) => item.id === body.data.dayId);
  if (!day) return NextResponse.json({ error: "Unknown day." }, { status: 404 });
  const prompt = buildTutorPrompt({
    style: "quiz",
    day: { date: day.date, title: day.title, objective: day.doneWhen, concepts: conceptsOf(day) },
    history: [],
    userText: "Return JSON {\"questions\":[{\"kind\":\"mcq\",\"prompt\":\"...\",\"choices\":[\"a\",\"b\"],\"answer\":\"a\",\"explanation\":\"...\",\"topic\":\"...\"}]}",
  });
  try {
    const text = await generateText({ system: prompt.system, contents: prompt.contents, json: true, key: "quiz-api" });
    const parsed = parseStructured(aiQuizSchema, text);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 422 });
    return NextResponse.json(parsed.data);
  } catch (error) {
    return aiFailure(error);
  }
}
