import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AnalysisRequest,
  AnalysisResult,
  AnalysisWithImageRequest,
  CommunityStrategy,
  CustomStrategy,
  MarketPrice,
} from "../backend.d";
import { useActor } from "./useActor";

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
