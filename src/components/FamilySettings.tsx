import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Copy, Plus, LogOut, Users, ChevronLeft } from "lucide-react";

interface FamilySettingsProps {
  onBack: () => void;
}

export default function FamilySettings({ onBack }: FamilySettingsProps) {
  const user = useQuery(api.users.getCurrentUser);
  const family = useQuery(api.families.getMyFamily);
  const createFamily = useMutation(api.families.create);
  const leaveFamily = useMutation(api.families.leave);
  
  const familyMembers = useQuery(api.families.getMembers, 
    user?.familyId ? { familyId: user.familyId } : "skip"
  );

  const handleCreateFamily = async () => {
    try {
      await createFamily();
    } catch (err) {
      alert("Failed to create family.");
    }
  };

  const handleLeaveFamily = async () => {
    if (window.confirm("Are you sure you want to leave your family? You will lose access to all shared tasks and data.")) {
      try {
        await leaveFamily();
      } catch (err) {
        alert("Failed to leave family.");
      }
    }
  };

  const inviteLink = family ? `${window.location.origin}/join/${family.inviteCode}` : "";

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteLink);
    alert("Invite link copied to clipboard!");
  };

  const handleShareLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join my family on DoneBun',
          text: 'Join my family on DoneBun to sync our tasks and calendars!',
          url: inviteLink,
        });
      } catch (err) {
        console.error("Error sharing:", err);
      }
    } else {
      handleCopyLink();
    }
  };


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
        <h2 className="text-xl font-bold tracking-tight">Family</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-8 space-y-10">

        {/* Family Workspace Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-[var(--color-muted)] uppercase tracking-widest">Family Workspace</h3>
            {user?.familyId && (
              <button 
                onClick={handleLeaveFamily}
                className="text-xs text-red-600 font-medium hover:underline flex items-center gap-1"
              >
                <LogOut size={12} /> Leave Family
              </button>
            )}
          </div>
          
          {user?.familyId ? (
            <div className="space-y-8">
              {/* Invite Link Card */}
              <div className="p-5 bg-white rounded-2xl border border-[var(--color-hairline)] shadow-sm space-y-4">
                <div>
                  <p className="font-medium text-xs text-[var(--color-muted)] uppercase tracking-wider mb-2">Invite Link</p>
                  <p className="font-mono text-[13px] break-all bg-[var(--color-surface-soft)] p-3 border border-[var(--color-hairline)] rounded-xl">{inviteLink}</p>
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={handleCopyLink}
                    className="flex-1 flex items-center justify-center gap-2 bg-white border border-[var(--color-hairline)] py-2.5 rounded-xl text-sm font-semibold hover:bg-[var(--color-surface-soft)] transition-colors shadow-sm"
                  >
                    <Copy size={16} /> Copy
                  </button>
                  <button 
                    onClick={handleShareLink}
                    className="flex-1 flex items-center justify-center gap-2 bg-[var(--color-primary)] text-white py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-colors shadow-sm"
                  >
                    <Plus size={16} /> Share
                  </button>
                </div>
              </div>

              {/* Members List */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-[var(--color-muted)] uppercase tracking-widest">Members</h4>
                <div className="space-y-3">
                  {familyMembers?.map((member: any) => {
                    const isMe = member._id === user?._id;
                    return (
                      <div key={member._id} className={`p-4 border border-[var(--color-hairline)] rounded-2xl bg-white ${isMe ? 'ring-2 ring-[var(--color-primary)]/10 border-[var(--color-primary)]/30' : ''}`}>
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-bold shadow-sm" style={{ backgroundColor: member.colorCode || 'var(--color-primary)' }}>
                            {member.initials || member.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold">{member.name} {isMe && <span className="text-[var(--color-primary)] text-xs font-bold ml-1">YOU</span>}</p>
                            <p className="text-sm text-[var(--color-muted)]">{member.email}</p>
                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-[var(--color-surface-soft)]/50 border border-dashed border-[var(--color-hairline)] rounded-3xl p-10 flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm">
                <Users size={32} className="text-[var(--color-muted)]" />
              </div>
              <h4 className="text-lg font-bold mb-2">Start a Family</h4>
              <p className="text-sm text-[var(--color-muted)] max-w-[240px] mb-8 leading-relaxed">
                Create a family workspace to share tasks and sync calendars with everyone.
              </p>
              
              <button 
                onClick={handleCreateFamily}
                className="bg-[var(--color-primary)] text-white px-8 py-3.5 rounded-2xl font-bold hover:opacity-90 transition-all shadow-md active:scale-95 flex items-center gap-2"
              >
                <Plus size={20} /> Create Family
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
