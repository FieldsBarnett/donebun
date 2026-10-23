/**
 * Virtual recurring task IDs: `${rootTaskId}:${isoDueDate}`.
 * ISO datetimes contain colons — split only on the first colon.
 */
export function parseVirtualTaskId(id: string): {
  taskId: string;
  virtualDate: string | null;
  isVirtual: boolean;
} {
  const colonIndex = id.indexOf(":");
  if (colonIndex === -1) {
    return { taskId: id, virtualDate: null, isVirtual: false };
  }

  return {
    taskId: id.slice(0, colonIndex),
    virtualDate: id.slice(colonIndex + 1),
    isVirtual: true,
  };
}

export function formatVirtualTaskId(taskId: string, virtualDate: string): string {
  return `${taskId}:${virtualDate}`;
}

/** Stable key for search / dedupe: series root id. */
export function seriesRootId(task: { _id: string; parentTaskId?: string | null }): string {
  if (task.parentTaskId) return task.parentTaskId;
  return parseVirtualTaskId(task._id).taskId;
}
