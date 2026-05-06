import { Check, MoreHorizontal } from "lucide-react";

interface TaskRowProps {
  title: string;
  completed: boolean;
  assigneeColor?: string;
  tags?: string[];
  onToggle: () => void;
  onOptions: () => void;
  isToday?: boolean;
}

export function TaskRow({ title, completed, assigneeColor, tags, onToggle, onOptions, isToday }: TaskRowProps) {
  return (
    <div className="group flex items-center gap-3 py-[10px] border-b border-[var(--color-hairline)] bg-[var(--color-canvas)]">
      {/* Checkbox */}
      <button 
        onClick={onToggle} 
        className={`flex-shrink-0 flex items-center justify-center w-[22px] h-[22px] rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[var(--color-primary)]
          ${completed 
            ? 'bg-[var(--color-primary)] border-[var(--color-primary)]' 
            : isToday 
              ? 'border-[var(--color-primary)] hover:bg-[var(--color-primary)]/10' 
              : 'border-[#c7c7cc] hover:bg-black/5'
          }`}
      >
        {completed && <Check size={14} className="text-white" strokeWidth={3} />}
      </button>
      
      {/* Title */}
      <div className={`flex-1 text-[15px] ${completed ? 'text-[var(--color-muted)] line-through' : 'text-[var(--color-ink)]'}`}>
        {title}
      </div>

      {/* Tags */}
      {tags && tags.length > 0 && (
        <div className="hidden sm:flex items-center gap-1.5">
          {tags.map(tag => (
            <span key={tag} className="text-[12px] px-2 py-0.5 rounded bg-[var(--color-surface-soft)] text-[var(--color-muted)]">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Assignee Indicator */}
      {assigneeColor && (
        <div 
          className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shadow-sm"
          style={{ backgroundColor: `var(--color-${assigneeColor})` }}
        >
          A
        </div>
      )}

      {/* Quick Actions Menu (3-dot) */}
      <button 
        onClick={onOptions}
        className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 rounded-md hover:bg-black/5 text-[var(--color-muted)] transition-all"
      >
        <MoreHorizontal size={18} />
      </button>
    </div>
  );
}
