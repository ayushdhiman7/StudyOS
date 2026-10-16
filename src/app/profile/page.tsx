import { ImportForm } from "@/components/import-form";
import { WeeklyReviewCard } from "@/components/weekly-review";
import { Card, buttonClass, inputClass } from "@/components/ui";
import { destructiveAction, saveSettings } from "@/server/actions";
import { exportData, getPrefs, listRevisions } from "@/lib/store";
import { usageSummary } from "@/lib/gemini";
import { reviewRevisionAction } from "@/server/actions";
import { NotifyButton } from "@/components/notify-button";
import { ThemeField } from "@/components/theme-sync";

export default async function ProfilePage() {
  const [prefs, revisions, usage, backup] = await Promise.all([getPrefs(), listRevisions(), usageSummary(), exportData()]);
  const download = `data:application/json,${encodeURIComponent(JSON.stringify(backup, null, 2))}`;
  return (
    <main className="grid gap-4">
      <header>
        <h1 className="text-3xl font-semibold">Profile</h1>
        <p className="text-sm text-muted">StudyOS AI 1.0. Notes, progress, and chats are stored in the MongoDB database named studyos. The Gemini key stays on the server and is never shown here.</p>
      </header>
      <Card>
        <h2 className="font-semibold">AI usage</h2>
        <p className="mt-1 text-sm text-muted">{usage.today} Gemini requests today, {usage.total} in total. Each request can use paid quota. Output is capped by GEMINI_MAX_OUTPUT_TOKENS. A quota error is not retried.</p>
      </Card>
      <Card>
        <h2 className="font-semibold">Weekly AI review</h2>
        <div className="mt-3">
          <WeeklyReviewCard />
        </div>
      </Card>
      <Card>
        <h2 className="font-semibold">Settings</h2>
        <form action={saveSettings} className="mt-3 grid gap-3">
          <ThemeField theme={prefs.theme} />
          <label className="grid gap-1 text-sm font-medium">Work hours<input className={inputClass} name="workHours" defaultValue={prefs.workHours} /></label>
          <label className="grid gap-1 text-sm font-medium">Study start<input className={inputClass} name="studyStart" type="time" defaultValue={prefs.studyStart} /></label>
          <label className="grid gap-1 text-sm font-medium">Office minutes<input className={inputClass} name="officeMinutes" type="number" min={15} defaultValue={prefs.officeMinutes} /></label>
          <label className="grid gap-1 text-sm font-medium">Weekend minutes<input className={inputClass} name="weekendMinutes" type="number" min={15} defaultValue={prefs.weekendMinutes} /></label>
          <label className="grid gap-1 text-sm font-medium">Holiday minutes<input className={inputClass} name="holidayMinutes" type="number" min={15} defaultValue={prefs.holidayMinutes} /></label>
          <fieldset>
            <legend className="text-sm font-medium">Office days</legend>
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label, index) => (
              <label key={label} className="mr-3 inline-flex min-h-11 items-center gap-1 text-sm">
                <input type="checkbox" name="officeDays" value={index} defaultChecked={prefs.officeDays.includes(index)} /> {label}
              </label>
            ))}
          </fieldset>
          <label className="grid gap-1 text-sm font-medium">Holidays<input className={inputClass} name="holidays" defaultValue={prefs.holidays.join(", ")} /></label>
          <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="notificationsEnabled" defaultChecked={prefs.notificationsEnabled} /> Enable reminders</label>
          <p className="text-xs text-muted">Browser reminders need permission and only fire while this site is open. The operating system can delay them. They are not push notifications.</p>
          <label className="grid gap-1 text-sm font-medium">Reminder time<input className={inputClass} name="reminderTime" type="time" defaultValue={prefs.reminderTime} /></label>
          {([
            ["notifyStudy", "Daily study", prefs.notificationTypes.study],
            ["notifyUpcoming", "Upcoming session", prefs.notificationTypes.upcoming],
            ["notifySession", "Session complete", prefs.notificationTypes.session],
            ["notifyRevision", "Revision", prefs.notificationTypes.revision],
            ["notifyIncomplete", "Incomplete topics", prefs.notificationTypes.incomplete],
            ["notifyWeekly", "Weekly summary", prefs.notificationTypes.weekly],
          ] as const).map(([name, label, checked]) => (
            <label key={name} className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name={name} defaultChecked={checked} /> {label}</label>
          ))}
          <label className="grid gap-1 text-sm font-medium">Revision intervals in days<input className={inputClass} name="revisionIntervals" defaultValue={prefs.revisionIntervals.join(", ")} /></label>
          <label className="grid gap-1 text-sm font-medium">
            AI style
            <select className={inputClass} name="aiStyle" defaultValue={prefs.aiStyle}>
              {["beginner", "deep", "interview", "example", "quiz", "revision"].map((style) => <option key={style} value={style}>{style}</option>)}
            </select>
          </label>
          <button className={buttonClass()} type="submit">Save settings</button>
        </form>
        <div className="mt-3"><NotifyButton /></div>
      </Card>
      <Card>
        <h2 className="font-semibold">Revision queue</h2>
        <ul className="mt-2 grid gap-2">
          {revisions.filter((item) => item.status === "pending").map((item) => (
            <li key={item.id} className="text-sm">
              {item.title} · due {item.dueDate}
              <form action={reviewRevisionAction} className="mt-1 flex gap-2">
                <input type="hidden" name="id" value={item.id} />
                <input className="w-16 rounded-lg border border-line px-2" name="confidence" type="number" min={1} max={5} defaultValue={3} aria-label="Confidence" />
                <button className={buttonClass("ghost")} type="submit">Mark reviewed</button>
              </form>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <h2 className="font-semibold">Backup</h2>
        <a className={`${buttonClass("ghost")} mt-3`} href={download} download="studyos-backup.json">Export notes and progress</a>
        <div className="mt-4"><ImportForm /></div>
      </Card>
      <Card>
        <h2 className="font-semibold">Privacy</h2>
        <p className="mt-2 text-sm text-muted">Notes and chats stay in your MongoDB database. They are sent to Gemini only when you ask a question, attach notes, or generate a quiz or note. Server logs record status codes, not full conversations or secrets.</p>
      </Card>
      <Card>
        <h2 className="font-semibold">Delete data</h2>
        {([
          ["chats", "Clear chat history"],
          ["notes", "Delete saved notes"],
          ["progress", "Reset study progress"],
        ] as const).map(([kind, label]) => (
          <form key={kind} action={destructiveAction} className="mt-3">
            <input type="hidden" name="kind" value={kind} />
            <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="confirm" value="yes" /> I understand this cannot be undone</label>
            <button className={`${buttonClass("danger")} mt-2`} type="submit">{label}</button>
          </form>
        ))}
      </Card>
    </main>
  );
}
