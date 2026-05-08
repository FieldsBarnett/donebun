import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { TaskGroupedList } from "./TaskGroupedList";
import SearchBar from "./SearchBar";
import { parseDueDate, isSameDay } from "../lib/dateUtils";
import { filterTasks, FilterMode } from "../lib/filterUtils";

export default function Dashboard({ filterMode }: { filterMode: FilterMode }) {
  const currentUser = useQuery(api.users.getCurrentUser);
  const tasks = useQuery(api.tasks.getTasks) || [];
  const updateTaskStatus = useMutation(api.tasks.updateTaskStatus);


  const today = new Date();

  const filteredTasks = filterTasks(tasks, currentUser, filterMode);

  const todayTasks = filteredTasks.filter(t => t.status === "active" && t.dueDate && isSameDay(parseDueDate(t.dueDate), today));
  const unscheduledTasks = filteredTasks.filter(t => t.status === "active" && !t.dueDate);

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
      

      <div className="space-y-12">
        {/* Today's Tasks */}
        <section>
          <TaskGroupedList 
            tasks={todayTasks} 
            isToday 
            onToggle={(task) => updateTaskStatus({ id: task._id, status: "completed" })}
          />
        </section>
        
        {/* Unscheduled / Unsorted items */}
        {unscheduledTasks.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1.5 h-6 bg-[var(--color-muted)]/20 rounded-full" />
              <h3 className="text-[17px] font-bold">Unscheduled</h3>
            </div>
            <TaskGroupedList 
              tasks={unscheduledTasks} 
              onToggle={(task) => updateTaskStatus({ id: task._id, status: "completed" })}
            />
          </section>
        )}

      </div>
    </div>
  );
}

