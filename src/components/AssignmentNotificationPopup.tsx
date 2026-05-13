import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Bell, CheckCheck, X } from "lucide-react";

export default function AssignmentNotificationPopup() {
  const unseenTasks = useQuery(api.tasks.getUnseenAssignments);
  const acknowledge = useMutation(api.tasks.acknowledgeAssignments);
  const [isVisible, setIsVisible] = useState(false);
  const [pendingTasks, setPendingTasks] = useState<typeof unseenTasks>([]);

  // When new unseen tasks arrive, capture them and show the popup.
  // We freeze the list so dimissing it won't flash away if the reactive
  // query updates while the popup is open.
  useEffect(() => {
    if (unseenTasks && unseenTasks.length > 0 && !isVisible) {
      setPendingTasks(unseenTasks);
      setIsVisible(true);
    }
  }, [unseenTasks, isVisible]);

  const handleAcknowledge = async () => {
    if (!pendingTasks || pendingTasks.length === 0) return;
    const ids = pendingTasks.map((t) => t._id) as Id<"tasks">[];
    await acknowledge({ taskIds: ids });
    setIsVisible(false);
    setPendingTasks([]);
  };

  if (!isVisible || !pendingTasks || pendingTasks.length === 0) return null;

  const count = pendingTasks.length;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-[200] animate-fade-in"
        onClick={handleAcknowledge}
      />

      {/* Popup card */}
      <div
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[201] w-[min(420px,92vw)] animate-modal-in"
        role="dialog"
        aria-modal="true"
        aria-label="New task assignments"
      >
        <div
          className="rounded-2xl border border-white/20 shadow-2xl overflow-hidden"
          style={{
            background: "linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,255,0.97) 100%)",
            boxShadow: "0 32px 64px rgba(0,0,0,0.18), 0 0 0 1px rgba(255,255,255,0.5) inset",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center gap-3 px-5 pt-5 pb-4"
            style={{
              background: "linear-gradient(135deg, var(--color-primary) 0%, #6366f1 100%)",
            }}
          >
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <Bell size={20} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-base leading-tight">
                {count === 1 ? "New Task Assigned to You" : `${count} Tasks Assigned to You`}
              </p>
              <p className="text-white/70 text-xs mt-0.5">
                While you were away
              </p>
            </div>
            <button
              onClick={handleAcknowledge}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors shrink-0"
              aria-label="Dismiss"
            >
              <X size={16} className="text-white" />
            </button>
          </div>

          {/* Task list */}
          <div className="px-5 pt-4 pb-2 max-h-[280px] overflow-y-auto">
            <div className="flex flex-col gap-2">
              {pendingTasks.map((task) => (
                <div
                  key={task._id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-[var(--color-surface-soft)] border border-[var(--color-hairline)]"
                >
                  <div className="w-2 h-2 rounded-full bg-[var(--color-primary)] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--color-ink)] truncate">
                      {task.title}
                    </p>
                    {task.dueDate && (
                      <p className="text-xs text-[var(--color-muted)] mt-0.5">
                        Due{" "}
                        {new Date(task.dueDate).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 pt-3 pb-5">
            <button
              id="assignment-notification-acknowledge-btn"
              onClick={handleAcknowledge}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-semibold text-sm text-white transition-all active:scale-95 hover:opacity-90 shadow-md"
              style={{
                background: "linear-gradient(135deg, var(--color-primary) 0%, #6366f1 100%)",
                boxShadow: "0 4px 12px rgba(0,105,255,0.3)",
              }}
            >
              <CheckCheck size={16} />
              Got it!
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
