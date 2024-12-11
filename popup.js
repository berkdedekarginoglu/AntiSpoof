document.addEventListener('DOMContentLoaded', async () => {
    const canvas = document.getElementById('piechart');
    const ctx = canvas.getContext('2d');
    let barChart = null;
    let translationsCache = null;

    // Arka plan gradienti
    canvas.style.background = `linear-gradient(to bottom, #2c3e50, #4f4f4f)`;

    const addDomainButton = document.getElementById('add-domain');
    const domainInput = document.getElementById('domain-input');
    const excludedDomainsContainer = document.getElementById('excluded-domains');
    const domainInputGroup = document.getElementById('domain-input-group');
    const excludeDomainsTitle = document.querySelector('h2');
    const homeButton = document.getElementById('home-button');
    const aboutUsButton = document.getElementById('about-us-button');
    const aboutUsSection = document.getElementById('about-us-section');
    const languageButton = document.getElementById('language-button');
    const resetStatsButton = document.getElementById('reset-stats');

    // Bu fonksiyon local.json'u bir kez yükler ve hafızada saklar
    async function loadTranslationsFile() {
        if (!translationsCache) {
            const response = await fetch('local.json');
            translationsCache = await response.json();
        }
        return translationsCache;
    }

    function drawChart(results) {
        const maxVal = Math.max( results.dmarc_fail, results.dkim_fail, results.spf_fail);
        const data = {
            labels: ['DMARC Fail', 'DKIM Fail', 'SPF Fail'],
            datasets: [{
                label: 'Verification Results',
                data: [ results.dmarc_fail, results.dkim_fail, results.spf_fail],
                backgroundColor: ['#27ae60', '#c0392b', '#f39c12', '#2980b9'],
                borderColor: ['#1e8449', '#922b21', '#d68910', '#21618c'],
                borderWidth: 1
            }]
        };

        const options = {
            responsive: true,
            maintainAspectRatio: true,
            layout: {
                padding: {
                    top: 20,
                    bottom: 20,
                },
            },
            plugins: {
                legend: {
                    display: true,
                    labels: {
                        color: 'white',
                    },
                },
                title: {
                    display: true,
                    text: 'ANTI SPOOF',
                    color: 'white',
                    font: {
                        size: 16
                    }
                },
            },
            scales: {
                x: {
                    ticks: {
                        color: 'white',
                    },
                },
                y: {
                    ticks: {
                        beginAtZero: true,
                        color: 'white',
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.2)',
                    },
                    suggestedMax: maxVal * 1.1
                },
            },
        };

        if (barChart) {
            barChart.destroy();
        }

        barChart = new Chart(ctx, {
            type: 'bar',
            data: data,
            options: options,
        });
    }

    function loadResults() {
        chrome.storage.local.get('results', (data) => {
            const results = data.results || { scan: 0, success: 0, dmarc_fail: 0, dkim_fail: 0, spf_fail: 0 };
            drawChart(results);
        });

        chrome.storage.onChanged.addListener((changes) => {
            if (changes.results) {
                const updatedResults = changes.results.newValue || { scan: 0, success: 0, dmarc_fail: 0, dkim_fail: 0, spf_fail: 0 };
                drawChart(updatedResults);
            }
        });
    }

    function isValidDomain(domain) {
        // Extract domain from email if necessary
        if (domain.includes('@')) {
            domain = domain.split('@')[1];
        }

        const domainPattern = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        return domainPattern.test(domain) ? domain : null;
    }

    function addDomain() {
        let domain = domainInput.value.trim();
        if (!domain) {
            alert('Please enter a valid domain!');
            return;
        }

        domain = isValidDomain(domain);
        if (!domain) {
            alert('Please enter a valid domain!');
            return;
        }

        chrome.storage.local.get('excludedDomains', (data) => {
            const excludedDomains = data.excludedDomains || [];
            if (excludedDomains.some(d => d.domain === domain)) {
                alert('Domain is already excluded!');
                return;
            }

            excludedDomains.push({ domain, isRemovable: true });
            chrome.storage.local.set({ excludedDomains }, () => {
                domainInput.value = '';
                updateExcludedDomainsUI();
                console.log(`Domain ${domain} added successfully.`);
            });
        });
    }

    addDomainButton.addEventListener('click', addDomain);
    domainInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            addDomain();
        }
    });

    async function getUserLanguage() {
        return new Promise((resolve) => {
            chrome.storage.local.get('language', (data) => {
                resolve(data.language || 'tr');
            });
        });
    }

    async function updateExcludedDomainsUI() {
        const data = await new Promise((resolve) => {
            chrome.storage.local.get('excludedDomains', resolve);
        });
        const excludedDomains = data.excludedDomains || [];
        excludedDomainsContainer.innerHTML = '';

        const language = await getUserLanguage();
        const translations = await loadTranslationsFile();
        const texts = translations[language];

        if (excludedDomains.length === 0) {
            excludedDomainsContainer.innerHTML = `<p>${texts.no_domains_excluded || 'No domains excluded yet.'}</p>`;
            return;
        }

        excludedDomains.forEach(({ domain, isRemovable }) => {
            // Artık inline stil yok
            const domainItem = document.createElement('div');
            const domainText = document.createElement('span');
            domainText.textContent = domain;
            domainItem.appendChild(domainText);

            if (isRemovable) {
                const removeButton = document.createElement('button');
                removeButton.textContent = texts.remove;
                removeButton.addEventListener('click', () => {
                    removeExcludedDomain(domain);
                });
                domainItem.appendChild(removeButton);
            }

            excludedDomainsContainer.appendChild(domainItem);
        });
    }

    function removeExcludedDomain(domain) {
        chrome.storage.local.get('excludedDomains', (data) => {
            const excludedDomains = data.excludedDomains || [];
            const updatedDomains = excludedDomains.filter(d => d.domain !== domain);
            chrome.storage.local.set({ excludedDomains: updatedDomains }, () => {
                console.log(`Domain ${domain} removed.`);
                updateExcludedDomainsUI();
            });
        });
    }

    async function applyTranslations() {
        const language = await getUserLanguage();
        const translations = await loadTranslationsFile();
        const texts = translations[language];

        homeButton.textContent = texts.home;
        aboutUsButton.textContent = texts.about_us;
        addDomainButton.textContent = texts.add;
        excludeDomainsTitle.textContent = texts.exclude_domains;
        domainInput.placeholder = texts.enter_domain;

        document.querySelector('.team-description').textContent = texts.team_description;
        document.querySelector('.coffee-link').textContent = texts.coffee;
        document.querySelector('#about-us-section h2').textContent = texts.meet_the_team;

        // Eğer hiç domain yoksa mesaj güncelle
        const data = await new Promise((resolve) => {
            chrome.storage.local.get('excludedDomains', resolve);
        });
        const excludedDomains = data.excludedDomains || [];
        if (excludedDomains.length === 0) {
            excludedDomainsContainer.innerHTML = `<p>${texts.no_domains_excluded}</p>`;
        }

        // Domain remove butonları güncelle
        excludedDomainsContainer.querySelectorAll('button').forEach(button => {
            button.textContent = texts.remove;
        });

        languageButton.textContent = language.toUpperCase();
    }

    function showSection(sectionToShow, sectionToHide) {
        sectionToShow.classList.remove('hidden');
        sectionToHide.classList.add('hidden');
    }

    homeButton.addEventListener('click', () => {
        showSection(excludedDomainsContainer, aboutUsSection);
        domainInputGroup.classList.remove('hidden');
        excludeDomainsTitle.classList.remove('hidden');
    });

    aboutUsButton.addEventListener('click', () => {
        if (!aboutUsSection.classList.contains('hidden')) {
            showSection(excludedDomainsContainer, aboutUsSection);
            domainInputGroup.classList.remove('hidden');
            excludeDomainsTitle.classList.remove('hidden');
        } else {
            showSection(aboutUsSection, excludedDomainsContainer);
            domainInputGroup.classList.add('hidden');
            excludeDomainsTitle.classList.add('hidden');
        }
    });

    languageButton.addEventListener('click', async () => {
        const language = await getUserLanguage();
        const newLanguage = language === 'tr' ? 'en' : 'tr';
        chrome.storage.local.set({ language: newLanguage }, async () => {
            await applyTranslations();
            console.log(`Language set to ${newLanguage.toUpperCase()}`);
        });
    });

    resetStatsButton.addEventListener('click', () => {
        chrome.storage.local.set({
            results: {
                scan: 0,
                success: 0,
                dmarc_fail: 0,
                dkim_fail: 0,
                spf_fail: 0
            }
        }, () => {
            loadResults();
            console.log('Statistics reset successfully.');
        });
    });

    // İlk yüklemeler
    loadResults();
    await updateExcludedDomainsUI();
    await applyTranslations();
});