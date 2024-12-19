let cachedExcludedDomains = null;
let cachedLanguage = null;
let cachedTranslations = null;
let cachedCheckedMessages = null;

// Şu an görüntülenen mesajın kimliği
let currentMessageId = null;

// Helper functions for storage (to use async/await)
function storageGet(keys) {
    return new Promise(resolve => {
        chrome.storage.local.get(keys, resolve);
    });
}
function storageSet(items) {
    return new Promise(resolve => {
        chrome.storage.local.set(items, resolve);
    });
}

// Load translations once
async function loadTranslations() {
    if (!cachedTranslations) {
        const response = await fetch(chrome.runtime.getURL('local.json'));
        if (!response.ok) throw new Error(`Error fetching translations: ${response.statusText}`);
        cachedTranslations = await response.json();
    }
    return cachedTranslations;
}

// Get user language from cache or storage
async function getUserLanguage() {
    const data = await storageGet('language');
    return data.language || 'tr';
}

// Load excluded domains if not cached
async function loadExcludedDomains() {
    if (cachedExcludedDomains !== null) return cachedExcludedDomains;
    const data = await storageGet('excludedDomains');
    if (data.excludedDomains) {
        cachedExcludedDomains = data.excludedDomains;
        return cachedExcludedDomains;
    } else {
        // If not found in storage, load default from excluded_domains.json
        const response = await fetch(chrome.runtime.getURL('excluded_domains.json'));
        const jsonData = await response.json();
        const excludedDomains = jsonData.domains.map(domain => ({ domain, isRemovable: false }));
        await storageSet({ excludedDomains });
        cachedExcludedDomains = excludedDomains;
        return cachedExcludedDomains;
    }
}

async function initializeStorage() {
    const data = await storageGet(['results', 'checkedMessages', 'excludedDomains', 'language']);
    if (!data.results) {
        await storageSet({
            results: {
                scan: 0,
                success: 0,
                dmarc_fail: 0,
                dkim_fail: 0,
                spf_fail: 0
            }
        });
    }

    if (!data.checkedMessages) {
        await storageSet({ checkedMessages: {} });
    }

    await loadExcludedDomains();
}

initializeStorage();

// Check if message was previously checked
async function isMessageChecked(messageId) {
    if (cachedCheckedMessages === null) {
        const data = await storageGet('checkedMessages');
        cachedCheckedMessages = data.checkedMessages || {};
    }
    return !!cachedCheckedMessages[messageId];
}

// Check if domain is excluded (use cachedExcludedDomains)
async function isDomainExcluded(domain) {
    const excludedDomains = await loadExcludedDomains();
    return excludedDomains.some(d => d.domain === domain);
}

async function saveMessageResult(messageId, result) {
    const data = await storageGet('checkedMessages');
    const messages = data.checkedMessages || {};
    messages[messageId] = {
        result: result,
        createdAt: Date.now()
    };
    await storageSet({ checkedMessages: messages });
    cachedCheckedMessages = messages;
}

async function updateResults(result) {
    const data = await storageGet('results');
    const results = data.results || {
        scan: 0,
        success: 0,
        dmarc_fail: 0,
        dkim_fail: 0,
        spf_fail: 0
    };

    results.scan += 1;
    if (result.spf === "PASS" && result.dmarc === "PASS" && result.dkim === "PASS") {
        results.success += 1;
    } else {
        if (result.spf === "FAIL" || result.spf === "MISSING") results.spf_fail += 1;
        if (result.dmarc === "FAIL" || result.dmarc === "MISSING") results.dmarc_fail += 1;
        if (result.dkim === "FAIL" || result.dkim === "MISSING") results.dkim_fail += 1;
    }

    await storageSet({ results });
}

function getUserIndexFromUrl() {
    const url = window.location.href;
    const userIndexMatch = url.match(/mail\/u\/(\d+)\//);
    return userIndexMatch ? userIndexMatch[1] : null;
}

async function checkMessageId() {
    const messageIdElement = document.querySelector('div[data-message-id]');
    const ikElement = document.querySelector('link[data-recorded-src]');
    const senderElement = document.querySelector('span.gD[email][name][data-hovercard-id]');

    if (messageIdElement && ikElement && senderElement) {
        let messageId = messageIdElement.getAttribute('data-message-id');
        messageId = messageId.replace('#', '');

        // Eğer hali hazırda currentMessageId bu mesajı gösteriyorsa tekrar işleme
        if (currentMessageId === messageId) {
            return; // Aynı mesaj tekrar işlenmesin
        }

        currentMessageId = messageId;

        const senderEmail = senderElement.getAttribute('email');
        const senderDomain = senderEmail.split('@')[1];

        const isExcluded = await isDomainExcluded(senderDomain);
        if (isExcluded) return;

        const recordedSrc = ikElement.getAttribute('data-recorded-src');
        const ikMatch = recordedSrc.match(/token=%5B%22cftp%22,%22([a-zA-Z0-9]+)%22/);
        let ikValue = ikMatch ? ikMatch[1] : null;

        const userIndex = getUserIndexFromUrl();
        if (!ikValue || !userIndex) return;

        const exists = await isMessageChecked(messageId);
        if (exists) {
            restoreSubject(messageId);
        } else {
            getScanResult(messageId, ikValue, userIndex);
        }
    }
}

function getScanResult(messageId, ikValue, userIndex) {
    const requestUrl = `https://mail.google.com/mail/u/${userIndex}/?ik=${ikValue}&view=om&permmsgid=${messageId}`;
    fetch(requestUrl)
        .then(response => response.text())
        .then(data => {
            checkEmailAuthentication(data, messageId);
        })
        .catch(() => {});
}

async function renderSpamWarning(result, subjectElement) {
    const language = await getUserLanguage();
    const translations = await loadTranslations();
    const { message, className, iconUrl, gradientColor } = getMessage(result, language, translations);

    if(!message) return;

    const existingBadgeContainer = subjectElement.previousElementSibling;
    if (existingBadgeContainer) existingBadgeContainer.remove();

    const badgeContainer = document.createElement('div');
    badgeContainer.style.cssText = `
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 8px;
        padding: 12px 20px;
        border-radius: 8px;
        font-family: Arial, sans-serif;
        position: relative;
        width: fit-content;
        max-width: 100%;
        box-sizing: border-box;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2);
    `;

    badgeContainer.classList.add('animated-gradient', className);
    badgeContainer.style.setProperty('--dynamic-gradient', gradientColor);

    const messageBox = document.createElement('div');
    messageBox.style.cssText = `
        display: flex;
        align-items: center;
        gap: 10px;
        color: #FFFFFF;
        font-size: 16px;
        font-weight: bold;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    `;

    const icon = document.createElement('img');
    icon.src = iconUrl;
    icon.alt = "Icon";
    icon.style.cssText = `
        width: 24px;
        height: 24px;
        object-fit: contain;
    `;

    const messageText = document.createElement('span');
    messageText.textContent = message;
    messageText.style.cssText = `
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    `;

    messageBox.appendChild(icon);
    messageBox.appendChild(messageText);
    badgeContainer.appendChild(messageBox);

    subjectElement.parentElement.insertBefore(badgeContainer, subjectElement);
}

function getMessage(result, language, translations) {
    let message = "";
    let className = "";
    let gradientColor = "";
    let iconUrl = "";

    if (result.spf === "PASS" && result.dmarc === "PASS" && result.dkim === "PASS") {
        /*
        message = translations[language].reliable;
        className = "gradient-reliable";
        gradientColor = "linear-gradient(45deg, #A3E635, #6DCB20, #45B200, #6DCB20, #A3E635)";
        iconUrl = chrome.runtime.getURL("img/verified.png");
         */
        message = false
    } else if (result.dkim === "FAIL") {
        message = translations[language].dangerous;
        className = "gradient-dangerous";
        gradientColor = "linear-gradient(45deg, #FF4500, #DC143C, #B22222, #DC143C, #FF4500)";
        iconUrl = chrome.runtime.getURL("img/block.png");
    } else if (result.dkim === "MISSING") {
        message = translations[language].suspicious;
        className = "gradient-suspicious";
        gradientColor = "linear-gradient(45deg, #FF4500, #DC143C, #B22222, #DC143C, #FF4500)";
        iconUrl = chrome.runtime.getURL("img/caution.png");
    } else if (result.dmarc === "MISSING" || result.dmarc === "FAIL") {
        message = translations[language].partially_reliable;
        className = "gradient-partially-reliable";
        gradientColor = "linear-gradient(45deg, #FFA500, #FF8C00, #CC7000, #FF8C00, #FFA500)";
        iconUrl = chrome.runtime.getURL("img/yellowShield.png");
    } else {
        message = translations[language].unverified;
        className = "gradient-unverified";
        gradientColor = "linear-gradient(45deg, #333333, #555555, #777777, #000000)";
        iconUrl = chrome.runtime.getURL("img/unknown.png");
    }

    return { message, className, iconUrl, gradientColor };
}

async function checkEmailAuthentication(responseData, messageId) {
    const subjectElements = document.querySelectorAll('[data-thread-perm-id]');
    if (subjectElements.length === 0) return;

    const subjectElement = subjectElements[0];

    const result = {
        spf: responseData.includes("spf=pass") ? "PASS" : (responseData.match(/spf=(pass|fail)/i) ? "FAIL" : "MISSING"),
        dmarc: responseData.includes("dmarc=pass") ? "PASS" : (responseData.match(/dmarc=(pass|fail)/i) ? "FAIL" : "MISSING"),
        dkim: responseData.includes("dkim=pass") ? "PASS" : (responseData.match(/dkim=(pass|fail)/i) ? "FAIL" : "MISSING")
    };

    await renderSpamWarning(result, subjectElement);
    await saveMessageResult(messageId, result);
    await updateResults(result);
}

async function restoreSubject(messageId) {
    if (cachedCheckedMessages === null) {
        const data = await storageGet('checkedMessages');
        cachedCheckedMessages = data.checkedMessages || {};
    }

    const result = cachedCheckedMessages[messageId]?.result;
    if (!result) return;

    const subjectElements = document.querySelectorAll('[data-thread-perm-id]');
    if (subjectElements.length === 0) return;

    const subjectElement = subjectElements[0];
    await renderSpamWarning(result, subjectElement);
}

const urlPattern = /#(inbox|search|spam|trash|starred)\//;

function observeUrlChanges() {
    let lastUrl = window.location.href;
    const observer = new MutationObserver(() => {
        const currentUrl = window.location.href;
        if (currentUrl !== lastUrl) {
            lastUrl = currentUrl;
            if (urlPattern.test(currentUrl)) {
                const parts = currentUrl.split('#');
                if (parts[1]) {
                    const subParts = parts[1].split('/');
                    const base64Code = subParts[1];
                    if (base64Code) {
                        checkMessageId();
                    }
                }
            }
        }
    });

    observer.observe(document, { subtree: true, childList: true });
}

function observeDomChanges() {
    const targetNode = document.body;
    const config = { attributes: true, childList: true, subtree: true };
    const callback = () => {
        // DOM değiştiğinde tekrar kontrol et
        if (urlPattern.test(window.location.href)) {
            checkMessageId();
        }
    };
    const domObserver = new MutationObserver(callback);
    domObserver.observe(targetNode, config);

    // İlk yüklemede de dene
    if (urlPattern.test(window.location.href)) {
        checkMessageId();
    }
}

async function cleanupOldMessages() {
    const ONE_DAY = 24 * 60 * 60 * 1000; // 24 hours
    const now = Date.now();

    const data = await storageGet('checkedMessages');
    const messages = data.checkedMessages || {};
    const updatedMessages = {};

    for (const [messageId, messageData] of Object.entries(messages)) {
        if (now - messageData.createdAt < ONE_DAY) {
            updatedMessages[messageId] = messageData;
        }
    }

    await storageSet({ checkedMessages: updatedMessages });
    cachedCheckedMessages = updatedMessages;
}

window.addEventListener('load', () => {
    observeUrlChanges();
    observeDomChanges();
    setInterval(() => {
        try {
            cleanupOldMessages();
        } catch (error) {
            console.info("Extension context invalidated. Cleanup skipped.");
        }
    }, 1800000); // 30 minutes
});