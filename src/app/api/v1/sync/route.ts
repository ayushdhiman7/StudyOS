import { NextResponse } from "next/server";
import { backupSchema } from "@/lib/domain/backup";
import { authorized, readJson, rejectUnauthorized } from "@/lib/http";
import { exportData, importData } from "@/lib/store";

export async function POST(request: Request) {
  if (!authorized(request)) return rejectUnauthorized();
  const body = await readJson(request, backupSchema);
  if (!body.ok) return body.response;
  const result = await importData(body.data, true);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 });
  const data = await exportData();
  return NextResponse.json({ ok: true, notes: data.notes.length, completions: data.completions.length });
}
