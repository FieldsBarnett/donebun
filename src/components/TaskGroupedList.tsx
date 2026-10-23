import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { TaskRow } from "./TaskRow";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  type DashboardBucket,
  sortTasksInDashboardGroup,
  buildDashboardContainers,
  sortCategoryContainerKeys,
  categoryContainerId,
} from "../../shared/dashboardSort";

interface Task {
  _id: string;
  title: string;
  description?: string;
  checklist?: { text: string; completed: boolean }[];
  attachments?: { storageId: string; name: string; type: string }[];
  status: "active" | "completed" | "deleted";
  dueDate?: string;
  ownerId: Id<"users">;
  assigneeId?: Id<"users">;
  categoryId?: Id<"categories"> | null;
  isPrivate: boolean;
  recurrence?: unknown;
  dashboardOrder?: number;
}

interface TaskGroupedListProps {
  tasks: Task[];
  onToggle: (task: Task) => void;
  isToday?: boolean;
  expandedTaskId?: string | null;
  onToggleExpand?: (taskId: string | null) => void;
  dashboardBucket?: DashboardBucket;
  enableDragDrop?: boolean;
}

function containerCategoryId(containerKey: string): Id<"categories"> | null {
  return containerKey === "__none__" ? null : (containerKey as Id<"categories">);
}

function SortableTaskItem({
  task,
  onToggle,
  isToday,
  expandedTaskId,
  onToggleExpand,
  isDragOverlay,
}: {
  task: Task;
  onToggle: (task: Task) => void;
  isToday?: boolean;
  expandedTaskId?: string | null;
  onToggleExpand?: (taskId: string | null) => void;
  isDragOverlay?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task._id,
    disabled: isDragOverlay || expandedTaskId === task._id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging && !isDragOverlay ? 0.35 : 1,
  };

  return (
    <div
      ref={isDragOverlay ? undefined : setNodeRef}
      style={style}
      className={
        isDragOverlay
          ? "shadow-lg rounded-xl bg-[var(--color-surface)] cursor-grabbing"
          : "cursor-grab active:cursor-grabbing touch-pan-y"
      }
      {...(isDragOverlay ? {} : { ...attributes, ...listeners })}
    >
      <TaskRow
        id={task._id}
        title={task.title}
        description={task.description}
        checklist={task.checklist}
        attachments={task.attachments}
        completed={task.status === "completed"}
        ownerId={task.ownerId}
        assigneeId={task.assigneeId}
        categoryId={task.categoryId ?? undefined}
        dueDate={task.dueDate}
        recurrence={task.recurrence as any}
        isPrivate={task.isPrivate}
        isRecurring={(task as { isRecurring?: boolean }).isRecurring}
        recurrenceStrategy={(task as { recurrence?: { strategy?: string } }).recurrence?.strategy as
          | "fixed"
          | "completion"
          | undefined}
        onToggle={() => onToggle(task)}
        isToday={isToday}
        isExpanded={expandedTaskId === task._id}
        onToggleExpand={() =>
          onToggleExpand?.(expandedTaskId === task._id ? null : task._id)
        }
      />
    </div>
  );
}

function CategoryDropZone({
  containerId,
  children,
  label,
  showLabel,
}: {
  containerId: string;
  children: ReactNode;
  label: string;
  showLabel: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: containerId });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col rounded-lg transition-colors ${
        isOver ? "bg-[var(--color-primary)]/5 ring-1 ring-[var(--color-primary)]/20" : ""
      }`}
    >
      {showLabel && (
        <h3 className="text-[13px] font-bold text-[var(--color-muted)] uppercase tracking-wider mb-2 px-1">
          {label}
        </h3>
      )}
      <div className="flex flex-col min-h-[2px]">{children}</div>
    </div>
  );
}

export function TaskGroupedList({
  tasks,
  onToggle,
  isToday,
  expandedTaskId,
  onToggleExpand,
  dashboardBucket,
  enableDragDrop = Boolean(dashboardBucket),
}: TaskGroupedListProps) {
  const categories = useQuery(api.categories.list) || [];
  const reorderDashboardTasks = useMutation(api.tasks.reorderDashboardTasks);

  const [localTasks, setLocalTasks] = useState<Task[]>(tasks);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    setLocalTasks(tasks);
  }, [tasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const containers = useMemo(() => {
    const raw = buildDashboardContainers(localTasks, categories);
    const sorted: Record<string, Task[]> = {};
    for (const key of Object.keys(raw)) {
      sorted[key] = sortTasksInDashboardGroup(raw[key]);
    }
    return sorted;
  }, [localTasks, categories]);

  const findContainerForTasks = useCallback(
    (taskList: Task[], id: string) => {
      if (id === "__none__" || categories.some((c) => c._id === id)) {
        return id;
      }
      const task = taskList.find((t) => t._id === id);
      if (task) return categoryContainerId(task.categoryId ?? null);
      return undefined;
    },
    [categories],
  );

  const containerKeys = useMemo(() => {
    const keysWithTasks = Object.keys(containers).filter(
      (key) => containers[key].length > 0,
    );
    const keys =
      activeId !== null
        ? sortCategoryContainerKeys(
            [
              ...new Set([
                ...keysWithTasks,
                "__none__",
                ...categories.map((c) => c._id),
              ]),
            ],
            categories,
          )
        : sortCategoryContainerKeys(keysWithTasks, categories);
    return keys.filter((key) => containers[key] !== undefined || activeId !== null);
  }, [containers, categories, activeId]);

  const persistPlacements = useCallback(
    (nextContainers: Record<string, Task[]>) => {
      if (!dashboardBucket) return;
      const placements: {
        id: string;
        categoryId: Id<"categories"> | null;
        order: number;
      }[] = [];

      for (const containerKey of Object.keys(nextContainers)) {
        const categoryId = containerCategoryId(containerKey);
        nextContainers[containerKey].forEach((task, order) => {
          placements.push({
            id: task._id,
            categoryId,
            order,
          });
        });
      }

      void reorderDashboardTasks({ bucket: dashboardBucket, placements });
    },
    [dashboardBucket, reorderDashboardTasks],
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    setLocalTasks((prev) => {
      const activeContainer = findContainerForTasks(prev, String(active.id));
      const overId = String(over.id);
      const overContainer =
        overId === "__none__" || categories.some((c) => c._id === overId)
          ? overId
          : findContainerForTasks(prev, overId);

      if (
        !activeContainer ||
        !overContainer ||
        activeContainer === overContainer
      ) {
        return prev;
      }

      const activeTask = prev.find((t) => t._id === active.id);
      if (!activeTask) return prev;

      const nextCategoryId = containerCategoryId(overContainer);
      const without = prev.filter((t) => t._id !== active.id);
      const moved: Task = {
        ...activeTask,
        categoryId: nextCategoryId ?? undefined,
      };

      const overItems = without.filter(
        (t) => categoryContainerId(t.categoryId ?? null) === overContainer,
      );
      const otherItems = without.filter(
        (t) => categoryContainerId(t.categoryId ?? null) !== overContainer,
      );

      let insertIndex = overItems.length;
      if (
        overId !== "__none__" &&
        !categories.some((c) => c._id === overId)
      ) {
        const overIndex = overItems.findIndex((t) => t._id === overId);
        if (overIndex >= 0) insertIndex = overIndex;
      }

      const newOverItems = [...overItems];
      newOverItems.splice(insertIndex, 0, moved);

      return [...otherItems, ...newOverItems];
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    setLocalTasks((prev) => {
      const activeContainer = findContainerForTasks(prev, String(active.id));
      const overId = String(over.id);
      const overContainer =
        overId === "__none__" || categories.some((c) => c._id === overId)
          ? overId
          : findContainerForTasks(prev, overId);

      if (!activeContainer || !overContainer) return prev;

      let next = prev;

      if (
        activeContainer === overContainer &&
        overId !== "__none__" &&
        !categories.some((c) => c._id === overId)
      ) {
        const items = prev.filter(
          (t) =>
            categoryContainerId(t.categoryId ?? null) === activeContainer,
        );
        const oldIndex = items.findIndex((t) => t._id === active.id);
        const newIndex = items.findIndex((t) => t._id === over.id);
        if (oldIndex >= 0 && newIndex >= 0 && oldIndex !== newIndex) {
          const reordered = arrayMove(items, oldIndex, newIndex);
          const otherItems = prev.filter(
            (t) =>
              categoryContainerId(t.categoryId ?? null) !== activeContainer,
          );
          next = [...otherItems, ...reordered];
        }
      }

      const nextContainers = buildDashboardContainers(next, categories);
      persistPlacements(nextContainers);
      return next;
    });
  };

  const activeTask = activeId
    ? localTasks.find((t) => t._id === activeId)
    : null;

  if (localTasks.length === 0) {
    return (
      <p className="text-sm text-[var(--color-muted)] py-2 italic">No tasks.</p>
    );
  }

  const listBody = (
    <div className="space-y-6">
      {containerKeys.map((containerKey) => {
        const containerTasks = containers[containerKey] ?? [];
        const showLabel = containerKey !== "__none__";
        const label =
          categories.find((c) => c._id === containerKey)?.name ?? "No Category";

        if (
          !enableDragDrop &&
          containerTasks.length === 0
        ) {
          return null;
        }

        if (!enableDragDrop) {
          if (containerTasks.length === 0) return null;
          return (
            <div key={containerKey} className="flex flex-col">
              {showLabel && (
                <h3 className="text-[13px] font-bold text-[var(--color-muted)] uppercase tracking-wider mb-2 px-1">
                  {label}
                </h3>
              )}
              <div className="flex flex-col">
                {containerTasks.map((task) => (
                  <TaskRow
                    key={task._id}
                    id={task._id}
                    title={task.title}
                    description={task.description}
                    checklist={task.checklist}
                    attachments={task.attachments}
                    completed={task.status === "completed"}
                    ownerId={task.ownerId}
                    assigneeId={task.assigneeId}
                    categoryId={task.categoryId ?? undefined}
                    dueDate={task.dueDate}
                    recurrence={task.recurrence as any}
                    isPrivate={task.isPrivate}
                    isRecurring={(task as { isRecurring?: boolean }).isRecurring}
                    recurrenceStrategy={
                      (task as { recurrence?: { strategy?: string } }).recurrence
                        ?.strategy as "fixed" | "completion" | undefined
                    }
                    onToggle={() => onToggle(task)}
                    isToday={isToday}
                    isExpanded={expandedTaskId === task._id}
                    onToggleExpand={() =>
                      onToggleExpand?.(
                        expandedTaskId === task._id ? null : task._id,
                      )
                    }
                  />
                ))}
              </div>
            </div>
          );
        }

        if (containerTasks.length === 0 && containerKey !== "__none__") {
          return (
            <CategoryDropZone
              key={containerKey}
              containerId={containerKey}
              label={label}
              showLabel={showLabel}
            >
              <p className="text-xs text-[var(--color-muted)] italic px-1 py-2">
                Drop tasks here
              </p>
            </CategoryDropZone>
          );
        }

        if (containerTasks.length === 0) {
          return null;
        }

        return (
          <CategoryDropZone
            key={containerKey}
            containerId={containerKey}
            label={label}
            showLabel={showLabel}
          >
            <SortableContext
              items={containerTasks.map((t) => t._id)}
              strategy={verticalListSortingStrategy}
            >
              {containerTasks.map((task) => (
                <SortableTaskItem
                  key={task._id}
                  task={task}
                  onToggle={onToggle}
                  isToday={isToday}
                  expandedTaskId={expandedTaskId}
                  onToggleExpand={onToggleExpand}
                />
              ))}
            </SortableContext>
          </CategoryDropZone>
        );
      })}
    </div>
  );

  if (!enableDragDrop) {
    return listBody;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      {listBody}
      <DragOverlay dropAnimation={null}>
        {activeTask ? (
          <SortableTaskItem
            task={activeTask}
            onToggle={onToggle}
            isToday={isToday}
            expandedTaskId={expandedTaskId}
            onToggleExpand={onToggleExpand}
            isDragOverlay
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
