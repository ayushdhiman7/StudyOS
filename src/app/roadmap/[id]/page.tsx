import Link from "next/link";
import { notFound } from "next/navigation";
import { AiNotesButton } from "@/components/ai-notes";
import { Card, buttonClass, inputClass } from "@/components/ui";
import { formatLong, localToday, plannedMinutes } from "@/lib/domain/study";
import { moveDayAction, savePersonalNotes, scheduleRevisionAction, skipDayAction, toggleItem } from "@/server/actions";
import { getDayDetail, listCompletions } from "@/lib/store";

export default async function DayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getDayDetail(id);
  if (!detail) notFound();
  const completions = await listCompletions();
  const done = new Set(completions.filter((item) => item.completedAt).map((item) => item.id));
  const minutes = plannedMinutes(detail.shown, detail.day.holiday, detail.prefs);
  const today = localToday();

  return (
    <main className="grid gap-4">
      <header>
        <Link className="text-sm font-bold" href="/roadmap">‹ Roadmap</Link>
        <p className="mt-3 text-sm text-muted">{formatLong(detail.shown)} · {minutes} min · {detail.progress.done}/{detail.progress.total}</p>
        <h1 className="font-display mt-1 text-[32px] leading-none md:text-[44px]">{detail.day.title}</h1>
        <p className="mt-2 text-sm text-muted">Done when you can explain the concepts without reading and complete the practical task. {detail.day.doneWhen}</p>
      </header>
      {detail.missed ? (
        <Card>
          <h2 className="font-semibold">This day was missed</h2>
          <p className="mt-1 text-sm text-muted">It stays incomplete. Catch up here, move it to the next open date, or skip it.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a className={buttonClass()} href="#checklist">Catch up</a>
            <form action={moveDayAction}>
              <input type="hidden" name="dayId" value={id} />
              <input type="hidden" name="today" value={today} />
              <button className={buttonClass("ghost")} type="submit">Move</button>
            </form>
            <form action={skipDayAction}>
              <input type="hidden" name="dayId" value={id} />
              <button className={buttonClass("ghost")} type="submit">Skip</button>
            </form>
          </div>
        </Card>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Link className={buttonClass()} href={`/session/${id}`}>Study session</Link>
        <Link className={buttonClass("ghost")} href={`/tutor?day=${id}`}>Ask AI</Link>
        <Link className={buttonClass("ghost")} href={`/quiz/${id}`}>Quiz</Link>
      </div>
      <Card>
        <h2 id="checklist" className="font-semibold">Checklist</h2>
        {detail.day.blocks.map((block) => (
          <div key={block.title} className="mt-4">
            <h3 className="text-sm font-semibold text-muted">{block.title}</h3>
            <ul className="mt-2 grid gap-2">
              {detail.items.filter((item) => item.blockTitle === block.title).map((item) => (
                <li key={item.id}>
                  <form action={toggleItem}>
                    <input type="hidden" name="itemId" value={item.id} />
                    <input type="hidden" name="dayId" value={id} />
                    <input type="hidden" name="complete" value={done.has(item.id) ? "0" : "1"} />
                    <button className="flex min-h-12 w-full items-center gap-3 rounded-[14px] border-2 border-line bg-card px-3 text-left text-sm" type="submit" aria-pressed={done.has(item.id)}>
                      <span aria-hidden="true" className={`inline-flex size-5 items-center justify-center rounded border-2 border-line ${done.has(item.id) ? "bg-yellow" : "bg-card"}`}>{done.has(item.id) ? "✓" : ""}</span>
                      {item.title}
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <h3 className="mt-4 text-sm font-semibold text-muted">Practice</h3>
        <ul className="mt-2 grid gap-2">
          {detail.items.filter((item) => item.kind === "practice").map((item) => (
            <li key={item.id}>
              <form action={toggleItem}>
                <input type="hidden" name="itemId" value={item.id} />
                <input type="hidden" name="dayId" value={id} />
                <input type="hidden" name="complete" value={done.has(item.id) ? "0" : "1"} />
                <button className="flex min-h-12 w-full items-center gap-3 rounded-[14px] border-2 border-line bg-card px-3 text-left text-sm" type="submit" aria-pressed={done.has(item.id)}>
                  <span aria-hidden="true" className={`inline-flex size-5 items-center justify-center rounded border-2 border-line ${done.has(item.id) ? "bg-yellow" : "bg-card"}`}>{done.has(item.id) ? "✓" : ""}</span>
                  {item.title}
                </button>
              </form>
            </li>
          ))}
        </ul>
      </Card>
      {detail.example ? (
        <Card>
          <h2 className="font-semibold">Example</h2>
          <p className="mt-1 text-xs text-muted">{detail.example.caption}</p>
          <pre className="mt-3 overflow-x-auto rounded-[14px] border-2 border-line bg-ink p-3 text-xs text-canvas"><code>{detail.example.code}</code></pre>
        </Card>
      ) : null}
      <Card>
        <h2 className="font-semibold">Interview prompts</h2>
        <ul className="mt-2 list-disc space-y-2 pl-5 text-sm">{detail.interview.map((prompt) => <li key={prompt}>{prompt}</li>)}</ul>
      </Card>
      <Card>
        <h2 className="font-semibold">Notes for this day</h2>
        <form action={savePersonalNotes} className="mt-3 grid gap-2">
          <input type="hidden" name="dayId" value={id} />
          <textarea className={`${inputClass} min-h-32 py-2`} name="notes" defaultValue={detail.state?.personalNotes ?? ""} aria-label="Personal notes" />
          <button className={buttonClass()} type="submit">Save notes</button>
        </form>
      </Card>
      <Card>
        <h2 className="font-semibold">Revision</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {[1, 3, 7].map((interval) => (
            <form key={interval} action={scheduleRevisionAction}>
              <input type="hidden" name="dayId" value={id} />
              <input type="hidden" name="title" value={detail.day.title} />
              <input type="hidden" name="from" value={detail.shown} />
              <input type="hidden" name="interval" value={interval} />
              <button className={buttonClass("ghost")} type="submit">Review in {interval} day{interval === 1 ? "" : "s"}</button>
            </form>
          ))}
        </div>
        <div className="mt-4"><AiNotesButton dayId={id} /></div>
      </Card>
    </main>
  );
}
