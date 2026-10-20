import { useState } from "react";
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
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { Link } from "react-router-dom";
import { Infinity, Archive } from "lucide-react";
import { api } from "../../convex/_generated/api";
import LoopCard from "./LoopCard";
import { Id } from "../../convex/_generated/dataModel";

export default function LoopsSection() {
  const loops = useQuery(api.loops.listActiveLoops) ?? [];
  const createLoop = useMutation(api.loops.createLoop);
  const reorderLoops = useMutation(api.loops.reorderLoops);
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);

  const staleCount = loops.filter((l) => l.isStale).length;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const loopIds = loops.map((l) => l._id);

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = loopIds.indexOf(active.id as Id<"loops">);
    const newIndex = loopIds.indexOf(over.id as Id<"loops">);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(loops, oldIndex, newIndex);
    void reorderLoops({ orderedLoopIds: reordered.map((l) => l._id) });
  };

  const handleQuickAdd = async () => {
    const t = title.trim();
    if (!t) return;
    setCreating(true);
    try {
      await createLoop({ title: t });
      setTitle("");
    } finally {
      setCreating(false);
    }
  };

  return (
    <section aria-labelledby="loops-heading">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-6 bg-[var(--color-badge-purple)]/40 rounded-full" />
          <h3 id="loops-heading" className="text-[17px] font-bold">
            Loops
          </h3>
          {staleCount > 0 && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">
              {staleCount} stale
            </span>
          )}
        </div>
        <Link
          to="/loops/archive"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--color-muted)] hover:text-[var(--color-primary)]"
        >
          <Archive size={16} />
          Archive
        </Link>
      </div>

      <p className="text-sm text-[var(--color-muted)] mb-4">
        Open threads in your head — projects, worries, and ideas — with todos and notes underneath.
      </p>

      <div className="flex gap-2 mb-4">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Quick-add a loop by title…"
          className="flex-1 rounded-xl border border-[var(--color-hairline)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleQuickAdd();
          }}
          aria-label="New loop title"
        />
        <button
          type="button"
          disabled={!title.trim() || creating}
          onClick={() => void handleQuickAdd()}
          className="px-4 py-2 rounded-xl bg-[var(--color-badge-purple)] text-white text-sm font-semibold disabled:opacity-40 shrink-0"
        >
          Add
        </button>
      </div>

      {loops.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--color-hairline)] p-8 text-center text-[var(--color-muted)]">
          <Infinity className="mx-auto mb-2 opacity-40" size={28} />
          <p className="text-sm">No open loops yet. Add one above when something is on your mind.</p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={loopIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {loops.map((loop) => (
                <LoopCard
                  key={loop._id}
                  loop={loop}
                  allLoops={loops}
                  onMoveLoop={() => {
                    /* list refreshes from Convex */
                  }}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </section>
  );
}
