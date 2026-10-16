import { mapGeminiError, modelCandidates } from "@/lib/domain/ai";
import { localToday } from "@/lib/domain/study";
import { UsageModel } from "@/lib/models";
import { connectDB } from "@/lib/db";

type Content = { role: "user" | "model"; parts: { text: string }[] };

const hits = new Map<string, number[]>();

export function rateLimit(key: string, limit = 20, windowMs = 10 * 60 * 1000): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((time) => now - time < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  return true;
}

export class AiError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

async function recordUsage() {
  await connectDB();
  const id = localToday();
  await UsageModel.updateOne({ _id: id }, { $inc: { count: 1 } }, { upsert: true });
}

export async function usageSummary(): Promise<{ today: number; total: number }> {
  await connectDB();
  const rows = await UsageModel.find().lean<{ _id: string; count: number }[]>();
  const today = localToday();
  return {
    today: rows.find((row) => row._id === today)?.count ?? 0,
    total: rows.reduce((sum, row) => sum + (row.count ?? 0), 0),
  };
}

export async function generateText(input: {
  system: string;
  contents: Content[];
  json?: boolean;
  key?: string;
}): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new AiError("auth", "GEMINI_API_KEY is not configured on the server.");
  if (!rateLimit(input.key ?? "local")) {
    throw new AiError("quota", "This app's request limit was reached. Try again in a few minutes.");
  }
  const models = modelCandidates(process.env.GEMINI_MODEL);
  const maxOutputTokens = Number(process.env.GEMINI_MAX_OUTPUT_TOKENS ?? 2048);
  let status = 503;
  for (const model of models) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          signal: AbortSignal.timeout(25_000),
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: input.system }] },
            contents: input.contents,
            generationConfig: {
              maxOutputTokens: Number.isFinite(maxOutputTokens) ? maxOutputTokens : 2048,
              temperature: input.json ? 0.2 : 0.5,
              responseMimeType: input.json ? "application/json" : "text/plain",
            },
          }),
        },
      );
      if (response.ok) {
        const data = (await response.json()) as {
          candidates?: { content?: { parts?: { text?: string }[] } }[];
        };
        const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim() ?? "";
        if (!text) throw new AiError("unavailable", "Gemini returned an empty answer.");
        await recordUsage().catch(() => undefined);
        console.info("gemini.ok", { model, json: Boolean(input.json) });
        return text;
      }
      status = response.status;
      console.info("gemini.error", { model, status });
      if (status !== 404) break;
    } catch (error) {
      if (error instanceof AiError) throw error;
      const name = error instanceof Error ? error.name : "";
      if (name === "TimeoutError" || name === "AbortError") throw new AiError("timeout", mapGeminiError(408).message);
      console.info("gemini.error", { model, status: "network" });
      throw new AiError("unavailable", mapGeminiError(503).message);
    }
  }
  const mapped = mapGeminiError(status);
  throw new AiError(mapped.code, mapped.message);
}
