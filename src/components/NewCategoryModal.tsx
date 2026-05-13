import { useState, useRef, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { X, Plus, Save, Trash2 } from "lucide-react";
import IconPickerModal from "./IconPickerModal";
import CategoryIcon from "./CategoryIcon";
import Modal from "./Modal";

interface NewCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (categoryId: Id<"categories">) => void;
  editingCategory?: {
    _id: Id<"categories">;
    name: string;
    icon?: string;
  };
}

export default function NewCategoryModal({ isOpen, onClose, onCreated, editingCategory }: NewCategoryModalProps) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("Tag");
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const createCategory = useMutation(api.categories.create);
  const updateCategory = useMutation(api.categories.update);
  const deleteCategory = useMutation(api.categories.remove);

  useEffect(() => {
    if (isOpen) {
      if (editingCategory) {
        setName(editingCategory.name);
        setIcon(editingCategory.icon || "Tag");
      } else {
        setName("");
        setIcon("Tag");
      }
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, editingCategory]);

  const handleSave = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!name.trim() || isSubmitting || isDeleting) return;

    setIsSubmitting(true);
    try {
      if (editingCategory) {
        await updateCategory({
          id: editingCategory._id,
          name: name.trim(),
          icon: icon
        });
      } else {
        const newId = await createCategory({ 
          name: name.trim(),
          icon: icon
        });
        onCreated?.(newId);
      }
      onClose();
    } catch (error) {
      console.error("Failed to save category:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!editingCategory || isDeleting || isSubmitting) return;
    if (window.confirm("Delete this category? All tasks in this category will be unassigned.")) {
      setIsDeleting(true);
      try {
        await deleteCategory({ id: editingCategory._id });
        onClose();
      } catch (error) {
        console.error("Failed to delete category:", error);
      } finally {
        setIsDeleting(false);
      }
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} zIndex={250}>
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-[var(--color-hairline)] overflow-hidden"
      >
        <div className="p-5">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-[var(--color-ink)]">
              {editingCategory ? "Edit Category" : "New Category"}
            </h3>
            <div className="flex items-center gap-2">
              {editingCategory && (
                <button 
                  onClick={handleDelete}
                  disabled={isDeleting || isSubmitting}
                  className="p-2 hover:bg-red-50 text-red-500 rounded-full transition-colors disabled:opacity-50"
                  title="Delete Category"
                >
                  {isDeleting ? (
                    <div className="w-5 h-5 border-2 border-red-200 border-t-red-500 rounded-full animate-spin" />
                  ) : (
                    <Trash2 size={20} />
                  )}
                </button>
              )}
              <button 
                onClick={onClose}
                className="p-2 hover:bg-black/5 rounded-full transition-colors"
              >
                <X size={20} className="text-[var(--color-muted)]" />
              </button>
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-6">
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-wider mb-1.5 block">
                  Category Name
                </label>
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="e.g. Work, Groceries, Personal"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full text-lg font-medium outline-none border-b-2 border-[var(--color-hairline)] focus:border-[var(--color-primary)] transition-colors py-1 bg-transparent"
                />
              </div>
              
              <div>
                <label className="text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-wider mb-1.5 block">
                  Icon
                </label>
                <button
                  type="button"
                  onClick={() => setShowIconPicker(true)}
                  className="w-10 h-10 rounded-xl border-2 border-[var(--color-hairline)] flex items-center justify-center text-[var(--color-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-all"
                >
                  <CategoryIcon name={icon} size={20} />
                </button>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-[var(--color-muted)] hover:bg-black/5 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!name.trim() || isSubmitting}
                className="flex-[2] bg-[var(--color-primary)] text-white px-4 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50 hover:bg-[#006ee6] transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  editingCategory ? <Save size={18} /> : <Plus size={18} />
                )}
                {editingCategory ? "Save Changes" : "Create Category"}
              </button>
            </div>
          </form>
        </div>
      </div>

      <IconPickerModal 
        isOpen={showIconPicker}
        onClose={() => setShowIconPicker(false)}
        onSelect={setIcon}
        selectedIcon={icon}
      />
    </Modal>
  );
}
