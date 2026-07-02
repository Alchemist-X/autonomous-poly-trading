// Analyst-in-the-loop persistence: marks (keep/doubt) and notes/hypotheses per
// forecast, stored as analyst.json in the event dir. The engine reads this file
// at the start of each round and injects unconsumed notes + doubts into its
// research prompt (see scripts/forecast — the shapes below mirror its types).

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { eventDir } from "./repo";

export type AnalystStance = "yes" | "no" | "question";
export type AnalystMark = "keep" | "doubt";

export interface AnalystNote {
  id: string;
  text: string;
  stance: AnalystStance;
  targetId: string | null; // LedgerEntry id (or demo evidence id) when attached to one card
  createdAtUtc: string;
  consumedRound: number | null; // set by the engine once folded into a round
}

export interface AnalystState {
  notes: AnalystNote[];
  marks: Record<string, AnalystMark>;
  // Engine-owned stamp (ledger id -> round that injected the doubt). Must be
  // preserved through every app-side read-modify-write or doubts re-inject.
  doubtsHandled?: Record<string, number>;
}

function analystPath(eventId: string): string {
  return path.join(eventDir(eventId), "analyst.json");
}

export function loadAnalyst(eventId: string): AnalystState {
  const file = analystPath(eventId);
  if (!existsSync(file)) return { notes: [], marks: {} };
  try {
    const raw = JSON.parse(readFileSync(file, "utf8")) as Partial<AnalystState>;
    const notes = Array.isArray(raw.notes)
      ? raw.notes.filter((n): n is AnalystNote => Boolean(n && typeof n.id === "string" && typeof n.text === "string"))
      : [];
    const marks: Record<string, AnalystMark> = {};
    if (raw.marks && typeof raw.marks === "object") {
      for (const [k, v] of Object.entries(raw.marks)) {
        if (v === "keep" || v === "doubt") marks[k] = v;
      }
    }
    const doubtsHandled: Record<string, number> = {};
    if (raw.doubtsHandled && typeof raw.doubtsHandled === "object") {
      for (const [k, v] of Object.entries(raw.doubtsHandled)) {
        if (typeof v === "number" && Number.isFinite(v)) doubtsHandled[k] = v;
      }
    }
    return { notes, marks, doubtsHandled };
  } catch {
    return { notes: [], marks: {} };
  }
}

export function saveAnalyst(eventId: string, state: AnalystState): void {
  const dir = eventDir(eventId);
  mkdirSync(dir, { recursive: true });
  const file = analystPath(eventId);
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, JSON.stringify(state, null, 2), "utf8");
  renameSync(tmp, file);
}

export function addNote(
  eventId: string,
  input: { text: string; stance: AnalystStance; targetId: string | null }
): AnalystNote {
  const current = loadAnalyst(eventId);
  const note: AnalystNote = {
    id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    text: input.text.trim(),
    stance: input.stance,
    targetId: input.targetId,
    createdAtUtc: new Date().toISOString(),
    consumedRound: null
  };
  saveAnalyst(eventId, { ...current, notes: [...current.notes, note] });
  return note;
}

export function removeNote(eventId: string, noteId: string): boolean {
  const current = loadAnalyst(eventId);
  const notes = current.notes.filter((n) => n.id !== noteId);
  if (notes.length === current.notes.length) return false;
  saveAnalyst(eventId, { ...current, notes });
  return true;
}

export function setMark(eventId: string, targetId: string, mark: AnalystMark | null): AnalystState {
  const current = loadAnalyst(eventId);
  const marks = { ...current.marks };
  if (mark === null) delete marks[targetId];
  else marks[targetId] = mark;
  const next = { ...current, marks };
  saveAnalyst(eventId, next);
  return next;
}
