import { TaskRow } from "./TaskRow";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

interface Task {
  _id: any;
  title: string;
  description?: string;
  status: "active" | "completed" | "deleted";
  dueDate?: string;
  ownerId: any;
  assigneeId?: any;
  categoryId?: any;
  isPrivate: boolean;
}

interface TaskGroupedListProps {
  tasks: Task[];
  onToggle: (task: Task) => void;
  isToday?: boolean;
}

export function TaskGroupedList({ tasks, onToggle, isToday }: TaskGroupedListProps) {
  const categories = useQuery(api.categories.list) || [];
  if (tasks.length === 0) {
    return <p className="text-sm text-[var(--color-muted)] py-2 italic">No tasks.</p>;
  }

  // Helper to get time for sorting
  const getTime = (iso: string | undefined) => {
    if (!iso) return Infinity; // No due date at the end
    if (!iso.includes("T")) return Infinity; // Date only at the end of the day
    return new Date(iso).getTime();
  };

  // Grouping
  const groups = tasks.reduce((acc, task) => {
    const category = categories.find(c => c._id === task.categoryId);
    const categoryName = category?.name || "No Category";
    
    if (!acc[categoryName]) acc[categoryName] = [];
    acc[categoryName].push(task);
    return acc;
  }, {} as Record<string, Task[]>);

  const sortedCategories = Object.keys(groups).sort((a, b) => {
    if (a === "No Category") return -1;
    if (b === "No Category") return 1;
    return a.localeCompare(b);
  });

  return (
    <div className="space-y-6">
      {sortedCategories.map((category) => {
        const categoryTasks = [...groups[category]].sort((a, b) => {
          // Sort by due date/time
          const timeA = getTime(a.dueDate);
          const timeB = getTime(b.dueDate);
          if (timeA !== timeB) return timeA - timeB;
          // Then by title
          return a.title.localeCompare(b.title);
        });

        return (
          <div key={category} className="flex flex-col">
            {category !== "No Category" && (
              <h3 className="text-[13px] font-bold text-[var(--color-muted)] uppercase tracking-wider mb-2 px-1">
                {category}
              </h3>
            )}
            <div className="flex flex-col">
              {categoryTasks.map((task) => (
                <TaskRow
                  key={task._id}
                  id={task._id}
                  title={task.title}
                  description={task.description}
                  completed={task.status === "completed"}
                  ownerId={task.ownerId}
                  assigneeId={task.assigneeId}
                  categoryId={task.categoryId}
                  dueDate={task.dueDate}
                  isPrivate={task.isPrivate}
                  isRecurring={(task as any).isRecurring}
                  recurrenceStrategy={(task as any).recurrence?.strategy}
                  onToggle={() => onToggle(task)}
                  isToday={isToday}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
