import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart2,
  Bookmark,
  Check,
  Copy,
  Loader2,
  LogIn,
  LogOut,
  Shield,
  Trash2,
  User,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useInternetIdentity } from "../hooks/useInternetIdentity";
import {
  useAnalysisHistory,
  useIsAdmin,
  useRemoveFromWatchlist,
  useWatchlist,
} from "../hooks/useQueries";
import { AdminPanel } from "./AdminPanel";

export function Profile() {
  const { identity, login, clear, isLoggingIn, isInitializing } =
    useInternetIdentity();
  const isLoggedIn = !!identity;
  const principal = identity?.getPrincipal().toString() ?? "";

  const { data: watchlist = [], isLoading: watchlistLoading } = useWatchlist();
  const { data: history = [], isLoading: historyLoading } =
    useAnalysisHistory();
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
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-card border border-border rounded-lg p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <Bookmark className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium text-muted-foreground">
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
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <BarChart2 className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium text-muted-foreground">
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

      {/* Admin Panel */}
      {isLoggedIn && isAdmin && (
        <>
          <Separator />
          <AdminPanel />
        </>
      )}

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
