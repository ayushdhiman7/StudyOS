import Link from "next/link";
import { Card, buttonClass, inputClass } from "@/components/ui";
import { listNotes } from "@/lib/store";

export default async function NotesPage({ searchParams }: { searchParams: Promise<{ q?: string; tag?: string; pinned?: string; revision?: string }> }) {
  const params = await searchParams;
  const notes = await listNotes({
    q: params.q,
    tag: params.tag,
    pinned: params.pinned === "1",
    revision: params.revision === "1",
  });
  return (
    <main className="grid gap-4">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold">Notes</h1>
        <Link className={buttonClass()} href="/notes/new">New note</Link>
      </header>
      <form className="grid gap-2 sm:grid-cols-4" action="/notes">
        <input className={inputClass} name="q" defaultValue={params.q ?? ""} aria-label="Search notes" placeholder="Search" />
        <input className={inputClass} name="tag" defaultValue={params.tag ?? ""} aria-label="Tag" placeholder="Tag" />
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="pinned" value="1" defaultChecked={params.pinned === "1"} /> Pinned</label>
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="revision" value="1" defaultChecked={params.revision === "1"} /> Revision</label>
        <button className={buttonClass("ghost")} type="submit">Filter</button>
      </form>
      {notes.length === 0 ? <Card><p className="text-sm text-muted">No notes match. Create one, or save an AI answer.</p></Card> : (
        <ul className="grid gap-3">
          {notes.map((note) => (
            <li key={note.id}>
              <Link href={`/notes/${note.id}`} className="block rounded-2xl border border-line bg-card p-4">
                <h2 className="font-semibold">{note.pinned ? "Pinned · " : ""}{note.title}</h2>
                <p className="mt-1 line-clamp-2 text-sm text-muted">{note.body}</p>
                <p className="mt-2 text-xs text-muted">{note.tags.join(", ") || "No tags"} · updated {note.updatedAt.slice(0, 10)}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
