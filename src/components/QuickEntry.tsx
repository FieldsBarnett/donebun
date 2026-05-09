import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { X, Calendar, ChevronRight, Check, User, Users, ChevronLeft, Clock, Eye, EyeOff } from "lucide-react";
import { parseDueDate, isSameDay } from "../lib/dateUtils";
import CategorySelector from "./CategorySelector";
import Modal from "./Modal";

interface QuickEntryProps {
  isOpen: boolean;
  onClose: () => void;
}

const PickerWrapper = ({ isOpen, onClose, children, className }: { isOpen: boolean; onClose: () => void; children: React.ReactNode; className: string }) => {
  if (!isOpen) return null;
  return (
    <>
      <div className="fixed inset-0 z-[105] cursor-default" onClick={(e) => { e.stopPropagation(); onClose(); }} />
      <div className={className} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </>
  );
};

export default function QuickEntry({ isOpen, onClose }: QuickEntryProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState<string>(""); // ISO string or YYYY-MM-DD
  const [categoryId, setCategoryId] = useState<Id<"categories"> | "">("");
  const [assigneeId, setAssigneeId] = useState<Id<"users"> | "family" | "">("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAssigneePicker, setShowAssigneePicker] = useState(false);
  const [showWhenPicker, setShowWhenPicker] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);

  // Date Picker State
  const [viewDate, setViewDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState(""); // HH:mm format

  const inputRef = useRef<HTMLInputElement>(null);
  const createTask = useMutation(api.tasks.createTask);
  const currentUser = useQuery(api.users.getCurrentUser);
  const familyMembers = useQuery(api.users.getMyFamilyMembers) || [];

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    if (currentUser && !assigneeId) {
      setAssigneeId(currentUser._id);
    }
  }, [currentUser, assigneeId]);

  const handleCreate = async () => {
    if (!title.trim() || isSubmitting) return;

    setIsSubmitting(true);

    try {
      await createTask({
        title: title.trim(),
        description: description.trim() || undefined,
        isPrivate: isPrivate,
        dueDate: dueDate || undefined,
        categoryId: categoryId || undefined,
        assigneeId: (assigneeId && assigneeId !== "family") ? assigneeId as Id<"users"> : undefined,
      });
      setTitle("");
      setDescription("");
      setDueDate("");
      setCategoryId("");
      setSelectedTime("");
      setIsPrivate(false);
      // Reset assignee to current user for next time
      if (currentUser) setAssigneeId(currentUser._id);
      onClose();
    } catch (error) {
      console.error("Failed to create task:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !showAssigneePicker && !showWhenPicker) {
      handleCreate();
    } else if (e.key === "Escape") {
      if (showAssigneePicker) setShowAssigneePicker(false);
      else if (showWhenPicker) setShowWhenPicker(false);
      else onClose();
    }
  };

  const getAssigneeName = () => {
    if (assigneeId === "family") return "Family";
    if (!assigneeId) return "Who?";
    const member = familyMembers.find(m => m._id === assigneeId);
    return member?.name || (assigneeId === currentUser?._id ? "Me" : "Who?");
  };

  // Calendar Helpers
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days = [];

    // Previous month padding
    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push(null);
    }

    // Current month days
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }

    // Fill to exactly 42 days (6 weeks) to ensure consistent height
    while (days.length < 42) {
      days.push(null);
    }

    return days;
  };

  const formatDateLabel = (iso: string) => {
    if (!iso) return "When?";
    const date = parseDueDate(iso);
    const hasTime = iso.includes("T");

    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    let base = "";
    if (isSameDay(date, today)) base = "Today";
    else if (isSameDay(date, tomorrow)) base = "Tomorrow";
    else base = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

    if (hasTime) {
      const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
      return `${base} at ${time}`;
    }
    return base;
  };

  const handleSelectDate = (date: Date | null, time?: string) => {
    if (!date) {
      setDueDate("");
      setSelectedTime("");
      setShowWhenPicker(false);
      return;
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    const finalTime = time !== undefined ? time : selectedTime;

    if (finalTime) {
      setDueDate(`${dateStr}T${finalTime}:00`);
    } else {
      setDueDate(dateStr);
    }
    setShowWhenPicker(false);
  };

  const isInFamily = currentUser?.familyId !== undefined;
  const calendarDays = getDaysInMonth(viewDate);
  const selectedMember = assigneeId && assigneeId !== "family" ? familyMembers.find(m => m._id === assigneeId) : null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} zIndex={100}>
      <div
        className="bg-white rounded-2xl shadow-2xl border border-[var(--color-hairline)] overflow-visible"
      >
        <div className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-6 h-6 rounded-full bg-[var(--color-primary)] flex items-center justify-center text-white">
              <ChevronRight size={14} />
            </div>
            <span className="text-sm font-medium text-[var(--color-muted)]">New Task</span>
            <button
              onClick={onClose}
              className="ml-auto p-1 hover:bg-black/5 rounded-full transition-colors"
            >
              <X size={18} className="text-[var(--color-muted)]" />
            </button>
          </div>

          <div className="flex items-center gap-2 mb-1">
            {isPrivate && <EyeOff size={20} className="text-[var(--color-primary)] shrink-0" />}
            <input
              ref={inputRef}
              type="text"
              placeholder="What needs to be done?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full text-2xl font-bold outline-none placeholder-[var(--color-muted)]/40 bg-transparent"
            />
          </div>

          <textarea
            placeholder="Add details, links, or notes..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full min-h-[80px] text-[15px] text-[var(--color-ink)] outline-none placeholder-[var(--color-muted)]/40 resize-none mb-4 bg-transparent leading-relaxed"
          />

          <div className="flex flex-wrap items-center justify-end gap-2 mb-6">
            {/* When Picker Button */}
            <div className="relative">
              <button
                onClick={() => setShowWhenPicker(!showWhenPicker)}
                className={`flex items-center justify-center w-8 h-8 rounded-full border transition-colors ${dueDate ? 'bg-[var(--color-yellow)]/10 border-[var(--color-yellow)] text-[#b38f00]' : 'border-[var(--color-hairline)] text-[var(--color-muted)] hover:border-[var(--color-muted)]'}`}
                title={formatDateLabel(dueDate)}
              >
                <Calendar size={14} />
              </button>

              <PickerWrapper
                isOpen={showWhenPicker}
                onClose={() => setShowWhenPicker(false)}
                className="fixed md:absolute top-1/2 -translate-y-1/2 md:top-full md:translate-y-0 right-4 left-4 md:right-0 md:left-auto md:translate-x-0 w-auto md:w-[280px] bg-white border border-[var(--color-hairline)] rounded-xl shadow-2xl z-[110] p-4 animate-modal-in overflow-hidden"
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold text-[var(--color-muted)] uppercase tracking-wider">When</span>
                  <button onClick={() => setShowWhenPicker(false)} className="p-1 hover:bg-black/5 rounded-full transition-colors">
                    <X size={16} />
                  </button>
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
                    ${date && dueDate && isSameDay(parseDueDate(dueDate), date) ? 'bg-[var(--color-primary)] text-white font-bold' : ''}
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
                        const baseDate = dueDate ? parseDueDate(dueDate) : new Date();
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
            </div>

            {/* Private Toggle */}
            <div className="relative">
              <button
                onClick={() => setIsPrivate(!isPrivate)}
                className={`flex items-center justify-center w-8 h-8 rounded-full border transition-colors ${isPrivate ? 'bg-[var(--color-primary)]/10 border-[var(--color-primary)] text-[var(--color-primary)]' : 'border-[var(--color-hairline)] text-[var(--color-muted)] hover:border-[var(--color-muted)]'}`}
                title={isPrivate ? "Make Public" : "Make Private"}
              >
                {isPrivate ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>

            {/* Who Picker (Assignee) - Only if in family */}
            {isInFamily && (
              <div className="relative">
                <button
                  onClick={() => setShowAssigneePicker(!showAssigneePicker)}
                  className={`flex items-center justify-center w-8 h-8 rounded-full border transition-colors ${assigneeId && assigneeId !== "family" ? 'border-transparent' : 'border-[var(--color-hairline)] text-[var(--color-muted)] hover:border-[var(--color-muted)]'}`}
                  title={getAssigneeName()}
                  style={selectedMember ? { backgroundColor: selectedMember.colorCode || 'var(--color-primary)' } : {}}
                >
                  {selectedMember ? (
                    <span className="text-[10px] font-bold text-white uppercase">{selectedMember.initials || selectedMember.name[0]}</span>
                  ) : (
                    assigneeId === "family" ? <Users size={14} /> : <User size={14} />
                  )}
                </button>

                <PickerWrapper
                  isOpen={showAssigneePicker}
                  onClose={() => setShowAssigneePicker(false)}
                  className="fixed md:absolute top-1/2 -translate-y-1/2 md:top-full md:translate-y-0 right-4 left-4 md:right-0 md:left-auto md:translate-x-0 w-auto md:w-56 bg-white border border-[var(--color-hairline)] rounded-xl shadow-xl z-50 p-1 animate-modal-in"
                >
                  <div className="flex items-center justify-between p-2 border-b border-[var(--color-hairline)] mb-1">
                    <span className="text-xs font-bold text-[var(--color-muted)] uppercase tracking-wider">Assignee</span>
                    <button onClick={() => setShowAssigneePicker(false)} className="p-1 hover:bg-black/5 rounded-full transition-colors">
                      <X size={16} />
                    </button>
                  </div>
                  <div className="max-h-60 overflow-auto">
                    <button
                      onClick={() => { setAssigneeId("family"); setShowAssigneePicker(false); }}
                      className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-black/5 rounded-lg transition-colors text-left"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center bg-[var(--color-surface-soft)] border border-[var(--color-hairline)] text-[var(--color-muted)] shadow-sm shrink-0 aspect-square overflow-hidden">
                          <Users size={12} />
                        </div>
                        Family
                      </div>
                      {assigneeId === "family" && <Check size={14} className="text-[var(--color-primary)] shrink-0" />}
                    </button>

                    {familyMembers?.map(member => (
                      <button
                        key={member._id}
                        onClick={() => { setAssigneeId(member._id); setShowAssigneePicker(false); }}
                        className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-black/5 rounded-lg transition-colors text-left"
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 shadow-sm aspect-square overflow-hidden"
                            style={{ backgroundColor: member.colorCode || 'var(--color-primary)' }}
                          >
                            {member.initials || member.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="truncate">{member.name} {member._id === currentUser?._id ? '(Me)' : ''}</span>
                        </div>
                        {assigneeId === member._id && <Check size={14} className="text-[var(--color-primary)] shrink-0" />}
                      </button>
                    ))}
                  </div>
                </PickerWrapper>
              </div>
            )}

            <CategorySelector
              selectedCategoryId={categoryId}
              onSelect={setCategoryId}
              className="shrink-0"
            />
          </div>

          <div className="flex items-center justify-end pt-4 border-t border-[var(--color-hairline)]">
            <button
              onClick={handleCreate}
              disabled={!title.trim() || isSubmitting}
              className="bg-[var(--color-primary)] text-white px-6 py-2 rounded-full text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#006ee6] active:scale-95 transition-all shadow-md shadow-blue-500/20 flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </>
              ) : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
