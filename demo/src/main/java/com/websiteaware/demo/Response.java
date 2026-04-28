package com.websiteaware.demo;

import java.util.List;
import java.util.Map;

public class Response {

    // ── EXISTING FIELDS (unchanged) ──
    private String answer;
    private String link;

    // ── NEW FIELDS ──
    private String sourceUrl;
    private String sourceLabel;
    private boolean fromWeb;
    private List<Map<String, String>> suggestedLinks;

    public Response(String answer, String link) {
        this.answer = answer;
        this.link = link;
    }

    // Existing getters/setters
    public String getAnswer() {
        return answer;
    }

    public void setAnswer(String answer) {
        this.answer = answer;
    }

    public String getLink() {
        return link;
    }

    public void setLink(String link) {
        this.link = link;
    }

    // New getters/setters
    public String getSourceUrl() {
        return sourceUrl;
    }

    public void setSourceUrl(String sourceUrl) {
        this.sourceUrl = sourceUrl;
    }

    public String getSourceLabel() {
        return sourceLabel;
    }

    public void setSourceLabel(String sourceLabel) {
        this.sourceLabel = sourceLabel;
    }

    public boolean isFromWeb() {
        return fromWeb;
    }

    public void setFromWeb(boolean fromWeb) {
        this.fromWeb = fromWeb;
    }

    public List<Map<String, String>> getSuggestedLinks() {
        return suggestedLinks;
    }

    public void setSuggestedLinks(List<Map<String, String>> suggestedLinks) {
        this.suggestedLinks = suggestedLinks;
    }
}