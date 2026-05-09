import { useState, useEffect } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Calendar, ChevronDown, ExternalLink, RefreshCw, UserCheck } from "lucide-react";
import ColorPickerModal from "./ColorPickerModal";


// We now use PRESET_COLORS from ColorPickerModal


const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

function getOAuthUrl(redirectUri: string): string {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (!clientId) return "";
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_SCOPES,
    access_type: "offline",
    prompt: "consent",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export default function GoogleCalendarSettings() {
  const googleAccounts = useQuery(api.google.getFamilyGoogleAccounts);
  const calendars = useQuery(api.calendars.listByFamily);
  const familyMembers = useQuery(api.users.getMyFamilyMembers) || [];
  const user = useQuery(api.users.getCurrentUser);

  const updateAssignee = useMutation(api.calendars.updateAssignee);
  const updateColor = useMutation(api.calendars.updateColor);
  const toggleSync = useMutation(api.calendars.toggleSync);
  const exchangeCode = useAction(api.googleActions.exchangeCode);

  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assigneeDropdownOpen, setAssigneeDropdownOpen] = useState<string | null>(null);
  const [colorPickerOpen, setColorPickerOpen] = useState<string | null>(null);

  // The redirect URI must match what's registered in Google Cloud Console
  const redirectUri = `${window.location.origin}/google-oauth-callback`;

  // Handle OAuth callback code in URL
  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");

    if (code && state === "google-calendar") {
      // Clear the code from URL immediately
      window.history.replaceState({}, "", window.location.pathname);
      setIsConnecting(true);
      setError(null);
      exchangeCode({ code, redirectUri })
        .then(() => setIsConnecting(false))
        .catch((err) => {
          setError(err.message ?? "Failed to connect Google account");
          setIsConnecting(false);
        });
    }
  }, []);

  const handleConnectGoogle = () => {
    const url = getOAuthUrl(redirectUri);
    if (!url) {
      setError("VITE_GOOGLE_CLIENT_ID is not set. Please add it to your .env.local file.");
      return;
    }
    // Append state param to detect callback
    window.location.href = url + "&state=google-calendar";
  };

  const handleToggleSync = async (calendarId: Id<"calendars">, enabled: boolean) => {
    try {
      await toggleSync({ calendarId, enabled });
    } catch (err: any) {
      setError(err.message ?? "Failed to update sync status");
    }
  };

  const handleAssigneeChange = async (calendarId: Id<"calendars">, assigneeId: Id<"users">) => {
    try {
      await updateAssignee({ calendarId, assigneeId });
      setAssigneeDropdownOpen(null);
    } catch (err: any) {
      setError(err.message ?? "Failed to update assignee");
    }
  };

  const handleColorChange = async (calendarId: Id<"calendars">, color: string) => {
    try {
      await updateColor({ calendarId, color });
      setColorPickerOpen(null);
    } catch (err: any) {
      setError(err.message ?? "Failed to update color");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header + Connect Button */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-semibold">Google Calendar Sync</h3>
          <p className="text-sm text-[var(--color-muted)] mt-1">
            Connect Google accounts to overlay events alongside your tasks.
          </p>
        </div>
        <button
          onClick={handleConnectGoogle}
          disabled={isConnecting}
          className="flex items-center justify-center gap-2 bg-[var(--color-primary)] text-white px-6 py-3 rounded-xl font-semibold hover:bg-[#005bb5] transition-all active:scale-[0.98] disabled:opacity-60 w-full md:w-auto shrink-0"
        >
          {isConnecting ? (
            <RefreshCw size={18} className="animate-spin shrink-0" />
          ) : (
            <Calendar size={18} className="shrink-0" />
          )}
          <span>{isConnecting ? "Connecting…" : "Connect Google Account"}</span>
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      {/* Connected Accounts */}
      {(googleAccounts ?? []).length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-2">
            Connected Accounts
          </p>
          {googleAccounts!.map((account: NonNullable<typeof googleAccounts>[0]) => (
            <div
              key={account._id}
              className="flex items-center gap-3 p-3 bg-[var(--color-surface-soft)] border border-[var(--color-hairline)] rounded-lg"
            >
              {/* Google logo */}
              <div className="w-8 h-8 rounded-full bg-white border border-[var(--color-hairline)] flex items-center justify-center shrink-0">
                <svg viewBox="0 0 24 24" className="w-4 h-4">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium truncate">{account.email}</p>
                  {account.isMe && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-bold">You</span>
                  )}
                </div>
                <p className="text-xs text-[var(--color-muted)]">
                  {account.ownerName} • {(calendars ?? []).filter((c: any) => c?.googleAccountId === account._id).length} calendars synced
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Synced Calendars */}
      {(calendars ?? []).length > 0 ? (
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-2">
            Synced Calendars
          </p>
          <div className="divide-y divide-[var(--color-hairline)] border border-[var(--color-hairline)] rounded-xl overflow-hidden">
            {calendars!.map((cal: NonNullable<typeof calendars>[0]) => {
              const isOwner = cal?.ownerId === user?._id;
              return (
                <div
                  key={cal?._id}
                  className={`flex items-center gap-3 p-3 bg-white transition-all ${isOwner ? 'hover:bg-[var(--color-surface-soft)]' : 'opacity-80'} ${cal.syncEnabled === false ? 'grayscale-[0.5] opacity-60' : ''}`}
                >
                  <div className="relative">
                    <Calendar size={16} className={`${isOwner ? 'text-[var(--color-primary)]' : 'text-[var(--color-muted)]'} shrink-0`} />
                    {!isOwner && (
                      <div className="absolute -top-1 -right-1 bg-white rounded-full p-0.5 shadow-xs">
                        <UserCheck size={8} className="text-[var(--color-muted)]" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{cal?.name}</p>
                    <p className="text-xs text-[var(--color-muted)] flex items-center gap-1">
                      {isOwner ? 'Your calendar' : `Added by ${familyMembers.find(m => m._id === cal?.ownerId)?.name || 'Unknown'}`}
                    </p>
                  </div>

                  {/* Color picker trigger */}
                  <div className="relative">
                    <button
                      onClick={() =>
                        isOwner
                          ? setColorPickerOpen(cal?._id ?? null)
                          : undefined
                      }
                      className={`w-6 h-6 rounded-full border shadow-sm transition-transform hover:scale-110 active:scale-95 ${
                        isOwner ? "cursor-pointer" : "cursor-default"
                      }`}
                      style={{ backgroundColor: cal?.color ?? "var(--color-badge-blue)" }}
                      title={isOwner ? "Change calendar color" : "Calendar color"}
                    />
                  </div>


                  {/* Assignee selector */}
                  <div className="relative">
                    <button
                      onClick={() =>
                        isOwner
                          ? setAssigneeDropdownOpen(
                              assigneeDropdownOpen === cal?._id ? null : cal?._id ?? null
                            )
                          : undefined
                      }
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                        isOwner
                          ? "border-[var(--color-hairline)] hover:bg-black/5 cursor-pointer"
                          : "border-transparent bg-[var(--color-surface-soft)] cursor-default"
                      }`}
                      title={isOwner ? "Change assignee" : "Only the owner can change the assignee"}
                    >
                      <UserCheck size={12} />
                      {familyMembers.find(m => m._id === cal?.assigneeId)?.name || 'Unknown'}
                      {isOwner && <ChevronDown size={12} />}
                    </button>

                    {assigneeDropdownOpen === cal?._id && (
                      <div className="absolute right-0 top-full mt-1 bg-white border border-[var(--color-hairline)] rounded-lg shadow-lg z-50 min-w-[160px] py-1">
                        {(familyMembers ?? []).map((member: NonNullable<typeof familyMembers>[0]) => (
                          <button
                            key={member._id}
                            onClick={() => handleAssigneeChange(cal!._id, member._id)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--color-surface-soft)] transition-colors"
                          >
                            <div
                              className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 aspect-square overflow-hidden"
                              style={{ backgroundColor: member.colorCode ?? "var(--color-primary)" }}
                            >
                              {member.name.charAt(0).toUpperCase()}
                            </div>
                            {member.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Sync Toggle — only for owner */}
                  {isOwner && (
                    <div className="flex items-center gap-2 pl-2 border-l border-[var(--color-hairline)]">
                      <input
                        type="checkbox"
                        id={`sync-${cal._id}`}
                        checked={cal.syncEnabled !== false}
                        onChange={(e) => handleToggleSync(cal._id, e.target.checked)}
                        className="w-4 h-4 rounded border-[var(--color-hairline)] text-[var(--color-primary)] focus:ring-[var(--color-primary)] cursor-pointer"
                      />
                      <label htmlFor={`sync-${cal._id}`} className="text-[10px] font-bold uppercase tracking-tight text-[var(--color-muted)] cursor-pointer select-none">
                        Sync
                      </label>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="text-center py-12 border-2 border-dashed border-[var(--color-hairline)] rounded-xl text-[var(--color-muted)]">
          <Calendar size={32} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium">No calendars connected yet</p>
          <p className="text-sm mt-1">Connect a Google account above to get started.</p>
        </div>
      )}

      {/* Setup instructions */}
      <details className="text-sm text-[var(--color-muted)]">
        <summary className="cursor-pointer font-medium hover:text-[var(--color-ink)] transition-colors">
          Setup instructions
        </summary>
        <div className="mt-3 p-4 bg-[var(--color-surface-soft)] rounded-lg space-y-2 text-xs leading-relaxed">
          <p>1. Add <code className="bg-black/5 px-1 rounded">VITE_GOOGLE_CLIENT_ID</code> and <code className="bg-black/5 px-1 rounded">GOOGLE_CLIENT_ID</code> + <code className="bg-black/5 px-1 rounded">GOOGLE_CLIENT_SECRET</code> to your <code className="bg-black/5 px-1 rounded">.env.local</code> and Convex environment variables.</p>
          <p>2. In Google Cloud Console, add <code className="bg-black/5 px-1 rounded">{window.location.origin}/google-oauth-callback</code> as an Authorized Redirect URI.</p>
          <p>3. Enable the <strong>Google Calendar API</strong> in your Google Cloud project.</p>
          <a
            href="https://console.cloud.google.com/apis/credentials"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[var(--color-primary)] hover:underline"
          >
            Open Google Cloud Console <ExternalLink size={10} />
          </a>
        </div>
      </details>

      <ColorPickerModal
        isOpen={colorPickerOpen !== null}
        onClose={() => setColorPickerOpen(null)}
        selectedColor={(calendars ?? []).find(c => c?._id === colorPickerOpen)?.color}
        onSelect={(color) => {
          if (colorPickerOpen) {
            handleColorChange(colorPickerOpen as Id<"calendars">, color);
          }
        }}
        title="Calendar Color"
      />
    </div>
  );
}
