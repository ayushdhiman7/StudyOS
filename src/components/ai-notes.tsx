"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { confirmNotesAction, generateNotesAction } from "@/server/actions";
import { buttonClass } from "@/components/ui";

export function AiNotesButton({ dayId }: { dayId: string }) {
  const router = useRouter();
  const [note, setNote] = useState<{ title: string; body: string; tags: string[] } | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  return (
    <div className="grid gap-2">
      <button
        className={buttonClass("ghost")}
        type="button"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError("");
          const result = await generateNotesAction(dayId);
          setPending(false);
          if (!result.ok || !result.note) setError(result.error);
          else setNote(result.note);
        }}
      >
        {pending ? "Writing notes…" : "Draft revision notes with AI"}
      </button>
      {error ? <p role="alert" className="text-sm text-red-800">{error}</p> : null}
      {note ? (
        <article className="rounded-xl border border-line p-3 text-sm">
          <h3 className="font-semibold">{note.title}</h3>
          <p className="mt-2 whitespace-pre-wrap">{note.body}</p>
          <button
            className={`${buttonClass()} mt-3`}
            type="button"
            onClick={async () => {
              const id = await confirmNotesAction(dayId, note);
              router.push(`/notes/${id}`);
            }}
          >
            Save note
          </button>
        </article>
      ) : null}
    </div>
  );
}
