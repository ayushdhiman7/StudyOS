"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { elapsedSeconds, remainingSeconds, type SessionClock } from "@/lib/domain/study";
import { sessionCheckAction, sessionRecapAction, startOrUpdateSession } from "@/server/actions";
import { buttonClass, inputClass } from "@/components/ui";

function format(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

export function StudyTimer({
  dayId,
  topic,
  initial,
  defaultSeconds,
}: {
  dayId: string;
  topic: string;
  initial: (SessionClock & { id: string; plannedSeconds: number; notes: string; breakReminder: boolean }) | null;
  defaultSeconds: number;
}) {
  const [planned, setPlanned] = useState(initial?.plannedSeconds ?? defaultSeconds);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [breaks, setBreaks] = useState(initial?.breakReminder ?? true);
  const [clock, setClock] = useState<SessionClock>(
    initial ?? { status: "paused", elapsedSeconds: 0, lastResumedAt: null },
  );
  const [now, setNow] = useState(() => new Date());
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [check, setCheck] = useState<{ question: string; hint: string } | null>(null);
  const [checkError, setCheckError] = useState("");
  const [checkPending, setCheckPending] = useState(false);
  const [recapNoteId, setRecapNoteId] = useState<string | null>(null);
  const [recapError, setRecapError] = useState("");
  const [coachEnabled, setCoachEnabled] = useState(true);
  const lastCheckStage = useRef(0);
  const elapsed = elapsedSeconds(clock, now);
  const remaining = remainingSeconds(initial?.plannedSeconds ?? planned, elapsed);

  useEffect(() => {
    if (clock.status !== "running") return;
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, [clock.status]);

  useEffect(() => {
    if (clock.status === "running" && remaining === 0 && typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification("Study session", { body: "Your study session is complete. Add your notes before finishing." });
    }
  }, [clock.status, remaining]);

  const stage = Math.floor(elapsed / (25 * 60));

  useEffect(() => {
    if (!coachEnabled || clock.status !== "running" || stage < 1 || stage === lastCheckStage.current) return;
    lastCheckStage.current = stage;
    setCheckPending(true);
    setCheckError("");
    void sessionCheckAction(dayId).then((result) => {
      setCheckPending(false);
      if (!result.ok) setCheckError(result.error);
      else setCheck(result.check);
    });
  }, [stage, clock.status, coachEnabled, dayId]);

  async function submit(intent: string) {
    const data = new FormData();
    data.set("dayId", dayId);
    data.set("intent", intent);
    data.set("plannedSeconds", String(planned));
    data.set("notes", notes);
    if (breaks) data.set("breakReminder", "on");
    const snapshot = new Date();
    if (intent === "pause") setClock({ status: "paused", elapsedSeconds: elapsedSeconds(clock, snapshot), lastResumedAt: null });
    if (intent === "start" || intent === "resume") {
      setClock({ status: "running", elapsedSeconds: elapsedSeconds(clock, snapshot), lastResumedAt: snapshot.toISOString() });
    }
    if (intent === "finish") setClock({ status: "finished", elapsedSeconds: elapsedSeconds(clock, snapshot), lastResumedAt: null });
    await startOrUpdateSession(data);
    if (intent === "finish" && coachEnabled) {
      const recap = await sessionRecapAction(dayId, notes);
      if (!recap.ok) setRecapError(recap.error);
      else setRecapNoteId(recap.noteId);
    }
  }

  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted">Current topic</p>
      <h1 className="font-display text-[32px] leading-none">{topic}</h1>
      <p className="font-mono text-5xl" aria-live="polite">
        {format(remaining)}
      </p>
      <p className="text-sm text-muted">Time studied: {format(elapsed)}. A running session counts wall-clock time until you pause it.</p>
      {breaks && stage > 0 ? <p className="rounded-[14px] border-2 border-line bg-yellow px-3 py-2 text-sm font-medium text-[#111111]">Break reminder: stand up for a minute, then continue.</p> : null}
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" checked={coachEnabled} onChange={(event) => setCoachEnabled(event.target.checked)} />
        AI session coach (mid-session check + end recap)
      </label>
      {checkPending ? <p className="text-sm text-muted">Fetching a mid-session check…</p> : null}
      {check ? (
        <div className="rounded-[20px] border-2 border-line p-3">
          <p className="text-sm font-medium">Mid-session check</p>
          <p className="mt-2 text-sm">{check.question}</p>
          <p className="mt-2 text-xs text-muted">Hint: {check.hint}</p>
          <button className={`${buttonClass("ghost")} mt-2`} type="button" onClick={() => setCheck(null)}>Dismiss</button>
        </div>
      ) : null}
      {checkError ? <p className="text-sm text-red-800">{checkError}</p> : null}
      {!initial ? (
        <label className="grid gap-1 text-sm font-medium">
          Session length
          <select className={inputClass} value={planned} onChange={(event) => setPlanned(Number(event.target.value))}>
            <option value={defaultSeconds}>Planned block ({Math.round(defaultSeconds / 60)} min)</option>
            <option value={1500}>25 minutes</option>
            <option value={2700}>45 minutes</option>
            <option value={3600}>60 minutes</option>
          </select>
        </label>
      ) : null}
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" checked={breaks} onChange={(event) => setBreaks(event.target.checked)} />
        Break reminder every 25 minutes
      </label>
      <label className="grid gap-1 text-sm font-medium">
        Session notes
        <textarea className={`${inputClass} min-h-28 py-2`} value={notes} onChange={(event) => setNotes(event.target.value)} />
      </label>
      <div className="flex flex-wrap gap-2">
        {clock.status !== "running" && clock.status !== "finished" ? (
          <button className={buttonClass()} type="button" onClick={() => submit(clock.elapsedSeconds > 0 ? "resume" : "start")}>
            {clock.elapsedSeconds > 0 ? "Resume" : "Start"}
          </button>
        ) : null}
        {clock.status === "running" ? (
          <button className={buttonClass("ghost")} type="button" onClick={() => submit("pause")}>
            Pause
          </button>
        ) : null}
        {clock.status !== "finished" ? (
          <button className={buttonClass("ghost")} type="button" onClick={() => setConfirmFinish(true)}>
            Finish
          </button>
        ) : (
          <div className="grid gap-1 text-sm">
            <p>This session is saved.</p>
            {recapNoteId ? (
              <p>
                AI recap saved.{" "}
                <Link className="font-bold underline" href={`/notes/${recapNoteId}`}>Open note</Link>
              </p>
            ) : null}
            {recapError ? <p className="text-red-800">{recapError}</p> : null}
          </div>
        )}
      </div>
      {confirmFinish ? (
        <div className="rounded-2xl border border-line p-4" role="dialog" aria-labelledby="finish-title">
          <h2 id="finish-title" className="font-semibold">Finish this session?</h2>
          <p className="mt-1 text-sm text-muted">Your notes and studied time will be saved. The topic stays incomplete until you check it off.</p>
          <div className="mt-3 flex gap-2">
            <button className={buttonClass()} type="button" onClick={() => submit("finish")}>
              Save and finish
            </button>
            <button className={buttonClass("ghost")} type="button" onClick={() => setConfirmFinish(false)}>
              Keep studying
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
