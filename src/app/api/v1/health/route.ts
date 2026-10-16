import { NextResponse } from "next/server";
import { connectDB, mongoReady } from "@/lib/db";

export async function GET() {
  try {
    await connectDB();
    return NextResponse.json({ ok: mongoReady(), mongo: mongoReady() ? "connected" : "disconnected", time: new Date().toISOString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "MongoDB is not reachable.";
    return NextResponse.json({ ok: false, mongo: "disconnected", error: message }, { status: 503 });
  }
}
