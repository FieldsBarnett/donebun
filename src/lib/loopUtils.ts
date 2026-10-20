import { STALE_LOOP_MS } from "./loopConstants";

export function formatLastTouched(lastTouched: number): string {
  const diffMs = Date.now() - lastTouched;
  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(lastTouched).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function isLoopStale(lastTouched: number): boolean {
  return Date.now() - lastTouched >= STALE_LOOP_MS;
}

export function staleLabel(lastTouched: number): string {
  const days = Math.floor((Date.now() - lastTouched) / (24 * 60 * 60 * 1000));
  return `untouched ${days} days`;
}

export const LOOP_STATUS_LABELS: Record<string, string> = {
  open: "Open",
  "stuck-waiting": "Stuck / waiting",
  closed: "Closed",
};
