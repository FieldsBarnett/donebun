export type FilterMode = "personal" | "family" | "everyone";

/**
 * Common filtering logic for tasks based on assignment and privacy.
 */
export function filterTasks(tasks: any[], currentUser: any, filterMode: FilterMode) {
  if (!currentUser) return [];

  return tasks.filter(t => {
    // Visibility check (Privacy)
    const isVisibleToMe = !t.isPrivate || t.ownerId === currentUser._id;
    if (!isVisibleToMe) return false;

    if (filterMode === "personal") {
      // Personal mode: Only show tasks explicitly assigned to me or private tasks I own
      return t.assigneeId === currentUser._id || (t.isPrivate && t.ownerId === currentUser._id);
    }

    if (filterMode === "family") {
      // Family mode: Show tasks assigned to me, unassigned (family pool), or my private tasks
      // Exclude tasks assigned to other family members
      return !t.assigneeId || t.assigneeId === currentUser._id || (t.isPrivate && t.ownerId === currentUser._id);
    }

    // Everyone mode: Show everything visible (non-private or my private)
    return true;
  });
}

/**
 * Common filtering logic for calendar events based on assignment.
 */
export function filterCalendarEvents(events: any[], currentUser: any, filterMode: FilterMode) {
  if (!currentUser) return [];

  return events.filter(e => {
    if (filterMode === "personal" || filterMode === "family") {
      // Calendars currently always have an assignee, so "family" mode for calendars 
      // behaves like "personal" (only show my events).
      return e.assigneeId === currentUser._id;
    }
    // Everyone mode: Show all events
    return true;
  });
}
