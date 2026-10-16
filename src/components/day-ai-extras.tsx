"use client";

import { useState } from "react";
import {
  confirmInterviewPromptsAction,
  confirmPracticeTaskAction,
  generateInterviewPromptsAction,
  generatePracticeTaskAction,
} from "@/server/actions";
import { buttonClass } from "@/components/ui";

export function DayAiExtras({
  dayId,
  interview,
  interviewIsAi,
}: {
  dayId: string;
  interview: string[];
  interviewIsAi: boolean;
}) {
  const [prompts, setPrompts] = useState(interview);
  const [draftPrompts, setDraftPrompts] = useState<string[] | null>(null);
  const [task, setTask] = useState<{ title: string; task: string; acceptance: string } | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [savedTask, setSavedTask] = useState(false);
  const [savedPrompts, setSavedPrompts] = useState(interviewIsAi);

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <div className="flex flex-wrap gap-2">
          <button
            className={buttonClass("ghost")}
            type="button"
            disabled={pending !== null}
            onClick={async () => {
              setPending("prompts");
              setError("");
              const result = await generateInterviewPromptsAction(dayId);
              setPending(null);
              if (!result.ok) setError(result.error);
              else setDraftPrompts(result.prompts);
            }}
          >
            {pending === "prompts" ? "Generating…" : "Draft AI interview prompts"}
          </button>
        </div>
        {draftPrompts ? (
          <div className="grid gap-2 rounded-[14px] border-2 border-line p-3">
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {draftPrompts.map((prompt) => (
                <li key={prompt}>{prompt}</li>
              ))}
            </ul>
            <button
              className={buttonClass()}
              type="button"
              onClick={async () => {
                await confirmInterviewPromptsAction(dayId, draftPrompts);
                setPrompts(draftPrompts);
                setSavedPrompts(true);
                setDraftPrompts(null);
              }}
            >
              Use these prompts
            </button>
          </div>
        ) : null}
        <p className="text-xs text-muted">{savedPrompts ? "Showing confirmed AI prompts." : "Showing static prompts until you confirm AI drafts."}</p>
        <ul className="list-disc space-y-2 pl-5 text-sm">
          {prompts.map((prompt) => (
            <li key={prompt}>{prompt}</li>
          ))}
        </ul>
      </div>

      <div className="grid gap-2">
        <button
          className={buttonClass("ghost")}
          type="button"
          disabled={pending !== null}
          onClick={async () => {
            setPending("task");
            setError("");
            setSavedTask(false);
            const result = await generatePracticeTaskAction(dayId);
            setPending(null);
            if (!result.ok) setError(result.error);
            else setTask(result.task);
          }}
        >
          {pending === "task" ? "Generating…" : "Draft a practice task with AI"}
        </button>
        {task ? (
          <article className="rounded-[14px] border-2 border-line p-3 text-sm">
            <h3 className="font-semibold">{task.title}</h3>
            <p className="mt-2 whitespace-pre-wrap">{task.task}</p>
            <p className="mt-2 text-muted">Done when: {task.acceptance}</p>
            {!savedTask ? (
              <button
                className={`${buttonClass()} mt-3`}
                type="button"
                onClick={async () => {
                  await confirmPracticeTaskAction(dayId, task);
                  setSavedTask(true);
                }}
              >
                Save to notes
              </button>
            ) : (
              <p className="mt-2 text-sm">Saved to notes and day notes.</p>
            )}
          </article>
        ) : null}
      </div>
      {error ? <p className="text-sm text-red-800">{error}</p> : null}
    </div>
  );
}
