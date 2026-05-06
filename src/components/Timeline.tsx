import { TaskRow } from "./TaskRow";
import { CalendarDays } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export default function Timeline() {
  const tasks = useQuery(api.tasks.getTasks) || [];
  const calendarEvents = useQuery(api.calendars.getEventsByFamily) || [];

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const isSameDay = (d1: Date, d2: Date) => {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  };

  const todayItems = [
    ...tasks.filter(t => t.dueDate && isSameDay(new Date(t.dueDate), today)),
    ...calendarEvents.filter(e => isSameDay(new Date(e.start), today))
  ].sort((a: any, b: any) => new Date(a.start || a.dueDate!).getTime() - new Date(b.start || b.dueDate!).getTime());

  const tomorrowItems = [
    ...tasks.filter(t => t.dueDate && isSameDay(new Date(t.dueDate), tomorrow)),
    ...calendarEvents.filter(e => isSameDay(new Date(e.start), tomorrow))
  ].sort((a: any, b: any) => new Date(a.start || a.dueDate!).getTime() - new Date(b.start || b.dueDate!).getTime());

  return (
    <div className="px-8 py-10 md:px-14 max-w-4xl mx-auto pb-24">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-[var(--color-yellow)] flex items-center justify-center text-white">
            <CalendarDays size={20} />
          </div>
          <h2 className="text-3xl font-bold tracking-tight">Timeline</h2>
        </div>
      </div>

      <div className="space-y-8">
        <section>
          <h3 className="text-[17px] font-semibold mb-1">Today</h3>
          <div className="flex flex-col">
            {todayItems.map((item: any) => (
              <TaskRow 
                key={item._id} 
                title={item.title} 
                completed={item.status === 'completed'} 
                assigneeColor={item.assigneeColor}
                tags={item.categoryName ? [item.categoryName] : []}
                onToggle={() => {}} 
                onOptions={() => {}} 
              />
            ))}
            {todayItems.length === 0 && <p className="text-sm text-[var(--color-muted)] py-2">No items for today.</p>}
          </div>
        </section>

        <section>
          <h3 className="text-[17px] font-semibold mb-1">Tomorrow</h3>
          <div className="flex flex-col">
            {tomorrowItems.map((item: any) => (
              <TaskRow 
                key={item._id} 
                title={item.title} 
                completed={item.status === 'completed'} 
                assigneeColor={item.assigneeColor}
                tags={item.categoryName ? [item.categoryName] : []}
                onToggle={() => {}} 
                onOptions={() => {}} 
              />
            ))}
            {tomorrowItems.length === 0 && <p className="text-sm text-[var(--color-muted)] py-2">No items for tomorrow.</p>}
          </div>
        </section>

      </div>
    </div>
  );
}
