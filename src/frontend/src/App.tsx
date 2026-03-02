import { Toaster } from "@/components/ui/sonner";
import {
  AlertTriangle,
  BarChart2,
  Brain,
  Moon,
  Sun,
  TrendingUp,
  User,
  Users,
} from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { AIAnalysis } from "./components/AIAnalysis";
import { Charts } from "./components/Charts";
import { Community } from "./components/Community";
import { Dashboard } from "./components/Dashboard";
import { Profile } from "./components/Profile";

// ─── Tab types ────────────────────────────────────────────────
type Tab = "dashboard" | "charts" | "ai" | "community" | "profile";

// Shared state for quick analyze: symbol passed from Dashboard to AI tab
export type QuickAnalyzeState = { symbol: string; ts: number } | null;

interface NavItem {
  id: Tab;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Markets", Icon: BarChart2 },
  { id: "charts", label: "Charts", Icon: TrendingUp },
  { id: "ai", label: "AI", Icon: Brain },
  { id: "community", label: "Community", Icon: Users },
  { id: "profile", label: "Profile", Icon: User },
];

// ─── Theme helpers ────────────────────────────────────────────
function getInitialTheme(): "dark" | "light" {
  try {
    const stored = localStorage.getItem("smart-trade-theme") as
      | "dark"
      | "light"
      | null;
    if (stored === "dark" || stored === "light") return stored;
  } catch {
    // ignore
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(theme: "dark" | "light") {
  const html = document.documentElement;
  if (theme === "dark") {
    html.classList.add("dark");
  } else {
    html.classList.remove("dark");
  }
  try {
    localStorage.setItem("smart-trade-theme", theme);
  } catch {
    // ignore
  }
}

// ─── Root App Component ───────────────────────────────────────
export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [theme, setTheme] = useState<"dark" | "light">(getInitialTheme);
  const [chartSymbol, setChartSymbol] = useState<string | undefined>(undefined);
  const [quickAnalyze, setQuickAnalyze] = useState<QuickAnalyzeState>(null);

  // Apply theme on mount and changes
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const handleChartOpen = (symbol: string) => {
    setChartSymbol(symbol);
    setActiveTab("charts");
  };

  const handleQuickAnalyze = (symbol: string) => {
    setQuickAnalyze({ symbol, ts: Date.now() });
    setActiveTab("ai");
  };

  const isDark = theme === "dark";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* ── Top bar ────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-center justify-between px-4 h-14 max-w-2xl mx-auto w-full">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-primary flex items-center justify-center shrink-0">
              <TrendingUp className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-base tracking-tight text-foreground">
              Smart Trade <span className="text-primary">AI</span>
            </span>
          </div>

          {/* Theme toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            className="h-8 w-8 rounded-md border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDark ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </button>
        </div>
      </header>

      {/* ── Disclaimer banner ──────────────────────────────── */}
      <div className="bg-gold/10 border-b border-gold/20 px-4 py-1.5">
        <p className="text-[11px] text-center text-gold flex items-center justify-center gap-1.5 max-w-2xl mx-auto">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          Educational purposes only. Not financial advice. Past performance does
          not guarantee future results.
        </p>
      </div>

      {/* ── Main content ───────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-4 pb-24">
          {activeTab === "dashboard" && (
            <Dashboard
              onChartOpen={handleChartOpen}
              onQuickAnalyze={handleQuickAnalyze}
            />
          )}
          {activeTab === "charts" && (
            <Charts initialSymbol={chartSymbol} isDark={isDark} />
          )}
          {activeTab === "ai" && (
            <AIAnalysis
              quickAnalyze={quickAnalyze}
              onQuickAnalyzeHandled={() => setQuickAnalyze(null)}
            />
          )}
          {activeTab === "community" && <Community />}
          {activeTab === "profile" && <Profile />}
        </div>
      </main>

      {/* ── Bottom navigation ──────────────────────────────── */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur border-t border-border pb-safe">
        <div className="flex items-stretch max-w-2xl mx-auto h-16">
          {NAV_ITEMS.map(({ id, label, Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                type="button"
                key={id}
                data-ocid={`nav.${id}_tab`}
                onClick={() => setActiveTab(id)}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-all min-h-[44px] select-none relative ${
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                aria-label={label}
                aria-current={isActive ? "page" : undefined}
              >
                {/* Active pill indicator */}
                {isActive && (
                  <motion.span
                    layoutId="nav-indicator"
                    className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-10 bg-primary rounded-full"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <div
                  className={`flex items-center justify-center rounded-xl transition-all ${
                    isActive ? "bg-primary/10 px-3 py-1" : "px-2 py-1"
                  }`}
                >
                  <Icon
                    className={`h-5 w-5 transition-transform ${isActive ? "scale-110" : ""}`}
                  />
                </div>
                <span
                  className={`text-[10px] font-medium transition-colors leading-none ${
                    isActive
                      ? "text-primary font-semibold"
                      : "text-muted-foreground"
                  }`}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* ── Toast notifications ────────────────────────────── */}
      <Toaster richColors position="top-center" />
    </div>
  );
}
