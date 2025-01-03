
function initializeStorage() {
    // Initialize results object if not present
    chrome.storage.local.get(['results', 'checkedMessages', 'excludedDomains'], (data) => {
        if (!data.results) {
            chrome.storage.local.set({
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
            chrome.storage.local.set({
                checkedMessages: {}
            });
        }
        if (!data.excludedDomains) {
            chrome.storage.local.set({ excludedDomains: [] });
        }
    });
}

initializeStorage();


function isMessageChecked(messageId) {
    return new Promise((resolve) => {
        chrome.storage.local.get('checkedMessages', (data) => {
            const messages = data.checkedMessages || {};
            resolve(!!messages[messageId]);
        });
    });
}

function isDomainExcluded(domain) {
    return new Promise((resolve) => {
        chrome.storage.local.get('excludedDomains', (data) => {
            const domains = data.excludedDomains || [];
            resolve(domains.includes(domain));
        });
    });
}

function saveMessageResult(messageId, result) {
    chrome.storage.local.get('checkedMessages', (data) => {
        const messages = data.checkedMessages || {};
        messages[messageId] = {
            result: result,
            createdAt: Date.now()
        };
        chrome.storage.local.set({ checkedMessages: messages });
    });
}

function updateResults(result) {
    chrome.storage.local.get('results', (data) => {
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
            if (result.spf === "FAIL") results.spf_fail += 1;
            if (result.dmarc === "FAIL") results.dmarc_fail += 1;
            if (result.dkim === "FAIL") results.dkim_fail += 1;
        }

        chrome.storage.local.set({ results });
    });
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
        let senderDomain = senderElement.getAttribute('email').split('@')[1]

        const isDomainExist = await isDomainExcluded(senderDomain);

        if (isDomainExist) {
            return;
        }

        let messageId = messageIdElement.getAttribute('data-message-id');
        messageId = messageId.replace('#', '');

        const recordedSrc = ikElement.getAttribute('data-recorded-src');
        const ikMatch = recordedSrc.match(/token=%5B%22cftp%22,%22([a-zA-Z0-9]+)%22/);
        let ikValue = ikMatch ? ikMatch[1] : null;

        const userIndex = getUserIndexFromUrl();

        if (!ikValue || !userIndex) {
            return;
        }

        const isMessageExist = await isMessageChecked(messageId);
        if (isMessageExist) {
            restoreSubject(messageId);} 
        else{
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

function getUserLanguage() {
    return navigator.language || navigator.userLanguage || "TR"; // Default to "TR" if language is not available
}

function renderSpamWarning(result, subjectElement, language) {
    // Remove previous badges
    const existingBadgeContainer = subjectElement.previousElementSibling;
    if (existingBadgeContainer) {
        existingBadgeContainer.remove();
    }

    // Badge Container
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
        width: fit-content; /* Dinamik genişlik */
        max-width: 100%; /* Ebeveyn genişliği aşılmasın */
        box-sizing: border-box;
        animation: gradient-flow 6s ease infinite; /* Hareketli gradient */
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2);
    `;

    // Determine message, color, and icon based on result
    const assessment = generatePastelMessage(result, language);
    const { message, color, iconUrl, textColor } = assessment;

    // Inject animation styles dynamically
    const styleElement = document.createElement("style");
    styleElement.textContent = `
        @keyframes gradient-flow {
            0% {
                background-position: 0% 50%;
            }
            50% {
                background-position: 100% 50%;
            }
            100% {
                background-position: 0% 50%;
            }
        }

        .animated-gradient {
            background: ${color};
            background-size: 300% 300%;
        }
    `;
    document.head.appendChild(styleElement);

    // Configure the animated badge
    badgeContainer.classList.add('animated-gradient');

    // Create message box
    const messageBox = document.createElement('div');
    messageBox.style.cssText = `
        display: flex;
        align-items: center;
        gap: 10px;
        color: ${textColor};
        font-size: 16px; /* Daha belirgin yazı boyutu */
        font-weight: bold;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    `;

    // Add icon
    const icon = document.createElement('img');
    icon.src = iconUrl;
    icon.alt = "Icon";
    icon.style.cssText = `
        width: 24px;
        height: 24px;
        object-fit: contain;
    `;

    // Add text
    const messageText = document.createElement('span');
    messageText.textContent = message;
    messageText.style.cssText = `
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    `;

    // Append elements
    messageBox.appendChild(icon);
    messageBox.appendChild(messageText);
    badgeContainer.appendChild(messageBox);

    // Insert badge container
    subjectElement.parentElement.insertBefore(badgeContainer, subjectElement);
}

function generatePastelMessage(result, language) {
    let message = "";
    let color = "";
    const textColor = "#FFFFFF"; // Beyaz metin
    let iconUrl = "";

    if (result.spf === "PASS" && result.dmarc === "PASS" && result.dkim === "PASS") {
        message = language === "TR"
            ? "Bu gönderici güvenilir olarak değerlendirilmiştir."
            : "This sender has been classified as reliable.";
        color = "linear-gradient(45deg, #A3E635, #6DCB20, #45B200, #6DCB20, #A3E635)";
        iconUrl = chrome.runtime.getURL("img/verified.png");
    } else if (result.spf === "FAIL" && result.dkim === "FAIL" && result.dmarc === "FAIL") {
        message = language === "TR"
            ? "Bu gönderici tehlikeli olarak işaretlenmiştir. Kimlik doğrulama tamamen başarısız olmuştur."
            : "This sender has been flagged as dangerous. Identity verification has completely failed.";
        color = "linear-gradient(45deg, #FF4500, #DC143C, #B22222, #DC143C, #FF4500)";
        iconUrl = chrome.runtime.getURL("img/block.png");
    } else if (result.spf === "MISSING" && result.dkim === "MISSING" && result.dmarc === "MISSING") {
        message = language === "TR"
            ? "Bu göndericinin kimliği doğrulanamamıştır. Eksik veya hatalı bilgiler tespit edilmiştir."
            : "The sender's identity could not be verified. Missing or incorrect information detected.";
        color = "linear-gradient(45deg, #333333, #555555, #777777, #000000)";
        iconUrl = chrome.runtime.getURL("img/unknown.png");
    } else if (result.dmarc === "FAIL" || (result.spf === "FAIL" && result.dkim === "FAIL")) {
        message = language === "TR"
            ? "Bu gönderici güvenilir değildir. Kimlik doğrulama süreçleri başarısız olmuştur."
            : "This sender is not reliable. Identity verification checks have failed.";
        color = "linear-gradient(45deg, #FFA500, #FF8C00, #CC7000, #FF8C00, #FFA500)";
        iconUrl = chrome.runtime.getURL("img/yellowShield.png");
    } else if (result.spf === "PASS" || result.dkim === "PASS" || result.dmarc === "PASS") {
        message = language === "TR"
            ? "Bu gönderici kısmen güvenilir olarak değerlendirilmiştir."
            : "This sender has been classified as partially reliable.";
        color = "linear-gradient(45deg, #FFA500, #FF8C00, #CC7000, #FF8C00, #FFA500)";
        iconUrl = chrome.runtime.getURL("img/yellowShield.png");
    } else {
        message = language === "TR"
            ? "Bu gönderici güvenilirlik açısından şüpheli olarak değerlendirilmiştir."
            : "This sender has been classified as suspicious in terms of reliability.";
        color = "linear-gradient(45deg, #FF4500, #DC143C, #B22222, #DC143C, #FF4500)";
        iconUrl = chrome.runtime.getURL("img/caution.png");
    }

    return { message, color, iconUrl, textColor };
}


function checkEmailAuthentication(responseData, messageId) {
    const language = getUserLanguage();
    const subjectElements = document.querySelectorAll('[data-thread-perm-id]');
    if (subjectElements.length === 0) {
        return;
    }

    const subjectElement = subjectElements[0];

    // Kimlik doğrulama sonuçları
    const result = {
        spf: responseData.match(/spf=(pass|fail)/i)
            ? responseData.includes("spf=pass")
                ? "PASS"
                : "FAIL"
            : "MISSING",
        dmarc: responseData.match(/dmarc=(pass|fail)/i)
            ? responseData.includes("dmarc=pass")
                ? "PASS"
                : "FAIL"
            : "MISSING",
        dkim: responseData.match(/dkim=(pass|fail)/i)
            ? responseData.includes("dkim=pass")
                ? "PASS"
                : "FAIL"
            : "MISSING",
    };

    // Spam uyarısını render et
    renderSpamWarning(result, subjectElement, language);

    // Mesaj sonuçlarını kaydet
    saveMessageResult(messageId, result);
    updateResults(result);
}

function restoreSubject(messageId) {
    chrome.storage.local.get('checkedMessages', (data) => {
        const messages = data.checkedMessages || {};
        const result = messages[messageId]?.result;

        if (!result) {
            return;
        }

        const subjectElements = document.querySelectorAll('[data-thread-perm-id]');
        if (subjectElements.length === 0) {
            return;
        }

        const subjectElement = subjectElements[0];

        // Uyarıyı render et
        renderSpamWarning(result, subjectElement);
    });
}



const urlPattern = /#(inbox|search|spam|trash|starred)\//;

function observeUrlChanges() {
    let lastUrl = window.location.href;

    const observer = new MutationObserver(() => {
        const currentUrl = window.location.href;
        if (currentUrl !== lastUrl) {
            lastUrl = currentUrl;
            if (urlPattern.test(currentUrl)) {
                const base64Code = currentUrl.split('#')[1].split('/')[1];
                if (base64Code) {
                    checkMessageId();
                }
            }
        }
    });

    observer.observe(document, { subtree: true, childList: true });
}

window.addEventListener('load', () => {
    observeUrlChanges();
});
