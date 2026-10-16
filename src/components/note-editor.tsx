"use client";

import { deleteNoteAction, saveNoteAction, scheduleRevisionAction } from "@/server/actions";
import { buttonClass, inputClass } from "@/components/ui";

export function NoteEditor({
  days,
  note,
  today,
}: {
  days: { id: string; label: string }[];
  note?: { id: string; title: string; body: string; dayId: string | null; tags: string[]; pinned: boolean; forRevision: boolean; createdAt: string; updatedAt: string };
  today?: string;
}) {
  return (
    <div className="grid gap-4">
      <form action={saveNoteAction} className="grid gap-3">
        {note ? <input type="hidden" name="id" value={note.id} /> : null}
        <label className="grid gap-1 text-sm font-medium">Title<input className={inputClass} name="title" defaultValue={note?.title ?? ""} required /></label>
        <label className="grid gap-1 text-sm font-medium">Note<textarea className={`${inputClass} min-h-48 py-2`} name="body" defaultValue={note?.body ?? ""} /></label>
        <p className="text-xs text-muted">Text is stored as you type it. Triple backticks are shown as code when you read a tutor answer. This editor does not apply other formatting.</p>
        <label className="grid gap-1 text-sm font-medium">Tags<input className={inputClass} name="tags" defaultValue={note?.tags.join(", ") ?? ""} placeholder="html, revision" /></label>
        <label className="grid gap-1 text-sm font-medium">
          Roadmap day
          <select className={inputClass} name="dayId" defaultValue={note?.dayId ?? ""}>
            <option value="">None</option>
            {days.map((day) => <option key={day.id} value={day.id}>{day.label}</option>)}
          </select>
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="pinned" defaultChecked={note?.pinned} /> Pin</label>
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="forRevision" defaultChecked={note?.forRevision} /> Mark for revision</label>
        <button className={buttonClass()} type="submit">Save</button>
      </form>
      {note && today ? (
        <form action={scheduleRevisionAction}>
          <input type="hidden" name="noteId" value={note.id} />
          <input type="hidden" name="title" value={note.title} />
          <input type="hidden" name="from" value={today} />
          <input type="hidden" name="interval" value="1" />
          <button className={buttonClass("ghost")} type="submit">Schedule revision tomorrow</button>
        </form>
      ) : null}
      {note ? (
        <form action={deleteNoteAction}>
          <input type="hidden" name="id" value={note.id} />
          <input type="hidden" name="confirm" value="yes" />
          <button className={buttonClass("danger")} type="submit" onClick={(event) => { if (!confirm("Delete this note?")) event.preventDefault(); }}>Delete note</button>
        </form>
      ) : null}
      {note ? <p className="text-xs text-muted">Created {note.createdAt.slice(0, 10)} · Updated {note.updatedAt.slice(0, 10)}</p> : null}
    </div>
  );
}
