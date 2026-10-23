/**
 * Pure helpers for normalizing voice / LLM-extracted task fields.
 * Shared between Convex actions and unit tests.
 */

export type VoiceRecurrence = {
  strategy: "fixed" | "completion";
  frequency: "daily" | "weekly" | "monthly" | "yearly";
  interval: number;
};

const EXPLICIT_RECURRENCE =
  /\b(every\s+(day|week|month|year|monday|tuesday|wednesday|thursday|friday|saturday|sunday|other\s+week)|each\s+(day|week|month|year|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|daily|weekly|monthly|yearly|recurring|repeat(ing)?|every\s+\d+\s+(days?|weeks?|months?|years?))\b/i;

/** Words that describe a one-off deadline, not a repeating schedule. */
const ONE_OFF_DEADLINE =
  /\b(deadline|due|by\s+(today|tomorrow|tonight|end\s+of\s+(day|week)|eod|eow)|before\s+|no\s+later\s+than)\b/i;

export function transcriptRequestsRecurrence(transcript: string): boolean {
  const t = transcript.trim();
  if (!t) return false;
  return EXPLICIT_RECURRENCE.test(t);
}

/**
 * Drop LLM-invented recurrence unless the transcript clearly asks to repeat.
 * Also drop when the phrasing is clearly a one-off deadline.
 */
export function sanitizeVoiceRecurrence(
  recurrence: VoiceRecurrence | null | undefined,
  transcript: string,
  title?: string,
): VoiceRecurrence | null {
  if (!recurrence) return null;

  const context = `${transcript}\n${title ?? ""}`;
  if (ONE_OFF_DEADLINE.test(context) && !EXPLICIT_RECURRENCE.test(transcript)) {
    return null;
  }

  if (!transcriptRequestsRecurrence(transcript)) {
    return null;
  }

  return recurrence;
}

export function normalizeVoiceRecurrence(raw: unknown): VoiceRecurrence | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const strategy = r.strategy === "completion" ? "completion" : "fixed";
  const frequency = r.frequency;
  if (
    frequency !== "daily" &&
    frequency !== "weekly" &&
    frequency !== "monthly" &&
    frequency !== "yearly"
  ) {
    return null;
  }
  const interval =
    typeof r.interval === "number" && r.interval >= 1 ? Math.floor(r.interval) : 1;
  return { strategy, frequency, interval };
}
