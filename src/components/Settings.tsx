import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { motion, AnimatePresence } from "framer-motion";
import FamilySettings from "./FamilySettings";
import AccountSettings from "./AccountSettings";
import GoogleCalendarSettings from "./GoogleCalendarSettings";
import Logbook from "./Logbook";
import { User, Users, Calendar, ChevronRight, ChevronLeft, BookOpen, Settings2, Check, Database } from "lucide-react";
import { FilterMode } from "../lib/filterUtils";
import ImportData from "./ImportData";

type SettingsView = "main" | "family" | "calendar" | "account" | "logbook" | "preferences" | "import";

export default function Settings({ filterMode }: { filterMode: FilterMode }) {
  const [view, setView] = useState<SettingsView>(() => {
    // Auto-switch to Calendar view when returning from Google OAuth
    const params = new URLSearchParams(window.location.search);
    return params.get("state") === "google-calendar" ? "calendar" : "main";
  });

  const currentUser = useQuery(api.users.getCurrentUser);
  const updatePreferences = useMutation(api.users.updatePreferences);

  // Handle hardware back button / popstate if needed (optional for web but good for UX)
  useEffect(() => {
    if (view !== "main") {
      const handlePopState = () => setView("main");
      window.addEventListener("popstate", handlePopState);
      return () => window.removeEventListener("popstate", handlePopState);
    }
  }, [view]);

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? "100%" : "-100%",
      opacity: 1,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: direction < 0 ? "100%" : "-100%",
      opacity: 1,
    }),
  };

  const moveTasksPreference = currentUser?.preferences?.moveTasksToLogbook || "next_day";

  return (
    <div className="relative h-screen overflow-hidden bg-white">
      <AnimatePresence initial={false} custom={view === "main" ? -1 : 1}>
        {view === "main" && (
          <motion.div
            key="main"
            custom={-1}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="absolute inset-0 px-8 py-10 md:px-14 max-w-4xl mx-auto overflow-y-auto flex flex-col justify-center"
          >
            <div className="space-y-4">
              <SettingsGroup 
                icon={<User size={22} className="text-[#007aff]" />}
                title="Account"
                onClick={() => setView("account")}
              />
              <SettingsGroup 
                icon={<Users size={22} className="text-[#af52de]" />}
                title="Family"
                onClick={() => setView("family")}
              />
              <SettingsGroup 
                icon={<Settings2 size={22} className="text-[#8e8e93]" />}
                title="Preferences"
                onClick={() => setView("preferences")}
              />
              <SettingsGroup 
                icon={<Calendar size={22} className="text-[#34c759]" />}
                title="Calendar Sync"
                onClick={() => setView("calendar")}
              />
              <SettingsGroup 
                icon={<BookOpen size={22} className="text-[#32ade6]" />}
                title="Logbook"
                onClick={() => setView("logbook")}
              />
              <SettingsGroup 
                icon={<Database size={22} className="text-[#ff9500]" />}
                title="Data & Import"
                onClick={() => setView("import")}
              />
            </div>
          </motion.div>
        )}

        {view === "family" && (
          <motion.div
            key="family"
            custom={1}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="absolute inset-0"
          >
            <FamilySettings onBack={() => setView("main")} />
          </motion.div>
        )}

        {view === "account" && (
          <motion.div
            key="account"
            custom={1}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="absolute inset-0"
          >
            <AccountSettings onBack={() => setView("main")} />
          </motion.div>
        )}

        {view === "preferences" && (
          <motion.div
            key="preferences"
            custom={1}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="absolute inset-0 bg-white"
          >
            <div className="flex flex-col h-full">
              <div className="px-6 py-4 border-b border-[var(--color-hairline)] flex items-center gap-4 sticky top-0 bg-white z-10">
                <button 
                  onClick={() => setView("main")}
                  className="p-2 -ml-2 hover:bg-[var(--color-surface-soft)] rounded-full transition-colors text-[var(--color-muted)]"
                >
                  <ChevronLeft size={24} />
                </button>
                <h2 className="text-xl font-bold tracking-tight">Preferences</h2>
              </div>
              <div className="flex-1 overflow-y-auto px-6 py-8">
                <div className="max-w-3xl mx-auto space-y-8">
                  <section>
                    <h3 className="text-sm font-bold text-[var(--color-muted)] uppercase tracking-wider mb-4 px-1">Task Management</h3>
                    <div className="bg-[var(--color-surface-soft)]/50 rounded-3xl overflow-hidden border border-[var(--color-hairline)]">
                      <div className="px-6 py-5 border-b border-[var(--color-hairline)]">
                        <p className="font-bold text-lg mb-1">Move tasks to Logbook</p>
                        <p className="text-sm text-[var(--color-muted)]">Choose when completed tasks are moved out of your main view.</p>
                      </div>
                      
                      <button 
                        onClick={() => updatePreferences({ moveTasksToLogbook: "immediately" })}
                        className="w-full flex items-center justify-between px-6 py-4 hover:bg-white transition-colors group"
                      >
                        <span className={`text-base ${moveTasksPreference === "immediately" ? "font-bold" : "font-medium"}`}>Immediately after completion</span>
                        {moveTasksPreference === "immediately" && <Check size={20} className="text-[#007aff]" />}
                      </button>
                      
                      <button 
                        onClick={() => updatePreferences({ moveTasksToLogbook: "next_day" })}
                        className="w-full flex items-center justify-between px-6 py-4 hover:bg-white transition-colors group border-t border-[var(--color-hairline)]"
                      >
                        <span className={`text-base ${moveTasksPreference === "next_day" ? "font-bold" : "font-medium"}`}>The next day</span>
                        {moveTasksPreference === "next_day" && <Check size={20} className="text-[#007aff]" />}
                      </button>
                    </div>
                    <div className="bg-[var(--color-surface-soft)]/50 rounded-3xl overflow-hidden border border-[var(--color-hairline)] mt-6">
                      <div className="px-6 py-5 border-b border-[var(--color-hairline)]">
                        <p className="font-bold text-lg mb-1">Past Due Tasks</p>
                        <p className="text-sm text-[var(--color-muted)]">Choose how incomplete tasks with past dates are displayed on the Dashboard.</p>
                      </div>
                      
                      <button 
                        onClick={() => updatePreferences({ pastDueTasks: "today" })}
                        className="w-full flex items-center justify-between px-6 py-4 hover:bg-white transition-colors group"
                      >
                        <span className={`text-base ${(currentUser?.preferences?.pastDueTasks || "today") === "today" ? "font-bold" : "font-medium"}`}>Show in Today (Default)</span>
                        {(currentUser?.preferences?.pastDueTasks || "today") === "today" && <Check size={20} className="text-[#007aff]" />}
                      </button>
                      
                      <button 
                        onClick={() => updatePreferences({ pastDueTasks: "past" })}
                        className="w-full flex items-center justify-between px-6 py-4 hover:bg-white transition-colors group border-t border-[var(--color-hairline)]"
                      >
                        <span className={`text-base ${currentUser?.preferences?.pastDueTasks === "past" ? "font-bold" : "font-medium"}`}>Show in Overdue</span>
                        {currentUser?.preferences?.pastDueTasks === "past" && <Check size={20} className="text-[#007aff]" />}
                      </button>
                      
                      <button 
                        onClick={() => updatePreferences({ pastDueTasks: "timeline" })}
                        className="w-full flex items-center justify-between px-6 py-4 hover:bg-white transition-colors group border-t border-[var(--color-hairline)]"
                      >
                        <span className={`text-base ${currentUser?.preferences?.pastDueTasks === "timeline" ? "font-bold" : "font-medium"}`}>Show only in Timeline</span>
                        {currentUser?.preferences?.pastDueTasks === "timeline" && <Check size={20} className="text-[#007aff]" />}
                      </button>
                    </div>
                  </section>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {view === "calendar" && (
          <motion.div
            key="calendar"
            custom={1}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="absolute inset-0 bg-white"
          >
            <div className="flex flex-col h-full">
              <div className="px-6 py-4 border-b border-[var(--color-hairline)] flex items-center gap-4 sticky top-0 bg-white z-10">
                <button 
                  onClick={() => setView("main")}
                  className="p-2 -ml-2 hover:bg-[var(--color-surface-soft)] rounded-full transition-colors text-[var(--color-muted)]"
                >
                  <ChevronLeft size={24} />
                </button>
                <h2 className="text-xl font-bold tracking-tight">Calendar Sync</h2>
              </div>
              <div className="flex-1 overflow-y-auto px-6 py-8">
                <div className="max-w-3xl mx-auto">
                  <GoogleCalendarSettings />
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {view === "logbook" && (
          <motion.div
            key="logbook"
            custom={1}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="absolute inset-0 bg-white"
          >
            <div className="flex flex-col h-full">
              <div className="px-6 py-4 border-b border-[var(--color-hairline)] flex items-center gap-4 sticky top-0 bg-white z-10">
                <button 
                  onClick={() => setView("main")}
                  className="p-2 -ml-2 hover:bg-[var(--color-surface-soft)] rounded-full transition-colors text-[var(--color-muted)]"
                >
                  <ChevronLeft size={24} />
                </button>
                <h2 className="text-xl font-bold tracking-tight">Logbook</h2>
              </div>
              <div className="flex-1 overflow-y-auto">
                <Logbook filterMode={filterMode} hideHeader={true} />
              </div>
            </div>
          </motion.div>
        )}
        {view === "import" && (
          <motion.div
            key="import"
            custom={1}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="absolute inset-0"
          >
            <ImportData onBack={() => setView("main")} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SettingsGroup({ icon, title, onClick, badge }: { 
  icon: React.ReactNode, 
  title: string, 
  onClick: () => void,
  badge?: string | number
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between p-5 rounded-3xl bg-white hover:bg-[var(--color-surface-soft)]/50 active:scale-[0.98] transition-all group border border-transparent hover:border-[var(--color-hairline)]"
    >
      <div className="flex items-center gap-4">
        <div className="text-[var(--color-muted)] group-hover:text-black transition-colors">
          {icon}
        </div>
        <h3 className="text-xl font-bold tracking-tight">{title}</h3>
      </div>
      <div className="flex items-center gap-3">
        {badge !== undefined && (
          <span className="text-sm font-bold text-[var(--color-muted)] bg-[var(--color-surface-soft)] px-2.5 py-1 rounded-full group-hover:bg-white border border-transparent group-hover:border-[var(--color-hairline)] transition-all">
            {badge}
          </span>
        )}
        <ChevronRight size={20} className="text-[var(--color-muted)] group-hover:text-black transition-colors" />
      </div>
    </button>
  );
}
