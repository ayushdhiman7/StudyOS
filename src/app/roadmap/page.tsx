import Link from "next/link";
import { Card, inputClass } from "@/components/ui";
import { getDashboard } from "@/lib/store";

export default async function RoadmapPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; week?: string }> }) {
  const params = await searchParams;
  const data = await getDashboard();
  const query = (params.q ?? "").trim().toLowerCase();
  const weeks = [...new Set(data.views.map((view) => view.day.weekId))];
  const filtered = data.views.filter((view) => {
    if (params.week && view.day.weekId !== params.week) return false;
    if (params.status === "done" && !view.progress.complete) return false;
    if (params.status === "open" && (view.progress.complete || view.skipped)) return false;
    if (params.status === "missed" && !view.missed) return false;
    if (!query) return true;
    const haystack = `${view.day.title} ${view.day.blocks.flatMap((block) => block.concepts).join(" ")} ${view.day.practice.join(" ")}`.toLowerCase();
    return haystack.includes(query);
  });

  return (
    <main className="grid gap-4">
      <header>
        <h1 className="font-display text-[32px] leading-none md:text-[44px]">Roadmap</h1>
        <p className="mt-2 text-sm text-muted">17 Oct – 15 Nov · 30 days. Opening a day does not mark it complete.</p>
      </header>
      <form className="grid gap-2 sm:grid-cols-3" action="/roadmap">
        <input className={inputClass} name="q" defaultValue={params.q ?? ""} placeholder="Search topics" aria-label="Search topics" />
        <select className={inputClass} name="status" defaultValue={params.status ?? "all"} aria-label="Completion">
          <option value="all">All days</option>
          <option value="open">Still open</option>
          <option value="done">Complete</option>
          <option value="missed">Missed</option>
        </select>
        <select className={inputClass} name="week" defaultValue={params.week ?? ""} aria-label="Week">
          <option value="">All weeks</option>
          {weeks.map((week) => <option key={week} value={week}>{data.views.find((view) => view.day.weekId === week)?.day.weekTitle}</option>)}
        </select>
        <button className="min-h-12 rounded-[14px] border-2 border-line bg-yellow px-4 text-[15px] font-bold text-[#111111]" type="submit">Filter</button>
      </form>
      {filtered.length === 0 ? <Card><p className="text-sm text-muted">No days match that filter.</p></Card> : null}
      <div className="grid gap-3">
        {filtered.map((view) => {
          const date = new Date(`${view.shown}T12:00:00`);
          const dayNum = date.toLocaleDateString("en-GB", { day: "numeric", timeZone: "Asia/Kolkata" });
          const month = date.toLocaleDateString("en-GB", { month: "short", timeZone: "Asia/Kolkata" }).toUpperCase();
          return (
          <Link key={view.day.id} href={`/roadmap/${view.day.id}`} className="flex items-center gap-4 rounded-[20px] border-2 border-line bg-card p-4 hard-shadow">
            <div className="flex w-14 shrink-0 flex-col items-center justify-center rounded-[14px] border-2 border-line bg-yellow py-2 text-[#111111]">
              <span className="font-display text-xl leading-none text-[#111111]">{dayNum}</span>
              <span className="text-[10px] font-bold tracking-wide text-[#111111]">{month}</span>
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-lg leading-tight">{view.day.title}</h2>
              <p className="mt-1 text-sm text-muted">{view.day.weekTitle} · {view.day.targetLabel}{view.day.holiday ? " · holiday" : ""}</p>
            </div>
            <p className="shrink-0 tabular-nums text-sm font-medium text-muted">{view.progress.done}/{view.progress.total}</p>
          </Link>
          );
        })}
      </div>
    </main>
  );
}
