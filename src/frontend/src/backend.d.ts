import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface http_request_result {
    status: bigint;
    body: Uint8Array;
    headers: Array<http_header>;
}
export interface AnalysisWithImageRequest {
    mimeType: string;
    imageBase64: string;
    notes?: string;
    strategyName: string;
    symbol: string;
}
export interface AnalysisRequest {
    principal: Principal;
    notes?: string;
    strategyName: string;
    symbol: string;
}
export interface TransformationOutput {
    status: bigint;
    body: Uint8Array;
    headers: Array<http_header>;
}
export type Time = bigint;
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
export interface UserProfile {
    name: string;
}
export interface http_header {
    value: string;
    name: string;
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export interface backendInterface {
    addToWatchlist(symbol: string): Promise<void>;
    approveStrategy(strategyId: string): Promise<void>;
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    clearAnalysisHistory(): Promise<void>;
    deleteStrategy(strategyId: string): Promise<void>;
    getAnalysisHistory(): Promise<Array<AnalysisResult>>;
    getApprovedStrategies(): Promise<Array<CommunityStrategy>>;
    getCallerUserProfile(): Promise<UserProfile | null>;
    getCallerUserRole(): Promise<UserRole>;
    getMarketPrices(): Promise<Array<MarketPrice>>;
    getPendingStrategies(): Promise<Array<CommunityStrategy>>;
    getUserProfile(user: Principal): Promise<UserProfile | null>;
    getWatchlist(): Promise<Array<string>>;
    isCallerAdmin(): Promise<boolean>;
    rejectStrategy(strategyId: string): Promise<void>;
    removeFromWatchlist(symbol: string): Promise<void>;
    requestAIAnalysis(request: AnalysisRequest): Promise<AnalysisResult>;
    requestAIAnalysisWithImage(request: AnalysisWithImageRequest): Promise<AnalysisResult>;
    saveCallerUserProfile(profile: UserProfile): Promise<void>;
    setAccessToken(twelveData: string, gemini: string): Promise<void>;
    submitStrategy(name: string, description: string, strategyType: string): Promise<void>;
    transform(input: TransformationInput): Promise<TransformationOutput>;
    voteOnStrategy(strategyId: string, upvote: boolean): Promise<void>;
}
