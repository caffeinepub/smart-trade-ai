import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BarChart2 } from "lucide-react";
import { useEffect, useState } from "react";

const SYMBOLS: { value: string; label: string; tv: string }[] = [
  { value: "BTC/USD", label: "BTC/USD — Bitcoin", tv: "BINANCE:BTCUSDT" },
  { value: "ETH/USD", label: "ETH/USD — Ethereum", tv: "BINANCE:ETHUSDT" },
  { value: "XAU/USD", label: "XAU/USD — Gold", tv: "OANDA:XAUUSD" },
  { value: "XAG/USD", label: "XAG/USD — Silver", tv: "OANDA:XAGUSD" },
  { value: "EUR/USD", label: "EUR/USD — Euro", tv: "OANDA:EURUSD" },
  { value: "GBP/USD", label: "GBP/USD — Pound", tv: "OANDA:GBPUSD" },
  { value: "USD/JPY", label: "USD/JPY — Yen", tv: "OANDA:USDJPY" },
  { value: "OIL", label: "OIL — Crude Oil", tv: "NYMEX:CL1!" },
  { value: "NASDAQ", label: "NASDAQ", tv: "NASDAQ:NDX" },
  { value: "S&P500", label: "S&P 500", tv: "SP:SPX" },
];

const TIMEFRAMES: { label: string; value: string }[] = [
  { label: "1m", value: "1" },
  { label: "5m", value: "5" },
  { label: "15m", value: "15" },
  { label: "1h", value: "60" },
  { label: "4h", value: "240" },
  { label: "1D", value: "D" },
];

interface ChartsProps {
  initialSymbol?: string;
  isDark: boolean;
}

export function Charts({ initialSymbol, isDark }: ChartsProps) {
  const [selectedSymbol, setSelectedSymbol] = useState(
    initialSymbol ?? "BTC/USD",
  );
  const [timeframe, setTimeframe] = useState("60");
  const [iframeKey, setIframeKey] = useState(0);

  // When initialSymbol changes (from dashboard), update selected symbol
  useEffect(() => {
    if (initialSymbol) {
      setSelectedSymbol(initialSymbol);
    }
  }, [initialSymbol]);

  const tvSymbol =
    SYMBOLS.find((s) => s.value === selectedSymbol)?.tv ?? "BINANCE:BTCUSDT";

  const tvTheme = isDark ? "dark" : "light";

  const iframeUrl = `https://www.tradingview.com/widgetembed/?symbol=${encodeURIComponent(tvSymbol)}&interval=${timeframe}&theme=${tvTheme}&style=1&locale=en&toolbar_bg=%23f1f3f6&enable_publishing=false&hide_side_toolbar=false&allow_symbol_change=true&container_id=tradingview_chart&hide_legend=false&save_image=false`;

  const handleSymbolChange = (value: string) => {
    setSelectedSymbol(value);
    setIframeKey((k) => k + 1);
  };

  const handleTimeframeChange = (tf: string) => {
    setTimeframe(tf);
    setIframeKey((k) => k + 1);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Controls */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <BarChart2 className="h-4 w-4 text-primary shrink-0" />
          <h2 className="font-semibold text-sm text-foreground">
            TradingView Chart
          </h2>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Symbol Selector */}
          <Select value={selectedSymbol} onValueChange={handleSymbolChange}>
            <SelectTrigger className="h-8 text-xs w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SYMBOLS.map((s) => (
                <SelectItem key={s.value} value={s.value} className="text-xs">
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Timeframe buttons */}
          <div className="flex gap-1">
            {TIMEFRAMES.map((tf) => (
              <Button
                key={tf.value}
                size="sm"
                variant={timeframe === tf.value ? "default" : "outline"}
                className="h-8 px-2.5 text-xs min-w-0"
                onClick={() => handleTimeframeChange(tf.value)}
              >
                {tf.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Chart iframe */}
      <div className="relative w-full rounded-lg overflow-hidden border border-border bg-card">
        <div className="aspect-[4/3] sm:aspect-[16/9] w-full min-h-[300px]">
          <iframe
            key={iframeKey}
            src={iframeUrl}
            className="w-full h-full border-0"
            title={`${selectedSymbol} Chart`}
            allowFullScreen
            loading="lazy"
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Charts provided by TradingView. Educational purposes only. Not financial
        advice.
      </p>
    </div>
  );
}
