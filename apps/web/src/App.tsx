import { useEffect } from "react";
import { useApp, type Tab } from "./store";
import { syncManager } from "./sync-supabase";
import { OnboardingFlow } from "./OnboardingFlow";
import HomePage from "./pages/Home";
import LearnPage from "./pages/Learn";
import PracticePage from "./pages/Practice";
import ProgressPage from "./pages/Progress";
import CoachPage from "./pages/Coach";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "home", label: "Home", icon: "⌂" },
  { id: "learn", label: "Learn", icon: "▤" },
  { id: "practice", label: "Practice", icon: "▶" },
  { id: "progress", label: "Progress", icon: "◔" },
  { id: "coach", label: "Coach", icon: "✎" },
];

export default function App() {
  const ready = useApp((s) => s.ready);
  const activeLearnerId = useApp((s) => s.activeLearnerId);
  const activeSession = useApp((s) => s.activeSession);
  const tab = useApp((s) => s.tab);
  const setTab = useApp((s) => s.setTab);

  useEffect(() => {
    if (!ready) return;
    void syncManager.refreshPending();
    void syncManager.sync();
    const onOnline = () => void syncManager.sync();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [ready]);

  if (!ready) {
    return <div className="app-shell items-center justify-center text-ink-dim">Loading…</div>;
  }
  if (!activeLearnerId) {
    return <OnboardingFlow />;
  }

  return (
    <div className="app-shell">
      <header className="px-4 py-3 border-b border-line flex items-center justify-between">
        <span className="font-bold">Zivvvo</span>
        <span className="text-xs text-ink-dim">{activeLearnerId}</span>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4">
        {activeSession ? (
          <PracticePage />
        ) : tab === "home" ? (
          <HomePage />
        ) : tab === "learn" ? (
          <LearnPage />
        ) : tab === "practice" ? (
          <PracticePage />
        ) : tab === "progress" ? (
          <ProgressPage />
        ) : (
          <CoachPage />
        )}
      </main>

      <nav className="safe-bottom grid grid-cols-5 border-t border-line bg-surface">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex flex-col items-center gap-1 py-2 text-xs ${
              tab === t.id ? "text-primary" : "text-ink-dim"
            }`}
          >
            <span className="text-base leading-none">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}