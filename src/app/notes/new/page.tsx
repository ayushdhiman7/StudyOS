import { NoteEditor } from "@/components/note-editor";
import { dayOptions } from "@/lib/store";

export default function NewNotePage() {
  return (
    <main className="grid gap-4">
      <h1 className="text-3xl font-semibold">New note</h1>
      <NoteEditor days={dayOptions()} />
    </main>
  );
}
