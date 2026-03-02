import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Check,
  ClipboardList,
  Loader2,
  Shield,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { CommunityStrategy } from "../backend.d";
import { useActor } from "../hooks/useActor";
import {
  useApproveStrategy,
  useDeleteStrategy,
  useRejectStrategy,
} from "../hooks/useQueries";

function usePendingStrategiesAdmin() {
  const { actor, isFetching } = useActor();
  return useQuery<CommunityStrategy[]>({
    queryKey: ["pendingStrategiesAdmin"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getPendingStrategies();
    },
    enabled: !!actor && !isFetching,
  });
}

function useAllStrategiesAdmin() {
  const { actor, isFetching } = useActor();
  return useQuery<CommunityStrategy[]>({
    queryKey: ["allStrategiesAdmin"],
    queryFn: async () => {
      if (!actor) return [];
      const [approved, pending] = await Promise.all([
        actor.getApprovedStrategies(),
        actor.getPendingStrategies(),
      ]);
      // Merge and deduplicate by id
      const map = new Map<string, CommunityStrategy>();
      for (const s of [...approved, ...pending]) map.set(s.id, s);
      return Array.from(map.values());
    },
    enabled: !!actor && !isFetching,
  });
}

function truncatePrincipal(principal: string): string {
  if (principal.length <= 12) return principal;
  return `${principal.slice(0, 5)}...${principal.slice(-4)}`;
}

export function AdminPanel() {
  const { data: pending = [], isLoading: pendingLoading } =
    usePendingStrategiesAdmin();
  const { data: all = [], isLoading: allLoading } = useAllStrategiesAdmin();

  const approveStrategy = useApproveStrategy();
  const rejectStrategy = useRejectStrategy();
  const deleteStrategy = useDeleteStrategy();
  const queryClient = useQueryClient();

  const invalidateAll = () => {
    void queryClient.invalidateQueries({
      queryKey: ["pendingStrategiesAdmin"],
    });
    void queryClient.invalidateQueries({ queryKey: ["allStrategiesAdmin"] });
    void queryClient.invalidateQueries({ queryKey: ["approvedStrategies"] });
  };

  const handleApprove = async (id: string) => {
    try {
      await approveStrategy.mutateAsync(id);
      invalidateAll();
      toast.success("Strategy approved");
    } catch {
      toast.error("Failed to approve");
    }
  };

  const handleReject = async (id: string) => {
    try {
      await rejectStrategy.mutateAsync(id);
      invalidateAll();
      toast.success("Strategy rejected");
    } catch {
      toast.error("Failed to reject");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteStrategy.mutateAsync(id);
      invalidateAll();
      toast.success("Strategy deleted");
    } catch {
      toast.error("Failed to delete");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Shield className="h-5 w-5 text-gold" />
        <h3 className="font-semibold text-sm text-foreground">Admin Panel</h3>
        <Badge
          variant="outline"
          className="text-gold border-gold/30 text-[10px]"
        >
          Admin
        </Badge>
      </div>

      {/* Pending strategies */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <ClipboardList className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-xs font-medium text-foreground">
            Pending Review
            {pending.length > 0 && (
              <Badge
                variant="destructive"
                className="text-[10px] ml-1.5 px-1.5 py-0"
              >
                {pending.length}
              </Badge>
            )}
          </h4>
        </div>

        {pendingLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-20 rounded-lg" />
            ))}
          </div>
        ) : pending.length === 0 ? (
          <div className="bg-bull/5 border border-bull/20 rounded-lg p-3 flex items-center gap-2 text-xs text-bull">
            <Check className="h-4 w-4 shrink-0" />
            No pending strategies. Queue is clear.
          </div>
        ) : (
          <div className="space-y-2">
            {pending.map((s) => (
              <div
                key={s.id}
                className="bg-card border border-border rounded-lg p-3"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {s.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {truncatePrincipal(s.creator.toString())} ·{" "}
                      {s.strategyType}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                  {s.description}
                </p>
                <div className="flex gap-1.5">
                  <Button
                    size="sm"
                    className="h-7 text-xs bg-bull hover:bg-bull/90 text-white flex-1"
                    onClick={() => handleApprove(s.id)}
                    disabled={approveStrategy.isPending}
                  >
                    {approveStrategy.isPending ? (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    ) : (
                      <Check className="h-3 w-3 mr-1" />
                    )}
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-7 text-xs flex-1"
                    onClick={() => handleReject(s.id)}
                    disabled={rejectStrategy.isPending}
                  >
                    {rejectStrategy.isPending ? (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    ) : (
                      <X className="h-3 w-3 mr-1" />
                    )}
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* All strategies */}
      <div>
        <h4 className="text-xs font-medium text-foreground mb-2">
          All Strategies ({all.length})
        </h4>

        {allLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 rounded-lg" />
            ))}
          </div>
        ) : all.length === 0 ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            No strategies found.
          </div>
        ) : (
          <ScrollArea className="max-h-64">
            <div className="space-y-1.5 pr-1">
              {all.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-2 bg-accent/30 rounded-md px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-foreground truncate">
                      {s.name}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Badge
                        variant={s.approved ? "secondary" : "outline"}
                        className={`text-[10px] px-1.5 py-0 h-4 ${s.approved ? "text-bull border-bull/20" : "text-muted-foreground"}`}
                      >
                        {s.approved ? "Live" : "Pending"}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {Number(s.votes)} votes
                      </span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                    onClick={() => handleDelete(s.id)}
                    disabled={deleteStrategy.isPending}
                  >
                    {deleteStrategy.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
