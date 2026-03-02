import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertCircle,
  BarChart2,
  Bell,
  BellOff,
  Bookmark,
  BookmarkCheck,
  Brain,
  ChevronDown,
  ChevronUp,
  GridIcon,
  List,
  Newspaper,
  RefreshCw,
  Trash2,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { MarketPrice, PriceAlert } from "../backend.d";
import { useInternetIdentity } from "../hooks/useInternetIdentity";
import {
  useAddToWatchlist,
  useFreeMarketPrices,
  usePriceAlerts,
  useRemoveFromWatchlist,
  useRemovePriceAlert,
  useSetPriceAlert,
  useWatchlist,
} from "../hooks/useQueries";

interface DashboardProps {
  onChartOpen: (symbol: string) => void;
  onQuickAnalyze?: (symbol: string) => void;
}

const SYMBOL_META: Record<string, { label: string; category: string }> = {
  "BTC/USD": { label: "Bitcoin", category: "Crypto" },
  "ETH/USD": { label: "Ethereum", category: "Crypto" },
  "XAU/USD": { label: "Gold", category: "Metals" },
  "XAG/USD": { label: "Silver", category: "Metals" },
  "EUR/USD": { label: "Euro", category: "Forex" },
  "GBP/USD": { label: "Pound", category: "Forex" },
  "USD/JPY": { label: "Yen", category: "Forex" },
  NASDAQ: { label: "NASDAQ", category: "Index" },
  "S&P500": { label: "S&P 500", category: "Index" },
  OIL: { label: "Crude Oil", category: "Energy" },
};

// Symbols that get live CoinGecko data
const LIVE_SYMBOLS = new Set(["BTC/USD", "ETH/USD"]);

const CATEGORY_COLORS: Record<string, string> = {
  Crypto: "bg-primary/15 text-primary",
  Metals: "text-gold border-gold/40",
  Forex: "bg-accent text-accent-foreground",
  Index: "bg-accent text-accent-foreground",
  Energy: "bg-destructive/10 text-destructive",
};

const SKELETON_KEYS = [
  "sk1",
  "sk2",
  "sk3",
  "sk4",
  "sk5",
  "sk6",
  "sk7",
  "sk8",
  "sk9",
  "sk10",
];

// ─── Market News Feed (static curated content) ────────────────

interface NewsItem {
  id: string;
  headline: string;
  summary: string;
  sentiment: "Bullish" | "Bearish" | "Neutral";
  source: string;
  age: string;
}

const MARKET_NEWS: NewsItem[] = [
  {
    id: "n1",
    headline: "Bitcoin ETF Inflows Hit Record $1.4B in Single Day",
    summary:
      "Spot Bitcoin ETFs recorded their largest single-day inflow as institutional demand surges ahead of the next halving cycle. BlackRock's iShares leads with $600M.",
    sentiment: "Bullish",
    source: "CryptoDesk",
    age: "2h ago",
  },
  {
    id: "n2",
    headline: "Fed Minutes Signal Caution on Rate Cuts, Dollar Strengthens",
    summary:
      "Federal Reserve minutes reveal policymakers need more inflation data before cutting rates. EUR/USD drops 0.3% as dollar index rallies to 3-month high.",
    sentiment: "Bearish",
    source: "FX Wire",
    age: "4h ago",
  },
  {
    id: "n3",
    headline: "Gold Holds Near All-Time High Amid Geopolitical Tensions",
    summary:
      "XAU/USD consolidates above $2,380 as safe-haven demand persists. Central bank gold buying continues at record pace for third consecutive quarter.",
    sentiment: "Bullish",
    source: "Metal Markets",
    age: "5h ago",
  },
  {
    id: "n4",
    headline: "NASDAQ Rallies on Strong Tech Earnings Beat",
    summary:
      "Big Tech earnings exceeded analyst estimates by an average 12%. NASDAQ futures point to a 1.2% gap-up open as AI-driven revenue growth accelerates.",
    sentiment: "Bullish",
    source: "Equity Daily",
    age: "7h ago",
  },
  {
    id: "n5",
    headline: "Crude Oil Faces Pressure as OPEC+ Output Uncertainty Grows",
    summary:
      "WTI crude dips below $80 as reports suggest OPEC+ may ease voluntary cuts in Q3. Demand concerns from China add to bearish pressure.",
    sentiment: "Bearish",
    source: "Energy Watch",
    age: "9h ago",
  },
  {
    id: "n6",
    headline: "Ethereum Staking Rewards Remain Stable at 4.2% APY",
    summary:
      "On-chain data shows consistent validator participation with ETH staking yield holding steady. Layer-2 activity hits new highs with 8M daily transactions.",
    sentiment: "Neutral",
    source: "On-Chain Analytics",
    age: "12h ago",
  },
];

function MarketNewsFeed() {
  const [expanded, setExpanded] = useState(false);

  const sentimentStyle = (s: NewsItem["sentiment"]) => {
    if (s === "Bullish") return "bg-bull/15 text-bull border-bull/30";
    if (s === "Bearish") return "bg-bear/15 text-bear border-bear/30";
    return "bg-gold/15 text-gold border-gold/30";
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <button
        type="button"
        data-ocid="news.toggle"
        className="w-full flex items-center px-4 min-h-[44px] gap-2 hover:bg-muted/20 transition-colors"
        onClick={() => setExpanded((p) => !p)}
      >
        <Newspaper className="h-3.5 w-3.5 text-primary shrink-0" />
        <span className="text-xs font-bold text-foreground flex-1 text-left">
          Market Insights
        </span>
        <Badge variant="secondary" className="text-[9px] font-mono shrink-0">
          {MARKET_NEWS.length} stories
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
            <div className="divide-y divide-border/40">
              {MARKET_NEWS.map((item) => (
                <div key={item.id} className="px-4 py-3 space-y-1.5">
                  <div className="flex items-start gap-2 justify-between">
                    <p className="text-xs font-semibold text-foreground leading-snug flex-1 pr-2">
                      {item.headline}
                    </p>
                    <Badge
                      variant="outline"
                      className={`text-[9px] px-1.5 h-4 shrink-0 whitespace-nowrap ${sentimentStyle(item.sentiment)}`}
                    >
                      {item.sentiment}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {item.summary}
                  </p>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground/60">
                    <span>{item.source}</span>
                    <span>·</span>
                    <span>{item.age}</span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Market Sentiment Gauge ───────────────────────────────────

function MarketSentimentGauge({ prices }: { prices: MarketPrice[] }) {
  if (prices.length < 3) return null;

  const validChanges = prices
    .map((p) => Number.parseFloat(p.changePercent))
    .filter((n) => !Number.isNaN(n));

  if (validChanges.length < 3) return null;

  const avg = validChanges.reduce((a, b) => a + b, 0) / validChanges.length;

  const getSentiment = (v: number) => {
    if (v < -2) return { label: "Extreme Fear", color: "#ef4444", pct: 5 };
    if (v < -0.5) return { label: "Fear", color: "#f97316", pct: 25 };
    if (v < 0.5) return { label: "Neutral", color: "#eab308", pct: 50 };
    if (v < 2) return { label: "Greed", color: "#22c55e", pct: 75 };
    return { label: "Extreme Greed", color: "#16a34a", pct: 95 };
  };

  const sentiment = getSentiment(avg);
  const positiveCount = validChanges.filter((v) => v >= 0).length;
  const negativeCount = validChanges.filter((v) => v < 0).length;

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-muted/60 flex items-center justify-center">
            <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <span className="text-xs font-bold text-foreground uppercase tracking-wide">
            Market Sentiment
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground font-mono">
            Avg {avg >= 0 ? "+" : ""}
            {avg.toFixed(2)}%
          </span>
          <Badge
            variant="outline"
            className="text-xs font-bold px-2 py-0.5"
            style={{
              color: sentiment.color,
              borderColor: `${sentiment.color}40`,
            }}
          >
            {sentiment.label}
          </Badge>
        </div>
      </div>

      {/* Gradient bar */}
      <div className="relative">
        <div
          className="h-3 w-full rounded-full overflow-hidden"
          style={{
            background:
              "linear-gradient(to right, #ef4444, #f97316, #eab308, #22c55e, #16a34a)",
          }}
        >
          <motion.div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
            initial={{ left: "50%" }}
            animate={{ left: `${Math.min(95, Math.max(5, sentiment.pct))}%` }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
          >
            <div className="h-5 w-2 rounded-full bg-white border-2 border-foreground/30 shadow-md" />
          </motion.div>
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-[9px] text-bear font-semibold">
            Extreme Fear
          </span>
          <span className="text-[9px] text-muted-foreground">Neutral</span>
          <span className="text-[9px] text-bull font-semibold">
            Extreme Greed
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3 pt-1 border-t border-border/40">
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-bull" />
          <span className="text-[10px] text-muted-foreground">
            {positiveCount} Bullish
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-bear" />
          <span className="text-[10px] text-muted-foreground">
            {negativeCount} Bearish
          </span>
        </div>
        <div className="ml-auto text-[10px] text-muted-foreground">
          {prices.length} assets tracked
        </div>
      </div>
    </div>
  );
}

function PriceCardSkeleton() {
  return (
    <div className="bg-card border border-border rounded-lg p-3 flex flex-col gap-2">
      <div className="flex items-start justify-between">
        <div className="space-y-1.5 flex-1">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
      <div className="flex items-end justify-between">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-4 w-16" />
      </div>
      <Skeleton className="h-7 w-full" />
    </div>
  );
}

// ─── Alert Form ───────────────────────────────────────────────

function PriceAlertForm({
  symbol,
  onClose,
}: {
  symbol: string;
  onClose: () => void;
}) {
  const [price, setPrice] = useState("");
  const [condition, setCondition] = useState<"above" | "below">("above");
  const setAlert = useSetPriceAlert();

  const handleSubmit = async () => {
    if (!price.trim()) {
      toast.error("Please enter a target price");
      return;
    }
    try {
      await setAlert.mutateAsync({
        symbol,
        targetPrice: price.trim(),
        condition,
      });
      toast.success(`Alert set for ${symbol}`);
      onClose();
    } catch {
      toast.error("Failed to set alert");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18 }}
      className="absolute top-full left-0 right-0 z-20 mt-1 bg-card border border-border rounded-xl shadow-xl p-3 space-y-2"
    >
      <p className="text-xs font-bold text-foreground">Set Alert — {symbol}</p>
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={() => setCondition("above")}
          className={`flex-1 h-8 text-xs font-semibold rounded-lg border transition-all ${condition === "above" ? "bg-bull/20 border-bull/50 text-bull" : "border-border text-muted-foreground hover:bg-muted/30"}`}
        >
          Above ↑
        </button>
        <button
          type="button"
          onClick={() => setCondition("below")}
          className={`flex-1 h-8 text-xs font-semibold rounded-lg border transition-all ${condition === "below" ? "bg-bear/20 border-bear/50 text-bear" : "border-border text-muted-foreground hover:bg-muted/30"}`}
        >
          Below ↓
        </button>
      </div>
      <Input
        type="number"
        inputMode="decimal"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        placeholder="Target price"
        className="h-8 text-xs font-mono"
        autoFocus
      />
      <div className="flex gap-1.5">
        <Button
          variant="outline"
          size="sm"
          onClick={onClose}
          className="flex-1 h-7 text-xs rounded-lg"
          disabled={setAlert.isPending}
        >
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={handleSubmit}
          className="flex-1 h-7 text-xs rounded-lg"
          disabled={setAlert.isPending || !price.trim()}
        >
          {setAlert.isPending ? "Setting..." : "Set Alert"}
        </Button>
      </div>
    </motion.div>
  );
}

// ─── Active Alerts Panel ──────────────────────────────────────

function ActiveAlertsPanel({ alerts }: { alerts: PriceAlert[] }) {
  const [expanded, setExpanded] = useState(true);
  const removeAlert = useRemovePriceAlert();

  const triggeredAlerts = alerts.filter((a) => a.triggered);
  const activeAlerts = alerts.filter((a) => !a.triggered);

  if (alerts.length === 0) return null;

  const handleRemove = async (id: string) => {
    try {
      await removeAlert.mutateAsync(id);
      toast.success("Alert removed");
    } catch {
      toast.error("Failed to remove alert");
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <button
        type="button"
        data-ocid="alerts.toggle"
        className="w-full flex items-center px-4 min-h-[44px] gap-2 hover:bg-muted/20 transition-colors"
        onClick={() => setExpanded((p) => !p)}
      >
        <Bell className="h-3.5 w-3.5 text-primary shrink-0" />
        <span className="text-xs font-bold text-foreground flex-1 text-left">
          Price Alerts
        </span>
        {triggeredAlerts.length > 0 && (
          <Badge
            variant="destructive"
            className="text-[9px] px-1.5 h-4 shrink-0"
          >
            {triggeredAlerts.length} triggered
          </Badge>
        )}
        <Badge variant="secondary" className="text-[9px] font-mono shrink-0">
          {activeAlerts.length} active
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
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <Separator />
            <div className="p-3 space-y-1.5">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 border ${
                    alert.triggered
                      ? "bg-gold/10 border-gold/30"
                      : "bg-muted/20 border-border/50"
                  }`}
                >
                  <div
                    className={`shrink-0 h-1.5 w-1.5 rounded-full ${alert.triggered ? "bg-gold animate-pulse" : "bg-primary"}`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono font-semibold text-foreground">
                      {alert.symbol}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {alert.condition === "above" ? "↑" : "↓"}{" "}
                      {alert.targetPrice}
                      {alert.triggered && (
                        <span className="ml-1.5 text-gold font-semibold">
                          ✓ Triggered
                        </span>
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemove(alert.id)}
                    disabled={removeAlert.isPending}
                    data-ocid="alerts.delete_button"
                    className="shrink-0 h-7 w-7 flex items-center justify-center rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    aria-label="Remove alert"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Market Heatmap ───────────────────────────────────────────

function MarketHeatmap({ prices }: { prices: MarketPrice[] }) {
  const [expanded, setExpanded] = useState(false);

  if (prices.length === 0) return null;

  const getHeatColor = (changeStr: string) => {
    const change = Number.parseFloat(changeStr);
    if (Number.isNaN(change)) return "bg-muted/40 border-border/40";
    const absChange = Math.abs(change);
    const intensity = Math.min(absChange / 3, 1);
    if (change > 0) {
      if (intensity > 0.66) return "bg-bull border-bull/60";
      if (intensity > 0.33) return "bg-bull/60 border-bull/40";
      return "bg-bull/25 border-bull/20";
    }
    if (intensity > 0.66) return "bg-bear border-bear/60";
    if (intensity > 0.33) return "bg-bear/60 border-bear/40";
    return "bg-bear/25 border-bear/20";
  };

  const getTextColor = (changeStr: string) => {
    const change = Number.parseFloat(changeStr);
    if (Number.isNaN(change)) return "text-foreground";
    const absChange = Math.abs(change);
    const intensity = Math.min(absChange / 3, 1);
    if (intensity > 0.66) return "text-white";
    return change >= 0 ? "text-bull" : "text-bear";
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <button
        type="button"
        data-ocid="heatmap.toggle"
        className="w-full flex items-center px-4 min-h-[44px] gap-2 hover:bg-muted/20 transition-colors"
        onClick={() => setExpanded((p) => !p)}
      >
        <GridIcon className="h-3.5 w-3.5 text-primary shrink-0" />
        <span className="text-xs font-bold text-foreground flex-1 text-left">
          Market Heatmap
        </span>
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
            <div className="p-3 grid grid-cols-5 gap-1.5">
              {prices.map((item) => {
                const meta = SYMBOL_META[item.symbol] ?? {
                  label: item.symbol,
                  category: "Other",
                };
                const change = Number.parseFloat(item.changePercent);
                const isPositive = !Number.isNaN(change) && change >= 0;
                return (
                  <motion.div
                    key={item.symbol}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3 }}
                    className={`rounded-lg border p-2 flex flex-col items-center justify-center gap-0.5 min-h-[64px] cursor-default select-none ${getHeatColor(item.changePercent)}`}
                  >
                    <p
                      className={`text-[9px] font-bold uppercase tracking-wide leading-tight text-center ${getTextColor(item.changePercent)}`}
                    >
                      {meta.label}
                    </p>
                    <p
                      className={`font-mono text-[9px] font-semibold flex items-center gap-0.5 ${getTextColor(item.changePercent)}`}
                    >
                      {isPositive ? (
                        <TrendingUp className="h-2 w-2" />
                      ) : (
                        <TrendingDown className="h-2 w-2" />
                      )}
                      {isPositive ? "+" : ""}
                      {item.changePercent}%
                    </p>
                  </motion.div>
                );
              })}
            </div>
            <p className="text-center text-[9px] text-muted-foreground/60 pb-2">
              Green = bullish · Red = bearish · Intensity = magnitude
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── PriceCard ────────────────────────────────────────────────

function PriceCardWithAlert({
  item,
  isWatchlisted,
  onChart,
  onWatchlist,
  onQuickAnalyze,
  isLoggedIn,
  isLive,
}: {
  item: MarketPrice;
  isWatchlisted: boolean;
  onChart: () => void;
  onWatchlist: () => void;
  onQuickAnalyze?: () => void;
  isLoggedIn: boolean;
  isLive: boolean;
}) {
  const [alertFormOpen, setAlertFormOpen] = useState(false);
  const meta = SYMBOL_META[item.symbol] ?? {
    label: item.symbol,
    category: "Other",
  };
  const changeNum = Number.parseFloat(item.changePercent);
  const isPositive = changeNum >= 0;

  return (
    <div className="relative bg-card border border-border rounded-lg p-3 card-hover animate-fade-in flex flex-col gap-2">
      {/* Live / Demo badge */}
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-sm text-foreground truncate">
              {item.symbol}
            </span>
            <Badge
              variant="outline"
              className={`text-[10px] px-1.5 py-0 h-4 shrink-0 ${CATEGORY_COLORS[meta.category] ?? ""}`}
            >
              {meta.category}
            </Badge>
            {isLive && (
              <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-bull">
                <span className="h-1.5 w-1.5 rounded-full bg-bull animate-pulse inline-block" />
                Live
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">{meta.label}</p>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {isLoggedIn && (
            <button
              type="button"
              onClick={() => setAlertFormOpen((p) => !p)}
              className={`text-muted-foreground hover:text-primary transition-colors p-0.5 min-h-[44px] min-w-[44px] flex items-center justify-center ${alertFormOpen ? "text-primary" : ""}`}
              aria-label="Set price alert"
            >
              {alertFormOpen ? (
                <BellOff className="h-3.5 w-3.5" />
              ) : (
                <Bell className="h-3.5 w-3.5" />
              )}
            </button>
          )}
          {isLoggedIn && (
            <button
              type="button"
              onClick={onWatchlist}
              className="text-muted-foreground hover:text-primary transition-colors p-0.5 shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label={
                isWatchlisted ? "Remove from watchlist" : "Add to watchlist"
              }
            >
              {isWatchlisted ? (
                <BookmarkCheck className="h-4 w-4 text-primary" />
              ) : (
                <Bookmark className="h-4 w-4" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Price */}
      <div className="flex items-end justify-between gap-2">
        <span className="font-mono font-bold text-base text-foreground leading-none">
          {item.price}
        </span>
        <span
          className={`font-mono text-sm font-medium flex items-center gap-0.5 ${
            isPositive ? "text-bull" : "text-bear"
          }`}
        >
          {isPositive ? (
            <TrendingUp className="h-3 w-3" />
          ) : (
            <TrendingDown className="h-3 w-3" />
          )}
          {isPositive ? "+" : ""}
          {item.changePercent}%
        </span>
      </div>

      {/* Action buttons */}
      <div className="flex gap-1.5">
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs flex-1"
          onClick={onChart}
        >
          <BarChart2 className="h-3 w-3 mr-1" />
          Chart
        </Button>
        {onQuickAnalyze && (
          <Button
            size="sm"
            variant="default"
            className="h-7 text-xs flex-1 bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20"
            onClick={onQuickAnalyze}
            data-ocid="dashboard.analyze_button"
          >
            <Brain className="h-3 w-3 mr-1" />
            Analyze
          </Button>
        )}
      </div>

      {/* Alert form popover */}
      <AnimatePresence>
        {alertFormOpen && (
          <PriceAlertForm
            symbol={item.symbol}
            onClose={() => setAlertFormOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

const REFRESH_INTERVAL_SEC = 30;

export function Dashboard({ onChartOpen, onQuickAnalyze }: DashboardProps) {
  const {
    data: prices,
    isLoading,
    isError,
    refetch,
    isFetching,
    dataUpdatedAt,
  } = useFreeMarketPrices();
  const { data: watchlist = [] } = useWatchlist();
  const { data: priceAlerts = [] } = usePriceAlerts();
  const addToWatchlist = useAddToWatchlist();
  const removeFromWatchlist = useRemoveFromWatchlist();
  const { identity } = useInternetIdentity();
  const isLoggedIn = !!identity;

  const [countdown, setCountdown] = useState(REFRESH_INTERVAL_SEC);
  const [viewMode, setViewMode] = useState<"grid" | "heatmap">("grid");

  const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt) : new Date();

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset when data updates
  useEffect(() => {
    setCountdown(REFRESH_INTERVAL_SEC);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) return REFRESH_INTERVAL_SEC;
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [dataUpdatedAt]);

  const displayPrices = prices && prices.length > 0 ? prices : [];
  const triggeredAlertsCount = (priceAlerts as PriceAlert[]).filter(
    (a) => a.triggered,
  ).length;

  const handleRefresh = async () => {
    await refetch();
  };

  const handleWatchlist = async (symbol: string) => {
    if (!isLoggedIn) {
      toast.info("Sign in to save to watchlist");
      return;
    }
    try {
      if (watchlist.includes(symbol)) {
        await removeFromWatchlist.mutateAsync(symbol);
        toast.success(`Removed ${symbol} from watchlist`);
      } else {
        await addToWatchlist.mutateAsync(symbol);
        toast.success(`Added ${symbol} to watchlist`);
      }
    } catch {
      toast.error("Failed to update watchlist");
    }
  };

  return (
    <div className="flex flex-col gap-4 pb-2">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            Market Prices
            {isLoggedIn && triggeredAlertsCount > 0 && (
              <Badge variant="destructive" className="text-[9px] px-1.5 h-4">
                {triggeredAlertsCount} alert
                {triggeredAlertsCount > 1 ? "s" : ""}
              </Badge>
            )}
          </h2>
          <p className="text-xs text-muted-foreground">
            Updated {lastUpdated.toLocaleTimeString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center gap-0.5 bg-muted/40 rounded-lg p-0.5">
            <button
              type="button"
              data-ocid="dashboard.grid_toggle"
              onClick={() => setViewMode("grid")}
              className={`h-7 w-7 flex items-center justify-center rounded-md transition-colors ${viewMode === "grid" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              aria-label="Grid view"
            >
              <List className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              data-ocid="dashboard.heatmap_toggle"
              onClick={() => setViewMode("heatmap")}
              className={`h-7 w-7 flex items-center justify-center rounded-md transition-colors ${viewMode === "heatmap" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              aria-label="Heatmap view"
            >
              <GridIcon className="h-3.5 w-3.5" />
            </button>
          </div>
          {/* Auto-refresh countdown */}
          {!isLoading && prices && prices.length > 0 && (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/40 rounded px-2 py-1">
              <Zap className="h-3 w-3 text-bull shrink-0" />
              <span>
                {isFetching ? "Refreshing..." : `Auto in ${countdown}s`}
              </span>
            </div>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={handleRefresh}
            disabled={isFetching}
            className="h-8 select-none"
            data-ocid="dashboard.refresh_button"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 mr-1 ${isFetching ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </div>

      {/* Error state */}
      {isError && (
        <div
          data-ocid="dashboard.error_state"
          className="flex items-center gap-2 bg-destructive/10 text-destructive rounded-lg p-3 text-sm"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>Failed to load market data. Showing demo prices.</span>
        </div>
      )}

      {/* Live indicator */}
      {!isLoading && prices && prices.length > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-bull">
          <span
            className={`inline-block h-2 w-2 rounded-full bg-bull ${isFetching ? "animate-pulse" : "animate-pulse-slow"}`}
          />
          {isFetching
            ? "Updating prices..."
            : "BTC & ETH live · Other prices updated daily"}
        </div>
      )}

      {/* Active Alerts Panel */}
      {isLoggedIn && (priceAlerts as PriceAlert[]).length > 0 && (
        <ActiveAlertsPanel alerts={priceAlerts as PriceAlert[]} />
      )}

      {/* Price grid or Heatmap */}
      {viewMode === "heatmap" && !isLoading ? (
        <MarketHeatmap prices={displayPrices} />
      ) : (
        <div
          data-ocid="dashboard.list"
          className="grid grid-cols-2 gap-2 sm:grid-cols-3"
        >
          {isLoading
            ? SKELETON_KEYS.map((k) => <PriceCardSkeleton key={k} />)
            : displayPrices.map((item) => (
                <PriceCardWithAlert
                  key={item.symbol}
                  item={item}
                  isWatchlisted={watchlist.includes(item.symbol)}
                  onChart={() => onChartOpen(item.symbol)}
                  onWatchlist={() => handleWatchlist(item.symbol)}
                  onQuickAnalyze={
                    onQuickAnalyze
                      ? () => onQuickAnalyze(item.symbol)
                      : undefined
                  }
                  isLoggedIn={isLoggedIn}
                  isLive={LIVE_SYMBOLS.has(item.symbol)}
                />
              ))}
        </div>
      )}

      {/* Market Sentiment Gauge */}
      {!isLoading && displayPrices.length >= 3 && (
        <MarketSentimentGauge prices={displayPrices} />
      )}

      {/* Market News Feed */}
      <MarketNewsFeed />

      {/* Disclaimer */}
      <p className="text-xs text-muted-foreground text-center pt-1">
        BTC/ETH prices via CoinGecko. Other prices are indicative. Not financial
        advice.
      </p>
    </div>
  );
}
