import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { BookOpen } from "lucide-react";
import { TaskRow } from "./TaskRow";

export default function Logbook() {
  const tasks = useQuery(api.tasks.getTasks) || [];
  const updateTaskStatus = useMutation(api.tasks.updateTaskStatus);
  const deleteTask = useMutation(api.tasks.deleteTask);

  const completedTasks = tasks.filter(t => t.status === "completed");

  return (
    <div className="px-8 py-10 md:px-14 max-w-4xl mx-auto pb-24">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-8 h-8 rounded bg-[var(--color-badge-green)] flex items-center justify-center text-white font-bold text-lg">
          <BookOpen size={18} />
        </div>
        <h2 className="text-3xl font-bold tracking-tight">Logbook</h2>
      </div>

      <div className="space-y-8">
        <div className="flex flex-col">
          {completedTasks.map(task => (
            <TaskRow 
              key={task._id} 
              title={task.title} 
              completed={true} 
              assigneeColor={task.assigneeColor}
              tags={task.categoryName ? [task.categoryName] : []}
              onToggle={() => updateTaskStatus({ id: task._id, status: "active" })} 
              onOptions={() => deleteTask({ id: task._id })} 
            />
          ))}
          {completedTasks.length === 0 && (
            <p className="text-sm text-[var(--color-muted)] py-4 italic">No completed tasks yet.</p>
          )}
        </div>

      </div>
    </div>
  );
}

