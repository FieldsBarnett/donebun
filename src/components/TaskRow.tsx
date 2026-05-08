import { useState, useRef, useEffect } from "react";
import { Check, Users, Calendar, ChevronRight, ChevronLeft, X, Eye, EyeOff, FileText } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { parseDueDate, isSameDay } from "../lib/dateUtils";
import { motion, AnimatePresence } from "framer-motion";
import CategorySelector from "./CategorySelector";

import RecurrenceEditModal, { UpdateMode } from "./RecurrenceEditModal";

interface TaskRowProps {
  id: string; // Changed from Id<"tasks"> to string for local support
  title: string;
  description?: string;
  completed: boolean;
  ownerId: Id<"users">;
  assigneeId?: Id<"users">;
  categoryId?: Id<"categories">;
  dueDate?: string;

  isPrivate: boolean;
  isRecurring?: boolean;
  recurrenceStrategy?: "fixed" | "completion";
  onToggle: () => void;
  isToday?: boolean;
  onSaveLocal?: (updates: any) => void;
  onRemoveLocal?: () => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}


export function TaskRow({
  id, title: initialTitle, description: initialDescription, completed,
  ownerId, assigneeId, categoryId, dueDate,
  onToggle, isToday, isPrivate, isRecurring, recurrenceStrategy,
  onSaveLocal, onRemoveLocal,
  isExpanded: controlledIsExpanded,
  onToggleExpand
}: TaskRowProps) {
  const [localTitle, setLocalTitle] = useState(initialTitle);
  const [localDescription, setLocalDescription] = useState(initialDescription || "");
  const [localDueDate, setLocalDueDate] = useState(dueDate);
  const [localAssigneeId, setLocalAssigneeId] = useState(assigneeId);
  const [localCategoryId, setLocalCategoryId] = useState(categoryId);
  const [localIsPrivate, setLocalIsPrivate] = useState(isPrivate);
  const [internalIsExpanded, setInternalIsExpanded] = useState(false);

  const [showRecurrenceModal, setShowRecurrenceModal] = useState(false);
  const pendingUpdatesRef = useRef<any>(null);

  const isExpanded = controlledIsExpanded !== undefined ? controlledIsExpanded : internalIsExpanded;

  const toggleExpand = (e: React.MouseEvent) => {
    // Don't expand if clicking buttons or links
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('a')) return;

    // If already expanded, clicking inside shouldn't collapse it
    if (isExpanded) return;

    if (onToggleExpand) {
      onToggleExpand();
    } else {
      setInternalIsExpanded(true);
    }
  };

  // Picker States
  const [showWhenPicker, setShowWhenPicker] = useState(false);
  const [showWhoPicker, setShowWhoPicker] = useState(false);
  const [viewDate, setViewDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState("");

  const updateTask = useMutation(api.tasks.updateTask);
  const currentUser = useQuery(api.users.getCurrentUser);
  const familyMembers = useQuery(api.users.getMyFamilyMembers) || [];


  const assignee = familyMembers.find(m => m._id === (localAssigneeId || assigneeId));
  const isFamilyPool = !(localAssigneeId || assigneeId);

  const titleRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync internal state with props when not expanded
  useEffect(() => {
    if (!isExpanded) {
      setLocalTitle(initialTitle);
      setLocalDescription(initialDescription || "");
      setLocalDueDate(dueDate);
      setLocalAssigneeId(assigneeId);
      setLocalCategoryId(categoryId);
      setLocalIsPrivate(isPrivate);
    }
  }, [initialTitle, initialDescription, dueDate, assigneeId, categoryId, isPrivate, isExpanded]);

  const handleUpdate = async (updates: any) => {
    try {
      await updateTask({ id: id as Id<"tasks">, ...updates });
    } catch (error) {
      console.error("Failed to update task:", error);
    }
  };

  const handleSave = async () => {
    const updates = {
      title: localTitle,
      description: localDescription,
      dueDate: localDueDate ?? null,
      assigneeId: localAssigneeId ?? null,
      categoryId: localCategoryId ?? null,
      isPrivate: localIsPrivate
    };

    const hasChanges = 
      localTitle !== initialTitle || 
      localDescription !== (initialDescription || "") || 
      localDueDate !== dueDate || 
      localAssigneeId !== assigneeId || 
      localCategoryId !== categoryId || 
      localIsPrivate !== isPrivate;

    if (!hasChanges) {
      if (onToggleExpand) {
        if (controlledIsExpanded) onToggleExpand();
      } else {
        setInternalIsExpanded(false);
      }
      return;
    }

    if (isRecurring) {
      pendingUpdatesRef.current = updates;
      setShowRecurrenceModal(true);
      return;
    }

    performSave(updates);
  };

  const performSave = (updates: any, updateMode: UpdateMode = "single") => {
    if (onSaveLocal) {
      onSaveLocal({ ...updates, updateMode });
      if (onToggleExpand) {
        if (controlledIsExpanded) onToggleExpand();
      } else {
        setInternalIsExpanded(false);
      }
      return;
    }

    if (onToggleExpand) {
      if (controlledIsExpanded) onToggleExpand();
    } else {
      setInternalIsExpanded(false);
    }
    handleUpdate({ ...updates, updateMode }); // fire-and-forget
  };

  // Use a ref to keep the latest handleSave available to the click-outside listener
  // without having to re-bind the event listener on every keystroke.
  const saveRef = useRef(handleSave);
  useEffect(() => {
    saveRef.current = handleSave;
  }, [handleSave]);

  // Click outside listener
  useEffect(() => {
    if (!isExpanded) return;

    const handleClickOutside = (event: MouseEvent) => {
      // If any picker is open, let the picker's overlay handle it
      if (showWhenPicker || showWhoPicker) return;

      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        saveRef.current();
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [isExpanded, showWhenPicker, showWhoPicker]);

  const getAssigneeName = () => {
    if (isFamilyPool) return "Who?";
    return assignee?.name || "Who?";
  };

  const formatDateLabel = (iso: string | undefined) => {
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

  // Calendar Helpers
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days = [];
    for (let i = 0; i < firstDay.getDay(); i++) days.push(null);
    for (let i = 1; i <= lastDay.getDate(); i++) days.push(new Date(year, month, i));
    return days;
  };

  const handleSelectDate = (date: Date | null, time?: string) => {
    if (!date) {
      setLocalDueDate(undefined);
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
      setLocalDueDate(`${dateStr}T${finalTime}:00`);
    } else {
      setLocalDueDate(dateStr);
    }
    setShowWhenPicker(false);
  };

  const PickerWrapper = ({ isOpen, onClose, children, className }: { isOpen: boolean; onClose: () => void; children: React.ReactNode; className: string }) => {
    if (!isOpen) return null;
    return (
      <>
        <div className="fixed inset-0 z-[205] cursor-default" onClick={(e) => { e.stopPropagation(); onClose(); }} />
        <div className={className} onClick={(e) => e.stopPropagation()}>
          {children}
        </div>
      </>
    );
  };


  return (
    <div ref={containerRef} className="relative">
      <AnimatePresence initial={false} mode="popLayout">
        {!isExpanded ? (
          <motion.div
            key="collapsed"
            layoutId={`task-card-${id}`}
            onClick={toggleExpand}
            className="relative group flex flex-col cursor-pointer overflow-hidden -mx-5 px-5 py-[2px] bg-[var(--color-canvas)] hover:bg-black/[0.02]"
            transition={{ type: "spring", stiffness: 500, damping: 40, mass: 0.8 }}
          >
            <div className="flex items-start gap-4 py-[8px]">
              {/* Checkbox */}
              <motion.button
                layoutId={`checkbox-${id}`}
                onClick={(e) => { e.stopPropagation(); onToggle(); }}
                className={`flex-shrink-0 flex items-center justify-center rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[var(--color-primary)] relative
                  w-[22px] h-[22px] mt-0.5
                  ${completed
                    ? 'bg-[var(--color-primary)] border-[var(--color-primary)]'
                    : isToday
                      ? 'border-[var(--color-primary)] hover:bg-[var(--color-primary)]/10'
                      : 'border-[#c7c7cc] hover:bg-black/5'
                  }`}
              >
                {completed && <Check size={14} className="text-white" strokeWidth={3} />}

              </motion.button>

              {/* Content Area */}
              <div className="flex-1 min-w-0">
                <div className={`text-[15px] ${completed ? 'text-[var(--color-muted)] line-through' : 'text-[var(--color-ink)]'} font-medium py-0.5 flex items-center gap-2`}>
                  <motion.span layoutId={`title-${id}`} className="truncate block">{initialTitle}</motion.span>
                </div>
              </div>

              {/* Collapsed extras */}
              <div className="shrink-0 flex items-center gap-3 self-start mt-0.5">
                {isPrivate && <EyeOff size={14} className="text-[var(--color-muted)]/50 shrink-0" />}

                {initialDescription && (
                  <FileText size={14} className="text-[var(--color-muted)]/50 shrink-0" />
                )}

                <div className="">
                  {isFamilyPool ? (
                    <div className="w-5 h-5 rounded-full flex items-center justify-center bg-[var(--color-surface-soft)] border border-[var(--color-hairline)] text-[var(--color-muted)] shrink-0">
                      <Users size={12} />
                    </div>
                  ) : assignee && (
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white shadow-sm shrink-0"
                      style={{ backgroundColor: assignee.colorCode?.startsWith('#') ? assignee.colorCode : `var(--color-${assignee.colorCode || 'primary'})` }}
                    >
                      {assignee.initials || assignee.name[0]}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="expanded"
            layoutId={`task-card-${id}`}
            className="relative flex flex-col overflow-hidden p-5 -mx-5 mb-4 bg-white shadow-2xl rounded-[16px] border border-[var(--color-hairline)] z-20 cursor-default"
            transition={{ type: "spring", stiffness: 500, damping: 40, mass: 0.8 }}
          >
            <div className="flex items-start gap-4 py-[8px]">
              {/* Checkbox (larger) */}
              <motion.button
                layoutId={`checkbox-${id}`}
                onClick={(e) => { e.stopPropagation(); onToggle(); }}
                className={`flex-shrink-0 flex items-center justify-center rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[var(--color-primary)] relative
                  w-[24px] h-[24px] mt-1.5
                  ${completed
                    ? 'bg-[var(--color-primary)] border-[var(--color-primary)]'
                    : isToday
                      ? 'border-[var(--color-primary)] hover:bg-[var(--color-primary)]/10'
                      : 'border-[#c7c7cc] hover:bg-black/5'
                  }`}
              >
                {completed && <Check size={16} className="text-white" strokeWidth={3} />}
              </motion.button>

              {/* Content Area */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2 mb-1">
                    {localIsPrivate && <EyeOff size={16} className="text-[var(--color-primary)] shrink-0" />}
                    <motion.textarea
                      layoutId={`title-${id}`}
                      ref={titleRef}
                      value={localTitle}
                      onChange={(e) => setLocalTitle(e.target.value)}
                      placeholder="What needs to be done?"
                      className="w-full text-2xl font-bold outline-none placeholder-[var(--color-muted)]/40 bg-transparent resize-none leading-tight"
                      rows={1}
                      autoFocus
                      onInput={(e) => {
                        const target = e.target as HTMLTextAreaElement;
                        target.style.height = 'auto';
                        target.style.height = target.scrollHeight + 'px';
                      }}
                    />
                  </div>
                  <textarea
                    value={localDescription}
                    onChange={(e) => setLocalDescription(e.target.value)}
                    placeholder="Add details, links, or notes..."
                    className="w-full min-h-[80px] text-[15px] text-[var(--color-ink)] outline-none placeholder-[var(--color-muted)]/40 resize-none bg-transparent leading-relaxed"
                  />

                  {/* Metadata Row */}
                  <div className="flex items-center justify-end gap-2 mt-2">
                    <div className="relative">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setShowWhenPicker(!showWhenPicker); }}
                        className={`flex items-center justify-center w-8 h-8 rounded-full border transition-colors ${localDueDate ? 'bg-[var(--color-yellow)]/10 border-[var(--color-yellow)] text-[#b38f00]' : 'border-[var(--color-hairline)] text-[var(--color-muted)] hover:border-[var(--color-muted)]'}`}
                        title={formatDateLabel(localDueDate)}
                      >
                        <Calendar size={14} />
                      </button>
                      <PickerWrapper 
                        isOpen={showWhenPicker} 
                        onClose={() => setShowWhenPicker(false)} 
                        className="fixed md:absolute top-1/2 -translate-y-1/2 md:top-full md:translate-y-0 right-4 left-4 md:right-0 md:left-auto md:translate-x-0 w-auto md:w-[280px] bg-white border border-[var(--color-hairline)] rounded-xl shadow-2xl z-[210] p-4 animate-modal-in overflow-hidden"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-xs font-bold text-[var(--color-muted)] uppercase tracking-wider">When</span>
                          <button onClick={() => setShowWhenPicker(false)} className="p-1 hover:bg-black/5 rounded-full transition-colors md:hidden">
                            <X size={16} />
                          </button>
                        </div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-bold">{viewDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span>
                          <div className="flex gap-1">
                            <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))} className="p-1 hover:bg-black/5 rounded-md"><ChevronLeft size={16} /></button>
                            <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))} className="p-1 hover:bg-black/5 rounded-md"><ChevronRight size={16} /></button>
                          </div>
                        </div>
                        <div className="grid grid-cols-7 gap-1 mb-4">
                          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <div key={i} className="text-[10px] font-bold text-[var(--color-muted)] text-center">{d}</div>)}
                          {getDaysInMonth(viewDate).map((date, i) => (
                            <button key={i} disabled={!date} onClick={() => date && handleSelectDate(date)} className={`text-xs h-8 w-8 flex items-center justify-center rounded-lg ${!date ? 'invisible' : 'hover:bg-[var(--color-primary)]/10'} ${date && isSameDay(date, new Date()) ? 'font-bold text-[var(--color-primary)]' : ''} ${date && localDueDate && isSameDay(parseDueDate(localDueDate), date) ? 'bg-[var(--color-primary)] text-white font-bold' : ''}`}>{date?.getDate()}</button>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => handleSelectDate(new Date())} className="flex-1 p-2 bg-[var(--color-yellow)]/10 text-[var(--color-yellow)] font-bold text-xs rounded-lg border border-[var(--color-yellow)]/20">Today</button>
                          <button onClick={() => { const t = new Date(); t.setDate(t.getDate() + 1); handleSelectDate(t); }} className="flex-1 p-2 bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-bold text-xs rounded-lg border border-[var(--color-primary)]/20">Tomorrow</button>
                        </div>
                      </PickerWrapper>
                    </div>

                    {currentUser?._id === ownerId && (
                      <div className="relative">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setLocalIsPrivate(!localIsPrivate); }}
                          className={`flex items-center justify-center w-8 h-8 rounded-full border transition-colors ${localIsPrivate ? 'bg-[var(--color-primary)]/10 border-[var(--color-primary)] text-[var(--color-primary)]' : 'border-[var(--color-hairline)] text-[var(--color-muted)] hover:border-[var(--color-muted)]'}`}
                          title={localIsPrivate ? "Make Public" : "Make Private"}
                        >
                          {localIsPrivate ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    )}

                    <div className="relative">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setShowWhoPicker(!showWhoPicker); }}
                        className={`flex items-center justify-center w-8 h-8 rounded-full border transition-colors ${localAssigneeId ? 'border-transparent' : 'border-[var(--color-hairline)] text-[var(--color-muted)] hover:border-[var(--color-muted)]'}`}
                        title={getAssigneeName()}
                        style={localAssigneeId && assignee ? {
                          backgroundColor: assignee.colorCode?.startsWith('#') ? assignee.colorCode : `var(--color-${assignee.colorCode || 'primary'})`
                        } : {}}
                      >
                        {localAssigneeId && assignee ? (
                          <span className="text-[10px] font-bold text-white uppercase">{assignee.initials || assignee.name[0]}</span>
                        ) : (
                          <Users size={14} />
                        )}
                      </button>
                      <PickerWrapper 
                        isOpen={showWhoPicker} 
                        onClose={() => setShowWhoPicker(false)} 
                        className="fixed md:absolute top-1/2 -translate-y-1/2 md:top-full md:translate-y-0 right-4 left-4 md:right-0 md:left-auto md:translate-x-0 w-auto md:w-56 bg-white border border-[var(--color-hairline)] rounded-xl shadow-xl z-[210] p-1 animate-modal-in"
                      >
                        <div className="flex items-center justify-between p-2 border-b border-[var(--color-hairline)] mb-1">
                          <span className="text-xs font-bold text-[var(--color-muted)] uppercase tracking-wider">Assignee</span>
                          <button onClick={() => setShowWhoPicker(false)} className="p-1 hover:bg-black/5 rounded-full transition-colors md:hidden">
                            <X size={16} />
                          </button>
                        </div>
                        <button onClick={() => { setLocalAssigneeId(undefined); setShowWhoPicker(false); }} className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-black/5 rounded-lg transition-colors">
                          <div className="flex items-center gap-2"><div className="w-6 h-6 rounded-full bg-[var(--color-surface-soft)] flex items-center justify-center"><Users size={12} /></div>Family Pool</div>
                          {!localAssigneeId && <Check size={14} className="text-[var(--color-primary)]" />}
                        </button>
                        {familyMembers.map(m => (
                          <button key={m._id} onClick={() => { setLocalAssigneeId(m._id); setShowWhoPicker(false); }} className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-black/5 rounded-lg transition-colors">
                            <div className="flex items-center gap-2"><div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ backgroundColor: m.colorCode || 'var(--color-primary)' }}>{m.initials || m.name[0]}</div>{m.name}</div>
                            {localAssigneeId === m._id && <Check size={14} className="text-[var(--color-primary)]" />}
                          </button>
                        ))}
                      </PickerWrapper>
                    </div>

                    <CategorySelector
                      selectedCategoryId={localCategoryId}
                      onSelect={(catId) => setLocalCategoryId(catId || undefined)}
                      className="shrink-0"
                    />
                  </div>
                </div>
              </div>

              {/* Close button */}
              <div className="shrink-0 flex items-center gap-3 self-start mt-0.5">
                <button type="button" onClick={(e) => { e.stopPropagation(); handleSave(); }} className="p-1 hover:bg-black/5 rounded-full transition-colors"><X size={20} className="text-[var(--color-muted)]" /></button>
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="flex items-center justify-end pt-5 mt-2 border-t border-[var(--color-hairline)] pb-1"
            >

              <div className="flex items-center gap-3 ml-auto">
                {onRemoveLocal && (
                  <button 
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onRemoveLocal(); }}
                    className="px-4 py-2 rounded-full text-sm font-semibold text-red-500 hover:bg-red-50 transition-colors"
                  >
                    Discard
                  </button>
                )}
                <button type="button" onClick={(e) => { e.stopPropagation(); handleSave(); }} className="bg-[var(--color-primary)] text-white px-6 py-2 rounded-full text-sm font-semibold hover:bg-[#006ee6] transition-all">Save</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <RecurrenceEditModal 
        isOpen={showRecurrenceModal}
        onClose={() => setShowRecurrenceModal(false)}
        onConfirm={(mode) => performSave(pendingUpdatesRef.current, mode)}
        actionType="edit"
        strategy={recurrenceStrategy}
      />
    </div>
  );
}
