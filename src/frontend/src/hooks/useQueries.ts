import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AnalysisRequest,
  AnalysisResult,
  AnalysisWithImageRequest,
  CommunityStrategy,
  CustomStrategy,
  MarketPrice,
  PriceAlert,
  TradeEntry,
} from "../backend.d";
import { useActor } from "./useActor";

// ─── CoinGecko Free Market Prices ─────────────────────────────

interface CoinGeckoSimplePrice {
  usd: number;
  usd_24h_change: number;
}

interface CoinGeckoResponse {
  bitcoin?: CoinGeckoSimplePrice;
  ethereum?: CoinGeckoSimplePrice;
}

// Static fallback prices for assets not available in CoinGecko free tier
const STATIC_FALLBACK_PRICES: Omit<MarketPrice, "timestamp">[] = [
  { symbol: "XAU/USD", price: "2,384.60", changePercent: "+0.42" },
  { symbol: "XAG/USD", price: "28.94", changePercent: "-0.18" },
  { symbol: "EUR/USD", price: "1.0851", changePercent: "-0.09" },
  { symbol: "GBP/USD", price: "1.2734", changePercent: "+0.15" },
  { symbol: "USD/JPY", price: "149.82", changePercent: "+0.23" },
  { symbol: "NASDAQ", price: "17,891.50", changePercent: "+0.76" },
  { symbol: "S&P500", price: "5,218.40", changePercent: "+0.53" },
  { symbol: "OIL", price: "78.43", changePercent: "-0.67" },
];

export function useFreeMarketPrices() {
  return useQuery<MarketPrice[]>({
    queryKey: ["freeMarketPrices"],
    queryFn: async () => {
      const now = BigInt(Date.now());
      try {
        const resp = await fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true",
          { signal: AbortSignal.timeout(8000) },
        );
        if (!resp.ok) throw new Error(`CoinGecko error: ${resp.status}`);
        const data = (await resp.json()) as CoinGeckoResponse;

        const cryptoPrices: MarketPrice[] = [];

        if (data.bitcoin) {
          const pct = data.bitcoin.usd_24h_change;
          cryptoPrices.push({
            symbol: "BTC/USD",
            price: data.bitcoin.usd.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }),
            changePercent: `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}`,
            timestamp: now,
          });
        }

        if (data.ethereum) {
          const pct = data.ethereum.usd_24h_change;
          cryptoPrices.push({
            symbol: "ETH/USD",
            price: data.ethereum.usd.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }),
            changePercent: `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}`,
            timestamp: now,
          });
        }

        const staticPrices: MarketPrice[] = STATIC_FALLBACK_PRICES.map((p) => ({
          ...p,
          timestamp: now,
        }));

        return [...cryptoPrices, ...staticPrices];
      } catch {
        // Full fallback to static prices
        return [
          {
            symbol: "BTC/USD",
            price: "67,842.50",
            changePercent: "+2.34",
            timestamp: now,
          },
          {
            symbol: "ETH/USD",
            price: "3,521.18",
            changePercent: "+1.87",
            timestamp: now,
          },
          ...STATIC_FALLBACK_PRICES.map((p) => ({ ...p, timestamp: now })),
        ];
      }
    },
    refetchInterval: 30000,
    staleTime: 25000,
  });
}

// ─── Market Prices ────────────────────────────────────────────
export function useMarketPrices() {
  const { actor, isFetching } = useActor();
  return useQuery<MarketPrice[]>({
    queryKey: ["marketPrices"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getMarketPrices();
    },
    enabled: !!actor && !isFetching,
    refetchInterval: 10000,
    staleTime: 8000,
  });
}

// ─── Analysis History ─────────────────────────────────────────
export function useAnalysisHistory() {
  const { actor, isFetching } = useActor();
  return useQuery<AnalysisResult[]>({
    queryKey: ["analysisHistory"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAnalysisHistory();
    },
    enabled: !!actor && !isFetching,
  });
}

// ─── AI Analysis Mutation ─────────────────────────────────────
export function useAnalyzeStrategy() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation<AnalysisResult, Error, AnalysisRequest>({
    mutationFn: async (request: AnalysisRequest) => {
      if (!actor) throw new Error("Not connected");
      return actor.requestAIAnalysis(request);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["analysisHistory"] });
    },
  });
}

// ─── AI Analysis With Image Mutation ─────────────────────────
export function useAnalyzeStrategyWithImage() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation<AnalysisResult, Error, AnalysisWithImageRequest>({
    mutationFn: async (request: AnalysisWithImageRequest) => {
      if (!actor) throw new Error("Not connected");
      return actor.requestAIAnalysisWithImage(request);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["analysisHistory"] });
    },
  });
}

// ─── Clear History Mutation ───────────────────────────────────
export function useClearHistory() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation<void, Error, void>({
    mutationFn: async () => {
      if (!actor) throw new Error("Not connected");
      return actor.clearAnalysisHistory();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["analysisHistory"] });
    },
  });
}

// ─── Community Strategies ─────────────────────────────────────
export function useApprovedStrategies() {
  const { actor, isFetching } = useActor();
  return useQuery<CommunityStrategy[]>({
    queryKey: ["approvedStrategies"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getApprovedStrategies();
    },
    enabled: !!actor && !isFetching,
  });
}

// ─── Pending Strategies (admin) ───────────────────────────────
export function usePendingStrategies() {
  const { actor, isFetching } = useActor();
  return useQuery<CommunityStrategy[]>({
    queryKey: ["pendingStrategies"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getPendingStrategies();
    },
    enabled: !!actor && !isFetching,
  });
}

// ─── Submit Strategy Mutation ─────────────────────────────────
export function useSubmitStrategy() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation<
    void,
    Error,
    { name: string; description: string; strategyType: string }
  >({
    mutationFn: async ({ name, description, strategyType }) => {
      if (!actor) throw new Error("Not connected");
      return actor.submitStrategy(name, description, strategyType);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["approvedStrategies"] });
    },
  });
}

// ─── Vote on Strategy Mutation ────────────────────────────────
export function useVoteOnStrategy() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation<void, Error, { strategyId: string; upvote: boolean }>({
    mutationFn: async ({ strategyId, upvote }) => {
      if (!actor) throw new Error("Not connected");
      return actor.voteOnStrategy(strategyId, upvote);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["approvedStrategies"] });
    },
  });
}

// ─── Watchlist ────────────────────────────────────────────────
export function useWatchlist() {
  const { actor, isFetching } = useActor();
  return useQuery<string[]>({
    queryKey: ["watchlist"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getWatchlist();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useAddToWatchlist() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (symbol: string) => {
      if (!actor) throw new Error("Not connected");
      return actor.addToWatchlist(symbol);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["watchlist"] });
    },
  });
}

export function useRemoveFromWatchlist() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (symbol: string) => {
      if (!actor) throw new Error("Not connected");
      return actor.removeFromWatchlist(symbol);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["watchlist"] });
    },
  });
}

// ─── Custom Strategies ────────────────────────────────────────
export function useCustomStrategies() {
  const { actor, isFetching } = useActor();
  return useQuery<CustomStrategy[]>({
    queryKey: ["customStrategies"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getCustomStrategies();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useGenerateCustomStrategy() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation<CustomStrategy, Error, string>({
    mutationFn: async (description: string) => {
      if (!actor) throw new Error("Not connected");
      return actor.generateCustomStrategy(description);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["customStrategies"] });
    },
  });
}

// ─── Is Admin ─────────────────────────────────────────────────
export function useIsAdmin() {
  const { actor, isFetching } = useActor();
  return useQuery<boolean>({
    queryKey: ["isAdmin"],
    queryFn: async () => {
      if (!actor) return false;
      return actor.isCallerAdmin();
    },
    enabled: !!actor && !isFetching,
  });
}

// ─── Admin: Approve/Reject/Delete ────────────────────────────
export function useApproveStrategy() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (strategyId: string) => {
      if (!actor) throw new Error("Not connected");
      return actor.approveStrategy(strategyId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["approvedStrategies"] });
      void queryClient.invalidateQueries({ queryKey: ["pendingStrategies"] });
    },
  });
}

export function useRejectStrategy() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (strategyId: string) => {
      if (!actor) throw new Error("Not connected");
      return actor.rejectStrategy(strategyId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["approvedStrategies"] });
      void queryClient.invalidateQueries({ queryKey: ["pendingStrategies"] });
    },
  });
}

export function useDeleteStrategy() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (strategyId: string) => {
      if (!actor) throw new Error("Not connected");
      return actor.deleteStrategy(strategyId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["approvedStrategies"] });
      void queryClient.invalidateQueries({ queryKey: ["pendingStrategies"] });
    },
  });
}

// ─── Trade Journal ────────────────────────────────────────────
export function useTradeEntries() {
  const { actor, isFetching } = useActor();
  return useQuery<TradeEntry[]>({
    queryKey: ["tradeEntries"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getTradeEntries();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useAddTradeEntry() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation<
    TradeEntry,
    Error,
    {
      symbol: string;
      entryPrice: string;
      exitPrice: string;
      direction: string;
      outcome: string;
      pnl: string;
      notes: string;
      strategy: string;
    }
  >({
    mutationFn: async (params) => {
      if (!actor) throw new Error("Not connected");
      return actor.addTradeEntry(
        params.symbol,
        params.entryPrice,
        params.exitPrice,
        params.direction,
        params.outcome,
        params.pnl,
        params.notes,
        params.strategy,
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tradeEntries"] });
    },
  });
}

export function useDeleteTradeEntry() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (id: string) => {
      if (!actor) throw new Error("Not connected");
      return actor.deleteTradeEntry(id);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tradeEntries"] });
    },
  });
}

// ─── Price Alerts ─────────────────────────────────────────────
export function usePriceAlerts() {
  const { actor, isFetching } = useActor();
  return useQuery<PriceAlert[]>({
    queryKey: ["priceAlerts"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getPriceAlerts();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useSetPriceAlert() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation<
    PriceAlert,
    Error,
    { symbol: string; targetPrice: string; condition: string }
  >({
    mutationFn: async ({ symbol, targetPrice, condition }) => {
      if (!actor) throw new Error("Not connected");
      return actor.setPriceAlert(symbol, targetPrice, condition);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["priceAlerts"] });
    },
  });
}

export function useRemovePriceAlert() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (id: string) => {
      if (!actor) throw new Error("Not connected");
      return actor.removePriceAlert(id);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["priceAlerts"] });
    },
  });
}

export function useCheckAlerts(prices: MarketPrice[]) {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation<PriceAlert[], Error, void>({
    mutationFn: async () => {
      if (!actor || prices.length === 0) return [];
      return actor.checkAndTriggerAlerts(prices);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["priceAlerts"] });
    },
  });
}

// ─── Favorite Strategies ──────────────────────────────────────
export function useFavoriteStrategies() {
  const { actor, isFetching } = useActor();
  return useQuery<string[]>({
    queryKey: ["favoriteStrategies"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getFavoriteStrategies();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useToggleFavoriteStrategy() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (strategyId: string) => {
      if (!actor) throw new Error("Not connected");
      return actor.toggleFavoriteStrategy(strategyId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["favoriteStrategies"] });
    },
  });
}
