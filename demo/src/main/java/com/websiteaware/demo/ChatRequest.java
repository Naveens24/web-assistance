package com.websiteaware.demo; // ← unchanged

import java.util.List;
import java.util.Map;

public class ChatRequest {

    // ── EXISTING FIELDS (kept exactly as-is) ──
    private String query;
    private List<Map<String, String>> content;

    // ── NEW FIELDS (added for Gemini upgrade) ──
    private String pageContext;
    private String pageUrl;
    private String pageTitle;
    private List<Map<String, String>> conversationHistory;
    private Map<String, Object> importantPages;

    // Existing getters (unchanged)
    public String getQuery() {
        return query;
    }

    public void setQuery(String query) {
        this.query = query;
    }

    public List<Map<String, String>> getContent() {
        return content;
    }

    public void setContent(List<Map<String, String>> content) {
        this.content = content;
    }

    // New getters
    public String getPageContext() {
        return pageContext;
    }

    public void setPageContext(String pageContext) {
        this.pageContext = pageContext;
    }

    public String getPageUrl() {
        return pageUrl;
    }

    public void setPageUrl(String pageUrl) {
        this.pageUrl = pageUrl;
    }

    public String getPageTitle() {
        return pageTitle;
    }

    public void setPageTitle(String pageTitle) {
        this.pageTitle = pageTitle;
    }

    public List<Map<String, String>> getConversationHistory() {
        return conversationHistory;
    }

    public void setConversationHistory(List<Map<String, String>> h) {
        this.conversationHistory = h;
    }

    public Map<String, Object> getImportantPages() {
        return importantPages;
    }

    public void setImportantPages(Map<String, Object> importantPages) {
        this.importantPages = importantPages;
    }
}