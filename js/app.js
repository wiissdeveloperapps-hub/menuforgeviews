const app = {
    data: null,
    currentLang: 'es',
    currentView: 'home', 
    selectedCategory: null,
    minPrice: null,
    maxPrice: null,
    currentMenuId: null,
    searchQuery: '',
    categoryTabsObserver: null,
    sourceHash: '',
    isDarkMode: false,
    cart: [],
    whatsapp: { enabled: false, phone: '', msgLang: 'es' },
    tables: [],
    selectedFilter: null,
    showFilterBar: false,
    filterOptions: [],
    orderNotes: '',
    selectedQuickNotes: [],
    dailySelections: {},
    toastTimer: null,
    confirmationCallback: null,
    selectedFilters: [],
    pendingSelectedFilters: [],
    pendingSelectedCategory: null,
    pendingMinPrice: null,
    pendingMaxPrice: null,
    
    sessionTimestamp: Date.now(),

    dom: {
        header: document.getElementById('header-container'),
        content: document.getElementById('main-content'),
        btnTheme: document.getElementById('btn-theme'),
        printContainer: document.getElementById('print-container'),
        btnBack: document.getElementById('btn-back'),
        logo: document.getElementById('restaurant-logo'),
        name: document.getElementById('restaurant-name'),
        contactIconsContainer: document.getElementById('contact-icons-container'),
        toast: document.getElementById('friendly-toast'),
        toastText: document.getElementById('toast-text'),
        langSelect: document.getElementById('language-selector'),
        currentFlag: document.getElementById('current-flag'),
        wifiActionBtn: document.getElementById('wifi-action-btn'),
        wifiModal: document.getElementById('wifi-modal'),
        wifiModalTitle: document.getElementById('wifi-modal-title'),
        wifiModalContent: document.getElementById('wifi-modal-content'),
        searchInput: document.getElementById('search-input'),
        searchControlsShell: document.getElementById('search-controls-shell'),
        categoryTabsContainer: document.getElementById('category-tabs-container'),
        categoryTabs: document.getElementById('category-tabs'),
        modal: document.getElementById('dish-modal'),
        mImgWrapper: document.getElementById('modal-img-wrapper'),
        mImg: document.getElementById('modal-img'),
        mTitle: document.getElementById('modal-title'),
        mPrice: document.getElementById('modal-price'),
        mDesc: document.getElementById('modal-desc'),
        cookieBanner: document.getElementById('cookie-banner'),
        cookieText: document.getElementById('cookie-text'),
        cookieBtn: document.getElementById('cookie-btn'),
        cartFab: document.getElementById('cart-fab'),
        cartBadge: document.getElementById('cart-badge'),
        cartModal: document.getElementById('cart-modal'),
        cartModalTitle: document.getElementById('cart-modal-title'),
        cartTotalLabel: document.getElementById('cart-total-label'),
        cartTableLabel: document.getElementById('cart-table-label'),
        cartItemsContainer: document.getElementById('cart-items-container'),
        cartTotalPrice: document.getElementById('cart-total-price'),
        tableSelector: document.getElementById('table-selector'),
        orderNotesInput: document.getElementById('order-notes-input'),
        orderNotesCounter: document.getElementById('order-notes-counter'),
        quickNotesContainer: document.getElementById('quick-notes-container'),
        orderNotesLabel: document.getElementById('order-notes-label'),
        filterBarContainer: document.getElementById('filter-bar-container'),
        filterToggleBtn: document.getElementById('filter-toggle-btn'),
        filterModal: document.getElementById('filter-modal'),
        filterModalTitle: document.getElementById('filter-modal-title'),
        filterModalOptions: document.getElementById('filter-modal-options'),
        filterApplyBtn: document.getElementById('filter-apply-btn'),
        sendOrderBtn: document.getElementById('send-order-btn'),
        confModal: document.getElementById('confirmation-modal')
    },

    async init() {
        let rawBrowserLang = navigator.language.split('-')[0].toLowerCase();
        if (rawBrowserLang === 'zh') rawBrowserLang = 'cn';
        if (rawBrowserLang === 'ar') rawBrowserLang = 'sa';
        
        const supportedLangs = Object.keys(I18N);
        this.currentLang = supportedLangs.includes(rawBrowserLang) ? rawBrowserLang : 'en';

        const tInit = I18N[this.currentLang] || I18N['es'];
        document.getElementById('restaurant-name').textContent = tInit.loading;
        const loaderInit = document.getElementById('loader');
        if (loaderInit) loaderInit.textContent = tInit.preparing;

        try {
            const hash = window.location.hash.substring(1);
            this.sourceHash = hash;
            if (!hash) throw new Error(tInit.invalidQR);

            const localCacheKey = `menuforge_data_${hash}`;
            const cachedDataStr = localStorage.getItem(localCacheKey);

            if (cachedDataStr) {
                try {
                    this.data = JSON.parse(cachedDataStr);
                    this.setupUI(); 
                    
                    this.revalidateDataInBackground(hash, localCacheKey);
                } catch (e) {
                    await this.loadFreshData(hash, localCacheKey);
                }
            } else {
                await this.loadFreshData(hash, localCacheKey);
            }

        } catch (error) {
            console.error(error);
            const tErr = I18N[this.currentLang] || I18N['es'];
            this.dom.content.innerHTML = `<div style="text-align:center; padding: 50px; color: #ef4444;"><h3>${tErr.errorTitle}</h3><p>${error.message}</p></div>`;
        }
    },

    async loadFreshData(hash, cacheKey) {
        const rawJsonData = await this.downloadData(hash);
        this.data = this.formatDataToStandard(rawJsonData);
        
        try { localStorage.setItem(cacheKey, JSON.stringify(this.data)); } catch(e) {}
        
        this.setupUI();
    },

    async revalidateDataInBackground(hash, cacheKey) {
        try {
            const freshJsonData = await this.downloadData(hash);
            const processedFreshData = this.formatDataToStandard(freshJsonData);

            const newString = JSON.stringify(processedFreshData);
            const oldString = JSON.stringify(this.data);

            if (newString !== oldString) {
                this.data = processedFreshData;
                try { localStorage.setItem(cacheKey, newString); } catch(e) {}
                
                this.updateUITexts();
                this.refreshCurrentView();
            }
        } catch (e) {
            console.warn("Fallo silencioso validando actualizaciones en segundo plano.", e);
        }
    },

    async downloadData(hash) {
        if (hash.startsWith('pako:')) {
            return this.decompressPako(hash.substring(5));
        } else if (hash.startsWith('restaurant:')) {
            const id = hash.replace('restaurant:', '');
            return await this.fetchRemote(id, 'restaurants');
        } else if (hash.startsWith('remote:')) {
            const id = hash.replace('remote:', '');
            return await this.fetchRemote(id, 'menus');
        } else {
            return await this.fetchRemote(hash, 'restaurants');
        }
    },

    formatDataToStandard(jsonData) {
        if (!jsonData.menus) {
            return {
                restaurantInfo: {
                    nombre: jsonData.nombreRestaurante || '',
                    logoBase64: jsonData.logoRestaurante || '',
                    telefono: jsonData.telefonoRestaurante,
                    direccion: jsonData.direccionRestaurante,
                    email: jsonData.emailRestaurante,
                    currency: jsonData.currency || 'EUR'
                },
                menus: [jsonData] 
            };
        }
        return jsonData;
    },

    setupUI() {
        this.dom.header.style.display = 'flex';
        const rInfo = this.data.restaurantInfo || {};
        
        if (rInfo.logoBase64) {
            this.dom.logo.src = rInfo.logoBase64;
            this.dom.logo.style.display = 'block';
        } else {
            this.dom.logo.style.display = 'none';
        }

        if (rInfo.whatsappEnabled && rInfo.whatsappPhone && rInfo.tables?.length > 0) {
            this.whatsapp.enabled = true;
            this.whatsapp.phone = rInfo.whatsappPhone;
            this.whatsapp.msgLang = rInfo.whatsappMessageLang || 'es';
            this.tables = rInfo.tables;
            this.dom.cartFab.style.display = 'flex';
        }

        const firstMenu = this.data.menus[0];
        if (firstMenu) {
            this.dom.langSelect.innerHTML = '';
            const langsToRender = new Set(Object.keys(I18N));
            if (firstMenu.traducciones) {
                Object.keys(firstMenu.traducciones).forEach(l => langsToRender.add(l));
            }

            langsToRender.forEach(lang => {
                const opt = document.createElement('option');
                opt.value = lang;
                opt.textContent = this.getCompactLanguageCode(lang);
                opt.title = firstMenu.traducciones?.[lang]?.meta?.languageName || this.getLanguageName(lang);
                this.dom.langSelect.appendChild(opt);
            });
            
            this.dom.langSelect.value = this.currentLang;
            this.updateFlag();
        }

        this.dom.langSelect.addEventListener('change', (e) => {
            this.currentLang = e.target.value;
            this.updateFlag();
            this.updateUITexts();
            this.refreshCurrentView();
        });

        this.applyThemePreference();
        this.updateUITexts();
        this.renderFilterBar();
        this.updateSearchVisibility();
        this.initCookies();
        this.navigateHome();
    },

    updateUITexts() {
        const t = I18N[this.currentLang] || I18N['es'];
        const t_wa = I18N_WHATSAPP[this.whatsapp.msgLang] || I18N_WHATSAPP['es'];
        const rInfo = this.data?.restaurantInfo || {};
        
        this.dom.searchInput.placeholder = t.search;
        this.dom.btnBack.title = t.back;
        this.dom.filterToggleBtn.title = t.filterButtonTitle || 'Filtrar platos';
        this.dom.filterToggleBtn.setAttribute('aria-label', t.filterToggleAriaLabel || t.filterButtonTitle || 'Filtrar platos');
        this.dom.filterModalTitle.textContent = t.filterButtonTitle || 'Filtrar platos';
        if (this.dom.filterApplyBtn) {
            this.dom.filterApplyBtn.textContent = t.filterApply || 'Filtrar';
        }
        
        const minInput = document.getElementById('filter-price-min');
        const maxInput = document.getElementById('filter-price-max');
        if (minInput) minInput.value = this.minPrice != null ? this.minPrice : '';
        if (maxInput) maxInput.value = this.maxPrice != null ? this.maxPrice : '';
        
        this.dom.cartModalTitle.textContent = t.cartTitle;
        this.dom.orderNotesLabel.textContent = t.notesLabel || 'Observaciones';
        this.dom.orderNotesInput.placeholder = t.notesPlaceholder || 'Añade detalles para la cocina';
        this.dom.orderNotesInput.maxLength = 140;
        this.dom.orderNotesCounter.textContent = `${this.orderNotes.length}/140`;
        this.dom.cartTotalLabel.textContent = t.cartTotal;
        this.dom.cartTableLabel.textContent = t.cartTableLabel;
        this.dom.sendOrderBtn.textContent = t_wa.orderBtn;
        this.dom.cookieText.textContent = t.cookieMsg;
        this.dom.cookieBtn.textContent = t.cookieBtn;
        
        this.dom.name.textContent = rInfo.nombre || t.defaultRestaurant;
        this.dom.langSelect.setAttribute('aria-label', t.langSelect);
        this.updateWifiButton();

        let iconsHtml = '';
        if (rInfo.telefono) {
            const cleanTel = this.escapeHTML(rInfo.telefono);
            iconsHtml += `<button class="action-icon-btn" onclick="app.triggerContactAction('tel', '${cleanTel}', '${t.toastTel}')" title="${t.btnPhone}"><svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg></button>`;
        }
        if (rInfo.email) {
            const cleanEmail = this.escapeHTML(rInfo.email);
            iconsHtml += `<button class="action-icon-btn" onclick="app.triggerContactAction('email', '${cleanEmail}', '${t.toastEmail}')" title="${t.btnEmail}"><svg viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg></button>`;
        }
        if (rInfo.direccion) {
            const cleanDir = this.escapeHTML(rInfo.direccion);
            const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(rInfo.direccion)}`;
            iconsHtml += `<button class="action-icon-btn" onclick="app.triggerContactAction('map', '${mapsUrl}', '${t.toastDir}')" title="${t.btnMap}"><svg viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg></button>`;
        }
        this.dom.contactIconsContainer.innerHTML = iconsHtml;
    },

    getCompactLanguageCode(langCode) {
        const compactMap = { es: 'ES', en: 'EN', fr: 'FR', it: 'IT', de: 'DE', pt: 'PT', cn: 'CN', sa: 'SA' };
        return compactMap[langCode] || String(langCode || '').toUpperCase();
    },

    getLanguageName(langCode) {
        const names = { es: 'Español', en: 'English', fr: 'Français', it: 'Italiano', de: 'Deutsch', pt: 'Português', cn: '中文', sa: 'العربية' };
        return names[langCode] || String(langCode || '').toUpperCase();
    },

    updateWifiButton() {
        const t = I18N[this.currentLang] || I18N['es'];
        const rInfo = this.data?.restaurantInfo || {};
        const hasWifi = !!((rInfo.wifiSsid || '').trim() || (rInfo.wifiPassword || '').trim());
        if (this.dom.wifiActionBtn) {
            this.dom.wifiActionBtn.classList.toggle('disabled', !hasWifi);
            this.dom.wifiActionBtn.title = t.wifiTitle || 'WiFi';
        }
    },

    toggleWifiModal() {
        const t = I18N[this.currentLang] || I18N['es'];
        const rInfo = this.data?.restaurantInfo || {};
        const ssid = (rInfo.wifiSsid || '').trim();
        const password = (rInfo.wifiPassword || '').trim();

        this.dom.wifiModalTitle.textContent = t.wifiTitle || 'WiFi';

        if (!ssid && !password) {
            this.dom.wifiModalContent.innerHTML = `<div class="wifi-modal-empty">${this.escapeHTML(t.wifiUnavailable || 'No hay WiFi disponible')}</div>`;
        } else {
            this.dom.wifiModalContent.innerHTML = `
                <div class="wifi-modal-row">
                    <strong>${this.escapeHTML(t.wifiSsidLabel || 'Nombre')}</strong>
                    <span>${this.escapeHTML(ssid || '—')}</span>
                </div>
                <div class="wifi-modal-row">
                    <strong>${this.escapeHTML(t.wifiPasswordLabel || 'Contraseña')}</strong>
                    <span>${this.escapeHTML(password || '—')}</span>
                </div>
            `;
        }

        this.dom.wifiModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    },

    closeWifiModal(event, force = false) {
        if (force || event.target === this.dom.wifiModal) {
            this.dom.wifiModal.classList.remove('active');
            document.body.style.overflow = '';
        }
    },

    triggerContactAction(type, value, toastMessage) {
        this.dom.toastText.textContent = `${toastMessage} ${value}`;
        this.dom.toast.classList.add('show');
        
        clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => {
            this.dom.toast.classList.remove('show');
        }, 3200);

        setTimeout(() => {
            if (type === 'tel') window.location.href = `tel:${value}`;
            else if (type === 'email') window.location.href = `mailto:${value}`;
            else if (type === 'map') window.open(value, '_blank');
        }, 600);
    },

    initCookies() {
        if (!localStorage.getItem('cookiesAccepted_MenuForge')) {
            setTimeout(() => this.dom.cookieBanner.classList.add('show'), 800);
        }
    },

    toggleFilterPanel() {
        const options = this.getAvailableFilterOptions();
        if (!options.length && !this.getAvailableCategories().length) return;
        this.pendingSelectedFilters = [...this.selectedFilters];
        this.pendingSelectedCategory = this.selectedCategory;
        this.pendingMinPrice = this.minPrice;
        this.pendingMaxPrice = this.maxPrice;
        this.renderFilterModal();
        this.dom.filterModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    },

    goBack() {
        if (this.searchQuery || this.selectedFilters.length || this.selectedCategory || this.minPrice != null || this.maxPrice != null) {
            this.clearSearchAndFilters();
            this.refreshCurrentView();
            return;
        }
        if (this.currentView === 'menu' || this.currentView === 'search') {
            this.navigateHome();
            return;
        }
        if (window.history.length > 1) {
            window.history.back();
        }
    },

    clearSearchAndFilters() {
        this.searchQuery = '';
        this.selectedFilters = [];
        this.selectedCategory = null;
        this.minPrice = null;
        this.maxPrice = null;
        this.pendingSelectedFilters = [];
        this.pendingSelectedCategory = null;
        this.pendingMinPrice = null;
        this.pendingMaxPrice = null;
        this.dom.searchInput.value = '';
        
        const minInput = document.getElementById('filter-price-min');
        const maxInput = document.getElementById('filter-price-max');
        if (minInput) minInput.value = '';
        if (maxInput) maxInput.value = '';
    },

    closeFilterModal(event, force = false) {
        if (force || event.target === this.dom.filterModal) {
            this.dom.filterModal.classList.remove('active');
            document.body.style.overflow = '';
        }
    },

    togglePendingFilter(filter) {
        this.pendingSelectedFilters = this.pendingSelectedFilters.includes(filter)
            ? this.pendingSelectedFilters.filter(item => item !== filter)
            : [...this.pendingSelectedFilters, filter];
        this.renderFilterModal();
    },

    togglePendingCategory(category) {
        this.pendingSelectedCategory = this.pendingSelectedCategory === category ? null : category;
        this.renderFilterModal();
    },

    setPendingPriceFilter(type, value) {
        const parsed = value === '' || value == null ? null : parseFloat(value);
        if (type === 'min') {
            this.pendingMinPrice = Number.isFinite(parsed) ? parsed : null;
        } else {
            this.pendingMaxPrice = Number.isFinite(parsed) ? parsed : null;
        }
    },

    applyCurrentFiltersAndClose() {
        this.selectedFilters = [...this.pendingSelectedFilters];
        this.selectedCategory = this.pendingSelectedCategory;
        this.minPrice = this.pendingMinPrice;
        this.maxPrice = this.pendingMaxPrice;
        this.refreshCurrentView();
        this.renderFilterBar();
        this.closeFilterModal({ target: this.dom.filterModal }, true);
    },

    resetPriceFilter() {
        this.minPrice = null;
        this.maxPrice = null;
        this.pendingMinPrice = null;
        this.pendingMaxPrice = null;
        const minInput = document.getElementById('filter-price-min');
        const maxInput = document.getElementById('filter-price-max');
        if (minInput) minInput.value = '';
        if (maxInput) maxInput.value = '';
        this.refreshCurrentView();
        this.renderFilterBar();
        this.renderFilterModal();
    },

    normalizeFilterValue(value) {
        if (!value) return '';
        const normalized = String(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const map = {
            'sin gluten': 'sin-gluten', 'gluten': 'sin-gluten', 'gluten free': 'sin-gluten',
            'sin lactosa': 'sin-lactosa', 'lactosa': 'sin-lactosa', 'lacteos': 'sin-lactosa',
            'vegano': 'vegano', 'vegan': 'vegano', 'vegetariano': 'vegetariano', 'vegetarian': 'vegetariano',
            'picante': 'picante', 'spicy': 'picante', 'sin frutos secos': 'sin-frutos-secos',
            'sin soja': 'sin-soja', 'sin huevo': 'sin-huevo', 'pescado': 'pescado', 'marisco': 'marisco',
            'carnes': 'carnes', 'cafe': 'cafe', 'bebida': 'bebida'
        };
        return map[normalized] || normalized.replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    },

    getFilterLabel(value) {
        const key = this.normalizeFilterValue(value);
        const t = FILTER_DICTIONARY[key] || {};
        return t[this.currentLang] || t.es || value || 'Etiqueta';
    },

    getFilterIcon(value) {
        const key = this.normalizeFilterValue(value);
        const map = {
            'sin-gluten': '🌾', 'sin-lactosa': '🥛', 'vegano': '🌱', 'vegetariano': '🥕',
            'picante': '🌶️', 'sin-frutos-secos': '🥜', 'sin-soja': '🌱', 'sin-huevo': '🥚',
            'pescado': '🐟', 'marisco': '🦐', 'carnes': '🥩', 'cafe': '☕', 'bebida': '🥤'
        };
        return map[key] || '🏷️';
    },

    getDishFilterValues(dish) {
        const values = [...(dish.etiquetas || []), ...(dish.alergenos || [])];
        return values.map(value => this.normalizeFilterValue(value)).filter(Boolean);
    },

    getScopedMenusForFilters() {
        if (this.currentView === 'menu' && this.currentMenuId) {
            return (this.data?.menus || []).filter(menu => menu.id === this.currentMenuId);
        }
        return this.data?.menus || [];
    },

    getAvailableFilterOptions() {
        const options = new Set();
        const menus = this.getScopedMenusForFilters();
        menus.forEach(menu => {
            const trans = menu.traducciones?.[this.currentLang] || menu.traducciones?.[Object.keys(menu.traducciones || {})[0]];
            const cats = trans?.categorias || [];
            cats.forEach(cat => {
                (cat.platos || []).forEach(dish => {
                    this.getDishFilterValues(dish).forEach(tag => tag && options.add(tag));
                });
            });
        });
        return [...options].filter(Boolean).sort();
    },

    getAvailableCategories() {
        const categories = new Set();
        const menus = this.getScopedMenusForFilters();
        menus.forEach(menu => {
            const trans = menu.traducciones?.[this.currentLang] || menu.traducciones?.[Object.keys(menu.traducciones || {})[0]];
            (trans?.categorias || []).forEach(cat => {
                if (cat?.nombre) categories.add(String(cat.nombre));
            });
        });
        return [...categories].sort();
    },

    renderFilterBar() {
        const t = I18N[this.currentLang] || I18N['es'];
        const options = this.getAvailableFilterOptions();
        this.filterOptions = options;
        this.dom.filterBarContainer.innerHTML = '';
        this.dom.filterBarContainer.style.display = 'none';

        const chips = [];
        if (this.selectedCategory) {
            chips.push(`<button type="button" class="filter-pill active" onclick='app.togglePendingCategory(${JSON.stringify(this.selectedCategory)}); app.applyCurrentFiltersAndClose();'>🍽️ ${this.escapeHTML(this.selectedCategory)}</button>`);
        }
        this.selectedFilters.forEach(filter => {
            chips.push(`<button type="button" class="filter-pill active" onclick='app.togglePendingFilter(${JSON.stringify(filter)}); app.applyCurrentFiltersAndClose();'>${this.escapeHTML(this.getFilterIcon(filter))} ${this.escapeHTML(this.getFilterLabel(filter))}</button>`);
        });
        if (this.minPrice != null || this.maxPrice != null) {
            const priceLabel = this.minPrice != null && this.maxPrice != null
                ? `${this.formatPrice(this.minPrice)} – ${this.formatPrice(this.maxPrice)}`
                : this.maxPrice != null ? `≤ ${this.formatPrice(this.maxPrice)}` : `≥ ${this.formatPrice(this.minPrice)}`;
            chips.push(`<button type="button" class="filter-pill active" onclick="app.resetPriceFilter()">💸 ${this.escapeHTML(priceLabel)}</button>`);
        }

        if (!chips.length) return;

        this.dom.filterBarContainer.innerHTML = `
            <div style="display:flex; flex-wrap:wrap; gap:8px; align-items:center;">
                ${chips.join('')}
                <button type="button" class="filter-pill" onclick="app.clearSearchAndFilters(); app.refreshCurrentView(); app.renderFilterBar();">${this.escapeHTML(t.filterClear || 'Limpiar')}</button>
            </div>
        `;
        this.dom.filterBarContainer.style.display = 'flex';
    },

    renderFilterModal() {
        const t = I18N[this.currentLang] || I18N['es'];
        const options = this.getAvailableFilterOptions();
        const categories = this.getAvailableCategories();
        const orderedOptions = [...options].sort((a, b) => {
            const aSelected = this.pendingSelectedFilters.includes(a);
            const bSelected = this.pendingSelectedFilters.includes(b);
            if (aSelected !== bSelected) return aSelected ? -1 : 1;
            return a.localeCompare(b);
        });
        const orderedCategories = [...categories].sort((a, b) => {
            const aSelected = this.pendingSelectedCategory === a;
            const bSelected = this.pendingSelectedCategory === b;
            if (aSelected !== bSelected) return aSelected ? -1 : 1;
            return a.localeCompare(b);
        });
        
        const categoryHtml = orderedCategories.length ? `
            <div class="filter-section-card">
                <div class="filter-section-title">${this.escapeHTML(t.filterCategoriesTitle || 'Categorías')}</div>
                <div class="filter-option-grid">
                    ${orderedCategories.map(category => `
                        <button type="button" class="filter-option-btn ${this.pendingSelectedCategory === category ? 'active' : ''}" onclick='app.togglePendingCategory(${JSON.stringify(category)})'>
                            <span class="filter-option-label"><span class="filter-option-icon">🍽️</span><span>${this.escapeHTML(category)}</span></span>
                            <span class="filter-count-badge">${this.getCategoryDishCount(category)}</span>
                        </button>
                    `).join('')}
                </div>
            </div>
        ` : '';

        const tagsHtml = orderedOptions.length ? `
            <div class="filter-section-card">
                <div class="filter-section-title">${this.escapeHTML(t.filterTagsTitle || 'Etiquetas y alergias')}</div>
                <div class="filter-option-grid">
                    ${orderedOptions.map(opt => `
                        <button type="button" class="filter-pill filter-chip-card ${this.pendingSelectedFilters.includes(opt) ? 'active' : ''}" onclick='app.togglePendingFilter(${JSON.stringify(opt)})'>
                            <span class="filter-chip-icon">${this.escapeHTML(this.getFilterIcon(opt))}</span>
                            <span>${this.escapeHTML(this.getFilterLabel(opt))}</span>
                        </button>
                    `).join('')}
                </div>
            </div>
        ` : '';

        const priceHtml = `
            <div class="filter-section-card">
                <div class="filter-section-title">${this.escapeHTML(t.filterPriceTitle || 'Rango de precio')}</div>
                <div class="filter-price-row">
                    <input type="number" id="filter-price-min" class="filter-price-input" placeholder="${this.escapeHTML(t.filterMinPrice || 'Mín')}" value="${this.pendingMinPrice != null ? this.pendingMinPrice : ''}" oninput="app.setPendingPriceFilter('min', this.value)">
                    <input type="number" id="filter-price-max" class="filter-price-input" placeholder="${this.escapeHTML(t.filterMaxPrice || 'Máx')}" value="${this.pendingMaxPrice != null ? this.pendingMaxPrice : ''}" oninput="app.setPendingPriceFilter('max', this.value)">
                </div>
            </div>
        `;

        const activeCount = [this.pendingSelectedCategory].filter(Boolean).length + this.pendingSelectedFilters.length + (this.pendingMinPrice != null || this.pendingMaxPrice != null ? 1 : 0);
        const footerLabel = activeCount > 0 ? `${t.filterApply || 'Aplicar filtros'} (${activeCount})` : (t.filterApply || 'Aplicar filtros');
        const heroHtml = `
            <div class="filter-hero-card">
                <div>
                    <div class="filter-hero-eyebrow">${this.escapeHTML(t.filterButtonTitle || 'Filtrar platos')}</div>
                    <div class="filter-hero-title">${activeCount > 0 ? `${activeCount} filtros listos` : 'Refina la vista del menú'}</div>
                </div>
                ${activeCount > 0 ? `<button type="button" class="filter-hero-clear" onclick="app.clearSearchAndFilters(); app.refreshCurrentView(); app.renderFilterBar();">${this.escapeHTML(t.filterClear || 'Limpiar')}</button>` : ''}
            </div>
        `;
        
        this.dom.filterModalOptions.innerHTML = `<div class="filter-accordion">${heroHtml}${categoryHtml}${tagsHtml}${priceHtml}</div>`;
        
        const footerButton = document.querySelector('#filter-modal .filter-cta-btn.primary');
        if (footerButton) footerButton.textContent = footerLabel;
    },

    shouldShowDish(dish) {
        if (this.selectedCategory) {
            const categoryName = this.getCurrentCategoryNameForDish(dish);
            if (categoryName !== this.selectedCategory) return false;
        }
        if (this.selectedFilters.length) {
            const dishValues = new Set(this.getDishFilterValues(dish));
            if (!this.selectedFilters.every(filter => dishValues.has(filter))) return false;
        }
        if (this.minPrice != null && typeof dish.precio === 'number' && dish.precio < this.minPrice) return false;
        if (this.maxPrice != null && typeof dish.precio === 'number' && dish.precio > this.maxPrice) return false;
        return true;
    },

    getCurrentCategoryNameForDish(dish) {
        const menus = this.getScopedMenusForFilters();
        for (const menu of menus) {
            const trans = menu.traducciones?.[this.currentLang] || menu.traducciones?.[Object.keys(menu.traducciones || {})[0]];
            const cats = trans?.categorias || [];
            for (const cat of cats) {
                if ((cat.platos || []).includes(dish)) return cat.nombre || '';
            }
        }
        return '';
    },

    getDishBadgesHTML(dish) {
        const badges = [];
        const values = this.getDishFilterValues(dish);
        values.forEach(value => {
            const icon = this.getFilterIcon(value);
            badges.push(`<span class="filter-pill" style="padding: 4px 8px; font-size: 0.72em; margin-top: 6px;">${icon} ${this.escapeHTML(this.getFilterLabel(value))}</span>`);
        });
        return badges.length ? `<div style="display:flex; flex-wrap:wrap; gap:6px; margin-top: 6px;">${badges.join('')}</div>` : '';
    },

    updateSearchVisibility() {
        const shouldShowSearch = this.currentView === 'menu' || this.currentView === 'search';
        if (this.dom.searchControlsShell) {
            this.dom.searchControlsShell.classList.toggle('visible', shouldShowSearch);
        }
        if (!shouldShowSearch) {
            this.dom.filterBarContainer.innerHTML = '';
            this.dom.filterBarContainer.style.display = 'none';
        }
    },

    getQuickNoteLabel(note, lang) {
        const dictionary = I18N[lang] || I18N['es'];
        const translationKey = note?.id ? NOTE_TRANSLATION_KEYS[note.id] : '';
        const translatedByKey = translationKey ? dictionary[translationKey] : '';
        if (translatedByKey) return translatedByKey;
        if (note?.traducciones?.[lang]) return note.traducciones[lang];
        if (note?.label) return note.label;
        return '';
    },

    appendQuickNote(note) {
        const noteEntry = note && typeof note === 'object' ? note : { id: String(note), displayLabel: String(note), recipientLabel: String(note) };
        const cleanLabel = (noteEntry.displayLabel || noteEntry.recipientLabel || '').trim();
        if (!cleanLabel) return;

        const currentSelection = this.selectedQuickNotes || [];
        const isSameNote = (entry) => (entry.id && noteEntry.id && entry.id === noteEntry.id) || ((entry.displayLabel || entry.recipientLabel || '').trim().toLowerCase() === cleanLabel.toLowerCase());
        const alreadySelected = currentSelection.some(isSameNote);

        if (alreadySelected) {
            this.selectedQuickNotes = currentSelection.filter(entry => !isSameNote(entry));
        } else {
            this.selectedQuickNotes = [...currentSelection, noteEntry];
        }

        this.orderNotes = this.selectedQuickNotes.map(entry => entry.displayLabel || entry.recipientLabel || '').filter(Boolean).join(' • ');
        if (this.dom.orderNotesInput) {
            this.dom.orderNotesInput.value = this.orderNotes;
            this.dom.orderNotesCounter.textContent = `${this.orderNotes.length}/140`;
        }
        this.renderQuickNotes();
    },

    updateOrderNotes(value) {
        this.orderNotes = value.slice(0, 140);
        if (this.dom.orderNotesInput) this.dom.orderNotesInput.value = this.orderNotes;
        if (this.dom.orderNotesCounter) this.dom.orderNotesCounter.textContent = `${this.orderNotes.length}/140`;
    },

    getConfiguredQuickNotes() {
        const notesConfig = this.data?.restaurantInfo?.whatsappOrderConfig?.quickNotes || [];
        const notes = notesConfig.map(note => ({
            id: note?.id || '',
            displayLabel: this.getQuickNoteLabel(note, this.currentLang),
            recipientLabel: this.getQuickNoteLabel(note, this.whatsapp.msgLang || 'es')
        })).filter(note => note.displayLabel || note.recipientLabel);

        if (notes.length) return notes;

        const t = I18N[this.currentLang] || I18N['es'];
        const tRecipient = I18N[this.whatsapp.msgLang || 'es'] || I18N['es'];
        return [
            { id: 'quick_note_poco_hecho', displayLabel: t.quickNotePocoHecho || 'Poco hecho', recipientLabel: tRecipient.quickNotePocoHecho || 'Poco hecho' },
            { id: 'quick_note_sin_sal', displayLabel: t.quickNoteSinSal || 'Sin sal', recipientLabel: tRecipient.quickNoteSinSal || 'Sin sal' },
            { id: 'quick_note_salsa_aparte', displayLabel: t.quickNoteSalsaAparte || 'Salsa aparte', recipientLabel: tRecipient.quickNoteSalsaAparte || 'Salsa aparte' }
        ];
    },

    renderQuickNotes() {
        const notes = this.getConfiguredQuickNotes();
        if (!notes.length) {
            if (this.dom.quickNotesContainer) {
                this.dom.quickNotesContainer.innerHTML = '';
                this.dom.quickNotesContainer.style.display = 'none';
            }
            return;
        }

        if (this.dom.quickNotesContainer) {
            this.dom.quickNotesContainer.innerHTML = notes.map(note => {
                const isActive = this.selectedQuickNotes.some(entry => {
                    const entryLabel = (entry.displayLabel || entry.recipientLabel || '').trim().toLowerCase();
                    const noteLabel = (note.displayLabel || note.recipientLabel || '').trim().toLowerCase();
                    return (entry.id && note.id && entry.id === note.id) || entryLabel === noteLabel;
                });
                return `<button type="button" class="filter-pill quick-note-chip ${isActive ? 'active' : ''}" onclick="app.appendQuickNote(${JSON.stringify(note).replace(/"/g, '&quot;')})">${this.escapeHTML(note.displayLabel || note.recipientLabel || '')}</button>`;
            }).join('');
            this.dom.quickNotesContainer.style.display = 'flex';
        }
    },

    buildOrderMessage(selectedTable, orderItems, t_wa) {
        const t = I18N[this.currentLang] || I18N['es'];
        const total = this.cart.reduce((sum, item) => sum + (item.precio * item.quantity), 0);
        const notes = (this.selectedQuickNotes.length ? this.selectedQuickNotes : (this.orderNotes ? [{ displayLabel: this.orderNotes, recipientLabel: this.orderNotes }] : [])).map(note => note.recipientLabel || note.displayLabel || '').filter(Boolean);
        const noteText = notes.join(' • ');

        let message = `${t_wa.header.replace('{table}', selectedTable)}\n\n${t.orderIntro || '🛎️ Nuevo pedido'}`;
        message += `\n\n${t.orderSection || '🧾 Pedido:'}\n${orderItems}`;
        if (noteText) {
            message += `\n\n${t.orderNotes || '📝 Notas:'} ${noteText}`;
        }
        message += `\n\n${t.orderTotal || '💳 Total:'} ${this.formatPrice(total)}`;
        message += `\n\n${t_wa.footer}`;
        return message;
    },

    acceptCookies() {
        localStorage.setItem('cookiesAccepted_MenuForge', 'true');
        this.dom.cookieBanner.classList.remove('show');
    },

    getPreservedUrl() {
        const hashSuffix = this.sourceHash ? `#${this.sourceHash}` : '';
        return `${window.location.pathname}${window.location.search}${hashSuffix}`;
    },

    navigateHome() {
        this.currentView = 'home';
        this.currentMenuId = null;
        this.dom.btnBack.style.display = 'none';
        this.dom.categoryTabsContainer.style.display = 'none';
        this.updateSearchVisibility();
        if (this.categoryTabsObserver) this.categoryTabsObserver.disconnect();
        
        if (this.searchQuery) {
            this.renderSearch();
        } else {
            this.renderHomeGrid();
        }
        this.renderFilterBar();
    },

    navigateToMenu(menuId) {
        this.currentView = 'menu';
        this.currentMenuId = menuId;
        this.dom.btnBack.style.display = 'flex';
        this.dom.searchInput.value = ''; 
        this.updateSearchVisibility();
        window.history.pushState({ view: 'menu', menuId, sourceHash: this.sourceHash }, '', this.getPreservedUrl());
        this.renderMenu(menuId);
    },

    refreshCurrentView() {
        if (this.searchQuery) this.renderSearch();
        else if (this.currentView === 'menu') this.renderMenu(this.currentMenuId);
        else this.renderHomeGrid();
        this.renderFilterBar();
    },

    getMenuTitle(menu) {
        const t = I18N[this.currentLang] || I18N['es'];
        const tipo = (menu.tipoMenu || menu.tipo || '').toLowerCase();
        
        if (tipo === 'diario') return t["menu_diario"] || "📅 Menú del Día";
        if (tipo === 'especial') return t["menu_especial"] || "⭐ Cartas Especiales";
        if (tipo === 'normal') return t["menu_normal"] || t.defaultMenu || "📋 Carta Principal";

        let trans = menu.traducciones?.[this.currentLang];
        if (!trans && menu.traducciones) {
            trans = menu.traducciones[Object.keys(menu.traducciones)[0]];
        }
        return trans?.nombreCarta || menu.nombreCarta || t.defaultMenu;
    },

    isDailyMenu(menu) {
        return (menu?.tipoMenu || menu?.tipo || '').toString().toLowerCase() === 'diario';
    },

    selectDailyDish(menuId, catIndex, dishIndex) {
        if (!this.dailySelections[menuId]) {
            this.dailySelections[menuId] = {};
        }
        this.dailySelections[menuId][catIndex] = dishIndex;
        this.refreshCurrentView();
    },

    addDailyMenuToCart(menu, button = null, force = false) {
        const trans = menu.traducciones?.[this.currentLang] || menu.traducciones[Object.keys(menu.traducciones)[0]];
        const cats = trans?.categorias || [];
        const selections = this.dailySelections[menu.id] || {};
        const t = I18N[this.currentLang] || I18N['es'];

        if (!force) {
            const missing = [];
            cats.forEach((cat, idx) => {
                if (selections[idx] === undefined) missing.push(cat.nombre);
            });

            if (missing.length > 0) {
                this.confirmationCallback = () => this.addDailyMenuToCart(menu, button, true);
                this.openConfirmation(
                    t.confirmationTitle || "Continuar incompleto?", 
                    (t.incompleteOrderMsg || "Falta: {list}. ¿Continuar?").replace('{list}', missing.join(', '))
                );
                return;
            }
        }

        const selectedDishesDetails = [];
        const selectedDishesDetailsWa = [];
        const waMenu = menu.traducciones?.[this.whatsapp.msgLang] || trans;

        cats.forEach((cat, catIdx) => {
            const dishIdx = selections[catIdx];
            if (dishIdx !== undefined) {
                const dish = cat.platos[dishIdx];
                const waDish = waMenu.categorias?.[catIdx]?.platos[dishIdx] || dish;
                const waCatName = waMenu.categorias?.[catIdx]?.nombre || cat.nombre;
                selectedDishesDetails.push({ category: cat.nombre, dish: dish.nombre });
                selectedDishesDetailsWa.push({ category: waCatName, dish: waDish.nombre });
            }
        });

        const menuName = this.getMenuTitle(menu);
        const uniqueId = `menu-${menu.id}-${Date.now()}`;

        const cartItem = {
            cart_id: uniqueId,
            nombre: menuName,
            nombre_display: menuName,
            nombre_wa: menuName,
            precio: typeof menu.precio === 'number' ? menu.precio : 0,
            tipo: 'daily-menu',
            selectedDishes: selectedDishesDetails,
            selectedDishesWa: selectedDishesDetailsWa
        };

        this.cart.push({ ...cartItem, quantity: 1 });
        this.updateCartBadge();

        if (button) {
            button.classList.remove('success', 'bump');
            void button.offsetWidth;
            button.classList.add('success', 'bump');
            button.innerHTML = '✓';
            setTimeout(() => {
                button.classList.remove('success', 'bump');
                button.innerHTML = '+';
            }, 700);
        }
        if (this.dom.cartFab) {
            this.dom.cartFab.classList.remove('bump');
            void this.dom.cartFab.offsetWidth;
            this.dom.cartFab.classList.add('bump');
        }
    },

    openConfirmation(title, message) {
        const t = I18N[this.currentLang] || I18N['es'];
        document.getElementById('conf-title').textContent = title;
        document.getElementById('conf-msg').textContent = message;
        
        const confModal = document.getElementById('confirmation-modal');
        confModal.querySelectorAll('.secondary')[0].textContent = t.btnCancel;
        confModal.querySelectorAll('.primary')[0].textContent = t.btnAccept;
        
        confModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    },

    closeConfirmation() {
        document.getElementById('confirmation-modal').classList.remove('active');
        document.body.style.overflow = '';
        this.confirmationCallback = null;
    },

    confirmAction() {
        if (this.confirmationCallback) {
            this.confirmationCallback();
        }
        this.closeConfirmation();
    },

    renderHomeGrid() {
        const menus = this.data.menus || [];
        const t = I18N[this.currentLang] || I18N['es'];
        
        if (menus.length === 0) {
            this.dom.content.innerHTML = `<div id="loader">${t.emptyMenu}</div>`;
            return;
        }

        if (menus.length === 1 && !this.searchQuery) {
            this.navigateToMenu(menus[0].id);
            this.dom.btnBack.style.display = 'none';
            return;
        }

        let html = '<div class="menu-grid">';
        menus.forEach(menu => {
            const tipo = (menu.tipoMenu || menu.tipo || 'normal').toLowerCase();
            const coverImg = DEFAULT_COVERS[tipo] || DEFAULT_COVERS.normal;
            const noCacheImg = `${coverImg}?t=${this.sessionTimestamp}`;
            const menuName = this.getMenuTitle(menu);

            html += `
                <div class="menu-card fade-in-slide" onclick="app.navigateToMenu('${menu.id}')">
                    <img class="menu-card-img" src="${noCacheImg}" alt="${this.escapeHTML(menuName)}" loading="lazy">
                    <div class="menu-card-overlay">
                        <h2 class="menu-card-title">${this.escapeHTML(menuName)}</h2>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        this.dom.content.innerHTML = html;
        this.initScrollAnimations();
        window.scrollTo(0,0);
    },

    getCategoryName(catKey, originalName) {
        const t = I18N[this.currentLang] || I18N['es'];
        if (catKey && t[catKey]) return t[catKey];
        return originalName;
    },

    getCategoryDishCount(categoryName) {
        const menus = this.getScopedMenusForFilters();
        let count = 0;
        menus.forEach(menu => {
            const trans = menu.traducciones?.[this.currentLang] || menu.traducciones?.[Object.keys(menu.traducciones || {})[0]];
            (trans?.categorias || []).forEach(cat => {
                const translatedName = this.getCategoryName(cat.key, cat.nombre);
                if (translatedName !== categoryName) return;
                (cat.platos || []).forEach(dish => {
                    if (this.shouldShowDish(dish)) count += 1;
                });
            });
        });
        return count;
    },

    renderMenu(menuId) {
        const menu = this.data.menus.find(m => m.id === menuId);
        if (!menu) return this.navigateHome();
        const t = I18N[this.currentLang] || I18N['es'];

        let trans = menu.traducciones?.[this.currentLang];
        if (!trans && menu.traducciones) {
            trans = menu.traducciones[Object.keys(menu.traducciones)[0]];
        }

        if (!trans || !trans.categorias || trans.categorias.length === 0) {
            this.dom.content.innerHTML = `<div id="loader">${t.emptyMenu}</div>`;
            this.dom.categoryTabs.innerHTML = '';
            this.dom.categoryTabsContainer.style.display = 'none';
            return;
        }

        const isDaily = this.isDailyMenu(menu);
        let html = '';

        if (isDaily) {
            const menuPrice = this.formatPrice(typeof menu.precio === 'number' ? menu.precio : 0);
            const dailyMenuTitle = (trans?.dailyMenuPriceTitle || t["menu_diario"] || '📅 Menú del Día').trim();
            const dailyMenuHelp = (trans?.dailyMenuPriceHelp || '').trim();
            const dailyMenuActionLabel = t.dailyMenuAdd || 'Añadir';
            const tipo = (menu.tipoMenu || menu.tipo || 'normal').toLowerCase();
            const coverImg = DEFAULT_COVERS[tipo] || DEFAULT_COVERS.normal;
            
            const heroImage = (menu.recursos?.imagenes && Object.keys(menu.recursos.imagenes).length > 0)
                ? Object.values(menu.recursos.imagenes)[0]
                : coverImg;
            
            const hasHeroImg = heroImage && heroImage.trim() !== '';
            const heroImageWithCache = hasHeroImg ? `${heroImage}?t=${this.sessionTimestamp}` : '';
            
            html += `
                <div class="daily-menu-shell fade-in-slide" style="margin-bottom: 30px;">
                    <div class="daily-menu-card">
                        ${hasHeroImg ? `<img src="${this.escapeHTML(heroImageWithCache)}" alt="${this.escapeHTML(this.getMenuTitle(menu))}" onerror="this.style.display='none'">` : ''}
                        <div class="daily-menu-card-body">
                            <div class="daily-menu-badge">${this.escapeHTML(dailyMenuTitle)}</div>
                            <h2 class="daily-menu-title">${this.escapeHTML(this.getMenuTitle(menu))}</h2>
                            ${dailyMenuHelp ? `<p class="daily-menu-copy">${this.escapeHTML(dailyMenuHelp)}</p>` : ''}
                            <div class="daily-menu-meta">
                                <div class="daily-menu-price-pill">${menuPrice}</div>
                                <button class="daily-menu-action" onclick="event.stopPropagation(); app.addDailyMenuToCart(app.data.menus.find(m=>m.id==='${menu.id}'), event.currentTarget);">${this.escapeHTML(dailyMenuActionLabel)}</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        this.dom.categoryTabsContainer.style.display = 'block';
        const images = menu.recursos?.imagenes || {};
        let tabsHtml = '';

        for (let catIndex = 0; catIndex < trans.categorias.length; catIndex++) {
            const cat = trans.categorias[catIndex];
            const catKey = cat.key;
            const translatedCatName = this.getCategoryName(catKey, cat.nombre);
            
            const categorySlug = this.slugify(translatedCatName || cat.nombre);
            const visibleDishes = (cat.platos || []).filter((dish) => this.shouldShowDish(dish));
            if (!visibleDishes.length) continue;
            
            tabsHtml += `<div class="category-tab" data-target="${categorySlug}">${this.escapeHTML(translatedCatName)}<span class="tab-count">${visibleDishes.length}</span></div>`;

            html += `<div id="${categorySlug}" class="category fade-in-slide">`;
            html += `<h2 class="category-title">${this.escapeHTML(translatedCatName)}</h2>`;
            
            visibleDishes.forEach((dish) => {
                const originalIndex = (cat.platos || []).findIndex(item => item === dish);
                html += this.generateDishCardHTML(dish, images, null, menu.id, catIndex, originalIndex >= 0 ? originalIndex : 0, isDaily);
            });
            html += `</div>`;
        }

        this.dom.categoryTabs.innerHTML = tabsHtml;
        
        document.querySelectorAll('.category-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const targetId = tab.getAttribute('data-target');
                const targetElement = document.getElementById(targetId);
                if (targetElement) {
                    const headerHeight = this.dom.header.offsetHeight;
                    const targetPosition = targetElement.getBoundingClientRect().top + window.pageYOffset - headerHeight;
                    window.scrollTo({ top: targetPosition, behavior: 'smooth' });
                }
            });
        });

        if (this.categoryTabsObserver) this.categoryTabsObserver.disconnect();
        const observerOptions = {
            root: null,
            rootMargin: `-${this.dom.header.offsetHeight + 15}px 0px 0px 0px`,
            threshold: 0.6
        };
        this.categoryTabsObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const id = entry.target.getAttribute('id');
                const tab = document.querySelector(`.category-tab[data-target="${id}"]`);
                if (tab) tab.classList.toggle('active', entry.isIntersecting);
            });
        }, observerOptions);
        
        this.dom.content.innerHTML = html;
        document.querySelectorAll('.category').forEach(section => this.categoryTabsObserver.observe(section));

        this.initScrollAnimations();
        window.scrollTo(0,0);
    },

    normalizeText(value) {
        return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    },

    fuzzyMatch(text, query) {
        const normalizedText = this.normalizeText(text);
        const normalizedQuery = this.normalizeText(query).trim();
        if (!normalizedQuery) return true;
        if (normalizedText.includes(normalizedQuery)) return true;
        let queryIndex = 0;
        for (const char of normalizedText) {
            if (char === normalizedQuery[queryIndex]) queryIndex += 1;
            if (queryIndex === normalizedQuery.length) return true;
        }
        return false;
    },

    handleSearch(query) {
        this.searchQuery = query.trim().toLowerCase();
        if (!this.searchQuery) {
            this.refreshCurrentView();
            return;
        }
        window.history.pushState({ view: 'search', query: this.searchQuery, sourceHash: this.sourceHash }, '', this.getPreservedUrl());
        this.renderSearch();
    },

    renderSearch() {
        let resultsHTML = '';
        const foundKeys = new Set();
        const t = I18N[this.currentLang] || I18N['es'];

        this.dom.btnBack.style.display = 'flex';
        this.dom.categoryTabsContainer.style.display = 'none';
        if (this.categoryTabsObserver) this.categoryTabsObserver.disconnect();

        this.data.menus.forEach(menu => {
            if (!menu.traducciones) return;
            const isDaily = this.isDailyMenu(menu);
            const images = menu.recursos?.imagenes || {};
            const displayMenuName = this.getMenuTitle(menu);

            for (const lang in menu.traducciones) {
                const trans = menu.traducciones[lang];
                if (trans && trans.categorias) {
                    for (let catIndex = 0; catIndex < trans.categorias.length; catIndex++) {
                        const cat = trans.categorias[catIndex];
                        if (cat.platos) {
                            for (let dishIndex = 0; dishIndex < cat.platos.length; dishIndex++) {
                                const dish = cat.platos[dishIndex];
                                if (!this.shouldShowDish(dish)) continue;
                                const name = (dish.nombre || '');
                                const desc = (dish.descripcion || '');
                                
                                if (this.fuzzyMatch(name, this.searchQuery) || this.fuzzyMatch(desc, this.searchQuery)) {
                                    const key = `${menu.id}-${catIndex}-${dishIndex}`;
                                    if (!foundKeys.has(key)) {
                                        foundKeys.add(key);
                                        const displayDish = menu.traducciones[this.currentLang]?.categorias[catIndex]?.platos[dishIndex];
                                        if (displayDish) {
                                            resultsHTML += this.generateDishCardHTML(displayDish, images, displayMenuName, menu.id, catIndex, dishIndex, isDaily);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        if (foundKeys.size === 0) {
            this.dom.content.innerHTML = `<div id="loader">${t.emptySearch} "${this.escapeHTML(this.searchQuery)}"</div>`;
        } else {
            this.dom.content.innerHTML = `
                <div class="category fade-in-slide">
                    <h2 class="category-title">${t.results} (${foundKeys.size})</h2>
                    ${resultsHTML}
                </div>
            `;
            this.initScrollAnimations();
        }
    },

    generateDishCardHTML(dish, images, sourceMenuName, menuId, catIndex, dishIndex, isDailyMenu = false) {
        const imgUrl = dish.idImagen ? images[dish.idImagen] : '';
        const safeName = this.escapeHTML(dish.nombre);
        const safeDesc = this.escapeHTML(dish.descripcion);
        const safePrice = this.formatPrice(dish.precio);
        const badgesHTML = this.getDishBadgesHTML(dish);

        const modalData = { name: safeName, desc: safeDesc, price: isDailyMenu ? '' : safePrice, imgUrl };
        const safeModalData = encodeURIComponent(JSON.stringify(modalData));

        let isSelected = false;
        if (isDailyMenu && menuId) {
            isSelected = this.dailySelections[menuId]?.[catIndex] === dishIndex;
        }

        let cartDishData = dish;
        if (this.whatsapp.enabled && menuId !== undefined) {
            const menu = this.data.menus.find(m => m.id === menuId);
            const waDish = menu?.traducciones?.[this.whatsapp.msgLang]?.categorias?.[catIndex]?.platos?.[dishIndex];
            if (waDish) {
                cartDishData = {
                    ...dish,
                    nombre_display: dish.nombre,
                    nombre_wa: waDish.nombre,
                    cart_id: `${menuId}-${catIndex}-${dishIndex}`
                };
            }
        }
        const safeCartData = encodeURIComponent(JSON.stringify(cartDishData));

        let actionButton = '';
        if (isDailyMenu) {
            actionButton = `<button class="dish-add-btn ${isSelected ? 'success' : ''}" onclick="event.stopPropagation(); app.selectDailyDish('${menuId}', ${catIndex}, ${dishIndex});">${isSelected ? '✓' : '○'}</button>`;
        } else if (this.whatsapp.enabled) {
            actionButton = `<button class="dish-add-btn" onclick="event.stopPropagation(); app.addToCart('${safeCartData}', event.currentTarget);">+</button>`;
        } else {
            actionButton = `<div class="dish-action-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg></div>`;
        }

        let bottomRowHTML = '';
        if (isDailyMenu) {
            bottomRowHTML = `
            <div class="dish-bottom-row">
                <div class="dish-price" style="font-size:0.85em; color:var(--text-muted-light);">${isSelected ? 'Seleccionado' : 'Pulsa para elegir'}</div>
                ${actionButton}
            </div>`;
        } else {
            bottomRowHTML = `
            <div class="dish-bottom-row">
                <div class="dish-price">${safePrice} ${sourceMenuName ? `<span class="dish-source-badge">${this.escapeHTML(sourceMenuName)}</span>` : ''}</div>
                ${actionButton}
            </div>`;
        }

        const cardClass = isDailyMenu && isSelected ? 'dish selected-daily-dish' : 'dish';

        return `
            <div class="${cardClass}" onclick="${isDailyMenu ? `app.selectDailyDish('${menuId}', ${catIndex}, ${dishIndex})` : `app.openModal('${safeModalData}')`}">
                ${imgUrl ? `<img class="dish-img" src="${imgUrl}" loading="lazy" onerror="this.style.display='none'">` : ''}
                <div class="dish-details">
                    <div class="dish-name">${safeName}</div>
                    ${safeDesc ? `<p class="dish-desc">${safeDesc}</p>` : ''}
                    ${badgesHTML}
                    ${bottomRowHTML}
                </div>
            </div>
        `;
    },

    getPrintableMenus() {
        const menus = this.data?.menus || [];
        if (this.currentView === 'menu' && this.currentMenuId) {
            return menus.filter(menu => menu.id === this.currentMenuId);
        }
        return menus;
    },

    printFullMenu() {
        const rInfo = this.data?.restaurantInfo || {};
        const menus = this.getPrintableMenus();
        const t = I18N[this.currentLang] || I18N['es'];
        let printHTML = '';

        menus.forEach((menu, index) => {
            const menuName = this.getMenuTitle(menu);
            const breakClass = index > 0 ? 'pdf-page-break' : '';
            printHTML += `<div class="pdf-page-section ${breakClass}">`;
            
            if (rInfo.logoBase64) {
                printHTML += `<img src="${rInfo.logoBase64}" class="pdf-watermark-bg" onerror="this.style.display='none'">`;
            }

            printHTML += `
                <div class="pdf-header-top">
                    ${rInfo.logoBase64 ? `<img src="${rInfo.logoBase64}" onerror="this.style.display='none'">` : ''}
                    <h1>${this.escapeHTML(rInfo.nombre || t.defaultRestaurant)}</h1>
                    <p>${this.escapeHTML(rInfo.direccion || '')} &bull; ${this.escapeHTML(rInfo.telefono || '')}</p>
                </div>
                <div class="pdf-menu-title-box">
                    <span>${this.escapeHTML(menuName)}</span>
                </div>
            `;
            
            let trans = null;
            if (menu.traducciones) {
                trans = menu.traducciones[this.currentLang] || menu.traducciones[Object.keys(menu.traducciones)[0]];
            }
            
            const images = menu.recursos?.imagenes || {};

            if (trans && trans.categorias) {
                trans.categorias.forEach(cat => {
                    const catName = this.getCategoryName(cat.key, cat.nombre);
                    printHTML += `<div class="pdf-cat-title">${this.escapeHTML(catName)}</div>`;
                    
                    if (cat.platos) {
                        cat.platos.forEach(dish => {
                            const priceFormatted = this.formatPrice(dish.precio);
                            const imgUrl = dish.idImagen ? images[dish.idImagen] : '';
                            
                            printHTML += `
                                <div class="pdf-dish-row">
                                    ${imgUrl ? `<img src="${imgUrl}" class="pdf-dish-thumb" onerror="this.style.display='none'">` : ''}
                                    <div class="pdf-dish-info">
                                        <p class="pdf-dish-name">${this.escapeHTML(dish.nombre)}</p>
                                        ${dish.descripcion ? `<p class="pdf-dish-desc">${this.escapeHTML(dish.descripcion)}</p>` : ''}
                                    </div>
                                    <div class="pdf-dish-dots"></div>
                                    <div class="pdf-dish-price">${priceFormatted}</div>
                                </div>
                            `;
                        });
                    }
                });
            }
            printHTML += `</div>`;
        });

        this.dom.printContainer.innerHTML = printHTML;
        setTimeout(() => { window.print(); }, 100);
    },

    openModal(safeDataStr) {
        const data = JSON.parse(decodeURIComponent(safeDataStr));
        const t = I18N[this.currentLang] || I18N['es'];
        
        this.dom.mTitle.innerHTML = data.name;
        
        if (data.price) {
            this.dom.mPrice.innerHTML = data.price;
            this.dom.mPrice.style.display = 'inline-block';
        } else {
            this.dom.mPrice.style.display = 'none';
        }
        
        this.dom.mDesc.innerHTML = data.desc || `<i>${t.noDescription}</i>`;
        
        if (data.imgUrl) {
            this.dom.mImg.src = data.imgUrl;
            this.dom.mImgWrapper.style.display = 'block';
        } else {
            this.dom.mImg.src = '';
            this.dom.mImgWrapper.style.display = 'none';
        }

        this.dom.modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    },

    closeModal(event, force = false) {
        if (force || event.target === this.dom.modal) {
            this.dom.modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    },

    addToCart(safeCartData, button = null) {
        const dish = JSON.parse(decodeURIComponent(safeCartData));
        const uniqueId = dish.cart_id || dish.nombre;
        const existingItem = this.cart.find(item => (item.cart_id || item.nombre) === uniqueId);

        if (existingItem) {
            existingItem.quantity++;
        } else {
            this.cart.push({ ...dish, quantity: 1 });
        }
        this.updateCartBadge();

        if (button) {
            button.classList.remove('success', 'bump');
            void button.offsetWidth;
            button.classList.add('success', 'bump');
            button.innerHTML = '✓';
            setTimeout(() => {
                button.classList.remove('success', 'bump');
                button.innerHTML = '+';
            }, 700);
        }
        if (this.dom.cartFab) {
            this.dom.cartFab.classList.remove('bump');
            void this.dom.cartFab.offsetWidth;
            this.dom.cartFab.classList.add('bump');
        }
    },

    updateCartBadge() {
        const totalItems = this.cart.reduce((sum, item) => sum + item.quantity, 0);
        this.dom.cartBadge.textContent = totalItems;
        if (totalItems > 0) {
            this.dom.cartBadge.classList.add('visible');
        } else {
            this.dom.cartBadge.classList.remove('visible');
        }
    },

    openCart() {
        if (!this.whatsapp.enabled) return;
        this.renderCartModal();
        this.dom.cartModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    },

    closeCart(event, force = false) {
        if (force || event.target === this.dom.cartModal) {
            this.dom.cartModal.classList.remove('active');
            document.body.style.overflow = '';
        }
    },

    renderCartModal() {
        const t = I18N[this.currentLang] || I18N['es'];
        let tableOptions = `<option value="">-- ${t.tableSelectDefault} --</option>`;
        this.renderQuickNotes();
        this.dom.orderNotesInput.value = this.orderNotes;
        this.dom.orderNotesCounter.textContent = `${this.orderNotes.length}/140`;
        const displayLang = this.currentLang;
        const valueLang = this.whatsapp.msgLang;

        this.tables.forEach(table => {
            const displayTableName = table.traducciones?.[displayLang] || table.name;
            const valueTableName = table.traducciones?.[valueLang] || table.name;
            tableOptions += `<option value="${this.escapeHTML(valueTableName)}">${this.escapeHTML(displayTableName)}</option>`;
        });
        this.dom.tableSelector.innerHTML = tableOptions;

        if (this.cart.length === 0) {
            this.dom.cartItemsContainer.innerHTML = `<div style="text-align:center; padding: 20px 0; color: var(--text-muted-light);">${t.cartEmpty}</div>`;
            this.updateCartTotal();
            return;
        }

        let itemsHtml = '';
        this.cart.forEach(item => {
            const uniqueId = this.escapeHTML(item.cart_id || item.nombre);
            const displayName = this.escapeHTML(item.nombre_display || item.nombre);

            let detailsHtml = '';
            if (item.tipo === 'daily-menu' && item.selectedDishes) {
                detailsHtml = `<div class="cart-item-details-list">` +
                    item.selectedDishes.map(d => `• ${this.escapeHTML(d.category)}: ${this.escapeHTML(d.dish)}`).join('<br>') +
                    `</div>`;
            }

            itemsHtml += `
                <div class="cart-item">
                    <div class="cart-item-row">
                        <div class="cart-item-name">${displayName}</div>
                        <div class="cart-item-controls">
                            <button class="quantity-btn" onclick="app.adjustCartQuantity('${uniqueId}', -1)">-</button>
                            <span class="cart-item-quantity">${item.quantity}</span>
                            <button class="quantity-btn" onclick="app.adjustCartQuantity('${uniqueId}', 1)">+</button>
                        </div>
                        <div class="cart-item-price">${this.formatPrice(item.precio * item.quantity)}</div>
                    </div>
                    ${detailsHtml}
                </div>
            `;
        });
        this.dom.cartItemsContainer.innerHTML = itemsHtml;
        this.updateCartTotal();
    },

    adjustCartQuantity(itemId, change) {
        const item = this.cart.find(i => (this.escapeHTML(i.cart_id || i.nombre)) === itemId);
        if (item) {
            item.quantity += change;
            if (item.quantity <= 0) {
                this.cart = this.cart.filter(i => (this.escapeHTML(i.cart_id || i.nombre)) !== itemId);
            }
        }
        this.renderCartModal();
        this.updateCartBadge();
    },

    updateCartTotal() {
        const total = this.cart.reduce((sum, item) => sum + (item.precio * item.quantity), 0);
        this.dom.cartTotalPrice.textContent = this.formatPrice(total);
    },

    sendOrder() {
        const selectedTable = this.dom.tableSelector.value;
        const t_wa = I18N_WHATSAPP[this.whatsapp.msgLang] || I18N_WHATSAPP['es'];
        if (!selectedTable) { alert(t_wa.noTable); return; }
        if (this.cart.length === 0) return;

        const orderItems = this.cart.map(item => {
            const nameForWhatsapp = item.nombre_wa || item.nombre;
            let itemStr = t_wa.item.replace('{quantity}', item.quantity).replace('{name}', nameForWhatsapp);
            
            if (item.tipo === 'daily-menu' && item.selectedDishesWa) {
                item.selectedDishesWa.forEach(sel => {
                    itemStr += `\n    - ${sel.category}: ${sel.dish}`;
                });
            }
            return itemStr;
        }).join('\n');

        const message = this.buildOrderMessage(selectedTable, orderItems, t_wa);
        window.open(`https://wa.me/${this.whatsapp.phone}?text=${encodeURIComponent(message)}`, '_blank');
    },

    updateFlag() { 
        this.dom.currentFlag.src = `assets/flags/${this.currentLang}.png`; 
    },
    
    applyThemePreference() {
        const storedTheme = localStorage.getItem('menuforge-theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const shouldDark = storedTheme ? storedTheme === 'dark' : prefersDark;
        document.body.classList.toggle('dark-mode', shouldDark);
        this.isDarkMode = shouldDark;
        if (this.dom.btnTheme) {
            this.dom.btnTheme.textContent = shouldDark ? '☀️' : '🌙';
        }
    },

    toggleTheme() {
        this.isDarkMode = !document.body.classList.contains('dark-mode');
        document.body.classList.toggle('dark-mode', this.isDarkMode);
        localStorage.setItem('menuforge-theme', this.isDarkMode ? 'dark' : 'light');
        if (this.dom.btnTheme) {
            this.dom.btnTheme.textContent = this.isDarkMode ? '☀️' : '🌙';
        }
    },
    
    formatPrice(price) {
        if (typeof price !== 'number') return '';
        const currencyCode = (this.data && this.data.restaurantInfo && this.data.restaurantInfo.currency) 
                            ? this.data.restaurantInfo.currency 
                            : 'EUR';
        
        let locale = this.currentLang;
        if (locale === 'cn') locale = 'zh-CN';
        else if (locale === 'sa') locale = 'ar-SA';
        else if (locale === 'en') locale = 'en-US';
        else if (locale === 'pt') locale = 'pt-BR';

        try {
            return price.toLocaleString(locale, { style: 'currency', currency: currencyCode });
        } catch(e) {
            return price.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
        }
    },
    
    escapeHTML(str) {
        if (!str) return '';
        return String(str).replace(/[&<>"']/g, match => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[match]));
    },

    slugify(text) {
        if (!text) return '';
        return text.toString().toLowerCase()
            .replace(/\s+/g, '-')        
            .replace(/[^\w\-]+/g, '')      
            .replace(/\-\-+/g, '-')        
            .replace(/^-+/, '')            
            .replace(/-+$/, '');            
    },

    initScrollAnimations() {
        const elements = document.querySelectorAll('.fade-in-slide');
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.01 });
        elements.forEach(el => observer.observe(el));
    },

    decompressPako(base64String) {
        const compressed = atob(base64String).split('').map(c => c.charCodeAt(0));
        return JSON.parse(pako.inflate(new Uint8Array(compressed), { to: 'string' }));
    },

    async fetchRemote(id, folder) {
        const workerUrl = window.location.hostname.includes('github.io') || window.location.hostname === 'localhost' 
            ? 'https://wiissdeveloperapps.dpdns.org' 
            : ''; 

        const url = `${workerUrl}/${folder}/${id}.json?t=${Date.now()}`;
        
        const response = await fetch(url);
        const t = I18N[this.currentLang] || I18N['es'];
        if (!response.ok) throw new Error(t.fetchError);
        
        const rawText = await response.text();
        const decompressed = LZString.decompressFromEncodedURIComponent(rawText);
        
        return JSON.parse(decompressed || rawText);
    }
};

window.addEventListener('popstate', (event) => {
    const state = event.state || {};
    if (state.view === 'menu' && state.menuId) {
        app.navigateToMenu(state.menuId);
    } else if (state.view === 'search') {
        app.searchQuery = state.query || '';
        app.dom.searchInput.value = app.searchQuery;
        if (app.searchQuery) app.renderSearch();
        else app.navigateHome();
    } else {
        app.clearSearchAndFilters();
        app.navigateHome();
    }
});

document.addEventListener('DOMContentLoaded', () => app.init());