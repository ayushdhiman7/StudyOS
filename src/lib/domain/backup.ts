import { z } from "zod";

const iso = z.string().regex(/^\d{4}-\d{2}-\d{2}(T[\d:.Z+-]+)?$/);

export const backupSchema = z.object({
  format: z.literal("studyos-backup"),
  version: z.literal(1),
  exportedAt: z.string(),
  notes: z.array(
    z.object({
      id: z.string().min(1),
      title: z.string().min(1).max(200),
      body: z.string().max(100_000),
      dayId: z.string().nullable(),
      tags: z.array(z.string().max(40)).max(20),
      pinned: z.boolean(),
      forRevision: z.boolean(),
      createdAt: iso,
      updatedAt: iso,
    }),
  ),
  completions: z.array(
    z.object({
      id: z.string().min(1),
      dayId: z.string().min(1),
      completedAt: z.string().nullable(),
      updatedAt: iso,
    }),
  ),
  dayStates: z.array(
    z.object({
      id: z.string().min(1),
      completedAt: z.string().nullable(),
      skippedAt: z.string().nullable(),
      scheduledDate: z.string().nullable(),
      personalNotes: z.string().max(20_000),
      updatedAt: iso,
    }),
  ),
  sessions: z.array(
    z.object({
      id: z.string().min(1),
      dayId: z.string().min(1),
      plannedSeconds: z.number().int().nonnegative(),
      elapsedSeconds: z.number().int().nonnegative(),
      status: z.enum(["running", "paused", "finished"]),
      startedAt: iso,
      lastResumedAt: z.string().nullable(),
      finishedAt: z.string().nullable(),
      notes: z.string().max(20_000),
      updatedAt: iso,
    }),
  ),
  quizAttempts: z.array(
    z.object({
      id: z.string().min(1),
      dayId: z.string().min(1),
      startedAt: iso,
      finishedAt: z.string().nullable(),
      score: z.number().int().nonnegative(),
      total: z.number().int().nonnegative(),
      durationSeconds: z.number().int().nonnegative(),
      answers: z.record(z.string(), z.string()),
      weakTopics: z.array(z.string()),
    }),
  ),
  revisionItems: z.array(
    z.object({
      id: z.string().min(1),
      dayId: z.string().nullable(),
      noteId: z.string().nullable(),
      title: z.string().min(1).max(200),
      dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      intervalDays: z.number().int().positive(),
      stage: z.number().int().nonnegative(),
      status: z.enum(["pending", "done"]),
      confidence: z.number().int().min(1).max(5).nullable(),
      createdAt: iso,
      updatedAt: iso,
    }),
  ),
  preferences: z.record(z.string(), z.unknown()).nullable(),
});

export type BackupFile = z.infer<typeof backupSchema>;

export function parseBackup(input: unknown): { ok: true; data: BackupFile } | { ok: false; error: string } {
  const parsed = backupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "The file is not a StudyOS backup." };
  return { ok: true, data: parsed.data };
}

export function mergeByUpdatedAt<T extends { id: string; updatedAt: string }>(current: T[], incoming: T[]): T[] {
  const map = new Map(current.map((item) => [item.id, item]));
  for (const item of incoming) {
    const existing = map.get(item.id);
    if (!existing || Date.parse(item.updatedAt) >= Date.parse(existing.updatedAt)) map.set(item.id, item);
  }
  return [...map.values()];
}
