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
import { useEffect, useState } from "react";
import { AIAnalysis } from "./components/AIAnalysis";
import { Charts } from "./components/Charts";
import { Community } from "./components/Community";
import { Dashboard } from "./components/Dashboard";
import { Profile } from "./components/Profile";

// ─── Tab types ────────────────────────────────────────────────
type Tab = "dashboard" | "charts" | "ai" | "community" | "profile";

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
            <Dashboard onChartOpen={handleChartOpen} />
          )}
          {activeTab === "charts" && (
            <Charts initialSymbol={chartSymbol} isDark={isDark} />
          )}
          {activeTab === "ai" && <AIAnalysis />}
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
                onClick={() => setActiveTab(id)}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors min-h-[44px] ${
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                aria-label={label}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon
                  className={`h-5 w-5 transition-transform ${isActive ? "scale-110" : ""}`}
                />
                <span
                  className={`text-[10px] font-medium transition-colors ${
                    isActive ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {label}
                </span>
                {isActive && (
                  <span className="absolute bottom-1 h-0.5 w-8 bg-primary rounded-full" />
                )}
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
