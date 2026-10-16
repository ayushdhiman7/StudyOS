"use client";

import { useState } from "react";
import { explainConceptAction, explainExampleAction, harderExampleAction } from "@/server/actions";
import { buttonClass, RichText } from "@/components/ui";

export function ExplainButton({ dayId, concept }: { dayId: string; concept: string }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState("");

  return (
    <div className="mt-1">
      <button
        className="text-xs font-bold underline"
        type="button"
        disabled={pending}
        onClick={async () => {
          if (open && text) {
            setOpen(false);
            return;
          }
          setPending(true);
          setError("");
          setOpen(true);
          const result = await explainConceptAction(dayId, concept);
          setPending(false);
          if (!result.ok) setError(result.error);
          else setText(result.text);
        }}
      >
        {pending ? "Explaining…" : open && text ? "Hide explain" : "Explain with AI"}
      </button>
      {open ? (
        <div className="mt-2 rounded-[14px] border-2 border-line bg-card p-3 text-sm">
          {error ? <p className="text-red-800">{error}</p> : null}
          {text ? <RichText text={text} /> : null}
        </div>
      ) : null}
    </div>
  );
}

export function ExampleAiTools({
  dayId,
  code,
  caption,
}: {
  dayId: string;
  code: string;
  caption: string;
}) {
  const [explain, setExplain] = useState("");
  const [variant, setVariant] = useState<{ caption: string; code: string; explanation: string } | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<"explain" | "harder" | null>(null);

  return (
    <div className="mt-3 grid gap-2">
      <div className="flex flex-wrap gap-2">
        <button
          className={buttonClass("ghost")}
          type="button"
          disabled={pending !== null}
          onClick={async () => {
            setPending("explain");
            setError("");
            const result = await explainExampleAction(dayId, code, caption);
            setPending(null);
            if (!result.ok) setError(result.error);
            else setExplain(result.text);
          }}
        >
          {pending === "explain" ? "Explaining…" : "Explain this example"}
        </button>
        <button
          className={buttonClass("ghost")}
          type="button"
          disabled={pending !== null}
          onClick={async () => {
            setPending("harder");
            setError("");
            const result = await harderExampleAction(dayId, code, caption);
            setPending(null);
            if (!result.ok) setError(result.error);
            else setVariant(result.variant);
          }}
        >
          {pending === "harder" ? "Generating…" : "Show a harder variant"}
        </button>
      </div>
      {error ? <p className="text-sm text-red-800">{error}</p> : null}
      {explain ? (
        <div className="rounded-[14px] border-2 border-line p-3 text-sm">
          <RichText text={explain} />
        </div>
      ) : null}
      {variant ? (
        <div className="rounded-[14px] border-2 border-line p-3">
          <p className="text-xs text-muted">{variant.caption}</p>
          <pre className="mt-2 overflow-x-auto rounded-[14px] border-2 border-line bg-ink p-3 text-xs text-canvas">
            <code>{variant.code}</code>
          </pre>
          <p className="mt-2 text-sm text-muted">{variant.explanation}</p>
        </div>
      ) : null}
    </div>
  );
}
