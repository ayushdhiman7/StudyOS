import { notFound } from "next/navigation";
import { NoteEditor } from "@/components/note-editor";
import { localToday } from "@/lib/domain/study";
import { dayOptions, getNote } from "@/lib/store";

export default async function NotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const note = await getNote(id);
  if (!note) notFound();
  return (
    <main className="grid gap-4">
      <h1 className="text-3xl font-semibold">Edit note</h1>
      <NoteEditor days={dayOptions()} note={note} today={localToday()} />
    </main>
  );
}
