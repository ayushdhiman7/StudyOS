"use client";

import { useEffect, useState } from "react";
import { buttonClass } from "@/components/ui";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // Avoid registering over Turbopack HMR noise in very early boots; still fine in prod/dev.
    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });
        if (registration.waiting) registration.waiting.postMessage("SKIP_WAITING");
        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              worker.postMessage("SKIP_WAITING");
            }
          });
        });
      } catch {
        // Registration can fail on insecure origins other than localhost.
      }
    };
    void register();
  }, []);
  return null;
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in window.navigator && Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone));
    setIsStandalone(standalone);
    setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent));
    setDismissed(sessionStorage.getItem("studyos-pwa-dismiss") === "1");

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (isStandalone || dismissed) return null;
  if (!deferred && !isIOS) return null;

  return (
    <div className="fixed inset-x-3 bottom-[5.5rem] z-40 rounded-[20px] border-2 border-line bg-card p-3 hard-shadow md:bottom-6 md:left-auto md:right-6 md:w-80">
      <p className="font-display text-lg leading-none">Install StudyOS</p>
      <p className="mt-2 text-sm text-muted">
        {isIOS
          ? "On iPhone/iPad: Share → Add to Home Screen for the full-screen app."
          : "Add StudyOS to your home screen for quick access and an app-like window."}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {deferred ? (
          <button
            className={buttonClass()}
            type="button"
            onClick={async () => {
              await deferred.prompt();
              await deferred.userChoice;
              setDeferred(null);
            }}
          >
            Install
          </button>
        ) : null}
        <button
          className={buttonClass("ghost")}
          type="button"
          onClick={() => {
            sessionStorage.setItem("studyos-pwa-dismiss", "1");
            setDismissed(true);
          }}
        >
          Not now
        </button>
      </div>
    </div>
  );
}
