import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Activity,
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Brain,
  ChevronDown,
  ChevronUp,
  History,
  ImageIcon,
  Info,
  Loader2,
  LogIn,
  Paperclip,
  Plus,
  RefreshCw,
  Send,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
  X,
  Zap,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { AnalysisResult, CustomStrategy } from "../backend.d";
import { useInternetIdentity } from "../hooks/useInternetIdentity";
import {
  useAnalysisHistory,
  useAnalyzeStrategy,
  useAnalyzeStrategyWithImage,
  useApprovedStrategies,
  useClearHistory,
  useCustomStrategies,
  useGenerateCustomStrategy,
} from "../hooks/useQueries";

// ─── Gemini Client-Side Parser ────────────────────────────────

/**
 * Parses a raw Gemini HTTP response body to extract the AI analysis JSON.
 * The backend may return "Parse failed. Raw response: <raw>" in the explanation
 * field if its own parsing fails. This function recovers the actual values.
 *
 * Gemini response structure:
 * {"candidates":[{"content":{"parts":[{"text":"{...json...}"}]}}]}
 */
function extractTextFromGeminiResponse(raw: string): string | null {
  // Find "text": or "text" : in the raw string
  const textKeyPattern = /"text"\s*:\s*"/;
  const match = textKeyPattern.exec(raw);
  if (!match) return null;

  // Start reading after the opening quote of the text value
  const startIdx = match.index + match[0].length;
  let result = "";
  let i = startIdx;
  let prevWasBackslash = false;

  while (i < raw.length) {
    const ch = raw[i];
    if (prevWasBackslash) {
      // Escaped character — include it literally (with escape)
      result += `\\${ch}`;
      prevWasBackslash = false;
    } else if (ch === "\\") {
      prevWasBackslash = true;
    } else if (ch === '"') {
      // Unescaped quote = end of text value
      break;
    } else {
      result += ch;
    }
    i++;
  }

  return result;
}

function unescapeJsonString(str: string): string {
  return str
    .replace(/\\"/g, '"')
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\r/g, "\r")
    .replace(/\\\\/g, "\\");
}

function stripMarkdownFences(str: string): string {
  return str
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();
}

export function parseGeminiResponse(
  rawResponse: string,
): Partial<AnalysisResult> | null {
  try {
    // Try to find the last "text": field (skip echoed prompt)
    // We search for all occurrences and use the last one
    const textKeyRegex = /"text"\s*:\s*"/g;
    let lastMatch: RegExpExecArray | null = null;
    let m: RegExpExecArray | null;
    // biome-ignore lint/suspicious/noAssignInExpressions: iterating regex matches
    while ((m = textKeyRegex.exec(rawResponse)) !== null) {
      lastMatch = m;
    }

    if (!lastMatch) return null;

    const startIdx = lastMatch.index + lastMatch[0].length;
    let extracted = "";
    let j = startIdx;
    let prevBackslash = false;

    while (j < rawResponse.length) {
      const ch = rawResponse[j];
      if (prevBackslash) {
        extracted += `\\${ch}`;
        prevBackslash = false;
      } else if (ch === "\\") {
        prevBackslash = true;
      } else if (ch === '"') {
        break;
      } else {
        extracted += ch;
      }
      j++;
    }

    // Unescape and strip fences
    const unescaped = unescapeJsonString(extracted);
    const stripped = stripMarkdownFences(unescaped);

    if (!stripped || stripped.length < 2) return null;

    // Parse as JSON
    const parsed = JSON.parse(stripped) as Record<string, unknown>;

    const getString = (key: string): string => {
      const val = parsed[key];
      return typeof val === "string" ? val : "";
    };

    return {
      signal: getString("signal") || getString("Signal") || "N/A",
      entryPrice:
        getString("entryPrice") ||
        getString("entry_price") ||
        getString("entry") ||
        "N/A",
      stopLoss:
        getString("stopLoss") ||
        getString("stop_loss") ||
        getString("stopLoss") ||
        "N/A",
      takeProfit:
        getString("takeProfit") ||
        getString("take_profit") ||
        getString("takeProfit") ||
        "N/A",
      riskLevel:
        getString("riskLevel") ||
        getString("risk_level") ||
        getString("risk") ||
        "Medium",
      confidence:
        getString("confidence") || getString("Confidence") || undefined,
      probability:
        getString("probability") || getString("Probability") || undefined,
      entryConfidence:
        getString("entryConfidence") ||
        getString("entry_confidence") ||
        undefined,
      stopLossSafety:
        getString("stopLossSafety") ||
        getString("stop_loss_safety") ||
        undefined,
      takeProfitProbability:
        getString("takeProfitProbability") ||
        getString("take_profit_probability") ||
        undefined,
      marketTrend:
        getString("marketTrend") || getString("market_trend") || undefined,
      strategyUsed:
        getString("strategyUsed") || getString("strategy_used") || undefined,
      explanation:
        getString("explanation") ||
        getString("Explanation") ||
        getString("reasoning") ||
        "AI analysis complete.",
    };
  } catch {
    // Also try extracting from the first occurrence if last failed
    const simpleExtracted = extractTextFromGeminiResponse(rawResponse);
    if (simpleExtracted) {
      try {
        const unescaped = unescapeJsonString(simpleExtracted);
        const stripped = stripMarkdownFences(unescaped);
        const parsed = JSON.parse(stripped) as Record<string, unknown>;
        const getString = (key: string): string => {
          const val = parsed[key];
          return typeof val === "string" ? val : "";
        };
        return {
          signal: getString("signal") || "N/A",
          entryPrice: getString("entryPrice") || getString("entry") || "N/A",
          stopLoss: getString("stopLoss") || "N/A",
          takeProfit: getString("takeProfit") || "N/A",
          riskLevel: getString("riskLevel") || "Medium",
          confidence: getString("confidence") || undefined,
          probability: getString("probability") || undefined,
          explanation: getString("explanation") || "AI analysis complete.",
        };
      } catch {
        return null;
      }
    }
    return null;
  }
}

// ─── Recovery logic for N/A results ──────────────────────────

const PARSE_FAILED_PREFIX = "Parse failed. Raw response: ";

function recoverAnalysisResult(result: AnalysisResult): AnalysisResult {
  const isNASignal =
    result.signal === "N/A" ||
    result.signal === "Error" ||
    result.signal === "" ||
    result.signal === "TODO";

  if (!isNASignal) return result;

  // Try to recover from explanation containing raw response
  if (result.explanation?.startsWith(PARSE_FAILED_PREFIX)) {
    const rawSnippet = result.explanation.slice(PARSE_FAILED_PREFIX.length);
    const parsed = parseGeminiResponse(rawSnippet);
    if (parsed?.signal && parsed.signal !== "N/A") {
      return {
        ...result,
        ...parsed,
        signal: parsed.signal ?? result.signal,
        entryPrice: parsed.entryPrice ?? result.entryPrice,
        stopLoss: parsed.stopLoss ?? result.stopLoss,
        takeProfit: parsed.takeProfit ?? result.takeProfit,
        riskLevel: parsed.riskLevel ?? result.riskLevel,
        confidence: parsed.confidence ?? result.confidence,
        probability: parsed.probability ?? result.probability,
        entryConfidence: parsed.entryConfidence ?? result.entryConfidence,
        stopLossSafety: parsed.stopLossSafety ?? result.stopLossSafety,
        takeProfitProbability:
          parsed.takeProfitProbability ?? result.takeProfitProbability,
        marketTrend: parsed.marketTrend ?? result.marketTrend,
        strategyUsed: parsed.strategyUsed ?? result.strategyUsed,
        explanation: parsed.explanation ?? result.explanation,
      };
    }
  }

  // Also try if explanation has embedded raw JSON even without the prefix
  if (result.explanation?.includes('"candidates"')) {
    const parsed = parseGeminiResponse(result.explanation);
    if (parsed?.signal && parsed.signal !== "N/A") {
      return { ...result, ...parsed };
    }
  }

  return result;
}

// ─── Constants ────────────────────────────────────────────────

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

function calcRiskReward(entry: string, sl: string, tp: string): string | null {
  const e = Number.parseFloat(entry.replace(/[^0-9.]/g, ""));
  const s = Number.parseFloat(sl.replace(/[^0-9.]/g, ""));
  const t = Number.parseFloat(tp.replace(/[^0-9.]/g, ""));
  if (
    Number.isNaN(e) ||
    Number.isNaN(s) ||
    Number.isNaN(t) ||
    e === s ||
    e === t
  )
    return null;
  const risk = Math.abs(e - s);
  const reward = Math.abs(t - e);
  if (risk === 0) return null;
  const ratio = reward / risk;
  return `1:${ratio.toFixed(1)}`;
}

// ─── Built-in strategies ──────────────────────────────────────

interface BuiltInStrategy {
  name: string;
  description: string;
  howItWorks: string;
  category: "momentum" | "breakout" | "trend" | "oscillator" | "levels";
  extraQuestions?: ExtraQuestion[];
}

interface ExtraQuestion {
  text: string;
  chips: string[];
  key: string;
  isImageUpload?: boolean;
}

const STRATEGY_CATEGORY_COLORS: Record<string, string> = {
  momentum: "bg-primary/20 text-primary",
  breakout: "bg-gold/20 text-gold",
  trend: "bg-bull/20 text-bull",
  oscillator: "bg-bear/20 text-bear",
  levels: "bg-purple-500/20 text-purple-400",
};

const BUILTIN_STRATEGIES: BuiltInStrategy[] = [
  {
    name: "Scalping",
    description: "Fast 1m/5m price action — 5-10 pip targets",
    howItWorks:
      "Enter on 1m/5m charts using price action. Look for quick momentum moves near support/resistance. Target 5-10 pip moves with tight stops of 3-5 pips.",
    category: "momentum",
    extraQuestions: [
      {
        key: "timezone",
        text: "Which trading session are you in? (Scalping is session-dependent)",
        chips: ["London Open", "NY Open", "Asian Session", "Skip"],
      },
    ],
  },
  {
    name: "Breakout",
    description: "Enter S/R breakouts with volume confirmation",
    howItWorks:
      "Wait for price to break above resistance or below support with volume. Enter on the breakout candle close, stop below the broken level.",
    category: "breakout",
    extraQuestions: [
      {
        key: "chartImage",
        text: "Upload a chart screenshot showing the key levels for better analysis.",
        chips: ["Skip"],
        isImageUpload: true,
      },
    ],
  },
  {
    name: "Trend Following",
    description: "EMA 20/50 crossover — ride the trend",
    howItWorks:
      "Use EMA 20/50 crossover. Trade in direction of the trend. Enter on pullbacks to the EMA, exit when trend reverses.",
    category: "trend",
  },
  {
    name: "RSI Strategy",
    description: "Buy oversold (RSI<30), sell overbought (RSI>70)",
    howItWorks:
      "Enter BUY when RSI drops below 30 and bounces back above (oversold). Enter SELL when RSI rises above 70 and drops back below (overbought). Confirm with price action.",
    category: "oscillator",
    extraQuestions: [
      {
        key: "chartImage",
        text: "Upload a chart screenshot with RSI indicator visible for visual analysis.",
        chips: ["Skip"],
        isImageUpload: true,
      },
    ],
  },
  {
    name: "Support/Resistance",
    description: "Buy at support, sell at resistance with stops",
    howItWorks:
      "Mark key support and resistance levels. Buy at support with stop below, sell at resistance with stop above. Target the opposite level.",
    category: "levels",
    extraQuestions: [
      {
        key: "chartImage",
        text: "Upload a chart showing your key S/R levels for precision analysis.",
        chips: ["Skip"],
        isImageUpload: true,
      },
    ],
  },
];

// ─── Base questions ───────────────────────────────────────────

interface QuestionDef {
  text: string;
  chips: string[];
  key: string;
  isImageUpload?: boolean;
}

const BASE_QUESTIONS: QuestionDef[] = [
  {
    key: "symbol",
    text: "Which asset are you analyzing?",
    chips: [
      "BTC/USD",
      "ETH/USD",
      "XAU/USD",
      "EUR/USD",
      "NASDAQ",
      "OIL",
      "Other",
    ],
  },
  {
    key: "timeframe",
    text: "What timeframe are you trading?",
    chips: ["1m", "5m", "15m", "1h", "4h", "1D"],
  },
  {
    key: "risk",
    text: "What's your risk appetite?",
    chips: ["Conservative", "Moderate", "Aggressive"],
  },
];

const RISK_MAP: Record<string, string> = {
  Conservative: "Low",
  Moderate: "Medium",
  Aggressive: "High",
};

function getQuestionsForStrategy(
  strategyName: string,
  isCustom = false,
): QuestionDef[] {
  const base = [...BASE_QUESTIONS];
  if (isCustom) {
    return [
      ...base,
      {
        key: "chartImage",
        text: "Do you have a chart screenshot? Upload it or skip.",
        chips: ["Skip"],
        isImageUpload: true,
      },
    ];
  }
  const builtin = BUILTIN_STRATEGIES.find((s) => s.name === strategyName);
  if (builtin?.extraQuestions) {
    return [...base, ...builtin.extraQuestions];
  }
  return base;
}

// ─── Helpers ──────────────────────────────────────────────────

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1] ?? result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─── Chat types ───────────────────────────────────────────────

type ChatPhase = "greeting" | "questioning" | "analyzing" | "result";

interface AnswerMap {
  symbol?: string;
  timeframe?: string;
  risk?: string;
  timezone?: string;
  chartImage?: string;
  [key: string]: string | undefined;
}

interface ChatMessage {
  id: string;
  role: "ai" | "user";
  content: string | React.ReactNode;
  type?: "text" | "chips" | "result" | "image-preview" | "error";
  chips?: string[];
  result?: AnalysisResult;
  isImageUploadPrompt?: boolean;
  timestamp?: string;
  chipsUsed?: boolean;
}

// ─── SignalStrength ───────────────────────────────────────────

function SignalStrength({
  signal,
  confidence,
}: {
  signal: string;
  confidence?: string;
}) {
  const isBuy = signal.toUpperCase().includes("BUY");
  const parsed = confidence
    ? Number.parseInt(confidence.replace(/[^0-9]/g, ""), 10)
    : 0;
  const pct = Number.isNaN(parsed) ? 0 : Math.min(100, Math.max(0, parsed));
  const bars = Math.round((pct / 100) * 5);

  return (
    <div className="flex items-center gap-2">
      <div
        className={`flex items-center justify-center w-10 h-10 rounded-xl shrink-0 ${isBuy ? "bg-bull/15" : "bg-bear/15"}`}
      >
        {isBuy ? (
          <ArrowUp className="h-5 w-5 text-bull" />
        ) : (
          <ArrowDown className="h-5 w-5 text-bear" />
        )}
      </div>
      <div className="flex flex-col gap-1">
        <span
          className={`text-xs font-bold font-mono ${isBuy ? "text-bull" : "text-bear"}`}
        >
          {signal.toUpperCase()}
        </span>
        {pct > 0 && (
          <div className="flex gap-0.5">
            {Array.from({ length: 5 }).map((_, idx) => (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: fixed 5 bars
                key={idx}
                className={`h-2 w-4 rounded-sm transition-all ${
                  idx < bars ? (isBuy ? "bg-bull" : "bg-bear") : "bg-muted/50"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ScoreStat ────────────────────────────────────────────────

function ScoreStat({
  label,
  value,
  accent,
  icon,
}: {
  label: string;
  value: string;
  accent?: "bull" | "bear" | "gold" | "default";
  icon?: React.ReactNode;
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
    <div className="bg-muted/40 rounded-lg p-2.5 text-center border border-border/50">
      {icon && (
        <div className="flex justify-center mb-1 opacity-60">{icon}</div>
      )}
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide leading-tight mb-1">
        {label}
      </p>
      <p className={`font-mono text-sm font-bold ${colorClass}`}>{value}</p>
    </div>
  );
}

// ─── ConfidenceMeter ──────────────────────────────────────────

function ConfidenceMeter({ confidence }: { confidence?: string }) {
  if (!confidence) return null;

  const parsed = Number.parseInt(confidence.replace(/[^0-9]/g, ""), 10);
  const isValid = !Number.isNaN(parsed) && parsed >= 0 && parsed <= 100;

  const colorClass = !isValid
    ? "text-muted-foreground"
    : parsed >= 70
      ? "text-bull"
      : parsed >= 40
        ? "text-gold"
        : "text-bear";

  const barColorClass = !isValid
    ? "bg-muted-foreground/40"
    : parsed >= 70
      ? "bg-bull"
      : parsed >= 40
        ? "bg-gold"
        : "bg-bear";

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
          <Activity className="h-3 w-3" />
          Signal Confidence
        </p>
        <span className={`text-sm font-mono font-bold ${colorClass}`}>
          {isValid ? `${parsed}%` : "—"}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted/60 overflow-hidden">
        {isValid && (
          <motion.div
            className={`h-full rounded-full ${barColorClass}`}
            initial={{ width: 0 }}
            animate={{ width: `${parsed}%` }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
          />
        )}
      </div>
    </div>
  );
}

// ─── AnalysisCard ─────────────────────────────────────────────

function AnalysisCard({ result }: { result: AnalysisResult }) {
  // Recover from parse failure
  const r = recoverAnalysisResult(result);

  const isBuy = r.signal.toUpperCase().includes("BUY");
  const isError =
    r.signal === "N/A" || r.signal === "Error" || r.signal === "TODO";

  const riskKey = r.riskLevel?.includes("Low")
    ? "Low"
    : r.riskLevel?.includes("High")
      ? "High"
      : "Medium";

  const trendLower = (r.marketTrend ?? "").toLowerCase();
  const trendAccent = trendLower.includes("bull")
    ? ("bull" as const)
    : trendLower.includes("bear")
      ? ("bear" as const)
      : ("gold" as const);

  const rrRatio = calcRiskReward(r.entryPrice, r.stopLoss, r.takeProfit);

  // Show raw error state — never hide the actual error message
  if (isError) {
    return (
      <div className="bg-card border border-border rounded-xl overflow-hidden w-full">
        <div className="p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-bear/15 flex items-center justify-center shrink-0">
              <AlertCircle className="h-4 w-4 text-bear" />
            </div>
            <p className="font-semibold text-sm text-foreground">
              Analysis Failed
            </p>
          </div>
          {r.explanation && (
            <p className="text-xs text-foreground/80 leading-relaxed break-words font-mono bg-muted/40 rounded-lg p-3 border border-border/50 whitespace-pre-wrap">
              {r.explanation}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="bg-card border border-border rounded-xl overflow-hidden w-full"
    >
      {/* Signal header */}
      <div
        className={`px-4 py-3 flex items-center justify-between gap-3 ${
          isBuy
            ? "bg-bull/8 border-b border-bull/20"
            : "bg-bear/8 border-b border-bear/20"
        }`}
      >
        <SignalStrength signal={r.signal} confidence={r.confidence} />
        <div className="flex flex-col items-end gap-1 shrink-0">
          <Badge
            variant="outline"
            className={`text-xs ${RISK_COLORS[riskKey] ?? ""}`}
          >
            <ShieldAlert className="h-3 w-3 mr-1" />
            {r.riskLevel ?? "N/A"} Risk
          </Badge>
          {r.strategyUsed && (
            <span className="text-[10px] text-muted-foreground font-mono">
              {r.strategyUsed}
            </span>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Price levels — larger, more prominent */}
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Target className="h-3 w-3" />
            Price Levels
          </p>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-signal rounded-lg p-3 text-center border border-border/50">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
                Entry
              </p>
              <p className="font-mono text-base font-bold text-foreground break-all leading-tight">
                {r.entryPrice}
              </p>
            </div>
            <div className="bg-bear/8 rounded-lg p-3 text-center border border-bear/20">
              <p className="text-[10px] text-bear uppercase tracking-wide mb-1">
                Stop Loss
              </p>
              <p className="font-mono text-base font-bold text-bear break-all leading-tight">
                {r.stopLoss}
              </p>
            </div>
            <div className="bg-bull/8 rounded-lg p-3 text-center border border-bull/20">
              <p className="text-[10px] text-bull uppercase tracking-wide mb-1">
                Take Profit
              </p>
              <p className="font-mono text-base font-bold text-bull break-all leading-tight">
                {r.takeProfit}
              </p>
            </div>
          </div>
          {rrRatio && (
            <div className="mt-2 flex items-center justify-end gap-1.5">
              <Trophy className="h-3 w-3 text-gold" />
              <span className="text-xs font-mono text-gold font-semibold">
                R:R {rrRatio}
              </span>
            </div>
          )}
        </div>

        <Separator />

        {/* Confidence meter */}
        {r.confidence && <ConfidenceMeter confidence={r.confidence} />}

        {/* Score grid */}
        {(r.probability ||
          r.entryConfidence ||
          r.stopLossSafety ||
          r.takeProfitProbability) && (
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Zap className="h-3 w-3" />
              Analysis Scores
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {r.probability && (
                <ScoreStat
                  label="Success Prob."
                  value={r.probability}
                  accent="bull"
                />
              )}
              {r.entryConfidence && (
                <ScoreStat
                  label="Entry Conf."
                  value={r.entryConfidence}
                  accent="gold"
                />
              )}
              {r.stopLossSafety && (
                <ScoreStat
                  label="SL Safety"
                  value={r.stopLossSafety}
                  accent={
                    r.stopLossSafety.toLowerCase().includes("good")
                      ? "bull"
                      : r.stopLossSafety.toLowerCase().includes("poor")
                        ? "bear"
                        : "gold"
                  }
                />
              )}
              {r.takeProfitProbability && (
                <ScoreStat
                  label="TP Prob."
                  value={r.takeProfitProbability}
                  accent="gold"
                />
              )}
            </div>
          </div>
        )}

        {/* Market trend */}
        {r.marketTrend && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">
              Market Trend:
            </span>
            <Badge
              variant="outline"
              className={`text-xs ${getTrendColor(r.marketTrend)}`}
            >
              {trendAccent === "bull" ? (
                <TrendingUp className="h-3 w-3 mr-1" />
              ) : trendAccent === "bear" ? (
                <TrendingDown className="h-3 w-3 mr-1" />
              ) : null}
              {r.marketTrend}
            </Badge>
          </div>
        )}

        <Separator />

        {/* Explanation */}
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <Brain className="h-3 w-3" />
            AI Reasoning
          </p>
          <p className="text-sm text-foreground/80 leading-relaxed break-words">
            {r.explanation}
          </p>
        </div>

        {/* Timestamp */}
        {r.timestamp && (
          <p className="text-[10px] text-muted-foreground text-right">
            {new Date(Number(r.timestamp) / 1_000_000).toLocaleString()}
          </p>
        )}
      </div>
    </motion.div>
  );
}

// ─── ChatBubble ───────────────────────────────────────────────

function ChatBubble({
  message,
  onChipClick,
  onImageAttach,
  imageFile,
  imagePreview,
  onImageClear,
  stepInfo,
}: {
  message: ChatMessage;
  onChipClick?: (chip: string) => void;
  onImageAttach?: () => void;
  imageFile?: File | null;
  imagePreview?: string | null;
  onImageClear?: () => void;
  stepInfo?: string;
}) {
  const isAI = message.role === "ai";
  const chipsInteractive = !message.chipsUsed && !!onChipClick;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      className={`flex gap-2.5 ${isAI ? "justify-start" : "justify-end"}`}
    >
      {/* AI avatar */}
      {isAI && (
        <div className="shrink-0 w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mt-0.5">
          <Brain className="h-3.5 w-3.5 text-primary" />
        </div>
      )}

      <div
        className={`max-w-[86%] flex flex-col gap-2 ${isAI ? "items-start" : "items-end"} min-w-0`}
      >
        {/* Progress hint */}
        {isAI && stepInfo && (
          <span className="text-[10px] text-muted-foreground pl-1">
            {stepInfo}
          </span>
        )}

        {/* Message content */}
        {message.type === "result" && message.result ? (
          <div className="w-full max-w-[340px]">
            <AnalysisCard result={message.result} />
          </div>
        ) : message.type === "image-preview" ? (
          <div className="rounded-xl overflow-hidden border border-border">
            {message.content}
          </div>
        ) : message.type === "error" ? (
          <div className="bg-bear/8 border border-bear/20 rounded-2xl rounded-tl-sm px-4 py-3 flex items-start gap-2.5 max-w-[300px]">
            <AlertCircle className="h-4 w-4 text-bear shrink-0 mt-0.5" />
            <p className="text-sm text-foreground/90 leading-relaxed">
              {message.content}
            </p>
          </div>
        ) : (
          <div
            className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed break-words max-w-[300px] ${
              isAI
                ? "bg-card border border-border/70 text-foreground rounded-tl-sm border-l-2 border-l-primary/40"
                : "bg-primary text-primary-foreground rounded-tr-sm shadow-sm"
            }`}
          >
            {message.content}
          </div>
        )}

        {/* Quick-reply chips + optional image upload */}
        {message.chips &&
        message.chips.length > 0 &&
        message.isImageUploadPrompt &&
        onImageAttach &&
        chipsInteractive ? (
          <div className="flex flex-col gap-2 w-full max-w-[300px]">
            <button
              type="button"
              onClick={onImageAttach}
              className="flex items-center gap-2 px-4 py-3 min-h-[48px] rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 text-primary text-sm font-medium hover:bg-primary/10 hover:border-primary/50 transition-all active:scale-[0.98]"
            >
              <ImageIcon className="h-4 w-4 shrink-0" />
              {imageFile ? "Change screenshot..." : "Upload chart screenshot"}
            </button>
            {imagePreview && imageFile && (
              <div className="relative inline-block w-fit">
                <img
                  src={imagePreview}
                  alt="Chart preview"
                  className="h-16 w-24 object-cover rounded-lg border border-border"
                />
                <button
                  type="button"
                  onClick={onImageClear}
                  className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-background border border-border flex items-center justify-center hover:bg-muted transition-colors"
                  aria-label="Remove image"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            <div className="flex flex-wrap gap-1.5">
              {message.chips.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => onChipClick?.(chip)}
                  className="inline-flex items-center px-3.5 py-2 min-h-[40px] rounded-full text-xs font-semibold border border-border bg-card text-foreground hover:bg-muted/60 hover:border-primary/40 transition-all active:scale-95"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        ) : message.chips && message.chips.length > 0 && chipsInteractive ? (
          <div className="flex flex-wrap gap-1.5 max-w-[300px]">
            {message.chips.map((chip) =>
              chip === "__retry__" ? (
                <button
                  key={chip}
                  type="button"
                  onClick={() => onChipClick?.(chip)}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 min-h-[44px] rounded-full text-xs font-semibold border border-gold/40 bg-gold/10 text-gold hover:bg-gold/20 hover:border-gold/60 transition-all active:scale-95"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Try Again
                </button>
              ) : chip === "__submit_strategy__" ? (
                <button
                  key={chip}
                  type="button"
                  onClick={() => onChipClick?.(chip)}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 min-h-[44px] rounded-full text-xs font-semibold border border-gold/40 bg-gold/10 text-gold hover:bg-gold/20 hover:border-gold/60 transition-all active:scale-95"
                >
                  <Trophy className="h-3.5 w-3.5" />
                  Submit Strategy
                </button>
              ) : chip === "__new_analysis__" ? (
                <button
                  key={chip}
                  type="button"
                  onClick={() => onChipClick?.(chip)}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 min-h-[44px] rounded-full text-xs font-semibold border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 hover:border-primary/60 transition-all active:scale-95"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  New Analysis
                </button>
              ) : (
                <button
                  key={chip}
                  type="button"
                  onClick={() => onChipClick?.(chip)}
                  className="inline-flex items-center px-3.5 py-2 min-h-[40px] rounded-full text-xs font-semibold border border-border bg-card text-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/40 transition-all active:scale-95"
                >
                  {chip}
                </button>
              ),
            )}
          </div>
        ) : null}

        {/* Timestamp */}
        {message.timestamp && (
          <span className="text-[10px] text-muted-foreground/60 px-1">
            {message.timestamp}
          </span>
        )}
      </div>
    </motion.div>
  );
}

// ─── AnalyzingStatus ──────────────────────────────────────────

const ANALYZING_MESSAGES = [
  "Fetching market context...",
  "Running strategy analysis...",
  "Generating trade signals...",
  "Calculating risk/reward...",
  "Finalizing report...",
] as const;

function AnalyzingStatus() {
  const [msgIndex, setMsgIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setMsgIndex(0);
    setVisible(true);
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setMsgIndex((prev) => (prev + 1) % ANALYZING_MESSAGES.length);
        setVisible(true);
      }, 250);
    }, 1600);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      className="flex gap-2.5 justify-start"
    >
      <div className="shrink-0 w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
        <Brain className="h-3.5 w-3.5 text-primary" />
      </div>
      <div className="bg-card border border-border border-l-2 border-l-primary/40 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-3 min-w-[200px]">
        <Loader2 className="h-3.5 w-3.5 text-primary animate-spin shrink-0" />
        <motion.span
          key={msgIndex}
          initial={{ opacity: 0 }}
          animate={{ opacity: visible ? 1 : 0 }}
          className="text-xs text-muted-foreground font-medium"
        >
          {ANALYZING_MESSAGES[msgIndex]}
        </motion.span>
      </div>
    </motion.div>
  );
}

// ─── Strategy Info Panel ──────────────────────────────────────

function StrategyInfoPanel({
  howItWorks,
  open,
}: {
  howItWorks: string;
  open: boolean;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden"
        >
          <div className="mx-3 mb-3 p-3 rounded-lg bg-primary/5 border border-primary/20 text-xs text-foreground leading-relaxed">
            <p className="font-bold text-primary mb-1.5 flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5" /> How it works
            </p>
            {howItWorks}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Strategy Row ─────────────────────────────────────────────

function StrategyRow({
  name,
  description,
  howItWorks,
  category,
  badge,
  onSelect,
}: {
  name: string;
  description: string;
  howItWorks: string;
  category?: string;
  badge?: string;
  onSelect: () => void;
}) {
  const [infoOpen, setInfoOpen] = useState(false);
  const catColor = category ? STRATEGY_CATEGORY_COLORS[category] : "";

  return (
    <div className="border-b border-border/40 last:border-b-0">
      <div className="flex items-center min-h-[52px] px-3 gap-2">
        {/* Category dot */}
        <div
          className={`w-2 h-2 rounded-full shrink-0 ${catColor ? catColor.split(" ")[0] : "bg-muted"}`}
        />
        <button
          type="button"
          onClick={onSelect}
          className="flex-1 flex flex-col items-start justify-center py-2 text-left min-w-0 hover:bg-muted/20 active:bg-muted/30 transition-colors rounded-md -ml-0.5 pl-1.5 pr-1"
        >
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-semibold text-foreground">
              {name}
            </span>
            {badge && (
              <Badge
                variant="outline"
                className={`text-[9px] px-1.5 py-0 h-4 ${catColor || "text-muted-foreground"}`}
              >
                {badge}
              </Badge>
            )}
          </div>
          <span className="text-xs text-muted-foreground truncate max-w-full">
            {description}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setInfoOpen((p) => !p)}
          className={`shrink-0 h-9 w-9 flex items-center justify-center rounded-full transition-colors min-h-[44px] ${
            infoOpen
              ? "text-primary bg-primary/10"
              : "text-muted-foreground hover:text-primary hover:bg-primary/10"
          }`}
          aria-label={`How ${name} works`}
        >
          <Info className="h-4 w-4" />
        </button>
      </div>
      <StrategyInfoPanel howItWorks={howItWorks} open={infoOpen} />
    </div>
  );
}

// ─── Add Strategy Modal ───────────────────────────────────────

function AddStrategyModal({
  open,
  onClose,
  onGenerate,
  isGenerating,
}: {
  open: boolean;
  onClose: () => void;
  onGenerate: (desc: string) => void;
  isGenerating: boolean;
}) {
  const [desc, setDesc] = useState("");

  const handleSubmit = () => {
    const trimmed = desc.trim();
    if (!trimmed) return;
    onGenerate(trimmed);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[min(92vw,420px)] bg-card border border-border rounded-2xl shadow-2xl p-5 flex flex-col gap-4"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-gold" />
                  Create Custom Strategy
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Describe your rules — AI generates it for you
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <label
                htmlFor="strategy-desc"
                className="text-xs font-semibold text-muted-foreground uppercase tracking-wide"
              >
                Strategy Description
              </label>
              <Textarea
                id="strategy-desc"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="e.g. Buy when RSI crosses 30 from below on 15m chart, use EMA 50 for trend direction, target 2:1 RR with tight stop"
                className="resize-none text-sm min-h-[100px] rounded-xl"
                disabled={isGenerating}
              />
              <p className="text-[11px] text-muted-foreground">
                Mention: indicators, timeframes, entry/exit rules, risk
                management
              </p>
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={onClose}
                disabled={isGenerating}
                className="rounded-full"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={isGenerating || !desc.trim()}
                className="rounded-full"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── Strategy Box ─────────────────────────────────────────────

const QUICK_PICKS = ["Scalping", "RSI Strategy", "Breakout", "Trend Following"];

function StrategyBox({
  onStrategySelect,
  isLoggedIn,
}: {
  onStrategySelect: (
    name: string,
    isCustom: boolean,
    description: string,
  ) => void;
  isLoggedIn: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);

  const { data: customStrategies = [], isLoading: customLoading } =
    useCustomStrategies();
  const { data: communityStrategies = [], isLoading: communityLoading } =
    useApprovedStrategies();
  const generateMutation = useGenerateCustomStrategy();

  const handleGenerate = async (description: string) => {
    try {
      await generateMutation.mutateAsync(description);
      toast.success("Strategy created!");
      setAddModalOpen(false);
    } catch (err) {
      toast.error(
        `Failed: ${err instanceof Error ? err.message : "Please try again"}`,
      );
    }
  };

  const totalCount =
    BUILTIN_STRATEGIES.length +
    customStrategies.length +
    communityStrategies.length;

  return (
    <>
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {/* Header */}
        <button
          type="button"
          className="w-full flex items-center px-4 min-h-[52px] gap-2.5 hover:bg-muted/20 transition-colors"
          onClick={() => setExpanded((p) => !p)}
          aria-expanded={expanded}
        >
          <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Brain className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="font-bold text-sm text-foreground flex-1 text-left">
            Strategies
          </span>
          <Badge variant="secondary" className="text-[10px] font-mono shrink-0">
            {totalCount}
          </Badge>
          {isLoggedIn && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setAddModalOpen(true);
              }}
              className="shrink-0 h-8 w-8 min-h-[44px] rounded-full border border-primary/30 bg-primary/5 flex items-center justify-center text-primary hover:bg-primary/15 hover:border-primary/50 transition-colors"
              aria-label="Create custom strategy"
            >
              <Plus className="h-4 w-4" />
            </button>
          )}
          <div className="shrink-0 h-8 w-8 flex items-center justify-center">
            {expanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </button>

        {/* Quick picks (always visible when collapsed) */}
        {!expanded && (
          <div className="px-4 pb-3 pt-1 flex flex-wrap gap-1.5">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide w-full mb-0.5 font-semibold">
              Quick picks
            </span>
            {QUICK_PICKS.map((name) => {
              const s = BUILTIN_STRATEGIES.find((b) => b.name === name);
              if (!s) return null;
              const catColor = s ? STRATEGY_CATEGORY_COLORS[s.category] : "";
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => onStrategySelect(name, false, s.description)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-full text-xs font-semibold border transition-all active:scale-95 ${catColor || "text-primary border-primary/30 bg-primary/5 hover:bg-primary/15"} border-current/20 bg-current/5 hover:bg-current/10`}
                >
                  <Zap className="h-3 w-3" />
                  {name}
                </button>
              );
            })}
          </div>
        )}

        {/* Expanded list */}
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
              <ScrollArea className="max-h-[300px]">
                <div className="py-1">
                  {/* Section: Built-in */}
                  <div className="flex items-center gap-2 px-3 pt-2.5 pb-1.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary/80" />
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      Built-in
                    </p>
                  </div>
                  {BUILTIN_STRATEGIES.map((s) => (
                    <StrategyRow
                      key={s.name}
                      name={s.name}
                      description={s.description}
                      howItWorks={s.howItWorks}
                      category={s.category}
                      onSelect={() => {
                        setExpanded(false);
                        onStrategySelect(s.name, false, s.description);
                      }}
                    />
                  ))}

                  {/* Section: My Strategies */}
                  {isLoggedIn && (
                    <>
                      <div className="flex items-center gap-2 px-3 pt-3 pb-1.5">
                        <div className="h-1.5 w-1.5 rounded-full bg-gold" />
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                          My Strategies
                        </p>
                      </div>
                      {customLoading ? (
                        <div className="px-3 py-2">
                          <Skeleton className="h-10 w-full rounded-lg" />
                        </div>
                      ) : customStrategies.length === 0 ? (
                        <p className="px-4 py-2.5 text-xs text-muted-foreground italic">
                          No custom strategies yet. Tap + to create one.
                        </p>
                      ) : (
                        (customStrategies as CustomStrategy[]).map((s) => (
                          <StrategyRow
                            key={s.id}
                            name={s.name}
                            description={s.description}
                            howItWorks={s.howItWorks}
                            badge="Custom"
                            onSelect={() => {
                              setExpanded(false);
                              onStrategySelect(s.name, true, s.description);
                            }}
                          />
                        ))
                      )}
                    </>
                  )}

                  {/* Section: Community */}
                  {(communityLoading || communityStrategies.length > 0) && (
                    <>
                      <div className="flex items-center gap-2 px-3 pt-3 pb-1.5">
                        <div className="h-1.5 w-1.5 rounded-full bg-bull" />
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                          Community
                        </p>
                      </div>
                      {communityLoading ? (
                        <div className="px-3 py-2">
                          <Skeleton className="h-10 w-full rounded-lg" />
                        </div>
                      ) : (
                        communityStrategies.map((s) => (
                          <StrategyRow
                            key={s.id}
                            name={s.name}
                            description={s.description}
                            howItWorks={s.description}
                            badge="Community"
                            onSelect={() => {
                              setExpanded(false);
                              onStrategySelect(s.name, true, s.description);
                            }}
                          />
                        ))
                      )}
                    </>
                  )}
                </div>
              </ScrollArea>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AddStrategyModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onGenerate={handleGenerate}
        isGenerating={generateMutation.isPending}
      />
    </>
  );
}

// ─── History Section ──────────────────────────────────────────

function HistorySection({
  history,
  isLoading,
  onClear,
  isClearing,
}: {
  history: AnalysisResult[];
  isLoading: boolean;
  onClear: () => void;
  isClearing: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const preview = history.slice(0, 3);
  const shown = expanded ? history : preview;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => setExpanded((p) => !p)}
          className="flex items-center gap-1.5 text-sm font-semibold text-foreground hover:text-primary transition-colors"
        >
          <History className="h-4 w-4 text-muted-foreground" />
          History
          {history.length > 0 && (
            <Badge variant="secondary" className="text-[10px] font-mono ml-1">
              {history.length}
            </Badge>
          )}
          {history.length > 3 && (
            <span className="text-xs text-muted-foreground ml-1">
              {expanded ? "show less" : `+${history.length - 3} more`}
            </span>
          )}
        </button>
        {history.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={onClear}
            disabled={isClearing}
          >
            {isClearing ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : null}
            Clear all
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : history.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground bg-muted/20 rounded-xl border border-border/50">
          <ArrowUpDown className="h-7 w-7 mx-auto mb-2 opacity-30" />
          <p className="text-sm font-medium">No analyses yet</p>
          <p className="text-xs mt-1 opacity-70">
            Pick a strategy above to run your first analysis
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {shown.map((result, i) => (
            <div
              key={`hist-${i}-${String(result.timestamp)}`}
              className="opacity-90 hover:opacity-100 transition-opacity"
            >
              <AnalysisCard result={result} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main AIAnalysis component ────────────────────────────────

export function AIAnalysis() {
  const { identity, login, isLoggingIn } = useInternetIdentity();
  const isLoggedIn = !!identity;

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [phase, setPhase] = useState<ChatPhase>("greeting");
  const [inputText, setInputText] = useState("");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [currentStrategy, setCurrentStrategy] = useState("");
  const [currentSymbol, setCurrentSymbol] = useState("BTC/USD");
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [currentQuestions, setCurrentQuestions] = useState<QuestionDef[]>([]);
  const [_isCustomStrategy, setIsCustomStrategy] = useState(false);

  // Image state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastAnalysisParams = useRef<{
    strategyName: string;
    symbol: string;
    notes: string;
    imageFile?: File;
  } | null>(null);

  // History
  const { data: history = [], isLoading: historyLoading } =
    useAnalysisHistory();
  const analyze = useAnalyzeStrategy();
  const analyzeWithImage = useAnalyzeStrategyWithImage();
  const clearHistory = useClearHistory();

  const isAnalyzing = analyze.isPending || analyzeWithImage.isPending;

  // ─── Helpers ────────────────────────────────────────────────

  const addMessage = useCallback(
    (msg: Omit<ChatMessage, "id" | "timestamp">) => {
      const now = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      setMessages((prev) => [
        ...prev,
        { ...msg, id: generateId(), timestamp: now },
      ]);
    },
    [],
  );

  const markLastChipsUsed = useCallback(() => {
    setMessages((prev) => {
      // Find the last AI message with chips and mark it as used
      const idx = [...prev]
        .reverse()
        .findIndex((m) => m.role === "ai" && m.chips && m.chips.length > 0);
      if (idx === -1) return prev;
      const actualIdx = prev.length - 1 - idx;
      return prev.map((m, i) =>
        i === actualIdx ? { ...m, chipsUsed: true } : m,
      );
    });
  }, []);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    });
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on message change
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // ─── Init greeting ──────────────────────────────────────────

  useEffect(() => {
    if (!isLoggedIn) return;
    setMessages([
      {
        id: "greeting-1",
        role: "ai",
        type: "text",
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        content:
          "👋 Hey! I'm your AI trading analyst. Pick a strategy below or type a question to get started.",
      },
    ]);
    setPhase("greeting");
    setQuestionIndex(0);
    setAnswers({});
  }, [isLoggedIn]);

  // ─── Image handling ──────────────────────────────────────────

  const handleImageClear = useCallback(() => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

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

  // ─── Run AI Analysis ─────────────────────────────────────────

  const runAnalysis = useCallback(
    async (
      strategyName: string,
      symbol: string,
      notes: string,
      attachedImage?: File,
    ) => {
      if (!identity) return;
      setPhase("analyzing");

      lastAnalysisParams.current = {
        strategyName,
        symbol,
        notes,
        imageFile: attachedImage,
      };

      try {
        let result: AnalysisResult;
        if (attachedImage) {
          const base64 = await fileToBase64(attachedImage);
          result = await analyzeWithImage.mutateAsync({
            strategyName,
            symbol,
            notes: notes || undefined,
            imageBase64: base64,
            mimeType: attachedImage.type,
          });
        } else {
          result = await analyze.mutateAsync({
            principal: identity.getPrincipal(),
            strategyName,
            symbol,
            notes: notes || undefined,
          });
        }

        // Try to recover from parse failures
        const recovered = recoverAnalysisResult(result);

        addMessage({
          role: "ai",
          type: "result",
          content: "",
          result: recovered,
        });

        setTimeout(() => {
          const isStillNA =
            recovered.signal === "N/A" ||
            recovered.signal === "Error" ||
            recovered.signal === "TODO";

          if (isStillNA) {
            addMessage({
              role: "ai",
              type: "error",
              content:
                recovered.explanation ||
                "Analysis failed. Check the result card above for the raw error.",
              chips: ["__retry__"],
              chipsUsed: false,
            });
          } else {
            addMessage({
              role: "ai",
              type: "text",
              content: "Analysis complete! What would you like to do next?",
              chips: ["__submit_strategy__", "__new_analysis__"],
              chipsUsed: false,
            });
          }
          setPhase("greeting");
          setQuestionIndex(0);
          setAnswers({});
        }, 300);
      } catch (err) {
        addMessage({
          role: "ai",
          type: "error",
          content: `Unable to complete analysis: ${err instanceof Error ? err.message : "Service unavailable. Please try again."}`,
        });
        addMessage({
          role: "ai",
          type: "chips",
          content: "Want to try again?",
          chips: ["__retry__"],
        });
        setPhase("greeting");
      }
    },
    [identity, analyze, analyzeWithImage, addMessage],
  );

  // ─── Handle strategy selection ────────────────────────────────

  const handleStrategySelect = useCallback(
    (strategyName: string, isCustom: boolean, _description: string) => {
      const questions = getQuestionsForStrategy(strategyName, isCustom);
      setCurrentStrategy(strategyName);
      setIsCustomStrategy(isCustom);
      setCurrentQuestions(questions);
      setAnswers({});
      setQuestionIndex(0);
      handleImageClear();

      addMessage({
        role: "user",
        type: "text",
        content: strategyName,
      });

      setTimeout(() => {
        const q = questions[0];
        addMessage({
          role: "ai",
          type: "text",
          content: q.text,
          chips: q.chips,
          isImageUploadPrompt: q.isImageUpload,
          chipsUsed: false,
        });
        setPhase("questioning");
      }, 300);
    },
    [addMessage, handleImageClear],
  );

  // ─── Handle answer ────────────────────────────────────────────

  const handleAnswer = useCallback(
    (answer: string, qIndex: number, attachedImage?: File) => {
      markLastChipsUsed();
      const currentQ = currentQuestions[qIndex];
      const newAnswers: AnswerMap = { ...answers };

      if (currentQ.key === "symbol") {
        const sym = answer === "Other" ? "BTC/USD" : answer;
        newAnswers.symbol = sym;
        setCurrentSymbol(sym);
      } else if (currentQ.key === "risk") {
        // Map friendly labels to internal values
        newAnswers.risk = RISK_MAP[answer] ?? answer;
      } else if (currentQ.key === "chartImage") {
        newAnswers.chartImage = answer;
      } else {
        newAnswers[currentQ.key] = answer;
      }
      setAnswers(newAnswers);

      // Display user answer
      if (answer !== "Skip" || !currentQ.isImageUpload) {
        addMessage({ role: "user", type: "text", content: answer });
      } else {
        addMessage({
          role: "user",
          type: "text",
          content: attachedImage ? "📊 Chart uploaded" : "Skipping image",
        });
      }

      const nextIndex = qIndex + 1;

      if (nextIndex < currentQuestions.length) {
        setTimeout(() => {
          const nextQ = currentQuestions[nextIndex];
          addMessage({
            role: "ai",
            type: "text",
            content: nextQ.text,
            chips: nextQ.chips,
            isImageUploadPrompt: nextQ.isImageUpload,
            chipsUsed: false,
          });
          setQuestionIndex(nextIndex);
        }, 350);
      } else {
        // All answered — run analysis
        const finalSymbol = newAnswers.symbol ?? currentSymbol;
        setTimeout(() => {
          addMessage({
            role: "ai",
            type: "text",
            content: `Running ${currentStrategy} analysis on ${finalSymbol}... 🔍`,
          });

          const notesArr = [
            `Strategy: ${currentStrategy}`,
            newAnswers.symbol ? `Symbol: ${newAnswers.symbol}` : null,
            newAnswers.timeframe ? `Timeframe: ${newAnswers.timeframe}` : null,
            newAnswers.risk ? `Risk: ${newAnswers.risk}` : null,
            newAnswers.timezone ? `Session: ${newAnswers.timezone}` : null,
          ].filter(Boolean);

          void runAnalysis(
            currentStrategy,
            finalSymbol,
            notesArr.join(", "),
            attachedImage ?? imageFile ?? undefined,
          );
          handleImageClear();
        }, 350);
      }
    },
    [
      answers,
      addMessage,
      currentStrategy,
      currentSymbol,
      currentQuestions,
      imageFile,
      runAnalysis,
      handleImageClear,
      markLastChipsUsed,
    ],
  );

  // ─── Handle chip click ────────────────────────────────────────

  const handleChipClick = useCallback(
    (chip: string) => {
      if (phase === "analyzing") return;

      if (chip === "__retry__") {
        const params = lastAnalysisParams.current;
        if (!params) return;
        markLastChipsUsed();
        addMessage({ role: "user", type: "text", content: "Try Again" });
        void runAnalysis(
          params.strategyName,
          params.symbol,
          params.notes,
          params.imageFile,
        );
        return;
      }

      if (chip === "__submit_strategy__") {
        markLastChipsUsed();
        addMessage({
          role: "user",
          type: "text",
          content: "Submit Strategy",
        });
        setTimeout(() => {
          addMessage({
            role: "ai",
            type: "text",
            content:
              "Head to the Strategies panel above and tap the + button to submit your strategy to the community.",
          });
        }, 300);
        return;
      }

      if (chip === "__new_analysis__") {
        markLastChipsUsed();
        addMessage({ role: "user", type: "text", content: "New Analysis" });
        setTimeout(() => {
          const now = new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          });
          setMessages([
            {
              id: "greeting-reset",
              role: "ai",
              type: "text",
              timestamp: now,
              content:
                "👋 Ready for another analysis! Pick a strategy below or type a question to get started.",
            },
          ]);
          setPhase("greeting");
          setQuestionIndex(0);
          setAnswers({});
          setCurrentStrategy("");
          setCurrentQuestions([]);
          handleImageClear();
        }, 300);
        return;
      }

      if (phase === "questioning") {
        const q = currentQuestions[questionIndex];
        if (q?.isImageUpload) {
          handleAnswer(chip, questionIndex, imageFile ?? undefined);
          if (chip === "Skip") handleImageClear();
        } else {
          handleAnswer(chip, questionIndex);
        }
      }
    },
    [
      phase,
      handleAnswer,
      questionIndex,
      currentQuestions,
      imageFile,
      handleImageClear,
      addMessage,
      runAnalysis,
      markLastChipsUsed,
    ],
  );

  const handleImageAttachForPrompt = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // ─── Handle free-text send ────────────────────────────────────

  const handleSend = useCallback(() => {
    const text = inputText.trim();
    if (!text && !imageFile) return;
    if (isAnalyzing) return;

    setInputText("");
    markLastChipsUsed();

    if (imageFile && imagePreview) {
      addMessage({
        role: "user",
        type: "image-preview",
        content: (
          <img
            src={imagePreview}
            alt="Chart upload"
            className="max-w-[200px] rounded-xl"
          />
        ),
      });
    }
    if (text) {
      addMessage({ role: "user", type: "text", content: text });
    }

    if (phase === "questioning") {
      const q = currentQuestions[questionIndex];
      if (q?.isImageUpload && imageFile) {
        handleAnswer("uploaded", questionIndex, imageFile);
        return;
      }
      if (text) {
        handleAnswer(text, questionIndex);
        return;
      }
    }

    // Free-text analysis
    const symbol = (() => {
      const lower = text.toLowerCase();
      if (lower.includes("btc") || lower.includes("bitcoin")) return "BTC/USD";
      if (lower.includes("eth") || lower.includes("ethereum")) return "ETH/USD";
      if (lower.includes("gold") || lower.includes("xau")) return "XAU/USD";
      if (lower.includes("silver") || lower.includes("xag")) return "XAG/USD";
      if (lower.includes("eur")) return "EUR/USD";
      if (lower.includes("gbp")) return "GBP/USD";
      if (lower.includes("jpy") || lower.includes("yen")) return "USD/JPY";
      if (lower.includes("nasdaq")) return "NASDAQ";
      if (lower.includes("s&p") || lower.includes("sp500")) return "S&P500";
      if (lower.includes("oil") || lower.includes("crude")) return "OIL";
      return "BTC/USD";
    })();

    setTimeout(() => {
      addMessage({
        role: "ai",
        type: "text",
        content: imageFile
          ? "Analyzing your chart image... 🔍"
          : `Analyzing "${text}"... 🔍`,
      });
      void runAnalysis("Custom Analysis", symbol, text, imageFile ?? undefined);
      handleImageClear();
    }, 200);
  }, [
    inputText,
    imageFile,
    imagePreview,
    isAnalyzing,
    phase,
    questionIndex,
    currentQuestions,
    addMessage,
    handleAnswer,
    runAnalysis,
    handleImageClear,
    markLastChipsUsed,
  ]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
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

  // Step info for questions
  const stepInfo =
    phase === "questioning" && currentQuestions.length > 0
      ? `Step ${questionIndex + 1} of ${currentQuestions.length}`
      : undefined;

  // ─── Login gate ───────────────────────────────────────────────

  if (!isLoggedIn) {
    return (
      <div className="flex flex-col gap-4 pb-2">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          <h2 className="font-bold text-base text-foreground">
            AI Strategy Analysis
          </h2>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-2xl p-8 flex flex-col items-center gap-4 text-center"
        >
          <div className="h-16 w-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Brain className="h-8 w-8 text-primary" />
          </div>
          <div>
            <p className="font-bold text-foreground text-lg">
              Sign in for AI Analysis
            </p>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-[240px]">
              Get personalized AI-powered trade signals, analysis, and
              risk/reward breakdowns
            </p>
          </div>
          <Button
            onClick={login}
            disabled={isLoggingIn}
            size="lg"
            className="rounded-full px-8 mt-1"
          >
            {isLoggingIn ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <LogIn className="h-4 w-4 mr-2" />
            )}
            {isLoggingIn ? "Signing in..." : "Sign In to Continue"}
          </Button>
        </motion.div>

        <p className="text-xs text-muted-foreground text-center">
          AI analysis is for educational purposes only. Not financial advice.
        </p>
      </div>
    );
  }

  // ─── Main UI ──────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-3 pb-2">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Brain className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h2 className="font-bold text-base text-foreground leading-tight">
            AI Analysis
          </h2>
          <p className="text-[10px] text-muted-foreground">
            Powered by Gemini 2.0
          </p>
        </div>
        <Badge variant="secondary" className="text-[10px] ml-auto font-mono">
          {phase === "analyzing" ? (
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-gold animate-pulse inline-block" />
              Analyzing
            </span>
          ) : (
            "Ready"
          )}
        </Badge>
      </div>

      {/* Strategy Box */}
      <StrategyBox
        onStrategySelect={handleStrategySelect}
        isLoggedIn={isLoggedIn}
      />

      {/* Chat area */}
      <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col">
        {/* Messages */}
        <ScrollArea className="flex-1 min-h-[320px] max-h-[480px]">
          <div className="p-4 space-y-4">
            {/* Empty state */}
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
                <div className="h-14 w-14 rounded-2xl bg-muted/40 border border-border flex items-center justify-center">
                  <Sparkles className="h-7 w-7 text-muted-foreground/50" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-muted-foreground">
                    Select a strategy to start
                  </p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    Or type a question below
                  </p>
                </div>
              </div>
            )}

            <AnimatePresence initial={false}>
              {messages.map((msg, idx) => (
                <ChatBubble
                  key={msg.id}
                  message={msg}
                  onChipClick={
                    phase !== "analyzing" ? handleChipClick : undefined
                  }
                  onImageAttach={
                    msg.isImageUploadPrompt && !msg.chipsUsed
                      ? handleImageAttachForPrompt
                      : undefined
                  }
                  imageFile={imageFile}
                  imagePreview={imagePreview}
                  onImageClear={handleImageClear}
                  stepInfo={
                    msg.role === "ai" &&
                    msg.chips &&
                    !msg.chipsUsed &&
                    phase === "questioning" &&
                    idx === messages.length - 1
                      ? stepInfo
                      : undefined
                  }
                />
              ))}
            </AnimatePresence>

            {/* Analyzing indicator */}
            <AnimatePresence>
              {isAnalyzing && <AnalyzingStatus />}
            </AnimatePresence>

            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        <Separator />

        {/* Image preview strip */}
        {imagePreview && !isAnalyzing && (
          <div className="px-4 pt-2.5 pb-1 flex items-center gap-2.5">
            <div className="relative inline-block">
              <img
                src={imagePreview}
                alt="Chart preview"
                className="h-12 w-16 object-cover rounded-lg border border-border"
              />
              <button
                type="button"
                onClick={handleImageClear}
                className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-background border border-border flex items-center justify-center hover:bg-muted transition-colors"
                aria-label="Remove image"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <ImageIcon className="h-3 w-3" />
              Chart attached
            </span>
          </div>
        )}

        {/* Input bar */}
        <div className="p-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isAnalyzing}
            className="shrink-0 h-11 w-11 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors disabled:opacity-40"
            aria-label="Attach chart image"
          >
            <Paperclip className="h-4 w-4" />
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageSelect}
            aria-label="Upload chart screenshot"
          />

          <input
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              phase === "analyzing"
                ? "Analyzing..."
                : phase === "questioning"
                  ? "Type answer or tap a chip..."
                  : "Ask anything or pick a strategy..."
            }
            className="flex-1 h-11 text-sm rounded-full border border-border bg-muted/30 focus:bg-background px-4 outline-none focus:ring-1 focus:ring-primary/40 transition-all placeholder:text-muted-foreground/60 disabled:opacity-40"
            disabled={isAnalyzing}
            aria-label="Chat input"
          />

          <Button
            type="button"
            size="icon"
            className="shrink-0 h-11 w-11 rounded-full"
            onClick={handleSend}
            disabled={isAnalyzing || (!inputText.trim() && !imageFile)}
            aria-label="Send message"
          >
            {isAnalyzing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* History section */}
      <HistorySection
        history={history}
        isLoading={historyLoading}
        onClear={handleClearHistory}
        isClearing={clearHistory.isPending}
      />

      <p className="text-xs text-muted-foreground text-center">
        For educational purposes only. Not financial advice.
      </p>
    </div>
  );
}
