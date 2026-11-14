// USOAP CMA CAP Takip - Phase 5 / Visit Management Hub v8
(function(){
    'use strict';

    const VISIT_HUB_VERSION = '10.2-phase7-visit-hub-hotfix';
    const VISIT_TABS = [
        'visits','visit-management','visit-scope','visit-workspace','visit-followup',
        'visit-consultation','visit-reports','icao-visit-validation','visit-analysis','visit-audit'
    ];

    const PHASES = {
        planning: {
            order:1, icon:'🗓️', label:'Planlama',
            description:'Ziyaret türü, tarih, denetim alanları, birimler, ekip ve takvim planı.',
            primary:'visits',
            tools:[
                {tab:'visits', label:'Plan & Kayıtlar', icon:'📋'},
                {tab:'visit-management', label:'Takvim & Yönetim', icon:'📅'}
            ]
        },
        preparation: {
            order:2, icon:'🧩', label:'Hazırlık',
            description:'PQ/CAP kapsamı, hazırlık kayıtları, kanıt planı ve validasyon adaylarının kapsamlandırılması.',
            primary:'visit-scope',
            tools:[
                {tab:'visit-scope', label:'Kapsam & Hazırlık', icon:'🗂️'},
                {external:'validation-readiness', label:'Validasyon Adayları', icon:'🎯'}
            ]
        },
        field: {
            order:3, icon:'🧭', label:'Saha Çalışması',
            description:'PQ/CAP bazında görüşme, saha notu, kanıt doğrulama, bulgu/gözlem ve değerlendirme kayıtları.',
            primary:'visit-workspace',
            tools:[{tab:'visit-workspace', label:'Saha Çalışma Alanı', icon:'📝'}]
        },
        followup: {
            order:4, icon:'⏱️', label:'Takip',
            description:'Takip tarihleri, ek kanıt, sorumlular, danışılacak makamlar ve açık işlerin kapatılması.',
            primary:'visit-followup',
            tools:[
                {tab:'visit-followup', label:'Takip Yönetimi', icon:'✅'},
                {tab:'visit-consultation', label:'Danışma Yönetimi', icon:'💬'}
            ]
        },
        results: {
            order:5, icon:'📝', label:'Sonuç & Rapor',
            description:'Ziyaret sonuçlarının konsolidasyonu, PDF/Excel raporları ve ICAO resmî validasyon sonuçları.',
            primary:'visit-reports',
            tools:[
                {tab:'visit-reports', label:'Ziyaret Raporları', icon:'📄'},
                {tab:'icao-visit-validation', label:'ICAO Resmî Validasyon', icon:'🌐'}
            ]
        },
        history: {
            order:6, icon:'📚', label:'Geçmiş & Analiz',
            description:'PQ/CAP zaman çizelgesi, ziyaret karşılaştırmaları, tekrarlanan sorunlar ve denetim izi.',
            primary:'visit-analysis',
            tools:[
                {tab:'visit-analysis', label:'PQ/CAP Geçmişi & Analiz', icon:'📈'},
                {tab:'visit-audit', label:'Değişiklik Geçmişi', icon:'🧾'}
            ]
        }
    };

    const TAB_TO_PHASE = {};
    Object.entries(PHASES).forEach(([phase, cfg]) => {
        cfg.tools.forEach(tool => { if (tool.tab) TAB_TO_PHASE[tool.tab] = phase; });
    });

    function esc(value){
        return String(value == null ? '' : value)
            .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
            .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
    }

    function visitRecords(){
        try { return typeof getVisitRecords === 'function' ? getVisitRecords() : []; }
        catch(_){ return []; }
    }

    function visitSummary(){
        const rows = visitRecords();
        const now = new Date(); now.setHours(0,0,0,0);
        const in30 = new Date(now); in30.setDate(in30.getDate()+30);
        const countType = t => rows.filter(v => ((v && v.visitType) || 'internal') === t).length;
        const upcoming = rows.filter(v => {
            if(!v || !v.plannedStart) return false;
            const d=new Date(v.plannedStart+'T00:00:00');
            return !isNaN(d) && d>=now && d<=in30 && v.status!=='completed';
        }).length;
        return {
            total:rows.length,
            upcoming,
            active:rows.filter(v => ['in_progress','evaluation'].includes(v.status)).length,
            follow:rows.filter(v => v.status==='follow_up').length,
            completed:rows.filter(v => v.status==='completed').length,
            cap:countType('cap_followup'),
            audit:countType('internal'),
            validation:countType('validation_prep'),
            icao:countType('icao_official'),
            other:countType('other')
        };
    }

    function phaseButtons(activePhase){
        return Object.entries(PHASES).sort((a,b)=>a[1].order-b[1].order).map(([key,cfg]) =>
            `<button type="button" class="visit-hub-phase ${key===activePhase?'active':''}" onclick="openVisitHub('${key}')"><span class="visit-hub-phase-order">${cfg.order}</span><span class="visit-hub-phase-icon">${cfg.icon}</span><span>${esc(cfg.label)}</span></button>`
        ).join('');
    }

    function toolButtons(activeTab, activePhase){
        const cfg=PHASES[activePhase] || PHASES.planning;
        return cfg.tools.map(tool => {
            const isActive = tool.tab === activeTab;
            if(tool.external){
                return `<button type="button" class="visit-hub-tool external" onclick="switchTab('${esc(tool.external)}')">${tool.icon||'↗️'} ${esc(tool.label)} <span class="visit-hub-external-mark">↗</span></button>`;
            }
            return `<button type="button" class="visit-hub-tool ${isActive?'active':''}" onclick="openVisitHubView('${esc(tool.tab)}')">${tool.icon||'•'} ${esc(tool.label)}</button>`;
        }).join('');
    }

    function summaryHtml(){
        const s=visitSummary();
        return `<div class="visit-hub-kpis">
            <span><b>${s.total}</b> Toplam</span>
            <span><b>${s.upcoming}</b> 30 günde planlı</span>
            <span><b>${s.active}</b> Devam eden</span>
            <span><b>${s.follow}</b> Takipte</span>
            <span><b>${s.completed}</b> Tamamlanan</span>
        </div>
        <div class="visit-hub-type-strip" title="Ziyaret kayıtlarının tür dağılımı">
            <span>CAP Takip <b>${s.cap}</b></span><span>İç Denetim <b>${s.audit}</b></span><span>Validasyon Hazırlığı <b>${s.validation}</b></span><span>ICAO <b>${s.icao}</b></span>${s.other?`<span>Diğer <b>${s.other}</b></span>`:''}
        </div>`;
    }

    function headerHtml(activeTab){
        const activePhase = TAB_TO_PHASE[activeTab] || 'planning';
        const cfg=PHASES[activePhase];
        return `<section class="visit-hub-header" data-visit-hub-version="${VISIT_HUB_VERSION}">
            <div class="visit-hub-title-row">
                <div>
                    <div class="visit-hub-eyebrow">USOAP CMA · Operasyon</div>
                    <h2>🧭 Ziyaret Yönetimi</h2>
                    <p>${esc(cfg.description)}</p>
                </div>
                <div class="visit-hub-title-actions">
                    <button type="button" class="btn-outline" onclick="openVisitHub('planning')">🏠 Hub Başlangıcı</button>
                    <button type="button" onclick="openVisitForm()">➕ Yeni Ziyaret</button>
                </div>
            </div>
            ${summaryHtml()}
            <div class="visit-hub-process" role="navigation" aria-label="Ziyaret süreci">${phaseButtons(activePhase)}</div>
            <div class="visit-hub-subnav"><div><b>${cfg.icon} ${esc(cfg.label)}</b><small>${esc(cfg.description)}</small></div><div class="visit-hub-tools">${toolButtons(activeTab,activePhase)}</div></div>
        </section>`;
    }

    function ensureHeaders(){
        VISIT_TABS.forEach(tabId => {
            const tab=document.getElementById('tab-'+tabId);
            if(!tab) return;
            let holder=tab.querySelector(':scope > .visit-hub-header-holder');
            if(!holder){
                holder=document.createElement('div');
                holder.className='visit-hub-header-holder';
                tab.insertBefore(holder,tab.firstChild);
            }
            holder.innerHTML=headerHtml(tabId);
        });
    }

    function updateVisibleHeader(activeTab){
        const tab=document.getElementById('tab-'+activeTab);
        if(!tab) return;
        let holder=tab.querySelector(':scope > .visit-hub-header-holder');
        if(!holder){ ensureHeaders(); holder=tab.querySelector(':scope > .visit-hub-header-holder'); }
        if(holder) holder.innerHTML=headerHtml(activeTab);
    }

    window.openVisitHub=function(phase='planning'){
        const cfg=PHASES[phase] || PHASES.planning;
        return window.openVisitHubView(cfg.primary);
    };

    window.openVisitHubView=function(tabId){
        if(!VISIT_TABS.includes(tabId)) return false;
        const ok=typeof switchTab==='function' ? switchTab(tabId) : false;
        if(ok) window.syncVisitHubNavigation(tabId);
        return ok;
    };

    window.syncVisitHubNavigation=function(activeTab){
        const hubBtn=document.getElementById('btn-tab-visit-hub');
        if(!VISIT_TABS.includes(activeTab)){
            if(hubBtn){ hubBtn.classList.remove('active'); hubBtn.style.color='var(--muted)'; }
            return;
        }
        ensureHeaders();
        updateVisibleHeader(activeTab);
        if(hubBtn){
            hubBtn.classList.add('active');
            hubBtn.style.color='var(--primary)';
            const group=hubBtn.closest('.nav-group');
            if(group) group.classList.add('open');
        }
    };

    window.refreshVisitHubSummary=function(){
        const active=document.querySelector('.tab-content.active');
        if(active && active.id && active.id.startsWith('tab-')){
            const tabId=active.id.slice(4);
            if(VISIT_TABS.includes(tabId)) updateVisibleHeader(tabId);
        }
    };

    window.runVisitHubSelfCheck=function(){
        const missingTabs=VISIT_TABS.filter(id=>!document.getElementById('tab-'+id));
        const phaseTargets=Object.entries(PHASES).flatMap(([phase,cfg])=>cfg.tools.filter(t=>t.tab).map(t=>({phase,tab:t.tab,exists:!!document.getElementById('tab-'+t.tab)})));
        const result={
            passed:missingTabs.length===0 && !!document.getElementById('btn-tab-visit-hub') && phaseTargets.every(x=>x.exists),
            version:VISIT_HUB_VERSION,
            missingTabs,
            phaseTargets,
            visitCount:visitSummary().total,
            visitTypes:Object.keys(VISIT_TYPES||{})
        };
        console.log('Ziyaret Yönetimi Hub öz denetimi:',result);
        return result;
    };

    function init(){
        ensureHeaders();
        const active=document.querySelector('.tab-content.active');
        if(active && active.id && active.id.startsWith('tab-')) window.syncVisitHubNavigation(active.id.slice(4));
    }

    if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true}); else init();
})();
