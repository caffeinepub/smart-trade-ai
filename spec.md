# Smart Trade AI

## Current State
- Full-stack ICP app with Motoko backend + React/TypeScript frontend
- Backend: market prices via Twelve Data API (6 keys, rotating), AI analysis via Gemini 2.5 Flash (5 keys, rotating), TradingView chart widget, Internet Identity auth
- Frontend: 5 tabs (Markets, Charts, AI, Community, Profile), mobile bottom nav, dark/light theme
- AI chat interface with strategy selection, guided Q&A, analysis result cards
- Pollinations AI frontend fallback when Gemini fails
- Features: trade journal, price alerts, market heatmap, market sentiment gauge, risk calculator, favorite strategies, community strategy voting

## Requested Changes (Diff)

### Add
- Replace Twelve Data with a free, no-limit market data API (CoinGecko for crypto, exchangerate.host for forex, fallback to static mock prices for indices/commodities — all free with no API key)
- Estimated analysis time display: show "~X seconds" before analysis starts based on which path will be taken
- Backend function `getAnalysisEstimate` returning estimated seconds
- New backend function: `getMarketNews` — returns latest curated news items as static array (no external API needed)
- 4–5 new features:
  1. **Learning Hub** — static educational content tab in Profile: glossary of trading terms (20 terms), and a "Did you know?" rotating fact
  2. **AI Confidence History Chart** — in analysis history, show a mini sparkline/bar of confidence % across last 5 analyses
  3. **Quick Analysis (no login)** — allow non-logged-in users to run 1 analysis per session (using localStorage flag) via Pollinations directly, so the app is useful immediately
  4. **Market News Feed** — small collapsible news section on Dashboard with curated market insights
  5. **Chat message timestamps and scroll behavior** — proper auto-scroll to bottom on new message, visible timestamps on hover, scrollable chat area that works on mobile

### Modify
- Backend `getMarketPrices`: replace Twelve Data HTTP calls with CoinGecko API for BTC/ETH, use exchangerate.host for forex pairs, keep static fallback for indices/oil
- AI analysis: keep Pollinations as primary since Gemini keys are all revoked — make Pollinations the FIRST attempt instead of fallback, remove Gemini key dependency from main flow (keep backend for reference but route through Pollinations for reliability)
- Chat interface: improve scroll behavior — chat window must auto-scroll to latest message, support scroll up to see history, smooth scroll on new message
- Analysis loading: show estimated time ("Analyzing... ~8 seconds") when analysis starts
- All code: remove dead/unused imports and variables
- Dashboard: market data now labeled as "Demo" when from mock (no API failure needed)

### Remove
- Twelve Data API keys from backend (replaced by free alternatives)
- Gemini keys from active rotation — keep setAccessToken admin function but remove hardcoded revoked keys, replace with empty array so users can add valid keys
- Dead code and unused imports in AIAnalysis.tsx (ArrowUpDown, Globe, etc.)

## Implementation Plan
1. Update backend `getMarketPrices` to use CoinGecko (free, no key) for crypto prices and exchangerate.host (free, no key) for forex — fall back to static mock for indices/commodities
2. Add `getAnalysisEstimate` query function returning estimated seconds based on whether Gemini keys exist
3. Add `getMarketNews` returning static curated news items array
4. Remove hardcoded revoked Gemini keys (set to empty), keep key rotation infrastructure
5. Frontend: make Pollinations the primary analysis path (no backend needed for analysis), show estimated time when analysis begins
6. Frontend AI chat: fix scroll — use a scrollable container with `overflow-y-auto`, auto-scroll ref on message append, smooth behavior
7. Frontend: add Learning Hub section to Profile tab
8. Frontend: add mini confidence sparkline to analysis history cards
9. Frontend: add guest Quick Analysis (1 per session) with localStorage guard
10. Frontend: add Market News Feed collapsible panel on Dashboard
11. Clean up all unused imports across all components
