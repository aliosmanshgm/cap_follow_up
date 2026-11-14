(function(){
    'use strict';

    const SHELL_VERSION='management-shell-v1-phase7';
    const CAP_TABS=['list','upcoming','past','kanban','empty-caps','icao-closed'];
    const CAP_SECTIONS={
        portfolio:{order:1,icon:'📋',label:'Portföy',description:'Tüm PQ/CAP kayıtları, ilerleme ve temel sorumluluk görünümü.',primary:'list',tools:[{tab:'list',icon:'📋',label:'Tüm PQ ve CAP’ler'}]},
        deadlines:{order:2,icon:'⏱️',label:'Termin & Risk',description:'Yaklaşan hedef tarihleri ve gecikmeye düşen CAP adımlarını yönetin.',primary:'upcoming',tools:[{tab:'upcoming',icon:'⚠️',label:'Yaklaşan'},{tab:'past',icon:'🔴',label:'Geciken'}]},
        workflow:{order:3,icon:'🗂️',label:'İş Akışı',description:'CAP adımlarını gecikme ve tarih riski odaklı Kanban görünümünde izleyin.',primary:'kanban',tools:[{tab:'kanban',icon:'🗂️',label:'Kanban'}]},
        gaps:{order:4,icon:'🧩',label:'Eksikler',description:'OLF/CAP veri eksiklerini ve eylem adımı bulunmayan PQ’ları inceleyin.',primary:'empty-caps',tools:[{tab:'empty-caps',icon:'🈳',label:'CAP Eksiklikleri'}]},
        closure:{order:5,icon:'🏆',label:'ICAO Sonuçları',description:'ICAO tarafından resmen kapatılan PQ’ları ve kapanış durumunu izleyin.',primary:'icao-closed',tools:[{tab:'icao-closed',icon:'🏆',label:'ICAO Kapatılanlar'}]}
    };
    const TAB_TO_SECTION={};
    Object.entries(CAP_SECTIONS).forEach(([key,cfg])=>cfg.tools.forEach(t=>TAB_TO_SECTION[t.tab]=key));

    const esc=v=>typeof escapeHtml==='function'?escapeHtml(String(v??'')):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

    function usableCapRows(){
        try{return (rawData||[]).filter(r=>r&&r.pq&&(!window.isUsableCapStep||isUsableCapStep(r)));}catch(_){return[];}
    }
    function capSummary(){
        const rows=usableCapRows(),byPq=new Map();
        rows.forEach(r=>{const k=String(r.pq||'');if(!byPq.has(k))byPq.set(k,[]);byPq.get(k).push(r);});
        let completed=0,late=0,ongoing=0;
        byPq.forEach(items=>{
            const sts=items.map(r=>{try{return getStatus(r).type;}catch(_){return'';}});
            if(sts.length&&sts.every(x=>x==='done')) completed++;
            else if(sts.some(x=>x==='late')) late++;
            else ongoing++;
        });
        let closed=0;
        try{closed=Object.values(pqMasterData||{}).filter(x=>x&&x.isIcaoClosed).length;}catch(_){closed=0;}
        return{pqCount:byPq.size,actionCount:rows.length,completed,late,ongoing,closed};
    }
    function visitSummary(){
        let records=[];try{records=typeof getVisitRecords==='function'?getVisitRecords():[];}catch(_){records=[];}
        const now=new Date();now.setHours(0,0,0,0);const in30=new Date(now);in30.setDate(in30.getDate()+30);
        const upcoming=records.filter(v=>{const d=new Date(v.plannedStart||'');return !Number.isNaN(d.getTime())&&d>=now&&d<=in30&&!['completed','cancelled'].includes(String(v.status||''));}).length;
        const active=records.filter(v=>!['completed','cancelled'].includes(String(v.status||''))).length;
        return{total:records.length,active,upcoming};
    }
    function pqSummary(){
        if(typeof window.getPqLibrarySummary==='function'){
            try{return window.getPqLibrarySummary();}catch(_){ }
        }
        return{activeAreas:0,loadedAreas:0,totalPqs:0,versionCount:0};
    }
    function validationSummary(){
        if(typeof window.getValidationReadinessSummary==='function'){
            try{return window.getValidationReadinessSummary();}catch(_){ }
        }
        return{total:0,ready:0,assigned:0,unassigned:0,overallPotential:0};
    }
    function latestAssessment(){
        try{return typeof window.getLatestOfficialAssessmentSnapshot==='function'?window.getLatestOfficialAssessmentSnapshot():null;}catch(_){return null;}
    }
    function latestEiText(row){
        const ei=Number(row&&row.snapshot&&row.snapshot.overall&&row.snapshot.overall.ei);
        return Number.isFinite(ei)?`%${ei.toFixed(2)}`:'-';
    }

    function capHeaderHtml(activeTab){
        const section=TAB_TO_SECTION[activeTab]||'portfolio',cfg=CAP_SECTIONS[section],sum=capSummary(),val=validationSummary();
        const phases=Object.entries(CAP_SECTIONS).map(([key,x])=>`<button type="button" class="cap-hub-phase ${key===section?'active':''}" onclick="openCapHub('${key}')"><span class="cap-hub-phase-order">${x.order}</span><span>${x.icon}</span><span>${esc(x.label)}</span></button>`).join('');
        const tools=cfg.tools.map(t=>`<button type="button" class="cap-hub-tool ${t.tab===activeTab?'active':''}" onclick="openCapHubView('${esc(t.tab)}')">${t.icon} ${esc(t.label)}</button>`).join('');
        return `<section class="cap-hub-header">
            <div class="cap-hub-title-row"><div><div class="cap-hub-eyebrow">Operasyon · CAP Yönetimi</div><h2>📋 CAP Yönetimi</h2><p>CAP portföyü, termin riski, iş akışı, veri eksikleri ve ICAO kapanışlarını tek merkezden yönetin. Validasyon projeksiyonu ayrı olarak Validasyon Hazırlığı ekranında tutulur.</p></div><div class="cap-hub-title-actions"><button type="button" class="btn-outline" onclick="switchTab('validation-readiness')">🎯 Validasyon Hazırlığı</button><button type="button" onclick="switchTab('report')">📝 Yönetici Raporu</button></div></div>
            <div class="cap-hub-kpis"><span><b>${sum.pqCount}</b> CAP/PQ</span><span><b>${sum.actionCount}</b> CAP adımı</span><span><b>${sum.completed}</b> tamamlanan PQ</span><span><b>${sum.late}</b> gecikme riski</span><span><b>${val.total||0}</b> validasyon adayı</span><span><b>${sum.closed}</b> ICAO kapalı</span></div>
            <div class="cap-hub-process">${phases}</div>
            <div class="cap-hub-subnav"><div><b>${cfg.icon} ${esc(cfg.label)}</b><small>${esc(cfg.description)}</small></div><div class="cap-hub-tools">${tools}</div></div>
        </section>`;
    }
    function ensureCapHeaders(){
        CAP_TABS.forEach(tabId=>{
            const tab=document.getElementById('tab-'+tabId);if(!tab)return;
            let holder=tab.querySelector(':scope > .cap-hub-header-holder');
            if(!holder){holder=document.createElement('div');holder.className='cap-hub-header-holder';tab.prepend(holder);}
        });
    }
    function updateCapHeader(activeTab){
        const tab=document.getElementById('tab-'+activeTab);if(!tab)return;
        let holder=tab.querySelector(':scope > .cap-hub-header-holder');if(!holder){ensureCapHeaders();holder=tab.querySelector(':scope > .cap-hub-header-holder');}
        if(holder)holder.innerHTML=capHeaderHtml(activeTab);
    }
    window.openCapHub=function(section='portfolio'){
        const cfg=CAP_SECTIONS[section]||CAP_SECTIONS.portfolio;return window.openCapHubView(cfg.primary);
    };
    window.openCapHubView=function(tabId){
        if(!CAP_TABS.includes(tabId))return false;const ok=typeof switchTab==='function'?switchTab(tabId):false;if(ok)window.syncCapHubNavigation(tabId);return ok;
    };
    window.syncCapHubNavigation=function(activeTab){
        const hubBtn=document.getElementById('btn-tab-cap-hub');
        if(!CAP_TABS.includes(activeTab)){
            if(hubBtn){hubBtn.classList.remove('active');hubBtn.style.color='var(--muted)';}
            return;
        }
        ensureCapHeaders();updateCapHeader(activeTab);
        if(hubBtn){hubBtn.classList.add('active');hubBtn.style.color='var(--primary)';const group=hubBtn.closest('.nav-group');if(group)group.classList.add('open');}
    };
    window.refreshCapHubSummary=function(){
        const active=document.querySelector('.tab-content.active');if(!active||!active.id)return;const tabId=active.id.slice(4);if(CAP_TABS.includes(tabId))updateCapHeader(tabId);
    };

    function flowCard({step,icon,title,value,sub,action,kind=''}){
        return `<button type="button" class="management-flow-card ${kind}" onclick="${action}"><span class="management-flow-step">${step}</span><span class="management-flow-icon">${icon}</span><span class="management-flow-copy"><b>${esc(title)}</b><strong>${esc(value)}</strong><small>${esc(sub)}</small></span><span class="management-flow-arrow">›</span></button>`;
    }
    window.renderManagementFlow=function(){
        const el=document.getElementById('managementFlowStrip');if(!el)return;
        const pq=pqSummary(),cap=capSummary(),val=validationSummary(),vis=visitSummary(),latest=latestAssessment();
        const latestName=latest?(latest.name||latest.assessmentName||latest.type||'Son resmî değerlendirme'):'Resmî kayıt bekleniyor';
        const html=[
            flowCard({step:'1',icon:'📚',title:'ICAO PQ Master',value:`${pq.activeAreas||0}/8 aktif alan`,sub:`${pq.totalPqs||0} aktif PQ · ${pq.versionCount||0} sürüm/revizyon`,action:"switchTab('pq-library')",kind:'reference'}),
            flowCard({step:'2',icon:'📋',title:'CAP Yönetimi',value:`${cap.pqCount} PQ / ${cap.actionCount} adım`,sub:`${cap.completed} tamamlandı · ${cap.late} gecikme riski`,action:"openCapHub('portfolio')",kind:'operation'}),
            flowCard({step:'3',icon:'🎯',title:'Validasyon Hazırlığı',value:`${val.total||0} aday PQ`,sub:`${val.ready||0} hazır · ${val.assigned||0} ziyarete atanmış`,action:"switchTab('validation-readiness')",kind:'validation'}),
            flowCard({step:'4',icon:'🧭',title:'Ziyaret Yönetimi',value:`${vis.active} aktif ziyaret`,sub:`${vis.upcoming} önümüzdeki 30 gün · ${vis.total} toplam`,action:"openVisitHub('planning')",kind:'visit'}),
            flowCard({step:'5',icon:'🌐',title:'Resmî ICAO EI',value:latestEiText(latest),sub:latestName,action:"openIcaoOfficialEiManager()",kind:'official'})
        ].join('');
        el.innerHTML=`<section class="management-flow-panel"><div class="management-flow-head"><div><span class="management-flow-eyebrow">USOAP CMA uçtan uca süreç</span><h3>PQ → CAP → Validasyon → Ziyaret → Resmî EI</h3><p>Her aşama bir önceki aşamanın kayıtlarını kullanır; resmî EI yalnız ICAO değerlendirmesiyle değişmiş kabul edilir.</p></div><button type="button" class="btn-outline" onclick="switchTab('quality')">🧪 Veri Kalitesi</button></div><div class="management-flow-grid">${html}</div></section>`;
    };

    window.openEiAnalysis=function(){
        const ok=typeof switchTab==='function'?switchTab('dashboard'):false;
        if(ok)setTimeout(()=>{const target=document.getElementById('eiOverallProgressPanel')||document.getElementById('eiChartPanel');if(target&&target.scrollIntoView)target.scrollIntoView({behavior:'smooth',block:'start'});},80);
        return ok;
    };

    window.runManagementShellSelfCheck=function(){
        const missingCapTabs=CAP_TABS.filter(id=>!document.getElementById('tab-'+id));
        const result={passed:missingCapTabs.length===0&&!!document.getElementById('btn-tab-cap-hub')&&!!document.getElementById('managementFlowStrip'),version:SHELL_VERSION,missingCapTabs,capSummary:capSummary(),validationSummary:validationSummary(),visitSummary:visitSummary(),pqSummary:pqSummary()};
        console.log('Management shell self-check:',result);return result;
    };

    setTimeout(()=>{ensureCapHeaders();renderManagementFlow();const active=document.querySelector('.tab-content.active');if(active&&active.id){const id=active.id.slice(4);window.syncCapHubNavigation(id);}},0);
})();
