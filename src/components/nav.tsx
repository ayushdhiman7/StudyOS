"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { CircleUser, House, Map, NotebookPen, Sparkles } from "lucide-react";
import { ThemeToggle, type ThemeChoice } from "@/components/theme-sync";

const links = [
  { href: "/", label: "Home", short: "Home", icon: House },
  { href: "/roadmap", label: "Roadmap", short: "Plan", icon: Map },
  { href: "/tutor", label: "AI Tutor", short: "Tutor", icon: Sparkles },
  { href: "/notes", label: "Notes", short: "Notes", icon: NotebookPen },
  { href: "/profile", label: "Profile", short: "You", icon: CircleUser },
];

export function PrimaryNav({ pathname, theme = "system" }: { pathname?: string; theme?: ThemeChoice }) {
  const current = usePathname();
  const path = pathname ?? current;
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-line bg-card md:inset-y-0 md:left-0 md:flex md:w-60 md:flex-col md:border-r-2 md:border-t-0"
    >
      <div className="hidden px-5 pb-2 pt-7 md:block">
        <p className="text-xs font-bold tracking-[0.12em]">STUDYOS</p>
        <p className="font-display mt-1.5 text-[22px] leading-none">Ayush Kumar</p>
        <p className="mb-5 mt-1 text-[13px] text-muted">30-day plan</p>
      </div>
      <ul className="grid grid-cols-5 gap-1 px-2 py-2 md:mt-0 md:grid-cols-1 md:gap-1.5 md:px-3">
        {links.map((link) => {
          const active = link.href === "/" ? path === "/" : path.startsWith(link.href);
          const Icon = link.icon;
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-[14px] px-1 text-[11px] font-medium md:min-h-[46px] md:flex-row md:justify-start md:gap-3 md:px-3 md:text-[15px] ${
                  active
                    ? "border-2 border-line bg-yellow text-on-yellow"
                    : "border-2 border-transparent text-muted"
                }`}
              >
                <Icon
                  className={`size-5 shrink-0 ${active ? "text-[#111111]" : ""}`}
                  color={active ? "#111111" : undefined}
                  strokeWidth={1.8}
                  aria-hidden
                />
                <span className="md:hidden">{link.short}</span>
                <span className="hidden md:inline">{link.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="mt-auto hidden px-3 pb-5 md:block">
        <ThemeToggle theme={theme} />
      </div>
    </nav>
  );
}

export function ReminderHost({
  enabled,
  reminders,
}: {
  enabled: boolean;
  reminders: { id: string; at: string; title: string; body: string; href: string }[];
}) {
  useEffect(() => {
    if (!enabled || typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const timers: number[] = [];
    const now = Date.now();
    for (const reminder of reminders) {
      const delay = Date.parse(reminder.at) - now;
      if (delay < 0 || delay > 36 * 60 * 60 * 1000) continue;
      const key = `studyos-reminder:${reminder.id}`;
      if (sessionStorage.getItem(key)) continue;
      timers.push(
        window.setTimeout(() => {
          sessionStorage.setItem(key, "1");
          const notification = new Notification(reminder.title, { body: reminder.body, tag: reminder.id });
          notification.onclick = () => {
            window.focus();
            window.location.assign(reminder.href);
          };
        }, delay),
      );
    }
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [enabled, reminders]);
  return null;
}
