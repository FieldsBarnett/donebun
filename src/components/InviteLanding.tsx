import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Users, CheckCircle2, AlertCircle, Home } from "lucide-react";
import { useState } from "react";

export default function InviteLanding() {
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const navigate = useNavigate();
  
  const user = useQuery(api.users.getCurrentUser);
  const family = useQuery(api.families.getByInviteCode, inviteCode ? { inviteCode } : "skip");
  const joinFamily = useMutation(api.families.join);
  
  const currentFamilyMembers = useQuery(api.families.getMembers, 
    user?.familyId ? { familyId: user.familyId } : "skip"
  );
  
  const isInSharedFamily = user?.familyId && currentFamilyMembers && currentFamilyMembers.length > 1;
  const isAlreadyInThisFamily = user?.familyId === family?._id;

  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleJoin = async () => {
    if (!inviteCode) return;
    setIsJoining(true);
    setError(null);
    try {
      await joinFamily({ inviteCode });
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Failed to join family.");
    } finally {
      setIsJoining(false);
    }
  };

  if (!family && family !== undefined) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-[var(--color-surface-soft)] text-center">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-[var(--color-hairline)] max-w-md w-full flex flex-col items-center">
          <AlertCircle size={48} className="text-red-500 mb-4" />
          <h1 className="text-2xl font-bold mb-2">Invalid Invite</h1>
          <p className="text-[var(--color-muted)] mb-6">This invite link is invalid or has expired.</p>
          <button 
            onClick={() => navigate("/")}
            className="flex items-center gap-2 bg-[var(--color-primary)] text-white px-6 py-2 rounded-lg font-medium hover:bg-[#005bb5] transition-colors"
          >
            <Home size={18} /> Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-[var(--color-surface-soft)] text-center">
      <div className="bg-white p-10 rounded-2xl shadow-sm border border-[var(--color-hairline)] max-w-md w-full flex flex-col items-center">
        <div className="w-20 h-20 bg-[var(--color-surface-soft)] rounded-full flex items-center justify-center mb-6 shrink-0 aspect-square overflow-hidden">
          <Users size={40} className="text-[var(--color-primary)]" />
        </div>
        
        {!success ? (
          <>
            <h1 className="text-2xl font-bold mb-2">Join {family?.name}</h1>
            <p className="text-[var(--color-muted)] mb-8">
              You've been invited to join a family workspace on DoneBun.
            </p>

            {isInSharedFamily ? (
              <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl mb-6 text-amber-800 text-sm flex items-start gap-3 text-left">
                <AlertCircle size={20} className="shrink-0 mt-0.5" />
                <p>You are already in a shared family. You must leave your current family in Settings before you can join a new one.</p>
              </div>
            ) : null}

            {isAlreadyInThisFamily && !isInSharedFamily ? (
              <div className="bg-green-50 border border-green-200 p-4 rounded-xl mb-6 text-green-800 text-sm flex items-start gap-3 text-left">
                <CheckCircle2 size={20} className="shrink-0 mt-0.5 text-green-600" />
                <p>You are already a member of this family!</p>
              </div>
            ) : null}

            {error && (
              <div className="bg-red-50 border border-red-200 p-4 rounded-xl mb-6 text-red-800 text-sm flex items-start gap-3 text-left">
                <AlertCircle size={20} className="shrink-0 mt-0.5" />
                <p>{error}</p>
              </div>
            )}

            <div className="w-full space-y-3">
              <button 
                onClick={handleJoin}
                disabled={isJoining || isInSharedFamily || isAlreadyInThisFamily || !family}
                className="w-full flex items-center justify-center gap-2 bg-[var(--color-primary)] text-white px-6 py-3 rounded-xl font-semibold hover:bg-[#005bb5] transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
              >
                {isJoining ? "Joining..." : "Accept Invitation"}
              </button>
              
              <button 
                onClick={() => navigate("/")}
                className="w-full flex items-center justify-center gap-2 bg-white border border-[var(--color-hairline)] text-[var(--color-ink)] px-6 py-3 rounded-xl font-semibold hover:bg-[var(--color-surface-soft)] transition-all"
              >
                <Home size={18} /> Go Home
              </button>
            </div>
          </>
        ) : (
          <>
            <CheckCircle2 size={64} className="text-green-500 mb-6" />
            <h1 className="text-2xl font-bold mb-2">Welcome to the family!</h1>
            <p className="text-[var(--color-muted)] mb-8">
              You've successfully joined {family?.name}. You can now see and share tasks with everyone.
            </p>
            <button 
              onClick={() => navigate("/")}
              className="w-full flex items-center justify-center gap-2 bg-[var(--color-primary)] text-white px-6 py-3 rounded-xl font-semibold hover:bg-[#005bb5] transition-all shadow-md hover:shadow-lg active:scale-95"
            >
              <Home size={18} /> Go to Dashboard
            </button>
          </>
        )}
      </div>
    </div>
  );
}
