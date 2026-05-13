import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Bell, CheckCheck } from "lucide-react";
import { TaskRow } from "./TaskRow";

export default function AssignmentNotificationPopup() {
  const unseenTasks = useQuery(api.tasks.getUnseenAssignments);
  const updateTaskStatus = useMutation(api.tasks.updateTaskStatus);
  const updateTask = useMutation(api.tasks.updateTask);
  const deleteTask = useMutation(api.tasks.deleteTask);
  const acknowledge = useMutation(api.tasks.acknowledgeAssignments);
  const [isVisible, setIsVisible] = useState(false);
  const [pendingTasks, setPendingTasks] = useState<typeof unseenTasks>([]);

  // Capture the unseen task list the first time it arrives, then freeze it
  // until the user dismisses. This prevents the list from updating reactively
  // while the popup is open (e.g. if one gets re-assigned mid-view).
  // However, we also sync new changes from unseenTasks to pendingTasks if
  // the task still exists in both, so external edits update the UI.
  useEffect(() => {
    if (!unseenTasks) return;
    
    if (unseenTasks.length > 0 && !isVisible) {
      setPendingTasks(unseenTasks);
      setIsVisible(true);
    } else if (isVisible) {
      setPendingTasks(prev => {
        return prev.map(pt => {
          const updated = unseenTasks.find(ut => ut._id === pt._id);
          return updated ? { ...pt, ...updated } : pt;
        });
      });
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

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-[3px] z-[90] animate-fade-in"
        onClick={handleAcknowledge}
      />

      {/* Modal panel */}
      <div
        className="fixed inset-0 z-[91] flex items-center justify-center p-4 pointer-events-none"
      >
        <div
          className="pointer-events-auto w-full max-w-[520px] max-h-[85vh] flex flex-col animate-modal-in rounded-2xl overflow-hidden border border-white/20"
          style={{
            background: "rgba(255,255,255,0.98)",
            boxShadow: "0 32px 72px rgba(0,0,0,0.22), 0 0 0 1px rgba(255,255,255,0.5) inset",
          }}
          role="dialog"
          aria-modal="true"
          aria-label="New task assignments"
        >
          {/* Header */}
          <div
            className="flex items-center gap-3 px-5 py-4 shrink-0"
            style={{
              background: "linear-gradient(135deg, var(--color-primary) 0%, #6366f1 100%)",
            }}
          >
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <Bell size={18} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-[15px] leading-tight">
                {count === 1
                  ? "You've been assigned a task"
                  : `You've been assigned ${count} tasks`}
              </p>
              <p className="text-white/70 text-xs mt-0.5">
                Review and edit before acknowledging
              </p>
            </div>
          </div>

          {/* Task list — scrollable */}
          <div className="flex-1 overflow-y-auto px-5 py-3">
            {/* TaskRow expects its parent to use -mx-5 / px-5 margin, so we
                provide that context here via the px-5 on the scroll container. */}
            <div className="flex flex-col">
              {pendingTasks.map((task) => (
                <TaskRow
                  key={task._id}
                  id={task._id}
                  title={task.title}
                  description={task.description}
                  checklist={task.checklist}
                  attachments={task.attachments as any}
                  completed={task.status === "completed"}
                  ownerId={task.ownerId}
                  assigneeId={task.assigneeId}
                  categoryId={task.categoryId}
                  dueDate={task.dueDate}
                  recurrence={(task.recurrence as any) ?? null}
                  isPrivate={task.isPrivate}
                  isRecurring={!!(task as any).isRecurring}
                  recurrenceStrategy={task.recurrence?.strategy}
                  isToday={false}
                  onToggle={() => {
                    const nextStatus =
                      task.status === "completed" ? "active" : "completed";
                    
                    setPendingTasks(prev => prev.map(t => 
                      t._id === task._id ? { ...t, status: nextStatus } as any : t
                    ));

                    updateTaskStatus({
                      id: task._id,
                      status: nextStatus,
                    });
                  }}
                  onSaveLocal={(updates) => {
                    setPendingTasks(prev => prev.map(t => 
                      t._id === task._id ? { ...t, ...updates } as any : t
                    ));
                    updateTask({ id: task._id, ...updates });
                  }}
                  onRemoveLocal={() => {
                    setPendingTasks(prev => prev.filter(t => t._id !== task._id));
                    deleteTask({ id: task._id });
                  }}
                />
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-[var(--color-hairline)] shrink-0">
            <button
              id="assignment-notification-acknowledge-btn"
              onClick={handleAcknowledge}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-semibold text-sm text-white transition-all active:scale-95 hover:opacity-90"
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
    </>,
    document.body
  );
}
