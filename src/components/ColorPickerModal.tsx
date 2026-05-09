import { X, Check } from "lucide-react";
import Modal from "./Modal";

export const PRESET_COLORS = [
  '#007aff', // Blue
  '#34c759', // Green
  '#ff9500', // Orange
  '#ff2d55', // Pink
  '#af52de', // Violet
  '#5ac8fa', // Sky
  '#ffcc00', // Yellow
  '#ff3b30', // Red
  '#5856d6', // Indigo
  '#00c7be', // Teal
];

interface ColorPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedColor?: string;
  onSelect: (color: string) => void;
  title?: string;
}

export default function ColorPickerModal({
  isOpen,
  onClose,
  selectedColor,
  onSelect,
  title = "Select Color"
}: ColorPickerModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} zIndex={300}>
      <div className="bg-white rounded-2xl shadow-2xl border border-[var(--color-hairline)] overflow-hidden">
        <div className="p-4 border-b border-[var(--color-hairline)] flex items-center justify-between bg-[var(--color-surface-soft)]/50">
          <span className="text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-wider">
            {title}
          </span>
          <button 
            onClick={onClose} 
            className="p-1 hover:bg-black/5 rounded-full transition-colors"
          >
            <X size={18} className="text-[var(--color-muted)]" />
          </button>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-5 gap-4">
            {PRESET_COLORS.map((color) => {
              const isSelected = selectedColor?.toLowerCase() === color.toLowerCase();
              return (
                <button
                  key={color}
                  onClick={() => {
                    onSelect(color);
                    onClose();
                  }}
                  className={`
                    group relative w-12 h-12 rounded-full transition-all duration-200 
                    hover:scale-110 active:scale-95 shadow-sm
                    ${isSelected ? 'ring-2 ring-offset-2 ring-[var(--color-primary)]' : 'hover:shadow-md'}
                  `}
                  style={{ backgroundColor: color }}
                  title={color}
                >
                  {isSelected && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Check size={20} className="text-white drop-shadow-md" />
                    </div>
                  )}
                  <div className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-10 transition-opacity bg-white" />
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-4 bg-[var(--color-surface-soft)]/30 border-t border-[var(--color-hairline)] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-[var(--color-muted)] hover:bg-black/5 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}
