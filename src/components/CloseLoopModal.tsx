import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import Modal from "./Modal";

type OpenTasksAction = "complete" | "delete" | "detach";

export default function CloseLoopModal({
  loopId,
  loopTitle,
  isOpen,
  onClose,
}: {
  loopId: Id<"loops">;
  loopTitle: string;
  isOpen: boolean;
  onClose: () => void;
}) {
  const openTasks = useQuery(api.loops.getOpenTasksForClose, isOpen ? { loopId } : "skip");
  const closeLoop = useMutation(api.loops.closeLoop);
  const [closingNote, setClosingNote] = useState("");
  const [openTasksAction, setOpenTasksAction] = useState<OpenTasksAction>("detach");
  const [submitting, setSubmitting] = useState(false);

  const hasOpen = (openTasks?.length ?? 0) > 0;

  const handleClose = async () => {
    setSubmitting(true);
    try {
      await closeLoop({
        loopId,
        closingNote: closingNote.trim() || undefined,
        openTasksAction: hasOpen ? openTasksAction : "detach",
      });
      setClosingNote("");
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <div className="bg-white rounded-2xl shadow-2xl border border-[var(--color-hairline)] overflow-hidden">
        <div className="p-5 border-b border-[var(--color-hairline)]">
          <h3 className="text-lg font-bold">Close loop</h3>
          <p className="text-sm text-[var(--color-muted)] mt-1">
            Archive &ldquo;{loopTitle}&rdquo; and everything inside it.
          </p>
        </div>
        <div className="p-5 space-y-4">
          {hasOpen && (
            <div className="space-y-2">
              <p className="text-sm font-medium">
                {openTasks!.length} open{" "}
                {openTasks!.length === 1 ? "todo" : "todos"} — what should happen?
              </p>
              <div className="space-y-2">
                {(
                  [
                    ["complete", "Mark all complete"],
                    ["detach", "Move to standalone todos"],
                    ["delete", "Delete open todos"],
                  ] as const
                ).map(([value, label]) => (
                  <label
                    key={value}
                    className="flex items-center gap-2 text-sm cursor-pointer"
                  >
                    <input
                      type="radio"
                      name="openTasksAction"
                      checked={openTasksAction === value}
                      onChange={() => setOpenTasksAction(value)}
                      className="text-[var(--color-primary)]"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          )}
          <div>
            <label className="text-sm font-medium block mb-1">
              Closing note <span className="text-[var(--color-muted)] font-normal">(optional)</span>
            </label>
            <textarea
              value={closingNote}
              onChange={(e) => setClosingNote(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-[var(--color-hairline)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
              placeholder="Why you're closing this loop…"
            />
          </div>
        </div>
        <div className="p-5 border-t border-[var(--color-hairline)] flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-black/5"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={handleClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold bg-[var(--color-primary)] text-white hover:opacity-90 disabled:opacity-50"
          >
            Close loop
          </button>
        </div>
      </div>
    </Modal>
  );
}
