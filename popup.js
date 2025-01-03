document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('piechart');
    const ctx = canvas.getContext('2d');
    let barChart = null;

    // Arka plan gradienti
    canvas.style.background = `linear-gradient(to bottom, #2c3e50, #4f4f4f)`;

    function drawChart(results) {
        const data = {
            labels: ['Success', 'DMARC Fail', 'DKIM Fail', 'SPF Fail'],
            datasets: [{
                label: 'Verification Results',
                data: [results.success, results.dmarc_fail, results.dkim_fail, results.spf_fail],
                backgroundColor: ['#27ae60', '#c0392b', '#f39c12', '#2980b9'], // Colors
                borderColor: ['#1e8449', '#922b21', '#d68910', '#21618c'], // Border colors
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
                    text: 'Anti Spoof',
                    color: 'white',
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
                    suggestedMax: Math.max(results.success, results.dmarc_fail, results.dkim_fail, results.spf_fail) * 1.1 // Set max value to 110% of the highest count
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

    // Excluded domains functionality
    const addDomainButton = document.getElementById('add-domain');
    const domainInput = document.getElementById('domain-input');
    const excludedDomainsContainer = document.getElementById('excluded-domains');

    function addDomain() {
        let domain = domainInput.value.trim();
        if (!domain) {
            alert('Please enter a valid domain!');
            return;
        }

        // Extract domain from email if necessary
        if (domain.includes('@')) {
            domain = domain.split('@')[1];
        }

        // Validate domain format
        const domainPattern = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!domainPattern.test(domain)) {
            alert('Please enter a valid domain!');
            return;
        }

        chrome.storage.local.get('excludedDomains', (data) => {
            const excludedDomains = data.excludedDomains || [];
            if (excludedDomains.includes(domain)) {
                alert('Domain is already excluded!');
                return;
            }

            excludedDomains.push(domain);
            chrome.storage.local.set({ excludedDomains }, () => {
                domainInput.value = ''; // Clear the input
                updateExcludedDomainsUI(); // Refresh the UI
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

    function updateExcludedDomainsUI() {
        chrome.storage.local.get('excludedDomains', (data) => {
            const excludedDomains = data.excludedDomains || [];
            excludedDomainsContainer.innerHTML = '';

            if (excludedDomains.length === 0) {
                excludedDomainsContainer.innerHTML = '<p>No domains excluded yet.</p>';
                return;
            }

            excludedDomains.forEach(domain => {
                const domainItem = document.createElement('div');
                domainItem.style.display = 'flex';
                domainItem.style.justifyContent = 'space-between';
                domainItem.style.alignItems = 'center';
                domainItem.style.marginBottom = '5px';
                domainItem.style.padding = '5px';
                domainItem.style.border = '1px solid #555';
                domainItem.style.borderRadius = '4px';
                domainItem.style.backgroundColor = '#2f3b4a';
                domainItem.style.color = '#ddd';

                const domainText = document.createElement('span');
                domainText.textContent = domain;

                const removeButton = document.createElement('button');
                removeButton.textContent = 'Remove';
                removeButton.style.backgroundColor = '#e74c3c';
                removeButton.style.color = '#fff';
                removeButton.style.border = 'none';
                removeButton.style.borderRadius = '4px';
                removeButton.style.padding = '4px 8px';
                removeButton.style.cursor = 'pointer';

                removeButton.addEventListener('click', () => {
                    removeExcludedDomain(domain);
                });

                domainItem.appendChild(domainText);
                domainItem.appendChild(removeButton);
                excludedDomainsContainer.appendChild(domainItem);
            });
        });
    }

    function removeExcludedDomain(domain) {
        chrome.storage.local.get('excludedDomains', (data) => {
            const excludedDomains = data.excludedDomains || [];
            const updatedDomains = excludedDomains.filter(d => d !== domain);
            chrome.storage.local.set({ excludedDomains: updatedDomains }, () => {
                console.log(`Domain ${domain} removed.`);
                updateExcludedDomainsUI();
            });
        });
    }

    // Initial load of results and excluded domains
    loadResults();
    updateExcludedDomainsUI();
});