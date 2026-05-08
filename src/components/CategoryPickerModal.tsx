import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Check, Plus, X, Pencil } from "lucide-react";
import CategoryIcon from "./CategoryIcon";
import Modal from "./Modal";

interface CategoryPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCategoryId?: Id<"categories"> | "";
  onSelect: (categoryId: Id<"categories"> | "") => void;
  onAddNew: () => void;
  onEdit: (category: { _id: Id<"categories">, name: string, icon?: string }) => void;
}

export default function CategoryPickerModal({ 
  isOpen, 
  onClose, 
  selectedCategoryId, 
  onSelect,
  onAddNew,
  onEdit
}: CategoryPickerModalProps) {
  const categories = useQuery(api.categories.list) || [];

  return (
    <Modal isOpen={isOpen} onClose={onClose} zIndex={200}>
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-[var(--color-hairline)] flex flex-col max-h-[80vh]"
      >
        <div className="p-4 border-b border-[var(--color-hairline)] flex items-center justify-between">
          <span className="text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-wider">Select Category</span>
          <button onClick={onClose} className="p-1 hover:bg-black/5 rounded-full transition-colors">
            <X size={18} className="text-[var(--color-muted)]" />
          </button>
        </div>

        <div className="p-2 overflow-y-auto">
          <button 
            onClick={() => { onSelect(""); onClose(); }}
            className="w-full flex items-center justify-between px-3 py-2.5 text-sm hover:bg-black/5 rounded-xl transition-colors text-left group"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[var(--color-surface-soft)] flex items-center justify-center text-[var(--color-muted)] group-hover:bg-black/5 transition-colors">
                <CategoryIcon name="Tag" size={16} />
              </div>
              <span className="font-medium">None</span>
            </div>
            {!selectedCategoryId && <Check size={18} className="text-[var(--color-primary)]" />}
          </button>

          {categories.map(cat => (
            <div key={cat._id} className="flex items-center gap-1 group/row">
              <button 
                onClick={() => { onSelect(cat._id); onClose(); }}
                className="flex-1 flex items-center justify-between px-3 py-2.5 text-sm hover:bg-black/5 rounded-xl transition-colors text-left"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-8 h-8 rounded-lg bg-[var(--color-badge-purple)]/10 flex items-center justify-center text-[var(--color-badge-purple)] shrink-0">
                    <CategoryIcon name={cat.icon} size={16} />
                  </div>
                  <span className="truncate font-medium">{cat.name}</span>
                </div>
                {selectedCategoryId === cat._id && <Check size={18} className="text-[var(--color-primary)]" />}
              </button>
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(cat);
                }}
                className="p-2.5 rounded-xl hover:bg-black/5 text-[var(--color-muted)] hover:text-[var(--color-primary)] transition-all shrink-0"
                title="Edit category"
              >
                <Pencil size={14} />
              </button>
            </div>
          ))}
        </div>

        <div className="p-2 border-t border-[var(--color-hairline)]">
          <button 
            onClick={() => { onAddNew(); onClose(); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-[var(--color-primary)] font-bold hover:bg-[var(--color-primary)]/5 rounded-xl transition-colors text-left"
          >
            <div className="w-8 h-8 rounded-lg bg-[var(--color-primary)]/10 flex items-center justify-center">
              <Plus size={18} />
            </div>
            New Category...
          </button>
        </div>
      </div>
    </Modal>
  );
}
