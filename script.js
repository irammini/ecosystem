// --- APP STATE ---
const appState = {
    lang: 'vi',
    currentFilter: 'all',
    activeTab: 'overview',
    activeTheme: 'aurora',
    charts: {},
    searchTerm: '' // added: current search term (lowercase)
};

// --- CORE LOGIC ---
document.addEventListener('DOMContentLoaded', () => {
    initApp();
    setupEventListeners();
});

function initApp() {
    initLangAndTheme();
    updateUI();
}

function updateUI() {
    applyTheme(appState.activeTheme);
    setLanguage(appState.lang, true); // Pass true for initial load to prevent double render
    renderFilters();
    filterAndRenderCards();
    updateActiveTab();
}

function initLangAndTheme() {
    appState.lang = localStorage.getItem('lang') || 'vi';
    appState.currentFilter = localStorage.getItem('filter') || 'all';
    appState.activeTab = localStorage.getItem('activeTab') || 'overview';
    appState.activeTheme = localStorage.getItem('theme') || 'aurora';
}

function getTranslation(key) {
    return (translations[appState.lang] && translations[appState.lang][key]) 
        || (translations['en'] && translations['en'][key]) 
        || key;
}

/**
 * Sets the application language and updates the UI.
 * @param {string} lang - The language code (e.g., 'vi', 'en').
 * @param {boolean} [isInitialLoad=false] - Flag to prevent re-rendering cards on initial load.
 */
function setLanguage(lang, isInitialLoad = false) {
    appState.lang = lang;
    localStorage.setItem('lang', lang);
    document.documentElement.lang = lang;

    // Translate all static elements with data-translate-key attribute
    document.querySelectorAll('[data-translate-key]').forEach(el => {
        const key = el.dataset.translateKey;
        const translation = getTranslation(key);
         if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
            el.placeholder = translation;
        } else {
            el.innerHTML = translation;
        }
    });
    
    // Specifically update the timeline link text
    const timelineText = document.querySelector('.timeline-text');
    if (timelineText) {
        timelineText.textContent = getTranslation('timeline_link');
    }
    
    // Update search input placeholder
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.placeholder = getTranslation('search_placeholder');
    }
    
    // Re-render the language switcher to show the active state
    renderLangSwitcher();

    // *** FIX: On language change (not initial load), re-render dynamic content ***
    if (!isInitialLoad) {
        renderFilters(); // Re-translate filter buttons
        filterAndRenderCards(); // Re-translate and render bot cards
        if (appState.activeTab === 'updates') {
            renderUpdatesTimeline(); // Re-translate timeline content
        }
    }
}

function renderLangSwitcher() {
    const switcher = document.getElementById('lang-switcher');
    if (!switcher) return;
    const langs = [
        { key: 'vi', flag: '🇻🇳' }, 
        { key: 'en', flag: '🇬🇧' }, 
        { key: 'fr', flag: '🇫🇷' },
        { key: 'ru', flag: '🇷🇺' },
        { key: 'es', flag: '🇪🇸' }, 
        { key: 'ja', flag: '🇯🇵' }
    ];
    switcher.innerHTML = langs.map(lang => `
        <button data-lang="${lang.key}" class="lang-btn px-2.5 py-1 rounded-full text-base transition-colors duration-200 ${appState.lang === lang.key ? 'bg-indigo-600 text-white' : 'hover:bg-slate-700'}">
            ${lang.flag}
        </button>
    `).join('');
    
    switcher.querySelectorAll('.lang-btn').forEach(button => {
        button.addEventListener('click', e => {
            const newLang = e.currentTarget.dataset.lang;
            setLanguage(newLang);
        });
    });
}

function getStatusInfo(status) {
    const statusClasses = {
        stable: 'bg-green-500',
        dev: 'bg-amber-500',
        planned: 'bg-slate-500',
        joke: 'bg-purple-500'
    };
    return {
        key: status.key,
        class: statusClasses[status.key] || 'bg-gray-500',
        text: getTranslation(`filter_${status.key}`)
    };
}

function renderFilters() {
    const filtersContainer = document.getElementById('filters');
    if (!filtersContainer) return;
    const uniqueTechs = [...new Set(botsData.map(b => b.tech.lang))];
    const filterKeys = ['all', 'stable', 'dev', 'planned', 'joke', ...uniqueTechs];
    
    filtersContainer.innerHTML = filterKeys.map(key => {
        const text = ['all', 'stable', 'dev', 'planned', 'joke'].includes(key) ? getTranslation(`filter_${key}`) : key;
        const isActive = appState.currentFilter === key;
        return `<button data-filter="${key}" class="filter-btn px-4 py-1.5 rounded-full text-sm font-semibold transition-colors duration-200 border ${isActive ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-[var(--bg-secondary)] border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'}">${text}</button>`;
    }).join('');
}

function filterAndRenderCards() {
    const filter = appState.currentFilter;
    let filteredBots;
    if (filter === 'all') {
        filteredBots = botsData;
    } else if (['stable', 'dev', 'planned', 'joke'].includes(filter)) {
        filteredBots = botsData.filter(bot => bot.status.key === filter);
    } else {
        filteredBots = botsData.filter(bot => bot.tech.lang === filter);
    }
    renderBotCards(filteredBots);
}

function escapeHtml(str = '') {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Helper: escape for RegExp
function escapeRegExp(s = '') {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Highlight occurrences of term in plain text safely, return HTML
function highlightText(text = '', term = '') {
    if (!term) return escapeHtml(text);
    const raw = String(text);
    const re = new RegExp(escapeRegExp(term), 'gi');
    let result = '';
    let lastIndex = 0;
    let match;
    while ((match = re.exec(raw)) !== null) {
        result += escapeHtml(raw.slice(lastIndex, match.index));
        result += `<mark class="search-highlight">${escapeHtml(match[0])}</mark>`;
        lastIndex = re.lastIndex;
        // prevent infinite loops for zero-length matches
        if (re.lastIndex === match.index) re.lastIndex++;
    }
    result += escapeHtml(raw.slice(lastIndex));
    return result;
}

// Replace renderBotCards to inject highlighted HTML and language icons where appropriate
function renderBotCards(bots) {
    const grid = document.getElementById('bot-grid');
    if (!grid) return;
    grid.innerHTML = '';
    bots.forEach((bot, index) => {
        const statusInfo = getStatusInfo(bot.status);
        const card = document.createElement('div');
        card.className = `bot-card card-glow-effect glass-effect rounded-2xl overflow-hidden`;
        card.dataset.id = bot.id;
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        
        let ramDisplay = typeof bot.config.ram === 'number' ? `${bot.config.ram} MB` : bot.config.ram || 'N/A';
        if (typeof bot.config.ram === 'number' && bot.config.ram >= 1024) {
            ramDisplay = `${(bot.config.ram / 1024).toFixed(1).replace('.0', '')} GB`;
        }
        
        const term = appState.searchTerm || '';
        const nameHtml = highlightText(bot.name, term);
        const libHtml = highlightText(bot.tech.lib || '', term);
        const langHtml = highlightText(bot.tech.lang || '', term);
        const roleFull = getTranslation(bot.translation_keys.role) || '';
        const roleHtml = highlightText(roleFull, term);

        // Build language icon HTML
        let techIconHtml = '';
        const lang = (bot.tech.lang || '').toLowerCase();
        if (lang.includes('python')) {
            techIconHtml = `<img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg" alt="Python" class="tech-icon">`;
        } else if (lang.includes('javascript')) {
            techIconHtml = `<img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/javascript/javascript-original.svg" alt="JavaScript" class="tech-icon">`;
        } else if (lang.includes('java')) {
            techIconHtml = `<img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/java/java-original.svg" alt="Java" class="tech-icon">`;
        } else if (lang.includes('rust')) {    
            techIconHtml = `<img src="https://ik.imagekit.io/irammini/rust-original.svg?updatedAt=1756023206076" alt="Rust" class="tech-icon">`;
        } else if (lang.includes('lua')) {
            techIconHtml = `<img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/lua/lua-plain.svg" alt="Lua" class="tech-icon">`;
        } else if (lang.includes('bun')) {
            techIconHtml = `<img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/bun/bun-original.svg" alt="Bun" class="tech-icon">`;
        } else if (lang === 'scnx') {
            techIconHtml = `🤖`;
        } else if (lang === 'kite') {
            techIconHtml = `🪁`;
        }

        card.innerHTML = `
            <div class="card-content p-5 flex flex-col h-full">
                <div class="flex-grow">
                    <div class="flex items-center mb-4">
                        <div class="w-12 h-12 rounded-full ${bot.isMain ? 'bg-indigo-600' : 'bg-slate-700'} flex items-center justify-center mr-4 flex-shrink-0">
                            <span class="text-xl font-bold text-white">${escapeHtml(bot.name.charAt(0))}</span>
                        </div>
                        <div class="min-w-0">
                            <h3 class="text-lg font-bold text-[var(--text-primary)]">${nameHtml}</h3>
                            <p class="text-sm text-[var(--text-secondary)] single-line-ellipsis">${libHtml}</p>
                        </div>
                    </div>
                    <p class="text-sm text-[var(--text-secondary)] mb-4 role-preview">${roleHtml}</p>
                    <div class="flex items-center justify-between text-xs text-[var(--text-secondary)] mb-4">
                        <div class="flex items-center gap-2 px-2 py-1 bg-black/20 rounded-full">
                            <span class="w-2 h-2 rounded-full ${statusInfo.class}"></span>
                            <span>${statusInfo.text}</span>
                        </div>
                        <span class="font-mono bg-black/20 px-2 py-1 rounded-full flex items-center gap-1">
                            ${techIconHtml}${langHtml === highlightText(bot.tech.lang, '') ? escapeHtml(bot.tech.lang) : langHtml}
                        </span>
                    </div>
                    <div class="flex justify-around text-center text-xs bg-black/10 p-2 rounded-lg border border-[var(--border-color)]">
                        <div class="flex items-center gap-2"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-[var(--text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg><div><div class="font-bold text-[var(--text-primary)]">${escapeHtml(ramDisplay)}</div><div class="text-[var(--text-secondary)]">${getTranslation('card_ram')}</div></div></div>
                        <div class="flex items-center gap-2"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-[var(--text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M12 6V3m0 18v-3M5.636 5.636l-1.414-1.414M19.778 19.778l-1.414-1.414M18.364 5.636l-1.414 1.414M4.222 19.778l1.414-1.414M12 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg><div><div class="font-bold text-[var(--text-primary)]">${escapeHtml(bot.config.cpu || 'N/A')}</div><div class="text-[var(--text-secondary)]">${getTranslation('card_cpu')}</div></div></div>
                        <div class="flex items-center gap-2"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-[var(--text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m1 5a9 9 0 01-18 0" /></svg><div><div class="font-bold text-[var(--text-primary)]">${escapeHtml(bot.config.disk || 'N/A')}</div><div class="text-[var(--text-secondary)]">${getTranslation('card_disk')}</div></div></div>
                    </div>
                </div>
                <button data-id="${bot.id}" class="view-details-btn mt-5 w-full bg-indigo-600 text-white font-semibold py-2 rounded-lg hover:bg-indigo-700 transition duration-200">${getTranslation('view_details')}</button>
            </div>
        `;
        grid.appendChild(card);
        setTimeout(() => {
            card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, 75 * index);
    });
}

function renderCharts() {
    if (typeof Chart === 'undefined') return;
    Object.values(appState.charts).forEach(chart => chart.destroy());
    
    const gridColor = 'rgba(150, 150, 150, 0.1)';
    const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim();
    const tooltipBg = getComputedStyle(document.documentElement).getPropertyValue('--bg-primary').trim();
    const tooltipTitle = getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim();
    const tooltipBody = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim();
    
    const ramCtx = document.getElementById('ramChart')?.getContext('2d');
    if (!ramCtx) return;
    const ramChartData = botsData.filter(b => typeof b.config.ram === 'number').sort((a, b) => b.config.ram - a.config.ram);
    appState.charts.ram = new Chart(ramCtx, {
        type: 'bar',
        data: { 
            labels: ramChartData.map(b => b.name), 
            datasets: [{ 
                label: 'RAM (MB)', 
                data: ramChartData.map(b => b.config.ram), 
                backgroundColor: 'rgba(99, 102, 241, 0.7)', 
                borderColor: 'rgba(99, 102, 241, 1)', 
                borderWidth: 1, 
                borderRadius: 4 
            }] 
        },
        options: { 
            responsive: true, maintainAspectRatio: false, indexAxis: 'y', 
            scales: { 
                x: { type: 'logarithmic', grid: { color: gridColor, drawOnChartArea: false }, ticks: { color: textColor, maxTicksLimit: 8 } }, 
                y: { ticks: { autoSkip: false, font: { size: 10 }, color: textColor }, grid: { color: gridColor } } 
            }, 
            plugins: { 
                legend: { display: false }, 
                tooltip: { backgroundColor: tooltipBg, titleColor: tooltipTitle, bodyColor: tooltipBody, callbacks: { label: (context) => ` ${context.raw} MB` } } 
            } 
        }
    });

    const langCtx = document.getElementById('langChart')?.getContext('2d');
    if (!langCtx) return;
    const langCounts = botsData.reduce((acc, bot) => { acc[bot.tech.lang] = (acc[bot.tech.lang] || 0) + 1; return acc; }, {});
    appState.charts.lang = new Chart(langCtx, {
        type: 'doughnut',
        data: { 
            labels: Object.keys(langCounts), 
            datasets: [{ 
                data: Object.values(langCounts), 
                backgroundColor: ['#6366f1', '#f59e0b', '#ef4444', '#22c55e', '#a855f7', '#8b5cf6', '#ec4899', '#6b7280'], 
                borderColor: getComputedStyle(document.documentElement).getPropertyValue('--bg-secondary').trim(),
                borderWidth: 4 
            }] 
        },
        options: { 
            responsive: true, maintainAspectRatio: false, 
            plugins: { 
                legend: { position: 'bottom', labels: { color: textColor, boxWidth: 12, padding: 20 } },
                tooltip: {
                    backgroundColor: tooltipBg, titleColor: tooltipTitle, bodyColor: tooltipBody,
                    callbacks: {
                        label: function(context) {
                            const langName = context.label || '';
                            const count = context.parsed || 0;
                            const botString = count === 1 ? getTranslation('chart_bot_singular') : getTranslation('chart_bot_plural');
                            return `${langName}: ${count} ${botString}`;
                        }
                    }
                }
            } 
        }
    });
}

function setupEventListeners() {
    const filters = document.getElementById('filters');
    if (filters) {
        filters.addEventListener('click', (e) => {
            const button = e.target.closest('button.filter-btn');
            if (button) {
                appState.currentFilter = button.dataset.filter;
                localStorage.setItem('filter', appState.currentFilter); // persist filter
                renderFilters();
                filterAndRenderCards();
            }
        });
    }

    const botGrid = document.getElementById('bot-grid');
    if (botGrid) {
        botGrid.addEventListener('click', e => {
            const button = e.target.closest('.view-details-btn');
            if (button) {
                showBotModal(button.dataset.id);
            }
        });
        
        botGrid.addEventListener('mousemove', e => {
            const card = e.target.closest('.card-glow-effect');
            if (card) {
                const rect = card.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                card.style.setProperty('--mouse-x', `${x}px`);
                card.style.setProperty('--mouse-y', `${y}px`);
            }
        });
    }

    document.getElementById('modal-close')?.addEventListener('click', hideAllModals);
    
    document.getElementById('irammini-link')?.addEventListener('click', (e) => {
        e.preventDefault();
        showDevInfoModal();
    });

    document.getElementById('tab-overview')?.addEventListener('click', () => switchTab('overview'));
    document.getElementById('tab-updates')?.addEventListener('click', () => switchTab('updates'));

    document.getElementById('settings-btn')?.addEventListener('click', showSettingsModal);
    document.getElementById('settings-modal-close')?.addEventListener('click', hideAllModals);
    
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const theme = btn.dataset.theme;
            appState.activeTheme = theme;
            localStorage.setItem('theme', theme);
            applyTheme(theme);
        });
    });

    // Search functionality
    setupSearchFunctionality();
}

function switchTab(tabId) {
    appState.activeTab = tabId;
    localStorage.setItem('activeTab', tabId);
    updateActiveTab();
}

function updateActiveTab() {
    const tabs = ['overview', 'updates'];
    tabs.forEach(tab => {
        const tabButton = document.getElementById(`tab-${tab}`);
        const tabContent = document.getElementById(`content-${tab}`);
        if (!tabButton || !tabContent) return;

        const isActive = appState.activeTab === tab;

        tabButton.classList.toggle('bg-indigo-600', isActive);
        tabButton.classList.toggle('text-white', isActive);
        tabButton.classList.toggle('text-[var(--text-secondary)]', !isActive);
        tabButton.classList.toggle('hover:bg-slate-800', !isActive);
        tabContent.classList.toggle('hidden', !isActive);
    });
    if (appState.activeTab === 'overview') {
        renderCharts();
    } else if (appState.activeTab === 'updates') {
        renderUpdatesTimeline();
    }
}

function showDevInfoModal() {
    const modalContent = document.getElementById('modal-content');
    if (!modalContent) return;
    modalContent.innerHTML = `
        <div class="flex items-center mb-6">
             <div class="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center mr-5 flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
            </div>
            <div>
                <h2 class="text-2xl md:text-3xl font-bold text-[var(--text-primary)]">${getTranslation('dev_modal_title')}</h2>
                <p class="text-md text-[var(--text-secondary)]">irammini</p>
            </div>
        </div>
        <div class="space-y-4 text-[var(--text-secondary)]">
            <p class="text-sm leading-relaxed bg-black/10 p-4 rounded-lg border border-[var(--border-color)]">
                ${getTranslation('dev_modal_content')}
            </p>
        </div>
    `;
    
    showModal('modal');
}


function showSettingsModal() {
    renderLangSwitcher();
    updateThemeModalSelection();
    showModal('settings-modal');
}

function renderUpdatesTimeline() {
    const timelineContainer = document.querySelector('#content-updates .timeline');
    if (!timelineContainer) return;
    timelineContainer.innerHTML = '';

    const sortedUpdates = [...updatesData].sort((a, b) => new Date(b.date) - new Date(a.date));

    sortedUpdates.forEach(update => {
        const updateElement = document.createElement('div');
        updateElement.className = 'timeline-item';

        let icon = '';
        switch (update.type) {
            case 'bot_update': icon = '🤖'; break;
            case 'new_feature': icon = '✨'; break;
            case 'new_bot': icon = '🚀'; break;
            default: icon = '📝';
        }

        updateElement.innerHTML = `
            <div class="timeline-icon">${icon}</div>
            <div class="timeline-content glass-effect">
                <div class="timeline-date">${update.date} - ${getTranslation(`update_type_${update.type}`)}</div>
                <h4 class="font-bold text-[var(--text-primary)] mb-1">${getTranslation(update.title_key)}</h4>
                <p class="text-sm text-[var(--text-secondary)]">${getTranslation(update.content_key)}</p>
            </div>
        `;
        timelineContainer.appendChild(updateElement);
    });
}

function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    // Create backdrop if missing
    let backdrop = document.getElementById('modal-backdrop');
    if (!backdrop) {
        backdrop = document.createElement('div');
        backdrop.id = 'modal-backdrop';
        Object.assign(backdrop.style, {
            position: 'fixed',
            inset: '0',
            background: 'rgba(0,0,0,0.45)',
            backdropFilter: 'blur(6px) saturate(120%)',
            WebkitBackdropFilter: 'blur(6px) saturate(120%)',
            zIndex: '60',
            opacity: '0',
            transition: 'opacity 180ms ease',
        });
        document.body.appendChild(backdrop);
        // force reflow then fade in
        void backdrop.offsetWidth;
        backdrop.style.opacity = '1';
    } else {
        backdrop.style.opacity = '1';
    }

    // Ensure modal is on top of backdrop
    Object.assign(modal.style, { display: 'block', zIndex: '70' });
    document.body.style.overflow = 'hidden';
    
    setTimeout(() => {
        modal.classList.add('fade-in');
    }, 10);
}

// --- CHANGED: hideAllModals - remove/hide backdrop smoothly ---
function hideAllModals() {
    const modals = document.querySelectorAll('.modal');
    
    modals.forEach(modal => {
        modal.classList.remove('fade-in');
        modal.classList.add('fade-out');
    });
    
    document.body.style.overflow = '';

    // fade out backdrop then remove
    const backdrop = document.getElementById('modal-backdrop');
    if (backdrop) {
        backdrop.style.opacity = '0';
    }
    
    setTimeout(() => {
        modals.forEach(modal => {
            modal.style.display = 'none';
            modal.classList.remove('fade-out');
            modal.style.zIndex = '';
        });
        if (backdrop && backdrop.parentNode) {
            backdrop.parentNode.removeChild(backdrop);
        }
    }, 300);
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    updateThemeModalSelection();
    // Re-render charts after a theme change to apply new colors
    if (appState.activeTab === 'overview') {
        setTimeout(renderCharts, 50); // Delay to allow CSS variables to update
    }
}

function updateThemeModalSelection() {
    document.querySelectorAll('.theme-btn').forEach(btn => {
        const isActive = btn.dataset.theme === appState.activeTheme;
        btn.classList.toggle('bg-indigo-600', isActive);
        btn.classList.toggle('text-white', isActive);
        btn.classList.toggle('hover:bg-[var(--bg-tertiary)]', !isActive);
        const checkIcon = btn.querySelector('.check-icon');
        if (checkIcon) {
            checkIcon.classList.toggle('hidden', !isActive);
        }
    });
}

// --- SEARCH FUNCTIONALITY ---
function setupSearchFunctionality() {
    const searchInput = document.getElementById('search-input');
    // Xóa các dòng liên quan đến searchButton và search-input-clear
    if (!searchInput) return;

    // Debounce search to improve performance
    let searchTimeout;
    const debounceSearch = (callback, delay = 300) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(callback, delay);
    };

    // Trigger search on Enter key
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSearch();
        }
    });

    // Real-time search with debouncing
    searchInput.addEventListener('input', () => {
        // Không còn nút clear trên thanh search
        debounceSearch(() => {
            if (searchInput.value.trim() !== '') {
                handleSearch();
            }
        }, 200);
    });

    // Set initial placeholder translation
    searchInput.placeholder = getTranslation('search_placeholder');
}

function handleSearch() {
    const searchInput = document.getElementById('search-input');
    if (!searchInput) return;
    const raw = searchInput.value.trim();
    const searchTermLower = raw.toLowerCase();
    appState.searchTerm = searchTermLower;

    if (searchTermLower === '') {
        // Clear search state and show filtered list
        filterAndRenderCards();
        // reset directory title
        const directoryTitle = document.querySelector('#bot-directory h2');
        if (directoryTitle) directoryTitle.innerHTML = getTranslation('directory_title');
        return;
    }

    // Perform search across all bots
    const searchResults = searchBots(searchTermLower);
    renderSearchResults(searchResults, raw);

    // Scroll to directory
    document.getElementById('bot-directory')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function searchBots(searchTerm) {
    const results = botsData.filter(bot => {
        // Search in bot name
        if (bot.name.toLowerCase().includes(searchTerm)) return true;

        // Search in programming language
        if ((bot.tech.lang || '').toLowerCase().includes(searchTerm)) return true;

        // Search in library/framework
        if ((bot.tech.lib || '').toLowerCase().includes(searchTerm)) return true;

        // Search in status
        if ((bot.status.key || '').toLowerCase().includes(searchTerm)) return true;

        // Search in translated role description
        const roleText = (getTranslation(bot.translation_keys.role) || '').toLowerCase();
        if (roleText.includes(searchTerm)) return true;

        // Search in translated history description
        const historyText = (getTranslation(bot.translation_keys.history) || '').toLowerCase();
        if (historyText.includes(searchTerm)) return true;

        return false;
    });
    return results;
}

function renderSearchResults(bots, searchTerm) {
    const grid = document.getElementById('bot-grid');
    if (!grid) return;

    // Build title with clear button
    const directoryTitle = document.querySelector('#bot-directory h2');
    const escapedTerm = escapeHtml(searchTerm);
    const clearButtonHtml = `<button id="clear-search" class="ml-3 px-2 py-0.5 text-sm rounded-full bg-slate-700 hover:bg-slate-600 transition">✖</button>`;

    if (bots.length === 0) {
        // Show no results message
        grid.innerHTML = `
            <div class="col-span-full text-center py-12">
                <div class="text-6xl mb-4">🔍</div>
                <h3 class="text-xl font-bold text-[var(--text-primary)] mb-2">${getTranslation('search_no_results')}</h3>
                <p class="text-[var(--text-secondary)]">${getTranslation('search_no_results_desc').replace('{term}', `<span class="text-indigo-400">"${escapedTerm}"</span>`)}</p>
            </div>
        `;
        // update directory title + clear button
        if (directoryTitle) directoryTitle.innerHTML = `${getTranslation('search_results')} <span class="text-indigo-400">"${escapedTerm}"</span> <span class="text-sm text-[var(--text-secondary)]">(0 ${getTranslation('search_results_plural')})</span> ${clearButtonHtml}`;
        // attach clear handler
        setTimeout(() => {
            document.getElementById('clear-search')?.addEventListener('click', () => {
                document.getElementById('search-input').value = '';
                appState.searchTerm = '';
                if (directoryTitle) directoryTitle.innerHTML = getTranslation('directory_title');
                filterAndRenderCards();
            });
        }, 20);
        return;
    }

    // Render the search results (renderBotCards will use appState.searchTerm for highlighting)
    renderBotCards(bots);

    // Update the directory title to show search results + clear button
    if (directoryTitle) {
        directoryTitle.innerHTML = `${getTranslation('search_results')} <span class="text-indigo-400">"${escapedTerm}"</span> <span class="text-sm text-[var(--text-secondary)]">(${bots.length} ${bots.length === 1 ? getTranslation('search_result') : getTranslation('search_results_plural')})</span> ${clearButtonHtml}`;
        // attach clear handler
        document.getElementById('clear-search')?.addEventListener('click', () => {
            document.getElementById('search-input').value = '';
            appState.searchTerm = '';
            directoryTitle.innerHTML = getTranslation('directory_title');
            filterAndRenderCards();
        });
    }
}

// Update filterAndRenderCards to reset search when filters are used
function filterAndRenderCards() {
    const filter = appState.currentFilter;
    let filteredBots;
    if (filter === 'all') {
        filteredBots = botsData;
    } else if (['stable', 'dev', 'planned', 'joke'].includes(filter)) {
        filteredBots = botsData.filter(bot => bot.status.key === filter);
    } else {
        filteredBots = botsData.filter(bot => bot.tech.lang === filter);
    }
    
    // Reset search input and directory title when using filters
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.value = '';
    }
    appState.searchTerm = ''; // clear search term state
    
    const directoryTitle = document.querySelector('#bot-directory h2');
    if (directoryTitle) {
        directoryTitle.innerHTML = getTranslation('directory_title');
    }
    
    renderBotCards(filteredBots);
}

// --- CHANGED: add showBotModal to render bot details in the modal (uses highlightText/getTranslation) ---
function showBotModal(botId) {
    const bot = botsData.find(b => b.id === botId);
    if (!bot) return;

    const modalContent = document.getElementById('modal-content');
    if (!modalContent) return;

    const term = appState.searchTerm || '';

    // Format RAM display
    let ramDisplay = bot.config.ram || 'N/A';
    if (typeof bot.config.ram === 'number') {
        ramDisplay = bot.config.ram >= 1024 ? `${(bot.config.ram/1024).toFixed(1).replace('.0','')} GB` : `${bot.config.ram} MB`;
    }

    // Thêm state cho việc hiển thị chi tiết
    let showDetails = false;

    function renderModalContent() {
        modalContent.innerHTML = `
            <div class="mb-4">
                <div class="flex items-center gap-4">
                    <div class="w-14 h-14 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-xl">
                        ${escapeHtml(bot.name.charAt(0))}
                    </div>
                    <div>
                        <h2 class="text-2xl font-bold text-[var(--text-primary)]">${highlightText(bot.name, term)}</h2>
                        <div class="text-sm text-[var(--text-secondary)] mt-1">${escapeHtml(bot.name)} • ${getStatusInfo(bot.status).text} • ${escapeHtml(bot.status.version || 'N/A')}</div>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div class="p-4 bg-black/5 rounded-lg border border-[var(--border-color)]">
                    <h3 class="font-semibold text-[var(--text-primary)] mb-2">${getTranslation('modal_role')}</h3>
                    <p class="text-[var(--text-secondary)]">${highlightText(getTranslation(bot.translation_keys.role), term)}</p>
                </div>
                <div class="p-4 bg-black/5 rounded-lg border border-[var(--border-color)]">
                    <h3 class="font-semibold text-[var(--text-primary)] mb-2">${getTranslation('modal_history')}</h3>
                    <p class="text-[var(--text-secondary)]">${highlightText(getTranslation(bot.translation_keys.history), term)}</p>
                </div>
            </div>

            <div class="mb-4 p-4 bg-black/5 rounded-lg border border-[var(--border-color)]">
                <h3 class="font-semibold text-[var(--text-primary)] mb-2">${getTranslation('modal_tech_specs')}</h3>
                <ul class="text-[var(--text-secondary)] space-y-1">
                    <li><strong>Lang:</strong> ${highlightText(bot.tech.lang || 'N/A', term)}</li>
                    <li><strong>Lib:</strong> ${highlightText(bot.tech.lib || 'N/A', term)}</li>
                    <li><strong>${getTranslation('modal_host')}:</strong> ${escapeHtml(bot.tech.host || 'N/A')}</li>
                    <li><strong>${getTranslation('modal_db')}:</strong> ${escapeHtml(bot.tech.db || 'N/A')}</li>
                    <li><strong>${getTranslation('card_ram')}:</strong> ${escapeHtml(ramDisplay)}</li>
                    <li><strong>${getTranslation('card_cpu')}:</strong> ${escapeHtml(bot.config.cpu || 'N/A')}</li>
                    <li><strong>${getTranslation('card_disk')}:</strong> ${escapeHtml(bot.config.disk || 'N/A')}</li>
                </ul>
                <button id="toggle-details" class="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition">
                    ${showDetails ? getTranslation('hide_technical_details') : getTranslation('view_technical_details')}
                </button>
                ${showDetails ? `
                    <div class="mt-4 pt-4 border-t border-[var(--border-color)]">
                        <h4 class="font-semibold text-[var(--text-primary)] mb-2">${getTranslation('technical_details')}:</h4>
                        <ul class="text-[var(--text-secondary)] space-y-1">
                            <li><strong>${getTranslation('uptime_kuma')}:</strong> ${renderBool(uptimeKumaMap[bot.id])}</li>
                            <li><strong>${getTranslation('repository')}:</strong> ${
                                typeof repoMap[bot.id] === 'string' && repoMap[bot.id].startsWith('http')
                                    ? `<a href="${repoMap[bot.id]}" target="_blank" class="text-cyan-400 underline">Link</a>`
                                    : (repoMap[bot.id] === false ? '<span style="color:#ef4444">✖</span>' : 
                                       repoMap[bot.id] || '<span style="color:#a3a3a3">N/A</span>')
                            }</li>
                            <li><strong>${getTranslation('custom_avatar')}:</strong> ${renderBool(avatarMap[bot.id])}</li>
                            <li><strong>${getTranslation('discord_status')}:</strong> ${renderBool(statusDiscordMap[bot.id])}</li>
                        </ul>
                    </div>
                ` : ''}
            </div>
        `;

        // Add event listener for toggle button
        document.getElementById('toggle-details')?.addEventListener('click', () => {
            showDetails = !showDetails;
            renderModalContent();
        });
    }

    renderModalContent();

    showModal('modal');
}

// Helper function for boolean rendering
function renderBool(val) {
    if (val === true) return '<span style="color:#22c55e">✔</span>';
    if (val === false) return '<span style="color:#ef4444">✖</span>';
    return '<span style="color:#a3a3a3">N/A</span>';
}

// Maps for details
const uptimeKumaMap = {
    'ramteaser': false, 'teaserlite': true, 'teaserpotato': true,
    'teaserhardcore': false, 'teaserdust': true, 'playercycle': true,
    'teasermusic': true, 'teaserdrift': true, 'teaserai': true,
    'teaserultra': true, 'teaserradish': true, 'cputeaser': true,
    'teasereclipse': 'N/A', 'teaserrebun': 'N/A', 'teaserkite': false,
    'teaserscnx': false, 'iminibot': true
};

const repoMap = {
    'iminibot': 'https://github.com/irammini/IminiBot',
    'ramteaser': 'Có (private)', 'teaserlite': 'Có (private)',
    'teaserpotato': false, 'teaserhardcore': false, 'teaserdust': false,
    'playercycle': 'Có (private)', 'teasermusic': false,
    'teaserdrift': 'Có (private)', 'teaserai': false,
    'teaserultra': 'Có (private)', 'teaserradish': 'Có (private)',
    'cputeaser': 'Có (private)', 'teasereclipse': 'N/A',
    'teaserrebun': 'N/A', 'teaserkite': false, 'teaserscnx': false
};

const avatarMap = {
    'teaserai': true,
    'teaser': true
};

const statusDiscordMap = {
    'ramteaser': true, 'teaserlite': true, 'teaserpotato': true,
    'teasermusic': true, 'cputeaser': true, 'teaserkite': true,
    'teaserscnx': true
};
