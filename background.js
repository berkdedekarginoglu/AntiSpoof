chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "RELOAD_EXTENSION") {
        chrome.runtime.reload();
    }
});
