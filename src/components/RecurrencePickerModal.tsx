import { useState, useEffect } from "react";
import { X, RotateCw, Calendar } from "lucide-react";
import Modal from "./Modal";

export type RecurrenceFrequency = "daily" | "weekly" | "monthly" | "yearly";
export type RecurrenceStrategy = "fixed" | "completion";

export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  interval: number;
  strategy: RecurrenceStrategy;
  daysOfWeek?: number[];
  dayOfMonth?: number;
  endDate?: string;
}

interface RecurrencePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (rule: RecurrenceRule | null) => void;
  initialRule?: RecurrenceRule | null;
}

const DAYS_OF_WEEK = [
  { label: "S", value: 0 },
  { label: "M", value: 1 },
  { label: "T", value: 2 },
  { label: "W", value: 3 },
  { label: "T", value: 4 },
  { label: "F", value: 5 },
  { label: "S", value: 6 },
];

export default function RecurrencePickerModal({
  isOpen,
  onClose,
  onSave,
  initialRule,
}: RecurrencePickerModalProps) {
  const [frequency, setFrequency] = useState<RecurrenceFrequency>(initialRule?.frequency || "daily");
  const [interval, setInterval] = useState<number>(initialRule?.interval || 1);
  const [strategy, setStrategy] = useState<RecurrenceStrategy>(initialRule?.strategy || "fixed");
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(initialRule?.daysOfWeek || []);
  const [dayOfMonth, setDayOfMonth] = useState<number>(initialRule?.dayOfMonth || new Date().getDate());
  const [endDate, setEndDate] = useState<string>(initialRule?.endDate || "");

  useEffect(() => {
    if (isOpen) {
      if (initialRule) {
        setFrequency(initialRule.frequency);
        setInterval(initialRule.interval);
        setStrategy(initialRule.strategy);
        setDaysOfWeek(initialRule.daysOfWeek || []);
        setDayOfMonth(initialRule.dayOfMonth || new Date().getDate());
        setEndDate(initialRule.endDate || "");
      } else {
        setFrequency("daily");
        setInterval(1);
        setStrategy("fixed");
        setDaysOfWeek([]);
        setDayOfMonth(new Date().getDate());
        setEndDate("");
      }
    }
  }, [initialRule, isOpen]);

  const handleSave = () => {
    const rule: RecurrenceRule = {
      frequency,
      interval,
      strategy,
    };

    // Only include complex rules for fixed strategy
    if (strategy === "fixed") {
      if (frequency === "weekly" && daysOfWeek.length > 0) {
        rule.daysOfWeek = daysOfWeek;
      }
      if (frequency === "monthly") {
        rule.dayOfMonth = dayOfMonth;
      }
      if (endDate) {
        rule.endDate = endDate;
      }
    }

    onSave(rule);
    onClose();
  };

  const handleRemove = () => {
    onSave(null);
    onClose();
  };

  const toggleDayOfWeek = (day: number) => {
    setDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} zIndex={150} size="sm">
      <div className="bg-white rounded-2xl shadow-xl border border-[var(--color-hairline)] flex flex-col font-system overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-hairline)] bg-[var(--color-surface-soft)]">
          <div className="flex items-center gap-2">
            <RotateCw size={18} className="text-[var(--color-primary)]" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--color-ink)]">Repeat</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-black/5 rounded-full text-[var(--color-muted)]">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-6">
          {/* Strategy Toggle */}
          <div className="bg-[var(--color-surface-soft)] p-1 rounded-xl flex border border-[var(--color-hairline)]">
            <button
              onClick={() => setStrategy("fixed")}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                strategy === "fixed"
                  ? "bg-white shadow-sm text-[var(--color-ink)]"
                  : "text-[var(--color-muted)] hover:text-[var(--color-ink)]"
              }`}
            >
              Scheduled
            </button>
            <button
              onClick={() => setStrategy("completion")}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                strategy === "completion"
                  ? "bg-white shadow-sm text-[var(--color-ink)]"
                  : "text-[var(--color-muted)] hover:text-[var(--color-ink)]"
              }`}
            >
              After Completion
            </button>
          </div>

          <div className="space-y-4">
            {/* Frequency Selector */}
            <div className="grid grid-cols-4 gap-2">
              {(["daily", "weekly", "monthly", "yearly"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFrequency(f)}
                  className={`py-2 px-1 text-[11px] font-bold uppercase tracking-tight rounded-lg border transition-all ${
                    frequency === f
                      ? "bg-[var(--color-primary)]/10 border-[var(--color-primary)] text-[var(--color-primary)]"
                      : "border-[var(--color-hairline)] text-[var(--color-muted)] hover:border-[var(--color-muted)]"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            {/* Interval Selection */}
            <div className="flex items-center justify-between px-1">
              <span className="text-sm font-medium text-[var(--color-ink)]">
                Every {interval} {frequency === "daily" ? "day" : frequency === "weekly" ? "week" : frequency === "monthly" ? "month" : "year"}{interval > 1 ? "s" : ""}
              </span>
              <div className="flex gap-2">
                <button
                  disabled={interval <= 1}
                  onClick={() => setInterval(i => Math.max(1, i - 1))}
                  className="w-8 h-8 rounded-full border border-[var(--color-hairline)] flex items-center justify-center text-[var(--color-muted)] hover:border-[var(--color-ink)] hover:text-[var(--color-ink)] disabled:opacity-30"
                >
                  -
                </button>
                <button
                  onClick={() => setInterval(i => i + 1)}
                  className="w-8 h-8 rounded-full border border-[var(--color-hairline)] flex items-center justify-center text-[var(--color-muted)] hover:border-[var(--color-ink)] hover:text-[var(--color-ink)]"
                >
                  +
                </button>
              </div>
            </div>

            {/* Strategy-Specific Inputs: Only for Fixed Strategy */}
            {strategy === "fixed" && (
              <div className="space-y-4 pt-2 border-t border-[var(--color-hairline)]">
                {/* Weekly: Days of Week */}
                {frequency === "weekly" && (
                  <div className="flex justify-between gap-1">
                    {DAYS_OF_WEEK.map((d) => (
                      <button
                        key={d.value}
                        onClick={() => toggleDayOfWeek(d.value)}
                        className={`w-8 h-8 rounded-full text-xs font-bold transition-all ${
                          daysOfWeek.includes(d.value)
                            ? "bg-[var(--color-primary)] text-white"
                            : "bg-[var(--color-surface-soft)] text-[var(--color-muted)] hover:bg-[var(--color-hairline)]"
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Monthly: Day of Month */}
                {frequency === "monthly" && (
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-[var(--color-muted)] uppercase tracking-wider shrink-0">On Day</span>
                    <input 
                      type="number" 
                      min={1} 
                      max={31} 
                      value={dayOfMonth}
                      onChange={(e) => setDayOfMonth(parseInt(e.target.value) || 1)}
                      className="w-16 bg-[var(--color-surface-soft)] border border-[var(--color-hairline)] rounded-lg px-2 py-1.5 text-sm font-medium outline-none focus:border-[var(--color-primary)]"
                    />
                  </div>
                )}

                {/* End Date */}
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-bold text-[var(--color-muted)] uppercase tracking-wider">Ends</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEndDate("")}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all ${
                        !endDate 
                          ? "bg-[var(--color-primary)]/10 border-[var(--color-primary)] text-[var(--color-primary)]"
                          : "border-[var(--color-hairline)] text-[var(--color-muted)] hover:border-[var(--color-muted)]"
                      }`}
                    >
                      Never
                    </button>
                    <div className="flex-[2] relative">
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className={`w-full py-2 pl-8 pr-2 text-xs font-bold rounded-lg border outline-none transition-all ${
                          endDate
                            ? "bg-[var(--color-primary)]/10 border-[var(--color-primary)] text-[var(--color-primary)]"
                            : "border-[var(--color-hairline)] text-[var(--color-muted)] hover:border-[var(--color-muted)]"
                        }`}
                      />
                      <Calendar size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {strategy === "completion" && (
              <div className="pt-2 border-t border-[var(--color-hairline)]">
                <p className="text-[11px] text-[var(--color-muted)] italic">
                  Next task will be created {interval} {frequency === "daily" ? "day" : frequency === "weekly" ? "week" : frequency === "monthly" ? "month" : "year"}{interval > 1 ? "s" : ""} after you complete the current one.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--color-hairline)] flex gap-3">
          {initialRule && (
            <button
              onClick={handleRemove}
              className="px-4 py-2 text-sm font-semibold text-red-500 hover:bg-red-50 rounded-xl transition-colors"
            >
              Remove
            </button>
          )}
          <button
            onClick={handleSave}
            className="flex-1 bg-[var(--color-primary)] text-white px-6 py-2 rounded-xl text-sm font-semibold hover:bg-[#006ee6] active:scale-95 transition-all shadow-md shadow-blue-500/20"
          >
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
}
