import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { LogOut, ChevronLeft, Trash2, AlertCircle } from "lucide-react";
import { authClient } from "../lib/auth-client";

interface AccountSettingsProps {
  onBack: () => void;
}

export default function AccountSettings({ onBack }: AccountSettingsProps) {
  const user = useQuery(api.users.getCurrentUser);
  const updateProfile = useMutation(api.users.updateProfile);
  const deleteAccount = useMutation(api.users.deleteAccount);
  
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSignOut = async () => {
    await authClient.signOut();
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      await deleteAccount();
      await authClient.signOut();
      window.location.href = "/";
    } catch (err) {
      alert("Failed to delete account. Please try again.");
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  if (!user) return null;

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[var(--color-hairline)] flex items-center gap-4 sticky top-0 bg-white z-10">
        <button 
          onClick={onBack}
          className="p-2 -ml-2 hover:bg-[var(--color-surface-soft)] rounded-full transition-colors text-[var(--color-muted)]"
        >
          <ChevronLeft size={24} />
        </button>
        <h2 className="text-xl font-bold tracking-tight">Account</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-8 space-y-10">
        {/* Profile Details */}
        <section className="space-y-6">
          <h3 className="text-xs font-bold text-[var(--color-muted)] uppercase tracking-widest">Profile Details</h3>
          
          <div className="p-6 border border-[var(--color-hairline)] rounded-3xl bg-white space-y-6">
            <div className="flex items-center gap-6">
              <div 
                className="w-20 h-20 rounded-full flex items-center justify-center text-white text-3xl font-bold shadow-md" 
                style={{ backgroundColor: user.colorCode || 'var(--color-primary)' }}
              >
                {user.initials || user.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 space-y-1">
                <p className="text-sm font-bold text-[var(--color-muted)] uppercase tracking-wider">Email</p>
                <p className="text-lg font-medium">{user.email}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-[var(--color-hairline)]">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-wider block">Display Name</label>
                <input 
                  type="text"
                  placeholder="Your Name"
                  defaultValue={user.name}
                  onBlur={(e) => updateProfile({ name: e.target.value })}
                  className="w-full px-4 py-3 bg-[var(--color-surface-soft)] border border-[var(--color-hairline)] rounded-2xl text-base focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 font-medium transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-wider block">Initials</label>
                <input 
                  type="text"
                  maxLength={2}
                  placeholder={user.name.charAt(0).toUpperCase()}
                  defaultValue={user.initials}
                  onBlur={(e) => updateProfile({ initials: e.target.value })}
                  className="w-full px-4 py-3 bg-[var(--color-surface-soft)] border border-[var(--color-hairline)] rounded-2xl text-base focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 font-medium transition-all"
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-wider block">Profile Color</label>
              <div className="flex gap-3 flex-wrap">
                {[
                  '#007aff', // Blue
                  '#ff9500', // Orange
                  '#ff2d55', // Pink
                  '#af52de', // Violet
                  '#34c759', // Green
                  '#5ac8fa', // Sky
                  '#ffcc00', // Yellow
                  '#8e8e93', // Gray
                ].map((c) => (
                  <button
                    key={c}
                    onClick={() => updateProfile({ colorCode: c })}
                    className={`w-10 h-10 rounded-full border-4 transition-all hover:scale-110 active:scale-95 shadow-sm ${user.colorCode === c ? 'border-black/20 scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                  >
                    {user.colorCode === c && <div className="w-2 h-2 bg-white rounded-full mx-auto" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Account Actions */}
        <section className="space-y-4">
          <h3 className="text-xs font-bold text-[var(--color-muted)] uppercase tracking-widest">Account Actions</h3>
          
          <div className="space-y-3">
            <button 
              onClick={handleSignOut}
              className="w-full flex items-center justify-between p-5 bg-white border border-[var(--color-hairline)] rounded-2xl hover:bg-[var(--color-surface-soft)] transition-colors group"
            >
              <div className="flex items-center gap-3">
                <LogOut size={20} className="text-[var(--color-muted)] group-hover:text-black transition-colors" />
                <span className="font-bold">Log Out</span>
              </div>
            </button>

            {!showDeleteConfirm ? (
              <button 
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full flex items-center justify-between p-5 bg-white border border-red-100 rounded-2xl hover:bg-red-50 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <Trash2 size={20} className="text-red-500" />
                  <span className="font-bold text-red-600">Delete Account</span>
                </div>
              </button>
            ) : (
              <div className="p-6 bg-red-50 border border-red-200 rounded-2xl space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex items-start gap-3">
                  <AlertCircle size={24} className="text-red-600 shrink-0" />
                  <div>
                    <h4 className="font-bold text-red-900">Are you absolutely sure?</h4>
                    <p className="text-sm text-red-700 mt-1 leading-relaxed">
                      This action cannot be undone. All your personal tasks and data will be permanently deleted.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button 
                    disabled={isDeleting}
                    onClick={handleDeleteAccount}
                    className="flex-1 bg-red-600 text-white font-bold py-3 rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {isDeleting ? "Deleting..." : "Yes, Delete My Account"}
                  </button>
                  <button 
                    disabled={isDeleting}
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 bg-white border border-red-200 text-red-900 font-bold py-3 rounded-xl hover:bg-red-100 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
