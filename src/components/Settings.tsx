import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { motion, AnimatePresence } from "framer-motion";
import FamilySettings from "./FamilySettings";
import AccountSettings from "./AccountSettings";
import GoogleCalendarSettings from "./GoogleCalendarSettings";
import Logbook from "./Logbook";
import { User, Users, Calendar, ChevronRight, ChevronLeft, BookOpen } from "lucide-react";
import { filterTasks, FilterMode } from "../lib/filterUtils";

type SettingsView = "main" | "family" | "calendar" | "account" | "logbook";

export default function Settings({ filterMode }: { filterMode: FilterMode }) {
  const [view, setView] = useState<SettingsView>(() => {
    // Auto-switch to Calendar view when returning from Google OAuth
    const params = new URLSearchParams(window.location.search);
    return params.get("state") === "google-calendar" ? "calendar" : "main";
  });

  const currentUser = useQuery(api.users.getCurrentUser);
  const tasks = useQuery(api.tasks.getTasks) || [];

  const completedCount = filterTasks(tasks, currentUser, filterMode)
    .filter((t: any) => t.status === "completed").length;

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
                icon={<Calendar size={22} className="text-[#34c759]" />}
                title="Calendar Sync"
                onClick={() => setView("calendar")}
              />
              <SettingsGroup 
                icon={<BookOpen size={22} className="text-[#32ade6]" />}
                title="Logbook"
                badge={completedCount > 0 ? completedCount : undefined}
                onClick={() => setView("logbook")}
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
