"use client";

import { useLayoutEffect, useSyncExternalStore } from "react";
import { saveTheme } from "@/server/actions";

export type ThemeChoice = "light" | "dark" | "system";

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function applyTheme(theme: ThemeChoice) {
  const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
  localStorage.setItem("studyos-theme", theme);
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    media.removeEventListener("change", listener);
    window.removeEventListener("storage", listener);
  };
}

function storedTheme(fallback: ThemeChoice): ThemeChoice {
  if (typeof window === "undefined") return fallback;
  const stored = localStorage.getItem("studyos-theme");
  if (stored === "light" || stored === "dark" || stored === "system") return stored;
  return fallback;
}

function appearanceIsDark(theme: ThemeChoice) {
  const current = storedTheme(theme);
  return current === "dark" || (current === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
}

export function ThemeSync({ theme }: { theme: ThemeChoice }) {
  useLayoutEffect(() => {
    const stored = localStorage.getItem("studyos-theme");
    const current: ThemeChoice = stored === "light" || stored === "dark" || stored === "system" ? stored : theme;
    const dark = current === "dark" || (current === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
  });
  return null;
}

function selectTheme(next: "light" | "dark") {
  applyTheme(next);
  void saveTheme(next);
}

export function ThemeToggle({ theme }: { theme: ThemeChoice }) {
  const dark = useSyncExternalStore(subscribe, () => appearanceIsDark(theme), () => theme === "dark");

  return (
    <div role="group" aria-label="Theme" className="flex gap-[3px] rounded-[14px] border-2 border-line p-[3px]">
      <button
        type="button"
        className={`min-h-9 flex-1 rounded-[10px] text-[13px] font-bold ${dark ? "bg-transparent text-ink" : "bg-yellow text-[#111111]"}`}
        aria-pressed={!dark}
        onClick={() => selectTheme("light")}
      >
        Light
      </button>
      <button
        type="button"
        className={`min-h-9 flex-1 rounded-[10px] text-[13px] font-bold ${dark ? "bg-yellow text-[#111111]" : "bg-transparent text-ink"}`}
        aria-pressed={dark}
        onClick={() => selectTheme("dark")}
      >
        Dark
      </button>
    </div>
  );
}

export function ThemeField({ theme }: { theme: ThemeChoice }) {
  const value = useSyncExternalStore(subscribe, () => storedTheme(theme), () => theme);

  function choose(next: ThemeChoice) {
    applyTheme(next);
    void saveTheme(next);
  }

  return (
    <fieldset className="grid gap-2">
      <legend className="text-sm font-medium">Theme</legend>
      {(["system", "light", "dark"] as const).map((option) => (
        <label key={option} className="flex min-h-11 items-center gap-2 text-sm">
          <input type="radio" name="theme" value={option} checked={value === option} onChange={() => choose(option)} />
          {option}
        </label>
      ))}
    </fieldset>
  );
}
