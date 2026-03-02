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
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import {
  Activity,
  AlertCircle,
  ArrowDown,
  ArrowUp,
  BookOpen,
  Brain,
  Calculator,
  ChevronDown,
  ChevronUp,
  Globe,
  Heart,
  History,
  ImageIcon,
  Info,
  Lightbulb,
  Loader2,
  LogIn,
  Paperclip,
  Plus,
  RefreshCw,
  Send,
  ShieldAlert,
  Sparkles,
  Target,
  Trash2,
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
  useAddTradeEntry,
  useAnalysisHistory,
  useAnalyzeStrategy,
  useAnalyzeStrategyWithImage,
  useApprovedStrategies,
  useClearHistory,
  useCustomStrategies,
  useFavoriteStrategies,
  useGenerateCustomStrategy,
  useToggleFavoriteStrategy,
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

// ─── Pollinations AI Fallback ─────────────────────────────────

const POLLINATIONS_URL = "https://text.pollinations.ai/openai";

async function callPollinationsAI(
  strategyName: string,
  symbol: string,
  notes: string,
): Promise<Partial<AnalysisResult>> {
  const prompt = `You are a professional trading analyst. Analyze ${symbol} using the ${strategyName} strategy.${notes ? `\nExtra context: ${notes}` : ""}
IMPORTANT: Return ONLY a raw JSON object. No markdown, no code fences, no extra text before or after. Start your response with { and end with }.
Required JSON format:
{"signal":"BUY or SELL","entryPrice":"numeric value","stopLoss":"numeric value","takeProfit":"numeric value","riskLevel":"Low or Medium or High","confidence":"e.g. 72%","probability":"e.g. 68%","entryConfidence":"e.g. 75%","stopLossSafety":"Good or Fair or Poor","takeProfitProbability":"e.g. 65%","marketTrend":"Bullish or Bearish or Neutral","strategyUsed":"strategy name","explanation":"2-3 sentence analysis"}`;

  const body = JSON.stringify({
    model: "openai",
    messages: [{ role: "user", content: prompt }],
  });

  const resp = await fetch(POLLINATIONS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

  if (!resp.ok) {
    throw new Error(`Pollinations API error: ${resp.status}`);
  }

  const data = (await resp.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data?.choices?.[0]?.message?.content ?? "";

  // Strip markdown fences
  const stripped = content
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  const tryParse = (jsonStr: string): Partial<AnalysisResult> => {
    const parsed = JSON.parse(jsonStr) as Record<string, unknown>;
    const getString = (key: string): string => {
      const val = parsed[key];
      return typeof val === "string" ? val : "";
    };
    return {
      signal: getString("signal") || "N/A",
      entryPrice: getString("entryPrice") || "N/A",
      stopLoss: getString("stopLoss") || "N/A",
      takeProfit: getString("takeProfit") || "N/A",
      riskLevel: getString("riskLevel") || "Medium",
      confidence: getString("confidence") || undefined,
      probability: getString("probability") || undefined,
      entryConfidence: getString("entryConfidence") || undefined,
      stopLossSafety: getString("stopLossSafety") || undefined,
      takeProfitProbability: getString("takeProfitProbability") || undefined,
      marketTrend: getString("marketTrend") || undefined,
      strategyUsed: getString("strategyUsed") || undefined,
      explanation: getString("explanation") || "AI analysis complete.",
    };
  };

  try {
    return tryParse(stripped);
  } catch {
    // Try to extract JSON from the content
    const jsonMatch = /\{[\s\S]*\}/.exec(stripped);
    if (jsonMatch) {
      try {
        return tryParse(jsonMatch[0]);
      } catch {
        // ignore
      }
    }
    throw new Error(`Failed to parse AI response: ${content.slice(0, 100)}`);
  }
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
    r.signal === "N/A" ||
    r.signal === "Error" ||
    r.signal === "TODO" ||
    r.signal === "POLLINATIONS";

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
          <p className="text-xs text-foreground/80 leading-relaxed">
            AI analysis is temporarily unavailable. Please try again in a
            moment.
          </p>
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
              ) : chip === "__save_journal__" ? (
                <button
                  key={chip}
                  type="button"
                  onClick={() => onChipClick?.(chip)}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 min-h-[44px] rounded-full text-xs font-semibold border border-bull/40 bg-bull/10 text-bull hover:bg-bull/20 hover:border-bull/60 transition-all active:scale-95"
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  Save to Journal
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

const ANALYSIS_DURATION = 12; // estimated seconds

function AnalyzingStatus() {
  const [msgIndex, setMsgIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const [secondsLeft, setSecondsLeft] = useState(ANALYSIS_DURATION);

  useEffect(() => {
    setMsgIndex(0);
    setVisible(true);
    setSecondsLeft(ANALYSIS_DURATION);

    const msgInterval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setMsgIndex((prev) => (prev + 1) % ANALYZING_MESSAGES.length);
        setVisible(true);
      }, 250);
    }, 1600);

    const countdownInterval = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => {
      clearInterval(msgInterval);
      clearInterval(countdownInterval);
    };
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
      <div className="bg-card border border-border border-l-2 border-l-primary/40 rounded-2xl rounded-tl-sm px-4 py-3 flex flex-col gap-1.5 min-w-[220px]">
        <div className="flex items-center gap-2">
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
        {secondsLeft > 0 && (
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1 bg-muted/60 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-primary/60 rounded-full"
                initial={{ width: "0%" }}
                animate={{
                  width: `${((ANALYSIS_DURATION - secondsLeft) / ANALYSIS_DURATION) * 100}%`,
                }}
                transition={{ duration: 1, ease: "linear" }}
              />
            </div>
            <span className="text-[10px] font-mono text-muted-foreground shrink-0">
              ~{secondsLeft}s
            </span>
          </div>
        )}
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
  strategyId,
  isFavorited,
  onSelect,
  onToggleFavorite,
}: {
  name: string;
  description: string;
  howItWorks: string;
  category?: string;
  badge?: string;
  strategyId?: string;
  isFavorited?: boolean;
  onSelect: () => void;
  onToggleFavorite?: (id: string) => void;
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
        {/* Favorite button */}
        {strategyId && onToggleFavorite && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(strategyId);
            }}
            className={`shrink-0 h-9 w-9 flex items-center justify-center rounded-full transition-colors min-h-[44px] ${
              isFavorited
                ? "text-bear bg-bear/10"
                : "text-muted-foreground hover:text-bear hover:bg-bear/10"
            }`}
            aria-label={isFavorited ? "Unfavorite" : "Favorite"}
          >
            <Heart className={`h-4 w-4 ${isFavorited ? "fill-bear" : ""}`} />
          </button>
        )}
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

// ─── AI Quick Tips ────────────────────────────────────────────

const TRADING_TIPS = [
  "Risk only 1–2% of your account per trade to protect your capital long-term.",
  "Always use a stop loss — the market can move against you at any time.",
  "The trend is your friend. Trade with the trend, not against it.",
  "Never risk more than you can afford to lose. Capital preservation comes first.",
  "A good Risk:Reward ratio is 1:2 or higher — let winners run, cut losers short.",
  "Patience is a trader's edge. Wait for your setup, don't force trades.",
  "Keep a trade journal. Reviewing your trades reveals patterns and mistakes.",
  "Avoid trading during major news events unless you understand the risk.",
  "Consistency beats big wins. Small, steady profits compound over time.",
  "Emotions are your worst enemy. Stick to your strategy no matter what.",
] as const;

function AIQuickTips() {
  const [tipIndex, setTipIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setTipIndex((prev) => (prev + 1) % TRADING_TIPS.length);
        setVisible(true);
      }, 300);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  const nextTip = () => {
    setVisible(false);
    setTimeout(() => {
      setTipIndex((prev) => (prev + 1) % TRADING_TIPS.length);
      setVisible(true);
    }, 200);
  };

  return (
    <button
      type="button"
      onClick={nextTip}
      className="w-full bg-primary/5 border border-primary/20 rounded-xl px-4 py-3 flex items-start gap-3 hover:bg-primary/10 transition-colors text-left"
      aria-label="Next trading tip"
    >
      <div className="shrink-0 h-6 w-6 rounded-lg bg-primary/15 flex items-center justify-center mt-0.5">
        <Lightbulb className="h-3.5 w-3.5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-1">
          Trading Tip — tap to skip
        </p>
        <motion.p
          key={tipIndex}
          initial={{ opacity: 0 }}
          animate={{ opacity: visible ? 1 : 0 }}
          transition={{ duration: 0.25 }}
          className="text-xs text-foreground/80 leading-relaxed"
        >
          {TRADING_TIPS[tipIndex]}
        </motion.p>
      </div>
      <span className="text-[9px] text-muted-foreground/50 font-mono shrink-0 mt-1">
        {tipIndex + 1}/{TRADING_TIPS.length}
      </span>
    </button>
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
  const { data: favoriteIds = [] } = useFavoriteStrategies();
  const toggleFavorite = useToggleFavoriteStrategy();
  const generateMutation = useGenerateCustomStrategy();

  // LocalStorage fallback for non-logged-in favorites
  const [localFavorites, setLocalFavorites] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem("strategy_favorites");
      return stored ? (JSON.parse(stored) as string[]) : [];
    } catch {
      return [];
    }
  });

  const effectiveFavorites = isLoggedIn ? favoriteIds : localFavorites;

  const handleToggleFavorite = async (strategyId: string) => {
    if (isLoggedIn) {
      try {
        await toggleFavorite.mutateAsync(strategyId);
      } catch {
        toast.error("Failed to update favorites");
      }
    } else {
      setLocalFavorites((prev) => {
        const updated = prev.includes(strategyId)
          ? prev.filter((id) => id !== strategyId)
          : [...prev, strategyId];
        localStorage.setItem("strategy_favorites", JSON.stringify(updated));
        return updated;
      });
    }
  };

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

  // Get favorited built-in strategies
  const favoritedBuiltins = BUILTIN_STRATEGIES.filter((s) =>
    effectiveFavorites.includes(s.name),
  );

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
              <ScrollArea className="max-h-[360px]">
                <div className="py-1">
                  {/* Section: Favorites — shown only if there are favorites */}
                  {favoritedBuiltins.length > 0 && (
                    <>
                      <div className="flex items-center gap-2 px-3 pt-2.5 pb-1.5">
                        <div className="h-1.5 w-1.5 rounded-full bg-bear" />
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                          Favorites
                        </p>
                      </div>
                      {favoritedBuiltins.map((s) => (
                        <StrategyRow
                          key={`fav-${s.name}`}
                          name={s.name}
                          description={s.description}
                          howItWorks={s.howItWorks}
                          category={s.category}
                          strategyId={s.name}
                          isFavorited={true}
                          onSelect={() => {
                            setExpanded(false);
                            onStrategySelect(s.name, false, s.description);
                          }}
                          onToggleFavorite={handleToggleFavorite}
                        />
                      ))}
                    </>
                  )}

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
                      strategyId={s.name}
                      isFavorited={effectiveFavorites.includes(s.name)}
                      onSelect={() => {
                        setExpanded(false);
                        onStrategySelect(s.name, false, s.description);
                      }}
                      onToggleFavorite={handleToggleFavorite}
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
                            strategyId={s.id}
                            isFavorited={effectiveFavorites.includes(s.id)}
                            onSelect={() => {
                              setExpanded(false);
                              onStrategySelect(s.name, true, s.description);
                            }}
                            onToggleFavorite={handleToggleFavorite}
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
                            strategyId={s.id}
                            isFavorited={effectiveFavorites.includes(s.id)}
                            onSelect={() => {
                              setExpanded(false);
                              onStrategySelect(s.name, true, s.description);
                            }}
                            onToggleFavorite={handleToggleFavorite}
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

// ─── Confidence Sparkline ─────────────────────────────────────

function ConfidenceSparkline({
  confidence,
  signal,
}: {
  confidence?: string;
  signal?: string;
}) {
  const parsed = confidence
    ? Number.parseInt(confidence.replace(/[^0-9]/g, ""), 10)
    : 0;
  const pct = Number.isNaN(parsed) ? 0 : Math.min(100, Math.max(0, parsed));
  if (pct === 0) return null;

  const bars = 5;
  const filled = Math.round((pct / 100) * bars);
  const isBuy = (signal ?? "").toUpperCase().includes("BUY");
  const barColor = isBuy ? "bg-bull" : "bg-bear";

  return (
    <div className="flex items-center gap-1.5 mt-1">
      <div className="flex gap-0.5 items-end">
        {Array.from({ length: bars }).map((_, idx) => {
          const heightPct = (idx + 1) * 20;
          return (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed 5 bars
              key={idx}
              className={`w-1.5 rounded-sm transition-all ${idx < filled ? barColor : "bg-muted/40"}`}
              style={{ height: `${heightPct * 0.3 + 4}px` }}
            />
          );
        })}
      </div>
      <span className="text-[10px] font-mono text-muted-foreground">
        {pct}%
      </span>
    </div>
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
          data-ocid="history.toggle"
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
            data-ocid="history.delete_button"
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
        <div
          data-ocid="history.empty_state"
          className="text-center py-8 text-muted-foreground bg-muted/20 rounded-xl border border-border/50"
        >
          <History className="h-7 w-7 mx-auto mb-2 opacity-30" />
          <p className="text-sm font-medium">No analyses yet</p>
          <p className="text-xs mt-1 opacity-70">
            Pick a strategy above to run your first analysis
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {shown.map((result, i) => {
            const r = recoverAnalysisResult(result);
            return (
              <div
                key={`hist-${i}-${String(result.timestamp)}`}
                data-ocid={`history.item.${i + 1}`}
                className="opacity-90 hover:opacity-100 transition-opacity"
              >
                {/* Mini history card with sparkline */}
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  <div className="px-3 py-2 flex items-start gap-3">
                    <div
                      className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${r.signal.toUpperCase().includes("BUY") ? "bg-bull/15" : r.signal === "N/A" || r.signal === "Error" ? "bg-muted/40" : "bg-bear/15"}`}
                    >
                      {r.signal.toUpperCase().includes("BUY") ? (
                        <ArrowUp className="h-4 w-4 text-bull" />
                      ) : r.signal.toUpperCase().includes("SELL") ? (
                        <ArrowDown className="h-4 w-4 text-bear" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-xs font-bold font-mono ${r.signal.toUpperCase().includes("BUY") ? "text-bull" : "text-bear"}`}
                        >
                          {r.signal}
                        </span>
                        {r.strategyUsed && (
                          <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                            {r.strategyUsed}
                          </span>
                        )}
                        {r.timestamp && (
                          <span className="text-[10px] text-muted-foreground/60 ml-auto">
                            {new Date(
                              Number(r.timestamp) / 1_000_000,
                            ).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <ConfidenceSparkline
                        confidence={r.confidence}
                        signal={r.signal}
                      />
                    </div>
                  </div>
                  <div className="px-3 pb-3">
                    <AnalysisCard result={result} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── RiskCalculator ───────────────────────────────────────────

function RiskCalculator() {
  const [expanded, setExpanded] = useState(false);
  const [entry, setEntry] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [accountSize, setAccountSize] = useState("10000");
  const [riskPct, setRiskPct] = useState([2]);

  const entryNum = Number.parseFloat(entry);
  const slNum = Number.parseFloat(stopLoss);
  const tpNum = Number.parseFloat(takeProfit);

  const hasValues =
    !Number.isNaN(entryNum) &&
    !Number.isNaN(slNum) &&
    !Number.isNaN(tpNum) &&
    entryNum !== 0;

  const riskPips = hasValues ? Math.abs(entryNum - slNum) : 0;
  const rewardPips = hasValues ? Math.abs(tpNum - entryNum) : 0;
  const rrRatio =
    hasValues && riskPips > 0 ? (rewardPips / riskPips).toFixed(2) : null;
  const riskPercent =
    hasValues && entryNum !== 0
      ? ((riskPips / entryNum) * 100).toFixed(2)
      : null;
  const gainPercent =
    hasValues && entryNum !== 0
      ? ((rewardPips / entryNum) * 100).toFixed(2)
      : null;

  const accountNum = Number.parseFloat(accountSize.replace(/,/g, "")) || 10000;
  const positionSize =
    hasValues && riskPips > 0
      ? ((accountNum * (riskPct[0]! / 100)) / (riskPips / entryNum)).toFixed(2)
      : null;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center px-4 min-h-[52px] gap-2.5 hover:bg-muted/20 transition-colors"
        onClick={() => setExpanded((p) => !p)}
        aria-expanded={expanded}
      >
        <div className="h-7 w-7 rounded-lg bg-gold/10 flex items-center justify-center shrink-0">
          <Calculator className="h-3.5 w-3.5 text-gold" />
        </div>
        <span className="font-bold text-sm text-foreground flex-1 text-left">
          Risk Calculator
        </span>
        {rrRatio && (
          <Badge
            variant="secondary"
            className="text-[10px] font-mono text-gold shrink-0"
          >
            R:R 1:{rrRatio}
          </Badge>
        )}
        <div className="shrink-0 h-8 w-8 flex items-center justify-center">
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
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
            <div className="p-4 space-y-4">
              {/* Price inputs */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                    Entry Price
                  </p>
                  <Input
                    type="number"
                    value={entry}
                    onChange={(e) => setEntry(e.target.value)}
                    placeholder="0.00"
                    className="h-9 text-sm font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold text-bear uppercase tracking-wide">
                    Stop Loss
                  </p>
                  <Input
                    type="number"
                    value={stopLoss}
                    onChange={(e) => setStopLoss(e.target.value)}
                    placeholder="0.00"
                    className="h-9 text-sm font-mono border-bear/30 focus-visible:ring-bear/40"
                  />
                </div>
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold text-bull uppercase tracking-wide">
                    Take Profit
                  </p>
                  <Input
                    type="number"
                    value={takeProfit}
                    onChange={(e) => setTakeProfit(e.target.value)}
                    placeholder="0.00"
                    className="h-9 text-sm font-mono border-bull/30 focus-visible:ring-bull/40"
                  />
                </div>
              </div>

              {/* Results */}
              {hasValues && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="grid grid-cols-2 gap-2 sm:grid-cols-4"
                >
                  <div className="bg-muted/40 rounded-lg p-2.5 text-center border border-border/50">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
                      R:R Ratio
                    </p>
                    <p className="font-mono text-sm font-bold text-gold">
                      {rrRatio ? `1:${rrRatio}` : "—"}
                    </p>
                  </div>
                  <div className="bg-bear/8 rounded-lg p-2.5 text-center border border-bear/20">
                    <p className="text-[10px] text-bear uppercase tracking-wide mb-1">
                      Risk %
                    </p>
                    <p className="font-mono text-sm font-bold text-bear">
                      {riskPercent ? `${riskPercent}%` : "—"}
                    </p>
                  </div>
                  <div className="bg-bull/8 rounded-lg p-2.5 text-center border border-bull/20">
                    <p className="text-[10px] text-bull uppercase tracking-wide mb-1">
                      Gain %
                    </p>
                    <p className="font-mono text-sm font-bold text-bull">
                      {gainPercent ? `${gainPercent}%` : "—"}
                    </p>
                  </div>
                  <div className="bg-primary/8 rounded-lg p-2.5 text-center border border-primary/20">
                    <p className="text-[10px] text-primary uppercase tracking-wide mb-1">
                      Pos. Size
                    </p>
                    <p className="font-mono text-sm font-bold text-primary">
                      {positionSize ? `$${positionSize}` : "—"}
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Account settings */}
              <div className="grid grid-cols-2 gap-3 pt-1 border-t border-border/50">
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                    Account Size ($)
                  </p>
                  <Input
                    type="number"
                    value={accountSize}
                    onChange={(e) => setAccountSize(e.target.value)}
                    placeholder="10000"
                    className="h-9 text-sm font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                    Risk per Trade: {riskPct[0]}%
                  </p>
                  <div className="flex items-center gap-2 h-9">
                    <Slider
                      value={riskPct}
                      onValueChange={setRiskPct}
                      min={0.5}
                      max={5}
                      step={0.5}
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── SaveToJournalForm ────────────────────────────────────────

function SaveToJournalForm({
  prefillSymbol,
  prefillDirection,
  prefillStrategy,
  onSaved,
  onCancel,
}: {
  prefillSymbol?: string;
  prefillDirection?: string;
  prefillStrategy?: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [symbol, setSymbol] = useState(prefillSymbol ?? "");
  const [direction, setDirection] = useState<"BUY" | "SELL">(
    prefillDirection?.toUpperCase() === "SELL" ? "SELL" : "BUY",
  );
  const [entryPrice, setEntryPrice] = useState("");
  const [exitPrice, setExitPrice] = useState("");
  const [outcome, setOutcome] = useState("Open");
  const [pnl, setPnl] = useState("");
  const [notes, setNotes] = useState("");
  const [strategy, setStrategy] = useState(prefillStrategy ?? "");
  const addEntry = useAddTradeEntry();

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
      toast.success("Saved to journal!");
      onSaved();
    } catch {
      toast.error("Failed to save to journal");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-xl p-4 space-y-3 w-full max-w-[320px]"
    >
      <div className="flex items-center gap-2">
        <BookOpen className="h-4 w-4 text-primary" />
        <p className="font-bold text-sm text-foreground">Save to Journal</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">
            Symbol
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
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setDirection("BUY")}
              className={`flex-1 h-8 text-xs font-bold rounded-md border transition-all ${direction === "BUY" ? "bg-bull/20 border-bull/50 text-bull" : "border-border text-muted-foreground hover:bg-muted/30"}`}
            >
              BUY
            </button>
            <button
              type="button"
              onClick={() => setDirection("SELL")}
              className={`flex-1 h-8 text-xs font-bold rounded-md border transition-all ${direction === "SELL" ? "bg-bear/20 border-bear/50 text-bear" : "border-border text-muted-foreground hover:bg-muted/30"}`}
            >
              SELL
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">
            Entry
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
            Exit
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
          placeholder="e.g. RSI Strategy"
          className="h-8 text-xs"
        />
      </div>

      <div className="space-y-1">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">
          Notes (optional)
        </p>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any observations..."
          className="resize-none text-xs min-h-[56px] rounded-lg"
        />
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onCancel}
          className="flex-1 rounded-full text-xs h-8"
          disabled={addEntry.isPending}
        >
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={addEntry.isPending || !symbol.trim()}
          className="flex-1 rounded-full text-xs h-8"
        >
          {addEntry.isPending ? (
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          ) : (
            <BookOpen className="h-3 w-3 mr-1" />
          )}
          Save
        </Button>
      </div>
    </motion.div>
  );
}

// ─── Guest Analysis Session ───────────────────────────────────

const GUEST_SESSION_KEY = "smart_trade_guest_used";

function hasUsedGuestAnalysis(): boolean {
  try {
    return sessionStorage.getItem(GUEST_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

function markGuestAnalysisUsed() {
  try {
    sessionStorage.setItem(GUEST_SESSION_KEY, "1");
  } catch {
    // ignore
  }
}

// ─── Main AIAnalysis component ────────────────────────────────

interface AIAnalysisProps {
  quickAnalyze?: { symbol: string; ts: number } | null;
  onQuickAnalyzeHandled?: () => void;
}

export function AIAnalysis({
  quickAnalyze,
  onQuickAnalyzeHandled,
}: AIAnalysisProps) {
  const { identity, login, isLoggingIn } = useInternetIdentity();
  const isLoggedIn = !!identity;

  // Guest mode: allow 1 free analysis without login
  const [guestMode, setGuestMode] = useState(false);
  const [guestUsed, setGuestUsed] = useState(hasUsedGuestAnalysis);

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
  const isSending = useRef(false);
  const lastAnalysisParams = useRef<{
    strategyName: string;
    symbol: string;
    notes: string;
    imageFile?: File;
    result?: AnalysisResult;
  } | null>(null);

  // History (only when logged in)
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
      const container = document.getElementById("chat-scroll-container");
      if (container) {
        container.scrollTop = container.scrollHeight;
      } else {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }
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
      const isGuest = !identity;
      if (isGuest && !guestMode) return;
      setPhase("analyzing");

      lastAnalysisParams.current = {
        strategyName,
        symbol,
        notes,
        imageFile: attachedImage,
        result: undefined,
      };

      try {
        const isGuest = !identity;
        let finalResult: AnalysisResult;

        if (isGuest) {
          // Guest mode: use Pollinations directly
          const pollinationsResult = await callPollinationsAI(
            strategyName,
            symbol,
            notes,
          );
          finalResult = {
            signal: pollinationsResult.signal ?? "N/A",
            entryPrice: pollinationsResult.entryPrice ?? "N/A",
            stopLoss: pollinationsResult.stopLoss ?? "N/A",
            takeProfit: pollinationsResult.takeProfit ?? "N/A",
            riskLevel: pollinationsResult.riskLevel ?? "Medium",
            confidence: pollinationsResult.confidence ?? "",
            probability: pollinationsResult.probability ?? "",
            entryConfidence: pollinationsResult.entryConfidence ?? "",
            stopLossSafety: pollinationsResult.stopLossSafety ?? "",
            takeProfitProbability:
              pollinationsResult.takeProfitProbability ?? "",
            marketTrend: pollinationsResult.marketTrend ?? "",
            strategyUsed: pollinationsResult.strategyUsed ?? strategyName,
            explanation: pollinationsResult.explanation ?? "Analysis complete.",
            timestamp: BigInt(Date.now() * 1_000_000),
          };
          // Mark guest analysis used
          markGuestAnalysisUsed();
          setGuestUsed(true);
        } else {
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
              principal: identity!.getPrincipal(),
              strategyName,
              symbol,
              notes: notes || undefined,
            });
          }

          // Try to recover from parse failures
          const recovered = recoverAnalysisResult(result);

          // If backend failed or signalled to use Pollinations, use it as fallback
          finalResult = recovered;
          const isBackendError =
            recovered.signal === "Error" ||
            recovered.signal === "N/A" ||
            recovered.signal === "TODO" ||
            recovered.signal === "" ||
            recovered.signal === "POLLINATIONS";
          if (isBackendError) {
            try {
              const pollinationsResult = await callPollinationsAI(
                strategyName,
                symbol,
                notes,
              );
              if (
                pollinationsResult.signal &&
                pollinationsResult.signal !== "N/A"
              ) {
                finalResult = {
                  ...recovered,
                  ...pollinationsResult,
                  timestamp: recovered.timestamp,
                };
              }
            } catch (pollinationsErr) {
              console.error(
                "Pollinations fallback also failed:",
                pollinationsErr,
              );
            }
          }
        }

        // Store result for Save to Journal
        if (lastAnalysisParams.current) {
          lastAnalysisParams.current.result = finalResult;
        }

        addMessage({
          role: "ai",
          type: "result",
          content: "",
          result: finalResult,
        });

        setTimeout(() => {
          const isStillNA =
            finalResult.signal === "N/A" ||
            finalResult.signal === "Error" ||
            finalResult.signal === "TODO";

          if (isStillNA) {
            addMessage({
              role: "ai",
              type: "error",
              content:
                finalResult.explanation ||
                "Analysis failed. Check the result card above for the raw error.",
              chips: ["__retry__"],
              chipsUsed: false,
            });
          } else {
            addMessage({
              role: "ai",
              type: "text",
              content: "Analysis complete! What would you like to do next?",
              chips: [
                "__submit_strategy__",
                "__save_journal__",
                "__new_analysis__",
              ],
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
    [identity, guestMode, analyze, analyzeWithImage, addMessage],
  );

  // ─── Handle quickAnalyze from Dashboard ───────────────────────
  // biome-ignore lint/correctness/useExhaustiveDependencies: respond to ts change
  useEffect(() => {
    if (!quickAnalyze || !isLoggedIn) return;
    const { symbol } = quickAnalyze;
    onQuickAnalyzeHandled?.();
    const t = setTimeout(() => {
      const questions = getQuestionsForStrategy("Trend Following", false);
      setCurrentStrategy("Trend Following");
      setIsCustomStrategy(false);
      setCurrentQuestions(questions);
      setAnswers({ symbol });
      setCurrentSymbol(symbol);
      setQuestionIndex(0);
      handleImageClear();
      addMessage({
        role: "user",
        type: "text",
        content: `Quick Analyze: ${symbol}`,
      });
      setTimeout(() => {
        // Skip to timeframe question (index 1) since symbol is pre-filled
        const tq = questions[1];
        if (tq) {
          addMessage({
            role: "ai",
            type: "text",
            content: `Analyzing ${symbol} with Trend Following. ${tq.text}`,
            chips: tq.chips,
            isImageUploadPrompt: tq.isImageUpload,
            chipsUsed: false,
          });
          setQuestionIndex(1);
          setPhase("questioning");
        }
      }, 300);
    }, 100);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quickAnalyze?.ts]);

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

      if (chip === "__save_journal__") {
        markLastChipsUsed();
        addMessage({ role: "user", type: "text", content: "Save to Journal" });
        const params = lastAnalysisParams.current;
        const result = params?.result;
        setTimeout(() => {
          addMessage({
            role: "ai",
            type: "result",
            content: (
              <SaveToJournalForm
                prefillSymbol={params?.symbol}
                prefillDirection={result?.signal}
                prefillStrategy={result?.strategyUsed ?? params?.strategyName}
                onSaved={() => {
                  addMessage({
                    role: "ai",
                    type: "text",
                    content: "✅ Trade saved to your journal!",
                  });
                }}
                onCancel={() => {
                  addMessage({
                    role: "ai",
                    type: "text",
                    content: "Journal entry cancelled.",
                  });
                }}
              />
            ) as unknown as string,
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

      if (chip === "__market_overview__") {
        markLastChipsUsed();
        addMessage({ role: "user", type: "text", content: "Market Overview" });
        setTimeout(() => {
          addMessage({
            role: "ai",
            type: "text",
            content: "Fetching market overview across all assets... 🌍",
          });
          void runAnalysis(
            "Market Overview",
            "BTC/USD",
            "Give me a brief overview of the current market conditions across crypto, forex, and commodities. Comment on BTC, Gold, EUR/USD trends.",
          );
        }, 200);
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
    if (isAnalyzing || isSending.current) return;
    isSending.current = true;

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
        isSending.current = false;
        handleAnswer("uploaded", questionIndex, imageFile);
        return;
      }
      if (text) {
        isSending.current = false;
        handleAnswer(text, questionIndex);
        return;
      }
    }

    // Free-text analysis
    const symbol = (() => {
      const lower = text.toLowerCase();
      if (lower.includes("btc") || lower.includes("bitcoin")) return "BTC/USD";
      if (lower.includes("eth") || lower.includes("ethereum")) return "ETH/USD";
      if (lower.includes("xau") || lower.includes("gold")) return "XAU/USD";
      if (lower.includes("xag") || lower.includes("silver")) return "XAG/USD";
      if (lower.includes("euro") || lower.includes("eur")) return "EUR/USD";
      if (lower.includes("pound") || lower.includes("gbp")) return "GBP/USD";
      if (lower.includes("yen") || lower.includes("jpy")) return "USD/JPY";
      if (
        lower.includes("ndx") ||
        lower.includes("nasdaq100") ||
        lower.includes("nasdaq")
      )
        return "NASDAQ";
      if (
        lower.includes("spx") ||
        lower.includes("s&p") ||
        lower.includes("sp500") ||
        lower.includes("s&p500")
      )
        return "S&P500";
      if (
        lower.includes("crude") ||
        lower.includes("wti") ||
        lower.includes("usoil") ||
        lower.includes("oil")
      )
        return "OIL";
      return "BTC/USD";
    })();

    isSending.current = false;
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

  const handleClearChat = useCallback(() => {
    const now = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    setMessages([
      {
        id: "greeting-clear",
        role: "ai",
        type: "text",
        timestamp: now,
        content:
          "👋 Hey! I'm your AI trading analyst. Pick a strategy below or type a question to get started.",
      },
    ]);
    setPhase("greeting");
    setQuestionIndex(0);
    setAnswers({});
    setCurrentStrategy("");
    setCurrentQuestions([]);
    handleImageClear();
  }, [handleImageClear]);

  // Step info for questions
  const stepInfo =
    phase === "questioning" && currentQuestions.length > 0
      ? `Step ${questionIndex + 1} of ${currentQuestions.length}`
      : undefined;

  // ─── Init greeting for guest mode ───────────────────────────
  useEffect(() => {
    if (!guestMode) return;
    setMessages([
      {
        id: "greeting-guest",
        role: "ai",
        type: "text",
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        content:
          "👋 Hey! You have 1 free analysis. Pick a strategy below or type a question to get started.",
      },
    ]);
    setPhase("greeting");
    setQuestionIndex(0);
    setAnswers({});
  }, [guestMode]);

  // ─── Login gate ───────────────────────────────────────────────

  if (!isLoggedIn && !guestMode) {
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
            data-ocid="ai.login_button"
          >
            {isLoggingIn ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <LogIn className="h-4 w-4 mr-2" />
            )}
            {isLoggingIn ? "Signing in..." : "Sign In to Continue"}
          </Button>

          {/* Guest try without login */}
          {!guestUsed ? (
            <button
              type="button"
              data-ocid="ai.guest_button"
              onClick={() => setGuestMode(true)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
            >
              Try 1 free analysis without signing in
            </button>
          ) : (
            <p className="text-xs text-muted-foreground/70">
              Free analysis used. Sign in for unlimited access.
            </p>
          )}
        </motion.div>

        <p className="text-xs text-muted-foreground text-center">
          AI analysis is for educational purposes only. Not financial advice.
        </p>
      </div>
    );
  }

  // ─── Main UI ──────────────────────────────────────────────────

  // Show guest exhausted banner mid-chat
  const showGuestExhaustedBanner = guestMode && guestUsed && !isLoggedIn;

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
            Powered by Pollinations AI
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

      {/* AI Quick Tips */}
      <AIQuickTips />

      {/* Risk Calculator */}
      <RiskCalculator />

      {/* Strategy Box — hide for guest to simplify */}
      {isLoggedIn && (
        <StrategyBox
          onStrategySelect={handleStrategySelect}
          isLoggedIn={isLoggedIn}
        />
      )}
      {!isLoggedIn && guestMode && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 pb-3 pt-3 flex flex-wrap gap-1.5">
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
                  onClick={() =>
                    handleStrategySelect(name, false, s.description)
                  }
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-full text-xs font-semibold border transition-all active:scale-95 ${catColor || "text-primary border-primary/30 bg-primary/5 hover:bg-primary/15"} border-current/20 bg-current/5 hover:bg-current/10`}
                >
                  <Zap className="h-3 w-3" />
                  {name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Guest exhausted banner */}
      {showGuestExhaustedBanner && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex flex-col items-center gap-2 text-center"
        >
          <p className="text-sm font-semibold text-foreground">
            Free analysis used
          </p>
          <p className="text-xs text-muted-foreground">
            Sign in to run unlimited analyses, save history, and access all
            features.
          </p>
          <Button
            onClick={login}
            disabled={isLoggingIn}
            size="sm"
            className="rounded-full mt-1"
            data-ocid="ai.signin_after_guest_button"
          >
            {isLoggingIn ? (
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            ) : (
              <LogIn className="h-3.5 w-3.5 mr-1" />
            )}
            Sign In to Continue
          </Button>
        </motion.div>
      )}

      {/* Chat area */}
      <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col">
        {/* Chat header bar with clear button */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border/50">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Chat
          </span>
          <button
            type="button"
            data-ocid="ai.chat_clear_button"
            onClick={handleClearChat}
            disabled={isAnalyzing || messages.length === 0}
            className="h-7 w-7 flex items-center justify-center rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-30"
            aria-label="Clear chat"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Messages — native scrollable with iOS momentum */}
        <div
          className="overflow-y-auto"
          style={{
            height: "min(55vh, 480px)",
            WebkitOverflowScrolling: "touch",
          }}
          ref={(el) => {
            // Assign messagesEndRef container for auto-scroll tracking
            if (!el) return;
            // We scroll the container itself to the bottom
            (
              el as HTMLDivElement & { _chatContainer?: boolean }
            )._chatContainer = true;
          }}
          id="chat-scroll-container"
        >
          <div className="p-4 space-y-4">
            {/* Empty state */}
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
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

            {/* Market Overview quick pick — shown in greeting phase */}
            {messages.length > 0 &&
              phase === "greeting" &&
              !isAnalyzing &&
              isLoggedIn && (
                <div className="flex justify-center pb-1">
                  <button
                    type="button"
                    data-ocid="ai.market_overview_button"
                    onClick={() => handleChipClick("__market_overview__")}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-full text-xs font-semibold border border-primary/30 bg-primary/5 text-primary hover:bg-primary/15 hover:border-primary/50 transition-all active:scale-95"
                  >
                    <Globe className="h-3.5 w-3.5" />
                    Market Overview
                  </button>
                </div>
              )}

            <AnimatePresence initial={false}>
              {messages.map((msg, idx) => (
                <ChatBubble
                  key={msg.id}
                  message={msg}
                  onChipClick={
                    phase !== "analyzing" && !showGuestExhaustedBanner
                      ? handleChipClick
                      : undefined
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
        </div>

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
