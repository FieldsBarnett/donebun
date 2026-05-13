import { BrowserRouter, Routes, Route, NavLink, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { useConvexAuth, useMutation } from "convex/react";
import { authClient } from "./lib/auth-client";
import Dashboard from "./components/Dashboard";
import Timeline from "./components/Timeline";
import CalendarView from "./components/CalendarView";
import Unscheduled from "./components/Unscheduled";
import Logbook from "./components/Logbook";
import Settings from "./components/Settings";
import QuickEntry from "./components/QuickEntry";
import VoiceEntry from "./components/VoiceEntry";
import InviteLanding from "./components/InviteLanding";
import { api } from "../convex/_generated/api";
import { Users, User, LayoutDashboard, CalendarDays, Calendar, Inbox, Settings as SettingsIcon, BookOpen, Plus, Mic as MicIcon, X } from "lucide-react";
import { FilterMode } from "./lib/filterUtils";

/**
 * Thin redirect page for the Google OAuth callback.
 * It receives ?code=...&state=google-calendar and immediately
 * navigates to /settings so the GoogleCalendarSettings component
 * can pick up the code and call exchangeCode.
 */
function GoogleOAuthCallback() {
  const navigate = useNavigate();
  useEffect(() => {
    // Preserve the full search string so Settings can read ?code=
    navigate("/settings" + window.location.search, { replace: true });
  }, [navigate]);
  return <div className="h-screen flex items-center justify-center">Connecting to Google…</div>;
}

function Layout({ 
  children, 
  filterMode, 
  onToggleFilter 
}: { 
  children: React.ReactNode; 
  filterMode: FilterMode; 
  onToggleFilter: () => void;
}) {
  const [isQuickEntryOpen, setIsQuickEntryOpen] = useState(false);
  const voiceEntryRef = useRef<{ startRecording: () => void; stopRecording: () => void; cancelRecording: () => void; isRecording: boolean } | null>(null);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [voiceRecording, setVoiceRecording] = useState(false);

  const toggleQuickEntry = () => {
    setIsQuickEntryOpen(prev => !prev);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input or textarea
      if (
        e.key === "n" && 
        !isQuickEntryOpen &&
        document.activeElement?.tagName !== "INPUT" && 
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        setIsQuickEntryOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isQuickEntryOpen]);

  return (
    <div className="flex h-[100dvh] bg-[var(--color-canvas)] text-[var(--color-ink)] flex-col md:flex-row font-system overflow-hidden">
      

      {/* Desktop Sidebar Navigation */}
      <nav className="hidden md:flex flex-col w-64 border-r border-[var(--color-hairline)] bg-[var(--color-surface-sidebar)] p-4 shrink-0">
        <div className="mb-4 mt-2 px-2">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--color-muted)]">DoneBun</span>
        </div>

        <div className="space-y-[2px] flex-1">
          <NavLink to="/" end className={({ isActive }) => `flex items-center gap-2.5 px-3 py-1.5 rounded-md transition-colors ${isActive ? 'bg-[var(--color-primary)] text-white font-medium' : 'hover:bg-black/5 text-[var(--color-ink)]'}`}>
            {({ isActive }) => <><LayoutDashboard size={18} className={isActive ? 'text-white' : 'text-[var(--color-primary)]'} /> Dashboard</>}
          </NavLink>
          <NavLink to="/timeline" className={({ isActive }) => `flex items-center gap-2.5 px-3 py-1.5 rounded-md transition-colors ${isActive ? 'bg-[var(--color-primary)] text-white font-medium' : 'hover:bg-black/5 text-[var(--color-ink)]'}`}>
            {({ isActive }) => <><CalendarDays size={18} className={isActive ? 'text-white' : 'text-[var(--color-yellow)]'} /> Timeline</>}
          </NavLink>
          <NavLink to="/calendar" className={({ isActive }) => `flex items-center gap-2.5 px-3 py-1.5 rounded-md transition-colors ${isActive ? 'bg-[var(--color-primary)] text-white font-medium' : 'hover:bg-black/5 text-[var(--color-ink)]'}`}>
            {({ isActive }) => <><Calendar size={18} className={isActive ? 'text-white' : 'text-[var(--color-badge-pink)]'} /> Calendar</>}
          </NavLink>
          <NavLink to="/unscheduled" className={({ isActive }) => `flex items-center gap-2.5 px-3 py-1.5 rounded-md transition-colors ${isActive ? 'bg-[var(--color-primary)] text-white font-medium' : 'hover:bg-black/5 text-[var(--color-ink)]'}`}>
            {({ isActive }) => <><Inbox size={18} className={isActive ? 'text-white' : 'text-[var(--color-muted)]'} /> Unscheduled</>}
          </NavLink>
          <NavLink to="/logbook" className={({ isActive }) => `flex items-center gap-2.5 px-3 py-1.5 rounded-md transition-colors ${isActive ? 'bg-[var(--color-primary)] text-white font-medium' : 'hover:bg-black/5 text-[var(--color-ink)]'}`}>
            {({ isActive }) => <><BookOpen size={18} className={isActive ? 'text-white' : 'text-[var(--color-badge-green)]'} /> Logbook</>}
          </NavLink>
        </div>

        <div className="mt-auto pt-4 border-t border-[var(--color-hairline)] space-y-2">
          {/* Desktop Filter Toggle */}
          <button 
            onClick={onToggleFilter}
            className="flex items-center gap-2.5 px-3 py-1.5 w-full rounded-md transition-colors hover:bg-black/5 text-[var(--color-ink)]"
          >
            {filterMode === "personal" && (
              <><User size={18} className="text-[var(--color-badge-blue)]" /> Personal</>
            )}
            {filterMode === "family" && (
              <><Users size={18} className="text-[var(--color-badge-purple)]" /> Family</>
            )}
            {filterMode === "everyone" && (
              <><Users size={18} className="text-[var(--color-badge-pink)]" /> Everyone</>
            )}
          </button>

          <NavLink to="/settings" className={({ isActive }) => `flex items-center gap-2.5 px-3 py-1.5 rounded-md transition-colors ${isActive ? 'bg-[var(--color-primary)] text-white font-medium' : 'hover:bg-black/5 text-[var(--color-ink)]'}`}>
            {({ isActive }) => <><SettingsIcon size={18} className={isActive ? 'text-white' : 'text-[var(--color-muted)]'} /> Settings</>}
          </NavLink>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden flex flex-col bg-[var(--color-canvas)] mb-16 md:mb-0">
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation & Filter */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-[var(--color-hairline)] flex flex-col z-50 px-safe pb-safe shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
        {/* Mobile Filter Toggle (Top of bottom nav) */}
        <div className="flex justify-center -mt-4 mb-1">
          <button 
            onClick={onToggleFilter}
            className="flex items-center gap-2 px-4 py-1.5 bg-white border border-[var(--color-hairline)] shadow-sm rounded-full transition-colors font-medium text-sm text-[var(--color-ink)]"
          >
            {filterMode === "personal" && (
              <><User size={16} className="text-[var(--color-badge-blue)]" /> Personal</>
            )}
            {filterMode === "family" && (
              <><Users size={16} className="text-[var(--color-badge-purple)]" /> Family</>
            )}
            {filterMode === "everyone" && (
              <><Users size={16} className="text-[var(--color-badge-pink)]" /> Everyone</>
            )}
          </button>
        </div>
        
        {/* Mobile Nav Links */}
        <div className="flex items-center justify-around h-16 px-2 pb-5">
          <NavLink to="/" end className={({ isActive }) => `flex flex-col items-center justify-center w-full h-full ${isActive ? 'text-[var(--color-primary)]' : 'text-[var(--color-muted)] hover:text-black'}`}>
            <LayoutDashboard size={22} />
          </NavLink>
          <NavLink to="/timeline" className={({ isActive }) => `flex flex-col items-center justify-center w-full h-full ${isActive ? 'text-[var(--color-primary)]' : 'text-[var(--color-muted)] hover:text-black'}`}>
            <CalendarDays size={22} />
          </NavLink>
          <NavLink to="/calendar" className={({ isActive }) => `flex flex-col items-center justify-center w-full h-full ${isActive ? 'text-[var(--color-primary)]' : 'text-[var(--color-muted)] hover:text-black'}`}>
            <Calendar size={22} />
          </NavLink>
          <NavLink to="/unscheduled" className={({ isActive }) => `flex flex-col items-center justify-center w-full h-full ${isActive ? 'text-[var(--color-primary)]' : 'text-[var(--color-muted)] hover:text-black'}`}>
            <Inbox size={22} />
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => `flex flex-col items-center justify-center w-full h-full ${isActive ? 'text-[var(--color-primary)]' : 'text-[var(--color-muted)] hover:text-black'}`}>
            <SettingsIcon size={22} />
          </NavLink>
        </div>
      </div>

      {/* FAB + Voice Button cluster */}
      <div className="fixed bottom-20 md:bottom-8 right-6 flex flex-col items-center gap-3 z-[60]">
        {/* Cancel button (only when recording) */}
        {voiceRecording && (
          <button
            onClick={() => voiceEntryRef.current?.cancelRecording()}
            className="w-12 h-12 rounded-full bg-white border border-[var(--color-hairline)] shadow-lg flex items-center justify-center text-red-500 hover:bg-red-50 transition-all animate-modal-in z-10"
            aria-label="Cancel recording"
          >
            <X size={22} />
          </button>
        )}
        {/* Voice mic button */}
        <button
          onPointerDown={(e) => {
            e.preventDefault();
            setVoiceOpen(true);
            // Small delay to let VoiceEntry mount before we signal it
            setTimeout(() => voiceEntryRef.current?.startRecording(), 50);
          }}
          onPointerUp={() => {
            if (voiceEntryRef.current?.isRecording) {
              voiceEntryRef.current.stopRecording();
            }
          }}
          onContextMenu={(e) => e.preventDefault()}
          className={`relative w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 select-none touch-none ${
            voiceRecording
              ? 'bg-red-500 scale-110 shadow-red-500/40 shadow-xl'
              : 'bg-[var(--color-surface-sidebar)] border border-[var(--color-hairline)] hover:scale-105 active:scale-95'
          }`}
          aria-label={voiceRecording ? 'Stop recording' : 'Start voice recording'}
        >
          {voiceRecording && <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-50 pointer-events-none" />}
          <MicIcon size={22} className={voiceRecording ? 'text-white relative z-10' : 'text-[var(--color-muted)]'} />
        </button>
        {/* FAB */}
        <button
          onClick={toggleQuickEntry}
          className="w-14 h-14 bg-[var(--color-primary)] text-white rounded-full shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-all group"
          aria-label="Create new task"
        >
          <Plus size={28} className="group-hover:rotate-90 transition-transform duration-200" />
        </button>
      </div>

      {/* Quick Entry Modal */}
      <QuickEntry
        isOpen={isQuickEntryOpen}
        onClose={() => setIsQuickEntryOpen(false)}
      />

      {/* Voice Entry */}
      <VoiceEntry
        isOpen={voiceOpen}
        onClose={() => { setVoiceOpen(false); setVoiceRecording(false); }}
        onRecordingChange={setVoiceRecording}
        ref={voiceEntryRef}
      />
    </div>
  );
}

function AppContent() {
  const storeUser = useMutation(api.users.store);
  const [filterMode, setFilterMode] = useState<FilterMode>(() => {
    const saved = localStorage.getItem("donebun_filter_mode") as FilterMode;
    return (["personal", "family", "everyone"].includes(saved)) ? saved : "personal";
  });

  useEffect(() => {
    localStorage.setItem("donebun_filter_mode", filterMode);
  }, [filterMode]);


  useEffect(() => {
    storeUser().catch(console.error);
  }, [storeUser]);

  const toggleFilter = () => {
    setFilterMode(prev => {
      if (prev === "personal") return "family";
      if (prev === "family") return "everyone";
      return "personal";
    });
  };

  return (
    <BrowserRouter>
      <Layout filterMode={filterMode} onToggleFilter={toggleFilter}>
        <Routes>
          <Route path="/" element={<Dashboard filterMode={filterMode} />} />
          <Route path="/timeline" element={<Timeline filterMode={filterMode} />} />
          <Route path="/calendar" element={<CalendarView filterMode={filterMode} />} />
          <Route path="/unscheduled" element={<Unscheduled filterMode={filterMode} />} />
          <Route path="/logbook" element={<Logbook filterMode={filterMode} />} />
          <Route path="/settings" element={<Settings filterMode={filterMode} />} />
          <Route path="/join/:inviteCode" element={<InviteLanding />} />
          <Route path="/google-oauth-callback" element={<GoogleOAuthCallback />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSignUp) {
      await authClient.signUp.email({ email, password, name: email.split("@")[0] });
    } else {
      await authClient.signIn.email({ email, password });
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-[var(--color-surface-soft)] font-system">
      <div className="bg-white p-10 rounded-2xl shadow-sm border border-[var(--color-hairline)] flex flex-col items-center w-96 max-w-full">
        <h1 className="text-3xl font-bold tracking-tight mb-2">DoneBun</h1>
        <p className="text-[var(--color-muted)] mb-8 text-center">{isSignUp ? "Create an account" : "Sign in to sync your family tasks."}</p>
        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
          <input 
            type="email" 
            placeholder="Email" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2 border border-[var(--color-hairline)] rounded-lg focus:outline-none focus:border-[var(--color-primary)]"
            required
          />
          <input 
            type="password" 
            placeholder="Password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2 border border-[var(--color-hairline)] rounded-lg focus:outline-none focus:border-[var(--color-primary)]"
            required
          />
          <button 
            type="submit" 
            className="bg-[var(--color-primary)] text-white font-medium px-6 py-2.5 rounded-lg w-full hover:bg-[#005bb5] transition-colors mt-2"
          >
            {isSignUp ? "Sign Up" : "Sign In"}
          </button>
        </form>
        <button 
          onClick={() => setIsSignUp(!isSignUp)}
          className="text-sm text-[var(--color-muted)] mt-6 hover:text-black transition-colors"
        >
          {isSignUp ? "Already have an account? Sign in" : "Need an account? Sign up"}
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const { isAuthenticated, isLoading } = useConvexAuth();

  if (isLoading) {
    return <div className="h-screen flex items-center justify-center bg-[var(--color-canvas)] font-system text-[var(--color-muted)]">Loading...</div>;
  }

  if (!isAuthenticated) {
    return <SignIn />;
  }

  return <AppContent />;
}
