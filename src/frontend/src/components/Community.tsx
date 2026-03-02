import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2,
  LogIn,
  MessageSquare,
  Plus,
  ThumbsDown,
  ThumbsUp,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { CommunityStrategy } from "../backend.d";
import { useInternetIdentity } from "../hooks/useInternetIdentity";
import {
  useApprovedStrategies,
  useSubmitStrategy,
  useVoteOnStrategy,
} from "../hooks/useQueries";

const STRATEGY_TYPES = [
  "Scalping",
  "Breakout",
  "Trend Following",
  "RSI Strategy",
  "Support/Resistance",
  "Custom",
];

const TYPE_COLORS: Record<string, string> = {
  Scalping: "bg-chart-1/15 text-chart-1 border-chart-1/30",
  Breakout: "bg-chart-2/15 text-chart-2 border-chart-2/30",
  "Trend Following": "bg-chart-4/15 text-chart-4 border-chart-4/30",
  "RSI Strategy": "bg-chart-5/15 text-chart-5 border-chart-5/30",
  "Support/Resistance": "bg-primary/15 text-primary border-primary/30",
  Custom: "bg-muted text-muted-foreground border-border",
};

function truncatePrincipal(principal: string): string {
  if (principal.length <= 12) return principal;
  return `${principal.slice(0, 5)}...${principal.slice(-4)}`;
}

function StrategyCard({
  strategy,
  onVote,
  isLoggedIn,
}: {
  strategy: CommunityStrategy;
  onVote: (id: string, upvote: boolean) => void;
  isLoggedIn: boolean;
}) {
  const typeColor = TYPE_COLORS[strategy.strategyType] ?? TYPE_COLORS.Custom;
  const creatorStr = strategy.creator.toString();

  return (
    <div className="bg-card border border-border rounded-lg p-3 animate-fade-in">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-sm text-foreground truncate">
            {strategy.name}
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            by {truncatePrincipal(creatorStr)}
          </p>
        </div>
        <Badge
          variant="outline"
          className={`text-[10px] shrink-0 ${typeColor}`}
        >
          {strategy.strategyType}
        </Badge>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed mb-3 line-clamp-3">
        {strategy.description}
      </p>

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {Number(strategy.votes)} votes
        </span>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs text-bull border-bull/20 hover:bg-bull/10"
            onClick={() => onVote(strategy.id, true)}
            disabled={!isLoggedIn}
            title={isLoggedIn ? "Upvote" : "Sign in to vote"}
          >
            <ThumbsUp className="h-3 w-3 mr-1" />
            Up
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs text-bear border-bear/20 hover:bg-bear/10"
            onClick={() => onVote(strategy.id, false)}
            disabled={!isLoggedIn}
            title={isLoggedIn ? "Downvote" : "Sign in to vote"}
          >
            <ThumbsDown className="h-3 w-3 mr-1" />
            Down
          </Button>
        </div>
      </div>
    </div>
  );
}

const SEED_STRATEGIES: CommunityStrategy[] = [
  {
    id: "seed-1",
    name: "Morning Breakout BTC",
    description:
      "Trade BTC breakouts in the first 2 hours after NY market open. Look for volume confirmation above the 4h resistance level with RSI > 55.",
    strategyType: "Breakout",
    votes: BigInt(47),
    approved: true,
    timestamp: BigInt(Date.now()),
    creator: { toString: () => "2vxsx-fae" } as any,
  },
  {
    id: "seed-2",
    name: "Gold Safe Haven Play",
    description:
      "Buy XAU/USD during equity market selloffs when SPX drops >1%. Set TP at nearest weekly resistance, SL below daily low.",
    strategyType: "Trend Following",
    votes: BigInt(32),
    approved: true,
    timestamp: BigInt(Date.now()),
    creator: { toString: () => "3xwcs-bae" } as any,
  },
  {
    id: "seed-3",
    name: "EUR/USD RSI Fade",
    description:
      "Fade RSI extremes (>70 or <30) on EUR/USD 1H chart with divergence. Use prior session high/low for targets.",
    strategyType: "RSI Strategy",
    votes: BigInt(28),
    approved: true,
    timestamp: BigInt(Date.now()),
    creator: { toString: () => "4yhdt-caf" } as any,
  },
];

function SubmitForm({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [strategyType, setStrategyType] = useState("Scalping");
  const submitStrategy = useSubmitStrategy();

  const handleSubmit = async () => {
    if (!name.trim() || !description.trim()) {
      toast.error("Please fill in all fields");
      return;
    }
    try {
      await submitStrategy.mutateAsync({
        name: name.trim(),
        description: description.trim(),
        strategyType,
      });
      toast.success("Strategy submitted for review!");
      onClose();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to submit strategy",
      );
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4 animate-slide-up">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm text-foreground">
          Submit Strategy
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <label
            htmlFor="strategy-name"
            className="text-xs font-medium text-muted-foreground mb-1 block"
          >
            Name
          </label>
          <Input
            id="strategy-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Morning BTC Breakout"
            className="h-9 text-sm"
          />
        </div>

        <div>
          <label
            htmlFor="strategy-type"
            className="text-xs font-medium text-muted-foreground mb-1 block"
          >
            Type
          </label>
          <Select value={strategyType} onValueChange={setStrategyType}>
            <SelectTrigger id="strategy-type" className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STRATEGY_TYPES.map((t) => (
                <SelectItem key={t} value={t} className="text-sm">
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label
            htmlFor="strategy-description"
            className="text-xs font-medium text-muted-foreground mb-1 block"
          >
            Description
          </label>
          <Textarea
            id="strategy-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe entry/exit conditions, timeframes, risk management..."
            className="text-sm h-24 resize-none"
          />
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            className="flex-1"
            onClick={handleSubmit}
            disabled={submitStrategy.isPending}
          >
            {submitStrategy.isPending ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5 mr-1.5" />
            )}
            Submit
          </Button>
        </div>
      </div>
    </div>
  );
}

export function Community() {
  const { identity, login, isLoggingIn } = useInternetIdentity();
  const isLoggedIn = !!identity;
  const [showForm, setShowForm] = useState(false);

  const { data: strategies, isLoading } = useApprovedStrategies();
  const voteOnStrategy = useVoteOnStrategy();

  const displayStrategies =
    strategies && strategies.length > 0 ? strategies : SEED_STRATEGIES;

  const handleVote = async (id: string, upvote: boolean) => {
    if (!isLoggedIn) {
      toast.info("Sign in to vote on strategies");
      return;
    }
    try {
      await voteOnStrategy.mutateAsync({ strategyId: id, upvote });
      toast.success(upvote ? "Upvoted!" : "Downvoted!");
    } catch {
      toast.error("Failed to record vote");
    }
  };

  return (
    <div className="flex flex-col gap-4 pb-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-base text-foreground">Community</h2>
          {!isLoading && (
            <Badge variant="secondary" className="text-xs">
              {displayStrategies.length}
            </Badge>
          )}
        </div>

        {isLoggedIn ? (
          <Button
            size="sm"
            className="h-8 text-xs"
            onClick={() => setShowForm((v) => !v)}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Submit
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={login}
            disabled={isLoggingIn}
          >
            {isLoggingIn ? (
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            ) : (
              <LogIn className="h-3.5 w-3.5 mr-1" />
            )}
            Sign In
          </Button>
        )}
      </div>

      {/* Submit form */}
      {showForm && <SubmitForm onClose={() => setShowForm(false)} />}

      {/* Info banner for guests */}
      {!isLoggedIn && (
        <div className="bg-primary/5 border border-primary/15 rounded-lg p-3 text-xs text-muted-foreground">
          Sign in to submit strategies and vote on community contributions.
        </div>
      )}

      {/* Strategy list */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-card border border-border rounded-lg p-3"
            >
              <Skeleton className="h-4 w-40 mb-1.5" />
              <Skeleton className="h-3 w-24 mb-3" />
              <Skeleton className="h-12 w-full mb-2" />
              <Skeleton className="h-7 w-32" />
            </div>
          ))}
        </div>
      ) : displayStrategies.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm font-medium">No strategies yet</p>
          <p className="text-xs mt-1">
            Be the first to share a strategy with the community!
          </p>
        </div>
      ) : (
        <ScrollArea className="max-h-[600px]">
          <div className="space-y-2 pr-1">
            {displayStrategies.map((s) => (
              <StrategyCard
                key={s.id}
                strategy={s}
                onVote={handleVote}
                isLoggedIn={isLoggedIn}
              />
            ))}
          </div>
        </ScrollArea>
      )}

      <p className="text-xs text-muted-foreground text-center">
        Community strategies are for educational discussion only. Not financial
        advice.
      </p>
    </div>
  );
}
