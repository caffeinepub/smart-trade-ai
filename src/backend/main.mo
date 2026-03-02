import Array "mo:core/Array";
import List "mo:core/List";
import Map "mo:core/Map";
import Text "mo:core/Text";
import Time "mo:core/Time";
import Order "mo:core/Order";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import OutCall "http-outcalls/outcall";
import MixinAuthorization "authorization/MixinAuthorization";
import AccessControl "authorization/access-control";
import Migration "migration";

(with migration = Migration.run)
actor {
  public type UserProfile = {
    name : Text;
  };

  public type MarketPrice = {
    symbol : Text;
    price : Text;
    changePercent : Text;
    timestamp : Time.Time;
  };

  public type AnalysisRequest = {
    principal : Principal;
    strategyName : Text;
    symbol : Text;
    notes : ?Text;
  };

  public type AnalysisResult = {
    signal : Text;
    entryPrice : Text;
    stopLoss : Text;
    takeProfit : Text;
    riskLevel : Text;
    explanation : Text;
    timestamp : Time.Time;
    confidence : Text;
    probability : Text;
    entryConfidence : Text;
    stopLossSafety : Text;
    takeProfitProbability : Text;
    marketTrend : Text;
    strategyUsed : Text;
  };

  public type CommunityStrategy = {
    id : Text;
    name : Text;
    description : Text;
    strategyType : Text;
    creator : Principal;
    timestamp : Time.Time;
    approved : Bool;
    votes : Int;
  };

  public type AnalysisWithImageRequest = {
    strategyName : Text;
    symbol : Text;
    notes : ?Text;
    imageBase64 : Text;
    mimeType : Text;
  };

  // ─── Twelve Data API keys (6 keys, backend-only, never returned to frontend)
  let twelveDataKeys : [Text] = [
    "904fe4116b2148eca45fce535af482c6",
    "f988d1da71fa4ad0938cd905101981ac",
    "17d22eafa5264a1b8354b079aebdd71b",
    "d8af8b81c87e4d97a325c3bd09d7218b",
    "d43ad76b576f48fd87fb9423d79a26cb",
    "7700a221ff464c44b8ff5da12cf36406",
  ];
  var twelveDataKeyIndex : Nat = 0;

  // ─── Gemini API key (backend-only, never returned to frontend) ─────────────
  let geminiApiKeyHardcoded : Text = "AIzaSyDt8982dulDkOCW7SjuHRQwS_uDxJ1EXKE";

  // Admin-configurable override keys (optional, take precedence if set)
  var twelveDataApiKey : Text = "";
  var geminiApiKey : Text = "";

  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);

  let userProfiles = Map.empty<Principal, UserProfile>();

  var lastMarketPriceFetchTime : Int = 0;
  var cachedMarketPrices : [MarketPrice] = [];

  let userAnalysisHistory = Map.empty<Principal, List.List<AnalysisResult>>();
  let communityStrategies = Map.empty<Text, CommunityStrategy>();
  let strategyVotes = Map.empty<Text, Map.Map<Principal, Bool>>();
  let userWatchlists = Map.empty<Principal, List.List<Text>>();

  module CommunityStrategy {
    public func compareByVotes(a : CommunityStrategy, b : CommunityStrategy) : Order.Order {
      if (a.votes > b.votes) { #greater }
      else if (a.votes < b.votes) { #less }
      else { #equal };
    };
  };

  // ─── Key helpers (never expose these values to frontend) ──────────────────
  func getTwelveDataKey() : Text {
    if (twelveDataApiKey != "") { return twelveDataApiKey };
    twelveDataKeys[twelveDataKeyIndex % twelveDataKeys.size()];
  };

  func rotateKey() {
    twelveDataKeyIndex := (twelveDataKeyIndex + 1) % twelveDataKeys.size();
  };

  func getGeminiKey() : Text {
    if (geminiApiKey != "") { return geminiApiKey };
    geminiApiKeyHardcoded;
  };

  // ─── Admin: set optional override keys ────────────────────────────────────
  public shared ({ caller }) func setAccessToken(twelveData : Text, gemini : Text) : async () {
    if (not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Only admins can set access token");
    };
    twelveDataApiKey := twelveData;
    geminiApiKey := gemini;
  };

  // ─── User Profiles ─────────────────────────────────────────────────────────
  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can access profiles");
    };
    userProfiles.get(caller);
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfile {
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only view your own profile");
    };
    userProfiles.get(user);
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can save profiles");
    };
    userProfiles.add(caller, profile);
  };

  // ─── HTTP transform (required for outcalls) ────────────────────────────────
  public query func transform(input : OutCall.TransformationInput) : async OutCall.TransformationOutput {
    OutCall.transform(input);
  };

  // ─── JSON field extraction using dot-notation Text.split ──────────────────
  // Splits the JSON string on "\"field\":\"" to extract the value
  func extractJsonField(json : Text, field : Text) : ?Text {
    let needle1 = "\"" # field # "\":\"";
    let needle2 = "\"" # field # "\": \"";
    func tryNeedle(needle : Text) : ?Text {
      let parts = json.split(#text needle);
      ignore parts.next(); // part before needle
      switch (parts.next()) {
        case (null) { null };
        case (?afterNeedle) {
          // Value is before the first closing quote
          let valueParts = afterNeedle.split(#char '\"');
          valueParts.next();
        };
      };
    };
    switch (tryNeedle(needle1)) {
      case (?v) { ?v };
      case (null) { tryNeedle(needle2) };
    };
  };

  func fieldOr(json : Text, field : Text, fallback : Text) : Text {
    switch (extractJsonField(json, field)) {
      case (?v) { v };
      case (null) { fallback };
    };
  };

  // ─── Market Prices with Twelve Data key rotation ──────────────────────────
  public shared func getMarketPrices() : async [MarketPrice] {
    let now = Time.now();
    let ageNs : Int = now - lastMarketPriceFetchTime;
    let ageSecs : Int = ageNs / 1_000_000_000;
    if (cachedMarketPrices.size() > 0 and ageSecs < 10) {
      return cachedMarketPrices;
    };

    let apiSymbols : [Text] = ["BTC/USD", "ETH/USD", "XAU/USD", "XAG/USD", "EUR/USD", "GBP/USD", "USD/JPY", "IXIC", "SPX", "USOIL"];
    let displaySymbols : [Text] = ["BTC/USD", "ETH/USD", "XAU/USD", "XAG/USD", "EUR/USD", "GBP/USD", "USD/JPY", "NASDAQ", "S&P500", "OIL"];

    var results : [MarketPrice] = [];

    var i = 0;
    while (i < apiSymbols.size()) {
      let sym = apiSymbols[i];
      let displaySym = displaySymbols[i];
      var fetched = false;
      var attempts : Nat = 0;

      while (not fetched and attempts < twelveDataKeys.size()) {
        let key = getTwelveDataKey();
        let url = "https://api.twelvedata.com/quote?symbol=" # sym # "&apikey=" # key;
        try {
          let body = await OutCall.httpGetRequest(url, [], transform);
          // Check for rate limit or error response
          let hasError = body.contains(#text "\"code\"") or
                         body.contains(#text "too many requests") or
                         body.contains(#text "rate limit");
          if (hasError) {
            rotateKey();
            attempts += 1;
          } else {
            switch (extractJsonField(body, "price")) {
              case (?price) {
                let change = switch (extractJsonField(body, "percent_change")) {
                  case (?c) { c };
                  case (null) { "0.00" };
                };
                results := results.concat([{
                  symbol = displaySym;
                  price;
                  changePercent = change;
                  timestamp = now;
                }]);
                fetched := true;
              };
              case (null) {
                rotateKey();
                attempts += 1;
              };
            };
          };
        } catch (_) {
          rotateKey();
          attempts += 1;
        };
      };

      // If all keys failed, use cached value for this symbol
      if (not fetched) {
        let cachedEntry = cachedMarketPrices.find(func(p : MarketPrice) : Bool { p.symbol == displaySym });
        switch (cachedEntry) {
          case (?p) { results := results.concat([p]) };
          case (null) {};
        };
      };

      i += 1;
    };

    if (results.size() > 0) {
      cachedMarketPrices := results;
      lastMarketPriceFetchTime := now;
    };
    results;
  };

  // ─── Gemini API helpers (backend-only, keys never exposed to frontend) ─────
  func buildGeminiBody(strategyName : Text, symbol : Text, notes : ?Text) : Text {
    let notesStr = switch (notes) {
      case (null) { "" };
      case (?n) { "\\nExtra notes: " # n };
    };
    "{\"contents\":[{\"parts\":[{\"text\":\"You are a professional trading analyst. Analyze " # symbol # " using the " # strategyName # " strategy." # notesStr # "\\nReturn ONLY strict JSON with no markdown or extra text:\\n{\\\"signal\\\":\\\"BUY or SELL\\\",\\\"entryPrice\\\":\\\"value\\\",\\\"stopLoss\\\":\\\"value\\\",\\\"takeProfit\\\":\\\"value\\\",\\\"riskLevel\\\":\\\"Low or Medium or High\\\",\\\"confidence\\\":\\\"e.g. 72%\\\",\\\"probability\\\":\\\"e.g. 68%\\\",\\\"entryConfidence\\\":\\\"e.g. 75%\\\",\\\"stopLossSafety\\\":\\\"Good or Fair or Poor\\\",\\\"takeProfitProbability\\\":\\\"e.g. 65%\\\",\\\"marketTrend\\\":\\\"Bullish or Bearish or Neutral\\\",\\\"strategyUsed\\\":\\\"name\\\",\\\"explanation\\\":\\\"2-3 sentences\\\"}\"}]}]}";
  };

  func buildGeminiImageBody(strategyName : Text, symbol : Text, notes : ?Text, imageBase64 : Text, mimeType : Text) : Text {
    let notesStr = switch (notes) {
      case (null) { "" };
      case (?n) { "\\nExtra notes: " # n };
    };
    "{\"contents\":[{\"parts\":[{\"inline_data\":{\"mime_type\":\"" # mimeType # "\",\"data\":\"" # imageBase64 # "\"}},{\"text\":\"Analyze this chart for " # symbol # " using " # strategyName # " strategy." # notesStr # "\\nReturn ONLY strict JSON with no markdown:\\n{\\\"signal\\\":\\\"BUY or SELL\\\",\\\"entryPrice\\\":\\\"value\\\",\\\"stopLoss\\\":\\\"value\\\",\\\"takeProfit\\\":\\\"value\\\",\\\"riskLevel\\\":\\\"Low or Medium or High\\\",\\\"confidence\\\":\\\"e.g. 72%\\\",\\\"probability\\\":\\\"e.g. 68%\\\",\\\"entryConfidence\\\":\\\"e.g. 75%\\\",\\\"stopLossSafety\\\":\\\"Good or Fair or Poor\\\",\\\"takeProfitProbability\\\":\\\"e.g. 65%\\\",\\\"marketTrend\\\":\\\"Bullish or Bearish or Neutral\\\",\\\"strategyUsed\\\":\\\"name\\\",\\\"explanation\\\":\\\"2-3 sentences\\\"}\"}]}]}";
  };

  func callGemini(reqBody : Text) : async AnalysisResult {
    let key = getGeminiKey();
    let url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" # key;
    let headers : [OutCall.Header] = [{ name = "Content-Type"; value = "application/json" }];
    let resp = await OutCall.httpPostRequest(url, headers, reqBody, transform);

    // Extract text from Gemini response JSON
    let rawText = switch (extractJsonField(resp, "text")) {
      case (?t) { t };
      case (null) { "" };
    };

    // Unescape escaped JSON
    let json = rawText
      |> _.replace(#text "\\\"", "\"")
      |> _.replace(#text "\\n", " ")
      |> _.replace(#text "\\\\", "\\");

    {
      signal = fieldOr(json, "signal", "N/A");
      entryPrice = fieldOr(json, "entryPrice", "N/A");
      stopLoss = fieldOr(json, "stopLoss", "N/A");
      takeProfit = fieldOr(json, "takeProfit", "N/A");
      riskLevel = fieldOr(json, "riskLevel", "Medium");
      explanation = fieldOr(json, "explanation", "Analysis complete. Review entry levels carefully.");
      timestamp = Time.now();
      confidence = fieldOr(json, "confidence", "N/A");
      probability = fieldOr(json, "probability", "N/A");
      entryConfidence = fieldOr(json, "entryConfidence", "N/A");
      stopLossSafety = fieldOr(json, "stopLossSafety", "N/A");
      takeProfitProbability = fieldOr(json, "takeProfitProbability", "N/A");
      marketTrend = fieldOr(json, "marketTrend", "Neutral");
      strategyUsed = fieldOr(json, "strategyUsed", "N/A");
    };
  };

  // ─── AI Analysis (Gemini called from backend only) ─────────────────────────
  public shared ({ caller }) func requestAIAnalysis(request : AnalysisRequest) : async AnalysisResult {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can request AI analysis");
    };

    let body = buildGeminiBody(request.strategyName, request.symbol, request.notes);
    let result = try {
      await callGemini(body);
    } catch (_) {
      {
        signal = "Error";
        entryPrice = "N/A";
        stopLoss = "N/A";
        takeProfit = "N/A";
        riskLevel = "N/A";
        explanation = "AI analysis failed. Please try again.";
        timestamp = Time.now();
        confidence = "0%";
        probability = "0%";
        entryConfidence = "0%";
        stopLossSafety = "N/A";
        takeProfitProbability = "0%";
        marketTrend = "Unknown";
        strategyUsed = request.strategyName;
      };
    };

    let history = switch (userAnalysisHistory.get(caller)) {
      case (null) { List.empty<AnalysisResult>() };
      case (?existing) { existing };
    };
    history.add(result);
    if (history.size() > 50) { ignore history.removeLast() };
    userAnalysisHistory.add(caller, history);
    result;
  };

  public shared ({ caller }) func requestAIAnalysisWithImage(request : AnalysisWithImageRequest) : async AnalysisResult {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can request AI analysis with image");
    };

    let body = buildGeminiImageBody(request.strategyName, request.symbol, request.notes, request.imageBase64, request.mimeType);
    let result = try {
      await callGemini(body);
    } catch (_) {
      {
        signal = "Error";
        entryPrice = "N/A";
        stopLoss = "N/A";
        takeProfit = "N/A";
        riskLevel = "N/A";
        explanation = "AI chart analysis failed. Please try again.";
        timestamp = Time.now();
        confidence = "0%";
        probability = "0%";
        entryConfidence = "0%";
        stopLossSafety = "N/A";
        takeProfitProbability = "0%";
        marketTrend = "Unknown";
        strategyUsed = request.strategyName;
      };
    };

    let history = switch (userAnalysisHistory.get(caller)) {
      case (null) { List.empty<AnalysisResult>() };
      case (?existing) { existing };
    };
    history.add(result);
    if (history.size() > 50) { ignore history.removeLast() };
    userAnalysisHistory.add(caller, history);
    result;
  };

  // ─── Analysis History ──────────────────────────────────────────────────────
  public query ({ caller }) func getAnalysisHistory() : async [AnalysisResult] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can access analysis history");
    };
    switch (userAnalysisHistory.get(caller)) {
      case (null) { [] };
      case (?history) { history.toArray() };
    };
  };

  public shared ({ caller }) func clearAnalysisHistory() : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can clear analysis history");
    };
    userAnalysisHistory.add(caller, List.empty<AnalysisResult>());
  };

  // ─── Community Strategies ──────────────────────────────────────────────────
  public shared ({ caller }) func submitStrategy(name : Text, description : Text, strategyType : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can submit strategies");
    };
    let strategy : CommunityStrategy = {
      id = name;
      name;
      description;
      strategyType;
      creator = caller;
      timestamp = Time.now();
      approved = false;
      votes = 0;
    };
    communityStrategies.add(name, strategy);
    strategyVotes.add(name, Map.empty<Principal, Bool>());
  };

  public shared ({ caller }) func voteOnStrategy(strategyId : Text, upvote : Bool) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can vote on strategies");
    };

    let votes = switch (strategyVotes.get(strategyId)) {
      case (null) {
        let nv = Map.empty<Principal, Bool>();
        strategyVotes.add(strategyId, nv);
        nv;
      };
      case (?existing) { existing };
    };
    votes.add(caller, upvote);

    let currentStrategy = switch (communityStrategies.get(strategyId)) {
      case (null) { Runtime.trap("Strategy not found") };
      case (?s) { s };
    };
    communityStrategies.add(strategyId, { currentStrategy with votes = votes.size() });
  };

  public query func getApprovedStrategies() : async [CommunityStrategy] {
    let arr = communityStrategies.values().toArray();
    arr.sort(CommunityStrategy.compareByVotes).filter(func(s) { s.approved });
  };

  public shared ({ caller }) func approveStrategy(strategyId : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can approve strategies");
    };
    let s = switch (communityStrategies.get(strategyId)) {
      case (null) { Runtime.trap("Strategy not found") };
      case (?s) { s };
    };
    communityStrategies.add(strategyId, { s with approved = true });
  };

  public shared ({ caller }) func rejectStrategy(strategyId : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can reject strategies");
    };
    let s = switch (communityStrategies.get(strategyId)) {
      case (null) { Runtime.trap("Strategy not found") };
      case (?s) { s };
    };
    communityStrategies.add(strategyId, { s with approved = false });
  };

  public shared ({ caller }) func deleteStrategy(strategyId : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can delete strategies");
    };
    communityStrategies.remove(strategyId);
    strategyVotes.remove(strategyId);
  };

  public query ({ caller }) func getPendingStrategies() : async [CommunityStrategy] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can fetch pending strategies");
    };
    let arr = communityStrategies.values().toArray();
    arr.sort(CommunityStrategy.compareByVotes).filter(func(s) { not s.approved });
  };

  // ─── Watchlist ─────────────────────────────────────────────────────────────
  public shared ({ caller }) func addToWatchlist(symbol : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can manage watchlists");
    };
    let wl = switch (userWatchlists.get(caller)) {
      case (null) { List.empty<Text>() };
      case (?existing) { existing };
    };
    if (wl.size() >= 20) { Runtime.trap("Watchlist is full!") };
    wl.add(symbol);
    userWatchlists.add(caller, wl);
  };

  public shared ({ caller }) func removeFromWatchlist(symbol : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can manage watchlists");
    };
    switch (userWatchlists.get(caller)) {
      case (null) { Runtime.trap("No watchlist found for caller!") };
      case (?wl) {
        userWatchlists.add(caller, wl.filter(func(s) { s != symbol }));
      };
    };
  };

  public query ({ caller }) func getWatchlist() : async [Text] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can access watchlists");
    };
    switch (userWatchlists.get(caller)) {
      case (null) { [] };
      case (?wl) { wl.toArray() };
    };
  };
};
