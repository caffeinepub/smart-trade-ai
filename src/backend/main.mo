import Array "mo:core/Array";
import List "mo:core/List";
import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Order "mo:core/Order";
import Principal "mo:core/Principal";
import Text "mo:core/Text";
import Time "mo:core/Time";
import OutCall "http-outcalls/outcall";
import MixinAuthorization "authorization/MixinAuthorization";
import AccessControl "authorization/access-control";
import Runtime "mo:core/Runtime";
import Error "mo:core/Error";

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

  public type AnalysisRequest = {
    principal : Principal;
    strategyName : Text;
    symbol : Text;
    notes : ?Text;
  };

  public type AnalysisWithImageRequest = {
    strategyName : Text;
    symbol : Text;
    notes : ?Text;
    imageBase64 : Text;
    mimeType : Text;
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

  public type CustomStrategy = {
    id : Text;
    name : Text;
    description : Text;
    howItWorks : Text;
    creator : Principal;
    timestamp : Time.Time;
  };

  let twelveDataKeys : [Text] = [
    "904fe4116b2148eca45fce535af482c6",
    "f988d1da71fa4ad0938cd905101981ac",
    "17d22eafa5264a1b8354b079aebdd71b",
    "d8af8b81c87e4d97a325c3bd09d7218b",
    "d43ad76b576f48fd87fb9423d79a26cb",
    "7700a221ff464c44b8ff5da12cf36406",
  ];

  var twelveDataKeyIndex : Nat = 0;

  let geminiKeys : [Text] = [
    "AIzaSyC_ksw8XtoO35iSE_DVFRNeONwydB4e_ZQ",
    "AIzaSyD9d2m7ggQ8d7ndWpsQVk5JfG_xHz4A1S0",
    "AIzaSyC5dcwBiBRfubZlTOuTeFUyl8CaemGLTI4",
    "AIzaSyD68nxpkflES-8AO4YluVRiaqO7veQZVD8",
    "AIzaSyC0aYLOs6WT_Ikxw2q3VNemA5pVSvyFnJ4",
  ];
  var geminiKeyIndex : Nat = 0;
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
  let customStrategies = Map.empty<Text, CustomStrategy>();
  let userWatchlists = Map.empty<Principal, List.List<Text>>();

  module CommunityStrategy {
    public func compareByVotes(a : CommunityStrategy, b : CommunityStrategy) : Order.Order {
      if (a.votes > b.votes) { #greater }
      else if (a.votes < b.votes) { #less }
      else { #equal };
    };
  };

  func getTwelveDataKey() : Text {
    if (twelveDataApiKey != "") { return twelveDataApiKey };
    twelveDataKeys[twelveDataKeyIndex % twelveDataKeys.size()];
  };

  func rotateTwelveDataKey() {
    twelveDataKeyIndex := (twelveDataKeyIndex + 1) % twelveDataKeys.size();
  };

  func getGeminiKey() : Text {
    if (geminiApiKey != "") { return geminiApiKey };
    geminiKeys[geminiKeyIndex % geminiKeys.size()];
  };

  public shared ({ caller }) func rotateGeminiKey() : async () {
    if (not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Only admins can rotate Gemini keys");
    };
    geminiKeyIndex := (geminiKeyIndex + 1) % geminiKeys.size();
  };

  public shared ({ caller }) func setAccessToken(twelveData : Text, gemini : Text) : async () {
    if (not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Only admins can set access token");
    };
    twelveDataApiKey := twelveData;
    geminiApiKey := gemini;
  };

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

  public query func transform(input : OutCall.TransformationInput) : async OutCall.TransformationOutput {
    OutCall.transform(input);
  };

  func extractJsonField(json : Text, field : Text) : ?Text {
    let needle1 = "\"" # field # "\":\"";
    let needle2 = "\"" # field # "\": \"";
    func tryNeedle(needle : Text) : ?Text {
      let parts = json.split(#text needle);
      ignore parts.next();
      switch (parts.next()) {
        case (null) { null };
        case (?afterNeedle) {
          var result = "";
          var prev : Char = ' ';
          var done = false;
          for (ch in afterNeedle.chars()) {
            if (not done) {
              if (ch == '\"' and prev != '\\') {
                done := true;
              } else {
                result := result # Text.fromChar(ch);
                prev := ch;
              };
            };
          };
          if (result != "") { ?result } else { null };
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
      case (?v) { if (v == "") { fallback } else { v } };
      case (null) { fallback };
    };
  };

  func extractGeminiText(resp : Text) : Text {
    let unescaped = unescapeJson(resp);

    if (not unescaped.contains(#text "\"candidates\"")) {
      return "";
    };

    let needle = "\"text\":\"";
    var lastSeg : ?Text = null;
    let parts = unescaped.split(#text needle);
    ignore parts.next();
    for (seg in parts) {
      lastSeg := ?seg;
    };
    switch (lastSeg) {
      case (null) { "" };
      case (?seg) {
        var result = "";
        var prevWasBackslash = false;
        var done = false;
        for (ch in seg.chars()) {
          if (not done) {
            if (ch == '\"' and not prevWasBackslash) {
              done := true;
            } else {
              result := result # Text.fromChar(ch);
              prevWasBackslash := (ch == '\\');
            };
          };
        };
        result;
      };
    };
  };

  func stripCodeFences(s : Text) : Text {
    var t = s;
    if (t.startsWith(#text "```json")) {
      let ps = t.split(#text "```json");
      ignore ps.next();
      switch (ps.next()) { case (?r) { t := r }; case (null) {} };
    } else if (t.startsWith(#text "```")) {
      let ps = t.split(#text "```");
      ignore ps.next();
      switch (ps.next()) { case (?r) { t := r }; case (null) {} };
    };
    if (t.contains(#text "```")) {
      let ps = t.split(#text "```");
      switch (ps.next()) { case (?b) { t := b }; case (null) {} };
    };
    t;
  };

  func unescapeJson(s : Text) : Text {
    s
      |> _.replace(#text "\\\"", "\"")
      |> _.replace(#text "\\n", " ")
      |> _.replace(#text "\\t", " ")
      |> _.replace(#text "\\\\", "\\");
  };

  func buildGeminiBody(strategyName : Text, symbol : Text, notes : ?Text) : Text {
    let notesStr = switch (notes) {
      case (null) { "" };
      case (?n) { "\\nExtra context: " # n };
    };
    "{\"contents\":[{\"parts\":[{\"text\":\"You are a professional trading analyst. Analyze " # symbol # " using the " # strategyName # " strategy." # notesStr # "\\nIMPORTANT: Return ONLY a raw JSON object. No markdown, no code fences, no extra text before or after. Start your response with { and end with }.\\nRequired JSON format:\\n{\\\"signal\\\":\\\"BUY or SELL\\\",\\\"entryPrice\\\":\\\"numeric value\\\",\\\"stopLoss\\\":\\\"numeric value\\\",\\\"takeProfit\\\":\\\"numeric value\\\",\\\"riskLevel\\\":\\\"Low or Medium or High\\\",\\\"confidence\\\":\\\"e.g. 72%\\\",\\\"probability\\\":\\\"e.g. 68%\\\",\\\"entryConfidence\\\":\\\"e.g. 75%\\\",\\\"stopLossSafety\\\":\\\"Good or Fair or Poor\\\",\\\"takeProfitProbability\\\":\\\"e.g. 65%\\\",\\\"marketTrend\\\":\\\"Bullish or Bearish or Neutral\\\",\\\"strategyUsed\\\":\\\"strategy name\\\",\\\"explanation\\\":\\\"2-3 sentence analysis\\\"}\"}]}]}";
  };

  func buildGeminiImageBody(strategyName : Text, symbol : Text, notes : ?Text, imageBase64 : Text, mimeType : Text) : Text {
    let notesStr = switch (notes) {
      case (null) { "" };
      case (?n) { "\\nExtra context: " # n };
    };
    "{\"contents\":[{\"parts\":[{\"inline_data\":{\"mime_type\":\"" # mimeType # "\",\"data\":\"" # imageBase64 # "\"}},{\"text\":\"Analyze this chart for " # symbol # " using " # strategyName # " strategy." # notesStr # "\\nIMPORTANT: Return ONLY a raw JSON object. No markdown, no code fences, no extra text before or after. Start your response with { and end with }.\\nRequired JSON format:\\n{\\\"signal\\\":\\\"BUY or SELL\\\",\\\"entryPrice\\\":\\\"numeric value\\\",\\\"stopLoss\\\":\\\"numeric value\\\",\\\"takeProfit\\\":\\\"numeric value\\\",\\\"riskLevel\\\":\\\"Low or Medium or High\\\",\\\"confidence\\\":\\\"e.g. 72%\\\",\\\"probability\\\":\\\"e.g. 68%\\\",\\\"entryConfidence\\\":\\\"e.g. 75%\\\",\\\"stopLossSafety\\\":\\\"Good or Fair or Poor\\\",\\\"takeProfitProbability\\\":\\\"e.g. 65%\\\",\\\"marketTrend\\\":\\\"Bullish or Bearish or Neutral\\\",\\\"strategyUsed\\\":\\\"strategy name\\\",\\\"explanation\\\":\\\"2-3 sentence analysis\\\"}\"}]}]}";
  };

  // Helper to check if Gemini result status or response indicates error/no remaining quota
  func isGeminiError(rawResponse : Text) : Bool {
    rawResponse.contains(#text "error") or
    rawResponse.contains(#text "429") or
    rawResponse.contains(#text "quota") or
    rawResponse.contains(#text "RESOURCE_EXHAUSTED") or
    (rawResponse.contains(#text "\"code\":") and
     (rawResponse.contains(#text "INVALID_ARGUMENT") or
     rawResponse.contains(#text "FAILED_PRECONDITION") or
     rawResponse.contains(#text "INTERNAL")));
  };

  // Helper function to limit text length with truncation indication
  func truncate(s : Text, maxLen : Nat) : Text {
    if (s.size() <= maxLen) { return s };
    var result = "";
    var count = 0;
    for (c in s.chars()) {
      if (count >= maxLen) { return result # "...(truncated)" };
      result := result # Text.fromChar(c);
      count += 1;
    };
    result # "...(truncated)";
  };

  /// Improved Gemini call result handling:
  /// * Attempts all keys.
  /// * Fresh signal/error for each key.
  /// * In case of errors:
  ///     * signal is "Error".
  ///     * entry/stop/take profit are "N/A".
  ///     * All keys tried are reported.
  ///     * Details of last (truncated) error.
  /// * Success (non-empty signal) instantly returns result.
  func callGemini(reqBody : Text) : async AnalysisResult {
    var lastRawError : Text = "Gemini error";
    var lastKeyNum : Nat = 1;
    var attempts : Nat = 0;
    while (attempts < geminiKeys.size()) {
      let key = geminiKeys[attempts];
      let keyNum = attempts + 1;
      let url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-04-17:generateContent?key=" # key;
      let headers : [OutCall.Header] = [{ name = "Content-Type"; value = "application/json" }];

      try {
        let resp = await OutCall.httpPostRequest(url, headers, reqBody, transform);
        let rawText = extractGeminiText(resp);
        let json = stripCodeFences(rawText);
        let signalVal = fieldOr(json, "signal", "");

        if (isGeminiError(resp)) {
          lastRawError := "Key " # keyNum.toText() # " failed: " # truncate(resp, 1200);
          lastKeyNum := keyNum;
        } else if (signalVal != "") {
          let explanationVal = if (signalVal == "") {
            "Parse failed. Raw response: " # truncate(resp, 800);
          } else {
            fieldOr(json, "explanation", "Analysis complete.");
          };

          return {
            signal = if (signalVal == "") { "N/A" } else { signalVal };
            entryPrice = fieldOr(json, "entryPrice", "N/A");
            stopLoss = fieldOr(json, "stopLoss", "N/A");
            takeProfit = fieldOr(json, "takeProfit", "N/A");
            riskLevel = fieldOr(json, "riskLevel", "Medium");
            explanation = explanationVal;
            timestamp = Time.now();
            confidence = fieldOr(json, "confidence", "N/A");
            probability = fieldOr(json, "probability", "N/A");
            entryConfidence = fieldOr(json, "entryConfidence", "N/A");
            stopLossSafety = fieldOr(json, "stopLossSafety", "N/A");
            takeProfitProbability = fieldOr(json, "takeProfitProbability", "N/A");
            marketTrend = fieldOr(json, "marketTrend", "Neutral");
            strategyUsed = fieldOr(json, "strategyUsed", "N/A");
          };
        } else {
          lastRawError := "Key " # keyNum.toText() # " failed: No signal in response. Raw: " # truncate(resp, 1200);
          lastKeyNum := keyNum;
        };
      } catch (e) {
        lastRawError := "Key " # keyNum.toText() # " failed: Exception: " # e.message();
        lastKeyNum := keyNum;
      };
      attempts += 1;
    };

    {
      signal = "Error";
      entryPrice = "N/A";
      stopLoss = "N/A";
      takeProfit = "N/A";
      riskLevel = "N/A";
      explanation = "All " # geminiKeys.size().toText() # " keys tried. Last error — " # lastRawError;
      timestamp = Time.now();
      confidence = "0%";
      probability = "0%";
      entryConfidence = "0%";
      stopLossSafety = "N/A";
      takeProfitProbability = "0%";
      marketTrend = "Unknown";
      strategyUsed = "Unknown";
    };
  };

  public shared ({ caller }) func getMarketPrices() : async [MarketPrice] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can access market prices");
    };
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
          let hasError = body.contains(#text "\"code\"") or
                         body.contains(#text "too many requests") or
                         body.contains(#text "rate limit");
          if (hasError) {
            rotateTwelveDataKey();
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
                rotateTwelveDataKey();
                attempts += 1;
              };
            };
          };
        } catch (_) {
          rotateTwelveDataKey();
          attempts += 1;
        };
      };

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

  public shared ({ caller }) func requestAIAnalysis(request : AnalysisRequest) : async AnalysisResult {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can request AI analysis");
    };
    let body = buildGeminiBody(request.strategyName, request.symbol, request.notes);
    let result = try {
      await callGemini(body);
    } catch (e) {
      {
        signal = "Error";
        entryPrice = "N/A";
        stopLoss = "N/A";
        takeProfit = "N/A";
        riskLevel = "N/A";
        explanation = "Error: " # e.message();
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
    } catch (e) {
      {
        signal = "Error";
        entryPrice = "N/A";
        stopLoss = "N/A";
        takeProfit = "N/A";
        riskLevel = "N/A";
        explanation = "Error: " # e.message();
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
      case (null) {
        let placeholder : CommunityStrategy = {
          id = strategyId;
          name = strategyId;
          description = "";
          strategyType = "Custom";
          creator = caller;
          timestamp = Time.now();
          approved = true;
          votes = 0;
        };
        communityStrategies.add(strategyId, placeholder);
        placeholder;
      };
      case (?s) { s };
    };
    communityStrategies.add(strategyId, { currentStrategy with votes = votes.size() });
  };

  public query ({ caller }) func getApprovedStrategies() : async [CommunityStrategy] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can access approved strategies");
    };
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

  func buildGeminiCustomStrategyBody(description : Text) : Text {
    let prompt = "You are a trading strategy expert. A user wants to create a strategy with this description: " # description # "\nReturn ONLY a raw JSON object:\n{\"name\":\"short strategy name\",\"description\":\"one sentence description\",\"howItWorks\":\"2-3 sentence explanation of how to use this strategy, entry/exit rules, indicators needed\"}";
    "{\"contents\":[{\"parts\":[{\"text\":\"" # prompt # "\"}]}]}";
  };

  public shared ({ caller }) func generateCustomStrategy(description : Text) : async CustomStrategy {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can generate custom strategies");
    };
    let body = buildGeminiCustomStrategyBody(description);
    let rawText = await OutCall.httpPostRequest(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-04-17:generateContent?key=" # getGeminiKey(),
      [{ name = "Content-Type"; value = "application/json" }],
      body,
      transform,
    );

    let json = stripCodeFences(extractGeminiText(rawText));
    let name = fieldOr(json, "name", "Unnamed");
    let desc = fieldOr(json, "description", "No description");
    let how = fieldOr(json, "howItWorks", "No details");

    let strat : CustomStrategy = {
      id = caller.toText() # "-" # name;
      name;
      description = desc;
      howItWorks = how;
      creator = caller;
      timestamp = Time.now();
    };

    customStrategies.add(strat.id, strat);
    strat;
  };

  public query ({ caller }) func getCustomStrategies() : async [CustomStrategy] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can access custom strategies");
    };
    customStrategies.values().toArray();
  };

  public shared ({ caller }) func deleteCustomStrategy(id : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can delete custom strategies");
    };
    switch (customStrategies.get(id)) {
      case (null) { Runtime.trap("Strategy not found") };
      case (?strat) {
        if (strat.creator != caller and not AccessControl.isAdmin(accessControlState, caller)) {
          Runtime.trap("Unauthorized: Only strategy creator or admin can delete");
        };
        customStrategies.remove(id);
      };
    };
  };

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
