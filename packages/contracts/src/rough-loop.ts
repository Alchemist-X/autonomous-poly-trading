// Rough-loop is the code-task automation runner (a dev tool), NOT part of the
// live-trading contract surface. Its schemas live here for now but are only
// consumed by services/rough-loop. Split out of index.ts (Stage 2,
// 2026-07-03); re-exported verbatim from index.ts.
import { z } from "zod";

export const roughLoopTaskStatusSchema = z.enum(["todo", "running", "blocked", "done", "cancelled"]);
export type RoughLoopTaskStatus = z.infer<typeof roughLoopTaskStatusSchema>;

export const roughLoopPrioritySchema = z.enum(["P0", "P1", "P2"]);
export type RoughLoopPriority = z.infer<typeof roughLoopPrioritySchema>;

export const roughLoopProviderSchema = z.string().min(1);
export type RoughLoopProvider = z.infer<typeof roughLoopProviderSchema>;

export const roughLoopDocumentSectionSchema = z.enum(["queue", "running", "blocked", "done"]);
export type RoughLoopDocumentSection = z.infer<typeof roughLoopDocumentSectionSchema>;

export const roughLoopTaskSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  status: roughLoopTaskStatusSchema,
  priority: roughLoopPrioritySchema,
  dependsOn: z.array(z.string()).default([]),
  allowedPaths: z.array(z.string()).default([]),
  definitionOfDone: z.array(z.string()).default([]),
  verification: z.array(z.string()).default([]),
  context: z.array(z.string()).default([]),
  latestResult: z.array(z.string()).default([]),
  attempts: z.number().int().nonnegative().default(0),
  section: roughLoopDocumentSectionSchema,
  createdOrder: z.number().int().nonnegative()
});
export type RoughLoopTask = z.infer<typeof roughLoopTaskSchema>;

export const roughLoopSelectionResultSchema = z.object({
  selectedTaskId: z.string().min(1).nullable(),
  reason: z.string().min(1),
  blockedTaskIds: z.array(z.string()).default([])
});
export type RoughLoopSelectionResult = z.infer<typeof roughLoopSelectionResultSchema>;

export const roughLoopVerificationCommandResultSchema = z.object({
  command: z.string().min(1),
  exitCode: z.number().int(),
  passed: z.boolean(),
  stdout: z.string(),
  stderr: z.string()
});
export type RoughLoopVerificationCommandResult = z.infer<typeof roughLoopVerificationCommandResultSchema>;

export const roughLoopVerificationResultSchema = z.object({
  passed: z.boolean(),
  summary: z.string().min(1),
  commandResults: z.array(roughLoopVerificationCommandResultSchema)
});
export type RoughLoopVerificationResult = z.infer<typeof roughLoopVerificationResultSchema>;

export const roughLoopRunStatusSchema = z.enum(["done", "retry", "blocked", "skipped", "failed"]);
export type RoughLoopRunStatus = z.infer<typeof roughLoopRunStatusSchema>;

export const roughLoopRunRecordSchema = z.object({
  runId: z.string().min(1),
  taskId: z.string().min(1),
  provider: roughLoopProviderSchema,
  status: roughLoopRunStatusSchema,
  attempt: z.number().int().positive(),
  startedAtUtc: z.string(),
  finishedAtUtc: z.string(),
  summary: z.string().min(1),
  changedFiles: z.array(z.string()),
  artifactsDir: z.string().min(1),
  verification: roughLoopVerificationResultSchema.nullable()
});
export type RoughLoopRunRecord = z.infer<typeof roughLoopRunRecordSchema>;
