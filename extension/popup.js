const messages = document.getElementById("messages");
const input = document.getElementById("input");
const sendBtn = document.getElementById("send");

// ✅ Display messages (with clickable links)
function addMessage(text, type) {
    let div = document.createElement("div");
    div.className = "message " + type;

    // Convert links into clickable anchor
    if (text.includes("http")) {
        div.innerHTML = text.replace(
            /(https?:\/\/[^\s]+)/g,
            '<a href="$1" target="_blank" style="color:#60a5fa;">Open Page</a>'
        );
    } else {
        div.innerText = text;
    }

    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
}

// ✅ Get content from page
async function getPageContent() {
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    return await chrome.tabs.sendMessage(tab.id, {
        type: "GET_CONTENT"
    });
}

// ONLY replace this one function in your existing popup.js:
async function getBotResponse(query, content) {
    try {
        let response = await fetch("http://localhost:8080/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                query: query,       // ← kept as-is
                content: content,   // ← kept as-is
                pageContext: "",    // ← new field (empty from popup is fine)
                conversationHistory: [],
                importantPages: {}
            })
        });

        let data = await response.json();
        // Support both old (answer) and new (reply) field
        const text = data.reply || data.answer || "No response.";
        if (data.link) return `${text}\n\n${data.link}`;
        return text;

    } catch (error) {
        return "Backend not running or connection failed.";
    }
}

// ✅ Send button click
sendBtn.addEventListener("click", async () => {
    let query = input.value.trim();
    if (!query) return;

    addMessage(query, "user");
    input.value = "";

    let content = await getPageContent();

    if (!content || content.length === 0) {
        addMessage("Please refresh the page and try again.", "bot");
        return;
    }

    let response = await getBotResponse(query, content);

    addMessage(response, "bot");
});

// ✅ Enter key support
input.addEventListener("keypress", function(e) {
    if (e.key === "Enter") {
        sendBtn.click();
    }
});

window.onload = () => {
    addMessage("Hi there!", "bot");
    addMessage("I can help you explore this website.", "bot");
};