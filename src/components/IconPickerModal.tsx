import { X } from "lucide-react";
import CategoryIcon from "./CategoryIcon";
import Modal from "./Modal";

// ... same icons ...
const CATEGORY_ICONS = [
  "Tag", "Briefcase", "User", "Home", "ShoppingCart", "Heart", "Star", "Zap", 
  "Coffee", "Code", "Book", "Music", "Video", "MapPin", "Flag", "Target", 
  "Bell", "Calendar", "Mail", "Phone", "Camera", "Gift", "CreditCard", 
  "DollarSign", "Hammer", "Trash2", "Smile", "Frown", "Meh", "Sun", "Moon", 
  "Cloud", "Anchor", "Bicycle", "Car", "Ghost", "Lightbulb", "Lock", "Unlock",
  "Palette", "Plane", "Rocket", "Scissors", "Shield", "Smartphone", "Sticker",
  "Trophy", "Umbrella", "Wallet", "Watch"
];

interface IconPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (iconName: string) => void;
  selectedIcon?: string;
}

export default function IconPickerModal({ isOpen, onClose, onSelect, selectedIcon }: IconPickerModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} zIndex={300}>
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-[var(--color-hairline)] flex flex-col max-h-[80vh]"
      >
        <div className="p-5 border-b border-[var(--color-hairline)] flex items-center justify-between">
          <h3 className="text-lg font-bold text-[var(--color-ink)]">Select Icon</h3>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-black/5 rounded-full transition-colors"
          >
            <X size={20} className="text-[var(--color-muted)]" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto grid grid-cols-6 sm:grid-cols-8 gap-2">
          {CATEGORY_ICONS.map((iconName) => (
            <button
              key={iconName}
              onClick={() => {
                onSelect(iconName);
                onClose();
              }}
              className={`
                aspect-square flex items-center justify-center rounded-xl transition-all
                ${selectedIcon === iconName 
                  ? 'bg-[var(--color-primary)] text-white shadow-lg scale-110' 
                  : 'hover:bg-black/5 text-[var(--color-muted)] hover:text-[var(--color-ink)]'}
              `}
              title={iconName}
            >
              <CategoryIcon name={iconName} size={20} />
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}
