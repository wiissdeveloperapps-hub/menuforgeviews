// Iconos por "key" de categoría (slug estable del catálogo, independiente del idioma),
// no por el nombre traducido -antes solo funcionaban en español y solo para 8 categorías fijas-.
// Se busca primero por el último tramo (p.ej. "cafes" en "bebidas::cafes"), luego por el tramo base.
const CATEGORY_ICONS = {
    bebidas: '🥤', bowls: '🥗', carnes: '🥩', desayunos: '🍳', ensaladas: '🥗',
    entrantes: '🍟', hamburguesas: '🍔', pastas: '🍝', pescados: '🐟', pizzas: '🍕',
    postres: '🍰', sandwiches: '🥪', sushi: '🍣', tacos: '🌮', wok: '🍜', wraps: '🌯',
    cafes: '☕', cervezas: '🍺', cocteles: '🍸', refrescos: '🥤',
    huevos: '🍳', pancakes: '🥞', tostadas: '🍞',
    primeros: '🍲', segundos: '🍖',
    desayuno: '🍳', comida: '🍽️', merienda: '🧁', cena: '🌙'
};

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
    selectedFilters: [],
    
    pendingSelectedFilters: [],
    pendingSelectedCategory: null,
    pendingMinPrice: null,
    pendingMaxPrice: null,
    
    orderNotes: '',
    selectedQuickNotes: [],
    dailySelections: {},
    toastTimer: null,
    confirmationCallback: null,
    
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
        sendOrderBtn: document.getElementById('send-order-btn'),
        confModal: document.getElementById('confirmation-modal'),
        confTitle: document.getElementById('conf-title'),
        confBtnCancel: document.getElementById('conf-btn-cancel'),
        confBtnAccept: document.getElementById('conf-btn-accept'),
        poweredByFooterText: document.getElementById('powered-by-footer-text'),
        poweredByFooter: document.getElementById('powered-by-footer')
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
            this.dom.content.innerHTML = `<div style="text-align:center; padding: 50px; color: #ef4444;"><h3>${tErr.errorTitle}</h3><p>${error.message}</p><button type="button" onclick="window.location.reload()" style="margin-top:16px; padding:10px 24px; border:none; border-radius:10px; background:#4f46e5; color:#fff; font-weight:700; font-size:0.95em; cursor:pointer;">${tErr.retryBtn || 'Retry'}</button></div>`;
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

        this.applyBrandTheme(rInfo);

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
        
        this.dom.cartModalTitle.textContent = t.cartTitle;
        this.dom.orderNotesLabel.textContent = t.notesLabel || 'Observaciones';
        this.dom.orderNotesInput.placeholder = t.notesPlaceholder || 'Añade detalles para la cocina';
        this.dom.orderNotesInput.maxLength = 140;
        this.dom.orderNotesCounter.textContent = `${this.orderNotes.length}/140`;
        this.dom.cartTotalLabel.textContent = t.cartTotal;
        this.dom.cartTableLabel.textContent = t.cartTableLabel;
        this.dom.sendOrderBtn.textContent = t.orderBtn || t_wa.orderBtn;
        this.dom.cookieText.textContent = t.cookieMsg;
        this.dom.cookieBtn.textContent = t.cookieBtn;
        // El hostelero que pagó "Quitar marca de agua" en la app deja de verla también aquí
        // -viaja como campo publicado en el JSON del restaurante, no hay compra ni login que
        // comprobar en esta web pública-.
        if (this.dom.poweredByFooter) this.dom.poweredByFooter.style.display = rInfo.sinMarca ? 'none' : '';
        if (this.dom.poweredByFooterText) this.dom.poweredByFooterText.innerHTML = t.poweredByFooter || 'Hecho con <strong>MenuForge</strong>';

        if (this.dom.confTitle && !this.dom.confTitle.textContent) {
            this.dom.confTitle.textContent = t.confDefaultTitle || '¿Estás seguro?';
        }
        if (this.dom.confBtnCancel) this.dom.confBtnCancel.textContent = t.btnCancel || 'Cancelar';
        if (this.dom.confBtnAccept) this.dom.confBtnAccept.textContent = t.btnAccept || 'Continuar';
        
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
      if (rInfo.direccion || (rInfo.latitud && rInfo.longitud)) {
            // Preferimos lat/lng (exactas, capturadas por GPS o clic en el mapa) sobre el
            // texto de dirección, que puede no traer el número si OSM no lo tiene catastrado.
            const hasCoords = typeof rInfo.latitud === 'number' && typeof rInfo.longitud === 'number';
            const mapsUrl = hasCoords
                ? `https://www.google.com/maps/search/?api=1&query=${rInfo.latitud},${rInfo.longitud}`
                : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(rInfo.direccion)}`;
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

    updateTempPrice(type, value) {
        const val = parseFloat(value);
        if (type === 'min') this.pendingMinPrice = isNaN(val) ? null : val;
        if (type === 'max') this.pendingMaxPrice = isNaN(val) ? null : val;
        this.updateFilterModalFooter();
    },

    clearTempFilters() {
        this.pendingSelectedFilters = [];
        this.pendingSelectedCategory = null;
        this.pendingMinPrice = null;
        this.pendingMaxPrice = null;
        this.renderFilterModal();
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

    normalizeFilterValue(value) {
        if (!value) return '';
        const normalized = String(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        // OJO: "Gluten"/"L\u00e1cteos" (al\u00e9rgeno: lo contiene) NO son lo mismo que "Sin gluten"/"Sin
        // lactosa" (dieta: libre de) -antes se fusionaban en el mismo icono/etiqueta, mostrando
        // el significado contrario-. Cada valor que ofrece el wizard tiene aqu\u00ed su propia clave.
        const map = {
            'gluten': 'gluten', 'lacteos': 'lacteos', 'frutos secos': 'frutos-secos', 'soja': 'soja',
            'huevo': 'huevo', 'pescado': 'pescado', 'marisco': 'marisco', 'crustaceos': 'crustaceos',
            'moluscos': 'moluscos', 'cacahuetes': 'cacahuetes', 'apio': 'apio', 'mostaza': 'mostaza',
            'sesamo': 'sesamo', 'sulfitos': 'sulfitos', 'altramuces': 'altramuces', 'fructosa': 'fructosa',
            'sorbitol': 'sorbitol', 'plv': 'plv', 'glutamato': 'glutamato',
            'sin gluten': 'sin-gluten', 'sin lactosa': 'sin-lactosa', 'vegano': 'vegano', 'vegetariano': 'vegetariano',
            'picante': 'picante', 'muy picante': 'muy-picante', 'halal': 'halal', 'sin cerdo': 'sin-cerdo',
            'kosher': 'kosher', 'keto': 'keto', 'sin azucar anadido': 'sin-azucar-anadido',
            'bajo en grasas': 'bajo-en-grasas', 'ecologico': 'ecologico', 'km 0': 'km-0',
            'alto en proteinas': 'alto-en-proteinas', 'menu infantil': 'menu-infantil', 'agridulce': 'agridulce',
            'comida real': 'comida-real',
            'carnes': 'carnes', 'cafe': 'cafe', 'bebida': 'bebida'
        };
        return map[normalized] || normalized.replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    },

    getFilterLabel(value) {
        const key = this.normalizeFilterValue(value);
        const tDict = FILTER_DICTIONARY[key] || {};
        const t = I18N[this.currentLang] || I18N['es'];
        return tDict[this.currentLang] || tDict.es || value || t.defaultTag || 'Etiqueta';
    },

    getFilterIcon(value) {
        const key = this.normalizeFilterValue(value);
        // Mismos iconos que ya usa el wizard al crear el plato, para que el hostelero reconozca
        // en la web exactamente lo mismo que eligió al editar.
        const map = {
            gluten: '🌾', lacteos: '🥛', 'frutos-secos': '🌰', soja: '🌱', huevo: '🥚',
            pescado: '🐟', marisco: '🦐', crustaceos: '🦀', moluscos: '🐚', cacahuetes: '🥜',
            apio: '🌿', mostaza: '🌼', sesamo: '🌾', sulfitos: '🧂', altramuces: '🫘',
            fructosa: '🍎', sorbitol: '🍬', plv: '🌿', glutamato: '🧂',
            'sin-gluten': '🚫🌾', 'sin-lactosa': '🥛🚫', vegano: '🌱', vegetariano: '🥬',
            picante: '🌶️', 'muy-picante': '🌶️🌶️', halal: '🕌', 'sin-cerdo': '🐖🚫',
            kosher: '✡️', keto: '🥑', 'sin-azucar-anadido': '🍭🚫', 'bajo-en-grasas': '🥄',
            ecologico: '🌿', 'km-0': '📍', 'alto-en-proteinas': '💪', 'menu-infantil': '👶',
            agridulce: '🍋', 'comida-real': '🍽️',
            carnes: '🥩', cafe: '☕', bebida: '🥤'
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
        return [...options].filter(Boolean);
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

    getCategoryIconForName(categoryName) {
        const menus = this.getScopedMenusForFilters();
        for (const menu of menus) {
            const trans = menu.traducciones?.[this.currentLang] || menu.traducciones?.[Object.keys(menu.traducciones || {})[0]];
            const cat = (trans?.categorias || []).find(c => String(c.nombre) === categoryName);
            if (cat?.key) {
                const parts = String(cat.key).split('::');
                const subSlug = parts[parts.length - 1];
                if (CATEGORY_ICONS[subSlug]) return CATEGORY_ICONS[subSlug];
                if (CATEGORY_ICONS[parts[0]]) return CATEGORY_ICONS[parts[0]];
            }
        }
        return '🍽️';
    },

    renderFilterBar() {
        const t = I18N[this.currentLang] || I18N['es'];
        const options = this.getAvailableFilterOptions();
        this.filterOptions = options;
        this.dom.filterBarContainer.innerHTML = '';
        this.dom.filterBarContainer.style.display = 'none';

        const chips = [];
        if (this.selectedCategory) {
            chips.push(`<button type="button" class="filter-pill active" onclick='app.selectedCategory = null; app.pendingSelectedCategory = null; app.refreshCurrentView(); app.renderFilterBar();'>🍽️ ${this.escapeHTML(this.selectedCategory)}</button>`);
        }
        this.selectedFilters.forEach(filter => {
            chips.push(`<button type="button" class="filter-pill active" onclick='app.selectedFilters = app.selectedFilters.filter(f => f !== ${JSON.stringify(filter)}); app.pendingSelectedFilters = [...app.selectedFilters]; app.refreshCurrentView(); app.renderFilterBar();'>${this.escapeHTML(this.getFilterIcon(filter))} ${this.escapeHTML(this.getFilterLabel(filter))}</button>`);
        });
        if (this.minPrice != null || this.maxPrice != null) {
            const priceLabel = this.minPrice != null && this.maxPrice != null
                ? `${this.formatPrice(this.minPrice)} – ${this.formatPrice(this.maxPrice)}`
                : this.maxPrice != null ? `≤ ${this.formatPrice(this.maxPrice)}` : `≥ ${this.formatPrice(this.minPrice)}`;
            chips.push(`<button type="button" class="filter-pill active" onclick="app.minPrice = null; app.maxPrice = null; app.pendingMinPrice = null; app.pendingMaxPrice = null; app.refreshCurrentView(); app.renderFilterBar();">💸 ${this.escapeHTML(priceLabel)}</button>`);
        }

        if (!chips.length) return;

        this.dom.filterBarContainer.innerHTML = `
            <div style="display:flex; flex-wrap:wrap; gap:8px; align-items:center;">
                ${chips.join('')}
                <button type="button" class="filter-pill filter-btn-clear-inline" onclick="app.clearSearchAndFilters(); app.refreshCurrentView(); app.renderFilterBar();">${this.escapeHTML(t.filterClear || 'Limpiar')}</button>
            </div>
        `;
        this.dom.filterBarContainer.style.display = 'flex';
    },

    renderFilterModal() {
        const t = I18N[this.currentLang] || I18N['es'];
        const categories = this.getAvailableCategories();
        
        const categoryHtml = categories.length ? `
            <div class="filter-section-card">
                <div class="filter-section-title">${this.escapeHTML(t.filterCategoriesTitle || 'Categorías')}</div>
                <div style="display: flex; flex-direction: column; gap: 8px;">
                    ${categories.map(category => {
                        const isActive = this.pendingSelectedCategory === category;
                        const icon = this.getCategoryIconForName(category);
                        return `
                        <button type="button" class="filter-option-btn ${isActive ? 'active' : ''}" style="width: 100%; display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; text-align: left;" onclick='app.togglePendingCategory(${JSON.stringify(category)})'>
                            <span class="filter-option-label" style="display: flex; align-items: center; gap: 10px; overflow: hidden;"><span class="filter-option-icon">${icon}</span><span style="white-space: normal; word-break: break-word;">${this.escapeHTML(category)}</span></span>
                            <span class="filter-count-badge" style="${isActive ? 'background: rgba(255,255,255,0.25); color: inherit;' : ''}">${this.getCategoryDishCount(category)}</span>
                        </button>
                        `;
                    }).join('')}
                </div>
            </div>
        ` : '';

        const allTagKeys = Object.keys(FILTER_DICTIONARY);
        const availableTags = this.getAvailableFilterOptions();
        
        const orderedTags = allTagKeys.sort((a, b) => {
            const aAvail = availableTags.includes(a);
            const bAvail = availableTags.includes(b);
            if (aAvail !== bAvail) return aAvail ? -1 : 1;
            return this.getFilterLabel(a).localeCompare(this.getFilterLabel(b));
        });

        const tagsHtml = `
            <div class="filter-section-card">
                <div class="filter-section-title">${this.escapeHTML(t.filterTagsTitle || 'Etiquetas y alergias')}</div>
                <div class="filter-option-grid" style="display:flex; flex-wrap: wrap;">
                    ${orderedTags.map(opt => {
                        const isAvailable = availableTags.includes(opt);
                        const isActive = this.pendingSelectedFilters.includes(opt);
                        if(isAvailable) {
                            return `
                            <button type="button" class="filter-pill filter-chip-card ${isActive ? 'active' : ''}" onclick='app.togglePendingFilter(${JSON.stringify(opt)})'>
                                <span class="filter-chip-icon">${this.escapeHTML(this.getFilterIcon(opt))}</span>
                                <span>${this.escapeHTML(this.getFilterLabel(opt))}</span>
                            </button>
                            `;
                        } else {
                            return `
                            <button type="button" class="filter-pill filter-chip-card disabled-chip" disabled>
                                <span class="filter-chip-icon" style="filter: grayscale(100%); opacity: 0.5;">${this.escapeHTML(this.getFilterIcon(opt))}</span>
                                <span style="opacity: 0.5;">${this.escapeHTML(this.getFilterLabel(opt))}</span>
                            </button>
                            `;
                        }
                    }).join('')}
                </div>
            </div>
        `;

        const priceHtml = `
            <div class="filter-section-card">
                <div class="filter-section-title">${this.escapeHTML(t.filterPriceTitle || 'Rango de precio')}</div>
                <div class="price-input-group">
                    <input type="number" inputmode="decimal" class="price-input" placeholder="${this.escapeHTML(t.filterMinPrice || 'Mínimo')}" value="${this.pendingMinPrice !== null ? this.pendingMinPrice : ''}" oninput="app.updateTempPrice('min', this.value)">
                    <span class="price-separator">-</span>
                    <input type="number" inputmode="decimal" class="price-input" placeholder="${this.escapeHTML(t.filterMaxPrice || 'Máximo')}" value="${this.pendingMaxPrice !== null ? this.pendingMaxPrice : ''}" oninput="app.updateTempPrice('max', this.value)">
                </div>
            </div>
        `;
        
        this.dom.filterModalTitle.textContent = t.filterButtonTitle || 'Filtrar platos';
        this.dom.filterModalOptions.innerHTML = `<div class="filter-accordion">${categoryHtml}${tagsHtml}${priceHtml}</div>`;
        this.updateFilterModalFooter();
    },

    updateFilterModalFooter() {
        const t = I18N[this.currentLang] || I18N['es'];
        let matchingDishesCount = 0;
        (this.data?.menus || []).forEach(m => {
            const trans = m.traducciones?.[this.currentLang] || m.traducciones?.[Object.keys(m.traducciones || {})[0]];
            (trans?.categorias || []).forEach(c => {
                (c.platos || []).forEach(p => {
                    if (this.shouldShowDish(p, true)) matchingDishesCount++;
                });
            });
        });

        const activeCount = [this.pendingSelectedCategory].filter(Boolean).length + this.pendingSelectedFilters.length + (this.pendingMinPrice != null || this.pendingMaxPrice != null ? 1 : 0);
        
        const modalFooter = document.querySelector('#filter-modal .filter-modal-footer');
        if (modalFooter) {
            modalFooter.innerHTML = `
                ${activeCount > 0 
                    ? `<button type="button" class="filter-btn-clear-link" onclick="app.clearTempFilters()">${this.escapeHTML(t.filterClear || 'Limpiar')}</button>` 
                    : `<div style="width: 80px;"></div>`
                }
                <button type="button" class="filter-cta-btn primary" onclick="app.applyCurrentFiltersAndClose()">
                    ${this.escapeHTML(t.applyFilters || 'Mostrar resultados')} (${matchingDishesCount})
                </button>
            `;
        }
    },

    shouldShowDish(dish, isTemp = false) {
        const cat = isTemp ? this.pendingSelectedCategory : this.selectedCategory;
        const filters = isTemp ? this.pendingSelectedFilters : this.selectedFilters;
        const minP = isTemp ? this.pendingMinPrice : this.minPrice;
        const maxP = isTemp ? this.pendingMaxPrice : this.maxPrice;

        if (cat) {
            const categoryName = this.getCurrentCategoryNameForDish(dish);
            if (categoryName !== cat) return false;
        }
        if (filters && filters.length > 0) {
            const dishValues = new Set(this.getDishFilterValues(dish));
            if (!filters.every(filter => dishValues.has(filter))) return false;
        }
        if (minP != null && typeof dish.precio === 'number' && dish.precio < minP) return false;
        if (maxP != null && typeof dish.precio === 'number' && dish.precio > maxP) return false;
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

    getDestacadoBadgeHTML(dish) {
        if (!dish.destacado) return '';
        const t = I18N[this.currentLang] || I18N['es'];
        const map = {
            recomendado: { icon: '⭐', label: t.highlightRecommended || 'Recomendado', cls: 'badge-recomendado' },
            popular:     { icon: '🔥', label: t.highlightPopular || 'Más pedido',      cls: 'badge-popular' },
            nuevo:       { icon: '🆕', label: t.highlightNew || 'Nuevo',               cls: 'badge-nuevo' }
        };
        const cfg = map[dish.destacado];
        if (!cfg) return '';
        return `<span class="dish-highlight-badge ${cfg.cls}">${cfg.icon} ${this.escapeHTML(cfg.label)}</span>`;
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
        
        // 1. Si tiene ID directo en el diccionario de traducciones
        const translationKey = note?.id ? NOTE_TRANSLATION_KEYS[note.id] : '';
        const translatedByKey = translationKey ? dictionary[translationKey] : '';
        if (translatedByKey) return translatedByKey;

        // 2. Si tiene traducciones específicas incrustadas
        if (note?.traducciones?.[lang]) return note.traducciones[lang];

        // 3. Traductor automático / Fallback inteligente para etiquetas de texto plano comunes
        const rawLabel = (note?.label || note?.displayLabel || note?.recipientLabel || (typeof note === 'string' ? note : '')).trim();
        if (rawLabel) {
            const normalizedTextMap = {
                "poco hecho": "quickNotePocoHecho",
                "sin sal": "quickNoteSinSal",
                "salsa aparte": "quickNoteSalsaAparte",
                "sin picante": "quickNoteSinPicante",
                "sin gluten": "quickNoteSinGluten",
                "sin cebolla": "quickNoteSinCebolla",
                "sin tomate": "quickNoteSinTomate",
                "sin aceite": "quickNoteSinAceite",
                "sin queso": "quickNoteSinQueso",
                "sin nueces": "quickNoteSinNueces",
                "sin alérgenicos": "quickNoteSinAlergenicos",
                "muy hecho": "quickNoteMuyHecho",
                "con salsa": "quickNoteConSalsa",
                "extra picante": "quickNoteExtraPicante",
                "sin cilantro": "quickNoteSinCilantro",
                "sin pepinillos": "quickNoteSinPepinillos",
                "al punto menos": "quickNoteAlPuntoMenos",
                "al punto": "quickNoteAlPunto",
                "al punto más": "quickNoteAlPuntoMas",
                "limpio de espinas": "quickNoteLimpioEspinas",
                "sin piel": "quickNoteSinPiel",
                "cortado en trozos pequeños": "quickNoteTrozosPequenos",
                "poca sal": "quickNotePocaSal",
                "poco picante": "quickNotePocoPicante",
                "extra de salsa": "quickNoteExtraSalsa",
                "sin aliñar": "quickNoteSinAlinar",
                "sin vinagre": "quickNoteSinVinagre",
                "sin ajo": "quickNoteSinAjo",
                "sin mayonesa": "quickNoteSinMayonesa",
                "sin kétchup": "quickNoteSinKetchup",
                "sin mostaza": "quickNoteSinMostaza",
                "para compartir al centro": "quickNoteCompartirCentro",
                "traer platos extra": "quickNotePlatosExtra",
                "cortado por la mitad": "quickNoteCortadoMitad",
                "pan muy tostado": "quickNotePanMuyTostado",
                "pan poco tostado": "quickNotePanPocoTostado",
                "con hielo": "quickNoteConHielo",
                "poco hielo": "quickNotePocoHielo",
                "sin hielo": "quickNoteSinHielo",
                "del tiempo": "quickNoteDelTiempo",
                "muy frío": "quickNoteMuyFrio",
                "con sacarina": "quickNoteConSacarina",
                "sin azúcar": "quickNoteSinAzucar",
                "con leche fría": "quickNoteConLecheFria",
                "con leche templada": "quickNoteConLecheTemplada",
                "traer primero lo de los niños": "quickNoteNinosPrimero",
                "traer todo a la vez": "quickNoteTodoALaVez",
                "para llevar": "quickNoteParaLlevar",
                "con cubiertos": "quickNoteConCubiertos",
                "sin cubiertos": "quickNoteSinCubiertos",
                "sin pimiento": "quickNoteSinPimiento",
                "sin champiñones": "quickNoteSinChampiniones",
                "sin aceitunas": "quickNoteSinAceitunas"
            };

            const lowerKey = rawLabel.toLowerCase();
            const mappedKey = normalizedTextMap[lowerKey];
            if (mappedKey && dictionary[mappedKey]) {
                return dictionary[mappedKey];
            }
            return rawLabel; // Si es una nota totalmente personalizada escrita a mano
        }

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
        // Todo el mensaje debe ir en el idioma del hostelero (t_wa), no en el idioma en el que
        // el cliente está navegando la carta -si no, el mensaje le llega mezclado en dos idiomas-.
        const total = this.cart.reduce((sum, item) => sum + (item.precio * item.quantity), 0);
        const notes = (this.selectedQuickNotes.length ? this.selectedQuickNotes : (this.orderNotes ? [{ displayLabel: this.orderNotes, recipientLabel: this.orderNotes }] : [])).map(note => note.recipientLabel || note.displayLabel || '').filter(Boolean);
        const noteText = notes.join(' • ');

        let message = `${t_wa.header.replace('{table}', selectedTable)}\n\n${t_wa.orderIntro || '🛎️ Nuevo pedido'}`;
        message += `\n\n${t_wa.orderSection || '🧾 Pedido:'}\n${orderItems}`;
        if (noteText) {
            message += `\n\n${t_wa.orderNotes || '📝 Notas:'} ${noteText}`;
        }
        message += `\n\n${t_wa.orderTotal || '💳 Total:'} ${this.formatPrice(total)}`;
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

        // El nombre ya viene traducido por idioma desde la app -incluido el genérico por
        // defecto si el hostelero no lo ha personalizado-, así que se usa siempre que exista.
        // Antes esto se ignoraba del todo para normal/diario/especial y SIEMPRE se forzaba la
        // etiqueta genérica: renombrar la carta no tenía ningún efecto en la web pública.
        let trans = menu.traducciones?.[this.currentLang];
        if (!trans && menu.traducciones) {
            trans = menu.traducciones[Object.keys(menu.traducciones)[0]];
        }
        if (trans?.nombreCarta) return trans.nombreCarta;

        if (tipo === 'diario') return t["menu_diario"] || "📅 Menú del Día";
        if (tipo === 'especial') return t["menu_especial"] || "🕐 Cartas por Horario";
        if (tipo === 'normal') return t["menu_normal"] || t.defaultMenu || "📋 Carta Principal";

        return menu.nombreCarta || t.defaultMenu;
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
                    t.confirmationTitle || "¿Continuar sin selección?", 
                    (t.incompleteOrderMsg || "Te falta seleccionar: {list}. ¿Seguro que quieres continuar?").replace('{list}', missing.join(', '))
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
        const confModal = this.dom.confModal || document.getElementById('confirmation-modal');
        if (!confModal) return;

        // Cerrar el carrito para que no tape el modal de confirmación de geolocalización
        this.dom.cartModal.classList.remove('active');

        const titleEl = document.getElementById('conf-title');
        const msgEl = document.getElementById('conf-msg');
        if (titleEl) titleEl.textContent = title || t.confDefaultTitle || '¿Estás seguro?';
        if (msgEl) msgEl.textContent = message || '';
        
        const cancelBtn = document.getElementById('conf-btn-cancel') || confModal.querySelector('.secondary');
        const acceptBtn = document.getElementById('conf-btn-accept') || confModal.querySelector('.primary');
        
        if (cancelBtn) {
            cancelBtn.style.display = 'block';
            cancelBtn.textContent = t.btnCancel || 'Cancelar';
        }
        if (acceptBtn) {
            acceptBtn.textContent = t.btnAccept || 'Continuar';
            acceptBtn.onclick = () => app.confirmAction();
        }
        
        confModal.style.zIndex = "999999";
        confModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    },

    openAlert(title, message) {
        const t = I18N[this.currentLang] || I18N['es'];
        const confModal = this.dom.confModal || document.getElementById('confirmation-modal');
        if (!confModal) return;

        this.dom.cartModal.classList.remove('active');

        const titleEl = document.getElementById('conf-title');
        const msgEl = document.getElementById('conf-msg');
        if (titleEl) titleEl.textContent = title || t.errorTitle || 'Aviso';
        if (msgEl) msgEl.textContent = message || '';
        
        const cancelBtn = document.getElementById('conf-btn-cancel') || confModal.querySelector('.secondary');
        const acceptBtn = document.getElementById('conf-btn-accept') || confModal.querySelector('.primary');
        
        if (cancelBtn) cancelBtn.style.display = 'none';
        if (acceptBtn) {
            acceptBtn.textContent = t.cookieBtn || 'Aceptar'; 
            acceptBtn.onclick = () => {
                app.closeConfirmation();
                app.openCart();
            };
        }
        
        confModal.style.zIndex = "999999";
        confModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    },

    closeConfirmation() {
        const confModal = this.dom.confModal || document.getElementById('confirmation-modal');
        if (confModal) confModal.classList.remove('active');
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

        if (menus.length === 1 && !this.searchQuery && menus[0].disponible !== false) {
            this.navigateToMenu(menus[0].id);
            this.dom.btnBack.style.display = 'none';
            return;
        }

        let html = '<div class="menu-grid">';
        menus.forEach(menu => {
            const isAvailable = menu.disponible !== false;
            const tipo = (menu.tipoMenu || menu.tipo || 'normal').toLowerCase();
            const noCacheImg = menu.imagenPortada || `${DEFAULT_COVERS[tipo] || DEFAULT_COVERS.normal}?t=${this.sessionTimestamp}`;
            const menuName = this.getMenuTitle(menu);

            html += `
                <div class="menu-card fade-in-slide ${isAvailable ? '' : 'disabled-item'}" ${isAvailable ? `onclick="app.navigateToMenu('${menu.id}')"` : ''}>
                    <img class="menu-card-img" src="${noCacheImg}" alt="${this.escapeHTML(menuName)}" loading="lazy">
                    <div class="menu-card-overlay">
                        <h2 class="menu-card-title">${this.escapeHTML(menuName)}</h2>
                        ${!isAvailable ? `<div class="unavailable-badge" style="position: absolute; top: 12px; right: 12px; z-index: 10;">${this.escapeHTML(t.filterUnavailable || 'No disponible')}</div>` : ''}
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
                    if (this.shouldShowDish(dish, false)) count += 1;
                });
            });
        });
        return count;
    },

    renderMenu(menuId) {
        const menu = this.data.menus.find(m => m.id === menuId);
        if (!menu || menu.disponible === false) return this.navigateHome();
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
            
            const heroImage = menu.imagenPortada
                || ((menu.recursos?.imagenes && Object.keys(menu.recursos.imagenes).length > 0)
                    ? Object.values(menu.recursos.imagenes)[0]
                    : coverImg);

            const hasHeroImg = heroImage && heroImage.trim() !== '';
            // Los data: URI no admiten query-string de cache-busting -romperían el base64-, solo se añade a rutas de fichero.
            const heroImageWithCache = hasHeroImg
                ? (heroImage.startsWith('data:') ? heroImage : `${heroImage}?t=${this.sessionTimestamp}`)
                : '';
            
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
        } else if (menu.imagenPortada) {
            // Menús normal/especial no tenían ningún hueco de portada -solo el selector de
            // menú-, así que si el hostelero subió una propia se muestra aquí, al entrar.
            const heroWithCache = menu.imagenPortada.startsWith('data:') ? menu.imagenPortada : `${menu.imagenPortada}?t=${this.sessionTimestamp}`;
            html += `
                <div class="menu-hero-banner fade-in-slide">
                    <img src="${this.escapeHTML(heroWithCache)}" alt="${this.escapeHTML(this.getMenuTitle(menu))}" onerror="this.parentElement.style.display='none'">
                    <div class="menu-hero-overlay"><h2>${this.escapeHTML(this.getMenuTitle(menu))}</h2></div>
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
            
            const isFirstTab = tabsHtml === '';
            tabsHtml += `<div class="category-tab${isFirstTab ? ' active' : ''}" data-target="${categorySlug}">${this.escapeHTML(translatedCatName)}<span class="tab-count">${visibleDishes.length}</span></div>`;

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
        // "threshold: 0.6" exigía ver el 60% de TODA la sección a la vez para marcarla activa.
        // Con las tarjetas de plato grandes, una categoría con varios platos es más alta que la
        // pantalla y nunca llega a ese 60% -ninguna pestaña se activaba nunca-. Se usa el patrón
        // scrollspy estándar: una franja fina cerca de la cabecera, la última categoría cuyo
        // borde superior la cruza es la activa.
        const observerOptions = {
            root: null,
            rootMargin: `-${this.dom.header.offsetHeight + 15}px 0px -70% 0px`,
            threshold: 0
        };
        this.categoryTabsObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                const id = entry.target.getAttribute('id');
                document.querySelectorAll('.category-tab').forEach(t => t.classList.remove('active'));
                const tab = document.querySelector(`.category-tab[data-target="${id}"]`);
                if (tab) {
                    tab.classList.add('active');
                    tab.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                }
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
        const t = I18N[this.currentLang] || I18N['es'];
        const isAvailable = dish.disponible !== false;
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
        if (!isAvailable) {
            actionButton = `<div style="font-size: 0.75em; color: #ef4444; font-weight: bold; text-transform: uppercase;">${this.escapeHTML(t.filterUnavailable || 'No disponible')}</div>`;
        } else if (isDailyMenu) {
            actionButton = `<button class="dish-add-btn ${isSelected ? 'success' : ''}" onclick="event.stopPropagation(); app.selectDailyDish('${menuId}', ${catIndex}, ${dishIndex});">${isSelected ? '✓' : '○'}</button>`;
        } else if (this.whatsapp.enabled) {
            actionButton = `<button class="dish-add-btn" onclick="event.stopPropagation(); app.addToCart('${safeCartData}', event.currentTarget);">+</button>`;
        } else {
            actionButton = `<div class="dish-action-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg></div>`;
        }

        let bottomRowHTML = '';
        if (isDailyMenu) {
            const statusLabel = !isAvailable ? (t.filterUnavailable || 'No disponible') : (isSelected ? (t.dishSelected || 'Seleccionado') : (t.dishTapToChoose || 'Pulsa para elegir'));
            bottomRowHTML = `
            <div class="dish-bottom-row">
                <div class="dish-price" style="font-size:0.85em; color:var(--text-muted-light);">${statusLabel}</div>
                ${actionButton}
            </div>`;
        } else {
            bottomRowHTML = `
            <div class="dish-bottom-row">
                <div class="dish-price">${safePrice} ${sourceMenuName ? `<span class="dish-source-badge">${this.escapeHTML(sourceMenuName)}</span>` : ''}</div>
                ${actionButton}
            </div>`;
        }

        // fade-in plato a plato -antes solo la sección de categoría entera aparecía de golpe al
        // llegar a ella, aquí cada plato entra por separado según se va viendo, mismo observer
        // que ya usan las tarjetas de menú y las categorías-. Clase aparte (solo opacidad, sin
        // transform) para no chocar con el "transform" que ya usa .dish al hacer hover.
        const baseCardClass = isDailyMenu && isSelected ? 'dish selected-daily-dish fade-in' : 'dish fade-in';
        const cardClass = isAvailable ? baseCardClass : `${baseCardClass} disabled-item`;
        const destacadoHTML = isAvailable ? this.getDestacadoBadgeHTML(dish) : '';

        return `
            <div class="${cardClass}" ${isAvailable ? `onclick="${isDailyMenu ? `app.selectDailyDish('${menuId}', ${catIndex}, ${dishIndex})` : `app.openModal('${safeModalData}')`}"` : ''}>
                ${destacadoHTML}
                ${imgUrl ? `<img class="dish-img" src="${imgUrl}" loading="lazy" onerror="this.style.display='none'">` : ''}
                <div class="dish-details">
                    <div class="dish-name">${safeName} ${!isAvailable ? `<span class="unavailable-badge">${this.escapeHTML(t.filterUnavailable || 'No disponible')}</span>` : ''}</div>
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

    async printFullMenu() {
        const rInfo = this.data?.restaurantInfo || {};
        const menus = this.getPrintableMenus();
        const t = I18N[this.currentLang] || I18N['es'];
        
        const loadingMsg = t.generatingPdf || 'Generando PDF, por favor espera...';
        
        const overlay = document.createElement('div');
        overlay.id = 'pdf-loading-overlay';
        overlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15, 23, 42, 0.9); color:#fff; display:flex; flex-direction:column; justify-content:center; align-items:center; z-index:999999;';
        
        overlay.innerHTML = `
            <style>
                @keyframes pdf-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                .pdf-spinner { width: 50px; height: 50px; border: 4px solid rgba(255,255,255,0.3); border-top: 4px solid #4f46e5; border-radius: 50%; animation: pdf-spin 1s linear infinite; margin-bottom: 20px; }
                .pdf-loading-title {
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif;
                    margin: 0;
                    font-size: 1.2rem;
                    text-align: center;
                    padding: 0 20px;
                }
            </style>
            <div class="pdf-spinner"></div>
            <h2 class="pdf-loading-title">${this.escapeHTML(loadingMsg)}</h2>
        `;
        document.body.appendChild(overlay);
        document.body.style.overflow = 'hidden';

        const removeOverlay = () => {
            const overlayEl = document.getElementById('pdf-loading-overlay');
            if (overlayEl) {
                overlayEl.remove();
                document.body.style.overflow = '';
            }
        };

        if (typeof html2pdf === 'undefined') {
            try {
                await new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
                    script.onload = resolve;
                    script.onerror = reject;
                    document.head.appendChild(script);
                });
            } catch (e) {
                removeOverlay();
                if (this.dom.toastText) this.dom.toastText.textContent = t.pdfError || 'Error';
                if (this.dom.toast) this.dom.toast.classList.add('show');
                setTimeout(() => this.dom.toast?.classList.remove('show'), 3000);
                return;
            }
        }

        const langAttr = this.currentLang === 'cn' ? 'zh-CN' : (this.currentLang === 'sa' ? 'ar' : this.currentLang);

        let printHTML = `
            <style>
                .pdf-wrapper { 
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", "WenQuanYi Micro Hei", sans-serif; 
                    color: #0f172a; 
                    background: #fff; 
                    padding: 5mm; 
                }
                .pdf-page-section { page-break-after: always; margin-bottom: 20px; }
                .pdf-page-section:last-child { page-break-after: avoid; margin-bottom: 0; }
                .pdf-header-top { text-align: center; margin-bottom: 20px; }
                .pdf-header-top img { max-width: 80px; max-height: 80px; margin-bottom: 10px; border-radius: 50%; object-fit: cover; }
                .pdf-header-top h1 { font-size: 24px; margin: 0 0 5px 0; font-weight: 800; color: #0f172a; }
                .pdf-header-top p { font-size: 14px; margin: 0; color: #64748b; }
                .pdf-menu-title-box { background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px; text-align: center; font-size: 16px; font-weight: 800; margin-bottom: 20px; border-radius: 8px; text-transform: uppercase; color: #334155; }
                .pdf-cat-title { font-size: 18px; font-weight: 800; margin: 20px 0 12px 0; border-bottom: 2px solid #4f46e5; padding-bottom: 5px; color: #1e293b; page-break-after: avoid; }
                .pdf-dish-row { display: flex; align-items: flex-start; margin-bottom: 12px; page-break-inside: avoid; }
                .pdf-dish-thumb { width: 40px; height: 40px; object-fit: cover; border-radius: 6px; margin-right: 12px; flex-shrink: 0; }
                .pdf-dish-info { flex-grow: 1; padding-right: 10px; }
                .pdf-dish-name { margin: 0; font-size: 15px; font-weight: 700; color: #0f172a; }
                .pdf-dish-desc { margin: 4px 0 0 0; font-size: 12px; color: #64748b; line-height: 1.4; }
                .pdf-dish-dots { flex-grow: 1; border-bottom: 1px dotted #cbd5e1; margin: 0 10px 6px 0; opacity: 0.5; }
                .pdf-dish-price { font-size: 15px; font-weight: 800; white-space: nowrap; margin-top: 2px; color: #0f172a; }
                .pdf-brand-footer { margin-top: 30px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px dashed #e2e8f0; padding-top: 15px; page-break-inside: avoid; }
            </style>
            <div class="pdf-wrapper" lang="${langAttr}">
        `;

        menus.forEach((menu) => {
            let trans = menu.traducciones?.[this.currentLang];
            if (!trans && menu.traducciones) {
                trans = menu.traducciones[Object.keys(menu.traducciones)[0]];
            }

            const menuName = trans?.nombreCarta || this.getMenuTitle(menu);
            const isDaily = this.isDailyMenu(menu);
            const globalPrice = isDaily ? this.formatPrice(typeof menu.precio === 'number' ? menu.precio : 0) : null;
            
            printHTML += `<div class="pdf-page-section">`;

            printHTML += `
                <div class="pdf-header-top">
                    ${rInfo.logoBase64 ? `<img src="${rInfo.logoBase64}" onerror="this.style.display='none'">` : ''}
                    <h1>${this.escapeHTML(rInfo.nombre || t.defaultRestaurant)}</h1>
                    ${rInfo.direccion || rInfo.telefono ? `<p>${this.escapeHTML(rInfo.direccion || '')} ${rInfo.direccion && rInfo.telefono ? '&bull;' : ''} ${this.escapeHTML(rInfo.telefono || '')}</p>` : ''}
                </div>
                
                <div class="pdf-menu-title-box">
                    <span>${this.escapeHTML(menuName)}</span>
                    ${isDaily && menu.precio > 0 ? `<br><span style="font-size: 0.85em; font-weight: normal; color: #475569;">Total: ${globalPrice}</span>` : ''}
                </div>
            `;
            
            const images = menu.recursos?.imagenes || {};

            if (trans && trans.categorias) {
                trans.categorias.forEach((cat) => {
                    if (cat.platos && cat.platos.length > 0) {
                        const catName = this.getCategoryName(cat.key, cat.nombre);
                        printHTML += `<div class="pdf-cat-title">${this.escapeHTML(catName)}</div>`;
                        
                        cat.platos.forEach(dish => {
                            const isDishZero = !dish.precio || dish.precio === 0;
                            const hidePrice = isDaily && isDishZero;
                            const priceFormatted = hidePrice ? '' : this.formatPrice(dish.precio);
                            const imgUrl = dish.idImagen ? images[dish.idImagen] : '';
                            
                            printHTML += `
                                <div class="pdf-dish-row">
                                    ${imgUrl ? `<img src="${imgUrl}" class="pdf-dish-thumb" crossorigin="anonymous" onerror="this.style.display='none'">` : ''}
                                    <div class="pdf-dish-info">
                                        <p class="pdf-dish-name">${this.escapeHTML(dish.nombre)}</p>
                                        ${dish.descripcion ? `<p class="pdf-dish-desc">${this.escapeHTML(dish.descripcion)}</p>` : ''}
                                    </div>
                                    ${!hidePrice ? `<div class="pdf-dish-dots"></div><div class="pdf-dish-price">${priceFormatted}</div>` : ''}
                                </div>
                            `;
                        });
                    }
                });
            }

            if (!this.data?.restaurantInfo?.sinMarca) {
                printHTML += `
                    <div class="pdf-brand-footer">
                        <span>${t.pdfFooter || 'Menú digital interactivo generado con MenuForge App'}</span>
                    </div>
                `;
            }

            printHTML += `</div>`;
        });
        
        printHTML += `</div>`;

        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = printHTML;

        const fileName = `${this.slugify(rInfo.nombre || 'menu')}.pdf`;

        const opt = {
            margin:       10,
            filename:     fileName,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true, letterRendering: true },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        html2pdf().set(opt).from(tempContainer).save().then(() => {
            removeOverlay();
        }).catch(err => {
            console.error('Error generando PDF:', err);
            removeOverlay();
            if (this.dom.toastText) this.dom.toastText.textContent = t.pdfError || 'Error al generar el PDF';
            if (this.dom.toast) this.dom.toast.classList.add('show');
            setTimeout(() => this.dom.toast?.classList.remove('show'), 3000);
        });
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
        
        this.dom.orderNotesInput.readOnly = true;
        this.dom.orderNotesInput.style.backgroundColor = 'var(--bg-input-disabled, #f1f5f9)';
        this.dom.orderNotesInput.style.color = 'var(--text-muted, #64748b)';
        this.dom.orderNotesInput.style.cursor = 'not-allowed';
        
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

    getUserLocation() {
        const t = I18N[this.currentLang] || I18N['es'];
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error(t.locationNotSupported || 'Geolocalización no soportada.'));
            } else {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        resolve({
                            lat: position.coords.latitude,
                            lng: position.coords.longitude
                        });
                    },
                    (error) => {
                        let errorMsg = t.locationError || 'Error al obtener la ubicación.';
                        if (error.code === error.PERMISSION_DENIED) {
                            errorMsg = t.locationDenied || 'Se denegó el acceso a la ubicación. Es necesario para verificar la distancia.';
                        }
                        reject(new Error(errorMsg));
                    },
                    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
                );
            }
        });
    },

    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371e3;
        const p1 = lat1 * Math.PI/180;
        const p2 = lat2 * Math.PI/180;
        const dp = (lat2-lat1) * Math.PI/180;
        const dl = (lon2-lon1) * Math.PI/180;

        const a = Math.sin(dp/2) * Math.sin(dp/2) +
                  Math.cos(p1) * Math.cos(p2) *
                  Math.sin(dl/2) * Math.sin(dl/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c; 
    },

    async sendOrder() {
        const selectedTable = this.dom.tableSelector.value;
        const t_wa = I18N_WHATSAPP[this.whatsapp.msgLang] || I18N_WHATSAPP['es'];
        const t = I18N[this.currentLang] || I18N['es'];
        
        if (this.cart.length === 0) {
            this.openAlert(t.errorTitle || 'Error', t.cartEmptySelectMsg || t.cartEmpty);
            return;
        }
        if (!selectedTable) {
            this.openAlert(t.errorTitle || 'Error', t.noTable || t_wa.noTable);
            return;
        }

        const processWhatsAppOrder = () => {
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
        };

        const rInfo = this.data?.restaurantInfo || {};
        const waConfig = rInfo.whatsappOrderConfig || {};
        const isDistanceRestrictionEnabled = waConfig.maxDistanceEnabled ?? rInfo.maxDistanceEnabled ?? false;
        
        if (isDistanceRestrictionEnabled && rInfo.latitud && rInfo.longitud) {
            const maxMeters = waConfig.maxDistanceMeters ?? rInfo.maxDistanceMeters ?? 50;
            
            const promptTitle = t.locationPromptTitle || 'Verificar ubicación';
            const promptMsg = (t.locationPromptMsg || 'Para realizar el pedido es necesario comprobar que estás a menos de {meters} metros du restaurante. ¿Deseas activar la localización para enviar el pedido?').replace('{meters}', maxMeters);

            this.confirmationCallback = async () => {
                try {
                    const originalBtnText = this.dom.sendOrderBtn.textContent;
                    this.dom.sendOrderBtn.textContent = t.calculatingDistance || 'Verificando tu ubicación...';
                    this.dom.sendOrderBtn.disabled = true;
                    this.dom.sendOrderBtn.style.opacity = '0.7';

                    const userCoords = await this.getUserLocation();
                    const distance = this.calculateDistance(userCoords.lat, userCoords.lng, rInfo.latitud, rInfo.longitud);

                    this.dom.sendOrderBtn.textContent = originalBtnText;
                    this.dom.sendOrderBtn.disabled = false;
                    this.dom.sendOrderBtn.style.opacity = '1';

                    if (distance > maxMeters) {
                        const errorMsg = (t.distanceExceeded || 'Debes estar a menos de {meters} metros.').replace('{meters}', maxMeters);
                        this.openAlert(t.gpsErrorTitle || 'Fuera de rango', errorMsg);
                        return; 
                    }
                    
                    processWhatsAppOrder();

                } catch (error) {
                    this.dom.sendOrderBtn.textContent = t.orderBtn || t_wa.orderBtn;
                    this.dom.sendOrderBtn.disabled = false;
                    this.dom.sendOrderBtn.style.opacity = '1';
                    
                    this.openAlert(t.gpsErrorTitle || 'Error de ubicación', error.message);
                }
            };

            this.openConfirmation(promptTitle, promptMsg);
            return; 
        }

        processWhatsAppOrder();
    },

    updateFlag() { 
        this.dom.currentFlag.src = `assets/flags/${this.currentLang}.png`; 
    },
    
    // Mismos presets que THEME_PRESETS en el lado Angular (theme-presets.ts) -mantener en sync-.
    // Solo cambia el color de acento (variables CSS), no toca layout ni tipografía, para que
    // cada restaurante no comparta la misma plantilla morada sin ningún esfuerzo.
    BRAND_THEME_PRESETS: {
        clasico:  { accent: '#4f46e5', accentDark: '#7c3aed' },
        playa:    { accent: '#f97316', accentDark: '#fb7185' },
        asiatico: { accent: '#dc2626', accentDark: '#7c2d12' },
        natural:  { accent: '#16a34a', accentDark: '#059669' },
        rustico:  { accent: '#b45309', accentDark: '#ea580c' }
    },

    applyBrandTheme(rInfo) {
        const preset = this.BRAND_THEME_PRESETS[rInfo?.temaVisual] || this.BRAND_THEME_PRESETS.clasico;
        const root = document.documentElement;
        root.style.setProperty('--accent', preset.accent);
        root.style.setProperty('--accent-gradient', `linear-gradient(135deg, ${preset.accent} 0%, ${preset.accentDark} 100%)`);
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
        const elements = document.querySelectorAll('.fade-in-slide, .fade-in');
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
        const t = I18N[this.currentLang] || I18N['es'];

        // Un primer escaneo de QR nunca tiene caché local, así que un fallo puntual del Worker
        // o de la API de GitHub (rate limit, blip transitorio) se veía directamente como error
        // sin ninguna red de seguridad. Reintentamos un par de veces antes de rendirnos -salvo
        // en un 404 real, donde reintentar no sirve de nada porque el archivo no existe-.
        const maxIntentos = 3;
        let ultimoError;
        for (let intento = 1; intento <= maxIntentos; intento++) {
            try {
                const response = await fetch(url);
                if (response.status === 404) throw new Error(t.fetchError);
                if (!response.ok) throw new Error(`HTTP_${response.status}`);

                const rawText = await response.text();
                const decompressed = LZString.decompressFromEncodedURIComponent(rawText);
                return JSON.parse(decompressed || rawText);
            } catch (e) {
                ultimoError = e;
                if (e.message === t.fetchError || intento === maxIntentos) break;
                await new Promise(resolve => setTimeout(resolve, 500 * intento));
            }
        }
        throw new Error(t.fetchError, { cause: ultimoError });
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