"use client";

import { useState } from "react";
import { confirmQuizAction, generateQuizAction, gradeQuizAction } from "@/server/actions";
import { buttonClass, inputClass } from "@/components/ui";

type PublicQuestion = { id: string; kind: string; prompt: string; choices: string[]; topic: string };
type Graded = {
  score: number;
  total: number;
  accuracy: number;
  weakTopics: string[];
  incorrect: { id: string; topic: string; prompt: string; response: string; answer: string; explanation: string }[];
};
type Draft = { kind: "mcq" | "short" | "output" | "coding" | "system"; prompt: string; choices: string[]; answer: string; explanation: string; topic: string };

export function QuizRunner({ dayId, questions }: { dayId: string; questions: PublicQuestion[] }) {
  const [startedAt] = useState(() => new Date().toISOString());
  const [result, setResult] = useState<Graded | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(formData: FormData) {
    const answers: Record<string, string> = {};
    for (const question of questions) answers[question.id] = String(formData.get(question.id) ?? "");
    setPending(true);
    setError("");
    try {
      setResult(await gradeQuizAction(dayId, answers, startedAt));
    } catch {
      setError("The quiz could not be saved. Check your connection and retry.");
    } finally {
      setPending(false);
    }
  }

  if (result) {
    return (
      <div className="grid gap-3">
        <h2 className="text-xl font-semibold">Score {result.score}/{result.total}</h2>
        <p className="text-sm text-muted">Accuracy {Math.round(result.accuracy * 100)}%. {result.weakTopics.length ? `Weak topics: ${result.weakTopics.join(", ")}.` : "No weak topics in this attempt."}</p>
        {result.incorrect.map((item) => (
          <article key={item.id} className="rounded-2xl border border-line p-3">
            <p className="text-xs text-muted">{item.topic}</p>
            <p className="mt-1 whitespace-pre-wrap text-sm">{item.prompt}</p>
            <p className="mt-2 text-sm">Your answer: {item.response || "blank"}</p>
            <p className="text-sm">Answer: {item.answer}</p>
            <p className="mt-1 text-sm text-muted">{item.explanation}</p>
          </article>
        ))}
      </div>
    );
  }

  return (
    <form action={onSubmit} className="grid gap-4">
      {questions.map((question, index) => (
        <fieldset key={question.id} className="rounded-2xl border border-line p-3">
          <legend className="px-1 text-sm font-semibold">{index + 1}. {question.topic}</legend>
          <p className="mt-2 whitespace-pre-wrap text-sm">{question.prompt}</p>
          {question.kind === "mcq" ? (
            <div className="mt-2 grid gap-2">
              {question.choices.map((choice) => (
                <label key={choice} className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="radio" name={question.id} value={choice} required />
                  {choice}
                </label>
              ))}
            </div>
          ) : (
            <textarea className={`${inputClass} mt-2 min-h-24 py-2`} name={question.id} aria-label={question.prompt} />
          )}
        </fieldset>
      ))}
      {error ? <p role="alert" className="text-sm text-red-800">{error}</p> : null}
      <button className={buttonClass()} type="submit" disabled={pending}>{pending ? "Scoring…" : "Submit quiz"}</button>
    </form>
  );
}

export function AiQuizButton({ dayId }: { dayId: string }) {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);

  return (
    <div className="grid gap-3">
      <button
        className={buttonClass("ghost")}
        type="button"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError("");
          const result = await generateQuizAction(dayId);
          setPending(false);
          if (!result.ok) setError(result.error);
          else setDrafts(result.questions);
        }}
      >
        {pending ? "Generating…" : "Generate a quiz with AI"}
      </button>
      {error ? <p role="alert" className="text-sm text-red-800">{error} <button type="button" className="underline" onClick={() => setError("")}>Dismiss</button></p> : null}
      {drafts.length > 0 && !saved ? (
        <div className="grid gap-2">
          {drafts.map((question) => (
            <article key={question.prompt} className="rounded-xl border border-line p-3 text-sm">
              <p className="whitespace-pre-wrap">{question.prompt}</p>
              <p className="mt-1 text-muted">Answer: {question.answer}</p>
              <p className="text-muted">{question.explanation}</p>
            </article>
          ))}
          <button
            className={buttonClass()}
            type="button"
            onClick={async () => {
              await confirmQuizAction(dayId, drafts);
              setSaved(true);
            }}
          >
            Save these questions
          </button>
        </div>
      ) : null}
      {saved ? <p className="text-sm">Saved. Reload the quiz to include them.</p> : null}
    </div>
  );
}
