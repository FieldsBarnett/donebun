import { X, Calendar, Tag, Repeat, ListTodo, AlignLeft } from "lucide-react";
import Modal from "./Modal";

interface TaskDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskTitle: string;
}

export default function TaskDetailsModal({ isOpen, onClose, taskTitle }: TaskDetailsModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} zIndex={50}>
      <div className="bg-white rounded-2xl shadow-xl border border-[var(--color-hairline)] flex flex-col max-h-[90vh] font-system">
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-hairline)]">
          <input 
            type="text" 
            defaultValue={taskTitle}
            className="text-lg font-semibold w-full outline-none bg-transparent"
          />
          <button onClick={onClose} className="p-1 hover:bg-black/5 rounded-full text-[var(--color-muted)]">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* Notes/Description */}
          <div className="flex gap-3 text-[var(--color-muted)] group focus-within:text-[var(--color-ink)]">
            <AlignLeft size={18} className="mt-0.5" />
            <textarea 
              placeholder="Notes" 
              className="w-full resize-none outline-none text-[15px] min-h-[60px] bg-transparent"
            />
          </div>

          {/* Checklist */}
          <div className="flex gap-3 text-[var(--color-muted)]">
            <ListTodo size={18} className="mt-0.5" />
            <div className="flex-1">
              <input 
                type="text" 
                placeholder="Add checklist item..." 
                className="w-full outline-none text-[15px] bg-transparent border-b border-transparent focus:border-[var(--color-hairline)] pb-1"
              />
            </div>
          </div>

          {/* Dates */}
          <div className="flex gap-3 text-[var(--color-muted)]">
            <Calendar size={18} className="mt-0.5" />
            <div className="flex-1 flex gap-4">
              <div className="flex-1">
                <span className="text-[12px] uppercase font-bold tracking-wider mb-1 block">Start Date</span>
                <input type="date" className="w-full outline-none text-[14px] text-[var(--color-ink)] bg-transparent" />
              </div>
              <div className="flex-1">
                <span className="text-[12px] uppercase font-bold tracking-wider mb-1 block">Deadline</span>
                <input type="date" className="w-full outline-none text-[14px] text-[var(--color-ink)] bg-transparent" />
              </div>
            </div>
          </div>

          {/* Repeat & Tags */}
          <div className="flex gap-4">
            <button className="flex items-center gap-2 px-3 py-1.5 rounded bg-[var(--color-surface-soft)] text-sm text-[var(--color-ink)] hover:bg-[var(--color-hairline)] transition-colors">
              <Repeat size={14} /> Repeat
            </button>
            <button className="flex items-center gap-2 px-3 py-1.5 rounded bg-[var(--color-surface-soft)] text-sm text-[var(--color-ink)] hover:bg-[var(--color-hairline)] transition-colors">
              <Tag size={14} /> Add Tags
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
