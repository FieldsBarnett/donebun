import { useState, useRef, useEffect } from "react";
import { Search, X, CheckCircle2, Circle } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

/** Very simple fuzzy match: returns a score > 0 if all chars of query appear in order in target. */
function fuzzyScore(query: string, target: string): number {
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  if (!q) return 1;
  let qi = 0;
  let score = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      // Consecutive matches score higher
      score += qi > 0 && t[ti - 1] === q[qi - 1] ? 2 : 1;
      qi++;
    }
  }
  return qi === q.length ? score : 0;
}

export default function SearchBar() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const tasks = useQuery(api.tasks.getTasks) ?? [];
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const results = query.trim()
    ? tasks
        .map((t) => ({ task: t, score: fuzzyScore(query, t.title) }))
        .filter((r) => r.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 8)
        .map((r) => r.task)
    : [];

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleFocus = () => setOpen(true);
  const handleClear = () => {
    setQuery("");
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className="relative w-full" id="task-search-bar">
      {/* Input */}
      <div
        className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border transition-all duration-200 bg-[var(--color-surface-soft)] ${
          open
            ? "border-[var(--color-primary)] shadow-[0_0_0_3px_rgba(0,122,255,0.12)]"
            : "border-[var(--color-hairline)] hover:border-[var(--color-muted)]"
        }`}
      >
        <Search
          size={16}
          className={`shrink-0 transition-colors ${open ? "text-[var(--color-primary)]" : "text-[var(--color-muted)]"}`}
        />
        <input
          ref={inputRef}
          type="text"
          id="task-search-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={handleFocus}
          placeholder="Search todos…"
          className="flex-1 bg-transparent outline-none text-[15px] text-[var(--color-ink)] placeholder-[var(--color-muted)] min-w-0"
        />
        {query && (
          <button
            onClick={handleClear}
            className="shrink-0 text-[var(--color-muted)] hover:text-black transition-colors"
            aria-label="Clear search"
          >
            <X size={15} />
          </button>
        )}
        {!query && (
          <kbd className="hidden sm:flex items-center gap-1 shrink-0 px-1.5 py-0.5 rounded text-[11px] font-medium bg-white border border-[var(--color-hairline)] text-[var(--color-muted)] leading-none select-none">
            ⌘K
          </kbd>
        )}
      </div>

      {/* Dropdown results */}
      {open && query.trim() && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl border border-[var(--color-hairline)] shadow-[0_8px_32px_rgba(0,0,0,0.12)] z-50 overflow-hidden">
          {results.length === 0 ? (
            <div className="px-4 py-6 text-center text-[var(--color-muted)] text-sm">
              No todos matching "<span className="font-medium text-[var(--color-ink)]">{query}</span>"
            </div>
          ) : (
            <ul>
              {results.map((task) => (
                <li
                  key={task._id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--color-surface-soft)] cursor-pointer transition-colors border-b border-[var(--color-hairline)] last:border-b-0 group"
                >
                  {task.status === "completed" ? (
                    <CheckCircle2 size={17} className="text-[var(--color-primary)] shrink-0" />
                  ) : (
                    <Circle size={17} className="text-[var(--color-muted)] shrink-0" />
                  )}
                  <span
                    className={`text-[15px] flex-1 truncate ${
                      task.status === "completed"
                        ? "line-through text-[var(--color-muted)]"
                        : "text-[var(--color-ink)]"
                    }`}
                  >
                    {/* Highlight matching chars */}
                    <HighlightMatch text={task.title} query={query} />
                  </span>
                  {task.dueDate && (
                    <span className="text-[11px] text-[var(--color-muted)] shrink-0">
                      {new Date(task.dueDate).toLocaleDateString("default", { month: "short", day: "numeric" })}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/** Highlights the matched characters in the result */
function HighlightMatch({ text, query }: { text: string; query: string }) {
  const q = query.toLowerCase();
  const chars = text.split("");
  let qi = 0;
  const matched = new Set<number>();

  for (let i = 0; i < chars.length && qi < q.length; i++) {
    if (chars[i].toLowerCase() === q[qi]) {
      matched.add(i);
      qi++;
    }
  }

  return (
    <>
      {chars.map((char, i) =>
        matched.has(i) ? (
          <mark key={i} className="bg-transparent text-[var(--color-primary)] font-semibold">
            {char}
          </mark>
        ) : (
          <span key={i}>{char}</span>
        )
      )}
    </>
  );
}
