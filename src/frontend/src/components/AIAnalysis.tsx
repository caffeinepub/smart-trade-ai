import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  AlertCircle,
  ArrowUpDown,
  Brain,
  Camera,
  History,
  ImageIcon,
  Loader2,
  LogIn,
  ShieldAlert,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  Upload,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import type { AnalysisResult } from "../backend.d";
import { useInternetIdentity } from "../hooks/useInternetIdentity";
import {
  useAnalysisHistory,
  useAnalyzeStrategy,
  useAnalyzeStrategyWithImage,
  useClearHistory,
} from "../hooks/useQueries";

const STRATEGIES = [
  {
    value: "Scalping",
    label: "Scalping",
    desc: "Quick in-and-out trades on small price movements",
  },
  {
    value: "Breakout",
    label: "Breakout",
    desc: "Trade when price breaks key levels",
  },
  {
    value: "Trend Following",
    label: "Trend Following",
    desc: "Ride established market trends",
  },
  {
    value: "RSI Strategy",
    label: "RSI Strategy",
    desc: "Trade overbought/oversold conditions",
  },
  {
    value: "Support/Resistance",
    label: "Support/Resistance",
    desc: "Trade key price levels",
  },
];

const SYMBOLS = [
  "BTC/USD",
  "ETH/USD",
  "XAU/USD",
  "XAG/USD",
  "EUR/USD",
  "GBP/USD",
  "USD/JPY",
  "NASDAQ",
  "S&P500",
  "OIL",
];

const RISK_COLORS: Record<string, string> = {
  Low: "bg-bull/15 text-bull border-bull/30",
  Medium: "bg-gold/15 text-gold border-gold/30",
  High: "bg-bear/15 text-bear border-bear/30",
};

function getTrendColor(trend: string): string {
  const lower = trend.toLowerCase();
  if (lower.includes("bull")) return "bg-bull/15 text-bull border-bull/30";
  if (lower.includes("bear")) return "bg-bear/15 text-bear border-bear/30";
  return "bg-gold/15 text-gold border-gold/30";
}

function ScoreStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "bull" | "bear" | "gold" | "default";
}) {
  const colorClass =
    accent === "bull"
      ? "text-bull"
      : accent === "bear"
        ? "text-bear"
        : accent === "gold"
          ? "text-gold"
          : "text-foreground";

  return (
    <div className="bg-muted/40 rounded-md p-2 text-center">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide leading-tight mb-0.5">
        {label}
      </p>
      <p className={`font-mono text-xs font-bold ${colorClass}`}>{value}</p>
    </div>
  );
}

function AnalysisCard({ result }: { result: AnalysisResult }) {
  const isBuy = result.signal.toUpperCase().includes("BUY");
  const riskKey = result.riskLevel.includes("Low")
    ? "Low"
    : result.riskLevel.includes("High")
      ? "High"
      : "Medium";

  const trendLower = (result.marketTrend ?? "").toLowerCase();
  const trendAccent = trendLower.includes("bull")
    ? ("bull" as const)
    : trendLower.includes("bear")
      ? ("bear" as const)
      : ("gold" as const);

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden animate-fade-in">
      {/* Terminal header bar */}
      <div
        className={`px-4 py-2.5 flex items-center justify-between ${
          isBuy
            ? "bg-bull/10 border-b border-bull/20"
            : "bg-bear/10 border-b border-bear/20"
        }`}
      >
        <div className="flex items-center gap-2">
          {isBuy ? (
            <TrendingUp className="h-5 w-5 text-bull" />
          ) : (
            <TrendingDown className="h-5 w-5 text-bear" />
          )}
          <Badge
            className={`font-mono font-bold text-sm px-3 py-1 ${isBuy ? "bg-bull text-white" : "bg-bear text-white"}`}
          >
            {result.signal.toUpperCase()}
          </Badge>
          {result.strategyUsed && (
            <span className="text-[10px] text-muted-foreground font-mono">
              {result.strategyUsed}
            </span>
          )}
        </div>
        <Badge
          variant="outline"
          className={`text-xs ${RISK_COLORS[riskKey] ?? ""}`}
        >
          <ShieldAlert className="h-3 w-3 mr-1" />
          {result.riskLevel} Risk
        </Badge>
      </div>

      <div className="p-4 space-y-3">
        {/* Price levels grid */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-signal rounded-md p-2 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
              Entry
            </p>
            <p className="font-mono text-xs font-semibold text-foreground mt-0.5">
              {result.entryPrice}
            </p>
          </div>
          <div className="bg-bear/10 rounded-md p-2 text-center">
            <p className="text-[10px] text-bear uppercase tracking-wide">
              Stop Loss
            </p>
            <p className="font-mono text-xs font-semibold text-bear mt-0.5">
              {result.stopLoss}
            </p>
          </div>
          <div className="bg-bull/10 rounded-md p-2 text-center">
            <p className="text-[10px] text-bull uppercase tracking-wide">
              Take Profit
            </p>
            <p className="font-mono text-xs font-semibold text-bull mt-0.5">
              {result.takeProfit}
            </p>
          </div>
        </div>

        {/* Score grid */}
        {(result.confidence ||
          result.probability ||
          result.entryConfidence ||
          result.stopLossSafety ||
          result.takeProfitProbability) && (
          <div>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
              Analysis Scores
            </p>
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
              {result.confidence && (
                <ScoreStat
                  label="Confidence"
                  value={result.confidence}
                  accent="bull"
                />
              )}
              {result.probability && (
                <ScoreStat
                  label="Success Prob."
                  value={result.probability}
                  accent="bull"
                />
              )}
              {result.entryConfidence && (
                <ScoreStat
                  label="Entry Conf."
                  value={result.entryConfidence}
                  accent="gold"
                />
              )}
              {result.stopLossSafety && (
                <ScoreStat
                  label="SL Safety"
                  value={result.stopLossSafety}
                  accent={
                    result.stopLossSafety.toLowerCase().includes("good")
                      ? "bull"
                      : result.stopLossSafety.toLowerCase().includes("poor")
                        ? "bear"
                        : "gold"
                  }
                />
              )}
              {result.takeProfitProbability && (
                <ScoreStat
                  label="TP Prob."
                  value={result.takeProfitProbability}
                  accent="gold"
                />
              )}
            </div>
          </div>
        )}

        {/* Market trend */}
        {result.marketTrend && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
              Market Trend:
            </span>
            <Badge
              variant="outline"
              className={`text-xs ${getTrendColor(result.marketTrend)}`}
            >
              {trendAccent === "bull" ? (
                <TrendingUp className="h-3 w-3 mr-1" />
              ) : trendAccent === "bear" ? (
                <TrendingDown className="h-3 w-3 mr-1" />
              ) : null}
              {result.marketTrend}
            </Badge>
          </div>
        )}

        {/* Explanation */}
        <p className="text-sm text-muted-foreground leading-relaxed">
          {result.explanation}
        </p>

        {/* Timestamp */}
        {result.timestamp && (
          <p className="text-[10px] text-muted-foreground">
            {new Date(Number(result.timestamp) / 1_000_000).toLocaleString()}
          </p>
        )}
      </div>
    </div>
  );
}

export function AIAnalysis() {
  const { identity, login, isLoggingIn } = useInternetIdentity();
  const isLoggedIn = !!identity;

  const [strategy, setStrategy] = useState("Scalping");
  const [symbol, setSymbol] = useState("BTC/USD");
  const [notes, setNotes] = useState("");
  const [latestResult, setLatestResult] = useState<AnalysisResult | null>(null);

  // Image upload state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: history = [], isLoading: historyLoading } =
    useAnalysisHistory();
  const analyze = useAnalyzeStrategy();
  const analyzeWithImage = useAnalyzeStrategyWithImage();
  const clearHistory = useClearHistory();

  const isAnalyzing = analyze.isPending || analyzeWithImage.isPending;
  const analyzeError = analyze.error ?? analyzeWithImage.error;
  const isAnalyzeError = analyze.isError || analyzeWithImage.isError;

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be under 10MB");
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImagePreview(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleImageClear = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Strip the data URL prefix (e.g. "data:image/png;base64,")
        const base64 = result.split(",")[1] ?? result;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleAnalyze = async () => {
    if (!identity) return;
    try {
      let result: AnalysisResult;
      if (imageFile) {
        const base64 = await fileToBase64(imageFile);
        result = await analyzeWithImage.mutateAsync({
          strategyName: strategy,
          symbol,
          notes: notes.trim() || undefined,
          imageBase64: base64,
          mimeType: imageFile.type,
        });
      } else {
        result = await analyze.mutateAsync({
          principal: identity.getPrincipal(),
          strategyName: strategy,
          symbol,
          notes: notes.trim() || undefined,
        });
      }
      setLatestResult(result);
      toast.success("Analysis complete!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Analysis failed");
    }
  };

  const handleClearHistory = async () => {
    try {
      await clearHistory.mutateAsync();
      toast.success("History cleared");
    } catch {
      toast.error("Failed to clear history");
    }
  };

  return (
    <div className="flex flex-col gap-4 pb-2">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Brain className="h-5 w-5 text-primary" />
        <h2 className="font-semibold text-base text-foreground">
          AI Strategy Analysis
        </h2>
      </div>

      {/* Login gate */}
      {!isLoggedIn && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 flex flex-col items-center gap-3 text-center">
          <Brain className="h-8 w-8 text-primary opacity-60" />
          <div>
            <p className="font-medium text-foreground text-sm">
              Sign in to access AI analysis
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Get personalized AI-powered trading signals and strategy analysis
            </p>
          </div>
          <Button onClick={login} disabled={isLoggingIn} size="sm">
            {isLoggingIn ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <LogIn className="h-4 w-4 mr-2" />
            )}
            {isLoggingIn ? "Signing in..." : "Sign In"}
          </Button>
        </div>
      )}

      {/* Analysis form */}
      {isLoggedIn && (
        <div className="bg-card border border-border rounded-lg p-4 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            {/* Strategy selector */}
            <div className="col-span-2 sm:col-span-1">
              <label
                htmlFor="strategy-select"
                className="text-xs font-medium text-muted-foreground mb-1.5 block"
              >
                Strategy
              </label>
              <Select value={strategy} onValueChange={setStrategy}>
                <SelectTrigger id="strategy-select" className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STRATEGIES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      <div>
                        <p className="text-sm">{s.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {s.desc}
                        </p>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Symbol selector */}
            <div className="col-span-2 sm:col-span-1">
              <label
                htmlFor="symbol-select"
                className="text-xs font-medium text-muted-foreground mb-1.5 block"
              >
                Symbol
              </label>
              <Select value={symbol} onValueChange={setSymbol}>
                <SelectTrigger id="symbol-select" className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SYMBOLS.map((s) => (
                    <SelectItem key={s} value={s} className="font-mono text-sm">
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Chart screenshot upload */}
          <div>
            <label
              htmlFor="chart-image-upload"
              className="text-xs font-medium text-muted-foreground mb-1.5 block flex items-center gap-1"
            >
              <Camera className="h-3.5 w-3.5" />
              Upload Chart Screenshot
              <span className="text-muted-foreground/60 font-normal">
                (optional — AI will analyze the chart visually)
              </span>
            </label>

            {imagePreview ? (
              <div className="relative rounded-lg overflow-hidden border border-border">
                <img
                  src={imagePreview}
                  alt="Chart screenshot preview"
                  className="w-full max-h-40 object-contain bg-muted/30"
                />
                <button
                  type="button"
                  onClick={handleImageClear}
                  className="absolute top-2 right-2 h-6 w-6 rounded-full bg-background/90 border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Remove image"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                <div className="absolute bottom-2 left-2">
                  <Badge className="text-[10px] bg-primary/80 text-white">
                    <ImageIcon className="h-3 w-3 mr-1" />
                    Chart uploaded
                  </Badge>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-border rounded-lg p-4 flex flex-col items-center gap-2 text-muted-foreground hover:border-primary/40 hover:text-foreground hover:bg-primary/5 transition-all cursor-pointer"
              >
                <Upload className="h-6 w-6 opacity-50" />
                <div className="text-center">
                  <p className="text-xs font-medium">
                    Click to upload chart screenshot
                  </p>
                  <p className="text-[10px] text-muted-foreground/70">
                    PNG, JPG, WebP — max 10MB
                  </p>
                </div>
              </button>
            )}

            <input
              ref={fileInputRef}
              id="chart-image-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageSelect}
              aria-label="Upload chart screenshot"
            />
          </div>

          {/* Notes */}
          <div>
            <label
              htmlFor="analysis-notes"
              className="text-xs font-medium text-muted-foreground mb-1.5 block"
            >
              Notes (optional)
            </label>
            <Textarea
              id="analysis-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add context, market observations, or custom strategy rules..."
              className="text-sm h-20 resize-none"
            />
          </div>

          {/* Analyze button */}
          <Button
            onClick={handleAnalyze}
            disabled={isAnalyzing}
            className="w-full"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {imageFile
                  ? "Analyzing chart image with AI..."
                  : "Analyzing with AI..."}
              </>
            ) : (
              <>
                {imageFile ? (
                  <Camera className="h-4 w-4 mr-2" />
                ) : (
                  <Brain className="h-4 w-4 mr-2" />
                )}
                {imageFile
                  ? `Analyze Chart Image — ${symbol}`
                  : `Analyze ${symbol} — ${strategy}`}
              </>
            )}
          </Button>
        </div>
      )}

      {/* Error state */}
      {isAnalyzeError && (
        <div className="flex items-center gap-2 bg-destructive/10 text-destructive rounded-lg p-3 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{analyzeError?.message ?? "Analysis failed. Try again."}</span>
        </div>
      )}

      {/* Latest result */}
      {latestResult && (
        <div>
          <h3 className="text-sm font-medium text-foreground mb-2 flex items-center gap-1.5">
            <Target className="h-4 w-4 text-primary" />
            Latest Analysis
          </h3>
          <AnalysisCard result={latestResult} />
        </div>
      )}

      {/* Analysis history */}
      {isLoggedIn && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-foreground flex items-center gap-1.5">
              <History className="h-4 w-4 text-muted-foreground" />
              History
              {history.length > 0 && (
                <Badge variant="secondary" className="text-xs ml-1">
                  {history.length}
                </Badge>
              )}
            </h3>
            {history.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-destructive hover:text-destructive"
                onClick={handleClearHistory}
                disabled={clearHistory.isPending}
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Clear
              </Button>
            )}
          </div>

          {historyLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-24 w-full rounded-lg" />
              ))}
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ArrowUpDown className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">
                No analyses yet. Run your first analysis above.
              </p>
            </div>
          ) : (
            <ScrollArea className="max-h-96">
              <div className="space-y-2 pr-2">
                {history.map((result, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: history entries have no stable ID
                  <div key={`history-${i}`}>
                    <AnalysisCard result={result} />
                    {i < history.length - 1 && <Separator className="my-2" />}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center">
        AI analysis is for educational purposes only. Not financial advice.
      </p>
    </div>
  );
}
