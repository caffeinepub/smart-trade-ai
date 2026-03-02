import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  BarChart2,
  BookOpen,
  Bookmark,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  GraduationCap,
  Loader2,
  LogIn,
  LogOut,
  Plus,
  Shield,
  Trash2,
  TrendingDown,
  TrendingUp,
  Trophy,
  User,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";
import type { TradeEntry } from "../backend.d";
import { useInternetIdentity } from "../hooks/useInternetIdentity";
import {
  useAddTradeEntry,
  useAnalysisHistory,
  useDeleteTradeEntry,
  useIsAdmin,
  useRemoveFromWatchlist,
  useTradeEntries,
  useWatchlist,
} from "../hooks/useQueries";
import { AdminPanel } from "./AdminPanel";

// ─── Outcome badge colors ─────────────────────────────────────

function OutcomeBadge({ outcome }: { outcome: string }) {
  const colorMap: Record<string, string> = {
    Win: "bg-bull/15 text-bull border-bull/30",
    Loss: "bg-bear/15 text-bear border-bear/30",
    Breakeven: "bg-gold/15 text-gold border-gold/30",
    Open: "bg-primary/15 text-primary border-primary/30",
  };
  return (
    <Badge
      variant="outline"
      className={`text-[10px] px-1.5 py-0 h-4 font-semibold ${colorMap[outcome] ?? "text-muted-foreground"}`}
    >
      {outcome}
    </Badge>
  );
}

function DirectionBadge({ direction }: { direction: string }) {
  const isBuy = direction.toUpperCase() === "BUY";
  return (
    <Badge
      variant="outline"
      className={`text-[10px] px-1.5 py-0 h-4 font-bold font-mono ${isBuy ? "bg-bull/15 text-bull border-bull/30" : "bg-bear/15 text-bear border-bear/30"}`}
    >
      {direction.toUpperCase()}
    </Badge>
  );
}

// ─── Trading Stats ────────────────────────────────────────────

function TradingStats({ entries }: { entries: TradeEntry[] }) {
  if (entries.length === 0) return null;

  const closedTrades = entries.filter(
    (e) => e.outcome === "Win" || e.outcome === "Loss",
  );
  const wins = entries.filter((e) => e.outcome === "Win").length;
  const winRate =
    closedTrades.length > 0
      ? ((wins / closedTrades.length) * 100).toFixed(1)
      : null;

  const parsePnl = (pnlStr: string): number => {
    const cleaned = pnlStr.replace(/[^0-9.\-+]/g, "");
    const num = Number.parseFloat(cleaned);
    return Number.isNaN(num)
      ? 0
      : pnlStr.startsWith("-")
        ? -Math.abs(num)
        : Math.abs(num);
  };

  const pnlValues = entries
    .filter((e) => e.pnl && e.pnl.trim() !== "")
    .map((e) => ({ raw: parsePnl(e.pnl), pnl: e.pnl }));

  const totalPnl = pnlValues.reduce((sum, v) => sum + v.raw, 0);

  const bestTrade =
    pnlValues.length > 0
      ? pnlValues.reduce((best, curr) => (curr.raw > best.raw ? curr : best))
      : null;
  const worstTrade =
    pnlValues.length > 0
      ? pnlValues.reduce((worst, curr) => (curr.raw < worst.raw ? curr : worst))
      : null;

  const totalPnlStr =
    totalPnl > 0
      ? `+$${totalPnl.toFixed(2)}`
      : totalPnl < 0
        ? `-$${Math.abs(totalPnl).toFixed(2)}`
        : "$0";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5">
        <Trophy className="h-4 w-4 text-gold" />
        <h3 className="text-sm font-semibold text-foreground">Trading Stats</h3>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-card border border-border rounded-xl p-3 text-center space-y-1">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
            Total Trades
          </p>
          <p className="text-2xl font-bold font-mono text-foreground">
            {entries.length}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {closedTrades.length} closed
          </p>
        </div>
        <div className="bg-card border border-border rounded-xl p-3 text-center space-y-1">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
            Win Rate
          </p>
          {winRate !== null ? (
            <>
              <p
                className={`text-2xl font-bold font-mono ${Number.parseFloat(winRate) >= 50 ? "text-bull" : "text-bear"}`}
              >
                {winRate}%
              </p>
              <p className="text-[10px] text-muted-foreground">
                {wins}W / {closedTrades.length - wins}L
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground font-mono">—</p>
          )}
        </div>
        <div className="bg-card border border-border rounded-xl p-3 text-center space-y-1">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
            Total P&amp;L
          </p>
          {pnlValues.length > 0 ? (
            <>
              <p
                className={`text-lg font-bold font-mono ${totalPnl > 0 ? "text-bull" : totalPnl < 0 ? "text-bear" : "text-foreground"}`}
              >
                {totalPnlStr}
              </p>
              <div className="flex items-center justify-center gap-0.5">
                {totalPnl > 0 ? (
                  <TrendingUp className="h-3 w-3 text-bull" />
                ) : totalPnl < 0 ? (
                  <TrendingDown className="h-3 w-3 text-bear" />
                ) : null}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground font-mono">—</p>
          )}
        </div>
        <div className="bg-card border border-border rounded-xl p-3 text-center space-y-1">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
            Best / Worst
          </p>
          {bestTrade && worstTrade ? (
            <>
              <p className="text-sm font-bold font-mono text-bull leading-tight">
                {bestTrade.raw > 0 ? "+" : ""}$
                {Math.abs(bestTrade.raw).toFixed(0)}
              </p>
              <p className="text-sm font-bold font-mono text-bear leading-tight">
                -${Math.abs(worstTrade.raw).toFixed(0)}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground font-mono">—</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Trade Journal ────────────────────────────────────────────

function TradeJournal() {
  const { data: entries = [], isLoading } = useTradeEntries();
  const addEntry = useAddTradeEntry();
  const deleteEntry = useDeleteTradeEntry();
  const [formOpen, setFormOpen] = useState(false);
  const [listExpanded, setListExpanded] = useState(true);

  // Form state
  const [symbol, setSymbol] = useState("");
  const [direction, setDirection] = useState<"BUY" | "SELL">("BUY");
  const [entryPrice, setEntryPrice] = useState("");
  const [exitPrice, setExitPrice] = useState("");
  const [outcome, setOutcome] = useState("Open");
  const [pnl, setPnl] = useState("");
  const [strategy, setStrategy] = useState("");
  const [notes, setNotes] = useState("");

  const resetForm = () => {
    setSymbol("");
    setDirection("BUY");
    setEntryPrice("");
    setExitPrice("");
    setOutcome("Open");
    setPnl("");
    setStrategy("");
    setNotes("");
    setFormOpen(false);
  };

  const handleSave = async () => {
    if (!symbol.trim()) {
      toast.error("Symbol is required");
      return;
    }
    try {
      await addEntry.mutateAsync({
        symbol: symbol.trim(),
        direction,
        entryPrice: entryPrice.trim(),
        exitPrice: exitPrice.trim(),
        outcome,
        pnl: pnl.trim(),
        notes: notes.trim(),
        strategy: strategy.trim(),
      });
      toast.success("Trade saved to journal!");
      resetForm();
    } catch {
      toast.error("Failed to save trade");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteEntry.mutateAsync(id);
      toast.success("Trade removed");
    } catch {
      toast.error("Failed to remove trade");
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-1.5 mb-3">
        <BookOpen className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Trade Journal</h3>
        {entries.length > 0 && (
          <Badge variant="secondary" className="text-[10px] font-mono ml-1">
            {entries.length}
          </Badge>
        )}
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setListExpanded((p) => !p)}
          className="h-7 w-7 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
        >
          {listExpanded ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </button>
        <button
          type="button"
          onClick={() => setFormOpen((p) => !p)}
          className="h-7 w-7 flex items-center justify-center rounded-full border border-primary/30 bg-primary/5 text-primary hover:bg-primary/15 transition-colors"
          aria-label="Add trade"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Add Form */}
      <AnimatePresence>
        {formOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden mb-3"
          >
            <div className="bg-muted/30 border border-border rounded-xl p-4 space-y-3">
              <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5 text-primary" />
                New Trade Entry
              </p>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">
                    Symbol *
                  </p>
                  <Input
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value)}
                    placeholder="BTC/USD"
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">
                    Direction
                  </p>
                  <div className="flex gap-1 h-8">
                    <button
                      type="button"
                      onClick={() => setDirection("BUY")}
                      className={`flex-1 text-xs font-bold rounded-md border transition-all ${direction === "BUY" ? "bg-bull/20 border-bull/50 text-bull" : "border-border text-muted-foreground hover:bg-muted/30"}`}
                    >
                      BUY
                    </button>
                    <button
                      type="button"
                      onClick={() => setDirection("SELL")}
                      className={`flex-1 text-xs font-bold rounded-md border transition-all ${direction === "SELL" ? "bg-bear/20 border-bear/50 text-bear" : "border-border text-muted-foreground hover:bg-muted/30"}`}
                    >
                      SELL
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">
                    Entry Price
                  </p>
                  <Input
                    value={entryPrice}
                    onChange={(e) => setEntryPrice(e.target.value)}
                    placeholder="0.00"
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">
                    Exit Price
                  </p>
                  <Input
                    value={exitPrice}
                    onChange={(e) => setExitPrice(e.target.value)}
                    placeholder="0.00"
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">
                    Outcome
                  </p>
                  <Select value={outcome} onValueChange={setOutcome}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Open">Open</SelectItem>
                      <SelectItem value="Win">Win</SelectItem>
                      <SelectItem value="Loss">Loss</SelectItem>
                      <SelectItem value="Breakeven">Breakeven</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">
                    P&amp;L
                  </p>
                  <Input
                    value={pnl}
                    onChange={(e) => setPnl(e.target.value)}
                    placeholder="+$120"
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">
                  Strategy
                </p>
                <Input
                  value={strategy}
                  onChange={(e) => setStrategy(e.target.value)}
                  placeholder="RSI Strategy, Scalping..."
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">
                  Notes
                </p>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional observations..."
                  className="resize-none text-xs min-h-[52px] rounded-lg"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetForm}
                  className="flex-1 h-8 text-xs rounded-full"
                  disabled={addEntry.isPending}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={addEntry.isPending || !symbol.trim()}
                  className="flex-1 h-8 text-xs rounded-full"
                >
                  {addEntry.isPending ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <BookOpen className="h-3 w-3 mr-1" />
                  )}
                  Save Trade
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Entry list */}
      <AnimatePresence>
        {listExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-lg" />
                ))}
              </div>
            ) : entries.length === 0 ? (
              <div className="bg-muted/20 border border-border/50 rounded-xl p-4 text-center">
                <BookOpen className="h-7 w-7 mx-auto mb-2 text-muted-foreground/30" />
                <p className="text-xs text-muted-foreground font-medium">
                  No trades logged yet
                </p>
                <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                  Tap the + button to log your first trade
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {(entries as TradeEntry[]).map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2.5"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-xs font-bold text-foreground">
                          {entry.symbol}
                        </span>
                        <DirectionBadge direction={entry.direction} />
                        <OutcomeBadge outcome={entry.outcome} />
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {entry.pnl && (
                          <span
                            className={`font-mono text-xs font-semibold ${entry.pnl.startsWith("+") ? "text-bull" : entry.pnl.startsWith("-") ? "text-bear" : "text-muted-foreground"}`}
                          >
                            {entry.pnl}
                          </span>
                        )}
                        {entry.strategy && (
                          <span className="text-[10px] text-muted-foreground truncate max-w-[100px]">
                            {entry.strategy}
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground/60 ml-auto">
                          {new Date(
                            Number(entry.timestamp) / 1_000_000,
                          ).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDelete(entry.id)}
                      disabled={deleteEntry.isPending}
                      className="shrink-0 h-7 w-7 flex items-center justify-center rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      aria-label="Delete trade"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Learning Hub ─────────────────────────────────────────────

interface GlossaryTerm {
  term: string;
  definition: string;
  category: "technical" | "risk" | "strategy" | "fundamental";
}

const GLOSSARY_TERMS: GlossaryTerm[] = [
  {
    term: "Support Level",
    definition:
      "A price level where buying pressure is strong enough to prevent further decline. Price tends to bounce upward when it reaches support.",
    category: "technical",
  },
  {
    term: "Resistance Level",
    definition:
      "A price level where selling pressure prevents further advances. Price often reverses or stalls when it reaches resistance.",
    category: "technical",
  },
  {
    term: "RSI (Relative Strength Index)",
    definition:
      "A momentum oscillator (0–100) measuring speed and change of price movements. Above 70 is overbought; below 30 is oversold.",
    category: "technical",
  },
  {
    term: "MACD",
    definition:
      "Moving Average Convergence Divergence — shows the relationship between two moving averages. A bullish signal occurs when MACD crosses above its signal line.",
    category: "technical",
  },
  {
    term: "Bollinger Bands",
    definition:
      "Three lines around price: a 20-period SMA with upper/lower bands 2 standard deviations away. Price touching upper band may signal overbought conditions.",
    category: "technical",
  },
  {
    term: "Stop Loss",
    definition:
      "A pre-set order to exit a trade if price moves against you by a defined amount. Essential for limiting losses and protecting capital.",
    category: "risk",
  },
  {
    term: "Take Profit",
    definition:
      "A pre-set order to close a trade when price reaches your target profit level. Locks in gains automatically without requiring manual monitoring.",
    category: "risk",
  },
  {
    term: "Risk/Reward Ratio",
    definition:
      "Compares potential profit to potential loss. A 1:2 R:R means risking $1 to make $2. Most professional traders target at least 1:2.",
    category: "risk",
  },
  {
    term: "Position Sizing",
    definition:
      "Determining how much capital to allocate to a single trade. Typically 1–2% of total capital per trade to manage risk.",
    category: "risk",
  },
  {
    term: "Drawdown",
    definition:
      "The peak-to-trough decline in account value. A 20% drawdown requires a 25% gain to recover. Minimizing drawdown is key to long-term success.",
    category: "risk",
  },
  {
    term: "EMA (Exponential Moving Average)",
    definition:
      "A moving average that gives more weight to recent prices. Faster to react than SMA. Common periods: 20, 50, 200.",
    category: "technical",
  },
  {
    term: "Candlestick Chart",
    definition:
      "Displays Open, High, Low, and Close prices for each period. Green (or white) candles = price closed higher; Red candles = price closed lower.",
    category: "fundamental",
  },
  {
    term: "Breakout",
    definition:
      "When price moves decisively above resistance or below support with increased volume, often signaling the start of a new trend.",
    category: "strategy",
  },
  {
    term: "Scalping",
    definition:
      "A fast trading style targeting small price movements (pips/ticks). Positions held for seconds to minutes. Requires tight spreads and high focus.",
    category: "strategy",
  },
  {
    term: "Trend Following",
    definition:
      "A strategy that enters trades in the direction of the established trend. 'The trend is your friend' — ride momentum until reversal signals appear.",
    category: "strategy",
  },
  {
    term: "Fibonacci Retracement",
    definition:
      "Key price levels (23.6%, 38.2%, 61.8%) based on Fibonacci ratios where pullbacks often pause or reverse during a trend.",
    category: "technical",
  },
  {
    term: "Volume",
    definition:
      "The number of units traded in a period. High volume on a breakout confirms strength; low volume breakouts often fail.",
    category: "fundamental",
  },
  {
    term: "Pip",
    definition:
      "The smallest price increment in forex (usually 0.0001 for most pairs). 10 pips on EUR/USD = $1 per standard lot.",
    category: "fundamental",
  },
  {
    term: "Leverage",
    definition:
      "Using borrowed capital to increase trade size. 10:1 leverage means $1,000 controls $10,000. Amplifies both gains and losses — use with caution.",
    category: "risk",
  },
  {
    term: "Confluence",
    definition:
      "When multiple technical signals align at the same price level (e.g., support + RSI oversold + Fibonacci level). Higher confluence = stronger signal.",
    category: "strategy",
  },
];

const CATEGORY_LABELS: Record<GlossaryTerm["category"], string> = {
  technical: "Technical",
  risk: "Risk",
  strategy: "Strategy",
  fundamental: "Fundamentals",
};

const CATEGORY_COLORS: Record<GlossaryTerm["category"], string> = {
  technical: "bg-primary/15 text-primary border-primary/30",
  risk: "bg-bear/15 text-bear border-bear/30",
  strategy: "bg-bull/15 text-bull border-bull/30",
  fundamental: "bg-gold/15 text-gold border-gold/30",
};

function LearningHub() {
  const [expanded, setExpanded] = useState(false);
  const [openTerm, setOpenTerm] = useState<string | null>(null);
  const [filter, setFilter] = useState<GlossaryTerm["category"] | "all">("all");

  const filtered =
    filter === "all"
      ? GLOSSARY_TERMS
      : GLOSSARY_TERMS.filter((t) => t.category === filter);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <button
        type="button"
        data-ocid="learning.toggle"
        className="w-full flex items-center px-4 min-h-[52px] gap-2.5 hover:bg-muted/20 transition-colors"
        onClick={() => setExpanded((p) => !p)}
        aria-expanded={expanded}
      >
        <div className="h-7 w-7 rounded-lg bg-gold/10 flex items-center justify-center shrink-0">
          <GraduationCap className="h-3.5 w-3.5 text-gold" />
        </div>
        <span className="font-bold text-sm text-foreground flex-1 text-left">
          Learning Hub
        </span>
        <Badge
          variant="secondary"
          className="text-[10px] font-mono text-gold shrink-0"
        >
          {GLOSSARY_TERMS.length} terms
        </Badge>
        {expanded ? (
          <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        )}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <Separator />
            {/* Category filter */}
            <div className="px-4 py-2.5 flex gap-1.5 flex-wrap">
              {(
                ["all", "technical", "risk", "strategy", "fundamental"] as const
              ).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setFilter(cat)}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-all min-h-[28px] ${
                    filter === cat
                      ? "bg-primary/15 text-primary border-primary/30"
                      : "border-border text-muted-foreground hover:bg-muted/30"
                  }`}
                >
                  {cat === "all" ? "All" : CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>
            <div className="divide-y divide-border/40 max-h-[420px] overflow-y-auto">
              {filtered.map((item) => (
                <div key={item.term}>
                  <button
                    type="button"
                    data-ocid="learning.term_button"
                    className="w-full flex items-center justify-between px-4 py-3 min-h-[48px] hover:bg-muted/20 transition-colors text-left gap-2"
                    onClick={() =>
                      setOpenTerm((p) => (p === item.term ? null : item.term))
                    }
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-sm font-semibold text-foreground">
                        {item.term}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[9px] px-1.5 h-4 shrink-0 ${CATEGORY_COLORS[item.category]}`}
                      >
                        {CATEGORY_LABELS[item.category]}
                      </Badge>
                    </div>
                    {openTerm === item.term ? (
                      <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    )}
                  </button>
                  <AnimatePresence>
                    {openTerm === item.term && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-3 pt-0.5">
                          <p className="text-xs text-foreground/80 leading-relaxed bg-muted/20 rounded-lg p-3 border border-border/50">
                            {item.definition}
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
            <div className="p-3 border-t border-border/40 text-center">
              <p className="text-[10px] text-muted-foreground/60">
                For educational purposes only. Not financial advice.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main Profile component ───────────────────────────────────

export function Profile() {
  const { identity, login, clear, isLoggingIn, isInitializing } =
    useInternetIdentity();
  const isLoggedIn = !!identity;
  const principal = identity?.getPrincipal().toString() ?? "";

  const { data: watchlist = [], isLoading: watchlistLoading } = useWatchlist();
  const { data: history = [], isLoading: historyLoading } =
    useAnalysisHistory();
  const { data: tradeEntries = [], isLoading: journalLoading } =
    useTradeEntries();
  const { data: isAdmin } = useIsAdmin();
  const removeFromWatchlist = useRemoveFromWatchlist();

  const [copied, setCopied] = useState(false);

  const handleCopyPrincipal = () => {
    void navigator.clipboard.writeText(principal);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRemoveWatchlist = async (symbol: string) => {
    try {
      await removeFromWatchlist.mutateAsync(symbol);
      toast.success(`Removed ${symbol} from watchlist`);
    } catch {
      toast.error("Failed to remove from watchlist");
    }
  };

  if (isInitializing) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-32 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-4">
      {/* Login / Profile card */}
      {!isLoggedIn ? (
        <div className="bg-card border border-border rounded-lg p-6 flex flex-col items-center gap-4 text-center">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="h-8 w-8 text-primary opacity-70" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Sign In</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Access AI analysis, save watchlists, and join the community.
            </p>
          </div>
          <Button
            onClick={login}
            disabled={isLoggingIn}
            className="w-full max-w-xs"
          >
            {isLoggingIn ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <LogIn className="h-4 w-4 mr-2" />
            )}
            {isLoggingIn ? "Connecting..." : "Sign In with Internet Identity"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Secure, password-free authentication on the Internet Computer.
          </p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
              <User className="h-6 w-6 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="font-semibold text-foreground text-sm">
                  My Account
                </p>
                {isAdmin && (
                  <Badge
                    variant="outline"
                    className="text-[10px] text-gold border-gold/30 px-1.5 py-0"
                  >
                    <Shield className="h-2.5 w-2.5 mr-0.5" />
                    Admin
                  </Badge>
                )}
              </div>
              <button
                type="button"
                onClick={handleCopyPrincipal}
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors mt-0.5 group"
              >
                <span className="font-mono truncate max-w-[160px]">
                  {principal.slice(0, 10)}...{principal.slice(-5)}
                </span>
                {copied ? (
                  <Check className="h-3 w-3 text-bull shrink-0" />
                ) : (
                  <Copy className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive h-8 px-2"
              onClick={clear}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Stats — only when logged in */}
      {isLoggedIn && (
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-card border border-border rounded-lg p-3 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Bookmark className="h-3.5 w-3.5 text-primary" />
              <span className="text-[10px] font-medium text-muted-foreground">
                Watchlist
              </span>
            </div>
            {watchlistLoading ? (
              <Skeleton className="h-6 w-8 mx-auto" />
            ) : (
              <p className="text-2xl font-bold text-foreground font-mono">
                {watchlist.length}
              </p>
            )}
          </div>
          <div className="bg-card border border-border rounded-lg p-3 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <BarChart2 className="h-3.5 w-3.5 text-primary" />
              <span className="text-[10px] font-medium text-muted-foreground">
                Analyses
              </span>
            </div>
            {historyLoading ? (
              <Skeleton className="h-6 w-8 mx-auto" />
            ) : (
              <p className="text-2xl font-bold text-foreground font-mono">
                {history.length}
              </p>
            )}
          </div>
          <div className="bg-card border border-border rounded-lg p-3 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <BookOpen className="h-3.5 w-3.5 text-primary" />
              <span className="text-[10px] font-medium text-muted-foreground">
                Journal
              </span>
            </div>
            {journalLoading ? (
              <Skeleton className="h-6 w-8 mx-auto" />
            ) : (
              <p className="text-2xl font-bold text-foreground font-mono">
                {tradeEntries.length}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Watchlist */}
      {isLoggedIn && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Bookmark className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">
              My Watchlist
            </h3>
          </div>

          {watchlistLoading ? (
            <div className="space-y-1.5">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-10 rounded-md" />
              ))}
            </div>
          ) : watchlist.length === 0 ? (
            <div className="bg-accent/30 rounded-lg p-3 text-xs text-muted-foreground text-center">
              Your watchlist is empty. Add symbols from the Dashboard.
            </div>
          ) : (
            <div className="space-y-1.5">
              {watchlist.map((sym) => (
                <div
                  key={sym}
                  className="flex items-center justify-between bg-accent/30 rounded-md px-3 py-2"
                >
                  <span className="font-mono text-sm font-medium text-foreground">
                    {sym}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveWatchlist(sym)}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                    aria-label={`Remove ${sym} from watchlist`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Trading Stats */}
      {isLoggedIn && (tradeEntries as TradeEntry[]).length > 0 && (
        <>
          <Separator />
          <TradingStats entries={tradeEntries as TradeEntry[]} />
        </>
      )}

      {/* Trade Journal */}
      {isLoggedIn && (
        <>
          <Separator />
          <TradeJournal />
        </>
      )}

      {/* Admin Panel */}
      {isLoggedIn && isAdmin && (
        <>
          <Separator />
          <AdminPanel />
        </>
      )}

      {/* Learning Hub — available to everyone */}
      <Separator />
      <LearningHub />

      {/* Footer */}
      <div className="mt-auto pt-2 text-center">
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()}{" "}
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-primary transition-colors"
          >
            Built with love using caffeine.ai
          </a>
        </p>
      </div>
    </div>
  );
}
