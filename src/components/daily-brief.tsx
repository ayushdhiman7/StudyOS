"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getDailyBriefAction } from "@/server/actions";
import { Card, buttonClass } from "@/components/ui";

type Brief = { focus: string; reason: string; cta: string; dayId: string | null };

export function DailyBrief() {
  const [brief, setBrief] = useState<Brief | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void getDailyBriefAction().then((result) => {
      if (cancelled) return;
      if (!result.ok) setError(result.error);
      else setBrief(result.brief);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <Card>
        <p className="text-sm text-muted">{error}</p>
      </Card>
    );
  }
  if (!brief) {
    return (
      <Card>
        <p className="text-sm text-muted">Preparing today’s AI focus…</p>
      </Card>
    );
  }

  return (
    <Card>
      <h2 className="font-display text-[17px]">Today’s focus</h2>
      <p className="mt-2 text-sm">{brief.focus}</p>
      <p className="mt-1 text-xs text-muted">{brief.reason}</p>
      <div className="mt-3">
        {brief.dayId ? (
          <Link className={buttonClass("ghost")} href={`/tutor?day=${brief.dayId}`}>
            {brief.cta}
          </Link>
        ) : (
          <Link className={buttonClass("ghost")} href="/roadmap">
            {brief.cta}
          </Link>
        )}
      </div>
    </Card>
  );
}
