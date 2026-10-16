import Link from "next/link";
import { notFound } from "next/navigation";
import { AiQuizButton, QuizRunner } from "@/components/quiz";
import { publicQuestions } from "@/lib/store";
import { ROADMAP } from "@/lib/roadmap";

export default async function QuizPage({ params }: { params: Promise<{ dayId: string }> }) {
  const { dayId } = await params;
  const day = ROADMAP.find((item) => item.id === dayId);
  if (!day) notFound();
  const questions = await publicQuestions(dayId);
  return (
    <main className="grid gap-4">
      <header>
        <p className="text-sm text-muted"><Link href={`/roadmap/${dayId}`}>Back to {day.title}</Link></p>
        <h1 className="text-3xl font-semibold">Quiz · {day.title}</h1>
      </header>
      {questions.length === 0 ? <p className="text-sm text-muted">No questions are stored for this day yet.</p> : <QuizRunner dayId={dayId} questions={questions} />}
      <AiQuizButton dayId={dayId} />
    </main>
  );
}
