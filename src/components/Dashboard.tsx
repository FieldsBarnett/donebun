import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { TaskRow } from "./TaskRow";
import SearchBar from "./SearchBar";

export default function Dashboard() {
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const tasks = useQuery(api.tasks.getTasks) || [];
  const createTask = useMutation(api.tasks.createTask);
  const updateTaskStatus = useMutation(api.tasks.updateTaskStatus);
  const deleteTask = useMutation(api.tasks.deleteTask);

  const handleCreateTask = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && newTaskTitle.trim()) {
      await createTask({
        title: newTaskTitle.trim(),
        isPrivate: false,
      });
      setNewTaskTitle("");
    }
  };

  const today = new Date();
  const isSameDay = (d1: Date, d2: Date) => {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  };

  const todayTasks = tasks.filter(t => t.status === "active" && t.dueDate && isSameDay(new Date(t.dueDate), today));
  const inboxTasks = tasks.filter(t => t.status === "active" && !t.dueDate);

  return (
    <div className="px-8 py-10 md:px-14 max-w-4xl mx-auto pb-24">
      {/* Fuzzy Search */}
      <div className="mb-8">
        <SearchBar />
      </div>

      {/* Star / Today Header styling like Things 3 */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-8 h-8 rounded bg-[var(--color-yellow)] flex items-center justify-center text-white font-bold text-lg">
          ★
        </div>
        <h2 className="text-3xl font-bold tracking-tight">Today</h2>
      </div>
      
      {/* Quick Entry */}
      <div className="mb-8">
        <input 
          type="text" 
          placeholder="New To-Do" 
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
          onKeyDown={handleCreateTask}
          className="w-full bg-transparent border-b border-[var(--color-hairline)] pb-3 outline-none text-[15px] placeholder-[var(--color-muted)]"
        />
      </div>

      <div className="space-y-8">
        {/* Today's Tasks */}
        <div className="flex flex-col">
          {todayTasks.map(task => (
            <TaskRow 
              key={task._id} 
              title={task.title} 
              completed={false} 
              isToday 
              assigneeColor={task.assigneeColor}
              tags={task.categoryName ? [task.categoryName] : []}
              onToggle={() => updateTaskStatus({ id: task._id, status: "completed" })} 
              onOptions={() => deleteTask({ id: task._id })} 
            />
          ))}
          {todayTasks.length === 0 && <p className="text-sm text-[var(--color-muted)] py-2">No tasks for today.</p>}
        </div>
        
        {/* Inbox / Unsorted items */}
        {inboxTasks.length > 0 && (
          <section>
            <h3 className="text-[17px] font-semibold mb-1">Inbox</h3>
            <div className="flex flex-col">
              {inboxTasks.map(task => (
                <TaskRow 
                  key={task._id} 
                  title={task.title} 
                  completed={false} 
                  assigneeColor={task.assigneeColor}
                  tags={task.categoryName ? [task.categoryName] : []}
                  onToggle={() => updateTaskStatus({ id: task._id, status: "completed" })} 
                  onOptions={() => deleteTask({ id: task._id })} 
                />
              ))}
            </div>
          </section>
        )}

      </div>
    </div>
  );
}

