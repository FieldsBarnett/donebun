import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import NewCategoryModal from "./NewCategoryModal";
import CategoryPickerModal from "./CategoryPickerModal";
import CategoryIcon from "./CategoryIcon";

interface CategorySelectorProps {
  selectedCategoryId?: Id<"categories"> | "";
  onSelect: (categoryId: Id<"categories"> | "") => void;
  className?: string;
  align?: 'left' | 'right';
}

export default function CategorySelector({ 
  selectedCategoryId, 
  onSelect, 
  className = ""
}: CategorySelectorProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<{ _id: Id<"categories">, name: string, icon?: string } | undefined>(undefined);
  const categories = useQuery(api.categories.list) || [];

  const selectedCategory = categories.find(c => c._id === selectedCategoryId);

  return (
    <div className={`relative ${className}`}>
      <button 
        onClick={() => setShowPicker(true)}
        className={`flex items-center justify-center w-8 h-8 rounded-full border transition-all ${selectedCategoryId ? 'bg-[var(--color-badge-purple)]/10 border-[var(--color-badge-purple)] text-[var(--color-badge-purple)]' : 'border-[var(--color-hairline)] text-[var(--color-muted)] hover:border-[var(--color-muted)] hover:bg-black/5'}`}
        title={selectedCategory ? `Category: ${selectedCategory.name}` : 'Add Category'}
      >
        <CategoryIcon name={selectedCategory?.icon} size={14} />
      </button>

      <CategoryPickerModal
        isOpen={showPicker}
        onClose={() => setShowPicker(false)}
        selectedCategoryId={selectedCategoryId}
        onSelect={onSelect}
        onAddNew={() => {
          setEditingCategory(undefined);
          setShowNewModal(true);
        }}
        onEdit={(cat) => {
          setEditingCategory(cat);
          setShowNewModal(true);
        }}
      />

      <NewCategoryModal 
        isOpen={showNewModal} 
        onClose={() => {
          setShowNewModal(false);
          setEditingCategory(undefined);
        }}
        editingCategory={editingCategory}
        onCreated={(newId) => {
          onSelect(newId);
          setShowNewModal(false);
          setEditingCategory(undefined);
        }}
      />
    </div>
  );
}
