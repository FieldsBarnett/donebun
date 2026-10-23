/** Dashboard time buckets — must match Convex `reorderDashboardTasks` args. */
export type DashboardBucket =
  | "today"
  | "overdue"
  | "unscheduled"
  | "upcoming";

export interface DashboardSortableTask {
  _id: string;
  title: string;
  dueDate?: string;
  dashboardOrder?: number;
}

function getTime(iso: string | undefined): number {
  if (!iso) return Infinity;
  if (!iso.includes("T")) return Infinity;
  return new Date(iso).getTime();
}

/** Sort tasks within one category group on the dashboard. */
export function sortTasksInDashboardGroup<T extends DashboardSortableTask>(
  tasks: T[],
): T[] {
  return [...tasks].sort((a, b) => {
    const orderA = a.dashboardOrder ?? Infinity;
    const orderB = b.dashboardOrder ?? Infinity;
    if (orderA !== orderB) return orderA - orderB;
    const timeA = getTime(a.dueDate);
    const timeB = getTime(b.dueDate);
    if (timeA !== timeB) return timeA - timeB;
    return a.title.localeCompare(b.title);
  });
}

export function categoryContainerId(categoryId: string | null | undefined): string {
  return categoryId ?? "__none__";
}

export function buildDashboardContainers<T extends { categoryId?: string | null }>(
  tasks: T[],
  categories: { _id: string; name: string }[],
): Record<string, T[]> {
  const groups: Record<string, T[]> = { __none__: [] };

  for (const task of tasks) {
    const key = categoryContainerId(task.categoryId ?? null);
    if (!groups[key]) groups[key] = [];
    groups[key].push(task);
  }

  for (const cat of categories) {
    if (!groups[cat._id]) groups[cat._id] = [];
  }

  return groups;
}

export function sortCategoryContainerKeys(
  keys: string[],
  categories: { _id: string; name: string }[],
): string[] {
  const nameById = new Map(categories.map((c) => [c._id, c.name]));
  return [...keys].sort((a, b) => {
    if (a === "__none__") return -1;
    if (b === "__none__") return 1;
    const nameA = nameById.get(a) ?? a;
    const nameB = nameById.get(b) ?? b;
    return nameA.localeCompare(nameB);
  });
}
