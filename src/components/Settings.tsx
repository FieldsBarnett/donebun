import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Copy, Plus, LogOut, Calendar, Users } from "lucide-react";
import { authClient } from "../lib/auth-client";
import GoogleCalendarSettings from "./GoogleCalendarSettings";

type SettingsTab = "account" | "calendar";

export default function Settings() {
  const user = useQuery(api.users.getCurrentUser);
  const createFamily = useMutation(api.families.create);
  const joinFamily = useMutation(api.families.join);
  
  const [tab, setTab] = useState<SettingsTab>(() => {
    // Auto-switch to Calendar tab when returning from Google OAuth
    const params = new URLSearchParams(window.location.search);
    return params.get("state") === "google-calendar" ? "calendar" : "account";
  });
  const [newFamilyName, setNewFamilyName] = useState("");
  const [joinFamilyId, setJoinFamilyId] = useState("");

  const familyMembers = useQuery(api.families.getMembers, 
    user?.familyId ? { familyId: user.familyId } : "skip"
  );

  const handleCreateFamily = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFamilyName.trim()) return;
    await createFamily({ name: newFamilyName });
    setNewFamilyName("");
  };

  const handleJoinFamily = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinFamilyId.trim()) return;
    try {
      // @ts-ignore
      await joinFamily({ familyId: joinFamilyId });
      setJoinFamilyId("");
    } catch (err) {
      alert("Failed to join family. Check the code.");
    }
  };

  const handleSignOut = async () => {
    await authClient.signOut();
  };

  return (
    <div className="px-8 py-10 md:px-14 max-w-4xl mx-auto space-y-8">
      <div>
        <h2 className="text-3xl font-bold mb-2 tracking-tight">Settings</h2>
        <p className="text-[var(--color-muted)]">Manage your account, family workspace, and calendar integrations.</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 bg-[var(--color-surface-soft)] border border-[var(--color-hairline)] rounded-xl p-1">
        <button
          onClick={() => setTab("account")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all flex-1 justify-center ${
            tab === "account" ? "bg-white shadow-sm text-black" : "text-[var(--color-muted)] hover:text-black"
          }`}
        >
          <Users size={16} /> Account &amp; Family
        </button>
        <button
          onClick={() => setTab("calendar")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all flex-1 justify-center ${
            tab === "calendar" ? "bg-white shadow-sm text-black" : "text-[var(--color-muted)] hover:text-black"
          }`}
        >
          <Calendar size={16} /> Calendar Sync
        </button>
      </div>

      {tab === "account" && (<>
      <div className="bg-white border border-[var(--color-hairline)] rounded-xl p-6 shadow-sm">
        <h3 className="text-xl font-semibold mb-4">Account</h3>
        {user ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{user.name}</p>
              <p className="text-sm text-[var(--color-muted)]">{user.email}</p>
            </div>
            <button 
              onClick={handleSignOut}
              className="flex items-center gap-2 text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg transition-colors"
            >
              <LogOut size={16} /> Sign Out
            </button>
          </div>
        ) : (
          <p className="text-[var(--color-muted)]">Loading account details...</p>
        )}
      </div>

      <div className="bg-white border border-[var(--color-hairline)] rounded-xl p-6 shadow-sm">
        <h3 className="text-xl font-semibold mb-4">Family Workspace</h3>
        
        {user?.familyId ? (
          <div className="space-y-6">
            <div className="p-4 bg-[var(--color-surface-soft)] rounded-lg border border-[var(--color-hairline)] flex items-center justify-between">
              <div>
                <p className="font-medium text-sm text-[var(--color-muted)] uppercase tracking-wider mb-1">Invite Code</p>
                <p className="font-mono text-lg">{user.familyId}</p>
              </div>
              <button 
                onClick={() => navigator.clipboard.writeText(user.familyId!)}
                className="p-2 hover:bg-black/5 rounded-md transition-colors"
                title="Copy Invite Code"
              >
                <Copy size={20} className="text-[var(--color-muted)]" />
              </button>
            </div>

            <div>
              <h4 className="font-medium mb-3">Members</h4>
              <div className="space-y-2">
                {familyMembers?.map((member: NonNullable<typeof familyMembers>[0]) => (
                  <div key={member._id} className="flex items-center gap-3 p-3 border border-[var(--color-hairline)] rounded-lg">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: member.colorCode || 'var(--color-primary)' }}>
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium">{member.name} {member._id === user._id && "(You)"}</p>
                      <p className="text-xs text-[var(--color-muted)]">{member.email}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            <p className="text-[var(--color-muted)]">You are not part of a family workspace yet.</p>
            
            <form onSubmit={handleCreateFamily} className="flex flex-col gap-3">
              <label className="font-medium text-sm">Create a New Family</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={newFamilyName}
                  onChange={(e) => setNewFamilyName(e.target.value)}
                  placeholder="Family Name (e.g. The Smiths)"
                  className="flex-1 px-4 py-2 border border-[var(--color-hairline)] rounded-lg focus:outline-none focus:border-[var(--color-primary)]"
                  required
                />
                <button type="submit" className="bg-[var(--color-primary)] text-white px-4 py-2 rounded-lg font-medium hover:bg-[#005bb5] transition-colors flex items-center gap-2">
                  <Plus size={16} /> Create
                </button>
              </div>
            </form>

            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[var(--color-hairline)]"></div></div>
              <div className="relative flex justify-center"><span className="bg-white px-4 text-sm text-[var(--color-muted)]">OR</span></div>
            </div>

            <form onSubmit={handleJoinFamily} className="flex flex-col gap-3">
              <label className="font-medium text-sm">Join Existing Family</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={joinFamilyId}
                  onChange={(e) => setJoinFamilyId(e.target.value)}
                  placeholder="Enter Invite Code"
                  className="flex-1 px-4 py-2 border border-[var(--color-hairline)] rounded-lg focus:outline-none focus:border-[var(--color-primary)]"
                  required
                />
                <button type="submit" className="bg-white text-[var(--color-ink)] border border-[var(--color-hairline)] px-4 py-2 rounded-lg font-medium hover:bg-[var(--color-surface-soft)] transition-colors">
                  Join
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
      </>)}

      {/* Calendar Sync Tab */}
      {tab === "calendar" && (
        <div className="bg-white border border-[var(--color-hairline)] rounded-xl p-6 shadow-sm">
          <GoogleCalendarSettings />
        </div>
      )}
    </div>
  );
}
