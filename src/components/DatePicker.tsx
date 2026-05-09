import { useState } from "react";
import { X, Calendar, ChevronRight, ChevronLeft, Clock, Repeat } from "lucide-react";
import { parseDueDate, isSameDay } from "../lib/dateUtils";
import PickerWrapper from "./PickerWrapper";
import RecurrencePickerModal, { RecurrenceRule } from "./RecurrencePickerModal";

interface DatePickerProps {
  isOpen: boolean;
  onClose: () => void;
  value: string; // ISO string or YYYY-MM-DD
  onChange: (value: string) => void;
  recurrence?: RecurrenceRule | null;
  onRecurrenceChange?: (rule: RecurrenceRule | null) => void;
  className?: string;
  zIndex?: number;
}

export default function DatePicker({
  isOpen,
  onClose,
  value,
  onChange,
  recurrence,
  onRecurrenceChange,
  className = "fixed md:absolute top-1/2 -translate-y-1/2 md:top-full md:translate-y-0 right-4 left-4 md:right-0 md:left-auto md:translate-x-0 w-auto md:w-[280px] bg-white border border-[var(--color-hairline)] rounded-xl shadow-2xl p-4 animate-modal-in overflow-hidden",
  zIndex,
}: DatePickerProps) {
  const [viewDate, setViewDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState(value.includes("T") ? value.split("T")[1].substring(0, 5) : "");
  const [showRecurrencePicker, setShowRecurrencePicker] = useState(false);

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days = [];

    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push(null);
    }

    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }

    while (days.length < 42) {
      days.push(null);
    }

    return days;
  };

  const handleSelectDate = (date: Date | null, time?: string) => {
    if (!date) {
      onChange("");
      onClose();
      return;
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    const finalTime = time !== undefined ? time : selectedTime;

    if (finalTime) {
      onChange(`${dateStr}T${finalTime}:00`);
    } else {
      onChange(dateStr);
    }
    onClose();
  };

  const calendarDays = getDaysInMonth(viewDate);

  return (
    <>
      <PickerWrapper
        isOpen={isOpen}
        onClose={onClose}
        className={className}
        zIndex={zIndex}
      >
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-bold text-[var(--color-muted)] uppercase tracking-wider">When</span>
          <div className="flex items-center gap-1">
            {onRecurrenceChange && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowRecurrencePicker(true);
                }}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors ${
                  recurrence 
                    ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]' 
                    : 'hover:bg-black/5 text-[var(--color-muted)]'
                }`}
                title="Repeat"
              >
                <Repeat size={14} />
                <span className="text-[10px] font-bold uppercase tracking-tight">Repeat</span>
              </button>
            )}
            <button onClick={onClose} className="p-1 hover:bg-black/5 rounded-full transition-colors text-[var(--color-muted)]">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Calendar Header */}
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-sm font-bold">
            {viewDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}
              className="p-1 hover:bg-black/5 rounded-md transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}
              className="p-1 hover:bg-black/5 rounded-md transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1 mb-4">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
            <div key={i} className="text-[10px] font-bold text-[var(--color-muted)] text-center py-1">
              {d}
            </div>
          ))}
          {calendarDays.map((date, i) => (
            <button
              key={i}
              disabled={!date}
              onClick={() => date && handleSelectDate(date)}
              className={`
                text-xs h-8 w-8 flex items-center justify-center rounded-lg transition-all
                ${!date ? 'invisible' : 'hover:bg-[var(--color-primary)]/10 hover:text-[var(--color-primary)]'}
                ${date && isSameDay(date, new Date()) ? 'font-bold text-[var(--color-primary)]' : ''}
                ${date && value && isSameDay(parseDueDate(value), date) ? 'bg-[var(--color-primary)] text-white font-bold' : ''}
              `}
            >
              {date?.getDate()}
            </button>
          ))}
        </div>

        {/* Time Entry */}
        <div className="h-[1px] bg-[var(--color-hairline)] mb-3" />
        <div className="flex items-center gap-2 mb-4">
          <Clock size={14} className="text-[var(--color-muted)]" />
          <input
            type="time"
            value={selectedTime}
            onChange={(e) => setSelectedTime(e.target.value)}
            className="text-xs font-medium outline-none border-none p-1 rounded-md hover:bg-black/5 transition-colors flex-1"
          />
          {selectedTime && (
            <button
              onClick={() => {
                const baseDate = value ? parseDueDate(value) : new Date();
                handleSelectDate(baseDate, selectedTime);
              }}
              className="text-[10px] font-bold text-[var(--color-primary)] uppercase tracking-wider px-2 py-1 hover:bg-[var(--color-primary)]/10 rounded-md transition-colors"
            >
              Set
            </button>
          )}
        </div>

        {/* Quick Options */}
        <div className="flex gap-2">
          <button
            onClick={() => handleSelectDate(new Date())}
            className="flex-1 flex flex-col items-center gap-1.5 p-3 bg-[var(--color-yellow)]/10 hover:bg-[var(--color-yellow)]/20 border border-[var(--color-yellow)]/20 rounded-xl transition-all"
          >
            <Calendar size={18} className="text-[var(--color-yellow)]" />
            <span className="text-[13px] font-bold text-[var(--color-yellow)]">Today</span>
          </button>
          <button
            onClick={() => {
              const tomorrow = new Date();
              tomorrow.setDate(tomorrow.getDate() + 1);
              handleSelectDate(tomorrow);
            }}
            className="flex-1 flex flex-col items-center gap-1.5 p-3 bg-[var(--color-primary)]/10 hover:bg-[var(--color-primary)]/20 border border-[var(--color-primary)]/20 rounded-xl transition-all"
          >
            <ChevronRight size={18} className="text-[var(--color-primary)]" />
            <span className="text-[13px] font-bold text-[var(--color-primary)]">Tomorrow</span>
          </button>
        </div>
      </PickerWrapper>

      <RecurrencePickerModal
        isOpen={showRecurrencePicker}
        onClose={() => setShowRecurrencePicker(false)}
        onSave={(rule) => {
          onRecurrenceChange?.(rule);
          // Don't close the date picker if we just set recurrence, 
          // or should we? Things 3 keeps the date picker open usually.
        }}
        initialRule={recurrence}
      />
    </>
  );
}
