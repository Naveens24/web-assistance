package com.websiteaware.demo;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.web.bind.annotation.*;

import java.io.*;
import java.net.*;
import java.util.*;
import java.util.concurrent.*;

@RestController
@CrossOrigin
public class ChatController {
    System.out.println("PYTHON URL: " + System.getenv("PYTHON_SERVICE_URL"));
System.out.println("API KEY: " + System.getenv("API_KEY_1"));
    private static final String PYTHON_SERVICE = System.getenv("PYTHON_SERVICE_URL");

    private static final List<ApiConfig> API_CHAIN = new ArrayList<>(Arrays.asList(
            // ── GROQ (fastest, free 30 req/min) ──
            new ApiConfig("API_KEY_1", "llama-3.3-70b-versatile",
                    "https://api.groq.com/openai/v1/chat/completions", "groq"),
            new ApiConfig("API_KEY_2", "llama-3.3-70b-versatile",
                    "https://api.groq.com/openai/v1/chat/completions", "groq"),
            new ApiConfig("API_KEY_1", "gemma2-9b-it",
                    "https://api.groq.com/openai/v1/chat/completions", "groq"),

            new ApiConfig("API_KEY_3", "llama-3.3-70b-versatile",
                    "https://api.groq.com/openai/v1/chat/completions", "groq"),

            new ApiConfig(
                    "API_KEY_1",
                    "openai/gpt-oss-120b",
                    "https://api.groq.com/openai/v1/chat/completions",
                    "groq"),

            new ApiConfig(
                    "API_KEY_1",
                    "meta-llama/llama-4-scout-17b-16e-instruct",
                    "https://api.groq.com/openai/v1/chat/completions",
                    "groq"),

            new ApiConfig(
                    "API_KEY_1",
                    "qwen/qwen3-32b",
                    "https://api.groq.com/openai/v1/chat/completions",
                    "groq"),

            new ApiConfig(
                    "API_KEY_1",
                    "llama-3.1-8b-instant",
                    "https://api.groq.com/openai/v1/chat/completions",
                    "groq")

    ));

    // Current API index (rotates on failure)
    private volatile int currentApiIndex = 0;

    // Rate limit cooldown tracker per API
    private final Map<Integer, Long> cooldowns = new ConcurrentHashMap<>();

    // Brave Search (optional — better than DuckDuckGo)
    private static final String BRAVE_KEY = "";

    private final ObjectMapper mapper = new ObjectMapper();

    // ============================================================
    // MAIN ENDPOINT
    // ============================================================
    @PostMapping("/chat")
    public Response chat(@RequestBody ChatRequest request) {
        try {
            String query = request.getQuery() != null ? request.getQuery().trim() : "";

            // Detect query type for smarter handling
            boolean isPersonQuery = isPersonQuery(query);
            boolean isDeepQuery = isDeepQuery(query);

            String extraContext = "";
            if (isPersonQuery)
                extraContext += buildPersonSearchHint(query, request.getPageUrl());
            if (isDeepQuery)
                extraContext += buildDeepQueryHint(query);

            // TIER 1: Answer from full website context
            Map<String, Object> result = callWithFallback(request, extraContext, false);
            boolean notFound = isNotFound((String) result.get("reply"));

            // TIER 2: Web search if not found
            if (notFound) {
                String webCtx = searchWeb(query, request.getPageTitle(), request.getPageUrl());
                if (webCtx != null && !webCtx.isEmpty()) {
                    result = callWithFallback(request, webCtx, true);
                    result.put("fromWeb", true);
                }
            }

            String reply = (String) result.getOrDefault("reply", userFriendlyFallback(query));
            String sourceUrl = (String) result.getOrDefault("sourceUrl", "");
            String sourceLabel = (String) result.getOrDefault("sourceLabel", "View source");
            boolean fromWeb = (boolean) result.getOrDefault("fromWeb", false);

            List<Map<String, String>> suggestedLinks = extractSuggestedLinks(query, request.getImportantPages());

            if (sourceUrl.isEmpty() && !suggestedLinks.isEmpty()) {
                sourceUrl = suggestedLinks.get(0).getOrDefault("href", "");
                sourceLabel = suggestedLinks.get(0).getOrDefault("text", "View on website");
            }

            Response resp = new Response(reply, sourceUrl);
            resp.setSourceUrl(sourceUrl);
            resp.setSourceLabel(sourceLabel);
            resp.setFromWeb(fromWeb);
            resp.setSuggestedLinks(suggestedLinks);
            return resp;

        } catch (Exception e) {
            e.printStackTrace();
            // Never show technical errors to user
            Response resp = new Response(userFriendlyFallback(request.getQuery()), "");
            resp.setSuggestedLinks(new ArrayList<>());
            return resp;
        }
    }

    // ============================================================
    // SMART API ROTATION — tries all APIs, never gives up
    // ============================================================
    private Map<String, Object> callWithFallback(ChatRequest request, String extra, boolean webMode) {
        // Try each API in order, skipping ones on cooldown
        for (int attempt = 0; attempt < API_CHAIN.size() * 2; attempt++) {
            int idx = (currentApiIndex + attempt) % API_CHAIN.size();
            ApiConfig api = API_CHAIN.get(idx);

            // Skip placeholder keys
            if (api.key.startsWith("YOUR_") || api.key.trim().isEmpty())
                continue;

            // Skip if on cooldown
            Long cooldownUntil = cooldowns.get(idx);
            if (cooldownUntil != null && System.currentTimeMillis() < cooldownUntil)
                continue;

            try {
                String prompt = webMode
                        ? buildWebPrompt(request, extra)
                        : buildPagePrompt(request, extra);

                Map<String, Object> result = doCall(api, buildMessages(request, prompt));
                String reply = (String) result.get("reply");

                if (reply != null && !reply.isEmpty() && !reply.startsWith("API Error")) {
                    // Advance index for load distribution
                    currentApiIndex = (idx + 1) % API_CHAIN.size();
                    result.put("fromWeb", webMode);
                    return result;
                }

            } catch (Exception e) {
                String msg = e.getMessage() != null ? e.getMessage() : "";
                // Rate limit → put on 60s cooldown
                if (msg.contains("429") || msg.contains("rate") || msg.contains("quota")) {
                    cooldowns.put(idx, System.currentTimeMillis() + 60_000);
                    System.out.println("⚠ Rate limit on API " + idx + " (" + api.provider + ") — cooling down 60s");
                }
                // Auth error → put on longer cooldown
                else if (msg.contains("401") || msg.contains("403")) {
                    cooldowns.put(idx, System.currentTimeMillis() + 300_000);
                    System.out.println("⚠ Auth failed on API " + idx + " — cooling down 5min");
                } else {
                    System.out.println("⚠ API " + idx + " error: " + msg);
                }
            }
        }

        // All APIs exhausted — return empty to trigger web search or fallback
        Map<String, Object> empty = new HashMap<>();
        empty.put("reply", "");
        empty.put("sourceUrl", "");
        empty.put("sourceLabel", "");
        empty.put("fromWeb", false);
        return empty;
    }

    // ============================================================
    // STRONG SYSTEM PROMPT — page content mode
    // ============================================================
    private String buildPagePrompt(ChatRequest request, String extra) {
        StringBuilder p = new StringBuilder();
        p.append("You are Cavanal AI, an expert AI assistant that works on ANY website.\n\n");
        p.append("YOUR TASK: Answer the user question precisely using ONLY the website content provided below.\n\n");
        p.append("CRITICAL RULES:\n");
        p.append("1. READ ALL content carefully — search for the answer in every section.\n");
        p.append(
                "2. !! ACCURACY WARNING !! NEVER use your training data for facts like dates, fees, names, schedules.\n");
        p.append("   ONLY use what is EXPLICITLY written in the website content below.\n");
        p.append("   If the content says 2026, answer 2026. If it says 2025, answer 2025. Do NOT guess.\n");
        p.append("3. Be SPECIFIC: extract exact names, dates, fees, phone numbers, emails, addresses.\n");
        p.append("4. For ANY website type:\n");
        p.append("   - Education: courses, fees, eligibility, admission, faculty, exam schedule, results\n");
        p.append("   - E-commerce: products, prices, features, availability\n");
        p.append("   - Corporate/SaaS: services, pricing, team, features\n");
        p.append("   - Healthcare: doctors, departments, appointments\n");
        p.append("   - Government: schemes, officials, deadlines, procedures\n");
        p.append("5. Give COMPLETE answer (4-8 sentences). Never say 'check the website'.\n");
        p.append("6. FORMATTING — clean markdown (will be rendered as HTML):\n");
        p.append("   - ### for section headings\n");
        p.append("   - **bold** for ALL dates, deadlines, fees, important names\n");
        p.append("   - Use bullet points - item for lists\n");
        p.append("   - Tables for structured data (use | col | col | format)\n");
        p.append("7. SOURCE URL: Find the [URL: ...] tag in the content nearest to your answer.\n");
        p.append("   Use THAT exact URL as the source. Do not use the homepage URL for sub-page content.\n");
        p.append("   End response with:\n");
        p.append("   SOURCE: <exact_url_from_nearest_URL_tag>\n");
        p.append("   LABEL: <short descriptive page name>\n");
        p.append("8. If truly not found, output exactly: NOT_FOUND\n\n");

        // Context
        String context = request.getPageContext();
        if (context != null && !context.isEmpty()) {
            // Smart truncation — keep most relevant parts
            if (context.length() > 20000) {
                context = smartTruncate(context, request.getQuery(), 20000);
            }
            p.append("=== COMPLETE WEBSITE CONTENT ===\n").append(context);
        } else if (request.getContent() != null) {
            p.append("=== WEBSITE CONTENT ===\n");
            request.getContent().stream().limit(50).forEach(item -> {
                String text = item.get("text");
                String link = item.get("link");
                if (text != null) {
                    p.append(text);
                    if (link != null && !link.isEmpty())
                        p.append(" [URL: ").append(link).append("]");
                    p.append("\n");
                }
            });
        }

        if (extra != null && !extra.isEmpty()) {
            p.append("\n").append(extra);
        }

        p.append("\n=== END OF CONTENT ===\n");
        return p.toString();
    }

    // ============================================================
    // STRONG SYSTEM PROMPT — web search mode
    // ============================================================
    private String buildWebPrompt(ChatRequest request, String webContext) {
        StringBuilder p = new StringBuilder();
        p.append("You are Cavanal AI, a smart AI assistant.\n\n");
        p.append("The answer was NOT found on the website pages. Use the web search results below.\n\n");
        p.append("RULES:\n");
        p.append("1. Use ONLY facts from the web search results. Do NOT use your training knowledge.\n");
        p.append("2. Use the MOST RECENT information from search results — prefer 2025/2026 data over older.\n");
        p.append("3. Be SPECIFIC: dates, fees, names, schedules — use exact values from search results.\n");
        p.append("4. FORMATTING — clean markdown:\n");
        p.append("   - ### for section headings\n");
        p.append("   - **bold** ALL dates, amounts, important terms\n");
        p.append("   - Use bullet points for lists\n");
        p.append("5. Be confident — give a complete, useful answer.\n");
        p.append("6. State this is from web search.\n");
        p.append("7. End with:\n");
        p.append("   SOURCE: <most_relevant_url_from_search_results>\n");
        p.append("   LABEL: <source page name>\n\n");

        p.append(webContext).append("\n");

        // Add page context as reference
        String ctx = request.getPageContext();
        if (ctx != null && ctx.length() > 0) {
            p.append("\n=== WEBSITE CONTEXT (reference) ===\n");
            p.append(ctx.length() > 5000 ? ctx.substring(0, 5000) : ctx);
        }

        p.append("\n=== END ===\n");
        return p.toString();
    }

    // ============================================================
    // SMART TRUNCATION — keep query-relevant sections
    // ============================================================
    private String smartTruncate(String context, String query, int maxLen) {
        if (context.length() <= maxLen)
            return context;

        String qLower = query != null ? query.toLowerCase() : "";
        String[] queryWords = qLower.split("\\s+");

        // Split context into sections
        String[] sections = context.split("\n---");
        List<ScoredSection> scored = new ArrayList<>();

        for (String section : sections) {
            int score = 0;
            String sLower = section.toLowerCase();
            for (String word : queryWords) {
                if (word.length() > 3)
                    score += countOccurrences(sLower, word);
            }
            scored.add(new ScoredSection(section, score));
        }

        // Sort by relevance
        scored.sort((a, b) -> Integer.compare(b.score, a.score));

        // Rebuild with most relevant sections first
        StringBuilder result = new StringBuilder();
        for (ScoredSection ss : scored) {
            if (result.length() + ss.text.length() > maxLen)
                break;
            result.append(ss.text).append("\n---");
        }

        return result.toString();
    }

    private int countOccurrences(String text, String word) {
        int count = 0, idx = 0;
        while ((idx = text.indexOf(word, idx)) != -1) {
            count++;
            idx++;
        }
        return count;
    }

    static class ScoredSection {
        String text;
        int score;

        ScoredSection(String t, int s) {
            text = t;
            score = s;
        }
    }

    // ============================================================
    // BUILD MESSAGES LIST
    // ============================================================
    private List<Map<String, String>> buildMessages(ChatRequest request, String systemPrompt) {
        List<Map<String, String>> messages = new ArrayList<>();

        Map<String, String> sys = new HashMap<>();
        sys.put("role", "system");
        sys.put("content", systemPrompt);
        messages.add(sys);

        if (request.getConversationHistory() != null) {
            for (Map<String, String> turn : request.getConversationHistory()) {
                Map<String, String> h = new HashMap<>();
                h.put("role", "assistant".equals(turn.get("role")) ? "assistant" : "user");
                h.put("content", turn.get("content"));
                messages.add(h);
            }
        }

        Map<String, String> userMsg = new HashMap<>();
        userMsg.put("role", "user");
        userMsg.put("content", request.getQuery() != null ? request.getQuery() : "");
        messages.add(userMsg);

        return messages;
    }

    // ============================================================
    // CORE HTTP CALL TO AI API
    // ============================================================
    private Map<String, Object> doCall(ApiConfig api, List<Map<String, String>> messages) throws Exception {
        Map<String, Object> body = new HashMap<>();
        body.put("model", api.model);
        body.put("messages", messages);
        body.put("temperature", 0.15); // very low = factual and specific
        body.put("max_tokens", 800);

        String json = mapper.writeValueAsString(body);

        URL url = new URL(api.url);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("POST");
        conn.setRequestProperty("Authorization", "Bearer " + api.key);
        conn.setRequestProperty("Content-Type", "application/json");
        conn.setRequestProperty("HTTP-Referer", "http://localhost:8080");
        conn.setRequestProperty("X-Title", "AVA Assistant");
        conn.setDoOutput(true);
        conn.setConnectTimeout(25000);
        conn.setReadTimeout(25000);

        try (OutputStream os = conn.getOutputStream()) {
            os.write(json.getBytes("utf-8"));
        }

        int status = conn.getResponseCode();
        if (status == 429)
            throw new RuntimeException("429 rate limit");
        if (status == 401 || status == 403)
            throw new RuntimeException(status + " auth error");

        InputStream is = status >= 200 && status < 300 ? conn.getInputStream() : conn.getErrorStream();
        StringBuilder sb = new StringBuilder();
        try (BufferedReader br = new BufferedReader(new InputStreamReader(is, "utf-8"))) {
            String line;
            while ((line = br.readLine()) != null)
                sb.append(line.trim());
        }

        return parseResponse(sb.toString());
    }

    // ============================================================
    // PARSE AI RESPONSE
    // ============================================================
    private Map<String, Object> parseResponse(String body) throws Exception {
        Map<String, Object> result = new HashMap<>();
        JsonNode root = mapper.readTree(body);

        if (root.has("error")) {
            String msg = root.path("error").path("message").asText();
            if (msg.contains("quota") || msg.contains("rate") || msg.contains("429")) {
                throw new RuntimeException("429 " + msg);
            }
            result.put("reply", "");
            result.put("sourceUrl", "");
            result.put("sourceLabel", "");
            return result;
        }

        String fullText = "";
        JsonNode choices = root.path("choices");
        if (choices.isArray() && choices.size() > 0) {
            fullText = choices.get(0).path("message").path("content").asText("").trim();
        }

        if (fullText.isEmpty() || "NOT_FOUND".equals(fullText.trim())) {
            result.put("reply", "");
            result.put("sourceUrl", "");
            result.put("sourceLabel", "");
            return result;
        }

        // Extract SOURCE and LABEL from AI response
        String reply = fullText, sourceUrl = "", sourceLabel = "View source";
        String[] lines = fullText.split("\n");
        StringBuilder rb = new StringBuilder();

        for (String line : lines) {
            String t = line.trim();
            if (t.startsWith("SOURCE:")) {
                sourceUrl = t.substring(7).trim().replaceAll("[\s.]+$", "");
            } else if (t.startsWith("LABEL:")) {
                sourceLabel = t.substring(6).trim();
            } else if (!t.equals("NOT_FOUND")) {
                if (rb.length() > 0)
                    rb.append("\n");
                rb.append(line);
            }
        }

        reply = rb.toString().trim();

        // Validate URL
        if (!sourceUrl.startsWith("http") || !sourceUrl.contains(".")) {
            sourceUrl = "";
        }

        // Fallback: extract URL from inline [URL:...] tags in reply
        if (sourceUrl.isEmpty() && reply.contains("[URL:")) {
            java.util.regex.Matcher m = java.util.regex.Pattern
                    .compile("\\[URL:(https?://[^\\]]+)\\]")
                    .matcher(reply);
            if (m.find()) {
                sourceUrl = m.group(1).trim();
            }
        }

        // Clean [URL:...] tags from the final reply text
        reply = reply.replaceAll("\\s*\\[URL:[^\\]]+\\]", "").trim();

        result.put("reply", reply);
        result.put("sourceUrl", sourceUrl);
        result.put("sourceLabel", sourceLabel);
        return result;
    }

    // ============================================================
    // NOT FOUND DETECTION
    // ============================================================
    private boolean isNotFound(String reply) {
        if (reply == null || reply.isEmpty())
            return true;
        if ("NOT_FOUND".equals(reply.trim()))
            return true;
        String lower = reply.toLowerCase();
        // Only trigger web search if AI explicitly says it couldn't find it
        // Don't trigger if AI gave a real answer (even if it mentions limitations)
        if (lower.length() > 200)
            return false; // Long answer = found something
        return (lower.contains("not found") && lower.length() < 100) ||
                (lower.contains("couldn't find") && lower.length() < 100) ||
                (lower.contains("no information") && lower.length() < 100) ||
                lower.equals("not_found");
    }

    // ============================================================
    // QUERY TYPE DETECTION
    // ============================================================
    private boolean isPersonQuery(String query) {
        if (query == null)
            return false;
        String q = query.toLowerCase();
        return q.contains("professor") || q.contains("prof.") || q.contains("dr.") ||
                q.contains("doctor") || q.contains("faculty") || q.contains("teacher") ||
                q.contains("who is") || q.contains("tell me about") ||
                countCapitalizedWords(query) >= 2;
    }

    private boolean isDeepQuery(String query) {
        // Universal deep queries — require sub-page crawl for any website type
        if (query == null)
            return false;
        String q = query.toLowerCase();
        return
        // Dates / deadlines (all sites)
        q.contains("deadline") || q.contains("last date") || q.contains("when") || q.contains("date") ||
        // Pricing / fees (e-commerce, SaaS, education)
                q.contains("price") || q.contains("cost") || q.contains("fee") || q.contains("how much")
                || q.contains("plan") || q.contains("subscription") ||
                // Eligibility / criteria (education, jobs, government)
                q.contains("eligibility") || q.contains("criteria") || q.contains("requirement")
                || q.contains("qualification") || q.contains("cutoff") ||
                // Education specific
                q.contains("jee") || q.contains("neet") || q.contains("cuet") || q.contains("entrance")
                || q.contains("scholarship") || q.contains("hostel") || q.contains("placement")
                || q.contains("syllabus") || q.contains("nirf") || q.contains("naac") ||
                // Specifications / details (e-commerce, SaaS)
                q.contains("specification") || q.contains("feature") || q.contains("compare")
                || q.contains("difference") || q.contains("vs") ||
                // Application / registration (any site)
                q.contains("application") || q.contains("apply") || q.contains("register") || q.contains("enroll")
                || q.contains("admission") ||
                // Jobs / careers
                q.contains("vacancy") || q.contains("opening") || q.contains("hiring") || q.contains("internship") ||
                // Results / reports (education, e-commerce, gov)
                q.contains("result") || q.contains("report") || q.contains("rank") || q.contains("stat");
    }

    private int countCapitalizedWords(String text) {
        int count = 0;
        String[] words = text.split("\\s+");
        for (int i = 1; i < words.length; i++) {
            String w = words[i].replaceAll("[^a-zA-Z]", "");
            if (!w.isEmpty() && Character.isUpperCase(w.charAt(0)) && w.length() > 2)
                count++;
        }
        return count;
    }

    private String buildPersonSearchHint(String query, String pageUrl) {
        return "\n=== PERSON SEARCH HINT ===\n" +
                "The user is asking about a specific person. " +
                "Search ALL faculty, staff, department, and about sections carefully. " +
                "Look for their name, designation, department, qualifications, and contact.\n";
    }

    private String buildDeepQueryHint(String query) {
        return "\n=== DEEP QUERY HINT ===\n" +
                "This query requires specific details (dates, numbers, criteria). " +
                "Look carefully in admission, notification, notice, and news sections. " +
                "Extract EXACT dates, eligibility criteria, application processes, and portal names.\n";
    }

    // ============================================================
    // WEB SEARCH
    // ============================================================
    private String searchWeb(String query, String siteTitle, String siteUrl) {
        try {
            String domain = "";
            try {
                domain = new URL(siteUrl).getHost();
            } catch (Exception ignored) {
            }

            // Try site-specific first, then general
            String siteQuery = (!domain.isEmpty() ? "site:" + domain + " " : siteTitle + " ") + query;
            String generalQuery = siteTitle + " " + query + " 2025 2026";

            String result = !BRAVE_KEY.isEmpty()
                    ? searchBrave(siteQuery)
                    : searchDuckDuckGo(siteQuery);

            if (result == null || result.length() < 100) {
                result = searchDuckDuckGo(generalQuery);
            }

            return result;
        } catch (Exception e) {
            return null;
        }
    }

    private String searchDuckDuckGo(String query) throws Exception {
        String encoded = URLEncoder.encode(query, "UTF-8");
        String url = "https://api.duckduckgo.com/?q=" + encoded
                + "&format=json&no_redirect=1&no_html=1&skip_disambig=1";

        String response = httpGet(url);
        if (response == null)
            return null;

        JsonNode root = mapper.readTree(response);
        StringBuilder result = new StringBuilder("=== WEB SEARCH: " + query + " ===\n\n");

        String abs = root.path("Abstract").asText("");
        String absUrl = root.path("AbstractURL").asText("");
        if (!abs.isEmpty()) {
            result.append("ANSWER: ").append(abs).append("\n");
            if (!absUrl.isEmpty())
                result.append("SOURCE_URL: ").append(absUrl).append("\n\n");
        }

        String answer = root.path("Answer").asText("");
        if (!answer.isEmpty())
            result.append("DIRECT: ").append(answer).append("\n\n");

        JsonNode topics = root.path("RelatedTopics");
        if (topics.isArray()) {
            int count = 0;
            for (JsonNode t : topics) {
                String text = t.path("Text").asText("");
                String tUrl = t.path("FirstURL").asText("");
                if (!text.isEmpty()) {
                    result.append("- ").append(text);
                    if (!tUrl.isEmpty())
                        result.append(" [URL:").append(tUrl).append("]");
                    result.append("\n");
                    if (++count >= 8)
                        break;
                }
            }
        }

        return result.length() > 80 ? result.toString() : null;
    }

    private String searchBrave(String query) throws Exception {
        String encoded = URLEncoder.encode(query, "UTF-8");
        URL apiUrl = new URL("https://api.search.brave.com/res/v1/web/search?q=" + encoded + "&count=8");
        HttpURLConnection conn = (HttpURLConnection) apiUrl.openConnection();
        conn.setRequestMethod("GET");
        conn.setRequestProperty("Accept", "application/json");
        conn.setRequestProperty("X-Subscription-Token", BRAVE_KEY);
        conn.setConnectTimeout(8000);
        conn.setReadTimeout(8000);
        if (conn.getResponseCode() != 200)
            return null;
        StringBuilder sb = new StringBuilder();
        try (BufferedReader br = new BufferedReader(new InputStreamReader(conn.getInputStream(), "utf-8"))) {
            String line;
            while ((line = br.readLine()) != null)
                sb.append(line);
        }
        JsonNode root = mapper.readTree(sb.toString());
        JsonNode results = root.path("web").path("results");
        StringBuilder result = new StringBuilder("=== WEB SEARCH ===\n");
        if (results.isArray()) {
            int count = 0;
            for (JsonNode r : results) {
                String title = r.path("title").asText("");
                String desc = r.path("description").asText("");
                String rUrl = r.path("url").asText("");
                if (!title.isEmpty()) {
                    result.append("RESULT: ").append(title).append("\n");
                    result.append("DESC: ").append(desc).append("\n");
                    result.append("URL: ").append(rUrl).append("\n\n");
                    if (++count >= 6)
                        break;
                }
            }
        }
        return result.length() > 50 ? result.toString() : null;
    }

    // ============================================================
    // SMART LINK SUGGESTIONS
    // ============================================================
    @SuppressWarnings("unchecked")
    private List<Map<String, String>> extractSuggestedLinks(String query, Map<String, Object> importantPages) {
        List<Map<String, String>> result = new ArrayList<>();
        if (importantPages == null || query == null)
            return result;
        String q = query.toLowerCase();

        Map<String, List<String>> keyMap = new LinkedHashMap<>();
        // Universal keyword map — works for all website types
        keyMap.put("products", Arrays.asList("product", "item", "buy", "shop", "course", "program", "service",
                "solution", "plan", "package", "offer", "deal"));
        keyMap.put("pricing", Arrays.asList("price", "cost", "fee", "rate", "plan", "package", "subscription", "charge",
                "tariff", "how much", "budget", "pay"));
        keyMap.put("contact", Arrays.asList("contact", "reach", "call", "email", "phone", "whatsapp", "address",
                "helpline", "support", "enquiry", "message", "chat"));
        keyMap.put("about", Arrays.asList("about", "who", "history", "story", "mission", "vision", "founded",
                "established", "overview", "company", "brand", "us"));
        keyMap.put("team", Arrays.asList("team", "people", "staff", "faculty", "professor", "doctor", "expert",
                "employee", "founder", "ceo", "director", "author", "member"));
        keyMap.put("careers", Arrays.asList("job", "career", "hiring", "vacancy", "opening", "recruit", "work with",
                "join", "intern", "opportunity", "position", "apply", "admission", "enroll", "register"));
        keyMap.put("support", Arrays.asList("help", "support", "faq", "guide", "doc", "how to", "tutorial", "issue",
                "problem", "question", "answer", "knowledge"));
        keyMap.put("news", Arrays.asList("news", "blog", "article", "post", "update", "notice", "announcement", "press",
                "media", "event", "latest", "recent", "result", "exam", "grade", "score", "merit"));
        keyMap.put("gallery", Arrays.asList("gallery", "photo", "image", "video", "portfolio", "project", "work",
                "showcase", "demo", "example", "case study"));
        keyMap.put("login", Arrays.asList("login", "signin", "register", "signup", "account", "dashboard", "portal",
                "member", "my account", "samarth", "student", "employee"));

        for (Map.Entry<String, List<String>> entry : keyMap.entrySet()) {
            boolean matches = entry.getValue().stream().anyMatch(q::contains);
            if (matches && importantPages.containsKey(entry.getKey())) {
                Object val = importantPages.get(entry.getKey());
                if (val instanceof Map) {
                    Map<String, String> page = (Map<String, String>) val;
                    if (page.containsKey("href")) {
                        result.add(page);
                        if (result.size() >= 3)
                            break;
                    }
                }
            }
        }
        return result;
    }

    // ============================================================
    // USER FRIENDLY FALLBACK (never shows technical errors)
    // ============================================================
    private String userFriendlyFallback(String query) {
        if (query == null)
            return "I couldn't find that. Please try rephrasing your question.";
        String q = query.toLowerCase();
        // Universal fallback messages based on query type
        if (q.contains("price") || q.contains("cost") || q.contains("fee") || q.contains("how much"))
            return "I couldn't find exact pricing details on this page. Please check the Pricing or Plans section, or contact the website directly.";
        if (q.contains("contact") || q.contains("email") || q.contains("phone") || q.contains("address"))
            return "I couldn't find contact details on this page. Please look for the Contact or About page on the website.";
        if (q.contains("job") || q.contains("career") || q.contains("hire") || q.contains("vacancy")
                || q.contains("admission") || q.contains("apply"))
            return "I couldn't find application details on this page. Please check the Careers, Apply, or Admissions section.";
        if (q.contains("product") || q.contains("service") || q.contains("course") || q.contains("plan"))
            return "I couldn't find specific details about that. Please browse the Products, Services, or Courses section for more information.";
        return "I couldn't find complete information about this on the website right now. Please visit the relevant section using the links below, or try rephrasing your question.";
    }

    // ============================================================
    // HTTP GET
    // ============================================================
    private String httpGet(String url) {
        try {
            URL u = new URL(url);
            HttpURLConnection conn = (HttpURLConnection) u.openConnection();
            conn.setRequestMethod("GET");
            conn.setRequestProperty("User-Agent", "Mozilla/5.0");
            conn.setConnectTimeout(8000);
            conn.setReadTimeout(8000);
            if (conn.getResponseCode() != 200)
                return null;
            StringBuilder sb = new StringBuilder();
            try (BufferedReader br = new BufferedReader(new InputStreamReader(conn.getInputStream(), "utf-8"))) {
                String line;
                while ((line = br.readLine()) != null)
                    sb.append(line);
            }
            return sb.toString();
        } catch (Exception e) {
            return null;
        }
    }

    public String fallbackMsg() {
        return "I couldn't find that information. Please try visiting the relevant section directly.";
    }

    // ============================================================
    // INNER CLASS: API Config
    // ============================================================
    static class ApiConfig {
        String key, model, url, provider;

        ApiConfig(String key, String model, String url, String provider) {
            this.key = key;
            this.model = model;
            this.url = url;
            this.provider = provider;
        }
    }
}