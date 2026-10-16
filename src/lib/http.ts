import { NextResponse } from "next/server";
import { z } from "zod";

const MAX_BODY = 32_000;

export function authorized(request: Request): boolean {
  const expected = process.env.STUDYOS_API_TOKEN;
  if (!expected) return false;
  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${expected}`;
}

export function rejectUnauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function readJson<T>(request: Request, schema: z.ZodType<T>): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse }> {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BODY) {
    return { ok: false, response: NextResponse.json({ error: "Request is too large." }, { status: 413 }) };
  }
  let text = "";
  try {
    text = await request.text();
  } catch {
    return { ok: false, response: NextResponse.json({ error: "Could not read the request." }, { status: 400 }) };
  }
  if (text.length > MAX_BODY) {
    return { ok: false, response: NextResponse.json({ error: "Request is too large." }, { status: 413 }) };
  }
  try {
    const parsed = schema.safeParse(JSON.parse(text));
    if (!parsed.success) return { ok: false, response: NextResponse.json({ error: "Invalid request." }, { status: 400 }) };
    return { ok: true, data: parsed.data };
  } catch {
    return { ok: false, response: NextResponse.json({ error: "Invalid request." }, { status: 400 }) };
  }
}

export function aiFailure(error: unknown) {
  const message = error instanceof Error ? error.message : "The AI service is unavailable right now.";
  const code = error instanceof Error && "code" in error ? String(error.code) : "unavailable";
  const status = code === "quota" ? 429 : code === "auth" ? 401 : code === "timeout" ? 504 : 502;
  return NextResponse.json({ error: message }, { status });
}
