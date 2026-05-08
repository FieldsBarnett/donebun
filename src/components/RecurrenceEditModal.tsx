import Modal from "./Modal";

export type UpdateMode = "single" | "future" | "all";

interface RecurrenceEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (mode: UpdateMode) => void;
  actionType?: "edit" | "delete";
  strategy?: "fixed" | "completion";
}

export default function RecurrenceEditModal({ isOpen, onClose, onConfirm, actionType = "edit", strategy = "fixed" }: RecurrenceEditModalProps) {
  const isDelete = actionType === "delete";
  const isCompletion = strategy === "completion";
  
  return (
    <Modal isOpen={isOpen} onClose={onClose} zIndex={100}>
      <div className="bg-white rounded-2xl shadow-xl border border-[var(--color-hairline)] flex flex-col p-6 max-w-sm w-full font-system">
        <h2 className="text-lg font-semibold text-[var(--color-ink)] mb-4">
          {isDelete ? "Delete recurring task" : "Edit recurring task"}
        </h2>
        <p className="text-sm text-[var(--color-muted)] mb-6">
          {isCompletion 
            ? `This task repeats after completion. How would you like to ${isDelete ? "delete" : "save"} it?`
            : `This is a repeating task. How would you like to ${isDelete ? "delete" : "save"} your changes?`
          }
        </p>
        
        <div className="flex flex-col gap-3">
          <button 
            className="w-full text-left px-4 py-3 rounded-xl bg-[var(--color-surface-soft)] hover:bg-[var(--color-hairline)] text-[var(--color-ink)] font-medium transition-colors"
            onClick={() => {
              onConfirm("single");
              onClose();
            }}
          >
            {isCompletion ? "This occurrence only (Skip to next)" : "This occurrence only"}
          </button>
          
          {!isCompletion && (
            <button 
              className="w-full text-left px-4 py-3 rounded-xl bg-[var(--color-surface-soft)] hover:bg-[var(--color-hairline)] text-[var(--color-ink)] font-medium transition-colors"
              onClick={() => {
                onConfirm("future");
                onClose();
              }}
            >
              This and following occurrences
            </button>
          )}

          <button 
            className="w-full text-left px-4 py-3 rounded-xl bg-[var(--color-surface-soft)] hover:bg-[var(--color-hairline)] text-[var(--color-ink)] font-medium transition-colors"
            onClick={() => {
              onConfirm("all");
              onClose();
            }}
          >
            {isCompletion ? "This and all future occurrences" : "All occurrences"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
