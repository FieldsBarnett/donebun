import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import {
  ChevronLeft,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Pencil,
  Plus,
  Search,
  Trash2,
  User,
  Users,
  X,
} from "lucide-react";
import Modal from "./Modal";
import { filterPasswords, FilterMode } from "../lib/filterUtils";
import { fuzzyScoreFields } from "../lib/fuzzySearch";

interface PasswordManagerProps {
  onBack: () => void;
  filterMode: FilterMode;
}

type FormState = {
  name: string;
  username: string;
  password: string;
  url: string;
  notes: string;
  isPrivate: boolean;
};

const emptyForm: FormState = {
  name: "",
  username: "",
  password: "",
  url: "",
  notes: "",
  isPrivate: false,
};

export default function PasswordManager({ onBack, filterMode }: PasswordManagerProps) {
  const passwords = useQuery(api.passwords.list);
  const currentUser = useQuery(api.users.getCurrentUser);
  const familyMembers = useQuery(api.users.getMyFamilyMembers) ?? [];
  const createPassword = useMutation(api.passwords.create);
  const updatePassword = useMutation(api.passwords.update);
  const removePassword = useMutation(api.passwords.remove);

  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<Id<"passwords"> | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const memberNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const member of familyMembers) {
      map.set(member._id, member.name);
    }
    if (currentUser) {
      map.set(currentUser._id, currentUser.name);
    }
    return map;
  }, [familyMembers, currentUser]);

  const filteredPasswords = useMemo(() => {
    if (!passwords) return undefined;
    const modeFiltered = filterPasswords(passwords, currentUser, filterMode);
    const query = searchQuery.trim();
    if (!query) return modeFiltered;

    return modeFiltered
      .map((entry) => ({
        entry,
        score: fuzzyScoreFields(query, [entry.name, entry.url, entry.notes]),
      }))
      .filter((result) => result.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((result) => result.entry);
  }, [passwords, currentUser, filterMode, searchQuery]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
    setShowForm(true);
  };

  const openEdit = (entry: {
    _id: Id<"passwords">;
    name: string;
    username?: string;
    password: string;
    url?: string;
    notes?: string;
    isPrivate?: boolean;
  }) => {
    setEditingId(entry._id);
    setForm({
      name: entry.name,
      username: entry.username ?? "",
      password: entry.password,
      url: entry.url ?? "",
      notes: entry.notes ?? "",
      isPrivate: entry.isPrivate ?? false,
    });
    setError(null);
    setShowForm(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await updatePassword({
          id: editingId,
          name: form.name,
          username: form.username,
          password: form.password,
          url: form.url,
          notes: form.notes,
          isPrivate: form.isPrivate,
        });
      } else {
        await createPassword({
          name: form.name,
          username: form.username || undefined,
          password: form.password,
          url: form.url || undefined,
          notes: form.notes || undefined,
          isPrivate: form.isPrivate,
        });
      }
      setShowForm(false);
      setForm(emptyForm);
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: Id<"passwords">) => {
    if (!confirm("Delete this password?")) return;
    try {
      await removePassword({ id });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  const togglePrivate = async (entry: {
    _id: Id<"passwords">;
    isPrivate?: boolean;
  }) => {
    try {
      await updatePassword({
        id: entry._id,
        isPrivate: !(entry.isPrivate ?? false),
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update privacy");
    }
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      alert("Could not copy to clipboard");
    }
  };

  const filterLabel =
    filterMode === "personal"
      ? "Personal"
      : filterMode === "family"
        ? "Family"
        : "Everyone";

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="px-6 py-4 border-b border-[var(--color-hairline)] flex items-center gap-4 sticky top-0 bg-white z-10">
        <button
          onClick={onBack}
          className="p-2 -ml-2 hover:bg-[var(--color-surface-soft)] rounded-full transition-colors text-[var(--color-muted)]"
        >
          <ChevronLeft size={24} />
        </button>
        <h2 className="text-xl font-bold tracking-tight flex-1">Passwords</h2>
        <button
          onClick={openCreate}
          className="p-2 rounded-full bg-[var(--color-primary)] text-white hover:opacity-90 transition-opacity"
          aria-label="Add password"
        >
          <Plus size={20} />
        </button>
      </div>

      <div className="px-6 py-4 border-b border-[var(--color-hairline)] space-y-3 bg-white sticky top-[73px] z-10">
        <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-surface-soft)]">
          <Search size={16} className="shrink-0 text-[var(--color-muted)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search name, website, notes…"
            className="flex-1 bg-transparent outline-none text-[15px] text-[var(--color-ink)] placeholder-[var(--color-muted)] min-w-0"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="shrink-0 text-[var(--color-muted)] hover:text-black transition-colors"
              aria-label="Clear search"
            >
              <X size={15} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 text-sm text-[var(--color-muted)]">
          {filterMode === "personal" ? (
            <User size={16} className="text-[var(--color-badge-blue)]" />
          ) : (
            <Users
              size={16}
              className={
                filterMode === "family"
                  ? "text-[var(--color-badge-purple)]"
                  : "text-[var(--color-badge-pink)]"
              }
            />
          )}
          <span>
            Showing <span className="font-medium text-[var(--color-ink)]">{filterLabel}</span>{" "}
            passwords
            {filteredPasswords !== undefined && (
              <span> ({filteredPasswords.length})</span>
            )}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
        {passwords === undefined && (
          <p className="text-[var(--color-muted)] text-sm">Loading…</p>
        )}

        {filteredPasswords?.length === 0 && !showForm && (
          <div className="text-center py-16 space-y-3">
            <KeyRound size={40} className="mx-auto text-[var(--color-muted)]" />
            <p className="font-medium">
              {searchQuery.trim()
                ? "No matching passwords"
                : filterMode === "personal"
                  ? "No personal passwords yet"
                  : "No shared passwords yet"}
            </p>
            <p className="text-sm text-[var(--color-muted)]">
              {searchQuery.trim()
                ? "Try a different search term."
                : "Store logins here, or use the API / CLI with your DoneBun login."}
            </p>
            {!searchQuery.trim() && (
              <button
                onClick={openCreate}
                className="mt-2 px-4 py-2 rounded-2xl bg-[var(--color-primary)] text-white text-sm font-medium"
              >
                Add password
              </button>
            )}
          </div>
        )}

        {filteredPasswords?.map((entry) => {
          const isRevealed = !!revealed[entry._id];
          const isPrivate = entry.isPrivate ?? false;
          const isOwner = entry.ownerId === currentUser?._id;
          const ownerName = entry.ownerId
            ? memberNameById.get(entry.ownerId)
            : undefined;

          return (
            <div
              key={entry._id}
              className="border border-[var(--color-hairline)] rounded-3xl p-5 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    {isPrivate && (
                      <EyeOff
                        size={16}
                        className="text-[var(--color-primary)] shrink-0"
                        aria-label="Private password"
                      />
                    )}
                    <h3 className="font-bold text-lg truncate">{entry.name}</h3>
                  </div>
                  {ownerName && !isOwner && filterMode !== "personal" && (
                    <p className="text-xs text-[var(--color-muted)] mt-0.5">
                      {ownerName}
                    </p>
                  )}
                  {entry.username && (
                    <p className="text-sm text-[var(--color-muted)] truncate">
                      {entry.username}
                    </p>
                  )}
                  {entry.url && (
                    <a
                      href={
                        entry.url.startsWith("http")
                          ? entry.url
                          : `https://${entry.url}`
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-[var(--color-primary)] truncate block"
                    >
                      {entry.url}
                    </a>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  {isOwner && (
                    <>
                      <button
                        onClick={() => togglePrivate(entry)}
                        className={`p-2 rounded-full transition-colors ${
                          isPrivate
                            ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
                            : "hover:bg-[var(--color-surface-soft)] text-[var(--color-muted)]"
                        }`}
                        title={isPrivate ? "Make shared" : "Make private"}
                        aria-label={isPrivate ? "Make shared" : "Make private"}
                      >
                        {isPrivate ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                      <button
                        onClick={() => openEdit(entry)}
                        className="p-2 rounded-full hover:bg-[var(--color-surface-soft)] text-[var(--color-muted)]"
                        aria-label="Edit"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(entry._id)}
                        className="p-2 rounded-full hover:bg-red-50 text-red-500"
                        aria-label="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 bg-[var(--color-surface-soft)] rounded-2xl px-3 py-2">
                <code className="flex-1 text-sm font-mono truncate">
                  {isRevealed ? entry.password : "••••••••••••"}
                </code>
                <button
                  onClick={() =>
                    setRevealed((prev) => ({
                      ...prev,
                      [entry._id]: !prev[entry._id],
                    }))
                  }
                  className="p-1.5 text-[var(--color-muted)] hover:text-black"
                  aria-label={isRevealed ? "Hide password value" : "Show password value"}
                >
                  {isRevealed ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
                <button
                  onClick={() => copyText(entry.password)}
                  className="p-1.5 text-[var(--color-muted)] hover:text-black"
                  aria-label="Copy password"
                >
                  <Copy size={16} />
                </button>
              </div>

              {entry.notes && (
                <p className="text-sm text-[var(--color-muted)] whitespace-pre-wrap">
                  {entry.notes}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} zIndex={200} size="lg">
        <div className="bg-white rounded-2xl shadow-2xl border border-[var(--color-hairline)] overflow-hidden max-h-[85dvh] flex flex-col">
          <div className="px-6 py-4 border-b border-[var(--color-hairline)] flex items-center justify-between shrink-0">
            <h3 className="text-lg font-bold">
              {editingId ? "Edit password" : "New password"}
            </h3>
            <button
              onClick={() => setShowForm(false)}
              className="p-2 rounded-full hover:bg-[var(--color-surface-soft)] text-[var(--color-muted)]"
            >
              <X size={20} />
            </button>
          </div>

          <div className="px-6 py-6 space-y-4 overflow-y-auto">
            {(
              [
                ["name", "Name", "text", "GitHub"],
                ["username", "Username / email", "text", "you@example.com"],
                ["password", "Password", "text", "••••••••"],
                ["url", "URL", "url", "https://…"],
              ] as const
            ).map(([key, label, type, placeholder]) => (
              <div key={key} className="space-y-1.5">
                <label className="text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-wider block">
                  {label}
                  {key === "name" || key === "password" ? " *" : ""}
                </label>
                <input
                  type={type}
                  value={form[key]}
                  placeholder={placeholder}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, [key]: e.target.value }))
                  }
                  className="w-full px-4 py-3 bg-[var(--color-surface-soft)] border border-[var(--color-hairline)] rounded-2xl text-base focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
                />
              </div>
            ))}

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-wider block">
                Notes
              </label>
              <textarea
                value={form.notes}
                rows={3}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, notes: e.target.value }))
                }
                className="w-full px-4 py-3 bg-[var(--color-surface-soft)] border border-[var(--color-hairline)] rounded-2xl text-base focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 resize-none"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Private</p>
                <p className="text-xs text-[var(--color-muted)]">
                  Only you can see this password
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setForm((prev) => ({ ...prev, isPrivate: !prev.isPrivate }))
                }
                className={`flex items-center justify-center w-10 h-10 rounded-full border transition-colors ${
                  form.isPrivate
                    ? "bg-[var(--color-primary)]/10 border-[var(--color-primary)] text-[var(--color-primary)]"
                    : "border-[var(--color-hairline)] text-[var(--color-muted)] hover:border-[var(--color-muted)]"
                }`}
                title={form.isPrivate ? "Make shared" : "Make private"}
              >
                {form.isPrivate ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <button
              onClick={handleSave}
              disabled={saving || !form.name.trim() || !form.password}
              className="w-full py-3 rounded-2xl bg-[var(--color-primary)] text-white font-medium disabled:opacity-50"
            >
              {saving ? "Saving…" : editingId ? "Save changes" : "Add password"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
