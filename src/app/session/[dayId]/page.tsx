import { notFound } from "next/navigation";
import { StudyTimer } from "@/components/timer";
import { plannedMinutes } from "@/lib/domain/study";
import { getDayDetail, getSession } from "@/lib/store";

export default async function SessionPage({ params }: { params: Promise<{ dayId: string }> }) {
  const { dayId } = await params;
  const detail = await getDayDetail(dayId);
  if (!detail) notFound();
  const session = await getSession(dayId);
  const minutes = plannedMinutes(detail.shown, detail.day.holiday, detail.prefs);
  return (
    <main>
      <StudyTimer
        dayId={dayId}
        topic={detail.day.title}
        defaultSeconds={minutes * 60}
        initial={session ? {
          id: session.id,
          status: session.status,
          elapsedSeconds: session.elapsedSeconds,
          lastResumedAt: session.lastResumedAt,
          plannedSeconds: session.plannedSeconds,
          notes: session.notes,
          breakReminder: session.breakReminder,
        } : null}
      />
    </main>
  );
}
