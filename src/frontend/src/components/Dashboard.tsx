import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertCircle,
  BarChart2,
  Bookmark,
  BookmarkCheck,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { MarketPrice } from "../backend.d";
import { useInternetIdentity } from "../hooks/useInternetIdentity";
import {
  useAddToWatchlist,
  useMarketPrices,
  useRemoveFromWatchlist,
  useWatchlist,
} from "../hooks/useQueries";

interface DashboardProps {
  onChartOpen: (symbol: string) => void;
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

const MOCK_PRICES: MarketPrice[] = [
  {
    symbol: "BTC/USD",
    price: "67,842.50",
    changePercent: "+2.34",
    timestamp: BigInt(Date.now()),
  },
  {
    symbol: "ETH/USD",
    price: "3,521.18",
    changePercent: "+1.87",
    timestamp: BigInt(Date.now()),
  },
  {
    symbol: "XAU/USD",
    price: "2,384.60",
    changePercent: "+0.42",
    timestamp: BigInt(Date.now()),
  },
  {
    symbol: "XAG/USD",
    price: "28.94",
    changePercent: "-0.18",
    timestamp: BigInt(Date.now()),
  },
  {
    symbol: "EUR/USD",
    price: "1.0851",
    changePercent: "-0.09",
    timestamp: BigInt(Date.now()),
  },
  {
    symbol: "GBP/USD",
    price: "1.2734",
    changePercent: "+0.15",
    timestamp: BigInt(Date.now()),
  },
  {
    symbol: "USD/JPY",
    price: "149.82",
    changePercent: "+0.23",
    timestamp: BigInt(Date.now()),
  },
  {
    symbol: "NASDAQ",
    price: "17,891.50",
    changePercent: "+0.76",
    timestamp: BigInt(Date.now()),
  },
  {
    symbol: "S&P500",
    price: "5,218.40",
    changePercent: "+0.53",
    timestamp: BigInt(Date.now()),
  },
  {
    symbol: "OIL",
    price: "78.43",
    changePercent: "-0.67",
    timestamp: BigInt(Date.now()),
  },
];

function PriceCard({
  item,
  isWatchlisted,
  onChart,
  onWatchlist,
  isLoggedIn,
}: {
  item: MarketPrice;
  isWatchlisted: boolean;
  onChart: () => void;
  onWatchlist: () => void;
  isLoggedIn: boolean;
}) {
  const meta = SYMBOL_META[item.symbol] ?? {
    label: item.symbol,
    category: "Other",
  };
  const changeNum = Number.parseFloat(item.changePercent);
  const isPositive = changeNum >= 0;

  return (
    <div className="bg-card border border-border rounded-lg p-3 card-hover animate-fade-in flex flex-col gap-2">
      {/* Header row */}
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
          </div>
          <p className="text-xs text-muted-foreground truncate">{meta.label}</p>
        </div>
        {isLoggedIn && (
          <button
            type="button"
            onClick={onWatchlist}
            className="text-muted-foreground hover:text-primary transition-colors p-0.5 shrink-0"
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

      {/* Chart button */}
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-xs w-full"
        onClick={onChart}
      >
        <BarChart2 className="h-3 w-3 mr-1" />
        View Chart
      </Button>
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

const REFRESH_INTERVAL_SEC = 10;

export function Dashboard({ onChartOpen }: DashboardProps) {
  const {
    data: prices,
    isLoading,
    isError,
    refetch,
    isFetching,
    dataUpdatedAt,
  } = useMarketPrices();
  const { data: watchlist = [] } = useWatchlist();
  const addToWatchlist = useAddToWatchlist();
  const removeFromWatchlist = useRemoveFromWatchlist();
  const { identity } = useInternetIdentity();
  const isLoggedIn = !!identity;

  const [countdown, setCountdown] = useState(REFRESH_INTERVAL_SEC);

  // Update last-updated time whenever data refreshes
  const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt) : new Date();

  // Countdown timer ticking toward next auto-refresh
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

  const displayPrices = prices && prices.length > 0 ? prices : MOCK_PRICES;

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
          <h2 className="text-base font-semibold text-foreground">
            Market Prices
          </h2>
          <p className="text-xs text-muted-foreground">
            Updated {lastUpdated.toLocaleTimeString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Auto-refresh countdown */}
          {!isLoading && !isError && prices && prices.length > 0 && (
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
            className="h-8"
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
        <div className="flex items-center gap-2 bg-destructive/10 text-destructive rounded-lg p-3 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>Failed to load market data. Showing demo prices.</span>
        </div>
      )}

      {/* Live indicator */}
      {!isLoading && !isError && prices && prices.length > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-bull">
          <span
            className={`inline-block h-2 w-2 rounded-full bg-bull ${isFetching ? "animate-pulse" : "animate-pulse-slow"}`}
          />
          {isFetching ? "Updating prices..." : "Live market data"}
        </div>
      )}

      {/* Price grid */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {isLoading
          ? SKELETON_KEYS.map((k) => <PriceCardSkeleton key={k} />)
          : displayPrices.map((item) => (
              <PriceCard
                key={item.symbol}
                item={item}
                isWatchlisted={watchlist.includes(item.symbol)}
                onChart={() => onChartOpen(item.symbol)}
                onWatchlist={() => handleWatchlist(item.symbol)}
                isLoggedIn={isLoggedIn}
              />
            ))}
      </div>

      {/* Disclaimer */}
      <p className="text-xs text-muted-foreground text-center pt-1">
        Prices are for educational reference only. Not financial advice.
      </p>
    </div>
  );
}
