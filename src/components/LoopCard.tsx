import { useState, useMemo, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  ExternalLink,
  Link2,
  StickyNote,
  Check,
  Trash2,
  ArrowUp,
  ArrowDown,
  Hand,
} from "lucide-react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import CloseLoopModal from "./CloseLoopModal";
import { formatLastTouched, staleLabel } from "../lib/loopUtils";
import { LOOP_STATUS_LABELS } from "../lib/loopUtils";

type LoopSummary = {
  _id: Id<"loops">;
  title: string;
  nextStep?: string;
  status: "open" | "stuck-waiting" | "closed";
  emoji?: string;
  color?: string;
  lastTouched: number;
  todoCompleted: number;
  todoTotal: number;
  isStale: boolean;
  staleDays: number;
  description?: string;
  contextLog?: { text: string; createdAt: number }[];
};

function SortableLoopShell({
  id,
  children,
  dragHandle,
}: {
  id: string;
  children: ReactNode;
  dragHandle: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className="relative">
      <div
        className="absolute left-0 top-3 -translate-x-1 hidden sm:flex touch-none cursor-grab active:cursor-grabbing text-[var(--color-muted)]"
        {...attributes}
        {...listeners}
      >
        {dragHandle}
      </div>
      {children}
    </div>
  );
}

function SortableItemRow({
  entryId,
  children,
}: {
  entryId: string;
  children: (props: {
    dragHandleProps: React.HTMLAttributes<HTMLElement>;
    isDragging: boolean;
  }) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: entryId });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div ref={setNodeRef} style={style}>
      {children({
        dragHandleProps: { ...attributes, ...listeners },
        isDragging,
      })}
    </div>
  );
}

export default function LoopCard({
  loop,
  allLoops,
  onMoveLoop,
}: {
  loop: LoopSummary;
  allLoops: LoopSummary[];
  onMoveLoop: (direction: "up" | "down") => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [newLog, setNewLog] = useState("");
  const [newItemTitle, setNewItemTitle] = useState("");
  const [newNote, setNewNote] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [newLinkTitle, setNewLinkTitle] = useState("");
  const [addMode, setAddMode] = useState<"task" | "note" | "link">("task");

  const detail = useQuery(
    api.loops.getLoopDetail,
    expanded ? { loopId: loop._id } : "skip",
  );
  const updateLoop = useMutation(api.loops.updateLoop);
  const touchStill = useMutation(api.loops.touchLoopStillOnIt);
  const addLog = useMutation(api.loops.addContextLogEntry);
  const createTask = useMutation(api.loops.createLoopTask);
  const createItem = useMutation(api.loops.createLoopItem);
  const updateItem = useMutation(api.loops.updateLoopItem);
  const deleteItem = useMutation(api.loops.deleteLoopItem);
  const updateTaskStatus = useMutation(api.tasks.updateTaskStatus);
  const reorderContents = useMutation(api.loops.reorderLoopContents);
  const moveTask = useMutation(api.loops.moveLoopTask);
  const moveLoopKeyboard = useMutation(api.loops.moveLoopByKeyboard);

  const accent =
    loop.color ||
    (loop.status === "stuck-waiting"
      ? "var(--color-yellow)"
      : "var(--color-primary)");

  const itemIds = useMemo(
    () => detail?.items.map((i) => `${i.kind}-${i.id}`) ?? [],
    [detail?.items],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const moveItemByKeyboard = (
    index: number,
    direction: "up" | "down",
  ) => {
    if (!detail) return;
    const swapIdx = direction === "up" ? index - 1 : index + 1;
    if (swapIdx < 0 || swapIdx >= detail.items.length) return;
    const reordered = arrayMove(detail.items, index, swapIdx);
    void reorderContents({
      loopId: loop._id,
      orderedEntries: reordered.map(
        (e: (typeof detail.items)[number]) => ({
          kind: e.kind === "task" ? ("task" as const) : e.kind,
          id: e.id,
        }),
      ),
    });
  };

  const onItemDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !detail) return;
    const oldIndex = itemIds.indexOf(String(active.id));
    const newIndex = itemIds.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(detail.items, oldIndex, newIndex);
    void reorderContents({
      loopId: loop._id,
      orderedEntries: reordered.map(
        (e: (typeof detail.items)[number]) => ({
          kind: e.kind === "task" ? ("task" as const) : e.kind,
          id: e.id,
        }),
      ),
    });
  };

  const handleKeyboardMove = async (direction: "up" | "down") => {
    await moveLoopKeyboard({ loopId: loop._id, direction });
    onMoveLoop(direction);
  };

  return (
    <>
      <SortableLoopShell
        id={loop._id}
        dragHandle={<GripVertical size={18} aria-hidden />}
      >
        <article
          className="sm:ml-6 rounded-2xl border border-[var(--color-hairline)] bg-white shadow-sm overflow-hidden"
          style={{ borderLeftWidth: 4, borderLeftColor: accent }}
        >
          <header className="p-4">
            <div className="flex items-start gap-2">
              <button
                type="button"
                onClick={() => setExpanded((e) => !e)}
                className="flex-1 text-left min-w-0"
                aria-expanded={expanded}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  {loop.emoji && (
                    <span className="text-lg" aria-hidden>
                      {loop.emoji}
                    </span>
                  )}
                  <h4 className="font-semibold text-[17px] truncate">{loop.title}</h4>
                  {loop.status === "stuck-waiting" && (
                    <span className="text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-[var(--color-yellow)]/15 text-[var(--color-yellow)]">
                      Waiting
                    </span>
                  )}
                  {loop.isStale && (
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                      {staleLabel(loop.lastTouched)}
                    </span>
                  )}
                </div>
                {loop.nextStep && (
                  <p className="text-sm text-[var(--color-muted)] mt-1 truncate">
                    Next: {loop.nextStep}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-2 text-xs text-[var(--color-muted)]">
                  <span>
                    {loop.todoTotal > 0
                      ? `${loop.todoCompleted}/${loop.todoTotal} todos`
                      : "No todos yet"}
                  </span>
                  <span>·</span>
                  <span>Touched {formatLastTouched(loop.lastTouched)}</span>
                </div>
              </button>
              <div className="flex flex-col gap-1 shrink-0">
                <button
                  type="button"
                  aria-label="Move loop up"
                  onClick={() => handleKeyboardMove("up")}
                  className="p-1 rounded hover:bg-black/5 text-[var(--color-muted)]"
                >
                  <ArrowUp size={16} />
                </button>
                <button
                  type="button"
                  aria-label="Move loop down"
                  onClick={() => handleKeyboardMove("down")}
                  className="p-1 rounded hover:bg-black/5 text-[var(--color-muted)]"
                >
                  <ArrowDown size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setExpanded((e) => !e)}
                  className="p-1 rounded hover:bg-black/5 text-[var(--color-muted)]"
                  aria-label={expanded ? "Collapse loop" : "Expand loop"}
                >
                  {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              <button
                type="button"
                onClick={() => touchStill({ loopId: loop._id })}
                className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border border-[var(--color-hairline)] hover:bg-[var(--color-surface-soft)]"
              >
                <Hand size={14} /> Still on it
              </button>
            </div>
          </header>

          {expanded && detail && (
            <div className="border-t border-[var(--color-hairline)] p-4 space-y-4 bg-[var(--color-surface-soft)]/40">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm block">
                  <span className="font-medium">Title</span>
                  <input
                    defaultValue={loop.title}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== loop.title) {
                        void updateLoop({ loopId: loop._id, title: v });
                      }
                    }}
                    className="mt-1 w-full rounded-lg border border-[var(--color-hairline)] px-2 py-1.5"
                  />
                </label>
                <label className="text-sm block">
                  <span className="font-medium">Next step</span>
                  <input
                    defaultValue={loop.nextStep ?? ""}
                    placeholder="One line for the card…"
                    onBlur={(e) => {
                      const v = e.target.value;
                      if (v !== (loop.nextStep ?? "")) {
                        void updateLoop({
                          loopId: loop._id,
                          nextStep: v.trim() || null,
                        });
                      }
                    }}
                    className="mt-1 w-full rounded-lg border border-[var(--color-hairline)] px-2 py-1.5"
                  />
                </label>
                <label className="text-sm block">
                  <span className="font-medium">Status</span>
                  <select
                    value={loop.status}
                    onChange={(e) =>
                      updateLoop({
                        loopId: loop._id,
                        status: e.target.value as LoopSummary["status"],
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-[var(--color-hairline)] px-2 py-1.5"
                  >
                    {Object.entries(LOOP_STATUS_LABELS)
                      .filter(([k]) => k !== "closed")
                      .map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="text-sm block">
                  <span className="font-medium">Emoji</span>
                  <input
                    defaultValue={loop.emoji ?? ""}
                    maxLength={4}
                    onBlur={(e) =>
                      updateLoop({
                        loopId: loop._id,
                        emoji: e.target.value.trim() || null,
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-[var(--color-hairline)] px-2 py-1.5"
                  />
                </label>
              </div>

              <label className="text-sm block">
                <span className="font-medium">Description</span>
                <textarea
                  defaultValue={loop.description ?? ""}
                  rows={2}
                  onBlur={(e) =>
                    updateLoop({
                      loopId: loop._id,
                      description: e.target.value.trim() || null,
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-[var(--color-hairline)] px-2 py-1.5"
                />
              </label>

              <div>
                <p className="text-sm font-medium mb-2">Context log</p>
                <ul className="space-y-2 max-h-40 overflow-y-auto mb-2">
                  {(detail.loop.contextLog ?? []).map((entry, i) => (
                    <li
                      key={`${entry.createdAt}-${i}`}
                      className="text-sm bg-white rounded-lg px-3 py-2 border border-[var(--color-hairline)]"
                    >
                      <time className="text-[10px] text-[var(--color-muted)] block mb-0.5">
                        {new Date(entry.createdAt).toLocaleString()}
                      </time>
                      {entry.text}
                    </li>
                  ))}
                </ul>
                <div className="flex gap-2">
                  <input
                    value={newLog}
                    onChange={(e) => setNewLog(e.target.value)}
                    placeholder="Add a thought…"
                    className="flex-1 rounded-lg border border-[var(--color-hairline)] px-2 py-1.5 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newLog.trim()) {
                        void addLog({ loopId: loop._id, text: newLog }).then(() =>
                          setNewLog(""),
                        );
                      }
                    }}
                  />
                  <button
                    type="button"
                    disabled={!newLog.trim()}
                    onClick={() =>
                      addLog({ loopId: loop._id, text: newLog }).then(() =>
                        setNewLog(""),
                      )
                    }
                    className="px-3 py-1.5 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium disabled:opacity-40"
                  >
                    Add
                  </button>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Items</p>
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={onItemDragEnd}
                >
                  <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
                    <ul className="space-y-1">
                      {detail.items.map((entry, itemIndex) => {
                        const entryKey = `${entry.kind}-${entry.id}`;
                        const itemMoveButtons = (
                          <span className="flex flex-col shrink-0">
                            <button
                              type="button"
                              aria-label="Move item up"
                              onClick={() => moveItemByKeyboard(itemIndex, "up")}
                              className="p-0.5 text-[var(--color-muted)] hover:text-[var(--color-ink)]"
                            >
                              <ArrowUp size={12} />
                            </button>
                            <button
                              type="button"
                              aria-label="Move item down"
                              onClick={() => moveItemByKeyboard(itemIndex, "down")}
                              className="p-0.5 text-[var(--color-muted)] hover:text-[var(--color-ink)]"
                            >
                              <ArrowDown size={12} />
                            </button>
                          </span>
                        );
                        return (
                          <SortableItemRow key={entryKey} entryId={entryKey}>
                            {({ dragHandleProps }) =>
                              entry.kind === "task" ? (
                                <li className="flex items-center gap-2 bg-white rounded-lg px-2 py-1.5 border border-[var(--color-hairline)]">
                                  <button
                                    type="button"
                                    className="touch-none cursor-grab text-[var(--color-muted)] p-0.5"
                                    aria-label="Drag to reorder"
                                    {...dragHandleProps}
                                  >
                                    <GripVertical size={14} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateTaskStatus({
                                        id: entry.id,
                                        status:
                                          entry.status === "completed"
                                            ? "active"
                                            : "completed",
                                      })
                                    }
                                    className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${
                                      entry.status === "completed"
                                        ? "bg-[var(--color-primary)] border-[var(--color-primary)] text-white"
                                        : "border-[var(--color-hairline)]"
                                    }`}
                                    aria-label="Toggle todo"
                                  >
                                    {entry.status === "completed" && (
                                      <Check size={12} />
                                    )}
                                  </button>
                                  <span
                                    className={`flex-1 text-sm truncate ${
                                      entry.status === "completed"
                                        ? "line-through text-[var(--color-muted)]"
                                        : ""
                                    }`}
                                  >
                                    {entry.title}
                                  </span>
                                  {itemMoveButtons}
                                  <select
                                    className="text-xs border border-[var(--color-hairline)] rounded px-1 max-w-[88px] truncate"
                                    defaultValue=""
                                    onChange={(e) => {
                                      const v = e.target.value;
                                      if (v === "") return;
                                      if (v === "out") {
                                        void moveTask({
                                          taskId: entry.id as Id<"tasks">,
                                        });
                                      } else {
                                        void moveTask({
                                          taskId: entry.id as Id<"tasks">,
                                          targetLoopId: v as Id<"loops">,
                                        });
                                      }
                                      e.target.value = "";
                                    }}
                                    aria-label="Move todo to another loop"
                                  >
                                    <option value="">Move…</option>
                                    <option value="out">Standalone</option>
                                    {allLoops
                                      .filter((l) => l._id !== loop._id)
                                      .map((l) => (
                                        <option key={l._id} value={l._id}>
                                          {l.title}
                                        </option>
                                      ))}
                                  </select>
                                </li>
                              ) : entry.kind === "note" ? (
                                <li className="flex items-start gap-2 bg-white rounded-lg px-2 py-1.5 border border-[var(--color-hairline)]">
                                  <button
                                    type="button"
                                    className="touch-none cursor-grab text-[var(--color-muted)] p-0.5 mt-0.5"
                                    {...dragHandleProps}
                                  >
                                    <GripVertical size={14} />
                                  </button>
                                  <StickyNote
                                    size={14}
                                    className="text-[var(--color-muted)] mt-1 shrink-0"
                                  />
                                  <input
                                    defaultValue={entry.text ?? ""}
                                    onBlur={(e) =>
                                      updateItem({
                                        itemId: entry.id as Id<"loopItems">,
                                        text: e.target.value,
                                      })
                                    }
                                    className="flex-1 text-sm bg-transparent outline-none"
                                  />
                                  {itemMoveButtons}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      deleteItem({
                                        itemId: entry.id as Id<"loopItems">,
                                      })
                                    }
                                    className="text-[var(--color-muted)] hover:text-red-500 p-0.5"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </li>
                              ) : (
                                <li className="flex items-center gap-2 bg-white rounded-lg px-2 py-1.5 border border-[var(--color-hairline)]">
                                  <button
                                    type="button"
                                    className="touch-none cursor-grab text-[var(--color-muted)] p-0.5"
                                    {...dragHandleProps}
                                  >
                                    <GripVertical size={14} />
                                  </button>
                                  <Link2 size={14} className="text-[var(--color-primary)] shrink-0" />
                                  <a
                                    href={entry.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex-1 text-sm text-[var(--color-primary)] truncate hover:underline"
                                  >
                                    {entry.linkTitle || entry.url}
                                  </a>
                                  <a
                                    href={entry.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[var(--color-muted)]"
                                    aria-label="Open link"
                                  >
                                    <ExternalLink size={14} />
                                  </a>
                                  {itemMoveButtons}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      deleteItem({
                                        itemId: entry.id as Id<"loopItems">,
                                      })
                                    }
                                    className="text-[var(--color-muted)] hover:text-red-500 p-0.5"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </li>
                              )
                            }
                          </SortableItemRow>
                        );
                      })}
                    </ul>
                  </SortableContext>
                </DndContext>

                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  {(["task", "note", "link"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setAddMode(mode)}
                      className={`px-2.5 py-1 rounded-full border ${
                        addMode === mode
                          ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
                          : "border-[var(--color-hairline)]"
                      }`}
                    >
                      {mode === "task" ? "Todo" : mode === "note" ? "Note" : "Link"}
                    </button>
                  ))}
                </div>
                {addMode === "task" && (
                  <div className="flex gap-2 mt-2">
                    <input
                      value={newItemTitle}
                      onChange={(e) => setNewItemTitle(e.target.value)}
                      placeholder="New todo…"
                      className="flex-1 rounded-lg border border-[var(--color-hairline)] px-2 py-1.5 text-sm"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newItemTitle.trim()) {
                          void createTask({
                            loopId: loop._id,
                            title: newItemTitle,
                          }).then(() => setNewItemTitle(""));
                        }
                      }}
                    />
                    <button
                      type="button"
                      disabled={!newItemTitle.trim()}
                      onClick={() =>
                        createTask({
                          loopId: loop._id,
                          title: newItemTitle,
                        }).then(() => setNewItemTitle(""))
                      }
                      className="px-3 py-1.5 rounded-lg bg-[var(--color-primary)] text-white text-sm disabled:opacity-40"
                    >
                      Add
                    </button>
                  </div>
                )}
                {addMode === "note" && (
                  <div className="flex gap-2 mt-2">
                    <input
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      placeholder="Note…"
                      className="flex-1 rounded-lg border border-[var(--color-hairline)] px-2 py-1.5 text-sm"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newNote.trim()) {
                          void createItem({
                            loopId: loop._id,
                            kind: "note",
                            text: newNote,
                          }).then(() => setNewNote(""));
                        }
                      }}
                    />
                    <button
                      type="button"
                      disabled={!newNote.trim()}
                      onClick={() =>
                        createItem({
                          loopId: loop._id,
                          kind: "note",
                          text: newNote,
                        }).then(() => setNewNote(""))
                      }
                      className="px-3 py-1.5 rounded-lg bg-[var(--color-primary)] text-white text-sm disabled:opacity-40"
                    >
                      Add
                    </button>
                  </div>
                )}
                {addMode === "link" && (
                  <div className="flex flex-col sm:flex-row gap-2 mt-2">
                    <input
                      value={newLinkUrl}
                      onChange={(e) => setNewLinkUrl(e.target.value)}
                      placeholder="https://…"
                      className="flex-1 rounded-lg border border-[var(--color-hairline)] px-2 py-1.5 text-sm"
                    />
                    <input
                      value={newLinkTitle}
                      onChange={(e) => setNewLinkTitle(e.target.value)}
                      placeholder="Label (optional)"
                      className="sm:w-40 rounded-lg border border-[var(--color-hairline)] px-2 py-1.5 text-sm"
                    />
                    <button
                      type="button"
                      disabled={!newLinkUrl.trim()}
                      onClick={() =>
                        createItem({
                          loopId: loop._id,
                          kind: "link",
                          url: newLinkUrl,
                          linkTitle: newLinkTitle || undefined,
                        }).then(() => {
                          setNewLinkUrl("");
                          setNewLinkTitle("");
                        })
                      }
                      className="px-3 py-1.5 rounded-lg bg-[var(--color-primary)] text-white text-sm disabled:opacity-40"
                    >
                      Add
                    </button>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setCloseOpen(true)}
                  className="text-sm font-medium text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg"
                >
                  Close loop…
                </button>
              </div>
            </div>
          )}
        </article>
      </SortableLoopShell>

      <CloseLoopModal
        loopId={loop._id}
        loopTitle={loop.title}
        isOpen={closeOpen}
        onClose={() => setCloseOpen(false)}
      />
    </>
  );
}
