import Link from "next/link";
import { ListChecks, Sparkles, Timer } from "lucide-react";
import { DailyBrief } from "@/components/daily-brief";
import { ReminderHost } from "@/components/nav";
import { Card, Empty, ProgressBar, buttonClass } from "@/components/ui";
import { formatLong, plannedMinutes } from "@/lib/domain/study";
import { chooseAnchor } from "@/server/actions";
import { getDashboard } from "@/lib/store";

function shortFocusMeta(label: string, shown: string, minutes: number) {
  const date = new Date(`${shown}T12:00:00`);
  const day = date.toLocaleDateString("en-GB", { weekday: "short", timeZone: "Asia/Kolkata" }).toUpperCase();
  const dayNum = date.toLocaleDateString("en-GB", { day: "numeric", timeZone: "Asia/Kolkata" });
  const month = date.toLocaleDateString("en-GB", { month: "short", timeZone: "Asia/Kolkata" }).toUpperCase();
  return `${label.toUpperCase()} · ${day} ${dayNum} ${month} · ${minutes} MIN`;
}

export default async function HomePage() {
  const data = await getDashboard();
  const focus = data.todayView ?? data.nextView;
  const minutes = focus ? plannedMinutes(focus.shown, focus.day.holiday, data.prefs) : 0;

  return (
    <main className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-6">
      <ReminderHost enabled={data.prefs.notificationsEnabled} reminders={data.reminders} />
      <div className="grid gap-6">
        <header>
          <p className="text-sm text-muted">{formatLong(data.today)}</p>
          <h1 className="font-display mt-1 text-[32px] leading-[1.1] md:text-[44px]">
            {data.greeting}, Ayush
          </h1>
        </header>

        {data.anchorNeeded ? (
          <Card>
            <h2 className="font-display text-lg">The original start date has passed</h2>
            <p className="mt-1 text-sm text-muted">Keep the 17 October calendar, or restart day one from today. Nothing is moved until you choose.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <form action={chooseAnchor}>
                <input type="hidden" name="choice" value="keep" />
                <button className={buttonClass()} type="submit">Keep original dates</button>
              </form>
              <form action={chooseAnchor}>
                <input type="hidden" name="choice" value="restart" />
                <input type="hidden" name="today" value={data.today} />
                <button className={buttonClass("ghost")} type="submit">Restart from today</button>
              </form>
            </div>
          </Card>
        ) : null}

        {focus ? (
          <section className="flex flex-col gap-3 rounded-3xl border-2 border-[#111111] bg-yellow p-5 text-[#111111] hard-shadow-lg sm:gap-3.5 sm:p-8">
            <p className="text-[11px] font-bold tracking-[0.08em] sm:text-xs sm:tracking-[0.1em]">
              {shortFocusMeta(data.todayView ? "Today" : "Next up", focus.shown, minutes)}
            </p>
            <h2 className="font-display text-[44px] leading-none sm:text-[72px]">{focus.day.title}</h2>
            <p className="text-[13px] sm:text-[15px]">
              {focus.progress.done} of {focus.progress.total} checklist items
            </p>
            <div
              className="h-1.5 max-w-md overflow-hidden rounded-full bg-[#111111]/15 sm:h-2"
              role="progressbar"
              aria-valuenow={Math.round(focus.progress.ratio * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="h-full rounded-full bg-[#111111]/70" style={{ width: `${Math.round(focus.progress.ratio * 100)}%` }} />
            </div>
            <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-3">
              <Link className={buttonClass()} href={`/session/${focus.day.id}`}>
                <Timer className="size-4" aria-hidden />
                Start study session
              </Link>
              <Link className={`${buttonClass("ghost")} max-sm:hidden`} href={`/tutor?day=${focus.day.id}`}>
                <Sparkles className="size-4" aria-hidden />
                Quick ask AI
              </Link>
              <Link className={`${buttonClass("ghost")} max-sm:hidden`} href={`/quiz/${focus.day.id}`}>
                <ListChecks className="size-4" aria-hidden />
                Daily quiz
              </Link>
            </div>
          </section>
        ) : (
          <Empty title="No study day is scheduled" body="The 30-day plan runs from 17 October to 15 November 2026." href="/roadmap" action="Open roadmap" />
        )}

        <DailyBrief />

        <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
          <Card className="p-3 sm:p-4">
            <p className="text-[11px] text-muted sm:text-[13px]">Roadmap</p>
            <p className="font-display mt-1 text-[22px] sm:mt-1.5 sm:text-[28px]">
              {data.roadmap.done}/{data.roadmap.total}
            </p>
          </Card>
          <Card className="p-3 sm:p-4">
            <p className="text-[11px] text-muted sm:text-[13px]">Streak</p>
            <p className="font-display mt-1 text-[22px] sm:mt-1.5 sm:text-[28px]">{data.streak.current} days</p>
          </Card>
          <Card className="p-3 sm:p-4">
            <p className="text-[11px] text-muted sm:text-[13px]">
              <span className="sm:hidden">Studied</span>
              <span className="hidden sm:inline">Studied / planned</span>
            </p>
            <p className="font-display mt-1 text-[22px] sm:mt-1.5 sm:text-[28px]">
              <span className="sm:hidden">{data.studyMinutes} min</span>
              <span className="hidden sm:inline">
                {data.studyMinutes} / {data.plannedToDate} min
              </span>
            </p>
          </Card>
        </div>

        <div className="grid gap-4 lg:hidden">
          <WeeklyCard weeks={data.weekly} />
          <SideCards data={data} />
        </div>
      </div>

      <aside className="hidden grid gap-4 lg:grid">
        <WeeklyCard weeks={data.weekly} />
        <SideCards data={data} />
      </aside>
    </main>
  );
}

function WeeklyCard({ weeks }: { weeks: { weekId: string; title: string; done: number; total: number }[] }) {
  return (
    <Card className="flex flex-col gap-4">
      <h2 className="font-display text-[17px] md:text-xl">Weekly progress</h2>
      <ul className="grid gap-4">
        {weeks.map((week) => {
          const [lead, detail] = week.title.split(": ");
          return (
            <li key={week.weekId} className="grid gap-1.5">
              <div className="flex items-start justify-between gap-3 text-sm">
                <p className="min-w-0">
                  <b>{lead}</b> {detail ? <span className="text-muted">{detail}</span> : null}
                </p>
                <span className="shrink-0 text-muted">
                  {week.done}/{week.total}
                </span>
              </div>
              <ProgressBar value={week.total ? week.done / week.total : 0} />
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function SideCards({
  data,
}: {
  data: {
    revisions: { id: string; title: string; dueDate: string; href: string }[];
    reminders: { id: string; body: string }[];
    notes: { id: string; title: string }[];
    quizAccuracy: number | null;
    weakTopics: string[];
    missed: { day: { id: string; title: string }; shown: string }[];
  };
}) {
  return (
    <>
      <Card>
        <h2 className="font-display text-[17px]">Upcoming revision</h2>
        {data.revisions.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Nothing is due. Schedule a review from a day or note.</p>
        ) : (
          <ul className="mt-2 grid gap-2">
            {data.revisions.map((item) => (
              <li key={item.id}>
                <Link className="text-sm font-bold" href={item.href}>
                  {item.title}
                </Link>
                <p className="text-xs text-muted">Due {item.dueDate}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card>
        <h2 className="font-display text-[17px]">Reminders</h2>
        {data.reminders.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Reminders are off, or nothing is scheduled.</p>
        ) : (
          <ul className="mt-2 grid gap-2 text-sm">
            {data.reminders.map((item) => (
              <li key={item.id}>{item.body}</li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted">
          Quiz accuracy: {data.quizAccuracy == null ? "no attempts yet" : `${Math.round(data.quizAccuracy * 100)}%`}.{" "}
          {data.weakTopics.length ? `Weak topics: ${data.weakTopics.join(", ")}.` : ""}
        </p>
      </Card>
      <Card>
        <h2 className="font-display text-[17px]">Recent notes</h2>
        {data.notes.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Notes you write show up here.</p>
        ) : (
          <ul className="mt-2 grid gap-2">
            {data.notes.map((note) => (
              <li key={note.id}>
                <Link className="font-bold" href={`/notes/${note.id}`}>
                  {note.title}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {data.missed.length > 0 ? (
        <Card>
          <h2 className="font-display text-[17px]">Unfinished days</h2>
          <ul className="mt-2 grid gap-1 text-sm">
            {data.missed.slice(0, 5).map((item) => (
              <li key={item.day.id}>
                <Link className="font-bold" href={`/roadmap/${item.day.id}`}>
                  {item.day.title}
                </Link>{" "}
                · {item.shown}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </>
  );
}
