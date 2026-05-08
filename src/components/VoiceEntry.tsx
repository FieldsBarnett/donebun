import {
  useState,
  useRef,
  useCallback,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import {
  Mic,
  MicOff,
  X,
  Layers,
  Scissors,
  Check,
  Loader2,
} from "lucide-react";
import Modal from "./Modal";
import { TaskRow } from "./TaskRow";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ParsedTask {
  id: string;
  title: string;
  description: string | null;
  assigneeId: string | null;
  dueDate: string | null;
  categoryId: string | null;
}

export interface VoiceEntryHandle {
  startRecording: () => void;
  stopRecording: () => void;
  cancelRecording: () => void;
  isRecording: boolean;
}

interface VoiceEntryProps {
  isOpen: boolean;
  onClose: () => void;
  onRecordingChange: (recording: boolean) => void;
}

type FamilyMember = {
  _id: string;
  name: string;
  colorCode?: string;
  initials?: string;
};

type Category = {
  _id: string;
  name: string;
  icon?: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2);
}

function toConvexAssigneeId(assigneeId: string | null, familyId: string | null): Id<"users"> | undefined {
  if (!assigneeId || assigneeId === familyId) return undefined;
  return assigneeId as Id<"users">;
}



// ─── Review Modal ─────────────────────────────────────────────────────────────

function ReviewModal({
  isOpen,
  initialTasks,
  onClose,
  onSave,
  onConsolidate,
  onSplit,
  currentUserId,
  isProcessing,
}: {
  isOpen: boolean;
  initialTasks: ParsedTask[];
  onClose: () => void;
  onSave: (tasks: ParsedTask[]) => void;
  onConsolidate: (tasks: ParsedTask[], onDone: (t: ParsedTask[]) => void) => void;
  onSplit: (task: ParsedTask, onDone: (t: ParsedTask[]) => void) => void;
  currentUserId: string | null;
  isProcessing: boolean;
}) {
  const [tasks, setTasks] = useState<ParsedTask[]>(initialTasks);
  const [expandedId, setExpandedId] = useState<string | null>(
    initialTasks.length === 1 ? initialTasks[0].id : null
  );

  // Sync local state if initialTasks changes from parent
  useEffect(() => {
    setTasks(initialTasks);
    if (initialTasks.length === 1) {
      setExpandedId(initialTasks[0].id);
    }
  }, [initialTasks]);

  const updateTask = (id: string, patch: Partial<ParsedTask>) =>
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  const removeTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  const handleConsolidate = () => {
    onConsolidate(tasks, (result) => {
      // Parent will update initialTasks, but we update local state too for immediate feedback
      setTasks(result);
      setExpandedId(result.length === 1 ? result[0].id : null);
    });
  };

  const handleSplit = () => {
    const task = tasks.find((t) => t.id === expandedId);
    if (!task) return;
    onSplit(task, (result) => {
      const newTasks = tasks.reduce((acc, t) => {
        if (t.id === expandedId) return [...acc, ...result];
        return [...acc, t];
      }, [] as ParsedTask[]);
      setTasks(newTasks);
      setExpandedId(null);
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} zIndex={100}>
      <div className="bg-white rounded-2xl shadow-2xl border border-[var(--color-hairline)] flex flex-col max-h-[90vh] overflow-hidden">
        <div className="p-5 flex flex-col h-full overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6 shrink-0">
            <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center text-white">
              <Mic size={14} />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium text-[var(--color-muted)]">Voice Tasks</span>
              {tasks.length > 0 && (
                <span className="ml-2 text-[10px] font-bold bg-[var(--color-surface-soft)] text-[var(--color-muted)] px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                  {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-black/5 rounded-full transition-colors"
            >
              <X size={18} className="text-[var(--color-muted)]" />
            </button>
          </div>

          {/* Task List */}
          <div className="flex-1 overflow-y-auto -mx-5 px-5 space-y-px">
            {tasks.length === 0 ? (
              <p className="text-center py-12 text-[var(--color-muted)] text-sm">
                No tasks to review.
              </p>
            ) : (
              tasks.map((task) => (
                <TaskRow
                  key={task.id}
                  id={task.id}
                  title={task.title}
                  description={task.description ?? undefined}
                  completed={false}
                  ownerId={currentUserId as Id<"users">}
                  assigneeId={task.assigneeId ? (task.assigneeId as Id<"users">) : undefined}
                  categoryId={task.categoryId ? (task.categoryId as Id<"categories">) : undefined}
                  dueDate={task.dueDate ?? undefined}
                  isPrivate={false}
                  isRecurring={false} // Voice entry tasks are newly created, not recurring yet
                  onToggle={() => {}}
                  onSaveLocal={(updates) => updateTask(task.id, updates)}
                  onRemoveLocal={() => removeTask(task.id)}
                  isExpanded={expandedId === task.id}
                  onToggleExpand={() => setExpandedId(prev => prev === task.id ? null : task.id)}
                />
              ))
            )}
          </div>

          {/* AI Actions */}
          {tasks.length > 0 && (
            <div className="mt-4 pt-4 border-t border-[var(--color-hairline)] shrink-0">
              <div className="flex gap-2">
                <button
                  onClick={handleConsolidate}
                  disabled={isProcessing || tasks.length < 2}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--color-hairline)] text-xs font-semibold hover:bg-[var(--color-primary)]/5 hover:border-[var(--color-primary)] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  {isProcessing ? <Loader2 size={13} className="animate-spin" /> : <Layers size={13} />}
                  Consolidate
                </button>
                <button
                  onClick={handleSplit}
                  disabled={isProcessing || !expandedId}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--color-hairline)] text-xs font-semibold hover:bg-[var(--color-primary)]/5 hover:border-[var(--color-primary)] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  {isProcessing ? <Loader2 size={13} className="animate-spin" /> : <Scissors size={13} />}
                  Split Out
                </button>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="mt-4 flex items-center justify-end shrink-0 pt-4 border-t border-[var(--color-hairline)]">
            <button
              onClick={() => onSave(tasks)}
              disabled={tasks.length === 0 || isProcessing}
              className="bg-[var(--color-primary)] text-white px-8 py-2.5 rounded-full text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#006ee6] active:scale-95 transition-all shadow-md shadow-blue-500/20 flex items-center gap-2"
            >
              {isProcessing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Check size={18} />
                  Save {tasks.length > 0 ? `${tasks.length} Task${tasks.length !== 1 ? 's' : ''}` : 'Tasks'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ─── Main VoiceEntry Component ────────────────────────────────────────────────

const VoiceEntry = forwardRef<VoiceEntryHandle, VoiceEntryProps>(function VoiceEntry(
  { isOpen, onClose, onRecordingChange },
  ref
) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [parsedTasks, setParsedTasks] = useState<ParsedTask[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const isCancellingRef = useRef(false);

  const extractTasks = useAction(api.voiceActions.extractTasksFromAudio);
  const consolidateFn = useAction(api.voiceActions.consolidateTasks);
  const splitFn = useAction(api.voiceActions.splitTask);
  const createTask = useMutation(api.tasks.createTask);

  const currentUser = useQuery(api.users.getCurrentUser);
  const rawMembers = useQuery(api.users.getMyFamilyMembers) ?? [];
  const rawCategories = useQuery(api.categories.list) ?? [];
  const familyMembers: FamilyMember[] = rawMembers.map((m) => ({
    _id: m._id,
    name: m.name,
    colorCode: m.colorCode,
    initials: m.initials,
  }));
  const categories: Category[] = rawCategories.map((c) => ({
    _id: c._id,
    name: c.name,
    icon: c.icon,
  }));
  const familyId = currentUser?.familyId ?? null;

  const setRecording = useCallback(
    (val: boolean) => {
      setIsRecording(val);
      onRecordingChange(val);
    },
    [onRecordingChange]
  );

  // Clean up when closed
  useEffect(() => {
    if (!isOpen) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        // Clear onstop FIRST so stopping here doesn't re-trigger processAudio
        mediaRecorderRef.current.onstop = null;
        mediaRecorderRef.current.stop();
      }
      mediaRecorderRef.current = null;
      chunksRef.current = [];
      setParsedTasks(null);
      setError(null);
      setRecording(false);
      isCancellingRef.current = false;
    }
  }, [isOpen, setRecording]);

  // ── Recording ───────────────────────────────────────────────────────────────

  const startRecording = useCallback(async () => {
    if (isRecording) return;
    try {
      setError(null);
      isCancellingRef.current = false;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (!isCancellingRef.current) {
          processAudio(mr.mimeType);
        }
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
    } catch {
      setError("Microphone access denied. Please allow microphone permissions.");
    }
  }, [isRecording, setRecording]); // eslint-disable-line react-hooks/exhaustive-deps

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
    setRecording(false);
  }, [setRecording]);

  const cancelRecording = useCallback(() => {
    isCancellingRef.current = true;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
    setRecording(false);
    onClose();
  }, [setRecording, onClose]);

  // Expose handle to parent
  useImperativeHandle(ref, () => ({
    startRecording,
    stopRecording,
    cancelRecording,
    get isRecording() { return isRecording; },
  }), [startRecording, stopRecording, cancelRecording, isRecording]);

  // ── Process Audio ───────────────────────────────────────────────────────────

  const processAudio = async (mimeType: string) => {
    if (chunksRef.current.length === 0) return;
    setIsTranscribing(true);
    try {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const arrayBuffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const base64 = btoa(binary);

      const members = familyMembers.map((m) => ({ id: m._id, name: m.name }));
      const cats = categories.map((c) => ({ id: c._id, name: c.name }));
      const result = await extractTasks({
        audioBase64: base64,
        mimeType: mimeType || "audio/webm",
        familyMembers: members,
        familyId: familyId ?? "",
        familyName: currentUser?.name ? `${currentUser.name}'s Family` : "Family",
        currentUserId: currentUser?._id ?? "",
        currentUserName: currentUser?.name ?? "Me",
        categories: cats,
        today: new Date().toISOString().slice(0, 10),
      });

      setParsedTasks(result.map((t) => {
        let dueDate: string | null = null;
        if (t.date) {
          dueDate = t.time ? `${t.date}T${t.time}:00` : t.date;
        }
        return {
          id: uid(),
          title: t.title,
          description: t.details,
          assigneeId: t.assigneeId ?? null,
          dueDate,
          categoryId: t.categoryId ?? null,
        };
      }));
    } catch (err: unknown) {
      setError(`Failed to extract tasks: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setIsTranscribing(false);
    }
  };

  // ── Save Tasks ──────────────────────────────────────────────────────────────

  const handleSave = async (tasksToSave: ParsedTask[]) => {
    try {
      await Promise.all(
        tasksToSave.map((t) => {
          return createTask({
            title: t.title,
            description: t.description ?? undefined,
            isPrivate: false,
            assigneeId: toConvexAssigneeId(t.assigneeId, familyId),
            categoryId: t.categoryId ? (t.categoryId as Id<"categories">) : undefined,
            dueDate: t.dueDate ?? undefined,
          });
        })
      );
      setParsedTasks(null);
      onClose();
    } catch (err: unknown) {
      setError(`Failed to save: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  // ── AI: Consolidate ─────────────────────────────────────────────────────────

  const handleConsolidate = async (tasks: ParsedTask[], onDone: (t: ParsedTask[]) => void) => {
    setIsAiProcessing(true);
    try {
      const members = familyMembers.map((m) => ({ id: m._id, name: m.name }));
      const cats = categories.map((c) => ({ id: c._id, name: c.name }));
      const result = await consolidateFn({
        tasks: tasks.map((t) => ({
          title: t.title,
          details: t.description ?? undefined,
          assigneeId: t.assigneeId ?? undefined,
          date: t.dueDate?.split('T')[0] ?? undefined,
          time: t.dueDate?.includes('T') ? t.dueDate.split('T')[1].slice(0, 5) : undefined,
          categoryId: t.categoryId ?? undefined
        })),
        familyMembers: members,
        familyId: familyId ?? "",
        familyName: currentUser?.name ? `${currentUser.name}'s Family` : "Family",
        currentUserId: currentUser?._id ?? "",
        currentUserName: currentUser?.name ?? "Me",
        categories: cats,
        today: new Date().toISOString().slice(0, 10),
      });
      onDone(result.map((t) => {
        let dueDate: string | null = null;
        if (t.date) {
          dueDate = t.time ? `${t.date}T${t.time}:00` : t.date;
        }
        return {
          id: uid(),
          title: t.title,
          description: t.details,
          assigneeId: t.assigneeId ?? null,
          dueDate,
          categoryId: t.categoryId ?? null,
        };
      }));
    } catch (err: unknown) {
      setError(`Consolidate failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setIsAiProcessing(false);
    }
  };

  // ── AI: Split ───────────────────────────────────────────────────────────────

  const handleSplit = async (task: ParsedTask, onDone: (t: ParsedTask[]) => void) => {
    setIsAiProcessing(true);
    try {
      const members = familyMembers.map((m) => ({ id: m._id, name: m.name }));
      const cats = categories.map((c) => ({ id: c._id, name: c.name }));
      const result = await splitFn({
        task: {
          title: task.title,
          details: task.description ?? undefined,
          assigneeId: task.assigneeId ?? undefined,
          date: task.dueDate?.split('T')[0] ?? undefined,
          time: task.dueDate?.includes('T') ? task.dueDate.split('T')[1].slice(0, 5) : undefined,
          categoryId: task.categoryId ?? undefined
        },
        familyMembers: members,
        familyId: familyId ?? "",
        familyName: currentUser?.name ? `${currentUser.name}'s Family` : "Family",
        currentUserId: currentUser?._id ?? "",
        currentUserName: currentUser?.name ?? "Me",
        categories: cats,
        today: new Date().toISOString().slice(0, 10),
      });
      onDone(result.map((t) => {
        let dueDate: string | null = null;
        if (t.date) {
          dueDate = t.time ? `${t.date}T${t.time}:00` : t.date;
        }
        return {
          id: uid(),
          title: t.title,
          description: t.details,
          assigneeId: t.assigneeId ?? null,
          dueDate,
          categoryId: t.categoryId ?? null,
        };
      }));
    } catch (err: unknown) {
      setError(`Split failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setIsAiProcessing(false);
    }
  };

  return (
    <>
      {/* Transcribing overlay */}
      <Modal isOpen={isTranscribing} onClose={() => {}} zIndex={200}>
        <div className="bg-white rounded-2xl shadow-2xl border border-[var(--color-hairline)] p-8 flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center">
            <Loader2 size={24} className="text-[var(--color-primary)] animate-spin" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-[var(--color-ink)]">Extracting tasks…</p>
            <p className="text-xs text-[var(--color-muted)]">Gemini is analyzing your voice note</p>
          </div>
        </div>
      </Modal>

      {/* Error overlay */}
      <Modal isOpen={!!error} onClose={() => { setError(null); onClose(); }} zIndex={200}>
        <div
          className="bg-white rounded-2xl shadow-2xl border border-[var(--color-hairline)] p-8 flex flex-col items-center gap-5"
        >
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
            <MicOff size={28} className="text-red-500" />
          </div>
          <div className="text-center">
            <p className="text-base font-bold text-[var(--color-ink)] mb-1">Something went wrong</p>
            <p className="text-sm text-[var(--color-muted)] leading-relaxed px-4">{error}</p>
          </div>
          <button
            onClick={() => { setError(null); onClose(); }}
            className="w-full py-3 bg-[var(--color-ink)] text-white rounded-xl text-sm font-bold hover:bg-black transition-colors"
          >
            Dismiss
          </button>
        </div>
      </Modal>

      {/* Review modal */}
      {parsedTasks && (
        <ReviewModal
          isOpen={!!parsedTasks}
          initialTasks={parsedTasks}
          onClose={() => { setParsedTasks(null); onClose(); }}
          onSave={handleSave}
          onConsolidate={handleConsolidate}
          onSplit={handleSplit}
          currentUserId={currentUser?._id ?? null}
          isProcessing={isAiProcessing}
        />
      )}
    </>
  );
});

export default VoiceEntry;
