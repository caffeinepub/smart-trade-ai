import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface UserProfile {
    name: string;
}
export interface TransformationOutput {
    status: bigint;
    body: Uint8Array;
    headers: Array<http_header>;
}
export type Time = bigint;
export interface CommunityStrategy {
    id: string;
    creator: Principal;
    votes: bigint;
    name: string;
    description: string;
    approved: boolean;
    timestamp: Time;
    strategyType: string;
}
export interface http_header {
    value: string;
    name: string;
}
export interface http_request_result {
    status: bigint;
    body: Uint8Array;
    headers: Array<http_header>;
}
export interface AnalysisRequest {
    principal: Principal;
    notes?: string;
    strategyName: string;
    symbol: string;
}
export interface AnalysisWithImageRequest {
    mimeType: string;
    imageBase64: string;
    notes?: string;
    strategyName: string;
    symbol: string;
}
export interface PriceAlert {
    id: string;
    userId: Principal;
    targetPrice: string;
    timestamp: Time;
    triggered: boolean;
    symbol: string;
    condition: string;
}
export interface MarketPrice {
    timestamp: Time;
    price: string;
    changePercent: string;
    symbol: string;
}
export interface TransformationInput {
    context: Uint8Array;
    response: http_request_result;
}
export interface TradeEntry {
    id: string;
    pnl: string;
    direction: string;
    strategy: string;
    notes: string;
    timestamp: Time;
    entryPrice: string;
    exitPrice: string;
    outcome: string;
    symbol: string;
}
export interface AnalysisResult {
    marketTrend: string;
    probability: string;
    stopLossSafety: string;
    takeProfit: string;
    explanation: string;
    stopLoss: string;
    timestamp: Time;
    entryPrice: string;
    signal: string;
    confidence: string;
    takeProfitProbability: string;
    riskLevel: string;
    strategyUsed: string;
    entryConfidence: string;
}
export interface CustomStrategy {
    id: string;
    creator: Principal;
    name: string;
    description: string;
    timestamp: Time;
    howItWorks: string;
}
export interface SystemStatus {
    geminiKeyCount: bigint;
    geminiModel: string;
    twelveDataKeyCount: bigint;
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export interface backendInterface {
    addGeminiKey(key: string): Promise<void>;
    addToWatchlist(symbol: string): Promise<void>;
    addTradeEntry(symbol: string, entryPrice: string, exitPrice: string, direction: string, outcome: string, pnl: string, notes: string, strategy: string): Promise<TradeEntry>;
    approveStrategy(strategyId: string): Promise<void>;
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    checkAndTriggerAlerts(currentPrices: Array<MarketPrice>): Promise<Array<PriceAlert>>;
    clearAnalysisHistory(): Promise<void>;
    deleteCustomStrategy(id: string): Promise<void>;
    deleteStrategy(strategyId: string): Promise<void>;
    deleteTradeEntry(id: string): Promise<void>;
    generateCustomStrategy(description: string): Promise<CustomStrategy>;
    getAnalysisHistory(): Promise<Array<AnalysisResult>>;
    getApprovedStrategies(): Promise<Array<CommunityStrategy>>;
    getCallerUserProfile(): Promise<UserProfile | null>;
    getCallerUserRole(): Promise<UserRole>;
    getCustomStrategies(): Promise<Array<CustomStrategy>>;
    getFavoriteStrategies(): Promise<Array<string>>;
    getMarketPrices(): Promise<Array<MarketPrice>>;
    getPendingStrategies(): Promise<Array<CommunityStrategy>>;
    getPriceAlerts(): Promise<Array<PriceAlert>>;
    getSystemStatus(): Promise<SystemStatus>;
    getTradeEntries(): Promise<Array<TradeEntry>>;
    getUserProfile(user: Principal): Promise<UserProfile | null>;
    getWatchlist(): Promise<Array<string>>;
    isCallerAdmin(): Promise<boolean>;
    rejectStrategy(strategyId: string): Promise<void>;
    removeFromWatchlist(symbol: string): Promise<void>;
    removePriceAlert(id: string): Promise<void>;
    requestAIAnalysis(request: AnalysisRequest): Promise<AnalysisResult>;
    requestAIAnalysisWithImage(request: AnalysisWithImageRequest): Promise<AnalysisResult>;
    rotateGeminiKey(): Promise<void>;
    saveCallerUserProfile(profile: UserProfile): Promise<void>;
    setAccessToken(twelveData: string, gemini: string): Promise<void>;
    setPriceAlert(symbol: string, targetPrice: string, condition: string): Promise<PriceAlert>;
    submitStrategy(name: string, description: string, strategyType: string): Promise<void>;
    toggleFavoriteStrategy(strategyId: string): Promise<void>;
    transform(input: TransformationInput): Promise<TransformationOutput>;
    voteOnStrategy(strategyId: string, upvote: boolean): Promise<void>;
}
