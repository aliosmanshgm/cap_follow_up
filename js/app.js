const I18N = {
        tr: {
            loadingText: 'Veriler İşleniyor... Lütfen Bekleyin.',
            appSubtitle: 'Analiz için lütfen Word (.docx) belgelerini yükleyiniz.',
            lblWord: '1️⃣ Orijinal Word Dosyaları (.docx)',
            lblExcel: '2️⃣ Excel Master Veri (.xlsx)'
        },
        en: {
            loadingText: 'Processing Data... Please Wait.',
            appSubtitle: 'Please upload Word (.docx) documents for analysis.',
            lblWord: '1️⃣ Original Word Files (.docx)',
            lblExcel: '2️⃣ Excel Master Data (.xlsx)'
        }
    };
    let currentUiLang = localStorage.getItem('usoapUiLang') === 'en' ? 'en' : 'tr';
    const t = (k) => (I18N[currentUiLang] && I18N[currentUiLang][k]) || k;

    function formatLongEnglishDate(date) {
        if (!date) return '-';
        const dt = (date instanceof Date) ? date : parseDateObj(date);
        if (!dt) return '-';
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        return `${months[dt.getMonth()]} ${dt.getDate()}, ${dt.getFullYear()}`;
    }
    function getLocalizedPqQuestion(master = {}) {
        const en = String(master.soru || master.question || '').trim();
        const tr = String(master.soruTr || master.questionTr || '').trim();
        return currentUiLang === 'tr' ? (tr || en) : (en || tr);
    }
    function getLocalizedPqFinding(master = {}) {
        const en = String(master.bulgu || master.finding || '').trim();
        const tr = String(master.bulguTr || master.findingTr || '').trim();
        return currentUiLang === 'tr' ? (tr || en) : (en || tr);
    }
    function getLoadedPqTranslationStats() {
        const rows = Object.values(pqMasterData || {});
        const q = rows.filter(m => String((m || {}).soruTr || '').trim()).length;
        const f = rows.filter(m => String((m || {}).bulguTr || '').trim()).length;
        const both = rows.filter(m => String((m || {}).soruTr || '').trim() && String((m || {}).bulguTr || '').trim()).length;
        return { total: rows.length, questionTr: q, findingTr: f, both };
    }
    function applyLanguage() {
        document.documentElement.lang = currentUiLang;
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const value = t(key);
            if (value && value !== key) el.textContent = value;
        });
        const langBtn = document.getElementById('globalLangToggleBtn');
        if (langBtn) langBtn.textContent = currentUiLang === 'tr' ? '🌐 PQ Metni: TR' : '🌐 PQ Text: EN';
        updateDynamicSubtitle();
    }
    function refreshPqLanguageSensitiveViews() {
        try { if (typeof render === 'function') render(); } catch (e) { console.warn('Dil sonrası ana görünüm yenilenemedi:', e); }
        try { if (typeof renderIcaoClosedList === 'function') renderIcaoClosedList(); } catch (e) {}
        try {
            if (typeof setIcaoPqTextLanguage === 'function') setIcaoPqTextLanguage(currentUiLang === 'tr' ? 'tr' : 'en');
            else if (typeof renderActiveIcaoPqTextSummary === 'function') renderActiveIcaoPqTextSummary();
        } catch (e) { console.warn('Dil sonrası ICVM PQ görünümü yenilenemedi:', e); }
        try { if (typeof renderVisitScopeCandidates === 'function' && document.getElementById('tab-visit-scope')?.classList.contains('active')) renderVisitScopeCandidates(); } catch (e) {}
    }
    function toggleLang() {
        currentUiLang = currentUiLang === 'tr' ? 'en' : 'tr';
        localStorage.setItem('usoapUiLang', currentUiLang);
        applyLanguage();
        refreshPqLanguageSensitiveViews();
        const s = getLoadedPqTranslationStats();
        const msg = currentUiLang === 'tr'
            ? `PQ metin dili TR. Türkçe veri: soru ${s.questionTr}/${s.total}, bulgu ${s.findingTr}/${s.total}.`
            : `PQ text language EN. Master PQ: ${s.total}.`;
        if (typeof showAppRuntimeToast === 'function') showAppRuntimeToast(msg, currentUiLang === 'tr' && s.both === 0 ? 'warn' : 'info');
    }
    window.toggleLang = toggleLang;
    window.getLocalizedPqQuestion = getLocalizedPqQuestion;
    window.getLocalizedPqFinding = getLocalizedPqFinding;
    window.getLoadedPqTranslationStats = getLoadedPqTranslationStats;

    // Değişkenler
    window.toggleFiltersPanel = function() { document.getElementById('rightFiltersPanel').classList.toggle('open'); };
    window.activeSmartTags = new Set(); 
    let window_loadedReportDate = null; let rawData = []; let pqMasterData = {}; let baseEIData = {}; let loadedFiles = new Set(); let charts = {};
    const chartBarValuePlugin = {
        id: 'chartBarValuePlugin',
        afterDatasetsDraw(chart) {
            // Bu etiketleyici yalnızca ICAO Resmî EI grafiği içindir.
            if (!chart || !chart.canvas || chart.canvas.id !== 'icaoOfficialChartCanvas') return;
            const {ctx} = chart;
            ctx.save();
            chart.data.datasets.forEach((dataset, datasetIndex) => {
                const meta = chart.getDatasetMeta(datasetIndex);
                if (!meta || meta.hidden) return;
                meta.data.forEach((element, index) => {
                    const raw = dataset.data[index];
                    if (raw === null || raw === undefined || raw === '') return;
                    const val = Number(raw);
                    if (!Number.isFinite(val)) return;
                    const pos = element.tooltipPosition();
                    const seriesCount = (chart.data.datasets || []).length;
                    ctx.font = seriesCount >= 4 ? 'bold 8px Arial' : seriesCount === 3 ? 'bold 9px Arial' : 'bold 11px Arial';
                    ctx.fillStyle = '#334155';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'bottom';
                    ctx.fillText(val.toLocaleString('tr-TR', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + '%', pos.x, pos.y - 6);
                });
            });
            ctx.restore();
        }
    };
    // Önceki sürümde global kaydedilmiş olabilecek eklentiyi kaldır.
    if (typeof Chart !== 'undefined' && Chart.registry) {
        const globallyRegisteredValuePlugin = Chart.registry.plugins.get('chartBarValuePlugin');
        if (globallyRegisteredValuePlugin) Chart.unregister(globallyRegisteredValuePlugin);
    }
    let loadedExcelFile = null; let savedManagementNotes = ""; window.currentActiveAreas = []; window.currentFilteredGroups = {}; window.currentAreaSummaryRaw = []; window.loadedWordAreas = new Set(); window.currentAreaEIData = [];
    let dailyReviewedSet = new Set(); let dailyReviewedPQs = new Set(); let dailyPQNotes = {}; let kanbanWorkflowStages = {}; 
    let systemArchives = {}; window.currentTrendData = null; 
    let icaoVisits = {}; let visitFirebaseRef = null; let visitFirebaseCallback = null; let activeVisitRecordId = null;
    let visitUnitSettingsRef = null; let visitUnitSettingsCallback = null; let visitUnitMappings = []; let visitUnitCanonicalUnits = [];
    let activeVisitScopeId = null;
    let visitScopeSelectedPqs = new Set();
    let visitScopeSelectedSteps = new Set();
    let activeVisitWorkspaceId = null;
    let activeVisitWorkspaceTarget = { type:'visit', key:'visit', label:'Ziyaret geneli', pq:'', step:'', snapshot:null };
    let visitWorkspaceDraftTimer = null;
    let activeIcaoOfficialVisitId = null; let activeIcaoValidationPq = null;

    // FIREBASE YAPILANDIRMASI
    const firebaseConfig = { apiKey: "AIzaSyBIey2A-LIZxq3pI2L1HAPUKM1Y46gERwg", authDomain: "icao-cap-takip.firebaseapp.com", databaseURL: "https://icao-cap-takip-default-rtdb.europe-west1.firebasedatabase.app", projectId: "icao-cap-takip", storageBucket: "icao-cap-takip.firebasestorage.app", messagingSenderId: "501420214187", appId: "1:501420214187:web:068e444ebd20c060a274ee" };
    firebase.initializeApp(firebaseConfig);
    const db = firebase.database();

    // TEMEL FONKSİYONLAR
    function ensureLoadingDetailEl() {
        const overlay = document.getElementById('loadingOverlay');
        if (!overlay) return null;
        let detail = document.getElementById('loadingDetailText');
        if (!detail) {
            detail = document.createElement('div');
            detail.id = 'loadingDetailText';
            detail.style.cssText = 'margin-top:6px; max-width:520px; text-align:center; color:var(--muted); font-size:12px; line-height:1.45; padding:0 20px;';
            overlay.appendChild(detail);
        }
        return detail;
    }
    function setLoadingMessage(message, detail) {
        const overlay = document.getElementById('loadingOverlay');
        if (!overlay) return;
        const title = overlay.querySelector('h3');
        if (title && message) title.innerText = message;
        const detailEl = ensureLoadingDetailEl();
        if (detailEl) detailEl.innerText = detail || '';
    }
    function showLoading(message, detail) {
        const overlay = document.getElementById('loadingOverlay');
        if (!overlay) return;
        overlay.style.display = 'flex';
        setLoadingMessage(message || 'Veriler İşleniyor... Lütfen Bekleyin.', detail || '');
    }
    function hideLoading() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) overlay.style.display = 'none';
    }
    function yieldToBrowser() {
        return new Promise(resolve => {
            if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => setTimeout(resolve, 0));
            else setTimeout(resolve, 0);
        });
    }

    function focusDesktopNavGroup(group) {
        if (!group || window.innerWidth <= 768) return;
        document.querySelectorAll('.grouped-nav .nav-group').forEach(other => {
            if (other !== group) other.classList.remove('open');
        });
        group.classList.add('open');
    }
    function keepNavGroupVisible(group) {
        const nav = group && group.closest ? group.closest('.grouped-nav') : null;
        const sidebar = group && group.closest ? group.closest('.sidebar') : null;
        if (!nav || !group) return;
        requestAnimationFrame(() => {
            if (window.innerWidth <= 768) {
                const left = group.offsetLeft - 12;
                const right = left + group.offsetWidth;
                const viewLeft = nav.scrollLeft;
                const viewRight = viewLeft + nav.clientWidth;
                if (left < viewLeft || right > viewRight) {
                    nav.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
                }
                return;
            }
            if (!sidebar) return;
            const groupRect = group.getBoundingClientRect();
            const sidebarRect = sidebar.getBoundingClientRect();
            const topPadding = 8;
            const bottomPadding = 12;
            if (groupRect.top < sidebarRect.top + topPadding) {
                sidebar.scrollBy({ top: groupRect.top - sidebarRect.top - topPadding, behavior: 'smooth' });
            } else if (groupRect.bottom > sidebarRect.bottom - bottomPadding) {
                sidebar.scrollBy({ top: groupRect.bottom - sidebarRect.bottom + bottomPadding, behavior: 'smooth' });
            }
        });
    }
    function toggleNavGroup(button) {
        const group = button && button.closest ? button.closest('.nav-group') : null;
        if (!group) return;
        if (window.innerWidth > 768) {
            const wasOpen = group.classList.contains('open');
            if (wasOpen) {
                group.classList.remove('open');
            } else {
                focusDesktopNavGroup(group);
                keepNavGroupVisible(group);
            }
            return;
        }
        group.classList.toggle('open');
        keepNavGroupVisible(group);
    }
    function initDesktopNavFocus() {
        if (window.innerWidth <= 768) return;
        const activeBtn = document.querySelector('.grouped-nav .tab-btn.active');
        const activeGroup = activeBtn && activeBtn.closest ? activeBtn.closest('.nav-group') : null;
        const firstGroup = document.querySelector('.grouped-nav .nav-group');
        focusDesktopNavGroup(activeGroup || firstGroup);
    }
    function initSidebarWheelScroll() {
        const sidebar = document.querySelector('.sidebar');
        const nav = document.querySelector('.grouped-nav');
        if (!sidebar || !nav || nav.dataset.wheelScrollBound === '1') return;
        nav.dataset.wheelScrollBound = '1';

        const nestedSelector = '.file-list-container,.checkbox-list,.visit-check-grid,.kanban-cards,.right-panel,.modal-content,.smart-list,.priority-list';
        const handleSidebarWheel = function(event) {
            const nestedScroller = event.target && event.target.closest
                ? event.target.closest(nestedSelector)
                : null;
            if (nestedScroller && nestedScroller !== nav) return;

            if (window.innerWidth <= 768) {
                const maxHorizontal = Math.max(0, nav.scrollWidth - nav.clientWidth);
                if (maxHorizontal <= 0) return;
                const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
                const before = nav.scrollLeft;
                nav.scrollLeft = Math.max(0, Math.min(maxHorizontal, before + delta));
                if (nav.scrollLeft !== before) {
                    event.preventDefault();
                    event.stopPropagation();
                }
                return;
            }

            const maxVertical = Math.max(0, sidebar.scrollHeight - sidebar.clientHeight);
            if (maxVertical <= 0) return;
            const before = sidebar.scrollTop;
            sidebar.scrollTop = Math.max(0, Math.min(maxVertical, before + event.deltaY));
            if (sidebar.scrollTop !== before) {
                event.preventDefault();
                event.stopPropagation();
            }
        };

        nav.addEventListener('wheel', handleSidebarWheel, { passive:false });
        sidebar.addEventListener('wheel', function(event) {
            if (event.target === sidebar || (event.target && !event.target.closest('.grouped-nav'))) {
                handleSidebarWheel(event);
            }
        }, { passive:false });

        let pointerStartX = 0;
        let pointerStartScroll = 0;
        let pointerDragging = false;
        nav.addEventListener('pointerdown', function(event) {
            if (window.innerWidth > 768 || event.pointerType === 'mouse') return;
            pointerStartX = event.clientX;
            pointerStartScroll = nav.scrollLeft;
            pointerDragging = true;
        }, { passive:true });
        nav.addEventListener('pointermove', function(event) {
            if (!pointerDragging || window.innerWidth > 768) return;
            nav.scrollLeft = pointerStartScroll - (event.clientX - pointerStartX);
        }, { passive:true });
        const stopPointerDrag = () => { pointerDragging = false; };
        nav.addEventListener('pointerup', stopPointerDrag, { passive:true });
        nav.addEventListener('pointercancel', stopPointerDrag, { passive:true });

        window.addEventListener('resize', function() {
            if (window.innerWidth > 768) {
                const maxVertical = Math.max(0, sidebar.scrollHeight - sidebar.clientHeight);
                if (sidebar.scrollTop > maxVertical) sidebar.scrollTop = maxVertical;
                initDesktopNavFocus();
            } else {
                const maxHorizontal = Math.max(0, nav.scrollWidth - nav.clientWidth);
                if (nav.scrollLeft > maxHorizontal) nav.scrollLeft = maxHorizontal;
            }
        }, { passive:true });
    }
    function openDataManagement() {
        const modal = document.getElementById('dataManagementModal');
        if (modal) modal.style.display = 'block';
    }
    function closeDataManagement() {
        const modal = document.getElementById('dataManagementModal');
        if (modal) modal.style.display = 'none';
    }
    function toggleMoreActions(event) {
        if (event) event.stopPropagation();
        const menu = document.getElementById('moreActionsMenu');
        if (menu) menu.classList.toggle('open');
    }
    function closeMoreActions() {
        const menu = document.getElementById('moreActionsMenu');
        if (menu) menu.classList.remove('open');
    }
    document.addEventListener('click', function(event) {
        const wrap = event.target && event.target.closest ? event.target.closest('.more-actions-wrap') : null;
        if (!wrap) closeMoreActions();
    });

    function switchTab(tabId) {
        const target = document.getElementById('tab-' + tabId);
        const btn = document.getElementById('btn-tab-' + tabId);
        if (!target || !btn) {
            const error = new Error(`Menü-sekme bağlantısı bulunamadı: ${tabId}`);
            recordRuntimeIssue('navigation', error.message, { tabId });
            showAppRuntimeToast('İstenen ekran açılamadı. Sistem Kontrolü ekranını inceleyiniz.', 'error');
            return false;
        }
        try {
            document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-btn').forEach(t => { t.classList.remove('active'); t.style.color = "var(--muted)"; });
            target.classList.add('active');
            btn.classList.add('active');
            const parentGroup = btn.closest('.nav-group');
            if(parentGroup) { if(window.innerWidth > 768) focusDesktopNavGroup(parentGroup); else parentGroup.classList.add('open'); keepNavGroupVisible(parentGroup); }
            if(tabId === 'report' || tabId === 'trend' || tabId === 'kanban' || tabId === 'strategic' || tabId === 'smart' || tabId === 'quality' || tabId === 'pq-library' || tabId === 'visits' || tabId === 'visit-scope' || tabId === 'icao-visit-validation' || tabId === 'visit-workspace' || tabId === 'visit-followup' || tabId === 'visit-consultation' || tabId === 'visit-reports' || tabId === 'visit-management' || tabId === 'visit-analysis' || tabId === 'visit-audit') { btn.style.color = "var(--primary)"; }
            if(tabId === 'past' || tabId === 'empty-caps') { btn.style.color = "var(--danger)"; }
            if(tabId === 'icao-closed') { btn.style.color = "#ca8a04"; }
            if(tabId === 'report') updateReportPreview();
            if(tabId === 'strategic') renderStrategicReportPreview();
            if(tabId === 'smart') updateSmartManagementPanel(getFilteredData(), window.currentAnalyticsModel || null);
            if(tabId === 'quality') updateDataQualityCenter(getFilteredData());
            if(tabId === 'pq-library') renderIcaoPqLibraryModule();
            if(tabId === 'visits') renderVisitModule();
            if(tabId === 'visit-scope') renderVisitScopeModule();
            if(tabId === 'icao-visit-validation') renderIcaoOfficialVisitModule();
            if(tabId === 'visit-workspace') renderVisitWorkspaceModule();
            if(tabId === 'visit-followup') renderVisitFollowUpModule();
            if(tabId === 'visit-consultation') renderVisitConsultationModule();
            if(tabId === 'visit-reports') renderVisitReportsModule();
            if(tabId === 'visit-management') renderVisitManagementDashboard();
            if(tabId === 'visit-analysis') renderVisitAnalysisModule();
            if(tabId === 'visit-audit') renderVisitAuditTrail();
            const filterPanel = document.getElementById('rightFiltersPanel');
            if (filterPanel) filterPanel.classList.remove('open');
            if(tabId === 'dashboard') { if(charts.s) charts.s.resize(); if(charts.d) charts.d.resize(); if(charts.o) charts.o.resize(); if(charts.ei) charts.ei.resize(); if(charts.icaoOfficial) charts.icaoOfficial.resize(); if(charts.icaoOfficialTrend) charts.icaoOfficialTrend.resize(); }
            if(tabId === 'trend') { if(charts.histTrend) charts.histTrend.resize(); }
            updateActiveScreenExportButtons();
            return true;
        } catch (error) {
            recordRuntimeIssue('navigation', error.message || String(error), { tabId, stack:error.stack || '' });
            showAppRuntimeToast('Ekran hazırlanırken hata oluştu. Sistem Kontrolü kayıt altına aldı.', 'error');
            console.error('Sekme geçişi hatası:', tabId, error);
            return false;
        }
    }

    // ================================================================
    // STABILIZASYON PAKETI 1
    // ================================================================
    const STABILIZATION_VERSION = '1.0.0';
    const stabilizationState = {
        firebaseConnected: null,
        connectionListenerStarted: false,
        runtimeIssues: [],
        initialized: false,
        lastHealthSnapshot: null
    };

    function showAppRuntimeToast(message, type = 'info') {
        let toast = document.getElementById('appRuntimeToast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'appRuntimeToast';
            toast.className = 'app-runtime-toast';
            document.body.appendChild(toast);
        }
        toast.className = 'app-runtime-toast' + (type && type !== 'info' ? ' ' + type : '');
        toast.textContent = message;
        toast.style.opacity = '1';
        clearTimeout(toast._hideTimer);
        toast._hideTimer = setTimeout(() => { toast.style.opacity = '0'; }, type === 'error' ? 7000 : 3500);
    }

    function sanitizeDiagnosticValue(value) {
        if (value === undefined) return '[undefined]';
        if (value === null) return null;
        if (value instanceof Error) return { name:value.name, message:value.message, stack:value.stack || '' };
        if (typeof value === 'string') return value.slice(0, 4000);
        try { return JSON.parse(JSON.stringify(value)); } catch (_) { return String(value).slice(0, 4000); }
    }

    function recordRuntimeIssue(source, message, detail = {}) {
        const item = {
            at: new Date().toISOString(),
            source: source || 'runtime',
            message: String(message || 'Bilinmeyen hata').slice(0, 1500),
            detail: sanitizeDiagnosticValue(detail)
        };
        stabilizationState.runtimeIssues.unshift(item);
        stabilizationState.runtimeIssues = stabilizationState.runtimeIssues.slice(0, 30);
        try { sessionStorage.setItem('usoapRuntimeIssues', JSON.stringify(stabilizationState.runtimeIssues)); } catch (_) {}
        return item;
    }

    function restoreRuntimeIssues() {
        try {
            const rows = JSON.parse(sessionStorage.getItem('usoapRuntimeIssues') || '[]');
            if (Array.isArray(rows)) stabilizationState.runtimeIssues = rows.slice(0, 30);
        } catch (_) {}
    }

    function updateSystemConnectionBadge() {
        const badge = document.getElementById('systemConnectionBadge');
        if (!badge) return;
        let label = '⚪ Kontrol ediliyor', cls = 'checking';
        if (!navigator.onLine) { label = '🔴 İnternet yok'; cls = 'error'; }
        else if (!firebase.auth().currentUser) { label = '🟠 Oturum yok'; cls = 'warn'; }
        else if (systemLastSaveError) { label = '🔴 Kayıt hatası'; cls = 'error'; }
        else if (systemSaveInFlight || systemSavePending) { label = '🟠 Kaydediliyor'; cls = 'warn'; }
        else if (stabilizationState.firebaseConnected === true) { label = '🟢 Firebase bağlı'; cls = 'ok'; }
        else if (stabilizationState.firebaseConnected === false) { label = '🔴 Firebase yok'; cls = 'error'; }
        badge.className = 'system-connection-badge ' + cls;
        badge.textContent = label;
        const last = systemLastSaveAt ? ` Son kayıt: ${systemLastSaveAt.toLocaleTimeString('tr-TR')}.` : '';
        badge.title = label.replace(/^[^ ]+\s*/, '') + '.' + last;
    }

    function startFirebaseConnectionMonitor() {
        if (stabilizationState.connectionListenerStarted || !db || typeof db.ref !== 'function') return;
        stabilizationState.connectionListenerStarted = true;
        try {
            db.ref('.info/connected').on('value', snapshot => {
                stabilizationState.firebaseConnected = snapshot.val() === true;
                updateSystemConnectionBadge();
            }, error => {
                stabilizationState.firebaseConnected = false;
                recordRuntimeIssue('firebase-connection', error.message || String(error));
                updateSystemConnectionBadge();
            });
        } catch (error) {
            stabilizationState.firebaseConnected = false;
            recordRuntimeIssue('firebase-connection', error.message || String(error));
            updateSystemConnectionBadge();
        }
    }

    function safeDiagnosticCall(fn, fallback) {
        try { return fn(); } catch (error) { return fallback; }
    }

    function getDuplicateHtmlIds() {
        const counts = new Map();
        document.querySelectorAll('[id]').forEach(el => counts.set(el.id, (counts.get(el.id) || 0) + 1));
        return Array.from(counts.entries()).filter(([, count]) => count > 1).map(([id, count]) => ({ id, count }));
    }

    function getMenuIntegrityIssues() {
        const issues = [];
        document.querySelectorAll('.tab-btn[id^="btn-tab-"]').forEach(btn => {
            const tabId = btn.id.replace(/^btn-tab-/, '');
            if (!document.getElementById('tab-' + tabId)) issues.push(`Hedef ekran yok: ${tabId}`);
        });
        document.querySelectorAll('.tab-content[id^="tab-"]').forEach(tab => {
            const tabId = tab.id.replace(/^tab-/, '');
            if (!document.getElementById('btn-tab-' + tabId)) issues.push(`Menü düğmesi yok: ${tabId}`);
        });
        return issues;
    }

    function getVisitIntegritySummary() {
        const visits = safeDiagnosticCall(() => getVisitRecords(), []);
        const followups = safeDiagnosticCall(() => getAllVisitFollowUpItems(), []);
        const consultations = safeDiagnosticCall(() => getAllVisitConsultationItems(), []);
        const visitIds = new Set(visits.map(v => v.id));
        const orphanFollow = followups.filter(item => !visitIds.has(item.visitId) || !item.source).length;
        const orphanConsult = consultations.filter(item => !visitIds.has(item.visitId) || !item.source).length;
        let duplicateFieldworkIds = 0;
        visits.forEach(visit => {
            const records = safeDiagnosticCall(() => getVisitFieldworkRecords(visit), []);
            const seen = new Set();
            records.forEach(r => { if (r.id && seen.has(r.id)) duplicateFieldworkIds++; else if (r.id) seen.add(r.id); });
        });
        return { visits:visits.length, followups:followups.length, consultations:consultations.length, orphanFollow, orphanConsult, duplicateFieldworkIds };
    }

    function buildSystemHealthSnapshot() {
        const checks = [];
        const add = (key, label, level, detail) => checks.push({ key, label, level, detail:String(detail || '') });
        const authenticated = !!safeDiagnosticCall(() => firebase.auth().currentUser, null);
        const duplicateIds = getDuplicateHtmlIds();
        const menuIssues = getMenuIntegrityIssues();
        const visit = getVisitIntegritySummary();
        add('browser-online', 'Tarayıcı bağlantısı', navigator.onLine ? 'ok' : 'error', navigator.onLine ? 'İnternet bağlantısı algılandı.' : 'Tarayıcı çevrimdışı görünüyor.');
        add('firebase-sdk', 'Firebase SDK', (typeof firebase !== 'undefined' && !!db) ? 'ok' : 'error', (typeof firebase !== 'undefined' && !!db) ? 'SDK ve veritabanı nesnesi hazır.' : 'Firebase SDK yüklenemedi.');
        add('firebase-auth', 'Firebase oturumu', authenticated ? 'ok' : 'warn', authenticated ? (firebase.auth().currentUser.email || firebase.auth().currentUser.uid) : 'Yetkili kullanıcı oturumu bulunmuyor.');
        add('firebase-connection', 'Firebase gerçek zamanlı bağlantı', stabilizationState.firebaseConnected === true ? 'ok' : (stabilizationState.firebaseConnected === false ? 'error' : 'warn'), stabilizationState.firebaseConnected === true ? 'Veritabanı bağlantısı aktif.' : stabilizationState.firebaseConnected === false ? 'Veritabanına aktif bağlantı kurulamıyor.' : 'Bağlantı durumu henüz alınmadı.');
        add('system-save', 'Ana veri kayıt kuyruğu', systemLastSaveError ? 'error' : (systemSavePending || systemSaveInFlight ? 'warn' : 'ok'), systemLastSaveError ? (systemLastSaveError.message || String(systemLastSaveError)) : systemSaveInFlight ? 'Firebase kaydı devam ediyor.' : systemSavePending ? 'Kaydedilmeyi bekleyen değişiklik var.' : (systemLastSaveAt ? `Son kayıt: ${systemLastSaveAt.toLocaleString('tr-TR')}` : 'Bekleyen kayıt yok.'));
        add('pdf', 'PDF motoru', (typeof pdfMake !== 'undefined' && pdfMake && typeof pdfMake.createPdf === 'function') ? 'ok' : 'warn', (typeof pdfMake !== 'undefined' && pdfMake && typeof pdfMake.createPdf === 'function') ? 'pdfMake hazır.' : 'pdfMake yüklenemedi; yazdırma yedeği kullanılacaktır.');
        add('excel', 'Excel motoru', (typeof XLSX !== 'undefined' && XLSX && XLSX.utils) ? 'ok' : 'error', (typeof XLSX !== 'undefined' && XLSX && XLSX.utils) ? 'XLSX hazır.' : 'Excel kütüphanesi yüklenemedi.');
        add('word', 'Word okuma motoru', (typeof JSZip !== 'undefined') ? 'ok' : 'error', (typeof JSZip !== 'undefined') ? 'JSZip hazır.' : 'Word ayrıştırma kütüphanesi yüklenemedi.');
        add('charts', 'Grafik motoru', (typeof Chart !== 'undefined') ? 'ok' : 'warn', (typeof Chart !== 'undefined') ? 'Chart.js hazır.' : 'Grafik kütüphanesi yüklenemedi.');
        const assessmentReady = typeof window.runAssessmentEventSelfCheck === 'function';
        const assessmentEvents = assessmentReady ? Object.values(window.icaoAssessmentEvents || {}).filter(x => x && !x.isDeleted).length : 0;
        const assessmentSnapshots = assessmentReady ? Object.values(window.icaoEiSnapshots || {}).filter(x => x && !x.isDeleted).length : 0;
        add('assessment-model', 'Assessment Event / EI Snapshot modeli', assessmentReady ? 'ok' : 'warn', assessmentReady ? `${assessmentEvents} değerlendirme olayı, ${assessmentSnapshots} EI snapshot hazır.` : 'Assessment Event modülü yüklenemedi.');
        add('duplicate-ids', 'HTML kimlik bütünlüğü', duplicateIds.length ? 'error' : 'ok', duplicateIds.length ? duplicateIds.map(x => `${x.id} (${x.count})`).join(', ') : 'Yinelenen HTML kimliği bulunmadı.');
        add('menu-tabs', 'Menü ve ekran bağlantıları', menuIssues.length ? 'error' : 'ok', menuIssues.length ? menuIssues.join(' | ') : 'Bütün menü düğmeleri ilgili ekrana bağlı.');
        const visitLevel = (visit.orphanFollow || visit.orphanConsult || visit.duplicateFieldworkIds) ? 'warn' : 'ok';
        add('visit-integrity', 'Ziyaret veri bütünlüğü', visitLevel, `${visit.visits} ziyaret, ${visit.followups} takip, ${visit.consultations} danışma. Kaynaksız takip: ${visit.orphanFollow}; kaynaksız danışma: ${visit.orphanConsult}; mükerrer saha kimliği: ${visit.duplicateFieldworkIds}.`);
        add('data-volume', 'Ana veri kapsamı', 'ok', `${(rawData || []).length} CAP satırı, ${Object.keys(pqMasterData || {}).length} master PQ, ${visit.visits} ziyaret.`);
        add('runtime-errors', 'Çalışma zamanı hata kaydı', stabilizationState.runtimeIssues.length ? 'warn' : 'ok', stabilizationState.runtimeIssues.length ? `Bu oturumda ${stabilizationState.runtimeIssues.length} hata/uyarı kaydedildi.` : 'Bu oturumda kaydedilmiş çalışma zamanı hatası yok.');
        const snapshot = {
            generatedAt: new Date().toISOString(),
            stabilizationVersion: STABILIZATION_VERSION,
            app: { href:location.href, userAgent:navigator.userAgent, online:navigator.onLine },
            counts: { rawData:(rawData || []).length, pqMaster:Object.keys(pqMasterData || {}).length, ...visit },
            save: { pending:systemSavePending, inFlight:systemSaveInFlight, lastSaveAt:systemLastSaveAt ? systemLastSaveAt.toISOString() : null, error:systemLastSaveError ? (systemLastSaveError.message || String(systemLastSaveError)) : null },
            checks,
            runtimeIssues: stabilizationState.runtimeIssues
        };
        stabilizationState.lastHealthSnapshot = snapshot;
        return snapshot;
    }

    function renderSystemHealthModal() {
        const snapshot = buildSystemHealthSnapshot();
        const summary = document.getElementById('systemHealthSummary');
        const checks = document.getElementById('systemHealthChecks');
        const errors = document.getElementById('systemHealthErrorList');
        const subtitle = document.getElementById('systemHealthSubtitle');
        if (subtitle) subtitle.textContent = `Stabilizasyon ${STABILIZATION_VERSION} · ${new Date(snapshot.generatedAt).toLocaleString('tr-TR')}`;
        const ok = snapshot.checks.filter(x => x.level === 'ok').length;
        const warn = snapshot.checks.filter(x => x.level === 'warn').length;
        const error = snapshot.checks.filter(x => x.level === 'error').length;
        if (summary) summary.innerHTML = [
            ['ok', ok, 'Başarılı kontrol'],
            ['warn', warn, 'Uyarı'],
            ['error', error, 'Hata'],
            [error ? 'error' : warn ? 'warn' : 'ok', snapshot.counts.visits || 0, 'Ziyaret kaydı']
        ].map(([level,value,label]) => `<div class="system-health-kpi ${level}"><strong>${value}</strong><span>${label}</span></div>`).join('');
        const icons = { ok:'✅', warn:'⚠️', error:'❌' };
        if (checks) checks.innerHTML = snapshot.checks.map(row => `<div class="system-health-row ${row.level}"><div class="icon">${icons[row.level]}</div><b>${escapeHtml(row.label)}</b><div class="detail">${escapeHtml(row.detail)}</div></div>`).join('');
        if (errors) errors.innerHTML = snapshot.runtimeIssues.length ? snapshot.runtimeIssues.map(item => `<div class="system-health-error-item"><b>${escapeHtml(new Date(item.at).toLocaleString('tr-TR'))} · ${escapeHtml(item.source)}</b>\n${escapeHtml(item.message)}${item.detail ? '\n' + escapeHtml(JSON.stringify(item.detail, null, 2)) : ''}</div>`).join('') : '<div style="padding:9px;color:var(--muted);font-size:11px;">Kayıtlı çalışma zamanı hatası bulunmuyor.</div>';
        updateSystemConnectionBadge();
        return snapshot;
    }

    function openSystemHealthModal() {
        const modal = document.getElementById('systemHealthModal');
        if (!modal) return;
        renderSystemHealthModal();
        modal.style.display = 'block';
    }
    function closeSystemHealthModal() {
        const modal = document.getElementById('systemHealthModal');
        if (modal) modal.style.display = 'none';
    }
    function downloadSystemDiagnosticReport() {
        const snapshot = buildSystemHealthSnapshot();
        const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type:'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `USOAP_Sistem_Tanilama_${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function initDuplicateActionGuard() {
        if (document.documentElement.dataset.actionGuardBound === '1') return;
        document.documentElement.dataset.actionGuardBound = '1';
        document.addEventListener('submit', event => {
            const form = event.target;
            if (!(form instanceof HTMLFormElement)) return;
            const now = Date.now();
            const until = Number(form.dataset.submitLockUntil || 0);
            if (until > now) {
                event.preventDefault(); event.stopImmediatePropagation();
                showAppRuntimeToast('Aynı kayıt işlemi devam ediyor. Lütfen kısa süre bekleyiniz.', 'warn');
                return;
            }
            form.dataset.submitLockUntil = String(now + 1200);
        }, true);
        document.addEventListener('click', event => {
            const btn = event.target && event.target.closest ? event.target.closest('button') : null;
            if (!btn) return;
            const action = (btn.getAttribute('onclick') || '') + ' ' + (btn.type || '');
            if (!/(save|kaydet|archiveCurrentState|import|deleteVisit|deleteVisit|submit)/i.test(action + ' ' + btn.textContent)) return;
            const now = Date.now();
            const until = Number(btn.dataset.actionLockUntil || 0);
            if (until > now) {
                event.preventDefault(); event.stopImmediatePropagation();
                showAppRuntimeToast('İşlem zaten başlatıldı. Lütfen kısa süre bekleyiniz.', 'warn');
                return;
            }
            btn.dataset.actionLockUntil = String(now + 900);
        }, true);
    }

    function initStabilizationPackage() {
        if (stabilizationState.initialized) return;
        stabilizationState.initialized = true;
        restoreRuntimeIssues();
        startFirebaseConnectionMonitor();
        initDuplicateActionGuard();
        window.addEventListener('online', updateSystemConnectionBadge);
        window.addEventListener('offline', updateSystemConnectionBadge);
        window.addEventListener('error', event => {
            recordRuntimeIssue('window-error', event.message || 'JavaScript hatası', { file:event.filename || '', line:event.lineno || 0, column:event.colno || 0, stack:event.error && event.error.stack || '' });
            updateSystemConnectionBadge();
        });
        window.addEventListener('unhandledrejection', event => {
            const reason = event.reason instanceof Error ? event.reason : new Error(String(event.reason || 'Promise hatası'));
            recordRuntimeIssue('unhandled-promise', reason.message, { stack:reason.stack || '' });
            updateSystemConnectionBadge();
        });
        window.addEventListener('beforeunload', event => {
            if (systemSavePending || systemSaveInFlight) {
                event.preventDefault();
                event.returnValue = '';
            }
        });
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden' && systemSavePending && !systemSaveInFlight) flushPendingSystemSave(false);
        });
        setTimeout(() => {
            updateSystemConnectionBadge();
            const snapshot = buildSystemHealthSnapshot();
            const critical = snapshot.checks.filter(x => x.level === 'error');
            if (critical.length) showAppRuntimeToast(`Sistem kontrolünde ${critical.length} kritik sorun bulundu.`, 'error');
        }, 1500);
    }

    window.openSystemHealthModal = openSystemHealthModal;
    window.closeSystemHealthModal = closeSystemHealthModal;
    window.renderSystemHealthModal = renderSystemHealthModal;
    window.downloadSystemDiagnosticReport = downloadSystemDiagnosticReport;
    window.runStabilizationSelfCheck = buildSystemHealthSnapshot;


    // GİRİŞ & YÜKLEME
    window.onload = function() {
        applyLanguage();
        initSidebarWheelScroll();
        initDesktopNavFocus();
        initStabilizationPackage();
        firebase.auth().onAuthStateChanged((user) => {
            if (user) { document.getElementById('loginOverlay').style.display = 'none'; document.getElementById('mainAppContainer').style.display = 'flex'; loadFromLocalStorage(); startVisitFirebaseListener(); startVisitUnitSettingsListener(); if(typeof startAssessmentEventListener==='function')startAssessmentEventListener(); startIcaoOfficialEiListener(); } 
            else { stopVisitFirebaseListener(); stopVisitUnitSettingsListener(); stopIcaoOfficialEiListener(); if(typeof stopAssessmentEventListener==='function')stopAssessmentEventListener(); document.getElementById('loadingOverlay').style.display = 'none'; document.getElementById('mainAppContainer').style.display = 'none'; document.getElementById('loginOverlay').style.display = 'flex'; }
        });
    };
    
    window.bypassLogin = function() { initSidebarWheelScroll(); initDesktopNavFocus(); document.getElementById('loginOverlay').style.display = 'none'; document.getElementById('mainAppContainer').style.display = 'flex'; renderFileList(); render(); };
    window.loginUser = function() { let email = document.getElementById('loginEmail').value.trim(); let pass = document.getElementById('loginPass').value; let errEl = document.getElementById('loginError'); if(!email || !pass) { errEl.innerText = "Lütfen e-posta ve şifrenizi giriniz."; errEl.style.display = "block"; return; } errEl.style.display = "none"; document.getElementById('loginOverlay').style.opacity = '0.5'; firebase.auth().signInWithEmailAndPassword(email, pass).then(() => { document.getElementById('loginOverlay').style.opacity = '1'; }).catch(() => { document.getElementById('loginOverlay').style.opacity = '1'; errEl.innerText = "Giriş başarısız."; errEl.style.display = "block"; }); };

    let systemSaveTimer = null;
    let systemSaveInFlight = false;
    let systemSaveQueued = false;
    let systemSavePending = false;
    let systemLastSaveAt = null;
    let systemLastSaveError = null;
    let systemSaveSequence = 0;

    function buildSystemSavePayload() {
        const safePqMasterData = [];
        Object.keys(pqMasterData || {}).forEach(k => safePqMasterData.push({ key: k, data: pqMasterData[k] }));
        const safeDailyPQNotes = [];
        Object.keys(dailyPQNotes || {}).forEach(k => safeDailyPQNotes.push({ key: k, note: dailyPQNotes[k] }));
        const safeKanbanWorkflowStages = [];
        Object.keys(kanbanWorkflowStages || {}).forEach(k => safeKanbanWorkflowStages.push({ key: k, value: kanbanWorkflowStages[k] }));
        return {
            rawData: rawData || [],
            pqMasterData: safePqMasterData,
            baseEIData: baseEIData || {},
            loadedFiles: Array.from(loadedFiles || []),
            loadedWordAreas: Array.from(window.loadedWordAreas || []),
            loadedExcelFile: loadedExcelFile || null,
            managementNotes: (document.getElementById('managementNotes') || {}).value || '',
            dailyReviewed: Array.from(dailyReviewedSet || []),
            dailyReviewedPQs: Array.from(dailyReviewedPQs || []),
            dailyPQNotes: safeDailyPQNotes,
            kanbanWorkflowStages: safeKanbanWorkflowStages,
            reportDate: window_loadedReportDate ? window_loadedReportDate.getTime() : null,
            stabilization: {
                schemaVersion: 1,
                savedAt: new Date().toISOString(),
                sequence: ++systemSaveSequence
            }
        };
    }

    async function flushPendingSystemSave(showFeedback = false) {
        clearTimeout(systemSaveTimer);
        systemSaveTimer = null;
        if (!firebase.auth().currentUser) {
            systemSavePending = false;
            updateSystemConnectionBadge();
            return false;
        }
        if (systemSaveInFlight) {
            systemSaveQueued = true;
            systemSavePending = true;
            updateSystemConnectionBadge();
            return false;
        }
        systemSaveInFlight = true;
        systemSavePending = false;
        systemLastSaveError = null;
        updateSystemConnectionBadge();
        try {
            const payload = buildSystemSavePayload();
            await db.ref('icao_system').set(payload);
            systemLastSaveAt = new Date();
            if (showFeedback) showAppRuntimeToast('Bekleyen ana veri kaydı Firebase’e gönderildi.', 'ok');
            return true;
        } catch (error) {
            systemLastSaveError = error;
            systemSavePending = true;
            recordRuntimeIssue('firebase-save', error.message || String(error), { stack:error.stack || '' });
            showAppRuntimeToast('Ana veri Firebase’e kaydedilemedi. Bağlantıyı kontrol ediniz.', 'error');
            console.error('Ana veri kayıt hatası:', error);
            return false;
        } finally {
            systemSaveInFlight = false;
            updateSystemConnectionBadge();
            if (systemSaveQueued) {
                systemSaveQueued = false;
                systemSavePending = true;
                systemSaveTimer = setTimeout(() => flushPendingSystemSave(false), 80);
            }
        }
    }

    function saveToLocalStorage(options = {}) {
        if(!firebase.auth().currentUser) return;
        systemSavePending = true;
        systemSaveQueued = systemSaveInFlight || systemSaveQueued;
        clearTimeout(systemSaveTimer);
        const immediate = options === true || (options && options.immediate === true);
        const delay = immediate ? 0 : 650;
        systemSaveTimer = setTimeout(() => flushPendingSystemSave(false), delay);
        updateSystemConnectionBadge();
    }
    window.flushPendingSystemSave = flushPendingSystemSave;
    window.saveToLocalStorage = saveToLocalStorage;

    function loadFromLocalStorage() {
        showLoading();
        db.ref('icao_system').once('value').then(async (snapshot) => {
            const data = snapshot.val();
            if (data) {
                rawData = data.rawData || []; baseEIData = data.baseEIData || {};
                pqMasterData = {}; if (Array.isArray(data.pqMasterData)) { data.pqMasterData.forEach(item => { pqMasterData[item.key] = item.data; }); }
                dailyPQNotes = {}; if (Array.isArray(data.dailyPQNotes)) { data.dailyPQNotes.forEach(item => { dailyPQNotes[item.key] = item.note; }); }
                loadedFiles = new Set(data.loadedFiles || []); window.loadedWordAreas = new Set(data.loadedWordAreas || []); loadedExcelFile = data.loadedExcelFile || null; savedManagementNotes = data.managementNotes || ""; dailyReviewedSet = new Set(data.dailyReviewed || []); dailyReviewedPQs = new Set(data.dailyReviewedPQs || []); kanbanWorkflowStages = {}; if (Array.isArray(data.kanbanWorkflowStages)) { data.kanbanWorkflowStages.forEach(item => { if(item && item.key) kanbanWorkflowStages[item.key] = item.value; }); } else { kanbanWorkflowStages = data.kanbanWorkflowStages || {}; } 
                document.getElementById('managementNotes').value = savedManagementNotes;
                window_loadedReportDate = data.reportDate ? new Date(data.reportDate) : null;
                updateDynamicSubtitle();
                if (Object.keys(baseEIData).length > 0) { document.getElementById('eiOverallProgressPanel').style.display = "grid"; document.getElementById('eiChartPanel').style.display = "block"; } else { document.getElementById('eiOverallProgressPanel').style.display = "none"; document.getElementById('eiChartPanel').style.display = "none"; }
                setLoadingMessage('Kayıtlı veri yükleniyor...', 'Filtreler ve ekran bileşenleri hazırlanıyor.'); renderFileList(); await yieldToBrowser(); refreshAllFilters(); await yieldToBrowser(); render();
            } else { window_loadedReportDate = null; updateDynamicSubtitle(); renderFileList(); }
        }).catch(e => { console.error(e); recordRuntimeIssue('firebase-load', e.message || String(e), {stack:e.stack || ''}); showAppRuntimeToast('Kayıtlı ana veri yüklenemedi. Sistem Kontrolü ekranını inceleyiniz.', 'error'); }).finally(() => { hideLoading(); updateSystemConnectionBadge(); });

        db.ref('icao_archive').on('value', (snapshot) => {
            let rawArchives = snapshot.val() || {};
            Object.keys(rawArchives).forEach(k => { let arch = rawArchives[k]; if (Array.isArray(arch.pqMasterData)) { let reconstructedObj = {}; arch.pqMasterData.forEach(item => { reconstructedObj[item.key] = item.data; }); arch.pqMasterData = reconstructedObj; } });
            systemArchives = rawArchives; updateTrendDropdowns(); renderHistoricalTrend(); 
        });
    }

    function normalizePQ(rawPq) { if (!rawPq) return ""; let str = rawPq.toString().trim().replace(',', '.'); if (/^\d{4}$/.test(str)) str = str.slice(0,1) + '.' + str.slice(1); if (/^\d{5}$/.test(str)) str = str.slice(0,2) + '.' + str.slice(2); let match = str.match(/\b(\d{1,2}\.\d{3})\b/); if (match) return match[1]; if (!isNaN(str) && str.includes('.')) { let parts = str.split('.'); if (parts[0].length >= 1 && parts[0].length <= 2) { if (parts[1].length === 1) return parts[0] + '.' + parts[1] + '00'; if (parts[1].length === 2) return parts[0] + '.' + parts[1] + '0'; if (parts[1].length === 3) return str; } } return str; }
    function findPQColumn(row) { const keys = Object.keys(row); for (let k of keys) { let uk = k.toUpperCase().trim(); if (uk === 'PQ' || uk === 'PQ NO' || uk === 'PROTOKOL NO' || uk === 'PROTOKOL' || uk === 'PQ NUMBER') return k; } for (let k of keys) { let uk = k.toUpperCase(); if ((uk.includes('PQ') || uk.includes('PROTOKOL')) && !uk.includes('SORU') && !uk.includes('QUESTION')) return k; } return null; }
    function getCol(row, keywords) { let key = Object.keys(row).find(k => keywords.some(kw => k.toUpperCase().includes(kw))); return key ? row[key] : ""; }
    function normalizeExcelHeaderName(value){return String(value||'').trim().toLocaleUpperCase('tr-TR').replace(/[_\-]+/g,' ').replace(/\s+/g,' ');}
    function getColExact(row, headers){
        const wanted=(headers||[]).map(normalizeExcelHeaderName);
        const key=Object.keys(row||{}).find(k=>wanted.includes(normalizeExcelHeaderName(k)));
        return key!==undefined?row[key]:"";
    }
    function normalizeExcelHeaderLoose(value){
        return normalizeExcelHeaderName(value)
            .replace(/[()\[\]{}.:;\/\\]+/g,' ')
            .replace(/\s+/g,' ')
            .trim();
    }
    function getColExactLoose(row, headers){
        const wanted=(headers||[]).map(normalizeExcelHeaderLoose);
        const key=Object.keys(row||{}).find(k=>wanted.includes(normalizeExcelHeaderLoose(k)));
        return key!==undefined?row[key]:"";
    }
    function findExcelMasterSheetName(wb){
        const names=(wb&&wb.SheetNames)||[];
        return names.find(n=>normalizeExcelHeaderLoose(n)==='EXCEL VERİ')
            || names.find(n=>normalizeExcelHeaderLoose(n)==='EXCEL VERI')
            || names.find(n=>normalizeExcelHeaderLoose(n).includes('EXCEL')&&normalizeExcelHeaderLoose(n).includes('VER'))
            || names[0];
    }
    function getDirectChildElements(node, localName) {
        return Array.from(node.childNodes || []).filter(n => n.nodeType === 1 && (n.localName === localName || n.nodeName === "w:" + localName));
    }
    function getRowCells(rowNode) {
        let directCells = getDirectChildElements(rowNode, "tc");
        return directCells.length > 0 ? directCells : Array.from(rowNode.getElementsByTagName("w:tc"));
    }
    function cleanDocxCellText(txt) {
        return (txt || "").replace(/\u00a0/g, " ").replace(/[ \t]+\n/g, "\n").replace(/\n[ \t]+/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
    }
    let getCellText = (cellNode) => { let text = ""; let paras = cellNode.getElementsByTagName("w:p"); for (let p = 0; p < paras.length; p++) { let ts = paras[p].getElementsByTagName("w:t"); for (let t = 0; t < ts.length; t++) text += ts[t].textContent; text += "\n"; } return cleanDocxCellText(text); };
    function extractValidDateStr(txt) { if (!txt) return ""; let cleaned = txt.replace(/click here( to enter a date\.?)?/ig, '').replace(/(\d{1,2}[\.\/\-]\d{1,2}[\.\/\-]\d{2})\s+(\d{2})/g, '$1$2').replace(/\s+/g, ' ').trim(); let m = cleaned.match(/\d{1,2}[\.\/\-]\d{1,2}[\.\/\-]\d{2,4}/); return m ? m[0] : cleaned; }
    function parseDateObj(txt) { if (!txt) return null; let raw = txt.toString().trim(); let iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/); let day, month, year; if (iso) { year = parseInt(iso[1], 10); month = parseInt(iso[2], 10) - 1; day = parseInt(iso[3], 10); } else { let m = raw.match(/(\d{1,2})[\.\/\-](\d{1,2})[\.\/\-](\d{2,4})/); if (!m) return null; day = parseInt(m[1], 10); month = parseInt(m[2], 10) - 1; year = parseInt(m[3], 10); if (year < 100) year += 2000; } let dt = new Date(year, month, day); if (dt.getFullYear() !== year || dt.getMonth() !== month || dt.getDate() !== day) return null; dt.setHours(0,0,0,0); return dt; }
    function formatLongTurkishDate(date) {
        if (!date) return "-";
        const dt = (date instanceof Date) ? date : parseDateObj(date);
        if (!dt) return "-";
        const months = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
        return `${dt.getDate()} ${months[dt.getMonth()]} ${dt.getFullYear()}`;
    }

    // Geriye dönük uyumluluk için kullanılan temel durum çözümleyicisi.
    // Ortak motor ve eski ekranlar aynı tamamlanma/gecikme kuralını buradan alır.
    function isCommonActionCompleted(item) {
        const progress = ((item && item.progress) || '').toString().toLowerCase();
        return progress.includes('completed') || progress.includes('tamamlandı') || progress.includes('tamamlandi') || progress.includes('100') || progress.trim() === '100';
    }

    function getLegacyActionStatusCore(item, todayValue = null) {
        const targetDate = item && item.estDate && item.estDate !== 'Kapatıldı' && item.estDate !== 'Tarih Yok'
            ? parseDateObj(item.estDate)
            : null;
        if (isCommonActionCompleted(item)) return { label: 'Tamamlandı', color: 'ok', type: 'done', targetDate };
        const today = todayValue instanceof Date ? new Date(todayValue) : todayMidnight();
        today.setHours(0, 0, 0, 0);
        if (targetDate && targetDate < today) return { label: 'Gecikmiş', color: 'danger', type: 'late', targetDate };
        return { label: 'Bekliyor', color: 'warn', type: 'pending', targetDate };
    }

    function getStatus(item) {
        // Eski ekranların beklediği done/late/pending biçimini koruyan uyumluluk katmanı.
        // Asıl sınıflandırma artık ortak hesaplama motorundan gelir.
        const classification = classifyCommonActionStatus(item, { upcomingDays: 30 });
        if (classification.code === COMMON_ACTION_STATUS.COMPLETED.code) return { label: 'Tamamlandı', color: 'ok', type: 'done' };
        if (classification.code === COMMON_ACTION_STATUS.LATE.code) return { label: 'Gecikmiş', color: 'danger', type: 'late' };
        return { label: 'Bekliyor', color: 'warn', type: 'pending' };
    }
    function getCheckedValues(id) { const c = document.getElementById(id); if (!c) return ['all']; const cb = Array.from(c.querySelectorAll('input[type="checkbox"]:checked')); if (cb.length === 0) return ['all']; return cb.map(b => b.value); }
    
    const ICAO_GLOBAL_ORDER = ['LEG', 'ORG', 'PEL', 'OPS', 'AIR', 'AIG', 'ANS', 'AGA'];
    function sortAreas(a, b) { let strA = a ? a.toString().trim().toUpperCase() : ""; let strB = b ? b.toString().trim().toUpperCase() : ""; let ia = ICAO_GLOBAL_ORDER.indexOf(strA); let ib = ICAO_GLOBAL_ORDER.indexOf(strB); if (ia === -1 && ib === -1) return strA.localeCompare(strB); if (ia === -1) return 1; if (ib === -1) return -1; return ia - ib; }
    function sortPQs(a, b) { let pa = a.split('.').map(Number); let pb = b.split('.').map(Number); let numA1 = isNaN(pa[0]) ? 999 : pa[0]; let numB1 = isNaN(pb[0]) ? 999 : pb[0]; if (numA1 !== numB1) return numA1 - numB1; let numA2 = isNaN(pa[1]) ? 999 : pa[1]; let numB2 = isNaN(pb[1]) ? 999 : pb[1]; return numA2 - numB2; }

    function renderFileList() {
        const wContainer = document.getElementById('wordFileList');
        const wordFiles = Array.from(loadedFiles);
        if (wordFiles.length === 0) {
            wContainer.innerHTML = `<div style="font-size: 10px; color: var(--muted); padding: 5px 0;">Yüklenmedi.</div>`;
        } else {
            wContainer.innerHTML = wordFiles.map(f => `<div class="file-badge"><span class="truncate" style="max-width: 150px;" title="${escapeHtml(f)}">📝 ${escapeHtml(f)}</span><span class="file-remove-btn" onclick="removeWordFile('${String(f).replace(/'/g, "\\'")}')">✕</span></div>`).join('');
        }
        
        const eContainer = document.getElementById('excelFileList');
        const eiStatusTxt = document.getElementById('eiStatusTxt');
        if (!loadedExcelFile) {
            eContainer.innerHTML = `<div style="font-size: 10px; color: var(--warn); padding: 5px 0;">Yüklenmedi.</div>`;
            eiStatusTxt.style.display = "none";
        } else {
            eContainer.innerHTML = `<div class="file-badge" style="border-color: var(--ok); background: rgba(16, 185, 129, 0.05);"><span class="truncate" style="max-width: 150px;" title="${escapeHtml(loadedExcelFile)}">📊 ${escapeHtml(loadedExcelFile)}</span><span class="file-remove-btn" onclick="removeExcelFile()">✕</span></div>`;
            eiStatusTxt.innerHTML = `<span style="color:var(--primary); font-weight:600;">${Object.keys(pqMasterData).length} PQ eşleşti.</span><span style="color:var(--ok); font-weight:600;">${Object.keys(baseEIData).length > 0 ? " | 🚀 EI Aktif" : ""}</span>`;
            eiStatusTxt.style.display = "block";
        }
    }
    
    function removeWordFile(fileName) { loadedFiles.delete(fileName); rawData = rawData.filter(d => d.sourceFile !== fileName); recalculateGlobalStateFromFiles(); refreshAllFilters(); saveToLocalStorage(); renderFileList(); render(); }
    function removeExcelFile() { loadedExcelFile = null; pqMasterData = {}; baseEIData = {}; document.getElementById('eiOverallProgressPanel').style.display = "none"; document.getElementById('eiChartPanel').style.display = "none"; rawData = rawData.filter(d => d.sourceFile !== "Excel Kapanış Arşivi" && d.sourceFile !== "Excel Master"); refreshAllFilters(); saveToLocalStorage(); renderFileList(); render(); }


    function downloadTemplate() {
        try {
            if (typeof XLSX === 'undefined') throw new Error('Excel kütüphanesi yüklenemedi.');

            const headers = [
                'PQ No', 'Denetim Alanı', 'CE', 'PQ Sorusu', 'Bulgu',
                'Doğrulama Türü', 'ICAO Değerlendirmesi', 'Sorumlu',
                'GÜNLÜK RAPORA EKLE', 'RAPOR NOTU', 'ICAO KAPATTI MI',
                'VALIDASYON GÖREVİ', 'PQ Sorusu (TR)', 'Bulgu (TR)'
            ];

            const pqKeys = Object.keys(pqMasterData || {}).sort((a, b) => {
                if (typeof sortPQs === 'function') return sortPQs(a, b);
                return String(a).localeCompare(String(b), 'tr', { numeric: true, sensitivity: 'base' });
            });

            const excelRows = [headers];
            pqKeys.forEach(pq => {
                const m = pqMasterData[pq] || {};
                excelRows.push([
                    pq,
                    m.alan || '',
                    m.ce || '',
                    m.soru || '',
                    m.bulgu || '',
                    m.tur || '',
                    m.degerlendirme || '',
                    m.sorumlu || '',
                    (typeof dailyReviewedPQs !== 'undefined' && dailyReviewedPQs.has(pq)) ? 'EVET' : '',
                    (typeof dailyPQNotes !== 'undefined' && dailyPQNotes[pq]) ? dailyPQNotes[pq] : '',
                    m.isIcaoClosed ? 'EVET' : '',
                    m.validasyonGorevi || '',
                    m.soruTr || '',
                    m.bulguTr || ''
                ]);
            });

            const wb = XLSX.utils.book_new();
            const wsMaster = XLSX.utils.aoa_to_sheet(excelRows);
            wsMaster['!cols'] = [
                {wch:12},{wch:18},{wch:10},{wch:55},{wch:70},{wch:20},{wch:24},
                {wch:24},{wch:20},{wch:45},{wch:18},{wch:24},{wch:55},{wch:70}
            ];
            wsMaster['!freeze'] = { xSplit: 0, ySplit: 1 };
            if (excelRows.length > 1) wsMaster['!autofilter'] = { ref: `A1:N${excelRows.length}` };
            XLSX.utils.book_append_sheet(wb, wsMaster, 'Excel_Veri');

            const defaultAreas = ['LEG','ORG','PEL','OPS','AIR','AIG','ANS','AGA'];
            const areaKeys = Object.keys(baseEIData || {});
            const areas = (areaKeys.length ? areaKeys : defaultAreas).slice().sort((a,b) => {
                if (typeof sortAreas === 'function') return sortAreas(a,b);
                return defaultAreas.indexOf(a) - defaultAreas.indexOf(b);
            });
            const eiRows = [['DENETİM ALANI','UYGULANABİLİR TOPLAM PQ','MEVCUT SATISFACTORY','AFTER VALIDASYON']];
            areas.forEach((area, idx) => {
                const b = (baseEIData || {})[area] || {};
                const rowNo = idx + 2;
                eiRows.push([
                    area,
                    Number.isFinite(Number(b.total)) && Number(b.total) > 0 ? Number(b.total) : '',
                    Number.isFinite(Number(b.sat)) && Number(b.sat) >= 0 ? Number(b.sat) : '',
                    { f: `C${rowNo}+(COUNTIFS(Excel_Veri!B:B,EI_Referans!A${rowNo},Excel_Veri!K:K,"EVET"))` }
                ]);
            });
            const wsEi = XLSX.utils.aoa_to_sheet(eiRows);
            wsEi['!cols'] = [{wch:20},{wch:26},{wch:24},{wch:22}];
            wsEi['!freeze'] = { xSplit: 0, ySplit: 1 };
            XLSX.utils.book_append_sheet(wb, wsEi, 'EI_Referans');

            const infoRows = [
                ['PQ Excel Master Şablonu'],
                ['Kullanım', 'Excel_Veri sayfasındaki satırları güncelleyip uygulamaya tekrar yükleyebilirsiniz.'],
                ['TR alanları', 'PQ Sorusu (TR) ve Bulgu (TR) sütunları Türkçe karşılıklar içindir.'],
                ['Önemli', 'ICAO KAPATTI MI sütununda EVET yazılan PQ, EI_Referans validasyon hesabına dahil edilir.'],
                ['Not', pqKeys.length ? 'Bu dosya uygulamada mevcut olan Master verinin dışa aktarılmış kopyasıdır.' : 'Master veri yüklü olmadığı için boş şablon oluşturulmuştur.']
            ];
            const wsInfo = XLSX.utils.aoa_to_sheet(infoRows);
            wsInfo['!cols'] = [{wch:24},{wch:95}];
            XLSX.utils.book_append_sheet(wb, wsInfo, 'Kullanım');

            XLSX.writeFile(wb, 'PQ_Excel_Master_Sablonu_TR_Ekli.xlsx');
            if (typeof showAppRuntimeToast === 'function') {
                showAppRuntimeToast(pqKeys.length ? `Excel Master dışa aktarıldı: ${pqKeys.length} PQ.` : 'Boş Excel Master şablonu indirildi.', 'success');
            }
        } catch (err) {
            console.error('Excel Master şablon dışa aktarma hatası:', err);
            alert('Excel Master şablonu oluşturulamadı: ' + (err.message || err));
        }
    }
    window.downloadTemplate = downloadTemplate;
    function clearAllData() { if(confirm("Tüm bulut verileri silinecek. Emin misiniz?")) { db.ref('icao_system').remove().then(() => { location.reload(); }); } }
    function updateDynamicSubtitle() {
        const subEl = document.getElementById('mainSubtitle');
        if (!subEl) return;
        if (window_loadedReportDate) {
            const dateStr = currentUiLang === 'en' ? formatLongEnglishDate(window_loadedReportDate) : formatLongTurkishDate(window_loadedReportDate);
            const isArchive = Array.from(loadedFiles).some(f => f.includes('[Arşiv]'));
            if (currentUiLang === 'en') {
                subEl.innerText = isArchive
                    ? `📦 [ARCHIVE] These data were restored from archive records dated ${dateStr}.`
                    : `These data were obtained from reports retrieved from ICAO USOAP OLF on ${dateStr}.`;
            } else {
                subEl.innerText = isArchive
                    ? `📦 [ARŞİV] Bu veriler, ${dateStr} tarihli arşiv kayıtlarından geri yüklenmiştir.`
                    : `Bu veriler, ${dateStr} tarihinde ICAO USOAP OLF'den alınan raporlardan temin edilmiştir.`;
            }
            subEl.style.color = "var(--primary)";
            subEl.style.fontWeight = "600";
        } else {
            subEl.innerText = t('appSubtitle');
            subEl.style.color = "var(--muted)";
            subEl.style.fontWeight = "normal";
        }
    }
    function recalculateGlobalStateFromFiles() { window.loadedWordAreas.clear(); window_loadedReportDate = null; loadedFiles.forEach(fileName => { let upperName = fileName.toUpperCase(); ICAO_GLOBAL_ORDER.forEach(a => { if (upperName.includes(a)) window.loadedWordAreas.add(a); }); let dateMatch = fileName.match(/(\d{4})(\d{2})(\d{2})/); if(dateMatch && !window_loadedReportDate) window_loadedReportDate = new Date(dateMatch[1], parseInt(dateMatch[2], 10) - 1, parseInt(dateMatch[3], 10)); }); updateDynamicSubtitle(); }

    window.filterCheckboxes = function(inputId, listId) { let filterText = document.getElementById(inputId).value.toLowerCase(); let labels = document.getElementById(listId).getElementsByTagName('label'); for (let i = 0; i < labels.length; i++) { let txtValue = labels[i].textContent || labels[i].innerText; labels[i].style.display = txtValue.toLowerCase().indexOf(filterText) > -1 ? "flex" : "none"; } };


    // ================================================================
    // HAZIR FİLTRELER
    // Tek bir hazır filtre aynı anda aktif olur. Alan, CE, ofis, personel,
    // doğrulama türü ve metin araması gibi kapsam filtreleri korunur.
    // ================================================================
    const READY_FILTER_DEFINITIONS = Object.freeze({
        late: { label: 'Gecikmiş Adımlar', description: 'Hedef tarihi geçmiş ve henüz tamamlanmamış CAP adımları.' },
        upcoming_30: { label: 'Yaklaşan 30 Gün', description: 'Bugünden itibaren 30 gün içinde hedef tarihi gelen açık CAP adımları.' },
        date_risk: { label: 'Tarih Riski / Eksik Tarih', description: 'Açık olduğu halde geçerli hedef tarihi bulunmayan CAP adımları.' },
        pq_completed: { label: 'Tüm Adımları Tamamlanan PQ', description: 'Kullanılabilir tüm CAP adımları tamamlanmış, ICAO validasyonu bekleyen PQ kayıtları.' },
        pq_open: { label: 'Açık PQ\'lar', description: 'Tüm CAP adımları tamamlanmamış veya CAP/tarih riski bulunan PQ kayıtları.' },
        closable_month: { label: 'Ay Sonuna Kadar Kapanabilir PQ', description: 'Açık adımlarının tamamının hedef tarihi içinde bulunulan ayın sonuna kadar gelen PQ kayıtları.' },
        evidence_waiting: { label: 'Kanıt Bekleyenler', description: 'Kanban iç süreç aşaması “Kanıt Bekleniyor” olarak işaretlenen CAP adımları.' },
        empty_cap: { label: 'CAP Yok / Eylem Boş', description: 'CAP adımı bulunmayan veya CAP eylem metni boş olan PQ kayıtları.' },
        missing_office: { label: 'Sorumlu Ofisi Eksik', description: 'CAP adımında sorumlu ofis bilgisi boş veya geçersiz olan kayıtlar.' }
    });

    window.activeReadyFilter = null;

    function getReadyFilterMonthEnd(referenceDate = new Date()) {
        const date = referenceDate instanceof Date ? new Date(referenceDate) : new Date();
        return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
    }

    function getReadyFilterMonthLabel(referenceDate = new Date()) {
        const months = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
        return `${months[referenceDate.getMonth()]} Sonuna Kadar Kapanabilir`;
    }

    function buildReadyFilterContext(sourceRows) {
        const rows = Array.isArray(sourceRows) ? sourceRows : [];
        const groups = {};
        rows.forEach(row => {
            if (!row || !row.pq) return;
            if (!groups[row.pq]) groups[row.pq] = [];
            groups[row.pq].push(row);
        });
        const monthEnd = getReadyFilterMonthEnd();
        const pqClassifications = {};
        Object.keys(groups).forEach(pq => {
            pqClassifications[pq] = classifyCommonPQStatus(pq, groups[pq], { projectionDate: monthEnd, upcomingDays: 30 });
        });
        return { rows, groups, monthEnd, pqClassifications };
    }

    function isMissingResponsibleOffice(value) {
        const normalized = String(value || '').trim().toUpperCase();
        return !normalized || normalized === '-' || normalized === 'N/A' || normalized === 'NA' || normalized === 'BELİRTİLMEDİ' || normalized === 'BELIRTILMEDI' || normalized === 'BİLİNMİYOR' || normalized === 'BILINMIYOR';
    }

    function matchesReadyFilter(row, filterKey, context) {
        if (!filterKey || !READY_FILTER_DEFINITIONS[filterKey]) return true;
        const actionClass = getCommonActionClassification(row);
        const pqClass = context && context.pqClassifications ? context.pqClassifications[row.pq] : null;
        switch (filterKey) {
            case 'late': return actionClass.code === COMMON_ACTION_STATUS.LATE.code;
            case 'upcoming_30': return actionClass.code === COMMON_ACTION_STATUS.UPCOMING.code;
            case 'date_risk': return actionClass.code === COMMON_ACTION_STATUS.DATE_RISK.code;
            case 'pq_completed': return !!pqClass && pqClass.code === COMMON_PQ_STATUS.CAP_COMPLETED.code;
            case 'pq_open': return !!pqClass && ![COMMON_PQ_STATUS.CAP_COMPLETED.code, COMMON_PQ_STATUS.OFFICIAL_CLOSED.code].includes(pqClass.code);
            case 'closable_month': return !!pqClass && pqClass.code === COMMON_PQ_STATUS.PROJECTED_CLOSABLE.code;
            case 'evidence_waiting': return getKanbanWorkflowStage(row.pq, row.step) === 'Kanıt Bekleniyor';
            case 'empty_cap': return row.isEmptyCap === true || (!!pqClass && pqClass.code === COMMON_PQ_STATUS.NO_CAP.code);
            case 'missing_office': return isMissingResponsibleOffice(row.office);
            default: return true;
        }
    }

    function clearReadyFilterConflicts() {
        ['statusFilterList', 'pqStatusFilterList', 'icaoValidationFilterList'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.querySelectorAll('input[type="checkbox"]').forEach(cb => { cb.checked = false; });
        });
        const dateStart = document.getElementById('dateStart');
        const dateEnd = document.getElementById('dateEnd');
        if (dateStart) dateStart.value = '';
        if (dateEnd) dateEnd.value = '';
    }

    function updateReadyFiltersUI() {
        const active = window.activeReadyFilter;
        document.querySelectorAll('[data-ready-filter]').forEach(btn => {
            const isActive = btn.getAttribute('data-ready-filter') === active;
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
        const monthLabel = document.getElementById('readyFilterMonthLabel');
        if (monthLabel) monthLabel.textContent = getReadyFilterMonthLabel();
        const info = document.getElementById('activeReadyFilterInfo');
        if (!info) return;
        const def = active ? READY_FILTER_DEFINITIONS[active] : null;
        if (!def) {
            info.classList.remove('show');
            info.innerHTML = '';
            return;
        }
        info.classList.add('show');
        info.innerHTML = `<span><b>Aktif hazır filtre:</b> ${def.label}<br><span style="color:var(--muted);">${def.description}</span></span><button type="button" onclick="clearReadyFilter()" title="Hazır filtreyi kaldır">✖</button>`;
    }

    window.applyReadyFilter = function(filterKey) {
        if (filterKey === 'official_closed') {
            window.activeReadyFilter = null;
            updateReadyFiltersUI();
            switchTab('icao-closed');
            renderIcaoClosedList();
            const panel = document.getElementById('rightFiltersPanel');
            if (panel) panel.classList.remove('open');
            return;
        }
        if (!READY_FILTER_DEFINITIONS[filterKey]) return;
        const nextFilter = window.activeReadyFilter === filterKey ? null : filterKey;
        if (nextFilter) clearReadyFilterConflicts();
        window.activeReadyFilter = nextFilter;
        updateReadyFiltersUI();
        render();
    };

    window.clearReadyFilter = function() {
        window.activeReadyFilter = null;
        updateReadyFiltersUI();
        render();
    };


    window.runReadyFilterSelfCheck = function() {
        const context = buildReadyFilterContext(rawData);
        const counts = {};
        Object.keys(READY_FILTER_DEFINITIONS).forEach(key => {
            const rows = rawData.filter(row => matchesReadyFilter(row, key, context));
            counts[key] = {
                rows: rows.length,
                pqs: new Set(rows.map(row => row.pq)).size
            };
        });
        const validKeys = Object.keys(READY_FILTER_DEFINITIONS).every(key => counts[key] && Number.isInteger(counts[key].rows));
        const subsetsValid = Object.values(counts).every(item => item.rows >= 0 && item.rows <= rawData.length && item.pqs >= 0);
        const result = {
            passed: validKeys && subsetsValid,
            activeFilter: window.activeReadyFilter,
            sourceRows: rawData.length,
            counts
        };
        console.table(Object.keys(counts).map(key => ({ filtre: READY_FILTER_DEFINITIONS[key].label, satir: counts[key].rows, pq: counts[key].pqs })));
        console.log('Hazır filtre öz denetimi:', result);
        return result;
    };
    window.clearFilters = function() { document.getElementById('searchInput').value = ''; document.getElementById('dateStart').value = ''; document.getElementById('dateEnd').value = ''; document.querySelectorAll('.checkbox-list input[type="checkbox"]').forEach(cb => cb.checked = false); if(document.getElementById('officeSearchInput')) document.getElementById('officeSearchInput').value = ''; if(document.getElementById('personSearchInput')) document.getElementById('personSearchInput').value = ''; window.activeSmartTags.clear(); window.activeReadyFilter = null; updateReadyFiltersUI(); window.filterCheckboxes('officeSearchInput', 'officeFilterList'); window.filterCheckboxes('personSearchInput', 'personFilterList'); render(); };
    window.toggleSmartTag = function(keyword, event) { if(event) event.stopPropagation(); if(window.activeSmartTags.has(keyword)) { window.activeSmartTags.delete(keyword); } else { window.activeSmartTags.add(keyword); } render(); };
    function updateActiveTagsUI() { let container = document.getElementById('activeTagsContainer'); let group = document.getElementById('activeTagsGroup'); if(!container) return; if(window.activeSmartTags && window.activeSmartTags.size > 0) { group.style.display = 'block'; container.innerHTML = Array.from(window.activeSmartTags).map(tag => { return `<span class="smart-tag" style="background:var(--primary); color:white; border-radius:4px; padding:4px 8px; font-size:11px;" onclick="window.toggleSmartTag('${tag}')">${tag.toUpperCase()} ✖</span>`; }).join(''); } else { group.style.display = 'none'; container.innerHTML = ''; } }

    function populateCheckboxes(set, id, isArea = false) {
        let container = document.getElementById(id);
        if (!container) return;
        let currentlyChecked = getCheckedValues(id);
        if(set.size > 0) {
            let arr = Array.from(set);
            if (isArea) arr.sort(sortAreas); else arr.sort();
            container.innerHTML = arr.map(i => {
                let isChecked = currentlyChecked.includes(i) ? "checked" : "";
                return `<label><input type="checkbox" value="${escapeHtml(i)}" onchange="render()" ${isChecked}> ${escapeHtml(i)}</label>`;
            }).join('');
            const group = document.getElementById(id + 'Group');
            if (group) group.style.display = "block";
        } else {
            container.innerHTML = "";
        }
    }
    
    function refreshAllFilters() { 
        let offices = new Set(), persons = new Set(), siteTypes = new Set(), areas = new Set(), ces = new Set(), icaos = new Set(); let activeAreas = window.loadedWordAreas || new Set(); 
        rawData.forEach(d => { let m = pqMasterData[d.pq] || {}; let alan = m.alan ? m.alan.trim().toUpperCase() : null; if (activeAreas.size === 0 || (alan && activeAreas.has(alan))) { if (d.office) offices.add(d.office.trim()); } }); 
        Object.values(pqMasterData).forEach(obj => { let alan = obj.alan ? obj.alan.trim().toUpperCase() : null; if (alan) areas.add(obj.alan); if (activeAreas.size === 0 || (alan && activeAreas.has(alan))) { if(obj.sorumlu) persons.add(obj.sorumlu); if(obj.tur) siteTypes.add(obj.tur); if(obj.ce) ces.add(obj.ce); if(obj.degerlendirme) icaos.add(obj.degerlendirme); } }); 
        populateCheckboxes(offices, 'officeFilterList'); populateCheckboxes(persons, 'personFilterList'); populateCheckboxes(siteTypes, 'typeFilterList'); populateCheckboxes(ces, 'ceFilterList'); populateCheckboxes(icaos, 'icaoFilterList'); 
        if (activeAreas.size > 0) { let restrictedAreas = new Set(); areas.forEach(a => { if (activeAreas.has(a.toString().trim().toUpperCase())) restrictedAreas.add(a); }); populateCheckboxes(restrictedAreas.size > 0 ? restrictedAreas : areas, 'areaFilterList', true); } else populateCheckboxes(areas, 'areaFilterList', true); 
        if(document.getElementById('personSearchInput') && document.getElementById('personSearchInput').value !== "") { window.filterCheckboxes('personSearchInput', 'personFilterList'); }
        if(document.getElementById('officeSearchInput') && document.getElementById('officeSearchInput').value !== "") { window.filterCheckboxes('officeSearchInput', 'officeFilterList'); }
    }

    // WORD DOSYASI YÜKLEME VE YENİ UYARI MANTIĞI
    // 30.06.2026 düzeltmesi: ICAO OLF bazı DOCX çıktılarında tüm PQ'ları tek büyük Word tablosu içinde üretiyor.
    // Bu parser artık "tablo = tek PQ" varsayımı yapmaz; satır satır ilerleyerek her yeni PROTOCOL FINDING/PQ başlığında bölümü değiştirir.
    function detectPQHeaderFromCells(cellTexts) {
        const normalizedCells = cellTexts.map(t => (t || "").replace(/\s+/g, " ").trim());
        const rowText = normalizedCells.join(" ").trim();
        if (!rowText) return "";

        // Gerçek PQ başlık satırı; örn: Not Satisfactory / CE-2 / 8.001 / soru metni.
        // Eylem satırlarında geçen "PQ No. 8.053" gibi referansları yanlışlıkla yeni bölüm saymamak için
        // CE veya Satisfactory bağlamı arıyoruz ve PQ'nun bir hücrenin başında olmasını tercih ediyoruz.
        const hasStatusContext = /\b(?:Not\s+)?Satisfactory\b/i.test(rowText);
        const hasCeContext = /\bCE-\d+\b/i.test(rowText);
        const pqAtCellStart = normalizedCells.map(t => t.match(/^\s*(\d{1,2}\.\d{3})\b/)).find(Boolean);
        if (pqAtCellStart && (hasStatusContext || hasCeContext)) return normalizePQ(pqAtCellStart[1]);

        // Yedek kural: bazı Word çıktılarında PQ hücresi başta görünmeyebilir; yine de CE/Status bağlamı varsa başlık kabul et.
        if (hasStatusContext && hasCeContext) {
            const pqAnywhere = rowText.match(/\b(\d{1,2}\.\d{3})\b/);
            if (pqAnywhere) return normalizePQ(pqAnywhere[1]);
        }
        return "";
    }

    function parseCapStepFromCellTexts(cellTexts) {
        if (!cellTexts || cellTexts.length < 7) return null;
        let step = (cellTexts[0] || "").trim();
        if (!/^\d+$/.test(step)) return null;

        let action = cleanDocxCellText(cellTexts[1] || "");
        let office = cleanDocxCellText(cellTexts[2] || "");
        // OLF CAP tablosunda 4. sütun EVIDENCE REFERENCE alanıdır.
        // Bazı DOCX'lerde başlık satırı birleşik hücreli görünse de veri satırlarında konum sabittir.
        let evidenceReference = cleanDocxCellText(cellTexts[3] || "");
        let progress = cleanDocxCellText(cellTexts[cellTexts.length - 1] || "");
        let isCompleted = progress.toLowerCase().includes('completed') || progress.toLowerCase().includes('tamamlandı') || progress.toLowerCase().includes('tamamlandi') || progress.includes('100');

        let estDateRaw = extractValidDateStr(cellTexts[4]);
        let revDateRaw = extractValidDateStr(cellTexts[5]);
        let compDateRaw = extractValidDateStr(cellTexts[6]);
        let finalDate = estDateRaw;
        if (/^\d/.test(revDateRaw)) finalDate = revDateRaw;
        if (isCompleted && /^\d/.test(compDateRaw)) finalDate = compDateRaw;

        let isPlaceholder = action.trim() === "" || action.toLowerCase().includes("click here") || action.trim().length < 4;
        return { step, action, office, evidenceReference, estDate: finalDate || "Tarih Yok", progress: progress || "0%", isPlaceholder };
    }

    function makeActionKey(pq, step, action) {
        return `${pq}||${step}||${(action || '').slice(0, 500)}`;
    }

    function mergeEvidenceReferenceText(currentValue, newValue) {
        const a = String(currentValue || '').trim();
        const b = String(newValue || '').trim();
        if (!a) return b;
        if (!b) return a;
        const na = a.replace(/\s+/g, ' ').trim().toLocaleLowerCase('tr');
        const nb = b.replace(/\s+/g, ' ').trim().toLocaleLowerCase('tr');
        if (na === nb || na.includes(nb)) return a;
        if (nb.includes(na)) return b;
        return a + '\n' + b;
    }

    function makeCapDuplicateIndexes() {
        const actionMap = new Map();
        rawData.forEach(d => actionMap.set(makeActionKey(d.pq, d.step, d.action), d));
        return {
            actionKeys: new Set(actionMap.keys()),
            actionMap,
            pqKeys: new Set(rawData.map(d => d.pq))
        };
    }

    function pushParsedCapSection(section, fileName, duplicateIndex) {
        let result = { addedActions: 0, addedEmptyCaps: 0 };
        if (!section || !section.pq || section.pq === "Bilinmeyen PQ") return result;

        const indexes = duplicateIndex || makeCapDuplicateIndexes();
        let filledSteps = section.tempSteps.filter(s => !s.isPlaceholder);
        if (filledSteps.length > 0) {
            filledSteps.forEach(s => {
                const key = makeActionKey(section.pq, s.step, s.action);
                if (!indexes.actionKeys.has(key)) {
                    const row={ pq: section.pq, step: s.step, action: s.action, office: s.office, evidenceReference: s.evidenceReference || '', estDate: s.estDate, progress: s.progress, sourceFile: fileName, note: "", isEmptyCap: false };
                    rawData.push(row);
                    indexes.actionKeys.add(key);
                    if(indexes.actionMap) indexes.actionMap.set(key,row);
                    indexes.pqKeys.add(section.pq);
                    result.addedActions++;
                } else if (s.evidenceReference) {
                    // Aynı CAP adımı daha önce yüklenmişse yeni Word'deki kanıt referansını kaybetme.
                    const existing = indexes.actionMap ? indexes.actionMap.get(key) : rawData.find(d=>makeActionKey(d.pq,d.step,d.action)===key);
                    if(existing) existing.evidenceReference = mergeEvidenceReferenceText(existing.evidenceReference, s.evidenceReference);
                }
            });
        } else if (section.tempSteps.length > 0 || section.hasCapMarker || section.hasProtocolMarker) {
            if (!indexes.pqKeys.has(section.pq)) {
                rawData.push({
                    pq: section.pq,
                    step: "-",
                    action: "⚠️ OLF üzerinde CAP (Eylem Planı) adımları hiç girilmemiştir veya tamamı boştur.",
                    office: "Belirtilmedi",
                    estDate: "Tarih Yok",
                    progress: "0%",
                    evidenceReference: "",
                    sourceFile: fileName,
                    note: "",
                    isEmptyCap: true
                });
                indexes.pqKeys.add(section.pq);
                indexes.actionKeys.add(makeActionKey(section.pq, "-", "EMPTY_CAP"));
                result.addedEmptyCaps++;
            }
        }
        return result;
    }

    async function parseDocxCapTables(xmlDoc, fileName, options = {}) {
        const tables = Array.from(xmlDoc.getElementsByTagName("w:tbl"));
        const duplicateIndex = options.duplicateIndex || makeCapDuplicateIndexes();
        let stats = { tables: tables.length, pqSections: 0, addedActions: 0, addedEmptyCaps: 0, rows: 0 };
        let processedRows = 0;
        let lastYieldAt = (typeof performance !== 'undefined' ? performance.now() : Date.now());

        for (let ti = 0; ti < tables.length; ti++) {
            let currentSection = null;
            const table = tables[ti];
            const rows = Array.from(table.getElementsByTagName("w:tr"));

            const finalizeCurrentSection = () => {
                let added = pushParsedCapSection(currentSection, fileName, duplicateIndex);
                stats.addedActions += added.addedActions;
                stats.addedEmptyCaps += added.addedEmptyCaps;
                currentSection = null;
            };

            for (let ri = 0; ri < rows.length; ri++) {
                const row = rows[ri];
                const rCells = getRowCells(row);
                const cellTexts = rCells.map(c => getCellText(c));
                const rowText = cellTexts.join(" ");
                const detectedPQ = detectPQHeaderFromCells(cellTexts);

                if (detectedPQ) {
                    finalizeCurrentSection();
                    currentSection = { pq: detectedPQ, tempSteps: [], hasCapMarker: false, hasProtocolMarker: true };
                    stats.pqSections++;
                } else if (currentSection) {
                    if (rowText.includes("CAP Action Items")) currentSection.hasCapMarker = true;
                    if (rowText.includes("PROTOCOL FINDING")) currentSection.hasProtocolMarker = true;
                    let parsedStep = parseCapStepFromCellTexts(cellTexts);
                    if (parsedStep) currentSection.tempSteps.push(parsedStep);
                }

                processedRows++;
                stats.rows = processedRows;
                const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
                if (processedRows % 25 === 0 || now - lastYieldAt > 120) {
                    setLoadingMessage(`Word işleniyor: ${fileName}`, `${processedRows} satır tarandı · ${stats.pqSections} PQ bölümü bulundu · ${stats.addedActions} eylem alındı`);
                    lastYieldAt = now;
                    await yieldToBrowser();
                }
            }

            finalizeCurrentSection();
            if (tables.length > 1 && (ti + 1) % 5 === 0) {
                setLoadingMessage(`Word işleniyor: ${fileName}`, `${ti + 1}/${tables.length} tablo işlendi · ${stats.pqSections} PQ bölümü bulundu`);
                await yieldToBrowser();
            }
        }

        if (stats.pqSections === 0) {
            console.warn(`DOCX içinde PQ başlığı bulunamadı: ${fileName}`);
        } else {
            console.info(`DOCX okundu: ${fileName} | Tablo: ${stats.tables} | PQ: ${stats.pqSections} | Eylem: ${stats.addedActions} | Boş CAP: ${stats.addedEmptyCaps}`);
        }
        return stats;
    }

    document.getElementById('docxInput').addEventListener('change', async (e) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;
        showLoading('Word dosyaları hazırlanıyor...', `${files.length} dosya seçildi.`);
        await yieldToBrowser();
        try {
            const duplicateIndex = makeCapDuplicateIndexes();
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                if (loadedFiles.has(file.name)) {
                    setLoadingMessage('Word dosyası zaten yüklü.', `${file.name} atlandı (${i + 1}/${files.length}).`);
                    await yieldToBrowser();
                    continue;
                }
                try {
                    setLoadingMessage(`Word dosyası açılıyor (${i + 1}/${files.length})`, file.name);
                    await yieldToBrowser();
                    const zip = await JSZip.loadAsync(file);
                    await yieldToBrowser();
                    const documentFile = zip.file("word/document.xml");
                    if (!documentFile) throw new Error("word/document.xml bulunamadı. Dosya geçerli bir DOCX olmayabilir.");

                    setLoadingMessage(`Word içeriği okunuyor (${i + 1}/${files.length})`, file.name);
                    const xml = await documentFile.async("string");
                    await yieldToBrowser();

                    setLoadingMessage(`Word XML ayrıştırılıyor (${i + 1}/${files.length})`, file.name);
                    const xmlDoc = new DOMParser().parseFromString(xml, "text/xml");
                    await yieldToBrowser();

                    const stats = await parseDocxCapTables(xmlDoc, file.name, { duplicateIndex });
                    loadedFiles.add(file.name);
                    setLoadingMessage(`Word dosyası işlendi (${i + 1}/${files.length})`, `${file.name}: ${stats.pqSections} PQ · ${stats.addedActions} eylem · ${stats.addedEmptyCaps} boş CAP`);
                    await yieldToBrowser();
                } catch (err) {
                    console.error("DOCX parse error:", err);
                    alert(`${file.name} okunurken hata oluştu: ${err.message || err}`);
                }
            }
            setLoadingMessage('Veriler hazırlanıyor...', 'Dosya listesi, filtreler ve gösterge panelleri güncelleniyor.');
            recalculateGlobalStateFromFiles();
            renderFileList();
            await yieldToBrowser();
            refreshAllFilters();
            await yieldToBrowser();
            saveToLocalStorage();
            await yieldToBrowser();
            render();
        } catch(e) {
            console.error(e);
            alert("Word dosyasını okurken bir hata oluştu: " + e.message);
        } finally {
            hideLoading();
            e.target.value = "";
        }
    });
    
    // EXCEL OKUMASI 
    document.getElementById('excelInput').addEventListener('change', async (e) => { 
        const file = e.target.files[0];
        if(!file) return;
        showLoading('Excel dosyası okunuyor...', file.name);
        await yieldToBrowser();
        try {
            const data = await file.arrayBuffer();
            await yieldToBrowser();
            setLoadingMessage('Excel çalışma kitabı ayrıştırılıyor...', file.name);
            const wb = XLSX.read(data);
            await yieldToBrowser();
            const masterSheetName = findExcelMasterSheetName(wb);
            const wsMaster = wb.Sheets[masterSheetName];
            const jsonData = XLSX.utils.sheet_to_json(wsMaster, {defval:''});
            await yieldToBrowser();
            const rawHeaders=jsonData.length?Object.keys(jsonData[0]||{}):[];
            const firstHeaders=rawHeaders.map(normalizeExcelHeaderName);
            const looseHeaders=rawHeaders.map(normalizeExcelHeaderLoose);
            let isBackupFile = jsonData.length > 0 && firstHeaders.includes('GÜNLÜK RAPORA EKLE') && !firstHeaders.includes('BULGU') && !firstHeaders.includes('PQ SORUSU');
            const hasQuestionTrHeader=looseHeaders.some(h=>['PQ SORUSU TR','SORU TR','PQ QUESTION TR'].includes(h));
            const hasFindingTrHeader=looseHeaders.some(h=>['BULGU TR','FINDING TR','AÇIKLAMA TR'].includes(h));
            let trQuestionImported=0,trFindingImported=0,trBothImported=0;
            if(!isBackupFile) pqMasterData = {};
            
            for (let i = 0; i < jsonData.length; i++) {
                const row = jsonData[i];
                let pqKey = findPQColumn(row);
                if(pqKey && row[pqKey]) {
                    let pqStr = normalizePQ(row[pqKey]);
                    if(pqStr) {
                        let icaoKapanis = getCol(row, ['ICAO KAPATTI MI', 'ICAO ONAYI', 'KAPANDI', 'KAPATILDI', 'ICAO CLOSED']);
                        let validasyonGorevi = getCol(row, ['VALIDASYON GÖREVİ', 'VALIDASYON', 'GÖREV', 'MISSION', 'EVENT', 'DENETİM']);
                        let isIcaoClosed = (icaoKapanis && icaoKapanis.toString().toUpperCase().trim() === 'EVET');

                        if(!isBackupFile) {
                            let alan = getCol(row, ['ALAN', 'AREA', 'DENETİM ALANI']) || "DİĞER";
                            const soruEng=getColExact(row,['PQ Sorusu','SORU','QUESTION','PQ QUESTION']) || getCol(row,['QUESTION']);
                            const bulguEng=getColExact(row,['Bulgu','FINDING','DESCRIPTION','AÇIKLAMA']) || getCol(row,['FINDING']);
                            const soruTr=getColExactLoose(row,['PQ Sorusu (TR)','PQ Sorusu TR','SORU (TR)','SORU TR','PQ QUESTION (TR)','PQ QUESTION TR']);
                            const bulguTr=getColExactLoose(row,['Bulgu (TR)','Bulgu TR','FINDING (TR)','FINDING TR','AÇIKLAMA (TR)','AÇIKLAMA TR']);
                            if(String(soruTr||'').trim()) trQuestionImported++;
                            if(String(bulguTr||'').trim()) trFindingImported++;
                            if(String(soruTr||'').trim()&&String(bulguTr||'').trim()) trBothImported++;
                            pqMasterData[pqStr] = {
                                alan: alan,
                                ce: getCol(row, ['CE', 'KRİTİK', 'CRITICAL']),
                                soru: soruEng,
                                soruTr: soruTr,
                                bulgu: bulguEng,
                                bulguTr: bulguTr,
                                tur: getCol(row, ['TÜR', 'TYPE', 'DOĞRULAMA']),
                                degerlendirme: getCol(row, ['DEĞERLENDİRME', 'STATUS', 'ICAO', 'DURUM']),
                                sorumlu: getCol(row, ['SORUMLU', 'PERSONEL']),
                                isIcaoClosed: isIcaoClosed,
                                validasyonGorevi: validasyonGorevi || "Belirtilmedi"
                            };
                        }

                        let rapEkle = getCol(row, ['GÜNLÜK RAPORA EKLE', 'RAPORA EKLE', 'REPORT']);
                        if (rapEkle !== undefined && rapEkle !== null) {
                            let val = String(rapEkle).trim().toUpperCase();
                            if (val === 'EVET' || val === 'X' || val === '1' || val === 'YES' || val === 'TRUE') dailyReviewedPQs.add(pqStr);
                            else if (val === 'HAYIR' || val === 'NO' || val === '0' || val === 'FALSE') dailyReviewedPQs.delete(pqStr);
                        }
                        let rapNotu = getCol(row, ['RAPOR NOTU', 'PQ NOTU', 'GÜNLÜK AÇIKLAMA']);
                        if (rapNotu !== undefined && rapNotu !== null && String(rapNotu).trim() !== "") dailyPQNotes[pqStr] = String(rapNotu);
                    }
                }
                if (i % 100 === 0) {
                    setLoadingMessage('Excel master verisi işleniyor...', `${i + 1}/${jsonData.length} satır kontrol edildi.`);
                    await yieldToBrowser();
                }
            }
            
            loadedExcelFile = file.name;
            window.lastPqTranslationImportDiagnostic={
                fileName:file.name,
                sheetName:masterSheetName,
                rowCount:jsonData.length,
                hasQuestionTrHeader,
                hasFindingTrHeader,
                questionTrCount:trQuestionImported,
                findingTrCount:trFindingImported,
                completeTrCount:trBothImported,
                importedAt:new Date().toISOString()
            };
            if(!isBackupFile){
                if(!hasQuestionTrHeader||!hasFindingTrHeader){
                    showAppRuntimeToast(`TR sütunları eksik: ${!hasQuestionTrHeader?'PQ Sorusu (TR) ':''}${!hasFindingTrHeader?'Bulgu (TR)':''}`.trim(),'error');
                } else if(trQuestionImported===0&&trFindingImported===0){
                    showAppRuntimeToast('TR sütunları bulundu ancak Türkçe hücrelerde veri yok. TR görünümünde ENG yedek metni gösterilecektir.','warn');
                } else {
                    showAppRuntimeToast(`Türkçe PQ verisi yüklendi: Soru ${trQuestionImported}, Bulgu ${trFindingImported}, ikisi tam ${trBothImported}.`,'success');
                }
            }

            let eiSheetName = wb.SheetNames.find(n => n.toUpperCase().includes('EI'));
            if (eiSheetName) {
                setLoadingMessage('EI referans sayfası okunuyor...', eiSheetName);
                await yieldToBrowser();
                const wsEI = wb.Sheets[eiSheetName];
                const jsonEI = XLSX.utils.sheet_to_json(wsEI);
                baseEIData = {};
                for (let i = 0; i < jsonEI.length; i++) {
                    const row = jsonEI[i];
                    let alan = row['DENETİM ALANI'] || row['ALAN'] || row['AREA'];
                    let total = parseInt(row['UYGULANABİLİR TOPLAM PQ'] || row['TOPLAM PQ'] || row['TOTAL PQ']);
                    let sat = parseInt(row['MEVCUT SATISFACTORY'] || row['SATISFACTORY'] || row['MEVCUT']);
                    let afterRaw = getCol(row, ['AFTER VALIDASYON', 'AFTER VALIDATION', 'VALIDASYON SONRASI', 'SONRASI SATISFACTORY', 'POST VALIDATION']);
                    let afterSat = parseInt(afterRaw);
                    if(alan && !isNaN(total) && !isNaN(sat)) {
                        baseEIData[alan.toString().trim().toUpperCase()] = { total, sat, afterSat: !isNaN(afterSat) ? afterSat : null };
                    }
                    if (i % 50 === 0) await yieldToBrowser();
                }

                if (Object.keys(baseEIData).length > 0) {
                    document.getElementById('eiOverallProgressPanel').style.display = "grid";
                    document.getElementById('eiChartPanel').style.display = "block";
                } else {
                    document.getElementById('eiOverallProgressPanel').style.display = "none";
                    document.getElementById('eiChartPanel').style.display = "none";
                }
            } else if(!isBackupFile) {
                document.getElementById('eiOverallProgressPanel').style.display = "none";
                document.getElementById('eiChartPanel').style.display = "none";
            }
            
            // Excel'de "EVET" olanları istatistikleri bozmaması için ana tablodan filtreliyoruz
            setLoadingMessage('ICAO kapalı PQ kayıtları ayrıştırılıyor...', 'Ana iş yükü listesinden resmen kapanan PQ kayıtları ayrılıyor.');
            const pqKeys = Object.keys(pqMasterData);
            for (let i = 0; i < pqKeys.length; i++) {
                let pqStr = pqKeys[i];
                let m = pqMasterData[pqStr];
                if (m.isIcaoClosed) rawData = rawData.filter(d => d.pq !== pqStr);
                if (i % 100 === 0) await yieldToBrowser();
            }

            setLoadingMessage('Ekran hazırlanıyor...', 'Filtreler, grafikler ve rapor panelleri güncelleniyor.');
            renderFileList();
            await yieldToBrowser();
            refreshAllFilters();
            await yieldToBrowser();
            saveToLocalStorage();
            await yieldToBrowser();
            render();
        } catch (err) {
            console.error(err);
            alert("Excel okunurken hata oluştu: " + err.message);
        } finally {
            hideLoading();
            e.target.value = "";
        }
    });

    // EKRAN 2: ICAO KAPATTI MI = EVET OLANLARIN LİSTELENMESİ
    window.renderIcaoClosedList = function() {
        let container = document.getElementById('icaoClosedListContainer');
        if(!container) return;
        
        let closedPQs = [];
        Object.keys(pqMasterData).forEach(pq => {
            if(pqMasterData[pq] && pqMasterData[pq].isIcaoClosed) { closedPQs.push({ pq: pq, ...pqMasterData[pq] }); }
        });

        if(closedPQs.length === 0) {
            container.innerHTML = `<div style="text-align:center; color:var(--muted); font-size:12px; padding:20px;">Excel master dosyasında henüz ICAO tarafından kapatılmış (EVET olarak işaretlenmiş) bir PQ bulunmamaktadır.</div>`;
            return;
        }

        let html = ""; let grouped = {};
        closedPQs.forEach(item => { let area = item.alan ? item.alan.trim().toUpperCase() : "DİĞER"; if(!grouped[area]) grouped[area] = []; grouped[area].push(item); });

        Object.keys(grouped).sort(sortAreas).forEach(area => {
            html += `<div style="margin-bottom:15px; border:1px solid #fde047; border-radius:6px; overflow:hidden;"><div style="background:#fef9c3; padding:8px 15px; font-weight:bold; color:#a16207; font-size:13px; border-bottom:1px solid #fde047;">📋 ${area} Alanı (${grouped[area].length} PQ)</div>`;
            grouped[area].sort((a,b) => sortPQs(a.pq, b.pq)).forEach(item => {
                html += `<div style="padding:10px 15px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; background:var(--card);">
                    <div><b style="color:var(--text); font-size:14px;">PQ ${item.pq}</b><span style="font-size:10px; background:#e0f2fe; color:#0369a1; padding:2px 6px; border-radius:4px; margin-left:5px; border:1px solid #bae6fd;">${item.validasyonGorevi || "GÖREV BİLİNMİYOR"}</span><br><span style="font-size:11px; color:var(--muted);">${escapeHtml(getLocalizedPqFinding(item) || (currentUiLang==='tr'?'Bulgu detayı yok':'Finding detail unavailable'))}</span></div>
                    <span style="color:#ca8a04; font-weight:bold; font-size:11px; white-space:nowrap; background:rgba(234, 179, 8, 0.1); padding:4px 8px; border-radius:4px;">🏆 OLF KAPALI</span>
                </div>`;
            });
            html += `</div>`;
        });
        container.innerHTML = html;
    };

    // CAP EKSİKLİKLERİ: CAP içeriği, tarih, sorumlu ve izlenebilirlik sorunları
    const CAP_DEFICIENCY_CATEGORIES = new Set([
        'missing_cap', 'missing_action',
        'missing_date', 'invalid_date', 'completion_date_conflict',
        'missing_office', 'missing_source'
    ]);

    function getCapDeficiencyGroup(category) {
        if (category === 'missing_cap' || category === 'missing_action') return 'content';
        if (category === 'missing_date' || category === 'invalid_date' || category === 'completion_date_conflict') return 'date';
        if (category === 'missing_office') return 'office';
        if (category === 'missing_source') return 'traceability';
        return 'other';
    }

    function getCapDeficiencyIssues(sourceRows) {
        const rows = Array.isArray(sourceRows) ? sourceRows : getFilteredData();
        const model = buildDataQualityModel(rows);
        return model.issues.filter(issue => CAP_DEFICIENCY_CATEGORIES.has(issue.category));
    }

    function getVisibleCapDeficiencyIssues(sourceRows) {
        const selected = (document.getElementById('capDeficiencyFilter') || {}).value || 'all';
        const issues = getCapDeficiencyIssues(sourceRows);
        return selected === 'all' ? issues : issues.filter(issue => getCapDeficiencyGroup(issue.category) === selected);
    }

    function capDeficiencySeverityStyle(severity) {
        if (severity === 'critical') return { bg:'#fee2e2', color:'#b91c1c', border:'#fecaca', label:'Kritik' };
        if (severity === 'high') return { bg:'#ffedd5', color:'#c2410c', border:'#fed7aa', label:'Yüksek' };
        if (severity === 'medium') return { bg:'#fef9c3', color:'#a16207', border:'#fde68a', label:'Orta' };
        return { bg:'#e0f2fe', color:'#0369a1', border:'#bae6fd', label:'Kontrol' };
    }

    window.renderEmptyCapsList = function() {
        const container = document.getElementById('emptyCapsListContainer');
        if (!container) return;

        const allIssues = getCapDeficiencyIssues(getFilteredData());
        const issues = getVisibleCapDeficiencyIssues(getFilteredData());
        const summary = document.getElementById('capDeficiencySummary');
        const affectedAll = new Set(allIssues.map(issue => issue.pq));
        const affectedVisible = new Set(issues.map(issue => issue.pq));
        if (summary) summary.innerHTML = `<b>${affectedVisible.size}</b> PQ · <b>${issues.length}</b> eksiklik gösteriliyor <span style="opacity:.7">(toplam ${affectedAll.size} PQ / ${allIssues.length} eksiklik)</span>`;

        if (!issues.length) {
            container.innerHTML = `<div style="text-align:center; color:var(--muted); font-size:12px; padding:24px;">Seçili kapsam ve eksiklik türü için kayıt bulunmadı.</div>`;
            return;
        }

        const grouped = {};
        issues.forEach(issue => {
            if (!grouped[issue.pq]) grouped[issue.pq] = [];
            grouped[issue.pq].push(issue);
        });

        let html = '';
        Object.keys(grouped).sort(sortPQs).forEach(pq => {
            const master = pqMasterData[pq] || {};
            const area = master.alan ? master.alan.trim().toUpperCase() : 'BİLİNMİYOR';
            const pqIssues = grouped[pq];
            const dateRiskCount = pqIssues.filter(issue => getCapDeficiencyGroup(issue.category) === 'date').length;
            const headerNote = dateRiskCount ? `<span style="font-size:10px; background:#fff7ed; color:#c2410c; padding:2px 6px; border:1px solid #fed7aa; border-radius:4px; margin-left:5px;">⏱ ${dateRiskCount} tarih riski</span>` : '';

            const issueHtml = pqIssues.map(issue => {
                const definition = DATA_QUALITY_CATEGORIES[issue.category] || { label: issue.category };
                const style = capDeficiencySeverityStyle(issue.severity);
                const stepText = issue.step ? `Adım ${escapeHtml(issue.step)}` : 'PQ geneli';
                return `<div style="padding:9px 10px; margin-top:8px; border:1px solid ${style.border}; background:${style.bg}; border-radius:6px;">
                    <div style="display:flex; flex-wrap:wrap; gap:6px; align-items:center; margin-bottom:5px;">
                        <span style="font-size:10px; font-weight:800; color:${style.color};">${escapeHtml(style.label)}</span>
                        <span style="font-size:10px; background:var(--card); color:var(--text); border:1px solid var(--border); padding:2px 6px; border-radius:4px;">${escapeHtml(definition.label)}</span>
                        <span style="font-size:10px; color:var(--muted);">${stepText}</span>
                    </div>
                    <div style="font-size:11px; color:var(--text);"><b>Sorun:</b> ${escapeHtml(issue.problem || definition.description || '')}</div>
                    <div style="font-size:11px; color:var(--muted); margin-top:3px;"><b>Mevcut:</b> ${escapeHtml(issue.currentValue || 'Boş')}</div>
                    ${issue.recommendation ? `<div style="font-size:11px; color:var(--muted); margin-top:3px;"><b>Öneri:</b> ${escapeHtml(issue.recommendation)}</div>` : ''}
                </div>`;
            }).join('');

            html += `<div onclick="openDataQualityIssue('${String(pq).replace(/'/g, "\'")}')" style="padding:12px 14px; border:1px solid var(--border); background:var(--card); margin-bottom:10px; border-left:4px solid var(--danger); border-radius:6px; cursor:pointer;">
                <div style="display:flex; justify-content:space-between; gap:10px; align-items:flex-start;">
                    <div><b style="color:var(--text); font-size:14px;">PQ ${escapeHtml(pq)}</b><span style="font-size:10px; background:#fee2e2; color:var(--danger); padding:2px 6px; border-radius:4px; margin-left:5px;">${escapeHtml(area)}</span>${headerNote}<div style="font-size:11px; color:var(--muted); margin-top:4px;">${escapeHtml(getLocalizedPqFinding(master) || (currentUiLang==='tr'?'Bulgu detayı yok':'Finding detail unavailable'))}</div></div>
                    <span style="color:var(--danger); font-weight:bold; font-size:11px; background:rgba(239,68,68,0.1); padding:4px 8px; border-radius:4px; white-space:nowrap;">${pqIssues.length} EKSİKLİK</span>
                </div>
                ${issueHtml}
            </div>`;
        });
        container.innerHTML = html;
    };

    function generateSmartTags(actionText, ceValue = "") {
        let tags = []; let lower = (actionText || "").toLowerCase(); let upper = (actionText || "").toUpperCase(); let upperCE = (ceValue || "").toUpperCase(); let addedTags = new Set();
        const addTag = (html) => { if (!addedTags.has(html)) { tags.push(html); addedTags.add(html); } };
        const makeHtml = (bg, col, border, icon, text, search) => { const isActive = window.activeSmartTags && window.activeSmartTags.has(search); const activeStyle = isActive ? `box-shadow: 0 0 0 2px ${col}; filter: brightness(0.9); transform: scale(1.05); font-weight: 800;` : ``; return `<span class="smart-tag" style="background:${bg}; color:${col}; border:1px solid ${border}; ${activeStyle}" onclick="window.toggleSmartTag('${search}', event)" title="Filtreyi Aç/Kapat">${icon} ${text}</span>`; };
        if (actionText.includes('🏆')) addTag(makeHtml('#fef08a', '#854d0e', '#fde047', '🏆', 'ICAO Onaylı (Kalıcı Kapanış)', 'icao onaylı'));
        if (upperCE.includes("CE-1")) addTag(makeHtml('#fce7f3', '#be185d', '#fbcfe8', '⚖️', 'Birincil Mevzuat (CE-1)', 'CE-1')); else if (upperCE.includes("CE-2")) addTag(makeHtml('#fce7f3', '#be185d', '#fbcfe8', '📜', 'Özel Mevzuat (CE-2)', 'CE-2'));
        if (upper.includes('SHY') || lower.includes('yönetmelik') || lower.includes('by-law')) addTag(makeHtml('#e0f2fe', '#0369a1', '#bae6fd', '📘', 'SHY/Yönetmelik', 'yönetmelik'));
        if (upper.includes('SHT') || lower.includes('talimat') || lower.includes('instruction')) addTag(makeHtml('#ffedd5', '#c2410c', '#fed7aa', '📙', 'SHT/Talimat', 'talimat'));
        if (upper.match(/\b(UOD|UED|SDED|HSD)\b/) || lower.includes('genelge') || lower.includes('circular')) addTag(makeHtml('#dcfce7', '#15803d', '#bbf7d0', '📗', 'Genelge', 'genelge'));
        if (lower.includes('direktif') || lower.includes('directive')) addTag(makeHtml('#fee2e2', '#b91c1c', '#fecaca', '📕', 'Direktif', 'direktif'));
        if (lower.includes('form') || upper.match(/FR[\.\-\s]?\d+/)) addTag(makeHtml('#f3f4f6', '#374151', '#e5e7eb', '📝', 'Form', 'form'));
        if (lower.includes('prosedür') || lower.includes('procedure') || upper.match(/BPR[\.\-\s]?\d+/)) addTag(makeHtml('#f3e8ff', '#6b21a8', '#e9d5ff', '⚙️', 'Prosedür', 'prosedür'));
        if (lower.includes('checklist') || lower.includes('kontrol listesi')) addTag(makeHtml('#fef9c3', '#a16207', '#fef08a', '☑️', 'Kontrol Listesi', 'checklist'));
        if (lower.match(/\b(recruitment|employment|istihdam|atama|norm kadro)\b/)) addTag(makeHtml('#e0e7ff', '#4338ca', '#c7d2fe', '👤', 'İstihdam/Personel', 'istihdam'));
        if (lower.match(/\b(eğitim|training|müfredat|syllabus|program)\b/)) addTag(makeHtml('#fef08a', '#854d0e', '#fde047', '🎓', 'Eğitim', 'eğitim'));
        if (lower.match(/\b(audit|inspection|gözetim|denetim)\b/)) addTag(makeHtml('#ffedd5', '#c2410c', '#fed7aa', '🔍', 'Gözetim/Denetim', 'denetim'));
        if (lower.match(/\b(eğitim|müfredat|program|denetim|audit|inspection|gözetim|onay|approval)\b/)) { addTag(makeHtml('#ef4444', '#ffffff', '#b91c1c', '🚨', 'KRİTİK', 'kritik')); }
        return tags.join(' ');
    }

    function getFilteredData() { 
        if (rawData.length === 0) return []; 
        const search = document.getElementById('searchInput').value.toLowerCase(); 
        const statusVals = getCheckedValues('statusFilterList'); const pqStatusVals = getCheckedValues('pqStatusFilterList'); const personVals = getCheckedValues('personFilterList'); const typeVals = getCheckedValues('typeFilterList'); const officeVals = getCheckedValues('officeFilterList'); const areaVals = getCheckedValues('areaFilterList'); const ceVals = getCheckedValues('ceFilterList'); const icaoVals = getCheckedValues('icaoFilterList'); const icaoValidationVals = getCheckedValues('icaoValidationFilterList'); 
        const dateStart = document.getElementById('dateStart').value; const dateEnd = document.getElementById('dateEnd').value; let dStartObj = dateStart ? new Date(dateStart + "T00:00:00") : null; let dEndObj = dateEnd ? new Date(dateEnd + "T23:59:59") : null;
        const readyFilterKey = window.activeReadyFilter || null;
        const readyFilterContext = readyFilterKey ? buildReadyFilterContext(rawData) : null;
        const pqCompletionMap = {}; rawData.forEach(d => { if (pqCompletionMap[d.pq] === undefined) pqCompletionMap[d.pq] = true; if (getStatus(d).type !== 'done') pqCompletionMap[d.pq] = false; });
        
        return rawData.filter(d => { 
            const excel = pqMasterData[d.pq] || {}; const statType = getStatus(d).type; 
            const matchSearch = d.pq.includes(search) || d.action.toLowerCase().includes(search) || d.office.toLowerCase().includes(search) || (excel.bulgu && excel.bulgu.toLowerCase().includes(search)) || (excel.bulguTr && String(excel.bulguTr).toLocaleLowerCase('tr-TR').includes(search)) || (excel.soru && String(excel.soru).toLowerCase().includes(search)) || (excel.soruTr && String(excel.soruTr).toLocaleLowerCase('tr-TR').includes(search)) || (excel.sorumlu && excel.sorumlu.toLowerCase().includes(search)) || (excel.ce && excel.ce.toLowerCase().includes(search)) || (d.note && d.note.toLowerCase().includes(search)); 
            const matchStatus = statusVals.includes('all') || statusVals.includes(statType); 
            let matchPqStatus = pqStatusVals.includes('all'); if (!matchPqStatus) { if (pqStatusVals.includes('pq-done') && pqCompletionMap[d.pq]) matchPqStatus = true; if (pqStatusVals.includes('pq-open') && !pqCompletionMap[d.pq]) matchPqStatus = true; }
            let matchIcaoValidation = true; if (!icaoValidationVals.includes('all') && icaoValidationVals.includes('icao-closed')) { if (!excel.isIcaoClosed) matchIcaoValidation = false; }
            const matchPerson = personVals.includes('all') || personVals.includes(excel.sorumlu); const matchType = typeVals.includes('all') || typeVals.includes(excel.tur); const matchOffice = officeVals.includes('all') || officeVals.includes(d.office.trim()); const matchArea = areaVals.includes('all') || areaVals.includes(excel.alan); const matchCE = ceVals.includes('all') || ceVals.includes(excel.ce); const matchIcao = icaoVals.includes('all') || icaoVals.includes(excel.degerlendirme); 
            let matchDate = true; if (dStartObj || dEndObj) { if (d.estDate && d.estDate !== "Kapatıldı") { let itemDate = parseDateObj(d.estDate); if (itemDate) { if (dStartObj && itemDate < dStartObj) matchDate = false; if (dEndObj && itemDate > dEndObj) matchDate = false; } else matchDate = false; } else { matchDate = false; } }
            let matchTags = true;
            if (window.activeSmartTags && window.activeSmartTags.size > 0) {
                let lowerAct = d.action.toLowerCase(); let upperAct = d.action.toUpperCase(); let ce = (excel.ce || "").toUpperCase();
                matchTags = Array.from(window.activeSmartTags).some(tagKeyword => {
                   if(tagKeyword === 'icao onaylı' && lowerAct.includes('🏆')) return true; if(tagKeyword === 'CE-1' && ce.includes('CE-1')) return true; if(tagKeyword === 'CE-2' && ce.includes('CE-2')) return true; if(tagKeyword === 'yönetmelik' && (upperAct.includes('SHY') || lowerAct.includes('yönetmelik'))) return true; if(tagKeyword === 'talimat' && (upperAct.includes('SHT') || lowerAct.includes('talimat'))) return true; if(tagKeyword === 'genelge' && (upperAct.match(/\b(UOD|UED|SDED|HSD)\b/) || lowerAct.includes('genelge'))) return true; if(tagKeyword === 'direktif' && lowerAct.includes('direktif')) return true; if(tagKeyword === 'form' && (lowerAct.includes('form') || upperAct.match(/FR[\.\-\s]?\d+/))) return true; if(tagKeyword === 'prosedür' && (lowerAct.includes('prosedür') || upperAct.match(/BPR[\.\-\s]?\d+/))) return true; if(tagKeyword === 'checklist' && (lowerAct.includes('checklist') || lowerAct.includes('kontrol listesi'))) return true; if(tagKeyword === 'istihdam' && lowerAct.match(/\b(recruitment|employment|istihdam|atama|norm kadro)\b/)) return true; if(tagKeyword === 'eğitim' && lowerAct.match(/\b(eğitim|training|müfredat|syllabus|program)\b/)) return true; if(tagKeyword === 'denetim' && lowerAct.match(/\b(audit|inspection|gözetim|denetim)\b/)) return true; if(tagKeyword === 'kritik' && lowerAct.match(/\b(eğitim|müfredat|program|denetim|audit|inspection|gözetim|onay|approval)\b/)) return true; return false;
                });
            }
            const matchReadyFilter = matchesReadyFilter(d, readyFilterKey, readyFilterContext);
            return matchSearch && matchStatus && matchPqStatus && matchPerson && matchType && matchOffice && matchArea && matchCE && matchIcao && matchDate && matchTags && matchIcaoValidation && matchReadyFilter; 
        }); 
    }


    // ================================================================
    // ORTAK HESAPLAMA MOTORU
    // PQ, CAP adımı, alan, doğrulama türü, gecikme ve veri kalitesi
    // metriklerini tek bir modelde üretir. Ekranlar ve raporlar aynı
    // tanımları kullanarak sayısal tutarlılığı korur.
    // ================================================================
    function createCommonCounter() {
        return { total: 0, onSite: 0, offSite: 0, other: 0 };
    }

    function getCommonVerificationType(pq) {
        const master = pqMasterData[pq] || {};
        const type = (master.tur || '').toUpperCase();
        if (type.includes('ON-SITE')) return 'onSite';
        if (type.includes('OFF-SITE')) return 'offSite';
        return 'other';
    }

    function incrementCommonCounter(counter, verificationType, amount = 1) {
        counter.total += amount;
        if (verificationType === 'onSite') counter.onSite += amount;
        else if (verificationType === 'offSite') counter.offSite += amount;
        else counter.other += amount;
    }

    function createCommonAreaRecord(area) {
        return {
            area,
            total: 0, totalOn: 0, totalOff: 0, totalOther: 0,
            done: 0, doneOn: 0, doneOff: 0, doneOther: 0,
            ongoing: 0, ongoingOn: 0, ongoingOff: 0, ongoingOther: 0,
            actions: 0, actionDone: 0, actionPending: 0, actionLate: 0,
            dateRiskActions: 0,
            delayedDaysTotal: 0, delayedDaysCount: 0, maxDelayDays: 0,
            pqs: []
        };
    }

    const COMMON_PQ_STATUS = Object.freeze({
        OFFICIAL_CLOSED: { code: 'official_closed', label: 'Resmî olarak ICAO tarafından kapatıldı', rank: 1 },
        CAP_COMPLETED: { code: 'cap_completed', label: 'Tüm CAP adımları tamamlandı', rank: 2 },
        PROJECTED_CLOSABLE: { code: 'projected_closable', label: 'Seçili tarihe kadar kapanabilir', rank: 3 },
        OPEN_DATE_RISK: { code: 'open_date_risk', label: 'Açık - tarih riski var', rank: 4 },
        OPEN: { code: 'open', label: 'Açık - devam ediyor', rank: 5 },
        NO_CAP: { code: 'no_cap', label: 'CAP yok / boş', rank: 6 }
    });

    const COMMON_ACTION_STATUS = Object.freeze({
        COMPLETED: { code: 'completed', label: 'Tamamlandı', rank: 1 },
        LATE: { code: 'late', label: 'Gecikmiş', rank: 2 },
        UPCOMING: { code: 'upcoming', label: 'Yaklaşan', rank: 3 },
        PENDING: { code: 'pending', label: 'Devam Ediyor', rank: 4 },
        DATE_RISK: { code: 'date_risk', label: 'Tarih Riski', rank: 5 }
    });

    function normalizeCommonDate(value) {
        if (!value) return null;
        const date = value instanceof Date ? new Date(value) : parseDateObj(value);
        if (!date || Number.isNaN(date.getTime())) return null;
        date.setHours(0, 0, 0, 0);
        return date;
    }

    function classifyCommonActionStatus(item, options = {}) {
        const today = normalizeCommonDate(options.today) || todayMidnight();
        const projectionDate = normalizeCommonDate(options.projectionDate);
        const upcomingDays = Number.isFinite(Number(options.upcomingDays)) ? Math.max(0, Number(options.upcomingDays)) : 30;
        const legacyStatus = getLegacyActionStatusCore(item, today);
        const legacyType = legacyStatus.type;
        const targetDate = legacyStatus.targetDate;
        const isUsable = isUsableCapStep(item);
        const invalidTarget = legacyType !== 'done' && isUsable && !targetDate;
        const legacyDateRisk = legacyType !== 'done' && !!item && !item.isEmptyCap && !targetDate;
        let status = COMMON_ACTION_STATUS.PENDING;
        let delayDays = 0;
        let daysRemaining = null;

        if (legacyType === 'done') {
            status = COMMON_ACTION_STATUS.COMPLETED;
        } else if (invalidTarget) {
            status = COMMON_ACTION_STATUS.DATE_RISK;
        } else if (targetDate && targetDate < today) {
            status = COMMON_ACTION_STATUS.LATE;
            delayDays = Math.max(0, dateDiffDays(today, targetDate));
        } else if (targetDate) {
            daysRemaining = Math.max(0, dateDiffDays(targetDate, today));
            status = daysRemaining <= upcomingDays ? COMMON_ACTION_STATUS.UPCOMING : COMMON_ACTION_STATUS.PENDING;
        }

        return {
            code: status.code,
            label: status.label,
            rank: status.rank,
            legacyType,
            isUsable,
            targetDate,
            delayDays,
            daysRemaining,
            dueByProjection: legacyType !== 'done' && !!targetDate && !!projectionDate && targetDate.getTime() <= projectionDate.getTime(),
            hasDateRisk: invalidTarget,
            legacyDateRisk
        };
    }

    function classifyCommonPQStatus(pq, items, options = {}) {
        const master = pqMasterData[pq] || {};
        const projectionDate = normalizeCommonDate(options.projectionDate);
        const usable = (items || []).filter(isUsableCapStep);
        const actionItems = usable.map(item => ({ item, classification: classifyCommonActionStatus(item, options) }));
        const doneSteps = actionItems.filter(x => x.classification.code === COMMON_ACTION_STATUS.COMPLETED.code).length;
        const openSteps = Math.max(0, usable.length - doneSteps);
        const missingDates = actionItems.filter(x => x.classification.hasDateRisk).length;
        const lateSteps = actionItems.filter(x => x.classification.code === COMMON_ACTION_STATUS.LATE.code).length;
        const dueByProjectionSteps = actionItems.filter(x => x.classification.dueByProjection).length;
        const allDone = usable.length > 0 && doneSteps === usable.length;
        const datedOpenItems = actionItems.filter(x => x.classification.code !== COMMON_ACTION_STATUS.COMPLETED.code && x.classification.targetDate);
        const latestOpenDate = datedOpenItems.reduce((latest, x) => !latest || x.classification.targetDate > latest ? x.classification.targetDate : latest, null);
        const latestKnownDate = actionItems.reduce((latest, x) => {
            const dt = x.classification.targetDate;
            return dt && (!latest || dt > latest) ? dt : latest;
        }, null);
        const canCloseByProjection = !!projectionDate && usable.length > 0 && !allDone && missingDates === 0 && datedOpenItems.length === openSteps && !!latestOpenDate && latestOpenDate.getTime() <= projectionDate.getTime();

        let status = COMMON_PQ_STATUS.OPEN;
        if (master.isIcaoClosed) status = COMMON_PQ_STATUS.OFFICIAL_CLOSED;
        else if (usable.length === 0) status = COMMON_PQ_STATUS.NO_CAP;
        else if (allDone) status = COMMON_PQ_STATUS.CAP_COMPLETED;
        else if (canCloseByProjection) status = COMMON_PQ_STATUS.PROJECTED_CLOSABLE;
        else if (missingDates > 0) status = COMMON_PQ_STATUS.OPEN_DATE_RISK;

        return {
            pq,
            master,
            code: status.code,
            label: status.label,
            rank: status.rank,
            usable,
            actionItems,
            totalSteps: usable.length,
            doneSteps,
            openSteps,
            missingDates,
            lateSteps,
            dueByProjectionSteps,
            allDone,
            canCloseByProjection,
            closureDate: missingDates === 0 ? (allDone ? latestKnownDate : latestOpenDate) : null,
            latestKnownDate,
            projectionDate
        };
    }

    function createCommonStatusCount() {
        return { count: 0, rows: [] };
    }

    function buildCommonCalculationModel(sourceRows, options = {}) {
        const rows = Array.isArray(sourceRows) ? sourceRows : [];
        const groups = {};
        rows.forEach(row => {
            if (!row || !row.pq) return;
            if (!groups[row.pq]) groups[row.pq] = [];
            groups[row.pq].push(row);
        });

        const model = {
            rows,
            groups,
            pq: {
                ...createCommonCounter(),
                completed: createCommonCounter(),
                open: createCommonCounter(),
                officialClosed: 0,
                noUsableCap: 0
            },
            actions: createCommonCounter(),
            status: {
                done: createCommonCounter(),
                pending: createCommonCounter(),
                late: createCommonCounter()
            },
            areas: {},
            offices: {},
            statusRows: { done: [], pending: [], late: [] },
            dateRiskRows: [],
            delayedRows: [],
            delay: { count: 0, totalDays: 0, maxDays: 0, averageDays: 0 },
            standardized: {
                projectionDate: normalizeCommonDate(options.projectionDate),
                pq: {
                    officialClosed: createCommonStatusCount(),
                    capCompleted: createCommonStatusCount(),
                    projectedClosable: createCommonStatusCount(),
                    open: createCommonStatusCount(),
                    openDateRisk: createCommonStatusCount(),
                    noCap: createCommonStatusCount()
                },
                actions: {
                    completed: createCommonStatusCount(),
                    late: createCommonStatusCount(),
                    upcoming: createCommonStatusCount(),
                    pending: createCommonStatusCount(),
                    dateRisk: createCommonStatusCount(),
                    dueByProjection: createCommonStatusCount()
                },
                pqItems: [],
                actionItems: []
            },
            generatedAt: new Date()
        };

        const today = options.today instanceof Date ? new Date(options.today) : todayMidnight();
        today.setHours(0, 0, 0, 0);
        const normalizeAreas = options.normalizeAreas === true;
        const useUsableForPqCompletion = options.useUsableStepsForPqCompletion === true;

        Object.keys(groups).forEach(pq => {
            const items = groups[pq];
            const master = pqMasterData[pq] || {};
            const verificationType = getCommonVerificationType(pq);
            const area = normalizeAreas
                ? (normalizeAreaKey(master.alan) || 'DİĞER')
                : (master.alan ? master.alan.trim().toUpperCase() : 'N/A');
            const completionItems = useUsableForPqCompletion ? items.filter(isUsableCapStep) : items;
            const isCompleted = completionItems.length > 0 && completionItems.every(isCommonActionCompleted);
            const pqClassification = classifyCommonPQStatus(pq, items, {
                today,
                projectionDate: model.standardized.projectionDate,
                upcomingDays: options.upcomingDays
            });
            const pqItem = {
                ...pqClassification,
                area,
                verificationType,
                ce: master.ce || '',
                responsible: master.sorumlu || '',
                finding: master.bulgu || '',
                validationTask: master.validasyonGorevi || ''
            };
            model.standardized.pqItems.push(pqItem);
            const pqBucket = pqClassification.code === COMMON_PQ_STATUS.OFFICIAL_CLOSED.code ? model.standardized.pq.officialClosed
                : pqClassification.code === COMMON_PQ_STATUS.CAP_COMPLETED.code ? model.standardized.pq.capCompleted
                : pqClassification.code === COMMON_PQ_STATUS.PROJECTED_CLOSABLE.code ? model.standardized.pq.projectedClosable
                : pqClassification.code === COMMON_PQ_STATUS.OPEN_DATE_RISK.code ? model.standardized.pq.openDateRisk
                : pqClassification.code === COMMON_PQ_STATUS.NO_CAP.code ? model.standardized.pq.noCap
                : model.standardized.pq.open;
            pqBucket.count++;
            pqBucket.rows.push(pqItem);

            incrementCommonCounter(model.pq, verificationType);
            incrementCommonCounter(isCompleted ? model.pq.completed : model.pq.open, verificationType);
            if (master.isIcaoClosed) model.pq.officialClosed++;
            if (!items.some(isUsableCapStep)) model.pq.noUsableCap++;

            if (!model.areas[area]) model.areas[area] = createCommonAreaRecord(area);
            const areaRecord = model.areas[area];
            areaRecord.total++;
            areaRecord.pqs.push(pq);
            if (verificationType === 'onSite') areaRecord.totalOn++;
            else if (verificationType === 'offSite') areaRecord.totalOff++;
            else areaRecord.totalOther++;

            if (isCompleted) {
                areaRecord.done++;
                if (verificationType === 'onSite') areaRecord.doneOn++;
                else if (verificationType === 'offSite') areaRecord.doneOff++;
                else areaRecord.doneOther++;
            } else {
                areaRecord.ongoing++;
                if (verificationType === 'onSite') areaRecord.ongoingOn++;
                else if (verificationType === 'offSite') areaRecord.ongoingOff++;
                else areaRecord.ongoingOther++;
            }

            items.forEach(item => {
                const actionClassification = classifyCommonActionStatus(item, {
                    today,
                    projectionDate: model.standardized.projectionDate,
                    upcomingDays: options.upcomingDays
                });
                const status = actionClassification.legacyType;
                const actionItem = {
                    row: item,
                    pq,
                    area,
                    verificationType,
                    master,
                    ...actionClassification
                };
                model.standardized.actionItems.push(actionItem);
                const actionBucket = actionClassification.code === COMMON_ACTION_STATUS.COMPLETED.code ? model.standardized.actions.completed
                    : actionClassification.code === COMMON_ACTION_STATUS.LATE.code ? model.standardized.actions.late
                    : actionClassification.code === COMMON_ACTION_STATUS.UPCOMING.code ? model.standardized.actions.upcoming
                    : actionClassification.code === COMMON_ACTION_STATUS.DATE_RISK.code ? model.standardized.actions.dateRisk
                    : model.standardized.actions.pending;
                actionBucket.count++;
                actionBucket.rows.push(actionItem);
                if (actionClassification.dueByProjection) {
                    model.standardized.actions.dueByProjection.count++;
                    model.standardized.actions.dueByProjection.rows.push(actionItem);
                }
                incrementCommonCounter(model.actions, verificationType);
                if (!model.status[status]) model.status[status] = createCommonCounter();
                incrementCommonCounter(model.status[status], verificationType);
                if (!model.statusRows[status]) model.statusRows[status] = [];
                model.statusRows[status].push(item);

                areaRecord.actions++;
                if (status === 'done') areaRecord.actionDone++;
                else if (status === 'late') areaRecord.actionLate++;
                else areaRecord.actionPending++;

                const office = (item.office || '').trim() || 'Belirtilmedi';
                if (!model.offices[office]) model.offices[office] = { office, actions: 0, pqs: new Set(), done: 0, pending: 0, late: 0 };
                model.offices[office].actions++;
                model.offices[office].pqs.add(pq);
                model.offices[office][status] = (model.offices[office][status] || 0) + 1;

                if (actionClassification.legacyDateRisk) {
                    model.dateRiskRows.push(item);
                    areaRecord.dateRiskActions++;
                }

                if (status === 'late') {
                    const delayDays = actionClassification.delayDays;
                    model.delayedRows.push({ row: item, delayDays });
                    model.delay.count++;
                    model.delay.totalDays += delayDays;
                    model.delay.maxDays = Math.max(model.delay.maxDays, delayDays);
                    areaRecord.delayedDaysCount++;
                    areaRecord.delayedDaysTotal += delayDays;
                    areaRecord.maxDelayDays = Math.max(areaRecord.maxDelayDays, delayDays);
                }
            });
        });

        model.delay.averageDays = model.delay.count ? Math.round(model.delay.totalDays / model.delay.count) : 0;
        Object.values(model.areas).forEach(area => {
            area.completionPct = area.total ? Number(((area.done / area.total) * 100).toFixed(2)) : 0;
            area.averageDelayDays = area.delayedDaysCount ? Math.round(area.delayedDaysTotal / area.delayedDaysCount) : 0;
        });
        model.officeRows = Object.values(model.offices).map(office => ({
            ...office,
            pqCount: office.pqs.size
        }));
        model.standardized.pq.openTotal = model.standardized.pq.open.count + model.standardized.pq.openDateRisk.count + model.standardized.pq.noCap.count;
        model.standardized.pq.completedOrOfficial = model.standardized.pq.officialClosed.count + model.standardized.pq.capCompleted.count;
        model.standardized.pq.closableByProjectionTotal = model.standardized.pq.capCompleted.count + model.standardized.pq.projectedClosable.count;
        model.standardized.actions.openTotal = model.standardized.actions.late.count + model.standardized.actions.upcoming.count + model.standardized.actions.pending.count + model.standardized.actions.dateRisk.count;

        if (options.includeEI === true && Object.keys(baseEIData || {}).length) {
            const eiRows = Array.isArray(options.eiRows) ? options.eiRows : rows;
            model.ei = buildEIProjectionModel(eiRows);
        } else {
            model.ei = null;
        }

        return model;
    }

    function getCommonLegacyStats(model) {
        return {
            pqs: {
                total: model.pq.total,
                onSite: model.pq.onSite,
                offSite: model.pq.offSite,
                completed: {
                    total: model.pq.completed.total,
                    onSite: model.pq.completed.onSite,
                    offSite: model.pq.completed.offSite
                }
            },
            actions: { total: model.actions.total, onSite: model.actions.onSite, offSite: model.actions.offSite },
            late: { total: model.status.late.total, onSite: model.status.late.onSite, offSite: model.status.late.offSite },
            pending: { total: model.status.pending.total, onSite: model.status.pending.onSite, offSite: model.status.pending.offSite },
            done: { total: model.status.done.total, onSite: model.status.done.onSite, offSite: model.status.done.offSite }
        };
    }

    window.buildCommonCalculationModel = buildCommonCalculationModel;
    window.classifyCommonPQStatus = classifyCommonPQStatus;
    window.classifyCommonActionStatus = classifyCommonActionStatus;
    window.COMMON_PQ_STATUS = COMMON_PQ_STATUS;
    window.COMMON_ACTION_STATUS = COMMON_ACTION_STATUS;

    // ================================================================
    // ORTAK GOREV TAKIP ADAPTORU
    // Yaklasan, geciken ve Kanban gorunumlerini ortak hesaplama motorunun
    // standart CAP adimi durumlariyla besler.
    // ================================================================
    let commonActionClassificationCache = new WeakMap();

    function resetCommonActionClassificationCache() {
        commonActionClassificationCache = new WeakMap();
    }

    function getCommonActionClassification(item, options = {}) {
        if (!item || typeof item !== 'object') return classifyCommonActionStatus(item || {}, options);
        const hasCustomOptions = !!(options.today || options.projectionDate || options.upcomingDays !== undefined);
        if (hasCustomOptions) return classifyCommonActionStatus(item, options);
        if (!commonActionClassificationCache.has(item)) {
            commonActionClassificationCache.set(item, classifyCommonActionStatus(item, { upcomingDays: 30 }));
        }
        return commonActionClassificationCache.get(item);
    }

    function buildCommonTaskTrackingModel(sourceRows, options = {}, existingModel = null) {
        const rows = Array.isArray(sourceRows) ? sourceRows : [];
        const model = existingModel || buildCommonCalculationModel(rows, {
            today: options.today,
            projectionDate: options.projectionDate,
            upcomingDays: options.upcomingDays === undefined ? 30 : options.upcomingDays
        });
        const actionItems = (model.standardized && model.standardized.actionItems) ? model.standardized.actionItems.slice() : [];
        const byCode = code => actionItems.filter(item => item.code === code);
        return {
            model,
            actionItems,
            completed: byCode(COMMON_ACTION_STATUS.COMPLETED.code),
            late: byCode(COMMON_ACTION_STATUS.LATE.code),
            upcoming: byCode(COMMON_ACTION_STATUS.UPCOMING.code),
            pending: byCode(COMMON_ACTION_STATUS.PENDING.code),
            dateRisk: byCode(COMMON_ACTION_STATUS.DATE_RISK.code)
        };
    }

    function commonTaskRowSort(a, b, mode) {
        const ca = a.classification || getCommonActionClassification(a.row || a);
        const cb = b.classification || getCommonActionClassification(b.row || b);
        const ra = a.row || a;
        const rb = b.row || b;
        const da = ca.targetDate;
        const db = cb.targetDate;
        if (mode === 'past') {
            if (cb.delayDays !== ca.delayDays) return cb.delayDays - ca.delayDays;
        } else if (da && db && da.getTime() !== db.getTime()) {
            return da - db;
        }
        if (da && !db) return -1;
        if (!da && db) return 1;
        return sortAreas((pqMasterData[ra.pq] || {}).alan || '', (pqMasterData[rb.pq] || {}).alan || '') || sortPQs(ra.pq, rb.pq) || String(ra.step || '').localeCompare(String(rb.step || ''), 'tr');
    }

    window.buildCommonTaskTrackingModel = buildCommonTaskTrackingModel;
    window.getCommonActionClassification = getCommonActionClassification;



    // ================================================================
    // VERI KALITESI MERKEZI
    // Word CAP ve Excel master verilerini ortak, kural bazli bir kalite
    // modelinde birlestirir. Aktif filtreler korunur; master-only PQ'lar
    // eylem-ozel filtre yoksa kapsama dahil edilir.
    // ================================================================
    const DATA_QUALITY_SEVERITIES = Object.freeze({
        critical: { label: 'Kritik', weight: 4 },
        high: { label: 'Yüksek', weight: 3 },
        medium: { label: 'Orta', weight: 2 },
        low: { label: 'Düşük / Kontrol', weight: 1 }
    });

    const DATA_QUALITY_CATEGORIES = Object.freeze({
        missing_cap: { label: 'CAP Kaydı Yok / Boş', severity: 'critical', description: 'PQ için kullanılabilir CAP adımı bulunmuyor.' },
        missing_master: { label: 'Excel Master Eşleşmesi Yok', severity: 'critical', description: 'Word CAP kaydının Excel master karşılığı bulunmuyor.' },
        missing_action: { label: 'CAP Eylem Metni Eksik', severity: 'critical', description: 'Adım var ancak eylem metni boş veya yer tutucu.' },
        missing_date: { label: 'Hedef Tarih Eksik', severity: 'high', description: 'Açık CAP adımında hedef tarih bulunmuyor.' },
        invalid_date: { label: 'Hedef Tarih Geçersiz', severity: 'high', description: 'Tarih alanı dolu fakat geçerli tarihe dönüştürülemiyor.' },
        missing_office: { label: 'Sorumlu Ofis Eksik', severity: 'high', description: 'CAP adımı için sorumlu ofis belirtilmemiş.' },
        duplicate_step: { label: 'Mükerrer Adım Numarası', severity: 'high', description: 'Aynı PQ içinde aynı adım numarası birden fazla kullanılmış.' },
        duplicate_action: { label: 'Mükerrer CAP Metni', severity: 'high', description: 'Aynı PQ içinde aynı veya neredeyse aynı CAP metni tekrarlanıyor.' },
        missing_area: { label: 'Denetim Alanı Eksik', severity: 'high', description: 'Excel master kaydında denetim alanı eksik veya varsayılan değerde.' },
        invalid_pq: { label: 'PQ Numarası Formatı Geçersiz', severity: 'high', description: 'PQ numarası beklenen 1.001 / 12.001 formatında değil.' },
        missing_ce: { label: 'CE Bilgisi Eksik', severity: 'medium', description: 'Excel master kaydında kritik element bilgisi yok.' },
        missing_owner: { label: 'PQ Sorumlusu Eksik', severity: 'medium', description: 'Excel master kaydında PQ sorumlusu belirtilmemiş.' },
        missing_finding: { label: 'Bulgu Metni Eksik', severity: 'medium', description: 'Excel master kaydında bulgu/açıklama metni yok.' },
        missing_type: { label: 'Doğrulama Türü Eksik', severity: 'medium', description: 'On-Site / Off-Site doğrulama türü belirtilmemiş.' },
        completion_date_conflict: { label: 'Tamamlanma / Tarih Çelişkisi', severity: 'medium', description: 'Tamamlanan adımın tarihi eksik, geçersiz veya gelecekte.' },
        invalid_step: { label: 'Adım Numarası Formatı', severity: 'medium', description: 'CAP adım numarası sayısal standartta değil.' },
        cross_pq_duplicate: { label: 'Farklı PQ’larda Aynı CAP Metni', severity: 'low', description: 'Aynı uzun CAP metni birden fazla PQ içinde kullanılmış; manuel kontrol önerilir.' },
        missing_source: { label: 'Kaynak Dosya Bilgisi Eksik', severity: 'low', description: 'CAP kaydının kaynak Word dosyası bilgisi bulunmuyor.' }
    });

    function dqNormalize(value) {
        return String(value === undefined || value === null ? '' : value).replace(/\s+/g, ' ').trim();
    }

    function dqNormalizeKey(value) {
        return dqNormalize(value)
            .toLocaleLowerCase('tr-TR')
            .replace(/[^a-z0-9çğıöşü]+/gi, ' ')
            .trim();
    }

    function dqIsMissing(value, extras = []) {
        const normalized = dqNormalize(value).toLocaleUpperCase('tr-TR');
        const missingValues = [
            '', '-', 'N/A', 'NA', 'BELİRTİLMEDİ', 'BELIRTILMEDI',
            'BİLİNMİYOR', 'BILINMIYOR', 'TARİH YOK', 'TARIH YOK'
        ];
        return missingValues.concat(extras.map(v => String(v).toLocaleUpperCase('tr-TR'))).includes(normalized);
    }

    function dqHasActionScopedFilters() {
        const actionFilterIds = ['statusFilterList', 'pqStatusFilterList', 'officeFilterList'];
        if (actionFilterIds.some(id => !getCheckedValues(id).includes('all'))) return true;
        if ((document.getElementById('dateStart') || {}).value || (document.getElementById('dateEnd') || {}).value) return true;
        if (window.activeReadyFilter) return true;
        if (window.activeSmartTags && window.activeSmartTags.size > 0) return true;
        return false;
    }

    function dqMasterMatchesFilters(pq, master) {
        const search = dqNormalize((document.getElementById('searchInput') || {}).value).toLocaleLowerCase('tr-TR');
        const areaVals = getCheckedValues('areaFilterList');
        const ceVals = getCheckedValues('ceFilterList');
        const personVals = getCheckedValues('personFilterList');
        const typeVals = getCheckedValues('typeFilterList');
        const icaoVals = getCheckedValues('icaoFilterList');
        const validationVals = getCheckedValues('icaoValidationFilterList');

        if (!areaVals.includes('all') && !areaVals.includes(master.alan)) return false;
        if (!ceVals.includes('all') && !ceVals.includes(master.ce)) return false;
        if (!personVals.includes('all') && !personVals.includes(master.sorumlu)) return false;
        if (!typeVals.includes('all') && !typeVals.includes(master.tur)) return false;
        if (!icaoVals.includes('all') && !icaoVals.includes(master.degerlendirme)) return false;
        if (!validationVals.includes('all') && validationVals.includes('icao-closed') && !master.isIcaoClosed) return false;

        if (search) {
            const haystack = [
                pq, master.alan, master.ce, master.sorumlu, master.tur,
                master.degerlendirme, master.bulgu, master.soru
            ].map(dqNormalize).join(' ').toLocaleLowerCase('tr-TR');
            if (!haystack.includes(search)) return false;
        }
        return true;
    }

    function getDataQualityScope(filteredRows) {
        const visibleRows = Array.isArray(filteredRows) ? filteredRows : getFilteredData();
        const rows = visibleRows.length ? expandFilteredRowsToFullPqGroups(visibleRows) : [];
        const pqs = new Set(rows.map(row => row && row.pq).filter(Boolean));

        // Eylem-özel filtre yoksa Excel'de bulunup Word/CAP verisinde olmayan
        // PQ'lar da kalite kapsamına alınır.
        if (!dqHasActionScopedFilters()) {
            const rawPqs = new Set(rawData.map(row => row.pq));
            Object.keys(pqMasterData || {}).forEach(pq => {
                const master = pqMasterData[pq] || {};
                if (!rawPqs.has(pq) && dqMasterMatchesFilters(pq, master)) pqs.add(pq);
            });
        }

        return {
            visibleRows,
            rows,
            pqs: Array.from(pqs).sort(sortPQs)
        };
    }

    function buildDataQualityModel(filteredRows) {
        const scope = getDataQualityScope(filteredRows);
        const groups = {};
        scope.rows.forEach(row => {
            if (!row || !row.pq) return;
            if (!groups[row.pq]) groups[row.pq] = [];
            groups[row.pq].push(row);
        });

        const issues = [];
        const seen = new Set();
        const today = todayMidnight();
        const allActionTextMap = new Map();

        function addIssue(category, pq, step, field, currentValue, problem, recommendation, row = null, master = null, overrideSeverity = '') {
            const definition = DATA_QUALITY_CATEGORIES[category];
            if (!definition) return;
            const severity = overrideSeverity || definition.severity;
            const key = [category, pq, step || '', field || '', dqNormalize(currentValue).slice(0, 300)].join('|');
            if (seen.has(key)) return;
            seen.add(key);

            const masterData = master || pqMasterData[pq] || {};
            issues.push({
                category,
                severity,
                pq,
                step: step || '',
                area: masterData.alan || 'DİĞER',
                ce: masterData.ce || '',
                office: row && row.office ? row.office : '',
                field: field || '',
                currentValue: dqNormalize(currentValue),
                problem: problem || definition.description,
                recommendation: recommendation || '',
                row,
                master: masterData
            });
        }

        scope.pqs.forEach(pq => {
            const hasMaster = Object.prototype.hasOwnProperty.call(pqMasterData, pq);
            const master = pqMasterData[pq] || {};
            const rows = groups[pq] || [];

            if (!/^\d{1,2}\.\d{3}$/.test(String(pq || ''))) {
                addIssue(
                    'invalid_pq', pq, '', 'PQ', pq,
                    'PQ numarası standart formatta değil.',
                    'PQ numarasını Excel ve Word kaynağında 1.001 / 12.001 biçiminde standartlaştırın.',
                    rows[0] || null, master
                );
            }

            if (!hasMaster) {
                addIssue(
                    'missing_master', pq, '', 'Excel Master', 'Kayıt yok',
                    'Word CAP kaydı için Excel master eşleşmesi bulunamadı.',
                    'PQ numarasını ve Excel master satırını kontrol edin.',
                    rows[0] || null, master
                );
            }

            if (hasMaster) {
                if (dqIsMissing(master.alan, ['DİĞER', 'DIGER'])) {
                    addIssue('missing_area', pq, '', 'Denetim Alanı', master.alan || 'Boş',
                        'Denetim alanı eksik veya varsayılan değerde.',
                        'Excel master kaydına AGA, ANS, AIR, OPS vb. gerçek alanı girin.', null, master);
                }
                if (dqIsMissing(master.ce)) {
                    addIssue('missing_ce', pq, '', 'CE', master.ce || 'Boş',
                        'Kritik element bilgisi eksik.',
                        'Excel master kaydında CE bilgisini tamamlayın.', null, master);
                }
                if (dqIsMissing(master.sorumlu)) {
                    addIssue('missing_owner', pq, '', 'PQ Sorumlusu', master.sorumlu || 'Boş',
                        'PQ sorumlusu belirtilmemiş.',
                        'Sorumlu personel/birim bilgisini master veride tamamlayın.', null, master);
                }
                if (dqIsMissing(master.bulgu)) {
                    addIssue('missing_finding', pq, '', 'Bulgu', master.bulgu || 'Boş',
                        'Bulgu veya açıklama metni eksik.',
                        'ICAO bulgu metnini Excel master kaydına ekleyin.', null, master);
                }
                if (dqIsMissing(master.tur)) {
                    addIssue('missing_type', pq, '', 'Doğrulama Türü', master.tur || 'Boş',
                        'Doğrulama türü eksik.',
                        'On-Site / Off-Site bilgisini tamamlayın.', null, master);
                }
            }

            // ICAO tarafından resmî kapatılan PQ'lar için CAP yokluğu sorun sayılmaz.
            if (master.isIcaoClosed) return;

            const usableRows = rows.filter(isUsableCapStep);
            if (!usableRows.length) {
                addIssue(
                    'missing_cap', pq, '', 'CAP', rows.length ? 'Boş / yer tutucu kayıt' : 'Kayıt yok',
                    'PQ için kullanılabilir CAP adımı bulunmuyor.',
                    'OLF kaydında somut eylem, sorumlu ofis ve hedef tarih içeren CAP adımlarını girin.',
                    rows[0] || null, master
                );
                return;
            }

            const stepMap = new Map();
            const actionMap = new Map();

            usableRows.forEach(row => {
                const step = dqNormalize(row.step);
                const action = dqNormalize(row.action);
                const actionKey = dqNormalizeKey(action);
                const classification = getCommonActionClassification(row);

                if (!stepMap.has(step)) stepMap.set(step, []);
                stepMap.get(step).push(row);

                if (actionKey.length >= 25) {
                    if (!actionMap.has(actionKey)) actionMap.set(actionKey, []);
                    actionMap.get(actionKey).push(row);

                    if (actionKey.length >= 60) {
                        if (!allActionTextMap.has(actionKey)) allActionTextMap.set(actionKey, []);
                        allActionTextMap.get(actionKey).push({ pq, row, master });
                    }
                }

                if (!action || action.length < 4 || /click here/i.test(action)) {
                    addIssue(
                        'missing_action', pq, step, 'CAP Eylemi', action || 'Boş',
                        'CAP eylem metni boş veya yer tutucu.',
                        'Somut, ölçülebilir ve kanıtlanabilir eylem metni girin.',
                        row, master
                    );
                }

                if (isMissingResponsibleOffice(row.office)) {
                    addIssue(
                        'missing_office', pq, step, 'Sorumlu Ofis', row.office || 'Boş',
                        'CAP adımının sorumlu ofisi eksik.',
                        'Eylemden sorumlu ofis/birim bilgisini tamamlayın.',
                        row, master
                    );
                }

                const rawDate = dqNormalize(row.estDate);
                const isPlaceholderDate = dqIsMissing(rawDate, ['KAPATILDI']);

                if (classification.code === COMMON_ACTION_STATUS.COMPLETED.code) {
                    if (!classification.targetDate) {
                        addIssue(
                            'completion_date_conflict', pq, step, 'Tamamlanma Tarihi', rawDate || 'Boş',
                            'Tamamlanan adımda geçerli tarih bulunmuyor.',
                            'Gerçek tamamlanma tarihini OLF kaydında güncelleyin.',
                            row, master
                        );
                    } else if (classification.targetDate > today) {
                        addIssue(
                            'completion_date_conflict', pq, step, 'Tamamlanma Tarihi', rawDate,
                            'Tamamlanan adımın tarihi gelecekte görünüyor.',
                            'Tamamlanma tarihini ve progress durumunu doğrulayın.',
                            row, master
                        );
                    }
                } else if (!classification.targetDate) {
                    if (isPlaceholderDate) {
                        addIssue(
                            'missing_date', pq, step, 'Hedef Tarih', rawDate || 'Boş',
                            'Açık CAP adımında hedef tarih bulunmuyor.',
                            'Gerçekçi hedef tarihi girin.',
                            row, master
                        );
                    } else {
                        addIssue(
                            'invalid_date', pq, step, 'Hedef Tarih', rawDate,
                            'Tarih metni geçerli bir tarihe dönüştürülemiyor.',
                            'Tarihi GG.AA.YYYY veya sistemin kabul ettiği formatta düzeltin.',
                            row, master
                        );
                    }
                }

                if (!/^\d+(?:\.\d+)?$/.test(step)) {
                    addIssue(
                        'invalid_step', pq, step, 'Adım Numarası', step,
                        'Adım numarası sayısal standartta değil.',
                        'Adım numarasını tekil ve sayısal olacak şekilde düzeltin.',
                        row, master
                    );
                }

                if (dqIsMissing(row.sourceFile)) {
                    addIssue(
                        'missing_source', pq, step, 'Kaynak Dosya', row.sourceFile || 'Boş',
                        'Kaynak Word dosyası bilgisi eksik.',
                        'Kaydı güncel Word raporundan yeniden içe aktarın.',
                        row, master
                    );
                }
            });

            stepMap.forEach((rowsForStep, step) => {
                if (step && rowsForStep.length > 1) {
                    addIssue(
                        'duplicate_step', pq, step, 'Adım Numarası', `${step} (${rowsForStep.length} kayıt)`,
                        'Aynı PQ içinde adım numarası birden fazla kullanılmış.',
                        'Adım numaralarını ve tekrar eden kayıtları kontrol edin.',
                        rowsForStep[0], master
                    );
                }
            });

            actionMap.forEach(rowsForAction => {
                if (rowsForAction.length > 1) {
                    addIssue(
                        'duplicate_action', pq, rowsForAction[0].step, 'CAP Eylemi', `${rowsForAction.length} aynı metin`,
                        'Aynı PQ içinde aynı CAP metni tekrarlanıyor.',
                        'Tekrar eden adımları birleştirin veya farklılaştırın.',
                        rowsForAction[0], master
                    );
                }
            });
        });

        allActionTextMap.forEach(entries => {
            const uniquePqs = Array.from(new Set(entries.map(entry => entry.pq)));
            if (uniquePqs.length < 2) return;
            entries.forEach(entry => {
                addIssue(
                    'cross_pq_duplicate', entry.pq, entry.row.step, 'CAP Eylemi',
                    `Benzer metin kullanılan PQ'lar: ${uniquePqs.join(', ')}`,
                    'Aynı uzun CAP metni farklı PQ’larda kullanılmış.',
                    'Eylemin ilgili PQ’ya özgü olup olmadığını manuel kontrol edin.',
                    entry.row, entry.master
                );
            });
        });

        issues.sort((a, b) =>
            DATA_QUALITY_SEVERITIES[b.severity].weight - DATA_QUALITY_SEVERITIES[a.severity].weight ||
            sortAreas(a.area, b.area) ||
            sortPQs(a.pq, b.pq) ||
            String(a.step).localeCompare(String(b.step), 'tr')
        );

        const affectedPqs = new Set(issues.map(issue => issue.pq));
        const issueFreePqs = scope.pqs.filter(pq => !affectedPqs.has(pq));
        const severityCounts = { critical: 0, high: 0, medium: 0, low: 0 };
        const categoryCounts = {};

        issues.forEach(issue => {
            severityCounts[issue.severity]++;
            if (!categoryCounts[issue.category]) {
                categoryCounts[issue.category] = {
                    category: issue.category,
                    count: 0,
                    pqs: new Set(),
                    severity: issue.severity
                };
            }
            categoryCounts[issue.category].count++;
            categoryCounts[issue.category].pqs.add(issue.pq);
        });

        const areaMap = {};
        scope.pqs.forEach(pq => {
            const master = pqMasterData[pq] || {};
            const area = master.alan || 'DİĞER';
            if (!areaMap[area]) areaMap[area] = { area, pqs: new Set(), affected: new Set(), issues: 0, high: 0 };
            areaMap[area].pqs.add(pq);
        });

        issues.forEach(issue => {
            const area = issue.area || 'DİĞER';
            if (!areaMap[area]) areaMap[area] = { area, pqs: new Set(), affected: new Set(), issues: 0, high: 0 };
            areaMap[area].pqs.add(issue.pq);
            areaMap[area].affected.add(issue.pq);
            areaMap[area].issues++;
            if (issue.severity === 'critical' || issue.severity === 'high') areaMap[area].high++;
        });

        const areaRows = Object.values(areaMap).map(area => ({
            area: area.area,
            pqCount: area.pqs.size,
            affectedPq: area.affected.size,
            issueCount: area.issues,
            highCount: area.high,
            cleanPct: area.pqs.size ? Number((((area.pqs.size - area.affected.size) / area.pqs.size) * 100).toFixed(1)) : 0
        })).sort((a, b) =>
            b.highCount - a.highCount ||
            b.issueCount - a.issueCount ||
            sortAreas(a.area, b.area)
        );

        return {
            scope,
            issues,
            affectedPqs: Array.from(affectedPqs),
            issueFreePqs,
            severityCounts,
            categoryCounts,
            areaRows,
            qualityRate: scope.pqs.length ? Number(((issueFreePqs.length / scope.pqs.length) * 100).toFixed(1)) : 0,
            generatedAt: new Date()
        };
    }

    function dqPopulateCategorySelect(model) {
        const select = document.getElementById('dqCategoryFilter');
        if (!select) return;
        const current = select.value || 'all';
        const options = Object.values(model.categoryCounts)
            .sort((a, b) =>
                DATA_QUALITY_SEVERITIES[b.severity].weight - DATA_QUALITY_SEVERITIES[a.severity].weight ||
                b.count - a.count
            )
            .map(item => `<option value="${item.category}">${escapeHtml(DATA_QUALITY_CATEGORIES[item.category].label)} (${item.count})</option>`)
            .join('');
        select.innerHTML = '<option value="all">Tüm kategoriler</option>' + options;
        select.value = Array.from(select.options).some(option => option.value === current) ? current : 'all';
    }

    function getVisibleDataQualityIssues(model) {
        const severity = (document.getElementById('dqSeverityFilter') || {}).value || 'all';
        const category = (document.getElementById('dqCategoryFilter') || {}).value || 'all';
        const search = dqNormalize((document.getElementById('dqSearchInput') || {}).value).toLocaleLowerCase('tr-TR');

        return (model.issues || []).filter(issue => {
            if (severity !== 'all' && issue.severity !== severity) return false;
            if (category !== 'all' && issue.category !== category) return false;
            if (!search) return true;

            const haystack = [
                issue.pq, issue.step, issue.area, issue.ce, issue.office, issue.field,
                issue.problem, issue.currentValue, issue.recommendation,
                DATA_QUALITY_CATEGORIES[issue.category].label
            ].map(dqNormalize).join(' ').toLocaleLowerCase('tr-TR');

            return haystack.includes(search);
        });
    }

    window.setDataQualityCategory = function(category) {
        const select = document.getElementById('dqCategoryFilter');
        if (select) select.value = select.value === category ? 'all' : category;
        renderDataQualityCenter();
    };

    window.clearDataQualityLocalFilters = function() {
        const severity = document.getElementById('dqSeverityFilter');
        const category = document.getElementById('dqCategoryFilter');
        const search = document.getElementById('dqSearchInput');
        if (severity) severity.value = 'all';
        if (category) category.value = 'all';
        if (search) search.value = '';
        renderDataQualityCenter();
    };

    window.openDataQualityIssue = function(pq) {
        if (rawData.some(row => row.pq === pq)) {
            openSmartPQ(pq);
            return;
        }
        const master = pqMasterData[pq] || {};
        alert(`PQ ${pq} için Word/CAP satırı bulunmuyor.\nAlan: ${master.alan || '-'}\nCE: ${master.ce || '-'}\nExcel master kaydı kontrol edilmelidir.`);
    };

    function buildDataQualitySummaryRows(model) {
        return [
            { 'Metrik': 'Analiz edilen PQ', 'Değer': model.scope.pqs.length, 'Açıklama': 'Aktif filtre kapsamı ve uygun master-only kayıtlar' },
            { 'Metrik': 'Sorunsuz PQ', 'Değer': model.issueFreePqs.length, 'Açıklama': 'Hiçbir kalite kuralına takılmayan PQ' },
            { 'Metrik': 'Sorunsuz PQ oranı', 'Değer': '%' + model.qualityRate.toFixed(1), 'Açıklama': 'Sorunsuz PQ / analiz edilen PQ' },
            { 'Metrik': 'Toplam kalite sorunu', 'Değer': model.issues.length, 'Açıklama': 'Tüm kural ihlalleri' },
            { 'Metrik': 'Kritik sorun', 'Değer': model.severityCounts.critical, 'Açıklama': 'CAP/master eşleşmesi gibi temel eksikler' },
            { 'Metrik': 'Yüksek sorun', 'Değer': model.severityCounts.high, 'Açıklama': 'Tarih, ofis, alan ve mükerrerlik sorunları' },
            { 'Metrik': 'Orta sorun', 'Değer': model.severityCounts.medium, 'Açıklama': 'Tamamlama ve master veri eksikleri' },
            { 'Metrik': 'Düşük / kontrol', 'Değer': model.severityCounts.low, 'Açıklama': 'Manuel doğrulama gerektiren kayıtlar' }
        ];
    }

    function buildDataQualityCategoryRows(model) {
        return Object.values(model.categoryCounts)
            .sort((a, b) =>
                DATA_QUALITY_SEVERITIES[b.severity].weight - DATA_QUALITY_SEVERITIES[a.severity].weight ||
                b.count - a.count
            )
            .map(item => ({
                'Kategori': DATA_QUALITY_CATEGORIES[item.category].label,
                'Seviye': DATA_QUALITY_SEVERITIES[item.severity].label,
                'Sorun Sayısı': item.count,
                'Etkilenen PQ': item.pqs.size,
                'Açıklama': DATA_QUALITY_CATEGORIES[item.category].description
            }));
    }

    function buildDataQualityAreaRows(model) {
        return model.areaRows.map(area => ({
            'Denetim Alanı': area.area,
            'PQ Sayısı': area.pqCount,
            'Etkilenen PQ': area.affectedPq,
            'Toplam Sorun': area.issueCount,
            'Kritik/Yüksek': area.highCount,
            'Sorunsuz PQ %': area.cleanPct
        }));
    }

    function buildDataQualityIssueRows(issues) {
        return (issues || []).map(issue => ({
            'Seviye': DATA_QUALITY_SEVERITIES[issue.severity].label,
            'Kategori': DATA_QUALITY_CATEGORIES[issue.category].label,
            'PQ': issue.pq,
            'Adım': issue.step,
            'Denetim Alanı': issue.area,
            'CE': issue.ce,
            'Sorumlu Ofis': issue.office,
            'Kontrol Edilen Alan': issue.field,
            'Sorun': fullTextForExcel(issue.problem),
            'Mevcut Değer': fullTextForExcel(issue.currentValue),
            'Düzeltme Önerisi': fullTextForExcel(issue.recommendation),
            'Bulgu': fullTextForExcel((issue.master || {}).bulgu || ''),
            'CAP Eylemi': fullTextForExcel((issue.row || {}).action || ''),
            'Hedef Tarih': (issue.row || {}).estDate || '',
            'Progress': (issue.row || {}).progress || '',
            'Kaynak Dosya': (issue.row || {}).sourceFile || ''
        }));
    }

    function buildDataQualityRecommendations(model) {
        return Object.values(model.categoryCounts)
            .sort((a, b) =>
                DATA_QUALITY_SEVERITIES[b.severity].weight - DATA_QUALITY_SEVERITIES[a.severity].weight ||
                b.count - a.count
            )
            .slice(0, 6)
            .map(item => {
                const sampleIssue = model.issues.find(issue => issue.category === item.category) || {};
                return {
                    title: DATA_QUALITY_CATEGORIES[item.category].label,
                    count: item.count,
                    pqs: item.pqs.size,
                    severity: item.severity,
                    text: sampleIssue.recommendation || DATA_QUALITY_CATEGORIES[item.category].description
                };
            });
    }

    window.renderDataQualityCenter = function(filteredRows) {
        const root = document.getElementById('tab-quality');
        if (!root) return null;

        const hasFreshScope = Array.isArray(filteredRows);
        const model = hasFreshScope
            ? buildDataQualityModel(filteredRows)
            : (window.currentDataQualityModel || buildDataQualityModel(getFilteredData()));
        window.currentDataQualityModel = model;
        dqPopulateCategorySelect(model);
        const visibleIssues = getVisibleDataQualityIssues(model);

        const setText = (id, value) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        };

        setText('dqAnalyzedPq', model.scope.pqs.length);
        setText('dqCleanPq', model.issueFreePqs.length);
        setText('dqTotalIssues', model.issues.length);
        setText('dqHighIssues', model.severityCounts.critical + model.severityCounts.high);
        setText('dqQualityRate', '%' + model.qualityRate.toFixed(1));

        const scope = document.getElementById('dqScope');
        if (scope) {
            scope.innerHTML = `Aktif filtre kapsamı: <b>${model.scope.visibleRows.length} görünür CAP satırı</b> · <b>${model.scope.pqs.length} PQ</b> · <b>${model.affectedPqs.length} etkilenen PQ</b> · yerel kalite filtresinde <b>${visibleIssues.length} sorun</b>`;
        }

        const selectedCategory = (document.getElementById('dqCategoryFilter') || {}).value || 'all';
        const categoryGrid = document.getElementById('dqCategoryGrid');
        if (categoryGrid) {
            categoryGrid.innerHTML = Object.values(model.categoryCounts)
                .sort((a, b) =>
                    DATA_QUALITY_SEVERITIES[b.severity].weight - DATA_QUALITY_SEVERITIES[a.severity].weight ||
                    b.count - a.count
                )
                .map(item => `
                    <div class="dq-category-card ${item.severity} ${selectedCategory === item.category ? 'active' : ''}" onclick="setDataQualityCategory('${item.category}')">
                        <strong>${item.count}</strong>
                        <span>${escapeHtml(DATA_QUALITY_CATEGORIES[item.category].label)}</span>
                        <small>${item.pqs.size} PQ · ${escapeHtml(DATA_QUALITY_SEVERITIES[item.severity].label)}</small>
                    </div>
                `).join('') || '<div class="dq-empty">Kalite sorunu bulunmadı.</div>';
        }

        const areaBody = document.getElementById('dqAreaSummaryBody');
        if (areaBody) {
            areaBody.innerHTML = renderHtmlTableRows(model.areaRows, [
                {render:area=>`<b>${escapeHtml(area.area)}</b>`,rawHtml:true},
                {key:'pqCount'},{key:'affectedPq'},{key:'issueCount'},{key:'highCount'},
                {render:area=>'%' + area.cleanPct.toFixed(1)}
            ], {colspan:6,emptyClass:'dq-empty',emptyText:'Alan verisi yok.'});
        }

        const recommendations = document.getElementById('dqRecommendations');
        if (recommendations) {
            recommendations.innerHTML = buildDataQualityRecommendations(model).map(item => `
                <div class="dq-recommendation">
                    <b>${item.count} sorun / ${item.pqs} PQ · ${escapeHtml(item.title)}</b><br>
                    ${escapeHtml(item.text)}
                </div>
            `).join('') || '<div class="dq-empty">Düzeltme önerisi gerektiren sorun bulunmadı.</div>';
        }

        const issueBody = document.getElementById('dqIssueTableBody');
        if (issueBody) {
            issueBody.innerHTML = renderHtmlTableRows(visibleIssues, [
                {render:issue=>`<span class="dq-severity ${issue.severity}">${escapeHtml(DATA_QUALITY_SEVERITIES[issue.severity].label)}</span>`,rawHtml:true},
                {render:issue=>`<b>${escapeHtml(DATA_QUALITY_CATEGORIES[issue.category].label)}</b>`,rawHtml:true},
                {render:issue=>`<b>PQ ${escapeHtml(issue.pq)}</b>${issue.step ? `<br>Adım ${escapeHtml(issue.step)}` : ''}`,rawHtml:true},
                {render:issue=>`${escapeHtml(issue.area||'-')}<br><span style="color:var(--muted)">${escapeHtml(issue.ce||'-')}</span>`,rawHtml:true},
                {render:issue=>`${escapeHtml(issue.field||'-')}<br><span style="color:var(--muted)">${escapeHtml(issue.office||'')}</span>`,rawHtml:true},
                {key:'problem'},
                {key:'currentValue',attrs:'class="dq-field-value"'},
                {key:'recommendation'}
            ], {colspan:8,emptyClass:'dq-empty',emptyText:'Seçili yerel filtrelerde kalite sorunu bulunmadı.',rowAttrs:issue=>`onclick="openDataQualityIssue(decodeURIComponent('${encodeURIComponent(String(issue.pq||''))}'))"`});
        }

        const note = document.getElementById('dqTableNote');
        if (note) {
            note.textContent = `${visibleIssues.length} sorun gösteriliyor. Bir satıra tıklayarak ilgili PQ ayrıntısına gidebilirsiniz.`;
        }

        return model;
    };

    window.updateDataQualityCenter = window.renderDataQualityCenter;

    window.runDataQualitySelfCheck = function() {
        const model = buildDataQualityModel(getFilteredData());
        const categoriesValid = model.issues.every(issue =>
            DATA_QUALITY_CATEGORIES[issue.category] && DATA_QUALITY_SEVERITIES[issue.severity]
        );
        const severityTotal = Object.values(model.severityCounts).reduce((sum, value) => sum + value, 0);
        const result = {
            passed: categoriesValid && severityTotal === model.issues.length,
            analyzedPq: model.scope.pqs.length,
            issues: model.issues.length,
            affectedPq: model.affectedPqs.length,
            cleanPq: model.issueFreePqs.length,
            qualityRate: model.qualityRate
        };
        console.table(result);
        return result;
    };

    // ================================================================
    // AKILLI YONETIM OZETI - KURAL BAZLI KARAR DESTEK KATMANI
    // Aktif filtredeki PQ'lari tam PQ baglamiyla analiz eder.
    // ================================================================
    function getSmartScopeRows(filteredRows) {
        const rows = Array.isArray(filteredRows) ? filteredRows : [];
        if (!rows.length) return [];
        return expandFilteredRowsToFullPqGroups(rows);
    }

    function buildSmartManagementModel(filteredRows, analyticsModel = null) {
        const visibleRows = Array.isArray(filteredRows) ? filteredRows : [];
        const scopeRows = getSmartScopeRows(visibleRows);
        const analytics = scopeRows.length ? buildCommonCalculationModel(scopeRows, { upcomingDays: 30 }) : (analyticsModel || buildCommonCalculationModel([]));
        const today = todayMidnight();
        const last30 = new Date(today); last30.setDate(last30.getDate() - 30);
        const globalTotal = Object.values(baseEIData || {}).reduce((sum, b) => sum + Number((b || {}).total || 0), 0) || Object.keys(pqMasterData || {}).length || 1;
        const areaTotals = {};
        Object.keys(baseEIData || {}).forEach(a => { areaTotals[normalizeAreaKey(a) || a] = Number((baseEIData[a] || {}).total || 0); });

        const pqItems = (analytics.standardized.pqItems || []).map(item => {
            const actionItems = item.actionItems || [];
            const openActions = actionItems.filter(x => x.classification.code !== COMMON_ACTION_STATUS.COMPLETED.code);
            const maxDelayDays = openActions.reduce((m, x) => Math.max(m, Number(x.classification.delayDays || 0)), 0);
            const upcomingSteps = openActions.filter(x => x.classification.code === COMMON_ACTION_STATUS.UPCOMING.code).length;
            const progressPct = item.totalSteps ? Number(((item.doneSteps / item.totalSteps) * 100).toFixed(1)) : 0;
            const areaKey = normalizeAreaKey(item.area) || item.area || 'DİĞER';
            const areaTotal = Number(areaTotals[areaKey] || 0) || Math.max(1, (analytics.areas[areaKey] || {}).total || 1);
            const areaContributionPct = Number((100 / areaTotal).toFixed(2));
            const overallContributionPct = Number((100 / globalTotal).toFixed(2));
            const evidenceWaiting = actionItems.filter(x => getKanbanWorkflowStage(item.pq, x.item.step) === 'Kanıt Bekleniyor').length;
            const riskScore = Math.round(
                (item.lateSteps * 40) +
                (item.missingDates * 30) +
                (Math.min(maxDelayDays, 730) * 0.12) +
                (item.openSteps * 5) +
                (upcomingSteps * 8) +
                (evidenceWaiting * 7) +
                (areaContributionPct * 3)
            );
            return {
                ...item,
                area: areaKey,
                owner: item.responsible || 'Belirtilmedi',
                finding: item.finding || '',
                maxDelayDays,
                upcomingSteps,
                evidenceWaiting,
                progressPct,
                areaContributionPct,
                overallContributionPct,
                riskScore
            };
        });

        const openPqs = pqItems.filter(x => ![COMMON_PQ_STATUS.OFFICIAL_CLOSED.code, COMMON_PQ_STATUS.CAP_COMPLETED.code].includes(x.code));
        const critical = openPqs.slice().sort((a,b) =>
            b.riskScore - a.riskScore || b.lateSteps - a.lateSteps || b.maxDelayDays - a.maxDelayDays || b.areaContributionPct - a.areaContributionPct || sortPQs(a.pq,b.pq)
        );
        const quickWins = openPqs.filter(x => x.totalSteps > 0 && x.missingDates === 0 && (x.openSteps <= 2 || x.progressPct >= 70)).sort((a,b) =>
            b.areaContributionPct - a.areaContributionPct || a.openSteps - b.openSteps || b.progressPct - a.progressPct || sortPQs(a.pq,b.pq)
        );
        const recentCompleted = pqItems.filter(x => x.code === COMMON_PQ_STATUS.CAP_COMPLETED.code && x.closureDate && x.closureDate >= last30 && x.closureDate <= today).sort((a,b) => b.closureDate - a.closureDate);
        const delayedActions = (analytics.standardized.actions.late.rows || []).slice().sort((a,b) =>
            Number(b.delayDays || 0) - Number(a.delayDays || 0) || sortPQs(a.pq,b.pq) || String(a.row.step || '').localeCompare(String(b.row.step || ''),'tr')
        );
        const officeRows = (analytics.officeRows || []).map(o => {
            const total = Number(o.actions || 0);
            const done = Number(o.done || 0);
            const late = Number(o.late || 0);
            const completionRate = total ? Number(((done / total) * 100).toFixed(1)) : 0;
            const delayRate = total ? Number(((late / total) * 100).toFixed(1)) : 0;
            const pressureScore = Math.round((late * 20) + (delayRate * 0.8) + (total * 1.5));
            return { ...o, totalActions:total, doneActions:done, lateActions:late, completionRate, delayRate, pressureScore };
        }).sort((a,b) => b.pressureScore - a.pressureScore || b.lateActions - a.lateActions || b.totalActions - a.totalActions || a.office.localeCompare(b.office,'tr'));

        return {
            visibleRows, scopeRows, analytics, pqItems, openPqs, critical, quickWins, recentCompleted, delayedActions, officeRows,
            bottleneck: officeRows[0] || null,
            highPriorityCount: critical.filter(x => x.riskScore >= 40 || x.lateSteps > 0 || x.missingDates > 0).length,
            generatedAt: new Date()
        };
    }

    function smartDateText(date) { return date ? formatExactDate(date) : 'Tarih yok'; }
    function smartEmpty(text) { return `<div class="smart-empty">${escapeHtml(text)}</div>`; }
    function smartProgressHtml(value) { const pct = Math.max(0, Math.min(100, Number(value || 0))); return `<div class="smart-progress"><span style="width:${pct}%"></span></div>`; }

    window.openSmartPQ = function(pq) {
        switchTab('list');
        const safeId = String(pq || '').replace(/\./g,'-');
        setTimeout(() => {
            const detail = document.getElementById('detail-' + safeId);
            const head = document.getElementById('head-' + safeId);
            if (detail && !detail.classList.contains('active')) togglePQ(safeId);
            if (head && head.scrollIntoView) head.scrollIntoView({behavior:'smooth', block:'center'});
        }, 50);
    };

    function renderSmartCriticalList(model) {
        const el = document.getElementById('smartCriticalList'); if (!el) return;
        const rows = (model.critical || []).slice(0, 8);
        el.innerHTML = rows.length ? rows.map(x => `<div class="smart-list-item" onclick="openSmartPQ('${String(x.pq).replace(/'/g,"\\'")}')"><div class="smart-item-head"><span>PQ ${escapeHtml(x.pq)} · ${escapeHtml(x.area)}</span><span class="smart-item-chip danger">Risk ${x.riskScore}</span></div><div class="smart-item-meta">${x.lateSteps} gecikmiş · ${x.missingDates} tarih riski · ${x.openSteps}/${x.totalSteps} açık adım · azami ${x.maxDelayDays} gün gecikme<br>Sorumlu: ${escapeHtml(x.owner)} · Alan EI katkısı: %${x.areaContributionPct.toFixed(2)}</div>${smartProgressHtml(x.progressPct)}</div>`).join('') : smartEmpty('Yüksek öncelikli açık PQ bulunmadı.');
    }

    function renderSmartDelayList(model) {
        const el = document.getElementById('smartDelayList'); if (!el) return;
        const rows = (model.delayedActions || []).slice(0, 8);
        el.innerHTML = rows.length ? rows.map(x => { const r=x.row||{}; return `<div class="smart-list-item" onclick="openSmartPQ('${String(x.pq).replace(/'/g,"\\'")}')"><div class="smart-item-head"><span>PQ ${escapeHtml(x.pq)} · Adım ${escapeHtml(r.step || '-')}</span><span class="smart-item-chip danger">${Number(x.delayDays || 0)} gün</span></div><div class="smart-item-meta">${escapeHtml(x.area || '-')} · ${escapeHtml(r.office || 'Belirtilmedi')} · Hedef: ${escapeHtml(smartDateText(x.targetDate))}<br>${escapeHtml(String(r.action || '').slice(0,220))}${String(r.action||'').length>220?'…':''}</div></div>`; }).join('') : smartEmpty('Gecikmiş CAP adımı bulunmadı.');
    }

    function renderSmartQuickWinList(model) {
        const el = document.getElementById('smartQuickWinList'); if (!el) return;
        const rows = (model.quickWins || []).slice(0, 8);
        el.innerHTML = rows.length ? rows.map(x => `<div class="smart-list-item" onclick="openSmartPQ('${String(x.pq).replace(/'/g,"\\'")}')"><div class="smart-item-head"><span>PQ ${escapeHtml(x.pq)} · ${escapeHtml(x.area)}</span><span class="smart-item-chip ok">+%${x.areaContributionPct.toFixed(2)} alan EI</span></div><div class="smart-item-meta">${x.openSteps} kalan adım · %${x.progressPct.toFixed(1)} ilerleme · ${x.upcomingSteps} yaklaşan adım<br>Sorumlu: ${escapeHtml(x.owner)} · Öngörülen son tarih: ${escapeHtml(smartDateText(x.closureDate))}</div>${smartProgressHtml(x.progressPct)}</div>`).join('') : smartEmpty('Hızlı kazanım ölçütlerini karşılayan açık PQ bulunmadı.');
    }

    function renderSmartOfficeList(model) {
        const el = document.getElementById('smartOfficeList'); if (!el) return;
        const rows = (model.officeRows || []).slice(0, 8);
        el.innerHTML = rows.length ? rows.map(o => `<div class="smart-list-item no-click"><div class="smart-item-head"><span>${escapeHtml(o.office)}</span><span class="smart-item-chip ${o.lateActions>0?'warn':'ok'}">${o.lateActions} gecikmiş</span></div><div class="smart-item-meta">${o.totalActions} eylem · ${o.pqCount} PQ · tamamlanma %${o.completionRate.toFixed(1)} · gecikme %${o.delayRate.toFixed(1)}</div>${smartProgressHtml(o.completionRate)}</div>`).join('') : smartEmpty('Sorumlu ofis verisi bulunmadı.');
    }

    function updateSmartManagementPanel(filteredRows, analyticsModel = null) {
        const model = buildSmartManagementModel(filteredRows, analyticsModel);
        window.currentSmartManagementModel = model;
        const setText = (id,val) => { const el=document.getElementById(id); if(el) el.textContent=String(val); };
        setText('smartCriticalCount', model.highPriorityCount);
        setText('smartLateActionCount', model.delayedActions.length);
        setText('smartQuickWinCount', model.quickWins.length);
        setText('smartRecentCompletedCount', model.recentCompleted.length);
        const scope = document.getElementById('smartManagementScope');
        if (scope) scope.textContent = `Aktif filtre kapsamı: ${new Set((filteredRows||[]).map(x=>x.pq)).size} PQ / ${(filteredRows||[]).length} görünür adım · Tam PQ bağlamında ${model.scopeRows.length} adım analiz edildi${window.activeReadyFilter && READY_FILTER_DEFINITIONS[window.activeReadyFilter] ? ' · Hazır filtre: ' + READY_FILTER_DEFINITIONS[window.activeReadyFilter].label : ''}`;
        const b = model.bottleneck;
        const firstCritical = model.critical[0];
        const quickNames = model.quickWins.slice(0,3).map(x=>'PQ '+x.pq).join(', ') || 'aday yok';
        const briefing = document.getElementById('smartManagementBriefing');
        if (briefing) {
            if (!model.scopeRows.length) briefing.innerHTML = 'Aktif filtre kapsamında analiz edilecek kayıt bulunamadı.';
            else briefing.innerHTML = `Aktif kapsamda <b>${model.openPqs.length} açık PQ</b> ve <b>${model.delayedActions.length} gecikmiş CAP adımı</b> bulunuyor. ${firstCritical ? `Öncelikli takip adayı <b>PQ ${escapeHtml(firstCritical.pq)}</b> (${escapeHtml(firstCritical.area)}, risk skoru ${firstCritical.riskScore}) olarak hesaplandı.` : 'Yüksek öncelikli PQ bulunmadı.'} ${b ? `En belirgin ofis darboğazı <b>${escapeHtml(b.office)}</b>: ${b.lateActions} gecikmiş / ${b.totalActions} eylem.` : 'Ofis darboğazı verisi yok.'} Hızlı kazanım adayları: <b>${escapeHtml(quickNames)}</b>. Son 30 günde tüm CAP adımları tamamlanan PQ sayısı <b>${model.recentCompleted.length}</b>.`;
        }
        renderSmartCriticalList(model); renderSmartDelayList(model); renderSmartQuickWinList(model); renderSmartOfficeList(model);
        return model;
    }

    function buildSmartSummaryExportRows(model) {
        model = model || window.currentSmartManagementModel || buildSmartManagementModel(getFilteredData());
        const b = model.bottleneck;
        return [
            {'Metrik':'Aktif Kapsamdaki PQ','Değer':new Set(model.visibleRows.map(x=>x.pq)).size,'Açıklama':'Mevcut filtrelerle görünür benzersiz PQ'},
            {'Metrik':'Açık PQ','Değer':model.openPqs.length,'Açıklama':'Resmî kapalı ve tüm CAP adımları tamamlananlar hariç'},
            {'Metrik':'Yüksek Öncelikli PQ','Değer':model.highPriorityCount,'Açıklama':'Gecikme, tarih riski ve iş yükü bileşik değerlendirmesi'},
            {'Metrik':'Gecikmiş CAP Adımı','Değer':model.delayedActions.length,'Açıklama':'Hedef tarihi geçmiş açık adımlar'},
            {'Metrik':'Hızlı Kazanım Adayı','Değer':model.quickWins.length,'Açıklama':'Az kalan adım veya yüksek ilerleme ve tarih riski bulunmayan PQ'},
            {'Metrik':'Son 30 Günde CAP Tamamlanan PQ','Değer':model.recentCompleted.length,'Açıklama':'Tüm CAP adımları son 30 günlük dönemde tamamlanan PQ'},
            {'Metrik':'Başlıca Darboğaz','Değer':b ? b.office : '-','Açıklama':b ? `${b.lateActions} gecikmiş / ${b.totalActions} eylem` : 'Ofis verisi yok'}
        ];
    }

    function buildSmartPqExportRows(items) {
        return (items || []).map(x => ({
            'PQ':x.pq,'Denetim Alanı':x.area,'CE':x.ce || '','Sorumlu':x.owner,'Standart Durum':x.label,'Risk Skoru':x.riskScore,'Toplam Adım':x.totalSteps,'Tamamlanan Adım':x.doneSteps,'Açık Adım':x.openSteps,'Gecikmiş Adım':x.lateSteps,'Tarih Riski':x.missingDates,'Azami Gecikme Günü':x.maxDelayDays,'İlerleme %':x.progressPct,'Alan EI Katkısı %':x.areaContributionPct,'Overall EI Katkısı %':x.overallContributionPct,'Öngörülen Son Tarih':smartDateText(x.closureDate),'Bulgu':fullTextForExcel(x.finding || '')
        }));
    }

    function buildSmartOfficeExportRows(items) {
        return (items || []).map(o => ({'Sorumlu Ofis':o.office,'Toplam Eylem':o.totalActions,'PQ Sayısı':o.pqCount,'Tamamlanan':o.doneActions,'Gecikmiş':o.lateActions,'Tamamlanma %':o.completionRate,'Gecikme %':o.delayRate,'Darboğaz Skoru':o.pressureScore}));
    }

    window.buildSmartManagementModel = buildSmartManagementModel;
    window.updateSmartManagementPanel = updateSmartManagementPanel;
    window.runSmartManagementSelfCheck = function() {
        const m = buildSmartManagementModel(getFilteredData());
        const passed = m.delayedActions.every(x => x.code === COMMON_ACTION_STATUS.LATE.code) && m.quickWins.every(x => x.missingDates === 0 && (x.openSteps <= 2 || x.progressPct >= 70));
        const result = {passed, pq:m.pqItems.length, open:m.openPqs.length, critical:m.highPriorityCount, delayed:m.delayedActions.length, quickWins:m.quickWins.length, offices:m.officeRows.length};
        console.table(result); return result;
    };


    // ZİYARET VE İÇ DENETİM - PAKET 1
    const VISIT_STATUSES = {
        draft:{label:'Taslak', css:'draft'}, planned:{label:'Planlandı', css:'planned'}, preparation:{label:'Hazırlık yapılıyor', css:'preparation'},
        in_progress:{label:'Ziyaret devam ediyor', css:'in_progress'}, evaluation:{label:'Değerlendirme aşamasında', css:'evaluation'},
        follow_up:{label:'Takipte', css:'follow_up'}, completed:{label:'Tamamlandı', css:'completed'}, cancelled:{label:'İptal edildi', css:'cancelled'}
    };
    const VISIT_METHODS = ['Doküman incelemesi','Görüşme','Yerinde gözlem','Kanıt doğrulama','Çevrim içi toplantı','Karma'];
    const VISIT_TYPES = { internal:'SHGM Ziyareti / İç Denetim', icao_official:'ICAO Resmî Ziyareti' };
    const ICAO_VISIT_TYPES = { ICVM:'ICVM', OSVA:'OSVA', CMAA:'CMAA', OTHER:'Diğer' };
    const ICAO_VALIDATION_STATUSES = {
        not_evaluated:'Değerlendirilmedi', under_review:'İnceleniyor', additional_evidence:'Ek Kanıt / Açıklama Talep Edildi',
        open:'CAP Açık Kaldı', validated:'CAP Kapatıldı / Validated', post_visit:'Ziyaret Sonrası Takip'
    };
    const DEFAULT_VISIT_AREAS = ['LEG','ORG','PEL','OPS','AIR','AIG','ANS','AGA','SSP'];

    function getCurrentVisitUser() {
        const user = firebase.auth().currentUser;
        return user ? { uid:user.uid || '', email:user.email || '', displayName:user.displayName || user.email || 'Yetkili kullanıcı' } : { uid:'', email:'', displayName:'Oturum açılmamış kullanıcı' };
    }
    function visitSafeDate(value) {
        if (!value) return null;
        const d = new Date(String(value).length === 10 ? value + 'T12:00:00' : value);
        return isNaN(d.getTime()) ? null : d;
    }
    function formatVisitDate(value) {
        const d = visitSafeDate(value);
        return d ? formatLongTurkishDate(d) : '-';
    }
    function formatVisitDateRange(start, end) {
        if (!start && !end) return '-';
        if (start && end && start === end) return formatVisitDate(start);
        return `${formatVisitDate(start)}${end ? ' – ' + formatVisitDate(end) : ''}`;
    }
    function getVisitAreaOptions() {
        const values = new Set(DEFAULT_VISIT_AREAS);
        Object.values(pqMasterData || {}).forEach(m => { if (m && m.alan) values.add(String(m.alan).trim().toUpperCase()); });
        (rawData || []).forEach(r => { const m = pqMasterData[r.pq] || {}; if (m.alan) values.add(String(m.alan).trim().toUpperCase()); });
        return Array.from(values).filter(Boolean).sort(sortAreas);
    }
    // Kurumsal ana birim listesi sağlandığında bu dizi doldurulabilir.
    // Kaynak verideki farklı yazımlar VISIT_UNIT_ALIAS_MAP üzerinden ana ada eşleştirilebilir.
    let VISIT_UNIT_CANONICAL_LIST = [];
    let VISIT_UNIT_ALIAS_MAP = {};
    function normalizeVisitUnitKey(value) {
        return String(value || '').trim().toLocaleUpperCase('tr-TR')
            .replace(/[\u2018\u2019'"`]/g, '')
            .replace(/[^A-ZÇĞİÖŞÜ0-9]+/g, ' ')
            .replace(/\s+/g, ' ').trim();
    }
    function canonicalizeVisitUnit(value) {
        const label = String(value || '').trim().replace(/\s+/g, ' ');
        if (!label) return '';
        const key = normalizeVisitUnitKey(label);
        const alias = VISIT_UNIT_ALIAS_MAP[key] || VISIT_UNIT_ALIAS_MAP[label];
        if (alias) return alias;
        if (VISIT_UNIT_CANONICAL_LIST.length) {
            const exact = VISIT_UNIT_CANONICAL_LIST.find(item => normalizeVisitUnitKey(item) === key);
            if (exact) return exact;
        }
        return label;
    }
    function getVisitUnitOptions() {
        const source = [];
        const visitSource = [];
        (rawData || []).forEach(r => { if (r.office && String(r.office).trim()) source.push(String(r.office).trim()); });
        Object.values(pqMasterData || {}).forEach(m => { if (m && m.sorumlu && String(m.sorumlu).trim()) source.push(String(m.sorumlu).trim()); });
        getVisitRecords().forEach(v => getVisitUnits(v).forEach(unit => { source.push(unit); visitSource.push(unit); }));
        // Kurumsal ana liste içe aktarılmışsa seçim ekranında yalnızca ana liste ve eski ziyaretlerde kullanılan değerler gösterilir.
        // Böylece kaynak Word/Excel'deki kişi adları ve farklı yazımlar tekrar tekrar listeye düşmez.
        const labels = VISIT_UNIT_CANONICAL_LIST.length ? VISIT_UNIT_CANONICAL_LIST.concat(visitSource.map(canonicalizeVisitUnit)) : source.map(canonicalizeVisitUnit);
        const byKey = new Map();
        labels.filter(Boolean).forEach(label => {
            const key = normalizeVisitUnitKey(label);
            if (!byKey.has(key)) byKey.set(key, label);
        });
        return Array.from(byKey.values()).sort((a,b) => a.localeCompare(b,'tr'));
    }
    function getVisitUnits(record) {
        if (!record) return [];
        if (Array.isArray(record.units)) return record.units.map(canonicalizeVisitUnit).filter(Boolean);
        if (record.unit) return [canonicalizeVisitUnit(record.unit)].filter(Boolean);
        return [];
    }
    function renderVisitUnitCheckboxes(selectedUnits = []) {
        const container = document.getElementById('visitUnitCheckboxes');
        if (!container) return;
        const selectedKeys = new Set((selectedUnits || []).map(normalizeVisitUnitKey));
        const options = getVisitUnitOptions();
        container.innerHTML = options.length ? options.map(unit => `<label data-unit-label="${escapeHtml(normalizeVisitUnitKey(unit))}"><input type="checkbox" name="visitUnitChoice" value="${escapeHtml(unit)}" ${selectedKeys.has(normalizeVisitUnitKey(unit)) ? 'checked' : ''} onchange="updateVisitUnitSelectionSummary()"> ${escapeHtml(unit)}</label>`).join('') : '<div class="visit-form-note">Birim listesi oluşturulamadı. Önce Word/Excel verilerini yükleyin veya kurumsal ana listeyi tanımlayın.</div>';
        filterVisitUnitOptions();
        updateVisitUnitSelectionSummary();
    }
    function filterVisitUnitOptions() {
        const q = ((document.getElementById('visitUnitSearch') || {}).value || '').trim().toLocaleUpperCase('tr-TR');
        document.querySelectorAll('#visitUnitCheckboxes label[data-unit-label]').forEach(label => {
            label.style.display = !q || label.dataset.unitLabel.includes(normalizeVisitUnitKey(q)) ? '' : 'none';
        });
    }
    function selectAllVisibleVisitUnits() {
        document.querySelectorAll('#visitUnitCheckboxes label[data-unit-label]').forEach(label => {
            if (label.style.display !== 'none') { const input = label.querySelector('input'); if (input) input.checked = true; }
        });
        updateVisitUnitSelectionSummary();
    }
    function updateVisitUnitSelectionSummary() {
        const selected = Array.from(document.querySelectorAll('input[name="visitUnitChoice"]:checked')).map(i => i.value);
        const el = document.getElementById('visitUnitSelectionSummary');
        if (el) el.textContent = selected.length ? `${selected.length} birim seçildi: ${selected.join(' · ')}` : 'Henüz birim seçilmedi.';
    }
    function cleanVisitUnitLabel(value) {
        return String(value || '').trim().replace(/\s+/g, ' ');
    }
    function getVisitUnitSourceInventory() {
        const inventory = new Map();
        const add = (value, sourceType) => {
            const label = cleanVisitUnitLabel(value);
            if (!label) return;
            const key = normalizeVisitUnitKey(label);
            if (!inventory.has(key)) inventory.set(key, { source:label, count:0, sourceTypes:new Set() });
            const item = inventory.get(key); item.count += 1; item.sourceTypes.add(sourceType);
        };
        (rawData || []).forEach(r => add(r && r.office, 'CAP Eylem Ofisi'));
        Object.values(pqMasterData || {}).forEach(m => add(m && m.sorumlu, 'Excel Sorumlu'));
        getVisitRecords(true).forEach(v => getVisitUnits(v).forEach(unit => add(unit, 'Ziyaret Kaydı')));
        (visitUnitMappings || []).forEach(row => add(row && row.source, 'Mevcut Eşleştirme'));
        return Array.from(inventory.values()).map(item => ({
            source:item.source,
            count:item.count,
            sourceTypes:Array.from(item.sourceTypes).sort((a,b)=>a.localeCompare(b,'tr')).join(', '),
            canonical:canonicalizeVisitUnit(item.source)
        })).sort((a,b)=>a.source.localeCompare(b.source,'tr'));
    }
    function rebuildVisitUnitMappingCache() {
        const canonical = new Map();
        (visitUnitCanonicalUnits || []).forEach(value => {
            const label = cleanVisitUnitLabel(value);
            if (label) canonical.set(normalizeVisitUnitKey(label), label);
        });
        const aliases = {};
        (visitUnitMappings || []).forEach(row => {
            if (!row || row.active === false) return;
            const source = cleanVisitUnitLabel(row.source);
            const target = cleanVisitUnitLabel(row.canonical);
            if (!source || !target) return;
            canonical.set(normalizeVisitUnitKey(target), target);
            aliases[normalizeVisitUnitKey(source)] = target;
        });
        VISIT_UNIT_CANONICAL_LIST = Array.from(canonical.values()).sort((a,b)=>a.localeCompare(b,'tr'));
        VISIT_UNIT_ALIAS_MAP = aliases;
        updateVisitUnitMappingStatus();
    }
    function updateVisitUnitMappingStatus() {
        const el = document.getElementById('visitUnitMappingStatus');
        if (!el) return;
        const activeMappings = (visitUnitMappings || []).filter(r => r && r.active !== false && cleanVisitUnitLabel(r.source) && cleanVisitUnitLabel(r.canonical)).length;
        el.textContent = activeMappings || VISIT_UNIT_CANONICAL_LIST.length
            ? `${VISIT_UNIT_CANONICAL_LIST.length} ana birim · ${activeMappings} kaynak eşleştirmesi Firebase'den kullanılıyor.`
            : 'Kurumsal birim eşleştirmesi yüklenmedi; kaynak değerler tekilleştirilerek gösteriliyor.';
    }
    function startVisitUnitSettingsListener() {
        stopVisitUnitSettingsListener();
        if (!firebase.auth().currentUser) return;
        visitUnitSettingsRef = db.ref('icao_visit_settings/unit_mapping');
        visitUnitSettingsCallback = snapshot => {
            const data = snapshot.val() || {};
            visitUnitMappings = Array.isArray(data.rows) ? data.rows : Object.values(data.rows || {});
            visitUnitCanonicalUnits = Array.isArray(data.canonicalUnits) ? data.canonicalUnits : Object.values(data.canonicalUnits || {});
            const selected = Array.from(document.querySelectorAll('input[name="visitUnitChoice"]:checked')).map(i => i.value);
            rebuildVisitUnitMappingCache();
            if (document.getElementById('visitFormModal') && document.getElementById('visitFormModal').style.display === 'block') renderVisitUnitCheckboxes(selected);
        };
        visitUnitSettingsRef.on('value', visitUnitSettingsCallback, error => {
            console.error('Birim eşleştirme ayarları yüklenemedi:', error);
            const el = document.getElementById('visitUnitMappingStatus');
            if (el) el.textContent = 'Birim eşleştirme ayarlarına erişilemedi: ' + (error.message || error);
        });
    }
    function stopVisitUnitSettingsListener() {
        if (visitUnitSettingsRef && visitUnitSettingsCallback) visitUnitSettingsRef.off('value', visitUnitSettingsCallback);
        visitUnitSettingsRef = null; visitUnitSettingsCallback = null;
    }
    function getMappingCell(row, names) {
        const normalizedNames = names.map(normalizeVisitUnitKey);
        const key = Object.keys(row || {}).find(k => normalizedNames.includes(normalizeVisitUnitKey(k)));
        return key ? row[key] : '';
    }
    function isMappingRowActive(value) {
        const text = normalizeVisitUnitKey(value || 'EVET');
        return !['HAYIR','NO','FALSE','0','PASIF','PASİF'].includes(text);
    }
    function exportVisitUnitMappingTemplate() {
        try {
            const inventory = getVisitUnitSourceInventory();
            const mappingBySource = new Map((visitUnitMappings || []).map(r => [normalizeVisitUnitKey(r.source), r]));
            const mappingRows = inventory.length ? inventory.map(item => {
                const existing = mappingBySource.get(normalizeVisitUnitKey(item.source));
                return {
                    'Kaynak Birim Adı':item.source,
                    'Ana Birim Adı':existing ? existing.canonical || '' : (item.canonical !== item.source ? item.canonical : ''),
                    'Aktif (EVET/HAYIR)':existing && existing.active === false ? 'HAYIR' : 'EVET',
                    'Kaynak Türü':item.sourceTypes,
                    'Kullanım Sayısı':item.count,
                    'Not':existing ? existing.note || '' : ''
                };
            }) : [{'Kaynak Birim Adı':'','Ana Birim Adı':'','Aktif (EVET/HAYIR)':'EVET','Kaynak Türü':'','Kullanım Sayısı':'','Not':''}];
            const canonicalRows = (VISIT_UNIT_CANONICAL_LIST.length ? VISIT_UNIT_CANONICAL_LIST : ['']).map(unit => ({'Ana Birim Adı':unit,'Aktif (EVET/HAYIR)':'EVET','Not':''}));
            const instructions = [
                {'Adım':'1','Açıklama':'Birim_Eslestirme sayfasındaki Kaynak Birim Adı sütununu değiştirmeyin.'},
                {'Adım':'2','Açıklama':'Her kaynak değer için kullanılmasını istediğiniz kurumsal adı Ana Birim Adı sütununa yazın.'},
                {'Adım':'3','Açıklama':'Aynı kurumsal birime ait farklı kaynak yazımlarına aynı Ana Birim Adını verin.'},
                {'Adım':'4','Açıklama':'Kullanılmayacak satırları Aktif sütununda HAYIR olarak işaretleyin.'},
                {'Adım':'5','Açıklama':'İsterseniz Ana_Birim_Listesi sayfasında kurumun kesin birim listesini ayrıca tanımlayın.'},
                {'Adım':'6','Açıklama':'Dosyayı kaydedip Ziyaret formundaki Eşleştirme Dosyası İçe Aktar düğmesiyle yükleyin.'}
            ];
            const wb = createReportWorkbook({title:'Ziyaret Birim Eşleştirme Şablonu',subject:'Kurumsal ana birim listesi ve kaynak eşleştirmeleri'});
            appendWorkbookSheets(wb,[createSheetDefinition('Birim_Eslestirme',mappingRows),createSheetDefinition('Ana_Birim_Listesi',canonicalRows),createSheetDefinition('Kullanim_Talimati',instructions)]);
            downloadReportWorkbook(wb,'Ziyaret_Birim_Eslestirme_Sablonu.xlsx');
        } catch (error) {
            console.error('Birim eşleştirme şablonu oluşturulamadı:', error);
            alert('Birim eşleştirme şablonu oluşturulamadı: ' + (error.message || error));
        }
    }
    async function importVisitUnitMappingFile(event) {
        const input = event && event.target;
        const file = input && input.files && input.files[0];
        if (!file) return;
        if (!firebase.auth().currentUser) { input.value=''; return alert('Birim eşleştirmesini kaydetmek için yetkili giriş yapılmalıdır.'); }
        showLoading('Birim eşleştirmesi içe aktarılıyor...');
        try {
            const buffer = await file.arrayBuffer();
            const wb = XLSX.read(buffer,{type:'array',cellDates:false});
            const mappingSheetName = wb.SheetNames.find(n => normalizeVisitUnitKey(n).includes('BIRIM ESLESTIRME')) || wb.SheetNames[0];
            const mappingData = XLSX.utils.sheet_to_json(wb.Sheets[mappingSheetName],{defval:''});
            const rows = [];
            mappingData.forEach(row => {
                const source = cleanVisitUnitLabel(getMappingCell(row,['Kaynak Birim Adı','Kaynak Birim','Source Unit']));
                const canonical = cleanVisitUnitLabel(getMappingCell(row,['Ana Birim Adı','Ana Birim','Canonical Unit']));
                if (!source || !canonical) return;
                rows.push({source,canonical,active:isMappingRowActive(getMappingCell(row,['Aktif (EVET/HAYIR)','Aktif','Active'])),note:cleanVisitUnitLabel(getMappingCell(row,['Not','Açıklama','Note']))});
            });
            let canonicalUnits = [];
            const canonicalSheetName = wb.SheetNames.find(n => normalizeVisitUnitKey(n).includes('ANA BIRIM LISTESI'));
            if (canonicalSheetName) {
                const canonicalData = XLSX.utils.sheet_to_json(wb.Sheets[canonicalSheetName],{defval:''});
                canonicalUnits = canonicalData.filter(row => isMappingRowActive(getMappingCell(row,['Aktif (EVET/HAYIR)','Aktif','Active']))).map(row => cleanVisitUnitLabel(getMappingCell(row,['Ana Birim Adı','Ana Birim','Canonical Unit']))).filter(Boolean);
            }
            canonicalUnits.push(...rows.filter(r=>r.active!==false).map(r=>r.canonical));
            const byCanonical = new Map(); canonicalUnits.forEach(u=>byCanonical.set(normalizeVisitUnitKey(u),u));
            canonicalUnits = Array.from(byCanonical.values()).sort((a,b)=>a.localeCompare(b,'tr'));
            if (!rows.length && !canonicalUnits.length) throw new Error('Dosyada geçerli bir eşleştirme veya ana birim kaydı bulunamadı.');
            const user = getCurrentVisitUser();
            await db.ref('icao_visit_settings/unit_mapping').set({rows,canonicalUnits,sourceFile:file.name,updatedAt:new Date().toISOString(),updatedBy:user});
            alert(`${canonicalUnits.length} ana birim ve ${rows.length} kaynak eşleştirmesi Firebase'e kaydedildi.`);
        } catch (error) {
            console.error('Birim eşleştirme dosyası içe aktarılamadı:', error);
            alert('Birim eşleştirme dosyası içe aktarılamadı: ' + (error.message || error));
        } finally {
            if (input) input.value='';
            hideLoading();
        }
    }

    function startVisitFirebaseListener() {
        stopVisitFirebaseListener();
        if (!firebase.auth().currentUser) return;
        visitFirebaseRef = db.ref('icao_visits');
        visitFirebaseCallback = snapshot => {
            icaoVisits = snapshot.val() || {};
            renderVisitModule();
            renderVisitScopeModule(true);
            renderIcaoOfficialVisitModule(true);
            renderVisitWorkspaceModule(true);
            renderVisitFollowUpModule(true);
            renderVisitConsultationModule(true);
            renderVisitReportsModule();
            renderVisitManagementDashboard();
            renderVisitAnalysisModule();
            renderVisitAuditTrail(true);
        };
        visitFirebaseRef.on('value', visitFirebaseCallback, error => {
            console.error('Ziyaret kayıtları yüklenemedi:', error);
            const note = document.getElementById('visitSyncNote');
            if (note) note.textContent = 'Ziyaret kayıtlarına erişilemedi: ' + (error.message || error);
        });
    }
    function stopVisitFirebaseListener() {
        if (visitFirebaseRef && visitFirebaseCallback) visitFirebaseRef.off('value', visitFirebaseCallback);
        visitFirebaseRef = null; visitFirebaseCallback = null;
    }
    function refreshVisitModule() {
        if (!firebase.auth().currentUser) return alert('Ziyaret kayıtlarına erişmek için yetkili giriş yapılmalıdır.');
        startVisitFirebaseListener();
        startVisitUnitSettingsListener();
    }
    function populateVisitStaticControls() {
        const statusSelects = [document.getElementById('visitStatusFilter'), document.getElementById('visitStatus')].filter(Boolean);
        statusSelects.forEach((select, idx) => {
            const current = select.value;
            select.innerHTML = (idx === 0 ? '<option value="all">Tüm durumlar</option>' : '') + Object.entries(VISIT_STATUSES).map(([key,s]) => `<option value="${key}">${s.label}</option>`).join('');
            if (current && Array.from(select.options).some(o => o.value === current)) select.value = current;
        });
        const areaFilter = document.getElementById('visitAreaFilter');
        if (areaFilter) {
            const current = areaFilter.value;
            areaFilter.innerHTML = '<option value="all">Tüm alanlar</option>' + getVisitAreaOptions().map(a => `<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`).join('');
            if (current && Array.from(areaFilter.options).some(o => o.value === current)) areaFilter.value = current;
        }
    }

    function getVisitType(record) { return (record && record.visitType) || 'internal'; }
    function isIcaoOfficialVisit(record) { return getVisitType(record) === 'icao_official'; }
    function toggleVisitTypeFields() {
        const type = (document.getElementById('visitType') || {}).value || 'internal';
        const field = document.getElementById('icaoVisitTypeField');
        const note = document.getElementById('icaoVisitTypeNote');
        const subtype = document.getElementById('icaoVisitType');
        const official = type === 'icao_official';
        if (field) field.style.display = official ? 'block' : 'none';
        if (note) note.style.display = official ? 'block' : 'none';
        if (subtype) subtype.required = official;
    }

    function renderVisitAreaCheckboxes(selectedAreas = []) {
        const container = document.getElementById('visitAreaCheckboxes');
        if (!container) return;
        const selected = new Set((selectedAreas || []).map(v => String(v).toUpperCase()));
        container.innerHTML = getVisitAreaOptions().map(area => `<label><input type="checkbox" name="visitAreaChoice" value="${escapeHtml(area)}" ${selected.has(area) ? 'checked' : ''}> ${escapeHtml(area)}</label>`).join('');
    }
    function renderVisitMethodCheckboxes(selectedMethods = []) {
        const container = document.getElementById('visitMethodCheckboxes');
        if (!container) return;
        const selected = new Set(selectedMethods || []);
        container.innerHTML = VISIT_METHODS.map(method => `<label><input type="checkbox" name="visitMethodChoice" value="${escapeHtml(method)}" ${selected.has(method) ? 'checked' : ''}> ${escapeHtml(method)}</label>`).join('');
    }
    function getVisitRecords(includeDeleted = false) {
        return Object.entries(icaoVisits || {}).map(([id, value]) => ({ id, ...(value || {}) })).filter(v => includeDeleted || !v.isDeleted);
    }
    // İç denetim/saha çalışma alanına bağlı modüller ICAO resmî ziyaretlerinden ayrıdır.
    // ICAO resmî ziyaretleri Plan, Kapsam/Hazırlık, ICAO Resmî Ziyareti, Yönetim/Takvim ve Audit Trail'de kalır.
    function getInternalWorkflowVisitRecords(includeDeleted = false) {
        return getVisitRecords(includeDeleted).filter(v => !isIcaoOfficialVisit(v));
    }
    function getVisibleVisits() {
        const status = (document.getElementById('visitStatusFilter') || {}).value || 'all';
        const area = (document.getElementById('visitAreaFilter') || {}).value || 'all';
        const q = ((document.getElementById('visitSearchInput') || {}).value || '').trim().toLocaleLowerCase('tr');
        return getVisitRecords().filter(v => {
            if (status !== 'all' && v.status !== status) return false;
            if (area !== 'all' && !(v.areas || []).includes(area)) return false;
            if (q) {
                const haystack = [v.visitName,VISIT_TYPES[getVisitType(v)]||'',ICAO_VISIT_TYPES[v.icaoVisitType]||'',getVisitUnits(v).join(' '),v.location,v.participants,v.counterparts,v.objective,v.generalNotes,(v.areas||[]).join(' '),(v.methods||[]).join(' ')].join(' ').toLocaleLowerCase('tr');
                if (!haystack.includes(q)) return false;
            }
            return true;
        }).sort((a,b) => {
            const ad = visitSafeDate(a.plannedStart), bd = visitSafeDate(b.plannedStart);
            if (ad && bd) return ad - bd;
            if (ad) return -1; if (bd) return 1;
            return String(a.visitName || '').localeCompare(String(b.visitName || ''),'tr');
        });
    }
    function renderVisitModule() {
        populateVisitStaticControls();
        const table = document.getElementById('visitTableBody');
        if (!table) return;
        const records = getVisitRecords();
        const visible = getVisibleVisits();
        const user = firebase.auth().currentUser;
        const sync = document.getElementById('visitSyncNote');
        if (sync) sync.textContent = user ? `Firebase bağlantısı aktif. Ziyaret kayıtları ayrı “icao_visits” veri kümesinde saklanır. Oturum: ${user.email || user.uid}` : 'Ziyaret kayıtlarını görüntülemek ve kaydetmek için yetkili giriş yapılmalıdır.';
        const counts = {
            total:records.length,
            planned:records.filter(v => ['draft','planned','preparation'].includes(v.status)).length,
            active:records.filter(v => ['in_progress','evaluation'].includes(v.status)).length,
            follow:records.filter(v => v.status === 'follow_up').length,
            completed:records.filter(v => v.status === 'completed').length
        };
        [['visitKpiTotal',counts.total],['visitKpiPlanned',counts.planned],['visitKpiActive',counts.active],['visitKpiFollowUp',counts.follow],['visitKpiCompleted',counts.completed]].forEach(([id,val]) => { const el=document.getElementById(id); if(el) el.textContent=val; });
        if (!visible.length) {
            table.innerHTML = `<tr><td colspan="8" class="visit-empty">${records.length ? 'Seçili filtrelere uygun ziyaret kaydı bulunamadı.' : 'Henüz ziyaret kaydı oluşturulmadı. “Yeni Ziyaret” düğmesiyle ilk planı oluşturabilirsiniz.'}</td></tr>`;
            return;
        }
        table.innerHTML = visible.map(v => {
            const status = VISIT_STATUSES[v.status] || VISIT_STATUSES.draft;
            const areas = (v.areas || []).map(a => `<span class="visit-area-chip">${escapeHtml(a)}</span>`).join('') || '-';
            const methods = (v.methods || []).join(', ') || '-';
            const updatedBy = (v.updatedBy && (v.updatedBy.displayName || v.updatedBy.email)) || (v.createdBy && (v.createdBy.displayName || v.createdBy.email)) || '-';
            const updatedAt = v.updatedAt ? formatVisitDate(v.updatedAt) : '-';
            return `<tr>
                <td><b>${escapeHtml(v.visitName || 'Adsız ziyaret')}</b><br><span class="visit-status ${status.css}">${status.label}</span><br><span class="visit-type-badge ${isIcaoOfficialVisit(v)?'icao':''}">${escapeHtml(isIcaoOfficialVisit(v)?('ICAO '+(ICAO_VISIT_TYPES[v.icaoVisitType]||'Resmî Ziyareti')):(VISIT_TYPES[getVisitType(v)]||VISIT_TYPES.internal))}</span></td>
                <td>${areas}</td>
                <td><b>${escapeHtml(getVisitUnits(v).join(' · ') || '-')}</b><br><span style="color:var(--muted)">${escapeHtml(v.location || '-')}</span></td>
                <td>${formatVisitDateRange(v.plannedStart,v.plannedEnd)}${v.actualStart || v.actualEnd ? `<br><small style="color:var(--ok)">Gerçekleşen: ${formatVisitDateRange(v.actualStart,v.actualEnd)}</small>` : ''}</td>
                <td><b>Katılımcı:</b> ${escapeHtml(shortenVisitText(v.participants,90))}<br><b>Muhatap:</b> ${escapeHtml(shortenVisitText(v.counterparts,90))}</td>
                <td><b>${escapeHtml(shortenVisitText(v.objective,130))}</b><br><span style="color:var(--muted)">${escapeHtml(methods)}</span></td>
                <td>${escapeHtml(updatedBy)}<br><span style="color:var(--muted)">${updatedAt}</span></td>
                <td><div class="visit-actions"><button class="btn-outline" onclick="viewVisitDetail('${v.id}')">👁️ Gör</button><button class="btn-outline" onclick="openVisitScopeForVisit('${v.id}')">🗂️ Kapsam</button>${isIcaoOfficialVisit(v)?`<button class="btn-outline" onclick="openIcaoOfficialVisitValidation('${v.id}')">🌐 ICVM</button>`:''}<button class="btn-outline" onclick="openVisitForm('${v.id}')">✏️ Düzenle</button><button style="background:var(--danger)" onclick="deleteVisitRecord('${v.id}')">🗑️</button></div></td>
            </tr>`;
        }).join('');
    }
    function shortenVisitText(value, max) {
        const text = String(value || '').replace(/\s+/g,' ').trim();
        return !text ? '-' : (text.length > max ? text.slice(0,max-1) + '…' : text);
    }
    function clearVisitFilters() {
        const s=document.getElementById('visitStatusFilter'), a=document.getElementById('visitAreaFilter'), q=document.getElementById('visitSearchInput');
        if(s)s.value='all'; if(a)a.value='all'; if(q)q.value=''; renderVisitModule();
    }
    function openVisitForm(id = null) {
        if (!firebase.auth().currentUser) return alert('Ziyaret kaydı oluşturmak veya düzenlemek için yetkili giriş yapılmalıdır.');
        activeVisitRecordId = id || null;
        const record = id ? (icaoVisits[id] || null) : null;
        document.getElementById('visitForm').reset();
        document.getElementById('visitRecordId').value = id || '';
        document.getElementById('visitFormTitle').textContent = record ? '✏️ Ziyareti Düzenle' : '➕ Yeni Ziyaret';
        populateVisitStaticControls();
        renderVisitAreaCheckboxes(record ? record.areas : []);
        renderVisitUnitCheckboxes(record ? getVisitUnits(record) : []);
        renderVisitMethodCheckboxes(record ? record.methods : ['Doküman incelemesi','Görüşme','Kanıt doğrulama']);
        const set = (field,val) => { const el=document.getElementById(field); if(el) el.value=val || ''; };
        set('visitName',record && record.visitName); set('visitLocation',record && record.location);
        set('visitPlannedStart',record && record.plannedStart); set('visitPlannedEnd',record && record.plannedEnd); set('visitActualStart',record && record.actualStart); set('visitActualEnd',record && record.actualEnd);
        set('visitStatus',(record && record.status) || 'draft'); set('visitParticipants',record && record.participants); set('visitCounterparts',record && record.counterparts);
        set('visitObjective',record && record.objective); set('visitGeneralNotes',record && record.generalNotes);
        set('visitType',record ? getVisitType(record) : 'internal'); set('icaoVisitType',(record && record.icaoVisitType) || 'ICVM'); toggleVisitTypeFields();
        const audit = document.getElementById('visitFormAuditInfo');
        if (audit) audit.textContent = record ? `Oluşturan: ${((record.createdBy||{}).displayName || (record.createdBy||{}).email || '-')} | Oluşturma: ${formatVisitDate(record.createdAt)} | Son güncelleme: ${formatVisitDate(record.updatedAt)}` : `Yeni kayıt, kaydeden kullanıcının kimliği ve zaman damgasıyla Firebase'e yazılacaktır.`;
        document.getElementById('visitFormModal').style.display='block';
    }
    function closeVisitForm() { const m=document.getElementById('visitFormModal'); if(m)m.style.display='none'; activeVisitRecordId=null; }
    async function saveVisitForm(event) {
        if (event) event.preventDefault();
        const user = firebase.auth().currentUser;
        if (!user) return alert('Kayıt için yetkili giriş gereklidir.');
        const areas = Array.from(document.querySelectorAll('input[name="visitAreaChoice"]:checked')).map(i => i.value);
        const methods = Array.from(document.querySelectorAll('input[name="visitMethodChoice"]:checked')).map(i => i.value);
        const units = Array.from(document.querySelectorAll('input[name="visitUnitChoice"]:checked')).map(i => canonicalizeVisitUnit(i.value)).filter(Boolean);
        if (!areas.length) return alert('En az bir denetim alanı seçiniz.');
        const visitType=(document.getElementById('visitType')||{}).value||'internal'; const icaoVisitType=(document.getElementById('icaoVisitType')||{}).value||'';
        if(visitType==='icao_official' && !icaoVisitType) return alert('ICAO resmî ziyaret türünü seçiniz.');
        if (!units.length) return alert('En az bir ziyaret edilecek birim seçiniz.');
        const start = document.getElementById('visitPlannedStart').value, end = document.getElementById('visitPlannedEnd').value;
        if (start && end && end < start) return alert('Planlanan bitiş tarihi başlangıç tarihinden önce olamaz.');
        const actualStart = document.getElementById('visitActualStart').value, actualEnd = document.getElementById('visitActualEnd').value;
        if (actualStart && actualEnd && actualEnd < actualStart) return alert('Gerçekleşen bitiş tarihi başlangıç tarihinden önce olamaz.');
        const id = activeVisitRecordId || db.ref('icao_visits').push().key;
        const existing = activeVisitRecordId ? (icaoVisits[activeVisitRecordId] || {}) : {};
        const actor = getCurrentVisitUser();
        const now = new Date().toISOString();
        const record = {
            visitName:document.getElementById('visitName').value.trim(), visitType, icaoVisitType:visitType==='icao_official'?icaoVisitType:'', areas, units, unit:units.join(' | '), location:document.getElementById('visitLocation').value.trim(),
            plannedStart:start, plannedEnd:end, actualStart, actualEnd, status:document.getElementById('visitStatus').value,
            participants:document.getElementById('visitParticipants').value.trim(), counterparts:document.getElementById('visitCounterparts').value.trim(), objective:document.getElementById('visitObjective').value.trim(), methods,
            generalNotes:document.getElementById('visitGeneralNotes').value.trim(), isDeleted:false,
            createdAt:existing.createdAt || now, createdBy:existing.createdBy || actor, updatedAt:now, updatedBy:actor,
            moduleVersion:'visit-package-1.2-icao-official'
        };
        const button=document.getElementById('visitSaveButton'); if(button){button.disabled=true;button.textContent='Kaydediliyor...';}
        try {
            const updates={};Object.entries(record).forEach(([key,value])=>{updates[`icao_visits/${id}/${key}`]=value;});
            addVisitAuditToUpdates(updates,id,'visit',id,activeVisitRecordId?'update':'create',existing,record,activeVisitRecordId?'Ziyaret üst bilgileri güncellendi.':'Yeni ziyaret kaydı oluşturuldu.',now,actor,{});
            await db.ref().update(updates);
            closeVisitForm();
            alert('Ziyaret kaydı Firebase üzerinde kaydedildi.');
        } catch(error) {
            console.error(error); alert('Ziyaret kaydedilemedi: ' + (error.message || error));
        } finally { if(button){button.disabled=false;button.textContent='💾 Ziyareti Kaydet';} }
    }
    async function deleteVisitRecord(id) {
        const record = icaoVisits[id]; if(!record) return;
        if (!firebase.auth().currentUser) return alert('Bu işlem için yetkili giriş gereklidir.');
        if (!confirm(`“${record.visitName || 'Ziyaret'}” kaydını kaldırmak istediğinize emin misiniz? Kayıt fiziksel olarak silinmeyecek, silindi olarak işaretlenecektir.`)) return;
        const actor=getCurrentVisitUser(), now=new Date().toISOString();
        try { const after={...record,isDeleted:true,deletedAt:now,deletedBy:actor,updatedAt:now,updatedBy:actor};const updates={};['isDeleted','deletedAt','deletedBy','updatedAt','updatedBy'].forEach(k=>updates[`icao_visits/${id}/${k}`]=after[k]);addVisitAuditToUpdates(updates,id,'visit',id,'delete',record,after,'Ziyaret kaydı silinmiş olarak işaretlendi.',now,actor,{});await db.ref().update(updates); }
        catch(error){console.error(error);alert('Ziyaret kaydı kaldırılamadı: '+(error.message||error));}
    }
    function viewVisitDetail(id) {
        const v=icaoVisits[id]; if(!v)return;
        const status=VISIT_STATUSES[v.status]||VISIT_STATUSES.draft;
        const item=(label,value,full=false)=>`<div class="visit-detail-item ${full?'full':''}"><b>${label}</b><div>${escapeHtml(value || '-')}</div></div>`;
        document.getElementById('visitDetailBody').innerHTML = `<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:12px"><div><h3 style="margin:0;color:var(--text)">${escapeHtml(v.visitName||'Adsız ziyaret')}</h3><div style="margin-top:5px"><span class="visit-status ${status.css}">${status.label}</span></div></div><button onclick="closeVisitDetail();openVisitForm('${id}')">✏️ Düzenle</button></div><div class="visit-detail-grid">${item('Ziyaret türü',isIcaoOfficialVisit(v)?('ICAO '+(ICAO_VISIT_TYPES[v.icaoVisitType]||'Resmî Ziyareti')):(VISIT_TYPES[getVisitType(v)]||VISIT_TYPES.internal))}${item('Denetim alanları',(v.areas||[]).join(', '))}${item('Birimler',getVisitUnits(v).join('\n'))}${item('Ziyaret yeri',v.location)}${item('Planlanan tarihler',formatVisitDateRange(v.plannedStart,v.plannedEnd))}${item('Gerçekleşen tarihler',formatVisitDateRange(v.actualStart,v.actualEnd))}${item('Ziyaret yöntemi',(v.methods||[]).join(', '))}${item('Katılan personel',v.participants,true)}${item('Birim muhatapları',v.counterparts,true)}${item('Ziyaretin amacı',v.objective,true)}${item('Genel açıklama / planlama notu',v.generalNotes,true)}${item('Oluşturan',((v.createdBy||{}).displayName||(v.createdBy||{}).email||'-')+' | '+formatVisitDate(v.createdAt),true)}${item('Son güncelleyen',((v.updatedBy||{}).displayName||(v.updatedBy||{}).email||'-')+' | '+formatVisitDate(v.updatedAt),true)}</div><div class="visit-sync-note" style="margin-top:12px">PQ/CAP kapsamı, hazırlık soruları ve saha notları sonraki paketlerde bu ziyaret kimliğine bağlanacaktır.</div>`;
        document.getElementById('visitDetailModal').style.display='block';
    }
    function closeVisitDetail(){const m=document.getElementById('visitDetailModal');if(m)m.style.display='none';}


    // ICAO RESMİ ZİYARETİ / ICVM - PQ/CAP MERKEZLİ VALIDASYON
    function getIcaoOfficialVisits(){return getVisitRecords().filter(v=>isIcaoOfficialVisit(v)).sort((a,b)=>(visitSafeDate(a.plannedStart)?.getTime()||0)-(visitSafeDate(b.plannedStart)?.getTime()||0));}
    function getIcaoValidationRecords(visit){const obj=((((visit||{}).icaoValidation||{}).records)||{});return Object.entries(obj).map(([id,v])=>({id,...(v||{})})).filter(r=>!r.isDeleted);}
    function icaoValidationKey(pq){return String(pq||'').replace(/\./g,'_DOT_').replace(/[#$\[\]\/]/g,'_');}
    function getIcaoVisitScopePqs(visit){
        return getVisitScopeStoredPqs(visit).filter(p=>{
            const pq=String((p||{}).pq||''); const master=pqMasterData[pq]||{};
            if(!pq || master.isIcaoClosed) return false;
            const hasCurrent=(rawData||[]).some(r=>r&&String(r.pq||'')===pq&&isUsableCapStep(r));
            const hasStored=getVisitScopeStoredSteps(visit).some(s=>s&&String(s.pq||'')===pq);
            return (rawData||[]).length ? hasCurrent : (hasCurrent||hasStored);
        }).sort((a,b)=>sortPQs(String(a.pq||''),String(b.pq||'')));
    }
    function getIcaoValidationForPq(visit,pq){return getIcaoValidationRecords(visit).find(r=>String(r.pq)===String(pq))||null;}
    function getIcaoVisitPqSteps(visit,pq){
        let current=[];
        // Mümkünse sadece en güncel Word/CAP kaynağını kullan; eski rapordaki kaldırılmış Step/kanıtlar taşınmasın.
        if(typeof window.buildVisitCurrentSourceCandidates==='function'){
            const candidate=window.buildVisitCurrentSourceCandidates(visit,((visit||{}).scope||{}).projectionDate||null).find(x=>String(x.pq)===String(pq));
            if(candidate) current=(candidate.actionItems||[]).filter(isUsableCapStep).map(r=>({step:r.step||'',action:r.action||'',office:r.office||'',evidenceReference:r.evidenceReference||'',estDate:r.estDate||'',progress:r.progress||'',statusLabel:r.statusLabel||(getStatus(r)||{}).label||''}));
        }
        if(!current.length) current=(rawData||[]).filter(r=>String(r.pq)===String(pq)&&isUsableCapStep(r)).map(r=>({step:r.step||'',action:r.action||'',office:r.office||'',evidenceReference:r.evidenceReference||'',estDate:r.estDate||'',progress:r.progress||'',statusLabel:(getStatus(r)||{}).label||''}));
        if(current.length)return current.sort((a,b)=>compareVisitPdfNumberValues(a.step,b.step));
        return getVisitScopeStoredSteps(visit).filter(s=>String(s.pq)===String(pq)).map(s=>({...s,evidenceReference:s.evidenceReference||''})).sort((a,b)=>compareVisitPdfNumberValues(a.step,b.step));
    }
    function normalizeIcaoEvidenceReference(value){return String(value||'').replace(/\s+/g,' ').trim();}
    function getIcaoVisitPqEvidenceBundle(visit,pq){
        const groups=new Map();
        getIcaoVisitPqSteps(visit,pq).forEach(step=>{
            const ref=normalizeIcaoEvidenceReference(step.evidenceReference);
            if(!ref)return;
            const key=ref.toLocaleLowerCase('tr');
            if(!groups.has(key))groups.set(key,{ref,steps:[]});
            const stepNo=String(step.step||'').trim();
            if(stepNo&&!groups.get(key).steps.includes(stepNo))groups.get(key).steps.push(stepNo);
        });
        const rows=Array.from(groups.values()).map(item=>({ref:item.ref,steps:item.steps.sort(compareVisitPdfNumberValues)}));
        const text=rows.map(item=>`${item.steps.length?('Step '+item.steps.join(', ')+': '):''}${item.ref}`).join('\n');
        return {rows,text,referenceCount:rows.length,stepCount:new Set(rows.flatMap(r=>r.steps)).size};
    }
    function getIcaoOfficialBaselineModel(){
        // ICVM başlangıç noktası 2024 CMAA değil, sisteme yüklenmiş son ICAO validasyonları sonrası resmî durumdur.
        // buildEIProjectionModel(), AFTER VALIDASYON değeri varsa onu; yoksa ICAO KAPATTI MI=EVET olan PQ'ları
        // 2024 base satisfactory sayısına ekleyerek aynı sonucu üretir. Böylece Excel formül cache'ine bağımlılık kalkar.
        try{return buildEIProjectionModel(rawData||[]);}catch(err){console.warn('ICVM resmî baseline modeli oluşturulamadı:',err);return null;}
    }
    function getIcaoOfficialBaselineSat(area,baselineModel=null){
        const key=normalizeAreaKey(area),model=baselineModel||getIcaoOfficialBaselineModel();
        const bucket=model&&model.areas?model.areas[key]:null;
        if(bucket)return getBucketAfterValidationSat(bucket);
        const b=baseEIData[key]||{};
        const after=getBaseAfterValidationSat(b);
        if(after!==null)return after;
        // Son güvenlik: resmen ICAO tarafından kapatılmış PQ sayısını base satisfactory üzerine ekle.
        const closedCount=Object.values(pqMasterData||{}).filter(m=>m&&m.isIcaoClosed&&normalizeAreaKey(m.alan)===key).length;
        return Math.min(Number(b.total||Infinity),Number(b.sat||0)+closedCount);
    }
    function getIcaoOfficialVisitImpactModel(visit,scopeOverride=null){
        const scopePqs=Array.isArray(scopeOverride)?scopeOverride:getIcaoVisitScopePqs(visit), records=getIcaoValidationRecords(visit);
        const recordMap=new Map(records.map(r=>[String(r.pq),r]));
        const baselineModel=getIcaoOfficialBaselineModel();
        const areas={}; let total=0,baseline=0,validatedNew=0;
        Object.keys(baseEIData||{}).forEach(a=>{
            const area=normalizeAreaKey(a),b=baseEIData[a]||{},bucket=baselineModel&&baselineModel.areas?baselineModel.areas[area]:null;
            const t=Number((bucket&&bucket.total)||b.total||0),sat=getIcaoOfficialBaselineSat(area,baselineModel);
            areas[area]={area,total:t,baselineSat:sat,validatedNew:0};total+=t;baseline+=sat;
        });
        scopePqs.forEach(p=>{const pq=String(p.pq||''),area=normalizeAreaKey(p.area||(pqMasterData[pq]||{}).alan),m=pqMasterData[pq]||{},r=recordMap.get(pq);if(!area||!areas[area]||m.isIcaoClosed)return;if(r&&r.status==='validated'){areas[area].validatedNew++;validatedNew++;}});
        Object.values(areas).forEach(a=>{a.newSat=Math.min(a.total,a.baselineSat+a.validatedNew);a.baselinePct=ratioPct(a.baselineSat,a.total);a.newPct=ratioPct(a.newSat,a.total);a.delta=a.newPct-a.baselinePct;});
        const newSat=Math.min(total,baseline+validatedNew);
        return {scopePqs,records,areas,total,baselineSat:baseline,validatedNew,newSat,baselinePct:ratioPct(baseline,total),newPct:ratioPct(newSat,total),delta:ratioPct(newSat,total)-ratioPct(baseline,total),baselineSource:'ICAO validasyonları sonrası resmî durum'};
    }
    function getSelectedIcaoVisitAreaFilter(){
        const el=document.getElementById('icaoVisitAreaFilter');
        const value=normalizeAreaKey((el&&el.value)||'');
        return !value||String((el&&el.value)||'').toLowerCase()==='all'?'all':value;
    }
    function getIcaoVisitAreaScopedPqs(visit,areaFilter=null){
        const scope=getIcaoVisitScopePqs(visit);
        const selected=areaFilter||getSelectedIcaoVisitAreaFilter();
        if(!selected||selected==='all')return scope;
        return scope.filter(p=>{
            const pq=String(p.pq||''),m=pqMasterData[pq]||{};
            return normalizeAreaKey(p.area||m.alan||'')===selected;
        });
    }
    function getIcaoVisitAvailableAreas(visit){
        const set=new Set();
        visitArrayValue((visit||{}).areas).map(normalizeAreaKey).filter(Boolean).forEach(a=>set.add(a));
        getIcaoVisitScopePqs(visit).forEach(p=>{const pq=String(p.pq||''),m=pqMasterData[pq]||{},a=normalizeAreaKey(p.area||m.alan||'');if(a)set.add(a);});
        return Array.from(set).sort(sortAreas);
    }
    function populateIcaoVisitAreaFilter(visit,preserve=true){
        const el=document.getElementById('icaoVisitAreaFilter');if(!el)return;
        const previous=preserve?getSelectedIcaoVisitAreaFilter():'all';
        const areas=visit?getIcaoVisitAvailableAreas(visit):[];
        el.innerHTML='<option value="all">Tüm alanlar</option>'+areas.map(a=>`<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`).join('');
        el.value=previous!=='all'&&areas.includes(previous)?previous:'all';
    }
    function handleIcaoVisitAreaFilterChange(){
        const visit=getActiveIcaoOfficialVisitRecord();
        if(visit&&activeIcaoValidationPq){
            const visibleInArea=getIcaoVisitAreaScopedPqs(visit).some(p=>String(p.pq||'')===String(activeIcaoValidationPq));
            if(!visibleInArea){activeIcaoValidationPq=null;resetIcaoValidationForm();}
        }
        renderIcaoOfficialVisitPqList();
        renderIcaoOfficialVisitEiSummary();
    }
    function icaoOfficialVisitAreaLabel(){
        const selected=getSelectedIcaoVisitAreaFilter();
        return selected==='all'?'Tüm alanlar':selected;
    }
    function icaoOfficialVisitAreaFileSuffix(){
        const selected=getSelectedIcaoVisitAreaFilter();
        return selected==='all'?'':('_'+selected.replace(/[^A-Za-z0-9_-]+/g,'_'));
    }
    function populateIcaoValidationStatus(){const s=document.getElementById('icaoValidationStatus');if(!s)return;const cur=s.value;s.innerHTML=Object.entries(ICAO_VALIDATION_STATUSES).map(([k,v])=>`<option value="${k}">${escapeHtml(v)}</option>`).join('');if(cur&&Array.from(s.options).some(o=>o.value===cur))s.value=cur;}
    const ICAO_PQ_TEXT_LANGUAGE_KEY='icao_pq_text_language';
    function getIcaoPqTextLanguage(){
        const el=document.getElementById('icaoVisitTextLanguage');
        return (el&&el.value)||localStorage.getItem(ICAO_PQ_TEXT_LANGUAGE_KEY)||'both';
    }
    function updateIcaoPqLanguageButtons(mode){
        document.querySelectorAll('#icaoVisitLanguageToggle [data-lang]').forEach(btn=>{
            const active=btn.getAttribute('data-lang')===mode;
            btn.classList.toggle('active',active);
            btn.setAttribute('aria-pressed',active?'true':'false');
        });
    }
    function initializeIcaoPqTextLanguage(){
        const el=document.getElementById('icaoVisitTextLanguage');if(!el)return;
        const saved=localStorage.getItem(ICAO_PQ_TEXT_LANGUAGE_KEY)||'both';
        const mode=Array.from(el.options).some(o=>o.value===saved)?saved:'both';
        el.value=mode;
        updateIcaoPqLanguageButtons(mode);
    }
    function renderActiveIcaoPqTextSummary(){
        if(!activeIcaoValidationPq)return;
        const visit=getActiveIcaoOfficialVisitRecord();if(!visit)return;
        const pq=String(activeIcaoValidationPq);
        const scope=getIcaoVisitScopePqs(visit).find(p=>String(p.pq)===pq);if(!scope)return;
        const m=pqMasterData[pq]||{},summary=document.getElementById('icaoValidationSummary');if(!summary)return;
        const mode=getIcaoPqTextLanguage();
        summary.innerHTML=`<div style="display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:7px"><b>PQ ${escapeHtml(pq)} — ${escapeHtml(scope.area||m.alan||'-')}</b><span style="font-size:9px;color:var(--muted)">${mode==='both'?'ENG + TR':mode.toUpperCase()}</span></div>${buildIcaoPqTextSummaryHtml(pq,scope)}<div style="color:var(--muted);margin-top:7px">Mevcut CAP adımları aşağıda yalnızca bilgi amaçlı gösterilir. Validasyon sonucu PQ/CAP seviyesinde kaydedilir.</div>`;
    }
    function setIcaoPqTextLanguage(mode){
        if(!['en','tr','both'].includes(mode))mode='both';
        const el=document.getElementById('icaoVisitTextLanguage');if(el)el.value=mode;
        localStorage.setItem(ICAO_PQ_TEXT_LANGUAGE_KEY,mode);
        updateIcaoPqLanguageButtons(mode);
        renderActiveIcaoPqTextSummary();
        showAppRuntimeToast(`PQ metin dili: ${mode==='both'?'ENG + TR':mode.toUpperCase()}`,'info');
    }
    function handleIcaoVisitLanguageChange(){
        setIcaoPqTextLanguage(getIcaoPqTextLanguage());
    }
    window.runPqTranslationImportSelfCheck=function(pq){
        const key=normalizePQ(pq||activeIcaoValidationPq||'');
        const m=key?(pqMasterData[key]||{}):{};
        const result={latestImport:window.lastPqTranslationImportDiagnostic||null,pq:key||null,questionTr:String(m.soruTr||''),findingTr:String(m.bulguTr||''),questionEn:String(m.soru||''),findingEn:String(m.bulgu||''),masterCount:Object.keys(pqMasterData||{}).length,trQuestionCount:Object.values(pqMasterData||{}).filter(x=>String((x||{}).soruTr||'').trim()).length,trFindingCount:Object.values(pqMasterData||{}).filter(x=>String((x||{}).bulguTr||'').trim()).length};console.log('PQ TR import kontrolü:',result);return result;};
    function getIcaoPqBilingualTexts(pq,scope={}){
        const m=pqMasterData[pq]||{};
        const masterQuestionTr=String(m.soruTr||'').trim(), masterFindingTr=String(m.bulguTr||'').trim();
        return {
            questionEn:String(m.soru||scope.question||'').trim(),
            questionTr:masterQuestionTr || String(scope.questionTr||'').trim(),
            findingEn:String(m.bulgu||scope.finding||'').trim(),
            findingTr:masterFindingTr || String(scope.findingTr||'').trim()
        };
    }
    function buildIcaoPqTextSummaryHtml(pq,scope={}){
        const t=getIcaoPqBilingualTexts(pq,scope),mode=getIcaoPqTextLanguage(),blocks=[];
        const add=(label,body,missing=false)=>blocks.push(`<div class="icao-pq-text-block"><div class="icao-pq-text-label">${escapeHtml(label)}${missing?'<span class="icao-pq-text-missing">TR çeviri yok · ENG gösteriliyor</span>':''}</div><div class="icao-pq-text-body">${escapeHtml(body||'-')}</div></div>`);
        if(mode==='en'||mode==='both'){
            add('PQ Question (ENG)',t.questionEn||'-');
            add('Finding (ENG)',t.findingEn||'-');
        }
        if(mode==='tr'||mode==='both'){
            add('PQ Sorusu (TR)',t.questionTr||t.questionEn||'-',!t.questionTr&&!!t.questionEn);
            add('Bulgu (TR)',t.findingTr||t.findingEn||'-',!t.findingTr&&!!t.findingEn);
        }
        return blocks.join('');
    }
    function updateIcaoTranslationStatus(visit){
        const el=document.getElementById('icaoVisitTranslationStatus');if(!el)return;
        if(!visit){el.textContent='Türkçe PQ metinleri Excel master yüklendiğinde burada kontrol edilir.';return;}
        const pqs=getIcaoVisitAreaScopedPqs(visit);let qOk=0,fOk=0,both=0;
        pqs.forEach(p=>{const m=pqMasterData[String(p.pq||'')]||{},q=String(m.soruTr||p.questionTr||'').trim(),f=String(m.bulguTr||p.findingTr||'').trim();if(q)qOk++;if(f)fOk++;if(q&&f)both++;});
        const total=pqs.length,pct=total?((both/total)*100).toFixed(1).replace('.',','):'0,0';
        el.innerHTML=`TR çeviri durumu: <span class="${both===total&&total?'ok':'warn'}">${both}/${total} PQ tam (%${pct})</span> · PQ Sorusu (TR): ${qOk}/${total} · Bulgu (TR): ${fOk}/${total}`;
    }
    function renderIcaoOfficialVisitModule(preserveSelection=false){
        const select=document.getElementById('icaoOfficialVisitSelect');if(!select)return;
        const visits=getIcaoOfficialVisits(),current=preserveSelection?(activeIcaoOfficialVisitId||select.value):select.value;
        select.innerHTML='<option value="">Bir ICAO resmî ziyareti seçiniz...</option>'+visits.map(v=>`<option value="${escapeHtml(v.id)}">${escapeHtml((ICAO_VISIT_TYPES[v.icaoVisitType]||'ICAO')+' — '+(v.visitName||'Adsız ziyaret')+' — '+formatVisitDateRange(v.plannedStart,v.plannedEnd))}</option>`).join('');
        if(current&&visits.some(v=>v.id===current)){select.value=current;activeIcaoOfficialVisitId=current;}else if(!activeIcaoOfficialVisitId&&visits.length===1){select.value=visits[0].id;activeIcaoOfficialVisitId=visits[0].id;}
        populateIcaoValidationStatus();initializeIcaoPqTextLanguage();
        const activeVisit=activeIcaoOfficialVisitId&&icaoVisits[activeIcaoOfficialVisitId]?{id:activeIcaoOfficialVisitId,...icaoVisits[activeIcaoOfficialVisitId]}:null;
        populateIcaoVisitAreaFilter(activeVisit,true);updateIcaoTranslationStatus(activeVisit);renderIcaoOfficialVisitPqList();renderIcaoOfficialVisitEiSummary();
    }
    function loadIcaoOfficialVisit(id){activeIcaoOfficialVisitId=id||null;activeIcaoValidationPq=null;const visit=getActiveIcaoOfficialVisitRecord();initializeIcaoPqTextLanguage();populateIcaoVisitAreaFilter(visit,false);updateIcaoTranslationStatus(visit);renderIcaoOfficialVisitPqList();renderIcaoOfficialVisitEiSummary();resetIcaoValidationForm();}
    function openIcaoOfficialVisitValidation(id){activeIcaoOfficialVisitId=id;switchTab('icao-visit-validation');const s=document.getElementById('icaoOfficialVisitSelect');if(s)s.value=id;renderIcaoOfficialVisitModule(true);}
    function openIcaoOfficialVisitForm(){openVisitForm();const t=document.getElementById('visitType'),sub=document.getElementById('icaoVisitType');if(t)t.value='icao_official';if(sub)sub.value='ICVM';toggleVisitTypeFields();}
    function openSelectedIcaoVisitScope(){if(!activeIcaoOfficialVisitId)return alert('Önce bir ICAO resmî ziyareti seçiniz.');openVisitScopeForVisit(activeIcaoOfficialVisitId);}
    function getVisibleIcaoOfficialVisitPqs(visit){
        if(!visit) return [];
        const scope=getIcaoVisitAreaScopedPqs(visit),records=getIcaoValidationRecords(visit),map=new Map(records.map(r=>[String(r.pq),r]));
        const q=((document.getElementById('icaoVisitSearch')||{}).value||'').trim().toLocaleLowerCase('tr-TR');
        const sf=(document.getElementById('icaoVisitStatusFilter')||{}).value||'all';
        return scope.filter(p=>{
            const pq=String(p.pq||''),m=pqMasterData[pq]||{},r=map.get(pq),st=(r&&r.status)||'not_evaluated';
            if(sf!=='all'&&st!==sf)return false;
            if(!q)return true;
            return [pq,p.area,m.alan,p.ce,m.ce,p.verificationType,m.tur,m.bulgu,m.bulguTr,m.soru,m.soruTr,p.finding,p.findingTr,p.question,p.questionTr].join(' ').toLocaleLowerCase('tr-TR').includes(q);
        });
    }

    function renderIcaoOfficialVisitPqList(){
        const list=document.getElementById('icaoOfficialVisitPqList'),note=document.getElementById('icaoOfficialVisitNote');if(!list)return;
        const visit=activeIcaoOfficialVisitId&&icaoVisits[activeIcaoOfficialVisitId]?{id:activeIcaoOfficialVisitId,...icaoVisits[activeIcaoOfficialVisitId]}:null;
        if(!visit){list.innerHTML='<div class="icao-visit-empty">ICAO resmî ziyaret kaydı seçiniz.</div>';if(note)note.textContent='ICAO resmî ziyaret kaydı seçiniz.';updateIcaoTranslationStatus(null);updateIcaoVisitKpis(null);return;}
        const totalScope=getIcaoVisitScopePqs(visit),scope=getIcaoVisitAreaScopedPqs(visit),records=getIcaoValidationRecords(visit),map=new Map(records.map(r=>[String(r.pq),r]));
        const rows=getVisibleIcaoOfficialVisitPqs(visit),areaLabel=icaoOfficialVisitAreaLabel();updateIcaoTranslationStatus(visit);
        const c=document.getElementById('icaoVisitListCount');if(c)c.textContent=`${rows.length} / ${scope.length} PQ${areaLabel!=='Tüm alanlar'?` · ${areaLabel}`:''}`;
        if(note)note.textContent=`${visit.visitName||'ICAO ziyareti'} | Tür: ${ICAO_VISIT_TYPES[visit.icaoVisitType]||visit.icaoVisitType||'ICAO'} | Ziyaret alanları: ${visitArrayValue(visit.areas).join(', ')||'-'} | Alan filtresi: ${areaLabel} | Filtre kapsamı: ${scope.length} / toplam ${totalScope.length} açık CAP/PQ. Daha önce ICAO tarafından kapatılmış veya güncel CAP kaydı bulunmayan PQ'lar validasyon listesine alınmaz.`;
        list.innerHTML=rows.length?rows.map(p=>{const pq=String(p.pq||''),m=pqMasterData[pq]||{},r=map.get(pq)||{},st=r.status||'not_evaluated',area=normalizeAreaKey(p.area||m.alan||'')||'-',ce=String(p.ce||m.ce||'-').trim()||'-',verification=String(p.verificationType||m.tur||'-').trim()||'-';return `<button type="button" class="icao-visit-pq ${st} ${activeIcaoValidationPq===pq?'active':''}" onclick="selectIcaoValidationPq('${escapeHtml(pq)}')"><div class="icao-visit-pq-title-row"><div class="icao-visit-pq-title">PQ ${escapeHtml(pq)}</div><span class="icao-visit-status-badge ${st}">${escapeHtml(ICAO_VALIDATION_STATUSES[st]||st)}</span></div><div class="icao-visit-pq-tags"><span class="icao-visit-meta-chip">${escapeHtml(area)}</span><span class="icao-visit-meta-chip">CE: ${escapeHtml(ce)}</span><span class="icao-visit-meta-chip">${escapeHtml(verification)}</span></div></button>`;}).join(''):'<div class="icao-visit-empty">Seçili ölçütlere uygun PQ bulunamadı. Ziyaret kapsamının “Kapsam ve Hazırlık” ekranında kaydedildiğini kontrol ediniz.</div>';
        updateIcaoVisitKpis(visit);
    }
    function updateIcaoVisitKpis(visit){const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v};if(!visit){['icaoVisitKpiPq','icaoVisitKpiValidated','icaoVisitKpiOpen','icaoVisitKpiEvidence'].forEach(id=>set(id,0));set('icaoVisitKpiEi','+0');return;}const scoped=getIcaoVisitAreaScopedPqs(visit),m=getIcaoOfficialVisitImpactModel(visit,scoped),map=new Map(m.records.map(r=>[String(r.pq),r]));let open=0,evidence=0;m.scopePqs.forEach(p=>{const st=(map.get(String(p.pq))||{}).status||'not_evaluated';if(st==='open')open++;if(st==='additional_evidence'||st==='post_visit')evidence++;});set('icaoVisitKpiPq',m.scopePqs.length);set('icaoVisitKpiValidated',m.validatedNew);set('icaoVisitKpiOpen',open);set('icaoVisitKpiEvidence',evidence);set('icaoVisitKpiEi','+'+m.validatedNew);}

    const ICAO_VALIDATION_TEXTAREA_IDS=['icaoValidationEvidence','icaoValidationComment','icaoValidationAdditionalRequest','icaoValidationNotes'];
    let icaoValidationDraftTimer=null;
    function icaoValidationDraftKey(){
        const pq=(document.getElementById('icaoValidationPq')||{}).value||activeIcaoValidationPq||'';
        if(!activeIcaoOfficialVisitId||!pq)return '';
        return `icao_validation_draft_${activeIcaoOfficialVisitId}_${String(pq).replace(/[^A-Za-z0-9_.-]/g,'_')}`;
    }
    function updateIcaoValidationDraftInfo(message,state=''){
        const el=document.getElementById('icaoValidationDraftInfo');if(!el)return;
        el.textContent=message||'Metin alanlarındaki değişiklikler tarayıcıda taslak olarak korunur.';
        el.className='icvm-draft-info'+(state?' '+state:'');
    }
    function autoSizeIcaoValidationTextarea(el){
        if(!el)return;el.style.height='auto';el.style.height=Math.min(Math.max(el.scrollHeight,96),360)+'px';
    }
    function updateIcaoValidationTextCounter(id){
        const el=document.getElementById(id),count=document.getElementById(id+'Count');if(count)count.textContent=`${(el&&el.value?el.value.length:0)} karakter`;
    }
    function refreshIcaoValidationTextareas(){
        ICAO_VALIDATION_TEXTAREA_IDS.forEach(id=>{const el=document.getElementById(id);if(el){autoSizeIcaoValidationTextarea(el);updateIcaoValidationTextCounter(id);}});
    }
    function saveIcaoValidationTextDraft(){
        const key=icaoValidationDraftKey();if(!key)return;
        const values={};ICAO_VALIDATION_TEXTAREA_IDS.forEach(id=>{const el=document.getElementById(id);values[id]=el?el.value:'';});
        try{localStorage.setItem(key,JSON.stringify({savedAt:new Date().toISOString(),values}));updateIcaoValidationDraftInfo('Taslak otomatik kaydedildi.','saved');}catch(e){console.warn('ICVM taslak kaydı yapılamadı',e);}
    }
    function handleIcaoValidationTextInput(el){
        if(!el)return;autoSizeIcaoValidationTextarea(el);updateIcaoValidationTextCounter(el.id);updateIcaoValidationDraftInfo('Kaydedilmemiş değişiklik var…');
        clearTimeout(icaoValidationDraftTimer);icaoValidationDraftTimer=setTimeout(saveIcaoValidationTextDraft,350);
    }
    function getIcaoValidationTextDraft(){
        const key=icaoValidationDraftKey();if(!key)return null;try{return JSON.parse(localStorage.getItem(key)||'null');}catch(e){return null;}
    }
    function clearIcaoValidationTextDraft(){
        const key=icaoValidationDraftKey();if(!key)return;try{localStorage.removeItem(key);}catch(e){}
        updateIcaoValidationDraftInfo('Firebase kaydı doğrulandı; yerel taslak temizlendi.','saved');
    }
    function restoreIcaoValidationTextDraft(record){
        const draft=getIcaoValidationTextDraft();if(!draft||!draft.values)return false;
        const draftTime=Date.parse(draft.savedAt||'')||0,serverTime=Date.parse((record||{}).updatedAt||'')||0;
        if(draftTime<=serverTime)return false;
        let changed=false;ICAO_VALIDATION_TEXTAREA_IDS.forEach(id=>{const el=document.getElementById(id);if(!el)return;const v=draft.values[id];if(typeof v==='string'&&v!==el.value){el.value=v;changed=true;}});
        if(changed)updateIcaoValidationDraftInfo('Bu PQ için kaydedilmemiş yerel taslak geri yüklendi.','restored');
        return changed;
    }
    function insertAtTextareaCursor(el,text){
        if(!el)return;const start=Number.isFinite(el.selectionStart)?el.selectionStart:el.value.length,end=Number.isFinite(el.selectionEnd)?el.selectionEnd:start;el.value=el.value.slice(0,start)+text+el.value.slice(end);const pos=start+text.length;try{el.setSelectionRange(pos,pos);}catch(e){}el.focus();handleIcaoValidationTextInput(el);
    }
    async function icaoValidationTextAction(id,action){
        const el=document.getElementById(id);if(!el)return;
        if(action==='timestamp'){
            const stamp=new Intl.DateTimeFormat('tr-TR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date());
            const prefix=el.value&&el.selectionStart===el.value.length&&!el.value.endsWith('\n')?'\n':'';insertAtTextareaCursor(el,`${prefix}[${stamp}] `);return;
        }
        if(action==='copy'){
            if(!el.value)return showAppRuntimeToast('Kopyalanacak metin bulunmuyor.','info');
            try{if(navigator.clipboard&&navigator.clipboard.writeText)await navigator.clipboard.writeText(el.value);else{el.select();document.execCommand('copy');}showAppRuntimeToast('Metin panoya kopyalandı.','success');}catch(e){showAppRuntimeToast('Metin kopyalanamadı.','error');}return;
        }
        if(action==='expand'){
            const wrap=el.closest('.icvm-textarea-wrap');if(wrap)wrap.classList.toggle('expanded');autoSizeIcaoValidationTextarea(el);el.focus();return;
        }
        if(action==='clear'){
            if(el.value&&!confirm('Bu metin alanını temizlemek istediğinize emin misiniz?'))return;el.value='';handleIcaoValidationTextInput(el);el.focus();
        }
    }
    window.handleIcaoValidationTextInput=handleIcaoValidationTextInput;
    window.icaoValidationTextAction=icaoValidationTextAction;

    function selectIcaoValidationPq(pq){
        const visit=activeIcaoOfficialVisitId&&icaoVisits[activeIcaoOfficialVisitId]?{id:activeIcaoOfficialVisitId,...icaoVisits[activeIcaoOfficialVisitId]}:null;if(!visit)return;
        if(activeIcaoValidationPq&&String(activeIcaoValidationPq)!==String(pq)&&icaoValidationDraftTimer){clearTimeout(icaoValidationDraftTimer);icaoValidationDraftTimer=null;saveIcaoValidationTextDraft();}
        activeIcaoValidationPq=String(pq);const scope=getIcaoVisitScopePqs(visit).find(p=>String(p.pq)===String(pq));if(!scope)return;renderIcaoPqReferencePanel();
        const m=pqMasterData[pq]||{},r=getIcaoValidationForPq(visit,pq)||{};document.getElementById('icaoValidationEmpty').style.display='none';document.getElementById('icaoValidationForm').style.display='block';document.getElementById('icaoValidationPq').value=pq;populateIcaoValidationStatus();
        const set=(id,v)=>{const e=document.getElementById(id);if(e)e.value=v||''};
        let evidenceValue=r.evidence||'';
        // Eski sürümde otomatik doldurulan değer, kayıtlı otomatik snapshot ile aynıysa artık boş gösterilir.
        // Kullanıcının manuel olarak değiştirdiği kanıt metni korunur.
        if(r.evidenceAutoSnapshot&&normalizeIcaoEvidenceReference(evidenceValue)===normalizeIcaoEvidenceReference(r.evidenceAutoSnapshot)) evidenceValue='';
        set('icaoValidationStatus',r.status||'not_evaluated');set('icaoValidationResultDate',r.resultDate);set('icaoValidationEvidence',evidenceValue);set('icaoValidationComment',r.icaoComment);set('icaoValidationAdditionalRequest',r.additionalRequest);set('icaoValidationResponsibleUnit',r.responsibleUnit);set('icaoValidationFollowUpDate',r.followUpDate);set('icaoValidationNotes',r.notes);
        updateIcaoValidationDraftInfo('Metin alanlarındaki değişiklikler tarayıcıda taslak olarak korunur.');restoreIcaoValidationTextDraft(r);refreshIcaoValidationTextareas();
        const evidenceInfo=document.getElementById('icaoValidationEvidenceAutoInfo');if(evidenceInfo)evidenceInfo.textContent='Step bazlı EVIDENCE REFERENCE bilgileri aşağıdaki salt okunur CAP Step bölümünde gösterilir. Bu alan otomatik doldurulmaz.';
        renderActiveIcaoPqTextSummary();
        const steps=getIcaoVisitPqSteps(visit,pq),stepEl=document.getElementById('icaoValidationSteps');if(stepEl)stepEl.innerHTML=steps.length?steps.map(s=>`<div class="icao-valid-step"><b>Step ${escapeHtml(s.step||'-')}</b> — ${escapeHtml(s.action||s.capText||s.description||'-')}<br><span style="color:var(--muted)">${escapeHtml(s.office||'-')} | ${escapeHtml(s.estDate||'-')} | ${escapeHtml(s.statusLabel||s.progress||'')}</span>${s.evidenceReference?`<br><span style="color:var(--text)"><b>📎 EVIDENCE REFERENCE:</b> ${escapeHtml(s.evidenceReference)}</span>`:''}</div>`).join(''):'<div class="icao-valid-step">Bu PQ için gösterilecek CAP Step kaydı bulunamadı.</div>';
        renderIcaoValidationImpactForPq(visit,pq);renderIcaoOfficialVisitPqList();
    }
    function renderIcaoValidationImpactForPq(visit,pq){const el=document.getElementById('icaoValidationEiImpact');if(!el)return;const m=pqMasterData[pq]||{},area=normalizeAreaKey(m.alan),base=baseEIData[area]||{},baselineModel=getIcaoOfficialBaselineModel(),bucket=baselineModel&&baselineModel.areas?baselineModel.areas[area]:null,total=Number((bucket&&bucket.total)||base.total||0),sat=getIcaoOfficialBaselineSat(area,baselineModel),r=getIcaoValidationForPq(visit,pq),eligible=!m.isIcaoClosed&&r&&r.status==='validated';const before=ratioPct(sat,total),after=ratioPct(Math.min(total,sat+(eligible?1:0)),total);el.innerHTML=`<b>EI etkisi</b><br>Mevcut resmî ${escapeHtml(area||'-')} EI <span style="font-size:9px;color:var(--muted)">(ICAO validasyonları sonrası)</span>: <b>${formatOfficialEiPct(before)}</b>${eligible?` → bu PQ ICVM'de kapatıldığı için geçici hesapta <b>${formatOfficialEiPct(after)}</b> <span class="icao-ei-positive">(${formatOfficialEiDelta(after-before)})</span>`:' · Bu PQ henüz EI artışına dahil edilmez.'}${m.isIcaoClosed?'<br><span style="color:var(--danger)">Bu PQ daha önce ICAO tarafından kapatılmıştır; yeniden EI etkisi oluşturamaz.</span>':''}`;}
    function resetIcaoValidationForm(){activeIcaoValidationPq=null;const f=document.getElementById('icaoValidationForm'),e=document.getElementById('icaoValidationEmpty');if(f)f.style.display='none';if(e)e.style.display='block';renderIcaoOfficialVisitPqList();}
    async function saveIcaoValidationRecord(event){
        if(event)event.preventDefault();const user=firebase.auth().currentUser;if(!user)return alert('Kayıt için yetkili giriş gereklidir.');const visitId=activeIcaoOfficialVisitId,pq=(document.getElementById('icaoValidationPq')||{}).value;if(!visitId||!pq)return alert('Ziyaret ve PQ seçiniz.');const visit=icaoVisits[visitId]||{},m=pqMasterData[pq]||{};if(m.isIcaoClosed)return alert('Bu PQ daha önce ICAO tarafından kapatılmıştır. Yeniden validasyon sonucu ile EI etkisi oluşturulamaz.');
        const val=id=>((document.getElementById(id)||{}).value||'').trim(),status=val('icaoValidationStatus')||'not_evaluated';const actor=getCurrentVisitUser(),now=new Date().toISOString(),key=icaoValidationKey(pq),existing=((visit.icaoValidation||{}).records||{})[key]||{};
        const record={pq,area:normalizeAreaKey(m.alan),status,resultDate:val('icaoValidationResultDate'),evidence:val('icaoValidationEvidence'),evidenceAutoSnapshot:'',icaoComment:val('icaoValidationComment'),additionalRequest:val('icaoValidationAdditionalRequest'),responsibleUnit:val('icaoValidationResponsibleUnit'),followUpDate:val('icaoValidationFollowUpDate'),notes:val('icaoValidationNotes'),eiEligible:status==='validated',baselineOfficialClosed:false,isDeleted:false,createdAt:existing.createdAt||now,createdBy:existing.createdBy||actor,updatedAt:now,updatedBy:actor,moduleVersion:'icao-official-visit-validation-v1.2'};
        const btn=document.getElementById('icaoValidationSaveButton');if(btn){btn.disabled=true;btn.textContent='Kaydediliyor...';}try{const updates={};updates[`icao_visits/${visitId}/icaoValidation/records/${key}`]=window.visitFirebaseSafeValue?window.visitFirebaseSafeValue(record):record;updates[`icao_visits/${visitId}/icaoValidation/updatedAt`]=now;updates[`icao_visits/${visitId}/icaoValidation/updatedBy`]=actor;updates[`icao_visits/${visitId}/icaoValidation/moduleVersion`]='icao-official-visit-validation-v1.2';addVisitAuditToUpdates(updates,visitId,'icao_validation',pq,existing.createdAt?'update':'create',existing,record,status==='validated'?'PQ/CAP ICVM kapsamında kapatıldı / validated olarak kaydedildi.':'PQ/CAP ICVM validasyon sonucu güncellendi.',now,actor,{pq});await db.ref().update(updates);const verify=await db.ref(`icao_visits/${visitId}/icaoValidation/records/${key}`).once('value');if(!verify.exists())throw new Error('Firebase yazma doğrulaması başarısız.');clearTimeout(icaoValidationDraftTimer);icaoValidationDraftTimer=null;clearIcaoValidationTextDraft();showAppRuntimeToast(status==='validated'?'CAP sonucu kaydedildi; geçici EI etkisine dahil edildi.':'ICVM değerlendirme kaydı Firebase üzerinde kaydedildi.','success');renderIcaoOfficialVisitModule(true);selectIcaoValidationPq(pq);}catch(err){console.error(err);alert('ICVM değerlendirme kaydı kaydedilemedi: '+(err.message||err));}finally{if(btn){btn.disabled=false;btn.textContent='💾 CAP Sonucunu Kaydet';}}
    }
    function renderIcaoOfficialVisitEiSummary(){
        const el=document.getElementById('icaoOfficialVisitEiSummary');if(!el)return;const visit=activeIcaoOfficialVisitId&&icaoVisits[activeIcaoOfficialVisitId]?{id:activeIcaoOfficialVisitId,...icaoVisits[activeIcaoOfficialVisitId]}:null;if(!visit){el.innerHTML='<div class="icao-visit-empty">Ziyaret seçildiğinde alan ve Overall EI etkisi hesaplanacaktır.</div>';return;}if(!Object.keys(baseEIData||{}).length){el.innerHTML='<div class="icao-visit-empty">EI hesaplaması için EI Referans Excel verisi yüklenmelidir.</div>';return;}const areaFilter=getSelectedIcaoVisitAreaFilter(),scopedPqs=getIcaoVisitAreaScopedPqs(visit,areaFilter),m=getIcaoOfficialVisitImpactModel(visit,scopedPqs),visitAreas=new Set(areaFilter==='all'?visitArrayValue(visit.areas).map(normalizeAreaKey):[areaFilter]);const rows=[{area:'Overall',total:m.total,baselineSat:m.baselineSat,validatedNew:m.validatedNew,newSat:m.newSat,baselinePct:m.baselinePct,newPct:m.newPct,delta:m.delta},...Object.values(m.areas).filter(a=>visitAreas.has(a.area))];const chartSvg=buildIcaoEiComparisonChartSvg(rows,{width:980,height:360});el.innerHTML=`<div class="visit-sync-note" style="margin-bottom:8px">Başlangıç EI/SAT değerleri, ICVM öncesindeki ICAO validasyonları sonrası resmî durumu esas alır. Bu hesap ziyaret sırasında çalışma amaçlıdır. ICAO'nun resmî sonuçları kesinleşmeden “ICAO Resmî EI Veri Yönetimi” tarihçesine otomatik aktarılmaz.${areaFilter!=='all'?` Overall satırı, yalnızca <b>${escapeHtml(areaFilter)}</b> alanında ICVM kapsamında kapanan PQ'ların Overall EI'ye geçici katkısını gösterir.`:''}</div><div style="overflow-x:auto"><table class="icao-ei-table icvm-ei-summary-table"><thead><tr><th>Alan</th><th>Uygulanabilir PQ</th><th>Mevcut Resmî SAT</th><th>ICVM'de Kapatılan Yeni PQ</th><th>Mevcut EI</th><th>Geçici ICVM Sonrası EI</th><th>Değişim</th></tr></thead><tbody>${rows.map(r=>`<tr><td><b>${escapeHtml(r.area)}</b></td><td>${r.total}</td><td>${r.baselineSat}</td><td class="icao-ei-positive">+${r.validatedNew}</td><td>${formatOfficialEiPct(r.baselinePct)}</td><td><b>${formatOfficialEiPct(r.newPct)}</b></td><td class="${r.delta>0?'icao-ei-positive':''}">${formatOfficialEiDelta(r.delta)}</td></tr>`).join('')}</tbody></table></div>${chartSvg?`<div style="margin-top:12px;padding:10px;border:1px solid #e2e8f0;border-radius:12px;background:#fff;overflow-x:auto"><div style="font-size:11px;font-weight:700;color:#0f172a;margin-bottom:6px">EI Değişim Sütun Grafiği</div>${chartSvg}</div>`:''}`;updateIcaoVisitKpis(visit);
    }
    function getActiveIcaoOfficialVisitRecord(){
        return activeIcaoOfficialVisitId&&icaoVisits[activeIcaoOfficialVisitId]?{id:activeIcaoOfficialVisitId,...icaoVisits[activeIcaoOfficialVisitId]}:null;
    }
    function icaoOfficialVisitExportFileBase(visit){
        const name=String((visit&&visit.visitName)||'ICAO_Resmi_Ziyareti').replace(/[^A-Za-z0-9ÇĞİÖŞÜçğıöşü_-]+/g,'_').replace(/^_+|_+$/g,'');
        return name||'ICAO_Resmi_Ziyareti';
    }
    function buildIcaoOfficialVisitExportRowsFromPqs(visit,pqs){
        return (pqs||[]).map(p=>{
            const pq=String(p.pq||''),m=pqMasterData[pq]||{},r=getIcaoValidationForPq(visit,pq)||{},steps=getIcaoVisitPqSteps(visit,pq);
            const status=r.status||'not_evaluated';
            return {
                'PQ':pq,
                'Alan':normalizeAreaKey(p.area||m.alan||''),
                'CE':String(p.ce||m.ce||'').trim(),
                'Doğrulama Türü':String(p.verificationType||m.tur||'').trim(),
                'ICAO / ICVM Sonucu':ICAO_VALIDATION_STATUSES[status]||status,
                'Sonuç Tarihi':r.resultDate||'',
                'PQ Sorusu (ENG)':fullTextForExcel(p.question||m.soru||''),
                'PQ Sorusu (TR)':fullTextForExcel(p.questionTr||m.soruTr||''),
                'Bulgu (ENG)':fullTextForExcel(p.finding||m.bulgu||''),
                'Bulgu (TR)':fullTextForExcel(p.findingTr||m.bulguTr||''),
                'Bulgu / PQ Bilgisi':fullTextForExcel(p.finding||m.bulgu||p.question||m.soru||''),
                'ICAO’ya Sunulan Kanıt / Uygulama Kanıtı':fullTextForExcel(r.evidence||''),
                'ICAO Görüşü / Ziyaret Notu':fullTextForExcel(r.icaoComment||''),
                'Ek Kanıt / Açıklama Talebi':fullTextForExcel(r.additionalRequest||''),
                'Sorumlu SHGM Birimi':r.responsibleUnit||'',
                'Takip Tarihi':r.followUpDate||'',
                'İç Not':fullTextForExcel(r.notes||''),
                'CAP Step Sayısı':steps.length,
                'CAP Step’leri (Bilgi Amaçlı)':fullTextForExcel(steps.map(s=>`Step ${s.step||'-'}: ${s.action||s.capText||s.description||'-'}${s.evidenceReference?` | EVIDENCE: ${s.evidenceReference}`:''}`).join('\n')),
                'Geçici EI Etkisi':status==='validated'?'Yeni satisfactory PQ olarak geçici hesaba dahil':'EI artışına dahil değil'
            };
        });
    }
    function buildIcaoOfficialVisitExportRows(visit){
        return buildIcaoOfficialVisitExportRowsFromPqs(visit,getVisibleIcaoOfficialVisitPqs(visit));
    }
    function buildIcaoOfficialVisitDetailedExportRows(visit){
        return buildIcaoOfficialVisitExportRowsFromPqs(visit,getIcaoVisitAreaScopedPqs(visit));
    }
    function buildIcaoOfficialVisitEiExportRows(visit){
        if(!visit||!Object.keys(baseEIData||{}).length)return [];
        const areaFilter=getSelectedIcaoVisitAreaFilter(),scopedPqs=getIcaoVisitAreaScopedPqs(visit,areaFilter),model=getIcaoOfficialVisitImpactModel(visit,scopedPqs),visitAreas=new Set(areaFilter==='all'?visitArrayValue(visit.areas).map(normalizeAreaKey):[areaFilter]);
        const rows=[{area:'Overall',total:model.total,baselineSat:model.baselineSat,validatedNew:model.validatedNew,newSat:model.newSat,baselinePct:model.baselinePct,newPct:model.newPct,delta:model.delta},...Object.values(model.areas).filter(a=>visitAreas.has(a.area))];
        return rows.map(r=>({
            'Alan':r.area,
            'Uygulanabilir PQ':r.total,
            'Mevcut Resmî SAT':r.baselineSat,
            'ICVM’de Kapatılan Yeni PQ':r.validatedNew,
            'Geçici Yeni SAT':r.newSat,
            'Mevcut Resmî EI':formatOfficialEiPct(r.baselinePct),
            'Geçici ICVM Sonrası EI':formatOfficialEiPct(r.newPct),
            'Değişim':formatOfficialEiDelta(r.delta)
        }));
    }
    function buildIcaoOfficialVisitStepExportRowsFromPqs(visit,pqs){
        const out=[];
        (pqs||[]).forEach(p=>{
            const pq=String(p.pq||''),m=pqMasterData[pq]||{};
            getIcaoVisitPqSteps(visit,pq).forEach(s=>out.push({
                'PQ':pq,'Alan':normalizeAreaKey(p.area||m.alan||''),'Step':s.step||'',
                'Planlanan Eylem':fullTextForExcel(s.action||s.capText||s.description||''),'Sorumlu Ofis':s.office||'',
                'Hedef Tarih':s.estDate||'','Durum':s.statusLabel||s.progress||'','EVIDENCE REFERENCE':fullTextForExcel(s.evidenceReference||'')
            }));
        });
        return out;
    }
    function buildIcaoOfficialVisitStepExportRows(visit){
        return buildIcaoOfficialVisitStepExportRowsFromPqs(visit,getVisibleIcaoOfficialVisitPqs(visit));
    }
    function buildIcaoOfficialVisitDetailedStepExportRows(visit){
        return buildIcaoOfficialVisitStepExportRowsFromPqs(visit,getIcaoVisitAreaScopedPqs(visit));
    }
    function buildIcaoOfficialVisitStatusSummaryRows(visit){
        const pqs=getIcaoVisitAreaScopedPqs(visit), records=getIcaoValidationRecords(visit), map=new Map(records.map(r=>[String(r.pq),r]));
        const counts={}; Object.keys(ICAO_VALIDATION_STATUSES).forEach(k=>counts[k]=0);
        pqs.forEach(p=>{const st=((map.get(String(p.pq||''))||{}).status)||'not_evaluated';counts[st]=(counts[st]||0)+1;});
        return Object.entries(ICAO_VALIDATION_STATUSES).map(([key,label])=>({'Durum':label,'PQ Sayısı':counts[key]||0}));
    }
    function exportIcaoOfficialVisitExcel(){
        const visit=getActiveIcaoOfficialVisitRecord();
        if(!visit)return alert('Önce ICAO Resmî Ziyareti ekranından bir ziyaret kaydı seçiniz.');
        const rows=buildIcaoOfficialVisitExportRows(visit),screenRows=buildIcaoScreenLanguageExportRows(rows),eiRows=buildIcaoOfficialVisitEiExportRows(visit),stepRows=buildIcaoOfficialVisitStepExportRows(visit);
        const wb=createReportWorkbook({title:'ICAO Resmî Ziyareti / ICVM',subject:'Aktif ekran raporu'});
        addJsonSheet(wb,'Rapor_Baglamı',[
            {'Başlık':'Aktif ekran','Değer':'ICAO Resmî Ziyareti / ICVM'},
            {'Başlık':'Ziyaret','Değer':visit.visitName||''},
            {'Başlık':'Ziyaret türü','Değer':ICAO_VISIT_TYPES[visit.icaoVisitType]||visit.icaoVisitType||'ICAO'},
            {'Başlık':'Alanlar','Değer':visitArrayValue(visit.areas).join(', ')},
            {'Başlık':'Planlanan tarih','Değer':formatVisitDateRange(visit.plannedStart,visit.plannedEnd)},
            {'Başlık':'Denetim alanı filtresi','Değer':icaoOfficialVisitAreaLabel()},
            {'Başlık':'Ekran araması','Değer':((document.getElementById('icaoVisitSearch')||{}).value||'')},
            {'Başlık':'Sonuç filtresi','Değer':((document.getElementById('icaoVisitStatusFilter')||{}).selectedOptions||[])[0]?.textContent||'Tüm sonuçlar'},
            {'Başlık':'Ekranda görünen PQ','Değer':rows.length},
            {'Başlık':'PQ metin dili','Değer':getIcaoPqTextLanguage()==='both'?'ENG + TR':getIcaoPqTextLanguage().toUpperCase()}
        ]);
        addJsonSheet(wb,'ICVM_EI_Ozeti',eiRows);
        addJsonSheet(wb,'PQ_CAP_Validasyon',screenRows);
        addJsonSheet(wb,'CAP_Stepleri_Bilgi',stepRows);
        downloadReportWorkbook(wb,icaoOfficialVisitExportFileBase(visit)+icaoOfficialVisitAreaFileSuffix()+'_Aktif_Ekran.xlsx');
    }
    function buildIcaoScreenLanguageExportRows(rows){
        const mode=getIcaoPqTextLanguage();
        return (rows||[]).map(r=>{
            const out={...r};
            if(mode==='en'){
                out['PQ Sorusu']=r['PQ Sorusu (ENG)']||'';out['Bulgu']=r['Bulgu (ENG)']||'';
            }else if(mode==='tr'){
                out['PQ Sorusu']=r['PQ Sorusu (TR)']||r['PQ Sorusu (ENG)']||'';out['Bulgu']=r['Bulgu (TR)']||r['Bulgu (ENG)']||'';
                out['TR Çeviri Durumu']=`${r['PQ Sorusu (TR)']?'PQ Sorusu ✓':'PQ Sorusu eksik'}; ${r['Bulgu (TR)']?'Bulgu ✓':'Bulgu eksik'}`;
            }
            if(mode!=='both'){
                delete out['PQ Sorusu (ENG)'];delete out['PQ Sorusu (TR)'];delete out['Bulgu (ENG)'];delete out['Bulgu (TR)'];delete out['Bulgu / PQ Bilgisi'];
            }else delete out['Bulgu / PQ Bilgisi'];
            return out;
        });
    }
    function icaoPqTextPdfRows(row,detailed=false){
        const mode=detailed?'both':getIcaoPqTextLanguage(),rows=[];
        const qEn=row['PQ Sorusu (ENG)']||'',qTr=row['PQ Sorusu (TR)']||'',fEn=row['Bulgu (ENG)']||'',fTr=row['Bulgu (TR)']||'';
        if(mode==='en'||mode==='both'){
            rows.push([{text:'PQ Question (ENG)',bold:true,fillColor:'#f1f5f9'},fullTextForPdf(qEn||'-')]);
            rows.push([{text:'Finding (ENG)',bold:true,fillColor:'#f1f5f9'},fullTextForPdf(fEn||'-')]);
        }
        if(mode==='tr'||mode==='both'){
            rows.push([{text:'PQ Sorusu (TR)',bold:true,fillColor:'#f1f5f9'},fullTextForPdf(qTr||qEn||'-')+(qTr?'':'  [TR çeviri yok — ENG gösteriliyor]')]);
            rows.push([{text:'Bulgu (TR)',bold:true,fillColor:'#f1f5f9'},fullTextForPdf(fTr||fEn||'-')+(fTr?'':'  [TR çeviri yok — ENG gösteriliyor]')]);
        }
        return rows;
    }
    function icaoValidationPdfPaletteFromLabel(label){
        const normalized=String(label||'').trim();
        const key=Object.keys(ICAO_VALIDATION_STATUSES).find(k=>String(ICAO_VALIDATION_STATUSES[k]||'').trim()===normalized)||'not_evaluated';
        const palettes={
            validated:{fill:'#dcfce7',text:'#166534'},
            open:{fill:'#fee2e2',text:'#991b1b'},
            additional_evidence:{fill:'#fef3c7',text:'#92400e'},
            post_visit:{fill:'#fef3c7',text:'#92400e'},
            under_review:{fill:'#dbeafe',text:'#1e40af'},
            not_evaluated:{fill:'#f1f5f9',text:'#475569'}
        };
        return palettes[key]||palettes.not_evaluated;
    }
    function icaoValidationPdfHeading(row,index){
        const palette=icaoValidationPdfPaletteFromLabel(row['ICAO / ICVM Sonucu']);
        return {table:{widths:['*'],body:[[{text:`${index+1}. PQ ${row['PQ']} — ${row['Alan']} — ${row['ICAO / ICVM Sonucu']}`,bold:true,fontSize:9,color:palette.text,fillColor:palette.fill,margin:[5,4,5,4]}]]},layout:'noBorders',margin:[0,index?7:0,0,3]};
    }

    function buildIcaoValidationPdfResultBlock(row,index,detailed=false){
        const palette=icaoValidationPdfPaletteFromLabel(row['ICAO / ICVM Sonucu']);
        const rows=[
            [{text:`${index+1}. PQ ${row['PQ']} — ${row['Alan']} — ${row['ICAO / ICVM Sonucu']}`,colSpan:2,bold:true,fontSize:9,color:palette.text,fillColor:palette.fill,margin:[5,4,5,4]},{}],
            ...icaoPqTextPdfRows(row,detailed),
            [{text:'Sonuç tarihi',bold:true,fillColor:'#f1f5f9'},row['Sonuç Tarihi']||'-'],
            [{text:detailed?'Sunulan ek/özel kanıt':'Kanıt',bold:true,fillColor:'#f1f5f9'},fullTextForPdf(row['ICAO’ya Sunulan Kanıt / Uygulama Kanıtı']||'-')],
            [{text:'ICAO görüşü',bold:true,fillColor:'#f1f5f9'},fullTextForPdf(row['ICAO Görüşü / Ziyaret Notu']||'-')],
            [{text:detailed?'Ek kanıt / açıklama talebi':'Ek talep',bold:true,fillColor:'#f1f5f9'},fullTextForPdf(row['Ek Kanıt / Açıklama Talebi']||'-')],
            [{text:'Sorumlu / takip',bold:true,fillColor:'#f1f5f9'},`${row['Sorumlu SHGM Birimi']||'-'} / ${row['Takip Tarihi']||'-'}`]
        ];
        if(detailed){
            rows.push([{text:'İç not',bold:true,fillColor:'#f1f5f9'},fullTextForPdf(row['İç Not']||'-')]);
            rows.push([{text:'CAP Step’leri / Evidence Reference',bold:true,fillColor:'#f1f5f9'},fullTextForPdf(row['CAP Step’leri (Bilgi Amaçlı)']||'-')]);
        }
        rows.push([{text:detailed?'Geçici EI etkisi':'EI etkisi',bold:true,fillColor:'#f1f5f9'},row['Geçici EI Etkisi']||'-']);
        return {table:{headerRows:1,dontBreakRows:true,keepWithHeaderRows:1,widths:[detailed?112:105,'*'],body:rows},layout:'lightHorizontalLines',margin:[0,index?7:0,0,5]};
    }

    function icaoValidationStatusKeyFromLabel(label){
        const normalized=String(label||'').trim();
        return Object.keys(ICAO_VALIDATION_STATUSES).find(k=>String(ICAO_VALIDATION_STATUSES[k]||'').trim()===normalized)||'not_evaluated';
    }
    function buildIcaoScreenPdfStatusSummary(rows){
        const counts={total:(rows||[]).length,validated:0,open:0,additional_evidence:0,post_visit:0,under_review:0,not_evaluated:0};
        (rows||[]).forEach(r=>{const key=icaoValidationStatusKeyFromLabel(r['ICAO / ICVM Sonucu']);counts[key]=(counts[key]||0)+1;});
        counts.evidence_followup=(counts.additional_evidence||0)+(counts.post_visit||0);
        counts.progressPct=counts.total>0?(counts.validated/counts.total)*100:0;
        return counts;
    }
    function buildIcaoScreenPdfPqStatusTable(rows){
        const body=[[{text:'PQ',bold:true,fillColor:'#e2e8f0'},{text:'Alan',bold:true,fillColor:'#e2e8f0'},{text:'CE',bold:true,fillColor:'#e2e8f0'},{text:'Tür',bold:true,fillColor:'#e2e8f0'},{text:'ICVM / ICAO Sonucu',bold:true,fillColor:'#e2e8f0'}]];
        (rows||[]).forEach(r=>{
            const palette=icaoValidationPdfPaletteFromLabel(r['ICAO / ICVM Sonucu']);
            body.push([
                {text:String(r['PQ']||'-'),bold:true},
                String(r['Alan']||'-'),
                String(r['CE']||'-'),
                String(r['Doğrulama Türü']||'-'),
                {text:String(r['ICAO / ICVM Sonucu']||'-'),bold:true,color:palette.text,fillColor:palette.fill}
            ]);
        });
        return body;
    }
    function buildIcaoScreenPdfAreaStatusData(rows){
        const map={};
        (rows||[]).forEach(r=>{
            const area=normalizeAreaKey(r['Alan']||'')||'DİĞER';
            if(!map[area])map[area]={area,total:0,validated:0,open:0,additional_evidence:0,post_visit:0,under_review:0,not_evaluated:0};
            const key=icaoValidationStatusKeyFromLabel(r['ICAO / ICVM Sonucu']);
            map[area].total++;map[area][key]=(map[area][key]||0)+1;
        });
        return Object.values(map).sort((a,b)=>sortAreas(a.area,b.area));
    }
    function buildIcaoScreenPdfAreaCombinedSvg(areaRows){
        const rows=(areaRows||[]).filter(r=>r&&r.area);
        if(!rows.length)return '';
        const W=760,left=128,right=118,barX=left,barW=W-left-right,barH=18,rowH=46,top=34,legendH=34,H=top+(rows.length*rowH)+legendH;
        const segments=[
            {key:'validated',label:'Kapalı',color:'#22c55e'},
            {key:'open',label:'Açık',color:'#ef4444'},
            {key:'additional_evidence',label:'Ek Kanıt',color:'#f59e0b'},
            {key:'post_visit',label:'Takip',color:'#eab308'},
            {key:'under_review',label:'İnceleniyor',color:'#3b82f6'},
            {key:'not_evaluated',label:'Değerlendirilmedi',color:'#94a3b8'}
        ];
        const esc=s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        let body='';
        rows.forEach((areaRow,idx)=>{
            const total=Math.max(1,Number(areaRow.total||0));
            const validated=Number(areaRow.validated||0);
            const progressPct=(validated/total)*100;
            const y=top+(idx*rowH);
            let cursor=barX,rects='',counts='';
            segments.forEach(seg=>{
                const count=Number(areaRow[seg.key]||0);if(!count)return;
                const w=barW*(count/total);
                rects+=`<rect x="${cursor.toFixed(1)}" y="${y}" width="${Math.max(0,w).toFixed(1)}" height="${barH}" fill="${seg.color}"/>`;
                if(w>=28)counts+=`<text x="${(cursor+w/2).toFixed(1)}" y="${y+13}" font-size="9" text-anchor="middle" fill="#ffffff" font-weight="700">${count}</text>`;
                cursor+=w;
            });
            body+=`<text x="8" y="${y+13}" font-size="12" font-weight="700" fill="#0f172a">${esc(areaRow.area)}</text>`;
            body+=`<text x="70" y="${y+13}" font-size="9" fill="#64748b">${areaRow.total} PQ</text>`;
            body+=`<rect x="${barX}" y="${y}" width="${barW}" height="${barH}" rx="4" fill="#e2e8f0"/>${rects}${counts}`;
            body+=`<text x="${barX+barW+10}" y="${y+8}" font-size="9" fill="#166534" font-weight="700">${validated}/${areaRow.total} kapalı</text>`;
            body+=`<text x="${barX+barW+10}" y="${y+20}" font-size="10" fill="#166534" font-weight="700">%${progressPct.toFixed(2).replace('.',',')}</text>`;
        });
        let lx=8,ly=H-18,legend='';
        segments.forEach(seg=>{
            legend+=`<rect x="${lx}" y="${ly-8}" width="9" height="9" rx="2" fill="${seg.color}"/><text x="${lx+13}" y="${ly}" font-size="8" fill="#475569">${seg.label}</text>`;
            lx+=seg.label.length*5.4+36;
        });
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#ffffff"/><text x="${barX}" y="18" font-size="10" fill="#64748b">Durum dağılımı</text><text x="${barX+barW+10}" y="18" font-size="10" fill="#166534" font-weight="700">İlerleme</text>${body}${legend}</svg>`;
    }

    function buildIcaoEiComparisonChartSvg(rows, opts={}){
        const data=(rows||[]).filter(r=>String(r.area||r['Alan']||'').trim());
        if(!data.length) return '';
        const width=opts.width||960, height=opts.height||360;
        const left=58, right=16, top=26, bottom=82;
        const plotW=width-left-right, plotH=height-top-bottom;
        const baselineColor='#5b9bd5', newColor='#2f5597', gridColor='#dbe3ef', textColor='#334155';
        const parsePctValue=value=>{
            if(value===null||value===undefined||value==='') return 0;
            if(typeof value==='number') return Number.isFinite(value)?value:0;
            let s=String(value).trim().replace(/%/g,'').replace(/\s/g,'');
            if(s.includes(',')&&s.includes('.')) s=s.replace(/\./g,'').replace(',','.');
            else s=s.replace(',','.');
            const n=parseFloat(s);
            return Number.isFinite(n)?n:0;
        };
        const rowBaseline=r=>parsePctValue(r.baselinePct ?? r['baselinePct'] ?? r['Mevcut Resmî EI'] ?? 0);
        const rowNew=r=>parsePctValue(r.newPct ?? r['newPct'] ?? r['Geçici ICVM Sonrası EI'] ?? 0);
        const maxVal=Math.max(100,...data.map(r=>Math.max(rowNew(r),rowBaseline(r))));
        const yMax=Math.max(100,Math.ceil(maxVal/10)*10);
        const groupW=plotW/data.length;
        const barGap=Math.min(16, groupW*0.12);
        const barW=Math.min(34, Math.max(18, (groupW - barGap*3)/2));
        const fmt=v=>`${Number(v||0).toFixed(2).replace('.',',')}%`;
        const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        let grid='',bars='',labels='';
        for(let t=0;t<=yMax;t+=10){
            const y=top + plotH - (t/yMax)*plotH;
            grid += `<line x1="${left}" y1="${y.toFixed(1)}" x2="${(left+plotW).toFixed(1)}" y2="${y.toFixed(1)}" stroke="${gridColor}" stroke-width="1"/>`;
            labels += `<text x="${left-8}" y="${(y+4).toFixed(1)}" font-size="10" text-anchor="end" fill="${textColor}">${t}%</text>`;
        }
        data.forEach((row,idx)=>{
            const area=String(row.area||row['Alan']||'');
            const b=rowBaseline(row);
            const n=rowNew(row);
            const delta=n-b;
            const xGroup=left + idx*groupW;
            const x1=xGroup + (groupW/2) - barW - (barGap/2);
            const x2=xGroup + (groupW/2) + (barGap/2);
            const h1=(b/yMax)*plotH, h2=(n/yMax)*plotH;
            const y1=top + plotH - h1, y2=top + plotH - h2;
            bars += `<rect x="${x1.toFixed(1)}" y="${y1.toFixed(1)}" width="${barW.toFixed(1)}" height="${h1.toFixed(1)}" rx="3" fill="${baselineColor}"/>`;
            bars += `<rect x="${x2.toFixed(1)}" y="${y2.toFixed(1)}" width="${barW.toFixed(1)}" height="${h2.toFixed(1)}" rx="3" fill="${newColor}"/>`;
            bars += `<text x="${(x1+barW/2).toFixed(1)}" y="${(y1-6).toFixed(1)}" font-size="10" text-anchor="middle" fill="${textColor}" font-weight="700">${fmt(b)}</text>`;
            bars += `<text x="${(x2+barW/2).toFixed(1)}" y="${(y2-6).toFixed(1)}" font-size="10" text-anchor="middle" fill="${textColor}" font-weight="700">${fmt(n)}</text>`;
            labels += `<text x="${(xGroup+groupW/2).toFixed(1)}" y="${(top+plotH+22).toFixed(1)}" font-size="11" text-anchor="middle" fill="${textColor}" font-weight="700">${esc(area)}</text>`;
            labels += `<text x="${(xGroup+groupW/2).toFixed(1)}" y="${(top+plotH+38).toFixed(1)}" font-size="9" text-anchor="middle" fill="#64748b">Mevcut: ${fmt(b)}</text>`;
            labels += `<text x="${(xGroup+groupW/2).toFixed(1)}" y="${(top+plotH+51).toFixed(1)}" font-size="9" text-anchor="middle" fill="#64748b">ICVM: ${fmt(n)}</text>`;
            labels += `<text x="${(xGroup+groupW/2).toFixed(1)}" y="${(top+plotH+64).toFixed(1)}" font-size="9" text-anchor="middle" fill="${delta>0?'#166534':'#64748b'}">Δ ${delta.toFixed(2).replace('.',',')} puan</text>`;
        });
        const legendY=14;
        const legend=`<rect x="${left+10}" y="${legendY}" width="12" height="12" rx="2" fill="${baselineColor}"/><text x="${left+28}" y="${legendY+10}" font-size="10" fill="${textColor}">Mevcut Resmî EI</text><rect x="${left+180}" y="${legendY}" width="12" height="12" rx="2" fill="${newColor}"/><text x="${left+198}" y="${legendY+10}" font-size="10" fill="${textColor}">Geçici ICVM Sonrası EI</text>`;
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff"/>${grid}<line x1="${left}" y1="${top+plotH}" x2="${left+plotW}" y2="${top+plotH}" stroke="#94a3b8" stroke-width="1.2"/>${labels}${bars}${legend}</svg>`;
    }

    function exportIcaoOfficialVisitPDF(){
        const visit=getActiveIcaoOfficialVisitRecord();
        if(!visit)return alert('Önce ICAO Resmî Ziyareti ekranından bir ziyaret kaydı seçiniz.');
        const rows=buildIcaoOfficialVisitExportRows(visit),eiRows=buildIcaoOfficialVisitEiExportRows(visit);
        const statusFilter=((document.getElementById('icaoVisitStatusFilter')||{}).selectedOptions||[])[0]?.textContent||'Tüm sonuçlar';
        const areaFilter=icaoOfficialVisitAreaLabel();
        const searchText=((document.getElementById('icaoVisitSearch')||{}).value||'').trim();
        const content=[
            {text:'ICAO Resmî Ziyareti / ICVM',style:'header'},
            {text:`${visit.visitName||'-'} | ${formatVisitDateRange(visit.plannedStart,visit.plannedEnd)} | Alanlar: ${visitArrayValue(visit.areas).join(', ')||'-'}`,style:'subheader'},
            {text:`Aktif ekran filtresi: Alan ${areaFilter} | ${statusFilter}${searchText?` | Arama: ${searchText}`:''} | Görünen PQ: ${rows.length} | PQ metin dili: ${getIcaoPqTextLanguage()==='both'?'ENG + TR':getIcaoPqTextLanguage().toUpperCase()}`,fontSize:8,color:'#64748b',margin:[0,0,0,10]}
        ];

        // SAYFA 1: Aktif Kapsam Durum Özeti + Denetim Alanı Bazında Son Durum
        const screenSummary=buildIcaoScreenPdfStatusSummary(rows);
        content.push({text:'Aktif Kapsam Durum Özeti',style:'sectionHeader'});
        content.push({table:{widths:['*','*','*','*','*','*','*'],body:[
            [
                {text:`Toplam PQ\n${screenSummary.total}`,alignment:'center',bold:true,fillColor:'#f8fafc'},
                {text:`Kapalı\n${screenSummary.validated}`,alignment:'center',bold:true,color:'#166534',fillColor:'#dcfce7'},
                {text:`Açık\n${screenSummary.open}`,alignment:'center',bold:true,color:'#991b1b',fillColor:'#fee2e2'},
                {text:`Ek Kanıt / Takip\n${screenSummary.evidence_followup}`,alignment:'center',bold:true,color:'#92400e',fillColor:'#fef3c7'},
                {text:`İnceleniyor\n${screenSummary.under_review}`,alignment:'center',bold:true,color:'#1e40af',fillColor:'#dbeafe'},
                {text:`Değerlendirilmedi\n${screenSummary.not_evaluated}`,alignment:'center',bold:true,color:'#475569',fillColor:'#f1f5f9'},
                {text:`İlerleme\n%${screenSummary.progressPct.toFixed(2).replace('.',',')}\n(${screenSummary.validated}/${screenSummary.total||0})`,alignment:'center',bold:true,color:'#166534',fillColor:'#ecfdf5'}
            ]
        ]},layout:'lightHorizontalLines',margin:[0,0,0,8]});
        const areaStatusRows=buildIcaoScreenPdfAreaStatusData(rows);
        content.push({text:'Denetim Alanı Bazında Son Durum',style:'sectionHeader'});
        if(areaStatusRows.length){
            content.push({svg:buildIcaoScreenPdfAreaCombinedSvg(areaStatusRows),width:760,margin:[0,0,0,8]});
        }else{
            content.push({text:'Aktif ekran filtresine uygun denetim alanı verisi bulunamadı.',italics:true,color:'#64748b',margin:[0,0,0,8]});
        }

        // SAYFA 2: ICVM Geçici EI Etki Özeti
        content.push({text:'ICVM Geçici EI Etki Özeti',style:'sectionHeader',pageBreak:'before'});
        if(eiRows.length){
            const eiBody=[[{text:'Alan',bold:true,fillColor:'#f1f5f9',alignment:'center'},{text:'Uyg. PQ',bold:true,fillColor:'#f1f5f9',alignment:'center'},{text:'Mevcut SAT',bold:true,fillColor:'#f1f5f9',alignment:'center'},{text:'Yeni PQ',bold:true,fillColor:'#f1f5f9',alignment:'center'},{text:'Mevcut EI',bold:true,fillColor:'#f1f5f9',alignment:'center'},{text:'ICVM Sonrası',bold:true,fillColor:'#f1f5f9',alignment:'center'},{text:'Değişim',bold:true,fillColor:'#f1f5f9',alignment:'center'}]];
            eiRows.forEach(r=>eiBody.push([{text:r['Alan'],alignment:'center'},{text:r['Uygulanabilir PQ'],alignment:'center'},{text:r['Mevcut Resmî SAT'],alignment:'center'},{text:r['ICVM’de Kapatılan Yeni PQ'],alignment:'center'},{text:r['Mevcut Resmî EI'],alignment:'center'},{text:r['Geçici ICVM Sonrası EI'],alignment:'center'},{text:r['Değişim'],alignment:'center'}]));
            content.push({table:{headerRows:1,widths:['auto','auto','auto','auto','auto','auto','auto'],body:eiBody},layout:'lightHorizontalLines',margin:[0,0,0,10]});
            content.push({svg:buildIcaoEiComparisonChartSvg(eiRows,{width:760,height:330}),width:760,margin:[0,2,0,12]});
        }else{
            content.push({text:'EI etki hesabı için veri bulunamadı.',italics:true,color:'#64748b'});
        }

        // SAYFA 3: Kapsamdaki PQ Durumları
        content.push({text:'Kapsamdaki PQ Durumları',style:'sectionHeader',pageBreak:'before'});
        if(rows.length){
            content.push({table:{headerRows:1,widths:[55,48,50,70,'*'],body:buildIcaoScreenPdfPqStatusTable(rows)},layout:'lightHorizontalLines',margin:[0,0,0,10]});
        }else{
            content.push({text:'Aktif ekran filtresine uygun PQ bulunamadı.',italics:true,color:'#64748b'});
        }

        // SAYFA 4+: PQ / CAP Validasyon Sonuçları
        content.push({text:'PQ / CAP Validasyon Sonuçları',style:'sectionHeader',pageBreak:'before'});
        if(!rows.length){
            content.push({text:'Aktif ekran filtresine uygun PQ bulunamadı.',italics:true,color:'#64748b'});
        }else{
            rows.forEach((r,i)=>content.push(buildIcaoValidationPdfResultBlock(r,i,false)));
        }
        const docDef=createStandardPdfDefinition(content,{pageOrientation:'landscape',pageSize:'A4',defaultStyle:{font:'Roboto',fontSize:8}});
        return safeDownloadPdf(docDef,icaoOfficialVisitExportFileBase(visit)+icaoOfficialVisitAreaFileSuffix()+'_Aktif_Ekran.pdf');
    }

    function exportIcaoOfficialVisitDetailedExcel(){
        const visit=getActiveIcaoOfficialVisitRecord();
        if(!visit)return alert('Önce ICAO Resmî Ziyareti ekranından bir ziyaret kaydı seçiniz.');
        const rows=buildIcaoOfficialVisitDetailedExportRows(visit), detailedRows=rows.map(r=>{const x={...r};delete x['Bulgu / PQ Bilgisi'];return x;}), eiRows=buildIcaoOfficialVisitEiExportRows(visit), stepRows=buildIcaoOfficialVisitDetailedStepExportRows(visit), statusRows=buildIcaoOfficialVisitStatusSummaryRows(visit);
        const wb=createReportWorkbook({title:'ICAO Resmî Ziyareti / ICVM — Detaylı Rapor',subject:'Denetim alanı kapsamlı detaylı rapor'});
        addJsonSheet(wb,'Rapor_Baglamı',[
            {'Başlık':'Rapor türü','Değer':'Detaylı rapor'},
            {'Başlık':'Ziyaret','Değer':visit.visitName||''},
            {'Başlık':'Ziyaret türü','Değer':ICAO_VISIT_TYPES[visit.icaoVisitType]||visit.icaoVisitType||'ICAO'},
            {'Başlık':'Alanlar','Değer':visitArrayValue(visit.areas).join(', ')},
            {'Başlık':'Planlanan tarih','Değer':formatVisitDateRange(visit.plannedStart,visit.plannedEnd)},
            {'Başlık':'Denetim alanı filtresi','Değer':icaoOfficialVisitAreaLabel()},
            {'Başlık':'Rapor kapsamındaki PQ','Değer':rows.length},
            {'Başlık':'PQ metin dili','Değer':'ENG + TR (detaylı raporda her iki dil ayrı alanlarda gösterilir)'},
            {'Başlık':'Not','Değer':'Bu detaylı rapor ekran araması ve sonuç filtresinden bağımsızdır; seçili denetim alanı filtresini esas alır.'}
        ]);
        addJsonSheet(wb,'ICVM_EI_Ozeti',eiRows);
        addJsonSheet(wb,'Durum_Ozeti',statusRows);
        addJsonSheet(wb,'PQ_CAP_Detay',detailedRows);
        addJsonSheet(wb,'CAP_Stepleri_Detay',stepRows);
        addJsonSheet(wb,'Ek_Kanit_Talepleri',rows.filter(r=>String(r['Ek Kanıt / Açıklama Talebi']||'').trim()).map(r=>({
            'PQ':r['PQ'],'Alan':r['Alan'],'ICAO / ICVM Sonucu':r['ICAO / ICVM Sonucu'],'Ek Kanıt / Açıklama Talebi':r['Ek Kanıt / Açıklama Talebi'],'Sorumlu SHGM Birimi':r['Sorumlu SHGM Birimi'],'Takip Tarihi':r['Takip Tarihi']
        })));
        addJsonSheet(wb,'Sunulan_Kanitlar',rows.filter(r=>String(r['ICAO’ya Sunulan Kanıt / Uygulama Kanıtı']||'').trim()).map(r=>({
            'PQ':r['PQ'],'Alan':r['Alan'],'ICAO / ICVM Sonucu':r['ICAO / ICVM Sonucu'],'ICAO’ya Sunulan Kanıt / Uygulama Kanıtı':r['ICAO’ya Sunulan Kanıt / Uygulama Kanıtı']
        })));
        downloadReportWorkbook(wb,icaoOfficialVisitExportFileBase(visit)+icaoOfficialVisitAreaFileSuffix()+'_Detayli.xlsx');
    }

    function exportIcaoOfficialVisitDetailedPDF(){
        const visit=getActiveIcaoOfficialVisitRecord();
        if(!visit)return alert('Önce ICAO Resmî Ziyareti ekranından bir ziyaret kaydı seçiniz.');
        const rows=buildIcaoOfficialVisitDetailedExportRows(visit), eiRows=buildIcaoOfficialVisitEiExportRows(visit);
        const areaFilter=icaoOfficialVisitAreaLabel();
        const content=[
            {text:'ICAO Resmî Ziyareti / ICVM — Detaylı Rapor',style:'header'},
            {text:`${visit.visitName||'-'} | ${formatVisitDateRange(visit.plannedStart,visit.plannedEnd)} | Ziyaret alanları: ${visitArrayValue(visit.areas).join(', ')||'-'}`,style:'subheader'},
            {text:`Denetim alanı filtresi: ${areaFilter} | Rapor kapsamı: ${rows.length} PQ. Detaylı rapor ekran araması ve sonuç filtresinden bağımsızdır; denetim alanı filtresini esas alır.`,fontSize:8,color:'#64748b',margin:[0,0,0,10]}
        ];

        // SAYFA 1: Aktif Kapsam Durum Özeti + Denetim Alanı Bazında Son Durum
        const detailedSummary=buildIcaoScreenPdfStatusSummary(rows);
        content.push({text:'Aktif Kapsam Durum Özeti',style:'sectionHeader'});
        content.push({table:{widths:['*','*','*','*','*','*','*'],body:[
            [
                {text:`Toplam PQ\n${detailedSummary.total}`,alignment:'center',bold:true,fillColor:'#f8fafc'},
                {text:`Kapalı\n${detailedSummary.validated}`,alignment:'center',bold:true,color:'#166534',fillColor:'#dcfce7'},
                {text:`Açık\n${detailedSummary.open}`,alignment:'center',bold:true,color:'#991b1b',fillColor:'#fee2e2'},
                {text:`Ek Kanıt / Takip\n${detailedSummary.evidence_followup}`,alignment:'center',bold:true,color:'#92400e',fillColor:'#fef3c7'},
                {text:`İnceleniyor\n${detailedSummary.under_review}`,alignment:'center',bold:true,color:'#1e40af',fillColor:'#dbeafe'},
                {text:`Değerlendirilmedi\n${detailedSummary.not_evaluated}`,alignment:'center',bold:true,color:'#475569',fillColor:'#f1f5f9'},
                {text:`İlerleme\n%${detailedSummary.progressPct.toFixed(2).replace('.',',')}\n(${detailedSummary.validated}/${detailedSummary.total||0})`,alignment:'center',bold:true,color:'#166534',fillColor:'#ecfdf5'}
            ]
        ]},layout:'lightHorizontalLines',margin:[0,0,0,8]});
        const detailedAreaRows=buildIcaoScreenPdfAreaStatusData(rows);
        content.push({text:'Denetim Alanı Bazında Son Durum',style:'sectionHeader'});
        if(detailedAreaRows.length){
            content.push({svg:buildIcaoScreenPdfAreaCombinedSvg(detailedAreaRows),width:760,margin:[0,0,0,8]});
        }else{
            content.push({text:'Seçili denetim alanı kapsamında veri bulunamadı.',italics:true,color:'#64748b',margin:[0,0,0,8]});
        }

        // SAYFA 2: ICVM Geçici EI Etki Özeti
        content.push({text:'ICVM Geçici EI Etki Özeti',style:'sectionHeader',pageBreak:'before'});
        if(eiRows.length){
            const eiBody=[[{text:'Alan',bold:true,fillColor:'#f1f5f9',alignment:'center'},{text:'Uyg. PQ',bold:true,fillColor:'#f1f5f9',alignment:'center'},{text:'Mevcut SAT',bold:true,fillColor:'#f1f5f9',alignment:'center'},{text:'Yeni PQ',bold:true,fillColor:'#f1f5f9',alignment:'center'},{text:'Mevcut EI',bold:true,fillColor:'#f1f5f9',alignment:'center'},{text:'ICVM Sonrası',bold:true,fillColor:'#f1f5f9',alignment:'center'},{text:'Değişim',bold:true,fillColor:'#f1f5f9',alignment:'center'}]];
            eiRows.forEach(r=>eiBody.push([
                {text:String(r['Alan']||''),alignment:'center'},
                {text:String(r['Uygulanabilir PQ']??''),alignment:'center'},
                {text:String(r['Mevcut Resmî SAT']??''),alignment:'center'},
                {text:String(r['ICVM’de Kapatılan Yeni PQ']??''),alignment:'center'},
                {text:String(r['Mevcut Resmî EI']||''),alignment:'center'},
                {text:String(r['Geçici ICVM Sonrası EI']||''),alignment:'center'},
                {text:String(r['Değişim']||''),alignment:'center'}
            ]));
            content.push({table:{headerRows:1,widths:['auto','auto','auto','auto','auto','auto','auto'],body:eiBody},layout:'lightHorizontalLines',margin:[0,0,0,10]});
            content.push({svg:buildIcaoEiComparisonChartSvg(eiRows,{width:760,height:330}),width:760,margin:[0,2,0,12]});
        }else{
            content.push({text:'EI etki hesabı için veri bulunamadı.',italics:true,color:'#64748b'});
        }

        // SAYFA 3: Kapsamdaki PQ Durumları
        content.push({text:'Kapsamdaki PQ Durumları',style:'sectionHeader',pageBreak:'before'});
        if(rows.length){
            content.push({table:{headerRows:1,widths:[55,48,50,70,'*'],body:buildIcaoScreenPdfPqStatusTable(rows)},layout:'lightHorizontalLines',margin:[0,0,0,10]});
        }else{
            content.push({text:'Ziyaret kapsamında PQ bulunamadı.',italics:true,color:'#64748b'});
        }

        // SAYFA 4+: PQ / CAP Validasyon Sonuçları — detay alanları korunur
        content.push({text:'PQ / CAP Validasyon Sonuçları',style:'sectionHeader',pageBreak:'before'});
        if(!rows.length){
            content.push({text:'Ziyaret kapsamında PQ bulunamadı.',italics:true,color:'#64748b'});
        }
        rows.forEach((r,i)=>content.push(buildIcaoValidationPdfResultBlock(r,i,true)));
        const docDef=createStandardPdfDefinition(content,{pageOrientation:'landscape',pageSize:'A4',defaultStyle:{font:'Roboto',fontSize:8}});
        return safeDownloadPdf(docDef,icaoOfficialVisitExportFileBase(visit)+icaoOfficialVisitAreaFileSuffix()+'_Detayli.pdf');
    }

    window.runIcaoOfficialVisitSelfCheck=function(){const result={tab:!!document.getElementById('tab-icao-visit-validation'),visitType:!!document.getElementById('visitType'),scopePool:!!document.getElementById('visitScopePoolFilter'),status:Object.keys(ICAO_VALIDATION_STATUSES).length,baseEiAreas:Object.keys(baseEIData||{}).length,functions:['renderIcaoOfficialVisitModule','saveIcaoValidationRecord','getIcaoOfficialVisitImpactModel'].every(n=>typeof window[n]==='function'||typeof eval(n)==='function'),evidenceAutofill:false,stepEvidenceReadOnly:true,internalWorkspaceSeparated:typeof getInternalWorkflowVisitRecords==='function'};result.passed=result.tab&&result.visitType&&result.status===6;console.log('ICAO resmî ziyaret öz denetimi:',result);return result;};
    window.handleIcaoVisitAreaFilterChange=handleIcaoVisitAreaFilterChange;window.handleIcaoVisitLanguageChange=handleIcaoVisitLanguageChange;window.setIcaoPqTextLanguage=setIcaoPqTextLanguage;window.renderIcaoOfficialVisitModule=renderIcaoOfficialVisitModule;window.loadIcaoOfficialVisit=loadIcaoOfficialVisit;window.openIcaoOfficialVisitValidation=openIcaoOfficialVisitValidation;window.openIcaoOfficialVisitForm=openIcaoOfficialVisitForm;window.openSelectedIcaoVisitScope=openSelectedIcaoVisitScope;window.renderIcaoOfficialVisitPqList=renderIcaoOfficialVisitPqList;window.selectIcaoValidationPq=selectIcaoValidationPq;window.resetIcaoValidationForm=resetIcaoValidationForm;window.saveIcaoValidationRecord=saveIcaoValidationRecord;window.toggleVisitTypeFields=toggleVisitTypeFields;window.exportIcaoOfficialVisitExcel=exportIcaoOfficialVisitExcel;window.exportIcaoOfficialVisitPDF=exportIcaoOfficialVisitPDF;window.exportIcaoOfficialVisitDetailedExcel=exportIcaoOfficialVisitDetailedExcel;window.exportIcaoOfficialVisitDetailedPDF=exportIcaoOfficialVisitDetailedPDF;window.getVisibleIcaoOfficialVisitPqs=getVisibleIcaoOfficialVisitPqs;


    // ZİYARET VE İÇ DENETİM - PAKET 2: KAPSAM VE HAZIRLIK
    function getVisitScopeRecord() {
        const id = activeVisitScopeId || ((document.getElementById('visitScopeVisitSelect') || {}).value || '');
        return id && icaoVisits[id] ? { id, ...icaoVisits[id] } : null;
    }
    function getVisitScopeStoredPqs(visit) { return visitArrayValue((((visit || {}).scope || {}).pqs)); }
    function getVisitScopeStoredSteps(visit) { return visitArrayValue((((visit || {}).scope || {}).steps)); }
    function getVisitPreparationRecords(visit) { return visitArrayValue((((visit || {}).preparation || {}).records)); }
    function visitScopeStepKey(row) { return makeActionKey(row.pq || '', row.step || '', row.action || ''); }
    function visitScopeStatusClass(action) {
        if (!action) return '';
        if (action.statusCode === COMMON_ACTION_STATUS.LATE.code) return 'late';
        if (action.statusCode === COMMON_ACTION_STATUS.DATE_RISK.code) return 'date-risk';
        if (action.statusCode === COMMON_ACTION_STATUS.COMPLETED.code) return 'done';
        return '';
    }
    function visitScopeMasterText(master, keys) {
        for (const key of keys) if (master && master[key] !== undefined && master[key] !== null && String(master[key]).trim()) return String(master[key]);
        return '';
    }
    function buildVisitScopeCandidates() {
        const visit = getVisitScopeRecord();
        if (!visit) return [];
        const areas = new Set(visitArrayValue(visit.areas).map(a => String(a).trim().toUpperCase()));
        const projectionDate = (document.getElementById('visitScopeDueDate') || {}).value || null;
        const allPqs = new Set([...Object.keys(pqMasterData || {}), ...rawData.map(r => r && r.pq).filter(Boolean)]);
        const candidates = [];
        allPqs.forEach(pq => {
            const master = pqMasterData[pq] || {};
            if (isIcaoOfficialVisit(visit) && master.isIcaoClosed) return;
            const area = String(master.alan || 'DİĞER').trim().toUpperCase();
            if (areas.size && !areas.has(area)) return;
            const sourceRows = rawData.filter(r => r && r.pq === pq);
            const pqStatus = classifyCommonPQStatus(pq, sourceRows, { projectionDate });
            const actionItems = sourceRows.filter(isUsableCapStep).map(row => {
                const cls = classifyCommonActionStatus(row, { projectionDate });
                return { ...row, statusCode:cls.code, statusLabel:cls.label, delayDays:cls.delayDays || 0, daysLeft:cls.daysLeft, dueByProjection:!!cls.dueByProjection, parsedDate:cls.parsedDate || null, key:visitScopeStepKey(row) };
            });
            candidates.push({
                pq, master, area, statusCode:pqStatus.code, statusLabel:pqStatus.label,
                question:visitScopeMasterText(master,['soru','question','pqQuestion']),
                questionTr:visitScopeMasterText(master,['soruTr','questionTr','pqQuestionTr']),
                finding:visitScopeMasterText(master,['bulgu','finding','description']),
                findingTr:visitScopeMasterText(master,['bulguTr','findingTr','descriptionTr']),
                reviewEvidence:visitScopeMasterText(master,['reviewEvidence','incelenecekKanitlar','evidence']),
                ce:master.ce || '', responsible:master.sorumlu || '', verificationType:master.tur || '',
                actionItems, lateSteps:actionItems.filter(a => a.statusCode === COMMON_ACTION_STATUS.LATE.code).length,
                dateRiskSteps:actionItems.filter(a => a.statusCode === COMMON_ACTION_STATUS.DATE_RISK.code).length,
                openSteps:actionItems.filter(a => a.statusCode !== COMMON_ACTION_STATUS.COMPLETED.code).length
            });
        });
        return candidates.sort((a,b) => sortAreas(a.area,b.area) || sortPQs(a.pq,b.pq));
    }
    function visitScopeHasCurrentCap(pq) {
        return (rawData || []).some(r => r && String(r.pq || '') === String(pq || '') && isUsableCapStep(r));
    }
    function visitScopeHasStoredCap(visit,pq) {
        return getVisitScopeStoredSteps(visit).some(s => s && String(s.pq || '') === String(pq || ''));
    }
    function visitScopeHasOpenIcaoCap(item, visit) {
        if (!item || !item.pq) return false;
        const master = item.master || pqMasterData[item.pq] || {};
        if (master.isIcaoClosed) return false;
        // Güncel CAP verisi yüklüyse onu esas al; veri yoksa ziyaretin saklı snapshot'ını emniyet ağı olarak kullan.
        if ((rawData || []).length) return (item.actionItems || []).length > 0;
        return (item.actionItems || []).length > 0 || visitScopeHasStoredCap(visit,item.pq);
    }
    function resolveVisitScopePoolFilter(visit) {
        const el=document.getElementById('visitScopePoolFilter'), value=(el&&el.value)||'auto';
        if (value !== 'auto') return value;
        return visit && isIcaoOfficialVisit(visit) ? 'open_cap' : 'all';
    }
    function getVisitScopePoolCandidates(visit) {
        const pool=resolveVisitScopePoolFilter(visit);
        return buildVisitScopeCandidates().filter(item=>{
            const master=item.master||pqMasterData[item.pq]||{};
            if(pool==='open_cap') return visitScopeHasOpenIcaoCap(item,visit);
            if(pool==='nonvalidated') return !master.isIcaoClosed;
            return true;
        });
    }
    function getVisibleVisitScopeCandidates() {
        const q = ((document.getElementById('visitScopeSearch') || {}).value || '').trim().toLocaleLowerCase('tr');
        const status = (document.getElementById('visitScopeStatusFilter') || {}).value || 'all';
        const visit=getVisitScopeRecord(), official=visit&&isIcaoOfficialVisit(visit);
        return getVisitScopePoolCandidates(visit).filter(item => {
            if (status === 'open' && (official ? item.statusCode === COMMON_PQ_STATUS.OFFICIAL_CLOSED.code : [COMMON_PQ_STATUS.OFFICIAL_CLOSED.code,COMMON_PQ_STATUS.CAP_COMPLETED.code].includes(item.statusCode))) return false;
            if (status === 'late' && item.lateSteps === 0) return false;
            if (status === 'date_risk' && item.dateRiskSteps === 0) return false;
            if (status === 'cap_completed' && item.statusCode !== COMMON_PQ_STATUS.CAP_COMPLETED.code) return false;
            if (status === 'official' && item.statusCode !== COMMON_PQ_STATUS.OFFICIAL_CLOSED.code) return false;
            if (status === 'no_cap' && item.statusCode !== COMMON_PQ_STATUS.NO_CAP.code) return false;
            if (q) {
                const haystack = [item.pq,item.area,item.ce,item.responsible,item.question,item.finding,...item.actionItems.flatMap(a => [a.action,a.office,a.step])].join(' ').toLocaleLowerCase('tr');
                if (!haystack.includes(q)) return false;
            }
            return true;
        });
    }
    function getVisibleVisitScopeSteps(item) {
        const filter = (document.getElementById('visitScopeStepFilter') || {}).value || 'all';
        return (item.actionItems || []).filter(a => {
            if (filter === 'open') return a.statusCode !== COMMON_ACTION_STATUS.COMPLETED.code;
            if (filter === 'late') return a.statusCode === COMMON_ACTION_STATUS.LATE.code;
            if (filter === 'date_risk') return a.statusCode === COMMON_ACTION_STATUS.DATE_RISK.code;
            if (filter === 'done') return a.statusCode === COMMON_ACTION_STATUS.COMPLETED.code;
            return true;
        });
    }
    function renderVisitScopeModule(forceReload = false) {
        const select = document.getElementById('visitScopeVisitSelect');
        if (!select) return;
        const visits = getVisitRecords().sort((a,b) => String(a.visitName || '').localeCompare(String(b.visitName || ''),'tr'));
        const desired = activeVisitScopeId || select.value || '';
        select.innerHTML = '<option value="">Bir ziyaret seçiniz...</option>' + visits.map(v => `<option value="${escapeHtml(v.id)}">${escapeHtml(v.visitName || 'Adsız ziyaret')} — ${escapeHtml(formatVisitDateRange(v.plannedStart,v.plannedEnd))}</option>`).join('');
        if (desired && visits.some(v => v.id === desired)) select.value = desired;
        else if (forceReload && visits.length === 1) select.value = visits[0].id;
        if (select.value && (forceReload || activeVisitScopeId !== select.value)) loadVisitScopeSelection(select.value, true);
        else if (!select.value) {
            activeVisitScopeId = null; visitScopeSelectedPqs.clear(); visitScopeSelectedSteps.clear();
            renderVisitScopeCandidates(); renderVisitPreparationPanel();
        } else {
            activeVisitScopeId = select.value; renderVisitScopeCandidates(); renderVisitPreparationPanel();
        }
    }
    function loadVisitScopeSelection(id, silent = false) {
        activeVisitScopeId = id || null;
        const visit = getVisitScopeRecord();
        visitScopeSelectedPqs = new Set(getVisitScopeStoredPqs(visit).map(x => String((x || {}).pq || '')).filter(Boolean));
        visitScopeSelectedSteps = new Set(getVisitScopeStoredSteps(visit).map(x => String((x || {}).key || visitScopeStepKey(x || {}))).filter(Boolean));
        const poolEl=document.getElementById('visitScopePoolFilter'); if(poolEl)poolEl.value='auto';
        if (visit && isIcaoOfficialVisit(visit)) {
            const eligible=new Set(getVisitScopePoolCandidates(visit).map(x=>String(x.pq)));
            visitScopeSelectedPqs=new Set([...visitScopeSelectedPqs].filter(pq=>eligible.has(String(pq))));
            const eligibleSteps=new Set(getVisitScopePoolCandidates(visit).flatMap(x=>(x.actionItems||[]).map(a=>a.key)));
            visitScopeSelectedSteps=new Set([...visitScopeSelectedSteps].filter(k=>eligibleSteps.has(k)));
        }
        const due = document.getElementById('visitScopeDueDate');
        if (due && visit && visit.scope && visit.scope.projectionDate) due.value = visit.scope.projectionDate;
        loadVisitGeneralPreparationFields(visit);
        renderVisitScopeCandidates(); renderVisitPreparationPanel();
        const note = document.getElementById('visitScopeSyncNote');
        if (note) note.textContent = visit ? `Seçili ziyaret: ${visit.visitName || 'Adsız ziyaret'} | Alan: ${visitArrayValue(visit.areas).join(', ') || '-'} | Birim: ${getVisitUnits(visit).join(', ') || '-'}` : 'Kapsam çalışması için bir ziyaret seçiniz.';
        if (!silent && !visit && id) alert('Seçilen ziyaret kaydı bulunamadı.');
    }
    function openVisitScopeForVisit(id) {
        switchTab('visit-scope');
        const select = document.getElementById('visitScopeVisitSelect'); if (select) select.value = id;
        loadVisitScopeSelection(id);
    }
    function clearVisitScopeLocalFilters() {
        const q=document.getElementById('visitScopeSearch'), pool=document.getElementById('visitScopePoolFilter'), s=document.getElementById('visitScopeStatusFilter'), st=document.getElementById('visitScopeStepFilter');
        if(q)q.value=''; if(pool)pool.value='auto'; if(s)s.value='all'; if(st)st.value='all'; renderVisitScopeCandidates();
    }
    function toggleVisitScopePq(pq, checked) {
        const visit=getVisitScopeRecord();
        if (checked) visitScopeSelectedPqs.add(pq); else visitScopeSelectedPqs.delete(pq);
        if (visit && isIcaoOfficialVisit(visit)) {
            const item=buildVisitScopeCandidates().find(x=>x.pq===pq);
            (item ? item.actionItems : []).forEach(a=> checked ? visitScopeSelectedSteps.add(a.key) : visitScopeSelectedSteps.delete(a.key));
        }
        renderVisitScopeCandidates(); renderVisitPreparationTargetOptions(); updateVisitScopeSummary();
    }
    function toggleVisitScopeStep(encodedKey, pq, checked) {
        const key = decodeURIComponent(encodedKey);
        if (checked) { visitScopeSelectedSteps.add(key); visitScopeSelectedPqs.add(pq); }
        else visitScopeSelectedSteps.delete(key);
        renderVisitScopeCandidates(); renderVisitPreparationTargetOptions(); updateVisitScopeSummary();
    }
    function selectVisitScopePqSteps(pq, mode) {
        const item = buildVisitScopeCandidates().find(x => x.pq === pq); if (!item) return;
        const steps = getVisibleVisitScopeSteps(item);
        const selectAll = mode !== false && steps.some(a => !visitScopeSelectedSteps.has(a.key));
        steps.forEach(a => selectAll ? visitScopeSelectedSteps.add(a.key) : visitScopeSelectedSteps.delete(a.key));
        if (selectAll) visitScopeSelectedPqs.add(pq);
        renderVisitScopeCandidates(); renderVisitPreparationTargetOptions(); updateVisitScopeSummary();
    }
    function clearVisitScopeSelection() {
        visitScopeSelectedPqs.clear(); visitScopeSelectedSteps.clear(); renderVisitScopeCandidates(); renderVisitPreparationTargetOptions(); updateVisitScopeSummary();
    }
    function selectVisitScopePreset(type) {
        const visit = getVisitScopeRecord(); if (!visit) return alert('Önce bir ziyaret seçiniz.');
        const candidates = getVisitScopePoolCandidates(visit);
        const projectionDate = (document.getElementById('visitScopeDueDate') || {}).value;
        if (type === 'due_date' && !projectionDate) return alert('Önce kapsam tarihini seçiniz.');
        visitScopeSelectedPqs.clear(); visitScopeSelectedSteps.clear();
        candidates.forEach(item => {
            let pqMatch = false; let steps = [];
            if (type === 'all_open') {
                if (isIcaoOfficialVisit(visit)) { pqMatch = visitScopeHasOpenIcaoCap(item,visit); steps=item.actionItems; }
                else { pqMatch = ![COMMON_PQ_STATUS.OFFICIAL_CLOSED.code,COMMON_PQ_STATUS.CAP_COMPLETED.code].includes(item.statusCode); steps=item.actionItems.filter(a=>a.statusCode!==COMMON_ACTION_STATUS.COMPLETED.code); }
            }
            if (type === 'late') { steps=item.actionItems.filter(a=>a.statusCode===COMMON_ACTION_STATUS.LATE.code); pqMatch=steps.length>0; }
            if (type === 'date_risk') { steps=item.actionItems.filter(a=>a.statusCode===COMMON_ACTION_STATUS.DATE_RISK.code); pqMatch=steps.length>0; }
            if (type === 'cap_completed') { pqMatch=item.statusCode===COMMON_PQ_STATUS.CAP_COMPLETED.code; steps=item.actionItems; }
            if (type === 'due_date') { steps=item.actionItems.filter(a=>a.dueByProjection && a.statusCode!==COMMON_ACTION_STATUS.COMPLETED.code); pqMatch=steps.length>0; }
            if (pqMatch) { visitScopeSelectedPqs.add(item.pq); steps.forEach(a=>visitScopeSelectedSteps.add(a.key)); }
        });
        renderVisitScopeCandidates(); renderVisitPreparationTargetOptions(); updateVisitScopeSummary();
    }
    function renderVisitScopeCandidates() {
        const list = document.getElementById('visitScopePqList'); if (!list) return;
        const visit = getVisitScopeRecord();
        if (!visit) { list.innerHTML='<div class="visit-scope-empty">Kapsam oluşturmak için bir ziyaret seçiniz.</div>'; updateVisitScopeKpis([]); return; }
        const candidates = getVisibleVisitScopeCandidates();
        const count=document.getElementById('visitScopeListCount'); if(count)count.textContent=`${candidates.length} PQ`;
        const syncNote=document.getElementById('visitScopeSyncNote');
        if(syncNote && visit && isIcaoOfficialVisit(visit)){
            const allNonValidated=buildVisitScopeCandidates().filter(x=>!(x.master||{}).isIcaoClosed).length;
            const openCaps=buildVisitScopeCandidates().filter(x=>visitScopeHasOpenIcaoCap(x,visit)).length;
            syncNote.textContent=`${visit.visitName||'ICAO ziyareti'} | ICAO valide edilmemiş PQ: ${allNonValidated} | Açık CAP bulunan PQ: ${openCaps} | Varsayılan ICVM havuzu: yalnız açık CAP'ler.`;
        }
        if (!candidates.length) { list.innerHTML='<div class="visit-scope-empty">Seçili ziyaret alanları ve görünüm filtreleri kapsamında PQ bulunamadı.</div>'; updateVisitScopeKpis(getVisitScopePoolCandidates(visit)); return; }
        list.innerHTML = candidates.map(item => {
            const selected=visitScopeSelectedPqs.has(item.pq); const steps=getVisibleVisitScopeSteps(item);
            const finding=shortenVisitText(item.finding || item.question || 'Bulgu/soru bilgisi yok.',240);
            const stepHtml=steps.length ? steps.map(a => {
                const checked=visitScopeSelectedSteps.has(a.key); const encoded=encodeURIComponent(a.key);
                const dayText=a.statusCode===COMMON_ACTION_STATUS.LATE.code?`${a.delayDays} gün gecikmiş`:(a.statusCode===COMMON_ACTION_STATUS.DATE_RISK.code?'Tarih eksik/geçersiz':(a.daysLeft!==null&&a.daysLeft!==undefined?`${a.daysLeft} gün kaldı`:''));
                return visit&&isIcaoOfficialVisit(visit) ? `<div class="visit-step-item ${visitScopeStatusClass(a)}"><label><b>Step ${escapeHtml(a.step || '-')}</b> <span style="color:var(--muted);font-size:9px">(bilgi amaçlı)</span> — ${escapeHtml(shortenVisitText(a.action,210))}<small>${escapeHtml(a.office || 'Ofis belirtilmedi')} | ${escapeHtml(a.estDate || 'Tarih yok')} | ${escapeHtml(a.statusLabel || '')}${dayText?' | '+escapeHtml(dayText):''}</small></label></div>` : `<div class="visit-step-item ${visitScopeStatusClass(a)}"><input type="checkbox" ${checked?'checked':''} onchange="toggleVisitScopeStep('${encoded}','${item.pq}',this.checked)"><label><b>Step ${escapeHtml(a.step || '-')}</b> — ${escapeHtml(shortenVisitText(a.action,210))}<small>${escapeHtml(a.office || 'Ofis belirtilmedi')} | ${escapeHtml(a.estDate || 'Tarih yok')} | ${escapeHtml(a.statusLabel || '')}${dayText?' | '+escapeHtml(dayText):''}</small></label></div>`;
            }).join('') : '<div class="visit-form-note">Görünüm filtresine uygun CAP adımı yok.</div>';
            return `<article class="visit-pq-card ${selected?'selected':''}"><div class="visit-pq-head"><input type="checkbox" ${selected?'checked':''} onchange="toggleVisitScopePq('${item.pq}',this.checked)"><div><div class="visit-pq-title">PQ ${escapeHtml(item.pq)} — ${escapeHtml(item.area)}</div><div class="visit-pq-meta">CE: ${escapeHtml(item.ce||'-')} | PQ sorumlusu: ${escapeHtml(item.responsible||'-')} | Açık adım: ${item.openSteps} | Gecikmiş: ${item.lateSteps} | Tarih riski: ${item.dateRiskSteps}</div></div><span class="visit-pq-status">${escapeHtml(item.statusLabel||'-')}</span></div><div class="visit-pq-finding">${escapeHtml(finding)}</div><div class="visit-step-list"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><b style="font-size:10px;color:var(--muted)">CAP Adımları (${steps.length})</b>${visit&&isIcaoOfficialVisit(visit)?'<span style="font-size:9px;color:var(--muted)">Step seçimi yapılmaz</span>':`<button type="button" class="btn-outline" style="font-size:9px;padding:4px 6px" onclick="selectVisitScopePqSteps('${item.pq}')">Görünen adımları seç/kaldır</button>`}</div>${stepHtml}</div></article>`;
        }).join('');
        updateVisitScopeKpis(getVisitScopePoolCandidates(visit)); updateVisitScopeSummary(); renderVisitPreparationTargetOptions();
    }
    function updateVisitScopeKpis(allCandidates) {
        const candidates=allCandidates||[]; const selectedStepRows=candidates.flatMap(x=>x.actionItems).filter(a=>visitScopeSelectedSteps.has(a.key));
        const prep=getVisitPreparationRecords(getVisitScopeRecord());
        const values={visitScopeKpiEligible:candidates.length,visitScopeKpiSelectedPq:visitScopeSelectedPqs.size,visitScopeKpiSelectedStep:visitScopeSelectedSteps.size,visitScopeKpiLate:selectedStepRows.filter(a=>a.statusCode===COMMON_ACTION_STATUS.LATE.code).length,visitScopeKpiPrep:prep.length};
        Object.entries(values).forEach(([id,val])=>{const el=document.getElementById(id);if(el)el.textContent=val;});
    }
    function updateVisitScopeSummary() {
        const visit=getVisitScopeRecord(); const el=document.getElementById('visitScopeSelectedSummary'); if(!el)return;
        el.textContent=visit?`${visit.visitName || 'Ziyaret'}: ${visitScopeSelectedPqs.size} PQ ve ${visitScopeSelectedSteps.size} ${isIcaoOfficialVisit(visit)?'bilgi amaçlı CAP adımı':'CAP adımı'} kapsamda.`:'Henüz ziyaret seçilmedi.';
    }
    function loadVisitGeneralPreparationFields(visit) {
        const general=(((visit||{}).preparation||{}).general)||{};
        const map={visitPrepGeneralAgenda:'agenda',visitPrepGeneralQuestions:'questions',visitPrepGeneralEvidence:'evidenceRequests',visitPrepGeneralAuthorities:'personsAuthorities',visitPrepGeneralRisks:'risks',visitPrepGeneralNotes:'notes'};
        Object.entries(map).forEach(([id,key])=>{const el=document.getElementById(id);if(el)el.value=general[key]||'';});
    }
    function getVisitGeneralPreparationFromForm() {
        const val=id=>((document.getElementById(id)||{}).value||'').trim();
        return {agenda:val('visitPrepGeneralAgenda'),questions:val('visitPrepGeneralQuestions'),evidenceRequests:val('visitPrepGeneralEvidence'),personsAuthorities:val('visitPrepGeneralAuthorities'),risks:val('visitPrepGeneralRisks'),notes:val('visitPrepGeneralNotes')};
    }
    function buildVisitScopeSnapshots() {
        const visit=getVisitScopeRecord(); const candidates=(visit&&isIcaoOfficialVisit(visit))?getVisitScopePoolCandidates(visit):buildVisitScopeCandidates(); const now=new Date().toISOString();
        const pqs=candidates.filter(x=>visitScopeSelectedPqs.has(x.pq)).map(x=>({pq:x.pq,area:x.area,ce:x.ce,responsible:x.responsible,verificationType:x.verificationType,question:x.question,questionTr:x.questionTr||'',finding:x.finding,findingTr:x.findingTr||'',reviewEvidence:x.reviewEvidence,statusCode:x.statusCode,statusLabel:x.statusLabel,sourceReportDate:window_loadedReportDate?window_loadedReportDate.toISOString():null,snapshotAt:now}));
        const steps=candidates.flatMap(x=>x.actionItems.map(a=>({x,a}))).filter(z=>visitScopeSelectedSteps.has(z.a.key)).map(({x,a})=>({key:a.key,pq:x.pq,step:a.step,action:a.action,office:a.office,evidenceReference:a.evidenceReference||'',estDate:a.estDate,progress:a.progress,statusCode:a.statusCode,statusLabel:a.statusLabel,delayDays:a.delayDays||0,sourceFile:a.sourceFile||'',sourceReportDate:window_loadedReportDate?window_loadedReportDate.toISOString():null,snapshotAt:now}));
        return {pqs,steps};
    }
    async function saveVisitScopeAndGeneralPreparation() {
        const visit=getVisitScopeRecord(); if(!visit)return alert('Önce bir ziyaret seçiniz.');
        if(!firebase.auth().currentUser)return alert('Kayıt için yetkili giriş gereklidir.');
        if(!visitScopeSelectedPqs.size)return alert('Ziyaret kapsamına en az bir PQ ekleyiniz.');
        if(isIcaoOfficialVisit(visit)){getVisitScopePoolCandidates(visit).filter(x=>visitScopeSelectedPqs.has(x.pq)).forEach(x=>x.actionItems.forEach(a=>visitScopeSelectedSteps.add(a.key)));}
        const actor=getCurrentVisitUser(), now=new Date().toISOString(), snapshots=buildVisitScopeSnapshots();
        const existingPrep=(visit.preparation||{});
        const scope={pqs:snapshots.pqs,steps:snapshots.steps,projectionDate:(document.getElementById('visitScopeDueDate')||{}).value||'',updatedAt:now,updatedBy:actor,moduleVersion:'visit-package-2'};
        const preparation={...existingPrep,general:getVisitGeneralPreparationFromForm(),records:getVisitPreparationRecords(visit),updatedAt:now,updatedBy:actor,moduleVersion:'visit-package-2'};
        const btn=document.getElementById('visitScopeSaveButton');if(btn){btn.disabled=true;btn.textContent='Kaydediliyor...';}
        try{const updates={};updates[`icao_visits/${visit.id}/scope`]=scope;updates[`icao_visits/${visit.id}/preparation`]=preparation;updates[`icao_visits/${visit.id}/updatedAt`]=now;updates[`icao_visits/${visit.id}/updatedBy`]=actor;updates[`icao_visits/${visit.id}/moduleVersion`]='visit-package-2';addVisitAuditToUpdates(updates,visit.id,'scope','scope',visit.scope||{},scope,'Ziyaret PQ/CAP kapsamı güncellendi.',now,actor,{});addVisitAuditToUpdates(updates,visit.id,'general_preparation','general',visit.preparation||{},preparation,'Ziyaret genel hazırlık bilgileri güncellendi.',now,actor,{});await db.ref().update(updates);alert('Ziyaret kapsamı ve genel hazırlık bilgileri Firebase üzerinde kaydedildi.');}
        catch(error){console.error(error);alert('Kapsam kaydedilemedi: '+(error.message||error));}
        finally{if(btn){btn.disabled=false;btn.textContent='💾 Kapsamı ve Genel Hazırlığı Kaydet';}}
    }
    function renderVisitPreparationTargetOptions() {
        const select=document.getElementById('visitPrepTarget');if(!select)return;
        const current=select.value; const candidates=buildVisitScopeCandidates();
        const options=['<option value="visit">Ziyaret geneli</option>'];
        candidates.filter(x=>visitScopeSelectedPqs.has(x.pq)).forEach(x=>options.push(`<option value="pq::${escapeHtml(x.pq)}">PQ ${escapeHtml(x.pq)} — ${escapeHtml(x.area)}</option>`));
        candidates.flatMap(x=>x.actionItems.map(a=>({x,a}))).filter(z=>visitScopeSelectedSteps.has(z.a.key)).forEach(({x,a})=>options.push(`<option value="step::${encodeURIComponent(a.key)}">PQ ${escapeHtml(x.pq)} / Step ${escapeHtml(a.step||'-')}</option>`));
        select.innerHTML=options.join(''); if(Array.from(select.options).some(o=>o.value===current))select.value=current;
    }
    function parseVisitPrepTarget(value) {
        const visit=getVisitScopeRecord(); const candidates=buildVisitScopeCandidates();
        if(!value||value==='visit')return {targetType:'visit',targetLabel:(visit&&visit.visitName)||'Ziyaret geneli',pq:'',step:'',stepKey:''};
        if(value.startsWith('pq::')){const pq=value.slice(4);return {targetType:'pq',targetLabel:`PQ ${pq}`,pq,step:'',stepKey:''};}
        if(value.startsWith('step::')){const key=decodeURIComponent(value.slice(6));const found=candidates.flatMap(x=>x.actionItems.map(a=>({x,a}))).find(z=>z.a.key===key);return found?{targetType:'step',targetLabel:`PQ ${found.x.pq} / Step ${found.a.step}`,pq:found.x.pq,step:found.a.step,stepKey:key}:{targetType:'step',targetLabel:'CAP adımı',pq:'',step:'',stepKey:key};}
        return {targetType:'visit',targetLabel:'Ziyaret geneli',pq:'',step:'',stepKey:''};
    }
    function resetVisitPreparationForm() {
        ['visitPrepRecordId','visitPrepQuestions','visitPrepEvidence','visitPrepAuthorities','visitPrepVerification','visitPrepAssessment','visitPrepRisks','visitPrepNotes'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
        const target=document.getElementById('visitPrepTarget');if(target)target.value='visit';
    }
    async function saveVisitPreparationRecord() {
        const visit=getVisitScopeRecord();if(!visit)return alert('Önce bir ziyaret seçiniz.');
        if(!firebase.auth().currentUser)return alert('Kayıt için yetkili giriş gereklidir.');
        const val=id=>((document.getElementById(id)||{}).value||'').trim();
        const target=parseVisitPrepTarget((document.getElementById('visitPrepTarget')||{}).value);
        const payload={questions:val('visitPrepQuestions'),evidenceRequests:val('visitPrepEvidence'),personsAuthorities:val('visitPrepAuthorities'),verificationPoints:val('visitPrepVerification'),preliminaryAssessment:val('visitPrepAssessment'),risks:val('visitPrepRisks'),notes:val('visitPrepNotes')};
        if(!Object.values(payload).some(Boolean))return alert('Hazırlık kaydına en az bir içerik giriniz.');
        const records=getVisitPreparationRecords(visit);const id=val('visitPrepRecordId')||db.ref('icao_visits').push().key;const existing=records.find(r=>r.id===id)||{};const actor=getCurrentVisitUser(),now=new Date().toISOString();
        const record={...existing,id,...target,...payload,createdAt:existing.createdAt||now,createdBy:existing.createdBy||actor,updatedAt:now,updatedBy:actor};
        const next=records.filter(r=>r.id!==id);next.push(record);
        const snapshots=buildVisitScopeSnapshots();
        const scope={pqs:snapshots.pqs,steps:snapshots.steps,projectionDate:(document.getElementById('visitScopeDueDate')||{}).value||'',updatedAt:now,updatedBy:actor,moduleVersion:'visit-package-2'};
        const preparation={...(visit.preparation||{}),general:getVisitGeneralPreparationFromForm(),records:next,updatedAt:now,updatedBy:actor,moduleVersion:'visit-package-2'};
        try{const updates={};updates[`icao_visits/${visit.id}/scope`]=scope;updates[`icao_visits/${visit.id}/preparation`]=preparation;updates[`icao_visits/${visit.id}/updatedAt`]=now;updates[`icao_visits/${visit.id}/updatedBy`]=actor;updates[`icao_visits/${visit.id}/moduleVersion`]='visit-package-2';addVisitAuditToUpdates(updates,visit.id,'preparation_record',id,existing.id?'update':'create',existing,record,existing.id?'Hazırlık kaydı güncellendi.':'Yeni hazırlık kaydı oluşturuldu.',now,actor,{pq:record.pq||'',step:record.step||''});await db.ref().update(updates);resetVisitPreparationForm();}
        catch(error){console.error(error);alert('Hazırlık kaydı kaydedilemedi: '+(error.message||error));}
    }
    function editVisitPreparationRecord(id) {
        const record=getVisitPreparationRecords(getVisitScopeRecord()).find(r=>r.id===id);if(!record)return;
        const set=(field,val)=>{const el=document.getElementById(field);if(el)el.value=val||'';};
        set('visitPrepRecordId',record.id);set('visitPrepQuestions',record.questions);set('visitPrepEvidence',record.evidenceRequests);set('visitPrepAuthorities',record.personsAuthorities);set('visitPrepVerification',record.verificationPoints);set('visitPrepAssessment',record.preliminaryAssessment);set('visitPrepRisks',record.risks);set('visitPrepNotes',record.notes);
        renderVisitPreparationTargetOptions();const target=document.getElementById('visitPrepTarget');if(target){if(record.targetType==='pq')target.value='pq::'+record.pq;else if(record.targetType==='step')target.value='step::'+encodeURIComponent(record.stepKey||'');else target.value='visit';}
    }
    async function deleteVisitPreparationRecord(id) {
        const visit=getVisitScopeRecord();if(!visit||!confirm('Bu hazırlık kaydını silmek istediğinize emin misiniz?'))return;
        const next=getVisitPreparationRecords(visit).filter(r=>r.id!==id);const actor=getCurrentVisitUser(),now=new Date().toISOString();
        const snapshots=buildVisitScopeSnapshots();
        const scope={pqs:snapshots.pqs,steps:snapshots.steps,projectionDate:(document.getElementById('visitScopeDueDate')||{}).value||'',updatedAt:now,updatedBy:actor,moduleVersion:'visit-package-2'};
        const preparation={...(visit.preparation||{}),general:getVisitGeneralPreparationFromForm(),records:next,updatedAt:now,updatedBy:actor,moduleVersion:'visit-package-2'};
        try{const removed=getVisitPreparationRecords(visit).find(r=>r.id===id)||{};const updates={};updates[`icao_visits/${visit.id}/scope`]=scope;updates[`icao_visits/${visit.id}/preparation`]=preparation;updates[`icao_visits/${visit.id}/updatedAt`]=now;updates[`icao_visits/${visit.id}/updatedBy`]=actor;updates[`icao_visits/${visit.id}/moduleVersion`]='visit-package-2';addVisitAuditToUpdates(updates,visit.id,'preparation_record',id,'delete',removed,{...removed,isDeleted:true},'Hazırlık kaydı silindi.',now,actor,{pq:removed.pq||'',step:removed.step||''});await db.ref().update(updates);}
        catch(error){console.error(error);alert('Hazırlık kaydı silinemedi: '+(error.message||error));}
    }
    function renderVisitPreparationPanel() {
        renderVisitPreparationTargetOptions();
        const list=document.getElementById('visitPreparationList');if(!list)return;
        const records=getVisitPreparationRecords(getVisitScopeRecord());updateVisitScopeKpis(buildVisitScopeCandidates());
        if(!records.length){list.innerHTML='<div class="visit-scope-empty">Henüz hazırlık kaydı yok.</div>';return;}
        const excerpt=r=>[r.questions&&`Sorular: ${r.questions}`,r.evidenceRequests&&`Kanıt: ${r.evidenceRequests}`,r.personsAuthorities&&`Kişi/Makam: ${r.personsAuthorities}`,r.verificationPoints&&`Doğrulama: ${r.verificationPoints}`,r.preliminaryAssessment&&`Ön değerlendirme: ${r.preliminaryAssessment}`,r.risks&&`Risk: ${r.risks}`,r.notes&&`Not: ${r.notes}`].filter(Boolean).join('\n');
        list.innerHTML=records.sort((a,b)=>String(a.targetLabel||'').localeCompare(String(b.targetLabel||''),'tr')).map(r=>`<div class="visit-prep-record"><div class="visit-prep-record-head"><div><div class="visit-prep-record-title">${escapeHtml(r.targetLabel||'Hazırlık kaydı')}</div><div class="visit-prep-record-meta">${escapeHtml(r.targetType==='step'?'CAP Adımı':r.targetType==='pq'?'PQ':'Ziyaret Geneli')} | Güncelleme: ${escapeHtml(formatVisitDate(r.updatedAt))}</div></div><div class="visit-prep-record-actions"><button type="button" class="btn-outline" onclick="editVisitPreparationRecord('${r.id}')">✏️</button><button type="button" style="background:var(--danger)" onclick="deleteVisitPreparationRecord('${r.id}')">🗑️</button></div></div><div class="visit-prep-record-body">${escapeHtml(excerpt(r)||'-')}</div></div>`).join('');
    }
    function buildVisitScopeExportBundle() {
        const visit=getVisitScopeRecord();if(!visit)return null;
        return {visit,scope:visit.scope||{pqs:[],steps:[]},general:((visit.preparation||{}).general)||{},records:getVisitPreparationRecords(visit)};
    }
    function buildVisitScopePqExportRows(bundle) {return visitArrayValue((bundle.scope||{}).pqs).map(x=>({'PQ':x.pq||'','Denetim Alanı':x.area||'','CE':x.ce||'','PQ Sorumlusu':x.responsible||'','Doğrulama Türü':x.verificationType||'','Standart Durum':x.statusLabel||'','PQ Sorusu (ENG)':fullTextForExcel(x.question||''),'PQ Sorusu (TR)':fullTextForExcel(x.questionTr||(pqMasterData[x.pq]||{}).soruTr||''),'ICAO Bulgusu (ENG)':fullTextForExcel(x.finding||''),'ICAO Bulgusu (TR)':fullTextForExcel(x.findingTr||(pqMasterData[x.pq]||{}).bulguTr||''),'İncelenecek Kanıtlar':fullTextForExcel(x.reviewEvidence||''),'Kaynak Rapor Tarihi':x.sourceReportDate||'','Anlık Görüntü Tarihi':x.snapshotAt||''}));}
    function buildVisitScopeStepExportRows(bundle) {return visitArrayValue((bundle.scope||{}).steps).map(x=>({'PQ':x.pq||'','Step':x.step||'','CAP Eylemi':fullTextForExcel(x.action||''),'Sorumlu Ofis':x.office||'','EVIDENCE REFERENCE':fullTextForExcel(x.evidenceReference||''),'Hedef Tarih':x.estDate||'','İlerleme':x.progress||'','Standart Durum':x.statusLabel||'','Gecikme Günü':x.delayDays||0,'Kaynak Dosya':x.sourceFile||'','Kaynak Rapor Tarihi':x.sourceReportDate||'','Anlık Görüntü Tarihi':x.snapshotAt||''}));}
    function buildVisitPreparationExportRows(bundle) {return (bundle.records||[]).map(x=>({'Hedef Türü':x.targetType==='step'?'CAP Adımı':x.targetType==='pq'?'PQ':'Ziyaret Geneli','Hedef':x.targetLabel||'','PQ':x.pq||'','Step':x.step||'','Sorulacak Sorular':fullTextForExcel(x.questions||''),'Talep/İncelenecek Kanıtlar':fullTextForExcel(x.evidenceRequests||''),'Görüşülecek Kişi/Danışılacak Makam':fullTextForExcel(x.personsAuthorities||''),'Doğrulanacak Hususlar':fullTextForExcel(x.verificationPoints||''),'Ön Değerlendirme':fullTextForExcel(x.preliminaryAssessment||''),'Riskli Konular':fullTextForExcel(x.risks||''),'Ziyaret Öncesi Not':fullTextForExcel(x.notes||''),'Son Güncelleme':x.updatedAt||''}));}
    function exportVisitScopeExcel() {
        const bundle=buildVisitScopeExportBundle();if(!bundle)return alert('Önce bir ziyaret seçiniz.');
        const pqRows=buildVisitScopePqExportRows(bundle),stepRows=buildVisitScopeStepExportRows(bundle),prepRows=buildVisitPreparationExportRows(bundle);
        if(!pqRows.length&&!stepRows.length&&!prepRows.length)return alert('Ziyaret kapsamında dışa aktarılacak kayıt bulunamadı. Önce kapsamı kaydediniz.');
        const v=bundle.visit,g=bundle.general||{};const wb=createReportWorkbook({title:'Ziyaret Kapsamı ve Hazırlık Çalışma Kâğıdı',subject:'USOAP CMA ziyaret hazırlığı'});
        addJsonSheet(wb,'Ziyaret_Ozeti',[{'Ziyaret':v.visitName||'','Durum':(VISIT_STATUSES[v.status]||{}).label||v.status||'','Alanlar':visitArrayValue(v.areas).join(', '),'Birimler':getVisitUnits(v).join(' | '),'Planlanan Tarih':formatVisitDateRange(v.plannedStart,v.plannedEnd),'Amaç':fullTextForExcel(v.objective||''),'Kapsamdaki PQ':pqRows.length,'Kapsamdaki CAP Adımı':stepRows.length,'Hazırlık Kaydı':prepRows.length,'Kapsam Tarihi':(bundle.scope||{}).projectionDate||''}]);
        addJsonSheet(wb,'Genel_Hazirlik',[{'Gündem / Çalışma Planı':fullTextForExcel(g.agenda||''),'Genel Sorular':fullTextForExcel(g.questions||''),'Genel Kanıt Talepleri':fullTextForExcel(g.evidenceRequests||''),'Görüşülecek Kişi/Makamlar':fullTextForExcel(g.personsAuthorities||''),'Genel Riskler':fullTextForExcel(g.risks||''),'Diğer Notlar':fullTextForExcel(g.notes||'')}]);
        addJsonSheet(wb,'PQ_Kapsami',pqRows);addJsonSheet(wb,'CAP_Adim_Kapsami',stepRows);addJsonSheet(wb,'Hazirlik_Kayitlari',prepRows);
        downloadReportWorkbook(wb,`Ziyaret_Kapsam_Hazirlik_${String(v.visitName||'Rapor').replace(/[^a-zA-Z0-9ğüşöçıİĞÜŞÖÇ]+/g,'_')}.xlsx`);
    }
    function buildVisitScopePdfDefinition(bundle) {
        const v=bundle.visit,g=bundle.general||{},pqRows=buildVisitScopePqExportRows(bundle),stepRows=buildVisitScopeStepExportRows(bundle),prepRows=buildVisitPreparationExportRows(bundle);
        const content=[{text:'Ziyaret Kapsamı ve Hazırlık Çalışma Kâğıdı',style:'header'},{text:`Ziyaret: ${v.visitName||'-'} | Planlanan tarih: ${formatVisitDateRange(v.plannedStart,v.plannedEnd)} | Alan: ${visitArrayValue(v.areas).join(', ')||'-'} | Birim: ${getVisitUnits(v).join(', ')||'-'}`,style:'subheader'}];
        content.push({text:'Ziyaret Özeti',style:'sectionHeader'},{table:{widths:[120,'*'],body:[[{text:'Amaç',bold:true,fillColor:'#f1f5f9'},fullTextForPdf(v.objective||'-')],[{text:'Kapsam',bold:true,fillColor:'#f1f5f9'},`${pqRows.length} PQ / ${stepRows.length} CAP adımı / ${prepRows.length} hazırlık kaydı`],[{text:'Kapsam tarihi',bold:true,fillColor:'#f1f5f9'},(bundle.scope||{}).projectionDate||'-']]},layout:'lightHorizontalLines',margin:[0,0,0,9]});
        content.push({text:'Genel Hazırlık',style:'sectionHeader'},{table:{widths:[120,'*'],body:[['Gündem',fullTextForPdf(g.agenda||'-')],['Genel sorular',fullTextForPdf(g.questions||'-')],['Kanıt talepleri',fullTextForPdf(g.evidenceRequests||'-')],['Kişi / makamlar',fullTextForPdf(g.personsAuthorities||'-')],['Riskler',fullTextForPdf(g.risks||'-')],['Diğer notlar',fullTextForPdf(g.notes||'-')]].map(r=>[{text:r[0],bold:true,fillColor:'#f1f5f9'},r[1]])},layout:'lightHorizontalLines',margin:[0,0,0,9]});
        content.push({text:'PQ Kapsamı',style:'sectionHeader'},...makePdfTableFromObjects(pqRows,[{key:'PQ',title:'PQ'},{key:'Denetim Alanı',title:'Alan'},{key:'CE',title:'CE'},{key:'Standart Durum',title:'Durum'},{key:'PQ Sorumlusu',title:'Sorumlu'},{key:'ICAO Bulgusu',title:'Bulgu / Açıklama'}],['auto','auto','auto','auto','auto','*'],{maxRows:500}));
        content.push({text:'CAP Adımı Kapsamı',style:'sectionHeader'});
        stepRows.forEach((r,i)=>{content.push({text:`${i+1}. PQ ${r['PQ']} / Step ${r['Step']} — ${r['Standart Durum']||'-'}`,style:'visitScopeItemTitle',pageBreak:i>0&&i%12===0?'before':undefined},{table:{widths:[105,'*'],body:[[{text:'CAP eylemi',bold:true,fillColor:'#f1f5f9'},fullTextForPdf(r['CAP Eylemi']||'-')],[{text:'Sorumlu ofis',bold:true,fillColor:'#f1f5f9'},fullTextForPdf(r['Sorumlu Ofis']||'-')],[{text:'Hedef tarih / ilerleme',bold:true,fillColor:'#f1f5f9'},`${r['Hedef Tarih']||'-'} / ${r['İlerleme']||'-'}`],[{text:'Kaynak',bold:true,fillColor:'#f1f5f9'},fullTextForPdf(r['Kaynak Dosya']||'-')]]},layout:'lightHorizontalLines',margin:[0,0,0,7]});});
        content.push({text:'PQ / CAP Özel Hazırlık Kayıtları',style:'sectionHeader'});
        prepRows.forEach((r,i)=>{content.push({text:`${i+1}. ${r['Hedef']||'-'}`,style:'visitScopeItemTitle'},{table:{widths:[120,'*'],body:[['Sorulacak sorular',r['Sorulacak Sorular']],['Talep / incelenecek kanıtlar',r['Talep/İncelenecek Kanıtlar']],['Kişi / danışılacak makam',r['Görüşülecek Kişi/Danışılacak Makam']],['Doğrulanacak hususlar',r['Doğrulanacak Hususlar']],['Ön değerlendirme',r['Ön Değerlendirme']],['Riskli konular',r['Riskli Konular']],['Ziyaret öncesi not',r['Ziyaret Öncesi Not']]].map(x=>[{text:x[0],bold:true,fillColor:'#f1f5f9'},fullTextForPdf(x[1]||'-')])},layout:'lightHorizontalLines',margin:[0,0,0,7]});});
        return createStandardPdfDefinition(content,{pageOrientation:'landscape',pageSize:'A4',styles:{visitScopeItemTitle:{fontSize:9,bold:true,color:'#1d4ed8',margin:[0,6,0,3]}},defaultStyle:{font:'Roboto',fontSize:7.8}});
    }
    function exportVisitScopePDF() {
        const bundle=buildVisitScopeExportBundle();if(!bundle)return alert('Önce bir ziyaret seçiniz.');
        const pqCount=visitArrayValue((bundle.scope||{}).pqs).length,stepCount=visitArrayValue((bundle.scope||{}).steps).length;
        if(!pqCount&&!stepCount&&!bundle.records.length)return alert('Ziyaret kapsamında dışa aktarılacak kayıt bulunamadı. Önce kapsamı kaydediniz.');
        try{return safeDownloadPdf(buildVisitScopePdfDefinition(bundle),'Ziyaret_Kapsam_Hazirlik_Calisma_Kagidi.pdf');}
        catch(error){console.error(error);alert('Ziyaret çalışma kâğıdı PDF raporu hazırlanamadı: '+(error.message||error));}
    }
    window.runVisitPackage2SelfCheck=function(){const funcs=['renderVisitScopeModule','saveVisitScopeAndGeneralPreparation','saveVisitPreparationRecord','exportVisitScopePDF','exportVisitScopeExcel'];const result={passed:funcs.every(n=>typeof window[n]==='function'||typeof eval(n)==='function'),functions:Object.fromEntries(funcs.map(n=>[n,typeof window[n]==='function'||typeof eval(n)==='function'])),visits:getVisitRecords().length,activeVisit:!!getVisitScopeRecord()};console.log('Ziyaret Paket 2 öz denetimi:',result);return result;};


    // ZİYARET VE İÇ DENETİM - PAKET 3: ZİYARET ÇALIŞMA ALANI
    const VISIT_FIELD_NOTE_TYPES = {
        general_note:'Genel not', interview_note:'Görüşme notu', evidence_reviewed:'Kanıt incelendi', evidence_request:'Kanıt talebi',
        explanation_request:'Açıklama talebi', follow_up_action:'Takip aksiyonu', improvement:'İyileştirme fırsatı',
        nonconformity_risk:'Uyumsuzluk riski', internal_finding:'İç denetim bulgusu', decision_required:'Karar gerektiren husus',
        consultation:'Danışılması gereken konu', positive_practice:'Olumlu uygulama', closing_assessment:'Kapanış değerlendirmesi'
    };
    const VISIT_EVIDENCE_STATUSES = {
        not_reviewed:'İncelenmedi', requested:'Talep edildi', partially_sufficient:'Kısmen yeterli', sufficient:'Yeterli',
        insufficient:'Yetersiz', update_required:'Güncelleme gerekli', verification_pending:'Doğrulama bekliyor'
    };
    const VISIT_FIELD_PRIORITIES = {critical:'Kritik',high:'Yüksek',medium:'Orta',low:'Düşük',info:'Bilgi amaçlı'};
    const VISIT_FIELD_RECORD_STATUSES = {draft:'Taslak',open:'Açık',waiting:'Bilgi / kanıt bekleniyor',evaluation:'Değerlendirmede',completed:'Tamamlandı',cancelled:'İptal edildi'};

    function getVisitWorkspaceVisit() {
        const id = activeVisitWorkspaceId || ((document.getElementById('visitWorkspaceVisitSelect') || {}).value || '');
        return id && icaoVisits[id] && !icaoVisits[id].isDeleted && !isIcaoOfficialVisit(icaoVisits[id]) ? {id,...icaoVisits[id]} : null;
    }
    function getVisitFieldworkRecords(visit, includeDeleted = false) {
        const records = visitArrayValue((((visit || {}).fieldwork || {}).records)).map(r => ({...(r || {})}));
        return records.filter(r => includeDeleted || !r.isDeleted).sort((a,b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
    }
    function getVisitWorkspaceTargets(visit) {
        if (!visit) return [];
        const targets = [{type:'visit',key:'visit',label:'Ziyaret geneli',pq:'',step:'',snapshot:{visitName:visit.visitName||'',areas:visitArrayValue(visit.areas),units:getVisitUnits(visit)}}];
        const pqs = getVisitScopeStoredPqs(visit);
        const steps = getVisitScopeStoredSteps(visit);
        pqs.forEach(pq => targets.push({type:'pq',key:String(pq.pq||''),label:`PQ ${pq.pq||'-'} — ${pq.area||'-'}`,pq:String(pq.pq||''),step:'',snapshot:{...pq}}));
        steps.forEach(step => targets.push({type:'step',key:String(step.key||visitScopeStepKey(step)),label:`PQ ${step.pq||'-'} / Step ${step.step||'-'}`,pq:String(step.pq||''),step:String(step.step||''),snapshot:{...step}}));
        return targets;
    }
    function visitWorkspaceTargetStatusClass(target) {
        const code = String(((target || {}).snapshot || {}).statusCode || '');
        if (code === COMMON_ACTION_STATUS.LATE.code) return 'late';
        if (code === COMMON_ACTION_STATUS.DATE_RISK.code) return 'date-risk';
        if (code === COMMON_ACTION_STATUS.COMPLETED.code) return 'done';
        return '';
    }
    function renderVisitWorkspaceModule(forceReload = false) {
        const select = document.getElementById('visitWorkspaceVisitSelect');
        if (!select) return;
        populateVisitWorkspaceControls();
        const visits = getInternalWorkflowVisitRecords().sort((a,b) => String(a.visitName||'').localeCompare(String(b.visitName||''),'tr'));
        const desired = activeVisitWorkspaceId || select.value || '';
        select.innerHTML = '<option value="">Bir ziyaret seçiniz...</option>' + visits.map(v => {
            const scopeCount = getVisitScopeStoredPqs(v).length;
            return `<option value="${escapeHtml(v.id)}">${escapeHtml(v.visitName||'Adsız ziyaret')} — ${scopeCount} PQ — ${escapeHtml(formatVisitDateRange(v.plannedStart,v.plannedEnd))}</option>`;
        }).join('');
        if (desired && visits.some(v=>v.id===desired)) select.value=desired;
        else if (forceReload && visits.length===1) select.value=visits[0].id;
        if (select.value && (forceReload || activeVisitWorkspaceId !== select.value)) loadVisitWorkspaceSelection(select.value,true);
        else if (!select.value) {
            activeVisitWorkspaceId=null; activeVisitWorkspaceTarget={type:'visit',key:'visit',label:'Ziyaret geneli',pq:'',step:'',snapshot:null};
            renderVisitWorkspaceTargets(); renderVisitWorkspaceRecords(); updateVisitWorkspaceKpis();
        } else {
            activeVisitWorkspaceId=select.value; renderVisitWorkspaceTargets(); renderVisitWorkspaceRecords(); updateVisitWorkspaceKpis(); renderVisitWorkspaceSelectedTarget();
        }
    }
    function populateVisitWorkspaceControls() {
        const fill = (id, map, allLabel) => {
            const el=document.getElementById(id); if(!el)return; const current=el.value;
            el.innerHTML=(allLabel?`<option value="all">${allLabel}</option>`:'')+Object.entries(map).map(([k,v])=>`<option value="${k}">${escapeHtml(v)}</option>`).join('');
            if(current && Array.from(el.options).some(o=>o.value===current))el.value=current;
        };
        fill('visitWorkspaceNoteType',VISIT_FIELD_NOTE_TYPES,''); fill('visitWorkspacePriority',VISIT_FIELD_PRIORITIES,''); fill('visitWorkspaceRecordStatus',VISIT_FIELD_RECORD_STATUSES,''); fill('visitWorkspaceEvidenceStatus',VISIT_EVIDENCE_STATUSES,'');
        fill('visitWorkNoteTypeFilter',VISIT_FIELD_NOTE_TYPES,'Tümü'); fill('visitWorkPriorityFilter',VISIT_FIELD_PRIORITIES,'Tümü'); fill('visitWorkStatusFilter',VISIT_FIELD_RECORD_STATUSES,'Tümü');
        const defaults={visitWorkspaceNoteType:'general_note',visitWorkspacePriority:'medium',visitWorkspaceRecordStatus:'open',visitWorkspaceEvidenceStatus:'not_reviewed'};
        Object.entries(defaults).forEach(([id,val])=>{const el=document.getElementById(id);if(el&&!el.value)el.value=val;});
    }
    function loadVisitWorkspaceSelection(id, silent = false) {
        activeVisitWorkspaceId=id||null;
        activeVisitWorkspaceTarget={type:'visit',key:'visit',label:'Ziyaret geneli',pq:'',step:'',snapshot:null};
        resetVisitWorkspaceForm(false);
        const visit=getVisitWorkspaceVisit();
        const note=document.getElementById('visitWorkspaceSyncNote');
        if(note) note.textContent=visit?`Seçili ziyaret: ${visit.visitName||'Adsız ziyaret'} | Kapsam: ${getVisitScopeStoredPqs(visit).length} PQ / ${getVisitScopeStoredSteps(visit).length} CAP adımı | Birim: ${getVisitUnits(visit).join(', ')||'-'}`:'Çalışma alanını kullanmak için bir ziyaret seçiniz.';
        renderVisitWorkspaceTargets(); renderVisitWorkspaceSelectedTarget(); renderVisitWorkspaceRecords(); updateVisitWorkspaceKpis(); restoreVisitWorkspaceDraft();
        if(!silent && id && !visit)alert('Seçilen ziyaret kaydı bulunamadı.');
    }
    function renderVisitWorkspaceTargets() {
        const list=document.getElementById('visitWorkspaceTargetList'); if(!list)return;
        const visit=getVisitWorkspaceVisit();
        if(!visit){list.innerHTML='<div class="visit-work-empty">Önce bir ziyaret seçiniz.</div>'; const c=document.getElementById('visitWorkspaceTargetCount');if(c)c.textContent='0 hedef';return;}
        const q=((document.getElementById('visitWorkspaceTargetSearch')||{}).value||'').trim().toLocaleLowerCase('tr');
        const targets=getVisitWorkspaceTargets(visit).filter(t=>{
            const snap=t.snapshot||{};return !q||[t.label,t.pq,t.step,snap.action,snap.office,snap.finding,snap.question].join(' ').toLocaleLowerCase('tr').includes(q);
        });
        const count=document.getElementById('visitWorkspaceTargetCount');if(count)count.textContent=`${targets.length} hedef`;
        list.innerHTML=targets.length?targets.map(t=>{
            const active=activeVisitWorkspaceTarget&&activeVisitWorkspaceTarget.type===t.type&&activeVisitWorkspaceTarget.key===t.key;
            const snap=t.snapshot||{}; const meta=t.type==='visit'?`${visitArrayValue(visit.areas).join(', ')||'-'} | ${getVisitUnits(visit).join(', ')||'-'}`:t.type==='pq'?`${snap.statusLabel||'-'} | ${shortenVisitText(snap.finding||snap.question||'',130)}`:`${snap.office||'Ofis yok'} | ${snap.estDate||'Tarih yok'} | ${snap.statusLabel||'-'}`;
            const encodedKey=encodeURIComponent(String(t.key||''));
            return `<button type="button" class="visit-work-target ${t.type==='step'?'step ':''}${visitWorkspaceTargetStatusClass(t)} ${active?'active':''}" data-visit-target-type="${escapeHtml(t.type)}" data-visit-target-key="${escapeHtml(encodedKey)}"><div class="visit-work-target-title">${escapeHtml(t.label)}</div><div class="visit-work-target-meta">${escapeHtml(meta)}</div></button>`;
        }).join(''):'<div class="visit-work-empty">Arama ölçütüne uygun kapsam kaydı bulunamadı.</div>';
        list.querySelectorAll('.visit-work-target[data-visit-target-key]').forEach(button=>{
            button.addEventListener('click',event=>{
                event.preventDefault();
                selectVisitWorkspaceTarget(button.dataset.visitTargetType||'',button.dataset.visitTargetKey||'');
            });
        });
    }
    function selectVisitWorkspaceTarget(type, encodedKey) {
        const visit=getVisitWorkspaceVisit();if(!visit)return alert('Önce bir ziyaret seçiniz.');
        const key=decodeURIComponent(encodedKey||''); const target=getVisitWorkspaceTargets(visit).find(t=>t.type===type&&t.key===key);
        if(!target)return alert('Seçilen ziyaret hedefi bulunamadı.');
        activeVisitWorkspaceTarget=target; resetVisitWorkspaceForm(false); renderVisitWorkspaceTargets(); renderVisitWorkspaceSelectedTarget(); renderVisitWorkspacePqReference(); restoreVisitWorkspaceDraft();
    }
    function renderVisitWorkspaceSelectedTarget() {
        const el=document.getElementById('visitWorkspaceSelectedTarget'); if(el)el.innerHTML=`<b>Seçili hedef:</b> ${escapeHtml((activeVisitWorkspaceTarget||{}).label||'Ziyaret geneli')}`;
        const prepEl=document.getElementById('visitWorkspacePrepContext'); if(!prepEl)return;
        const visit=getVisitWorkspaceVisit(); const prep=getVisitPreparationRecords(visit).filter(r=>{
            if(!activeVisitWorkspaceTarget||activeVisitWorkspaceTarget.type==='visit')return r.targetType==='visit';
            if(activeVisitWorkspaceTarget.type==='pq')return r.targetType==='pq'&&String(r.pq||'')===activeVisitWorkspaceTarget.pq;
            return r.targetType==='step'&&String(r.stepKey||r.targetKey||'')===activeVisitWorkspaceTarget.key;
        });
        if(!prep.length){prepEl.style.display='none';prepEl.textContent='';return;}
        prepEl.style.display='block';prepEl.textContent='Hazırlık kaydı:\n'+prep.map((r,i)=>`${i+1}. ${(r.questions||r.evidenceRequests||r.verificationPoints||r.notes||'').trim()}`).join('\n');
    }
    function getVisitWorkspaceDraftKey() {
        const t=activeVisitWorkspaceTarget||{};return activeVisitWorkspaceId?`visit_fieldwork_draft_${activeVisitWorkspaceId}_${t.type}_${encodeURIComponent(t.key||'visit')}`:'';
    }
    function collectVisitWorkspaceFormData() {
        return {
            noteType:(document.getElementById('visitWorkspaceNoteType')||{}).value||'general_note',priority:(document.getElementById('visitWorkspacePriority')||{}).value||'medium',
            status:(document.getElementById('visitWorkspaceRecordStatus')||{}).value||'open',evidenceStatus:(document.getElementById('visitWorkspaceEvidenceStatus')||{}).value||'not_reviewed',
            noteText:((document.getElementById('visitWorkspaceNote')||{}).value||'').trim(),evidenceReviewed:((document.getElementById('visitWorkspaceEvidence')||{}).value||'').trim(),
            assessment:((document.getElementById('visitWorkspaceAssessment')||{}).value||'').trim(),actionOwner:((document.getElementById('visitWorkspaceOwner')||{}).value||'').trim(),
            expectedOutput:((document.getElementById('visitWorkspaceExpectedOutput')||{}).value||'').trim(),consultAuthority:((document.getElementById('visitWorkspaceConsultAuthority')||{}).value||'').trim(),
            consultationTopic:((document.getElementById('visitWorkspaceConsultTopic')||{}).value||'').trim(),followUpRequired:!!((document.getElementById('visitWorkspaceFollowRequired')||{}).checked),
            followUpDate:((document.getElementById('visitWorkspaceFollowDate')||{}).value||'')
        };
    }
    function scheduleVisitWorkspaceDraftSave() {
        clearTimeout(visitWorkspaceDraftTimer); visitWorkspaceDraftTimer=setTimeout(()=>{
            const key=getVisitWorkspaceDraftKey(); const id=((document.getElementById('visitWorkspaceRecordId')||{}).value||''); if(!key||id)return;
            try{localStorage.setItem(key,JSON.stringify({...collectVisitWorkspaceFormData(),savedAt:new Date().toISOString()}));const n=document.getElementById('visitWorkspaceDraftNote');if(n)n.textContent='Taslak bu tarayıcıda geçici olarak kaydedildi.';}catch(e){console.warn(e);}
        },450);
    }
    function restoreVisitWorkspaceDraft() {
        const id=((document.getElementById('visitWorkspaceRecordId')||{}).value||'');if(id)return;
        const key=getVisitWorkspaceDraftKey();if(!key)return;let data=null;try{data=JSON.parse(localStorage.getItem(key)||'null');}catch(e){}
        if(!data)return; setVisitWorkspaceFormData(data);const n=document.getElementById('visitWorkspaceDraftNote');if(n)n.textContent='Bu hedef için tarayıcıda saklanan taslak geri yüklendi.';
    }
    function clearVisitWorkspaceDraft(){const key=getVisitWorkspaceDraftKey();if(key)try{localStorage.removeItem(key)}catch(e){}}
    function setVisitWorkspaceFormData(data) {
        const set=(id,v)=>{const el=document.getElementById(id);if(el)el.value=v||'';};
        set('visitWorkspaceNoteType',data.noteType||'general_note');set('visitWorkspacePriority',data.priority||'medium');set('visitWorkspaceRecordStatus',data.status||'open');set('visitWorkspaceEvidenceStatus',data.evidenceStatus||'not_reviewed');set('visitWorkspaceNote',data.noteText);set('visitWorkspaceEvidence',data.evidenceReviewed);set('visitWorkspaceAssessment',data.assessment);set('visitWorkspaceOwner',data.actionOwner);set('visitWorkspaceExpectedOutput',data.expectedOutput);set('visitWorkspaceConsultAuthority',data.consultAuthority);set('visitWorkspaceConsultTopic',data.consultationTopic);set('visitWorkspaceFollowDate',data.followUpDate);
        const cb=document.getElementById('visitWorkspaceFollowRequired');if(cb)cb.checked=!!data.followUpRequired;toggleVisitWorkspaceFollowDate();
    }
    function toggleVisitWorkspaceFollowDate(){const cb=document.getElementById('visitWorkspaceFollowRequired'),d=document.getElementById('visitWorkspaceFollowDate'),section=document.getElementById('visitWorkspaceFollowSection');const enabled=!!(cb&&cb.checked);if(d){d.disabled=!enabled;d.required=enabled;}if(section)section.classList.toggle('follow-enabled',enabled);}
    function scrollVisitWorkspaceToFollowUp(){const section=document.getElementById('visitWorkspaceFollowSection');if(section){section.scrollIntoView({behavior:'smooth',block:'center'});setTimeout(()=>{const cb=document.getElementById('visitWorkspaceFollowRequired');if(cb)cb.focus({preventScroll:true});},350);}}
    function resetVisitWorkspaceForm(clearDraft = true) {
        const form=document.getElementById('visitWorkspaceForm');if(form)form.reset();
        const id=document.getElementById('visitWorkspaceRecordId');if(id)id.value='';populateVisitWorkspaceControls();toggleVisitWorkspaceFollowDate();if(clearDraft)clearVisitWorkspaceDraft();
        const n=document.getElementById('visitWorkspaceDraftNote');if(n)n.textContent='Bağlantı kesintisine karşı form taslağı bu tarayıcıda geçici olarak saklanır.';
        if(clearDraft) setVisitWorkspaceSaveStatus('');
    }
    function setVisitWorkspaceSaveStatus(message, type = 'info', autoHideMs = 0) {
        const el = document.getElementById('visitWorkspaceSaveStatus');
        if (!el) return;
        clearTimeout(el._hideTimer);
        el.textContent = message || '';
        el.className = 'visit-work-save-status' + (message ? ' show ' + type : '');
        if (message && autoHideMs > 0) {
            el._hideTimer = setTimeout(() => {
                el.textContent = '';
                el.className = 'visit-work-save-status';
            }, autoHideMs);
        }
    }
    async function saveVisitWorkspaceRecord(event) {
        if (event) event.preventDefault();
        const visit = getVisitWorkspaceVisit();
        if (!visit) return alert('Önce bir ziyaret seçiniz.');

        const data = collectVisitWorkspaceFormData();
        if (!data.noteText) return alert('Not / tespit / açıklama alanını doldurunuz.');
        if (data.followUpRequired && !data.followUpDate) return alert('Takip gerekli seçildiğinde takip tarihi girilmelidir.');

        const existingId = ((document.getElementById('visitWorkspaceRecordId') || {}).value || '');
        const isUpdate = !!existingId;
        setVisitWorkspaceSaveStatus(isUpdate ? 'Saha kaydı güncelleniyor…' : 'Saha kaydı Firebase’e kaydediliyor…', 'info');

        try {
            if (!window.firebase || !firebase.database || !db || typeof db.ref !== 'function') {
                throw new Error('Firebase veritabanı bağlantısı hazır değil.');
            }
            const currentUser = firebase.auth && firebase.auth().currentUser;
            if (!currentUser) {
                throw new Error('Firebase oturumu bulunamadı. Lütfen yeniden giriş yapınız.');
            }
            if (navigator.onLine === false) {
                throw new Error('İnternet bağlantısı yok. Kayıt yalnızca tarayıcı taslağında tutuluyor.');
            }
            if (typeof window.visitFirebaseSafeValue !== 'function') {
                throw new Error('Firebase veri temizleme yardımcısı yüklenemedi. Sayfayı yenileyip tekrar deneyiniz.');
            }

            const records = getVisitFieldworkRecords(visit, true);
            const existing = records.find(r => r.id === existingId) || {};
            const recordsRef = db.ref(`icao_visits/${visit.id}/fieldwork/records`);
            const id = existingId || recordsRef.push().key;
            if (!id) throw new Error('Firebase kayıt kimliği oluşturulamadı.');

            const now = new Date().toISOString();
            const actor = getCurrentVisitUser();
            const target = activeVisitWorkspaceTarget || {type:'visit', key:'visit', label:'Ziyaret geneli'};
            const record = window.visitFirebaseSafeValue({
                ...existing,
                id,
                targetType: target.type,
                targetKey: target.key,
                targetLabel: target.label,
                pq: target.pq || '',
                step: target.step || '',
                targetSnapshot: window.visitFirebaseSafeValue(target.snapshot || null),
                ...data,
                isDeleted: false,
                createdAt: existing.createdAt || now,
                createdBy: existing.createdBy || actor,
                updatedAt: now,
                updatedBy: actor,
                moduleVersion: 'visit-package-3'
            });

            const updates = {};
            updates[`icao_visits/${visit.id}/fieldwork/records/${id}`] = record;
            updates[`icao_visits/${visit.id}/fieldwork/updatedAt`] = now;
            updates[`icao_visits/${visit.id}/fieldwork/updatedBy`] = actor;
            updates[`icao_visits/${visit.id}/fieldwork/moduleVersion`] = 'visit-package-3';
            addVisitAuditToUpdates(
                updates,
                visit.id,
                'fieldwork',
                id,
                isUpdate ? 'update' : 'create',
                existing,
                record,
                isUpdate ? 'Saha kaydı güncellendi.' : 'Yeni saha kaydı oluşturuldu.',
                now,
                actor,
                {pq: record.pq || '', step: record.step || ''}
            );

            const cleanUpdates = window.visitFirebaseSafeValue(updates);
            showLoading();
            await db.ref().update(cleanUpdates);

            // Başarı mesajını yalnızca kayıt Firebase'den geri okunabildiğinde göster.
            const verifySnapshot = await db.ref(`icao_visits/${visit.id}/fieldwork/records/${id}`).once('value');
            const savedRecord = verifySnapshot.val();
            if (!savedRecord) {
                throw new Error('Kayıt Firebase üzerinde doğrulanamadı.');
            }
            if (String(savedRecord.updatedAt || '') !== String(now)) {
                throw new Error('Firebase doğrulamasında güncel kayıt sürümü okunamadı.');
            }

            clearVisitWorkspaceDraft();
            resetVisitWorkspaceForm(false);
            const successMessage = isUpdate ? 'Saha kaydı Firebase üzerinde başarıyla güncellendi.' : 'Saha kaydı Firebase üzerinde başarıyla kaydedildi.';
            setVisitWorkspaceSaveStatus(successMessage + '  ' + new Date().toLocaleTimeString('tr-TR', {hour:'2-digit', minute:'2-digit'}), 'success', 10000);
            if (typeof showAppRuntimeToast === 'function') showAppRuntimeToast(successMessage, 'success');
        } catch (e) {
            console.error('Saha kaydı Firebase yazma hatası:', e);
            const errorMessage = 'Saha kaydı Firebase’e kaydedilemedi: ' + (e.message || e);
            setVisitWorkspaceSaveStatus(errorMessage, 'error');
            if (typeof showAppRuntimeToast === 'function') showAppRuntimeToast(errorMessage, 'error');
            else alert(errorMessage);
        } finally {
            hideLoading();
        }
    }
    function editVisitWorkspaceRecord(id) {
        const visit=getVisitWorkspaceVisit();const rec=getVisitFieldworkRecords(visit,true).find(r=>r.id===id);if(!rec)return alert('Kayıt bulunamadı.');
        const target=getVisitWorkspaceTargets(visit).find(t=>t.type===rec.targetType&&t.key===rec.targetKey);if(target)activeVisitWorkspaceTarget=target;
        const el=document.getElementById('visitWorkspaceRecordId');if(el)el.value=id;setVisitWorkspaceFormData(rec);renderVisitWorkspaceTargets();renderVisitWorkspaceSelectedTarget();document.getElementById('visitWorkspaceForm').scrollIntoView({behavior:'smooth',block:'start'});
    }
    async function deleteVisitWorkspaceRecord(id) {
        const visit=getVisitWorkspaceVisit();if(!visit||!confirm('Bu saha kaydı silinmiş olarak işaretlensin mi?'))return;const now=new Date().toISOString();const actor=getCurrentVisitUser();
        try{const before=getVisitFieldworkRecords(visit,true).find(r=>r.id===id)||{};const after={...before,isDeleted:true,deletedAt:now,deletedBy:actor,updatedAt:now,updatedBy:actor};const updates={};['isDeleted','deletedAt','deletedBy','updatedAt','updatedBy'].forEach(k=>updates[`icao_visits/${visit.id}/fieldwork/records/${id}/${k}`]=after[k]);addVisitAuditToUpdates(updates,visit.id,'fieldwork',id,'delete',before,after,'Saha kaydı silinmiş olarak işaretlendi.',now,actor,{pq:before.pq||'',step:before.step||''});await db.ref().update(updates);}
        catch(e){console.error(e);alert('Kayıt silinemedi: '+(e.message||e));}
    }
    function getFilteredVisitWorkspaceRecords() {
        const visit=getVisitWorkspaceVisit();let rows=getVisitFieldworkRecords(visit);const view=(document.getElementById('visitWorkspaceViewFilter')||{}).value||'all';const nt=(document.getElementById('visitWorkNoteTypeFilter')||{}).value||'all';const pr=(document.getElementById('visitWorkPriorityFilter')||{}).value||'all';const st=(document.getElementById('visitWorkStatusFilter')||{}).value||'all';const q=((document.getElementById('visitWorkSearch')||{}).value||'').trim().toLocaleLowerCase('tr');
        rows=rows.filter(r=>{
            if(view==='follow_up'&&!(r.followUpRequired&&r.status!=='completed'&&r.status!=='cancelled'))return false;
            if(view==='consultation'&&!String(r.consultAuthority||r.consultationTopic||'').trim())return false;
            if(view==='evidence_issue'&&!['insufficient','partially_sufficient','update_required','verification_pending','requested'].includes(r.evidenceStatus))return false;
            if(view==='open'&&['completed','cancelled'].includes(r.status))return false;
            if(nt!=='all'&&r.noteType!==nt)return false;if(pr!=='all'&&r.priority!==pr)return false;if(st!=='all'&&r.status!==st)return false;
            if(q&&!([r.targetLabel,r.pq,r.step,r.noteText,r.evidenceReviewed,r.assessment,r.actionOwner,r.consultAuthority,r.consultationTopic].join(' ').toLocaleLowerCase('tr').includes(q)))return false;return true;
        });return rows;
    }
    function renderVisitWorkspaceRecords() {
        const list=document.getElementById('visitWorkspaceRecordList');if(!list)return;const visit=getVisitWorkspaceVisit();if(!visit){list.innerHTML='<div class="visit-work-empty">Önce bir ziyaret seçiniz.</div>';updateVisitWorkspaceKpis();return;}
        const rows=getFilteredVisitWorkspaceRecords();list.innerHTML=rows.length?rows.map(r=>{
            const extras=[];if(r.evidenceReviewed||r.evidenceStatus)extras.push(`<div><b>Kanıt:</b> ${escapeHtml(VISIT_EVIDENCE_STATUSES[r.evidenceStatus]||r.evidenceStatus||'-')}<br>${escapeHtml(shortenVisitText(r.evidenceReviewed||'',180))}</div>`);if(r.followUpRequired)extras.push(`<div><b>Takip:</b> ${escapeHtml(formatVisitDate(r.followUpDate))}<br>${escapeHtml(r.actionOwner||'Sorumlu belirtilmedi')}</div>`);if(r.consultAuthority||r.consultationTopic)extras.push(`<div><b>Danışma:</b> ${escapeHtml(r.consultAuthority||'-')}<br>${escapeHtml(r.consultationTopic||'')}</div>`);if(r.expectedOutput)extras.push(`<div><b>Beklenen çıktı:</b><br>${escapeHtml(r.expectedOutput)}</div>`);
            const actor=(r.updatedBy||{}).displayName||(r.updatedBy||{}).email||'';
            return `<article class="visit-work-record ${escapeHtml(r.priority||'medium')}"><div class="visit-work-record-head"><div><div class="visit-work-record-title">${escapeHtml(r.targetLabel||'Ziyaret geneli')} — ${escapeHtml(VISIT_FIELD_NOTE_TYPES[r.noteType]||r.noteType||'Not')}</div><div class="visit-work-record-meta">${escapeHtml(VISIT_FIELD_PRIORITIES[r.priority]||r.priority||'-')} | ${escapeHtml(VISIT_FIELD_RECORD_STATUSES[r.status]||r.status||'-')} | ${escapeHtml(formatVisitDate(r.updatedAt))}${actor?' | '+escapeHtml(actor):''}</div></div><div class="visit-work-record-actions"><button type="button" class="btn-outline" onclick="editVisitWorkspaceRecord('${r.id}')">Düzenle</button><button type="button" class="btn-outline" onclick="deleteVisitWorkspaceRecord('${r.id}')">Sil</button></div></div><div class="visit-work-record-body">${escapeHtml(r.noteText||'')}</div>${r.assessment?`<div class="visit-work-record-body"><b>Değerlendirme:</b> ${escapeHtml(r.assessment)}</div>`:''}${extras.length?`<div class="visit-work-record-extra">${extras.join('')}</div>`:''}</article>`;
        }).join(''):'<div class="visit-work-empty">Seçili ölçütlere uygun saha kaydı bulunamadı.</div>';updateVisitWorkspaceKpis();
    }
    function updateVisitWorkspaceKpis() {
        const rows=getVisitFieldworkRecords(getVisitWorkspaceVisit());const values={visitWorkKpiTotal:rows.length,visitWorkKpiFollow:rows.filter(r=>r.followUpRequired&&!['completed','cancelled'].includes(r.status)).length,visitWorkKpiEvidence:rows.filter(r=>['insufficient','partially_sufficient','update_required','verification_pending'].includes(r.evidenceStatus)).length,visitWorkKpiConsult:rows.filter(r=>String(r.consultAuthority||r.consultationTopic||'').trim()).length,visitWorkKpiDone:rows.filter(r=>r.status==='completed').length};Object.entries(values).forEach(([id,v])=>{const el=document.getElementById(id);if(el)el.textContent=v;});
    }
    function clearVisitWorkspaceFilters(){['visitWorkspaceViewFilter','visitWorkNoteTypeFilter','visitWorkPriorityFilter','visitWorkStatusFilter'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='all';});const q=document.getElementById('visitWorkSearch');if(q)q.value='';renderVisitWorkspaceRecords();}
    function buildVisitWorkspaceExportBundle(){const visit=getVisitWorkspaceVisit();if(!visit)return null;return{visit,records:getVisitFieldworkRecords(visit),scope:visit.scope||{},preparation:visit.preparation||{}};}
    function visitPdfNumberParts(value){
        const match=String(value??'').match(/\d+(?:\.\d+)*/);if(!match)return [Number.MAX_SAFE_INTEGER];
        return match[0].split('.').map(part=>Number(part));
    }
    function compareVisitPdfNumberValues(a,b){
        const aa=visitPdfNumberParts(a),bb=visitPdfNumberParts(b),len=Math.max(aa.length,bb.length);
        for(let i=0;i<len;i++){const av=aa[i]??0,bv=bb[i]??0;if(av!==bv)return av-bv;}return 0;
    }
    function visitPdfTargetRank(record){
        const type=String((record||{}).targetType||'').toLowerCase();
        if(type==='visit'||(!record?.pq&&type!=='pq'&&type!=='step'))return 0;
        if(type==='pq')return 1;
        if(type==='step')return 2;
        return record?.pq?2:3;
    }
    function compareVisitPdfRecords(a,b,{groupByVisit=false}={}){
        if(groupByVisit){
            const visitCmp=String(a?.visitName||'').localeCompare(String(b?.visitName||''),'tr',{numeric:true,sensitivity:'base'});
            if(visitCmp)return visitCmp;
        }
        const rankCmp=visitPdfTargetRank(a)-visitPdfTargetRank(b);if(rankCmp)return rankCmp;
        const pqCmp=compareVisitPdfNumberValues(a?.pq||a?.targetLabel||'',b?.pq||b?.targetLabel||'');if(pqCmp)return pqCmp;
        const stepCmp=compareVisitPdfNumberValues(a?.step||'',b?.step||'');if(stepCmp)return stepCmp;
        const dateA=Date.parse(a?.createdAt||a?.updatedAt||'')||0,dateB=Date.parse(b?.createdAt||b?.updatedAt||'')||0;
        if(dateA!==dateB)return dateA-dateB;
        return String(a?.targetLabel||'').localeCompare(String(b?.targetLabel||''),'tr',{numeric:true,sensitivity:'base'});
    }
    function sortVisitPdfRecords(records,options={}){return [...(records||[])].sort((a,b)=>compareVisitPdfRecords(a,b,options));}
    function sortVisitPdfPqs(records){return [...(records||[])].sort((a,b)=>compareVisitPdfNumberValues(a?.pq||'',b?.pq||'')||String(a?.visitName||'').localeCompare(String(b?.visitName||''),'tr',{numeric:true,sensitivity:'base'}));}
    function sortVisitPdfSteps(records){return [...(records||[])].sort((a,b)=>compareVisitPdfNumberValues(a?.pq||'',b?.pq||'')||compareVisitPdfNumberValues(a?.step||'',b?.step||'')||String(a?.visitName||'').localeCompare(String(b?.visitName||''),'tr',{numeric:true,sensitivity:'base'}));}
    function buildVisitWorkspaceExportRows(bundle){return (bundle.records||[]).map(r=>({'Hedef Türü':r.targetType==='step'?'CAP Adımı':r.targetType==='pq'?'PQ':'Ziyaret Geneli','Hedef':r.targetLabel||'','PQ':r.pq||'','Step':r.step||'','Not Türü':VISIT_FIELD_NOTE_TYPES[r.noteType]||r.noteType||'','Öncelik':VISIT_FIELD_PRIORITIES[r.priority]||r.priority||'','Kayıt Durumu':VISIT_FIELD_RECORD_STATUSES[r.status]||r.status||'','Not / Tespit':fullTextForExcel(r.noteText||''),'İncelenen / Talep Edilen Kanıt':fullTextForExcel(r.evidenceReviewed||''),'Kanıt Durumu':VISIT_EVIDENCE_STATUSES[r.evidenceStatus]||r.evidenceStatus||'','Değerlendirme':fullTextForExcel(r.assessment||''),'Takip Gerekli':r.followUpRequired?'EVET':'HAYIR','Takip Tarihi':r.followUpDate||'','Aksiyon Sorumlusu':r.actionOwner||'','Danışılacak Makam':r.consultAuthority||'','Danışma Konusu':fullTextForExcel(r.consultationTopic||''),'Beklenen Çıktı':fullTextForExcel(r.expectedOutput||''),'Oluşturan':(r.createdBy||{}).displayName||(r.createdBy||{}).email||'','Oluşturma Tarihi':r.createdAt||'','Son Güncelleyen':(r.updatedBy||{}).displayName||(r.updatedBy||{}).email||'','Son Güncelleme':r.updatedAt||''}));}
    function exportVisitWorkspaceExcel(){const b=buildVisitWorkspaceExportBundle();if(!b)return alert('Önce bir ziyaret seçiniz.');const rows=buildVisitWorkspaceExportRows(b);if(!rows.length)return alert('Dışa aktarılacak saha kaydı bulunamadı.');const v=b.visit;const wb=createReportWorkbook({title:'Ziyaret Saha Kayıtları',subject:'USOAP CMA ziyaret çalışma alanı'});addJsonSheet(wb,'Ziyaret_Ozeti',[{'Ziyaret':v.visitName||'','Durum':(VISIT_STATUSES[v.status]||{}).label||v.status||'','Alanlar':visitArrayValue(v.areas).join(', '),'Birimler':getVisitUnits(v).join(' | '),'Planlanan Tarih':formatVisitDateRange(v.plannedStart,v.plannedEnd),'Gerçekleşen Tarih':formatVisitDateRange(v.actualStart,v.actualEnd),'Kapsamdaki PQ':getVisitScopeStoredPqs(v).length,'Kapsamdaki CAP Adımı':getVisitScopeStoredSteps(v).length,'Saha Kaydı':rows.length}]);addJsonSheet(wb,'Saha_Kayitlari',rows);addJsonSheet(wb,'Acik_Takip',rows.filter(r=>r['Takip Gerekli']==='EVET'&&!['Tamamlandı','İptal edildi'].includes(r['Kayıt Durumu'])));addJsonSheet(wb,'Danisma_Kayitlari',rows.filter(r=>r['Danışılacak Makam']||r['Danışma Konusu']));addJsonSheet(wb,'Kanit_Degerlendirme',rows.filter(r=>r['İncelenen / Talep Edilen Kanıt']||r['Kanıt Durumu']));downloadReportWorkbook(wb,`Ziyaret_Saha_Kayitlari_${String(v.visitName||'Rapor').replace(/[^a-zA-Z0-9ğüşöçıİĞÜŞÖÇ]+/g,'_')}.xlsx`);}
    function buildVisitWorkspacePdfDefinition(bundle){const v=bundle.visit,sortedBundle={...bundle,records:sortVisitPdfRecords(bundle.records)},rows=buildVisitWorkspaceExportRows(sortedBundle);const content=[{text:'Ziyaret Saha Kayıtları ve İç Denetim Çalışma Notları',style:'header'},{text:`Ziyaret: ${v.visitName||'-'} | Tarih: ${formatVisitDateRange(v.plannedStart,v.plannedEnd)} | Alan: ${visitArrayValue(v.areas).join(', ')||'-'} | Birim: ${getVisitUnits(v).join(', ')||'-'} | Kayıt: ${rows.length}`,style:'subheader'}];rows.forEach((r,i)=>{content.push({text:`${i+1}. ${r['Hedef']} — ${r['Not Türü']} — ${r['Öncelik']}`,style:'visitWorkPdfTitle',pageBreak:i>0&&i%10===0?'before':undefined},{table:{widths:[120,'*'],body:[['Kayıt durumu',r['Kayıt Durumu']],['Not / tespit',r['Not / Tespit']],['Kanıt ve yeterlilik',`${r['Kanıt Durumu']||'-'}\n${r['İncelenen / Talep Edilen Kanıt']||'-'}`],['Değerlendirme',r['Değerlendirme']||'-'],['Takip',r['Takip Gerekli']==='EVET'?`${r['Takip Tarihi']||'-'} | ${r['Aksiyon Sorumlusu']||'-'}`:'Gerekli değil'],['Danışma',`${r['Danışılacak Makam']||'-'}\n${r['Danışma Konusu']||''}`],['Beklenen çıktı',r['Beklenen Çıktı']||'-']].map(x=>[{text:x[0],bold:true,fillColor:'#f1f5f9'},fullTextForPdf(x[1]||'-')])},layout:'lightHorizontalLines',margin:[0,0,0,8]});});return createStandardPdfDefinition(content,{pageOrientation:'portrait',pageSize:'A4',styles:{visitWorkPdfTitle:{fontSize:9,bold:true,color:'#1d4ed8',margin:[0,6,0,3]}},defaultStyle:{font:'Roboto',fontSize:8}});}
    function exportVisitWorkspacePDF(){const b=buildVisitWorkspaceExportBundle();if(!b)return alert('Önce bir ziyaret seçiniz.');if(!b.records.length)return alert('Dışa aktarılacak saha kaydı bulunamadı.');try{return safeDownloadPdf(buildVisitWorkspacePdfDefinition(b),'Ziyaret_Saha_Kayitlari.pdf');}catch(e){console.error(e);alert('Saha kayıtları PDF raporu hazırlanamadı: '+(e.message||e));}}


    // ZİYARET VE İÇ DENETİM - PAKET 4A: TAKİP YÖNETİMİ
    const VISIT_FOLLOW_STATUSES = {
        open:'Açık', waiting_info:'Birimden bilgi bekleniyor', waiting_evidence:'Kanıt bekleniyor',
        waiting_consultation:'Danışma bekleniyor', evaluation:'Değerlendirmede', revision_requested:'Revizyon talep edildi',
        revisit_required:'Takip ziyareti gerekli', completed:'Tamamlandı', cancelled:'İptal edildi'
    };
    const VISIT_FOLLOW_CLOSURE_DECISIONS = {
        no_action:'İlave işlem gerekmiyor', evidence_sufficient:'Kanıt yeterli', additional_evidence:'İlave kanıt gerekli',
        cap_revision:'CAP revizyonu gerekli', new_cap_step:'Yeni CAP adımı gerekli', management_decision:'Yönetim kararı gerekli',
        revisit_required:'Takip ziyareti gerekli'
    };
    let activeVisitFollowUpKey = '';

    function visitFollowTodayIso(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
    function parseVisitFollowDateOnly(value){if(!value)return null;const m=String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!m)return null;const d=new Date(Number(m[1]),Number(m[2])-1,Number(m[3]));return Number.isNaN(d.getTime())?null:d;}
    function visitFollowDateDiff(dateStr){if(!dateStr)return null;const a=parseVisitFollowDateOnly(dateStr);const b=parseVisitFollowDateOnly(visitFollowTodayIso());if(!a||!b)return null;return Math.round((a-b)/86400000);}
    function getVisitFollowUpOverlay(visit, recordId){const records=(((visit||{}).followUp||{}).records)||{};return records[recordId]||{};}
    function getAllVisitFollowUpItems(){
        const items=[];
        getInternalWorkflowVisitRecords().forEach(visit=>{
            getVisitFieldworkRecords(visit).filter(source=>{const overlay=getVisitFollowUpOverlay(visit,source.id);return !!source.followUpRequired||!!(overlay&&Object.keys(overlay).length&&!overlay.isDeleted);}).forEach(source=>{
                const overlay=getVisitFollowUpOverlay(visit,source.id); const status=overlay.status||(source.status==='completed'?'completed':'open');
                const followUpDate=overlay.followUpDate||source.followUpDate||''; const diff=visitFollowDateDiff(followUpDate);
                let timing='open';
                if(['completed','cancelled'].includes(status))timing='completed';
                else if(diff===null)timing='date_risk';
                else if(diff<0)timing='overdue';
                else if(diff===0)timing='today';
                else if(diff<=7)timing='next7';
                else if(diff<=30)timing='next30';
                const daysLate=diff!==null&&diff<0?Math.abs(diff):0;
                items.push({
                    key:`${visit.id}::${source.id}`,visitId:visit.id,sourceRecordId:source.id,visitName:visit.visitName||'Adsız ziyaret',
                    visitAreas:visitArrayValue(visit.areas),visitUnits:getVisitUnits(visit),source,overlay,status,followUpDate,diff,timing,daysLate,
                    priority:overlay.priority||source.priority||'medium',owner:overlay.owner||source.actionOwner||'',expectedOutput:overlay.expectedOutput||source.expectedOutput||'',
                    evidenceReceived:overlay.evidenceReceived||'',resultNote:overlay.resultNote||'',closureDecision:overlay.closureDecision||'',closureDate:overlay.closureDate||'',linkedConsultationId:overlay.linkedConsultationId||''
                });
            });
        });
        return items.sort((a,b)=>{const rank={overdue:0,today:1,next7:2,next30:3,date_risk:4,open:5,completed:6};return (rank[a.timing]??9)-(rank[b.timing]??9)||(a.diff??99999)-(b.diff??99999)||String(a.visitName).localeCompare(String(b.visitName),'tr');});
    }
    function visitFollowTimingLabel(item){if(item.timing==='completed')return item.status==='cancelled'?'İptal edildi':'Tamamlandı';if(item.timing==='date_risk')return 'Takip tarihi eksik';if(item.timing==='overdue')return `${item.daysLate} gün gecikmiş`;if(item.timing==='today')return 'Bugün';if(item.timing==='next7'||item.timing==='next30')return `${item.diff} gün kaldı`;return 'Açık';}
    function visitFollowTimingClass(item){return item.timing==='next7'||item.timing==='next30'?'upcoming':item.timing;}
    function getVisitRecordForProcessLink(visitId){return getVisitRecords(true).find(v=>v.id===visitId)||null;}
    function visitProcessSourceLabel(visit,recordId){const source=getVisitFieldworkRecords(visit,true).find(r=>r.id===recordId);return source?`${source.targetLabel||'Ziyaret geneli'} — ${shortenVisitText(source.noteText||'',80)}`:`Kayıt ${recordId}`;}
    function getVisitConsultationLinkOptions(visitId){return getAllVisitConsultationItems().filter(i=>i.visitId===visitId);}
    function getVisitFollowUpLinkOptions(visitId){return getAllVisitFollowUpItems().filter(i=>i.visitId===visitId);}
    function renderVisitFollowConsultationLink(item){
        const select=document.getElementById('visitFollowLinkedConsultation');if(!select)return;
        const options=getVisitConsultationLinkOptions(item.visitId);const sameSource=options.find(o=>o.sourceRecordId===item.sourceRecordId);
        const selected=item.linkedConsultationId||(sameSource?sameSource.sourceRecordId:'');
        select.innerHTML='<option value="">Bağlantı yok</option>'+options.map(o=>`<option value="${escapeHtml(o.sourceRecordId)}">${escapeHtml(o.sourceRecordId===item.sourceRecordId?'Aynı saha kaydı — '+(o.authority||o.topic||'Danışma kaydı'):(o.source.targetLabel||'Ziyaret geneli')+' — '+(o.authority||o.topic||'Danışma kaydı'))}</option>`).join('');
        if(selected&&Array.from(select.options).some(o=>o.value===selected))select.value=selected;else select.value='';updateVisitFollowConsultationLinkState();
    }
    function updateVisitFollowConsultationLinkState(){
        const status=(document.getElementById('visitFollowStatus')||{}).value||'';const select=document.getElementById('visitFollowLinkedConsultation');const id=select?select.value:'';const info=document.getElementById('visitFollowConsultLinkInfo');const openBtn=document.getElementById('visitFollowOpenConsultBtn');
        if(openBtn)openBtn.disabled=!id;if(!info)return;
        info.className='visit-process-link-info'+(id?' linked':status==='waiting_consultation'?' required':'');
        if(id){const item=activeVisitFollowUpKey?getAllVisitFollowUpItems().find(i=>i.key===activeVisitFollowUpKey):null;const c=item?getVisitConsultationLinkOptions(item.visitId).find(x=>x.sourceRecordId===id):null;info.textContent=c?`Bağlı danışma: ${c.authority||'Makam belirtilmedi'} — ${VISIT_CONSULT_STATUSES[c.status]||c.status}`:'Bağlı danışma kaydı seçildi.';}
        else info.textContent=status==='waiting_consultation'?'Danışma bekleniyor durumu için bir danışma kaydı seçilmeli veya yeni kayıt oluşturulmalıdır.':'Bağlı danışma kaydı bulunmuyor.';
    }
    async function createConsultationFromSelectedFollowUp(){
        if(!activeVisitFollowUpKey)return alert('Önce bir takip kaydı seçiniz.');const item=getAllVisitFollowUpItems().find(i=>i.key===activeVisitFollowUpKey);if(!item)return alert('Takip kaydı bulunamadı.');
        const visit=getVisitRecordForProcessLink(item.visitId);const existingConsult=getVisitConsultationOverlay(visit,item.sourceRecordId);if(existingConsult&&Object.keys(existingConsult).length&&!existingConsult.isDeleted){const sel=document.getElementById('visitFollowLinkedConsultation');if(sel)sel.value=item.sourceRecordId;updateVisitFollowConsultationLinkState();return alert('Bu saha kaydı için danışma kaydı zaten bulunuyor. Bağlantı seçildi.');}
        const now=new Date().toISOString(),actor=getCurrentVisitUser();const consultRecord={sourceRecordId:item.sourceRecordId,linkedFollowUpId:item.sourceRecordId,status:'open',priority:item.priority||'medium',authority:item.source.consultAuthority||'',responsible:item.owner||item.source.actionOwner||'',topic:item.source.consultationTopic||item.source.noteText||'',question:item.source.consultationTopic||item.source.noteText||'',method:'',requestDate:'',referenceNo:'',expectedResponseDate:'',nextActionDate:item.followUpDate||'',responseDate:'',responseText:'',decision:'',capImpact:'',closureDate:'',createdAt:now,createdBy:actor,updatedAt:now,updatedBy:actor,isDeleted:false};
        const currentFollow=item.overlay||{};const followRecord={sourceRecordId:item.sourceRecordId,status:(document.getElementById('visitFollowStatus')||{}).value||item.status||'waiting_consultation',priority:(document.getElementById('visitFollowPriority')||{}).value||item.priority||'medium',followUpDate:(document.getElementById('visitFollowDate')||{}).value||item.followUpDate||'',owner:(document.getElementById('visitFollowOwner')||{}).value||item.owner||'',expectedOutput:(document.getElementById('visitFollowExpectedOutput')||{}).value||item.expectedOutput||'',evidenceReceived:(document.getElementById('visitFollowEvidenceReceived')||{}).value||item.evidenceReceived||'',resultNote:(document.getElementById('visitFollowResultNote')||{}).value||item.resultNote||'',closureDecision:(document.getElementById('visitFollowClosureDecision')||{}).value||item.closureDecision||'',closureDate:(document.getElementById('visitFollowClosureDate')||{}).value||item.closureDate||'',linkedConsultationId:item.sourceRecordId,createdAt:currentFollow.createdAt||now,createdBy:currentFollow.createdBy||actor,updatedAt:now,updatedBy:actor,isDeleted:false};
        const updates={};updates[`icao_visits/${item.visitId}/consultation/records/${item.sourceRecordId}`]=consultRecord;updates[`icao_visits/${item.visitId}/consultation/updatedAt`]=now;updates[`icao_visits/${item.visitId}/consultation/updatedBy`]=actor;updates[`icao_visits/${item.visitId}/consultation/moduleVersion`]='visit-follow-consult-integration';updates[`icao_visits/${item.visitId}/followUp/records/${item.sourceRecordId}`]=followRecord;updates[`icao_visits/${item.visitId}/followUp/updatedAt`]=now;updates[`icao_visits/${item.visitId}/followUp/updatedBy`]=actor;updates[`icao_visits/${item.visitId}/followUp/moduleVersion`]='visit-follow-consult-integration';
        addVisitAuditToUpdates(updates,item.visitId,'consultation',item.sourceRecordId,'create',{},consultRecord,'Takip kaydından danışma kaydı oluşturuldu.',now,actor,{pq:item.source.pq||'',step:item.source.step||''});addVisitAuditToUpdates(updates,item.visitId,'followup',item.sourceRecordId,currentFollow&&currentFollow.createdAt?'update':'create',currentFollow,followRecord,'Takip kaydı danışma sürecine bağlandı.',now,actor,{pq:item.source.pq||'',step:item.source.step||''});
        try{await db.ref().update(updates);alert('Danışma kaydı oluşturuldu ve takip kaydına bağlandı.');}catch(e){console.error(e);alert('Danışma kaydı oluşturulamadı: '+(e.message||e));}
    }
    function openLinkedConsultationFromFollowUp(){if(!activeVisitFollowUpKey)return alert('Önce bir takip kaydı seçiniz.');const item=getAllVisitFollowUpItems().find(i=>i.key===activeVisitFollowUpKey);const id=(document.getElementById('visitFollowLinkedConsultation')||{}).value||item&&item.linkedConsultationId;if(!item||!id)return alert('Bağlı danışma kaydı seçilmemiş.');switchTab('visit-consultation');renderVisitConsultationModule();selectVisitConsultationItem(encodeURIComponent(`${item.visitId}::${id}`));}
    function renderVisitConsultationFollowLink(item){
        const select=document.getElementById('visitConsultLinkedFollowUp');if(!select)return;const options=getVisitFollowUpLinkOptions(item.visitId);const same=options.find(o=>o.sourceRecordId===item.sourceRecordId);const selected=item.linkedFollowUpId||(same?same.sourceRecordId:'');
        select.innerHTML='<option value="">Bağlantı yok</option>'+options.map(o=>`<option value="${escapeHtml(o.sourceRecordId)}">${escapeHtml(o.sourceRecordId===item.sourceRecordId?'Aynı saha kaydı — '+(VISIT_FOLLOW_STATUSES[o.status]||o.status):(o.source.targetLabel||'Ziyaret geneli')+' — '+(VISIT_FOLLOW_STATUSES[o.status]||o.status))}</option>`).join('');if(selected&&Array.from(select.options).some(o=>o.value===selected))select.value=selected;else select.value='';updateVisitConsultationFollowLinkState();
    }
    function updateVisitConsultationFollowLinkState(){
        const select=document.getElementById('visitConsultLinkedFollowUp');const id=select?select.value:'';const info=document.getElementById('visitConsultFollowLinkInfo');const openBtn=document.getElementById('visitConsultOpenFollowBtn'),evalBtn=document.getElementById('visitConsultEvaluateFollowBtn');const status=(document.getElementById('visitConsultStatus')||{}).value||'';const response=String((document.getElementById('visitConsultResponseText')||{}).value||'').trim();
        if(openBtn)openBtn.disabled=!id;if(evalBtn)evalBtn.disabled=!id||!(status==='completed'||status==='response_received'||response);if(!info)return;info.className='visit-process-link-info'+(id?' linked':'');
        if(id){const item=activeVisitConsultationKey?getAllVisitConsultationItems().find(i=>i.key===activeVisitConsultationKey):null;const f=item?getVisitFollowUpLinkOptions(item.visitId).find(x=>x.sourceRecordId===id):null;info.textContent=f?`Bağlı takip: ${VISIT_FOLLOW_STATUSES[f.status]||f.status} — ${formatVisitDate(f.followUpDate)}`:'Bağlı takip kaydı seçildi.';}else info.textContent='Bağlı takip kaydı bulunmuyor.';
    }
    function openLinkedFollowUpFromConsultation(){if(!activeVisitConsultationKey)return alert('Önce bir danışma kaydı seçiniz.');const item=getAllVisitConsultationItems().find(i=>i.key===activeVisitConsultationKey);const id=(document.getElementById('visitConsultLinkedFollowUp')||{}).value||item&&item.linkedFollowUpId;if(!item||!id)return alert('Bağlı takip kaydı seçilmemiş.');switchTab('visit-followup');renderVisitFollowUpModule();selectVisitFollowUp(encodeURIComponent(`${item.visitId}::${id}`));}
    async function moveLinkedFollowUpToEvaluation(){
        if(!activeVisitConsultationKey)return alert('Önce bir danışma kaydı seçiniz.');const item=getAllVisitConsultationItems().find(i=>i.key===activeVisitConsultationKey);const followId=(document.getElementById('visitConsultLinkedFollowUp')||{}).value||item&&item.linkedFollowUpId;if(!item||!followId)return alert('Bağlı takip kaydı bulunmuyor.');const follow=getVisitFollowUpLinkOptions(item.visitId).find(f=>f.sourceRecordId===followId);if(!follow)return alert('Bağlı takip kaydı bulunamadı.');
        const consultStatus=(document.getElementById('visitConsultStatus')||{}).value||item.status;const response=String((document.getElementById('visitConsultResponseText')||{}).value||item.responseText||'').trim();if(!['completed','response_received'].includes(consultStatus)&&!response)return alert('Takibi değerlendirmeye almak için danışma cevabı alınmış veya danışma tamamlanmış olmalıdır.');
        const now=new Date().toISOString(),actor=getCurrentVisitUser(),existing=follow.overlay||{};const note=[existing.resultNote||'',`Danışma sonucu ${formatVisitDate((document.getElementById('visitConsultResponseDate')||{}).value||item.responseDate)||'itibarıyla'} değerlendirmeye alındı.`].filter(Boolean).join('\n');const record={...existing,sourceRecordId:followId,status:'evaluation',linkedConsultationId:item.sourceRecordId,resultNote:note,updatedAt:now,updatedBy:actor,isDeleted:false,createdAt:existing.createdAt||now,createdBy:existing.createdBy||actor};const updates={};updates[`icao_visits/${item.visitId}/followUp/records/${followId}`]=record;updates[`icao_visits/${item.visitId}/followUp/updatedAt`]=now;updates[`icao_visits/${item.visitId}/followUp/updatedBy`]=actor;updates[`icao_visits/${item.visitId}/followUp/moduleVersion`]='visit-follow-consult-integration';addVisitAuditToUpdates(updates,item.visitId,'followup',followId,existing&&existing.createdAt?'update':'create',existing,record,'Danışma sonucu bağlı takip kaydında değerlendirmeye alındı.',now,actor,{pq:follow.source.pq||'',step:follow.source.step||''});try{await db.ref().update(updates);alert('Bağlı takip kaydı “Değerlendirmede” durumuna alındı.');}catch(e){console.error(e);alert('Takip kaydı güncellenemedi: '+(e.message||e));}
    }

    function populateVisitFollowUpControls(){
        const statusFilter=document.getElementById('visitFollowStatusFilter'),status=document.getElementById('visitFollowStatus'),closure=document.getElementById('visitFollowClosureDecision');
        if(statusFilter){const v=statusFilter.value;statusFilter.innerHTML='<option value="all">Tüm durumlar</option>'+Object.entries(VISIT_FOLLOW_STATUSES).map(([k,l])=>`<option value="${k}">${l}</option>`).join('');if(v&&Array.from(statusFilter.options).some(o=>o.value===v))statusFilter.value=v;}
        if(status){const v=status.value;status.innerHTML=Object.entries(VISIT_FOLLOW_STATUSES).map(([k,l])=>`<option value="${k}">${l}</option>`).join('');status.value=v&&VISIT_FOLLOW_STATUSES[v]?v:'open';}
        if(closure){const v=closure.value;closure.innerHTML='<option value="">Seçiniz...</option>'+Object.entries(VISIT_FOLLOW_CLOSURE_DECISIONS).map(([k,l])=>`<option value="${k}">${l}</option>`).join('');if(v&&VISIT_FOLLOW_CLOSURE_DECISIONS[v])closure.value=v;}
    }
    function renderVisitFollowUpModule(forceReload=false){
        populateVisitFollowUpControls(); const visitSelect=document.getElementById('visitFollowVisitFilter');
        if(visitSelect){const current=visitSelect.value||'all';visitSelect.innerHTML='<option value="all">Tüm ziyaretler</option>'+getInternalWorkflowVisitRecords().map(v=>`<option value="${escapeHtml(v.id)}">${escapeHtml(v.visitName||'Adsız ziyaret')}</option>`).join('');visitSelect.value=Array.from(visitSelect.options).some(o=>o.value===current)?current:'all';}
        renderVisitFollowUpList(); if(forceReload&&activeVisitFollowUpKey)selectVisitFollowUp(activeVisitFollowUpKey,true);
    }
    function getFilteredVisitFollowUpItems(){
        const visit=(document.getElementById('visitFollowVisitFilter')||{}).value||'all';const timing=(document.getElementById('visitFollowTimingFilter')||{}).value||'all';const status=(document.getElementById('visitFollowStatusFilter')||{}).value||'all';const priority=(document.getElementById('visitFollowPriorityFilter')||{}).value||'all';const q=((document.getElementById('visitFollowSearch')||{}).value||'').trim().toLocaleLowerCase('tr');
        return getAllVisitFollowUpItems().filter(i=>{
            if(visit!=='all'&&i.visitId!==visit)return false;
            if(timing!=='all'){
                if(timing==='next7'&&!(i.diff!==null&&i.diff>=0&&i.diff<=7&&!['completed','cancelled'].includes(i.status)))return false;
                else if(timing==='next30'&&!(i.diff!==null&&i.diff>=0&&i.diff<=30&&!['completed','cancelled'].includes(i.status)))return false;
                else if(!['next7','next30'].includes(timing)&&i.timing!==timing)return false;
            }
            if(status!=='all'&&i.status!==status)return false;if(priority!=='all'&&i.priority!==priority)return false;
            if(q&&!([i.visitName,i.visitAreas.join(' '),i.visitUnits.join(' '),i.source.targetLabel,i.source.pq,i.source.step,i.source.noteText,i.owner,i.expectedOutput,i.resultNote].join(' ').toLocaleLowerCase('tr').includes(q)))return false;return true;
        });
    }
    function updateVisitFollowUpKpis(){const all=getAllVisitFollowUpItems();const set={visitFollowKpiTotal:all.length,visitFollowKpiOverdue:all.filter(i=>i.timing==='overdue').length,visitFollowKpiWeek:all.filter(i=>i.diff!==null&&i.diff>=0&&i.diff<=7&&!['completed','cancelled'].includes(i.status)).length,visitFollowKpiEvidence:all.filter(i=>i.status==='waiting_evidence').length,visitFollowKpiRevisit:all.filter(i=>i.status==='revisit_required').length,visitFollowKpiCompleted:all.filter(i=>i.status==='completed').length};Object.entries(set).forEach(([id,v])=>{const el=document.getElementById(id);if(el)el.textContent=v;});}
    function renderVisitFollowUpList(){
        const list=document.getElementById('visitFollowList');if(!list)return;const rows=getFilteredVisitFollowUpItems();const count=document.getElementById('visitFollowListCount');if(count)count.textContent=`${rows.length} kayıt`;
        list.innerHTML=rows.length?rows.map(i=>`<button type="button" class="visit-follow-card ${visitFollowTimingClass(i)} ${activeVisitFollowUpKey===i.key?'active':''}" onclick="selectVisitFollowUp('${encodeURIComponent(i.key)}')"><div class="visit-follow-card-title">${escapeHtml(i.visitName)} — ${escapeHtml(i.source.targetLabel||'Ziyaret geneli')}</div><div class="visit-follow-card-meta"><span class="visit-follow-badge ${visitFollowTimingClass(i)}">${escapeHtml(visitFollowTimingLabel(i))}</span> | ${escapeHtml(VISIT_FOLLOW_STATUSES[i.status]||i.status)} | ${escapeHtml(VISIT_FIELD_PRIORITIES[i.priority]||i.priority)}${i.linkedConsultationId?'<span class="visit-linked-badge">Danışmaya bağlı</span>':''}<br>Takip: ${escapeHtml(formatVisitDate(i.followUpDate))} | Sorumlu: ${escapeHtml(i.owner||'Belirtilmedi')}</div><div class="visit-follow-card-note">${escapeHtml(shortenVisitText(i.source.noteText||'',180))}</div></button>`).join(''):'<div class="visit-follow-empty">Seçili ölçütlere uygun takip kaydı bulunamadı.</div>';updateVisitFollowUpKpis();
        if(activeVisitFollowUpKey&&!getAllVisitFollowUpItems().some(i=>i.key===activeVisitFollowUpKey))resetVisitFollowUpForm();
    }
    function selectVisitFollowUp(encodedKey,silent=false){const key=decodeURIComponent(encodedKey||'');const item=getAllVisitFollowUpItems().find(i=>i.key===key);if(!item){if(!silent)alert('Takip kaydı bulunamadı.');return;}activeVisitFollowUpKey=key;renderVisitFollowUpList();renderVisitFollowUpSource(item);document.getElementById('visitFollowStatus').value=item.status;document.getElementById('visitFollowPriority').value=item.priority;document.getElementById('visitFollowDate').value=item.followUpDate||'';document.getElementById('visitFollowOwner').value=item.owner||'';document.getElementById('visitFollowExpectedOutput').value=item.expectedOutput||'';document.getElementById('visitFollowEvidenceReceived').value=item.evidenceReceived||'';document.getElementById('visitFollowResultNote').value=item.resultNote||'';document.getElementById('visitFollowClosureDecision').value=item.closureDecision||'';document.getElementById('visitFollowClosureDate').value=item.closureDate||'';renderVisitFollowConsultationLink(item);}
    function renderVisitFollowUpSource(item){const el=document.getElementById('visitFollowSource');if(!el)return;const s=item.source;el.innerHTML=`<h5>${escapeHtml(item.visitName)} — ${escapeHtml(s.targetLabel||'Ziyaret geneli')}</h5><div class="visit-follow-source-grid"><div class="visit-follow-source-item"><b>PQ / Step</b><br>${escapeHtml(s.pq||'-')} / ${escapeHtml(s.step||'-')}</div><div class="visit-follow-source-item"><b>Kaynak kayıt</b><br>${escapeHtml(VISIT_FIELD_NOTE_TYPES[s.noteType]||s.noteType||'-')} | ${escapeHtml(VISIT_FIELD_RECORD_STATUSES[s.status]||s.status||'-')}</div><div class="visit-follow-source-item full"><b>Saha notu / tespit</b><br>${escapeHtml(s.noteText||'-')}</div><div class="visit-follow-source-item full"><b>Kanıt ve değerlendirme</b><br>${escapeHtml(s.evidenceReviewed||'-')}<br>${escapeHtml(s.assessment||'')}</div><div class="visit-follow-source-item"><b>İlk takip tarihi</b><br>${escapeHtml(formatVisitDate(s.followUpDate))}</div><div class="visit-follow-source-item"><b>İlk sorumlu</b><br>${escapeHtml(s.actionOwner||'-')}</div></div>`;}
    function resetVisitFollowUpForm(){activeVisitFollowUpKey='';const src=document.getElementById('visitFollowSource');if(src)src.innerHTML='<div class="visit-follow-empty">Soldan bir takip kaydı seçiniz.</div>';['visitFollowDate','visitFollowOwner','visitFollowExpectedOutput','visitFollowEvidenceReceived','visitFollowResultNote','visitFollowClosureDate'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});const s=document.getElementById('visitFollowStatus');if(s)s.value='open';const p=document.getElementById('visitFollowPriority');if(p)p.value='medium';const c=document.getElementById('visitFollowClosureDecision');if(c)c.value='';const link=document.getElementById('visitFollowLinkedConsultation');if(link)link.innerHTML='<option value="">Bağlantı yok</option>';updateVisitFollowConsultationLinkState();renderVisitFollowUpList();}
    async function saveVisitFollowUpRecord(){
        if(!activeVisitFollowUpKey)return alert('Önce soldan bir takip kaydı seçiniz.');const item=getAllVisitFollowUpItems().find(i=>i.key===activeVisitFollowUpKey);if(!item)return alert('Takip kaydı bulunamadı.');
        const status=document.getElementById('visitFollowStatus').value;const followUpDate=document.getElementById('visitFollowDate').value;const closureDecision=document.getElementById('visitFollowClosureDecision').value;const closureDate=document.getElementById('visitFollowClosureDate').value;
        const linkedConsultationId=(document.getElementById('visitFollowLinkedConsultation')||{}).value||'';if(!followUpDate&&!['completed','cancelled'].includes(status))return alert('Açık bir takip kaydı için takip tarihi girilmelidir.');if(status==='waiting_consultation'&&!linkedConsultationId)return alert('Danışma bekleniyor durumu için bağlı danışma kaydı seçilmeli veya yeni danışma kaydı oluşturulmalıdır.');if(status==='completed'&&(!closureDecision||!closureDate))return alert('Tamamlanan takip için kapanış kararı ve kapanış tarihi girilmelidir.');
        const now=new Date().toISOString(),actor=getCurrentVisitUser(),existing=item.overlay||{};const record={sourceRecordId:item.sourceRecordId,status,priority:document.getElementById('visitFollowPriority').value,followUpDate,owner:document.getElementById('visitFollowOwner').value.trim(),expectedOutput:document.getElementById('visitFollowExpectedOutput').value.trim(),evidenceReceived:document.getElementById('visitFollowEvidenceReceived').value.trim(),resultNote:document.getElementById('visitFollowResultNote').value.trim(),closureDecision,closureDate,linkedConsultationId,createdAt:existing.createdAt||now,createdBy:existing.createdBy||actor,updatedAt:now,updatedBy:actor,isDeleted:false};
        const updates={};updates[`icao_visits/${item.visitId}/followUp/records/${item.sourceRecordId}`]=record;if(existing.linkedConsultationId&&existing.linkedConsultationId!==linkedConsultationId){updates[`icao_visits/${item.visitId}/consultation/records/${existing.linkedConsultationId}/linkedFollowUpId`]=null;}if(linkedConsultationId){updates[`icao_visits/${item.visitId}/consultation/records/${linkedConsultationId}/linkedFollowUpId`]=item.sourceRecordId;updates[`icao_visits/${item.visitId}/consultation/records/${linkedConsultationId}/updatedAt`]=now;updates[`icao_visits/${item.visitId}/consultation/records/${linkedConsultationId}/updatedBy`]=actor;}updates[`icao_visits/${item.visitId}/followUp/updatedAt`]=now;updates[`icao_visits/${item.visitId}/followUp/updatedBy`]=actor;updates[`icao_visits/${item.visitId}/followUp/moduleVersion`]='visit-package-4-followup';addVisitAuditToUpdates(updates,item.visitId,'followup',item.sourceRecordId,existing&&existing.createdAt?'update':'create',existing,record,existing&&existing.createdAt?'Takip kaydı güncellendi.':'Takip yönetimi kaydı oluşturuldu.',now,actor,{pq:item.source.pq||'',step:item.source.step||''});
        try{await db.ref().update(updates);alert('Takip kaydı güncellendi.');}catch(e){console.error(e);alert('Takip kaydı kaydedilemedi: '+(e.message||e));}
    }
    function clearVisitFollowUpFilters(){['visitFollowVisitFilter','visitFollowTimingFilter','visitFollowStatusFilter','visitFollowPriorityFilter'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='all';});const q=document.getElementById('visitFollowSearch');if(q)q.value='';renderVisitFollowUpList();}
    function openSelectedFollowUpInWorkspace(){if(!activeVisitFollowUpKey)return alert('Önce bir takip kaydı seçiniz.');const item=getAllVisitFollowUpItems().find(i=>i.key===activeVisitFollowUpKey);if(!item)return;switchTab('visit-workspace');const sel=document.getElementById('visitWorkspaceVisitSelect');if(sel)sel.value=item.visitId;loadVisitWorkspaceSelection(item.visitId,true);const s=item.source;if(s.targetType&&s.targetKey)selectVisitWorkspaceTarget(s.targetType,encodeURIComponent(s.targetKey));}
    function buildVisitFollowUpExportRows(rows){return rows.map(i=>({'Ziyaret':i.visitName,'Denetim Alanı':i.visitAreas.join(', '),'Birim':i.visitUnits.join(' | '),'PQ':i.source.pq||'','Step':i.source.step||'','Hedef':i.source.targetLabel||'','Saha Notu':fullTextForExcel(i.source.noteText||''),'Öncelik':VISIT_FIELD_PRIORITIES[i.priority]||i.priority,'Takip Durumu':VISIT_FOLLOW_STATUSES[i.status]||i.status,'Takip Tarihi':i.followUpDate||'','Zaman Durumu':visitFollowTimingLabel(i),'Gecikme Günü':i.daysLate||0,'Aksiyon Sorumlusu':i.owner||'','Beklenen Çıktı / Kanıt':fullTextForExcel(i.expectedOutput||''),'Alınan Bilgi / Kanıt':fullTextForExcel(i.evidenceReceived||''),'Takip Değerlendirmesi':fullTextForExcel(i.resultNote||''),'Kapanış Kararı':VISIT_FOLLOW_CLOSURE_DECISIONS[i.closureDecision]||i.closureDecision||'','Kapanış Tarihi':i.closureDate||'','Bağlı Danışma Kaydı':i.linkedConsultationId||''}));}
    function exportVisitFollowUpExcel(){const items=getFilteredVisitFollowUpItems();if(!items.length)return alert('Dışa aktarılacak takip kaydı bulunamadı.');const rows=buildVisitFollowUpExportRows(items);const wb=createReportWorkbook({title:'Ziyaret Takip Yönetimi',subject:'USOAP CMA ziyaret takip kayıtları'});addJsonSheet(wb,'Takip_Kayitlari',rows);addJsonSheet(wb,'Geciken_Takipler',rows.filter(r=>r['Gecikme Günü']>0));addJsonSheet(wb,'Kanıt_Bekleyenler',rows.filter(r=>r['Takip Durumu']==='Kanıt bekleniyor'));addJsonSheet(wb,'Tamamlanan_Takipler',rows.filter(r=>r['Takip Durumu']==='Tamamlandı'));downloadReportWorkbook(wb,'Ziyaret_Takip_Yonetimi.xlsx');}
    function buildVisitFollowUpPdfDefinition(items){const content=[{text:'Ziyaret ve İç Denetim - Takip Yönetimi',style:'header'},{text:`Rapor tarihi: ${formatLongTurkishDate(new Date())} | Takip kaydı: ${items.length} | Geciken: ${items.filter(i=>i.timing==='overdue').length}`,style:'subheader'}];items.forEach((i,idx)=>{content.push({text:`${idx+1}. ${i.visitName} — ${i.source.targetLabel||'Ziyaret geneli'}`,style:'visitFollowPdfTitle',pageBreak:idx>0&&idx%9===0?'before':undefined},{table:{widths:[125,'*'],body:[['PQ / Step',`${i.source.pq||'-'} / ${i.source.step||'-'}`],['Takip durumu',VISIT_FOLLOW_STATUSES[i.status]||i.status],['Takip tarihi',`${formatVisitDate(i.followUpDate)} — ${visitFollowTimingLabel(i)}`],['Sorumlu',i.owner||'-'],['Saha notu',i.source.noteText||'-'],['Beklenen çıktı / kanıt',i.expectedOutput||'-'],['Alınan bilgi / kanıt',i.evidenceReceived||'-'],['Değerlendirme',i.resultNote||'-'],['Bağlı danışma',i.linkedConsultationId||'-'],['Kapanış',`${VISIT_FOLLOW_CLOSURE_DECISIONS[i.closureDecision]||'-'} | ${formatVisitDate(i.closureDate)}`]].map(r=>[{text:r[0],bold:true,fillColor:'#f1f5f9'},fullTextForPdf(r[1])])},layout:'lightHorizontalLines',margin:[0,0,0,9]});});return createStandardPdfDefinition(content,{pageOrientation:'portrait',pageSize:'A4',styles:{visitFollowPdfTitle:{fontSize:9,bold:true,color:'#1d4ed8',margin:[0,7,0,3]}},defaultStyle:{font:'Roboto',fontSize:8}});}
    function exportVisitFollowUpPDF(){const items=getFilteredVisitFollowUpItems();if(!items.length)return alert('Dışa aktarılacak takip kaydı bulunamadı.');try{return safeDownloadPdf(buildVisitFollowUpPdfDefinition(items),'Ziyaret_Takip_Yonetimi.pdf');}catch(e){console.error(e);alert('Takip PDF raporu hazırlanamadı: '+(e.message||e));}}
    window.runVisitFollowUpSelfCheck=function(){const items=getAllVisitFollowUpItems();const funcs=['renderVisitFollowUpModule','saveVisitFollowUpRecord','exportVisitFollowUpPDF','exportVisitFollowUpExcel'];const result={passed:funcs.every(n=>typeof window[n]==='function'||typeof eval(n)==='function'),functions:Object.fromEntries(funcs.map(n=>[n,typeof window[n]==='function'||typeof eval(n)==='function'])),items:items.length,overdue:items.filter(i=>i.timing==='overdue').length,completed:items.filter(i=>i.status==='completed').length};console.log('Takip Yönetimi öz denetimi:',result);return result;};


    // ZİYARET VE İÇ DENETİM - PAKET 4B: DANIŞMA YÖNETİMİ
    const VISIT_CONSULT_STATUSES = {
        open:'Açık', preparing:'Hazırlanıyor', sent:'Gönderildi', waiting_response:'Cevap bekleniyor',
        response_received:'Cevap alındı', evaluation:'Değerlendirmede', decision_required:'Karar gerekli',
        completed:'Tamamlandı', cancelled:'İptal edildi'
    };
    const VISIT_CONSULT_METHODS = {
        official_letter:'Resmî yazı', email:'E-posta', meeting:'Toplantı', phone:'Telefon',
        board_committee:'Kurul / komisyon', information_system:'Bilgi sistemi', other:'Diğer'
    };
    const VISIT_CONSULT_CAP_IMPACTS = {
        none:'PQ/CAP üzerinde değişiklik yok', clarification:'Açıklama / netleştirme', evidence_update:'Kanıt güncellemesi',
        cap_revision:'CAP revizyonu', new_cap_step:'Yeni CAP adımı', deadline_change:'Hedef tarih değişikliği',
        management_decision:'Yönetim kararı', legal_review:'Hukuki değerlendirme', other:'Diğer'
    };
    let activeVisitConsultationKey = '';

    function getVisitConsultationOverlay(visit, recordId){const records=(((visit||{}).consultation||{}).records)||{};return records[recordId]||{};}
    function sourceRequiresConsultation(source, overlay){return !!(overlay&&Object.keys(overlay).length)||source.noteType==='consultation'||String(source.consultAuthority||'').trim()!==''||String(source.consultationTopic||'').trim()!=='';}
    function getAllVisitConsultationItems(){
        const items=[];
        getInternalWorkflowVisitRecords().forEach(visit=>{
            getVisitFieldworkRecords(visit).forEach(source=>{
                const overlay=getVisitConsultationOverlay(visit,source.id);if(!sourceRequiresConsultation(source,overlay))return;
                const status=overlay.status||'open';const expectedResponseDate=overlay.expectedResponseDate||'';const diff=visitFollowDateDiff(expectedResponseDate);
                let timing='open';
                if(['completed','cancelled'].includes(status))timing='completed';
                else if(['response_received','evaluation','decision_required'].includes(status))timing='open';
                else if(diff===null)timing=['sent','waiting_response'].includes(status)?'date_risk':'open';
                else if(diff<0)timing='overdue';
                else if(diff===0)timing='today';
                else if(diff<=7)timing='next7';
                else if(diff<=30)timing='next30';
                const daysLate=diff!==null&&diff<0?Math.abs(diff):0;
                items.push({
                    key:`${visit.id}::${source.id}`,visitId:visit.id,sourceRecordId:source.id,visitName:visit.visitName||'Adsız ziyaret',
                    visitAreas:visitArrayValue(visit.areas),visitUnits:getVisitUnits(visit),source,overlay,status,timing,diff,daysLate,
                    priority:overlay.priority||source.priority||'medium',authority:overlay.authority||source.consultAuthority||'',
                    topic:overlay.topic||source.consultationTopic||'',question:overlay.question||source.consultationTopic||source.noteText||'',
                    method:overlay.method||'',requestDate:overlay.requestDate||'',referenceNo:overlay.referenceNo||'',
                    expectedResponseDate,responseDate:overlay.responseDate||'',responseText:overlay.responseText||'',
                    decision:overlay.decision||'',capImpact:overlay.capImpact||'',responsible:overlay.responsible||source.actionOwner||'',
                    nextActionDate:overlay.nextActionDate||'',closureDate:overlay.closureDate||'',linkedFollowUpId:overlay.linkedFollowUpId||''
                });
            });
        });
        return items.sort((a,b)=>{
            const rank={overdue:0,today:1,next7:2,next30:3,date_risk:4,open:5,completed:6};
            return (rank[a.timing]??9)-(rank[b.timing]??9)||String(a.expectedResponseDate||'9999').localeCompare(String(b.expectedResponseDate||'9999'))||a.visitName.localeCompare(b.visitName,'tr');
        });
    }
    function visitConsultTimingLabel(item){if(item.timing==='overdue')return `${item.daysLate} gün gecikmiş`;if(item.timing==='today')return 'Cevap bugün bekleniyor';if(item.timing==='next7')return `${item.diff} gün kaldı`;if(item.timing==='next30')return `${item.diff} gün kaldı`;if(item.timing==='date_risk')return 'Cevap tarihi eksik';if(item.timing==='completed')return 'Tamamlandı';return item.expectedResponseDate?`${item.diff} gün kaldı`:'Açık';}
    function populateVisitConsultationControls(){
        const fill=(id,map,allLabel)=>{const e=document.getElementById(id);if(!e)return;const cur=e.value;e.innerHTML=(allLabel?`<option value="all">${allLabel}</option>`:'')+Object.entries(map).map(([k,v])=>`<option value="${k}">${escapeHtml(v)}</option>`).join('');if(cur&&Array.from(e.options).some(o=>o.value===cur))e.value=cur;};
        fill('visitConsultStatus',VISIT_CONSULT_STATUSES,'');fill('visitConsultStatusFilter',VISIT_CONSULT_STATUSES,'Tüm durumlar');
        const method=document.getElementById('visitConsultMethod'),methodCurrent=method?method.value:'';if(method){method.innerHTML='<option value="">Seçiniz...</option>'+Object.entries(VISIT_CONSULT_METHODS).map(([k,v])=>`<option value="${k}">${escapeHtml(v)}</option>`).join('');if(methodCurrent&&Array.from(method.options).some(o=>o.value===methodCurrent))method.value=methodCurrent;}
        const impact=document.getElementById('visitConsultCapImpact'),impactCurrent=impact?impact.value:'';if(impact){impact.innerHTML='<option value="">Seçiniz...</option>'+Object.entries(VISIT_CONSULT_CAP_IMPACTS).map(([k,v])=>`<option value="${k}">${escapeHtml(v)}</option>`).join('');if(impactCurrent&&Array.from(impact.options).some(o=>o.value===impactCurrent))impact.value=impactCurrent;}
        const status=document.getElementById('visitConsultStatus');if(status&&!status.value)status.value='open';const priority=document.getElementById('visitConsultPriority');if(priority&&!priority.value)priority.value='medium';
    }
    function renderVisitConsultationModule(){
        const visitFilter=document.getElementById('visitConsultVisitFilter');if(!visitFilter)return;populateVisitConsultationControls();const items=getAllVisitConsultationItems();const visits=getInternalWorkflowVisitRecords().filter(v=>items.some(i=>i.visitId===v.id));const currentVisit=visitFilter.value;
        visitFilter.innerHTML='<option value="all">Tüm ziyaretler</option>'+visits.map(v=>`<option value="${escapeHtml(v.id)}">${escapeHtml(v.visitName||'Adsız ziyaret')}</option>`).join('');if(currentVisit&&Array.from(visitFilter.options).some(o=>o.value===currentVisit))visitFilter.value=currentVisit;
        const authorityFilter=document.getElementById('visitConsultAuthorityFilter');const currentAuthority=authorityFilter?authorityFilter.value:'all';const authorities=Array.from(new Set(items.map(i=>String(i.authority||'').trim()).filter(Boolean))).sort((a,b)=>a.localeCompare(b,'tr'));if(authorityFilter){authorityFilter.innerHTML='<option value="all">Tüm makamlar</option>'+authorities.map(a=>`<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`).join('');if(currentAuthority&&Array.from(authorityFilter.options).some(o=>o.value===currentAuthority))authorityFilter.value=currentAuthority;}
        renderVisitConsultationList();
    }
    function getFilteredVisitConsultationItems(){
        const visit=(document.getElementById('visitConsultVisitFilter')||{}).value||'all',timing=(document.getElementById('visitConsultTimingFilter')||{}).value||'all',status=(document.getElementById('visitConsultStatusFilter')||{}).value||'all',authority=(document.getElementById('visitConsultAuthorityFilter')||{}).value||'all',q=((document.getElementById('visitConsultSearch')||{}).value||'').trim().toLocaleLowerCase('tr');
        return getAllVisitConsultationItems().filter(i=>{
            if(visit!=='all'&&i.visitId!==visit)return false;if(timing!=='all'&&i.timing!==timing)return false;if(status!=='all'&&i.status!==status)return false;if(authority!=='all'&&i.authority!==authority)return false;
            return !q||[i.visitName,i.visitAreas.join(' '),i.visitUnits.join(' '),i.source.pq,i.source.step,i.source.targetLabel,i.source.noteText,i.authority,i.topic,i.question,i.responseText,i.decision,i.responsible].join(' ').toLocaleLowerCase('tr').includes(q);
        });
    }
    function renderVisitConsultationList(){
        const items=getFilteredVisitConsultationItems(),all=getAllVisitConsultationItems();const list=document.getElementById('visitConsultList'),count=document.getElementById('visitConsultListCount');if(count)count.textContent=`${items.length} kayıt`;if(!list)return;
        list.innerHTML=items.length?items.map(i=>{const active=i.key===activeVisitConsultationKey;const cls=i.timing==='overdue'?'overdue':i.timing==='today'?'today':['next7','next30'].includes(i.timing)?'upcoming':i.timing==='completed'?'completed':i.timing==='date_risk'?'date-risk':'';const encodedKey=encodeURIComponent(String(i.key||''));return `<button type="button" class="visit-consult-card ${cls} ${active?'active':''}" data-visit-consult-key="${escapeHtml(encodedKey)}"><div class="visit-consult-card-title">${escapeHtml(i.visitName)} — ${escapeHtml(i.source.targetLabel||'Ziyaret geneli')}</div><div class="visit-consult-card-meta">${escapeHtml(VISIT_CONSULT_STATUSES[i.status]||i.status)}${i.linkedFollowUpId?'<span class="visit-linked-badge">Takibe bağlı</span>':''} | ${escapeHtml(i.authority||'Makam belirtilmedi')} | ${escapeHtml(formatVisitDate(i.expectedResponseDate))} | ${escapeHtml(visitConsultTimingLabel(i))}</div><div class="visit-consult-card-note"><b>${escapeHtml(i.topic||'Danışma konusu belirtilmedi')}</b><br>${escapeHtml(shortenVisitText(i.question||i.source.noteText||'',180))}</div></button>`;}).join(''):'<div class="visit-consult-empty">Seçili ölçütlere uygun danışma kaydı bulunamadı.</div>';
        list.querySelectorAll('.visit-consult-card[data-visit-consult-key]').forEach(button=>{
            button.addEventListener('click',event=>{
                event.preventDefault();
                selectVisitConsultationItem(button.dataset.visitConsultKey||'');
            });
        });
        const values={visitConsultKpiTotal:all.length,visitConsultKpiOverdue:all.filter(i=>i.timing==='overdue').length,visitConsultKpiWaiting:all.filter(i=>['sent','waiting_response'].includes(i.status)).length,visitConsultKpiResponse:all.filter(i=>['response_received','evaluation','decision_required','completed'].includes(i.status)&&String(i.responseText||'').trim()).length,visitConsultKpiDecision:all.filter(i=>i.status==='decision_required').length,visitConsultKpiCompleted:all.filter(i=>i.status==='completed').length};Object.entries(values).forEach(([id,v])=>{const e=document.getElementById(id);if(e)e.textContent=v;});
    }
    function selectVisitConsultationItem(encodedKey){const key=decodeURIComponent(encodedKey||'');const item=getAllVisitConsultationItems().find(i=>i.key===key);if(!item)return alert('Danışma kaydı bulunamadı.');activeVisitConsultationKey=key;renderVisitConsultationSource(item);populateVisitConsultationForm(item);renderVisitConsultationList();}
    function renderVisitConsultationSource(item){const el=document.getElementById('visitConsultSource');if(!el)return;const s=item.source;el.innerHTML=`<h5>${escapeHtml(item.visitName)} — ${escapeHtml(s.targetLabel||'Ziyaret geneli')}</h5><div class="visit-consult-source-grid"><div class="visit-consult-source-item"><b>PQ / Step</b><br>${escapeHtml(s.pq||'-')} / ${escapeHtml(s.step||'-')}</div><div class="visit-consult-source-item"><b>Kaynak kayıt</b><br>${escapeHtml(VISIT_FIELD_NOTE_TYPES[s.noteType]||s.noteType||'-')} | ${escapeHtml(VISIT_FIELD_RECORD_STATUSES[s.status]||s.status||'-')}</div><div class="visit-consult-source-item full"><b>Saha notu / tespit</b><br>${escapeHtml(s.noteText||'-')}</div><div class="visit-consult-source-item full"><b>İlk danışma bilgisi</b><br>${escapeHtml(s.consultAuthority||'-')}<br>${escapeHtml(s.consultationTopic||'-')}</div></div>`;}
    function populateVisitConsultationForm(item){document.getElementById('visitConsultStatus').value=item.status||'open';document.getElementById('visitConsultPriority').value=item.priority||'medium';document.getElementById('visitConsultAuthority').value=item.authority||'';document.getElementById('visitConsultResponsible').value=item.responsible||'';document.getElementById('visitConsultTopic').value=item.topic||'';document.getElementById('visitConsultQuestion').value=item.question||'';document.getElementById('visitConsultMethod').value=item.method||'';document.getElementById('visitConsultRequestDate').value=item.requestDate||'';document.getElementById('visitConsultReferenceNo').value=item.referenceNo||'';document.getElementById('visitConsultExpectedResponseDate').value=item.expectedResponseDate||'';document.getElementById('visitConsultNextActionDate').value=item.nextActionDate||'';document.getElementById('visitConsultResponseDate').value=item.responseDate||'';document.getElementById('visitConsultResponseText').value=item.responseText||'';document.getElementById('visitConsultCapImpact').value=item.capImpact||'';document.getElementById('visitConsultClosureDate').value=item.closureDate||'';document.getElementById('visitConsultDecision').value=item.decision||'';renderVisitConsultationFollowLink(item);}
    function resetVisitConsultationForm(){activeVisitConsultationKey='';const src=document.getElementById('visitConsultSource');if(src)src.innerHTML='<div class="visit-consult-empty">Soldan bir danışma kaydı seçiniz.</div>';['visitConsultAuthority','visitConsultResponsible','visitConsultTopic','visitConsultQuestion','visitConsultRequestDate','visitConsultReferenceNo','visitConsultExpectedResponseDate','visitConsultNextActionDate','visitConsultResponseDate','visitConsultResponseText','visitConsultClosureDate','visitConsultDecision'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});const s=document.getElementById('visitConsultStatus');if(s)s.value='open';const p=document.getElementById('visitConsultPriority');if(p)p.value='medium';const m=document.getElementById('visitConsultMethod');if(m)m.value='';const c=document.getElementById('visitConsultCapImpact');if(c)c.value='';const link=document.getElementById('visitConsultLinkedFollowUp');if(link)link.innerHTML='<option value="">Bağlantı yok</option>';updateVisitConsultationFollowLinkState();renderVisitConsultationList();}
    async function saveVisitConsultationRecord(){
        if(!activeVisitConsultationKey)return alert('Önce soldan bir danışma kaydı seçiniz.');const item=getAllVisitConsultationItems().find(i=>i.key===activeVisitConsultationKey);if(!item)return alert('Danışma kaydı bulunamadı.');
        const status=document.getElementById('visitConsultStatus').value,authority=document.getElementById('visitConsultAuthority').value.trim(),topic=document.getElementById('visitConsultTopic').value.trim(),question=document.getElementById('visitConsultQuestion').value.trim(),requestDate=document.getElementById('visitConsultRequestDate').value,expectedResponseDate=document.getElementById('visitConsultExpectedResponseDate').value,responseDate=document.getElementById('visitConsultResponseDate').value,responseText=document.getElementById('visitConsultResponseText').value.trim(),decision=document.getElementById('visitConsultDecision').value.trim(),closureDate=document.getElementById('visitConsultClosureDate').value;
        if(!authority)return alert('Danışılacak makam girilmelidir.');if(!topic&&!question)return alert('Danışma konusu veya sorulacak soru girilmelidir.');if(['sent','waiting_response'].includes(status)&&!requestDate)return alert('Gönderilen veya cevap beklenen danışma kaydı için talep tarihi girilmelidir.');if(!['open','preparing','completed','cancelled'].includes(status)&&!expectedResponseDate&&!responseDate)return alert('Danışma sürecinin izlenebilmesi için cevap beklenen tarih veya cevap tarihi girilmelidir.');if(responseText&&!responseDate)return alert('Gelen cevap girildiğinde cevap tarihi de girilmelidir.');if(status==='completed'&&(!decision||!closureDate))return alert('Tamamlanan danışma kaydı için alınan karar ve kapanış tarihi girilmelidir.');
        const now=new Date().toISOString(),actor=getCurrentVisitUser(),existing=item.overlay||{};const record={sourceRecordId:item.sourceRecordId,status,priority:document.getElementById('visitConsultPriority').value,authority,responsible:document.getElementById('visitConsultResponsible').value.trim(),topic,question,method:document.getElementById('visitConsultMethod').value,requestDate,referenceNo:document.getElementById('visitConsultReferenceNo').value.trim(),expectedResponseDate,nextActionDate:document.getElementById('visitConsultNextActionDate').value,responseDate,responseText,decision,capImpact:document.getElementById('visitConsultCapImpact').value,closureDate,linkedFollowUpId:(document.getElementById('visitConsultLinkedFollowUp')||{}).value||'',createdAt:existing.createdAt||now,createdBy:existing.createdBy||actor,updatedAt:now,updatedBy:actor,isDeleted:false};
        const updates={};updates[`icao_visits/${item.visitId}/consultation/records/${item.sourceRecordId}`]=record;if(existing.linkedFollowUpId&&existing.linkedFollowUpId!==record.linkedFollowUpId){updates[`icao_visits/${item.visitId}/followUp/records/${existing.linkedFollowUpId}/linkedConsultationId`]=null;}if(record.linkedFollowUpId){updates[`icao_visits/${item.visitId}/followUp/records/${record.linkedFollowUpId}/linkedConsultationId`]=item.sourceRecordId;updates[`icao_visits/${item.visitId}/followUp/records/${record.linkedFollowUpId}/updatedAt`]=now;updates[`icao_visits/${item.visitId}/followUp/records/${record.linkedFollowUpId}/updatedBy`]=actor;}updates[`icao_visits/${item.visitId}/consultation/updatedAt`]=now;updates[`icao_visits/${item.visitId}/consultation/updatedBy`]=actor;updates[`icao_visits/${item.visitId}/consultation/moduleVersion`]='visit-package-4-consultation';addVisitAuditToUpdates(updates,item.visitId,'consultation',item.sourceRecordId,existing&&existing.createdAt?'update':'create',existing,record,existing&&existing.createdAt?'Danışma kaydı güncellendi.':'Danışma yönetimi kaydı oluşturuldu.',now,actor,{pq:item.source.pq||'',step:item.source.step||''});
        try{await db.ref().update(updates);alert('Danışma kaydı güncellendi.');}catch(e){console.error(e);alert('Danışma kaydı kaydedilemedi: '+(e.message||e));}
    }
    function clearVisitConsultationFilters(){['visitConsultVisitFilter','visitConsultTimingFilter','visitConsultStatusFilter','visitConsultAuthorityFilter'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='all';});const q=document.getElementById('visitConsultSearch');if(q)q.value='';renderVisitConsultationList();}
    function openSelectedConsultationInWorkspace(){if(!activeVisitConsultationKey)return alert('Önce bir danışma kaydı seçiniz.');const item=getAllVisitConsultationItems().find(i=>i.key===activeVisitConsultationKey);if(!item)return;switchTab('visit-workspace');const sel=document.getElementById('visitWorkspaceVisitSelect');if(sel)sel.value=item.visitId;loadVisitWorkspaceSelection(item.visitId,true);const s=item.source;if(s.targetType&&s.targetKey)selectVisitWorkspaceTarget(s.targetType,encodeURIComponent(s.targetKey));}
    function buildVisitConsultationExportRows(rows){return rows.map(i=>({'Ziyaret':i.visitName,'Denetim Alanı':i.visitAreas.join(', '),'Birim':i.visitUnits.join(' | '),'PQ':i.source.pq||'','Step':i.source.step||'','Hedef':i.source.targetLabel||'','Saha Notu':fullTextForExcel(i.source.noteText||''),'Öncelik':VISIT_FIELD_PRIORITIES[i.priority]||i.priority,'Danışma Durumu':VISIT_CONSULT_STATUSES[i.status]||i.status,'Danışılacak Makam':i.authority||'','Danışma Konusu':fullTextForExcel(i.topic||''),'Sorulacak Soru / Görüş Talebi':fullTextForExcel(i.question||''),'Danışma Yöntemi':VISIT_CONSULT_METHODS[i.method]||i.method||'','Talep Tarihi':i.requestDate||'','Yazı / Kayıt Referansı':i.referenceNo||'','Cevap Beklenen Tarih':i.expectedResponseDate||'','Zaman Durumu':visitConsultTimingLabel(i),'Gecikme Günü':i.daysLate||0,'Süreç Sorumlusu':i.responsible||'','Cevap Tarihi':i.responseDate||'','Gelen Cevap / Görüş':fullTextForExcel(i.responseText||''),'Alınan Karar / İşlem':fullTextForExcel(i.decision||''),'PQ/CAP Etkisi':VISIT_CONSULT_CAP_IMPACTS[i.capImpact]||i.capImpact||'','Sonraki İşlem Tarihi':i.nextActionDate||'','Kapanış Tarihi':i.closureDate||'','Bağlı Takip Kaydı':i.linkedFollowUpId||''}));}
    function exportVisitConsultationExcel(){const items=getFilteredVisitConsultationItems();if(!items.length)return alert('Dışa aktarılacak danışma kaydı bulunamadı.');const rows=buildVisitConsultationExportRows(items);const wb=createReportWorkbook({title:'Ziyaret Danışma Yönetimi',subject:'USOAP CMA ziyaret danışma kayıtları'});addJsonSheet(wb,'Danisma_Kayitlari',rows);addJsonSheet(wb,'Cevabi_Gecikenler',rows.filter(r=>r['Gecikme Günü']>0));addJsonSheet(wb,'Cevap_Bekleyenler',rows.filter(r=>['Gönderildi','Cevap bekleniyor'].includes(r['Danışma Durumu'])));addJsonSheet(wb,'Cevap_Alinanlar',rows.filter(r=>r['Gelen Cevap / Görüş']));addJsonSheet(wb,'Tamamlanan_Danismalar',rows.filter(r=>r['Danışma Durumu']==='Tamamlandı'));downloadReportWorkbook(wb,'Ziyaret_Danisma_Yonetimi.xlsx');}
    function buildVisitConsultationPdfDefinition(items){const content=[{text:'Ziyaret ve İç Denetim - Danışma Yönetimi',style:'header'},{text:`Rapor tarihi: ${formatLongTurkishDate(new Date())} | Danışma kaydı: ${items.length} | Cevabı geciken: ${items.filter(i=>i.timing==='overdue').length}`,style:'subheader'}];items.forEach((i,idx)=>{content.push({text:`${idx+1}. ${i.visitName} — ${i.source.targetLabel||'Ziyaret geneli'}`,style:'visitConsultPdfTitle',pageBreak:idx>0&&idx%8===0?'before':undefined},{table:{widths:[125,'*'],body:[['PQ / Step',`${i.source.pq||'-'} / ${i.source.step||'-'}`],['Danışma durumu',VISIT_CONSULT_STATUSES[i.status]||i.status],['Danışılacak makam',i.authority||'-'],['Konu ve soru',`${i.topic||'-'}\n${i.question||''}`],['Yöntem / talep',`${VISIT_CONSULT_METHODS[i.method]||'-'} | ${formatVisitDate(i.requestDate)} | ${i.referenceNo||'-'}`],['Cevap beklenen tarih',`${formatVisitDate(i.expectedResponseDate)} — ${visitConsultTimingLabel(i)}`],['Gelen cevap',`${formatVisitDate(i.responseDate)}\n${i.responseText||'-'}`],['Karar ve CAP etkisi',`${i.decision||'-'}\n${VISIT_CONSULT_CAP_IMPACTS[i.capImpact]||'-'}`],['Sorumlu / sonraki işlem',`${i.responsible||'-'} | ${formatVisitDate(i.nextActionDate)}`],['Bağlı takip',i.linkedFollowUpId||'-'],['Kapanış tarihi',formatVisitDate(i.closureDate)]].map(r=>[{text:r[0],bold:true,fillColor:'#f1f5f9'},fullTextForPdf(r[1])])},layout:'lightHorizontalLines',margin:[0,0,0,9]});});return createStandardPdfDefinition(content,{pageOrientation:'portrait',pageSize:'A4',styles:{visitConsultPdfTitle:{fontSize:9,bold:true,color:'#1d4ed8',margin:[0,7,0,3]}},defaultStyle:{font:'Roboto',fontSize:8}});}
    function exportVisitConsultationPDF(){const items=getFilteredVisitConsultationItems();if(!items.length)return alert('Dışa aktarılacak danışma kaydı bulunamadı.');try{return safeDownloadPdf(buildVisitConsultationPdfDefinition(items),'Ziyaret_Danisma_Yonetimi.pdf');}catch(e){console.error(e);alert('Danışma PDF raporu hazırlanamadı: '+(e.message||e));}}
    window.runVisitConsultationSelfCheck=function(){const items=getAllVisitConsultationItems();const funcs=['renderVisitConsultationModule','saveVisitConsultationRecord','exportVisitConsultationPDF','exportVisitConsultationExcel'];const result={passed:funcs.every(n=>typeof window[n]==='function'||typeof eval(n)==='function'),functions:Object.fromEntries(funcs.map(n=>[n,typeof window[n]==='function'||typeof eval(n)==='function'])),items:items.length,overdue:items.filter(i=>i.timing==='overdue').length,waiting:items.filter(i=>['sent','waiting_response'].includes(i.status)).length,completed:items.filter(i=>i.status==='completed').length};console.log('Danışma Yönetimi öz denetimi:',result);return result;};


    window.runFollowConsultationIntegrationSelfCheck=function(){
        const requiredIds=['visitFollowLinkedConsultation','visitFollowConsultLinkInfo','visitConsultLinkedFollowUp','visitConsultFollowLinkInfo'];
        const funcs=['createConsultationFromSelectedFollowUp','openLinkedConsultationFromFollowUp','openLinkedFollowUpFromConsultation','moveLinkedFollowUpToEvaluation'];
        const follow=getAllVisitFollowUpItems(),consult=getAllVisitConsultationItems();const danglingFollow=follow.filter(f=>f.linkedConsultationId&&!consult.some(c=>c.visitId===f.visitId&&c.sourceRecordId===f.linkedConsultationId));const danglingConsult=consult.filter(c=>c.linkedFollowUpId&&!follow.some(f=>f.visitId===c.visitId&&f.sourceRecordId===c.linkedFollowUpId));
        const result={passed:requiredIds.every(id=>!!document.getElementById(id))&&funcs.every(n=>typeof window[n]==='function'||typeof eval(n)==='function')&&!danglingFollow.length&&!danglingConsult.length,fields:Object.fromEntries(requiredIds.map(id=>[id,!!document.getElementById(id)])),functions:Object.fromEntries(funcs.map(n=>[n,typeof window[n]==='function'||typeof eval(n)==='function'])),linkedFollowups:follow.filter(f=>f.linkedConsultationId).length,linkedConsultations:consult.filter(c=>c.linkedFollowUpId).length,danglingFollow,danglingConsult};console.log('Takip-Danışma entegrasyon öz denetimi:',result);return result;
    };



    // ZİYARET VE İÇ DENETİM - PAKET 6A: DEĞİŞİKLİK GEÇMİŞİ VE DENETİM İZİ
    const VISIT_AUDIT_ENTITY_LABELS={visit:'Ziyaret üst bilgisi',scope:'Kapsam',general_preparation:'Genel hazırlık',preparation_record:'Hazırlık kaydı',fieldwork:'Saha kaydı',followup:'Takip kaydı',consultation:'Danışma kaydı'};
    const VISIT_AUDIT_ACTION_LABELS={create:'Oluşturuldu',update:'Güncellendi',delete:'Silindi / pasife alındı',restore:'Geri alındı'};
    const VISIT_AUDIT_FIELD_LABELS={visitName:'Ziyaret adı',areas:'Denetim alanları',units:'Ziyaret edilen birimler',unit:'Birim',location:'Ziyaret yeri',plannedStart:'Planlanan başlangıç',plannedEnd:'Planlanan bitiş',actualStart:'Gerçekleşen başlangıç',actualEnd:'Gerçekleşen bitiş',status:'Durum',participants:'Katılımcılar',counterparts:'Birim muhatapları',objective:'Amaç',methods:'Yöntemler',generalNotes:'Genel not',projectionDate:'Projeksiyon tarihi',pqCount:'PQ sayısı',stepCount:'CAP adımı sayısı',agenda:'Gündem / çalışma planı',generalQuestions:'Genel sorular',generalEvidenceRequests:'Belge / kanıt talepleri',generalAuthorities:'Görüşülecek kişi / makam',generalRisks:'Genel riskler',generalNotesPreparation:'Hazırlık notları',targetType:'Hedef türü',targetLabel:'Hedef',pq:'PQ',step:'Step',questions:'Sorular',evidenceRequests:'Kanıt talepleri',personsAuthorities:'Kişi / makam',verificationPoints:'Doğrulama hususları',preliminaryAssessment:'Ön değerlendirme',risks:'Riskler',notes:'Notlar',noteType:'Not türü',priority:'Öncelik',recordStatus:'Kayıt durumu',evidenceStatus:'Kanıt durumu',noteText:'Not / tespit',evidenceReviewed:'İncelenen kanıt',assessment:'Değerlendirme',followUpRequired:'Takip gerekli',followUpDate:'Takip tarihi',actionOwner:'Aksiyon sorumlusu',expectedOutput:'Beklenen çıktı',consultAuthority:'Danışılacak makam',consultationTopic:'Danışma konusu',owner:'Takip sorumlusu',evidenceReceived:'Alınan bilgi / kanıt',resultNote:'Takip sonucu',closureDecision:'Kapanış kararı',closureDate:'Kapanış tarihi',authority:'Danışılacak makam',responsible:'Süreç sorumlusu',topic:'Danışma konusu',question:'Sorulacak soru',method:'Danışma yöntemi',requestDate:'Talep tarihi',referenceNo:'Yazı / kayıt referansı',expectedResponseDate:'Cevap beklenen tarih',nextActionDate:'Sonraki işlem tarihi',responseDate:'Cevap tarihi',responseText:'Gelen cevap',decision:'Alınan karar',capImpact:'PQ/CAP etkisi',linkedConsultationId:'Bağlı danışma kaydı',linkedFollowUpId:'Bağlı takip kaydı',isDeleted:'Silinmiş kayıt'};
    const VISIT_AUDIT_IGNORED_FIELDS=new Set(['createdAt','createdBy','updatedAt','updatedBy','deletedAt','deletedBy','moduleVersion','snapshotAt','sourceReportDate','targetSnapshot','sourceFile']);
    // Her kayıt türü yalnızca kendi formunda yönetilen alanlarla karşılaştırılır.
    // Böylece ziyaret üst bilgisi güncellenirken scope, fieldwork, followUp,
    // consultation ve history gibi alt modüller değişmiş gibi raporlanmaz.
    const VISIT_AUDIT_ENTITY_FIELDS={
        visit:new Set(['visitName','areas','units','unit','location','plannedStart','plannedEnd','actualStart','actualEnd','status','participants','counterparts','objective','methods','generalNotes','isDeleted']),
        scope:new Set(['pqCount','stepCount','projectionDate']),
        general_preparation:new Set(['agenda','generalQuestions','generalEvidenceRequests','generalAuthorities','generalRisks','generalNotesPreparation']),
        preparation_record:new Set(['targetType','targetLabel','pq','step','questions','evidenceRequests','personsAuthorities','verificationPoints','preliminaryAssessment','risks','notes','isDeleted']),
        fieldwork:new Set(['targetType','targetLabel','pq','step','noteType','priority','status','recordStatus','evidenceStatus','noteText','evidenceReviewed','assessment','followUpRequired','followUpDate','actionOwner','expectedOutput','consultAuthority','consultationTopic','isDeleted']),
        followup:new Set(['status','priority','followUpDate','owner','actionOwner','expectedOutput','evidenceReceived','resultNote','closureDecision','closureDate','linkedConsultationId','isDeleted']),
        consultation:new Set(['status','priority','authority','responsible','topic','question','method','requestDate','referenceNo','expectedResponseDate','nextActionDate','responseDate','responseText','decision','capImpact','closureDate','linkedFollowUpId','isDeleted'])
    };
    function visitAuditAllowedFields(entityType){return VISIT_AUDIT_ENTITY_FIELDS[entityType]||null;}
    function filterVisitAuditChanges(entityType,changes){
        const allowed=visitAuditAllowedFields(entityType);
        const rows=visitArrayValue(changes);
        return allowed?rows.filter(change=>change&&allowed.has(change.field)):rows;
    }
    function visitAuditActorLabel(actor){return (actor&&((actor.displayName||actor.email||actor.uid)))||'-';}
    function visitAuditValue(value){
        if(value===undefined||value===null||value==='')return '';
        if(Array.isArray(value))return value.map(v=>typeof v==='object'?visitAuditValue(v):String(v)).join(' | ');
        if(typeof value==='object'){
            if(value.displayName||value.email||value.uid)return visitAuditActorLabel(value);
            try{const text=JSON.stringify(value);return text.length>1800?text.slice(0,1800)+'…':text;}catch(e){return String(value);}
        }
        const text=String(value);return text.length>1800?text.slice(0,1800)+'…':text;
    }
    function visitAuditComparable(value){return visitAuditValue(value).replace(/\s+/g,' ').trim();}
    function buildVisitAuditChanges(before,after){
        const b=before||{},a=after||{};const keys=new Set([...Object.keys(b),...Object.keys(a)]);const changes=[];
        keys.forEach(field=>{if(VISIT_AUDIT_IGNORED_FIELDS.has(field))return;const oldValue=visitAuditValue(b[field]),newValue=visitAuditValue(a[field]);if(visitAuditComparable(oldValue)!==visitAuditComparable(newValue))changes.push({field,label:VISIT_AUDIT_FIELD_LABELS[field]||field,oldValue,newValue});});
        return changes.slice(0,80);
    }
    function visitAuditScopeSnapshot(scope){scope=scope||{};return {pqCount:visitArrayValue(scope.pqs).length,stepCount:visitArrayValue(scope.steps).length,projectionDate:scope.projectionDate||''};}
    function visitAuditGeneralPreparationSnapshot(preparation){const g=(preparation&&preparation.general)||{};return {agenda:g.agenda||'',generalQuestions:g.questions||g.generalQuestions||'',generalEvidenceRequests:g.evidenceRequests||g.generalEvidenceRequests||'',generalAuthorities:g.personsAuthorities||g.generalAuthorities||'',generalRisks:g.risks||g.generalRisks||'',generalNotesPreparation:g.notes||g.generalNotes||''};}
    function visitAuditRecordSnapshot(record,entityType){
        record=record||{};
        if(entityType==='scope')return visitAuditScopeSnapshot(record);
        if(entityType==='general_preparation')return visitAuditGeneralPreparationSnapshot(record);
        const copy={},allowed=visitAuditAllowedFields(entityType);
        Object.keys(record).forEach(k=>{
            if(VISIT_AUDIT_IGNORED_FIELDS.has(k))return;
            if(allowed&&!allowed.has(k))return;
            copy[k]=record[k];
        });
        return copy;
    }
    function addVisitAuditToUpdates(updates,visitId,entityType,entityId,action,before,after,summary,now,actor,context){
        if(!updates||!visitId)return null;const id=db.ref(`icao_visits/${visitId}/history`).push().key;const changes=buildVisitAuditChanges(visitAuditRecordSnapshot(before,entityType),visitAuditRecordSnapshot(after,entityType));
        if(action==='update'&&!changes.length)return null;const entry={id,visitId,entityType,entityId:entityId||'',action,summary:summary||'',changes,timestamp:now||new Date().toISOString(),actor:actor||getCurrentVisitUser(),context:context||{},moduleVersion:'visit-package-6A.1',isDeleted:false};
        updates[`icao_visits/${visitId}/history/${id}`]=entry;updates[`icao_visits/${visitId}/historyMeta/updatedAt`]=entry.timestamp;updates[`icao_visits/${visitId}/historyMeta/updatedBy`]=entry.actor;updates[`icao_visits/${visitId}/historyMeta/moduleVersion`]='visit-package-6A.1';return entry;
    }
    function getAllVisitAuditEntries(){
        const rows=[];
        getVisitRecords(true).forEach(visit=>{
            Object.values((visit&&visit.history)||{}).forEach(entry=>{
                if(!entry||entry.isDeleted)return;
                rows.push({...entry,visitId:visit.id,visitName:(visit.visitName||'Adsız ziyaret')+(visit.isDeleted?' [SİLİNMİŞ]':''),visitAreas:visitArrayValue(visit.areas),visitUnits:getVisitUnits(visit),changes:filterVisitAuditChanges(entry.entityType,entry.changes)});
            });
        });
        return rows.sort((a,b)=>String(b.timestamp||'').localeCompare(String(a.timestamp||'')));
    }
    function populateVisitAuditControls(){
        const entries=getAllVisitAuditEntries(),visits=getVisitRecords(true);
        const setOptions=(id,items,allLabel)=>{const el=document.getElementById(id);if(!el)return;const current=el.value||'all';el.innerHTML=`<option value="all">${escapeHtml(allLabel)}</option>`+items.map(x=>`<option value="${escapeHtml(x.value)}">${escapeHtml(x.label)}</option>`).join('');if(Array.from(el.options).some(o=>o.value===current))el.value=current;};
        setOptions('visitAuditVisitFilter',visits.map(v=>({value:v.id,label:(v.visitName||'Adsız ziyaret')+(v.isDeleted?' [SİLİNMİŞ]':'')})),'Tüm ziyaretler');
        setOptions('visitAuditEntityFilter',Object.entries(VISIT_AUDIT_ENTITY_LABELS).map(([value,label])=>({value,label})),'Tüm kayıt türleri');
        setOptions('visitAuditActionFilter',Object.entries(VISIT_AUDIT_ACTION_LABELS).map(([value,label])=>({value,label})),'Tüm işlemler');
        const users=Array.from(new Map(entries.map(e=>[visitAuditActorLabel(e.actor),{value:visitAuditActorLabel(e.actor),label:visitAuditActorLabel(e.actor)}])).values()).sort((a,b)=>a.label.localeCompare(b.label,'tr'));
        setOptions('visitAuditUserFilter',users,'Tüm kullanıcılar');
    }
    function getFilteredVisitAuditEntries(){
        let rows=getAllVisitAuditEntries();const visit=(document.getElementById('visitAuditVisitFilter')||{}).value||'all',entity=(document.getElementById('visitAuditEntityFilter')||{}).value||'all',action=(document.getElementById('visitAuditActionFilter')||{}).value||'all',user=(document.getElementById('visitAuditUserFilter')||{}).value||'all',start=(document.getElementById('visitAuditStartDate')||{}).value||'',end=(document.getElementById('visitAuditEndDate')||{}).value||'',q=((document.getElementById('visitAuditSearch')||{}).value||'').trim().toLocaleLowerCase('tr');
        return rows.filter(e=>{if(visit!=='all'&&e.visitId!==visit)return false;if(entity!=='all'&&e.entityType!==entity)return false;if(action!=='all'&&e.action!==action)return false;if(user!=='all'&&visitAuditActorLabel(e.actor)!==user)return false;const day=String(e.timestamp||'').slice(0,10);if(start&&day<start)return false;if(end&&day>end)return false;if(q){const changeText=e.changes.map(c=>`${c.label} ${c.oldValue} ${c.newValue}`).join(' ');const hay=[e.visitName,e.summary,e.entityId,e.context&&e.context.pq,e.context&&e.context.step,visitAuditActorLabel(e.actor),changeText].join(' ').toLocaleLowerCase('tr');if(!hay.includes(q))return false;}return true;});
    }
    function visitAuditDateTime(value){if(!value)return '-';const d=new Date(value);return Number.isNaN(d.getTime())?String(value):d.toLocaleString('tr-TR',{dateStyle:'medium',timeStyle:'short'});}
    function renderVisitAuditTrail(silent){
        const body=document.getElementById('visitAuditTableBody');if(!body)return;populateVisitAuditControls();const rows=getFilteredVisitAuditEntries();
        const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=String(v);};set('visitAuditKpiTotal',rows.length);set('visitAuditKpiCreate',rows.filter(r=>r.action==='create').length);set('visitAuditKpiUpdate',rows.filter(r=>r.action==='update').length);set('visitAuditKpiDelete',rows.filter(r=>r.action==='delete').length);set('visitAuditKpiUsers',new Set(rows.map(r=>visitAuditActorLabel(r.actor))).size);
        if(!rows.length){body.innerHTML='<tr><td colspan="8" class="visit-audit-empty">Seçilen filtrelerde denetim izi kaydı bulunmuyor.</td></tr>';return;}
        body.innerHTML=rows.map(e=>{const changes=e.changes||[];const changeHtml=changes.length?`<details><summary>${changes.length} alan değişikliği</summary>${changes.map(c=>`<div class="visit-audit-change"><b>${escapeHtml(c.label||c.field)}</b><div class="visit-audit-old"><b>Önce:</b><br>${escapeHtml(c.oldValue||'-')}</div><div class="visit-audit-new"><b>Sonra:</b><br>${escapeHtml(c.newValue||'-')}</div></div>`).join('')}</details>`:'<span style="color:var(--muted)">Alan farkı kaydedilmedi.</span>';const ctx=[e.context&&e.context.pq&&`PQ ${e.context.pq}`,e.context&&e.context.step&&`Step ${e.context.step}`].filter(Boolean).join(' / ')||'-';return `<tr><td>${escapeHtml(visitAuditDateTime(e.timestamp))}</td><td><b>${escapeHtml(e.visitName)}</b><br><span style="color:var(--muted)">${escapeHtml(e.visitAreas.join(', '))}</span></td><td>${escapeHtml(VISIT_AUDIT_ENTITY_LABELS[e.entityType]||e.entityType)}</td><td><span class="visit-audit-badge ${escapeHtml(e.action)}">${escapeHtml(VISIT_AUDIT_ACTION_LABELS[e.action]||e.action)}</span></td><td>${escapeHtml(visitAuditActorLabel(e.actor))}</td><td>${escapeHtml(ctx)}</td><td class="visit-audit-summary">${escapeHtml(e.summary||'-')}</td><td class="visit-audit-changes">${changeHtml}</td></tr>`;}).join('');
    }
    function clearVisitAuditFilters(){['visitAuditVisitFilter','visitAuditEntityFilter','visitAuditActionFilter','visitAuditUserFilter'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='all';});['visitAuditStartDate','visitAuditEndDate','visitAuditSearch'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});renderVisitAuditTrail();}
    function buildVisitAuditExportRows(rows){return rows.flatMap(e=>{const base={'Tarih / Saat':visitAuditDateTime(e.timestamp),'Ziyaret':e.visitName,'Denetim Alanları':e.visitAreas.join(', '),'Birimler':e.visitUnits.join(' | '),'Kayıt Türü':VISIT_AUDIT_ENTITY_LABELS[e.entityType]||e.entityType,'Kayıt Kimliği':e.entityId||'','İşlem':VISIT_AUDIT_ACTION_LABELS[e.action]||e.action,'Kullanıcı':visitAuditActorLabel(e.actor),'PQ':(e.context&&e.context.pq)||'','Step':(e.context&&e.context.step)||'','Özet':fullTextForExcel(e.summary||'')};if(!e.changes.length)return [{...base,'Değişen Alan':'','Önceki Değer':'','Yeni Değer':''}];return e.changes.map(c=>({...base,'Değişen Alan':c.label||c.field,'Önceki Değer':fullTextForExcel(c.oldValue||''),'Yeni Değer':fullTextForExcel(c.newValue||'')}));});}
    function exportVisitAuditExcel(){const rows=getFilteredVisitAuditEntries();if(!rows.length)return alert('Dışa aktarılacak denetim izi kaydı bulunamadı.');const wb=createReportWorkbook({title:'Ziyaret Değişiklik Geçmişi ve Denetim İzi',subject:'USOAP CMA ziyaret modülü işlem geçmişi'});addJsonSheet(wb,'Denetim_Izi',buildVisitAuditExportRows(rows));addJsonSheet(wb,'Islem_Ozeti',Object.entries(VISIT_AUDIT_ACTION_LABELS).map(([k,v])=>({'İşlem':v,'Adet':rows.filter(r=>r.action===k).length})));addJsonSheet(wb,'Kullanici_Ozeti',Array.from(new Set(rows.map(r=>visitAuditActorLabel(r.actor)))).map(u=>({'Kullanıcı':u,'İşlem Adedi':rows.filter(r=>visitAuditActorLabel(r.actor)===u).length})));downloadReportWorkbook(wb,'Ziyaret_Degisiklik_Gecmisi.xlsx');}
    function buildVisitAuditPdfDefinition(rows){const content=[{text:'Ziyaret ve İç Denetim - Değişiklik Geçmişi ve Denetim İzi',style:'header'},{text:`Rapor tarihi: ${formatLongTurkishDate(new Date())} | İşlem: ${rows.length} | Kullanıcı: ${new Set(rows.map(r=>visitAuditActorLabel(r.actor))).size}`,style:'subheader'}];rows.forEach((e,idx)=>{content.push({text:`${idx+1}. ${e.visitName} — ${VISIT_AUDIT_ENTITY_LABELS[e.entityType]||e.entityType}`,style:'visitAuditPdfTitle',pageBreak:idx>0&&idx%10===0?'before':undefined},{table:{widths:[120,'*'],body:[['Tarih / Saat',visitAuditDateTime(e.timestamp)],['İşlem',VISIT_AUDIT_ACTION_LABELS[e.action]||e.action],['Kullanıcı',visitAuditActorLabel(e.actor)],['PQ / Step',`${(e.context&&e.context.pq)||'-'} / ${(e.context&&e.context.step)||'-'}`],['Özet',e.summary||'-'],['Değişiklikler',(e.changes||[]).map(c=>`${c.label||c.field}\nÖnce: ${c.oldValue||'-'}\nSonra: ${c.newValue||'-'}`).join('\n\n')||'-']].map(r=>[{text:r[0],bold:true,fillColor:'#f1f5f9'},fullTextForPdf(r[1])])},layout:'lightHorizontalLines',margin:[0,0,0,8]});});return createStandardPdfDefinition(content,{pageOrientation:'portrait',pageSize:'A4',styles:{visitAuditPdfTitle:{fontSize:9,bold:true,color:'#1d4ed8',margin:[0,7,0,3]}},defaultStyle:{font:'Roboto',fontSize:8}});}
    function exportVisitAuditPDF(){const rows=getFilteredVisitAuditEntries();if(!rows.length)return alert('Dışa aktarılacak denetim izi kaydı bulunamadı.');return safeDownloadPdf(buildVisitAuditPdfDefinition(rows),'Ziyaret_Degisiklik_Gecmisi.pdf');}
    window.renderVisitAuditTrail=renderVisitAuditTrail;window.clearVisitAuditFilters=clearVisitAuditFilters;window.exportVisitAuditExcel=exportVisitAuditExcel;window.exportVisitAuditPDF=exportVisitAuditPDF;
    window.runVisitAuditSelfCheck=function(){const rows=getAllVisitAuditEntries();const result={passed:!!document.getElementById('tab-visit-audit')&&typeof addVisitAuditToUpdates==='function'&&typeof exportVisitAuditPDF==='function'&&typeof exportVisitAuditExcel==='function',entries:rows.length,visits:new Set(rows.map(r=>r.visitId)).size,users:new Set(rows.map(r=>visitAuditActorLabel(r.actor))).size,historyPath:'icao_visits/{visitId}/history'};console.log('Paket 6A öz denetimi:',result);return result;};


    // ZİYARET VE İÇ DENETİM - PAKET 5: ZİYARET RAPORLARI
    const VISIT_REPORT_TYPES = {
        executive:{label:'Yönetici Ziyaret Özeti',desc:'Ziyaretlerin kapsamı, açık riskleri, takip ve danışma darboğazlarını kısa yönetici özeti olarak sunar.'},
        result:{label:'Ziyaret Sonuç Raporu',desc:'Saha tespitleri, kanıt değerlendirmeleri, iç denetim bulguları, iyileştirmeler ve açık hususları birleştirir.'},
        complete:{label:'Tam Ziyaret Dosyası',desc:'Plan, kapsam, hazırlık, PQ/CAP çalışma kâğıdı, saha kayıtları, takip ve danışma kayıtlarının tamamını içerir.'},
        workpaper:{label:'Kapsam ve Çalışma Kâğıdı',desc:'Seçilen PQ/CAP adımları, hazırlık soruları, kanıt talepleri ve ziyaret gündemini raporlar.'},
        pqcap:{label:'PQ ve CAP İnceleme Raporu',desc:'PQ ve CAP adımı bazında kapsam, durum, sorumlu ofis, hedef tarih ve saha notlarını gösterir.'},
        followup:{label:'Açık ve Geciken Takipler',desc:'Açık, gecikmiş, kanıt bekleyen ve tamamlanan takip kayıtlarını ayrıntılı sunar.'},
        consultation:{label:'Danışma Kayıtları ve Sonuçları',desc:'Danışılacak makam, talep/cevap tarihleri, gelen görüş, karar ve CAP etkisini raporlar.'},
        evidence:{label:'Kanıt Yeterlilik Raporu',desc:'Talep edilen ve incelenen kanıtları; yeterli, kısmen yeterli, yetersiz ve bekleyen durumlarıyla gösterir.'},
        findings:{label:'Bulgular ve İyileştirmeler',desc:'İç denetim bulguları, uyumsuzluk riskleri, iyileştirme fırsatları ve olumlu uygulamaları toplar.'}
    };
    let activeVisitReportType = 'executive';

    function visitReportUnique(values){return Array.from(new Set((values||[]).map(v=>String(v||'').trim()).filter(Boolean)));}
    function getVisitReportSelectedVisits(){
        const visitId=(document.getElementById('visitReportVisitFilter')||{}).value||'all';
        const area=(document.getElementById('visitReportAreaFilter')||{}).value||'all';
        const status=(document.getElementById('visitReportStatusFilter')||{}).value||'all';
        const q=((document.getElementById('visitReportSearch')||{}).value||'').trim().toLocaleLowerCase('tr');
        return getInternalWorkflowVisitRecords().filter(v=>{
            if(visitId!=='all'&&v.id!==visitId)return false;
            if(area!=='all'&&!visitArrayValue(v.areas).includes(area))return false;
            if(status!=='all'&&v.status!==status)return false;
            if(q){
                const pqText=getVisitScopeStoredPqs(v).map(p=>p.pq).join(' ');
                const hay=[v.visitName,getVisitUnits(v).join(' '),visitArrayValue(v.areas).join(' '),v.location,v.participants,v.counterparts,v.objective,pqText].join(' ').toLocaleLowerCase('tr');
                if(!hay.includes(q))return false;
            }
            return true;
        }).sort((a,b)=>String(a.plannedStart||'9999').localeCompare(String(b.plannedStart||'9999'))||String(a.visitName||'').localeCompare(String(b.visitName||''),'tr'));
    }
    function visitReportGetFieldwork(visits){return (visits||[]).flatMap(v=>getVisitFieldworkRecords(v).map(r=>({...r,visitId:v.id,visitName:v.visitName||'Adsız ziyaret',visitAreas:visitArrayValue(v.areas),visitUnits:getVisitUnits(v)})));}
    function visitReportGetFollowups(visits){const ids=new Set((visits||[]).map(v=>v.id));return getAllVisitFollowUpItems().filter(i=>ids.has(i.visitId));}
    function visitReportGetConsultations(visits){const ids=new Set((visits||[]).map(v=>v.id));return getAllVisitConsultationItems().filter(i=>ids.has(i.visitId));}
    function visitReportGetScopePqs(visits){return (visits||[]).flatMap(v=>getVisitScopeStoredPqs(v).map(p=>({...p,visitId:v.id,visitName:v.visitName||'Adsız ziyaret',visitAreas:visitArrayValue(v.areas),visitUnits:getVisitUnits(v)})));}
    function visitReportGetScopeSteps(visits){return (visits||[]).flatMap(v=>getVisitScopeStoredSteps(v).map(s=>({...s,visitId:v.id,visitName:v.visitName||'Adsız ziyaret',visitAreas:visitArrayValue(v.areas),visitUnits:getVisitUnits(v)})));}
    function visitReportGetPreparations(visits){return (visits||[]).flatMap(v=>getVisitPreparationRecords(v).map(r=>({...r,visitId:v.id,visitName:v.visitName||'Adsız ziyaret'})));}
    function visitReportEvidenceIsIssue(status){return ['not_reviewed','requested','partially_sufficient','insufficient','update_required','verification_pending'].includes(String(status||''));}
    function visitReportBuildBundle(){
        const visits=getVisitReportSelectedVisits(),fieldwork=visitReportGetFieldwork(visits),followups=visitReportGetFollowups(visits),consultations=visitReportGetConsultations(visits),pqs=visitReportGetScopePqs(visits),steps=visitReportGetScopeSteps(visits),preparations=visitReportGetPreparations(visits);
        const evidence=fieldwork.filter(r=>r.evidenceReviewed||r.evidenceStatus);
        const findings=fieldwork.filter(r=>['internal_finding','nonconformity_risk'].includes(r.noteType));
        const improvements=fieldwork.filter(r=>r.noteType==='improvement');
        const positive=fieldwork.filter(r=>r.noteType==='positive_practice');
        const openFieldwork=fieldwork.filter(r=>!['completed','cancelled'].includes(r.status));
        const openFollowups=followups.filter(i=>!['completed','cancelled'].includes(i.status));
        const overdueFollowups=openFollowups.filter(i=>i.timing==='overdue');
        const openConsultations=consultations.filter(i=>!['completed','cancelled'].includes(i.status));
        const evidenceSufficient=evidence.filter(r=>r.evidenceStatus==='sufficient');
        const evidenceIssues=evidence.filter(r=>visitReportEvidenceIsIssue(r.evidenceStatus));
        return {visits,fieldwork,followups,consultations,pqs,steps,preparations,evidence,findings,improvements,positive,openFieldwork,openFollowups,overdueFollowups,openConsultations,evidenceSufficient,evidenceIssues,reportType:activeVisitReportType};
    }
    function populateVisitReportControls(){
        const visits=getInternalWorkflowVisitRecords();
        const visitSel=document.getElementById('visitReportVisitFilter');
        if(visitSel){const cur=visitSel.value||'all';visitSel.innerHTML='<option value="all">Tüm ziyaretler</option>'+visits.map(v=>`<option value="${escapeHtml(v.id)}">${escapeHtml(v.visitName||'Adsız ziyaret')}</option>`).join('');visitSel.value=Array.from(visitSel.options).some(o=>o.value===cur)?cur:'all';}
        const typeSel=document.getElementById('visitReportType');
        if(typeSel){typeSel.innerHTML=Object.entries(VISIT_REPORT_TYPES).map(([k,v])=>`<option value="${k}">${escapeHtml(v.label)}</option>`).join('');typeSel.value=activeVisitReportType;}
        const areaSel=document.getElementById('visitReportAreaFilter');
        if(areaSel){const cur=areaSel.value||'all';const areas=visitReportUnique(visits.flatMap(v=>visitArrayValue(v.areas))).sort(sortAreas);areaSel.innerHTML='<option value="all">Tüm alanlar</option>'+areas.map(a=>`<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`).join('');areaSel.value=Array.from(areaSel.options).some(o=>o.value===cur)?cur:'all';}
        const statusSel=document.getElementById('visitReportStatusFilter');
        if(statusSel){const cur=statusSel.value||'all';statusSel.innerHTML='<option value="all">Tüm durumlar</option>'+Object.entries(VISIT_STATUSES).map(([k,v])=>`<option value="${k}">${escapeHtml(v.label)}</option>`).join('');statusSel.value=Array.from(statusSel.options).some(o=>o.value===cur)?cur:'all';}
        renderVisitReportTemplates();
    }
    function renderVisitReportTemplates(){
        const el=document.getElementById('visitReportTemplateList');if(!el)return;
        el.innerHTML=Object.entries(VISIT_REPORT_TYPES).map(([k,v])=>`<button type="button" class="visit-report-template ${k===activeVisitReportType?'active':''}" onclick="setVisitReportType('${k}')"><b>${escapeHtml(v.label)}</b><span>${escapeHtml(v.desc)}</span></button>`).join('');
        const ctx=document.getElementById('visitReportTemplateContext');if(ctx)ctx.textContent=VISIT_REPORT_TYPES[activeVisitReportType]?.label||'-';
    }
    function setVisitReportType(type){if(!VISIT_REPORT_TYPES[type])return;activeVisitReportType=type;const s=document.getElementById('visitReportType');if(s)s.value=type;renderVisitReportTemplates();renderVisitReportsPreview();}
    function clearVisitReportFilters(){['visitReportVisitFilter','visitReportAreaFilter','visitReportStatusFilter'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='all';});const q=document.getElementById('visitReportSearch');if(q)q.value='';renderVisitReportsPreview();}
    function renderVisitReportsModule(){populateVisitReportControls();renderVisitReportsPreview();}
    function visitReportItemHtml(title,meta,text,cls=''){return `<div class="visit-report-preview-item ${cls}"><b>${escapeHtml(title||'-')}</b>${meta?`<div class="meta">${escapeHtml(meta)}</div>`:''}${text?`<div style="margin-top:4px;white-space:pre-wrap">${escapeHtml(shortenVisitText(text,420))}</div>`:''}</div>`;}
    function visitReportSectionHtml(title,body){return `<section class="visit-report-preview-section"><h5>${escapeHtml(title)}</h5><div class="visit-report-preview-body">${body||'<div class="visit-report-empty">Kayıt bulunamadı.</div>'}</div></section>`;}
    function visitReportSummaryText(b){
        const topVisit=b.visits[0];
        const prefix=b.visits.length===1?`${topVisit.visitName||'Ziyaret'} için`:`${b.visits.length} ziyaret kapsamında`;
        return `${prefix} ${b.pqs.length} PQ ve ${b.steps.length} CAP adımı rapor kapsamındadır. ${b.fieldwork.length} saha kaydının ${b.openFieldwork.length} adedi açık durumdadır. ${b.openFollowups.length} açık takip kaydının ${b.overdueFollowups.length} adedi gecikmiştir. ${b.openConsultations.length} danışma süreci açık olup ${b.evidenceIssues.length} kanıt kaydı ilave inceleme veya doğrulama gerektirmektedir.`;
    }
    function renderVisitReportsPreview(){
        const b=visitReportBuildBundle(),preview=document.getElementById('visitReportPreview');if(!preview)return;
        [['visitReportKpiVisits',b.visits.length],['visitReportKpiPqs',b.pqs.length],['visitReportKpiSteps',b.steps.length],['visitReportKpiFieldwork',b.fieldwork.length],['visitReportKpiOpenFollow',b.openFollowups.length],['visitReportKpiOverdue',b.overdueFollowups.length],['visitReportKpiConsult',b.openConsultations.length],['visitReportKpiEvidence',b.evidenceSufficient.length]].forEach(([id,val])=>{const e=document.getElementById(id);if(e)e.textContent=val;});
        const scope=document.getElementById('visitReportScopeContext');if(scope)scope.textContent=`${b.visits.length} ziyaret · ${b.pqs.length} PQ · ${b.steps.length} Step`;
        if(!b.visits.length){preview.innerHTML='<div class="visit-report-empty">Seçili filtrelere uygun ziyaret bulunamadı.</div>';return;}
        const sections=[];
        sections.push(`<div class="visit-report-summary"><b>${escapeHtml(VISIT_REPORT_TYPES[activeVisitReportType].label)}</b><br>${escapeHtml(visitReportSummaryText(b))}</div>`);
        const visitBody=b.visits.slice(0,12).map(v=>visitReportItemHtml(v.visitName||'Adsız ziyaret',`${visitArrayValue(v.areas).join(', ')||'-'} · ${getVisitUnits(v).join(' | ')||'-'} · ${(VISIT_STATUSES[v.status]||{}).label||v.status||'-'}`,`${formatVisitDateRange(v.plannedStart,v.plannedEnd)} | ${v.objective||''}`,v.status==='completed'?'ok':'')).join('');
        sections.push(visitReportSectionHtml('Ziyaret Kapsamı',visitBody));
        if(['executive','result','complete'].includes(activeVisitReportType)){
            const riskBody=b.overdueFollowups.slice(0,10).map(i=>visitReportItemHtml(`${i.visitName} — ${i.source.targetLabel||'Ziyaret geneli'}`,`${i.daysLate} gün gecikmiş · ${VISIT_FIELD_PRIORITIES[i.priority]||i.priority}`,i.source.noteText||i.resultNote||'', 'danger')).join('')||b.openFollowups.slice(0,8).map(i=>visitReportItemHtml(`${i.visitName} — ${i.source.targetLabel||'Ziyaret geneli'}`,visitFollowTimingLabel(i),i.source.noteText||'', 'warn')).join('');
            sections.push(visitReportSectionHtml('Öncelikli Açık Hususlar',riskBody));
        }
        if(['result','complete','findings'].includes(activeVisitReportType)){
            const findingBody=b.findings.slice(0,15).map(r=>visitReportItemHtml(`${r.visitName} — ${r.targetLabel||r.pq||'Ziyaret geneli'}`,`${VISIT_FIELD_NOTE_TYPES[r.noteType]||r.noteType} · ${VISIT_FIELD_PRIORITIES[r.priority]||r.priority}`,r.noteText||r.assessment||'',r.noteType==='internal_finding'?'danger':'warn')).join('');
            const improvementBody=b.improvements.slice(0,10).map(r=>visitReportItemHtml(`${r.visitName} — ${r.targetLabel||r.pq||'Ziyaret geneli'}`,'İyileştirme fırsatı',r.noteText||r.assessment||'','ok')).join('');
            sections.push(visitReportSectionHtml('İç Denetim Bulguları ve Riskler',findingBody));
            sections.push(visitReportSectionHtml('İyileştirme Fırsatları',improvementBody));
        }
        if(['workpaper','complete','pqcap'].includes(activeVisitReportType)){
            const pqBody=b.pqs.slice(0,18).map(p=>visitReportItemHtml(`${p.visitName} — PQ ${p.pq||'-'}`,`${p.area||p.alan||'-'} · ${p.statusLabel||p.status||''}`,p.finding||p.pqQuestion||p.question||'')).join('');
            sections.push(visitReportSectionHtml('PQ Kapsamı',pqBody));
        }
        if(['result','complete','evidence'].includes(activeVisitReportType)){
            const evidenceBody=b.evidence.slice(0,20).map(r=>visitReportItemHtml(`${r.visitName} — ${r.targetLabel||r.pq||'Ziyaret geneli'}`,VISIT_EVIDENCE_STATUSES[r.evidenceStatus]||r.evidenceStatus||'Kanıt durumu belirtilmedi',r.evidenceReviewed||r.assessment||'',visitReportEvidenceIsIssue(r.evidenceStatus)?'warn':'ok')).join('');
            sections.push(visitReportSectionHtml('Kanıt Değerlendirmeleri',evidenceBody));
        }
        if(['followup','complete'].includes(activeVisitReportType)){
            const followBody=b.followups.slice(0,20).map(i=>visitReportItemHtml(`${i.visitName} — ${i.source.targetLabel||'Ziyaret geneli'}`,`${VISIT_FOLLOW_STATUSES[i.status]||i.status} · ${visitFollowTimingLabel(i)}`,i.source.noteText||i.resultNote||'',i.timing==='overdue'?'danger':i.status==='completed'?'ok':'warn')).join('');
            sections.push(visitReportSectionHtml('Takip Kayıtları',followBody));
        }
        if(['consultation','complete'].includes(activeVisitReportType)){
            const consultBody=b.consultations.slice(0,20).map(i=>visitReportItemHtml(`${i.visitName} — ${i.authority||'Danışılacak makam belirtilmedi'}`,`${VISIT_CONSULT_STATUSES[i.status]||i.status} · ${visitConsultTimingLabel(i)}`,`${i.topic||i.question||''}${i.decision?`\nKarar: ${i.decision}`:''}`,i.timing==='overdue'?'danger':i.status==='completed'?'ok':'warn')).join('');
            sections.push(visitReportSectionHtml('Danışma Kayıtları',consultBody));
        }
        preview.innerHTML=sections.join('');
    }

    function visitReportRowsVisits(b){return buildVisitExportRows(b.visits);}
    function visitReportRowsPqs(b){return b.pqs.map(p=>({'Ziyaret':p.visitName,'Alanlar':p.visitAreas.join(', '),'Birimler':p.visitUnits.join(' | '),'PQ':p.pq||'','Denetim Alanı':p.area||p.alan||'','PQ Durumu':p.statusLabel||p.status||'','Bulgu / PQ Sorusu':fullTextForExcel(p.finding||p.pqQuestion||p.question||''),'Kapsam Notu':fullTextForExcel(p.note||'')}));}
    function visitReportRowsSteps(b){return b.steps.map(s=>({'Ziyaret':s.visitName,'PQ':s.pq||'','Step':s.step||'','Alan':s.area||s.alan||'','Standart Durum':s.statusLabel||s.status||'','Hedef Tarih':s.estDate||s.dueDate||s.targetDate||'','Sorumlu Ofis':s.office||s.responsibleOffice||'','Gecikme Günü':s.delayDays||s.daysLate||0,'CAP Metni':fullTextForExcel(s.action||s.capText||s.actionText||s.description||''),'Kaynak Dosya':s.sourceFile||''}));}
    function visitReportRowsGeneralPreparation(b){return b.visits.map(v=>{const g=((v.preparation||{}).general)||{};return {'Ziyaret':v.visitName||'','Gündem / Çalışma Planı':fullTextForExcel(g.agenda||''),'Genel Sorular':fullTextForExcel(g.questions||''),'Talep Edilecek Kanıtlar':fullTextForExcel(g.evidenceRequests||''),'Görüşülecek Kişiler / Makamlar':fullTextForExcel(g.personsAuthorities||''),'Genel Riskler':fullTextForExcel(g.risks||''),'Diğer Notlar':fullTextForExcel(g.notes||'')};});}
    function visitReportRowsPreparation(b){return b.preparations.map(r=>({'Ziyaret':r.visitName,'Seviye':r.targetType||'','PQ':r.pq||'','Step':r.step||'','Hedef':r.targetLabel||'','Sorular':fullTextForExcel(r.questions||''),'Kanıt Talepleri':fullTextForExcel(r.evidenceRequests||r.evidence||''),'Görüşülecek Kişi / Makam':fullTextForExcel(r.personsAuthorities||r.peopleToMeet||r.authority||''),'Doğrulanacak Hususlar':fullTextForExcel(r.verificationPoints||''),'Ön Değerlendirme':fullTextForExcel(r.preliminaryAssessment||r.preAssessment||''),'Riskler':fullTextForExcel(r.risks||''),'Notlar':fullTextForExcel(r.notes||'')}));}
    function visitReportRowsFieldwork(b){return b.fieldwork.map(r=>({'Ziyaret':r.visitName,'Alanlar':r.visitAreas.join(', '),'Birimler':r.visitUnits.join(' | '),'Hedef Türü':r.targetType==='step'?'CAP Adımı':r.targetType==='pq'?'PQ':'Ziyaret Geneli','Hedef':r.targetLabel||'','PQ':r.pq||'','Step':r.step||'','Not Türü':VISIT_FIELD_NOTE_TYPES[r.noteType]||r.noteType||'','Öncelik':VISIT_FIELD_PRIORITIES[r.priority]||r.priority||'','Kayıt Durumu':VISIT_FIELD_RECORD_STATUSES[r.status]||r.status||'','Not / Tespit':fullTextForExcel(r.noteText||''),'Kanıt':fullTextForExcel(r.evidenceReviewed||''),'Kanıt Durumu':VISIT_EVIDENCE_STATUSES[r.evidenceStatus]||r.evidenceStatus||'','Değerlendirme':fullTextForExcel(r.assessment||''),'Takip Gerekli':r.followUpRequired?'EVET':'HAYIR','Takip Tarihi':r.followUpDate||'','Aksiyon Sorumlusu':r.actionOwner||'','Danışılacak Makam':r.consultAuthority||'','Danışma Konusu':fullTextForExcel(r.consultationTopic||''),'Beklenen Çıktı':fullTextForExcel(r.expectedOutput||'')}));}
    function visitReportRowsEvidence(b){return b.evidence.map(r=>({'Ziyaret':r.visitName,'PQ':r.pq||'','Step':r.step||'','Hedef':r.targetLabel||'','Kanıt Durumu':VISIT_EVIDENCE_STATUSES[r.evidenceStatus]||r.evidenceStatus||'','Kanıt / Belge':fullTextForExcel(r.evidenceReviewed||''),'Değerlendirme':fullTextForExcel(r.assessment||''),'İlave İşlem Gerekli':visitReportEvidenceIsIssue(r.evidenceStatus)?'EVET':'HAYIR'}));}
    function visitReportRowsFindings(b){return [...b.findings,...b.improvements,...b.positive].map(r=>({'Ziyaret':r.visitName,'PQ':r.pq||'','Step':r.step||'','Hedef':r.targetLabel||'','Kayıt Türü':VISIT_FIELD_NOTE_TYPES[r.noteType]||r.noteType||'','Öncelik':VISIT_FIELD_PRIORITIES[r.priority]||r.priority||'','Tespit / Öneri':fullTextForExcel(r.noteText||''),'Değerlendirme':fullTextForExcel(r.assessment||''),'Beklenen Çıktı':fullTextForExcel(r.expectedOutput||'')}));}
    function visitReportRowsSummary(b){return [
        {'Gösterge':'Ziyaret sayısı','Değer':b.visits.length},{'Gösterge':'Kapsamdaki PQ','Değer':b.pqs.length},{'Gösterge':'Kapsamdaki CAP adımı','Değer':b.steps.length},{'Gösterge':'Saha kaydı','Değer':b.fieldwork.length},{'Gösterge':'Açık saha kaydı','Değer':b.openFieldwork.length},{'Gösterge':'Açık takip','Değer':b.openFollowups.length},{'Gösterge':'Geciken takip','Değer':b.overdueFollowups.length},{'Gösterge':'Açık danışma','Değer':b.openConsultations.length},{'Gösterge':'Kanıt kaydı','Değer':b.evidence.length},{'Gösterge':'Yeterli kanıt','Değer':b.evidenceSufficient.length},{'Gösterge':'İlave işlem gerektiren kanıt','Değer':b.evidenceIssues.length},{'Gösterge':'İç denetim bulgusu / risk','Değer':b.findings.length},{'Gösterge':'İyileştirme fırsatı','Değer':b.improvements.length},{'Gösterge':'Olumlu uygulama','Değer':b.positive.length}
    ];}
    function visitReportAddExcelSheets(wb,b,type){
        addJsonSheet(wb,'Rapor_Ozeti',visitReportRowsSummary(b));addJsonSheet(wb,'Ziyaretler',visitReportRowsVisits(b));
        if(['executive','result','complete','workpaper','pqcap'].includes(type)){addJsonSheet(wb,'PQ_Kapsami',visitReportRowsPqs(b));addJsonSheet(wb,'CAP_Adimlari',visitReportRowsSteps(b));}
        if(['workpaper','complete'].includes(type)){addJsonSheet(wb,'Genel_Hazirlik',visitReportRowsGeneralPreparation(b));addJsonSheet(wb,'Hazirlik_Kayitlari',visitReportRowsPreparation(b));}
        if(['result','complete','pqcap','evidence','findings'].includes(type)){addJsonSheet(wb,'Saha_Kayitlari',visitReportRowsFieldwork(b));}
        if(['result','complete','evidence'].includes(type)){addJsonSheet(wb,'Kanit_Degerlendirme',visitReportRowsEvidence(b));addJsonSheet(wb,'Kanit_Sorunlari',visitReportRowsEvidence({...b,evidence:b.evidenceIssues}));}
        if(['result','complete','findings'].includes(type)){addJsonSheet(wb,'Bulgu_ve_Iyilestirme',visitReportRowsFindings(b));}
        if(['executive','result','complete','followup'].includes(type)){const rows=buildVisitFollowUpExportRows(b.followups);addJsonSheet(wb,'Takip_Kayitlari',rows);addJsonSheet(wb,'Geciken_Takipler',buildVisitFollowUpExportRows(b.overdueFollowups));}
        if(['executive','result','complete','consultation'].includes(type)){addJsonSheet(wb,'Danisma_Kayitlari',buildVisitConsultationExportRows(b.consultations));}
    }
    function exportVisitReportsExcel(){const b=visitReportBuildBundle();if(!b.visits.length)return alert('Dışa aktarılacak ziyaret bulunamadı.');const label=VISIT_REPORT_TYPES[activeVisitReportType].label;const wb=createReportWorkbook({title:`Ziyaret ve İç Denetim - ${label}`,subject:'USOAP CMA ziyaret raporları'});visitReportAddExcelSheets(wb,b,activeVisitReportType);downloadReportWorkbook(wb,`Ziyaret_Raporu_${activeVisitReportType}.xlsx`);}

    function visitReportPdfKeyValueRows(rows){return {table:{widths:[125,'*'],body:(rows||[]).map(r=>[{text:String(r[0]||''),bold:true,fillColor:'#f1f5f9'},fullTextForPdf(r[1]||'-')])},layout:'lightHorizontalLines',margin:[0,0,0,9]};}
    function visitReportPdfRecord(title,rows,idx,accent='#2563eb'){return [{text:title,style:'visitReportRecordTitle',color:accent,pageBreak:idx>0&&idx%10===0?'before':undefined},visitReportPdfKeyValueRows(rows)];}
    function buildVisitReportsPdfDefinition(b,type){
        const label=VISIT_REPORT_TYPES[type].label,content=[{text:`Ziyaret ve İç Denetim - ${label}`,style:'header'},{text:`Rapor tarihi: ${formatLongTurkishDate(new Date())} | Ziyaret: ${b.visits.length} | PQ: ${b.pqs.length} | CAP adımı: ${b.steps.length}`,style:'subheader'},{text:visitReportSummaryText(b),style:'visitReportExecutiveText'}];
        content.push({text:'Yönetim Göstergeleri',style:'sectionHeader'},visitReportPdfKeyValueRows(visitReportRowsSummary(b).map(r=>[r['Gösterge'],String(r['Değer'])])));
        content.push({text:'Ziyaret Bilgileri',style:'sectionHeader'});
        b.visits.forEach((v,idx)=>content.push(...visitReportPdfRecord(`${idx+1}. ${v.visitName||'Adsız ziyaret'}`,[['Durum',(VISIT_STATUSES[v.status]||{}).label||v.status||'-'],['Alan / Birim',`${visitArrayValue(v.areas).join(', ')||'-'} | ${getVisitUnits(v).join(' | ')||'-'}`],['Planlanan / Gerçekleşen',`${formatVisitDateRange(v.plannedStart,v.plannedEnd)} | ${formatVisitDateRange(v.actualStart,v.actualEnd)}`],['Amaç',v.objective||'-'],['Katılımcılar / Muhataplar',`${v.participants||'-'}\n${v.counterparts||'-'}`],['Genel not',v.generalNotes||'-']],idx)));
        if(['workpaper','complete','pqcap'].includes(type)){
            content.push({text:'PQ ve CAP Kapsamı',style:'sectionHeader'});
            sortVisitPdfPqs(b.pqs).forEach((p,idx)=>content.push(...visitReportPdfRecord(`${p.visitName} — PQ ${p.pq||'-'}`,[['Alan / Durum',`${p.area||p.alan||'-'} | ${p.statusLabel||p.status||'-'}`],['Bulgu / PQ Sorusu',p.finding||p.pqQuestion||p.question||'-']],idx)));
            sortVisitPdfSteps(b.steps).forEach((s,idx)=>content.push(...visitReportPdfRecord(`${s.visitName} — PQ ${s.pq||'-'} / Step ${s.step||'-'}`,[['Durum / Tarih',`${s.statusLabel||s.status||'-'} | ${formatVisitDate(s.estDate||s.dueDate||s.targetDate)}`],['Sorumlu Ofis',s.office||s.responsibleOffice||'-'],['CAP Metni',s.action||s.capText||s.actionText||s.description||'-']],idx)));
        }
        if(['workpaper','complete'].includes(type)){
            content.push({text:'Genel Hazırlık ve Ziyaret Gündemi',style:'sectionHeader'});
            b.visits.forEach((v,idx)=>{const g=((v.preparation||{}).general)||{};content.push(...visitReportPdfRecord(`${v.visitName||'Adsız ziyaret'} — Genel Hazırlık`,[['Gündem / Çalışma Planı',g.agenda||'-'],['Genel Sorular',g.questions||'-'],['Talep Edilecek Kanıtlar',g.evidenceRequests||'-'],['Görüşülecek Kişiler / Makamlar',g.personsAuthorities||'-'],['Genel Riskler',g.risks||'-'],['Diğer Notlar',g.notes||'-']],idx));});
            b.preparations.forEach((r,idx)=>content.push(...visitReportPdfRecord(`${r.visitName} — ${r.targetLabel||'Ziyaret geneli'}`,[['Sorular',r.questions||'-'],['Kanıt Talepleri',r.evidenceRequests||'-'],['Görüşülecek Kişi / Makam',r.personsAuthorities||'-'],['Doğrulanacak Hususlar',r.verificationPoints||'-'],['Ön Değerlendirme',r.preliminaryAssessment||'-'],['Riskler / Notlar',`${r.risks||'-'}\n${r.notes||''}`]],idx,'#7c3aed')));
        }
        if(['result','complete','pqcap','evidence','findings'].includes(type)){
            const reportFieldwork=sortVisitPdfRecords(type==='findings'?[...b.findings,...b.improvements,...b.positive]:type==='evidence'?b.evidence:b.fieldwork,{groupByVisit:b.visits.length>1});
            content.push({text:type==='findings'?'Bulgular, Riskler ve İyileştirmeler':type==='evidence'?'Kanıtla İlişkili Saha Kayıtları':'Saha Kayıtları',style:'sectionHeader'});
            reportFieldwork.forEach((r,idx)=>content.push(...visitReportPdfRecord(`${r.visitName} — ${r.targetLabel||r.pq||'Ziyaret geneli'}`,[['Tür / Öncelik',`${VISIT_FIELD_NOTE_TYPES[r.noteType]||r.noteType||'-'} | ${VISIT_FIELD_PRIORITIES[r.priority]||r.priority||'-'}`],['Kayıt durumu',VISIT_FIELD_RECORD_STATUSES[r.status]||r.status||'-'],['Not / Tespit',r.noteText||'-'],['Kanıt / Durum',`${r.evidenceReviewed||'-'}\n${VISIT_EVIDENCE_STATUSES[r.evidenceStatus]||r.evidenceStatus||'-'}`],['Değerlendirme',r.assessment||'-']],idx,r.noteType==='internal_finding'?'#dc2626':r.noteType==='improvement'?'#059669':'#2563eb')));
        }
        if(['executive','result','complete','followup'].includes(type)){
            content.push({text:'Takip Yönetimi',style:'sectionHeader'});
            [...b.followups].sort((a,b)=>compareVisitPdfRecords({...a.source,visitName:a.visitName},{...b.source,visitName:b.visitName},{groupByVisit:b.visits.length>1})).forEach((i,idx)=>content.push(...visitReportPdfRecord(`${i.visitName} — ${i.source.targetLabel||'Ziyaret geneli'}`,[['Durum / Zaman',`${VISIT_FOLLOW_STATUSES[i.status]||i.status} | ${visitFollowTimingLabel(i)}`],['Sorumlu / Tarih',`${i.owner||'-'} | ${formatVisitDate(i.followUpDate)}`],['Kaynak tespit',i.source.noteText||'-'],['Beklenen çıktı / Kanıt',`${i.expectedOutput||'-'}\n${i.evidenceReceived||''}`],['Sonuç / Kapanış',`${i.resultNote||'-'}\n${VISIT_FOLLOW_CLOSURE_DECISIONS[i.closureDecision]||'-'} | ${formatVisitDate(i.closureDate)}`]],idx,i.timing==='overdue'?'#dc2626':'#d97706')));
        }
        if(['executive','result','complete','consultation'].includes(type)){
            content.push({text:'Danışma Yönetimi',style:'sectionHeader'});
            [...b.consultations].sort((a,b)=>compareVisitPdfRecords({...a.source,visitName:a.visitName},{...b.source,visitName:b.visitName},{groupByVisit:b.visits.length>1})).forEach((i,idx)=>content.push(...visitReportPdfRecord(`${i.visitName} — ${i.authority||'Makam belirtilmedi'}`,[['Durum / Zaman',`${VISIT_CONSULT_STATUSES[i.status]||i.status} | ${visitConsultTimingLabel(i)}`],['Konu / Soru',`${i.topic||'-'}\n${i.question||''}`],['Talep / Cevap',`${formatVisitDate(i.requestDate)} | ${formatVisitDate(i.expectedResponseDate)} | ${formatVisitDate(i.responseDate)}`],['Gelen cevap',i.responseText||'-'],['Karar / CAP etkisi',`${i.decision||'-'}\n${VISIT_CONSULT_CAP_IMPACTS[i.capImpact]||'-'}`]],idx,i.timing==='overdue'?'#dc2626':'#7c3aed')));
        }
        if(['result','complete','evidence'].includes(type)){
            content.push({text:'Kanıt Yeterlilik Özeti',style:'sectionHeader'});
            sortVisitPdfRecords(b.evidence,{groupByVisit:b.visits.length>1}).forEach((r,idx)=>content.push(...visitReportPdfRecord(`${r.visitName} — ${r.targetLabel||r.pq||'Ziyaret geneli'}`,[['Kanıt durumu',VISIT_EVIDENCE_STATUSES[r.evidenceStatus]||r.evidenceStatus||'-'],['Kanıt / Belge',r.evidenceReviewed||'-'],['Değerlendirme',r.assessment||'-']],idx,visitReportEvidenceIsIssue(r.evidenceStatus)?'#d97706':'#059669')));
        }
        return createStandardPdfDefinition(content,{pageOrientation:'portrait',pageSize:'A4',styles:{visitReportRecordTitle:{fontSize:9,bold:true,margin:[0,7,0,3]},visitReportExecutiveText:{fontSize:9,lineHeight:1.35,color:'#334155',margin:[0,4,0,10]}},defaultStyle:{font:'Roboto',fontSize:8}});
    }
    function exportVisitReportsPDF(){const b=visitReportBuildBundle();if(!b.visits.length)return alert('Dışa aktarılacak ziyaret bulunamadı.');try{return safeDownloadPdf(buildVisitReportsPdfDefinition(b,activeVisitReportType),`Ziyaret_Raporu_${activeVisitReportType}.pdf`);}catch(e){console.error(e);alert('Ziyaret raporu PDF olarak hazırlanamadı: '+(e.message||e));}}
    window.renderVisitReportsModule=renderVisitReportsModule;window.renderVisitReportsPreview=renderVisitReportsPreview;window.setVisitReportType=setVisitReportType;window.clearVisitReportFilters=clearVisitReportFilters;window.exportVisitReportsPDF=exportVisitReportsPDF;window.exportVisitReportsExcel=exportVisitReportsExcel;
    window.runVisitReportsSelfCheck=function(){const b=visitReportBuildBundle();const funcs=['renderVisitReportsModule','exportVisitReportsPDF','exportVisitReportsExcel'];const result={passed:!!document.getElementById('tab-visit-reports')&&funcs.every(n=>typeof window[n]==='function'),functions:Object.fromEntries(funcs.map(n=>[n,typeof window[n]==='function'])),visits:b.visits.length,pqs:b.pqs.length,steps:b.steps.length,fieldwork:b.fieldwork.length,followups:b.followups.length,consultations:b.consultations.length};console.log('Ziyaret Raporları öz denetimi:',result);return result;};



    // ZİYARET VE İÇ DENETİM - PAKET 6B: KPI, TAKVİM VE YÖNETİM PANELİ
    const VISIT_MGMT_EVENT_LABELS={visit:'Ziyaret',followup:'Takip',consultation:'Danışma',cap:'CAP hedef tarihi'};
    let visitManagementEventIndex={};
    function visitMgmtToday(){const d=new Date();d.setHours(12,0,0,0);return d;}
    function visitMgmtIso(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
    function visitMgmtMonthValue(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;}
    function visitMgmtDate(value){if(!value)return null;const d=visitSafeDate(value);if(!d)return null;d.setHours(12,0,0,0);return d;}
    function visitMgmtDiff(value){const d=visitMgmtDate(value);if(!d)return null;return Math.round((d-visitMgmtToday())/86400000);}
    function visitMgmtInRange(value,start,end){const d=visitMgmtDate(value);if(!d)return false;const s=visitMgmtDate(start),e=visitMgmtDate(end);if(s&&d<s)return false;if(e&&d>e)return false;return true;}
    function visitMgmtVisitOverlapsRange(v,start,end){if(!start&&!end)return true;const dates=[v.plannedStart,v.plannedEnd,v.actualStart,v.actualEnd].map(visitMgmtDate).filter(Boolean);if(!dates.length)return false;const min=new Date(Math.min(...dates)),max=new Date(Math.max(...dates)),s=visitMgmtDate(start),e=visitMgmtDate(end);return (!s||max>=s)&&(!e||min<=e);}
    function getVisitManagementFilters(){return {period:(document.getElementById('visitMgmtPeriod')||{}).value||'all',start:(document.getElementById('visitMgmtStartDate')||{}).value||'',end:(document.getElementById('visitMgmtEndDate')||{}).value||'',area:(document.getElementById('visitMgmtArea')||{}).value||'all',unit:(document.getElementById('visitMgmtUnit')||{}).value||'all',status:(document.getElementById('visitMgmtStatus')||{}).value||'all',month:(document.getElementById('visitMgmtCalendarMonth')||{}).value||visitMgmtMonthValue(new Date())};}
    function populateVisitManagementControls(){
        const area=document.getElementById('visitMgmtArea'),unit=document.getElementById('visitMgmtUnit'),status=document.getElementById('visitMgmtStatus'),month=document.getElementById('visitMgmtCalendarMonth');
        if(area){const cur=area.value;area.innerHTML='<option value="all">Tüm alanlar</option>'+getVisitAreaOptions().map(a=>`<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`).join('');if(cur&&Array.from(area.options).some(o=>o.value===cur))area.value=cur;}
        if(unit){const cur=unit.value;const units=Array.from(new Set(getVisitRecords().flatMap(v=>getVisitUnits(v)))).filter(Boolean).sort((a,b)=>a.localeCompare(b,'tr'));unit.innerHTML='<option value="all">Tüm birimler</option>'+units.map(u=>`<option value="${escapeHtml(u)}">${escapeHtml(u)}</option>`).join('');if(cur&&Array.from(unit.options).some(o=>o.value===cur))unit.value=cur;}
        if(status){const cur=status.value;status.innerHTML='<option value="all">Tüm durumlar</option>'+Object.entries(VISIT_STATUSES).map(([k,v])=>`<option value="${k}">${escapeHtml(v.label)}</option>`).join('');if(cur&&Array.from(status.options).some(o=>o.value===cur))status.value=cur;}
        if(month&&!month.value)month.value=visitMgmtMonthValue(new Date());
    }
    function applyVisitManagementPeriod(value){
        const today=visitMgmtToday(),start=document.getElementById('visitMgmtStartDate'),end=document.getElementById('visitMgmtEndDate');let s='',e='';
        if(value==='this_month'){s=visitMgmtIso(new Date(today.getFullYear(),today.getMonth(),1));e=visitMgmtIso(new Date(today.getFullYear(),today.getMonth()+1,0));}
        else if(value==='next30'){s=visitMgmtIso(today);const x=new Date(today);x.setDate(x.getDate()+30);e=visitMgmtIso(x);}
        else if(value==='this_year'){s=`${today.getFullYear()}-01-01`;e=`${today.getFullYear()}-12-31`;}
        if(start)start.value=s;if(end)end.value=e;renderVisitManagementDashboard();
    }
    function visitManagementFilterChanged(){const p=document.getElementById('visitMgmtPeriod');if(p)p.value='custom';renderVisitManagementDashboard();}
    function clearVisitManagementFilters(){['visitMgmtArea','visitMgmtUnit','visitMgmtStatus'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='all';});['visitMgmtStartDate','visitMgmtEndDate'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});const p=document.getElementById('visitMgmtPeriod');if(p)p.value='all';goVisitManagementToday();}
    function changeVisitManagementMonth(delta){const e=document.getElementById('visitMgmtCalendarMonth');if(!e)return;const parts=(e.value||visitMgmtMonthValue(new Date())).split('-').map(Number),d=new Date(parts[0],parts[1]-1+delta,1);e.value=visitMgmtMonthValue(d);renderVisitManagementDashboard();}
    function goVisitManagementToday(){const e=document.getElementById('visitMgmtCalendarMonth');if(e)e.value=visitMgmtMonthValue(new Date());renderVisitManagementDashboard();}
    function visitMgmtScopeStepDate(s){return s.estDate||s.dueDate||s.targetDate||s.completionDate||'';}
    function visitMgmtFieldworkIsOpen(r){return !['completed','cancelled'].includes(r.status||r.recordStatus||'open');}
    function buildVisitManagementModel(){
        populateVisitManagementControls();const f=getVisitManagementFilters(),today=visitMgmtToday();
        const candidates=getInternalWorkflowVisitRecords().filter(v=>{if(f.area!=='all'&&!visitArrayValue(v.areas).includes(f.area))return false;if(f.unit!=='all'&&!getVisitUnits(v).includes(f.unit))return false;if(f.status!=='all'&&v.status!==f.status)return false;return true;});
        const candidateIds=new Set(candidates.map(v=>v.id));const allCandidateFollowups=getAllVisitFollowUpItems().filter(i=>candidateIds.has(i.visitId));const allCandidateConsultations=getAllVisitConsultationItems().filter(i=>candidateIds.has(i.visitId));const allCandidateSteps=candidates.flatMap(v=>getVisitScopeStoredSteps(v).map(s=>({...s,visitId:v.id})));let visits=candidates;
        if(f.start||f.end){const inRangeIds=new Set();candidates.forEach(v=>{if(visitMgmtVisitOverlapsRange(v,f.start,f.end))inRangeIds.add(v.id);});allCandidateFollowups.forEach(i=>{if(visitMgmtInRange(i.followUpDate,f.start,f.end))inRangeIds.add(i.visitId);});allCandidateConsultations.forEach(i=>{if(visitMgmtInRange(i.expectedResponseDate||i.nextActionDate,f.start,f.end))inRangeIds.add(i.visitId);});allCandidateSteps.forEach(s=>{if(visitMgmtInRange(visitMgmtScopeStepDate(s),f.start,f.end))inRangeIds.add(s.visitId);});visits=candidates.filter(v=>inRangeIds.has(v.id));}
        const ids=new Set(visits.map(v=>v.id));const followups=allCandidateFollowups.filter(i=>ids.has(i.visitId));const consultations=allCandidateConsultations.filter(i=>ids.has(i.visitId));
        const fieldwork=visits.flatMap(v=>getVisitFieldworkRecords(v).map(r=>({...r,visitId:v.id,visitName:v.visitName||'Adsız ziyaret',visitAreas:visitArrayValue(v.areas),visitUnits:getVisitUnits(v)})));
        const steps=visits.flatMap(v=>getVisitScopeStoredSteps(v).map(s=>({...s,visitId:v.id,visitName:v.visitName||'Adsız ziyaret',visitAreas:visitArrayValue(v.areas),visitUnits:getVisitUnits(v)})));
        const activeVisits=visits.filter(v=>!['completed','cancelled'].includes(v.status));
        const completedVisits=visits.filter(v=>v.status==='completed');
        const overdueVisits=activeVisits.filter(v=>{const d=visitMgmtDate(v.plannedEnd||v.plannedStart);return d&&d<today;});
        const upcomingVisits=activeVisits.map(v=>({...v,diff:visitMgmtDiff(v.plannedStart)})).filter(v=>v.diff!==null&&v.diff>=0&&v.diff<=30).sort((a,b)=>a.diff-b.diff);
        const openFollowups=followups.filter(i=>!['completed','cancelled'].includes(i.status));const overdueFollowups=openFollowups.filter(i=>i.timing==='overdue');
        const openConsultations=consultations.filter(i=>!['completed','cancelled'].includes(i.status));const overdueConsultations=openConsultations.filter(i=>i.timing==='overdue');
        const evidenceIssues=fieldwork.filter(r=>visitMgmtFieldworkIsOpen(r)&&['insufficient','partially_sufficient','update_required','verification_pending'].includes(r.evidenceStatus));
        const criticalRecords=fieldwork.filter(r=>visitMgmtFieldworkIsOpen(r)&&(r.priority==='critical'||r.noteType==='internal_finding'||r.noteType==='nonconformity_risk'));
        const events=[];let seq=0;const add=(event)=>{const date=String(event.date||'').slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return;if((f.start||f.end)&&!visitMgmtInRange(date,f.start,f.end))return;const id=`vm-${++seq}`;events.push({...event,id,date});};
        visits.forEach(v=>{if(v.plannedStart)add({type:'visit',date:v.plannedStart,title:`Ziyaret: ${v.visitName||'Adsız ziyaret'}`,visitId:v.id,detail:`${visitArrayValue(v.areas).join(', ')} | ${getVisitUnits(v).join(' | ')}`});});
        openFollowups.forEach(i=>{if(i.followUpDate)add({type:'followup',date:i.followUpDate,title:`Takip: ${i.source.pq?`PQ ${i.source.pq}`:i.visitName}`,visitId:i.visitId,key:i.key,detail:`${i.visitName} | ${i.owner||'Sorumlu yok'} | ${visitFollowTimingLabel(i)}`});});
        openConsultations.forEach(i=>{if(i.expectedResponseDate)add({type:'consultation',date:i.expectedResponseDate,title:`Danışma: ${i.authority||i.visitName}`,visitId:i.visitId,key:i.key,detail:`${i.visitName} | ${i.topic||'-'} | ${visitConsultTimingLabel(i)}`});});
        steps.forEach(s=>{const date=visitMgmtScopeStepDate(s);if(date)add({type:'cap',date,title:`CAP: PQ ${s.pq||'-'} / Step ${s.step||'-'}`,visitId:s.visitId,pq:s.pq||'',step:s.step||'',detail:`${s.visitName} | ${s.office||s.responsibleOffice||'-'}`});});
        events.sort((a,b)=>a.date.localeCompare(b.date)||a.type.localeCompare(b.type));
        const buildStats=(kind)=>{const values=new Map();visits.forEach(v=>{const keys=kind==='area'?visitArrayValue(v.areas):getVisitUnits(v);keys.forEach(k=>{if(!k)return;const st=values.get(k)||{name:k,visitIds:new Set(),visits:0,completed:0,openFollow:0,overdue:0,openConsult:0,evidence:0};st.visitIds.add(v.id);values.set(k,st);});});values.forEach(st=>{st.visits=st.visitIds.size;st.completed=visits.filter(v=>st.visitIds.has(v.id)&&v.status==='completed').length;st.openFollow=openFollowups.filter(i=>st.visitIds.has(i.visitId)).length;st.overdue=overdueFollowups.filter(i=>st.visitIds.has(i.visitId)).length;st.openConsult=openConsultations.filter(i=>st.visitIds.has(i.visitId)).length;st.evidence=evidenceIssues.filter(i=>st.visitIds.has(i.visitId)).length;});return Array.from(values.values()).sort((a,b)=>(b.overdue+b.evidence+b.openConsult)-(a.overdue+a.evidence+a.openConsult)||b.visits-a.visits||a.name.localeCompare(b.name,'tr'));};
        return {filters:f,visits,activeVisits,completedVisits,overdueVisits,upcomingVisits,followups,openFollowups,overdueFollowups,consultations,openConsultations,overdueConsultations,fieldwork,evidenceIssues,criticalRecords,steps,events,areaStats:buildStats('area'),unitStats:buildStats('unit'),completionPct:visits.length?Math.round(completedVisits.length/visits.length*100):0};
    }
    function visitMgmtSummary(model){const topArea=model.areaStats[0],topUnit=model.unitStats[0];const parts=[];parts.push(`Seçili kapsamda <b>${model.visits.length} ziyaret</b> bulunuyor; ${model.completedVisits.length} ziyaret tamamlandı, ${model.activeVisits.length} ziyaret aktif durumda.`);if(model.overdueFollowups.length)parts.push(`<b>${model.overdueFollowups.length} takip gecikmiş</b>; en eski gecikme ${Math.max(...model.overdueFollowups.map(i=>i.daysLate||0))} gün.`);if(model.overdueConsultations.length)parts.push(`<b>${model.overdueConsultations.length} danışma cevabı gecikmiş</b>.`);if(model.evidenceIssues.length)parts.push(`${model.evidenceIssues.length} açık kayıtta kanıt yeterliliği sorunu bulunuyor.`);if(model.upcomingVisits.length)parts.push(`Önümüzdeki 30 günde ${model.upcomingVisits.length} ziyaret planlanmış.`);if(topArea)parts.push(`Yönetim önceliği en yüksek alan: <b>${escapeHtml(topArea.name)}</b>.`);if(topUnit)parts.push(`En yoğun birim: <b>${escapeHtml(topUnit.name)}</b>.`);if(!model.visits.length)return 'Seçilen filtrelerde ziyaret kaydı bulunmuyor.';return parts.join(' ');}
    function renderVisitMgmtList(id,items,formatter,empty){const el=document.getElementById(id);if(!el)return;el.innerHTML=items.length?items.slice(0,12).map(formatter).join(''):`<div class="visit-mgmt-empty">${escapeHtml(empty)}</div>`;}
    function renderVisitManagementCalendar(model){
        const input=document.getElementById('visitMgmtCalendarMonth'),value=(input&&input.value)||visitMgmtMonthValue(new Date()),[year,month]=value.split('-').map(Number),first=new Date(year,month-1,1),last=new Date(year,month,0),label=document.getElementById('visitMgmtCalendarLabel');if(label)label.textContent=first.toLocaleDateString('tr-TR',{month:'long',year:'numeric'});
        const events=model.events.filter(e=>e.date.startsWith(value));visitManagementEventIndex=Object.fromEntries(model.events.map(e=>[e.id,e]));const byDay=new Map();events.forEach(e=>{const day=Number(e.date.slice(8,10));if(!byDay.has(day))byDay.set(day,[]);byDay.get(day).push(e);});
        const heads=['Pzt','Sal','Çar','Per','Cum','Cmt','Paz'].map(d=>`<div class="visit-mgmt-day-head">${d}</div>`).join(''),offset=(first.getDay()+6)%7,total=Math.ceil((offset+last.getDate())/7)*7,todayIso=visitMgmtIso(visitMgmtToday());let cells='';
        for(let i=0;i<total;i++){const day=i-offset+1;if(day<1||day>last.getDate()){cells+='<div class="visit-mgmt-day outside"></div>';continue;}const iso=`${value}-${String(day).padStart(2,'0')}`,items=byDay.get(day)||[];cells+=`<div class="visit-mgmt-day ${iso===todayIso?'today':''}"><div class="visit-mgmt-day-number">${day}</div>${items.slice(0,4).map(e=>`<button type="button" class="visit-mgmt-event ${e.type}" title="${escapeHtml(e.detail||e.title)}" onclick="openVisitManagementEvent('${e.id}')">${escapeHtml(e.title)}</button>`).join('')}${items.length>4?`<div class="visit-mgmt-more">+${items.length-4} olay</div>`:''}</div>`;}
        const cal=document.getElementById('visitMgmtCalendar');if(cal)cal.innerHTML=heads+cells;const count=document.getElementById('visitMgmtCalendarCount');if(count)count.textContent=`${events.length} olay`;
        const list=document.getElementById('visitMgmtCalendarEvents');if(list)list.innerHTML=events.length?events.map(e=>`<div class="visit-mgmt-calendar-event-row"><b>${escapeHtml(formatVisitDate(e.date))}</b><span class="visit-mgmt-chip ${e.type}">${escapeHtml(VISIT_MGMT_EVENT_LABELS[e.type])}</span><button type="button" style="border:0;background:transparent;text-align:left;color:var(--text);cursor:pointer;padding:0" onclick="openVisitManagementEvent('${e.id}')"><b>${escapeHtml(e.title)}</b><br><span style="color:var(--muted)">${escapeHtml(e.detail||'')}</span></button></div>`).join(''):'<div class="visit-mgmt-empty">Bu ay için takvim olayı bulunmuyor.</div>';
    }
    function renderVisitManagementScoreTable(id,rows,isUnit){const body=document.getElementById(id);if(!body)return;body.innerHTML=rows.length?rows.slice(0,25).map(r=>`<tr><td><b>${escapeHtml(r.name)}</b></td><td>${r.visits}</td><td>${r.completed}</td><td>${r.openFollow}</td><td><b style="color:${r.overdue?'var(--danger)':'var(--ok)'}">${r.overdue}</b></td><td>${isUnit?r.openConsult:r.evidence}</td></tr>`).join(''):`<tr><td colspan="6" class="visit-mgmt-empty">Kayıt bulunmuyor.</td></tr>`;}
    function renderVisitManagementDashboard(){
        if(!document.getElementById('tab-visit-management'))return;const m=buildVisitManagementModel(),set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=String(v);};set('visitMgmtKpiVisits',m.visits.length);set('visitMgmtKpiUpcoming',m.upcomingVisits.length);set('visitMgmtKpiOverdueVisits',m.overdueVisits.length);set('visitMgmtKpiOpenFollow',m.openFollowups.length);set('visitMgmtKpiOverdueFollow',m.overdueFollowups.length);set('visitMgmtKpiOpenConsult',m.openConsultations.length);set('visitMgmtKpiOverdueConsult',m.overdueConsultations.length);set('visitMgmtKpiEvidence',m.evidenceIssues.length);set('visitMgmtKpiCritical',m.criticalRecords.length);set('visitMgmtKpiCompletion',`${m.completionPct}%`);const summary=document.getElementById('visitMgmtExecutiveSummary');if(summary)summary.innerHTML=visitMgmtSummary(m);
        renderVisitManagementCalendar(m);
        set('visitMgmtOverdueFollowCount',m.overdueFollowups.length);set('visitMgmtOverdueConsultCount',m.overdueConsultations.length);set('visitMgmtUpcomingVisitCount',m.upcomingVisits.length);set('visitMgmtEvidenceCount',m.evidenceIssues.length+m.criticalRecords.length);
        renderVisitMgmtList('visitMgmtOverdueFollowList',m.overdueFollowups,i=>`<div class="visit-mgmt-list-item danger" onclick="openVisitManagementFollowUp('${encodeURIComponent(i.key)}')"><b>${escapeHtml(i.visitName)} — ${escapeHtml(i.source.targetLabel||'Ziyaret geneli')}</b><div>${escapeHtml(i.source.noteText||'-')}</div><div class="meta">${escapeHtml(formatVisitDate(i.followUpDate))} | ${i.daysLate||0} gün gecikmiş | ${escapeHtml(i.owner||'Sorumlu yok')}</div></div>`,'Geciken takip bulunmuyor.');
        renderVisitMgmtList('visitMgmtOverdueConsultList',m.openConsultations.filter(i=>i.timing==='overdue'||i.timing==='date_risk').sort((a,b)=>(b.daysLate||0)-(a.daysLate||0)),i=>`<div class="visit-mgmt-list-item ${i.timing==='overdue'?'danger':'warn'}" onclick="openVisitManagementConsultation('${encodeURIComponent(i.key)}')"><b>${escapeHtml(i.visitName)} — ${escapeHtml(i.authority||'Makam belirtilmedi')}</b><div>${escapeHtml(i.topic||i.question||'-')}</div><div class="meta">${escapeHtml(formatVisitDate(i.expectedResponseDate))} | ${escapeHtml(visitConsultTimingLabel(i))}</div></div>`,'Geciken veya tarih riski olan danışma bulunmuyor.');
        renderVisitMgmtList('visitMgmtUpcomingVisitList',m.upcomingVisits,v=>`<div class="visit-mgmt-list-item ok" onclick="openVisitManagementVisit('${v.id}')"><b>${escapeHtml(v.visitName||'Adsız ziyaret')}</b><div>${escapeHtml(visitArrayValue(v.areas).join(', '))} | ${escapeHtml(getVisitUnits(v).join(' | '))}</div><div class="meta">${escapeHtml(formatVisitDateRange(v.plannedStart,v.plannedEnd))} | ${v.diff===0?'Bugün':v.diff+' gün kaldı'}</div></div>`,'Önümüzdeki 30 günde ziyaret bulunmuyor.');
        const evidenceCombined=[...m.criticalRecords.map(r=>({...r,_kind:'critical'})),...m.evidenceIssues.filter(r=>!m.criticalRecords.some(c=>c.id===r.id&&c.visitId===r.visitId)).map(r=>({...r,_kind:'evidence'}))];renderVisitMgmtList('visitMgmtEvidenceList',evidenceCombined,r=>`<div class="visit-mgmt-list-item ${r._kind==='critical'?'danger':'warn'}" onclick="openVisitManagementWorkspace('${r.visitId}','${encodeURIComponent(r.targetType||'visit')}','${encodeURIComponent(r.targetKey||'')}')"><b>${escapeHtml(r.visitName)} — ${escapeHtml(r.targetLabel||r.pq||'Ziyaret geneli')}</b><div>${escapeHtml(r.noteText||r.assessment||'-')}</div><div class="meta">${escapeHtml(VISIT_FIELD_PRIORITIES[r.priority]||r.priority||'-')} | ${escapeHtml(VISIT_EVIDENCE_STATUSES[r.evidenceStatus]||r.evidenceStatus||'-')}</div></div>`,'Kritik veya kanıt sorunu bulunan açık kayıt yok.');
        renderVisitManagementScoreTable('visitMgmtAreaTable',m.areaStats,false);renderVisitManagementScoreTable('visitMgmtUnitTable',m.unitStats,true);window.currentVisitManagementModel=m;
    }
    function openVisitManagementEvent(id){const e=visitManagementEventIndex[id];if(!e)return;if(e.type==='visit')return openVisitManagementVisit(e.visitId);if(e.type==='followup')return openVisitManagementFollowUp(encodeURIComponent(e.key));if(e.type==='consultation')return openVisitManagementConsultation(encodeURIComponent(e.key));if(e.type==='cap'){switchTab('visit-scope');const sel=document.getElementById('visitScopeVisitSelect');if(sel)sel.value=e.visitId;loadVisitScopeSelection(e.visitId,true);}}
    function openVisitManagementVisit(id){switchTab('visits');setTimeout(()=>viewVisitDetail(id),50);}
    function openVisitManagementFollowUp(encodedKey){switchTab('visit-followup');setTimeout(()=>selectVisitFollowUp(encodedKey),50);}
    function openVisitManagementConsultation(encodedKey){switchTab('visit-consultation');setTimeout(()=>selectVisitConsultationItem(encodedKey),50);}
    function openVisitManagementWorkspace(visitId,targetType,targetKey){switchTab('visit-workspace');setTimeout(()=>{const sel=document.getElementById('visitWorkspaceVisitSelect');if(sel)sel.value=visitId;loadVisitWorkspaceSelection(visitId,true);const type=decodeURIComponent(targetType||'visit'),key=decodeURIComponent(targetKey||'');if(type&&key)selectVisitWorkspaceTarget(type,encodeURIComponent(key));},50);}
    function buildVisitManagementKpiRows(m){return [{'Gösterge':'Ziyaret','Değer':m.visits.length},{'Gösterge':'Tamamlanan ziyaret','Değer':m.completedVisits.length},{'Gösterge':'Geciken ziyaret','Değer':m.overdueVisits.length},{'Gösterge':'30 gün içinde ziyaret','Değer':m.upcomingVisits.length},{'Gösterge':'Açık takip','Değer':m.openFollowups.length},{'Gösterge':'Geciken takip','Değer':m.overdueFollowups.length},{'Gösterge':'Açık danışma','Değer':m.openConsultations.length},{'Gösterge':'Geciken danışma','Değer':m.overdueConsultations.length},{'Gösterge':'Kanıt sorunu','Değer':m.evidenceIssues.length},{'Gösterge':'Kritik açık kayıt','Değer':m.criticalRecords.length},{'Gösterge':'Ziyaret tamamlanma oranı','Değer':`${m.completionPct}%`}];}
    function buildVisitManagementCalendarRows(m){return m.events.map(e=>({'Tarih':e.date,'Olay Türü':VISIT_MGMT_EVENT_LABELS[e.type]||e.type,'Başlık':e.title,'Ziyaret':(getVisitRecords().find(v=>v.id===e.visitId)||{}).visitName||'','PQ':e.pq||'','Step':e.step||'','Açıklama':fullTextForExcel(e.detail||'')}));}
    function exportVisitManagementExcel(){const m=buildVisitManagementModel();if(!m.visits.length)return alert('Dışa aktarılacak ziyaret verisi bulunamadı.');const wb=createReportWorkbook({title:'Ziyaret Yönetim Paneli ve Takvim',subject:'USOAP CMA ziyaret KPI, takvim ve yönetim özeti'});addJsonSheet(wb,'Yonetim_Ozeti',buildVisitManagementKpiRows(m));addJsonSheet(wb,'Takvim_Olaylari',buildVisitManagementCalendarRows(m));addJsonSheet(wb,'Alan_Karnesi',m.areaStats.map(r=>({'Alan':r.name,'Ziyaret':r.visits,'Tamamlanan':r.completed,'Açık Takip':r.openFollow,'Geciken Takip':r.overdue,'Açık Danışma':r.openConsult,'Kanıt Sorunu':r.evidence})));addJsonSheet(wb,'Birim_Karnesi',m.unitStats.map(r=>({'Birim':r.name,'Ziyaret':r.visits,'Tamamlanan':r.completed,'Açık Takip':r.openFollow,'Geciken Takip':r.overdue,'Açık Danışma':r.openConsult,'Kanıt Sorunu':r.evidence})));addJsonSheet(wb,'Geciken_Takipler',buildVisitFollowUpExportRows(m.overdueFollowups));addJsonSheet(wb,'Geciken_Danismalar',buildVisitConsultationExportRows(m.overdueConsultations));addJsonSheet(wb,'Yaklasan_Ziyaretler',buildVisitExportRows(m.upcomingVisits));addJsonSheet(wb,'Kanit_Sorunlari',buildVisitWorkspaceExportRows({records:m.evidenceIssues}));downloadReportWorkbook(wb,'Ziyaret_Yonetim_Paneli_Takvim.xlsx');}
    function buildVisitManagementPdfDefinition(m){const content=[{text:'Ziyaret ve İç Denetim - Yönetim Paneli ve Takvim',style:'header'},{text:`Rapor tarihi: ${formatLongTurkishDate(new Date())} | Ziyaret: ${m.visits.length} | Tamamlanma: %${m.completionPct}`,style:'subheader'},{text:fullTextForPdf(visitMgmtSummary(m).replace(/<[^>]+>/g,'')),style:'visitMgmtExecutive'},{text:'Yönetim Göstergeleri',style:'sectionHeader'},{table:{widths:['*',80],body:[[{text:'Gösterge',bold:true,fillColor:'#e2e8f0'},{text:'Değer',bold:true,fillColor:'#e2e8f0'}],...buildVisitManagementKpiRows(m).map(r=>[r['Gösterge'],String(r['Değer'])])]},layout:'lightHorizontalLines'}];
        const addItems=(title,items,mapper)=>{content.push({text:title,style:'sectionHeader'});if(!items.length){content.push({text:'Kayıt bulunmuyor.',color:'#64748b',margin:[0,0,0,6]});return;}items.slice(0,30).forEach((i,idx)=>content.push({text:`${idx+1}. ${mapper(i)}`,fontSize:8.5,margin:[0,2,0,3]}));};
        addItems('Geciken Takipler',m.overdueFollowups,i=>`${i.visitName} — ${i.source.targetLabel||'Ziyaret geneli'} | ${i.daysLate||0} gün | ${i.owner||'Sorumlu yok'}`);addItems('Geciken Danışmalar',m.overdueConsultations,i=>`${i.visitName} — ${i.authority||'Makam belirtilmedi'} | ${i.daysLate||0} gün | ${i.topic||'-'}`);addItems('Yaklaşan Ziyaretler',m.upcomingVisits,i=>`${formatVisitDate(i.plannedStart)} — ${i.visitName||'Adsız ziyaret'} | ${visitArrayValue(i.areas).join(', ')}`);addItems('Kanıt Sorunları ve Kritik Kayıtlar',[...m.criticalRecords,...m.evidenceIssues],i=>`${i.visitName} — ${i.targetLabel||i.pq||'Ziyaret geneli'} | ${i.noteText||i.assessment||'-'}`);content.push({text:'Takvim Olayları',style:'sectionHeader'},{table:{widths:[70,70,150,'*'],body:[['Tarih','Tür','Başlık','Açıklama'].map(x=>({text:x,bold:true,fillColor:'#e2e8f0'})),...m.events.slice(0,120).map(e=>[formatVisitDate(e.date),VISIT_MGMT_EVENT_LABELS[e.type]||e.type,e.title,fullTextForPdf(e.detail||'')])]},layout:'lightHorizontalLines'});return createStandardPdfDefinition(content,{pageOrientation:'landscape',pageSize:'A4',styles:{visitMgmtExecutive:{fontSize:9,lineHeight:1.4,color:'#334155',margin:[0,4,0,10]}},defaultStyle:{font:'Roboto',fontSize:8}});}
    function exportVisitManagementPDF(){const m=buildVisitManagementModel();if(!m.visits.length)return alert('Dışa aktarılacak ziyaret verisi bulunamadı.');return safeDownloadPdf(buildVisitManagementPdfDefinition(m),'Ziyaret_Yonetim_Paneli_Takvim.pdf');}
    window.renderVisitManagementDashboard=renderVisitManagementDashboard;window.applyVisitManagementPeriod=applyVisitManagementPeriod;window.visitManagementFilterChanged=visitManagementFilterChanged;window.clearVisitManagementFilters=clearVisitManagementFilters;window.changeVisitManagementMonth=changeVisitManagementMonth;window.goVisitManagementToday=goVisitManagementToday;window.openVisitManagementEvent=openVisitManagementEvent;window.openVisitManagementVisit=openVisitManagementVisit;window.openVisitManagementFollowUp=openVisitManagementFollowUp;window.openVisitManagementConsultation=openVisitManagementConsultation;window.openVisitManagementWorkspace=openVisitManagementWorkspace;window.exportVisitManagementExcel=exportVisitManagementExcel;window.exportVisitManagementPDF=exportVisitManagementPDF;
    window.runVisitManagementSelfCheck=function(){const m=buildVisitManagementModel();const funcs=['renderVisitManagementDashboard','exportVisitManagementExcel','exportVisitManagementPDF'];const result={passed:!!document.getElementById('tab-visit-management')&&funcs.every(n=>typeof window[n]==='function'),functions:Object.fromEntries(funcs.map(n=>[n,typeof window[n]==='function'])),visits:m.visits.length,events:m.events.length,overdueFollowups:m.overdueFollowups.length,overdueConsultations:m.overdueConsultations.length,evidenceIssues:m.evidenceIssues.length};console.log('Paket 6B öz denetimi:',result);return result;};


    // ZİYARET VE İÇ DENETİM - PAKET 6C: PQ/CAP GEÇMİŞİ, KARŞILAŞTIRMA VE TEKRARLANAN SORUN ANALİZİ
    const VISIT_ANALYSIS_EVENT_LABELS={scope:'Kapsam',preparation:'Hazırlık',fieldwork:'Saha kaydı',followup:'Takip',consultation:'Danışma',audit:'Değişiklik geçmişi'};
    const VISIT_REPEAT_TYPE_LABELS={target:'Aynı PQ / Step',unit_category:'Birim + sorun kategorisi',evidence:'Tekrarlanan kanıt sorunu',open:'Birden fazla ziyarette açık kalan',text:'Aynı / çok benzer tespit'};
    let activeVisitAnalysisMode='history';

    function visitAnalysisDay(value){if(!value)return '';const s=String(value);if(/^\d{4}-\d{2}-\d{2}/.test(s))return s.slice(0,10);const d=new Date(value);if(Number.isNaN(d.getTime()))return '';return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
    function visitAnalysisTimestamp(value){if(!value)return 0;const d=new Date(value);return Number.isNaN(d.getTime())?0:d.getTime();}
    function visitAnalysisVisitDate(visit){return (visit&& (visit.actualStart||visit.plannedStart||visit.createdAt||visit.updatedAt))||'';}
    function visitAnalysisTargetMatches(obj,pq,step){if(!obj)return false;const opq=String(obj.pq||'').trim(),ostep=String(obj.step||'').trim();if(pq&&opq!==String(pq))return false;if(step&&step!=='all'&&ostep!==String(step))return false;return !!opq;}
    function visitAnalysisEvidenceProblem(record){return ['insufficient','update_required','verification_pending','requested','partially_sufficient'].includes(String((record||{}).evidenceStatus||''));}
    function visitAnalysisOpenRecord(record){return !['completed','cancelled'].includes(String((record||{}).status||''));}
    function visitAnalysisTargetKey(pq,step){return String(pq||'')+(step?`::${String(step)}`:'');}
    function visitAnalysisAllPqs(area){const set=new Set();getInternalWorkflowVisitRecords().forEach(v=>{if(area&&area!=='all'&&!visitArrayValue(v.areas).includes(area))return;getVisitScopeStoredPqs(v).forEach(p=>p&&p.pq&&set.add(String(p.pq)));getVisitScopeStoredSteps(v).forEach(s=>s&&s.pq&&set.add(String(s.pq)));getVisitFieldworkRecords(v).forEach(r=>r&&r.pq&&set.add(String(r.pq)));});return Array.from(set).sort(sortPQs);}
    function visitAnalysisStepsForPq(pq,area){const set=new Set();getInternalWorkflowVisitRecords().forEach(v=>{if(area&&area!=='all'&&!visitArrayValue(v.areas).includes(area))return;getVisitScopeStoredSteps(v).forEach(s=>{if(String(s.pq||'')===String(pq)&&s.step!==undefined&&s.step!==null&&String(s.step)!=='')set.add(String(s.step));});getVisitFieldworkRecords(v).forEach(r=>{if(String(r.pq||'')===String(pq)&&r.step!==undefined&&r.step!==null&&String(r.step)!=='')set.add(String(r.step));});});return Array.from(set).sort((a,b)=>String(a).localeCompare(String(b),'tr',{numeric:true}));}
    function visitAnalysisVisitMatchesTarget(visit,pq,step){return getVisitScopeStoredPqs(visit).some(p=>String(p.pq||'')===String(pq))||getVisitScopeStoredSteps(visit).some(s=>visitAnalysisTargetMatches(s,pq,step))||getVisitFieldworkRecords(visit).some(r=>visitAnalysisTargetMatches(r,pq,step));}
    function visitAnalysisEvent(type,visit,date,title,detail,extra={}){return {type,visitId:visit.id,visitName:visit.visitName||'Adsız ziyaret',visitAreas:visitArrayValue(visit.areas),visitUnits:getVisitUnits(visit),date:date||visitAnalysisVisitDate(visit),title,detail:detail||'',pq:extra.pq||'',step:extra.step||'',status:extra.status||'',priority:extra.priority||'',actor:extra.actor||'',source:extra.source||null};}
    function buildVisitAnalysisTimeline(){const pq=((document.getElementById('visitAnalysisPQ')||{}).value||'').trim(),step=(document.getElementById('visitAnalysisStep')||{}).value||'all',visitFilter=(document.getElementById('visitAnalysisVisit')||{}).value||'all',eventType=(document.getElementById('visitAnalysisEventType')||{}).value||'all';if(!pq)return [];const events=[];getInternalWorkflowVisitRecords(true).forEach(visit=>{if(visitFilter!=='all'&&visit.id!==visitFilter)return;const scopePq=getVisitScopeStoredPqs(visit).find(p=>String(p.pq||'')===pq),scopeSteps=getVisitScopeStoredSteps(visit).filter(s=>visitAnalysisTargetMatches(s,pq,step));if(scopePq||scopeSteps.length){events.push(visitAnalysisEvent('scope',visit,visitAnalysisVisitDate(visit),step==='all'?`PQ ${pq} ziyaret kapsamına alındı`:`PQ ${pq} / Step ${step} ziyaret kapsamına alındı`,scopeSteps.length?scopeSteps.map(s=>`Step ${s.step}: ${s.capText||s.actionText||'-'} | Hedef: ${formatVisitDate(s.dueDate||s.targetDate||'')}`).join('\n'):((scopePq&&scopePq.finding)||''),{pq,step:step==='all'?'':step}));}
            getVisitPreparationRecords(visit).filter(r=>visitAnalysisTargetMatches(r,pq,step)).forEach(r=>events.push(visitAnalysisEvent('preparation',visit,r.updatedAt||r.createdAt||visitAnalysisVisitDate(visit),`${r.targetLabel||`PQ ${pq}`} için hazırlık kaydı`,[r.questions&&`Sorular: ${r.questions}`,r.evidenceRequests&&`Kanıt talepleri: ${r.evidenceRequests}`,r.preliminaryAssessment&&`Ön değerlendirme: ${r.preliminaryAssessment}`,r.risks&&`Riskler: ${r.risks}`].filter(Boolean).join('\n'),{pq:r.pq||pq,step:r.step||'',actor:visitAuditActorLabel(r.updatedBy||r.createdBy)})));
            getVisitFieldworkRecords(visit).filter(r=>visitAnalysisTargetMatches(r,pq,step)).forEach(r=>events.push(visitAnalysisEvent('fieldwork',visit,r.updatedAt||r.createdAt||visitAnalysisVisitDate(visit),`${VISIT_FIELD_NOTE_TYPES[r.noteType]||r.noteType||'Saha kaydı'} — ${r.targetLabel||`PQ ${pq}`}`,[r.noteText,r.evidenceReviewed&&`Kanıt: ${r.evidenceReviewed}`,r.assessment&&`Değerlendirme: ${r.assessment}`].filter(Boolean).join('\n'),{pq:r.pq||pq,step:r.step||'',status:r.status,priority:r.priority,actor:visitAuditActorLabel(r.updatedBy||r.createdBy),source:r})));
        });
        getAllVisitFollowUpItems().filter(i=>(visitFilter==='all'||i.visitId===visitFilter)&&visitAnalysisTargetMatches(i.source,pq,step)).forEach(i=>{const v=getInternalWorkflowVisitRecords(true).find(x=>x.id===i.visitId);if(v)events.push(visitAnalysisEvent('followup',v,i.overlay.updatedAt||i.followUpDate||i.source.updatedAt,`Takip — ${i.source.targetLabel||`PQ ${pq}`}`,[`Durum: ${VISIT_FOLLOW_STATUSES[i.status]||i.status}`,i.owner&&`Sorumlu: ${i.owner}`,i.expectedOutput&&`Beklenen çıktı: ${i.expectedOutput}`,i.resultNote&&`Sonuç: ${i.resultNote}`].filter(Boolean).join('\n'),{pq:i.source.pq||pq,step:i.source.step||'',status:i.status,priority:i.priority,actor:visitAuditActorLabel(i.overlay.updatedBy)}));});
        getAllVisitConsultationItems().filter(i=>(visitFilter==='all'||i.visitId===visitFilter)&&visitAnalysisTargetMatches(i.source,pq,step)).forEach(i=>{const v=getInternalWorkflowVisitRecords(true).find(x=>x.id===i.visitId);if(v)events.push(visitAnalysisEvent('consultation',v,i.overlay.updatedAt||i.requestDate||i.source.updatedAt,`Danışma — ${i.authority||'Makam belirtilmedi'}`,[i.topic,i.question&&`Soru: ${i.question}`,i.responseText&&`Cevap: ${i.responseText}`,i.decision&&`Karar: ${i.decision}`].filter(Boolean).join('\n'),{pq:i.source.pq||pq,step:i.source.step||'',status:i.status,priority:i.priority,actor:visitAuditActorLabel(i.overlay.updatedBy)}));});
        getAllVisitAuditEntries().filter(e=>(visitFilter==='all'||e.visitId===visitFilter)&&String((e.context||{}).pq||'')===pq&&(step==='all'||String((e.context||{}).step||'')===String(step))).forEach(e=>{const v=getInternalWorkflowVisitRecords(true).find(x=>x.id===e.visitId);if(v)events.push(visitAnalysisEvent('audit',v,e.timestamp,`${VISIT_AUDIT_ENTITY_LABELS[e.entityType]||e.entityType} — ${VISIT_AUDIT_ACTION_LABELS[e.action]||e.action}`,e.summary||e.changes.map(c=>`${c.label}: ${c.oldValue||'-'} → ${c.newValue||'-'}`).join('\n'),{pq,step:step==='all'?'':step,actor:visitAuditActorLabel(e.actor)}));});
        return events.filter(e=>eventType==='all'||e.type===eventType).sort((a,b)=>visitAnalysisTimestamp(b.date)-visitAnalysisTimestamp(a.date)||a.visitName.localeCompare(b.visitName,'tr'));
    }
    function populateVisitAnalysisControls(){const areas=Array.from(new Set(getInternalWorkflowVisitRecords().flatMap(v=>visitArrayValue(v.areas)))).filter(Boolean).sort(sortAreas),units=Array.from(new Set(getInternalWorkflowVisitRecords().flatMap(v=>getVisitUnits(v)))).filter(Boolean).sort((a,b)=>a.localeCompare(b,'tr'));const fill=(id,items,allLabel)=>{const el=document.getElementById(id);if(!el)return;const cur=el.value||'all';el.innerHTML=`<option value="all">${escapeHtml(allLabel)}</option>`+items.map(x=>`<option value="${escapeHtml(x)}">${escapeHtml(x)}</option>`).join('');if(Array.from(el.options).some(o=>o.value===cur))el.value=cur;};fill('visitAnalysisArea',areas,'Tüm alanlar');fill('visitCompareArea',areas,'Tüm alanlar');fill('visitRepeatArea',areas,'Tüm alanlar');fill('visitCompareUnit',units,'Tüm birimler');fill('visitRepeatUnit',units,'Tüm birimler');populateVisitAnalysisPqs();populateVisitAnalysisVisits();populateVisitComparisonSelectors();}
    function populateVisitAnalysisPqs(){const el=document.getElementById('visitAnalysisPQ');if(!el)return;const area=(document.getElementById('visitAnalysisArea')||{}).value||'all',cur=el.value,pqs=visitAnalysisAllPqs(area);el.innerHTML='<option value="">PQ seçiniz...</option>'+pqs.map(p=>`<option value="${escapeHtml(p)}">PQ ${escapeHtml(p)}${pqMasterData[p]&&pqMasterData[p].alan?` — ${escapeHtml(pqMasterData[p].alan)}`:''}</option>`).join('');if(cur&&pqs.includes(cur))el.value=cur;populateVisitAnalysisSteps();}
    function populateVisitAnalysisSteps(){const el=document.getElementById('visitAnalysisStep');if(!el)return;const pq=(document.getElementById('visitAnalysisPQ')||{}).value||'',area=(document.getElementById('visitAnalysisArea')||{}).value||'all',cur=el.value||'all',steps=visitAnalysisStepsForPq(pq,area);el.innerHTML='<option value="all">PQ geneli / tüm adımlar</option>'+steps.map(s=>`<option value="${escapeHtml(s)}">Step ${escapeHtml(s)}</option>`).join('');if(steps.includes(cur))el.value=cur;else el.value='all';}
    function populateVisitAnalysisVisits(){const el=document.getElementById('visitAnalysisVisit');if(!el)return;const pq=(document.getElementById('visitAnalysisPQ')||{}).value||'',step=(document.getElementById('visitAnalysisStep')||{}).value||'all',cur=el.value||'all';const visits=getInternalWorkflowVisitRecords().filter(v=>!pq||visitAnalysisVisitMatchesTarget(v,pq,step)).sort((a,b)=>visitAnalysisTimestamp(visitAnalysisVisitDate(b))-visitAnalysisTimestamp(visitAnalysisVisitDate(a)));el.innerHTML='<option value="all">Tüm ziyaretler</option>'+visits.map(v=>`<option value="${escapeHtml(v.id)}">${escapeHtml(v.visitName||'Adsız ziyaret')} — ${escapeHtml(formatVisitDate(visitAnalysisVisitDate(v)))}</option>`).join('');if(visits.some(v=>v.id===cur))el.value=cur;else el.value='all';}
    function visitAnalysisFilterChanged(){populateVisitAnalysisPqs();populateVisitAnalysisVisits();renderVisitAnalysisHistory();}
    function visitAnalysisPqChanged(){populateVisitAnalysisSteps();populateVisitAnalysisVisits();renderVisitAnalysisHistory();}
    function clearVisitAnalysisHistoryFilters(){const a=document.getElementById('visitAnalysisArea'),p=document.getElementById('visitAnalysisPQ'),s=document.getElementById('visitAnalysisStep'),v=document.getElementById('visitAnalysisVisit'),t=document.getElementById('visitAnalysisEventType');if(a)a.value='all';if(p)p.value='';if(s)s.value='all';if(v)v.value='all';if(t)t.value='all';populateVisitAnalysisPqs();populateVisitAnalysisVisits();renderVisitAnalysisHistory();}
    function renderVisitAnalysisHistory(){const timeline=document.getElementById('visitAnalysisTimeline');if(!timeline)return;const pq=(document.getElementById('visitAnalysisPQ')||{}).value||'',step=(document.getElementById('visitAnalysisStep')||{}).value||'all';if(!pq){timeline.innerHTML='<div class="visit-analysis-empty">Bir PQ seçiniz.</div>';['visitAnalysisHistoryVisits','visitAnalysisHistoryEvents','visitAnalysisHistoryFindings','visitAnalysisHistoryOpenFollow','visitAnalysisHistoryConsult','visitAnalysisHistoryEvidence'].forEach(id=>{const e=document.getElementById(id);if(e)e.textContent='0';});return;}const events=buildVisitAnalysisTimeline(),visits=new Set(events.map(e=>e.visitId)),field=events.filter(e=>e.type==='fieldwork').map(e=>e.source).filter(Boolean),openFollow=events.filter(e=>e.type==='followup'&&!['completed','cancelled'].includes(e.status)).length,consult=events.filter(e=>e.type==='consultation').length,findings=field.filter(r=>['internal_finding','nonconformity_risk'].includes(r.noteType)).length,evidence=field.filter(r=>r.evidenceStatus==='sufficient').length;const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=String(v);};set('visitAnalysisHistoryVisits',visits.size);set('visitAnalysisHistoryEvents',events.length);set('visitAnalysisHistoryFindings',findings);set('visitAnalysisHistoryOpenFollow',openFollow);set('visitAnalysisHistoryConsult',consult);set('visitAnalysisHistoryEvidence',evidence);const title=document.getElementById('visitAnalysisTimelineTitle'),count=document.getElementById('visitAnalysisTimelineCount');if(title)title.textContent=step==='all'?`PQ ${pq} Zaman Çizelgesi`:`PQ ${pq} / Step ${step} Zaman Çizelgesi`;if(count)count.textContent=`${events.length} kayıt`;timeline.innerHTML=events.length?events.map(e=>`<article class="visit-analysis-event ${escapeHtml(e.type)}"><div class="visit-analysis-event-head"><div><div class="visit-analysis-event-title">${escapeHtml(e.title)}</div><div class="visit-analysis-event-meta">${escapeHtml(e.visitName)} · ${escapeHtml(VISIT_ANALYSIS_EVENT_LABELS[e.type]||e.type)}${e.actor?` · ${escapeHtml(e.actor)}`:''}</div></div><div class="visit-analysis-event-date">${escapeHtml(formatVisitDate(e.date))}</div></div><div class="visit-analysis-event-detail">${escapeHtml(e.detail||'-')}</div><div class="visit-analysis-event-meta"><span class="visit-analysis-navlink" onclick="openVisitAnalysisSource('${escapeHtml(e.type)}','${escapeHtml(e.visitId)}','${encodeURIComponent(e.pq||'')}','${encodeURIComponent(e.step||'')}')">Kaynak kaydı aç</span></div></article>`).join(''):'<div class="visit-analysis-empty">Seçilen PQ/Step için ziyaret kaydı bulunamadı.</div>';}
    function openVisitAnalysisSource(type,visitId,pqEnc,stepEnc){const pq=decodeURIComponent(pqEnc||''),step=decodeURIComponent(stepEnc||'');if(type==='scope'||type==='preparation'){switchTab('visit-scope');setTimeout(()=>{const s=document.getElementById('visitScopeVisitSelect');if(s)s.value=visitId;loadVisitScopeSelection(visitId,true);},50);return;}if(type==='fieldwork'||type==='followup'||type==='consultation'){switchTab('visit-workspace');setTimeout(()=>{const s=document.getElementById('visitWorkspaceVisitSelect');if(s)s.value=visitId;loadVisitWorkspaceSelection(visitId,true);if(pq){const visit=icaoVisits[visitId]?{id:visitId,...icaoVisits[visitId]}:null;const target=visit?getVisitWorkspaceTargets(visit).find(t=>t.type===(step?'step':'pq')&&String(t.pq||'')===String(pq)&&(!step||String(t.step||'')===String(step))):null;if(target)selectVisitWorkspaceTarget(target.type,encodeURIComponent(target.key));}},50);return;}if(type==='audit'){switchTab('visit-audit');setTimeout(()=>{const s=document.getElementById('visitAuditVisitFilter');if(s)s.value=visitId;renderVisitAuditTrail();},50);}}

    function getVisitComparisonCandidates(){const area=(document.getElementById('visitCompareArea')||{}).value||'all',unit=(document.getElementById('visitCompareUnit')||{}).value||'all';return getInternalWorkflowVisitRecords().filter(v=>(area==='all'||visitArrayValue(v.areas).includes(area))&&(unit==='all'||getVisitUnits(v).includes(unit))).sort((a,b)=>visitAnalysisTimestamp(visitAnalysisVisitDate(b))-visitAnalysisTimestamp(visitAnalysisVisitDate(a)));}
    function populateVisitComparisonSelectors(){const visits=getVisitComparisonCandidates(),a=document.getElementById('visitCompareA'),b=document.getElementById('visitCompareB');if(!a||!b)return;const av=a.value,bv=b.value,opts='<option value="">Ziyaret seçiniz...</option>'+visits.map(v=>`<option value="${escapeHtml(v.id)}">${escapeHtml(v.visitName||'Adsız ziyaret')} — ${escapeHtml(formatVisitDate(visitAnalysisVisitDate(v)))}</option>`).join('');a.innerHTML=opts;b.innerHTML=opts;if(visits.some(v=>v.id===av))a.value=av;if(visits.some(v=>v.id===bv))b.value=bv;renderVisitComparison();}
    function autoSelectVisitComparison(){const visits=getVisitComparisonCandidates(),a=document.getElementById('visitCompareA'),b=document.getElementById('visitCompareB');if(visits.length<2)return alert('Karşılaştırma için en az iki ziyaret bulunmalıdır.');if(a)a.value=visits[1].id;if(b)b.value=visits[0].id;renderVisitComparison();}
    function buildVisitComparisonMetrics(visit){if(!visit)return null;const field=getVisitFieldworkRecords(visit),follow=getAllVisitFollowUpItems().filter(i=>i.visitId===visit.id),consult=getAllVisitConsultationItems().filter(i=>i.visitId===visit.id),pqs=getVisitScopeStoredPqs(visit),steps=getVisitScopeStoredSteps(visit),findings=field.filter(r=>r.noteType==='internal_finding'),risks=field.filter(r=>r.noteType==='nonconformity_risk'),improvements=field.filter(r=>r.noteType==='improvement'),evidenceIssues=field.filter(visitAnalysisEvidenceProblem),openRecords=field.filter(visitAnalysisOpenRecord),openFollow=follow.filter(i=>!['completed','cancelled'].includes(i.status)),completedFollow=follow.filter(i=>i.status==='completed'),overdueFollow=follow.filter(i=>i.timing==='overdue'),openConsult=consult.filter(i=>!['completed','cancelled'].includes(i.status)),completedConsult=consult.filter(i=>i.status==='completed'),overdueConsult=consult.filter(i=>i.timing==='overdue');return {visit,pqs,steps,field,follow,consult,findings,risks,improvements,evidenceIssues,openRecords,openFollow,completedFollow,overdueFollow,openConsult,completedConsult,overdueConsult,critical:field.filter(r=>r.priority==='critical'&&visitAnalysisOpenRecord(r))};}
    function visitComparisonRows(a,b){const rows=[['Kapsamdaki PQ',a.pqs.length,b.pqs.length,'scope'],['Kapsamdaki CAP adımı',a.steps.length,b.steps.length,'scope'],['Saha kaydı',a.field.length,b.field.length,'findings'],['İç denetim bulgusu',a.findings.length,b.findings.length,'findings'],['Uyumsuzluk riski',a.risks.length,b.risks.length,'findings'],['İyileştirme fırsatı',a.improvements.length,b.improvements.length,'findings'],['Kanıt sorunu',a.evidenceIssues.length,b.evidenceIssues.length,'findings'],['Açık saha kaydı',a.openRecords.length,b.openRecords.length,'findings'],['Açık takip',a.openFollow.length,b.openFollow.length,'followup'],['Geciken takip',a.overdueFollow.length,b.overdueFollow.length,'followup'],['Tamamlanan takip',a.completedFollow.length,b.completedFollow.length,'followup'],['Açık danışma',a.openConsult.length,b.openConsult.length,'consultation'],['Geciken danışma',a.overdueConsult.length,b.overdueConsult.length,'consultation'],['Tamamlanan danışma',a.completedConsult.length,b.completedConsult.length,'consultation'],['Kritik açık kayıt',a.critical.length,b.critical.length,'findings']];const focus=(document.getElementById('visitCompareFocus')||{}).value||'all';return rows.filter(r=>focus==='all'||r[3]===focus).map(([label,x,y,group])=>{const delta=y-x,lowerBetter=['İç denetim bulgusu','Uyumsuzluk riski','Kanıt sorunu','Açık saha kaydı','Açık takip','Geciken takip','Açık danışma','Geciken danışma','Kritik açık kayıt'].includes(label);let assessment='Değişiklik yok';if(delta!==0)assessment=lowerBetter?(delta<0?'İyileşme':'Olumsuz artış'):(delta>0?'Artış':'Azalış');return {label,a:x,b:y,delta,assessment,group};});}
    function visitComparisonSummaryHtml(m){if(!m)return 'Ziyaret seçilmedi.';return `<b>${escapeHtml(m.visit.visitName||'Adsız ziyaret')}</b><br>${escapeHtml(formatVisitDateRange(m.visit.plannedStart,m.visit.plannedEnd))}<br>Alan: ${escapeHtml(visitArrayValue(m.visit.areas).join(', ')||'-')}<br>Birim: ${escapeHtml(getVisitUnits(m.visit).join(' | ')||'-')}<br>PQ: ${m.pqs.length} · CAP adımı: ${m.steps.length} · Saha kaydı: ${m.field.length}<br>Açık takip: ${m.openFollow.length} · Açık danışma: ${m.openConsult.length}`;}
    function renderVisitComparison(){const aId=(document.getElementById('visitCompareA')||{}).value||'',bId=(document.getElementById('visitCompareB')||{}).value||'',a=buildVisitComparisonMetrics(getInternalWorkflowVisitRecords().find(v=>v.id===aId)),b=buildVisitComparisonMetrics(getInternalWorkflowVisitRecords().find(v=>v.id===bId)),sa=document.getElementById('visitComparisonSummaryA'),sb=document.getElementById('visitComparisonSummaryB'),body=document.getElementById('visitComparisonTableBody'),ctx=document.getElementById('visitComparisonContext'),scope=document.getElementById('visitComparisonScopeChanges');if(sa)sa.innerHTML=visitComparisonSummaryHtml(a);if(sb)sb.innerHTML=visitComparisonSummaryHtml(b);if(!a||!b){if(body)body.innerHTML='<tr><td colspan="5" class="visit-analysis-empty">İki ziyaret seçiniz.</td></tr>';if(ctx)ctx.textContent='-';if(scope)scope.innerHTML='<div class="visit-analysis-empty">Karşılaştırma bekleniyor.</div>';return;}const rows=visitComparisonRows(a,b);if(ctx)ctx.textContent=`${a.visit.visitName} → ${b.visit.visitName}`;if(body)body.innerHTML=rows.map(r=>`<tr><td><b>${escapeHtml(r.label)}</b></td><td>${r.a}</td><td>${r.b}</td><td class="visit-analysis-delta ${r.assessment==='İyileşme'?'pos':r.assessment==='Olumsuz artış'?'neg':''}">${r.delta>0?'+':''}${r.delta}</td><td>${escapeHtml(r.assessment)}</td></tr>`).join('');const pqa=new Set(a.pqs.map(p=>String(p.pq||''))),pqb=new Set(b.pqs.map(p=>String(p.pq||''))),saKeys=new Set(a.steps.map(s=>visitAnalysisTargetKey(s.pq,s.step))),sbKeys=new Set(b.steps.map(s=>visitAnalysisTargetKey(s.pq,s.step))),addedPq=[...pqb].filter(x=>!pqa.has(x)),removedPq=[...pqa].filter(x=>!pqb.has(x)),addedStep=[...sbKeys].filter(x=>!saKeys.has(x)),removedStep=[...saKeys].filter(x=>!sbKeys.has(x));if(scope)scope.innerHTML=`<div class="visit-analysis-compare-grid"><div class="visit-analysis-summary"><b>Sonraki ziyarette eklenenler</b><br>PQ: ${escapeHtml(addedPq.join(', ')||'-')}<br>CAP adımı: ${escapeHtml(addedStep.join(', ')||'-')}</div><div class="visit-analysis-summary"><b>Sonraki ziyarette kapsamdan çıkanlar</b><br>PQ: ${escapeHtml(removedPq.join(', ')||'-')}<br>CAP adımı: ${escapeHtml(removedStep.join(', ')||'-')}</div></div>`;}

    function visitRepeatRecordDate(record,visit){return record.updatedAt||record.createdAt||visitAnalysisVisitDate(visit);}
    function normalizeVisitIssueText(text){return String(text||'').toLocaleLowerCase('tr').replace(/\d{4}-\d{2}-\d{2}|\d+/g,' ').replace(/[^a-zçğıöşü\s]/gi,' ').replace(/\s+/g,' ').trim().slice(0,180);}
    function buildVisitRepeatedIssues(){const area=(document.getElementById('visitRepeatArea')||{}).value||'all',unit=(document.getElementById('visitRepeatUnit')||{}).value||'all',minVisits=Number((document.getElementById('visitRepeatMinVisits')||{}).value||2),type=(document.getElementById('visitRepeatType')||{}).value||'all',q=((document.getElementById('visitRepeatSearch')||{}).value||'').trim().toLocaleLowerCase('tr');const rows=[];getInternalWorkflowVisitRecords().forEach(visit=>{if(area!=='all'&&!visitArrayValue(visit.areas).includes(area))return;if(unit!=='all'&&!getVisitUnits(visit).includes(unit))return;getVisitFieldworkRecords(visit).forEach(r=>{const noteworthy=['internal_finding','nonconformity_risk','evidence_request','follow_up_action','consultation','decision_required'].includes(r.noteType)||visitAnalysisEvidenceProblem(r)||r.followUpRequired;if(!noteworthy)return;rows.push({visit,record:r,date:visitRepeatRecordDate(r,visit),units:getVisitUnits(visit),targetKey:visitAnalysisTargetKey(r.pq,r.step),textKey:normalizeVisitIssueText(r.noteText||r.assessment||r.evidenceReviewed),open:visitAnalysisOpenRecord(r),evidence:visitAnalysisEvidenceProblem(r)});});});const patterns=[];const addGroups=(kind,groups,labeler)=>{groups.forEach((items,key)=>{const visits=new Set(items.map(x=>x.visit.id));if(visits.size<minVisits)return;const sorted=[...items].sort((a,b)=>visitAnalysisTimestamp(b.date)-visitAnalysisTimestamp(a.date)),latest=sorted[0],latestVisitDate=Math.max(...sorted.map(x=>visitAnalysisTimestamp(visitAnalysisVisitDate(x.visit)))),latestItems=sorted.filter(x=>visitAnalysisTimestamp(visitAnalysisVisitDate(x.visit))===latestVisitDate),openLatest=latestItems.some(x=>x.open),resolved=!openLatest&&latestItems.length>0;patterns.push({kind,key,label:labeler(key,items),visitCount:visits.size,recordCount:items.length,visits:[...new Map(sorted.map(x=>[x.visit.id,x.visit])).values()],pqs:[...new Set(items.map(x=>x.record.pq).filter(Boolean))],steps:[...new Set(items.map(x=>x.record.step).filter(Boolean))],units:[...new Set(items.flatMap(x=>x.units))],latestDate:latest.date,openLatest,resolved,evidence:items.some(x=>x.evidence),sample:latest.record.noteText||latest.record.assessment||latest.record.evidenceReviewed||'',noteType:latest.record.noteType});});};const groupBy=fn=>{const m=new Map();rows.forEach(x=>{const k=fn(x);if(!k)return;if(!m.has(k))m.set(k,[]);m.get(k).push(x);});return m;};addGroups('target',groupBy(x=>x.targetKey),key=>{const [pq,step]=key.split('::');return step?`PQ ${pq} / Step ${step}`:`PQ ${pq}`;});addGroups('unit_category',groupBy(x=>`${x.units[0]||'Birim belirtilmedi'}::${x.record.noteType||'other'}`),key=>{const [u,t]=key.split('::');return `${u} — ${VISIT_FIELD_NOTE_TYPES[t]||t}`;});addGroups('evidence',groupBy(x=>x.evidence?x.targetKey:''),key=>{const [pq,step]=key.split('::');return `${step?`PQ ${pq} / Step ${step}`:`PQ ${pq}`} — Kanıt sorunu`;});addGroups('open',groupBy(x=>x.open?x.targetKey:''),key=>{const [pq,step]=key.split('::');return `${step?`PQ ${pq} / Step ${step}`:`PQ ${pq}`} — Açık kalan husus`;});addGroups('text',groupBy(x=>x.textKey&&x.textKey.length>=25?x.textKey:''),key=>`Tekrarlanan tespit: ${key.slice(0,90)}${key.length>90?'…':''}`);return patterns.filter(p=>(type==='all'||p.kind===type)&&(!q||[p.label,p.sample,p.pqs.join(' '),p.steps.join(' '),p.units.join(' ')].join(' ').toLocaleLowerCase('tr').includes(q))).sort((a,b)=>b.visitCount-a.visitCount||Number(b.openLatest)-Number(a.openLatest)||visitAnalysisTimestamp(b.latestDate)-visitAnalysisTimestamp(a.latestDate));}
    function renderVisitRepeatedIssues(){const list=document.getElementById('visitRepeatList');if(!list)return;const patterns=buildVisitRepeatedIssues(),visits=new Set(patterns.flatMap(p=>p.visits.map(v=>v.id))),pqs=new Set(patterns.flatMap(p=>p.pqs)),set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=String(v);};set('visitRepeatKpiPatterns',patterns.length);set('visitRepeatKpiVisits',visits.size);set('visitRepeatKpiPqs',pqs.size);set('visitRepeatKpiOpen',patterns.filter(p=>p.openLatest).length);set('visitRepeatKpiEvidence',patterns.filter(p=>p.evidence).length);set('visitRepeatKpiResolved',patterns.filter(p=>p.resolved).length);const c=document.getElementById('visitRepeatCount');if(c)c.textContent=`${patterns.length} örüntü`;list.innerHTML=patterns.length?patterns.map(p=>`<article class="visit-analysis-repeat-card ${p.openLatest?'danger':p.evidence?'purple':''}"><div class="visit-analysis-repeat-card-head"><div><div class="visit-analysis-repeat-card-title">${escapeHtml(p.label)}</div><div class="visit-analysis-repeat-card-meta">${escapeHtml(VISIT_REPEAT_TYPE_LABELS[p.kind]||p.kind)} · ${p.visitCount} ziyaret · ${p.recordCount} kayıt · Son kayıt: ${escapeHtml(formatVisitDate(p.latestDate))}</div></div><span class="visit-analysis-chip">${p.openLatest?'Son ziyarette açık':p.resolved?'Son ziyarette iyileşmiş':'İzleniyor'}</span></div><div class="visit-analysis-repeat-card-detail">Ziyaretler: ${escapeHtml(p.visits.map(v=>v.visitName).join(' | '))}\nPQ: ${escapeHtml(p.pqs.join(', ')||'-')} · Step: ${escapeHtml(p.steps.join(', ')||'-')}\nBirimler: ${escapeHtml(p.units.join(' | ')||'-')}\nÖrnek: ${escapeHtml(p.sample||'-')}</div></article>`).join(''):'<div class="visit-analysis-empty">Seçilen ölçütlerde tekrarlanan sorun örüntüsü bulunamadı.</div>';}
    function clearVisitRepeatedFilters(){const a=document.getElementById('visitRepeatArea'),u=document.getElementById('visitRepeatUnit'),m=document.getElementById('visitRepeatMinVisits'),t=document.getElementById('visitRepeatType'),q=document.getElementById('visitRepeatSearch');if(a)a.value='all';if(u)u.value='all';if(m)m.value='2';if(t)t.value='all';if(q)q.value='';renderVisitRepeatedIssues();}

    function setVisitAnalysisMode(mode){activeVisitAnalysisMode=mode;['history','comparison','repeated'].forEach(m=>{const btn=document.getElementById('visitAnalysisMode'+(m==='history'?'History':m==='comparison'?'Compare':'Repeat')),sec=document.getElementById('visitAnalysis'+(m==='history'?'History':m==='comparison'?'Comparison':'Repeated')+'Section');if(btn)btn.classList.toggle('active',m===mode);if(sec)sec.classList.toggle('active',m===mode);});if(mode==='history')renderVisitAnalysisHistory();if(mode==='comparison')renderVisitComparison();if(mode==='repeated')renderVisitRepeatedIssues();}
    function renderVisitAnalysisModule(){if(!document.getElementById('tab-visit-analysis'))return;populateVisitAnalysisControls();setVisitAnalysisMode(activeVisitAnalysisMode);}

    function buildVisitAnalysisTimelineRows(){return buildVisitAnalysisTimeline().map(e=>({'Tarih':visitAnalysisDay(e.date),'Ziyaret':e.visitName,'Alanlar':e.visitAreas.join(', '),'Birimler':e.visitUnits.join(' | '),'Kayıt Türü':VISIT_ANALYSIS_EVENT_LABELS[e.type]||e.type,'PQ':e.pq||'','Step':e.step||'','Başlık':e.title,'Açıklama':fullTextForExcel(e.detail||''),'Durum':e.status||'','Öncelik':VISIT_FIELD_PRIORITIES[e.priority]||e.priority||'','Kullanıcı':e.actor||''}));}
    function buildVisitComparisonExportRows(){const a=buildVisitComparisonMetrics(getInternalWorkflowVisitRecords().find(v=>v.id===((document.getElementById('visitCompareA')||{}).value||''))),b=buildVisitComparisonMetrics(getInternalWorkflowVisitRecords().find(v=>v.id===((document.getElementById('visitCompareB')||{}).value||'')));if(!a||!b)return [];return visitComparisonRows(a,b).map(r=>({'Gösterge':r.label,'Önceki Ziyaret':a.visit.visitName,'Önceki Değer':r.a,'Sonraki Ziyaret':b.visit.visitName,'Sonraki Değer':r.b,'Değişim':r.delta,'Değerlendirme':r.assessment}));}
    function buildVisitRepeatedExportRows(){return buildVisitRepeatedIssues().map(p=>({'Örüntü Türü':VISIT_REPEAT_TYPE_LABELS[p.kind]||p.kind,'Başlık':p.label,'Ziyaret Sayısı':p.visitCount,'Kayıt Sayısı':p.recordCount,'Ziyaretler':p.visits.map(v=>v.visitName).join(' | '),'PQ':p.pqs.join(', '),'Step':p.steps.join(', '),'Birimler':p.units.join(' | '),'Son Kayıt Tarihi':visitAnalysisDay(p.latestDate),'Son Ziyarette Açık':p.openLatest?'EVET':'HAYIR','Son Ziyarette İyileşmiş':p.resolved?'EVET':'HAYIR','Kanıt Sorunu':p.evidence?'EVET':'HAYIR','Örnek Tespit':fullTextForExcel(p.sample||'')}));}
    function exportVisitAnalysisExcel(){const wb=createReportWorkbook({title:'PQ/CAP Geçmişi, Ziyaret Karşılaştırma ve Tekrarlanan Sorun Analizi',subject:'USOAP CMA ziyaret ve iç denetim analizleri'}),timeline=buildVisitAnalysisTimelineRows(),compare=buildVisitComparisonExportRows(),repeat=buildVisitRepeatedExportRows();addJsonSheet(wb,'PQ_CAP_Zaman_Cizelgesi',timeline.length?timeline:[{'Bilgi':'Bir PQ seçilmedi veya kayıt bulunamadı.'}]);addJsonSheet(wb,'Ziyaret_Karsilastirma',compare.length?compare:[{'Bilgi':'İki ziyaret seçilmedi.'}]);addJsonSheet(wb,'Tekrarlanan_Sorunlar',repeat.length?repeat:[{'Bilgi':'Tekrarlanan sorun örüntüsü bulunamadı.'}]);downloadReportWorkbook(wb,'Ziyaret_PQ_CAP_Gecmis_Karsilastirma_Tekrar_Analizi.xlsx');}
    function buildVisitAnalysisPdfDefinition(){const timeline=buildVisitAnalysisTimeline(),compareRows=buildVisitComparisonExportRows(),repeat=buildVisitRepeatedIssues(),content=[{text:'Ziyaret ve İç Denetim - PQ/CAP Geçmişi, Karşılaştırma ve Tekrarlanan Sorun Analizi',style:'header'},{text:`Rapor tarihi: ${formatLongTurkishDate(new Date())}`,style:'subheader'}];content.push({text:'PQ/CAP Zaman Çizelgesi',style:'sectionHeader'});if(!timeline.length)content.push({text:'Bir PQ seçilmedi veya zaman çizelgesi kaydı bulunamadı.',color:'#64748b'});else timeline.slice(0,150).forEach((e,i)=>content.push({text:`${i+1}. ${formatVisitDate(e.date)} — ${e.visitName} — ${VISIT_ANALYSIS_EVENT_LABELS[e.type]||e.type}`,bold:true,fontSize:8.5,margin:[0,4,0,2]},{text:fullTextForPdf(`${e.title}\n${e.detail||''}`),fontSize:8,margin:[0,0,0,4]}));content.push({text:'Ziyaret Karşılaştırma',style:'sectionHeader'});if(!compareRows.length)content.push({text:'İki ziyaret seçilmedi.',color:'#64748b'});else content.push({table:{headerRows:1,widths:['*',65,65,55,'*'],body:[['Gösterge','Önceki','Sonraki','Değişim','Değerlendirme'].map(x=>({text:x,bold:true,fillColor:'#e2e8f0'})),...compareRows.map(r=>[r['Gösterge'],String(r['Önceki Değer']),String(r['Sonraki Değer']),String(r['Değişim']),r['Değerlendirme']])]},layout:'lightHorizontalLines'});content.push({text:'Tekrarlanan Sorunlar',style:'sectionHeader'});if(!repeat.length)content.push({text:'Tekrarlanan sorun örüntüsü bulunamadı.',color:'#64748b'});else repeat.slice(0,80).forEach((p,i)=>content.push({text:`${i+1}. ${p.label}`,bold:true,fontSize:8.5,margin:[0,4,0,2]},{text:fullTextForPdf(`${VISIT_REPEAT_TYPE_LABELS[p.kind]||p.kind} | ${p.visitCount} ziyaret | ${p.openLatest?'Son ziyarette açık':p.resolved?'Son ziyarette iyileşmiş':'İzleniyor'}\nZiyaretler: ${p.visits.map(v=>v.visitName).join(' | ')}\nPQ/Step: ${p.pqs.join(', ')||'-'} / ${p.steps.join(', ')||'-'}\n${p.sample||''}`),fontSize:8,margin:[0,0,0,4]}));return createStandardPdfDefinition(content,{pageOrientation:'landscape',pageSize:'A4',defaultStyle:{font:'Roboto',fontSize:8}});}
    function exportVisitAnalysisPDF(){return safeDownloadPdf(buildVisitAnalysisPdfDefinition(),'Ziyaret_PQ_CAP_Gecmis_Karsilastirma_Tekrar_Analizi.pdf');}
    window.renderVisitAnalysisModule=renderVisitAnalysisModule;window.setVisitAnalysisMode=setVisitAnalysisMode;window.visitAnalysisFilterChanged=visitAnalysisFilterChanged;window.visitAnalysisPqChanged=visitAnalysisPqChanged;window.renderVisitAnalysisHistory=renderVisitAnalysisHistory;window.clearVisitAnalysisHistoryFilters=clearVisitAnalysisHistoryFilters;window.openVisitAnalysisSource=openVisitAnalysisSource;window.populateVisitComparisonSelectors=populateVisitComparisonSelectors;window.autoSelectVisitComparison=autoSelectVisitComparison;window.renderVisitComparison=renderVisitComparison;window.renderVisitRepeatedIssues=renderVisitRepeatedIssues;window.clearVisitRepeatedFilters=clearVisitRepeatedFilters;window.exportVisitAnalysisExcel=exportVisitAnalysisExcel;window.exportVisitAnalysisPDF=exportVisitAnalysisPDF;
    window.runVisitAnalysisSelfCheck=function(){const pqs=visitAnalysisAllPqs('all'),patterns=buildVisitRepeatedIssues(),result={passed:!!document.getElementById('tab-visit-analysis')&&typeof exportVisitAnalysisExcel==='function'&&typeof exportVisitAnalysisPDF==='function',visits:getInternalWorkflowVisitRecords().length,pqs:pqs.length,repeatedPatterns:patterns.length,modes:['history','comparison','repeated']};console.log('Paket 6C öz denetimi:',result);return result;};


        window.runVisitPackage3SelfCheck=function(){const visit=getVisitWorkspaceVisit();const targets=getVisitWorkspaceTargets(visit);const records=getVisitFieldworkRecords(visit);const funcs=['renderVisitWorkspaceModule','saveVisitWorkspaceRecord','exportVisitWorkspacePDF','exportVisitWorkspaceExcel'];const result={passed:funcs.every(n=>typeof window[n]==='function'||typeof eval(n)==='function'),functions:Object.fromEntries(funcs.map(n=>[n,typeof window[n]==='function'||typeof eval(n)==='function'])),visit:!!visit,targets:targets.length,records:records.length};console.log('Ziyaret Paket 3 öz denetimi:',result);return result;};

    function buildVisitExportRows(records) {
        return (records || []).map(v => ({
            'Ziyaret Adı':v.visitName||'', 'Durum':(VISIT_STATUSES[v.status]||{}).label||v.status||'', 'Denetim Alanları':(v.areas||[]).join(', '), 'Ziyaret Edilecek Birim(ler)':getVisitUnits(v).join(' | '), 'Ziyaret Yeri':v.location||'',
            'Planlanan Başlangıç':v.plannedStart||'', 'Planlanan Bitiş':v.plannedEnd||'', 'Gerçekleşen Başlangıç':v.actualStart||'', 'Gerçekleşen Bitiş':v.actualEnd||'',
            'Katılan Personel':fullTextForExcel(v.participants||''), 'Birim Muhatapları':fullTextForExcel(v.counterparts||''), 'Ziyaretin Amacı':fullTextForExcel(v.objective||''), 'Yöntem':(v.methods||[]).join(', '), 'Genel Not':fullTextForExcel(v.generalNotes||''),
            'Oluşturan':(v.createdBy||{}).displayName||(v.createdBy||{}).email||'', 'Oluşturma Tarihi':v.createdAt||'', 'Son Güncelleyen':(v.updatedBy||{}).displayName||(v.updatedBy||{}).email||'', 'Son Güncelleme':v.updatedAt||''
        }));
    }
    function exportVisitsExcel(ctx) {
        const rows=buildVisitExportRows((ctx&&ctx.rows)||getVisibleVisits()); if(!rows.length)return alert('Dışa aktarılacak ziyaret kaydı bulunamadı.');
        const wb=createReportWorkbook({title:'Ziyaret ve İç Denetim Planı',subject:'USOAP CMA birim ziyaretleri'}); addJsonSheet(wb,'Ziyaret_Plani',rows); downloadReportWorkbook(wb,'Ziyaret_ve_Ic_Denetim_Plani.xlsx');
    }
    function visitArrayValue(value) {
        if (Array.isArray(value)) return value.filter(v => v !== undefined && v !== null && String(v).trim() !== '');
        if (value && typeof value === 'object') return Object.values(value).filter(v => v !== undefined && v !== null && String(v).trim() !== '');
        if (value === undefined || value === null || String(value).trim() === '') return [];
        return [value];
    }
    function normalizeVisitForExport(record) {
        const v = record || {};
        return {
            ...v,
            areas: visitArrayValue(v.areas).map(String),
            methods: visitArrayValue(v.methods).map(String),
            units: getVisitUnits(v).length ? getVisitUnits(v) : visitArrayValue(v.units || v.unit).map(String)
        };
    }
    function buildVisitPdfDefinition(records) {
        const safeRecords = (records || []).map(normalizeVisitForExport);
        const content = [
            {text:'Ziyaret ve İç Denetim Planı',style:'header'},
            {text:`Rapor tarihi: ${formatLongTurkishDate(new Date())} | Ziyaret sayısı: ${safeRecords.length}`,style:'subheader'}
        ];
        safeRecords.forEach((v,index) => {
            const status = (VISIT_STATUSES[v.status] || {}).label || v.status || '-';
            const rows = [
                [{text:'Durum',bold:true,fillColor:'#f1f5f9'}, fullTextForPdf(status) || '-'],
                [{text:'Denetim alanları',bold:true,fillColor:'#f1f5f9'}, fullTextForPdf(v.areas.join(', ')) || '-'],
                [{text:'Ziyaret edilecek birim(ler)',bold:true,fillColor:'#f1f5f9'}, fullTextForPdf(v.units.join('\n')) || '-'],
                [{text:'Ziyaret yeri',bold:true,fillColor:'#f1f5f9'}, fullTextForPdf(v.location) || '-'],
                [{text:'Planlanan tarihler',bold:true,fillColor:'#f1f5f9'}, fullTextForPdf(formatVisitDateRange(v.plannedStart,v.plannedEnd)) || '-'],
                [{text:'Gerçekleşen tarihler',bold:true,fillColor:'#f1f5f9'}, fullTextForPdf(formatVisitDateRange(v.actualStart,v.actualEnd)) || '-'],
                [{text:'Katılan personel',bold:true,fillColor:'#f1f5f9'}, fullTextForPdf(v.participants) || '-'],
                [{text:'Birim muhatapları',bold:true,fillColor:'#f1f5f9'}, fullTextForPdf(v.counterparts) || '-'],
                [{text:'Ziyaretin amacı',bold:true,fillColor:'#f1f5f9'}, fullTextForPdf(v.objective) || '-'],
                [{text:'Ziyaret yöntemi',bold:true,fillColor:'#f1f5f9'}, fullTextForPdf(v.methods.join(', ')) || '-'],
                [{text:'Genel açıklama / planlama notu',bold:true,fillColor:'#f1f5f9'}, fullTextForPdf(v.generalNotes) || '-']
            ];
            content.push({text:`${index+1}. ${v.visitName || 'Adsız ziyaret'}`,style:'visitTitle',pageBreak:index>0 && index%3===0?'before':undefined});
            content.push({table:{headerRows:0,widths:[135,'*'],body:rows},layout:'lightHorizontalLines',margin:[0,0,0,12]});
        });
        return createStandardPdfDefinition(content,{
            pageOrientation:'portrait',pageSize:'A4',
            styles:{visitTitle:{fontSize:12,bold:true,color:'#1d4ed8',margin:[0,8,0,5]}},
            defaultStyle:{font:'Roboto',fontSize:8.5}
        });
    }
    function visitPrintEscape(value) {
        return escapeHtml(value === undefined || value === null || String(value).trim() === '' ? '-' : String(value)).replace(/\n/g,'<br>');
    }
    function buildVisitPrintHtml(records) {
        const safeRecords = (records || []).map(normalizeVisitForExport);
        const cards = safeRecords.map((v,index) => {
            const status = (VISIT_STATUSES[v.status] || {}).label || v.status || '-';
            const row = (label,value) => `<tr><th>${visitPrintEscape(label)}</th><td>${visitPrintEscape(value)}</td></tr>`;
            return `<section class="visit-print-card">
                <h2>${index+1}. ${visitPrintEscape(v.visitName || 'Adsız ziyaret')}</h2>
                <table>
                    ${row('Durum',status)}
                    ${row('Denetim alanları',v.areas.join(', '))}
                    ${row('Ziyaret edilecek birim(ler)',v.units.join('\n'))}
                    ${row('Ziyaret yeri',v.location)}
                    ${row('Planlanan tarihler',formatVisitDateRange(v.plannedStart,v.plannedEnd))}
                    ${row('Gerçekleşen tarihler',formatVisitDateRange(v.actualStart,v.actualEnd))}
                    ${row('Katılan personel',v.participants)}
                    ${row('Birim muhatapları',v.counterparts)}
                    ${row('Ziyaretin amacı',v.objective)}
                    ${row('Ziyaret yöntemi',v.methods.join(', '))}
                    ${row('Genel açıklama / planlama notu',v.generalNotes)}
                </table>
            </section>`;
        }).join('');
        return `<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><title>Ziyaret ve İç Denetim Planı</title>
        <style>
            @page{size:A4 portrait;margin:14mm} body{font-family:Arial,Helvetica,sans-serif;color:#0f172a;margin:0;font-size:10pt}
            h1{font-size:18pt;color:#1d4ed8;margin:0 0 4px} .meta{color:#64748b;margin:0 0 16px}
            .visit-print-card{page-break-inside:avoid;margin:0 0 14px}.visit-print-card h2{font-size:12pt;color:#1d4ed8;margin:0 0 6px}
            table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border-bottom:1px solid #e2e8f0;padding:6px 7px;vertical-align:top;word-wrap:break-word;white-space:normal}
            th{width:31%;background:#f1f5f9;text-align:left}@media print{button{display:none!important}}
        </style></head><body>
        <h1>Ziyaret ve İç Denetim Planı</h1><p class="meta">Rapor tarihi: ${visitPrintEscape(formatLongTurkishDate(new Date()))} | Ziyaret sayısı: ${safeRecords.length}</p>
        ${cards}<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),250));<\/script>


</body></html>`;
    }
    function openVisitPrintFallback(records, reason) {
        const html = buildVisitPrintHtml(records);
        const popup = window.open('', '_blank');
        if (popup) {
            popup.document.open(); popup.document.write(html); popup.document.close();
        } else {
            const frame = document.createElement('iframe');
            frame.style.position='fixed'; frame.style.right='0'; frame.style.bottom='0'; frame.style.width='1px'; frame.style.height='1px'; frame.style.border='0';
            document.body.appendChild(frame);
            frame.onload=()=>{ try { frame.contentWindow.focus(); frame.contentWindow.print(); } catch(e) { console.error(e); } setTimeout(()=>frame.remove(),2000); };
            frame.srcdoc=html;
        }
        if (reason) console.warn('Ziyaret PDF indirme yedeği kullanıldı:', reason);
    }
    function exportVisitsPDF(ctx) {
        const records = ((ctx && Array.isArray(ctx.rows)) ? ctx.rows : getVisibleVisits()).map(normalizeVisitForExport);
        if (!records.length) return alert('Dışa aktarılacak ziyaret kaydı bulunamadı. Filtreleri kontrol edin veya önce bir ziyaret kaydı oluşturun.');
        try {
            if (typeof pdfMake === 'undefined' || !pdfMake || typeof pdfMake.createPdf !== 'function') {
                openVisitPrintFallback(records, 'PDFMake kütüphanesi yüklenemedi.');
                alert('PDF kütüphanesine erişilemediği için tarayıcının yazdırma ekranı açıldı. Hedef olarak “PDF olarak kaydet” seçeneğini kullanabilirsiniz.');
                return;
            }
            const docDef = buildVisitPdfDefinition(records);
            safeDownloadPdf(docDef,'Ziyaret_ve_Ic_Denetim_Plani.pdf');
        } catch(error) {
            console.error('Ziyaret PDF hatası:',error);
            openVisitPrintFallback(records,error);
            alert('Doğrudan PDF indirme tamamlanamadı. Tarayıcının yazdırma ekranı açıldı; “PDF olarak kaydet” seçeneğini kullanabilirsiniz. Hata: ' + (error && error.message ? error.message : error));
        }
    }
    window.filterVisitUnitOptions=filterVisitUnitOptions; window.selectAllVisibleVisitUnits=selectAllVisibleVisitUnits; window.updateVisitUnitSelectionSummary=updateVisitUnitSelectionSummary; window.exportVisitUnitMappingTemplate=exportVisitUnitMappingTemplate; window.importVisitUnitMappingFile=importVisitUnitMappingFile; window.exportVisitsPDF=exportVisitsPDF; window.exportVisitsExcel=exportVisitsExcel; window.openVisitForm=openVisitForm; window.closeVisitForm=closeVisitForm; window.saveVisitForm=saveVisitForm; window.deleteVisitRecord=deleteVisitRecord; window.viewVisitDetail=viewVisitDetail; window.closeVisitDetail=closeVisitDetail; window.renderVisitModule=renderVisitModule; window.refreshVisitModule=refreshVisitModule; window.clearVisitFilters=clearVisitFilters;
    window.runVisitModuleSelfCheck=function(){const records=getVisitRecords();const result={passed:!!document.getElementById('tab-visits')&&!!document.getElementById('btn-tab-visits')&&typeof saveVisitForm==='function'&&typeof startVisitFirebaseListener==='function',records:records.length,active:records.filter(v=>!['completed','cancelled'].includes(v.status)).length,firebasePath:'icao_visits',unitMultiSelect:!!document.getElementById('visitUnitCheckboxes'),pdfExport:typeof exportVisitsPDF==='function',sidebarWheelBound:document.querySelector('.sidebar')?.dataset.wheelScrollBound==='1'};console.table(result);return result;};

    function render() {
        resetCommonActionClassificationCache();
        const filteredData = getFilteredData(); updateActiveTagsUI(); updateReadyFiltersUI();
        const analytics = buildCommonCalculationModel(filteredData);
        window.currentAnalyticsModel = analytics;
        const stats = getCommonLegacyStats(analytics);
        const groups = analytics.groups; window.currentFilteredGroups = groups;

        document.getElementById('totalPqCount').innerText = stats.pqs.total; document.getElementById('activeActionCount').innerText = stats.actions.total; document.getElementById('lateCount').innerText = stats.late.total; document.getElementById('doneCount').innerText = stats.done.total; document.getElementById('pendingCount').innerText = stats.pending.total;
        
        if (stats.pqs.total === 0 && stats.actions.total === 0) { document.getElementById('pqDetails').innerHTML = ""; document.getElementById('actionDetails').innerHTML = ""; document.getElementById('lateDetails').innerHTML = ""; document.getElementById('doneDetails').innerHTML = ""; document.getElementById('pendingDetails').innerHTML = ""; } 
        else {
            let pqExtra = stats.pqs.completed.total > 0 ? `<br><div style="margin-top:6px; font-size:12px; background: rgba(16, 185, 129, 0.1); padding: 6px 8px; border-radius: 4px; border: 1px solid rgba(16, 185, 129, 0.2);"><span style="color:var(--ok); font-weight:bold;">✅ PQ TAMAMLANDI (${stats.pqs.completed.total})</span><br><span style="font-weight:normal; font-size:11px; color:var(--text);"><b>Dağılım:</b> ${stats.pqs.completed.onSite} / ${stats.pqs.completed.offSite} Off-Site</span></div>` : "";
            document.getElementById('pqDetails').innerHTML = `<b>Dağılım:</b> ${stats.pqs.onSite} On-Site / ${stats.pqs.offSite} Off-Site ${pqExtra}`; document.getElementById('actionDetails').innerHTML = `<b>Dağılım:</b> ${stats.actions.onSite} On-Site / ${stats.actions.offSite} Off-Site`; document.getElementById('lateDetails').innerHTML = `<b>Dağılım:</b> ${stats.late.onSite} On-Site / ${stats.late.offSite} Off-Site`; document.getElementById('doneDetails').innerHTML = `<b>Dağılım:</b> ${stats.done.onSite} On-Site / ${stats.done.offSite} Off-Site`; document.getElementById('pendingDetails').innerHTML = `<b>Dağılım:</b> ${stats.pending.onSite} On-Site / ${stats.pending.offSite} Off-Site`;
        }

        renderTable(filteredData, groups); updateCharts(filteredData, analytics); updateAreaSummary(filteredData, analytics); updateWarnings(filteredData, analytics); updatePastTasks(filteredData, analytics); updateEIProjections(filteredData); renderIcaoOfficialChart(); updateSmartManagementPanel(filteredData, analytics); updateDataQualityCenter(filteredData); renderKanban(filteredData, analytics);
        if(document.getElementById('tab-report').classList.contains('active')) updateReportPreview();
        if(document.getElementById('tab-strategic') && document.getElementById('tab-strategic').classList.contains('active')) renderStrategicReportPreview();
        if(document.getElementById('tab-visits') && document.getElementById('tab-visits').classList.contains('active')) renderVisitModule();
    }

    window.togglePQ = function(id) { let dRow = document.getElementById('detail-'+id); let hRow = document.getElementById('head-'+id); if(dRow.classList.contains('active')) { dRow.classList.remove('active'); hRow.classList.remove('active'); } else { dRow.classList.add('active'); hRow.classList.add('active'); } };
    window.updateNote = function(pq, step, val) { let item = rawData.find(x => x.pq === pq && x.step === step); if(item) { item.note = val; saveToLocalStorage(); if(document.getElementById('tab-report').classList.contains('active')) updateReportPreview(); } }
    window.toggleDailyReport = function(pq, step, isChecked) { let key = pq + "|" + step; if (isChecked) dailyReviewedSet.add(key); else dailyReviewedSet.delete(key); saveToLocalStorage(); if(document.getElementById('tab-report').classList.contains('active')) updateReportPreview(); }
    window.toggleDailyReportPQ = function(pq, isChecked) { if(isChecked) dailyReviewedPQs.add(pq); else dailyReviewedPQs.delete(pq); saveToLocalStorage(); if(document.getElementById('tab-report').classList.contains('active')) updateReportPreview(); }
    window.updatePQNote = function(pq, val) { dailyPQNotes[pq] = val; saveToLocalStorage(); if(document.getElementById('tab-report').classList.contains('active')) updateReportPreview(); }

    function renderTable(filteredData, groups) {
        const tbody = document.getElementById('tableBody');
        if (filteredData.length === 0) { tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 50px; color: var(--muted);">Veri bulunamadı.</td></tr>`; return; }
        
        let tableHtml = "";
        let sortedPQs = Object.keys(groups).sort(sortPQs);
        sortedPQs.forEach(pq => {
            const items = groups[pq]; const excel = pqMasterData[pq] || {}; const safeId = pq.replace(/\./g, '-');
            const localizedQuestion = getLocalizedPqQuestion(excel);
            const localizedFinding = getLocalizedPqFinding(excel);
            const totalItems = items.length; const doneItems = items.filter(i => getStatus(i).type === 'done').length; const pct = Math.round((doneItems / totalItems) * 100);
            const isAllDone = pct === 100; const pqStatusText = isAllDone ? `<br><span class="badge badge-pq-done">✅ PQ TAMAMLANDI</span>` : '';
            
            let html = `<tr id="head-${safeId}" class="pq-group-row" onclick="togglePQ('${safeId}')">
                <td><b>PQ ${pq}</b><br><span class="badge badge-extra" style="margin-top:5px;">${excel.alan || 'N/A'}</span></td>
                <td><div style="font-size:12px; font-weight:600; margin-bottom:4px; display:flex; justify-content:space-between;"><span>${doneItems} / ${totalItems} Eylem Tamamlandı</span><span>%${pct}</span></div><div class="pq-progress-container"><div class="pq-progress-fill ${isAllDone ? 'done' : ''}" style="width:${pct}%"></div></div>${pqStatusText}</td>
                <td style="font-size:12px; color:var(--muted); line-height:1.5;">${localizedFinding ? `<div class="truncate"><b>${currentUiLang==='tr'?'Bulgu':'Finding'}:</b> ${escapeHtml(localizedFinding)}</div>` : ''}<b>Tür:</b> ${excel.tur || 'N/A'} | <b>Personel:</b> ${excel.sorumlu || 'N/A'}<br><b>ICAO Durum:</b> ${excel.degerlendirme || 'N/A'}</td>
                <td style="text-align:center; font-size:18px; color:var(--primary);">➕</td></tr>`;
            
            let detailHtml = `<tr id="detail-${safeId}" class="pq-detail-row"><td colspan="4"><div class="detail-container">`;
            detailHtml += `<div class="finding-box"><div class="finding-meta"><span><b>Alan:</b> ${excel.alan || '-'}</span><span><b>CE:</b> ${excel.ce || '-'}</span><span><b>Tür:</b> ${excel.tur || '-'}</span><span><b>Personel:</b> ${excel.sorumlu || '-'}</span><span><b>ICAO:</b> ${excel.degerlendirme || '-'}</span></div>${localizedQuestion?`<b>❓ ${currentUiLang==='tr'?'PQ Sorusu':'PQ Question'}:</b><br>${escapeHtml(localizedQuestion)}<br><br>`:''}<b>📝 ${currentUiLang==='tr'?'İlgili ICAO Bulgusu':'Related ICAO Finding'}:</b><br>${localizedFinding?escapeHtml(localizedFinding):'<i>Excel eşleşmesi yok.</i>'}</div>`;
            detailHtml += `<div style="margin-top: 15px; background: white; padding: 10px; border-radius: 8px; border: 1px solid #e2e8f0; display:flex; gap:10px; align-items:center;">
                <label style="display:flex; align-items:center; gap:8px; font-weight:bold; font-size:13px; color:#0f5132; background:#d1e7dd; padding:6px 12px; border-radius:6px; cursor:pointer;"><input type="checkbox" style="width:16px; height:16px; accent-color:#198754;" ${dailyReviewedPQs.has(pq) ? 'checked' : ''} onchange="toggleDailyReportPQ('${pq}', this.checked); event.stopPropagation();"> GÜNLÜK RAPORA EKLE (TÜM PQ)</label>
                <input type="text" class="note-input" style="flex:1; min-height:auto;" placeholder="Bu PQ için yönetici özetine eklenecek genel not..." value="${dailyPQNotes[pq] || ''}" oninput="updatePQNote('${pq}', this.value)" onclick="event.stopPropagation();">
            </div>`;
            
            detailHtml += `<table class="inner-steps-table"><thead><tr><th>Adım</th><th>Planlanan Eylem</th><th>Sorumlu Ofis</th><th>Hedef/Bitiş</th><th>Durum</th></tr></thead><tbody>`;
            items.forEach(item => {
                const s = getStatus(item); let tagsHtml = generateSmartTags(item.action, excel.ce || '');
                detailHtml += `<tr><td><b>${item.step}</b></td><td><div style="margin-bottom:8px;">${item.action}</div><div style="margin-bottom:8px;">${tagsHtml}</div><textarea class="note-input" placeholder="Kişisel not ekle..." onchange="updateNote('${pq}', '${item.step}', this.value)">${item.note || ''}</textarea></td><td><b>${item.office}</b></td><td style="white-space:nowrap;">${item.estDate}</td><td style="color:var(--${s.color}); font-weight:bold; white-space:nowrap;">${s.label}</td></tr>`;
            });
            detailHtml += `</tbody></table></div></td></tr>`;
            tableHtml += html + detailHtml;
        });
        tbody.innerHTML = tableHtml;
    }

    function updateAreaSummary(filteredData, analyticsModel = null) {
        const analytics = analyticsModel || buildCommonCalculationModel(filteredData || []);
        const areaStats = analytics.areas || {};
        const tbody = document.getElementById('areaSummaryBody');
        tbody.innerHTML = "";
        window.currentAreaSummaryRaw = [];

        if (Object.keys(areaStats).length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:30px; color:var(--muted);">Bu filtreleme için veri bulunamadı.</td></tr>`;
            renderIcaoClosedList();
            renderEmptyCapsList();
            return;
        }

        Object.keys(areaStats).sort(sortAreas).forEach(alan => {
            const s = areaStats[alan];
            const pct = s.total > 0 ? ((s.done / s.total) * 100).toFixed(1) : 0;
            window.currentAreaSummaryRaw.push({ alan: alan, ...s, pct: pct });
            const tr = document.createElement('tr');
            tr.innerHTML = `<td style="vertical-align:middle; font-size:13px;"><b>${alan}</b></td><td style="text-align:center;"><b>${s.total}</b><br><i style="font-size:10px; color:var(--muted);">(${s.totalOn} On-Site, ${s.totalOff} Off-Site)</i></td><td style="text-align:center;"><span style="color:var(--ok); font-weight:bold; font-size:14px;">${s.done}</span><br><i style="font-size:10px; color:var(--muted);">(${s.doneOn} On-Site, ${s.doneOff} Off-Site)</i></td><td style="text-align:center;"><span style="color:var(--warn); font-weight:bold; font-size:14px;">${s.ongoing}</span><br><i style="font-size:10px; color:var(--muted);">(${s.ongoingOn} On-Site, ${s.ongoingOff} Off-Site)</i></td><td style="text-align:center; vertical-align:middle; font-size:13px;"><b>%${pct}</b></td>`;
            tbody.appendChild(tr);
        });

        renderIcaoClosedList();
        renderEmptyCapsList();
    }

    function updateCharts(data, analyticsModel = null) {
        const analytics = analyticsModel || buildCommonCalculationModel(data || []);
        const sType = {
            done: { 'On-Site': analytics.status.done.onSite, 'Off-Site': analytics.status.done.offSite, 'Other': analytics.status.done.other },
            late: { 'On-Site': analytics.status.late.onSite, 'Off-Site': analytics.status.late.offSite, 'Other': analytics.status.late.other },
            pending: { 'On-Site': analytics.status.pending.onSite, 'Off-Site': analytics.status.pending.offSite, 'Other': analytics.status.pending.other }
        };
        const c1 = document.getElementById('statusChart').getContext('2d'); if (charts.s) charts.s.destroy(); charts.s = new Chart(c1, { type: 'bar', data: { labels: ['Tamamlanan', 'Bekleyen', 'Gecikmiş'], datasets: [ { label: 'On-Site', data: [sType.done['On-Site'], sType.pending['On-Site'], sType.late['On-Site']], backgroundColor: '#3b82f6' }, { label: 'Off-Site', data: [sType.done['Off-Site'], sType.pending['Off-Site'], sType.late['Off-Site']], backgroundColor: '#10b981' }, { label: 'Diğer', data: [sType.done['Other'], sType.pending['Other'], sType.late['Other']], backgroundColor: '#94a3b8' } ] }, options: { plugins: { title: { display: true, text: 'Eylem Dağılımı ve Doğrulama Türü' } }, responsive: true, maintainAspectRatio: false, scales: { x: { stacked: true }, y: { stacked: true } } } });
        const tL = analytics.status.late.total;
        const tO = Math.max(0, analytics.actions.total - tL);
        const c2 = document.getElementById('delayChart').getContext('2d'); if (charts.d) charts.d.destroy(); charts.d = new Chart(c2, { type: 'doughnut', data: { labels: ['Geciken %', 'Zamanında/Bekleyen %'], datasets: [{ data: [tL, tO], backgroundColor: ['#ef4444', '#10b981'] }] }, options: { plugins: { title: { display: true, text: 'Eylem Gecikme Oranı' } }, cutout: '75%', responsive: true, maintainAspectRatio: false } });
        const c3 = document.getElementById('officeChart').getContext('2d'); if (charts.o) charts.o.destroy();
        const sOffices = (analytics.officeRows || []).slice().sort((a,b) => b.actions - a.actions).slice(0,5);
        charts.o = new Chart(c3, { type: 'bar', data: { labels: sOffices.map(o => o.office.substring(0,15)), datasets: [{ label: 'Eylem Sayısı', data: sOffices.map(o => o.actions), backgroundColor: '#f59e0b' }] }, options: { plugins: { title: { display: true, text: 'En Çok Eylem Atanan 5 Ofis' }, legend: { display: false } }, responsive: true, maintainAspectRatio: false } });
    }

    const KANBAN_WORKFLOW_STAGE_OPTIONS = ['Hazırlanıyor', 'Kanıt Bekleniyor', 'Birim Kontrolünde', 'SHGM Kontrolünde', 'ICAO’ya Sunulacak', 'ICAO Değerlendirmesinde', 'Kapatıldı'];
    function getKanbanStageKey(pq, step) { return `${pq}|${step}`; }
    function getKanbanWorkflowStage(pq, step) { return kanbanWorkflowStages[getKanbanStageKey(pq, step)] || 'Hazırlanıyor'; }
    function kanbanWorkflowSelectHtml(pq, step) {
        const current = getKanbanWorkflowStage(pq, step);
        return `<select title="SHGM iç süreç aşaması" onclick="event.stopPropagation()" onchange="updateKanbanWorkflowStage('${String(pq).replace(/'/g, "\\'")}', '${String(step).replace(/'/g, "\\'")}', this.value, event)" style="width:100%; margin:6px 0; padding:5px; font-size:10px; background:var(--bg); border:1px solid var(--border); border-radius:6px; color:var(--text);">${KANBAN_WORKFLOW_STAGE_OPTIONS.map(opt => `<option value="${escapeHtml(opt)}" ${opt === current ? 'selected' : ''}>${escapeHtml(opt)}</option>`).join('')}</select>`;
    }
    window.updateKanbanWorkflowStage = function(pq, step, value, ev) {
        if (ev) ev.stopPropagation();
        const key = getKanbanStageKey(pq, step);
        if (!value || value === 'Hazırlanıyor') delete kanbanWorkflowStages[key]; else kanbanWorkflowStages[key] = value;
        saveToLocalStorage();
        if (document.getElementById('tab-kanban').classList.contains('active')) renderKanban(getFilteredData());
    };
    function summarizeKanbanWorkflowStages(items) {
        let counts = {};
        (items || []).forEach(d => { let st = getKanbanWorkflowStage(d.pq, d.step); counts[st] = (counts[st] || 0) + 1; });
        let top = Object.keys(counts).sort((a,b) => counts[b] - counts[a])[0] || 'Hazırlanıyor';
        return { top, counts };
    }

    function getKanbanActionStatus(d) {
        const classification = getCommonActionClassification(d);
        if (classification.code === COMMON_ACTION_STATUS.COMPLETED.code) return { label: classification.label, color: 'ok', type: 'done', common: classification };
        if (classification.code === COMMON_ACTION_STATUS.LATE.code) return { label: classification.label, color: 'danger', type: 'late', common: classification };
        if (classification.code === COMMON_ACTION_STATUS.DATE_RISK.code) return { label: 'Tarih Yok / Planlama Riski', color: 'danger', type: 'missing', common: classification };
        return { label: classification.label, color: classification.code === COMMON_ACTION_STATUS.UPCOMING.code ? 'warn' : 'primary', type: 'pending', common: classification };
    }
    function getKanbanDaysInfo(d, bucketType) {
        const classification = getCommonActionClassification(d);
        if (!classification.targetDate) return { label: 'Tarih yok', days: null, chipClass: 'danger' };
        if (bucketType === 'late' || classification.code === COMMON_ACTION_STATUS.LATE.code) return { label: `${classification.delayDays} gün gecikti`, days: classification.delayDays, chipClass: 'danger' };
        if (bucketType === 'done') return { label: `Hedef: ${d.estDate}`, days: classification.daysRemaining, chipClass: 'ok' };
        const days = classification.daysRemaining === null ? 0 : classification.daysRemaining;
        return { label: `${days} gün kaldı`, days, chipClass: classification.code === COMMON_ACTION_STATUS.UPCOMING.code ? 'warn' : 'ok' };
    }
    function getPQKanbanMetrics(pq, items) {
        const m = pqMasterData[pq] || {};
        const usable = (items || []).filter(isUsableCapStep);
        const pqClassification = classifyCommonPQStatus(pq, items || [], { upcomingDays: 30 });
        let done = 0, late = 0, pending = 0, missing = 0, maxDelay = 0, latestDate = null, earliestOpenDate = null;
        const offices = new Set();
        usable.forEach(d => {
            const classification = getCommonActionClassification(d);
            if (classification.code === COMMON_ACTION_STATUS.COMPLETED.code) done++;
            else if (classification.code === COMMON_ACTION_STATUS.LATE.code) { late++; maxDelay = Math.max(maxDelay, classification.delayDays || 0); }
            else if (classification.code === COMMON_ACTION_STATUS.DATE_RISK.code) missing++;
            else pending++;
            if (classification.targetDate) {
                if (!latestDate || classification.targetDate > latestDate) latestDate = classification.targetDate;
                if (classification.code !== COMMON_ACTION_STATUS.COMPLETED.code && (!earliestOpenDate || classification.targetDate < earliestOpenDate)) earliestOpenDate = classification.targetDate;
            }
            if (d.office) offices.add(normalizeTrendOwner(d.office));
        });
        let type = 'pending', label = pqClassification.label, color = 'warn';
        if (pqClassification.code === COMMON_PQ_STATUS.OFFICIAL_CLOSED.code || pqClassification.code === COMMON_PQ_STATUS.CAP_COMPLETED.code) {
            type = 'done'; color = 'ok';
        } else if (late > 0) {
            type = 'late'; label = 'Gecikmiş'; color = 'danger';
        } else if (missing > 0 || pqClassification.code === COMMON_PQ_STATUS.OPEN_DATE_RISK.code || pqClassification.code === COMMON_PQ_STATUS.NO_CAP.code) {
            type = 'missing'; label = pqClassification.label; color = 'danger';
        }
        const areaTotal = baseEIData[normalizeAreaKey(m.alan)] ? baseEIData[normalizeAreaKey(m.alan)].total : 0;
        return {
            pq, items, master: m, usable, done, late, pending, missing, maxDelay, latestDate, earliestOpenDate,
            total: usable.length, remaining: Math.max(0, usable.length - done), progressPct: usable.length ? ratioPct(done, usable.length) : 0,
            type, label, color, pqStatusCode: pqClassification.code, pqStatusLabel: pqClassification.label,
            offices: Array.from(offices).slice(0, 3).join(' / ') || m.sorumlu || '-',
            areaContributionPct: areaTotal > 0 ? 100 / areaTotal : 0
        };
    }
    function kanbanCompare(a, b, type, mode) {
        const getDt = x => mode === 'pq' ? (x.earliestOpenDate || x.latestDate) : parseDateObj(x.estDate);
        if (type === 'late') {
            let ad = mode === 'pq' ? (a.maxDelay || 0) : (getKanbanDaysInfo(a, 'late').days || 0);
            let bd = mode === 'pq' ? (b.maxDelay || 0) : (getKanbanDaysInfo(b, 'late').days || 0);
            if (bd !== ad) return bd - ad;
        }
        if (type === 'pending') {
            let da = getDt(a), db = getDt(b);
            if (da && db && da.getTime() !== db.getTime()) return da - db;
            if (da && !db) return -1;
            if (!da && db) return 1;
        }
        if (type === 'done') {
            let da = getDt(a), db = getDt(b);
            if (da && db && da.getTime() !== db.getTime()) return db - da;
        }
        if (mode === 'pq') {
            if ((b.areaContributionPct || 0) !== (a.areaContributionPct || 0)) return (b.areaContributionPct || 0) - (a.areaContributionPct || 0);
            if ((a.remaining || 0) !== (b.remaining || 0)) return (a.remaining || 0) - (b.remaining || 0);
            return sortPQs(a.pq, b.pq);
        }
        return sortAreas((pqMasterData[a.pq]||{}).alan||'', (pqMasterData[b.pq]||{}).alan||'') || sortPQs(a.pq, b.pq) || String(a.step).localeCompare(String(b.step));
    }

    function kanbanPqClick(pq) { return `onclick="switchTab('list'); window.togglePQ('${String(pq || '').replace(/\./g, '-')}');"`; }

    function renderKanbanStepCard(d, bucketType) {
        const m = pqMasterData[d.pq] || {};
        const status = getKanbanActionStatus(d);
        const days = getKanbanDaysInfo(d, status.type);
        const pqItems = rawData.filter(x => x.pq === d.pq);
        const pqMetrics = getPQKanbanMetrics(d.pq, pqItems);
        const tagsHtml = generateSmartTags(d.action || '', m.ce || '');
        const actionText = escapeHtml((d.action || '').substring(0, 170)) + ((d.action || '').length > 170 ? '...' : '');
        const borderColor = status.type === 'late' ? 'var(--danger)' : (status.type === 'done' ? 'var(--ok)' : (status.type === 'missing' ? '#991b1b' : 'var(--warn)'));
        return `<div class="kanban-card" style="border-left-color:${borderColor};" ${kanbanPqClick(d.pq)}>
            <div class="kanban-card-meta"><span><b style="color:var(--text); font-size:13px;">PQ ${escapeHtml(d.pq)}</b> <span style="background:rgba(0,0,0,0.05); padding:2px 6px; border-radius:4px;">${escapeHtml(m.alan || 'N/A')}</span></span><span>${escapeHtml(d.estDate || '-')}</span></div>
            <div class="kanban-card-title">${actionText}</div>
            <div class="kanban-card-riskline">
                <span class="kb-risk-chip ${days.chipClass}">${escapeHtml(days.label)}</span>
                <span class="kb-risk-chip">${escapeHtml(m.ce || '-')}</span>
                <span class="kb-risk-chip">${escapeHtml(m.tur || '-')}</span>
                <span class="kb-risk-chip ok">EI ${pctText(pqMetrics.areaContributionPct)}</span>
            </div>
            <div class="kanban-progress-small" title="PQ ilerlemesi"><span style="width:${Math.min(100, pqMetrics.progressPct).toFixed(0)}%"></span></div>
            <div style="font-size:10px; color:var(--muted); margin-bottom:6px;">PQ ilerleme: %${pqMetrics.progressPct.toFixed(0)} | Kalan adım: ${pqMetrics.remaining}</div>
            <div style="margin-bottom: 5px;">${tagsHtml}</div>
            ${kanbanWorkflowSelectHtml(d.pq, d.step)}
            <div class="kanban-card-footer"><span style="font-size:11px; font-weight:bold; color:var(--primary);">Adım ${escapeHtml(d.step)}</span><span style="font-size:10px; color:var(--muted); background:var(--bg); padding:2px 6px; border-radius:4px; border:1px solid var(--border);">${escapeHtml(d.office || '-')}</span></div>
        </div>`;
    }

    function renderKanbanPQCard(item) {
        const m = item.master || {};
        const dateText = item.type === 'done' ? (item.latestDate ? formatExactDate(item.latestDate) : '-') : (item.earliestOpenDate ? formatExactDate(item.earliestOpenDate) : (item.latestDate ? formatExactDate(item.latestDate) : 'Tarih yok'));
        const borderColor = item.type === 'late' ? 'var(--danger)' : (item.type === 'done' ? 'var(--ok)' : (item.type === 'missing' ? '#991b1b' : 'var(--warn)'));
        const firstAction = item.usable[0] ? truncateTextForExport(item.usable[0].action, 170) : (m.bulgu || 'CAP adımı bulunamadı');
        return `<div class="kanban-card" style="border-left-color:${borderColor};" ${kanbanPqClick(item.pq)}>
            <div class="kanban-card-meta"><span><b style="color:var(--text); font-size:13px;">PQ ${escapeHtml(item.pq)}</b> <span style="background:rgba(0,0,0,0.05); padding:2px 6px; border-radius:4px;">${escapeHtml(m.alan || 'N/A')}</span></span><span>${escapeHtml(dateText)}</span></div>
            <div class="kanban-card-title">${escapeHtml(firstAction)}</div>
            <div class="kanban-card-riskline">
                <span class="kb-risk-chip ${item.type === 'done' ? 'ok' : (item.type === 'pending' ? 'warn' : 'danger')}">${escapeHtml(item.label)}</span>
                <span class="kb-risk-chip">${escapeHtml(m.ce || '-')}</span>
                <span class="kb-risk-chip ok">EI ${pctText(item.areaContributionPct)}</span>
            </div>
            <div class="kanban-progress-small"><span style="width:${Math.min(100, item.progressPct).toFixed(0)}%"></span></div>
            <div style="font-size:10px; color:var(--muted); margin-bottom:8px;">${item.done}/${item.total} adım tamamlandı | ${item.late} gecikmiş | ${item.missing} tarih eksik | İç süreç: ${escapeHtml(summarizeKanbanWorkflowStages(item.usable).top)}</div>
            <div class="kanban-card-footer"><span style="font-size:11px; font-weight:bold; color:var(--primary);">Kalan ${item.remaining} adım</span><span style="font-size:10px; color:var(--muted); background:var(--bg); padding:2px 6px; border-radius:4px; border:1px solid var(--border);">${escapeHtml(item.offices || '-')}</span></div>
        </div>`;
    }

    function buildKanbanPQItems(filteredData) {
        const selectedPQs = new Set((filteredData || []).map(d => d.pq));
        const groups = {};
        rawData.forEach(d => { if (selectedPQs.has(d.pq)) { if (!groups[d.pq]) groups[d.pq] = []; groups[d.pq].push(d); } });
        return Object.keys(groups).map(pq => getPQKanbanMetrics(pq, groups[pq]));
    }

    function setKanbanColumn(column, items, renderLimit, renderFn) {
        const el = document.getElementById(`kb-${column}`);
        const countEl = document.getElementById(`kb-${column}-count`);
        if (!el || !countEl) return;
        countEl.innerText = items.length > renderLimit ? `${renderLimit}+ (${items.length})` : items.length;
        el.innerHTML = items.length ? items.slice(0, renderLimit).map(renderFn).join('') : `<div style="color:var(--muted); font-size:12px; text-align:center; padding:18px; border:1px dashed var(--border); border-radius:8px;">Kart bulunmuyor.</div>`;
    }

    function renderKanban(filteredData, analyticsModel = null) {
        const renderLimit = 100;
        const viewEl = document.getElementById('kanbanViewMode');
        const viewMode = viewEl ? viewEl.value : 'step';
        const buckets = { late: [], missing: [], pending: [], done: [] };
        if (viewMode === 'pq') {
            buildKanbanPQItems(filteredData).forEach(item => { if (buckets[item.type]) buckets[item.type].push(item); });
            Object.keys(buckets).forEach(type => buckets[type].sort((a,b) => kanbanCompare(a,b,type,'pq')));
            setKanbanColumn('late', buckets.late, renderLimit, renderKanbanPQCard);
            setKanbanColumn('missing', buckets.missing, renderLimit, renderKanbanPQCard);
            setKanbanColumn('pending', buckets.pending, renderLimit, renderKanbanPQCard);
            setKanbanColumn('done', buckets.done, renderLimit, renderKanbanPQCard);
        } else {
            const tracking = buildCommonTaskTrackingModel(filteredData || [], { upcomingDays: 30 }, analyticsModel);
            tracking.actionItems.forEach(item => {
                const row = item.row;
                const st = getKanbanActionStatus(row);
                if (buckets[st.type]) buckets[st.type].push(row);
            });
            Object.keys(buckets).forEach(type => buckets[type].sort((a,b) => kanbanCompare(a,b,type,'step')));
            setKanbanColumn('late', buckets.late, renderLimit, d => renderKanbanStepCard(d, 'late'));
            setKanbanColumn('missing', buckets.missing, renderLimit, d => renderKanbanStepCard(d, 'missing'));
            setKanbanColumn('pending', buckets.pending, renderLimit, d => renderKanbanStepCard(d, 'pending'));
            setKanbanColumn('done', buckets.done, renderLimit, d => renderKanbanStepCard(d, 'done'));
        }
        const summary = document.getElementById('kbSummary');
        if (summary) {
            const pqCount = viewMode === 'pq' ? (buckets.late.length + buckets.missing.length + buckets.pending.length + buckets.done.length) : new Set((filteredData || []).map(d => d.pq)).size;
            const critical = buckets.late.length + buckets.missing.length;
            summary.innerHTML = `<div class="kanban-summary-card"><strong>${pqCount}</strong><span>${viewMode === 'pq' ? 'PQ kartı' : 'Etkilenen PQ'}</span></div><div class="kanban-summary-card"><strong>${buckets.late.length}</strong><span>Gecikmiş</span></div><div class="kanban-summary-card"><strong>${buckets.missing.length}</strong><span>Tarih riski</span></div><div class="kanban-summary-card"><strong>${critical}</strong><span>Kritik takip</span></div><div class="kanban-summary-card"><strong>${buckets.done.length}</strong><span>Tamamlanan</span></div>`;
        }
    }
    function updateWarnings(filteredData, analyticsModel = null) {
        const upcoming = getUpcomingTasks(filteredData, analyticsModel);
        const lst = document.getElementById('warningList');
        if (!lst) return;
        if (upcoming.length === 0) {
            lst.className = '';
            lst.innerHTML = `<div style="padding: 30px; text-align: center; color: var(--muted); font-size:14px;">Önümüzdeki 30 gün içinde yaklaşan bir eylem bulunmamaktadır.</div>`;
            return;
        }
        const genCard = d => {
            const classification = getCommonActionClassification(d);
            const remaining = classification.daysRemaining === null ? 0 : classification.daysRemaining;
            return `<div class="warning-item" onclick="switchTab('list'); window.togglePQ('${d.pq.replace(/\./g, '-')}');"><div><span class="badge badge-extra" style="margin-bottom: 6px; padding: 2px 8px; font-size: 10px;">${(pqMasterData[d.pq]||{}).alan||'N/A'}</span><br><b style="color:var(--text); font-size:14px;">PQ ${d.pq}</b> <span style="color:var(--primary); font-size:11px; font-weight:bold; margin-left:4px; background:rgba(37,99,235,0.1); padding:2px 6px; border-radius:4px;">Adım ${d.step}</span><br><span style="color:var(--muted); font-size:11px; display:inline-block; margin-top:4px;">${escapeHtml(d.office || '-')}</span></div><div style="text-align:right;"><span class="days-left">${remaining} gün kaldı</span><br><span style="color:var(--muted); font-size:11px;">${escapeHtml(d.estDate || '-')}</span></div></div>`;
        };
        const viewMode = getTaskViewMode('upcoming');
        if (viewMode === 'list') {
            lst.className = 'warning-grid';
            lst.innerHTML = upcoming.map(genCard).join('');
        } else {
            lst.className = '';
            let html = '';
            const grouped = groupTasksByArea(upcoming);
            Object.keys(grouped).sort(sortAreas).forEach(area => {
                html += `<div style="margin-bottom:15px; background:var(--card); padding:15px; border-radius:8px; border:1px solid var(--border);"><h5 style="margin:0 0 10px 0; color:var(--text); border-bottom:1px dashed var(--border); padding-bottom:8px; font-size:14px;">📋 ${area} Denetim Alanı <span style="color:var(--muted); font-weight:normal; font-size:12px;">(${grouped[area].length} Eylem)</span></h5><div class="warning-grid">${grouped[area].map(genCard).join('')}</div></div>`;
            });
            lst.innerHTML = html;
        }
    }
    function getUpcomingTasks(filteredData, analyticsModel = null) {
        const tracking = buildCommonTaskTrackingModel(filteredData || [], { upcomingDays: 30 }, analyticsModel);
        return tracking.upcoming
            .slice()
            .sort((a, b) => commonTaskRowSort(a, b, 'upcoming'))
            .map(item => item.row);
    }
    function getPastTasks(filteredData, rangeDays = null, analyticsModel = null) {
        const tracking = buildCommonTaskTrackingModel(filteredData || [], { upcomingDays: 30 }, analyticsModel);
        const today = todayMidnight();
        let minDate = null;
        if (rangeDays && Number(rangeDays) > 0) {
            minDate = new Date(today);
            minDate.setDate(today.getDate() - Number(rangeDays));
            minDate.setHours(0, 0, 0, 0);
        }
        return tracking.late
            .filter(item => !minDate || (item.targetDate && item.targetDate >= minDate))
            .sort((a, b) => commonTaskRowSort(a, b, 'past'))
            .map(item => item.row);
    }
    function taskCardHtml(d, mode) {
        const classification = getCommonActionClassification(d);
        const m = pqMasterData[d.pq] || {};
        const isPast = mode === 'past';
        const diffDays = isPast ? classification.delayDays : (classification.daysRemaining === null ? 0 : classification.daysRemaining);
        const color = isPast ? 'var(--danger)' : 'var(--warn)';
        const label = isPast ? `${diffDays} gün gecikti` : `${diffDays} gün kaldı`;
        const cls = isPast ? 'task-card-critical' : 'task-card-upcoming';
        return `<div class="warning-item ${cls}" onclick="switchTab('list'); window.togglePQ('${d.pq.replace(/\./g, '-')}');">
            <div>
                <span class="badge badge-extra" style="margin-bottom: 6px; padding: 2px 8px; font-size: 10px;">${m.alan || 'N/A'}</span><br>
                <b style="color:var(--text); font-size:14px;">PQ ${d.pq}</b>
                <span style="color:var(--primary); font-size:11px; font-weight:bold; margin-left:4px; background:rgba(37,99,235,0.1); padding:2px 6px; border-radius:4px;">Adım ${d.step}</span><br>
                <span style="color:var(--muted); font-size:11px; display:inline-block; margin-top:4px;">${escapeHtml(d.office || '-')}</span>
            </div>
            <div style="text-align:right; min-width:90px;">
                <span class="days-left" style="color:${color};">${label}</span><br>
                <span style="color:var(--muted); font-size:11px;">${escapeHtml(d.estDate || '-')}</span>
            </div>
        </div>`;
    }
    function renderTaskGroupHtml(tasks, mode) {
        let grouped = {};
        tasks.forEach(d => {
            let area = (pqMasterData[d.pq] || {}).alan ? pqMasterData[d.pq].alan.trim().toUpperCase() : 'N/A';
            if (!grouped[area]) grouped[area] = [];
            grouped[area].push(d);
        });
        let html = "";
        Object.keys(grouped).sort(sortAreas).forEach(area => {
            html += `<div style="margin-bottom:15px; background:var(--card); padding:15px; border-radius:8px; border:1px solid var(--border);"><h5 style="margin:0 0 10px 0; color:var(--text); border-bottom:1px dashed var(--border); padding-bottom:8px; font-size:14px;">📋 ${area} Denetim Alanı <span style="color:var(--muted); font-weight:normal; font-size:12px;">(${grouped[area].length} Eylem)</span></h5><div class="warning-grid">` + grouped[area].map(d => taskCardHtml(d, mode)).join('') + `</div></div>`;
        });
        return html;
    }


    function getSelectedRadioValue(name, fallback = 'list') {
        const el = document.querySelector(`input[name="${name}"]:checked`);
        return el ? el.value : fallback;
    }

    function getTaskViewMode(mode) {
        if (mode === 'past') return getSelectedRadioValue('pastView', 'list');
        if (mode === 'upcoming') return getSelectedRadioValue('warnView', 'list');
        return 'list';
    }

    function getPastRangeDaysFromSelect() {
        let rangeVal = (document.getElementById('pastRangeSelect') || {}).value || 'all';
        return rangeVal === 'all' ? null : parseInt(rangeVal, 10);
    }

    function getPastRangeLabel() {
        let rangeVal = (document.getElementById('pastRangeSelect') || {}).value || 'all';
        if (rangeVal === '30') return 'Son 30 gün';
        if (rangeVal === '90') return 'Son 90 gün';
        if (rangeVal === '180') return 'Son 180 gün';
        return 'Tüm geçmiş dönem';
    }

    function getTaskViewLabel(mode, viewMode) {
        let base = mode === 'past' ? 'Geçmiş Görevler' : 'Yaklaşan Görevler';
        let view = viewMode === 'group' ? 'Alana göre gruplu görünüm' : 'Tarihe göre liste görünümü';
        return `${base} - ${view}`;
    }

    function groupTasksByArea(tasks) {
        let grouped = {};
        (tasks || []).forEach(d => {
            let area = (pqMasterData[d.pq] || {}).alan ? pqMasterData[d.pq].alan.trim().toUpperCase() : 'N/A';
            if (!grouped[area]) grouped[area] = [];
            grouped[area].push(d);
        });
        Object.keys(grouped).forEach(area => grouped[area].sort((a,b) => {
            let dtA = parseDateObj(a.estDate), dtB = parseDateObj(b.estDate);
            if (dtA && dtB && dtA.getTime() !== dtB.getTime()) return dtA - dtB;
            return sortPQs(a.pq, b.pq) || String(a.step || '').localeCompare(String(b.step || ''), 'tr');
        }));
        return grouped;
    }

    function taskDayDeltaText(d, mode) {
        const classification = getCommonActionClassification(d);
        if (!classification.targetDate) return '-';
        if (mode === 'past') return `${classification.delayDays} gün gecikmiş`;
        if (mode === 'upcoming') return `${classification.daysRemaining === null ? 0 : classification.daysRemaining} gün kaldı`;
        return `${classification.daysRemaining === null ? 0 : classification.daysRemaining} gün`;
    }
    function buildTaskAreaSummaryRows(tasks, mode) {
        const grouped = groupTasksByArea(tasks);
        return Object.keys(grouped).sort(sortAreas).map(area => {
            const rows = grouped[area];
            const pqs = new Set(rows.map(d => d.pq));
            const dayVals = rows.map(d => {
                const classification = getCommonActionClassification(d);
                return mode === 'past' ? classification.delayDays : classification.daysRemaining;
            }).filter(v => v !== null && Number.isFinite(v));
            return {
                'Denetim Alanı': area,
                'Eylem Sayısı': rows.length,
                'Etkilenen PQ': pqs.size,
                [mode === 'past' ? 'En Yüksek Gecikme Günü' : 'En Yakın Kalan Gün']: dayVals.length ? (mode === 'past' ? Math.max(...dayVals) : Math.min(...dayVals)) : '',
                [mode === 'past' ? 'Ortalama Gecikme Günü' : 'Ortalama Kalan Gün']: dayVals.length ? Math.round(dayVals.reduce((a,b) => a + b, 0) / dayVals.length) : '',
                'İlk Hedef Tarih': rows[0] ? rows[0].estDate : ''
            };
        });
    }
    function buildTaskGroupedExportRows(tasks, mode) {
        const grouped = groupTasksByArea(tasks);
        let out = [];
        Object.keys(grouped).sort(sortAreas).forEach(area => {
            grouped[area].forEach((d, idx) => {
                out.push(Object.assign({
                    'Alan Grubu': area,
                    'Alan İçindeki Sıra': idx + 1,
                    'Görünüm': 'Alana göre gruplu'
                }, buildActionExportRow(d, { mode, longText: true })));
            });
        });
        return out;
    }

    function addTaskExportSheets(wb, ctx, detailRows) {
        const baseName = ctx.mode === 'past' ? 'Gecmis_Gorevler' : 'Yaklasan_Gorevler';
        const modeLabel = ctx.viewMode === 'group' ? 'Alana göre gruplu' : 'Tarihe göre liste';
        addJsonSheet(wb, 'Gorev_Rapor_Baglamı', [{
            'Rapor': ctx.title,
            'Ekran Görünümü': modeLabel,
            'Zaman Kapsamı': ctx.rangeLabel || (ctx.mode === 'upcoming' ? 'Önümüzdeki 30 gün' : ''),
            'Kayıt Sayısı': (ctx.rows || []).length,
            'Rapor Tarihi': formatLongTurkishDate(new Date())
        }]);
        if (ctx.viewMode === 'group') {
            addJsonSheet(wb, `${baseName}_Alana_Gore`, buildTaskGroupedExportRows(ctx.rows, ctx.mode));
            addJsonSheet(wb, `${baseName}_Liste`, detailRows);
        } else {
            addJsonSheet(wb, 'Liste', detailRows);
            addJsonSheet(wb, `${baseName}_Alana_Gore`, buildTaskGroupedExportRows(ctx.rows, ctx.mode));
        }
        addJsonSheet(wb, `${baseName}_Alan_Ozeti`, buildTaskAreaSummaryRows(ctx.rows, ctx.mode));
    }

    function buildPdfGroupedTaskContent(ctx) {
        const grouped = groupTasksByArea(ctx.rows || []);
        const blocks = [];
        Object.keys(grouped).sort(sortAreas).forEach(area => {
            const rows = grouped[area];
            const body = [[
                {text:'PQ', style:'th'}, {text:'Adım', style:'th'}, {text:'Eylem', style:'th'},
                {text:'Sorumlu', style:'th'}, {text:'Hedef', style:'th'}, {text:ctx.mode === 'past' ? 'Gecikme' : 'Kalan', style:'th'}
            ]];
            rows.forEach(d => body.push([
                {text:d.pq || '', fontSize:9},
                {text:String(d.step || ''), fontSize:9},
                {text:fullTextForPdf(d.action || '-'), fontSize:8},
                {text:d.office || '-', fontSize:8},
                {text:d.estDate || '-', fontSize:9},
                {text:taskDayDeltaText(d, ctx.mode), fontSize:9, bold:true, color:ctx.mode === 'past' ? '#ef4444' : '#f59e0b'}
            ]));
            blocks.push({text:`${area} Denetim Alanı (${rows.length} eylem / ${new Set(rows.map(d => d.pq)).size} PQ)`, fontSize:11, bold:true, color:'#0f172a', margin:[0,8,0,4]});
            blocks.push({table:{headerRows:1, widths:['auto','auto','*','auto','auto','auto'], body}, layout:'lightHorizontalLines', margin:[0,0,0,8]});
        });
        return blocks.length ? blocks : [{text:'Kayıt bulunamadı.', italics:true, color:'#64748b'}];
    }

    function updatePastTasks(filteredData, analyticsModel = null) {
        const listEl = document.getElementById('pastTasksList');
        const summaryEl = document.getElementById('pastTasksSummary');
        if (!listEl || !summaryEl) return;
        const rangeDays = getPastRangeDaysFromSelect();
        const past = getPastTasks(filteredData, rangeDays, analyticsModel);
        if (past.length === 0) {
            summaryEl.innerHTML = '';
            listEl.className = '';
            listEl.innerHTML = `<div style="padding: 30px; text-align: center; color: var(--muted); font-size:14px;">Seçilen kapsama göre tarihi geçmiş açık eylem bulunmamaktadır.</div>`;
            return;
        }
        const pqCount = new Set(past.map(d => d.pq)).size;
        const classifications = past.map(d => getCommonActionClassification(d));
        const delays = classifications.map(c => c.delayDays).filter(Number.isFinite);
        const maxDelay = delays.length ? Math.max(...delays) : 0;
        const avgDelay = delays.length ? Math.round(delays.reduce((a,b) => a+b, 0) / delays.length) : 0;
        const oldestItem = past.slice().sort((a,b) => commonTaskRowSort({row:a, classification:getCommonActionClassification(a)}, {row:b, classification:getCommonActionClassification(b)}, 'upcoming'))[0];
        const oldest = oldestItem && oldestItem.estDate ? oldestItem.estDate : '-';
        summaryEl.innerHTML = `<div class="past-summary-grid">
            <div class="past-summary-card"><b>${past.length}</b><span>Gecikmiş eylem</span></div>
            <div class="past-summary-card"><b>${pqCount}</b><span>Etkilenen PQ</span></div>
            <div class="past-summary-card"><b>${maxDelay}</b><span>En yüksek gecikme günü</span></div>
            <div class="past-summary-card"><b>${avgDelay}</b><span>Ortalama gecikme günü</span></div>
            <div class="past-summary-card"><b style="font-size:15px; margin-top:3px;">${oldest}</b><span>En eski hedef tarih</span></div>
        </div>`;
        const viewMode = getTaskViewMode('past');
        if (viewMode === 'group') {
            listEl.className = '';
            listEl.innerHTML = renderTaskGroupHtml(past, 'past');
        } else {
            listEl.className = 'warning-grid';
            listEl.innerHTML = past.map(d => taskCardHtml(d, 'past')).join('');
        }
    }
    window.runTaskTrackingCommonEngineSelfCheck = function() {
        const rows = getFilteredData();
        const common = buildCommonCalculationModel(rows, { upcomingDays: 30 });
        const tracking = buildCommonTaskTrackingModel(rows, { upcomingDays: 30 }, common);
        const classifiedTotal = tracking.completed.length + tracking.late.length + tracking.upcoming.length + tracking.pending.length + tracking.dateRisk.length;
        const kanbanBuckets = { done: 0, late: 0, pending: 0, missing: 0 };
        rows.forEach(row => {
            const st = getKanbanActionStatus(row);
            if (kanbanBuckets[st.type] !== undefined) kanbanBuckets[st.type]++;
        });
        const expectedPending = tracking.upcoming.length + tracking.pending.length;
        const result = {
            passed: classifiedTotal === tracking.actionItems.length
                && kanbanBuckets.done === tracking.completed.length
                && kanbanBuckets.late === tracking.late.length
                && kanbanBuckets.missing === tracking.dateRisk.length
                && kanbanBuckets.pending === expectedPending,
            actionItems: tracking.actionItems.length,
            classifiedTotal,
            common: {
                completed: tracking.completed.length,
                late: tracking.late.length,
                upcoming: tracking.upcoming.length,
                pending: tracking.pending.length,
                dateRisk: tracking.dateRisk.length
            },
            kanbanBuckets
        };
        console.table(result.common);
        console.log('Task tracking common engine self-check:', result);
        return result;
    };

    function normalizeAreaKey(val) { return (val || "").toString().trim().toUpperCase(); }
    function pctText(value) { return `%${(isFinite(value) ? value : 0).toFixed(2)}`; }
    function ratioPct(done, total) { return total > 0 ? (done / total) * 100 : 0; }
    function getExplicitAfterValidationSatValue(val) {
        if (val === undefined || val === null || val === '') return null;
        let n = Number(val);
        return isFinite(n) ? n : null;
    }
    function getBaseAfterValidationSat(baseRecord) {
        let b = baseRecord || {};
        let candidates = [b.afterSat, b.afterValidationSat, b.afterValidation, b.validasyonSonrasiSat, b.postValidationSat];
        for (let c of candidates) {
            let n = getExplicitAfterValidationSatValue(c);
            if (n !== null) return n;
        }
        return null;
    }
    function getBucketAfterValidationSat(bucket) {
        if (!bucket) return 0;
        let base = bucket.baseSatOnly || 0;
        let explicit = getExplicitAfterValidationSatValue(bucket.afterValidationSat);
        let sat = explicit !== null && explicit >= base ? explicit : base + (bucket.icaoClosed || 0);
        return Math.max(0, Math.min(bucket.total || sat, sat));
    }
    function getBucketValidationDelta(bucket) { return Math.max(0, getBucketAfterValidationSat(bucket) - ((bucket && bucket.baseSatOnly) || 0)); }
    function getBucketOfficialFindings(bucket) { return Math.max(0, ((bucket && bucket.total) || 0) - getBucketAfterValidationSat(bucket)); }
    function getBucketCurrentSat(bucket) { return getBucketAfterValidationSat(bucket) + ((bucket && bucket.localCompleted) || 0); }
    function getBucketProjectedSat(bucket) { return getBucketCurrentSat(bucket) + ((bucket && bucket.projected) || 0); }
    function getBucketMaxPct(bucket) { return ratioPct(getBucketProjectedSat(bucket), bucket.total); }
    function todayMidnight() { let t = new Date(); t.setHours(0,0,0,0); return t; }

    function escapeHtml(str) {
        return (str === undefined || str === null ? '' : str.toString()).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    }

    function hasExplicitValidationTask(val) {
        let s = (val === undefined || val === null ? '' : val.toString()).trim();
        if (!s) return false;
        let n = s.toLocaleUpperCase('tr-TR');
        return !(n === 'BELİRTİLMEDİ' || n === 'BELIRTILMEDI' || n === '-' || n === 'YOK' || n === 'N/A');
    }

    function normalizeValidationTaskName(val, fallbackForClosed = false) {
        let s = (val === undefined || val === null ? '' : val.toString()).trim();
        if (hasExplicitValidationTask(s)) return s;
        return fallbackForClosed ? 'Validasyon Görevi Belirtilmedi' : '';
    }

    function addValidationTaskToModel(model, task) {
        if (!model || !task) return;
        if (!model.validationTaskSet.has(task)) {
            model.validationTaskSet.add(task);
            model.validationTasks.push(task);
        }
    }

    function addValidationClosureToBucket(bucket, task, pq) {
        if (!bucket || !task) return;
        bucket.validationCounts[task] = (bucket.validationCounts[task] || 0) + 1;
        if (!bucket.validationPQs[task]) bucket.validationPQs[task] = [];
        bucket.validationPQs[task].push(pq);
    }

    function getBucketValidationCount(bucket, task) {
        if (!bucket || !task || !bucket.validationCounts) return 0;
        return bucket.validationCounts[task] || 0;
    }

    function getBucketSatAfterValidation(bucket, validationTasks, uptoIndex) {
        if (!bucket) return 0;
        let sat = bucket.baseSatOnly;
        (validationTasks || []).slice(0, uptoIndex + 1).forEach(task => { sat += getBucketValidationCount(bucket, task); });
        return sat;
    }

    function validationTaskHeaderHtml(task) {
        let safe = escapeHtml(task);
        return `<th title="${safe}" style="min-width:120px;"><span style="display:block; font-size:9px; color:var(--icao-blue); letter-spacing:0.3px; margin-bottom:2px;">ICAO VALIDASYONU</span>${safe}</th>`;
    }

    function renderMilestoneHeader(validationTasks) {
        let row = document.getElementById('milestoneHeaderRow');
        if (!row) return;
        let tasks = validationTasks || [];
        let validationHeaders = tasks.length > 0 ? tasks.map(validationTaskHeaderHtml).join('') : '<th>ICAO Validasyonu</th>';
        row.innerHTML = `<th style="text-align: left; width: 18%;">Denetim Alanı / Kapsam</th><th>CMAA (Başlangıç)</th>${validationHeaders}<th>Mevcut EI</th><th>%60 Hedefi</th><th>%70 Hedefi</th><th>%80 Hedefi</th><th>%90 Hedefi</th><th>%100 Hedefi</th>`;
        let table = document.getElementById('milestoneTable');
        if (table) table.style.minWidth = `${1120 + Math.max(0, tasks.length - 1) * 135}px`;
    }

    function validationMilestoneCellHtml(bucket, validationTasks, idx) {
        let task = validationTasks[idx];
        let added = getBucketValidationCount(bucket, task);
        let sat = getBucketSatAfterValidation(bucket, validationTasks, idx);
        let pct = ratioPct(sat, bucket.total);
        let pqPreview = (bucket.validationPQs && bucket.validationPQs[task]) ? bucket.validationPQs[task].slice().sort(sortPQs).slice(0, 5).map(p => `PQ ${p}`).join(', ') : '';
        let more = (bucket.validationPQs && bucket.validationPQs[task] && bucket.validationPQs[task].length > 5) ? ` +${bucket.validationPQs[task].length - 5}` : '';
        let detail = added > 0 ? `+${added} PQ | ${sat}/${bucket.total}` : `0 PQ | ${sat}/${bucket.total}`;
        let title = pqPreview ? ` title="${escapeHtml(pqPreview + more)}"` : '';
        let muted = added > 0 ? '' : ' color:var(--muted); opacity:0.75;';
        return `<td class="${added > 0 ? 'ms-passed' : ''}"${title} style="${muted}"><b>${pctText(pct)}</b><br><span style="font-size:10px; color:var(--muted);">${detail}</span></td>`;
    }

    function validationNoDataCellHtml(bucket) {
        let sat = getBucketAfterValidationSat(bucket);
        let delta = Math.max(0, sat - (bucket.baseSatOnly || 0));
        return `<td style="color:var(--muted); opacity:0.75;"><b>${pctText(ratioPct(sat, bucket.total))}</b><br><span style="font-size:10px;">${delta > 0 ? '+' + delta + ' PQ' : 'Kayıt yok'}</span></td>`;
    }

    function parseUserDateInput(txt) {
        if (!txt) return null;
        let raw = txt.toString().trim();
        let iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
        if (iso) return parseDateObj(`${iso[1]}-${iso[2]}-${iso[3]}`);
        return parseDateObj(raw);
    }

    function createEIBucket(name, total, baseSat, afterValidationSat = null) {
        return {
            name: name,
            total: total || 0,
            baseSatOnly: baseSat || 0,
            afterValidationSat: getExplicitAfterValidationSatValue(afterValidationSat),
            icaoClosed: 0,
            localCompleted: 0,
            projected: 0,
            noCap: 0,
            realizedEvents: [],
            projectedEvents: [],
            undatedLocal: 0,
            undatedProjected: 0,
            validationCounts: {},
            validationPQs: {}
        };
    }

    function isUsableCapStep(item) {
        if (!item || item.isEmptyCap) return false;
        if (item.step === "-") return false;
        let action = (item.action || "").toString().trim();
        if (!action || action.includes("OLF üzerinde CAP")) return false;
        return true;
    }

    function getPQClosureInfo(pq, items) {
        const steps = (items || []).filter(isUsableCapStep);
        if (steps.length === 0) {
            return { pq, hasUsableCap: false, allDone: false, closureDate: null, latestKnownDate: null, missingDates: 0, totalSteps: 0, doneSteps: 0 };
        }
        const classifications = steps.map(step => classifyCommonActionStatus(step));
        const allDone = classifications.every(c => c.code === COMMON_ACTION_STATUS.COMPLETED.code);
        const dated = classifications.map(c => c.targetDate).filter(Boolean);
        const latest = dated.reduce((max, dt) => !max || dt > max ? dt : max, null);
        const missingDates = classifications.length - dated.length;
        const doneSteps = classifications.filter(c => c.code === COMMON_ACTION_STATUS.COMPLETED.code).length;
        return {
            pq,
            hasUsableCap: true,
            allDone,
            closureDate: missingDates === 0 ? latest : null,
            latestKnownDate: latest,
            missingDates,
            totalSteps: steps.length,
            doneSteps
        };
    }

    function groupRowsByPQ(rows) {
        let groups = {};
        (rows || []).forEach(d => { if(!groups[d.pq]) groups[d.pq] = []; groups[d.pq].push(d); });
        return groups;
    }

    function expandFilteredRowsToFullPqGroups(filteredData) {
        if (!filteredData || filteredData.length === 0) return [];
        let selectedPQs = new Set(filteredData.map(d => d.pq));
        return rawData.filter(d => selectedPQs.has(d.pq));
    }

    function addPQToBucket(bucket, field, pq, date) {
        if (!bucket) return;
        bucket[field]++;
        if (field === 'localCompleted') {
            if (date) bucket.realizedEvents.push({ pq, date });
            else bucket.undatedLocal++;
        }
        if (field === 'projected') {
            if (date) bucket.projectedEvents.push({ pq, date });
            else bucket.undatedProjected++;
        }
    }

    function buildEIProjectionModel(sourceRows) {
        let model = { scope: createEIBucket("🌍 TÜRKİYE GENELİ", 0, 0), areas: {}, activeAreas: new Set(), pqInfos: [], validationTasks: [], validationTaskSet: new Set() };

        Object.keys(baseEIData).forEach(area => {
            let b = baseEIData[area] || {};
            let afterSat = getBaseAfterValidationSat(b);
            model.areas[area] = createEIBucket(area, b.total || 0, b.sat || 0, afterSat);
            model.scope.total += b.total || 0;
            model.scope.baseSatOnly += b.sat || 0;
            if (afterSat !== null) {
                if (model.scope.afterValidationSat === null) model.scope.afterValidationSat = 0;
                model.scope.afterValidationSat += afterSat;
            }
        });

        Object.entries(pqMasterData).forEach(([pq, m]) => {
            let area = normalizeAreaKey(m.alan);
            if (!area || !model.areas[area]) return;

            let explicitTask = normalizeValidationTaskName(m.validasyonGorevi, false);
            if (explicitTask) addValidationTaskToModel(model, explicitTask);

            if (m.isIcaoClosed) {
                let task = normalizeValidationTaskName(m.validasyonGorevi, true);
                addValidationTaskToModel(model, task);
                model.areas[area].icaoClosed++;
                model.scope.icaoClosed++;
                addValidationClosureToBucket(model.areas[area], task, pq);
                addValidationClosureToBucket(model.scope, task, pq);
            }
        });

        let groups = groupRowsByPQ(sourceRows || []);
        Object.keys(groups).forEach(pq => {
            let m = pqMasterData[pq] || {};
            if (m.isIcaoClosed) return;

            let area = normalizeAreaKey(m.alan);
            if (!area || !model.areas[area]) return;
            model.activeAreas.add(area);

            let info = getPQClosureInfo(pq, groups[pq]);
            info.area = area;
            model.pqInfos.push(info);

            if (!info.hasUsableCap) {
                model.areas[area].noCap++;
                model.scope.noCap++;
                return;
            }

            if (info.allDone) {
                addPQToBucket(model.areas[area], 'localCompleted', pq, info.closureDate);
                addPQToBucket(model.scope, 'localCompleted', pq, info.closureDate);
            } else {
                addPQToBucket(model.areas[area], 'projected', pq, info.closureDate);
                addPQToBucket(model.scope, 'projected', pq, info.closureDate);
            }
        });

        Object.values(model.areas).forEach(b => {
            b.realizedEvents.sort((a,b) => a.date - b.date || sortPQs(a.pq, b.pq));
            b.projectedEvents.sort((a,b) => a.date - b.date || sortPQs(a.pq, b.pq));
        });
        model.scope.realizedEvents.sort((a,b) => a.date - b.date || sortPQs(a.pq, b.pq));
        model.scope.projectedEvents.sort((a,b) => a.date - b.date || sortPQs(a.pq, b.pq));
        return model;
    }

    function resolveMilestone(bucket, targetPct, validationTasks = []) {
        if (!bucket || bucket.total <= 0) return { status: 'unreachable', html: 'Veri yok' };
        let reqSat = Math.ceil((targetPct / 100) * bucket.total);
        let currentSat = getBucketCurrentSat(bucket);
        let maxSat = getBucketProjectedSat(bucket);

        let c = bucket.baseSatOnly;
        if (c >= reqSat) return { status: 'base', html: `CMAA'da geçildi<br><span style="font-size:10px;">${c}/${bucket.total}</span>` };

        let countedIcao = 0;
        (validationTasks || []).forEach(task => {
            if (c >= reqSat) return;
            let inc = getBucketValidationCount(bucket, task);
            countedIcao += inc;
            c += inc;
            if (c >= reqSat) {
                return;
            }
        });
        if (c >= reqSat) {
            let crossingTask = null;
            let tmp = bucket.baseSatOnly;
            for (let task of (validationTasks || [])) {
                tmp += getBucketValidationCount(bucket, task);
                if (tmp >= reqSat) { crossingTask = task; break; }
            }
            return { status: 'current', html: `${escapeHtml(crossingTask || 'ICAO Validasyonu')}<br><span style="font-size:10px;">ICAO onayı</span>` };
        }

        let officialAfterValidationSat = getBucketAfterValidationSat(bucket);
        if (officialAfterValidationSat > c) c = officialAfterValidationSat;
        if (c >= reqSat) return { status: 'current', html: `Mevcut<br><span style="font-size:10px;">ICAO validasyonu dahil</span>` };

        for (let e of bucket.realizedEvents) {
            c++;
            if (c >= reqSat) return { status: 'passed', html: `Tamamlandı<br><span style="font-size:11px;">${formatExactDate(e.date)}</span>` };
        }

        c += bucket.undatedLocal;
        if (c >= reqSat || currentSat >= reqSat) return { status: 'current-unknown', html: `Mevcut<br><span style="font-size:10px;">tarih eksik</span>` };

        for (let e of bucket.projectedEvents) {
            c++;
            if (c >= reqSat) return { status: 'future', html: `${formatExactDate(e.date)}<br><span style="font-size:10px;">PQ ${e.pq}</span>` };
        }

        c += bucket.undatedProjected;
        if (c >= reqSat || maxSat >= reqSat) return { status: 'unknown', html: `Tarih belirsiz<br><span style="font-size:10px;">eksik tarihli CAP</span>` };

        return { status: 'unreachable', html: `Ulaşılamıyor<br><span style="font-size:10px;">maks. ${pctText(ratioPct(maxSat, bucket.total))}</span>` };
    }

    function milestoneCellHtml(bucket, targetPct, validationTasks = []) {
        let r = resolveMilestone(bucket, targetPct, validationTasks);
        if (r.status === 'future') return `<td class="ms-future">${r.html}</td>`;
        if (r.status === 'unreachable' || r.status === 'unknown') return `<td class="ms-unreachable">${r.html}</td>`;
        return `<td class="ms-passed">${r.html}</td>`;
    }

    function refreshSimulatorAreaSelects() {
        ['simAreaSelect', 'dateSimAreaSelect'].forEach(id => {
            let el = document.getElementById(id);
            if (!el) return;
            let previous = el.value;
            el.innerHTML = `<option value="GLOBAL">🌍 TÜRKİYE GENELİ</option>`;
            Object.keys(baseEIData).sort(sortAreas).forEach(a => { el.innerHTML += `<option value="${a}">${a} Alanı</option>`; });
            if (previous && Array.from(el.options).some(o => o.value === previous)) el.value = previous;
        });
    }

    function getBucketForArea(model, area) {
        if (!model) return null;
        if (area === 'GLOBAL') return model.scope;
        return model.areas[area] || null;
    }


    function getIcaoOfficialEiData() {
        if (typeof window.getManagedIcaoOfficialEiChartConfig === 'function') {
            return window.getManagedIcaoOfficialEiChartConfig();
        }
        return null;
    }

    function officialEiChartNumber(value) {
        if (value === null || value === undefined || value === '') return null;
        const parsed = Number(String(value).replace(',', '.'));
        return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : null;
    }

    function setIcaoOfficialChartEmptyState(message) {
        const empty = document.getElementById('icaoOfficialChartEmptyState');
        const wrap = document.getElementById('icaoOfficialChartCanvasWrap');
        if (empty) {
            empty.innerHTML = message;
            empty.style.display = 'flex';
        }
        if (wrap) wrap.style.display = 'none';
        if (charts.icaoOfficial) {
            charts.icaoOfficial.destroy();
            charts.icaoOfficial = null;
        }
    }

    function formatOfficialEiPct(value) {
        const n = officialEiChartNumber(value);
        return n === null ? '-' : '%' + n.toLocaleString('tr-TR', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    }

    function formatOfficialEiDelta(value) {
        const n = officialEiChartNumber(value);
        if (n === null) return '-';
        const sign = n > 0 ? '+' : '';
        return sign + n.toLocaleString('tr-TR', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + ' puan';
    }

    function formatOfficialEiCardDate(value) {
        if (!value) return 'Tarih belirtilmedi';
        const date = new Date(String(value).length === 10 ? String(value) + 'T00:00:00' : value);
        return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('tr-TR', {day: '2-digit', month: 'long', year: 'numeric'});
    }

    function renderIcaoOfficialOverallCards(config) {
        const grid = document.getElementById('icaoOfficialOverallCards');
        const hint = document.getElementById('icaoOfficialOverallCardsHint');
        if (!grid) return;
        const records = (config && Array.isArray(config.records)) ? config.records : [];
        if (!records.length) {
            grid.innerHTML = '<div style="grid-column:1/-1;padding:14px;border:1px dashed var(--border);border-radius:10px;color:var(--muted);font-size:12px;text-align:center;">Overall EI kartları için aktif ve seçili bir resmî değerlendirme bulunmuyor.</div>';
            if (hint) hint.textContent = 'Veri Yönetimi bölümündeki aktif kayıtlar kullanılır';
            return;
        }

        const reference = records.find(r => r.id === config.referenceId) || records[0];
        const latest = records[records.length - 1];
        const referenceValue = officialEiChartNumber(reference && reference.overallEI);
        const latestValue = officialEiChartNumber(latest && latest.overallEI);
        const delta = referenceValue === null || latestValue === null ? null : Math.round((latestValue - referenceValue) * 100) / 100;
        const palette = ['#4f97cf', '#284b9b', '#10b981', '#f59e0b'];

        const periodCards = records.map((record, index) => {
            const value = officialEiChartNumber(record.overallEI);
            const badges = [];
            if (record.id === reference.id) badges.push('<span style="font-size:10px;font-weight:700;color:var(--primary);background:rgba(37,99,235,0.10);padding:3px 7px;border-radius:999px;">Referans</span>');
            if (record.id === latest.id && records.length > 1) badges.push('<span style="font-size:10px;font-weight:700;color:var(--ok);background:rgba(16,185,129,0.10);padding:3px 7px;border-radius:999px;">Son seçili dönem</span>');
            return `<div style="border:1px solid var(--border);border-left:4px solid ${palette[index % palette.length]};border-radius:10px;padding:13px 14px;background:var(--card);min-width:0;">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:8px;">
                    <div style="font-size:12px;font-weight:700;color:var(--text);overflow-wrap:anywhere;">${escapeHtml(record.label || record.name || `Dönem ${index + 1}`)}</div>
                    <div style="display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end;">${badges.join('')}</div>
                </div>
                <div style="font-size:27px;line-height:1;font-weight:800;color:var(--text);">${formatOfficialEiPct(value)}</div>
                <div style="font-size:11px;color:var(--muted);margin-top:8px;">${escapeHtml(formatOfficialEiCardDate(record.assessmentDate))}</div>
            </div>`;
        }).join('');

        const deltaColor = delta === null || delta === 0 ? 'var(--muted)' : delta > 0 ? 'var(--ok)' : 'var(--danger)';
        const deltaBg = delta === null || delta === 0 ? 'rgba(148,163,184,0.08)' : delta > 0 ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)';
        const comparisonCard = `<div style="border:1px solid var(--border);border-left:4px solid ${deltaColor};border-radius:10px;padding:13px 14px;background:${deltaBg};min-width:0;">
            <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:8px;">Referansa Göre Overall Değişim</div>
            <div style="font-size:27px;line-height:1;font-weight:800;color:${deltaColor};">${formatOfficialEiDelta(delta)}</div>
            <div style="font-size:11px;color:var(--muted);margin-top:8px;overflow-wrap:anywhere;">${escapeHtml(latest.label || latest.name || 'Son dönem')} − ${escapeHtml(reference.label || reference.name || 'Referans dönem')}</div>
        </div>`;

        grid.innerHTML = periodCards + comparisonCard;
        if (hint) hint.textContent = `${records.length} seçili dönem • Değişim referans döneme göre hesaplanır`;
    }

    function renderIcaoOfficialChangeSummary(config) {
        const el = document.getElementById('icaoOfficialChangeSummary');
        if (!el) return;
        const records = (config && config.records) || [];
        const categories = (config && config.areas) || [];
        const referenceId = config && config.referenceId;
        const reference = records.find(r => r.id === referenceId) || records[0];
        if (!reference || records.length < 2) {
            el.innerHTML = '<div style="font-size:12px;color:var(--muted);padding:10px 12px;border:1px dashed var(--border);border-radius:8px;">Değişim hesabı için en az iki dönem seçilmelidir.</div>';
            return;
        }
        const comparisons = records.filter(r => r.id !== reference.id);
        const header = comparisons.map(r => `<th style="min-width:145px;">${escapeHtml(r.label || r.name || 'Dönem')}</th>`).join('');
        const rows = categories.map(cat => {
            const refValue = officialEiChartNumber((cat.values || {})[reference.id]);
            const cells = comparisons.map(r => {
                const current = officialEiChartNumber((cat.values || {})[r.id]);
                const delta = current === null || refValue === null ? null : Math.round((current - refValue) * 100) / 100;
                const deltaColor = delta === null || delta === 0 ? 'var(--muted)' : delta > 0 ? 'var(--ok)' : 'var(--danger)';
                return `<td style="text-align:center;"><b>${formatOfficialEiPct(current)}</b><br><span style="font-size:11px;color:${deltaColor};font-weight:700;">${formatOfficialEiDelta(delta)}</span></td>`;
            }).join('');
            return `<tr><td style="font-weight:700;">${escapeHtml(cat.area)}</td><td style="text-align:center;background:rgba(37,99,235,0.05);"><b>${formatOfficialEiPct(refValue)}</b><br><span style="font-size:10px;color:var(--muted);">Referans</span></td>${cells}</tr>`;
        }).join('');
        el.innerHTML = `<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:8px;"><h4 style="margin:0;color:var(--text);">Dönemler Arası EI Değişimi</h4><span style="font-size:11px;color:var(--muted);">Referans: <b>${escapeHtml(reference.label || reference.name || 'Dönem')}</b></span></div><div style="overflow-x:auto;border:1px solid var(--border);border-radius:9px;"><table style="width:100%;border-collapse:collapse;font-size:12px;"><thead><tr><th style="text-align:left;min-width:85px;">Alan</th><th style="min-width:145px;background:rgba(37,99,235,0.05);">${escapeHtml(reference.label || reference.name || 'Referans')}</th>${header}</tr></thead><tbody>${rows}</tbody></table></div>`;
    }

    function renderIcaoOfficialChart() {
        const canvas = document.getElementById('icaoOfficialChartCanvas');
        if (!canvas || typeof Chart === 'undefined') return;

        if (typeof window.renderIcaoOfficialPeriodControls === 'function') window.renderIcaoOfficialPeriodControls();
        const config = getIcaoOfficialEiData();
        const isLoaded = window.icaoOfficialEiManagementLoaded === true;
        const summary = document.getElementById('icaoOfficialSelectedPeriodSummary');
        if (!config || !Array.isArray(config.areas) || !config.areas.length || !Array.isArray(config.records) || !config.records.length) {
            if (summary) summary.textContent = isLoaded ? 'Aktif/seçili dönem bulunmuyor' : 'Yükleniyor...';
            const message = isLoaded
                ? '<div><b>Grafik için seçilmiş aktif resmî EI dönemi bulunmuyor.</b><br><span style="font-size:12px;">Veri Yönetimi → ICAO Resmî EI Verileri bölümünden kayıt oluşturup aktif hale getir veya yukarıdaki dönem seçimlerini kullan.</span></div>'
                : '<div><b>ICAO resmî EI kayıtları Firebase’den yükleniyor...</b></div>';
            setIcaoOfficialChartEmptyState(message);
            renderIcaoOfficialOverallCards(null);
            renderIcaoOfficialChangeSummary(null);
            return;
        }

        const records = config.records;
        const rows = config.areas.filter(r => r && r.area).map(r => ({
            area: String(r.area),
            values: Object.fromEntries(records.map(record => [record.id, officialEiChartNumber((r.values || {})[record.id])]))
        }));
        if (summary) summary.textContent = records.map(r => r.label || r.name || 'Dönem').join(' • ');

        const empty = document.getElementById('icaoOfficialChartEmptyState');
        const wrap = document.getElementById('icaoOfficialChartCanvasWrap');
        if (empty) empty.style.display = 'none';
        if (wrap) wrap.style.display = 'block';

        const palette = [
            {backgroundColor:'#4f97cf', borderColor:'#4f97cf'},
            {backgroundColor:'#284b9b', borderColor:'#284b9b'},
            {backgroundColor:'#10b981', borderColor:'#10b981'},
            {backgroundColor:'#f59e0b', borderColor:'#f59e0b'}
        ];
        const datasets = records.map((record, index) => ({
            label: record.label || record.name || `Dönem ${index + 1}`,
            data: rows.map(r => r.values[record.id]),
            backgroundColor: palette[index % palette.length].backgroundColor,
            borderColor: palette[index % palette.length].borderColor,
            borderWidth: 1,
            barPercentage: records.length >= 4 ? 0.84 : 0.76,
            categoryPercentage: records.length >= 4 ? 0.86 : 0.72,
            officialRecordId: record.id
        }));

        const ctx = canvas.getContext('2d');
        if (charts.icaoOfficial) charts.icaoOfficial.destroy();
        charts.icaoOfficial = new Chart(ctx, {
            type: 'bar',
            plugins: [chartBarValuePlugin],
            data: { labels: rows.map(r => r.area), datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: { padding: { top: records.length >= 3 ? 34 : 28, right: 10 } },
                plugins: {
                    legend: { position: 'bottom', labels: { boxWidth: 14, boxHeight: 14, usePointStyle: false } },
                    title: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => {
                                const value = officialEiChartNumber(ctx.raw);
                                return value === null ? `${ctx.dataset.label}: Veri yok` : `${ctx.dataset.label}: %${value.toLocaleString('tr-TR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
                            },
                            afterLabel: (ctx) => {
                                const referenceId = config.referenceId;
                                if (!referenceId || ctx.dataset.officialRecordId === referenceId) return '';
                                const category = rows[ctx.dataIndex];
                                const current = officialEiChartNumber(ctx.raw);
                                const reference = officialEiChartNumber((category.values || {})[referenceId]);
                                if (current === null || reference === null) return 'Referansa göre değişim: Veri yok';
                                const delta = Math.round((current - reference) * 100) / 100;
                                return `Referansa göre değişim: ${formatOfficialEiDelta(delta)}`;
                            }
                        }
                    }
                },
                scales: {
                    x: { grid: { display: false }, ticks: { color: '#334155', font: { weight: '600' } } },
                    y: {
                        min: 0,
                        max: 100,
                        ticks: { callback: (value) => value + '%', color: '#334155' },
                        title: { display: true, text: 'Effective Implementation', color: '#334155', font: { size: 12, weight: '600' } },
                        grid: { color: 'rgba(148, 163, 184, 0.25)' }
                    }
                }
            }
        });
        renderIcaoOfficialOverallCards(config);
        renderIcaoOfficialChangeSummary(config);
    }

    function getDashboardAssessmentRows() {
        if (typeof window.getOfficialAssessmentTimelineWithSnapshots !== 'function') return [];
        try {
            return (window.getOfficialAssessmentTimelineWithSnapshots() || []).filter(row => {
                if (!row || !row.snapshot) return false;
                const overall = typeof window.getAssessmentMetricValue === 'function' ? window.getAssessmentMetricValue(row, 'Overall') : null;
                const hasArea = ['LEG','ORG','PEL','OPS','AIR','AIG','ANS','AGA'].some(a => typeof window.getAssessmentMetricValue === 'function' && window.getAssessmentMetricValue(row, a) !== null);
                return overall !== null || hasArea;
            });
        } catch (e) { return []; }
    }

    function dashboardAssessmentDateLabel(row) {
        const raw = row && (row.assessmentDate || row.endDate || row.startDate);
        if (!raw) return 'Tarih yok';
        const d = new Date(String(raw).length === 10 ? raw + 'T00:00:00' : raw);
        return isNaN(d) ? String(raw) : d.toLocaleDateString('tr-TR', {day:'2-digit', month:'short', year:'numeric'});
    }

    function dashboardAssessmentScopeLabel(row) {
        const scope = Array.isArray(row && row.scopeAreas) ? row.scopeAreas : [];
        if (scope.length >= 8) return 'Tüm alanlar';
        if (scope.length) return scope.join(' + ');
        return 'Kapsam belirtilmedi';
    }

    function renderDashboardAssessmentTimeline(rows) {
        const el = document.getElementById('eiAssessmentTimeline');
        if (!el) return;
        if (!rows || !rows.length) {
            el.innerHTML = '<div class="ei-assessment-empty">Assessment Event kaydı bulunamadı. EI katmanları geçici olarak Excel EI referansı ve ICAO kapatma kayıtlarından hesaplanıyor.</div>';
            return;
        }
        let prev = null;
        el.innerHTML = rows.map((row, index) => {
            const value = typeof window.getAssessmentMetricValue === 'function' ? window.getAssessmentMetricValue(row, 'Overall') : null;
            const delta = value !== null && prev !== null ? Math.round((value - prev) * 100) / 100 : null;
            if (value !== null) prev = value;
            const deltaClass = delta === null || delta === 0 ? 'neu' : delta > 0 ? 'pos' : 'neg';
            const deltaHtml = delta === null ? '' : `<span class="event-delta ${deltaClass}">${delta > 0 ? '+' : ''}${delta.toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2})} puan</span>`;
            const scope = Array.isArray(row.scopeAreas) ? row.scopeAreas : [];
            const scopeHtml = scope.length ? `<div class="event-scope">${scope.map(a=>`<span class="scope-chip">${escapeHtml(a)}</span>`).join('')}</div>` : '';
            const cls = index === 0 ? 'baseline' : index === rows.length - 1 ? 'latest' : '';
            const overall = value === null ? 'EI yok' : `%${value.toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
            return `<div class="ei-assessment-card ${cls}">
                <div class="event-top"><div class="event-name">${escapeHtml(row.name || row.type || 'ICAO Değerlendirmesi')}</div><span class="event-type">${escapeHtml(row.type || 'OTHER')}</span></div>
                <div class="event-ei">${overall}${deltaHtml}</div>
                <div class="event-meta">${escapeHtml(dashboardAssessmentDateLabel(row))}<br>${escapeHtml(dashboardAssessmentScopeLabel(row))}</div>${scopeHtml}
            </div>`;
        }).join('');
    }

    function assessmentAreaState(rows, area, fallbackBasePct) {
        let effective = isFinite(fallbackBasePct) ? fallbackBasePct : 0;
        let base = effective;
        const steps = [];
        (rows || []).forEach((row, index) => {
            const value = typeof window.getAssessmentMetricValue === 'function' ? window.getAssessmentMetricValue(row, area) : null;
            const inScope = index === 0 || (typeof window.isAreaInAssessmentScope === 'function' ? window.isAreaInAssessmentScope(row, area) : false);
            const before = effective;
            if (value !== null && (inScope || index === 0)) effective = value;
            if (index === 0 && value !== null) base = value;
            steps.push({row, value, inScope, before, effective, delta: value !== null && inScope ? Math.round((effective - before) * 100) / 100 : null});
        });
        return {base, official: effective, steps};
    }

    function renderEiAreaAssessmentTable(rows, areaRows) {
        const el = document.getElementById('eiAreaAssessmentTable');
        if (!el) return;
        if (!areaRows || !areaRows.length) { el.innerHTML = ''; return; }
        if (!rows || !rows.length) {
            el.innerHTML = '<div class="ei-assessment-empty">Alan bazlı resmî değerlendirme zaman çizgisi için Assessment Event / EI Snapshot verisi bulunmuyor.</div>';
            return;
        }
        const headers = rows.map(r => `<th>${escapeHtml(r.type || 'ICAO')}<br><span style="font-size:9px;color:var(--muted);font-weight:500;">${escapeHtml(dashboardAssessmentDateLabel(r))}</span></th>`).join('');
        const body = areaRows.map(d => {
            const eventCells = (d.assessmentSteps || []).map((st, index) => {
                if (index > 0 && !st.inScope) return '<td class="scope-out">Kapsam dışı</td>';
                if (st.value === null) return '<td class="scope-out">EI verisi yok</td>';
                const delta = index === 0 ? null : st.delta;
                const deltaText = delta === null ? '' : `<br><span style="font-size:9px;color:${delta>0?'var(--ok)':delta<0?'var(--danger)':'var(--muted)'};font-weight:700;">${delta>0?'+':''}${delta.toFixed(2)} puan</span>`;
                return `<td class="scope-in"><b>%${Number(st.value).toFixed(2)}</b>${deltaText}</td>`;
            }).join('');
            return `<tr><td><b>${escapeHtml(d.alan)}</b></td>${eventCells}<td class="projection-cell"><b>%${d.local}</b><br><span style="font-size:9px;color:var(--muted);">${d.validationCandidateCount} aday PQ</span></td><td class="theoretical-cell"><b>%${d.proj}</b><br><span style="font-size:9px;color:var(--muted);">+${d.openCapCount} açık CAP</span></td></tr>`;
        }).join('');
        el.innerHTML = `<table><thead><tr><th>Alan</th>${headers}<th>Validasyon Adayı Projeksiyonu</th><th>Teorik Üst Sınır</th></tr></thead><tbody>${body}</tbody></table>`;
    }

    function updateEIProjections(filteredData) {
        if (Object.keys(baseEIData).length === 0) return;

        let projectionRows = expandFilteredRowsToFullPqGroups(filteredData);
        let model = buildEIProjectionModel(projectionRows);
        window.currentProjectionModel = model;

        let scope = model.scope;
        let absGT = scope.total;
        let fallbackBaseSat = scope.baseSatOnly;
        let fallbackOfficialSat = getBucketAfterValidationSat(scope);
        let assessmentRows = getDashboardAssessmentRows();
        renderDashboardAssessmentTimeline(assessmentRows);

        const overallRows = assessmentRows.filter(r => typeof window.getAssessmentMetricValue === 'function' && window.getAssessmentMetricValue(r,'Overall') !== null);
        const baselineEvent = overallRows.length ? overallRows[0] : null;
        const latestEvent = overallRows.length ? overallRows[overallRows.length - 1] : null;
        let pctB = baselineEvent ? window.getAssessmentMetricValue(baselineEvent,'Overall') : ratioPct(fallbackBaseSat, absGT);
        let pctI = latestEvent ? window.getAssessmentMetricValue(latestEvent,'Overall') : ratioPct(fallbackOfficialSat, absGT);
        if (!isFinite(pctB)) pctB = 0;
        if (!isFinite(pctI)) pctI = pctB;

        const officialSnap = latestEvent && latestEvent.snapshot ? latestEvent.snapshot : null;
        const officialSat = officialSnap && officialSnap.overall ? Number(officialSnap.overall.satisfactory) : NaN;
        const officialApplicable = officialSnap && officialSnap.overall ? Number(officialSnap.overall.applicable) : NaN;
        const compatibleCounts = Number.isFinite(officialSat) && Number.isFinite(officialApplicable) && officialApplicable === absGT;
        const cIcao = compatibleCounts ? officialSat : fallbackOfficialSat;
        const candidateCount = scope.localCompleted || 0;
        const openCapCount = scope.projected || 0;
        let pctL = Math.min(100, pctI + ratioPct(candidateCount, absGT));
        let pctP = Math.min(100, pctL + ratioPct(openCapCount, absGT));
        const cLocal = compatibleCounts ? Math.min(absGT, officialSat + candidateCount) : Math.min(absGT, cIcao + candidateCount);
        const cProj = Math.min(absGT, cLocal + openCapCount);

        const baseTitle = document.getElementById('lblBaseTitle');
        const officialTitle = document.getElementById('lblIcaoTitle');
        if (baseTitle) baseTitle.textContent = baselineEvent ? `${baselineEvent.type || baselineEvent.name || 'İlk değerlendirme'} EI (%):` : 'CMAA / Başlangıç EI (%):';
        if (officialTitle) officialTitle.textContent = latestEvent ? `Güncel Resmî EI (${latestEvent.type || latestEvent.name || 'son değerlendirme'} sonrası):` : 'Güncel Resmî ICAO EI (%):';
        const localTitle = document.getElementById('lblLocalTitle'); if(localTitle)localTitle.textContent='Validasyon Adayları Dahil EI Projeksiyonu:';
        const projTitle = document.getElementById('lblProjTitle'); if(projTitle)projTitle.textContent="Tüm Açık CAP'ler Başarıyla Valide Edilirse Teorik EI:";

        const baselineCounts = baselineEvent && baselineEvent.snapshot && baselineEvent.snapshot.overall ? baselineEvent.snapshot.overall : null;
        const baseCountHtml = baselineCounts && Number.isFinite(Number(baselineCounts.satisfactory)) && Number.isFinite(Number(baselineCounts.applicable)) ? `(${baselineCounts.satisfactory}/${baselineCounts.applicable})` : `(${fallbackBaseSat}/${absGT})`;
        const officialCountHtml = compatibleCounts ? `(${officialSat}/${officialApplicable})` : (latestEvent ? '(resmî snapshot)' : `(${cIcao}/${absGT})`);
        document.getElementById('lblBase').innerHTML = `${pctText(pctB)} <span style="font-size:12px; font-weight:normal; color:var(--muted); margin-left:5px;">${baseCountHtml}</span>`;
        document.getElementById('lblIcao').innerHTML = `${pctText(pctI)} <span style="font-size:12px; font-weight:normal; color:var(--icao-blue); margin-left:5px;">${officialCountHtml}</span>`;
        document.getElementById('lblLocal').innerHTML = `${pctText(pctL)} <span style="font-size:12px; font-weight:normal; color:var(--ok); margin-left:5px;">(+${candidateCount} validasyon adayı PQ)</span>`;
        document.getElementById('lblProj').innerHTML = `${pctText(pctP)} <span style="font-size:13px; font-weight:normal; color:var(--warn); margin-left:5px;">(+${openCapCount} açık CAP PQ)</span>`;

        document.getElementById('barBase').style.width = Math.max(0, Math.min(100, pctB)) + '%';
        document.getElementById('barBase').innerHTML = pctText(pctB);
        document.getElementById('barIcao').style.width = Math.max(0, pctI - pctB) + '%';
        document.getElementById('barLocal').style.width = Math.max(0, pctL - pctI) + '%';
        document.getElementById('barProj').style.width = Math.max(0, pctP - pctL) + '%';
        const meta = document.getElementById('eiProjectionMeta');
        if(meta)meta.innerHTML = `<b>Metodoloji:</b> Resmî EI yalnız Assessment Event/EI Snapshot sonucuyla değişir. <b>${candidateCount}</b> PQ'nun tüm CAP adımları tamamlanmış olup henüz ICAO validasyonu beklediği için yeşil alan yalnız projeksiyondur. <b>${openCapCount}</b> PQ ise açık CAP havuzundaki teorik ilave potansiyeldir.${latestEvent?` Son resmî değerlendirme: <b>${escapeHtml(latestEvent.name||latestEvent.type||'-')}</b> (${escapeHtml(dashboardAssessmentDateLabel(latestEvent))}).`:''}`;

        let sAreas = getCheckedValues('areaFilterList');
        let isG = sAreas.includes('all');
        let aAreas = isG ? Object.keys(baseEIData) : sAreas.map(normalizeAreaKey).filter(a => baseEIData[a]);
        if (aAreas.length === 0) { aAreas = Object.keys(baseEIData); isG = true; }
        let dAreas = isG ? aAreas.filter(a => model.activeAreas.has(a) || model.areas[a].icaoClosed > 0 || assessmentRows.length > 0) : aAreas;
        dAreas.sort(sortAreas);

        let validationTasks = model.validationTasks || [];
        renderMilestoneHeader(validationTasks);

        const tbodyMS = document.getElementById('milestoneTableBody');
        tbodyMS.innerHTML = "";
        let ord = [{ key: 'Scope', bucket: model.scope }, ...dAreas.map(a => ({ key: a, bucket: model.areas[a] }))];
        ord.forEach(item => {
            let m = item.bucket;
            if (!m || m.total === 0) return;
            let tr = document.createElement('tr');
            if (item.key === 'Scope') tr.className = "ms-global-row";
            let currentSat = getBucketCurrentSat(m);
            let basePct = ratioPct(m.baseSatOnly, m.total);
            let currentPct = ratioPct(currentSat, m.total);
            let maxPct = getBucketMaxPct(m);
            let html = `<td style="text-align: left;">${m.name}</td>`;
            html += `<td><b>${pctText(basePct)}</b><br><span style="font-size:10px; color:var(--muted);">(${m.baseSatOnly}/${m.total})</span></td>`;
            if (validationTasks.length > 0) validationTasks.forEach((task, idx) => { html += validationMilestoneCellHtml(m, validationTasks, idx); });
            else html += validationNoDataCellHtml(m);
            html += `<td class="ms-passed"><b>${pctText(currentPct)}</b><br><span style="font-size:10px; color:var(--muted);">${currentSat}/${m.total} | maks. ${pctText(maxPct)}</span></td>`;
            [60, 70, 80, 90, 100].forEach(lvl => { html += milestoneCellHtml(m, lvl, validationTasks); });
            tr.innerHTML = html;
            tbodyMS.appendChild(tr);
        });

        refreshSimulatorAreaSelects();

        window.currentAreaEIData = dAreas.map(a => {
            let bkt = model.areas[a];
            let fallbackBase = ratioPct(bkt.baseSatOnly, bkt.total);
            let state = assessmentAreaState(assessmentRows, a, fallbackBase);
            let official = assessmentRows.length ? state.official : ratioPct(getBucketAfterValidationSat(bkt), bkt.total);
            let local = Math.min(100, official + ratioPct(bkt.localCompleted || 0, bkt.total));
            let proj = Math.min(100, local + ratioPct(bkt.projected || 0, bkt.total));
            return { alan: a, base: Number(state.base).toFixed(2), icao: Number(official).toFixed(2), local: Number(local).toFixed(2), proj: Number(proj).toFixed(2), noCap: bkt.noCap, undatedProjected: bkt.undatedProjected, validationCandidateCount:bkt.localCompleted||0, openCapCount:bkt.projected||0, assessmentSteps:state.steps };
        });

        const sourceBadge=document.getElementById('eiAreaChartSourceBadge');
        if(sourceBadge)sourceBadge.textContent=assessmentRows.length?`${assessmentRows.length} resmî Assessment Event · kapsam bilgisi aktif`:'Fallback: Excel EI referansı / ICAO kapatma kayıtları';

        const ctx = document.getElementById('eiChartCanvas').getContext('2d');
        if (charts.ei) charts.ei.destroy();
        const datasets=[];
        if(assessmentRows.length){
            datasets.push({label:`1. ${assessmentRows[0].type||assessmentRows[0].name||'Başlangıç'} EI`,data:window.currentAreaEIData.map(d=>parseFloat(d.base)),backgroundColor:'#64748b',assessmentKind:'baseline'});
            const palette=['#3b82f6','#2563eb','#7c3aed','#0ea5e9','#4f46e5','#0284c7'];
            assessmentRows.slice(1).forEach((row,idx)=>{
                const eventIndex=idx+1;
                const data=window.currentAreaEIData.map(d=>{const st=d.assessmentSteps[eventIndex];return st&&st.inScope&&st.value!==null?Number((st.effective-st.before).toFixed(2)):0;});
                const scopeMask=window.currentAreaEIData.map(d=>{const st=d.assessmentSteps[eventIndex];return !!(st&&st.inScope);});
                const valueMask=window.currentAreaEIData.map(d=>{const st=d.assessmentSteps[eventIndex];return !!(st&&st.value!==null);});
                if(data.some((v,i)=>scopeMask[i]||valueMask[i]))datasets.push({label:`${eventIndex+1}. ${row.type||row.name||'ICAO'} değişimi`,data,backgroundColor:palette[idx%palette.length],assessmentKind:'event',assessmentRow:row,scopeMask,valueMask});
            });
            datasets.push({label:'Validasyon Adayları',data:window.currentAreaEIData.map(d=>Number((parseFloat(d.local)-parseFloat(d.icao)).toFixed(2))),backgroundColor:'#10b981',assessmentKind:'candidate'});
            datasets.push({label:'Açık CAP Teorik Potansiyeli',data:window.currentAreaEIData.map(d=>Number((parseFloat(d.proj)-parseFloat(d.local)).toFixed(2))),backgroundColor:'#f59e0b',assessmentKind:'projection'});
        }else{
            datasets.push({ label: '1. CMAA EI (%)', data: window.currentAreaEIData.map(d => parseFloat(d.base)), backgroundColor: '#64748b' });
            datasets.push({ label: '2. ICAO Validasyonları EI (%)', data: window.currentAreaEIData.map(d => parseFloat(d.icao) - parseFloat(d.base)), backgroundColor: '#3b82f6' });
            datasets.push({ label: '3. Validasyon Adayları', data: window.currentAreaEIData.map(d => parseFloat(d.local) - parseFloat(d.icao)), backgroundColor: '#10b981' });
            datasets.push({ label: '4. Açık CAP Teorik Potansiyeli', data: window.currentAreaEIData.map(d => parseFloat(d.proj) - parseFloat(d.local)), backgroundColor: '#f59e0b' });
        }
        const hasNegative=datasets.some(ds=>(ds.data||[]).some(v=>Number(v)<0));
        charts.ei = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: window.currentAreaEIData.map(d => [ d.alan, `Resmî: %${d.icao}`, `Aday: %${d.local}` ]),
                datasets
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins:{tooltip:{callbacks:{label:(ctx)=>{
                    const ds=ctx.dataset,d=window.currentAreaEIData[ctx.dataIndex];
                    if(ds.assessmentKind==='baseline')return `${ds.label}: %${Number(ctx.raw).toFixed(2)}`;
                    if(ds.assessmentKind==='event'){
                        if(ds.scopeMask&&!ds.scopeMask[ctx.dataIndex])return `${ds.label}: Kapsam dışı`;
                        if(ds.valueMask&&!ds.valueMask[ctx.dataIndex])return `${ds.label}: EI verisi yok`;
                        const st=d.assessmentSteps[(assessmentRows||[]).findIndex(r=>ds.assessmentRow&&r.id===ds.assessmentRow.id)];
                        return `${ds.label}: ${Number(ctx.raw)>=0?'+':''}${Number(ctx.raw).toFixed(2)} puan${st&&st.value!==null?` → %${Number(st.value).toFixed(2)}`:''}`;
                    }
                    return `${ds.label}: ${Number(ctx.raw)>=0&&ds.assessmentKind!=='baseline'?'+':''}${Number(ctx.raw).toFixed(2)} puan`;
                }}}},
                scales: { x: { stacked: true }, y: { stacked: true, min:hasNegative?-15:0, max: 100, ticks:{callback:v=>v+'%'} } }
            }
        });
        renderEiAreaAssessmentTable(assessmentRows,window.currentAreaEIData);
    }

    window.runSimulator = function() {
        let area = document.getElementById('simAreaSelect').value;
        let target = parseInt(document.getElementById('simTargetSelect').value, 10);
        if(Object.keys(baseEIData).length === 0) { alert("EI Referans (Excel) verisi bulunamadı!"); return; }

        let model = buildEIProjectionModel(rawData);
        let bucket = getBucketForArea(model, area);
        let resEl = document.getElementById('simResult');
        resEl.style.display = 'block';

        if (!bucket || bucket.total === 0) {
            resEl.innerHTML = `❌ Seçilen alan için EI referans verisi bulunamadı.`;
            resEl.style.borderLeft = "4px solid var(--danger)";
            return;
        }

        let reqSat = Math.ceil((target / 100) * bucket.total);
        let currentSat = getBucketCurrentSat(bucket);
        let maxSat = getBucketProjectedSat(bucket);
        let needed = reqSat - currentSat;
        let currentPct = ratioPct(currentSat, bucket.total);
        let maxPct = ratioPct(maxSat, bucket.total);
        let label = area === 'GLOBAL' ? 'TÜRKİYE GENELİ' : area;

        if (needed <= 0) {
            resEl.innerHTML = `✅ <b>${label}</b> için %${target} hedefine mevcut durumda ulaşılmıştır.<br><span style="font-size:12px; color:var(--muted); font-weight:normal;">Mevcut EI: ${pctText(currentPct)} (${currentSat}/${bucket.total})</span>`;
            resEl.style.borderLeft = "4px solid var(--ok)";
            return;
        }

        if (reqSat > maxSat) {
            let gap = reqSat - maxSat;
            resEl.innerHTML = `❌ <b>${label}</b> için %${target} hedefine mevcut CAP havuzuyla ulaşılamıyor.<br><span style="font-size:12px; color:var(--muted); font-weight:normal;">Mevcut EI: ${pctText(currentPct)} (${currentSat}/${bucket.total}) | Tüm mevcut CAP'ler kapanırsa: ${pctText(maxPct)} (${maxSat}/${bucket.total}) | İlave gereken PQ: ${gap}</span>`;
            resEl.style.borderLeft = "4px solid var(--danger)";
            return;
        }

        let resolution = resolveMilestone(bucket, target, model.validationTasks || []);
        let datedInfo = resolution.status === 'future' ? resolution.html : (resolution.status === 'unknown' ? 'Tarih bilgisi eksik olan CAP adımları nedeniyle net tarih hesaplanamıyor.' : resolution.html);
        let unknownNote = bucket.undatedProjected > 0 ? `<br><span style="font-size:12px; color:var(--muted); font-weight:normal;">Not: ${bucket.undatedProjected} açık PQ'da tarih eksik olduğu için bazı ileri hedeflerde kesin tarih üretilemeyebilir.</span>` : '';
        resEl.innerHTML = `🚀 <b>${label}</b> için %${target} hedefine ulaşmak adına <b>${needed} PQ</b> daha kapanmalıdır.<br><span style="font-size:12px; color:var(--muted); font-weight:normal;">Mevcut: ${pctText(currentPct)} (${currentSat}/${bucket.total}) → Hedef için gereken: ${reqSat}/${bucket.total}. Mevcut CAP planına göre hedef zamanı: <b>${datedInfo}</b></span>${unknownNote}`;
        resEl.style.borderLeft = "4px solid var(--primary)";
    };

    function computeDateSimulation(area, targetDate) {
        let groups = groupRowsByPQ(rawData);
        let model = buildEIProjectionModel(rawData);
        let bucket = getBucketForArea(model, area);
        if (!bucket || bucket.total === 0) return null;

        let simSat = getBucketAfterValidationSat(bucket);
        let currentSat = getBucketAfterValidationSat(bucket);
        let assumedPqs = [];
        let alreadyDonePqs = [];
        let noDatePqs = [];
        let afterDatePqs = [];
        let targetTime = targetDate.getTime();
        let today = todayMidnight().getTime();

        Object.keys(groups).forEach(pq => {
            let m = pqMasterData[pq] || {};
            if (m.isIcaoClosed) return;
            let pqArea = normalizeAreaKey(m.alan);
            if (area !== 'GLOBAL' && pqArea !== area) return;
            if (area === 'GLOBAL' && (!pqArea || !baseEIData[pqArea])) return;

            let info = getPQClosureInfo(pq, groups[pq]);
            if (!info.hasUsableCap) return;

            if (info.allDone) {
                currentSat++;
                // For future/current projections, already completed PQs are counted even if completion date is absent.
                if (!info.closureDate || info.closureDate.getTime() <= targetTime || targetTime >= today) {
                    simSat++;
                    alreadyDonePqs.push(pq);
                } else {
                    afterDatePqs.push({ pq, date: info.closureDate });
                }
                return;
            }

            if (info.closureDate && info.closureDate.getTime() <= targetTime) {
                simSat++;
                assumedPqs.push({ pq, date: info.closureDate });
            } else if (!info.closureDate) {
                noDatePqs.push(pq);
            } else {
                afterDatePqs.push({ pq, date: info.closureDate });
            }
        });

        assumedPqs.sort((a,b) => a.date - b.date || sortPQs(a.pq, b.pq));
        afterDatePqs.sort((a,b) => a.date - b.date || sortPQs(a.pq, b.pq));
        return { bucket, currentSat, simSat, assumedPqs, alreadyDonePqs, noDatePqs, afterDatePqs };
    }

    window.runDateSimulator = function() {
        let area = document.getElementById('dateSimAreaSelect').value;
        let rawDate = document.getElementById('dateSimTargetDate').value;
        let targetDate = parseUserDateInput(rawDate);
        let resEl = document.getElementById('dateSimResult');
        resEl.style.display = 'block';

        if(Object.keys(baseEIData).length === 0) { alert("EI Referans (Excel) verisi bulunamadı!"); return; }
        if(!targetDate) {
            resEl.innerHTML = `❌ Tarih okunamadı. Lütfen <b>31.12.2026</b> veya <b>2026-12-31</b> formatında giriniz.`;
            resEl.style.borderLeft = "4px solid var(--danger)";
            return;
        }

        let sim = computeDateSimulation(area, targetDate);
        if (!sim) {
            resEl.innerHTML = `❌ Seçilen alan için EI referans verisi bulunamadı.`;
            resEl.style.borderLeft = "4px solid var(--danger)";
            return;
        }

        let label = area === 'GLOBAL' ? 'TÜRKİYE GENELİ' : area;
        let currentPct = ratioPct(sim.currentSat, sim.bucket.total);
        let simPct = ratioPct(sim.simSat, sim.bucket.total);
        let delta = sim.simSat - sim.currentSat;
        let pqPreview = sim.assumedPqs.slice(0, 12).map(x => `PQ ${x.pq}`).join(', ');
        let more = sim.assumedPqs.length > 12 ? ` +${sim.assumedPqs.length - 12} PQ daha` : '';
        let noDateNote = sim.noDatePqs.length > 0 ? `<br><span style="font-size:12px; color:var(--warn); font-weight:normal;">⚠️ ${sim.noDatePqs.length} açık PQ'nun tüm adımlarında tarih bilgisi tamam olmadığı için bu simülasyona dahil edilmedi.</span>` : '';

        resEl.innerHTML = `📅 <b>${label}</b> için <b>${formatExactDate(targetDate)}</b> itibarıyla olumlu senaryo EI: <b>${pctText(simPct)}</b> (${sim.simSat}/${sim.bucket.total}).<br><span style="font-size:12px; color:var(--muted); font-weight:normal;">Mevcut EI: ${pctText(currentPct)} (${sim.currentSat}/${sim.bucket.total}) | Bu tarihe kadar ek kapanacağı varsayılan PQ: <b>${Math.max(0, delta)}</b>${pqPreview ? `<br>Varsayılan ek PQ'lar: ${pqPreview}${more}` : ''}</span>${noDateNote}`;
        resEl.style.borderLeft = delta > 0 ? "4px solid var(--ok)" : "4px solid var(--primary)";
    };

    function formatExactDate(date) { if (!date) return "-"; const months = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"]; let d = date.getDate().toString().padStart(2, '0'); return `${d} ${months[date.getMonth()]} ${date.getFullYear()}`; }
    
    function showGapReport() {
        let h = `<p style="font-size:12px; color:var(--muted); margin-top:0;">Filtrelenen eylemlerin tümü zamanında kapatılsa bile %100 hedefine ulaşılamamasının sebepleri aşağıda listelenmiştir.</p>`;
        if(window.currentAreaEIData.length === 0) h += `<b>Analiz için yeterli EI verisi yok.</b>`;
        else { window.currentAreaEIData.forEach(d => { if(parseFloat(d.proj) < 100) { let gap = (100 - parseFloat(d.proj)).toFixed(2); h += `<div style="background:var(--card); border:1px solid var(--danger); border-left:4px solid var(--danger); padding:15px; margin-bottom:10px; border-radius:6px;"><b>📋 ${d.alan} Alanı</b><br><span style="color:var(--danger); font-size:13px; display:inline-block; margin-top:5px;"><b>%${gap} Açık Var:</b> OLF üzerinde bu oranı tamamlayacak bir eylem planı sunulmamış veya sistemde kayıtlı değil. ICAO'nun kabul edeceği yeni bir CAP girilmesi gerekiyor.</span></div>`; } }); }
        if(h.indexOf('Açık Var') === -1) h += `<div style="color:var(--ok); font-weight:bold; padding:20px; text-align:center;">Tebrikler! Mevcut eylemler kapatıldığında hedeflere ulaşılabiliyor, eksik CAP bulunmuyor.</div>`;
        document.getElementById('gapModalBody').innerHTML = h; document.getElementById('gapModal').style.display = 'block';
    }

    function getReportMode() {
        const el = document.querySelector('input[name="reportMode"]:checked');
        return el ? el.value : 'auto';
    }

    function getManagerReportScopeRows() {
        const filtered = (typeof getFilteredData === 'function') ? getFilteredData() : rawData;
        const expanded = expandFilteredRowsToFullPqGroups(filtered);
        return expanded.length ? expanded : filtered;
    }

    function managerPqClickAttr(pq) { return `onclick="switchTab('list'); window.togglePQ('${String(pq || '').replace(/\./g, '-')}');"`; }

    function managerMiniRow(item, mode, subtitle) {
        if (!item) return '';
        const cls = mode || 'warn';
        const pq = item.pq || '-';
        const titleRight = item.dateText || (item.latestDate ? formatTrendDate(item.latestDate) : (item.earliestOpenDate ? formatTrendDate(item.earliestOpenDate) : 'Tarih yok'));
        const meta = subtitle || `Alan: ${escapeHtml(item.area || (item.master || {}).alan || '-')} | CE: ${escapeHtml(item.ce || (item.master || {}).ce || '-')} | Kalan: ${item.remainingSteps !== undefined ? item.remainingSteps : (item.remaining || '-')} adım | İlerleme: %${trendSafePct(item.progressPct || 0)}`;
        return `<div class="manager-mini-row ${cls}" ${managerPqClickAttr(pq)}><div class="manager-mini-title"><span>PQ ${escapeHtml(pq)}</span><span>${escapeHtml(titleRight)}</span></div><div class="manager-mini-meta">${meta}<br><b>Sorumlu:</b> ${escapeHtml(item.owner || item.offices || (item.master || {}).sorumlu || '-')}</div></div>`;
    }

    function buildManagerReportBundle() {
        const scopeRows = rawData || [];
        const filteredScopeRows = getManagerReportScopeRows();
        const analysis = getSnapshotAnalysis({ rawData: scopeRows, pqMasterData: pqMasterData, baseEIData: baseEIData, dailyReviewedPQs: [], reportTimestamp: Date.now(), note: 'Güncel Durum' });
        const support = buildTrendDecisionSupport({ analysisB: analysis, newClosed: [] });
        const allUpcoming = getUpcomingTasks(scopeRows);
        const allPast = getPastTasks(scopeRows, null);
        const allMissingDateRows = scopeRows.filter(d => getKanbanActionStatus(d).type === 'missing').sort((a,b) => sortAreas((pqMasterData[a.pq]||{}).alan||'', (pqMasterData[b.pq]||{}).alan||'') || sortPQs(a.pq,b.pq));
        const upcoming = allUpcoming.slice(0, 8);
        const past = allPast.slice(0, 8);
        const missingDateRows = allMissingDateRows.slice(0, 8);
        const selectedPQs = Array.from(dailyReviewedPQs).sort((a,b) => sortAreas((pqMasterData[a]||{}).alan||'', (pqMasterData[b]||{}).alan||'') || sortPQs(a,b));
        const selectedRows = scopeRows.filter(d => selectedPQs.includes(d.pq));
        const selectedGroups = groupRowsByPQ(selectedRows);
        selectedPQs.forEach(pq => {
            let m = pqMasterData[pq] || {};
            if (m.isIcaoClosed && !selectedGroups[pq]) selectedGroups[pq] = [{ pq, step: 'ICAO-VAL', action: '🏆 ICAO validasyonu ile kapatıldı.', office: 'SHGM / ICAO', estDate: 'Kapatıldı', progress: '100% Completed', note: '' }];
        });
        return { analysis, support, upcoming, past, missingDateRows, allUpcoming, allPast, allMissingDateRows, upcomingAllCount: allUpcoming.length, pastAllCount: allPast.length, missingDateAllCount: allMissingDateRows.length, selectedPQs, selectedGroups, filteredScopeRows };
    }

    function getManagerExpectedClosureAreaRows(bundleOrAnalysis) {
        const a = bundleOrAnalysis && bundleOrAnalysis.analysis ? bundleOrAnalysis.analysis : bundleOrAnalysis;
        const areaRows = (a && a.areaRows) || {};
        return Object.keys(areaRows).map(area => {
            const r = areaRows[area] || {};
            const officialSat = (r.afterValidationSatEffective !== undefined && r.afterValidationSatEffective !== null) ? r.afterValidationSatEffective : getAnalysisAreaAfterValidationSat(r);
            const expectedCount = r.localCompleted || 0;
            const expectedSat = officialSat + expectedCount;
            return {
                area,
                count: expectedCount,
                officialOpenFindings: Math.max(0, (r.total || 0) - officialSat),
                expectedOpenFindings: Math.max(0, (r.total || 0) - expectedSat),
                officialEI: ratioPct(officialSat, r.total || 0),
                expectedEI: ratioPct(expectedSat, r.total || 0),
                total: r.total || 0
            };
        }).filter(r => r.count > 0).sort((a,b) => sortAreas(a.area, b.area));
    }

    function getManagerExpectedClosureSummary(bundleOrAnalysis, maxItems = 10) {
        const rows = getManagerExpectedClosureAreaRows(bundleOrAnalysis);
        if (!rows.length) return 'Alan kırılımı yok';
        const shown = rows.slice(0, maxItems).map(r => `${escapeHtml(r.area)}: ${r.count}`).join(' · ');
        const hidden = rows.length > maxItems ? ` · +${rows.length - maxItems} alan` : '';
        return shown + hidden;
    }

    function buildManagerExpectedClosureBreakdownHtml(bundle) {
        const rows = getManagerExpectedClosureAreaRows(bundle);
        const total = rows.reduce((sum, r) => sum + r.count, 0);
        let html = `<div class="manager-section"><h3>✅ Kapatılması Beklenen Bulgu - Alan Kırılımı</h3>`;
        if (!rows.length) {
            html += `<div class="manager-empty">Tüm CAP adımları tamamlanmış ve ICAO validasyonu bekleyen açık PQ bulunmamaktadır.</div></div>`;
            return html;
        }
        html += `<div style="margin-bottom:8px;">${rows.map(r => `<span class="manager-breakdown-chip">${escapeHtml(r.area)}: ${r.count}</span>`).join('')}</div>`;
        html += `<table class="manager-breakdown-table"><thead><tr><th>Denetim Alanı</th><th>Kapatılması Beklenen Bulgu</th><th>Resmî Açık Bulgu</th><th>Kapanış Sonrası Açık Bulgu</th><th>Beklenen EI</th></tr></thead><tbody>`;
        rows.forEach(r => {
            html += `<tr><td><b>${escapeHtml(r.area)}</b></td><td>${r.count}</td><td>${r.officialOpenFindings}</td><td>${r.expectedOpenFindings}</td><td>${pctText(r.expectedEI)}</td></tr>`;
        });
        html += `<tr><td><b>TOPLAM</b></td><td><b>${total}</b></td><td colspan="3">Bu sayı, tüm CAP adımları tamamlanmış ancak henüz ICAO validasyonu ile resmiyet kazanmamış PQ/bulgu sayısını ifade eder.</td></tr>`;
        html += `</tbody></table></div>`;
        return html;
    }

    function buildManagerExpectedClosurePdfTable(bundle) {
        const rows = getManagerExpectedClosureAreaRows(bundle);
        if (!rows.length) return null;
        const body = [[{text:'Alan', style:'th'}, {text:'Kapatılması Beklenen Bulgu', style:'th'}, {text:'Resmî Açık Bulgu', style:'th'}, {text:'Kapanış Sonrası Açık Bulgu', style:'th'}, {text:'Beklenen EI', style:'th'}]];
        rows.forEach(r => body.push([r.area, String(r.count), String(r.officialOpenFindings), String(r.expectedOpenFindings), pctText(r.expectedEI)]));
        body.push([{text:'TOPLAM', bold:true}, {text:String(rows.reduce((s,r) => s + r.count, 0)), bold:true}, '', '', '']);
        return { table:{headerRows:1, widths:['*','auto','auto','auto','auto'], body}, layout:'lightHorizontalLines', margin:[0,0,0,12] };
    }

    function getManagerEiPhaseRows(bundle) {
        const a = bundle && bundle.analysis ? bundle.analysis : getSnapshotAnalysis({ rawData: rawData, pqMasterData: pqMasterData, baseEIData: baseEIData, dailyReviewedPQs: [], reportTimestamp: Date.now(), note: 'Güncel Durum' });
        const total = a.totalEI || 0;
        const baseSat = a.baseSat || 0;
        const officialSat = (a.afterValidationSat !== undefined && a.afterValidationSat !== null) ? a.afterValidationSat : (a.baseSat || 0) + (a.icaoClosed || 0);
        const expectedClosureRows = getManagerExpectedClosureAreaRows(a);
        const expectedClosureTotal = expectedClosureRows.reduce((sum, r) => sum + r.count, 0);
        const localSat = officialSat + expectedClosureTotal;
        const projectedSat = localSat + (a.projected || 0);
        function row(key, title, sat, cls, source, note) {
            sat = Math.max(0, Math.min(total || sat, sat || 0));
            return {
                key, title, sat, cls, source, note,
                ei: ratioPct(sat, total),
                findings: Math.max(0, total - sat),
                satisfactoryText: `${sat}/${total}`
            };
        }
        const rows = [
            row('cmaa', 'CMAA (Başlangıç)', baseSat, 'cmaa', 'Resmî başlangıç', 'CMAA aşamasındaki ilk resmî EI ve açık bulgu sayısı.'),
            row('official', 'ICAO Validasyonları Sonrası', officialSat, 'official', 'Resmî validasyon', 'Excel EI_Referans / AFTER VALIDASYON ve ICAO kapatılan PQ etkisi.'),
            row('local', 'Kapatılması Beklenen Bulgu', localSat, 'local', 'ICAO validasyonu bekleyen CAP', 'Tüm CAP adımları tamamlanan ancak henüz ICAO validasyonu ile resmileşmeyen PQ/bulgu sayısı.'),
            row('projected', 'Tüm CAP\'ler Tamamlanmışlar Dahil', projectedSat, 'projected', 'Potansiyel senaryo', 'Mevcut açık CAP havuzunun tamamının olumlu kapanacağı varsayımı.')
        ];
        rows[2].expectedClosureCount = expectedClosureTotal;
        rows[2].expectedClosureBreakdown = expectedClosureRows;
        rows[2].displayFindingText = `${expectedClosureTotal} kapatılması beklenen bulgu`;
        rows[2].displayMetaHtml = `Beklenen EI: ${pctText(rows[2].ei)}<br>Kapanış sonrası açık bulgu: ${rows[2].findings}<br>${getManagerExpectedClosureSummary(a, 6)}`;
        return rows;
    }

    function managerPhaseCardHtml(row) {
        const findingText = row.displayFindingText || `${row.findings} açık bulgu`;
        const metaHtml = row.displayMetaHtml || `Satisfactory: ${escapeHtml(row.satisfactoryText)}<br>${escapeHtml(row.source)}`;
        return `<div class="manager-phase-card ${row.cls}"><span class="phase-title">${escapeHtml(row.title)}</span><b class="phase-ei">${pctText(row.ei)}</b><span class="phase-finding">${findingText}</span><span class="phase-meta">${metaHtml}</span></div>`;
    }

    function buildManagerEiPhaseHtml(bundle) {
        const phases = getManagerEiPhaseRows(bundle);
        const cmaa = phases[0], official = phases[1], local = phases[2], projected = phases[3];
        const officialClosed = Math.max(0, cmaa.findings - official.findings);
        const localExpected = local.expectedClosureCount || 0;
        const projectedExpected = Math.max(0, local.findings - projected.findings);
        const expectedSummary = getManagerExpectedClosureSummary(bundle, 10);
        let html = `<div class="manager-section"><h3>🧭 Resmî EI Safhaları ve Beklenti Projeksiyonu</h3>`;
        html += `<div class="manager-phase-grid">${phases.map(managerPhaseCardHtml).join('')}</div>`;
        html += `<div class="manager-insight">Resmî çizgi: CMAA başlangıcında <b>${cmaa.findings} bulgu</b> ve <b>${pctText(cmaa.ei)}</b> EI vardı. ICAO validasyonları sonrasında resmî açık bulgu sayısı <b>${official.findings}</b> seviyesine inerken resmî Overall EI <b>${pctText(official.ei)}</b> seviyesine çıkmıştır. SHGM çalışmalarında tüm CAP adımları tamamlanan ve henüz ICAO validasyonu ile resmiyet kazanmayan <b>${localExpected}</b> bulgu/PQ bulunmaktadır (${expectedSummary}). Bu kapanışlar resmileşirse kapanış sonrası açık bulgu <b>${local.findings}</b>, beklenen EI <b>${pctText(local.ei)}</b> olur. Mevcut tüm CAP havuzu olumlu tamamlanırsa potansiyel EI <b>${pctText(projected.ei)}</b> seviyesine ulaşır.</div>`;
        html += `<div class="manager-phase-note"><div><b>-${officialClosed}</b>ICAO validasyonlarıyla resmî kapanan bulgu/PQ</div><div><b>${localExpected}</b>Kapatılması beklenen bulgu/PQ<br>${expectedSummary}</div><div><b>-${projectedExpected}</b>Tüm açık CAP'ler olumlu tamamlanırsa ilave potansiyel kapanış</div></div>`;
        html += `</div>`;
        html += buildManagerExpectedClosureBreakdownHtml(bundle);
        return html;
    }

    function buildAutoManagerReportHtml(bundle, customNote) {
        const a = bundle.analysis;
        const s = a.stats;
        const support = bundle.support;
        const b = support.briefing || {};
        const bottleneck = b.bottleneck ? `${escapeHtml(b.bottleneck.office)} (${b.bottleneck.lateActions} gecikmiş eylem)` : 'Belirgin darboğaz yok';
        const critical = b.latestCritical ? `PQ ${escapeHtml(b.latestCritical.pq)} / ${escapeHtml(formatTrendDate(b.latestCritical.latestDate))}` : 'Kritik yol verisi yok';
        const quickWin = (b.quickWins && b.quickWins.length) ? b.quickWins.map(x => `PQ ${escapeHtml(x.pq)}`).join(', ') : 'Hızlı kazanım adayı yok';
        const phases = getManagerEiPhaseRows(bundle);
        const officialEI = phases[1] ? phases[1].ei : 0;
        const currentEI = phases[2] ? phases[2].ei : (a.ei.overall || 0);
        const projectedEI = phases[3] ? phases[3].ei : (a.ei.projectedOverall || 0);
        const expectedClosureTotal = phases[2] ? (phases[2].expectedClosureCount || 0) : 0;
        const expectedClosureSummary = getManagerExpectedClosureSummary(bundle, 8);
        let html = `<div class="manager-section"><h2>📋 OTOMATİK YÖNETİCİ BRİFİNGİ</h2>`;
        if (customNote && customNote.trim()) html += `<div class="manager-insight" style="margin-bottom:12px;"><b>Yönetici Notu:</b><br>${customNote.replace(/\n/g, '<br>')}</div>`;
        html += `<div class="manager-kpi-grid">
            <div class="manager-kpi"><b>${s.lateActions.total}</b><span>Gecikmiş eylem</span></div>
            <div class="manager-kpi"><b>${bundle.missingDateAllCount}</b><span>Tarih riski</span></div>
            <div class="manager-kpi"><b>${s.openPqItems.length}</b><span>CAP takibindeki açık PQ</span></div>
            <div class="manager-kpi"><b>${expectedClosureTotal}</b><span>Kapatılması beklenen bulgu</span></div>
        </div>
        <div class="manager-insight">Resmî ICAO validasyon sonrası Overall EI <b>%${officialEI.toFixed(2)}</b>; tüm CAP adımları tamamlanan <b>${expectedClosureTotal}</b> bulgu/PQ (${expectedClosureSummary}) ICAO validasyonu ile olumlu kapanırsa beklenen EI <b>%${currentEI.toFixed(2)}</b>; tüm açık CAP havuzu olumlu tamamlanırsa potansiyel EI <b>%${projectedEI.toFixed(2)}</b>. Öncelikli takip adayı <b>${critical}</b>; ana darboğaz <b>${bottleneck}</b>; hızlı kazanım adayları <b>${quickWin}</b>.</div></div>`;
        html += buildManagerEiPhaseHtml(bundle);

        html += `<div class="manager-section"><h3>🔴 Kritik Yol / Hedefi Kilitleyen PQ'lar</h3><div class="manager-list">`;
        html += support.criticalPath.length ? support.criticalPath.slice(0, 6).map(x => managerMiniRow(x, 'danger')).join('') : `<div class="manager-empty">Kritik yol adayı bulunamadı.</div>`;
        html += `</div></div>`;

        html += `<div class="manager-section"><h3>⚡ En Hızlı EI Katkısı Sağlayabilecek PQ'lar</h3><div class="manager-list">`;
        html += support.topImpact.length ? support.topImpact.slice(0, 6).map(x => managerMiniRow(x, 'ok', `Alan: ${escapeHtml(x.area || '-')} | Alan EI katkısı: %${trendSafePct(x.areaContributionPct)} | Kalan: ${x.remainingSteps} adım | İlerleme: %${trendSafePct(x.progressPct)}`)).join('') : `<div class="manager-empty">Hızlı kazanım adayı bulunamadı.</div>`;
        html += `</div></div>`;

        html += `<div class="manager-section"><h3>🏢 Sorumlu Birim Darboğazları</h3><div class="manager-list">`;
        const offices = support.officeRows.slice().sort((x,y) => y.lateActions - x.lateActions || y.totalActions - x.totalActions).slice(0, 6);
        html += offices.length ? offices.map(o => `<div class="manager-mini-row ${o.lateActions ? 'danger' : 'ok'}" style="cursor:default;"><div class="manager-mini-title"><span>${escapeHtml(o.office)}</span><span>%${trendSafePct(o.completionRate)}</span></div><div class="manager-mini-meta">Toplam eylem: ${o.totalActions} | Tamamlanan: ${o.doneActions} | Gecikmiş: ${o.lateActions} | Etkilenen PQ: ${o.pqCount}</div></div>`).join('') : `<div class="manager-empty">Sorumlu ofis verisi bulunamadı.</div>`;
        html += `</div></div>`;

        html += `<div class="manager-section"><h3>⚠️ Yaklaşan ve Geçmiş Görev Uyarıları</h3><div class="manager-kpi-grid"><div class="manager-kpi"><b>${bundle.upcomingAllCount}</b><span>Yaklaşan görev</span></div><div class="manager-kpi"><b>${bundle.pastAllCount}</b><span>Geçmiş görev</span></div><div class="manager-kpi"><b>${new Set(getPastTasks(rawData, null).map(x => x.pq)).size}</b><span>Gecikmeden etkilenen PQ</span></div></div><div class="manager-list">`;
        const taskRows = bundle.past.slice(0,4).map(d => {
            let dt = parseDateObj(d.estDate), today = todayMidnight();
            let days = dt ? Math.ceil((today - dt) / 86400000) : '-';
            return { pq:d.pq, dateText: `${days} gün gecikti`, area:(pqMasterData[d.pq]||{}).alan, ce:(pqMasterData[d.pq]||{}).ce, owner:d.office, progressPct:0, remainingSteps:'-', master:pqMasterData[d.pq]||{} };
        }).concat(bundle.upcoming.slice(0,4).map(d => {
            let dt = parseDateObj(d.estDate), today = todayMidnight();
            let days = dt ? Math.ceil((dt - today) / 86400000) : '-';
            return { pq:d.pq, dateText: `${days} gün kaldı`, area:(pqMasterData[d.pq]||{}).alan, ce:(pqMasterData[d.pq]||{}).ce, owner:d.office, progressPct:0, remainingSteps:'-', master:pqMasterData[d.pq]||{} };
        }));
        html += taskRows.length ? taskRows.map(x => managerMiniRow(x, x.dateText.includes('gecikti') ? 'danger' : 'warn')).join('') : `<div class="manager-empty">Yaklaşan/geçmiş açık görev bulunamadı.</div>`;
        html += `</div></div>`;

        if (bundle.missingDateRows.length) {
            html += `<div class="manager-section"><h3>⚫ Tarih Yok / Planlama Kalitesi Riski</h3><div class="manager-list">` + bundle.missingDateRows.map(d => managerMiniRow({ pq:d.pq, dateText:'Tarih yok', area:(pqMasterData[d.pq]||{}).alan, ce:(pqMasterData[d.pq]||{}).ce, owner:d.office, progressPct:0, remainingSteps:'-', master:pqMasterData[d.pq]||{} }, 'danger')).join('') + `</div></div>`;
        }
        return html;
    }

    function buildSelectedPQReportHtml(bundle, includeHeading = true) {
        const reportPQs = bundle.selectedPQs || [];
        let html = includeHeading ? `<div class="manager-section"><h2>🔍 SEÇİLİ PQ RAPORU</h2>` : '';
        if (reportPQs.length === 0) {
            html += `<div class="manager-empty">Seçili PQ bulunmamaktadır. Detaylı CAP Listesi'nde “GÜNLÜK RAPORA EKLE” kutusunu işaretlediğinde bu bölüm dolacaktır.</div>`;
            return includeHeading ? html + `</div>` : html;
        }
        let lastArea = null;
        reportPQs.forEach(pq => {
            const items = bundle.selectedGroups[pq] || [];
            const m = pqMasterData[pq] || {};
            const usable = items.filter(isUsableCapStep);
            const isDone = m.isIcaoClosed || (usable.length > 0 && usable.every(x => getStatus(x).type === 'done'));
            const area = normalizeAreaKey(m.alan) || 'DİĞER';
            if (area !== lastArea) { html += `<h3 style="margin:16px 0 8px 0; color:var(--primary); border-bottom:1px solid var(--border); padding-bottom:5px;">${escapeHtml(area)} DENETİM ALANI</h3>`; lastArea = area; }
            const pqNote = dailyPQNotes[pq] || '';
            html += `<div class="review-card" style="border-left-color:${isDone ? 'var(--ok)' : 'var(--warn)'};"><div class="review-card-header"><span style="font-size:15px;">PQ ${escapeHtml(pq)} ${isDone ? '✅' : '⏳'}</span><span class="badge badge-extra">${escapeHtml(m.alan || 'N/A')}</span></div><div style="font-size:12px; color:var(--muted); margin-bottom:10px;"><b>CE:</b> ${escapeHtml(m.ce || '-')} | <b>Tür:</b> ${escapeHtml(m.tur || '-')} | <b>Sorumlu:</b> ${escapeHtml(m.sorumlu || '-')}</div>`;
            if (pqNote.trim()) html += `<div style="background:rgba(245,158,11,0.1);border-left:3px solid var(--warn);padding:8px 12px;margin-bottom:12px;font-size:13px;color:#92400e;border-radius:4px;"><b>📝 PQ Notu:</b> ${escapeHtml(pqNote).replace(/\n/g, '<br>')}</div>`;
            html += `<div style="background:var(--bg);padding:10px;border-radius:6px;font-size:12px;margin-bottom:10px;"><b>İlgili Bulgu:</b> ${escapeHtml(getLocalizedPqFinding(m) || (currentUiLang==='tr'?'Belirtilmemiş':'Not specified'))}</div>`;
            items.forEach(item => {
                const st = getStatus(item);
                html += `<div style="margin-bottom:8px;padding-bottom:8px;border-bottom:1px dashed var(--border);font-size:13px;"><div style="display:flex;justify-content:space-between;margin-bottom:4px;"><b>Adım ${escapeHtml(item.step)}</b><span style="color:var(--${st.color});font-weight:bold;font-size:11px;">${escapeHtml(st.label)}</span></div><div style="margin-bottom:4px;color:var(--text);">${escapeHtml(item.action || '')}</div><div style="display:flex;justify-content:space-between;font-size:11px;color:var(--muted);"><span>🏢 ${escapeHtml(item.office || '-')}</span><span>📅 Hedef: ${escapeHtml(item.estDate || '-')}</span></div>`;
                if (item.note) html += `<div style="margin-top:6px;font-size:11px;background:var(--bg);padding:6px;border-radius:4px;border-left:2px solid var(--primary);"><b>Not:</b> ${escapeHtml(item.note)}</div>`;
                html += `</div>`;
            });
            html += `</div>`;
        });
        return includeHeading ? html + `</div>` : html;
    }

    function updateReportPreview() {
        const noteEl = document.getElementById('managementNotes');
        const customNote = noteEl ? escapeHtml(noteEl.value || '') : '';
        const mode = getReportMode();
        const bundle = buildManagerReportBundle();
        let html = '';
        if (mode === 'auto') html = buildAutoManagerReportHtml(bundle, customNote);
        else if (mode === 'selected') html = buildSelectedPQReportHtml(bundle, true);
        else html = buildAutoManagerReportHtml(bundle, customNote) + buildSelectedPQReportHtml(bundle, true);

        const a = bundle.analysis;
        const phases = getManagerEiPhaseRows(bundle);
        const cmaa = phases[0], official = phases[1], local = phases[2], projected = phases[3];
        document.getElementById('reportPreview').innerHTML = html;
        document.getElementById('repCmaaFindings').innerText = cmaa.findings;
        document.getElementById('repOfficialFindings').innerText = official.findings;
        document.getElementById('repLocalFindings').innerText = local.expectedClosureCount || 0;
        document.getElementById('repProjectedEi').innerText = pctText(projected.ei);
        document.getElementById('repCmaaSub').innerHTML = `EI: ${pctText(cmaa.ei)}<br>${cmaa.satisfactoryText}`;
        document.getElementById('repOfficialSub').innerHTML = `EI: ${pctText(official.ei)}<br>Resmî validasyon`;
        document.getElementById('repLocalSub').innerHTML = `Beklenen EI: ${pctText(local.ei)}<br>${getManagerExpectedClosureSummary(bundle, 4)}`;
        document.getElementById('repProjectedSub').innerHTML = `Açık bulgu: ${projected.findings}<br>${a.stats.lateActions.total} gecikmiş adım`;
    }

    function copyReportToClipboard() { const previewEl = document.getElementById('reportPreview'); const range = document.createRange(); range.selectNode(previewEl); window.getSelection().removeAllRanges(); window.getSelection().addRange(range); try { document.execCommand('copy'); alert("Rapor panoya kopyalandı!"); } catch(err) { alert("Kopyalama başarısız oldu."); } window.getSelection().removeAllRanges(); }

    function truncateTextForExport(value, maxLen = 500) {
        let txt = (value === undefined || value === null ? '' : value.toString()).replace(/\s+/g, ' ').trim();
        return txt.length > maxLen ? txt.substring(0, maxLen) + '...' : txt;
    }

    function fullTextForPdf(value) {
        return (value === undefined || value === null ? '' : value.toString()).replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
    }


    function pdfCellSafe(cell) {
        if (cell === undefined || cell === null) return '';
        if (typeof cell === 'number' || typeof cell === 'boolean') return String(cell);
        if (typeof cell === 'string') return cell;
        if (Array.isArray(cell)) return cell.map(pdfCellSafe);
        if (typeof cell === 'object') {
            const out = Object.assign({}, cell);
            if ('text' in out && (out.text === undefined || out.text === null)) out.text = '';
            if (Array.isArray(out.text)) out.text = out.text.map(pdfCellSafe);
            if (out.ul && Array.isArray(out.ul)) out.ul = out.ul.map(pdfCellSafe);
            if (out.ol && Array.isArray(out.ol)) out.ol = out.ol.map(pdfCellSafe);
            if (out.stack && Array.isArray(out.stack)) out.stack = out.stack.map(pdfCellSafe);
            if (out.columns && Array.isArray(out.columns)) out.columns = out.columns.map(pdfCellSafe);
            if (out.table && out.table.body) out.table = normalizePdfTable(out.table);
            return out;
        }
        return String(cell);
    }

    function normalizePdfTable(table) {
        const out = Object.assign({}, table || {});
        let body = Array.isArray(out.body) ? out.body : [];
        body = body.map(row => Array.isArray(row) ? row.slice() : [row]);
        const currentWidthCount = Array.isArray(out.widths) ? out.widths.length : 0;
        const maxCols = Math.max(currentWidthCount, ...body.map(row => row.length), 1);
        if (Array.isArray(out.widths)) {
            out.widths = out.widths.slice();
            while (out.widths.length < maxCols) out.widths.push('*');
        } else {
            out.widths = Array(maxCols).fill('*');
        }
        out.body = body.map(row => {
            const fixed = row.map(pdfCellSafe);
            while (fixed.length < maxCols) fixed.push('');
            return fixed;
        });
        return out;
    }

    function normalizePdfNode(node) {
        if (node === undefined || node === null) return '';
        if (typeof node === 'string' || typeof node === 'number' || typeof node === 'boolean') return String(node);
        if (Array.isArray(node)) return node.map(normalizePdfNode);
        if (typeof node === 'object') {
            const out = Object.assign({}, node);
            if ('text' in out && (out.text === undefined || out.text === null)) out.text = '';
            if (Array.isArray(out.text)) out.text = out.text.map(pdfCellSafe);
            if (out.content) out.content = normalizePdfNode(out.content);
            if (out.stack) out.stack = normalizePdfNode(out.stack);
            if (out.columns) out.columns = normalizePdfNode(out.columns);
            if (out.ul) out.ul = normalizePdfNode(out.ul);
            if (out.ol) out.ol = normalizePdfNode(out.ol);
            if (out.table && out.table.body) out.table = normalizePdfTable(out.table);
            return out;
        }
        return String(node);
    }

    function pdfExportToast(message, isError = false) {
        let toast = document.getElementById('pdfExportToast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'pdfExportToast';
            toast.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:20050;max-width:420px;padding:12px 15px;border-radius:9px;color:#fff;font:600 13px Arial,sans-serif;box-shadow:0 10px 28px rgba(15,23,42,.28);transition:opacity .2s;';
            document.body.appendChild(toast);
        }
        toast.style.background = isError ? '#b91c1c' : '#1d4ed8';
        toast.textContent = message;
        toast.style.opacity = '1';
        clearTimeout(toast._hideTimer);
        toast._hideTimer = setTimeout(() => { toast.style.opacity = '0'; }, isError ? 7000 : 3500);
    }

    function printablePdfText(value) {
        return escapeHtml(fullTextForPdf(value) || '-').replace(/\n/g, '<br>');
    }

    function pdfNodeToPrintHtml(node) {
        if (node === undefined || node === null) return '';
        if (typeof node === 'string' || typeof node === 'number' || typeof node === 'boolean') return `<p>${printablePdfText(node)}</p>`;
        if (Array.isArray(node)) return node.map(pdfNodeToPrintHtml).join('');
        if (typeof node !== 'object') return '';
        if (node.table && Array.isArray(node.table.body)) {
            const rows = node.table.body.map((row, rowIndex) => {
                const cells = (Array.isArray(row) ? row : [row]).map(cell => {
                    const raw = cell && typeof cell === 'object' && 'text' in cell ? cell.text : cell;
                    const tag = rowIndex === 0 ? 'th' : 'td';
                    const colspan = cell && typeof cell === 'object' && cell.colSpan ? ` colspan="${cell.colSpan}"` : '';
                    return `<${tag}${colspan}>${printablePdfText(Array.isArray(raw) ? raw.map(x => x && x.text !== undefined ? x.text : x).join(' ') : raw)}</${tag}>`;
                }).join('');
                return `<tr>${cells}</tr>`;
            }).join('');
            return `<table>${rows}</table>`;
        }
        if (node.stack) return `<section>${pdfNodeToPrintHtml(node.stack)}</section>`;
        if (node.content) return pdfNodeToPrintHtml(node.content);
        if (node.columns) return `<div class="columns">${node.columns.map(c => `<div>${pdfNodeToPrintHtml(c)}</div>`).join('')}</div>`;
        if (node.ul) return `<ul>${node.ul.map(x => `<li>${pdfNodeToPrintHtml(x)}</li>`).join('')}</ul>`;
        if (node.ol) return `<ol>${node.ol.map(x => `<li>${pdfNodeToPrintHtml(x)}</li>`).join('')}</ol>`;
        if ('text' in node) {
            const text = Array.isArray(node.text) ? node.text.map(x => x && x.text !== undefined ? x.text : x).join(' ') : node.text;
            const className = node.style === 'header' ? 'report-title' : (node.style === 'sectionHeader' ? 'section-title' : 'text-node');
            return `<div class="${className}">${printablePdfText(text)}</div>`;
        }
        return '';
    }

    function openGenericPdfPrintFallback(docDef, fileName, reason) {
        const title = (fileName || 'Rapor.pdf').replace(/\.pdf$/i, '').replace(/_/g, ' ');
        const contentHtml = pdfNodeToPrintHtml((docDef || {}).content || []);
        const html = `<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><title>${escapeHtml(title)}</title><style>
            @page{size:A4 landscape;margin:12mm}body{font-family:Arial,Helvetica,sans-serif;color:#0f172a;font-size:9pt;margin:0}.report-title{font-size:18pt;font-weight:700;color:#1d4ed8;margin:0 0 5px}.section-title{font-size:12pt;font-weight:700;margin:14px 0 6px;color:#0f172a}.text-node,p{margin:3px 0 7px;line-height:1.35}table{width:100%;border-collapse:collapse;table-layout:fixed;margin:4px 0 12px;page-break-inside:auto}tr{page-break-inside:avoid}th,td{border:1px solid #cbd5e1;padding:5px;vertical-align:top;word-break:break-word;white-space:normal}th{background:#e2e8f0;font-weight:700}.columns{display:flex;gap:8px}.columns>div{flex:1}section{page-break-inside:avoid}@media print{.no-print{display:none!important}}
        

/* Ziyaret ve İç Denetim - Paket 5: Ziyaret Raporları */
.visit-report-shell{display:grid;gap:14px}.visit-report-header{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;background:var(--card);border:1px solid var(--border);border-radius:12px;padding:18px}.visit-report-header h3{margin:0;color:var(--primary);font-size:18px}.visit-report-header p{margin:5px 0 0;color:var(--muted);font-size:12px;max-width:900px;line-height:1.5}.visit-report-actions{display:flex;gap:8px;flex-wrap:wrap}.visit-report-toolbar{display:grid;grid-template-columns:minmax(230px,1.15fr) minmax(220px,1fr) 150px 155px minmax(190px,.9fr) auto;gap:9px;align-items:end;background:var(--card);border:1px solid var(--border);border-radius:10px;padding:12px}.visit-report-toolbar label{display:block;font-size:10px;font-weight:800;color:var(--muted);margin-bottom:4px}.visit-report-toolbar select,.visit-report-toolbar input{width:100%;box-sizing:border-box}.visit-report-kpis{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:9px}.visit-report-kpi{background:var(--card);border:1px solid var(--border);border-top:4px solid var(--primary);border-radius:10px;padding:11px;min-width:0}.visit-report-kpi strong{display:block;font-size:22px;line-height:1.1;overflow:hidden;text-overflow:ellipsis}.visit-report-kpi span{display:block;color:var(--muted);font-size:9px;font-weight:800;text-transform:uppercase;margin-top:5px;line-height:1.25}.visit-report-kpi.danger{border-top-color:var(--danger)}.visit-report-kpi.warn{border-top-color:var(--warn)}.visit-report-kpi.ok{border-top-color:var(--ok)}.visit-report-kpi.info{border-top-color:var(--icao-blue)}.visit-report-kpi.purple{border-top-color:#7c3aed}.visit-report-layout{display:grid;grid-template-columns:minmax(280px,.72fr) minmax(560px,1.28fr);gap:12px;align-items:start}.visit-report-panel{background:var(--card);border:1px solid var(--border);border-radius:10px;min-width:0;overflow:hidden}.visit-report-panel-head{padding:12px 14px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;gap:10px}.visit-report-panel-head h4{margin:0;color:var(--primary);font-size:14px}.visit-report-template-list{padding:10px;display:grid;gap:8px}.visit-report-template{width:100%;text-align:left;background:var(--card);color:var(--text);border:1px solid var(--border);border-left:5px solid var(--primary);border-radius:9px;padding:10px;cursor:pointer}.visit-report-template:hover,.visit-report-template.active{background:rgba(37,99,235,.07);border-color:var(--primary)}.visit-report-template b{display:block;font-size:11px}.visit-report-template span{display:block;color:var(--muted);font-size:9.5px;line-height:1.45;margin-top:3px}.visit-report-preview{padding:14px;display:grid;gap:12px;max-height:850px;overflow:auto}.visit-report-summary{background:linear-gradient(135deg,rgba(37,99,235,.08),rgba(16,185,129,.06));border:1px solid rgba(37,99,235,.18);border-radius:10px;padding:13px;font-size:11px;line-height:1.6}.visit-report-preview-section{border:1px solid var(--border);border-radius:9px;overflow:hidden}.visit-report-preview-section h5{margin:0;padding:9px 11px;background:var(--kanban-bg);border-bottom:1px solid var(--border);color:var(--primary);font-size:12px}.visit-report-preview-body{padding:10px;display:grid;gap:7px}.visit-report-preview-row{display:grid;grid-template-columns:130px 1fr;gap:8px;font-size:10.5px;line-height:1.45}.visit-report-preview-row b{color:var(--muted)}.visit-report-preview-item{border:1px solid var(--border);border-left:4px solid var(--primary);border-radius:7px;padding:8px;font-size:10px;line-height:1.45}.visit-report-preview-item.danger{border-left-color:var(--danger)}.visit-report-preview-item.warn{border-left-color:var(--warn)}.visit-report-preview-item.ok{border-left-color:var(--ok)}.visit-report-preview-item .meta{font-size:9px;color:var(--muted);margin-top:3px}.visit-report-empty{padding:30px;text-align:center;color:var(--muted);font-size:11px}.visit-report-context{font-size:10px;color:var(--muted);background:var(--kanban-bg);border:1px solid var(--border);padding:5px 8px;border-radius:7px}.visit-report-checkbox{display:flex!important;gap:7px;align-items:center;margin:0!important;font-size:10px!important;color:var(--text)!important}.visit-report-checkbox input{width:auto!important}
@media(max-width:1300px){.visit-report-kpis{grid-template-columns:repeat(4,minmax(0,1fr))}.visit-report-toolbar{grid-template-columns:1fr 1fr 1fr}.visit-report-layout{grid-template-columns:1fr}.visit-report-preview{max-height:none}}
@media(max-width:700px){.visit-report-header{flex-direction:column}.visit-report-actions{width:100%}.visit-report-actions button{flex:1;justify-content:center}.visit-report-toolbar{grid-template-columns:1fr}.visit-report-kpis{grid-template-columns:1fr 1fr}.visit-report-preview-row{grid-template-columns:1fr}.visit-report-template-list{grid-template-columns:1fr}.visit-report-panel-head{align-items:flex-start;flex-direction:column}}

</style></head><body><div class="no-print" style="background:#fff7ed;border:1px solid #fdba74;padding:10px;margin-bottom:12px"><b>PDF yedek görünümü:</b> Yazdırma penceresinde hedef olarak “PDF olarak kaydet” seçeneğini kullanın.${reason ? '<br>'+escapeHtml(String(reason.message || reason)) : ''}</div>${contentHtml}<script>window.addEventListener('load',()=>setTimeout(()=>{window.focus();window.print();},350));<\/script></body></html>`;
        const frame = document.createElement('iframe');
        frame.setAttribute('aria-hidden','true');
        frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:1200px;height:900px;border:0;';
        document.body.appendChild(frame);
        frame.onload = () => setTimeout(() => frame.remove(), 120000);
        frame.srcdoc = html;
        pdfExportToast('Doğrudan PDF indirilemedi. Tarayıcının “PDF olarak kaydet” ekranı açılıyor.', true);
    }

    function triggerPdfBlobDownload(blob, fileName) {
        if (!(blob instanceof Blob) || blob.size === 0) throw new Error('PDF dosyası oluşturulamadı veya boş döndü.');
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName || 'Rapor.pdf';
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        setTimeout(() => { URL.revokeObjectURL(url); link.remove(); }, 1500);
    }

    function safeDownloadPdf(docDef, fileName) {
        const targetName = fileName || 'Rapor.pdf';
        const safeDocDef = normalizePdfNode(docDef || {});
        pdfExportToast('PDF hazırlanıyor...');
        if (typeof pdfMake === 'undefined' || !pdfMake || typeof pdfMake.createPdf !== 'function') {
            openGenericPdfPrintFallback(safeDocDef, targetName, new Error('PDF kütüphanesi yüklenemedi.'));
            return Promise.resolve(false);
        }
        return new Promise(resolve => {
            let settled = false;
            const finishSuccess = blob => {
                if (settled) return;
                settled = true;
                clearTimeout(timeoutId);
                try {
                    triggerPdfBlobDownload(blob, targetName);
                    pdfExportToast('PDF indirildi: ' + targetName);
                    resolve(true);
                } catch (error) {
                    console.error('PDF blob indirme hatası:', error);
                    openGenericPdfPrintFallback(safeDocDef, targetName, error);
                    resolve(false);
                }
            };
            const finishFailure = error => {
                if (settled) return;
                settled = true;
                clearTimeout(timeoutId);
                console.error('PDF oluşturma hatası:', error);
                openGenericPdfPrintFallback(safeDocDef, targetName, error);
                resolve(false);
            };
            const timeoutId = setTimeout(() => finishFailure(new Error('PDF oluşturma işlemi 30 saniye içinde tamamlanamadı.')), 30000);
            try {
                const pdfDoc = pdfMake.createPdf(safeDocDef);
                if (!pdfDoc || typeof pdfDoc.getBlob !== 'function') {
                    finishFailure(new Error('PDF blob oluşturma işlevine erişilemedi.'));
                    return;
                }
                const maybePromise = pdfDoc.getBlob(finishSuccess);
                if (maybePromise && typeof maybePromise.then === 'function') maybePromise.then(finishSuccess).catch(finishFailure);
            } catch (error) {
                finishFailure(error);
            }
        });
    }

    function normalizeWorkbookSheetName(name) {
        return (name || 'Sayfa').toString().replace(/[\\\/\?\*\[\]\:]/g, '_').substring(0, 31);
    }

    function autoFitSheet(ws, rows) {
        if (!rows || rows.length === 0) return;
        const headers = Object.keys(rows[0]);
        ws['!cols'] = headers.map(h => {
            let maxLen = Math.max(h.length, ...rows.map(r => (r[h] === undefined || r[h] === null ? '' : r[h].toString()).length));
            return { wch: Math.min(Math.max(maxLen + 2, 10), 55) };
        });
        if (ws['!ref']) ws['!autofilter'] = { ref: ws['!ref'] };
    }

    function addJsonSheet(wb, name, rows) {
        const safeRows = rows && rows.length ? rows : [{ 'Bilgi': 'Kayıt bulunamadı' }];
        const ws = XLSX.utils.json_to_sheet(safeRows);
        autoFitSheet(ws, safeRows);
        XLSX.utils.book_append_sheet(wb, ws, normalizeWorkbookSheetName(name));
        return ws;
    }


    // ================================================================
    // ORTAK TABLO / RAPOR BILESENLERI
    // ================================================================
    function createReportWorkbook(ctx = {}) {
        const wb = XLSX.utils.book_new();
        wb.Props = {
            Title: ctx.title || 'USOAP CMA Raporu',
            Subject: ctx.subject || 'USOAP CMA CAP İzleme',
            Author: ctx.author || 'ICAO CAP İzleme',
            CreatedDate: new Date()
        };
        return wb;
    }

    function createSheetDefinition(name, rows) { return { name, rows: rows || [] }; }

    function appendWorkbookSheets(wb, definitions) {
        (definitions || []).forEach(def => {
            if (!def || !def.name) return;
            addJsonSheet(wb, def.name, def.rows || []);
        });
        return wb;
    }

    function downloadReportWorkbook(wb, fileName) {
        XLSX.writeFile(wb, fileName || 'USOAP_CMA_Raporu.xlsx');
    }

    function appendPdfTableSection(sections, title, rows, columns, widths, options = {}) {
        sections.push({ text: title, style: options.titleStyle || 'sectionHeader' });
        sections.push(...makePdfTableFromObjects(rows, columns, widths, options));
        return sections;
    }

    function buildPdfKpiGrid(summaryRows, columnCount = 4) {
        const items = Array.isArray(summaryRows) ? summaryRows : [];
        const body = [];
        for (let i = 0; i < items.length; i += columnCount) {
            const row = items.slice(i, i + columnCount).map(item => {
                const metric = item['Metrik'] || item['Başlık'] || '-';
                const value = item['Değer'] === undefined ? '-' : item['Değer'];
                return { text:[{text:metric+'\n',bold:true,fontSize:8,color:'#64748b'},{text:String(value),bold:true,fontSize:13,color:'#0f172a'}], fillColor:'#f8fafc', margin:[6,6,6,6] };
            });
            while (row.length < columnCount) row.push({text:'',fillColor:'#ffffff'});
            body.push(row);
        }
        if (!body.length) {
            const row=[{text:'Özet üretilemedi',fillColor:'#f8fafc'}];
            while(row.length<columnCount) row.push({text:'',fillColor:'#ffffff'});
            body.push(row);
        }
        return body;
    }

    function createStandardPdfDefinition(content, options = {}) {
        return {
            pageOrientation: options.pageOrientation || 'landscape',
            pageSize: options.pageSize || 'A4',
            content: content || [],
            footer: (currentPage,pageCount)=>({text:currentPage+' / '+pageCount,alignment:'right',margin:[0,0,25,0],fontSize:8,color:'#64748b'}),
            styles: Object.assign({
                header:{fontSize:17,bold:true,color:'#2563eb',margin:[0,0,0,4]},
                subheader:{fontSize:9,color:'#64748b',margin:[0,0,0,12]},
                sectionHeader:{fontSize:12,bold:true,color:'#0f172a',margin:[0,8,0,6]},
                noteBox:{fontSize:10,color:'#0f172a',fillColor:'#f8fafc',margin:[0,0,0,10]},
                th:{bold:true,fontSize:8,fillColor:'#f1f5f9',margin:[0,3,0,3]}
            }, options.styles || {}),
            defaultStyle:Object.assign({font:'Roboto',fontSize:8},options.defaultStyle||{})
        };
    }

    function renderHtmlTableRows(rows, columns, options = {}) {
        const source = Array.isArray(rows) ? rows : [];
        if (!source.length) return `<tr><td colspan="${options.colspan || columns.length}" class="${options.emptyClass || ''}">${escapeHtml(options.emptyText || 'Kayıt bulunamadı.')}</td></tr>`;
        return source.map((row,index)=>{
            const rowAttrs = typeof options.rowAttrs === 'function' ? (options.rowAttrs(row,index)||'') : '';
            const cells = columns.map(column=>{
                const value = typeof column.render === 'function' ? column.render(row,index) : row[column.key];
                const attrs = typeof column.attrs === 'function' ? (column.attrs(row,index)||'') : (column.attrs||'');
                const html = column.rawHtml ? String(value ?? '') : escapeHtml(String(value ?? ''));
                return `<td${attrs ? ' '+attrs : ''}>${html}</td>`;
            }).join('');
            return `<tr${rowAttrs ? ' '+rowAttrs : ''}>${cells}</tr>`;
        }).join('');
    }

    function buildActionExportRow(d, options = {}) {
        const m = pqMasterData[d.pq] || {};
        const classification = getCommonActionClassification(d);
        const daysDiff = classification.targetDate
            ? (classification.code === COMMON_ACTION_STATUS.LATE.code ? -classification.delayDays : classification.daysRemaining)
            : '';
        const row = {
            'PQ': d.pq,
            'Denetim Alanı': m.alan || 'DİĞER',
            'CE': m.ce || '',
            'Doğrulama Türü': m.tur || '',
            'PQ Sorumlusu': m.sorumlu || '',
            'ICAO Değerlendirmesi': m.degerlendirme || '',
            'Adım': d.step,
            'Eylem / CAP Adımı': truncateTextForExport(d.action, options.longText ? 1200 : 500),
            'Eylem Ofisi': d.office || '',
            'Hedef Tarih': d.estDate || '',
            'Durum': classification.label,
            'Durum Kodu': classification.code,
            'Progress': d.progress || '',
            'Gün Farkı': daysDiff,
            'Not': truncateTextForExport(d.note || '', 600),
            'Bulgu': truncateTextForExport(m.bulgu || '', options.longText ? 1200 : 700)
        };
        if (options.mode === 'upcoming') row['Kalan Gün'] = classification.daysRemaining === null ? '' : classification.daysRemaining;
        if (options.mode === 'past') row['Gecikme Günü'] = classification.delayDays;
        return row;
    }
    function buildExecutiveSummaryRows(scopeRows) {
        const rows = scopeRows || getFilteredData();
        const analytics = buildCommonCalculationModel(rows, { includeEI: true, eiRows: rawData });
        const model = analytics.ei;
        const currentEI = model && model.scope.total ? pctText(ratioPct(getBucketCurrentSat(model.scope), model.scope.total)) : 'EI verisi yok';
        const projectedEI = model && model.scope.total ? pctText(ratioPct(getBucketProjectedSat(model.scope), model.scope.total)) : 'EI verisi yok';
        const reportDate = window_loadedReportDate ? window_loadedReportDate.toLocaleDateString('tr-TR') : new Date().toLocaleDateString('tr-TR');
        return [
            { 'Metrik': 'Rapor Tarihi', 'Değer': reportDate, 'Açıklama': 'Yüklenen Word export tarihi veya bugünün tarihi' },
            { 'Metrik': 'Kapsanan PQ', 'Değer': analytics.pq.total, 'Açıklama': 'Filtre / ekran kapsamındaki benzersiz PQ sayısı' },
            { 'Metrik': 'Toplam CAP Adımı', 'Değer': analytics.actions.total, 'Açıklama': 'Filtre / ekran kapsamındaki eylem adımı sayısı' },
            { 'Metrik': 'Tamamlanan Adım', 'Değer': analytics.status.done.total, 'Açıklama': 'Progress tamamlandı/100 kabul edilen adımlar' },
            { 'Metrik': 'Devam Eden Adım', 'Değer': analytics.status.pending.total, 'Açıklama': 'Hedef tarihi geçmemiş açık adımlar' },
            { 'Metrik': 'Gecikmiş Adım', 'Değer': analytics.status.late.total, 'Açıklama': 'Hedef tarihi geçmiş ve tamamlanmamış adımlar' },
            { 'Metrik': 'CMAA Overall EI', 'Değer': model && model.scope.total ? pctText(ratioPct(model.scope.baseSatOnly, model.scope.total)) : 'EI verisi yok', 'Açıklama': 'Resmi CMAA başlangıç EI' },
            { 'Metrik': 'ICAO Validasyon Sonrası Resmi EI', 'Değer': model && model.scope.total ? pctText(ratioPct(getBucketAfterValidationSat(model.scope), model.scope.total)) : 'EI verisi yok', 'Açıklama': 'Resmi validasyon sonrası EI' },
            { 'Metrik': 'CAP Tamamlanmışlar Dahil Beklenen EI', 'Değer': currentEI, 'Açıklama': 'CMAA + ICAO validasyonları + tüm adımları tamamlanmış CAP PQ yansıması' },
            { 'Metrik': 'Tüm CAP Projeksiyon EI', 'Değer': projectedEI, 'Açıklama': 'Mevcut tüm CAP havuzu tamamlanırsa oluşacak tahmini EI' }
        ];
    }

    function buildAreaExportRows(scopeRows) {
        const rows = scopeRows || getFilteredData();
        let fullRows = expandFilteredRowsToFullPqGroups(rows);
        if (fullRows.length === 0 && rows.length > 0) fullRows = rows;
        const analytics = buildCommonCalculationModel(fullRows, {
            normalizeAreas: true,
            useUsableStepsForPqCompletion: true
        });
        return Object.values(analytics.areas).sort((a,b) => sortAreas(a.area,b.area)).map(a => ({
            'Denetim Alanı': a.area,
            'PQ Sayısı': a.total,
            'Tamamlanan PQ': a.done,
            'Açık PQ': a.ongoing,
            'CAP Adımı': a.actions,
            'Tamamlanan Adım': a.actionDone,
            'Devam Eden Adım': a.actionPending,
            'Gecikmiş Adım': a.actionLate,
            'PQ İlerleme %': a.total ? ((a.done / a.total) * 100).toFixed(2) : '0.00'
        }));
    }

    function buildPQExportRows(scopeRows) {
        let rows = scopeRows || getFilteredData();
        let fullRows = expandFilteredRowsToFullPqGroups(rows);
        if (fullRows.length === 0 && rows.length > 0) fullRows = rows;
        let groups = groupRowsByPQ(fullRows);
        return Object.keys(groups).sort((a,b) => sortAreas((pqMasterData[a]||{}).alan||'', (pqMasterData[b]||{}).alan||'') || sortPQs(a,b)).map(pq => {
            let m = pqMasterData[pq] || {};
            let items = groups[pq];
            let usable = items.filter(isUsableCapStep);
            let actionStates = usable.map(x => classifyCommonActionStatus(x));
            let done = actionStates.filter(x => x.code === COMMON_ACTION_STATUS.COMPLETED.code).length;
            let late = actionStates.filter(x => x.code === COMMON_ACTION_STATUS.LATE.code).length;
            let nextDates = actionStates.map(x => x.targetDate).filter(Boolean).sort((a,b) => a-b);
            let closure = getPQClosureInfo(pq, items);
            return {
                'PQ': pq,
                'Denetim Alanı': m.alan || 'DİĞER',
                'CE': m.ce || '',
                'Doğrulama Türü': m.tur || '',
                'PQ Sorumlusu': m.sorumlu || '',
                'ICAO Kapattı mı': m.isIcaoClosed ? 'EVET' : 'HAYIR',
                'Validasyon Görevi': m.validasyonGorevi || '',
                'CAP Adımı': usable.length,
                'Tamamlanan Adım': done,
                'Gecikmiş Adım': late,
                'PQ İlerleme %': usable.length ? ((done / usable.length) * 100).toFixed(2) : '0.00',
                'PQ Durumu': m.isIcaoClosed ? 'ICAO KAPATTI' : (usable.length > 0 && done === usable.length ? 'TAMAMLANDI' : 'AÇIK'),
                'Öngörülen PQ Kapanış Tarihi': closure.closureDate ? formatExactDate(closure.closureDate) : '',
                'İlk Hedef Tarih': nextDates[0] ? formatExactDate(nextDates[0]) : '',
                'Son Hedef Tarih': nextDates[nextDates.length - 1] ? formatExactDate(nextDates[nextDates.length - 1]) : '',
                'Bulgu': truncateTextForExport(m.bulgu || '', 900)
            };
        });
    }

    function buildManagerReportExcelRows(bundle) {
        const a = bundle.analysis;
        const support = bundle.support;
        const phases = getManagerEiPhaseRows(bundle);
        const expectedSummary = getManagerExpectedClosureSummary(bundle, 20);
        const phaseRows = phases.map(r => ({
            'Başlık': r.title,
            'Değer': r.key === 'local' ? (r.expectedClosureCount || 0) : pctText(r.ei),
            'EI': pctText(r.ei),
            'Açık Bulgu': r.findings,
            'Satisfactory': r.satisfactoryText,
            'Durum': r.source,
            'Açıklama': r.key === 'local' ? `${r.note} Alan kırılımı: ${expectedSummary}` : r.note
        }));
        return phaseRows.concat([
            { 'Başlık': 'ICAO validasyonlarıyla resmî kapanış', 'Değer': Math.max(0, phases[0].findings - phases[1].findings), 'EI': pctText(phases[1].ei), 'Açık Bulgu': phases[1].findings, 'Satisfactory': phases[1].satisfactoryText, 'Durum': 'Resmî', 'Açıklama': 'CMAA bulgusundan ICAO validasyon sonrası açık bulguya düşüş' },
            { 'Başlık': 'Kapatılması Beklenen Bulgu', 'Değer': phases[2].expectedClosureCount || 0, 'EI': pctText(phases[2].ei), 'Açık Bulgu': phases[2].findings, 'Satisfactory': phases[2].satisfactoryText, 'Durum': 'Beklenti', 'Açıklama': `Tüm CAP adımları biten ancak henüz ICAO validasyonu bekleyen PQ/bulgu etkisi. Alan kırılımı: ${expectedSummary}` },
            { 'Başlık': 'Gecikmiş eylem', 'Değer': a.stats.lateActions.total, 'EI': '', 'Açık Bulgu': '', 'Satisfactory': '', 'Durum': 'Risk', 'Açıklama': 'Hedef tarihi geçmiş açık CAP adımı' },
            { 'Başlık': 'Tarih riski', 'Değer': bundle.missingDateAllCount, 'EI': '', 'Açık Bulgu': '', 'Satisfactory': '', 'Durum': 'Risk', 'Açıklama': 'Hedef tarihi eksik/geçersiz açık CAP adımı' },
            { 'Başlık': 'Kritik yol adayı', 'Değer': support.briefing.latestCritical ? `PQ ${support.briefing.latestCritical.pq}` : '-', 'EI': '', 'Açık Bulgu': '', 'Satisfactory': '', 'Durum': 'Öncelik', 'Açıklama': support.briefing.latestCritical ? formatTrendDate(support.briefing.latestCritical.latestDate) : '' },
            { 'Başlık': 'Darboğaz', 'Değer': support.briefing.bottleneck ? support.briefing.bottleneck.office : '-', 'EI': '', 'Açık Bulgu': '', 'Satisfactory': '', 'Durum': 'Öncelik', 'Açıklama': support.briefing.bottleneck ? `${support.briefing.bottleneck.lateActions} gecikmiş eylem` : '' }
        ]);
    }

    function buildManagerExpectedClosureExcelRows(bundle) {
        return getManagerExpectedClosureAreaRows(bundle).map(r => ({
            'Denetim Alanı': r.area,
            'Kapatılması Beklenen Bulgu': r.count,
            'Resmî Açık Bulgu': r.officialOpenFindings,
            'Kapanış Sonrası Açık Bulgu': r.expectedOpenFindings,
            'Resmî EI': pctText(r.officialEI),
            'Beklenen EI': pctText(r.expectedEI),
            'Uygulanabilir Toplam PQ': r.total
        }));
    }

    function buildManagerExpectedClosurePQExcelRows(bundle) {
        const a = bundle.analysis || {};
        return (a.stats && a.stats.closedPqItems ? a.stats.closedPqItems : [])
            .filter(i => i.source === 'CAP Tamamlandı')
            .sort((x,y) => sortAreas(x.area, y.area) || sortPQs(x.pq, y.pq))
            .map(i => ({
                'PQ': i.pq,
                'Denetim Alanı': i.area,
                'CE': i.ce,
                'Doğrulama Türü': i.tur,
                'Kaynak': i.source,
                'Validasyon Görevi': i.validationTask || '',
                'Bulgu': truncateTextForExport(i.bulgu || '', 1200)
            }));
    }

    function buildKanbanExportRows(rows, mode = 'step') {
        if (mode === 'pq') {
            return buildKanbanPQItems(rows).map(i => ({
                'PQ': i.pq, 'Kolon': i.label, 'Standart PQ Durumu': i.pqStatusLabel || i.label, 'PQ Durum Kodu': i.pqStatusCode || '', 'Denetim Alanı': (i.master || {}).alan || '', 'CE': (i.master || {}).ce || '', 'Tür': (i.master || {}).tur || '', 'Sorumlu': i.offices || (i.master || {}).sorumlu || '',
                'Toplam Adım': i.total, 'Tamamlanan Adım': i.done, 'Kalan Adım': i.remaining, 'Gecikmiş Adım': i.late, 'Tarih Eksik Adım': i.missing, 'İlerleme %': i.progressPct.toFixed(2), 'Alan EI Katkısı %': i.areaContributionPct.toFixed(2),
                'İlk Açık / Kilit Tarih': i.earliestOpenDate ? formatExactDate(i.earliestOpenDate) : '', 'Son Hedef Tarih': i.latestDate ? formatExactDate(i.latestDate) : '', 'Baskın İç Süreç': summarizeKanbanWorkflowStages(i.usable).top, 'Bulgu': (i.master || {}).bulgu || ''
            }));
        }
        return (rows || []).map(d => {
            const m = pqMasterData[d.pq] || {};
            const st = getKanbanActionStatus(d);
            const classification = st.common || getCommonActionClassification(d);
            const days = getKanbanDaysInfo(d, st.type);
            return {
                'PQ': d.pq, 'Kolon': st.label, 'Standart Adım Durumu': classification.label, 'Adım Durum Kodu': classification.code, 'Denetim Alanı': m.alan || '', 'CE': m.ce || '', 'Tür': m.tur || '', 'PQ Sorumlusu': m.sorumlu || '', 'Adım': d.step,
                'Eylem': d.action || '', 'Eylem Ofisi': d.office || '', 'Hedef Tarih': d.estDate || '', 'Gün Bilgisi': days.label, 'Gecikme Günü': classification.delayDays || 0, 'Kalan Gün': classification.daysRemaining === null ? '' : classification.daysRemaining, 'İç Süreç Aşaması': getKanbanWorkflowStage(d.pq, d.step), 'Progress': d.progress || '', 'Bulgu': m.bulgu || ''
            };
        });
    }
    function stripHtmlForReport(value) {
        return (value === undefined || value === null ? '' : value.toString())
            .replace(/<br\s*\/?>/gi, ' | ')
            .replace(/<[^>]*>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/\s+/g, ' ')
            .trim();
    }

    function fullTextForExcel(value) {
        let txt = (value === undefined || value === null ? '' : value.toString()).replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
        return txt.length > 32000 ? txt.substring(0, 32000) + '\n...[Excel hucre siniri nedeniyle metin kisaltilmistir]' : txt;
    }

    function buildActionExportRowFull(d, options = {}) {
        let row = buildActionExportRow(d, options);
        let m = pqMasterData[d.pq] || {};
        row['Eylem / CAP Adımı'] = fullTextForExcel(d.action || '');
        row['Bulgu'] = fullTextForExcel(m.bulgu || '');
        row['Not'] = fullTextForExcel(d.note || '');
        return row;
    }

    function getReportDateText() {
        return formatLongTurkishDate(window_loadedReportDate || new Date());
    }

    function buildFilterContextRows(ctx) {
        const activeTabTitle = (document.querySelector('.tab-btn.active') || {}).innerText || ctx.title || '';
        return [
            { 'Başlık': 'Rapor', 'Değer': ctx.title || '' },
            { 'Başlık': 'Aktif Menü', 'Değer': activeTabTitle.replace(/\s+/g, ' ').trim() },
            { 'Başlık': 'Veri Tarihi', 'Değer': getReportDateText() },
            { 'Başlık': 'Ekran Kayıt Sayısı', 'Değer': (ctx.rows || []).length },
            { 'Başlık': 'Benzersiz PQ', 'Değer': new Set((ctx.rows || []).map(d => d.pq).filter(Boolean)).size },
            { 'Başlık': 'Görünüm', 'Değer': ctx.viewLabel || ctx.mode || '-' },
            { 'Başlık': 'Kapsam', 'Değer': ctx.rangeLabel || 'Aktif ekran filtreleri' }
        ];
    }

    function getDateRiskRows(rows) {
        return buildCommonCalculationModel(rows || []).dateRiskRows
            .slice()
            .sort((a,b) => sortAreas((pqMasterData[a.pq]||{}).alan||'', (pqMasterData[b.pq]||{}).alan||'') || sortPQs(a.pq,b.pq));
    }

    function taskDayValue(d, mode) {
        const classification = getCommonActionClassification(d);
        if (!classification.targetDate) return null;
        return mode === 'past' ? classification.delayDays : classification.daysRemaining;
    }
    function getTopDelayedRows(rows, limit = 30) {
        return buildCommonTaskTrackingModel(rows || [], { upcomingDays: 30 }).late
            .slice()
            .sort((a, b) => commonTaskRowSort(a, b, 'past'))
            .map(item => item.row)
            .slice(0, limit);
    }

    function getTopUpcomingRows(rows, limit = 30) {
        const tasks = getUpcomingTasks(rows || getFilteredData());
        return tasks.slice(0, limit);
    }

    function buildDelayBucketRows(tasks, mode = 'past') {
        const buckets = mode === 'past' ? [
            { key:'1-30', label:'1-30 gün gecikmiş', min:1, max:30 },
            { key:'31-90', label:'31-90 gün gecikmiş', min:31, max:90 },
            { key:'91-180', label:'91-180 gün gecikmiş', min:91, max:180 },
            { key:'180+', label:'180+ gün gecikmiş', min:181, max:Infinity }
        ] : [
            { key:'0-7', label:'0-7 gün kaldı', min:0, max:7 },
            { key:'8-15', label:'8-15 gün kaldı', min:8, max:15 },
            { key:'16-30', label:'16-30 gün kaldı', min:16, max:30 }
        ];
        return buckets.map(b => {
            const rows = (tasks || []).filter(d => {
                const val = taskDayValue(d, mode);
                return val !== null && val >= b.min && val <= b.max;
            });
            return { 'Dilim': b.label, 'Eylem Sayısı': rows.length, 'Etkilenen PQ': new Set(rows.map(d => d.pq)).size, 'Alan Sayısı': new Set(rows.map(d => (pqMasterData[d.pq]||{}).alan || 'DİĞER')).size };
        });
    }

    function buildTaskOfficeSummaryRows(tasks, mode = 'past') {
        const map = {};
        (tasks || []).forEach(d => {
            const office = (d.office || 'Belirtilmedi').trim() || 'Belirtilmedi';
            if (!map[office]) map[office] = { office, total:0, pqs:new Set(), maxDays:0, sumDays:0, dayCount:0 };
            const rec = map[office];
            rec.total++;
            rec.pqs.add(d.pq);
            const val = taskDayValue(d, mode);
            if (val !== null) { rec.maxDays = Math.max(rec.maxDays, val); rec.sumDays += val; rec.dayCount++; }
        });
        return Object.values(map).sort((a,b) => b.total - a.total || b.maxDays - a.maxDays || a.office.localeCompare(b.office, 'tr')).map(r => ({
            'Sorumlu Ofis': r.office,
            'Eylem Sayısı': r.total,
            'Etkilenen PQ': r.pqs.size,
            [mode === 'past' ? 'En Yüksek Gecikme' : 'En Yakın/Kritik Gün']: r.maxDays,
            [mode === 'past' ? 'Ortalama Gecikme' : 'Ortalama Kalan Gün']: r.dayCount ? Math.round(r.sumDays / r.dayCount) : ''
        }));
    }

    function buildEIOverviewRows(sourceRows) {
        if (!Object.keys(baseEIData).length) return [];
        const model = buildEIProjectionModel(sourceRows || rawData);
        const rows = [];
        const pushBucket = (key, bucket) => {
            if (!bucket || !bucket.total) return;
            rows.push({
                'Kapsam': key,
                'Toplam Uygulanabilir PQ': bucket.total,
                'CMAA Satisfactory': bucket.baseSatOnly,
                'CMAA EI': pctText(ratioPct(bucket.baseSatOnly, bucket.total)),
                'ICAO Validasyon Satisfactory': getBucketAfterValidationSat(bucket),
                'ICAO Validasyon EI': pctText(ratioPct(getBucketAfterValidationSat(bucket), bucket.total)),
                'Resmî Açık Bulgu': getBucketOfficialFindings(bucket),
                'Kapatılması Beklenen Bulgu': bucket.localCompleted || 0,
                'CAP Tamamlanmışlar Dahil EI': pctText(ratioPct(getBucketCurrentSat(bucket), bucket.total)),
                'Açık CAP Potansiyeli': bucket.projected || 0,
                'Tüm CAP Potansiyel EI': pctText(ratioPct(getBucketProjectedSat(bucket), bucket.total)),
                'CAP Yok / Boş': bucket.noCap || 0,
                'Tarih Eksik Potansiyel': bucket.undatedProjected || 0
            });
        };
        pushBucket('TÜRKİYE GENELİ', model.scope);
        Object.keys(model.areas).sort(sortAreas).forEach(a => pushBucket(a, model.areas[a]));
        return rows;
    }


    function getOfficialEiExportConfig() {
        try {
            const cfg = (typeof window.getManagedIcaoOfficialEiChartConfig === 'function') ? window.getManagedIcaoOfficialEiChartConfig() : null;
            return cfg && Array.isArray(cfg.records) && cfg.records.length ? cfg : null;
        } catch (e) {
            console.warn('ICAO resmî EI dışa aktarma verisi hazırlanamadı:', e);
            return null;
        }
    }

    function buildOfficialEiPeriodExportRows(config) {
        const cfg = config || getOfficialEiExportConfig();
        if (!cfg) return [];
        const areas = ['LEG','ORG','PEL','OPS','AIR','AIG','ANS','AGA'];
        return cfg.records.map((record, index) => {
            const row = {
                'Sıra': index + 1,
                'Değerlendirme': record.label || record.name || `Dönem ${index + 1}`,
                'Değerlendirme Tarihi': record.assessmentDate || '',
                'Referans Dönem': record.id === cfg.referenceId ? 'EVET' : 'HAYIR',
                'Overall EI (%)': officialEiChartNumber(record.overallEI)
            };
            areas.forEach(area => { row[`${area} EI (%)`] = officialEiChartNumber((record.areas || {})[area]); });
            return row;
        });
    }

    function buildOfficialEiComparisonExportRows(config) {
        const cfg = config || getOfficialEiExportConfig();
        if (!cfg) return [];
        const reference = cfg.records.find(r => r.id === cfg.referenceId) || cfg.records[0];
        return (cfg.areas || []).map(category => {
            const refValue = officialEiChartNumber((category.values || {})[reference.id]);
            const row = {
                'Alan': category.area,
                'Referans Dönem': reference.label || reference.name || 'Referans',
                'Referans EI (%)': refValue
            };
            cfg.records.filter(r => r.id !== reference.id).forEach(record => {
                const current = officialEiChartNumber((category.values || {})[record.id]);
                const delta = current === null || refValue === null ? null : Math.round((current - refValue) * 100) / 100;
                const label = record.label || record.name || 'Dönem';
                row[`${label} EI (%)`] = current;
                row[`${label} Değişim (puan)`] = delta;
            });
            return row;
        });
    }

    function buildOfficialEiOverallExportRows(config) {
        const cfg = config || getOfficialEiExportConfig();
        if (!cfg) return [];
        const reference = cfg.records.find(r => r.id === cfg.referenceId) || cfg.records[0];
        const refValue = officialEiChartNumber(reference.overallEI);
        return cfg.records.map(record => {
            const value = officialEiChartNumber(record.overallEI);
            return {
                'Değerlendirme': record.label || record.name || 'Dönem',
                'Değerlendirme Tarihi': record.assessmentDate || '',
                'Overall EI (%)': value,
                'Referans Dönem': record.id === reference.id ? 'EVET' : 'HAYIR',
                'Referansa Göre Değişim (puan)': value === null || refValue === null ? null : Math.round((value - refValue) * 100) / 100
            };
        });
    }

    function buildOfficialEiPdfSections() {
        const cfg = getOfficialEiExportConfig();
        if (!cfg) return [];
        const reference = cfg.records.find(r => r.id === cfg.referenceId) || cfg.records[0];
        const overallRows = buildOfficialEiOverallExportRows(cfg);
        const comparisonRows = buildOfficialEiComparisonExportRows(cfg);
        const sections = [{text:'ICAO Resmî EI Karşılaştırması', style:'sectionHeader'}];

        if (overallRows.length) {
            const body = [[
                {text:'Değerlendirme', style:'th'},
                {text:'Tarih', style:'th'},
                {text:'Overall EI', style:'th'},
                {text:'Referansa Göre Değişim', style:'th'}
            ]];
            overallRows.forEach(row => body.push([
                {text:String(row['Değerlendirme'] || ''), fontSize:8},
                {text:String(row['Değerlendirme Tarihi'] || '-'), fontSize:8},
                {text:formatOfficialEiPct(row['Overall EI (%)']), bold:true, fontSize:9},
                {text:row['Referans Dönem']==='EVET' ? 'Referans' : formatOfficialEiDelta(row['Referansa Göre Değişim (puan)']), fontSize:8}
            ]));
            sections.push({text:`Overall EI Kartları • Referans: ${reference.label || reference.name || 'Dönem'}`, fontSize:9, bold:true, margin:[0,0,0,5]});
            sections.push({table:{headerRows:1,widths:['*','auto','auto','auto'],body},layout:'lightHorizontalLines',margin:[0,0,0,10]});
        }

        const canvas = document.getElementById('icaoOfficialChartCanvas');
        if (canvas && canvas.width > 0 && canvas.height > 0 && canvas.offsetParent !== null) {
            try {
                const image = canvas.toDataURL('image/png', 1.0);
                if (image && image.startsWith('data:image/')) sections.push({image, width:730, alignment:'center', margin:[0,2,0,10]});
            } catch (e) { console.warn('ICAO resmî EI grafiği PDF görseline dönüştürülemedi:', e); }
        }

        if (comparisonRows.length) {
            const records = cfg.records;
            const head = [{text:'Alan',style:'th'},{text:reference.label || reference.name || 'Referans',style:'th'}];
            records.filter(r=>r.id!==reference.id).forEach(r=>head.push({text:r.label || r.name || 'Dönem',style:'th'}));
            const body=[head];
            comparisonRows.forEach(row=>{
                const cells=[{text:String(row['Alan']||''),bold:true,fontSize:8},{text:formatOfficialEiPct(row['Referans EI (%)']),fontSize:8}];
                records.filter(r=>r.id!==reference.id).forEach(r=>{
                    const label=r.label || r.name || 'Dönem';
                    const value=row[`${label} EI (%)`];
                    const delta=row[`${label} Değişim (puan)`];
                    cells.push({text:`${formatOfficialEiPct(value)}
${formatOfficialEiDelta(delta)}`,fontSize:8});
                });
                body.push(cells);
            });
            sections.push({text:'Alan Bazlı Resmî EI Değişimi',fontSize:9,bold:true,margin:[0,2,0,5]});
            sections.push({table:{headerRows:1,widths:['auto',...records.map(()=>'*')],body},layout:'lightHorizontalLines',margin:[0,0,0,10]});
        }
        return sections;
    }

    function buildDashboardKpiRows(rows) {
        const scopeRows = rows || getFilteredData();
        const analytics = buildCommonCalculationModel(scopeRows);
        const ei = buildEIOverviewRows(rawData)[0] || {};
        return [
            { 'Metrik': 'Veri Tarihi', 'Değer': getReportDateText(), 'Yorum': 'Word export tarihi esas alınır.' },
            { 'Metrik': 'Ekrandaki PQ', 'Değer': analytics.pq.total, 'Yorum': 'Aktif filtre kapsamındaki benzersiz PQ.' },
            { 'Metrik': 'CAP Adımı', 'Değer': analytics.actions.total, 'Yorum': 'Aktif filtre kapsamındaki toplam eylem.' },
            { 'Metrik': 'Tamamlanan / Devam Eden / Gecikmiş', 'Değer': `${analytics.status.done.total} / ${analytics.status.pending.total} / ${analytics.status.late.total}`, 'Yorum': 'Eylem adımı statüsü.' },
            { 'Metrik': 'Tarih Riski', 'Değer': analytics.dateRiskRows.length, 'Yorum': 'Hedef tarihi eksik/geçersiz açık CAP adımı.' },
            { 'Metrik': 'CMAA EI', 'Değer': ei['CMAA EI'] || 'EI verisi yok', 'Yorum': 'Resmî başlangıç oranı.' },
            { 'Metrik': 'ICAO Validasyon EI', 'Değer': ei['ICAO Validasyon EI'] || 'EI verisi yok', 'Yorum': 'Resmî validasyonlar sonrası oran.' },
            ...(() => {
                const cfg = getOfficialEiExportConfig();
                if (!cfg) return [];
                const ref = cfg.records.find(r => r.id === cfg.referenceId) || cfg.records[0];
                const latest = cfg.records[cfg.records.length - 1];
                const refValue = officialEiChartNumber(ref && ref.overallEI);
                const latestValue = officialEiChartNumber(latest && latest.overallEI);
                const delta = refValue === null || latestValue === null ? null : Math.round((latestValue - refValue) * 100) / 100;
                return [
                    { 'Metrik': 'Resmî EI Referans Dönemi', 'Değer': ref ? (ref.label || ref.name || '-') : '-', 'Yorum': refValue === null ? 'Overall EI değeri eksik.' : `Overall EI ${formatOfficialEiPct(refValue)}` },
                    { 'Metrik': 'Resmî EI Son Seçili Dönem', 'Değer': latest ? (latest.label || latest.name || '-') : '-', 'Yorum': latestValue === null ? 'Overall EI değeri eksik.' : `Overall EI ${formatOfficialEiPct(latestValue)}` },
                    { 'Metrik': 'Resmî Overall EI Değişimi', 'Değer': formatOfficialEiDelta(delta), 'Yorum': 'Seçilen referans dönem ile son seçili dönem arasındaki yüzde puan değişimi.' }
                ];
            })(),
            { 'Metrik': 'CAP Tamamlanmışlar Dahil EI', 'Değer': ei['CAP Tamamlanmışlar Dahil EI'] || 'EI verisi yok', 'Yorum': 'Henüz ICAO validasyonu bekleyen kapatılması beklenen bulgular dahil.' },
            { 'Metrik': 'Tüm CAP Potansiyel EI', 'Değer': ei['Tüm CAP Potansiyel EI'] || 'EI verisi yok', 'Yorum': 'Tüm açık CAP adımları olumlu tamamlanırsa.' }
        ];
    }

    function milestoneStatusText(bucket, target, validationTasks) {
        const r = resolveMilestone(bucket, target, validationTasks || []);
        return stripHtmlForReport(r.html || '') || r.status;
    }

    function buildMilestoneMatrixRows(sourceRows) {
        if (!Object.keys(baseEIData).length) return [];
        const projectionRows = expandFilteredRowsToFullPqGroups(sourceRows || getFilteredData());
        const model = buildEIProjectionModel(projectionRows.length ? projectionRows : rawData);
        const tasks = model.validationTasks || [];
        const rows = [];
        const pushBucket = (scopeName, bucket) => {
            if (!bucket || !bucket.total) return;
            const row = {
                'Denetim Alanı / Kapsam': scopeName,
                'Toplam PQ': bucket.total,
                'CMAA EI': pctText(ratioPct(bucket.baseSatOnly, bucket.total)),
                'CMAA Satisfactory': `${bucket.baseSatOnly}/${bucket.total}`,
                'Mevcut EI': pctText(ratioPct(getBucketCurrentSat(bucket), bucket.total)),
                'Mevcut Satisfactory': `${getBucketCurrentSat(bucket)}/${bucket.total}`,
                'Maksimum Potansiyel EI': pctText(ratioPct(getBucketProjectedSat(bucket), bucket.total)),
                'CAP Yok / Boş': bucket.noCap || 0,
                'Tarih Eksik Potansiyel': bucket.undatedProjected || 0
            };
            if (tasks.length) {
                tasks.forEach((task, idx) => {
                    const sat = getBucketSatAfterValidation(bucket, tasks, idx);
                    row[`ICAO Validasyonu - ${task}`] = `${pctText(ratioPct(sat, bucket.total))} | +${getBucketValidationCount(bucket, task)} PQ | ${sat}/${bucket.total}`;
                });
            } else {
                row['ICAO Validasyonu'] = `${pctText(ratioPct(getBucketAfterValidationSat(bucket), bucket.total))} | +${getBucketValidationDelta(bucket)} PQ`;
            }
            [60,70,80,90,100].forEach(t => { row[`%${t} Hedefi`] = milestoneStatusText(bucket, t, tasks); });
            rows.push(row);
        };
        pushBucket('TÜRKİYE GENELİ', model.scope);
        Object.keys(model.areas).sort(sortAreas).forEach(a => pushBucket(a, model.areas[a]));
        return rows;
    }

    function buildMilestoneGapRows(sourceRows) {
        if (!Object.keys(baseEIData).length) return [];
        const projectionRows = expandFilteredRowsToFullPqGroups(sourceRows || getFilteredData());
        const model = buildEIProjectionModel(projectionRows.length ? projectionRows : rawData);
        const tasks = model.validationTasks || [];
        const out = [];
        const scan = (scopeName, bucket) => {
            if (!bucket || !bucket.total) return;
            [60,70,80,90,100].forEach(target => {
                const reqSat = Math.ceil((target / 100) * bucket.total);
                const maxSat = getBucketProjectedSat(bucket);
                const r = resolveMilestone(bucket, target, tasks);
                if (r.status === 'unreachable' || r.status === 'unknown') {
                    out.push({
                        'Kapsam': scopeName,
                        'Hedef': `%${target}`,
                        'Durum': r.status === 'unreachable' ? 'Mevcut CAP havuzuyla ulaşılamıyor' : 'Tarih bilgisi eksik olduğu için tarih belirsiz',
                        'Gereken Satisfactory': reqSat,
                        'Maksimum Satisfactory': maxSat,
                        'Eksik PQ': Math.max(0, reqSat - maxSat),
                        'CAP Yok / Boş': bucket.noCap || 0,
                        'Tarih Eksik Potansiyel': bucket.undatedProjected || 0,
                        'Açıklama': milestoneStatusText(bucket, target, tasks)
                    });
                }
            });
        };
        scan('TÜRKİYE GENELİ', model.scope);
        Object.keys(model.areas).sort(sortAreas).forEach(a => scan(a, model.areas[a]));
        return out;
    }

    function buildMilestoneContributionRows(sourceRows) {
        if (!Object.keys(baseEIData).length) return [];
        const projectionRows = expandFilteredRowsToFullPqGroups(sourceRows || getFilteredData());
        const model = buildEIProjectionModel(projectionRows.length ? projectionRows : rawData);
        const rows = [];
        Object.keys(model.areas).sort(sortAreas).forEach(area => {
            const bucket = model.areas[area];
            const areaTotal = bucket.total || 0;
            (bucket.realizedEvents || []).forEach(e => {
                const m = pqMasterData[e.pq] || {};
                rows.push({ 'Kaynak': 'CAP Adımları Tamamlandı', 'Denetim Alanı': area, 'PQ': e.pq, 'Tarih': formatExactDate(e.date), 'Alan EI Katkısı': pctText(ratioPct(1, areaTotal)), 'CE': m.ce || '', 'Sorumlu': m.sorumlu || '', 'Bulgu': fullTextForExcel(m.bulgu || '') });
            });
            (bucket.projectedEvents || []).forEach(e => {
                const m = pqMasterData[e.pq] || {};
                rows.push({ 'Kaynak': 'Açık CAP Potansiyeli', 'Denetim Alanı': area, 'PQ': e.pq, 'Tarih': formatExactDate(e.date), 'Alan EI Katkısı': pctText(ratioPct(1, areaTotal)), 'CE': m.ce || '', 'Sorumlu': m.sorumlu || '', 'Bulgu': fullTextForExcel(m.bulgu || '') });
            });
        });
        return rows.sort((a,b) => sortAreas(a['Denetim Alanı'], b['Denetim Alanı']) || String(a['Tarih']).localeCompare(String(b['Tarih']), 'tr') || sortPQs(a.PQ,b.PQ));
    }

    function buildDateSimulationRowsFromUi() {
        const dateEl = document.getElementById('dateSimTargetDate');
        if (!dateEl || !dateEl.value) return [];
        const area = (document.getElementById('dateSimAreaSelect') || {}).value || 'GLOBAL';
        const targetDate = parseUserDateInput(dateEl.value);
        const sim = targetDate ? computeDateSimulation(area, targetDate) : null;
        if (!sim) return [];
        const label = area === 'GLOBAL' ? 'TÜRKİYE GENELİ' : area;
        const rows = [{
            'Kapsam': label,
            'Simülasyon Tarihi': formatLongTurkishDate(targetDate),
            'Mevcut Satisfactory': sim.currentSat,
            'Simülasyon Satisfactory': sim.simSat,
            'Mevcut EI': pctText(ratioPct(sim.currentSat, sim.bucket.total)),
            'Simülasyon EI': pctText(ratioPct(sim.simSat, sim.bucket.total)),
            'Ek Kapanacağı Varsayılan PQ': Math.max(0, sim.simSat - sim.currentSat),
            'Tarih Eksik PQ': sim.noDatePqs.length
        }];
        sim.assumedPqs.forEach(x => rows.push({ 'Kapsam': label, 'Simülasyon Tarihi': formatLongTurkishDate(targetDate), 'PQ': x.pq, 'Varsayılan Kapanış Tarihi': formatExactDate(x.date), 'Not': 'Bu tarihe kadar tüm adımların olumlu tamamlanacağı varsayılmıştır.' }));
        return rows;
    }

    function buildAreaScorecardRows(rows) {
        const base = buildAreaExportRows(rows || getFilteredData());
        const eiRows = buildEIOverviewRows(rawData).filter(r => r['Kapsam'] !== 'TÜRKİYE GENELİ');
        const eiMap = {}; eiRows.forEach(r => eiMap[normalizeAreaKey(r['Kapsam'])] = r);
        return base.map(r => {
            const ei = eiMap[normalizeAreaKey(r['Denetim Alanı'])] || {};
            return Object.assign({}, r, {
                'CMAA EI': ei['CMAA EI'] || '',
                'Resmî EI': ei['ICAO Validasyon EI'] || '',
                'Beklenen EI': ei['CAP Tamamlanmışlar Dahil EI'] || '',
                'Potansiyel EI': ei['Tüm CAP Potansiyel EI'] || '',
                'Kapatılması Beklenen Bulgu': ei['Kapatılması Beklenen Bulgu'] || 0,
                'Tarih Riski': ei['Tarih Eksik Potansiyel'] || 0
            });
        });
    }

    function buildEmptyCapSummaryRows(issueRows) {
        const map = {};
        (issueRows || []).forEach(issue => {
            const master = pqMasterData[issue.pq] || issue.master || {};
            const area = normalizeAreaKey(master.alan || issue.area) || 'DİĞER';
            const ce = master.ce || issue.ce || 'CE Yok';
            const definition = DATA_QUALITY_CATEGORIES[issue.category] || { label: issue.category || 'CAP Eksikliği' };
            const type = definition.label;
            const key = area + '|' + ce + '|' + type;
            if (!map[key]) map[key] = { area, ce, type, pqs:new Set(), count:0 };
            map[key].pqs.add(issue.pq); map[key].count++;
        });
        return Object.values(map).sort((a,b) => sortAreas(a.area,b.area) || a.ce.localeCompare(b.ce,'tr') || a.type.localeCompare(b.type,'tr')).map(r => ({
            'Denetim Alanı': r.area,
            'CE': r.ce,
            'Eksiklik Türü': r.type,
            'Etkilenen PQ': r.pqs.size,
            'Eksiklik Kaydı': r.count,
            'PQ Listesi': Array.from(r.pqs).sort(sortPQs).join(', ')
        }));
    }

    function buildIcaoValidationSummaryRows(rows) {
        const map = {};
        (rows || []).forEach(m => {
            const area = normalizeAreaKey(m.alan) || 'DİĞER';
            const task = normalizeValidationTaskName(m.validasyonGorevi, true);
            const key = task + '|' + area;
            if (!map[key]) map[key] = { task, area, pqs:new Set(), ceSet:new Set() };
            map[key].pqs.add(m.pq); if (m.ce) map[key].ceSet.add(m.ce);
        });
        return Object.values(map).sort((a,b) => a.task.localeCompare(b.task,'tr') || sortAreas(a.area,b.area)).map(r => ({
            'Validasyon Görevi': r.task,
            'Denetim Alanı': r.area,
            'Kapatılan PQ': r.pqs.size,
            'CE Kırılımı': Array.from(r.ceSet).sort().join(', '),
            'PQ Listesi': Array.from(r.pqs).sort(sortPQs).join(', ')
        }));
    }

    function makePdfTableFromObjects(rows, columns, widths, options = {}) {
        const maxRows = options.maxRows === undefined ? 40 : options.maxRows;
        const useRows = maxRows ? (rows || []).slice(0, maxRows) : (rows || []);
        const body = [[...columns.map(c => ({ text: c.title || c.key, style:'th' }))]];
        useRows.forEach(r => {
            body.push(columns.map(c => ({ text: fullTextForPdf(r[c.key] === undefined ? '' : r[c.key]), fontSize: c.fontSize || 8, bold: !!c.bold })));
        });
        if (!useRows.length) body.push(columns.map((c, idx) => idx === 0 ? { text:'Kayıt bulunamadı.', italics:true, color:'#64748b', fontSize:8 } : ''));
        const tbl = { table:{ headerRows:1, widths: widths || columns.map(c => c.width || '*'), body }, layout:'lightHorizontalLines', margin: options.margin || [0,0,0,10] };
        const hidden = (rows || []).length - useRows.length;
        if (hidden > 0) return [tbl, { text:`Not: PDF okunabilirliği için ilk ${useRows.length} kayıt gösterildi. Tüm kayıtlar Excel raporunda yer almaktadır.`, fontSize:8, color:'#64748b', margin:[0,-6,0,8] }];
        return [tbl];
    }

    function buildSpecialPdfSections(ctx, rowsForSummary) {
        const sections = [];
        let skipDefaultDetail = false;
        if (ctx.mode === 'smart') {
            skipDefaultDetail = true;
            const smart = buildSmartManagementModel(ctx.rows);
            sections.push({text:'Akıllı Yönetim Özeti', style:'sectionHeader'});
            sections.push(...makePdfTableFromObjects(buildSmartSummaryExportRows(smart), [
                {key:'Metrik',title:'Metrik'},{key:'Değer',title:'Değer'},{key:'Açıklama',title:'Açıklama'}
            ], ['*','auto','2*'], {maxRows:20}));
            sections.push({text:"Öncelikli Takip Edilecek PQ'lar", style:'sectionHeader'});
            sections.push(...makePdfTableFromObjects(buildSmartPqExportRows(smart.critical.slice(0,12)), [
                {key:'PQ',title:'PQ'},{key:'Denetim Alanı',title:'Alan'},{key:'Risk Skoru',title:'Risk'},{key:'Açık Adım',title:'Açık'},{key:'Gecikmiş Adım',title:'Gecikmiş'},{key:'Tarih Riski',title:'Tarih Riski'},{key:'Sorumlu',title:'Sorumlu'}
            ], ['auto','auto','auto','auto','auto','auto','*'], {maxRows:12}));
            sections.push({text:'Hızlı EI Kazanımı Adayları', style:'sectionHeader'});
            sections.push(...makePdfTableFromObjects(buildSmartPqExportRows(smart.quickWins.slice(0,12)), [
                {key:'PQ',title:'PQ'},{key:'Denetim Alanı',title:'Alan'},{key:'Açık Adım',title:'Kalan'},{key:'İlerleme %',title:'İlerleme'},{key:'Alan EI Katkısı %',title:'Alan EI'},{key:'Öngörülen Son Tarih',title:'Son Tarih'}
            ], ['auto','auto','auto','auto','auto','*'], {maxRows:12}));
            sections.push({text:'Sorumlu Ofis Darboğazları', style:'sectionHeader'});
            sections.push(...makePdfTableFromObjects(buildSmartOfficeExportRows(smart.officeRows.slice(0,12)), [
                {key:'Sorumlu Ofis',title:'Ofis'},{key:'Toplam Eylem',title:'Eylem'},{key:'PQ Sayısı',title:'PQ'},{key:'Gecikmiş',title:'Gecikmiş'},{key:'Tamamlanma %',title:'Tamamlanma'},{key:'Gecikme %',title:'Gecikme'}
            ], ['*','auto','auto','auto','auto','auto'], {maxRows:12}));
            sections.push({text:'En Fazla Geciken CAP Adımları', style:'sectionHeader'});
            sections.push(...makePdfTableFromObjects(smart.delayedActions.slice(0,15).map(x=>buildActionExportRowFull(x.row,{mode:'past'})), [
                {key:'PQ',title:'PQ'},{key:'Denetim Alanı',title:'Alan'},{key:'Adım',title:'Adım'},{key:'Eylem / CAP Adımı',title:'Eylem'},{key:'Eylem Ofisi',title:'Sorumlu'},{key:'Gecikme Günü',title:'Gecikme'}
            ], ['auto','auto','auto','*','auto','auto'], {maxRows:15}));
        } else if (ctx.mode === 'dashboard') {
            skipDefaultDetail = true;
            appendPdfTableSection(sections, 'EI Safhaları', buildEIOverviewRows(rawData).slice(0, 12), [
                {key:'Kapsam', title:'Kapsam'}, {key:'CMAA EI', title:'CMAA'}, {key:'ICAO Validasyon EI', title:'Resmî EI'}, {key:'CAP Tamamlanmışlar Dahil EI', title:'Beklenen EI'}, {key:'Tüm CAP Potansiyel EI', title:'Potansiyel EI'}, {key:'Resmî Açık Bulgu', title:'Resmî Açık'}, {key:'Kapatılması Beklenen Bulgu', title:'Beklenen Kapanış'}
            ], ['*','auto','auto','auto','auto','auto','auto'], { maxRows: 12 });
            sections.push({text:'Öncelikli Gecikmeler', style:'sectionHeader'});
            sections.push(...makePdfTableFromObjects(getTopDelayedRows(ctx.rows, 15).map(d => buildActionExportRowFull(d, { mode:'past' })), [
                {key:'PQ', title:'PQ'}, {key:'Denetim Alanı', title:'Alan'}, {key:'Adım', title:'Adım'}, {key:'Eylem / CAP Adımı', title:'Eylem'}, {key:'Eylem Ofisi', title:'Sorumlu'}, {key:'Hedef Tarih', title:'Hedef'}, {key:'Gecikme Günü', title:'Gecikme'}
            ], ['auto','auto','auto','*','auto','auto','auto'], { maxRows: 15 }));
            sections.push({text:'Yaklaşan Kritik Görevler', style:'sectionHeader'});
            sections.push(...makePdfTableFromObjects(getTopUpcomingRows(ctx.rows, 15).map(d => buildActionExportRowFull(d, { mode:'upcoming' })), [
                {key:'PQ', title:'PQ'}, {key:'Denetim Alanı', title:'Alan'}, {key:'Adım', title:'Adım'}, {key:'Eylem / CAP Adımı', title:'Eylem'}, {key:'Eylem Ofisi', title:'Sorumlu'}, {key:'Hedef Tarih', title:'Hedef'}, {key:'Kalan Gün', title:'Kalan'}
            ], ['auto','auto','auto','*','auto','auto','auto'], { maxRows: 15 }));
            sections.push({text:'Tarih Riski', style:'sectionHeader'});
            sections.push(...makePdfTableFromObjects(getDateRiskRows(ctx.rows).slice(0,15).map(d => buildActionExportRowFull(d)), [
                {key:'PQ', title:'PQ'}, {key:'Denetim Alanı', title:'Alan'}, {key:'Adım', title:'Adım'}, {key:'Eylem / CAP Adımı', title:'Eylem'}, {key:'Eylem Ofisi', title:'Sorumlu'}
            ], ['auto','auto','auto','*','auto'], { maxRows: 15 }));
        } else if (ctx.mode === 'milestones') {
            skipDefaultDetail = true;
            sections.push({text:'Hedef Matrisi', style:'sectionHeader'});
            sections.push(...makePdfTableFromObjects(buildMilestoneMatrixRows(ctx.rows), [
                {key:'Denetim Alanı / Kapsam', title:'Kapsam'}, {key:'CMAA EI', title:'CMAA'}, {key:'Mevcut EI', title:'Mevcut'}, {key:'Maksimum Potansiyel EI', title:'Potansiyel'}, {key:'%60 Hedefi', title:'%60'}, {key:'%70 Hedefi', title:'%70'}, {key:'%80 Hedefi', title:'%80'}, {key:'%90 Hedefi', title:'%90'}, {key:'%100 Hedefi', title:'%100'}
            ], ['*','auto','auto','auto','auto','auto','auto','auto','auto'], { maxRows: 25 }));
            const gaps = buildMilestoneGapRows(ctx.rows);
            sections.push({text:'Ulaşılamayan / Tarihi Belirsiz Hedefler', style:'sectionHeader'});
            sections.push(...makePdfTableFromObjects(gaps, [
                {key:'Kapsam', title:'Kapsam'}, {key:'Hedef', title:'Hedef'}, {key:'Durum', title:'Durum'}, {key:'Eksik PQ', title:'Eksik PQ'}, {key:'CAP Yok / Boş', title:'Boş CAP'}, {key:'Tarih Eksik Potansiyel', title:'Tarih Riski'}
            ], ['*','auto','*','auto','auto','auto'], { maxRows: 30 }));
        } else if (ctx.mode === 'summary') {
            skipDefaultDetail = true;
            sections.push({text:'Alan Performans Karnesi', style:'sectionHeader'});
            sections.push(...makePdfTableFromObjects(buildAreaScorecardRows(ctx.rows), [
                {key:'Denetim Alanı', title:'Alan'}, {key:'PQ Sayısı', title:'PQ'}, {key:'Tamamlanan PQ', title:'Tamamlanan'}, {key:'Açık PQ', title:'Açık'}, {key:'Gecikmiş Adım', title:'Gecikmiş'}, {key:'Resmî EI', title:'Resmî EI'}, {key:'Beklenen EI', title:'Beklenen EI'}, {key:'Potansiyel EI', title:'Potansiyel'}
            ], ['*','auto','auto','auto','auto','auto','auto','auto'], { maxRows: 30 }));
            sections.push({text:'Alan Bazında En Kritik Gecikmeler', style:'sectionHeader'});
            sections.push(...makePdfTableFromObjects(getTopDelayedRows(ctx.rows, 25).map(d => buildActionExportRowFull(d, { mode:'past' })), [
                {key:'PQ', title:'PQ'}, {key:'Denetim Alanı', title:'Alan'}, {key:'Adım', title:'Adım'}, {key:'Eylem / CAP Adımı', title:'Eylem'}, {key:'Gecikme Günü', title:'Gecikme'}
            ], ['auto','auto','auto','*','auto'], { maxRows: 25 }));
        } else if (ctx.mode === 'empty') {
            sections.push({text:'CAP Eksiklikleri Özet Kırılımı', style:'sectionHeader'});
            sections.push(...makePdfTableFromObjects(buildEmptyCapSummaryRows(ctx.rows), [
                {key:'Denetim Alanı', title:'Alan'}, {key:'CE', title:'CE'}, {key:'Eksiklik Türü', title:'Eksiklik Türü'}, {key:'Etkilenen PQ', title:'PQ'}, {key:'Eksiklik Kaydı', title:'Kayıt'}, {key:'PQ Listesi', title:'PQ Listesi'}
            ], ['auto','auto','*','auto','auto','*'], { maxRows: 30 }));
        } else if (ctx.mode === 'icao') {
            sections.push({text:'Validasyon Görevi Bazında Kapanış Özeti', style:'sectionHeader'});
            sections.push(...makePdfTableFromObjects(buildIcaoValidationSummaryRows(ctx.rows), [
                {key:'Validasyon Görevi', title:'Validasyon'}, {key:'Denetim Alanı', title:'Alan'}, {key:'Kapatılan PQ', title:'PQ'}, {key:'CE Kırılımı', title:'CE'}, {key:'PQ Listesi', title:'PQ Listesi'}
            ], ['*','auto','auto','auto','*'], { maxRows: 40 }));
        } else if (ctx.mode === 'list') {
            sections.push({text:'PQ ve Alan Özeti', style:'sectionHeader'});
            sections.push(...makePdfTableFromObjects(buildPQExportRows(ctx.rows).slice(0, 25), [
                {key:'PQ', title:'PQ'}, {key:'Denetim Alanı', title:'Alan'}, {key:'CE', title:'CE'}, {key:'PQ Durumu', title:'Durum'}, {key:'CAP Adımı', title:'Adım'}, {key:'Tamamlanan Adım', title:'Tamamlanan'}, {key:'Gecikmiş Adım', title:'Gecikmiş'}, {key:'PQ İlerleme %', title:'İlerleme'}
            ], ['auto','auto','auto','auto','auto','auto','auto','auto'], { maxRows: 25 }));
        }
        return { sections, skipDefaultDetail };
    }


    // FILTRE BAZLI STRATEJIK RAPOR
    function getStrategicDefaultDateValue() {
        const base = window_loadedReportDate || new Date();
        const y = base.getFullYear();
        return `${y}-12-31`;
    }

    function ensureStrategicReportControls() {
        const dateEl = document.getElementById('strategicTargetDate');
        if (dateEl && !dateEl.value) dateEl.value = getStrategicDefaultDateValue();

        const box = document.getElementById('strategicScopeCheckboxList');
        if (!box) return;
        const previous = new Set(Array.from(box.querySelectorAll('input[type="checkbox"]:checked')).map(x => x.value));
        const areas = Object.keys(baseEIData || {}).map(normalizeAreaKey).filter(Boolean).sort(sortAreas);
        const wanted = [
            { value:'ALL', text:'Türkiye Geneli + Tüm Alan Kırılımları' },
            { value:'GLOBAL', text:'Sadece Türkiye Geneli' },
            ...areas.map(a => ({ value:a, text:`${a} Alanı` }))
        ];
        const signature = wanted.map(x => x.value).join('|');
        if (box.dataset.signature !== signature) {
            box.innerHTML = wanted.map((o, i) => {
                const checked = previous.size ? previous.has(o.value) : o.value === 'ALL';
                return `<label><input type="checkbox" value="${escapeHtml(o.value)}" ${checked ? 'checked' : ''} onchange="handleStrategicScopeChange(this)"><span>${escapeHtml(o.text)}</span></label>`;
            }).join('');
            box.dataset.signature = signature;
        }
    }

    function handleStrategicScopeChange(changed) {
        const box = document.getElementById('strategicScopeCheckboxList');
        if (!box) return;
        const checks = Array.from(box.querySelectorAll('input[type="checkbox"]'));
        if (changed.checked && (changed.value === 'ALL' || changed.value === 'GLOBAL')) {
            checks.forEach(x => { if (x !== changed) x.checked = false; });
        } else if (changed.checked) {
            checks.forEach(x => { if (x.value === 'ALL' || x.value === 'GLOBAL') x.checked = false; });
        }
        if (!checks.some(x => x.checked)) {
            const all = checks.find(x => x.value === 'ALL');
            if (all) all.checked = true;
        }
        renderStrategicReportPreview();
    }

    function getStrategicScopeValues() {
        ensureStrategicReportControls();
        const box = document.getElementById('strategicScopeCheckboxList');
        if (!box) return ['ALL'];
        const values = Array.from(box.querySelectorAll('input[type="checkbox"]:checked')).map(x => x.value);
        return values.length ? values : ['ALL'];
    }

    function getStrategicScopeLabel(scopes) {
        scopes = Array.isArray(scopes) ? scopes : [scopes];
        if (scopes.includes('ALL')) return 'Türkiye Geneli + Tüm Alan Kırılımları';
        if (scopes.includes('GLOBAL')) return 'Sadece Türkiye Geneli';
        return scopes.length === 1 ? `${scopes[0]} Alanı` : `Seçili Alanlar: ${scopes.join(', ')}`;
    }

    function getStrategicTargetDate() {
        ensureStrategicReportControls();
        const raw = (document.getElementById('strategicTargetDate') || {}).value || getStrategicDefaultDateValue();
        return parseDateObj(raw) || todayMidnight();
    }

    function getStrategicScopeAreas(scopes) {
        const areas = Object.keys(baseEIData || {}).map(normalizeAreaKey).filter(Boolean).sort(sortAreas);
        scopes = Array.isArray(scopes) ? scopes : [scopes];
        if (scopes.includes('ALL') || scopes.includes('GLOBAL')) return areas;
        return areas.filter(a => scopes.includes(a));
    }

    function strategicStepInAreas(d, areas) {
        if (!areas || areas.length === 0) return false;
        const area = normalizeAreaKey((pqMasterData[d.pq] || {}).alan);
        return areas.includes(area);
    }

    function strategicMasterInAreas(m, areas) {
        if (!areas || areas.length === 0) return false;
        const area = normalizeAreaKey((m || {}).alan);
        return areas.includes(area);
    }

    function strategicEmptyAreaStat(area) {
        const b = baseEIData[area] || {};
        const after = getBaseAfterValidationSat(b);
        const officialSat = after !== null ? after : (b.sat || 0);
        return {
            area,
            totalApplicable: b.total || 0,
            baseSat: b.sat || 0,
            officialSat,
            officialClosedPq: Math.max(0, officialSat - (b.sat || 0)),
            activeFilterPq: 0,
            localClosedPq: 0,
            targetAdditionalPq: 0,
            targetClosableTotalPq: 0,
            potentialAdditionalPq: 0,
            openPq: 0,
            noCapPq: 0,
            dateRiskPq: 0,
            totalSteps: 0,
            doneSteps: 0,
            openSteps: 0,
            targetDueOpenSteps: 0,
            lateSteps: 0,
            missingDateOpenSteps: 0,
            maxDelayDays: 0,
            sumDelayDays: 0,
            delayCount: 0
        };
    }

    function strategicPct(sat, total) {
        return pctText(ratioPct(sat || 0, total || 0));
    }

    function buildStrategicFilterReportData() {
        ensureStrategicReportControls();
        const scopes = getStrategicScopeValues();
        const targetDate = getStrategicTargetDate();
        const targetLabel = formatLongTurkishDate(targetDate);
        const note = ((document.getElementById('strategicReportNote') || {}).value || '').trim();
        const areas = getStrategicScopeAreas(scopes);

        const filteredRows = getFilteredData();
        const scopedFilteredRows = filteredRows.filter(d => strategicStepInAreas(d, areas));
        const selectedPqs = new Set(scopedFilteredRows.map(d => d.pq).filter(Boolean));
        const expandedRows = rawData.filter(d => selectedPqs.has(d.pq) && strategicStepInAreas(d, areas));
        const commonModel = buildCommonCalculationModel(expandedRows, {
            normalizeAreas: true,
            useUsableStepsForPqCompletion: true,
            projectionDate: targetDate,
            upcomingDays: 30
        });

        const areaStats = {};
        areas.forEach(a => areaStats[a] = strategicEmptyAreaStat(a));

        const pqRows = [];
        const targetPqRows = [];
        const delayedRows = [];
        const targetStepRows = [];
        const dateRiskRows = [];

        commonModel.standardized.pqItems
            .slice()
            .sort((a,b) => sortPQs(a.pq,b.pq))
            .forEach(item => {
                const m = item.master || {};
                const area = item.area || normalizeAreaKey(m.alan) || 'DİĞER';
                const s = areaStats[area];
                if (!s || item.code === COMMON_PQ_STATUS.OFFICIAL_CLOSED.code) return;

                s.activeFilterPq++;
                if (item.code === COMMON_PQ_STATUS.NO_CAP.code) {
                    s.noCapPq++;
                    s.openPq++;
                } else if (item.code === COMMON_PQ_STATUS.CAP_COMPLETED.code) {
                    s.localClosedPq++;
                } else {
                    s.openPq++;
                    s.potentialAdditionalPq++;
                    if (item.code === COMMON_PQ_STATUS.PROJECTED_CLOSABLE.code) s.targetAdditionalPq++;
                    if (item.code === COMMON_PQ_STATUS.OPEN_DATE_RISK.code) s.dateRiskPq++;
                }

                const statusText = item.code === COMMON_PQ_STATUS.PROJECTED_CLOSABLE.code
                    ? `${item.label} (${targetLabel})`
                    : item.label;
                const pqRow = {
                    'PQ': item.pq,
                    'Denetim Alanı': area,
                    'CE': item.ce || '',
                    'Doğrulama Türü': m.tur || '',
                    'PQ Sorumlusu': item.responsible || '',
                    'PQ Durumu': statusText,
                    'Durum Kodu': item.code,
                    'CAP Adımı': item.totalSteps,
                    'Tamamlanan Adım': item.doneSteps,
                    'Açık Adım': item.openSteps,
                    'Gecikmiş Adım': item.lateSteps,
                    'Tarih Eksik Adım': item.missingDates,
                    'Seçili Tarihe Kadar Vadesi Gelen Açık Adım': item.dueByProjectionSteps,
                    'PQ Kapanış / Projeksiyon Tarihi': item.closureDate ? formatExactDate(item.closureDate) : (item.latestKnownDate ? `${formatExactDate(item.latestKnownDate)} (eksik tarih var)` : ''),
                    'Seçili Tarihe Kadar Kapanır mı': item.code === COMMON_PQ_STATUS.CAP_COMPLETED.code ? 'Zaten tamamlandı' : (item.code === COMMON_PQ_STATUS.PROJECTED_CLOSABLE.code ? 'EVET' : 'HAYIR'),
                    'Bulgu': fullTextForExcel(item.finding || '')
                };
                pqRows.push(pqRow);
                if (item.code === COMMON_PQ_STATUS.CAP_COMPLETED.code || item.code === COMMON_PQ_STATUS.PROJECTED_CLOSABLE.code) targetPqRows.push(pqRow);
            });

        commonModel.standardized.actionItems.forEach(action => {
            const s = areaStats[action.area];
            if (!s || action.master.isIcaoClosed || !action.isUsable) return;
            s.totalSteps++;
            if (action.code === COMMON_ACTION_STATUS.COMPLETED.code) {
                s.doneSteps++;
                return;
            }
            s.openSteps++;
            if (action.code === COMMON_ACTION_STATUS.DATE_RISK.code) {
                s.missingDateOpenSteps++;
                const riskRow = buildActionExportRowFull(action.row);
                riskRow['Standart Adım Durumu'] = action.label;
                riskRow['Durum Kodu'] = action.code;
                dateRiskRows.push(riskRow);
            }
            if (action.dueByProjection) {
                s.targetDueOpenSteps++;
                const targetRow = buildActionExportRowFull(action.row, { mode:'upcoming' });
                targetRow['Standart Adım Durumu'] = action.label;
                targetRow['Durum Kodu'] = action.code;
                targetRow['Seçili Tarihe Kadar Vadesi Geliyor'] = 'EVET';
                targetStepRows.push(targetRow);
            }
            if (action.code === COMMON_ACTION_STATUS.LATE.code) {
                s.lateSteps++;
                s.delayCount++;
                s.sumDelayDays += action.delayDays;
                s.maxDelayDays = Math.max(s.maxDelayDays, action.delayDays);
                const row = buildActionExportRowFull(action.row, { mode:'past' });
                row['Gecikme Günü'] = action.delayDays;
                row['Standart Adım Durumu'] = action.label;
                delayedRows.push(row);
            }
        });

        const officialClosedRows = Object.keys(pqMasterData || {}).filter(pq => {
            const m = pqMasterData[pq] || {};
            return m.isIcaoClosed && strategicMasterInAreas(m, areas);
        }).sort(sortPQs).map(pq => {
            const m = pqMasterData[pq] || {};
            return {
                'PQ': pq,
                'Denetim Alanı': normalizeAreaKey(m.alan) || 'DİĞER',
                'CE': m.ce || '',
                'Doğrulama Türü': m.tur || '',
                'PQ Sorumlusu': m.sorumlu || '',
                'Validasyon Görevi': m.validasyonGorevi || '',
                'PQ Durumu': COMMON_PQ_STATUS.OFFICIAL_CLOSED.label,
                'Durum Kodu': COMMON_PQ_STATUS.OFFICIAL_CLOSED.code,
                'Bulgu': fullTextForExcel(m.bulgu || '')
            };
        });

        Object.values(areaStats).forEach(s => {
            s.targetClosableTotalPq = s.localClosedPq + s.targetAdditionalPq;
            s.avgDelayDays = s.delayCount ? Math.round(s.sumDelayDays / s.delayCount) : 0;
            s.officialOpenFindings = Math.max(0, s.totalApplicable - s.officialSat);
            s.localSat = Math.min(s.totalApplicable, s.officialSat + s.localClosedPq);
            s.targetSat = Math.min(s.totalApplicable, s.officialSat + s.targetClosableTotalPq);
            s.potentialSat = Math.min(s.totalApplicable, s.officialSat + s.localClosedPq + s.potentialAdditionalPq);
            s.baseEI = ratioPct(s.baseSat, s.totalApplicable);
            s.officialEI = ratioPct(s.officialSat, s.totalApplicable);
            s.localEI = ratioPct(s.localSat, s.totalApplicable);
            s.targetEI = ratioPct(s.targetSat, s.totalApplicable);
            s.potentialEI = ratioPct(s.potentialSat, s.totalApplicable);
        });

        const isAllScope = scopes.includes('ALL');
        const isGlobalScope = scopes.includes('GLOBAL');
        const sumLabel = (!isAllScope && !isGlobalScope) ? 'SEÇİLİ ALANLAR TOPLAMI' : 'TÜRKİYE GENELİ';
        const sum = strategicEmptyAreaStat(sumLabel);
        Object.values(areaStats).forEach(s => {
            ['totalApplicable','baseSat','officialSat','officialClosedPq','activeFilterPq','localClosedPq','targetAdditionalPq','targetClosableTotalPq','potentialAdditionalPq','openPq','noCapPq','dateRiskPq','totalSteps','doneSteps','openSteps','targetDueOpenSteps','lateSteps','missingDateOpenSteps','sumDelayDays','delayCount'].forEach(k => sum[k] += s[k] || 0);
            sum.maxDelayDays = Math.max(sum.maxDelayDays || 0, s.maxDelayDays || 0);
        });
        sum.avgDelayDays = sum.delayCount ? Math.round(sum.sumDelayDays / sum.delayCount) : 0;
        sum.officialOpenFindings = Math.max(0, sum.totalApplicable - sum.officialSat);
        sum.localSat = Math.min(sum.totalApplicable, sum.officialSat + sum.localClosedPq);
        sum.targetSat = Math.min(sum.totalApplicable, sum.officialSat + sum.targetClosableTotalPq);
        sum.potentialSat = Math.min(sum.totalApplicable, sum.officialSat + sum.localClosedPq + sum.potentialAdditionalPq);
        sum.baseEI = ratioPct(sum.baseSat, sum.totalApplicable);
        sum.officialEI = ratioPct(sum.officialSat, sum.totalApplicable);
        sum.localEI = ratioPct(sum.localSat, sum.totalApplicable);
        sum.targetEI = ratioPct(sum.targetSat, sum.totalApplicable);
        sum.potentialEI = ratioPct(sum.potentialSat, sum.totalApplicable);

        const areaRows = Object.values(areaStats).sort((a,b) => sortAreas(a.area, b.area)).map(strategicAreaStatToRow);
        const summaryRows = isAllScope
            ? [strategicAreaStatToRow(sum)].concat(areaRows)
            : (isGlobalScope ? [strategicAreaStatToRow(sum)] : [strategicAreaStatToRow(sum)].concat(areaRows));
        delayedRows.sort((a,b) => (Number(b['Gecikme Günü']) || 0) - (Number(a['Gecikme Günü']) || 0) || sortAreas(a['Denetim Alanı'], b['Denetim Alanı']) || sortPQs(a['PQ'], b['PQ']));
        targetStepRows.sort((a,b) => {
            const da = parseDateObj(a['Hedef Tarih']), db = parseDateObj(b['Hedef Tarih']);
            if (da && db && da.getTime() !== db.getTime()) return da - db;
            return sortAreas(a['Denetim Alanı'], b['Denetim Alanı']) || sortPQs(a['PQ'], b['PQ']);
        });
        pqRows.sort((a,b) => sortAreas(a['Denetim Alanı'], b['Denetim Alanı']) || sortPQs(a['PQ'], b['PQ']));
        targetPqRows.sort((a,b) => sortAreas(a['Denetim Alanı'], b['Denetim Alanı']) || sortPQs(a['PQ'], b['PQ']));

        return {
            scope: scopes,
            scopeLabel: getStrategicScopeLabel(scopes),
            targetDate,
            targetLabel,
            note,
            rows: expandedRows,
            activeFilterRows: scopedFilteredRows,
            summary: sum,
            areaStats,
            summaryRows,
            areaRows,
            pqRows,
            targetPqRows,
            officialClosedRows,
            delayedRows,
            targetStepRows,
            dateRiskRows,
            commonModel
        };
    }

    function strategicAreaStatToRow(s) {
        return {
            'Kapsam': s.area,
            'Uygulanabilir Toplam PQ': s.totalApplicable,
            'Aktif Filtrede PQ': s.activeFilterPq,
            'CMAA Satisfactory': s.baseSat,
            'CMAA EI': strategicPct(s.baseSat, s.totalApplicable),
            'Resmî Kapalı PQ': s.officialClosedPq,
            'ICAO Validasyon Satisfactory': s.officialSat,
            'Resmî EI': strategicPct(s.officialSat, s.totalApplicable),
            'Resmî Açık Bulgu': s.officialOpenFindings,
            'Tüm Adımları Tamamlanan CAP/PQ': s.localClosedPq,
            'Seçili Tarihe Kadar Ek Kapanabilecek PQ': s.targetAdditionalPq,
            'Seçili Tarihe Kadar Toplam Kapanış Beklentisi': s.targetClosableTotalPq,
            'Seçili Tarih EI': strategicPct(s.targetSat, s.totalApplicable),
            'Tüm CAP Potansiyel EI': strategicPct(s.potentialSat, s.totalApplicable),
            'Aktif Filtrede Açık PQ': s.openPq,
            'CAP Yok / Boş PQ': s.noCapPq,
            'Tarih Riskli PQ': s.dateRiskPq,
            'Toplam CAP Adımı': s.totalSteps,
            'Tamamlanan Adım': s.doneSteps,
            'Açık Adım': s.openSteps,
            'Seçili Tarihe Kadar Vadesi Gelen Açık Adım': s.targetDueOpenSteps,
            'Gecikmiş Adım': s.lateSteps,
            'Tarih Eksik Açık Adım': s.missingDateOpenSteps,
            'En Yüksek Gecikme Günü': s.maxDelayDays || 0,
            'Ortalama Gecikme Günü': s.avgDelayDays || 0
        };
    }

    function getStrategicKpiRows(data) {
        const s = data.summary || {};
        return [
            { 'Metrik': 'Kapsam', 'Değer': data.scopeLabel, 'Açıklama': 'Seçilen rapor kapsamı' },
            { 'Metrik': 'Projeksiyon Tarihi', 'Değer': data.targetLabel, 'Açıklama': 'Bu tarihe kadar tamamlanacağı varsayılan açık CAP adımları hesaba alınır' },
            { 'Metrik': 'Aktif Filtrede PQ', 'Değer': s.activeFilterPq || 0, 'Açıklama': 'Mevcut filtrelerin yakaladığı benzersiz PQ sayısı' },
            { 'Metrik': 'Resmî Kapalı PQ', 'Değer': s.officialClosedPq || 0, 'Açıklama': 'ICAO validasyonları sonrası resmî kapanış etkisi' },
            { 'Metrik': 'Tüm Adımları Tamamlanan CAP/PQ', 'Değer': s.localClosedPq || 0, 'Açıklama': 'Henüz ICAO validasyonu bekleyen kapanış beklentisi' },
            { 'Metrik': 'Seçili Tarihe Kadar Kapanabilecek PQ', 'Değer': s.targetClosableTotalPq || 0, 'Açıklama': 'Tamamlanmış + seçili tarihe kadar tüm adımları bitebilecek PQ' },
            { 'Metrik': 'Resmî EI', 'Değer': strategicPct(s.officialSat, s.totalApplicable), 'Açıklama': 'CMAA + ICAO validasyonları' },
            { 'Metrik': 'Seçili Tarih EI', 'Değer': strategicPct(s.targetSat, s.totalApplicable), 'Açıklama': 'Resmî EI + seçili tarih kapanış beklentisi' },
            { 'Metrik': 'Toplam / Açık CAP Adımı', 'Değer': `${s.totalSteps || 0} / ${s.openSteps || 0}`, 'Açıklama': 'Aktif filtre kapsamındaki adımlar' },
            { 'Metrik': 'Gecikmiş Adım', 'Değer': s.lateSteps || 0, 'Açıklama': `En yüksek gecikme: ${s.maxDelayDays || 0} gün; ortalama: ${s.avgDelayDays || 0} gün` }
        ];
    }

    function renderStrategicReportPreview() {
        const el = document.getElementById('strategicReportPreview');
        if (!el) return;
        ensureStrategicReportControls();
        if (!rawData || rawData.length === 0) {
            el.innerHTML = '<div style="color:var(--muted); text-align:center; padding:30px;">Rapor için önce Word ve Excel verilerini yükleyin.</div>';
            return;
        }
        const data = buildStrategicFilterReportData();
        const kpis = getStrategicKpiRows(data);
        const cards = kpis.slice(2, 10).map(k => `<div class="report-stat-mini"><h4>${escapeHtml(String(k['Değer']))}</h4><p>${escapeHtml(k['Metrik'])}</p></div>`).join('');
        const areaRows = data.summaryRows.map(r => `<tr>
            <td><b>${escapeHtml(r['Kapsam'])}</b></td>
            <td style="text-align:center;">${r['Uygulanabilir Toplam PQ']}</td>
            <td style="text-align:center;">${r['Aktif Filtrede PQ']}</td>
            <td style="text-align:center;">${r['Resmî Kapalı PQ']}</td>
            <td style="text-align:center;">${r['Tüm Adımları Tamamlanan CAP/PQ']}</td>
            <td style="text-align:center;">${r['Seçili Tarihe Kadar Toplam Kapanış Beklentisi']}</td>
            <td style="text-align:center;"><b>${r['Seçili Tarih EI']}</b></td>
            <td style="text-align:center; color:var(--danger); font-weight:bold;">${r['Gecikmiş Adım']}</td>
        </tr>`).join('');
        const delayedPreview = data.delayedRows.slice(0, 10).map(r => `<div class="review-card">
            <div class="review-card-header"><span>PQ ${escapeHtml(r['PQ'])} / ${escapeHtml(r['Denetim Alanı'])} / Adım ${escapeHtml(String(r['Adım']))}</span><span style="color:var(--danger);">${escapeHtml(String(r['Gecikme Günü']))} gün</span></div>
            <div style="font-size:12px; color:var(--muted); margin-bottom:6px;">${escapeHtml(r['Eylem Ofisi'] || '-')} | Hedef: ${escapeHtml(r['Hedef Tarih'] || '-')}</div>
            <div style="font-size:13px;">${escapeHtml(truncateTextForExport(r['Eylem / CAP Adımı'] || '', 350))}</div>
        </div>`).join('') || '<div style="color:var(--muted);">Gecikmiş adım bulunmadı.</div>';
        el.innerHTML = `
            <h3 style="margin-top:0; color:var(--primary);">Filtre Bazlı Stratejik Rapor Önizleme</h3>
            <p style="color:var(--muted); font-size:12px;">Kapsam: <b>${escapeHtml(data.scopeLabel)}</b> | Projeksiyon tarihi: <b>${escapeHtml(data.targetLabel)}</b> | Aktif filtre satırı: <b>${data.activeFilterRows.length}</b></p>
            ${data.note ? `<div class="noteBox" style="background:var(--kanban-bg); padding:10px; border-radius:8px; margin-bottom:12px;"><b>Rapor notu:</b> ${escapeHtml(data.note)}</div>` : ''}
            <div class="report-stat-row" style="flex-wrap:wrap;">${cards}</div>
            <h4 style="margin:18px 0 8px 0;">Genel / Alan Bazlı Özet</h4>
            <div style="overflow-x:auto;"><table><thead><tr><th>Kapsam</th><th>Toplam PQ</th><th>Filtre PQ</th><th>Resmî Kapalı</th><th>CAP Tamam</th><th>Tarih Kapanış</th><th>Seçili Tarih EI</th><th>Gecikmiş Adım</th></tr></thead><tbody>${areaRows}</tbody></table></div>
            <h4 style="margin:18px 0 8px 0;">En Çok Geciken İlk 10 Adım</h4>
            ${delayedPreview}
        `;
    }

    function exportStrategicReportExcel() {
        const data = buildStrategicFilterReportData();
        if (!data.rows || data.rows.length === 0) {
            return alert('Aktif filtre/kapsam için raporlanacak CAP verisi bulunamadı.');
        }
        const wb = createReportWorkbook({ title:'Filtre Bazlı Stratejik Rapor' });
        addJsonSheet(wb, 'Rapor_Baglamı', buildFilterContextRows({ title:'Filtre Bazlı Stratejik Rapor', mode:'strategic', rows:data.rows, viewLabel:data.scopeLabel, rangeLabel:`Projeksiyon: ${data.targetLabel}` }).concat([
            { 'Başlık': 'Projeksiyon Tarihi', 'Değer': data.targetLabel },
            { 'Başlık': 'Rapor Notu', 'Değer': data.note || '-' }
        ]));
        addJsonSheet(wb, 'Yonetici_KPI', getStrategicKpiRows(data));
        addJsonSheet(wb, 'Standart_Durum_Ozeti', [
            { 'Seviye':'PQ', 'Durum':'Resmî Kapalı', 'Durum Kodu':COMMON_PQ_STATUS.OFFICIAL_CLOSED.code, 'Adet':data.commonModel.standardized.pq.officialClosed.count },
            { 'Seviye':'PQ', 'Durum':'Tüm CAP Adımları Tamamlandı', 'Durum Kodu':COMMON_PQ_STATUS.CAP_COMPLETED.code, 'Adet':data.commonModel.standardized.pq.capCompleted.count },
            { 'Seviye':'PQ', 'Durum':'Seçili Tarihe Kadar Kapanabilir', 'Durum Kodu':COMMON_PQ_STATUS.PROJECTED_CLOSABLE.code, 'Adet':data.commonModel.standardized.pq.projectedClosable.count },
            { 'Seviye':'PQ', 'Durum':'Açık - Devam Ediyor', 'Durum Kodu':COMMON_PQ_STATUS.OPEN.code, 'Adet':data.commonModel.standardized.pq.open.count },
            { 'Seviye':'PQ', 'Durum':'Açık - Tarih Riski', 'Durum Kodu':COMMON_PQ_STATUS.OPEN_DATE_RISK.code, 'Adet':data.commonModel.standardized.pq.openDateRisk.count },
            { 'Seviye':'PQ', 'Durum':'CAP Yok / Boş', 'Durum Kodu':COMMON_PQ_STATUS.NO_CAP.code, 'Adet':data.commonModel.standardized.pq.noCap.count },
            { 'Seviye':'CAP Adımı', 'Durum':'Tamamlandı', 'Durum Kodu':COMMON_ACTION_STATUS.COMPLETED.code, 'Adet':data.commonModel.standardized.actions.completed.count },
            { 'Seviye':'CAP Adımı', 'Durum':'Gecikmiş', 'Durum Kodu':COMMON_ACTION_STATUS.LATE.code, 'Adet':data.commonModel.standardized.actions.late.count },
            { 'Seviye':'CAP Adımı', 'Durum':'Yaklaşan (30 gün)', 'Durum Kodu':COMMON_ACTION_STATUS.UPCOMING.code, 'Adet':data.commonModel.standardized.actions.upcoming.count },
            { 'Seviye':'CAP Adımı', 'Durum':'Devam Ediyor', 'Durum Kodu':COMMON_ACTION_STATUS.PENDING.code, 'Adet':data.commonModel.standardized.actions.pending.count },
            { 'Seviye':'CAP Adımı', 'Durum':'Tarih Riski', 'Durum Kodu':COMMON_ACTION_STATUS.DATE_RISK.code, 'Adet':data.commonModel.standardized.actions.dateRisk.count },
            { 'Seviye':'CAP Adımı', 'Durum':'Seçili Tarihe Kadar Vadesi Gelen Açık Adım', 'Durum Kodu':'due_by_projection', 'Adet':data.commonModel.standardized.actions.dueByProjection.count }
        ]);
        addJsonSheet(wb, 'Genel_Alan_Ozeti', data.summaryRows);
        addJsonSheet(wb, 'PQ_Kapanis_Projeksiyon', data.pqRows);
        addJsonSheet(wb, 'Tarihe_Kadar_Kapanacak_PQ', data.targetPqRows);
        addJsonSheet(wb, 'Resmi_Kapatilan_PQ', data.officialClosedRows);
        addJsonSheet(wb, 'Adim_Vade_Ozeti', data.summaryRows.map(r => ({
            'Kapsam': r['Kapsam'],
            'Toplam CAP Adımı': r['Toplam CAP Adımı'],
            'Tamamlanan Adım': r['Tamamlanan Adım'],
            'Açık Adım': r['Açık Adım'],
            'Seçili Tarihe Kadar Vadesi Gelen Açık Adım': r['Seçili Tarihe Kadar Vadesi Gelen Açık Adım'],
            'Gecikmiş Adım': r['Gecikmiş Adım'],
            'Tarih Eksik Açık Adım': r['Tarih Eksik Açık Adım'],
            'En Yüksek Gecikme Günü': r['En Yüksek Gecikme Günü'],
            'Ortalama Gecikme Günü': r['Ortalama Gecikme Günü']
        })));
        addJsonSheet(wb, 'Tarihe_Kadar_Adimlar', data.targetStepRows);
        addJsonSheet(wb, 'Geciken_Adim_Detay', data.delayedRows);
        addJsonSheet(wb, 'Tarih_Riski_Adimlar', data.dateRiskRows);
        addJsonSheet(wb, 'CAP_Detay_Tam_Metin', data.commonModel.standardized.actionItems.map(action => {
            const row = buildActionExportRowFull(action.row);
            row['Standart Adım Durumu'] = action.label;
            row['Durum Kodu'] = action.code;
            row['Gecikme Günü'] = action.delayDays || 0;
            row['Kalan Gün'] = action.daysRemaining === null ? '' : action.daysRemaining;
            row['Seçili Tarihe Kadar Vadesi Geliyor'] = action.dueByProjection ? 'EVET' : 'HAYIR';
            return row;
        }));
        downloadReportWorkbook(wb, 'Filtre_Bazli_Stratejik_Rapor.xlsx');
    }

    function exportStrategicReportPDF() {
        const data = buildStrategicFilterReportData();
        if (!data.rows || data.rows.length === 0) {
            return alert('Aktif filtre/kapsam için raporlanacak CAP verisi bulunamadı.');
        }
        showLoading();
        setTimeout(() => {
            try {
                const kpis = getStrategicKpiRows(data);
                const kpiBody = [];
                for (let i = 0; i < kpis.length; i += 4) {
                    const row = kpis.slice(i, i+4).map(r => ({
                        text: [{text: (r['Metrik'] || '-') + '\n', bold:true, fontSize:8, color:'#64748b'}, {text:String(r['Değer'] === undefined ? '-' : r['Değer']), bold:true, fontSize:13, color:'#0f172a'}],
                        fillColor:'#f8fafc',
                        margin:[6,6,6,6]
                    }));
                    while (row.length < 4) row.push({text:'', fillColor:'#ffffff'});
                    kpiBody.push(row);
                }

                const content = [
                    { text:'Filtre Bazlı Stratejik Rapor', style:'header' },
                    { text:`Rapor tarihi: ${formatLongTurkishDate(new Date())} | Veri tarihi: ${getReportDateText()} | Kapsam: ${data.scopeLabel} | Projeksiyon tarihi: ${data.targetLabel}`, style:'subheader' },
                    { table:{ widths:['*','*','*','*'], body:kpiBody }, layout:'noBorders', margin:[0,0,0,12] }
                ];
                if (data.note) content.push({ text:'Rapor Notu', style:'sectionHeader' }, { text:fullTextForPdf(data.note), style:'noteBox' });

                content.push({ text:'Genel ve Alan Bazlı PQ / EI Özeti', style:'sectionHeader' });
                content.push(...makePdfTableFromObjects(data.summaryRows, [
                    {key:'Kapsam', title:'Kapsam'}, {key:'Uygulanabilir Toplam PQ', title:'Toplam PQ'}, {key:'Aktif Filtrede PQ', title:'Filtre PQ'}, {key:'Resmî Kapalı PQ', title:'Resmî Kapalı'}, {key:'Tüm Adımları Tamamlanan CAP/PQ', title:'CAP Tamam'}, {key:'Seçili Tarihe Kadar Toplam Kapanış Beklentisi', title:'Tarih Kapanış'}, {key:'Resmî EI', title:'Resmî EI'}, {key:'Seçili Tarih EI', title:'Tarih EI'}, {key:'Tüm CAP Potansiyel EI', title:'Potansiyel EI'}
                ], ['*','auto','auto','auto','auto','auto','auto','auto','auto'], { maxRows:0 }));

                content.push({ text:'Adım Bazlı Özet', style:'sectionHeader' });
                content.push(...makePdfTableFromObjects(data.summaryRows.map(r => ({
                    'Kapsam': r['Kapsam'],
                    'Toplam': r['Toplam CAP Adımı'],
                    'Tamamlanan': r['Tamamlanan Adım'],
                    'Açık': r['Açık Adım'],
                    'Seçili Tarihe Kadar Vadesi Gelen': r['Seçili Tarihe Kadar Vadesi Gelen Açık Adım'],
                    'Gecikmiş': r['Gecikmiş Adım'],
                    'Tarih Eksik': r['Tarih Eksik Açık Adım'],
                    'Azami Gecikme': r['En Yüksek Gecikme Günü'],
                    'Ortalama Gecikme': r['Ortalama Gecikme Günü']
                })), [
                    {key:'Kapsam', title:'Kapsam'}, {key:'Toplam', title:'Toplam'}, {key:'Tamamlanan', title:'Tamamlanan'}, {key:'Açık', title:'Açık'}, {key:'Seçili Tarihe Kadar Vadesi Gelen', title:'Tarihe Kadar'}, {key:'Gecikmiş', title:'Gecikmiş'}, {key:'Tarih Eksik', title:'Tarih Eksik'}, {key:'Azami Gecikme', title:'Azami'}, {key:'Ortalama Gecikme', title:'Ortalama'}
                ], ['*','auto','auto','auto','auto','auto','auto','auto','auto'], { maxRows:0 }));

                content.push({ text:`Seçili Tarihe Kadar Kapanabilecek PQ'lar (${data.targetLabel})`, style:'sectionHeader' });
                content.push(...makePdfTableFromObjects(data.targetPqRows, [
                    {key:'PQ', title:'PQ'}, {key:'Denetim Alanı', title:'Alan'}, {key:'CE', title:'CE'}, {key:'PQ Durumu', title:'Durum'}, {key:'CAP Adımı', title:'Adım'}, {key:'Tamamlanan Adım', title:'Tamam'}, {key:'PQ Kapanış / Projeksiyon Tarihi', title:'Kapanış Tarihi'}, {key:'Bulgu', title:'Bulgu', fontSize:7}
                ], ['auto','auto','auto','*','auto','auto','auto','*'], { maxRows:0 }));

                content.push({ text:'Geciken Adımlar - Ayrıntılı İçerik', style:'sectionHeader' });
                content.push(...makePdfTableFromObjects(data.delayedRows, [
                    {key:'PQ', title:'PQ'}, {key:'Denetim Alanı', title:'Alan'}, {key:'Adım', title:'Adım'}, {key:'Eylem / CAP Adımı', title:'Eylem', fontSize:7}, {key:'Eylem Ofisi', title:'Sorumlu'}, {key:'Hedef Tarih', title:'Hedef'}, {key:'Gecikme Günü', title:'Gün'}
                ], ['auto','auto','auto','*','auto','auto','auto'], { maxRows:0 }));

                content.push({ text:`Seçili Tarihe Kadar Vadesi Gelen Açık Adımlar (${data.targetLabel})`, style:'sectionHeader' });
                content.push(...makePdfTableFromObjects(data.targetStepRows, [
                    {key:'PQ', title:'PQ'}, {key:'Denetim Alanı', title:'Alan'}, {key:'Adım', title:'Adım'}, {key:'Eylem / CAP Adımı', title:'Eylem', fontSize:7}, {key:'Eylem Ofisi', title:'Sorumlu'}, {key:'Hedef Tarih', title:'Hedef'}, {key:'Durum', title:'Durum'}
                ], ['auto','auto','auto','*','auto','auto','auto'], { maxRows:0 }));

                const docDef = {
                    pageOrientation:'landscape',
                    pageSize:'A4',
                    content,
                    footer: (currentPage, pageCount) => ({ text: currentPage + ' / ' + pageCount, alignment:'right', margin:[0,0,25,0], fontSize:8, color:'#64748b' }),
                    styles: {
                        header:{ fontSize:17, bold:true, color:'#2563eb', margin:[0,0,0,4] },
                        subheader:{ fontSize:9, color:'#64748b', margin:[0,0,0,12] },
                        sectionHeader:{ fontSize:12, bold:true, color:'#0f172a', margin:[0,9,0,6] },
                        noteBox:{ fontSize:10, color:'#0f172a', fillColor:'#f8fafc', margin:[0,0,0,10] },
                        th:{ bold:true, fontSize:8, fillColor:'#f1f5f9', margin:[0,3,0,3] }
                    },
                    defaultStyle:{ font:'Roboto', fontSize:8 }
                };
                safeDownloadPdf(docDef, 'Filtre_Bazli_Stratejik_Rapor.pdf');
            } catch(e) {
                console.error(e);
                alert('Stratejik PDF oluşturulurken hata oluştu: ' + (e && e.message ? e.message : e));
            } finally {
                hideLoading();
            }
        }, 100);
    }


    function getActiveExportContext() {
        const activeTabEl = document.querySelector('.tab-content.active');
        const activeTab = activeTabEl ? activeTabEl.id : 'tab-dashboard';
        let ctx = { activeTab, title: 'ICAO USOAP CMA CAP İzleme Raporu', fileName: 'ICAO_CAP_Raporu.xlsx', mode: 'default', rows: [] };
        if (activeTab === 'tab-dashboard') {
            ctx.title = 'Dashboard Genel Yönetim Raporu'; ctx.fileName = 'Dashboard_Genel_Raporu.xlsx'; ctx.mode = 'dashboard'; ctx.rows = getFilteredData();
        } else if (activeTab === 'tab-smart') {
            ctx.title = 'Akıllı Yönetim Özeti'; ctx.fileName = 'Akilli_Yonetim_Ozeti.xlsx'; ctx.mode = 'smart'; ctx.rows = getFilteredData();
        } else if (activeTab === 'tab-milestones') {
            ctx.title = 'Hedef Tabloları ve EI Projeksiyon Raporu'; ctx.fileName = 'Hedef_Tablolari_EI_Projeksiyon.xlsx'; ctx.mode = 'milestones'; ctx.rows = getFilteredData();
        } else if (activeTab === 'tab-summary') {
            ctx.title = 'Alan Özetleri Performans Karnesi'; ctx.fileName = 'Alan_Ozetleri_Performans_Karnesi.xlsx'; ctx.mode = 'summary'; ctx.rows = getFilteredData();
        } else if (activeTab === 'tab-upcoming') {
            ctx.title = 'Yaklaşan Görevler Raporu (30 Gün)'; ctx.fileName = 'Yaklasan_Gorevler_Detayli.xlsx'; ctx.mode = 'upcoming'; ctx.rows = getUpcomingTasks(getFilteredData()); ctx.viewMode = getTaskViewMode('upcoming'); ctx.viewLabel = getTaskViewLabel('upcoming', ctx.viewMode); ctx.rangeLabel = 'Önümüzdeki 30 gün';
        } else if (activeTab === 'tab-past') {
            let rangeDays = getPastRangeDaysFromSelect();
            ctx.title = 'Geçmiş Görevler / Tarihi Geçmiş Açık Eylemler'; ctx.fileName = 'Gecmis_Gorevler_Detayli.xlsx'; ctx.mode = 'past'; ctx.rows = getPastTasks(getFilteredData(), rangeDays); ctx.viewMode = getTaskViewMode('past'); ctx.viewLabel = getTaskViewLabel('past', ctx.viewMode); ctx.rangeLabel = getPastRangeLabel();
        } else if (activeTab === 'tab-visits') {
            ctx.title = 'Ziyaret ve İç Denetim Planı'; ctx.fileName = 'Ziyaret_ve_Ic_Denetim_Plani.xlsx'; ctx.mode = 'visits'; ctx.rows = getVisibleVisits();
        } else if (activeTab === 'tab-icao-visit-validation') {
            ctx.title = 'ICAO Resmî Ziyareti / ICVM'; ctx.fileName = 'ICAO_Resmi_Ziyareti_ICVM.xlsx'; ctx.mode = 'icao_official_visit'; ctx.rows = [];
        } else if (activeTab === 'tab-visit-scope') {
            ctx.title = 'Ziyaret Kapsamı ve Hazırlık Çalışma Kâğıdı'; ctx.fileName = 'Ziyaret_Kapsam_Hazirlik.xlsx'; ctx.mode = 'visit_scope'; ctx.rows = [];
        } else if (activeTab === 'tab-visit-workspace') {
            ctx.title = 'Ziyaret Saha Kayıtları ve İç Denetim Çalışma Notları'; ctx.fileName = 'Ziyaret_Saha_Kayitlari.xlsx'; ctx.mode = 'visit_workspace'; ctx.rows = [];
        } else if (activeTab === 'tab-visit-followup') {
            ctx.title = 'Ziyaret ve İç Denetim Takip Yönetimi'; ctx.fileName = 'Ziyaret_Takip_Yonetimi.xlsx'; ctx.mode = 'visit_followup'; ctx.rows = [];
        } else if (activeTab === 'tab-visit-consultation') {
            ctx.title = 'Ziyaret ve İç Denetim Danışma Yönetimi'; ctx.fileName = 'Ziyaret_Danisma_Yonetimi.xlsx'; ctx.mode = 'visit_consultation'; ctx.rows = [];
        } else if (activeTab === 'tab-visit-reports') {
            ctx.title = 'Ziyaret ve İç Denetim Raporları'; ctx.fileName = 'Ziyaret_Raporlari.xlsx'; ctx.mode = 'visit_reports'; ctx.rows = [];
        } else if (activeTab === 'tab-visit-management') {
            ctx.title = 'Ziyaret Yönetim Paneli ve Takvim'; ctx.fileName = 'Ziyaret_Yonetim_Paneli_Takvim.xlsx'; ctx.mode = 'visit_management'; ctx.rows = [];
        } else if (activeTab === 'tab-visit-analysis') {
            ctx.title = 'PQ/CAP Geçmişi, Karşılaştırma ve Tekrarlanan Sorun Analizi'; ctx.fileName = 'Ziyaret_PQ_CAP_Gecmis_Karsilastirma_Tekrar_Analizi.xlsx'; ctx.mode = 'visit_analysis'; ctx.rows = [];
        } else if (activeTab === 'tab-visit-audit') {
            ctx.title = 'Ziyaret Değişiklik Geçmişi ve Denetim İzi'; ctx.fileName = 'Ziyaret_Degisiklik_Gecmisi.xlsx'; ctx.mode = 'visit_audit'; ctx.rows = [];
        } else if (activeTab === 'tab-list') {
            ctx.title = 'Detaylı CAP Listesi Raporu'; ctx.fileName = 'Detayli_CAP_Listesi_Raporu.xlsx'; ctx.mode = 'list'; ctx.rows = getFilteredData();
        } else if (activeTab === 'tab-quality') {
            ctx.title = 'Veri Kalitesi Merkezi Raporu'; ctx.fileName = 'Veri_Kalitesi_Merkezi.xlsx'; ctx.mode = 'quality'; ctx.rows = getFilteredData();
        } else if (activeTab === 'tab-empty-caps') {
            ctx.title = 'CAP Eksiklikleri Raporu'; ctx.fileName = 'CAP_Eksiklikleri_Detayli.xlsx'; ctx.mode = 'empty'; ctx.rows = getVisibleCapDeficiencyIssues(getFilteredData());
        } else if (activeTab === 'tab-icao-closed') {
            ctx.title = 'ICAO Tarafından Kapatılan PQ Raporu'; ctx.fileName = 'ICAO_Kapatilanlar_Detayli.xlsx'; ctx.mode = 'icao';
            Object.keys(pqMasterData).forEach(pq => { if (pqMasterData[pq] && pqMasterData[pq].isIcaoClosed) ctx.rows.push({ pq, ...pqMasterData[pq] }); });
            ctx.rows.sort((a,b) => sortAreas(a.alan,b.alan) || sortPQs(a.pq,b.pq));
        } else if (activeTab === 'tab-strategic') {
            ctx.title = 'Filtre Bazlı Stratejik Rapor'; ctx.fileName = 'Filtre_Bazli_Stratejik_Rapor.xlsx'; ctx.mode = 'strategic'; ctx.rows = getFilteredData();
        } else if (activeTab === 'tab-trend') {
            ctx.title = 'Trend ve Kıyaslama Raporu'; ctx.fileName = 'Trend_Kiyaslama.xlsx'; ctx.mode = 'trend'; ctx.rows = [];
        } else if (activeTab === 'tab-report') {
            ctx.title = 'Yönetici Brifing Raporu'; ctx.fileName = 'Yonetici_Brifing_Raporu.xlsx'; ctx.mode = 'manager'; ctx.rows = rawData;
        } else if (activeTab === 'tab-kanban') {
            ctx.title = 'EI Odaklı Kanban Öncelik Raporu'; ctx.fileName = 'Kanban_Oncelik_Raporu.xlsx'; ctx.mode = 'kanban'; ctx.rows = getFilteredData();
        } else {
            ctx.rows = getFilteredData(); ctx.fileName = 'ICAO_CAP_Filtrelenmis_Detayli_Rapor.xlsx';
        }
        if (window.activeReadyFilter && READY_FILTER_DEFINITIONS[window.activeReadyFilter]) {
            ctx.readyFilterKey = window.activeReadyFilter;
            ctx.readyFilterLabel = READY_FILTER_DEFINITIONS[window.activeReadyFilter].label;
        }
        return ctx;
    }

    function updateActiveScreenExportButtons(){
        const btn=document.querySelector('.tab-btn.active');
        const screen=(btn&&btn.textContent?btn.textContent.replace(/\s+/g,' ').trim():'Aktif ekran');
        const pdf=document.getElementById('activeScreenPdfBtn'),excel=document.getElementById('activeScreenExcelBtn');
        if(pdf){pdf.textContent='📄 Ekran PDF';pdf.title=`${screen} ekranını PDF olarak dışa aktar`;}
        if(excel){excel.textContent='📊 Ekran Excel';excel.title=`${screen} ekranını Excel olarak dışa aktar`;}
    }
    window.updateActiveScreenExportButtons=updateActiveScreenExportButtons;


    function exportDataQualityExcel(ctx) {
        const model = buildDataQualityModel((ctx && ctx.rows) || getFilteredData());
        const visibleIssues = getVisibleDataQualityIssues(model);

        if (!model.scope.pqs.length && !model.issues.length) {
            alert('Dışa aktarılacak veri kalitesi kaydı bulunamadı.');
            return;
        }

        const wb = createReportWorkbook({ title:'Veri Kalitesi Merkezi', subject:'USOAP CMA veri kalite kontrolü' });

        appendWorkbookSheets(wb, [
            createSheetDefinition('Rapor_Baglamı', buildFilterContextRows(ctx || {
                title: 'Veri Kalitesi Merkezi',
                mode: 'quality',
                rows: getFilteredData()
            })),
            createSheetDefinition('Kalite_Ozeti', buildDataQualitySummaryRows(model)),
            createSheetDefinition('Kategori_Ozeti', buildDataQualityCategoryRows(model)),
            createSheetDefinition('Alan_Ozeti', buildDataQualityAreaRows(model)),
            createSheetDefinition('Filtreli_Sorun_Detay', buildDataQualityIssueRows(visibleIssues)),
            createSheetDefinition('Tum_Sorun_Detay', buildDataQualityIssueRows(model.issues)),
            createSheetDefinition('Sorunsuz_PQlar', model.issueFreePqs.map(pq => {
                const master = pqMasterData[pq] || {};
                return {
                    'PQ': pq,
                    'Denetim Alanı': master.alan || 'DİĞER',
                    'CE': master.ce || '',
                    'PQ Sorumlusu': master.sorumlu || '',
                    'Doğrulama Türü': master.tur || ''
                };
            }))
        ]);

        downloadReportWorkbook(wb, (ctx && ctx.fileName) || 'Veri_Kalitesi_Merkezi.xlsx');
    }

    function buildDataQualityPdfDetailBlocks(detailRows) {
        const blocks = [];
        (detailRows || []).forEach((row, index) => {
            blocks.push({
                text: `${index + 1}. PQ ${row['PQ'] || '-'}${row['Adım'] ? ' / Adım ' + row['Adım'] : ''} — ${row['Kategori'] || '-'}`,
                style: 'issueTitle',
                pageBreak: index > 0 && index % 12 === 0 ? 'before' : undefined
            });
            blocks.push({
                table: {
                    widths: [105, '*'],
                    body: [
                        [{text:'Önem seviyesi',bold:true,fillColor:'#f1f5f9'}, fullTextForPdf(row['Seviye'] || '-')],
                        [{text:'Denetim alanı / CE',bold:true,fillColor:'#f1f5f9'}, fullTextForPdf(`${row['Denetim Alanı'] || '-'} / ${row['CE'] || '-'}`)],
                        [{text:'Sorumlu ofis',bold:true,fillColor:'#f1f5f9'}, fullTextForPdf(row['Sorumlu Ofis'] || '-')],
                        [{text:'Kontrol edilen alan',bold:true,fillColor:'#f1f5f9'}, fullTextForPdf(row['Kontrol Edilen Alan'] || '-')],
                        [{text:'Sorun',bold:true,fillColor:'#f1f5f9'}, fullTextForPdf(row['Sorun'] || '-')],
                        [{text:'Mevcut değer',bold:true,fillColor:'#f1f5f9'}, fullTextForPdf(row['Mevcut Değer'] || '-')],
                        [{text:'Düzeltme önerisi',bold:true,fillColor:'#f1f5f9'}, fullTextForPdf(row['Düzeltme Önerisi'] || '-')]
                    ]
                },
                layout:'lightHorizontalLines',
                margin:[0,0,0,8]
            });
        });
        if (!blocks.length) blocks.push({text:'Seçili filtre kapsamında kalite sorunu bulunamadı.',italics:true,color:'#64748b'});
        return blocks;
    }

    function exportDataQualityPDF(ctx) {
        try {
            const model = buildDataQualityModel((ctx && ctx.rows) || getFilteredData());
            const visibleIssues = getVisibleDataQualityIssues(model);
            if (!model.scope.pqs.length && !model.issues.length) {
                alert('Dışa aktarılacak veri kalitesi kaydı bulunamadı.');
                return;
            }
            const summaryRows = buildDataQualitySummaryRows(model);
            const categoryRows = buildDataQualityCategoryRows(model);
            const areaRows = buildDataQualityAreaRows(model);
            const detailRows = buildDataQualityIssueRows(visibleIssues);
            const content = [
                { text: 'Veri Kalitesi Merkezi Raporu', style: 'header' },
                { text: `Rapor tarihi: ${formatLongTurkishDate(new Date())} | Veri tarihi: ${getReportDateText()} | Analiz edilen PQ: ${model.scope.pqs.length} | Toplam sorun: ${model.issues.length} | Yerel filtrede: ${visibleIssues.length}`, style: 'subheader' },
                { text: 'Kalite Göstergeleri', style: 'sectionHeader' },
                ...makePdfTableFromObjects(summaryRows, [
                    { key:'Metrik', title:'Metrik' }, { key:'Değer', title:'Değer' }, { key:'Açıklama', title:'Açıklama' }
                ], ['*','auto','2*'], {maxRows:30}),
                { text:'Sorun Kategorileri', style:'sectionHeader' },
                ...makePdfTableFromObjects(categoryRows, [
                    { key:'Kategori', title:'Kategori' }, { key:'Seviye', title:'Seviye' }, { key:'Sorun Sayısı', title:'Sorun' }, { key:'Etkilenen PQ', title:'PQ' }, { key:'Açıklama', title:'Açıklama' }
                ], ['*','auto','auto','auto','2*'], {maxRows:100}),
                { text:'Alan Bazlı Kalite Özeti', style:'sectionHeader' },
                ...makePdfTableFromObjects(areaRows, [
                    { key:'Denetim Alanı', title:'Alan' }, { key:'PQ Sayısı', title:'PQ' }, { key:'Etkilenen PQ', title:'Etkilenen' }, { key:'Toplam Sorun', title:'Sorun' }, { key:'Kritik/Yüksek', title:'Kritik/Yüksek' }, { key:'Sorunsuz PQ %', title:'Sorunsuz %' }
                ], ['*','auto','auto','auto','auto','auto'], {maxRows:100}),
                { text:'Ayrıntılı Kalite Sorunları', style:'sectionHeader' },
                ...buildDataQualityPdfDetailBlocks(detailRows)
            ];
            const docDef = createStandardPdfDefinition(content, {
                pageOrientation:'landscape', pageSize:'A4',
                styles:{issueTitle:{fontSize:9.5,bold:true,color:'#991b1b',margin:[0,6,0,3]}},
                defaultStyle:{font:'Roboto',fontSize:7.8}
            });
            return safeDownloadPdf(docDef, 'Veri_Kalitesi_Merkezi.pdf');
        } catch (error) {
            console.error('Veri Kalitesi PDF hatası:', error);
            pdfExportToast('Veri Kalitesi PDF raporu hazırlanamadı: ' + (error && error.message ? error.message : error), true);
            alert('PDF oluşturulurken hata oluştu: ' + (error && error.message ? error.message : error));
        }
    }


    function exportExcel() {
        const ctx = getActiveExportContext();
        if (ctx.mode === 'trend') { exportTrendExcel(); return; }
        if (ctx.mode === 'strategic') { exportStrategicReportExcel(); return; }
        if (ctx.mode === 'quality') { exportDataQualityExcel(ctx); return; }
        if (ctx.mode === 'visits') { exportVisitsExcel(ctx); return; }
        if (ctx.mode === 'icao_official_visit') { exportIcaoOfficialVisitExcel(); return; }
        if (ctx.mode === 'visit_scope') { exportVisitScopeExcel(); return; }
        if (ctx.mode === 'visit_workspace') { exportVisitWorkspaceExcel(); return; }
        if (ctx.mode === 'visit_followup') { exportVisitFollowUpExcel(); return; }
        if (ctx.mode === 'visit_consultation') { exportVisitConsultationExcel(); return; }
        if (ctx.mode === 'visit_reports') { exportVisitReportsExcel(); return; }
        if (ctx.mode === 'visit_management') { exportVisitManagementExcel(); return; }
        if (ctx.mode === 'visit_analysis') { exportVisitAnalysisExcel(); return; }
        if (ctx.mode === 'visit_audit') { exportVisitAuditExcel(); return; }
        if (!ctx.rows || ctx.rows.length === 0) {
            if (!(ctx.mode === 'milestones' && Object.keys(baseEIData).length > 0)) return alert('Dışa aktarılacak veri bulunamadı.');
        }

        const wb = createReportWorkbook(ctx);
        addJsonSheet(wb, 'Rapor_Baglamı', buildFilterContextRows(ctx));

        if (ctx.mode === 'manager') {
            const bundle = buildManagerReportBundle();
            const support = bundle.support;
            addJsonSheet(wb, 'Yonetici_Brifingi', buildManagerReportExcelRows(bundle));
            addJsonSheet(wb, 'Kapatilmasi_Beklenen', buildManagerExpectedClosureExcelRows(bundle));
            addJsonSheet(wb, 'Kapatilmasi_Beklenen_PQ', buildManagerExpectedClosurePQExcelRows(bundle));
            addJsonSheet(wb, 'Kritik_Yol', support.criticalPath.map(i => ({ 'PQ': i.pq, 'Alan': i.area, 'CE': i.ce, 'Sorumlu': i.owner, 'Kilit Tarih': formatTrendDate(i.latestDate), 'Kalan Adım': i.remainingSteps, 'Gecikmiş Adım': i.lateSteps, 'Tarih Eksik': i.missingDates, 'İlerleme %': trendSafePct(i.progressPct), 'Alan EI Katkısı %': trendSafePct(i.areaContributionPct), 'Bulgu': fullTextForExcel(i.bulgu) })));
            addJsonSheet(wb, 'Hizli_EI_Kazanim', support.topImpact.map(i => ({ 'PQ': i.pq, 'Alan': i.area, 'CE': i.ce, 'Sorumlu': i.owner, 'Kalan Adım': i.remainingSteps, 'İlerleme %': trendSafePct(i.progressPct), 'Alan EI Katkısı %': trendSafePct(i.areaContributionPct), 'Kilit Tarih': formatTrendDate(i.latestDate), 'Bulgu': fullTextForExcel(i.bulgu) })));
            addJsonSheet(wb, 'Sorumlu_Karnesi', support.officeRows.map(o => ({ 'Ofis': o.office, 'Toplam Eylem': o.totalActions, 'Tamamlanan': o.doneActions, 'Devam Eden': o.ongoingActions, 'Gecikmiş': o.lateActions, 'PQ Sayısı': o.pqCount, 'Tamamlanma %': trendSafePct(o.completionRate), 'Gecikme %': trendSafePct(o.delayRate) })));
            addJsonSheet(wb, 'Yaklasan_Gorevler', (bundle.allUpcoming || bundle.upcoming).map(d => buildActionExportRowFull(d, { mode: 'upcoming' })));
            addJsonSheet(wb, 'Gecmis_Gorevler', (bundle.allPast || bundle.past).map(d => buildActionExportRowFull(d, { mode: 'past' })));
            addJsonSheet(wb, 'Tarih_Riski', (bundle.allMissingDateRows || bundle.missingDateRows).map(d => buildActionExportRowFull(d)));
            addJsonSheet(wb, 'Secili_PQlar', buildPQExportRows(rawData.filter(d => bundle.selectedPQs.includes(d.pq))));
            downloadReportWorkbook(wb, ctx.fileName); return;
        }
        if (ctx.mode === 'kanban') {
            const mode = (document.getElementById('kanbanViewMode') || {}).value || 'step';
            addJsonSheet(wb, 'Kanban_Kartlari', buildKanbanExportRows(ctx.rows, mode));
            addJsonSheet(wb, 'Kanban_PQ_Ozeti', buildKanbanExportRows(ctx.rows, 'pq'));
            addJsonSheet(wb, 'Yonetici_Ozeti', buildExecutiveSummaryRows(ctx.rows));
            addJsonSheet(wb, 'Alan_Ozeti', buildAreaScorecardRows(ctx.rows));
            addJsonSheet(wb, 'Tarih_Riski', getDateRiskRows(ctx.rows).map(d => buildActionExportRowFull(d)));
            downloadReportWorkbook(wb, ctx.fileName); return;
        }

        if (ctx.mode === 'smart') {
            const smart = buildSmartManagementModel(ctx.rows);
            addJsonSheet(wb, 'Akilli_Ozet', buildSmartSummaryExportRows(smart));
            addJsonSheet(wb, 'Oncelikli_PQ', buildSmartPqExportRows(smart.critical));
            addJsonSheet(wb, 'Hizli_Kazanim_PQ', buildSmartPqExportRows(smart.quickWins));
            addJsonSheet(wb, 'Darbogaz_Ofisler', buildSmartOfficeExportRows(smart.officeRows));
            addJsonSheet(wb, 'Geciken_Adimlar', smart.delayedActions.map(x => buildActionExportRowFull(x.row, {mode:'past'})));
            addJsonSheet(wb, 'Son30Gun_CAP_Tamamlanan', buildSmartPqExportRows(smart.recentCompleted));
            downloadReportWorkbook(wb, ctx.fileName); return;
        }

        if (ctx.mode === 'dashboard') {
            addJsonSheet(wb, 'Dashboard_KPI', buildDashboardKpiRows(ctx.rows));
            const officialEiCfg = getOfficialEiExportConfig();
            if (officialEiCfg) {
                addJsonSheet(wb, 'ICAO_Resmi_EI_Donemler', buildOfficialEiPeriodExportRows(officialEiCfg));
                addJsonSheet(wb, 'ICAO_Resmi_EI_Overall', buildOfficialEiOverallExportRows(officialEiCfg));
                addJsonSheet(wb, 'ICAO_Resmi_EI_Degisim', buildOfficialEiComparisonExportRows(officialEiCfg));
            }
            addJsonSheet(wb, 'EI_Safhalari', buildEIOverviewRows(rawData));
            addJsonSheet(wb, 'Alan_Karnesi', buildAreaScorecardRows(ctx.rows));
            addJsonSheet(wb, 'PQ_Ozeti', buildPQExportRows(ctx.rows));
            addJsonSheet(wb, 'Gecikmis_Oncelik', getTopDelayedRows(ctx.rows, 100).map(d => buildActionExportRowFull(d, { mode:'past' })));
            addJsonSheet(wb, 'Yaklasan_Oncelik', getTopUpcomingRows(ctx.rows, 100).map(d => buildActionExportRowFull(d, { mode:'upcoming' })));
            addJsonSheet(wb, 'Tarih_Riski', getDateRiskRows(ctx.rows).map(d => buildActionExportRowFull(d)));
            addJsonSheet(wb, 'CAP_Detay_Tam_Metin', ctx.rows.map(d => buildActionExportRowFull(d)));
            downloadReportWorkbook(wb, ctx.fileName); return;
        }

        if (ctx.mode === 'milestones') {
            addJsonSheet(wb, 'Hedef_Matrisi', buildMilestoneMatrixRows(ctx.rows));
            addJsonSheet(wb, 'Ulasilamayan_Hedefler', buildMilestoneGapRows(ctx.rows));
            addJsonSheet(wb, 'Hedefe_Katki_PQ', buildMilestoneContributionRows(ctx.rows));
            addJsonSheet(wb, 'Tarih_Simulasyonu', buildDateSimulationRowsFromUi());
            addJsonSheet(wb, 'EI_Safhalari', buildEIOverviewRows(rawData));
            addJsonSheet(wb, 'CAP_Detay_Tam_Metin', ctx.rows.map(d => buildActionExportRowFull(d)));
            downloadReportWorkbook(wb, ctx.fileName); return;
        }

        if (ctx.mode === 'summary') {
            addJsonSheet(wb, 'Alan_Karnesi', buildAreaScorecardRows(ctx.rows));
            addJsonSheet(wb, 'Alan_EI', buildEIOverviewRows(rawData).filter(r => r['Kapsam'] !== 'TÜRKİYE GENELİ'));
            addJsonSheet(wb, 'Alan_Gecikme_Ozeti', buildTaskAreaSummaryRows(getTopDelayedRows(ctx.rows, 100000), 'past'));
            addJsonSheet(wb, 'Alan_PQ_Detay', buildPQExportRows(ctx.rows));
            addJsonSheet(wb, 'Alan_CAP_Detay', ctx.rows.map(d => buildActionExportRowFull(d)));
            downloadReportWorkbook(wb, ctx.fileName); return;
        }

        if (ctx.mode === 'list') {
            addJsonSheet(wb, 'Yonetici_Ozeti', buildExecutiveSummaryRows(ctx.rows));
            addJsonSheet(wb, 'Alan_Ozeti', buildAreaScorecardRows(ctx.rows));
            addJsonSheet(wb, 'PQ_Ozeti', buildPQExportRows(ctx.rows));
            addJsonSheet(wb, 'CAP_Detay_Tam_Metin', ctx.rows.map(d => buildActionExportRowFull(d)));
            addJsonSheet(wb, 'Gecikmis_Eylemler', getTopDelayedRows(ctx.rows, 100000).map(d => buildActionExportRowFull(d, { mode:'past' })));
            addJsonSheet(wb, 'Tarih_Riski', getDateRiskRows(ctx.rows).map(d => buildActionExportRowFull(d)));
            addJsonSheet(wb, 'EI_Ozeti', buildEIOverviewRows(rawData));
            downloadReportWorkbook(wb, ctx.fileName); return;
        }

        let detailRows = [];
        if (ctx.mode === 'icao') {
            detailRows = ctx.rows.map(m => ({
                'PQ': m.pq,
                'Denetim Alanı': m.alan || 'DİĞER',
                'CE': m.ce || '',
                'Doğrulama Türü': m.tur || '',
                'PQ Sorumlusu': m.sorumlu || '',
                'Validasyon Görevi': m.validasyonGorevi || '',
                'ICAO Kapattı mı': 'EVET',
                'Bulgu': fullTextForExcel(m.bulgu || '')
            }));
            addJsonSheet(wb, 'Yonetici_Ozeti', buildExecutiveSummaryRows(getFilteredData()));
            addJsonSheet(wb, 'Validasyon_Ozeti', buildIcaoValidationSummaryRows(ctx.rows));
            addJsonSheet(wb, 'Kapatilan_PQ_Detay', detailRows);
            addJsonSheet(wb, 'EI_Etkisi', buildEIOverviewRows(rawData));
            downloadReportWorkbook(wb, ctx.fileName); return;
        } else if (ctx.mode === 'empty') {
            detailRows = ctx.rows.map(issue => {
                const m = pqMasterData[issue.pq] || issue.master || {};
                const definition = DATA_QUALITY_CATEGORIES[issue.category] || { label: issue.category || 'CAP Eksikliği' };
                return {
                    'PQ': issue.pq,
                    'Adım': issue.step || '',
                    'Denetim Alanı': m.alan || issue.area || 'DİĞER',
                    'CE': m.ce || issue.ce || '',
                    'Eksiklik Türü': definition.label,
                    'Önem Seviyesi': (DATA_QUALITY_SEVERITIES[issue.severity] || {}).label || issue.severity || '',
                    'Kontrol Alanı': issue.field || '',
                    'Sorun': issue.problem || definition.description || '',
                    'Mevcut Değer': fullTextForExcel(issue.currentValue || 'Boş'),
                    'Düzeltme Önerisi': fullTextForExcel(issue.recommendation || ''),
                    'Sorumlu Ofis': issue.office || '',
                    'Bulgu': fullTextForExcel(m.bulgu || '')
                };
            });
            addJsonSheet(wb, 'Yonetici_Ozeti', buildExecutiveSummaryRows(getFilteredData()));
            addJsonSheet(wb, 'CAP_Eksiklik_Ozeti', buildEmptyCapSummaryRows(ctx.rows));
            addJsonSheet(wb, 'CAP_Eksiklik_Detay', detailRows);
            addJsonSheet(wb, 'EI_Safhalari', buildEIOverviewRows(rawData));
            downloadReportWorkbook(wb, ctx.fileName); return;
        } else {
            detailRows = ctx.rows.map(d => buildActionExportRowFull(d, { mode: ctx.mode }));
        }

        addJsonSheet(wb, 'Yonetici_Ozeti', buildExecutiveSummaryRows(ctx.rows));
        if (ctx.mode === 'past' || ctx.mode === 'upcoming') {
            addTaskExportSheets(wb, ctx, detailRows);
            addJsonSheet(wb, ctx.mode === 'past' ? 'Gecikme_Bucket' : 'Kalan_Sure_Bucket', buildDelayBucketRows(ctx.rows, ctx.mode));
            addJsonSheet(wb, 'Sorumlu_Ofis_Ozeti', buildTaskOfficeSummaryRows(ctx.rows, ctx.mode));
            addJsonSheet(wb, 'PQ_Ozeti', buildPQExportRows(ctx.rows));
        } else {
            addJsonSheet(wb, 'Liste', detailRows);
            addJsonSheet(wb, 'PQ_Ozeti', buildPQExportRows(ctx.rows));
            addJsonSheet(wb, 'Alan_Ozeti', buildAreaScorecardRows(ctx.rows));
        }
        addJsonSheet(wb, 'EI_Ozeti', buildEIOverviewRows(rawData));
        downloadReportWorkbook(wb, ctx.fileName);
    }


    function buildPdfTableRowsForContext(ctx) {
        let widths = [];
        let bodyData = [];
        if (ctx.mode === 'icao') {
            widths = ['auto', 'auto', 'auto', '*'];
            bodyData.push([{text: 'PQ', style: 'th'}, {text: 'Alan', style: 'th'}, {text: 'Görev', style: 'th'}, {text: 'Bulgu', style: 'th'}]);
            ctx.rows.forEach(m => bodyData.push([{text:m.pq, fontSize:9}, {text:m.alan||'DİĞER', fontSize:9}, {text:m.validasyonGorevi||'-', fontSize:9}, {text:fullTextForPdf(m.bulgu||'-'), fontSize:8}]));
        } else if (ctx.mode === 'empty') {
            widths = ['auto', 'auto', 'auto', '*', '*'];
            bodyData.push([{text: 'PQ / Adım', style: 'th'}, {text: 'Alan', style: 'th'}, {text: 'Eksiklik', style: 'th'}, {text: 'Sorun / Mevcut Değer', style: 'th'}, {text: 'Düzeltme Önerisi', style: 'th'}]);
            ctx.rows.forEach(issue => {
                const m = pqMasterData[issue.pq] || issue.master || {};
                const definition = DATA_QUALITY_CATEGORIES[issue.category] || { label: issue.category || 'CAP Eksikliği' };
                bodyData.push([
                    {text:`${issue.pq}${issue.step ? ' / ' + issue.step : ''}`, fontSize:9},
                    {text:m.alan || issue.area || 'DİĞER', fontSize:9},
                    {text:definition.label, fontSize:8, color:'#ef4444'},
                    {text:fullTextForPdf(`${issue.problem || definition.description || ''}
Mevcut: ${issue.currentValue || 'Boş'}`), fontSize:8},
                    {text:fullTextForPdf(issue.recommendation || '-'), fontSize:8}
                ]);
            });
        } else {
            widths = ['auto', 'auto', 'auto', '*', 'auto', 'auto', 'auto'];
            bodyData.push([{text:'PQ', style:'th'}, {text:'Alan', style:'th'}, {text:'Adım', style:'th'}, {text:'Eylem', style:'th'}, {text:'Sorumlu', style:'th'}, {text:'Hedef', style:'th'}, {text: ctx.mode === 'past' ? 'Gecikme' : 'Durum', style:'th'}]);
            const today = new Date(); today.setHours(0,0,0,0);
            ctx.rows.forEach(d => {
                let m = pqMasterData[d.pq] || {}; let stat = getStatus(d); let delayCell = stat.label;
                if (ctx.mode === 'past') { let dt = parseDateObj(d.estDate); delayCell = dt ? Math.ceil((today - dt) / (1000*60*60*24)) + ' gün' : '-'; }
                if (ctx.mode === 'upcoming') { let dt = parseDateObj(d.estDate); delayCell = dt ? Math.ceil((dt - today) / (1000*60*60*24)) + ' gün' : '-'; }
                bodyData.push([
                    {text:d.pq, fontSize:9}, {text:m.alan||'DİĞER', fontSize:9}, {text:d.step, fontSize:9},
                    {text:fullTextForPdf(d.action), fontSize:8}, {text:d.office||'-', fontSize:8}, {text:d.estDate||'-', fontSize:9},
                    {text:delayCell, fontSize:9, bold: ctx.mode === 'past' || ctx.mode === 'upcoming', color: stat.type === 'done' ? '#10b981' : (stat.type === 'late' ? '#ef4444' : '#f59e0b')}
                ]);
            });
        }
        return { widths, bodyData };
    }

    function buildPdfAreaSummaryTable(rows) {
        let areaRows = buildAreaExportRows(rows).slice(0, 30);
        if (!areaRows.length) return null;
        let body = [[{text:'Alan', style:'th'}, {text:'PQ', style:'th'}, {text:'Tamamlanan PQ', style:'th'}, {text:'Açık PQ', style:'th'}, {text:'CAP Adımı', style:'th'}, {text:'Gecikmiş', style:'th'}, {text:'İlerleme %', style:'th'}]];
        areaRows.forEach(r => body.push([r['Denetim Alanı'], r['PQ Sayısı'], r['Tamamlanan PQ'], r['Açık PQ'], r['CAP Adımı'], r['Gecikmiş Adım'], r['PQ İlerleme %']]));
        return { table: { headerRows: 1, widths: ['*','auto','auto','auto','auto','auto','auto'], body }, layout: 'lightHorizontalLines', margin: [0,0,0,12] };
    }

    function exportManagerPDF() {
        if (!rawData || rawData.length === 0) return alert('Dışa aktarılacak veri bulunamadı.');
        showLoading();
        setTimeout(() => {
            try {
                const bundle = buildManagerReportBundle();
                const a = bundle.analysis || {};
                const support = bundle.support || { criticalPath: [], topImpact: [], officeRows: [] };
                const phases = getManagerEiPhaseRows(bundle);
                const officialEI = phases[1] ? phases[1].ei : ((a.ei && a.ei.overall) || 0);
                const expectedEI = phases[2] ? phases[2].ei : ((a.ei && a.ei.overall) || 0);
                const projectedEI = phases[3] ? phases[3].ei : ((a.ei && a.ei.projectedOverall) || 0);
                const expectedClosureTotal = phases[2] ? (phases[2].expectedClosureCount || 0) : 0;
                const note = (document.getElementById('managementNotes') || {}).value || '';
                let kpis = buildManagerReportExcelRows(bundle).slice(0, 6).map(r => ({ text: [{text: (r['Başlık'] || '-') + '\n', bold:true, fontSize:8, color:'#64748b'}, {text:String(r['Değer'] === undefined ? '-' : r['Değer']), bold:true, fontSize:13, color:'#0f172a'}], fillColor:'#f8fafc', margin:[6,6,6,6] }));
                if (!kpis.length) kpis = [{ text:'Özet üretilemedi', fillColor:'#f8fafc', margin:[6,6,6,6] }];
                let kpiBody = [];
                for (let i = 0; i < kpis.length; i += 3) {
                    const row = kpis.slice(i, i+3);
                    while (row.length < 3) row.push({text:'', fillColor:'#ffffff'});
                    kpiBody.push(row);
                }
                let content = [
                    {text:'Yönetici Brifing Raporu', style:'header'},
                    {text:'Rapor tarihi: ' + new Date().toLocaleDateString('tr-TR') + ' | Resmî EI: %' + officialEI.toFixed(2) + ' | Kapatılması beklenen bulgu: ' + expectedClosureTotal + ' | Beklenen EI: %' + expectedEI.toFixed(2) + ' | Tüm CAP potansiyeli: %' + projectedEI.toFixed(2), style:'subheader'},
                    {table:{widths:['*','*','*'], body:kpiBody}, layout:'noBorders', margin:[0,0,0,12]}
                ];
                if (note.trim()) content.push({text:'Yönetici Notu', style:'sectionHeader'}, {text:fullTextForPdf(note.trim()), style:'noteBox'});
                const expectedTable = buildManagerExpectedClosurePdfTable(bundle);
                if (expectedTable) content.push({text:'Kapatılması Beklenen Bulgu - Alan Kırılımı', style:'sectionHeader'}, expectedTable);
                content.push({text:'Kritik Yol İlk 8', style:'sectionHeader'}, {ul:((support.criticalPath || []).length ? support.criticalPath.slice(0,8).map(i => `PQ ${i.pq} - ${i.area} - ${formatTrendDate(i.latestDate)} - kalan ${i.remainingSteps} adım`) : ['Kritik yol adayı bulunamadı.'])});
                content.push({text:'Hızlı EI Kazanımı İlk 8', style:'sectionHeader'}, {ul:((support.topImpact || []).length ? support.topImpact.slice(0,8).map(i => `PQ ${i.pq} - ${i.area} - Alan EI katkısı %${trendSafePct(i.areaContributionPct)} - kalan ${i.remainingSteps} adım`) : ['Hızlı kazanım adayı bulunamadı.'])});
                content.push({text:'Sorumlu Birim Darboğazları', style:'sectionHeader'}, {ul:((support.officeRows || []).length ? support.officeRows.slice(0,8).map(o => `${o.office}: ${o.lateActions} gecikmiş / ${o.totalActions} toplam eylem / tamamlanma %${trendSafePct(o.completionRate)}`) : ['Sorumlu ofis verisi bulunamadı.'])});
                if (bundle.selectedPQs && bundle.selectedPQs.length) {
                    content.push({text:'Seçili PQ Detayları', style:'sectionHeader'});
                    bundle.selectedPQs.forEach(pq => {
                        const m = pqMasterData[pq] || {};
                        const items = (bundle.selectedGroups[pq] || []).filter(isUsableCapStep);
                        content.push({text:`PQ ${pq} - ${(m.alan || 'DİĞER')} - ${(m.ce || '-')}`, bold:true, fontSize:10, margin:[0,6,0,2]});
                        content.push({text:'Bulgu: ' + fullTextForPdf(m.bulgu || '-'), fontSize:8, margin:[0,0,0,4]});
                        if (!items.length) content.push({text:'CAP adımı bulunamadı veya ICAO validasyonu ile kapatıldı.', italics:true, fontSize:8, margin:[0,0,0,4]});
                        items.forEach(item => {
                            const st = getStatus(item);
                            content.push({text:`Adım ${item.step} | Hedef: ${item.estDate || '-'} | Sorumlu: ${item.office || '-'} | Durum: ${st.label}`, bold:true, fontSize:8, margin:[8,2,0,1]});
                            content.push({text:fullTextForPdf(item.action || '-'), fontSize:8, margin:[8,0,0,3]});
                            if (item.note) content.push({text:'Not: ' + fullTextForPdf(item.note), fontSize:8, margin:[8,0,0,3]});
                        });
                    });
                }
                let docDef = { pageOrientation:'landscape', pageSize:'A4', content, footer:(currentPage,pageCount)=>({text:currentPage+' / '+pageCount, alignment:'right', margin:[0,0,25,0], fontSize:8, color:'#64748b'}), styles:{header:{fontSize:17,bold:true,color:'#2563eb',margin:[0,0,0,4]}, subheader:{fontSize:9,color:'#64748b',margin:[0,0,0,12]}, sectionHeader:{fontSize:12,bold:true,color:'#0f172a',margin:[0,8,0,6]}, noteBox:{fontSize:10,color:'#0f172a',fillColor:'#f8fafc',margin:[0,0,0,10]}, th:{bold:true,fontSize:9,fillColor:'#f1f5f9',margin:[0,4,0,4]}}, defaultStyle:{font:'Roboto',fontSize:9} };
                safeDownloadPdf(docDef, 'Yonetici_Brifing_Raporu.pdf');
            } catch(e) { console.error(e); alert('PDF oluşturulurken hata oluştu: ' + (e && e.message ? e.message : e)); }
            finally { hideLoading(); }
        }, 100);
    }

    function exportKanbanPDF() {
        showLoading();
        setTimeout(() => {
            try {
                const rows = getFilteredData();
                if (!rows.length) { hideLoading(); alert('Dışa aktarılacak veri bulunamadı.'); return; }
                const mode = (document.getElementById('kanbanViewMode') || {}).value || 'step';
                const exportRows = buildKanbanExportRows(rows, mode);
                const body = [[{text:'PQ', style:'th'}, {text:'Kolon', style:'th'}, {text:'Alan', style:'th'}, {text:'CE', style:'th'}, {text: mode === 'pq' ? 'Özet' : 'Adım/Eylem', style:'th'}, {text:'Sorumlu', style:'th'}, {text:'Hedef/Risk', style:'th'}]];
                exportRows.forEach(r => body.push([
                    {text:r['PQ'] || '', fontSize:9}, {text:r['Kolon'] || '', fontSize:9}, {text:r['Denetim Alanı'] || '', fontSize:9}, {text:r['CE'] || '', fontSize:9},
                    {text:fullTextForPdf(r['Eylem'] || (`${r['Toplam Adım'] || 0} adım / ${r['Gecikmiş Adım'] || 0} gecikmiş / ${r['Tarih Eksik Adım'] || 0} tarih eksik${r['Bulgu'] ? '\nBulgu: ' + r['Bulgu'] : ''}`)), fontSize:8},
                    {text:r['Eylem Ofisi'] || r['Sorumlu'] || r['PQ Sorumlusu'] || '', fontSize:8}, {text:r['Gün Bilgisi'] || r['İlk Açık / Kilit Tarih'] || '', fontSize:9}
                ]));
                let docDef = { pageOrientation:'landscape', pageSize:'A4', content:[{text:'EI Odaklı Kanban Öncelik Raporu', style:'header'}, {text:'Rapor tarihi: ' + new Date().toLocaleDateString('tr-TR') + ' | Görünüm: ' + (mode === 'pq' ? 'PQ Bazlı' : 'CAP Adımı Bazlı'), style:'subheader'}, {table:{headerRows:1, widths:['auto','auto','auto','auto','*','auto','auto'], body}, layout:'lightHorizontalLines'}], footer:(currentPage,pageCount)=>({text:currentPage+' / '+pageCount, alignment:'right', margin:[0,0,25,0], fontSize:8, color:'#64748b'}), styles:{header:{fontSize:17,bold:true,color:'#2563eb',margin:[0,0,0,4]}, subheader:{fontSize:9,color:'#64748b',margin:[0,0,0,12]}, th:{bold:true,fontSize:9,fillColor:'#f1f5f9',margin:[0,4,0,4]}}, defaultStyle:{font:'Roboto',fontSize:9} };
                safeDownloadPdf(docDef, 'Kanban_Oncelik_Raporu.pdf');
            } catch(e) { console.error(e); alert('PDF oluşturulurken hata oluştu: ' + (e && e.message ? e.message : e)); }
            finally { hideLoading(); }
        }, 100);
    }

    window.exportPDF = function() {
        let ctx;
        try {
            ctx = getActiveExportContext();
            if (ctx.mode === 'trend') { exportTrendPDF(); return; }
            if (ctx.mode === 'strategic') { exportStrategicReportPDF(); return; }
            if (ctx.mode === 'manager') { exportManagerPDF(); return; }
            if (ctx.mode === 'kanban') { exportKanbanPDF(); return; }
            if (ctx.mode === 'quality') { exportDataQualityPDF(ctx); return; }
            if (ctx.mode === 'visits') { exportVisitsPDF(ctx); return; }
            if (ctx.mode === 'icao_official_visit') { exportIcaoOfficialVisitPDF(); return; }
            if (ctx.mode === 'visit_scope') { exportVisitScopePDF(); return; }
            if (ctx.mode === 'visit_workspace') { exportVisitWorkspacePDF(); return; }
            if (ctx.mode === 'visit_followup') { exportVisitFollowUpPDF(); return; }
            if (ctx.mode === 'visit_consultation') { exportVisitConsultationPDF(); return; }
            if (ctx.mode === 'visit_reports') { exportVisitReportsPDF(); return; }
            if (ctx.mode === 'visit_management') { exportVisitManagementPDF(); return; }
            if (ctx.mode === 'visit_analysis') { exportVisitAnalysisPDF(); return; }
            if (ctx.mode === 'visit_audit') { exportVisitAuditPDF(); return; }
            if ((!ctx.rows || ctx.rows.length === 0) && !(ctx.mode === 'milestones' && Object.keys(baseEIData).length > 0)) return alert('Dışa aktarılacak veri bulunamadı.');
        } catch(e) {
            console.error(e);
            alert('PDF hazırlığı sırasında hata oluştu: ' + (e && e.message ? e.message : e));
            return;
        }

        showLoading();
        setTimeout(() => {
            try {
                const { widths, bodyData } = buildPdfTableRowsForContext(ctx);
                let rowsForSummary = (ctx.mode === 'icao' || ctx.mode === 'empty' || ctx.mode === 'milestones') ? getFilteredData() : ctx.rows;
                let summaryRows = (ctx.mode === 'dashboard') ? buildDashboardKpiRows(ctx.rows) : buildExecutiveSummaryRows(rowsForSummary);
                const kpiBody = buildPdfKpiGrid(summaryRows, 4);
                let areaSummary = buildPdfAreaSummaryTable(rowsForSummary);
                let managementNote = (document.getElementById('managementNotes') && document.getElementById('managementNotes').value.trim()) ? document.getElementById('managementNotes').value.trim() : '';
                let content = [
                    {text: ctx.title, style: 'header'},
                    {text: 'Rapor tarihi: ' + formatLongTurkishDate(new Date()) + ' | Veri tarihi: ' + getReportDateText() + ' | Kayıt sayısı: ' + ((ctx.rows || []).length) + ((ctx.mode === 'past' || ctx.mode === 'upcoming') ? (' | Görünüm: ' + (ctx.viewLabel || '-') + (ctx.rangeLabel ? ' | Kapsam: ' + ctx.rangeLabel : '')) : ''), style: 'subheader'},
                    {table: {widths: ['*','*','*','*'], body: kpiBody}, layout: 'noBorders', margin:[0,0,0,12]}
                ];
                if (managementNote && ctx.mode !== 'dashboard') content.push({text: 'Yönetici Notu', style:'sectionHeader'}, {text: fullTextForPdf(managementNote), style:'noteBox'});
                if (ctx.mode === 'dashboard') {
                    const officialSections = buildOfficialEiPdfSections();
                    if (officialSections.length) content.push(...officialSections);
                }

                const special = buildSpecialPdfSections(ctx, rowsForSummary);
                if (areaSummary && !['milestones', 'summary'].includes(ctx.mode)) content.push({text: 'Alan Bazlı Özet', style:'sectionHeader'}, areaSummary);
                if (special && special.sections && special.sections.length) content.push(...special.sections);

                if (!(special && special.skipDefaultDetail)) {
                    if ((ctx.mode === 'past' || ctx.mode === 'upcoming') && ctx.viewMode === 'group') {
                        content.push({text: 'Detay Liste - Alana Göre Gruplu', style:'sectionHeader'});
                        content.push(...buildPdfGroupedTaskContent(ctx));
                    } else {
                        content.push({text: 'Detay Liste', style:'sectionHeader'}, {table: {headerRows: 1, widths: widths, body: bodyData}, layout: 'lightHorizontalLines'});
                    }
                }
                const docDef = createStandardPdfDefinition(content, {
                    pageOrientation:'landscape',
                    pageSize:'A4',
                    styles:{th:{bold:true,fontSize:9,fillColor:'#f1f5f9',margin:[0,4,0,4]}},
                    defaultStyle:{font:'Roboto',fontSize:9}
                });
                safeDownloadPdf(docDef, ctx.title.replace(/\s+/g, '_') + '.pdf');
            } catch(e) { console.error(e); alert('PDF oluşturulurken hata oluştu: ' + (e && e.message ? e.message : e)); }
            finally { hideLoading(); }
        }, 100);
    };


    window.exportDataQualityPDF = exportDataQualityPDF;
    window.exportStrategicReportPDF = exportStrategicReportPDF;
    window.exportManagerPDF = exportManagerPDF;
    window.exportKanbanPDF = exportKanbanPDF;
    window.safeDownloadPdf = safeDownloadPdf;
    window.runPdfExportAudit = function() {
        const checks = {
            pdfMakeLoaded: typeof pdfMake !== 'undefined' && !!pdfMake && typeof pdfMake.createPdf === 'function',
            dispatcher: typeof window.exportPDF === 'function',
            dataQuality: typeof exportDataQualityPDF === 'function',
            visits: typeof exportVisitsPDF === 'function',
            visitReports: typeof exportVisitReportsPDF === 'function',
            strategic: typeof exportStrategicReportPDF === 'function',
            manager: typeof exportManagerPDF === 'function',
            kanban: typeof exportKanbanPDF === 'function',
            trend: typeof window.exportTrendPDF === 'function',
            robustDownloader: typeof safeDownloadPdf === 'function',
            pdfButtons: document.querySelectorAll('button[onclick*="PDF"],button[onclick*="Pdf"],button[onclick*="pdf"]').length
        };
        checks.passed = checks.dispatcher && checks.dataQuality && checks.visits && checks.visitReports && checks.strategic && checks.manager && checks.kanban && checks.robustDownloader;
        console.table(checks);
        return checks;
    };


    // ARŞİVLEME VE TREND
    window.archiveCurrentState = function() {
        if(rawData.length === 0) return alert("Arşivlenecek veri yok."); let note = prompt("Bu arşiv için kısa bir başlık girin (Örn: Q1 Denetim Öncesi, Off-Site Sonrası vs.):", "Güncel Durum"); if(note === null) return;
        showLoading(); let dateKey = new Date().toISOString().replace(/[:.]/g, '-'); let repDateObj = window_loadedReportDate || new Date(); let yyyy = repDateObj.getFullYear(); let mm = String(repDateObj.getMonth() + 1).padStart(2, '0'); let dd = String(repDateObj.getDate()).padStart(2, '0'); let reportDateStr = `${yyyy}-${mm}-${dd}`;
        let safePqMasterData = []; Object.keys(pqMasterData).forEach(k => safePqMasterData.push({ key: k, data: pqMasterData[k] }));
        let safeKanbanWorkflowStages = []; Object.keys(kanbanWorkflowStages).forEach(k => safeKanbanWorkflowStages.push({ key: k, value: kanbanWorkflowStages[k] }));
        let dataToSave = { reportDateStr: reportDateStr, reportTimestamp: repDateObj.getTime(), note: note, rawData: rawData, pqMasterData: safePqMasterData, baseEIData: baseEIData, dailyReviewedPQs: Array.from(dailyReviewedPQs), kanbanWorkflowStages: safeKanbanWorkflowStages };
        db.ref('icao_archive/' + dateKey).set(dataToSave).then(() => { hideLoading(); alert("Arşiv kaydedildi!"); }).catch(e => { console.error(e); hideLoading(); });
    };
    window.deleteSelectedArchive = function() { let sel = document.getElementById('trendSelectA').value; if(!sel || sel === 'current') return alert("Geçerli bir arşiv seçilmedi."); if(confirm("Seçili arşivi kalıcı olarak SİLMEK istediğinize emin misiniz?")) { showLoading(); db.ref('icao_archive/' + sel).remove().then(() => { hideLoading(); alert("Arşiv silindi."); document.getElementById('trendResultsArea').style.display = 'none'; }).catch(e => { console.error(e); hideLoading(); }); } };
    window.restoreSelectedArchive = function(selectId = 'trendSelectA') {
        let sel = document.getElementById(selectId).value; if(!sel || sel === 'current') return alert("Geçerli bir arşiv seçin.");
        if(confirm("Mevcut çalışma verileriniz temizlenecek ve arşiv yüklenecektir. Devam edilsin mi?")) {
            showLoading(); let arch = systemArchives[sel]; rawData = arch.rawData || []; baseEIData = arch.baseEIData || {}; pqMasterData = reconstructPqMaster(arch.pqMasterData || {}); dailyReviewedPQs = new Set(arch.dailyReviewedPQs || []); dailyReviewedSet = new Set(); dailyPQNotes = {}; kanbanWorkflowStages = {}; if (Array.isArray(arch.kanbanWorkflowStages)) { arch.kanbanWorkflowStages.forEach(item => { if(item && item.key) kanbanWorkflowStages[item.key] = item.value; }); } else { kanbanWorkflowStages = arch.kanbanWorkflowStages || {}; } window.loadedWordAreas = new Set(); rawData.forEach(d => { let m = pqMasterData[d.pq]; if (m && m.alan) window.loadedWordAreas.add(m.alan.trim().toUpperCase()); });
            loadedFiles = new Set(["[Arşiv] " + (arch.reportDateStr || arch.note)]); loadedExcelFile = "[Arşivden Gelen Master Veri]"; saveToLocalStorage(); hideLoading(); alert("Arşiv başarıyla yüklendi!"); switchTab('dashboard'); updateDynamicSubtitle(); refreshAllFilters(); renderFileList(); render();
        }
    };
    function updateTrendDropdowns() {
        let selA = document.getElementById('trendSelectA'); let selB = document.getElementById('trendSelectB'); let selSide = document.getElementById('sidebarArchiveSelect');
        selA.innerHTML = ""; selB.innerHTML = `<option value="current">🟢 ŞU ANKİ MEVCUT DURUM</option>`; selSide.innerHTML = `<option value="">Arşiv Seçin...</option>`;
        let keys = Object.keys(systemArchives).sort((a,b) => { let tA = systemArchives[a].reportTimestamp || systemArchives[a].timestamp; let tB = systemArchives[b].reportTimestamp || systemArchives[b].timestamp; return tA - tB; });
        if(keys.length === 0) { selA.innerHTML = `<option value="">Henüz arşiv kaydı yok</option>`; selSide.innerHTML = `<option value="">Arşiv Yok</option>`; return; }
        keys.forEach(k => { let arch = systemArchives[k]; let label = `${arch.reportDateStr || arch.dateStr} - ${arch.note}`; selA.innerHTML += `<option value="${k}">${label}</option>`; selB.innerHTML += `<option value="${k}">${label}</option>`; selSide.innerHTML += `<option value="${k}">${label}</option>`; });
    }
    
    function reconstructPqMaster(input) {
        if (!input) return {};
        if (Array.isArray(input)) {
            let obj = {};
            input.forEach(item => { if (item && item.key) obj[item.key] = item.data || {}; });
            return obj;
        }
        if (typeof input === 'object') return input;
        return {};
    }

    function snapshotFromKey(key) {
        if (key === 'current') return { rawData: rawData, baseEIData: baseEIData, dailyReviewedPQs: Array.from(dailyReviewedPQs), pqMasterData: pqMasterData, reportTimestamp: Date.now(), note: 'Güncel Durum', reportDateStr: new Date().toISOString().slice(0,10) };
        return systemArchives[key] || null;
    }

    function trendLabelForKey(key) {
        if (key === 'current') return 'Güncel Durum';
        let arch = systemArchives[key] || {};
        return `${arch.reportDateStr || arch.dateStr || 'Tarihsiz'} - ${arch.note || 'Arşiv'}`;
    }

    function isSnapshotStepDone(row) {
        let p = (row && row.progress ? row.progress : '').toString().toLowerCase();
        return p.includes('completed') || p.includes('tamamlandı') || p.includes('tamamlandi') || p.includes('100');
    }

    function isSnapshotUsableStep(row) {
        if (!row || row.isEmptyCap || row.step === '-') return false;
        let action = (row.action || '').toString().trim();
        return !!action && !action.includes('OLF üzerinde CAP');
    }

    function snapshotStatusType(row, asOfDate) {
        if (isSnapshotStepDone(row)) return 'done';
        let dt = parseDateObj(row.estDate);
        if (dt && asOfDate && dt < asOfDate) return 'late';
        return 'pending';
    }

    function emptyTrendMetric() { return { total:0, on:0, off:0 }; }
    function addTypeMetric(metric, master) {
        metric.total++;
        let tur = ((master || {}).tur || '').toString().toUpperCase();
        if (tur.includes('ON-SITE')) metric.on++; else if (tur.includes('OFF-SITE')) metric.off++;
    }


    function dateDiffDays(later, earlier) {
        if (!later || !earlier) return 0;
        let a = new Date(later); let b = new Date(earlier);
        a.setHours(0,0,0,0); b.setHours(0,0,0,0);
        return Math.round((a - b) / 86400000);
    }

    function normalizeTrendOwner(value, fallback = 'Belirtilmedi') {
        let v = (value === undefined || value === null ? '' : value.toString()).replace(/\s+/g, ' ').trim();
        return v || fallback;
    }

    function formatTrendDate(dt) {
        if (!dt) return 'Tarih yok';
        try { return formatExactDate(dt); } catch(e) { return dt.toLocaleDateString('tr-TR'); }
    }

    function trendPqClickAttr(pq) {
        return `onclick="switchTab('list'); window.togglePQ('${String(pq || '').replace(/\./g, '-')}');"`;
    }

    function trendSafePct(v) { return isFinite(v) ? Number(v).toFixed(2) : '0.00'; }

    function buildTrendDecisionSupport(td) {
        let a = td && td.analysisB ? td.analysisB : null;
        if (!a) return { criticalPath: [], topImpact: [], riskImpact: [], officeRows: [], briefing: {} };
        let open = (a.stats.openPqItems || []).slice();
        let officeRows = (a.stats.officeRows || []).slice();

        let criticalPath = open.slice().sort((x,y) => {
            let xMissing = x.missingDates > 0 ? 1 : 0;
            let yMissing = y.missingDates > 0 ? 1 : 0;
            if (yMissing !== xMissing) return yMissing - xMissing;
            let xTime = x.latestDate ? x.latestDate.getTime() : -1;
            let yTime = y.latestDate ? y.latestDate.getTime() : -1;
            if (yTime !== xTime) return yTime - xTime;
            if (y.lateSteps !== x.lateSteps) return y.lateSteps - x.lateSteps;
            return y.areaContributionPct - x.areaContributionPct;
        }).slice(0, 10);

        let topImpact = open.slice().sort((x,y) => {
            if (y.areaContributionPct !== x.areaContributionPct) return y.areaContributionPct - x.areaContributionPct;
            if (x.remainingSteps !== y.remainingSteps) return x.remainingSteps - y.remainingSteps;
            if (y.progressPct !== x.progressPct) return y.progressPct - x.progressPct;
            return sortPQs(x.pq, y.pq);
        }).slice(0, 10);

        let riskImpact = open.filter(x => x.lateSteps > 0 || x.missingDates > 0 || x.progressPct < 35).map(x => {
            let riskScore = (x.lateSteps * 35) + (x.missingDates * 25) + ((100 - x.progressPct) * 0.35) + (x.areaContributionPct * 8) + Math.min(x.maxDelayDays, 365) * 0.08;
            return Object.assign({}, x, { riskScore });
        }).sort((x,y) => y.riskScore - x.riskScore).slice(0, 10);

        let bottleneck = officeRows.slice().sort((x,y) => {
            if (y.lateActions !== x.lateActions) return y.lateActions - x.lateActions;
            if (y.delayRate !== x.delayRate) return y.delayRate - x.delayRate;
            return y.totalActions - x.totalActions;
        })[0] || null;
        let quickWins = topImpact.filter(x => x.remainingSteps <= 2 || x.progressPct >= 70).slice(0, 3);
        let latestCritical = criticalPath[0] || null;
        let highRiskCount = riskImpact.length;
        return { criticalPath, topImpact, riskImpact, officeRows, briefing: { bottleneck, quickWins, latestCritical, highRiskCount } };
    }

    function trendPriorityItemHtml(item, mode) {
        if (!item) return '';
        let cls = mode === 'risk' ? 'danger' : (mode === 'impact' ? 'ok' : 'warn');
        let chip = mode === 'risk' ? `Risk ${Math.round(item.riskScore || 0)}` : `%${trendSafePct(item.areaContributionPct)} Alan EI`;
        let dateText = item.latestDate ? formatTrendDate(item.latestDate) : 'Tarih eksik';
        let meta = `Alan: ${escapeHtml(item.area || '-')} | Kalan: ${item.remainingSteps}/${item.totalSteps} adım | İlerleme: %${trendSafePct(item.progressPct)} | Gecikmiş: ${item.lateSteps}`;
        if (item.missingDates > 0) meta += ` | Tarihi eksik adım: ${item.missingDates}`;
        return `<div class="priority-item ${cls}" ${trendPqClickAttr(item.pq)}><div class="priority-title"><span>PQ ${escapeHtml(item.pq)}</span><span class="priority-chip">${chip}</span></div><div class="priority-meta"><b>Kilit tarih:</b> ${escapeHtml(dateText)}<br>${meta}<br><b>Sorumlu:</b> ${escapeHtml(item.owner || '-')}</div></div>`;
    }

    function renderTrendDecisionSupport(td) {
        let support = buildTrendDecisionSupport(td);
        td.decisionSupport = support;
        let briefingEl = document.getElementById('trendExecutiveBriefing');
        let criticalEl = document.getElementById('trendCriticalPathList');
        let officeEl = document.getElementById('trendOfficeScorecard');
        let impactEl = document.getElementById('trendTopEIPQList');
        let riskEl = document.getElementById('trendRiskImpactList');
        if (!briefingEl || !criticalEl || !officeEl || !impactEl || !riskEl) return;

        let b = support.briefing || {};
        let quickWinText = (b.quickWins && b.quickWins.length) ? b.quickWins.map(x => `PQ ${x.pq}`).join(', ') : 'Hızlı kazanım adayı yok';
        let bottleneckText = b.bottleneck ? `${b.bottleneck.office} (${b.bottleneck.lateActions} gecikmiş / ${b.bottleneck.totalActions} eylem)` : 'Darboğaz verisi yok';
        let criticalText = b.latestCritical ? `PQ ${b.latestCritical.pq} - ${formatTrendDate(b.latestCritical.latestDate)}` : 'Kritik yol verisi yok';
        briefingEl.innerHTML = `<h4>📌 Tek Sayfalık Yönetici Brifingi</h4><p>Seçilen güncel durum itibarıyla Overall EI <b>%${td.analysisB.ei.overall.toFixed(2)}</b>, tüm açık CAP havuzunun olumlu kapanması halinde projeksiyon <b>%${td.analysisB.ei.projectedOverall.toFixed(2)}</b>. Yeni kapanan PQ sayısı <b>${td.newClosed.length}</b>, gecikmiş eylem sayısı <b>${td.analysisB.stats.lateActions.total}</b>.</p><div class="briefing-actions"><div class="briefing-action"><b>Öncelikli takip</b>${escapeHtml(criticalText)}</div><div class="briefing-action"><b>Darboğaz</b>${escapeHtml(bottleneckText)}</div><div class="briefing-action"><b>Hızlı kazanım</b>${escapeHtml(quickWinText)}</div><div class="briefing-action"><b>Riskli yüksek etki</b>${support.riskImpact.length} PQ izlenmeli</div></div>`;

        criticalEl.innerHTML = support.criticalPath.length ? support.criticalPath.map(x => trendPriorityItemHtml(x, 'critical')).join('') : '<div style="color:var(--muted); font-size:12px; padding:10px;">Açık ve tarihli kritik yol PQ verisi bulunamadı.</div>';
        impactEl.innerHTML = support.topImpact.length ? support.topImpact.map(x => trendPriorityItemHtml(x, 'impact')).join('') : '<div style="color:var(--muted); font-size:12px; padding:10px;">EI katkısı hesaplanabilecek açık PQ bulunamadı.</div>';
        riskEl.innerHTML = support.riskImpact.length ? support.riskImpact.map(x => trendPriorityItemHtml(x, 'risk')).join('') : '<div style="color:var(--ok); font-size:12px; padding:10px;">Yüksek risk / yüksek etki kriterlerini karşılayan açık PQ bulunmadı.</div>';

        let officeRows = support.officeRows.slice().sort((a,b) => b.lateActions - a.lateActions || b.totalActions - a.totalActions).slice(0, 10);
        if (!officeRows.length) { officeEl.innerHTML = '<div style="color:var(--muted); font-size:12px; padding:10px;">Sorumlu ofis verisi bulunamadı.</div>'; return; }
        let html = '<div class="office-score-row header"><div>Ofis</div><div>İlerleme</div><div>Gecikmiş</div><div>PQ</div></div>';
        officeRows.forEach(o => {
            html += `<div class="office-score-row"><div><b>${escapeHtml(o.office)}</b><div class="score-bar"><span style="width:${Math.min(100, o.completionRate).toFixed(0)}%"></span></div></div><div>%${trendSafePct(o.completionRate)}</div><div style="color:${o.lateActions > 0 ? 'var(--danger)' : 'var(--ok)'}; font-weight:bold;">${o.lateActions}</div><div>${o.pqCount}</div></div>`;
        });
        officeEl.innerHTML = html;
    }

    function getAnalysisAreaAfterValidationSat(row) {
        if (!row) return 0;
        let explicit = getExplicitAfterValidationSatValue(row.afterValidationSat);
        let base = row.baseSat || 0;
        let sat = explicit !== null && explicit >= base ? explicit : base + (row.icaoClosed || 0);
        return Math.max(0, Math.min(row.total || sat, sat));
    }
    function getAnalysisAfterValidationSat(analysis) {
        if (!analysis || !analysis.areaRows) return (analysis ? (analysis.baseSat || 0) + (analysis.icaoClosed || 0) : 0);
        return Object.values(analysis.areaRows).reduce((sum, row) => sum + getAnalysisAreaAfterValidationSat(row), 0);
    }

    function getSnapshotAnalysis(dataObj) {
        dataObj = dataObj || {};
        let bEI = dataObj.baseEIData || {};
        let pMaster = reconstructPqMaster(dataObj.pqMasterData || {});
        let rData = dataObj.rawData || [];
        let dailySet = new Set(dataObj.dailyReviewedPQs || []);
        let asOf = new Date(dataObj.reportTimestamp || dataObj.timestamp || Date.now());
        asOf.setHours(0,0,0,0);

        let analysis = {
            label: dataObj.note || dataObj.reportDateStr || '',
            asOf,
            totalEI: 0,
            baseSat: 0,
            afterValidationSat: 0,
            validationDelta: 0,
            icaoClosed: 0,
            localCompleted: 0,
            projected: 0,
            ei: { overall: 0, projectedOverall: 0, areas: {}, projectedAreas: {} },
            areaRows: {},
            stats: {
                closedPQs: emptyTrendMetric(),
                doneActions: emptyTrendMetric(),
                ongoingActions: emptyTrendMetric(),
                lateActions: emptyTrendMetric(),
                closedPqSet: new Set(),
                closedPqItems: [],
                openPqItems: [],
                pqProgressItems: [],
                officeStats: {},
                officeRows: [],
                areaStats: {}
            }
        };

        Object.keys(bEI).forEach(areaRaw => {
            let area = normalizeAreaKey(areaRaw);
            let b = bEI[areaRaw] || {};
            analysis.totalEI += b.total || 0;
            analysis.baseSat += b.sat || 0;
            analysis.areaRows[area] = {
                area,
                total: b.total || 0,
                baseSat: b.sat || 0,
                afterValidationSat: getBaseAfterValidationSat(b),
                icaoClosed: 0,
                localCompleted: 0,
                projected: 0,
                activePQs: new Set(),
                closedPQs: 0,
                doneActions: 0,
                ongoingActions: 0,
                lateActions: 0,
                currentEI: 0,
                projectedEI: 0
            };
            analysis.stats.areaStats[area] = { closedPQs:0, doneActions:0, ongoingActions:0, lateActions:0 };
        });

        function addClosedPQ(pq, master, source) {
            if (analysis.stats.closedPqSet.has(pq)) return;
            analysis.stats.closedPqSet.add(pq);
            addTypeMetric(analysis.stats.closedPQs, master);
            let area = normalizeAreaKey((master || {}).alan) || 'DİĞER';
            if (analysis.stats.areaStats[area]) analysis.stats.areaStats[area].closedPQs++;
            if (analysis.areaRows[area]) analysis.areaRows[area].closedPQs++;
            analysis.stats.closedPqItems.push({
                pq,
                area,
                ce: (master || {}).ce || '',
                tur: (master || {}).tur || '',
                source,
                validationTask: (master || {}).validasyonGorevi || '',
                bulgu: (master || {}).bulgu || ''
            });
        }

        Object.keys(pMaster).forEach(pq => {
            let m = pMaster[pq] || {};
            let area = normalizeAreaKey(m.alan);
            if (!area || !analysis.areaRows[area]) return;
            if (m.isIcaoClosed) {
                analysis.icaoClosed++;
                analysis.areaRows[area].icaoClosed++;
                addClosedPQ(pq, m, 'ICAO Validasyonu');
            }
        });

        let groups = {};
        rData.forEach(d => { if (!groups[d.pq]) groups[d.pq] = []; groups[d.pq].push(d); });

        function addOfficeTrendStep(officeName, statusType, pq, master, delayDays) {
            let office = normalizeTrendOwner(officeName || (master || {}).sorumlu || 'Belirtilmedi');
            if (!analysis.stats.officeStats[office]) analysis.stats.officeStats[office] = { office, totalActions:0, doneActions:0, ongoingActions:0, lateActions:0, pqSet:new Set(), areaSet:new Set(), maxDelayDays:0, impactOverall:0 };
            let o = analysis.stats.officeStats[office];
            o.totalActions++;
            o.pqSet.add(pq);
            if ((master || {}).alan) o.areaSet.add(normalizeAreaKey(master.alan));
            if (statusType === 'done') o.doneActions++; else o.ongoingActions++;
            if (statusType === 'late') { o.lateActions++; o.maxDelayDays = Math.max(o.maxDelayDays, delayDays || 0); }
        }

        Object.keys(groups).forEach(pq => {
            let m = pMaster[pq] || {};
            if (m.isIcaoClosed) return;
            let area = normalizeAreaKey(m.alan);
            if (!area || !analysis.areaRows[area]) return;
            analysis.areaRows[area].activePQs.add(pq);
            let usable = groups[pq].filter(isSnapshotUsableStep);
            let allDone = usable.length > 0 && usable.every(isSnapshotStepDone);
            let isLocallyClosed = allDone || dailySet.has(pq);

            let latestDate = null;
            let earliestDate = null;
            let missingDates = 0;
            let doneSteps = 0;
            let lateSteps = 0;
            let pendingSteps = 0;
            let maxDelayDays = 0;
            let owners = new Set();

            usable.forEach(step => {
                let type = snapshotStatusType(step, asOf);
                let dt = parseDateObj(step.estDate);
                if (!dt) missingDates++;
                else {
                    if (!latestDate || dt > latestDate) latestDate = dt;
                    if (!earliestDate || dt < earliestDate) earliestDate = dt;
                    if (type === 'late') maxDelayDays = Math.max(maxDelayDays, Math.max(0, dateDiffDays(asOf, dt)));
                }
                if (type === 'done') doneSteps++;
                else if (type === 'late') lateSteps++;
                else pendingSteps++;
                owners.add(normalizeTrendOwner(step.office || m.sorumlu || 'Belirtilmedi'));
                addOfficeTrendStep(step.office || m.sorumlu, type, pq, m, type === 'late' && dt ? dateDiffDays(asOf, dt) : 0);
            });

            if (isLocallyClosed) {
                analysis.localCompleted++;
                analysis.areaRows[area].localCompleted++;
                addClosedPQ(pq, m, dailySet.has(pq) && !allDone ? 'Günlük işaretleme' : 'CAP Tamamlandı');
            } else if (usable.length > 0) {
                analysis.projected++;
                analysis.areaRows[area].projected++;
            }

            let areaTotal = analysis.areaRows[area].total || 0;
            let pqProgressItem = {
                pq,
                area,
                ce: m.ce || '',
                tur: m.tur || '',
                owner: Array.from(owners).slice(0, 3).join(' / ') || normalizeTrendOwner(m.sorumlu || 'Belirtilmedi'),
                bulgu: m.bulgu || '',
                totalSteps: usable.length,
                doneSteps,
                remainingSteps: Math.max(0, usable.length - doneSteps),
                pendingSteps,
                lateSteps,
                missingDates,
                latestDate,
                earliestDate,
                maxDelayDays,
                progressPct: usable.length > 0 ? ratioPct(doneSteps, usable.length) : 0,
                isClosed: isLocallyClosed,
                overallContributionPct: analysis.totalEI > 0 ? 100 / analysis.totalEI : 0,
                areaContributionPct: areaTotal > 0 ? 100 / areaTotal : 0
            };
            analysis.stats.pqProgressItems.push(pqProgressItem);
            if (!isLocallyClosed && usable.length > 0) analysis.stats.openPqItems.push(pqProgressItem);

            groups[pq].forEach(d => {
                let type = snapshotStatusType(d, asOf);
                if (type === 'done') { addTypeMetric(analysis.stats.doneActions, m); analysis.areaRows[area].doneActions++; analysis.stats.areaStats[area].doneActions++; }
                else {
                    addTypeMetric(analysis.stats.ongoingActions, m); analysis.areaRows[area].ongoingActions++; analysis.stats.areaStats[area].ongoingActions++;
                    if (type === 'late') { addTypeMetric(analysis.stats.lateActions, m); analysis.areaRows[area].lateActions++; analysis.stats.areaStats[area].lateActions++; }
                }
            });
        });

        analysis.stats.officeRows = Object.values(analysis.stats.officeStats).map(o => ({
            office: o.office,
            totalActions: o.totalActions,
            doneActions: o.doneActions,
            ongoingActions: o.ongoingActions,
            lateActions: o.lateActions,
            pqCount: o.pqSet.size,
            areaCount: o.areaSet.size,
            maxDelayDays: o.maxDelayDays,
            completionRate: ratioPct(o.doneActions, o.totalActions),
            delayRate: ratioPct(o.lateActions, o.totalActions),
            impactOverall: o.impactOverall || 0
        })).sort((a,b) => b.lateActions - a.lateActions || b.totalActions - a.totalActions || a.office.localeCompare(b.office));

        analysis.afterValidationSat = getAnalysisAfterValidationSat(analysis);
        analysis.validationDelta = Math.max(0, analysis.afterValidationSat - analysis.baseSat);
        let currentSat = analysis.afterValidationSat + analysis.localCompleted;
        let projectedSat = currentSat + analysis.projected;
        analysis.ei.baseOverall = ratioPct(analysis.baseSat, analysis.totalEI);
        analysis.ei.officialOverall = ratioPct(analysis.afterValidationSat, analysis.totalEI);
        analysis.ei.overall = ratioPct(currentSat, analysis.totalEI);
        analysis.ei.localOverall = analysis.ei.overall;
        analysis.ei.projectedOverall = ratioPct(projectedSat, analysis.totalEI);
        Object.keys(analysis.areaRows).forEach(area => {
            let r = analysis.areaRows[area];
            let officialSat = getAnalysisAreaAfterValidationSat(r);
            let cur = officialSat + r.localCompleted;
            let proj = cur + r.projected;
            r.afterValidationSatEffective = officialSat;
            r.validationDelta = Math.max(0, officialSat - r.baseSat);
            r.baseEI = ratioPct(r.baseSat, r.total);
            r.officialEI = ratioPct(officialSat, r.total);
            r.currentEI = ratioPct(cur, r.total);
            r.projectedEI = ratioPct(proj, r.total);
            r.activePQCount = r.activePQs.size;
            delete r.activePQs;
            analysis.ei.areas[area] = r.currentEI;
            analysis.ei.projectedAreas[area] = r.projectedEI;
        });
        analysis.stats.closedPqItems.sort((a,b) => sortAreas(a.area,b.area) || sortPQs(a.pq,b.pq));
        return analysis;
    }


    window.runCommonCalculationSelfCheck = function(rows) {
        const source = Array.isArray(rows) ? rows : getFilteredData();
        const model = buildCommonCalculationModel(source);
        const direct = {
            pq: new Set(source.map(d => d.pq).filter(Boolean)).size,
            actions: source.length,
            done: source.filter(d => getLegacyActionStatusCore(d).type === 'done').length,
            pending: source.filter(d => getLegacyActionStatusCore(d).type === 'pending').length,
            late: source.filter(d => getLegacyActionStatusCore(d).type === 'late').length
        };
        const engine = {
            pq: model.pq.total,
            actions: model.actions.total,
            done: model.status.done.total,
            pending: model.status.pending.total,
            late: model.status.late.total
        };
        const passed = Object.keys(direct).every(key => direct[key] === engine[key]);
        return { passed, direct, engine };
    };


    window.COMMON_ENGINE_VERSION = '2.4-cleanup';
    window.runCommonEngineMigrationAudit = function(rows) {
        const source = Array.isArray(rows) ? rows : getFilteredData();
        const model = buildCommonCalculationModel(source, { upcomingDays: 30 });
        const legacy = window.runCommonCalculationSelfCheck(source);
        const pqStatusTotal = Object.values(model.standardized.pq)
            .filter(value => value && typeof value === 'object' && typeof value.count === 'number')
            .reduce((sum, value) => sum + value.count, 0);
        const actionStatusTotal = ['completed', 'late', 'upcoming', 'pending', 'dateRisk']
            .reduce((sum, key) => sum + model.standardized.actions[key].count, 0);
        const checks = {
            legacyCountsMatch: legacy.passed,
            pqStatusesCoverAllPqs: pqStatusTotal === model.pq.total,
            actionStatusesCoverAllActions: actionStatusTotal === model.actions.total,
            delayCountMatchesLate: model.delay.count === model.status.late.total,
            chartOfficeTotalsMatch: (model.officeRows || []).reduce((sum, row) => sum + row.actions, 0) === model.actions.total
        };
        return {
            passed: Object.values(checks).every(Boolean),
            version: window.COMMON_ENGINE_VERSION,
            checks,
            totals: { pq: model.pq.total, actions: model.actions.total, late: model.status.late.total, dateRisk: model.dateRiskRows.length }
        };
    };


    window.runCommonProjectionSelfCheck = function(rows, projectionDate) {
        const source = Array.isArray(rows) ? rows : getFilteredData();
        const date = normalizeCommonDate(projectionDate) || getStrategicTargetDate();
        const model = buildCommonCalculationModel(source, {
            normalizeAreas: true,
            useUsableStepsForPqCompletion: true,
            projectionDate: date
        });
        const pqCounts = model.standardized.pq;
        const actionCounts = model.standardized.actions;
        const pqTotal = pqCounts.officialClosed.count + pqCounts.capCompleted.count + pqCounts.projectedClosable.count + pqCounts.open.count + pqCounts.openDateRisk.count + pqCounts.noCap.count;
        const actionTotal = actionCounts.completed.count + actionCounts.late.count + actionCounts.upcoming.count + actionCounts.pending.count + actionCounts.dateRisk.count;
        return {
            passed: pqTotal === model.pq.total && actionTotal === model.actions.total,
            projectionDate: date,
            pqTotal,
            expectedPqTotal: model.pq.total,
            actionTotal,
            expectedActionTotal: model.actions.total,
            pq: pqCounts,
            actions: actionCounts
        };
    };

    function setDeltaCard(valueId, descId, delta, suffix, desc, invertGood = false) {
        let el = document.getElementById(valueId);
        let good = invertGood ? delta < 0 : delta > 0;
        let bad = invertGood ? delta > 0 : delta < 0;
        el.innerText = (delta > 0 ? '+' : '') + delta.toFixed(typeof delta === 'number' && Math.abs(delta) < 10 && suffix.includes('%') ? 2 : 0) + suffix;
        el.className = 'delta-val ' + (good ? 'delta-pos' : (bad ? 'delta-neg' : 'delta-neu'));
        document.getElementById(descId).innerText = desc;
    }

    function renderTrendAreaTable(areaRows) {
        let el = document.getElementById('trendAreaComparisonTable');
        if (!el) return;
        if (!areaRows || areaRows.length === 0) { el.innerHTML = '<div style="padding:20px; color:var(--muted);">Alan bazlı kıyaslama verisi bulunamadı.</div>'; return; }
        let html = `<table style="font-size:12px; min-width:900px;"><thead><tr><th>Alan</th><th>Eski EI</th><th>Yeni EI</th><th>Δ EI</th><th>Proj. Yeni EI</th><th>Kapanan PQ Δ</th><th>Tamamlanan Eylem Δ</th><th>Gecikmiş Eylem Δ</th></tr></thead><tbody>`;
        areaRows.forEach(r => {
            let cls = r.deltaEI > 0 ? 'delta-pos' : (r.deltaEI < 0 ? 'delta-neg' : 'delta-neu');
            let lateCls = r.deltaLate < 0 ? 'delta-pos' : (r.deltaLate > 0 ? 'delta-neg' : 'delta-neu');
            html += `<tr><td><b>${r.area}</b></td><td>%${r.oldEI.toFixed(2)}</td><td>%${r.newEI.toFixed(2)}</td><td class="${cls}" style="font-weight:bold;">${r.deltaEI>0?'+':''}${r.deltaEI.toFixed(2)}</td><td>%${r.newProjectedEI.toFixed(2)}</td><td>${r.deltaClosed>0?'+':''}${r.deltaClosed}</td><td>${r.deltaDone>0?'+':''}${r.deltaDone}</td><td class="${lateCls}" style="font-weight:bold;">${r.deltaLate>0?'+':''}${r.deltaLate}</td></tr>`;
        });
        html += '</tbody></table>';
        el.innerHTML = html;
    }

    function renderTrendNewClosedList(items) {
        let el = document.getElementById('trendNewClosedList');
        if (!el) return;
        if (!items || items.length === 0) { el.innerHTML = '<div style="padding:10px; color:var(--muted);">İki tarih arasında yeni kapanan PQ bulunmamaktadır.</div>'; return; }
        let html = '<div class="warning-grid">';
        items.slice(0, 80).forEach(item => {
            let badgeColor = item.source === 'ICAO Validasyonu' ? '#ca8a04' : '#047857';
            html += `<div class="warning-item" onclick="switchTab('list'); window.togglePQ('${item.pq.replace(/\./g, '-')}');" style="border-left-color:${badgeColor};"><div><span class="badge badge-extra" style="margin-bottom:6px;">${item.area || 'N/A'}</span><br><b>PQ ${item.pq}</b> <span style="font-size:10px; color:${badgeColor}; font-weight:bold; margin-left:4px;">${escapeHtml(item.source)}</span><br><span style="font-size:11px; color:var(--muted);">${escapeHtml(item.validationTask || item.ce || '-')}</span></div><div style="font-size:11px; color:var(--muted); text-align:right; max-width:160px;">${escapeHtml(truncateTextForExport(item.bulgu || '', 90))}</div></div>`;
        });
        html += '</div>';
        if (items.length > 80) html += `<div style="font-size:12px; color:var(--muted); margin-top:8px;">İlk 80 kayıt gösterildi. Toplam yeni kapanan PQ: ${items.length}</div>`;
        el.innerHTML = html;
    }

    function renderTrendCharts(trendData) {
        let labels = trendData.areaRows.map(r => r.area);
        const ctx1 = document.getElementById('trendComparisonChartCanvas').getContext('2d');
        if (charts.trendComp) charts.trendComp.destroy();
        charts.trendComp = new Chart(ctx1, {
            type: 'bar',
            data: { labels, datasets: [
                { label: 'Eski EI (%)', data: trendData.areaRows.map(r => r.oldEI), backgroundColor: '#94a3b8' },
                { label: 'Yeni EI (%)', data: trendData.areaRows.map(r => r.newEI), backgroundColor: '#2563eb' },
                { label: 'Yeni Projeksiyon EI (%)', data: trendData.areaRows.map(r => r.newProjectedEI), backgroundColor: '#f59e0b' }
            ] },
            options: { responsive:true, maintainAspectRatio:false, scales:{ y:{ beginAtZero:true, max:100 } }, plugins:{ title:{ display:true, text:'Alan Bazında EI Kıyaslaması' } } }
        });

        const ctx2 = document.getElementById('trendActionChartCanvas').getContext('2d');
        if (charts.trendAction) charts.trendAction.destroy();
        charts.trendAction = new Chart(ctx2, {
            type: 'bar',
            data: { labels: ['Kapanan PQ', 'Tamamlanan Eylem', 'Devam Eden Eylem', 'Gecikmiş Eylem'], datasets: [
                { label: trendData.labelA, data: [trendData.analysisA.stats.closedPQs.total, trendData.analysisA.stats.doneActions.total, trendData.analysisA.stats.ongoingActions.total, trendData.analysisA.stats.lateActions.total], backgroundColor: '#94a3b8' },
                { label: trendData.labelB, data: [trendData.analysisB.stats.closedPQs.total, trendData.analysisB.stats.doneActions.total, trendData.analysisB.stats.ongoingActions.total, trendData.analysisB.stats.lateActions.total], backgroundColor: '#10b981' }
            ] },
            options: { responsive:true, maintainAspectRatio:false, plugins:{ title:{ display:true, text:'Aksiyon Metrikleri Kıyaslaması' } } }
        });
    }

    window.runTrendAnalysis = function() {
        let valA = document.getElementById('trendSelectA').value;
        let valB = document.getElementById('trendSelectB').value;
        if (!valA) return alert('Lütfen karşılaştırma için en az bir geçmiş arşiv seçin.');
        if (valA === valB) return alert('Aynı iki tarihi kıyaslayamazsınız.');
        let dataA = snapshotFromKey(valA);
        let dataB = snapshotFromKey(valB);
        if (!dataA || !dataB) return alert('Seçilen arşiv verisi okunamadı.');

        let analysisA = getSnapshotAnalysis(dataA);
        let analysisB = getSnapshotAnalysis(dataB);
        let labelA = trendLabelForKey(valA);
        let labelB = trendLabelForKey(valB);
        let deltaEI = analysisB.ei.overall - analysisA.ei.overall;
        let deltaPQ = analysisB.stats.closedPQs.total - analysisA.stats.closedPQs.total;
        let deltaDone = analysisB.stats.doneActions.total - analysisA.stats.doneActions.total;
        let deltaOngoing = analysisB.stats.ongoingActions.total - analysisA.stats.ongoingActions.total;
        let deltaLate = analysisB.stats.lateActions.total - analysisA.stats.lateActions.total;

        document.getElementById('trendResultsArea').style.display = 'block';
        setDeltaCard('deltaEI', 'deltaEIDesc', deltaEI, '%', `Eski EI: %${analysisA.ei.overall.toFixed(2)} ➔ Yeni EI: %${analysisB.ei.overall.toFixed(2)}`);
        setDeltaCard('deltaPQ', 'deltaPQDesc', deltaPQ, '', `Eski: ${analysisA.stats.closedPQs.total} ➔ Yeni: ${analysisB.stats.closedPQs.total}`);
        setDeltaCard('deltaDoneAct', 'deltaDoneActDesc', deltaDone, '', `Eski: ${analysisA.stats.doneActions.total} ➔ Yeni: ${analysisB.stats.doneActions.total}`);
        setDeltaCard('deltaOngAct', 'deltaOngActDesc', deltaOngoing, '', `Eski: ${analysisA.stats.ongoingActions.total} ➔ Yeni: ${analysisB.stats.ongoingActions.total}`, true);
        setDeltaCard('deltaLate', 'deltaLateDesc', deltaLate, '', `Eski: ${analysisA.stats.lateActions.total} ➔ Yeni: ${analysisB.stats.lateActions.total}`, true);

        let allAreas = new Set([...Object.keys(analysisA.areaRows), ...Object.keys(analysisB.areaRows)]);
        let areaRows = Array.from(allAreas).sort(sortAreas).map(area => {
            let a = analysisA.areaRows[area] || { currentEI:0, projectedEI:0, closedPQs:0, doneActions:0, lateActions:0 };
            let b = analysisB.areaRows[area] || { currentEI:0, projectedEI:0, closedPQs:0, doneActions:0, lateActions:0 };
            return {
                area,
                oldEI: a.currentEI || 0,
                newEI: b.currentEI || 0,
                newProjectedEI: b.projectedEI || 0,
                deltaEI: (b.currentEI || 0) - (a.currentEI || 0),
                deltaClosed: (b.closedPQs || 0) - (a.closedPQs || 0),
                deltaDone: (b.doneActions || 0) - (a.doneActions || 0),
                deltaLate: (b.lateActions || 0) - (a.lateActions || 0)
            };
        });
        let newClosed = analysisB.stats.closedPqItems.filter(item => !analysisA.stats.closedPqSet.has(item.pq));
        let best = areaRows.slice().sort((x,y) => y.deltaEI - x.deltaEI)[0];
        let worstLate = areaRows.slice().sort((x,y) => y.deltaLate - x.deltaLate)[0];
        let insight = `Kıyaslama kapsamı: <b>${escapeHtml(labelA)}</b> ile <b>${escapeHtml(labelB)}</b>. Overall EI değişimi <b>${deltaEI >= 0 ? '+' : ''}${deltaEI.toFixed(2)} puan</b>. Yeni kapanan PQ sayısı <b>${newClosed.length}</b>.`;
        if (best && Math.abs(best.deltaEI) > 0.001) insight += ` En yüksek EI katkısı <b>${best.area}</b> alanında (${best.deltaEI >= 0 ? '+' : ''}${best.deltaEI.toFixed(2)} puan).`;
        if (worstLate && worstLate.deltaLate > 0) insight += ` Dikkat: gecikmiş eylem artışı en çok <b>${worstLate.area}</b> alanında (+${worstLate.deltaLate}) görünüyor.`;
        document.getElementById('trendInsightBox').innerHTML = `<h4>🧭 Yönetici Yorumu</h4><p>${insight}</p><div class="mini-kpi-row"><div class="mini-kpi"><strong>%${analysisB.ei.projectedOverall.toFixed(2)}</strong><span>Yeni projeksiyon EI</span></div><div class="mini-kpi"><strong>${analysisB.stats.closedPQs.total}</strong><span>Toplam kapanan PQ</span></div><div class="mini-kpi"><strong>${analysisB.stats.lateActions.total}</strong><span>Yeni gecikmiş eylem</span></div><div class="mini-kpi"><strong>${analysisB.projected}</strong><span>Açık CAP havuzu PQ</span></div></div>`;

        window.currentTrendData = { labelA, labelB, analysisA, analysisB, deltaEI, deltaPQ, deltaDone, deltaOngoing, deltaLate, areaRows, newClosed };
        renderTrendCharts(window.currentTrendData);
        renderTrendAreaTable(areaRows);
        renderTrendNewClosedList(newClosed);
        renderTrendDecisionSupport(window.currentTrendData);
    };

    function renderHistoricalTrend() {
        let keys = Object.keys(systemArchives).sort((a,b) => { let tA = systemArchives[a].reportTimestamp || systemArchives[a].timestamp; let tB = systemArchives[b].reportTimestamp || systemArchives[b].timestamp; return tA - tB; });
        if (keys.length === 0 && rawData.length === 0) return;
        let labels = [], baseSeg = [], icaoSeg = [], localSeg = [], potentialSeg = [], target60 = [], target80 = [];
        function pushSnapshot(label, snap) {
            let a = getSnapshotAnalysis(snap);
            labels.push(label);
            baseSeg.push(Number(ratioPct(a.baseSat, a.totalEI).toFixed(2)));
            icaoSeg.push(Number(ratioPct(a.icaoClosed, a.totalEI).toFixed(2)));
            localSeg.push(Number(ratioPct(a.localCompleted, a.totalEI).toFixed(2)));
            potentialSeg.push(Number(ratioPct(a.projected, a.totalEI).toFixed(2)));
            target60.push(60); target80.push(80);
        }
        keys.forEach(k => {
            let arch = systemArchives[k];
            pushSnapshot(arch.reportDateStr || arch.dateStr || 'Tarihsiz', arch);
        });
        if (rawData.length > 0) pushSnapshot('Güncel Durum', snapshotFromKey('current'));
        const ctx = document.getElementById('historicalTrendChartCanvas').getContext('2d');
        if (charts.histTrend) charts.histTrend.destroy();
        charts.histTrend = new Chart(ctx, {
            type: 'bar',
            data: { labels, datasets: [
                { label: 'CMAA Başlangıç EI', data: baseSeg, backgroundColor: '#64748b', stack: 'ei' },
                { label: 'ICAO Validasyon Katkısı', data: icaoSeg, backgroundColor: '#3b82f6', stack: 'ei' },
                { label: 'CAP Tamamlanmış Katkı', data: localSeg, backgroundColor: '#10b981', stack: 'ei' },
                { label: 'Açık CAP Potansiyeli', data: potentialSeg, backgroundColor: '#f59e0b', stack: 'ei' },
                { type:'line', label: '%60 eşik', data: target60, borderColor:'#94a3b8', borderDash:[6,4], pointRadius:0, fill:false, tension:0, yAxisID:'y' },
                { type:'line', label: '%80 hedef', data: target80, borderColor:'#ef4444', borderDash:[6,4], pointRadius:0, fill:false, tension:0, yAxisID:'y' }
            ] },
            options: { responsive: true, maintainAspectRatio: false, plugins:{ tooltip:{ callbacks:{ label:function(ctx){ return `${ctx.dataset.label}: %${Number(ctx.raw || 0).toFixed(2)}`; } } }, title:{ display:true, text:'Overall EI Katmanları ve Potansiyel Tavan' } }, scales: { x:{ stacked:true }, y: { stacked:true, min: 0, max: 100, title:{ display:true, text:'Overall EI (%)' } } } }
        });
    }

    window.exportTrendExcel = function() {
        if (!window.currentTrendData) { runTrendAnalysis(); if (!window.currentTrendData) return; }
        let td = window.currentTrendData;
        const wb = createReportWorkbook({ title:'Trend ve Kıyaslama Raporu', subject:'USOAP CMA CAP Trend' });
        addJsonSheet(wb, 'Trend_Ozet', [
            { 'Metrik': 'Kıyaslama A', 'Değer': td.labelA },
            { 'Metrik': 'Kıyaslama B', 'Değer': td.labelB },
            { 'Metrik': 'Overall EI Değişimi', 'Değer': td.deltaEI.toFixed(2) + ' puan' },
            { 'Metrik': 'Yeni Kapanan PQ', 'Değer': td.newClosed.length },
            { 'Metrik': 'Tamamlanan Eylem Değişimi', 'Değer': td.deltaDone },
            { 'Metrik': 'Gecikmiş Eylem Değişimi', 'Değer': td.deltaLate }
        ]);
        addJsonSheet(wb, 'Alan_Kiyaslama', td.areaRows.map(r => ({
            'Alan': r.area,
            'Eski EI %': r.oldEI.toFixed(2),
            'Yeni EI %': r.newEI.toFixed(2),
            'Delta EI': r.deltaEI.toFixed(2),
            'Yeni Projeksiyon EI %': r.newProjectedEI.toFixed(2),
            'Kapanan PQ Delta': r.deltaClosed,
            'Tamamlanan Eylem Delta': r.deltaDone,
            'Gecikmiş Eylem Delta': r.deltaLate
        })));
        addJsonSheet(wb, 'Yeni_Kapanan_PQ', td.newClosed.map(i => ({ 'PQ': i.pq, 'Alan': i.area, 'CE': i.ce, 'Kaynak': i.source, 'Validasyon Görevi': i.validationTask, 'Bulgu': truncateTextForExport(i.bulgu, 1000) })));
        addJsonSheet(wb, 'Metrikler', [
            { 'Metrik': 'Kapanan PQ', [td.labelA]: td.analysisA.stats.closedPQs.total, [td.labelB]: td.analysisB.stats.closedPQs.total, 'Delta': td.deltaPQ },
            { 'Metrik': 'Tamamlanan Eylem', [td.labelA]: td.analysisA.stats.doneActions.total, [td.labelB]: td.analysisB.stats.doneActions.total, 'Delta': td.deltaDone },
            { 'Metrik': 'Devam Eden Eylem', [td.labelA]: td.analysisA.stats.ongoingActions.total, [td.labelB]: td.analysisB.stats.ongoingActions.total, 'Delta': td.deltaOngoing },
            { 'Metrik': 'Gecikmiş Eylem', [td.labelA]: td.analysisA.stats.lateActions.total, [td.labelB]: td.analysisB.stats.lateActions.total, 'Delta': td.deltaLate }
        ]);
        let support = td.decisionSupport || buildTrendDecisionSupport(td);
        addJsonSheet(wb, 'Kritik_Yol', support.criticalPath.map(i => ({ 'PQ': i.pq, 'Alan': i.area, 'CE': i.ce, 'Sorumlu': i.owner, 'Kilit Tarih': formatTrendDate(i.latestDate), 'Toplam Adım': i.totalSteps, 'Kalan Adım': i.remainingSteps, 'Gecikmiş Adım': i.lateSteps, 'Eksik Tarih': i.missingDates, 'İlerleme %': trendSafePct(i.progressPct), 'Alan EI Katkısı %': trendSafePct(i.areaContributionPct), 'Bulgu': truncateTextForExport(i.bulgu, 1000) })));
        addJsonSheet(wb, 'Sorumlu_Karnesi', support.officeRows.map(o => ({ 'Sorumlu Ofis': o.office, 'Toplam Eylem': o.totalActions, 'Tamamlanan': o.doneActions, 'Devam Eden': o.ongoingActions, 'Gecikmiş': o.lateActions, 'Tamamlanma %': trendSafePct(o.completionRate), 'Gecikme %': trendSafePct(o.delayRate), 'Etkilenen PQ': o.pqCount, 'En Yüksek Gecikme Günü': o.maxDelayDays })));
        addJsonSheet(wb, 'EI_Hizli_Kazanim', support.topImpact.map(i => ({ 'PQ': i.pq, 'Alan': i.area, 'Sorumlu': i.owner, 'Kalan Adım': i.remainingSteps, 'İlerleme %': trendSafePct(i.progressPct), 'Alan EI Katkısı %': trendSafePct(i.areaContributionPct), 'Overall EI Katkısı %': trendSafePct(i.overallContributionPct), 'Kilit Tarih': formatTrendDate(i.latestDate), 'Bulgu': truncateTextForExport(i.bulgu, 1000) })));
        addJsonSheet(wb, 'Risk_Etki', support.riskImpact.map(i => ({ 'PQ': i.pq, 'Alan': i.area, 'Sorumlu': i.owner, 'Risk Skoru': Math.round(i.riskScore || 0), 'Gecikmiş Adım': i.lateSteps, 'Eksik Tarih': i.missingDates, 'İlerleme %': trendSafePct(i.progressPct), 'Alan EI Katkısı %': trendSafePct(i.areaContributionPct), 'Kilit Tarih': formatTrendDate(i.latestDate), 'Bulgu': truncateTextForExport(i.bulgu, 1000) })));
        downloadReportWorkbook(wb, 'Trend_Kiyaslama_Detayli.xlsx');
    };

    window.exportTrendPDF = function() {
        if (!window.currentTrendData) { runTrendAnalysis(); if (!window.currentTrendData) return; }
        let td = window.currentTrendData;
        let support = td.decisionSupport || buildTrendDecisionSupport(td);
        let areaBody = [[{text:'Alan', style:'th'}, {text:'Eski EI', style:'th'}, {text:'Yeni EI', style:'th'}, {text:'Δ EI', style:'th'}, {text:'Yeni Proj.', style:'th'}, {text:'Gecikmiş Δ', style:'th'}]];
        td.areaRows.forEach(r => areaBody.push([r.area, '%' + r.oldEI.toFixed(2), '%' + r.newEI.toFixed(2), (r.deltaEI>0?'+':'') + r.deltaEI.toFixed(2), '%' + r.newProjectedEI.toFixed(2), (r.deltaLate>0?'+':'') + r.deltaLate]));
        let closedBody = [[{text:'PQ', style:'th'}, {text:'Alan', style:'th'}, {text:'Kaynak', style:'th'}, {text:'Validasyon / CE', style:'th'}, {text:'Bulgu', style:'th'}]];
        (td.newClosed.length ? td.newClosed : [{pq:'-',area:'-',source:'-',validationTask:'-',ce:'-',bulgu:'Yeni kapanan PQ yok'}]).forEach(i => closedBody.push([i.pq, i.area, i.source, i.validationTask || i.ce || '-', fullTextForPdf(i.bulgu || '')]));
        showLoading();
        setTimeout(() => {
            try {
                let docDef = {
                    pageOrientation: 'landscape', pageSize: 'A4',
                    content: [
                        {text: 'Trend ve Kıyaslama Raporu', style:'header'},
                        {text: `${td.labelA}  ➔  ${td.labelB}`, style:'subheader'},
                        {table:{widths:['*','*','*','*','*'], body:[[ 
                            {text:[{text:'Overall EI Δ\n', bold:true, fontSize:8, color:'#64748b'}, {text:(td.deltaEI>0?'+':'') + td.deltaEI.toFixed(2) + ' puan', bold:true, fontSize:14}]},
                            {text:[{text:'Yeni Kapanan PQ\n', bold:true, fontSize:8, color:'#64748b'}, {text:String(td.newClosed.length), bold:true, fontSize:14}]},
                            {text:[{text:'Tamamlanan Eylem Δ\n', bold:true, fontSize:8, color:'#64748b'}, {text:(td.deltaDone>0?'+':'') + td.deltaDone, bold:true, fontSize:14}]},
                            {text:[{text:'Devam Eden Δ\n', bold:true, fontSize:8, color:'#64748b'}, {text:(td.deltaOngoing>0?'+':'') + td.deltaOngoing, bold:true, fontSize:14}]},
                            {text:[{text:'Gecikmiş Δ\n', bold:true, fontSize:8, color:'#64748b'}, {text:(td.deltaLate>0?'+':'') + td.deltaLate, bold:true, fontSize:14}]}
                        ]]}, layout:'lightHorizontalLines', margin:[0,0,0,12]},
                        {text:'Alan Bazında Kıyaslama', style:'sectionHeader'},
                        {table:{headerRows:1, widths:['*','auto','auto','auto','auto','auto'], body:areaBody}, layout:'lightHorizontalLines', margin:[0,0,0,12]},
                        {text:'İki Tarih Arasında Yeni Kapanan PQlar', style:'sectionHeader'},
                        {table:{headerRows:1, widths:['auto','auto','auto','auto','*'], body:closedBody}, layout:'lightHorizontalLines', margin:[0,0,0,12]},
                        {text:'Önceliklendirme ve Darboğaz Özeti', style:'sectionHeader'},
                        {text:`Kritik yol adayı: ${support.briefing.latestCritical ? 'PQ ' + support.briefing.latestCritical.pq + ' / ' + formatTrendDate(support.briefing.latestCritical.latestDate) : '-'} | Darboğaz: ${support.briefing.bottleneck ? support.briefing.bottleneck.office + ' (' + support.briefing.bottleneck.lateActions + ' gecikmiş)' : '-'} | Yüksek risk/etki PQ: ${support.riskImpact.length}`, margin:[0,0,0,8]},
                        {columns:[
                            {width:'50%', stack:[{text:'Kritik Yol İlk 5', bold:true, margin:[0,0,0,4]}, {ul:(support.criticalPath.length ? support.criticalPath.slice(0,5).map(i => `PQ ${i.pq} - ${i.area} - ${formatTrendDate(i.latestDate)} - kalan ${i.remainingSteps} adım`) : ['-'])}]},
                            {width:'50%', stack:[{text:'Hızlı EI Kazanımı İlk 5', bold:true, margin:[0,0,0,4]}, {ul:(support.topImpact.length ? support.topImpact.slice(0,5).map(i => `PQ ${i.pq} - %${trendSafePct(i.areaContributionPct)} alan EI - kalan ${i.remainingSteps} adım`) : ['-'])}]}
                        ]}
                    ],
                    footer: function(currentPage, pageCount) { return { text: currentPage + ' / ' + pageCount, alignment:'right', margin:[0,0,25,0], fontSize:8, color:'#64748b' }; },
                    styles: { header:{fontSize:17,bold:true,color:'#2563eb',margin:[0,0,0,4]}, subheader:{fontSize:9,color:'#64748b',margin:[0,0,0,12]}, sectionHeader:{fontSize:12,bold:true,margin:[0,8,0,6]}, th:{bold:true,fontSize:9,fillColor:'#f1f5f9',margin:[0,4,0,4]} },
                    defaultStyle: { font:'Roboto', fontSize:9 }
                };
                safeDownloadPdf(docDef, 'Trend_Kiyaslama_Raporu.pdf');
            } catch(e) { alert('Trend PDF oluşturulurken hata oluştu: ' + e.message); }
            finally { hideLoading(); }
        }, 100);
    };

    window.runCommonReportComponentsSelfCheck = function() {
        const sample=[{A:'Bir',B:1},{A:'İki',B:2}];
        const html=renderHtmlTableRows(sample,[{key:'A'},{key:'B'}],{colspan:2});
        const wb=createReportWorkbook({title:'Test'});
        appendWorkbookSheets(wb,[createSheetDefinition('Test',sample)]);
        const sections=[];
        appendPdfTableSection(sections,'Test',sample,[{key:'A',title:'A'},{key:'B',title:'B'}],['*','auto'],{maxRows:10});
        const result={passed:html.includes('<tr')&&wb.SheetNames.includes('Test')&&sections.length>=2,htmlRows:(html.match(/<tr/g)||[]).length,workbookSheets:wb.SheetNames.length,pdfNodes:sections.length};
        console.table(result);
        return result;
    };


    window.runVisitClickLayoutSelfCheck=function(){
        const result={
            passed:true,
            workspaceTargetButtons:document.querySelectorAll('.visit-work-target[data-visit-target-key]').length,
            consultationCards:document.querySelectorAll('.visit-consult-card[data-visit-consult-key]').length,
            consultationCardDisplay:null
        };
        const card=document.querySelector('.visit-consult-card');
        if(card)result.consultationCardDisplay=getComputedStyle(card).display;
        result.passed=result.consultationCardDisplay===null||result.consultationCardDisplay==='block';
        console.log('Ziyaret tıklama ve kart yerleşimi kontrolü:',result);
        return result;
    };
