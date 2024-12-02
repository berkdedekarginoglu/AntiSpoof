let checkedMessages = {};

function checkMessageId() {
    const messageIdElement = document.querySelector('div[data-message-id]');
    const ikElement = document.querySelector('link[data-recorded-src]');

    if (messageIdElement && ikElement) {
        let messageId = messageIdElement.getAttribute('data-message-id');
        messageId = messageId.replace('#', '');

        const recordedSrc = ikElement.getAttribute('data-recorded-src');
        const ikMatch = recordedSrc.match(/token=%5B%22cftp%22,%22([a-zA-Z0-9]+)%22/);
        let ikValue = ikMatch ? ikMatch[1] : null;

        if (!ikValue) {
            return;
        }

        if (checkedMessages[messageId]) {
            restoreSubject(checkedMessages[messageId].result, messageId);
            return;
        }

        getScanResult(messageId, ikValue);
    }
}

function getScanResult(messageId, ikValue) {
    const requestUrl = `https://mail.google.com/mail/u/0/?ik=${ikValue}&view=om&permmsgid=${messageId}`;

    fetch(requestUrl)
        .then(response => response.text())
        .then(data => {
            checkEmailAuthentication(data, messageId);
        })
        .catch(() => {});
}

function checkEmailAuthentication(responseData, messageId) {
    const subjectElements = document.querySelectorAll('[data-thread-perm-id]');
    if (subjectElements.length === 0) {
        return;
    }

    const subjectElement = subjectElements[0];

    let result = {};

    const badgeContainer = document.createElement('div');
    badgeContainer.style.display = 'flex';
    badgeContainer.style.gap = '8px';
    badgeContainer.style.marginBottom = '8px';

    const badgeStyle = `
        display: inline-block;
        padding: 4px 8px;
        font-size: 12px;
        font-weight: bold;
        color: white;
        border-radius: 5px;
    `;

    if (responseData.includes("spf=pass")) {
        result.spf = "PASS";
        const spfBadge = document.createElement('span');
        spfBadge.textContent = 'SPF: PASS';
        spfBadge.style.cssText = `${badgeStyle} background-color: green;`;
        badgeContainer.appendChild(spfBadge);
    } else {
        result.spf = "FAIL";
        const spfBadge = document.createElement('span');
        spfBadge.textContent = 'SPF: FAIL';
        spfBadge.style.cssText = `${badgeStyle} background-color: red;`;
        badgeContainer.appendChild(spfBadge);
    }

    if (responseData.includes("dmarc=pass")) {
        result.dmarc = "PASS";
        const dmarcBadge = document.createElement('span');
        dmarcBadge.textContent = 'DMARC: PASS';
        dmarcBadge.style.cssText = `${badgeStyle} background-color: green;`;
        badgeContainer.appendChild(dmarcBadge);
    } else {
        result.dmarc = "FAIL";
        const dmarcBadge = document.createElement('span');
        dmarcBadge.textContent = 'DMARC: FAIL';
        dmarcBadge.style.cssText = `${badgeStyle} background-color: red;`;
        badgeContainer.appendChild(dmarcBadge);
    }

    if (responseData.includes("dkim=pass")) {
        result.dkim = "PASS";
        const dkimBadge = document.createElement('span');
        dkimBadge.textContent = 'DKIM: PASS';
        dkimBadge.style.cssText = `${badgeStyle} background-color: green;`;
        badgeContainer.appendChild(dkimBadge);
    } else {
        result.dkim = "FAIL";
        const dkimBadge = document.createElement('span');
        dkimBadge.textContent = 'DKIM: FAIL';
        dkimBadge.style.cssText = `${badgeStyle} background-color: red;`;
        badgeContainer.appendChild(dkimBadge);
    }

    subjectElement.parentElement.insertBefore(badgeContainer, subjectElement);

    checkedMessages[messageId] = {
        result: result
    };
}

function restoreSubject(result, messageId) {
    const subjectElements = document.querySelectorAll('[data-thread-perm-id]');
    if (subjectElements.length === 0) {
        return;
    }

    const subjectElement = subjectElements[0];

    const badgeContainer = subjectElement.previousElementSibling;
    if (badgeContainer) {
        badgeContainer.remove();
    }

    const newBadgeContainer = document.createElement('div');
    newBadgeContainer.style.display = 'flex';
    newBadgeContainer.style.gap = '8px';
    newBadgeContainer.style.marginBottom = '8px';

    const badgeStyle = `
        display: inline-block;
        padding: 4px 8px;
        font-size: 12px;
        font-weight: bold;
        color: white;
        border-radius: 5px;
    `;

    if (result.spf) {
        const spfBadge = document.createElement('span');
        spfBadge.textContent = `SPF: ${result.spf}`;
        spfBadge.style.cssText = `${badgeStyle} background-color: ${result.spf === 'PASS' ? 'green' : 'red'};`;
        newBadgeContainer.appendChild(spfBadge);
    }

    if (result.dmarc) {
        const dmarcBadge = document.createElement('span');
        dmarcBadge.textContent = `DMARC: ${result.dmarc}`;
        dmarcBadge.style.cssText = `${badgeStyle} background-color: ${result.dmarc === 'PASS' ? 'green' : 'red'};`;
        newBadgeContainer.appendChild(dmarcBadge);
    }

    if (result.dkim) {
        const dkimBadge = document.createElement('span');
        dkimBadge.textContent = `DKIM: ${result.dkim}`;
        dkimBadge.style.cssText = `${badgeStyle} background-color: ${result.dkim === 'PASS' ? 'green' : 'red'};`;
        newBadgeContainer.appendChild(dkimBadge);
    }

    subjectElement.parentElement.insertBefore(newBadgeContainer, subjectElement);
}

setInterval(checkMessageId, 1000);
