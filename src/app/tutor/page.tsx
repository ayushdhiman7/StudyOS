import Link from "next/link";
import { MockInterviewLauncher, MockInterviewPanel } from "@/components/mock-interview";
import { TutorChat } from "@/components/tutor";
import { newChat } from "@/server/actions";
import { buttonClass } from "@/components/ui";
import { dayOptions, getMessages, getPrefs, listConversations, listNotes } from "@/lib/store";

export default async function TutorPage({
  searchParams,
}: {
  searchParams: Promise<{ chat?: string; day?: string; mode?: string }>;
}) {
  const params = await searchParams;
  const [conversations, prefs, notes] = await Promise.all([listConversations(), getPrefs(), listNotes({})]);
  const active = params.chat ?? "";
  const messages = active ? await getMessages(active) : [];
  const days = params.day
    ? dayOptions().filter((day) => day.id === params.day).concat(dayOptions().filter((day) => day.id !== params.day))
    : dayOptions();
  const mockMode = params.mode === "mock" && Boolean(active && params.day);

  return (
    <main className="grid gap-4 lg:grid-cols-[220px_1fr]">
      <aside className="grid gap-2">
        <form action={newChat}><button className={buttonClass()} type="submit">New chat</button></form>
        <MockInterviewLauncher days={days} />
        {conversations.length === 0 ? <p className="text-sm text-muted">No conversations yet.</p> : (
          <ul className="grid gap-1">
            {conversations.map((chat) => (
              <li key={chat.id}><Link className="block rounded-xl px-2 py-2 text-sm hover:bg-card" href={`/tutor?chat=${chat.id}`}>{chat.title}</Link></li>
            ))}
          </ul>
        )}
      </aside>
      <div className="grid gap-4">
        {mockMode && params.day ? (
          <MockInterviewPanel conversationId={active} dayId={params.day} />
        ) : null}
        <TutorChat
          conversationId={active}
          messages={messages}
          days={days}
          notes={notes.map((note) => ({ id: note.id, title: note.title }))}
          style={prefs.aiStyle}
        />
      </div>
    </main>
  );
}
