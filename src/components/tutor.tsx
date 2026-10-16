"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { clearChat, feedbackAction, regenerateChat, saveAnswerNote, sendChat } from "@/server/actions";
import { buttonClass, inputClass, RichText } from "@/components/ui";

type Message = { id: string; role: "user" | "assistant"; content: string; createdAt: string; helpful: boolean | null };

export function TutorChat({
  conversationId,
  messages,
  days,
  notes,
  style,
}: {
  conversationId: string;
  messages: Message[];
  days: { id: string; label: string }[];
  notes: { id: string; title: string }[];
  style: string;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(sendChat, { error: null as string | null, followUps: [] as string[], conversationId: "" });
  const [text, setText] = useState("");
  const prompts = [
    "Explain this like I am a beginner.",
    "Explain the internal working step by step.",
    "Show a simple code example.",
    "Give me an interview-ready answer.",
    "Give me a coding exercise without showing the solution.",
  ];

  useEffect(() => {
    if (state.conversationId && state.conversationId !== conversationId) router.replace(`/tutor?chat=${state.conversationId}`);
  }, [state.conversationId, conversationId, router]);

  return (
    <div className="grid gap-4">
      <div className="grid gap-3">
        {messages.length === 0 ? <p className="text-sm text-muted">Ask about today’s topic, a note, or an interview question.</p> : null}
        {messages.map((message) => (
          <article key={message.id} className={`rounded-[20px] border-2 border-line p-3 hard-shadow ${message.role === "user" ? "bg-yellow text-on-yellow" : "bg-card"}`}>
            <p className="text-xs opacity-70">{message.role === "user" ? "You" : "Tutor"} · {new Date(message.createdAt).toLocaleString("en-IN", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}</p>
            <div className="mt-2">
              <RichText text={message.content} />
            </div>
            {message.role === "assistant" ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <button className={buttonClass("ghost")} type="button" onClick={() => navigator.clipboard.writeText(message.content)}>
                  Copy
                </button>
                <form action={saveAnswerNote}>
                  <input type="hidden" name="content" value={message.content} />
                  <input type="hidden" name="title" value="Tutor answer" />
                  <input type="hidden" name="dayId" value="" />
                  <button className={buttonClass("ghost")} type="submit">Save to notes</button>
                </form>
                <form action={feedbackAction}>
                  <input type="hidden" name="messageId" value={message.id} />
                  <input type="hidden" name="helpful" value="yes" />
                  <button className={buttonClass("ghost")} type="submit" aria-pressed={message.helpful === true}>Helpful</button>
                </form>
                <form action={feedbackAction}>
                  <input type="hidden" name="messageId" value={message.id} />
                  <input type="hidden" name="helpful" value="no" />
                  <button className={buttonClass("ghost")} type="submit" aria-pressed={message.helpful === false}>Not helpful</button>
                </form>
              </div>
            ) : null}
          </article>
        ))}
        {pending ? <p className="text-sm text-muted">Thinking…</p> : null}
        {state.error ? (
          <p className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-900" role="alert">
            {state.error}
          </p>
        ) : null}
      </div>
      <form action={action} className="grid gap-3">
        <input type="hidden" name="conversationId" value={conversationId} />
        <input type="hidden" name="style" value={style} />
        <label className="grid gap-1 text-sm font-medium">
          Roadmap context
          <select className={inputClass} name="dayId" defaultValue="">
            <option value="">No day context</option>
            {days.map((day) => (
              <option key={day.id} value={day.id}>{day.label}</option>
            ))}
          </select>
        </label>
        {notes.length > 0 ? (
          <fieldset className="grid gap-1">
            <legend className="text-sm font-medium">Attach notes</legend>
            {notes.slice(0, 8).map((note) => (
              <label key={note.id} className="flex min-h-11 items-center gap-2 text-sm">
                <input type="checkbox" name="noteId" value={note.id} />
                {note.title}
              </label>
            ))}
          </fieldset>
        ) : null}
        <label className="grid gap-1 text-sm font-medium">
          Question
          <textarea className={`${inputClass} min-h-28 py-2`} name="text" value={text} onChange={(event) => setText(event.target.value)} required />
        </label>
        <div className="flex flex-wrap gap-2">
          {prompts.map((prompt) => (
            <button key={prompt} className={buttonClass("ghost")} type="button" onClick={() => setText(prompt)}>
              {prompt}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button className={buttonClass()} type="submit" disabled={pending}>Send</button>
          {state.error ? (
            <button className={buttonClass("ghost")} type="submit">Retry</button>
          ) : null}
        </div>
      </form>
      {state.followUps.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {state.followUps.map((follow) => (
            <button key={follow} className={buttonClass("ghost")} type="button" onClick={() => setText(follow)}>
              {follow}
            </button>
          ))}
        </div>
      ) : null}
      {conversationId ? (
        <div className="flex flex-wrap gap-2">
          <form action={regenerateChat}>
            <input type="hidden" name="conversationId" value={conversationId} />
            <button className={buttonClass("ghost")} type="submit">Regenerate answer</button>
          </form>
          <form action={clearChat}>
            <input type="hidden" name="conversationId" value={conversationId} />
            <input type="hidden" name="confirm" value="yes" />
            <button
              className={buttonClass("danger")}
              type="submit"
              onClick={(event) => {
                if (!confirm("Clear this conversation?")) event.preventDefault();
              }}
            >
              Clear conversation
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
