"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { scoreMockAnswerAction, startMockInterviewAction } from "@/server/actions";
import { buttonClass, inputClass } from "@/components/ui";

export function MockInterviewLauncher({ days }: { days: { id: string; label: string }[] }) {
  const router = useRouter();
  const [dayId, setDayId] = useState(days[0]?.id ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  if (!days.length) return null;

  return (
    <div className="rounded-[20px] border-2 border-line p-3">
      <p className="text-sm font-medium">Mock interview</p>
      <p className="mt-1 text-xs text-muted">AI asks a prompt for the day, scores your answer, then continues.</p>
      <label className="mt-2 grid gap-1 text-sm font-medium">
        Day
        <select className={inputClass} value={dayId} onChange={(event) => setDayId(event.target.value)}>
          {days.map((day) => (
            <option key={day.id} value={day.id}>{day.label}</option>
          ))}
        </select>
      </label>
      <button
        className={`${buttonClass()} mt-2`}
        type="button"
        disabled={pending || !dayId}
        onClick={async () => {
          setPending(true);
          setError("");
          const result = await startMockInterviewAction(dayId);
          setPending(false);
          if (!result.ok) setError(result.error);
          else router.push(`/tutor?chat=${result.conversationId}&day=${dayId}&mode=mock`);
        }}
      >
        {pending ? "Starting…" : "Start mock interview"}
      </button>
      {error ? <p className="mt-2 text-sm text-red-800">{error}</p> : null}
    </div>
  );
}

export function MockInterviewPanel({
  conversationId,
  dayId,
}: {
  conversationId: string;
  dayId: string;
}) {
  const router = useRouter();
  const [answer, setAnswer] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  return (
    <div className="rounded-[20px] border-2 border-line bg-card p-3">
      <p className="text-sm font-medium">Your interview answer</p>
      <textarea
        className={`${inputClass} mt-2 min-h-28 py-2`}
        value={answer}
        onChange={(event) => setAnswer(event.target.value)}
        placeholder="Answer out loud in writing…"
      />
      <button
        className={`${buttonClass()} mt-2`}
        type="button"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError("");
          const result = await scoreMockAnswerAction(conversationId, dayId, answer);
          setPending(false);
          if (!result.ok) setError(result.error);
          else {
            setAnswer("");
            router.refresh();
          }
        }}
      >
        {pending ? "Scoring…" : "Submit answer"}
      </button>
      {error ? <p className="mt-2 text-sm text-red-800">{error}</p> : null}
    </div>
  );
}
