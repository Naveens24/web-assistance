chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.sendMessage(tab.id, { action: "TOGGLE_CHAT" }, (response) => {
    if (chrome.runtime.lastError) {
      console.log("Error:", chrome.runtime.lastError.message);
    } else {
      console.log("Message sent successfully");
    }
  });
});