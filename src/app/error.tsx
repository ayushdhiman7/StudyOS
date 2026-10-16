"use client";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="grid gap-3">
      <h1 className="text-2xl font-semibold">This page could not load</h1>
      <p className="text-sm text-muted">{error.message || "Check the connection and try again."}</p>
      <button className="min-h-11 w-fit rounded-xl bg-teal px-4 text-sm font-semibold text-teal-ink" type="button" onClick={reset}>
        Retry
      </button>
    </main>
  );
}
