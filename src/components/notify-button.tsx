"use client";

import { buttonClass } from "@/components/ui";

export function NotifyButton() {
  return (
    <button
      className={buttonClass("ghost")}
      type="button"
      onClick={() => {
        if (typeof Notification === "undefined") return;
        void Notification.requestPermission();
      }}
    >
      Allow browser reminders
    </button>
  );
}
