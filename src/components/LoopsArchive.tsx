import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Link } from "react-router-dom";
import { Archive, ArrowLeft, RotateCcw, Search } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

export default function LoopsArchive() {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const loops = useQuery(api.loops.listClosedLoops, { search: debounced || undefined }) ?? [];
  const reopen = useMutation(api.loops.reopenLoop);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  return (
    <div className="px-8 py-10 md:px-14 max-w-4xl mx-auto pb-24">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--color-muted)] hover:text-[var(--color-primary)] mb-6"
      >
        <ArrowLeft size={16} />
        Back to dashboard
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-8 h-8 rounded bg-[var(--color-badge-purple)]/80 flex items-center justify-center text-white">
          <Archive size={18} />
        </div>
        <h2 className="text-3xl font-bold tracking-tight">Loop archive</h2>
      </div>

      <div className="relative mb-6">
        <Search
          size={18}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]"
        />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search closed loops…"
          className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-[var(--color-hairline)] outline-none focus:border-[var(--color-primary)]"
        />
      </div>

      {loops.length === 0 ? (
        <p className="text-[var(--color-muted)] text-sm italic">No closed loops match your search.</p>
      ) : (
        <ul className="space-y-3">
          {loops.map((loop) => (
            <li
              key={loop._id}
              className="rounded-2xl border border-[var(--color-hairline)] bg-white p-4 flex flex-col sm:flex-row sm:items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {loop.emoji && <span>{loop.emoji}</span>}
                  <h3 className="font-semibold truncate">{loop.title}</h3>
                </div>
                {loop.closingNote && (
                  <p className="text-sm text-[var(--color-muted)] mt-1 line-clamp-2">
                    {loop.closingNote}
                  </p>
                )}
                <p className="text-xs text-[var(--color-muted)] mt-2">
                  Closed{" "}
                  {loop.closedAt
                    ? new Date(loop.closedAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "—"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => reopen({ loopId: loop._id as Id<"loops"> })}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--color-hairline)] text-sm font-medium hover:bg-[var(--color-surface-soft)] shrink-0"
              >
                <RotateCcw size={16} />
                Reopen
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
