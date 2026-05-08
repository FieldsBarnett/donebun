/**
 * Safely parses a date string into a local Date object.
 * Handles "YYYY-MM-DD" as local midnight instead of UTC midnight.
 * Handles "YYYY-MM-DDTHH:mm:ss" as local time.
 */
export function parseDueDate(dueDate: string): Date {
  if (!dueDate.includes("T")) {
    const [year, month, day] = dueDate.split("-").map(Number);
    return new Date(year, month - 1, day);
  }
  return new Date(dueDate);
}

/**
 * Checks if two dates are the same day in local time.
 */
export function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

/**
 * Returns a key for grouping by date (YYYY-MM-DD) in local time.
 */
export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
