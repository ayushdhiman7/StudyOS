export const PLAN_START = "2026-10-17";
export const PLAN_END = "2026-11-15";
export const APP_TIMEZONE = "Asia/Kolkata";
export const DEFAULT_INTERVALS = [1, 3, 7] as const;

export type AnchorChoice = "keep" | "restart" | null;

export type Preferences = {
  theme: "light" | "dark" | "system";
  officeDays: number[];
  workHours: string;
  studyStart: string;
  officeMinutes: number;
  weekendMinutes: number;
  holidayMinutes: number;
  holidays: string[];
  reminderTime: string;
  notificationsEnabled: boolean;
  notificationTypes: {
    study: boolean;
    upcoming: boolean;
    session: boolean;
    revision: boolean;
    incomplete: boolean;
    weekly: boolean;
  };
  revisionIntervals: number[];
  aiStyle: "beginner" | "deep" | "interview" | "example" | "quiz" | "revision";
  anchorChoice: AnchorChoice;
  anchorDate: string | null;
};

export const defaultPreferences: Preferences = {
  theme: "system",
  officeDays: [1, 2, 3, 4, 5],
  workHours: "09:00-18:00",
  studyStart: "20:00",
  officeMinutes: 120,
  weekendMinutes: 360,
  holidayMinutes: 330,
  holidays: ["2026-10-20"],
  reminderTime: "20:00",
  notificationsEnabled: true,
  notificationTypes: {
    study: true,
    upcoming: true,
    session: true,
    revision: true,
    incomplete: true,
    weekly: false,
  },
  revisionIntervals: [...DEFAULT_INTERVALS],
  aiStyle: "beginner",
  anchorChoice: null,
  anchorDate: null,
};

export function localToday(now = new Date(), timeZone = APP_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function diffDays(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  return Math.round((end - start) / 86_400_000);
}

export function weekdayIndex(iso: string): number {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function formatLong(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function greeting(now = new Date(), timeZone = APP_TIMEZONE): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "numeric",
      hourCycle: "h23",
    }).format(now),
  );
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function zonedTimeToUtc(isoDate: string, hhmm: string, timeZone = APP_TIMEZONE): Date {
  const [hour, minute] = hhmm.split(":").map(Number);
  const [year, month, day] = isoDate.split("-").map(Number);
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(guess);
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const zonedAsUtc = Date.UTC(read("year"), read("month") - 1, read("day"), read("hour"), read("minute"));
  return new Date(guess.getTime() - (zonedAsUtc - guess.getTime()));
}

export function checklistProgress(itemIds: string[], completed: ReadonlySet<string>) {
  const total = itemIds.length;
  const done = itemIds.filter((id) => completed.has(id)).length;
  return {
    done,
    total,
    ratio: total === 0 ? 0 : done / total,
    complete: total > 0 && done === total,
  };
}

export function roadmapProgress(dayResults: { complete: boolean }[]) {
  const total = dayResults.length;
  const done = dayResults.filter((day) => day.complete).length;
  return { done, total, ratio: total === 0 ? 0 : done / total };
}

/** A calendar date counts once. The current streak includes today, or yesterday if today is not finished yet. */
export function studyStreak(dates: string[], today: string): { current: number; longest: number } {
  const unique = [...new Set(dates)].filter(Boolean).sort();
  let longest = 0;
  let run = 0;
  let previous = "";
  for (const date of unique) {
    run = previous && diffDays(previous, date) === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = date;
  }
  const set = new Set(unique);
  let cursor = set.has(today) ? today : addDays(today, -1);
  if (!set.has(cursor)) return { current: 0, longest };
  let current = 0;
  while (set.has(cursor)) {
    current += 1;
    cursor = addDays(cursor, -1);
  }
  return { current, longest };
}

export type ClockStatus = "running" | "paused" | "finished";

export type SessionClock = {
  status: ClockStatus;
  elapsedSeconds: number;
  lastResumedAt: string | null;
};

export function elapsedSeconds(session: SessionClock, now: Date): number {
  const base = Math.max(0, Math.floor(session.elapsedSeconds));
  if (session.status !== "running" || !session.lastResumedAt) return base;
  const extra = Math.floor((now.getTime() - Date.parse(session.lastResumedAt)) / 1000);
  return base + Math.max(0, extra);
}

export function pauseClock(session: SessionClock, now: Date): SessionClock {
  if (session.status === "finished") return { ...session, lastResumedAt: null };
  return { status: "paused", elapsedSeconds: elapsedSeconds(session, now), lastResumedAt: null };
}

export function resumeClock(session: SessionClock, now: Date): SessionClock {
  if (session.status === "finished") return session;
  return {
    status: "running",
    elapsedSeconds: elapsedSeconds(session, now),
    lastResumedAt: now.toISOString(),
  };
}

export function finishClock(session: SessionClock, now: Date): SessionClock {
  return {
    status: "finished",
    elapsedSeconds: elapsedSeconds(session, now),
    lastResumedAt: null,
  };
}

export function remainingSeconds(plannedSeconds: number, elapsed: number): number {
  return Math.max(0, plannedSeconds - elapsed);
}

export function nextDueDate(fromIso: string, intervalDays: number): string {
  return addDays(fromIso, intervalDays);
}

/** Gaps between reviews. Completed on day 0, then +1, +3, +7 by default. */
export function revisionSchedule(fromIso: string, intervals: number[] = [...DEFAULT_INTERVALS]): string[] {
  let cursor = fromIso;
  return intervals.map((days) => {
    cursor = addDays(cursor, days);
    return cursor;
  });
}

export function revisionPriority(input: {
  dueDate: string;
  today: string;
  confidence: number | null;
  topicAccuracy: number | null;
}): number {
  const overdue = Math.max(0, diffDays(input.dueDate, input.today));
  const lowConfidence = input.confidence == null ? 1 : Math.max(0, 5 - input.confidence);
  const weakness = input.topicAccuracy == null ? 1 : Math.max(0, 1 - input.topicAccuracy);
  return overdue * 10 + lowConfidence * 2 + weakness * 5;
}

export function plannedMinutes(
  date: string,
  holiday: boolean,
  prefs: Pick<Preferences, "officeDays" | "officeMinutes" | "weekendMinutes" | "holidayMinutes" | "holidays">,
): number {
  if (holiday || prefs.holidays.includes(date)) return prefs.holidayMinutes;
  const day = weekdayIndex(date);
  if (!prefs.officeDays.includes(day)) return prefs.weekendMinutes;
  return prefs.officeMinutes;
}

export function displayDate(
  originalDate: string,
  scheduledDate: string | null | undefined,
  prefs: Pick<Preferences, "anchorChoice" | "anchorDate">,
): string {
  if (scheduledDate) return scheduledDate;
  if (prefs.anchorChoice === "restart" && prefs.anchorDate) {
    return addDays(originalDate, diffDays(PLAN_START, prefs.anchorDate));
  }
  return originalDate;
}

export function nextOpenDate(start: string, occupied: ReadonlySet<string>, holidays: readonly string[]): string {
  let cursor = start;
  for (let i = 0; i < 400; i += 1) {
    if (!occupied.has(cursor) && !holidays.includes(cursor)) return cursor;
    cursor = addDays(cursor, 1);
  }
  return cursor;
}

export type ReminderDraft = {
  id: string;
  at: string;
  title: string;
  body: string;
  href: string;
};

export function buildReminders(input: {
  now: Date;
  today: string;
  prefs: Preferences;
  studyTitle: string | null;
  studyHref: string | null;
  revisions: { id: string; title: string; href: string; dueDate: string }[];
  unfinishedCount: number;
  weekDone: number;
  weekTotal: number;
}): ReminderDraft[] {
  if (!input.prefs.notificationsEnabled) return [];
  const types = input.prefs.notificationTypes;
  const reminders: ReminderDraft[] = [];
  const studyAt = (day: string) => zonedTimeToUtc(day, input.prefs.reminderTime).toISOString();
  const upcomingAt = (day: string) => zonedTimeToUtc(day, input.prefs.studyStart).toISOString();

  if (types.study && input.studyTitle && input.studyHref) {
    let day = input.today;
    let at = studyAt(day);
    if (Date.parse(at) <= input.now.getTime()) {
      day = addDays(day, 1);
      at = studyAt(day);
    }
    reminders.push({
      id: `study:${day}`,
      at,
      title: "Study time",
      body: `Study time: Continue with ${input.studyTitle}.`,
      href: input.studyHref,
    });
  }

  if (types.upcoming && input.studyTitle && input.studyHref) {
    let day = input.today;
    let at = upcomingAt(day);
    if (Date.parse(at) <= input.now.getTime()) {
      day = addDays(day, 1);
      at = upcomingAt(day);
    }
    reminders.push({
      id: `upcoming:${day}`,
      at,
      title: "Upcoming study session",
      body: `Upcoming study session: ${input.studyTitle}.`,
      href: input.studyHref,
    });
  }

  if (types.revision) {
    for (const item of input.revisions.filter((revision) => revision.dueDate <= input.today).slice(0, 3)) {
      reminders.push({
        id: `revision:${item.id}:${input.today}`,
        at: new Date(input.now.getTime() + 60_000).toISOString(),
        title: "Revision reminder",
        body: `Quick revision: Review ${item.title}.`,
        href: item.href,
      });
    }
  }

  if (types.incomplete && input.unfinishedCount > 0) {
    reminders.push({
      id: `incomplete:${input.today}`,
      at: zonedTimeToUtc(input.today, "21:30").toISOString(),
      title: "Unfinished topics",
      body: `You have ${input.unfinishedCount} unfinished ${input.unfinishedCount === 1 ? "topic" : "topics"}. Plan a catch-up session?`,
      href: "/roadmap?status=open",
    });
  }

  if (types.weekly && weekdayIndex(input.today) === 0) {
    reminders.push({
      id: `weekly:${input.today}`,
      at: studyAt(input.today),
      title: "Weekly summary",
      body: `This week: ${input.weekDone} of ${input.weekTotal} planned days are complete.`,
      href: "/",
    });
  }

  const seen = new Set<string>();
  return reminders.filter((reminder) => {
    if (seen.has(reminder.id)) return false;
    seen.add(reminder.id);
    return true;
  });
}
