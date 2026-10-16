import Link from "next/link";
import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-[20px] border-2 border-line bg-card p-5 hard-shadow ${className}`}>
      {children}
    </section>
  );
}

export function buttonClass(variant: "primary" | "ghost" | "danger" | "yellow" = "primary") {
  const base =
    "inline-flex min-h-12 items-center justify-center gap-2 rounded-[14px] border-2 border-[#111111] px-5 text-[15px] font-bold text-[#111111] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral";
  if (variant === "ghost") return `${base} bg-white text-[#111111]`;
  if (variant === "danger") return `${base} bg-coral`;
  if (variant === "yellow") return `${base} bg-yellow text-[#111111]`;
  return `${base} bg-coral`;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1 text-sm font-medium text-ink">
      {label}
      {children}
    </label>
  );
}

export const inputClass =
  "min-h-12 w-full rounded-[14px] border-2 border-line bg-card px-3 text-base text-ink";

export function Empty({ title, body, href, action }: { title: string; body: string; href?: string; action?: string }) {
  return (
    <Card>
      <h2 className="font-display text-lg">{title}</h2>
      <p className="mt-1 text-sm text-muted">{body}</p>
      {href && action ? (
        <Link className={`${buttonClass()} mt-4`} href={href}>
          {action}
        </Link>
      ) : null}
    </Card>
  );
}

export function ProgressBar({ value }: { value: number }) {
  const width = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div className="h-2 overflow-hidden rounded-full bg-track" role="progressbar" aria-valuenow={width} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-coral" style={{ width: `${width}%` }} />
    </div>
  );
}

export function RichText({ text }: { text: string }) {
  const chunks = text.split(/```/);
  return (
    <div className="space-y-3 text-sm leading-6">
      {chunks.map((chunk, index) => {
        if (index % 2 === 0) {
          return (
            <p key={index} className="whitespace-pre-wrap">
              {chunk}
            </p>
          );
        }
        const newline = chunk.indexOf("\n");
        const code = newline === -1 ? chunk : chunk.slice(newline + 1);
        return (
          <pre key={index} className="overflow-x-auto rounded-[14px] border-2 border-line bg-ink p-3 text-xs text-canvas">
            <code>{code}</code>
          </pre>
        );
      })}
    </div>
  );
}
