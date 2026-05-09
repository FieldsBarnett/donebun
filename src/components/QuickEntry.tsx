import { useState, useEffect, useRef, useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { X, Calendar, ChevronRight, Check, User, Users, Eye, EyeOff, ListTodo, Paperclip, FileText, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { parseDueDate, isSameDay, toDateKey } from "../lib/dateUtils";
import CategorySelector from "./CategorySelector";
import Modal from "./Modal";
import ImagePreviewModal from "./ImagePreviewModal";
import DatePicker from "./DatePicker";
import { RecurrenceRule } from "./RecurrencePickerModal";
import PickerWrapper from "./PickerWrapper";

interface QuickEntryProps {
  isOpen: boolean;
  onClose: () => void;
}

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

export default function QuickEntry({ isOpen, onClose }: QuickEntryProps) {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [checklist, setChecklist] = useState<{text: string, completed: boolean}[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [previewImage, setPreviewImage] = useState<{file: Attachment, index: number} | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [dueDate, setDueDate] = useState<string>(""); // ISO string or YYYY-MM-DD
  const [recurrence, setRecurrence] = useState<RecurrenceRule | null>(null);
  const [categoryId, setCategoryId] = useState<Id<"categories"> | "">("");
  const [assigneeId, setAssigneeId] = useState<Id<"users"> | "family" | "">("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAssigneePicker, setShowAssigneePicker] = useState(false);
  const [showWhenPicker, setShowWhenPicker] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const checklistRefs = useRef<(HTMLInputElement | null)[]>([]);
  const createTask = useMutation(api.tasks.createTask);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const currentUser = useQuery(api.users.getCurrentUser);
  const familyMembers = useQuery(api.users.getMyFamilyMembers) || [];

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
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
      const finalChecklist = checklist.filter(item => item.text.trim() !== "");
      await createTask({
        title: title.trim(),
        description: description.trim() || undefined,
        isPrivate: isPrivate,
        dueDate: dueDate || undefined,
        recurrence: recurrence || undefined,
        categoryId: categoryId || undefined,
        assigneeId: (assigneeId && assigneeId !== "family") ? assigneeId as Id<"users"> : undefined,
        checklist: finalChecklist.length > 0 ? finalChecklist : undefined,
        attachments: attachments.length > 0 ? attachments : undefined,
      });
      setTitle("");
      setDescription("");
      setDueDate("");
      setRecurrence(null);
      setCategoryId("");
      setChecklist([]);
      setAttachments([]);
      setIsPrivate(false);
      // Reset assignee to current user for next time
      if (currentUser) setAssigneeId(currentUser._id);
      onClose();

      // Navigate to the appropriate view
      if (dueDate) {
        const dateKey = toDateKey(parseDueDate(dueDate));
        navigate(`/timeline?date=${dateKey}`);
      } else {
        navigate("/unscheduled");
      }
    } catch (error) {
      console.error("Failed to create task:", error);
    } finally {
      setIsSubmitting(false);
    }
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
      
      setAttachments(prev => [...prev, {
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
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleChecklistKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const newChecklist = [...checklist];
      newChecklist.splice(index + 1, 0, { text: '', completed: false });
      setChecklist(newChecklist);
      setTimeout(() => checklistRefs.current[index + 1]?.focus(), 0);
    } else if (e.key === 'Backspace' && checklist[index].text === '') {
      e.preventDefault();
      const newChecklist = [...checklist];
      newChecklist.splice(index, 1);
      setChecklist(newChecklist);
      if (index > 0) {
        setTimeout(() => checklistRefs.current[index - 1]?.focus(), 0);
      }
    }
  };

  const startChecklist = () => {
    if (checklist.length === 0 || checklist[checklist.length - 1].text.trim() !== '') {
      setChecklist([...checklist, { text: '', completed: false }]);
      setTimeout(() => checklistRefs.current[checklist.length]?.focus(), 0);
    } else {
      checklistRefs.current[checklist.length - 1]?.focus();
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

  const handleQuickSelectDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    setDueDate(`${year}-${month}-${day}`);
  };

  const isInFamily = currentUser?.familyId !== undefined;
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
              autoFocus
              enterKeyHint="done"
              className="w-full text-2xl font-bold outline-none placeholder-[var(--color-muted)]/40 bg-transparent"
            />
          </div>

          <textarea
            placeholder="Add details, links, or notes..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full min-h-[80px] text-[15px] text-[var(--color-ink)] outline-none placeholder-[var(--color-muted)]/40 resize-none bg-transparent leading-relaxed"
          />

          {checklist.length > 0 && (
            <div className="flex flex-col gap-1.5 mt-2 mb-4">
              {checklist.map((item, i) => (
                <div key={i} className="flex items-center gap-2 group">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const newChecklist = [...checklist];
                      newChecklist[i].completed = !newChecklist[i].completed;
                      setChecklist(newChecklist);
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
                      const newChecklist = [...checklist];
                      newChecklist[i].text = e.target.value;
                      setChecklist(newChecklist);
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
                      const newChecklist = [...checklist];
                      newChecklist.splice(i, 1);
                      setChecklist(newChecklist);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-[var(--color-muted)] hover:text-red-500 transition-opacity"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {attachments.map((file, i) => (
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

          <div className="flex flex-wrap items-center justify-end gap-2 mb-6">
            <div className="relative">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileUpload}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className={`flex items-center justify-center w-8 h-8 rounded-full border transition-colors ${attachments.length > 0 ? 'bg-[var(--color-primary)]/10 border-[var(--color-primary)] text-[var(--color-primary)]' : 'border-[var(--color-hairline)] text-[var(--color-muted)] hover:border-[var(--color-muted)]'}`}
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

            {/* When Picker Button */}
            <div className="relative">
              <button
                onClick={() => setShowWhenPicker(!showWhenPicker)}
                className={`flex items-center justify-center w-8 h-8 rounded-full border transition-colors ${dueDate ? 'bg-[var(--color-yellow)]/10 border-[var(--color-yellow)] text-[#b38f00]' : 'border-[var(--color-hairline)] text-[var(--color-muted)] hover:border-[var(--color-muted)]'}`}
                title={formatDateLabel(dueDate)}
              >
                <Calendar size={14} />
              </button>

              <DatePicker
                isOpen={showWhenPicker}
                onClose={() => setShowWhenPicker(false)}
                value={dueDate}
                onChange={setDueDate}
                recurrence={recurrence}
                onRecurrenceChange={setRecurrence}
              />
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

          <div className="flex items-center justify-between pt-4 border-t border-[var(--color-hairline)]">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleQuickSelectDate(new Date()); }}
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
                  handleQuickSelectDate(tomorrow);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--color-primary)]/10 hover:bg-[var(--color-primary)]/20 border border-[var(--color-primary)]/20 rounded-full transition-all text-[var(--color-primary)]"
              >
                <ChevronRight size={14} />
                <span className="text-xs font-bold">Tomorrow</span>
              </button>
            </div>
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
