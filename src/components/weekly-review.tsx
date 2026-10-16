"use client";

import Link from "next/link";
import { useState } from "react";
import { getWeeklyReviewAction } from "@/server/actions";
import { buttonClass } from "@/components/ui";

type Review = {
  summary: string;
  weakTopics: string[];
  catchUp: { dayId: string; title: string; why: string }[];
};

export function WeeklyReviewCard({ initial }: { initial?: Review | null }) {
  const [review, setReview] = useState<Review | null>(initial ?? null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function load(force = false) {
    setPending(true);
    setError("");
    const result = await getWeeklyReviewAction(force);
    setPending(false);
    if (!result.ok) setError(result.error);
    else setReview(result.review);
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        <button className={buttonClass("ghost")} type="button" disabled={pending} onClick={() => load(false)}>
          {pending ? "Loading…" : review ? "Refresh weekly AI review" : "Generate weekly AI review"}
        </button>
        {review ? (
          <button className={buttonClass("ghost")} type="button" disabled={pending} onClick={() => load(true)}>
            Force new review
          </button>
        ) : null}
      </div>
      {error ? <p className="text-sm text-red-800">{error}</p> : null}
      {review ? (
        <div className="grid gap-2 text-sm">
          <p>{review.summary}</p>
          {review.weakTopics.length ? (
            <p className="text-muted">Weak topics: {review.weakTopics.join(", ")}</p>
          ) : null}
          {review.catchUp.length ? (
            <ul className="grid gap-1">
              {review.catchUp.map((item) => (
                <li key={item.dayId}>
                  <Link className="font-bold" href={`/roadmap/${item.dayId}`}>{item.title}</Link>
                  <span className="text-muted"> — {item.why}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-muted">Summarize completed days, weak topics, and a catch-up order.</p>
      )}
    </div>
  );
}
