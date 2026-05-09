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
 * Returns a local date string (YYYY-MM-DD) or date-time string (YYYY-MM-DDTHH:mm:ss).
 * Does not include the 'Z' suffix, maintaining the time as "local" for all users.
 */
export function toLocalISOString(date: Date, includeTime: boolean): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const datePart = `${year}-${month}-${day}`;

  if (!includeTime) return datePart;

  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${datePart}T${hours}:${minutes}:${seconds}`;
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
