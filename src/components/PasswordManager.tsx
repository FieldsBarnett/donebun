import { useState } from "react";
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
  Trash2,
  X,
} from "lucide-react";
import Modal from "./Modal";

interface PasswordManagerProps {
  onBack: () => void;
}

type FormState = {
  name: string;
  username: string;
  password: string;
  url: string;
  notes: string;
};

const emptyForm: FormState = {
  name: "",
  username: "",
  password: "",
  url: "",
  notes: "",
};

export default function PasswordManager({ onBack }: PasswordManagerProps) {
  const passwords = useQuery(api.passwords.list);
  const createPassword = useMutation(api.passwords.create);
  const updatePassword = useMutation(api.passwords.update);
  const removePassword = useMutation(api.passwords.remove);

  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<Id<"passwords"> | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  }) => {
    setEditingId(entry._id);
    setForm({
      name: entry.name,
      username: entry.username ?? "",
      password: entry.password,
      url: entry.url ?? "",
      notes: entry.notes ?? "",
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
        });
      } else {
        await createPassword({
          name: form.name,
          username: form.username || undefined,
          password: form.password,
          url: form.url || undefined,
          notes: form.notes || undefined,
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

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      alert("Could not copy to clipboard");
    }
  };

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

      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
        {passwords === undefined && (
          <p className="text-[var(--color-muted)] text-sm">Loading…</p>
        )}

        {passwords?.length === 0 && !showForm && (
          <div className="text-center py-16 space-y-3">
            <KeyRound size={40} className="mx-auto text-[var(--color-muted)]" />
            <p className="font-medium">No passwords yet</p>
            <p className="text-sm text-[var(--color-muted)]">
              Store logins here, or use the API / CLI with your DoneBun login.
            </p>
            <button
              onClick={openCreate}
              className="mt-2 px-4 py-2 rounded-2xl bg-[var(--color-primary)] text-white text-sm font-medium"
            >
              Add password
            </button>
          </div>
        )}

        {passwords?.map((entry) => {
          const isRevealed = !!revealed[entry._id];
          return (
            <div
              key={entry._id}
              className="border border-[var(--color-hairline)] rounded-3xl p-5 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-bold text-lg truncate">{entry.name}</h3>
                  {entry.username && (
                    <p className="text-sm text-[var(--color-muted)] truncate">
                      {entry.username}
                    </p>
                  )}
                  {entry.url && (
                    <a
                      href={entry.url.startsWith("http") ? entry.url : `https://${entry.url}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-[var(--color-primary)] truncate block"
                    >
                      {entry.url}
                    </a>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
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
                  aria-label={isRevealed ? "Hide password" : "Show password"}
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

            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}

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
