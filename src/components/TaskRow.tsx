import React, { useState, useRef, useEffect, useMemo } from "react";
import { Check, Users, Calendar, ChevronRight, X, Eye, EyeOff, FileText, ListTodo, Trash2, Paperclip, Repeat } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { parseDueDate, isSameDay, toDateKey } from "../lib/dateUtils";
import { motion, AnimatePresence } from "framer-motion";
import CategorySelector from "./CategorySelector";
import Modal from "./Modal";
import ImagePreviewModal from "./ImagePreviewModal";
import DatePicker from "./DatePicker";
import { RecurrenceRule } from "./RecurrencePickerModal";
import PickerWrapper from "./PickerWrapper";

import RecurrenceEditModal, { UpdateMode } from "./RecurrenceEditModal";

interface Attachment {
  storageId: string;
  name: string;
  type: string;
}

const AttachmentItem = ({ file, onRemove, onOpen }: { file: Attachment; onRemove?: () => void; onOpen?: () => void }) => {
  const url = useQuery(api.files.getUrl, file.storageId ? { storageId: file.storageId } : "skip");
  const isImage = file.type.startsWith('image/');
  
  // Create a consistent "random" tilt based on the storageId
  const tilt = useMemo(() => {
    const seed = file.storageId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return (seed % 6) - 3; // -3 to +3 degrees
  }, [file.storageId]);

  if (isImage) {
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onOpen?.(); }}
        className="w-14 h-14 rounded-lg border border-[var(--color-hairline)] overflow-hidden bg-white shrink-0 hover:border-[var(--color-primary)] transition-all shadow-sm hover:shadow-md hover:scale-105 active:scale-95"
        style={{ transform: `rotate(${tilt}deg)` }}
      >
        {url ? (
          <img src={url} alt={file.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-black/5 animate-pulse" />
        )}
      </button>
    );
  }

  return (
    <div 
      className="flex items-center gap-2 px-2 py-1 bg-[var(--color-surface-soft)] border border-[var(--color-hairline)] rounded-lg text-xs group shadow-sm"
      style={{ transform: `rotate(${tilt}deg)` }}
    >
      {url ? (
        <a 
          href={url} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="flex items-center gap-2 hover:text-[var(--color-primary)] transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          <FileText size={12} />
          <span className="max-w-[120px] truncate">{file.name}</span>
        </a>
      ) : (
        <div className="flex items-center gap-2 text-[var(--color-muted)]">
          <FileText size={12} />
          <span className="max-w-[120px] truncate">{file.name}</span>
        </div>
      )}
      {onRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="p-0.5 hover:bg-black/5 rounded text-[var(--color-muted)] hover:text-red-500 ml-1"
        >
          <Trash2 size={12} />
        </button>
      )}
    </div>
  );
};

interface TaskRowProps {
  id: string; // Changed from Id<"tasks"> to string for local support
  title: string;
  description?: string;
  checklist?: { text: string; completed: boolean }[];
  attachments?: Attachment[];
  completed: boolean;
  ownerId: Id<"users">;
  assigneeId?: Id<"users">;
  categoryId?: Id<"categories">;
  dueDate?: string;
  recurrence?: RecurrenceRule | null;

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
  id, title: initialTitle, description: initialDescription, checklist: initialChecklist, attachments: initialAttachments, completed,
  ownerId, assigneeId, categoryId, dueDate, recurrence: initialRecurrence,
  onToggle, isToday, isPrivate, isRecurring, recurrenceStrategy,
  onSaveLocal, onRemoveLocal,
  isExpanded: controlledIsExpanded,
  onToggleExpand
}: TaskRowProps) {
  const [localTitle, setLocalTitle] = useState(initialTitle);
  const [localDescription, setLocalDescription] = useState(initialDescription || "");
  const [localChecklist, setLocalChecklist] = useState<{text: string, completed: boolean}[]>(initialChecklist || []);
  const [localAttachments, setLocalAttachments] = useState<Attachment[]>(initialAttachments || []);
  const [previewImage, setPreviewImage] = useState<{file: Attachment, index: number} | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [localDueDate, setLocalDueDate] = useState(dueDate);
  const [localRecurrence, setLocalRecurrence] = useState<RecurrenceRule | null>(initialRecurrence || null);
  const [localAssigneeId, setLocalAssigneeId] = useState(assigneeId);
  const [localCategoryId, setLocalCategoryId] = useState(categoryId);
  const [localIsPrivate, setLocalIsPrivate] = useState(isPrivate);
  const [internalIsExpanded, setInternalIsExpanded] = useState(false);

  const [showRecurrenceModal, setShowRecurrenceModal] = useState(false);
  const pendingUpdatesRef = useRef<any>(null);

  const checklistRefs = useRef<(HTMLInputElement | null)[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const updateTask = useMutation(api.tasks.updateTask);
  const deleteTask = useMutation(api.tasks.deleteTask);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
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
      setLocalChecklist(initialChecklist || []);
      setLocalAttachments(initialAttachments || []);
      setLocalDueDate(dueDate);
      setLocalRecurrence(initialRecurrence || null);
      setLocalAssigneeId(assigneeId);
      setLocalCategoryId(categoryId);
      setLocalIsPrivate(isPrivate);
    }
  }, [initialTitle, initialDescription, initialChecklist, initialAttachments, dueDate, initialRecurrence, assigneeId, categoryId, isPrivate, isExpanded]);

  const handleUpdate = async (updates: any) => {
    try {
      await updateTask({ id: id as Id<"tasks">, ...updates });
    } catch (error) {
      console.error("Failed to update task:", error);
    }
  };

  const handleSelectDate = (date: Date | null) => {
    if (date) {
      setLocalDueDate(toDateKey(date));
    } else {
      setLocalDueDate(undefined);
    }
  };

  const handleSave = async () => {
    const finalChecklist = localChecklist.filter(item => item.text.trim() !== "");
    const updates = {
      title: localTitle,
      description: localDescription,
      checklist: finalChecklist.length > 0 ? finalChecklist : undefined,
      attachments: localAttachments.length > 0 ? localAttachments : undefined,
      dueDate: (localDueDate && localDueDate !== "") ? localDueDate : null,
      recurrence: localRecurrence ?? null,
      assigneeId: localAssigneeId ?? null,
      categoryId: localCategoryId ?? null,
      isPrivate: localIsPrivate
    };

    const initialChecklistFiltered = (initialChecklist || []).filter(item => item.text.trim() !== "");
    const checklistChanged = JSON.stringify(finalChecklist) !== JSON.stringify(initialChecklistFiltered);
    const attachmentsChanged = JSON.stringify(localAttachments) !== JSON.stringify(initialAttachments || []);
    const recurrenceChanged = JSON.stringify(localRecurrence) !== JSON.stringify(initialRecurrence || null);

    const hasChanges = 
      localTitle !== initialTitle || 
      localDescription !== (initialDescription || "") || 
      checklistChanged ||
      attachmentsChanged ||
      localDueDate !== dueDate || 
      recurrenceChanged ||
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const postUrl = await generateUploadUrl();
      const result = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      const { storageId } = await result.json();
      
      setLocalAttachments(prev => [...prev, {
        storageId,
        name: file.name,
        type: file.type,
      }]);
    } catch (error) {
      console.error("Upload failed:", error);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeAttachment = (index: number) => {
    setLocalAttachments(prev => prev.filter((_, i) => i !== index));
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

  const handleDelete = async () => {
    try {
      if (onRemoveLocal) {
        onRemoveLocal();
      } else {
        await deleteTask({ id: id as Id<"tasks"> });
      }
      setShowDeleteConfirm(false);
    } catch (error) {
      console.error("Failed to delete task:", error);
    }
  };

  // Use a ref to keep the latest handleSave available to the click-outside listener
  // without having to re-bind the event listener on every keystroke.
  const saveRef = useRef(handleSave);
  useEffect(() => {
    saveRef.current = handleSave;
  }, [handleSave]);

  useEffect(() => {
    if (isExpanded) {
      // Small delay for motion layout to settle
      const timer = setTimeout(() => {
        titleRef.current?.focus();
        // Move cursor to end of text
        if (titleRef.current) {
          const length = titleRef.current.value.length;
          titleRef.current.setSelectionRange(length, length);
        }
        // Scroll into view if it was expanded via props (e.g. from search)
        if (controlledIsExpanded) {
          containerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isExpanded, controlledIsExpanded]);

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

  const handleChecklistKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const newChecklist = [...localChecklist];
      newChecklist.splice(index + 1, 0, { text: '', completed: false });
      setLocalChecklist(newChecklist);
      setTimeout(() => checklistRefs.current[index + 1]?.focus(), 0);
    } else if (e.key === 'Backspace' && localChecklist[index].text === '') {
      e.preventDefault();
      const newChecklist = [...localChecklist];
      newChecklist.splice(index, 1);
      setLocalChecklist(newChecklist);
      if (index > 0) {
        setTimeout(() => checklistRefs.current[index - 1]?.focus(), 0);
      }
    }
  };

  const startChecklist = () => {
    if (localChecklist.length === 0 || localChecklist[localChecklist.length - 1].text.trim() !== '') {
      setLocalChecklist([...localChecklist, { text: '', completed: false }]);
      setTimeout(() => checklistRefs.current[localChecklist.length]?.focus(), 0);
    } else {
      checklistRefs.current[localChecklist.length - 1]?.focus();
    }
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

                {(initialAttachments && initialAttachments.length > 0) && (
                  <Paperclip size={14} className="text-[var(--color-muted)]/50 shrink-0" />
                )}

                <div className="">
                  {isFamilyPool ? (
                    <div className="w-5 h-5 rounded-full flex items-center justify-center bg-[var(--color-surface-soft)] border border-[var(--color-hairline)] text-[var(--color-muted)] shrink-0 aspect-square overflow-hidden">
                      <Users size={12} />
                    </div>
                  ) : assignee && (
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white shadow-sm shrink-0 aspect-square overflow-hidden"
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

                  {localChecklist.length > 0 && (
                    <div className="flex flex-col gap-1.5 mt-2 mb-2">
                      {localChecklist.map((item, i) => (
                        <div key={i} className="flex items-center gap-2 group">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const newChecklist = [...localChecklist];
                              newChecklist[i].completed = !newChecklist[i].completed;
                              setLocalChecklist(newChecklist);
                            }}
                            className={`flex-shrink-0 flex items-center justify-center rounded border transition-colors w-4 h-4 ${
                              item.completed 
                                ? 'bg-[var(--color-primary)] border-[var(--color-primary)]' 
                                : 'border-[#c7c7cc] hover:bg-[var(--color-primary)]/10'
                            }`}
                          >
                            {item.completed && <Check size={10} className="text-white" strokeWidth={3} />}
                          </button>
                          <input
                            ref={(el) => { checklistRefs.current[i] = el; }}
                            type="text"
                            value={item.text}
                            onChange={(e) => {
                              const newChecklist = [...localChecklist];
                              newChecklist[i].text = e.target.value;
                              setLocalChecklist(newChecklist);
                            }}
                            onKeyDown={(e) => handleChecklistKeyDown(e, i)}
                            placeholder="New Item"
                            className={`flex-1 text-[14px] outline-none bg-transparent ${
                              item.completed ? 'text-[var(--color-muted)] line-through' : 'text-[var(--color-ink)]'
                            }`}
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const newChecklist = [...localChecklist];
                              newChecklist.splice(i, 1);
                              setLocalChecklist(newChecklist);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 text-[var(--color-muted)] hover:text-red-500 transition-opacity"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {localAttachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-4 mb-2">
                      {localAttachments.map((file, i) => (
                        <AttachmentItem 
                          key={i} 
                          file={file} 
                          onRemove={() => removeAttachment(i)} 
                          onOpen={() => setPreviewImage({ file, index: i })}
                        />
                      ))}
                      {isUploading && (
                        <div className="flex items-center gap-2 px-2 py-1 bg-[var(--color-surface-soft)] border border-dashed border-[var(--color-hairline)] rounded-lg text-xs italic text-[var(--color-muted)]">
                          <div className="w-3 h-3 border-2 border-[var(--color-muted)]/30 border-t-[var(--color-muted)] rounded-full animate-spin" />
                          Uploading...
                        </div>
                      )}
                    </div>
                  )}

                  <ImagePreviewModal 
                    file={previewImage?.file || null}
                    isOpen={!!previewImage}
                    onClose={() => setPreviewImage(null)}
                    onRemove={() => {
                      if (previewImage) {
                        removeAttachment(previewImage.index);
                        setPreviewImage(null);
                      }
                    }}
                  />
                </div>
              </div>

              {/* Close button */}
              <div className="shrink-0 flex items-center gap-3 self-start mt-0.5">
                <button type="button" onClick={(e) => { e.stopPropagation(); handleSave(); }} className="p-1 hover:bg-black/5 rounded-full transition-colors"><X size={20} className="text-[var(--color-muted)]" /></button>
              </div>
            </div>

            {/* Metadata Row */}
            <div className="flex items-center justify-between mt-4">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(true); }}
                className="flex items-center justify-center w-8 h-8 rounded-full border border-[var(--color-hairline)] text-[var(--color-muted)] hover:border-[var(--color-muted)] transition-colors"
                title="Delete Task"
              >
                <Trash2 size={14} />
              </button>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                    disabled={isUploading}
                    className={`flex items-center justify-center w-8 h-8 rounded-full border transition-colors ${localAttachments.length > 0 ? 'bg-[var(--color-primary)]/10 border-[var(--color-primary)] text-[var(--color-primary)]' : 'border-[var(--color-hairline)] text-[var(--color-muted)] hover:border-[var(--color-muted)]'}`}
                    title="Attach File"
                  >
                    {isUploading ? (
                      <div className="w-3 h-3 border-2 border-[var(--color-primary)]/30 border-t-[var(--color-primary)] rounded-full animate-spin" />
                    ) : (
                      <Paperclip size={14} />
                    )}
                  </button>
                </div>

                <div className="relative">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); startChecklist(); }}
                    className="flex items-center justify-center w-8 h-8 rounded-full border border-[var(--color-hairline)] text-[var(--color-muted)] hover:border-[var(--color-muted)] transition-colors"
                    title="Add Checklist"
                  >
                    <ListTodo size={14} />
                  </button>
                </div>

                <div className="relative">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setShowWhenPicker(!showWhenPicker); }}
                    className={`flex items-center justify-center w-8 h-8 rounded-full border transition-colors ${
                      localRecurrence 
                        ? 'bg-[var(--color-primary)]/10 border-[var(--color-primary)] text-[var(--color-primary)]' 
                        : localDueDate 
                          ? 'bg-[var(--color-yellow)]/10 border-[var(--color-yellow)] text-[#b38f00]' 
                          : 'border-[var(--color-hairline)] text-[var(--color-muted)] hover:border-[var(--color-muted)]'
                    }`}
                    title={formatDateLabel(localDueDate)}
                  >
                    <Calendar size={14} />
                  </button>

                  {localRecurrence && (
                    <div className="absolute -top-1 -right-1 bg-[var(--color-primary)] text-white rounded-full p-0.5 border border-white pointer-events-none shadow-sm">
                      <Repeat size={8} strokeWidth={3} />
                    </div>
                  )}
                  
                  <DatePicker
                    isOpen={showWhenPicker}
                    onClose={() => setShowWhenPicker(false)}
                    value={localDueDate || ""}
                    onChange={setLocalDueDate}
                    recurrence={localRecurrence}
                    onRecurrenceChange={setLocalRecurrence}
                  />
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
                      <button key={m._id} onClick={() => { setLocalAssigneeId(m._id); setShowWhoPicker(false); }} className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-black/5 rounded-lg transition-colors text-left">
                        <div className="flex items-center gap-2 overflow-hidden"><div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 aspect-square overflow-hidden" style={{ backgroundColor: m.colorCode || 'var(--color-primary)' }}>{m.initials || m.name[0]}</div><span className="truncate">{m.name}</span></div>
                        {localAssigneeId === m._id && <Check size={14} className="text-[var(--color-primary)] shrink-0" />}
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

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="flex items-center justify-between pt-5 mt-6 border-t border-[var(--color-hairline)] pb-1"
            >
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleSelectDate(new Date()); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--color-yellow)]/10 hover:bg-[var(--color-yellow)]/20 border border-[var(--color-yellow)]/20 rounded-full transition-all text-[var(--color-yellow)]"
                >
                  <Calendar size={14} />
                  <span className="text-xs font-bold">Today</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const tomorrow = new Date();
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    handleSelectDate(tomorrow);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--color-primary)]/10 hover:bg-[var(--color-primary)]/20 border border-[var(--color-primary)]/20 rounded-full transition-all text-[var(--color-primary)]"
                >
                  <ChevronRight size={14} />
                  <span className="text-xs font-bold">Tomorrow</span>
                </button>
              </div>

              <div className="flex items-center gap-3">
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

      <Modal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)}>
        <div className="bg-white rounded-2xl p-6 shadow-xl border border-[var(--color-hairline)] max-w-sm mx-auto">
          <h3 className="text-lg font-bold mb-2">Delete Task?</h3>
          <p className="text-[var(--color-muted)] text-sm mb-6">Are you sure you want to delete this task? This action cannot be undone.</p>
          <div className="flex gap-3">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="flex-1 px-4 py-2 rounded-xl border border-[var(--color-hairline)] text-sm font-semibold hover:bg-black/5 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              className="flex-1 px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
