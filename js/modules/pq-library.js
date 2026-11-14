// ICAO PQ veri tabanı, DOCX parser ve sürüm yönetimi modülü
// ===== Ziyaret çalışma merkezi + ICAO PQ sürüm veri tabanı =====
    let icaoOfficialWorkspaceMode='validation';
    let visitWorkspaceMode='fieldwork';
    let icaoPqLibrary={editions:{}};
    let pqDbView='versions';
    let pqDbSelectedPq='';
    let pqDbLoaded=false;
    const PQDB_STORAGE_KEY='icao_pq_library_v1';
    const PQDB_ACTIVE_EDITION_KEY='icao_pq_library_active_edition'; // legacy fallback
    const PQDB_AREAS=['LEG','ORG','PEL','OPS','AIR','AIG','ANS','AGA'];
    const PQDB_AREA_META={
        LEG:{icon:'⚖️',name:'Primary Aviation Legislation and Civil Aviation Regulations',short:'Mevzuat',range:'1.xxx'},
        ORG:{icon:'🏛️',name:'Civil Aviation Organization',short:'Organizasyon',range:'2.xxx'},
        PEL:{icon:'🎓',name:'Personnel Licensing and Training',short:'Personel Lisanslama',range:'3.xxx'},
        OPS:{icon:'✈️',name:'Aircraft Operations',short:'Uçuş Operasyonları',range:'4.xxx'},
        AIR:{icon:'🛠️',name:'Airworthiness of Aircraft',short:'Uçuşa Elverişlilik',range:'5.xxx'},
        AIG:{icon:'🔎',name:'Aircraft Accident and Incident Investigation',short:'Kaza/Olay İnceleme',range:'6.xxx'},
        ANS:{icon:'🗼',name:'Air Navigation Services',short:'Hava Seyrüsefer',range:'7.xxx'},
        AGA:{icon:'🛬',name:'Aerodromes and Ground Aids',short:'Havaalanları',range:'8.xxx'}
    };
    let pqDbSelectedArea='';
    function pqDbNormalizeRevision(v){v=String(v||'').trim();if(!v||/^(ilk\s*yay[ıi]n|initial\s*(issue|release)|original)$/i.test(v))return'0';const m=v.match(/(?:rev(?:ision)?\.?|revizyon)\s*(?:no\.?|#)?\s*[:\-]?\s*([A-Za-z0-9._-]+)/i);return m?m[1]:v;}
    function pqDbRevisionLabel(v){v=String(v??'').trim();return(!v||v==='0')?'İlk Yayın':`Revizyon ${v}`;}

    function setIcaoVisitWorkspaceMode(mode){
        icaoOfficialWorkspaceMode=['validation','reference','impact'].includes(mode)?mode:'validation';
        document.querySelectorAll('#icaoVisitSubnav [data-icao-mode]').forEach(b=>b.classList.toggle('active',b.dataset.icaoMode===icaoOfficialWorkspaceMode));
        const layout=document.querySelector('#tab-icao-visit-validation .icao-visit-layout'),ei=document.getElementById('icaoOfficialVisitEiSection'),form=document.getElementById('icaoValidationForm'),empty=document.getElementById('icaoValidationEmpty'),ref=document.getElementById('icaoPqReferencePanel');
        if(layout)layout.classList.toggle('visit-mode-hidden',icaoOfficialWorkspaceMode==='impact');
        if(ei)ei.classList.toggle('visit-mode-hidden',icaoOfficialWorkspaceMode!=='impact');
        if(ref)ref.style.display=icaoOfficialWorkspaceMode==='reference'?'grid':'none';
        if(icaoOfficialWorkspaceMode==='reference'){
            if(form)form.style.display='none'; if(empty)empty.style.display='none'; renderIcaoPqReferencePanel();
        }else if(icaoOfficialWorkspaceMode==='validation'){
            if(activeIcaoValidationPq){if(form)form.style.display='block';if(empty)empty.style.display='none';}else{if(form)form.style.display='none';if(empty)empty.style.display='block';}
        }
        if(icaoOfficialWorkspaceMode==='impact')renderIcaoOfficialVisitEiSummary();
    }
    window.setIcaoVisitWorkspaceMode=setIcaoVisitWorkspaceMode;

    function setVisitWorkspaceMode(mode){
        visitWorkspaceMode=['fieldwork','reference','records'].includes(mode)?mode:'fieldwork';
        document.querySelectorAll('#visitWorkspaceSubnav [data-work-mode]').forEach(b=>b.classList.toggle('active',b.dataset.workMode===visitWorkspaceMode));
        const form=document.getElementById('visitWorkspaceForm'),ref=document.getElementById('visitWorkspacePqReferencePanel'),records=document.getElementById('visitWorkspaceRecordsPanel');
        if(form)form.style.display=visitWorkspaceMode==='fieldwork'?'block':'none';
        if(ref)ref.style.display=visitWorkspaceMode==='reference'?'grid':'none';
        if(records)records.style.display=visitWorkspaceMode==='records'?'block':'none';
        if(visitWorkspaceMode==='reference')renderVisitWorkspacePqReference();
        if(visitWorkspaceMode==='records')renderVisitWorkspaceRecords();
    }
    window.setVisitWorkspaceMode=setVisitWorkspaceMode;

    function pqDbSafeKey(v){return String(v||'').trim().replace(/[.#$\[\]\/]/g,'_').replace(/\s+/g,'_');}
    function pqDbNormalizeLibrary(raw){
        const lib=raw&&typeof raw==='object'?raw:{editions:{},activeByArea:{}};
        if(!lib.editions||typeof lib.editions!=='object')lib.editions={};
        if(!lib.activeByArea||typeof lib.activeByArea!=='object')lib.activeByArea={};
        return lib;
    }
    function pqDbRemoveLegacyEmbeddedSeed(lib){
        let changed=false;
        const editions=(lib&&lib.editions)||{};
        Object.keys(editions).forEach(key=>{
            const edition=editions[key]||{};
            const areas=edition.areas||{};
            Object.keys(areas).forEach(area=>{
                const rec=areas[area]||{};
                if(rec.importedAt==='seed'||rec.createdAt==='seed'){delete areas[area];changed=true;}
            });
            if(!Object.keys(areas).length){delete editions[key];changed=true;}
        });
        return changed;
    }

    function pqDbSaveLocal(){try{localStorage.setItem(PQDB_STORAGE_KEY,JSON.stringify(icaoPqLibrary));}catch(e){console.warn('PQ DB local save',e);}}
    function pqDbActiveEdition(){return localStorage.getItem(PQDB_ACTIVE_EDITION_KEY)||'';}
    function pqDbActiveAreaRecord(area){area=String(area||'').trim().toUpperCase();const direct=(icaoPqLibrary.activeByArea||{})[area];if(direct&&direct.editionKey)return direct;const legacy=pqDbActiveEdition();return legacy&&(((icaoPqLibrary.editions||{})[legacy]||{}).areas||{})[area]?{editionKey:legacy,area}:null;}
    function setPqDbActiveEdition(key){if(key)localStorage.setItem(PQDB_ACTIVE_EDITION_KEY,key);else localStorage.removeItem(PQDB_ACTIVE_EDITION_KEY);renderPqDbVersions();renderPqDbKpis();showAppRuntimeToast(key?`Eski uyumluluk için aktif PQ referansı: ${key}`:'Eski aktif PQ referansı temizlendi.','success');}
    window.setPqDbActiveEdition=setPqDbActiveEdition;

    async function loadIcaoPqLibrary(force=false){
        if(pqDbLoaded&&!force){renderIcaoPqLibraryModule();return icaoPqLibrary;}
        const note=document.getElementById('pqDbSyncNote');if(note)note.textContent='PQ veri tabanı okunuyor...';
        try{
            if(!window.PQRepository)throw new Error('PQ repository servisi yüklenemedi.');
            const result=await window.PQRepository.load();
            icaoPqLibrary=pqDbNormalizeLibrary(result.library);
            if(window.PQLinkage&&typeof window.PQLinkage.enrichLibrary==='function')window.PQLinkage.enrichLibrary(icaoPqLibrary);
            if(pqDbRemoveLegacyEmbeddedSeed(icaoPqLibrary))pqDbSaveLocal();
            if(note)note.textContent=result.message||'PQ veri tabanı hazır.';
        }catch(err){
            console.warn('PQ DB load',err);
            let local=null;try{local=JSON.parse(localStorage.getItem(PQDB_STORAGE_KEY)||'null');}catch(e){}
            icaoPqLibrary=pqDbNormalizeLibrary(local||{editions:{}});
            if(window.PQLinkage&&typeof window.PQLinkage.enrichLibrary==='function')window.PQLinkage.enrichLibrary(icaoPqLibrary);
            if(note)note.textContent='PQ veri tabanı yüklenemedi; yerel cache kullanılıyor. '+(err.message||err);
        }
        pqDbLoaded=true;refreshCapPqLinkage({persist:true,silent:true});renderPqDbKpis();renderPqDbVersions();populatePqDbSelectors();renderPqDbCatalog();renderPqDbComparison();renderPqDbLinkage();return icaoPqLibrary;
    }
    window.loadIcaoPqLibrary=loadIcaoPqLibrary;

    function pqDbEditionEntries(){
        return Object.entries((icaoPqLibrary&&icaoPqLibrary.editions)||{}).map(([key,v])=>({key,...(v||{})})).sort((a,b)=>String(b.year||'').localeCompare(String(a.year||''),undefined,{numeric:true})||String(b.revision||'').localeCompare(String(a.revision||''),undefined,{numeric:true}));
    }
    function pqDbAreaEntries(edition){return Object.entries((edition&&edition.areas)||{}).map(([area,v])=>({area,...(v||{})})).sort((a,b)=>{const ai=PQDB_AREAS.indexOf(a.area),bi=PQDB_AREAS.indexOf(b.area);if(ai>=0||bi>=0)return(ai<0?999:ai)-(bi<0?999:bi);return a.area.localeCompare(b.area);});}
    function pqDbPqList(areaData){return Object.values((areaData&&areaData.pqs)||{}).filter(Boolean).sort((a,b)=>String(a.pq||'').localeCompare(String(b.pq||''),undefined,{numeric:true}));}
    function pqDbAmendments(areaData){return Object.values((areaData&&areaData.amendments)||{}).filter(Boolean);}
    function pqDbEditionLabel(e){return e?`Sürüm ${e.year||'?'} · ${pqDbRevisionLabel(e.revision)}`:'-';}
    function pqDbFlattenRecords(){const out=[];pqDbEditionEntries().forEach(e=>pqDbAreaEntries(e).forEach(a=>out.push({editionKey:e.key,edition:e,area:a.area,areaData:a})));return out;}
    function pqDbChangeClass(v){const x=String(v||'').toLowerCase();if(x==='no change')return'no-change';return x.replace(/\s+/g,'-');}
    function pqDbControlValue(p){return String((p&&p.ce)||(p&&p.sspComponent)||'').trim();}
    function pqDbControlLabel(p){return String((p&&p.sspComponent)?'SSP Component':'CE');}

    function renderPqDbKpis(){
        const eds=pqDbEditionEntries(),areas=eds.flatMap(e=>pqDbAreaEntries(e)),pqs=areas.flatMap(a=>pqDbPqList(a)),changes=areas.flatMap(a=>pqDbAmendments(a));
        const vals={pqDbKpiEditions:eds.length,pqDbKpiAreas:areas.length,pqDbKpiPqs:pqs.length,pqDbKpiOnsite:pqs.filter(p=>p.assessmentMode==='On-site').length,pqDbKpiPpq:pqs.filter(p=>p.ppq).length,pqDbKpiChanges:changes.length,pqDbKpiConcepts:Object.keys((icaoPqLibrary&&icaoPqLibrary.concepts)||{}).length};Object.entries(vals).forEach(([id,v])=>{const e=document.getElementById(id);if(e)e.textContent=String(v);});
    }
    function pqDbAreaMeta(area){return PQDB_AREA_META[area]||{icon:'📘',name:area,short:area,range:''};}
    function pqDbAreaRows(area){return pqDbFlattenRecords().filter(r=>r.area===area).sort((a,b)=>String(b.edition.year||'').localeCompare(String(a.edition.year||''),undefined,{numeric:true})||String(b.edition.revision||'').localeCompare(String(a.edition.revision||''),undefined,{numeric:true}));}
    function pqDbAreaActiveContext(area,rows){
        const active=pqDbActiveAreaRecord(area),activeRow=active?rows.find(r=>r.editionKey===active.editionKey):null,latest=rows[0]||null,current=activeRow||latest;
        const a=current&&current.areaData||{},pqs=pqDbPqList(a),amendments=pqDbAmendments(a);
        return {active,activeRow,current,pqs,amendments,onSite:pqs.filter(p=>p.assessmentMode==='On-site').length,offSite:pqs.filter(p=>p.assessmentMode==='Off-site').length,ppq:pqs.filter(p=>p.ppq).length};
    }
    function pqDbSelectArea(area){pqDbSelectedArea=String(area||'').toUpperCase();renderPqDbVersions();}
    window.pqDbSelectArea=pqDbSelectArea;
    function openPqDbAreaCatalog(area){
        const rows=pqDbAreaRows(area),ctx=pqDbAreaActiveContext(area,rows),row=ctx.current;if(!row)return;
        openPqDbEdition(row.editionKey,area);
    }
    window.openPqDbAreaCatalog=openPqDbAreaCatalog;
    function openPqDbAreaCompare(area){
        const rows=pqDbAreaRows(area),ctx=pqDbAreaActiveContext(area,rows),row=ctx.current;if(!row)return;
        setPqDbView('compare');
        const target=document.getElementById('pqDbCompareTarget');if(target)target.value=row.editionKey;
        pqDbCompareTargetChanged(false);
        const areaSel=document.getElementById('pqDbCompareArea');if(areaSel&&[...areaSel.options].some(o=>o.value===area))areaSel.value=area;
        pqDbCompareTargetChanged();
    }
    window.openPqDbAreaCompare=openPqDbAreaCompare;
    function renderPqDbVersions(){
        const grid=document.getElementById('pqDbVersionGrid');if(!grid)return;
        const records=pqDbFlattenRecords(),extraAreas=[...new Set(records.map(r=>r.area).filter(a=>!PQDB_AREAS.includes(a)))].sort(),areas=[...PQDB_AREAS,...extraAreas];
        if(!pqDbSelectedArea||!areas.includes(pqDbSelectedArea)){pqDbSelectedArea=areas.find(a=>pqDbAreaRows(a).length)||PQDB_AREAS[0];}
        const cards=areas.map(area=>{
            const rows=pqDbAreaRows(area),ctx=pqDbAreaActiveContext(area,rows),m=pqDbAreaMeta(area),cur=ctx.current,a=cur&&cur.areaData||{},has=!!cur,isSelected=area===pqDbSelectedArea;
            const ver=cur?String(cur.edition.year||'?'):'—',rev=cur?pqDbRevisionLabel(cur.edition.revision):'Kayıt yok',date=a.publicationDate||'',changeCount=ctx.amendments.length;
            return `<button type="button" class="pqdb-area-card area-${escapeHtml(area.toLowerCase())} ${isSelected?'selected':''} ${has?'has-data':'empty'}" onclick="pqDbSelectArea('${escapeHtml(area)}')">
                <div class="pqdb-area-card-top"><span class="pqdb-area-icon">${m.icon}</span><span class="pqdb-area-code">${escapeHtml(area)}</span><span class="pqdb-area-range">${escapeHtml(m.range)}</span></div>
                <div class="pqdb-area-card-name">${escapeHtml(m.short)}</div>
                <div class="pqdb-area-card-version"><span>Aktif / güncel</span><strong>${escapeHtml(ver)}</strong><em>${escapeHtml(rev)}</em></div>
                <div class="pqdb-area-card-metrics"><span><b>${ctx.pqs.length}</b> PQ</span><span><b>${ctx.onSite}</b> On-site</span><span><b>${ctx.offSite}</b> Off-site</span><span><b>${ctx.ppq}</b> PPQ</span></div>
                <div class="pqdb-area-card-foot"><span>${has?`${rows.length} kayıt · ${changeCount} değişiklik`:'Henüz PQ dokümanı yüklenmedi'}</span>${ctx.activeRow?'<b class="pqdb-card-active">AKTİF</b>':''}</div>
                ${date?`<div class="pqdb-area-card-date">Belge: ${escapeHtml(date)}</div>`:''}
            </button>`;
        }).join('');
        const area=pqDbSelectedArea,rows=pqDbAreaRows(area),ctx=pqDbAreaActiveContext(area,rows),m=pqDbAreaMeta(area),active=ctx.active;
        let detailBody='';
        if(!rows.length){
            detailBody=`<div class="pqdb-area-empty-state"><div class="empty-icon">${m.icon}</div><h4>${escapeHtml(area)} için henüz PQ kaydı yok</h4><p>Bu denetim alanının ICAO PQ Word dokümanını yüklediğinizde sürüm ve revizyon geçmişi burada oluşacaktır.</p><button type="button" onclick="document.getElementById('pqDbDocxInput').click()">📄 ${escapeHtml(area)} PQ DOCX Yükle</button></div>`;
        }else{
            const versions={};rows.forEach(r=>{const v=String(r.edition.year||'?');(versions[v]||(versions[v]=[])).push(r);});
            detailBody=Object.keys(versions).sort((a,b)=>String(b).localeCompare(String(a),undefined,{numeric:true})).map(version=>{
                const revRows=versions[version].sort((a,b)=>String(b.edition.revision||'').localeCompare(String(a.edition.revision||''),undefined,{numeric:true}));
                return `<section class="pqdb-version-block"><div class="pqdb-version-block-head"><div><span class="version-label">Sürüm</span><strong>${escapeHtml(version)}</strong></div><span>${revRows.length} revizyon/kayıt</span></div><div class="pqdb-revision-list">${revRows.map(r=>{
                    const a=r.areaData||{},sd=a.sourceDocument||{},isActive=!!(active&&active.editionKey===r.editionKey),pqCount=pqDbPqList(a).length,amendments=pqDbAmendments(a).length,cloud=sd.status==='stored'?'☁️ Kaynak DOCX':sd.status==='external-planned'?'🔗 Harici arşiv planlı':'🗄️ Yapılandırılmış veri';
                    return `<article class="pqdb-revision-row ${isActive?'active-record':''}"><div class="pqdb-revision-main"><div class="pqdb-revision-heading"><b>${escapeHtml(pqDbRevisionLabel(r.edition.revision))}</b>${isActive?'<span class="pqdb-badge new">AKTİF</span>':''}</div><div class="pqdb-revision-file">${escapeHtml(a.sourceFile||'-')}</div>${a.note?`<div class="pqdb-revision-note">${escapeHtml(a.note)}</div>`:''}</div><div class="pqdb-revision-meta"><span><b>${pqCount}</b> PQ</span><span><b>${amendments}</b> amendment</span><span>Belge tarihi: <b>${escapeHtml(a.publicationDate||'-')}</b></span><span>${escapeHtml(cloud)}</span></div><div class="pqdb-version-actions"><button type="button" class="btn-outline" onclick="openPqDbEdition('${escapeHtml(r.editionKey)}','${escapeHtml(area)}')">📋 Katalog</button><button type="button" class="btn-outline" onclick="openPqDbMetadataEdit('${escapeHtml(r.editionKey)}','${escapeHtml(area)}')">✏️ Metadata</button>${isActive?'':`<button type="button" class="btn-outline pqdb-active-btn" onclick="setPqDbActiveAreaRecord('${escapeHtml(r.editionKey)}','${escapeHtml(area)}')">✓ Aktif Yap</button>`}</div></article>`;
                }).join('')}</div></section>`;
            }).join('');
        }
        const detail=`<section class="pqdb-area-detail area-${escapeHtml(area.toLowerCase())}"><div class="pqdb-area-detail-head"><div class="pqdb-area-detail-title"><span class="pqdb-area-detail-icon">${m.icon}</span><div><div class="pqdb-area-detail-code">${escapeHtml(area)} <span>${escapeHtml(m.range)}</span></div><h4>${escapeHtml(m.name)}</h4></div></div><div class="pqdb-area-detail-actions"><button type="button" class="btn-outline" onclick="openPqDbAreaCatalog('${escapeHtml(area)}')" ${rows.length?'':'disabled'}>📋 Aktif Kataloğu Aç</button><button type="button" class="btn-outline" onclick="openPqDbAreaCompare('${escapeHtml(area)}')" ${rows.length>1?'':'disabled'}>🔀 Sürüm Kıyasla</button><button type="button" onclick="document.getElementById('pqDbDocxInput').click()">📄 Yeni DOCX</button></div></div>${rows.length?`<div class="pqdb-area-detail-summary"><span><b>${ctx.pqs.length}</b> Aktif PQ</span><span><b>${ctx.onSite}</b> On-site</span><span><b>${ctx.offSite}</b> Off-site</span><span><b>${ctx.ppq}</b> PPQ</span><span><b>${ctx.amendments.length}</b> Amendment</span><span><b>${rows.length}</b> Sürüm/revizyon kaydı</span></div>`:''}<div class="pqdb-area-detail-body">${detailBody}</div></section>`;
        grid.innerHTML=`<div class="pqdb-area-card-grid">${cards}</div>${detail}`;
    }
    function openPqDbEdition(key,area){setPqDbView('catalog');const sel=document.getElementById('pqDbCatalogEdition');if(sel)sel.value=key;pqDbCatalogEditionChanged(false);const areaSel=document.getElementById('pqDbCatalogArea');if(areaSel&&area&&[...areaSel.options].some(o=>o.value===area))areaSel.value=area;pqDbCatalogEditionChanged();}
    window.openPqDbEdition=openPqDbEdition;

    function setPqDbView(view){pqDbView=['versions','catalog','compare','linkage'].includes(view)?view:'versions';document.querySelectorAll('#pqDbModebar [data-pqdb-view]').forEach(b=>b.classList.toggle('active',b.dataset.pqdbView===pqDbView));['versions','catalog','compare','linkage'].forEach(v=>{const e=document.getElementById('pqDbView'+v.charAt(0).toUpperCase()+v.slice(1));if(e)e.classList.toggle('active',v===pqDbView);});if(view==='versions')renderPqDbVersions();if(view==='catalog')renderPqDbCatalog();if(view==='compare')renderPqDbComparison();if(view==='linkage')renderPqDbLinkage();}
    window.setPqDbView=setPqDbView;

    function populatePqDbSelectors(){
        const eds=pqDbEditionEntries();const fill=(id,opts,current)=>{const el=document.getElementById(id);if(!el)return;const prev=current||el.value;el.innerHTML=opts.map(o=>`<option value="${escapeHtml(o.value)}">${escapeHtml(o.label)}</option>`).join('');if(opts.some(o=>o.value===prev))el.value=prev;};
        fill('pqDbCatalogEdition',eds.map(e=>({value:e.key,label:pqDbEditionLabel(e)})));
        fill('pqDbCompareTarget',eds.map(e=>({value:e.key,label:pqDbEditionLabel(e)})));
        pqDbCatalogEditionChanged(false);pqDbCompareTargetChanged(false);
    }
    function pqDbCatalogEditionChanged(render=true){
        const eds=pqDbEditionEntries(),key=(document.getElementById('pqDbCatalogEdition')||{}).value||(eds[0]||{}).key||'',edition=((icaoPqLibrary.editions||{})[key])||{},areas=pqDbAreaEntries(edition);
        const a=document.getElementById('pqDbCatalogArea');
        if(a){const prev=a.value;a.innerHTML=areas.map(x=>`<option value="${escapeHtml(x.area)}">${escapeHtml(x.area)}</option>`).join('');if(areas.some(x=>x.area===prev))a.value=prev;}
        const selectedArea=(a&&a.value)||((areas[0]||{}).area)||'',areaData=((edition.areas||{})[selectedArea])||null;
        const controls=new Set(pqDbPqList(areaData).map(pqDbControlValue).filter(Boolean)),ce=document.getElementById('pqDbCatalogCe');
        if(ce){const prev=ce.value,isSsp=selectedArea==='SSP',label=ce.previousElementSibling;if(label)label.textContent=isSsp?'SSP Bileşeni':'CE';ce.innerHTML=`<option value="all">${isSsp?'Tüm SSP Bileşenleri':"Tüm CE'ler"}</option>`+[...controls].sort().map(x=>`<option>${escapeHtml(x)}</option>`).join('');if([...ce.options].some(o=>o.value===prev))ce.value=prev;}
        if(render)renderPqDbCatalog();
    }
    window.pqDbCatalogEditionChanged=pqDbCatalogEditionChanged;

    function renderPqDbCatalog(){
        const body=document.getElementById('pqDbCatalogBody');if(!body)return;const edKey=(document.getElementById('pqDbCatalogEdition')||{}).value,area=(document.getElementById('pqDbCatalogArea')||{}).value,edition=((icaoPqLibrary.editions||{})[edKey])||{},areaData=((edition.areas||{})[area])||null;
        if(!areaData){body.innerHTML='<tr><td colspan="5">Sürüm/alan seçiniz.</td></tr>';document.getElementById('pqDbCatalogCount').textContent='0 PQ';renderPqDbDetail(null,edKey,area);return;}
        const mode=(document.getElementById('pqDbCatalogMode')||{}).value||'all',ce=(document.getElementById('pqDbCatalogCe')||{}).value||'all',ppq=(document.getElementById('pqDbCatalogPpq')||{}).value||'all',q=((document.getElementById('pqDbCatalogSearch')||{}).value||'').toLocaleLowerCase('tr');
        const rows=pqDbPqList(areaData).filter(p=>(mode==='all'||p.assessmentMode===mode)&&(ce==='all'||pqDbControlValue(p)===ce)&&(ppq==='all'||(ppq==='yes'?p.ppq:!p.ppq))&&(!q||[p.pq,p.question,p.guidance,p.auditorNote,p.references,p.ce,p.sspComponent,p.changeDescription].join(' ').toLocaleLowerCase('tr').includes(q)));
        document.getElementById('pqDbCatalogCount').textContent=`${rows.length} PQ`;if(pqDbSelectedPq&&!rows.some(p=>p.pq===pqDbSelectedPq))pqDbSelectedPq='';
        body.innerHTML=rows.length?rows.map(p=>`<tr class="${pqDbSelectedPq===p.pq?'active':''}" onclick="selectPqDbPq('${escapeHtml(p.pq)}')"><td><b>${escapeHtml(p.pq)}</b></td><td>${escapeHtml(p.assessmentMode||'-')}</td><td>${escapeHtml(pqDbControlValue(p)||'-')}</td><td>${p.ppq?'Yes':'-'}</td><td>${p.changeType?`<span class="pqdb-badge ${pqDbChangeClass(p.changeType)}">${escapeHtml(p.changeType)}</span>`:'-'}</td></tr>`).join(''):'<tr><td colspan="5">Filtreye uygun PQ bulunamadı.</td></tr>';
        const selected=rows.find(p=>p.pq===pqDbSelectedPq)||rows[0]||null;if(selected&&!pqDbSelectedPq)pqDbSelectedPq=selected.pq;renderPqDbDetail(selected,edKey,area);
    }
    function selectPqDbPq(pq){pqDbSelectedPq=String(pq||'');renderPqDbCatalog();}
    window.selectPqDbPq=selectPqDbPq;
    function renderPqDbDetail(p,edKey,area){
        const el=document.getElementById('pqDbDetail'),tag=document.getElementById('pqDbDetailEdition'),edition=((icaoPqLibrary.editions||{})[edKey])||{},areaData=((edition.areas||{})[area])||{};
        if(tag)tag.textContent=`${pqDbEditionLabel(edition)} · ${area||'-'}`;if(!el)return;if(!p){el.innerHTML='<div class="pqdb-empty">Ayrıntı için bir PQ seçiniz.</div>';return;}
        const sd=areaData.sourceDocument||{},sourceAction=sd.downloadURL?`<a class="btn-outline pqdb-source-link" href="${escapeHtml(sd.downloadURL)}" target="_blank" rel="noopener">☁️ Kaynak DOCX</a>`:`<span class="smart-scope">Kaynak: ${escapeHtml(areaData.sourceFile||'-')}</span>`;
        el.innerHTML=`<div class="pqdb-detail"><div class="pqdb-detail-head"><div><h4>PQ ${escapeHtml(p.pq)}</h4><div class="visit-pq-ref-chips"><span class="visit-pq-ref-chip">${escapeHtml(p.assessmentMode||'-')}</span><span class="visit-pq-ref-chip">${escapeHtml(pqDbControlValue(p)||'-')}</span><span class="visit-pq-ref-chip">PPQ: ${p.ppq?'Yes':'No'}</span>${p.changeType?`<span class="pqdb-badge ${pqDbChangeClass(p.changeType)}">${escapeHtml(p.changeType)}</span>`:''}</div></div>${sourceAction}</div><div class="pqdb-detail-grid"><div class="pqdb-detail-item"><b>Alan</b><span>${escapeHtml(p.area||area||'-')}</span></div><div class="pqdb-detail-item"><b>On/Off-site</b><span>${escapeHtml(p.assessmentMode||'-')}</span></div><div class="pqdb-detail-item"><b>${escapeHtml(pqDbControlLabel(p))}</b><span>${escapeHtml(pqDbControlValue(p)||'-')}</span></div><div class="pqdb-detail-item"><b>PPQ</b><span>${p.ppq?'Yes':'No'}</span></div><div class="pqdb-detail-item"><b>PQ Concept</b><span class="pqdb-mono">${escapeHtml(p.conceptId||'-')}</span></div><div class="pqdb-detail-item"><b>PQ Instance</b><span class="pqdb-mono">${escapeHtml(p.instanceId||'-')}</span></div></div>${p.lineage?`<div class="pqdb-text-block lineage"><h5>🔗 Sürüm Lineage</h5><div>${escapeHtml([`İlişki: ${p.lineage.relation||'-'}`,(p.lineage.previousPqs||[]).length?`Önceki PQ: ${(p.lineage.previousPqs||[]).join(', ')}`:'',p.lineage.inheritedFromConceptId?`Concept devamı: ${p.lineage.inheritedFromConceptId}`:'',(p.lineage.parentConceptIds||[]).length?`Birleşen concept: ${(p.lineage.parentConceptIds||[]).join(', ')}`:''].filter(Boolean).join('\n'))}</div></div>`:''}<div class="pqdb-text-block"><h5>Protocol Question</h5><div>${escapeHtml(p.question||'-')}</div></div><div class="pqdb-text-block"><h5>Guidance for Review of Evidence</h5><div>${escapeHtml(p.guidance||'-')}</div></div>${p.auditorNote?`<div class="pqdb-text-block auditor"><h5>⚠️ Note(s) to the auditor</h5><div>${escapeHtml(p.auditorNote)}</div></div>`:''}<div class="pqdb-text-block"><h5>ICAO References</h5><div>${escapeHtml(p.references||'-')}</div></div>${p.changeType||p.changeDescription?`<div class="pqdb-text-block amendment"><h5>🔀 Summary of Amendments</h5><div>${escapeHtml([p.previousPq?`Önceki PQ: ${p.previousPq}`:'',p.changeType||'',p.changeDescription||''].filter(Boolean).join('\n'))}</div></div>`:''}</div>`;
    }

    function pqDbCompareTargetChanged(render=true){
        const eds=pqDbEditionEntries(),targetKey=(document.getElementById('pqDbCompareTarget')||{}).value||(eds[0]||{}).key||'',target=((icaoPqLibrary.editions||{})[targetKey])||{},areas=pqDbAreaEntries(target),areaSel=document.getElementById('pqDbCompareArea');if(areaSel){const prev=areaSel.value;areaSel.innerHTML=areas.map(a=>`<option value="${escapeHtml(a.area)}">${escapeHtml(a.area)}</option>`).join('');if(areas.some(a=>a.area===prev))areaSel.value=prev;}
        const area=(areaSel||{}).value||(areas[0]||{}).area||'',areaData=((target.areas||{})[area])||{},prevYear=(areaData.amendmentMeta||{}).previousYear;const base=document.getElementById('pqDbCompareBase');if(base){const old=base.value;let opts=[];if(prevYear)opts.push({value:`summary:${prevYear}`,label:`ICAO Summary of Amendments (${prevYear} → ${target.year||'?'})`});opts.push(...eds.filter(e=>e.key!==targetKey).map(e=>({value:e.key,label:pqDbEditionLabel(e)})));base.innerHTML=opts.map(o=>`<option value="${escapeHtml(o.value)}">${escapeHtml(o.label)}</option>`).join('');if(opts.some(o=>o.value===old))base.value=old;}
        if(render)renderPqDbComparison();
    }
    window.pqDbCompareTargetChanged=pqDbCompareTargetChanged;
    function renderPqDbComparison(){
        const body=document.getElementById('pqDbCompareBody');if(!body)return;const targetKey=(document.getElementById('pqDbCompareTarget')||{}).value,baseKey=(document.getElementById('pqDbCompareBase')||{}).value,area=(document.getElementById('pqDbCompareArea')||{}).value,target=((icaoPqLibrary.editions||{})[targetKey])||{},targetArea=((target.areas||{})[area])||null;let rows=[];
        if(targetArea&&String(baseKey||'').startsWith('summary:')){rows=pqDbAmendments(targetArea).map(a=>({...a,mode:(pqDbPqList(targetArea).find(p=>p.pq===a.newPq)||{}).assessmentMode||'',ce:pqDbControlValue(pqDbPqList(targetArea).find(p=>p.pq===a.newPq)||{})}));}
        else if(targetArea&&baseKey){const base=((icaoPqLibrary.editions||{})[baseKey])||{},baseArea=((base.areas||{})[area])||null;if(baseArea){const bmap=new Map(pqDbPqList(baseArea).map(p=>[p.pq,p])),tmap=new Map(pqDbPqList(targetArea).map(p=>[p.pq,p]));const keys=new Set([...bmap.keys(),...tmap.keys()]);for(const pq of [...keys].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}))){const b=bmap.get(pq),t=tmap.get(pq);if(!b){rows.push({oldPq:'',newPq:pq,type:'New',description:'PQ yeni sürümde eklendi.',mode:t.assessmentMode,ce:pqDbControlValue(t)});continue;}if(!t){rows.push({oldPq:pq,newPq:'',type:'Deleted',description:'PQ yeni sürümde bulunmuyor.',mode:b.assessmentMode,ce:pqDbControlValue(b)});continue;}const fields=[['Question','question'],['Guidance','guidance'],['Auditor note','auditorNote'],['References','references'],['PPQ','ppq'],['CE','ce'],['SSP Component','sspComponent'],['On/Off-site','assessmentMode']],changed=fields.filter(([,k])=>String(b[k]??'')!==String(t[k]??'')).map(([label])=>label);rows.push({oldPq:pq,newPq:pq,type:changed.length?'Revised':'No change',description:changed.length?`Değişen alanlar: ${changed.join(', ')}`:'İçerik değişikliği tespit edilmedi.',mode:t.assessmentMode,ce:pqDbControlValue(t)});}}}
        const counts={'New':0,'Revised':0,'Deleted':0,'Merged':0,'No change':0};rows.forEach(r=>{if(Object.prototype.hasOwnProperty.call(counts,r.type))counts[r.type]++;});[['pqDbChangeNew','New'],['pqDbChangeRevised','Revised'],['pqDbChangeDeleted','Deleted'],['pqDbChangeMerged','Merged'],['pqDbChangeNoChange','No change']].forEach(([id,k])=>{const e=document.getElementById(id);if(e)e.textContent=String(counts[k]||0);});const sum=document.getElementById('pqDbCompareSummary');if(sum)sum.textContent=targetArea?`${area} · ${rows.length} satır`:'Sürüm/alan seçiniz';body.innerHTML=rows.length?rows.map(r=>`<tr><td>${escapeHtml(r.oldPq||'-')}</td><td>${escapeHtml(r.newPq||'-')}</td><td><span class="pqdb-badge ${pqDbChangeClass(r.type)}">${escapeHtml(r.type||'-')}</span></td><td>${escapeHtml(r.mode||'-')}</td><td>${escapeHtml(r.ce||'-')}</td><td>${escapeHtml(r.description||'-')}</td></tr>`).join(''):'<tr><td colspan="6">Kıyaslama için uygun veri bulunamadı.</td></tr>';
    }

    let pqDbPendingImports=[];

    function pqDbEditionKey(meta){return pqDbSafeKey(`${String(meta.year||'').trim()}_R${pqDbNormalizeRevision(meta.revision)}`);}
    function pqDbExistingArea(editionKey,area){return (((icaoPqLibrary.editions||{})[editionKey]||{}).areas||{})[area]||null;}
    function pqDbImportSelectedItems(){
        return pqDbPendingImports.filter((item,i)=>{const cb=document.getElementById(`pqDbImportSelect_${i}`);return item.validation.valid&&(!cb||cb.checked);});
    }
    function closePqDbImportPreview(){const m=document.getElementById('pqDbImportModal');if(m)m.style.display='none';pqDbPendingImports=[];}
    window.closePqDbImportPreview=closePqDbImportPreview;

    function renderPqDbImportPreview(){
        const modal=document.getElementById('pqDbImportModal'),body=document.getElementById('pqDbImportBody'),summary=document.getElementById('pqDbImportSummary');
        if(!modal||!body)return;
        const valid=pqDbPendingImports.filter(x=>x.validation.valid).length,invalid=pqDbPendingImports.length-valid,replacements=pqDbPendingImports.filter(x=>x.existing).length,totalPqs=pqDbPendingImports.reduce((n,x)=>n+((x.validation.metrics||{}).pqCount||0),0);
        if(summary)summary.innerHTML=`<div><strong>${pqDbPendingImports.length}</strong><span>DOCX</span></div><div><strong>${valid}</strong><span>Geçerli</span></div><div><strong>${invalid}</strong><span>Hatalı</span></div><div><strong>${replacements}</strong><span>Güncelleme</span></div><div><strong>${totalPqs}</strong><span>PQ</span></div>`;
        body.innerHTML=pqDbPendingImports.map((item,i)=>{
            const p=item.parsed||{},meta=p.meta||{},v=item.validation||{errors:[],warnings:[],metrics:{}},x=v.metrics||{},sample=(p.pqs||[]).slice(0,5),active=meta.active!==false;
            const areaOptions=[...PQDB_AREAS,...(!PQDB_AREAS.includes(meta.area)&&meta.area?[meta.area]:[])].map(a=>`<option value="${escapeHtml(a)}" ${a===meta.area?'selected':''}>${escapeHtml(a)}</option>`).join('');
            return `<article class="pqdb-import-card ${v.valid?'valid':'invalid'}"><div class="pqdb-import-card-head"><label class="pqdb-import-select"><input id="pqDbImportSelect_${i}" type="checkbox" ${v.valid?'checked':'disabled'} onchange="updatePqDbImportSaveState()"><span></span></label><div><h4>${escapeHtml(item.file.name)}</h4><div class="pqdb-import-meta">Alan: ${escapeHtml(meta.area||'?')} · Sürüm: ${escapeHtml(meta.year||'?')} · ${escapeHtml(pqDbRevisionLabel(meta.revision))} ${item.existing?'<b class="pqdb-replace-tag">MEVCUT KAYIT GÜNCELLENECEK</b>':'<b class="pqdb-new-tag">YENİ KAYIT</b>'}</div></div><span class="${v.valid?'pqdb-valid-tag':'pqdb-error-tag'}">${v.valid?'✓ Doğrulandı':'✕ Düzeltme Gerekli'}</span></div>
                <div class="pqdb-import-meta-edit"><div><label>Denetim Alanı</label><select id="pqDbImportArea_${i}">${areaOptions}</select></div><div><label>Sürüm</label><input id="pqDbImportYear_${i}" type="text" value="${escapeHtml(meta.year||'')}" placeholder="2024"></div><div><label>Revizyon</label><input id="pqDbImportRevision_${i}" type="text" value="${escapeHtml(meta.revision||'')}" placeholder="2 / İlk Yayın"></div><div><label>Kaynak Belge Tarihi</label><input id="pqDbImportDate_${i}" type="date" value="${/^\d{4}-\d{2}-\d{2}$/.test(meta.publicationDate||'')?escapeHtml(meta.publicationDate):''}"></div><div class="wide"><label>Açıklama / Not</label><input id="pqDbImportNote_${i}" type="text" value="${escapeHtml(meta.note||'')}" placeholder="İsteğe bağlı not"></div><label class="pqdb-import-active"><input id="pqDbImportActive_${i}" type="checkbox" ${active?'checked':''}> Bu alanın aktif kaydı</label><button type="button" class="btn-outline" onclick="revalidatePqDbPendingImport(${i})">↻ Bilgileri Uygula / Yeniden Doğrula</button></div>
                <div class="pqdb-import-metrics"><span><b>${x.pqCount||0}</b> PQ</span><span><b>${x.onSite||0}</b> On-site</span><span><b>${x.offSite||0}</b> Off-site</span><span><b>${x.ppq||0}</b> PPQ</span><span><b>${x.auditorNotes||0}</b> Auditor note</span><span><b>${x.amendments||0}</b> Amendment</span></div>${v.errors.length?`<div class="pqdb-import-messages error">${v.errors.map(e=>`<div>⛔ ${escapeHtml(e)}</div>`).join('')}</div>`:''}${v.warnings.length?`<div class="pqdb-import-messages warn">${v.warnings.map(e=>`<div>⚠️ ${escapeHtml(e)}</div>`).join('')}</div>`:''}<details class="pqdb-import-sample"><summary>Örnek PQ kayıtlarını göster</summary><table><thead><tr><th>PQ</th><th>Tür</th><th>CE / SSP Bileşeni</th><th>PPQ</th><th>Protocol Question</th></tr></thead><tbody>${sample.map(q=>`<tr><td>${escapeHtml(q.pq)}</td><td>${escapeHtml(q.assessmentMode)}</td><td>${escapeHtml(pqDbControlValue(q)||'-')}</td><td>${q.ppq?'Yes':'-'}</td><td>${escapeHtml(q.question||'-')}</td></tr>`).join('')}</tbody></table></details></article>`;
        }).join('');
        modal.style.display='flex';updatePqDbImportSaveState();
    }
    function syncPqDbPendingMetadataFromInputs(i){const item=pqDbPendingImports[i];if(!item||!item.parsed)return item;const meta=item.parsed.meta||(item.parsed.meta={});const read=id=>((document.getElementById(id)||{}).value||'').trim();meta.area=read(`pqDbImportArea_${i}`).toUpperCase();meta.year=read(`pqDbImportYear_${i}`);meta.revision=pqDbNormalizeRevision(read(`pqDbImportRevision_${i}`));meta.publicationDate=read(`pqDbImportDate_${i}`);meta.note=read(`pqDbImportNote_${i}`);meta.active=!!((document.getElementById(`pqDbImportActive_${i}`)||{}).checked);item.validation=window.PQDocxParser.validate(item.parsed);item.editionKey=pqDbEditionKey(meta);item.existing=pqDbExistingArea(item.editionKey,meta.area);const cb=document.getElementById(`pqDbImportSelect_${i}`);if(cb){if(item.validation.valid&&cb.disabled){cb.disabled=false;cb.checked=true;}else if(!item.validation.valid){cb.checked=false;cb.disabled=true;}}return item;}
    function revalidatePqDbPendingImport(i){syncPqDbPendingMetadataFromInputs(i);renderPqDbImportPreview();}
    window.revalidatePqDbPendingImport=revalidatePqDbPendingImport;
    function updatePqDbImportSaveState(){const btn=document.getElementById('pqDbImportSaveBtn'),selected=pqDbImportSelectedItems();if(btn){btn.disabled=!selected.length;btn.textContent=selected.length?`☁️ Firebase’e Kaydet (${selected.length})`:'☁️ Firebase’e Kaydet';}}
    window.updatePqDbImportSaveState=updatePqDbImportSaveState;

    async function prepareIcaoPqDocuments(event){
        const files=Array.from((event&&event.target&&event.target.files)||[]);if(!files.length)return;
        const note=document.getElementById('pqDbSyncNote');showLoading('ICAO PQ dokümanları analiz ediliyor...',`${files.length} dosya seçildi.`);
        pqDbPendingImports=[];
        try{
            if(!window.PQDocxParser)throw new Error('PQ DOCX parser modülü yüklenemedi.');
            for(const file of files){
                if(note)note.textContent=`Analiz ediliyor: ${file.name}`;
                try{
                    const parsed=await window.PQDocxParser.parseFile(file);parsed.meta=parsed.meta||{};parsed.meta.revision=pqDbNormalizeRevision(parsed.meta.revision);parsed.meta.active=true;parsed.meta.note=parsed.meta.note||'';const validation=window.PQDocxParser.validate(parsed),editionKey=pqDbEditionKey(parsed.meta),existing=pqDbExistingArea(editionKey,parsed.meta.area);
                    pqDbPendingImports.push({file,parsed,validation,editionKey,existing});
                }catch(err){pqDbPendingImports.push({file,parsed:null,validation:{valid:false,errors:[String(err.message||err)],warnings:[],metrics:{}},editionKey:'',existing:null});}
            }
            renderPqDbImportPreview();
            if(note)note.textContent='DOCX analizi tamamlandı. Firebase kaydından önce önizlemeyi kontrol edin.';
        }finally{hideLoading();if(event&&event.target)event.target.value='';}
    }
    window.prepareIcaoPqDocuments=prepareIcaoPqDocuments;
    window.importIcaoPqDocuments=prepareIcaoPqDocuments;

    async function commitPqDbPendingImports(){
        pqDbPendingImports.forEach((_,i)=>syncPqDbPendingMetadataFromInputs(i));
        const selected=pqDbImportSelectedItems();if(!selected.length)return;
        if(!window.PQRepository)return alert('PQ repository servisi yüklenemedi.');
        try{if(!navigator.onLine)return alert('Firebase kaydı için çevrim içi bağlantı gerekir.');}catch(_){ }
        try{if(!firebase.auth().currentUser)return alert('Firebase kaydı için yetkili kullanıcı girişi gerekir.');}catch(_){return alert('Firebase oturumu doğrulanamadı.');}
        const replacements=selected.filter(x=>x.existing);if(replacements.length&&!confirm(`${replacements.length} alan/sürüm kaydı mevcut. Seçilen DOCX verileriyle güncellensin mi?`))return;
        const note=document.getElementById('pqDbSyncNote');showLoading('PQ verileri Firebase’e kaydediliyor...',`${selected.length} doküman işlenecek.`);
        let done=0,storageWarnings=[];
        try{
            for(const item of selected){
                if(note)note.textContent=`Firebase’e kaydediliyor: ${item.file.name}`;
                const result=await window.PQRepository.saveParsedDocument({
                    file:item.file,
                    parsed:item.parsed,
                    editionKey:item.editionKey,
                    overwrite:!!item.existing,
                    onProgress:progress=>{
                        const msg=progress&&progress.message?progress.message:'Firebase işlemi sürüyor…';
                        if(note)note.textContent=`${item.file.name} · ${msg}`;
                        try{showLoading('PQ verileri Firebase’e kaydediliyor...',`${done+1}/${selected.length} · ${msg}`);}catch(_){}
                    }
                });done++;
                if(result.sourceDocument&&!['stored','external-planned'].includes(result.sourceDocument.status))storageWarnings.push(`${item.file.name}: kaynak DOCX arşivlenemedi (${result.sourceDocument.status}${result.sourceDocument.error?` – ${result.sourceDocument.error}`:''}).`);
                if(!pqDbActiveEdition())localStorage.setItem(PQDB_ACTIVE_EDITION_KEY,item.editionKey);
            }
            closePqDbImportPreview();pqDbLoaded=false;await loadIcaoPqLibrary(true);setPqDbView('versions');
            if(note)note.textContent=storageWarnings.length?`${done} PQ dokümanı Firebase Realtime Database'e kaydedildi. ${storageWarnings.length} kaynak DOCX arşiv uyarısı var.`:`${done} PQ dokümanı Firebase Realtime Database'e kaydedildi. Kaynak DOCX arşivi Firebase Storage kullanmadan harici/Google Drive entegrasyonu için hazırlandı.`;
            if(storageWarnings.length)console.warn('PQ Storage uyarıları',storageWarnings);
            showAppRuntimeToast(`${done} ICAO PQ dokümanı Firebase'e kaydedildi.`,'success');
        }catch(err){console.error(err);alert('PQ verisi Firebase’e kaydedilemedi: '+(err.message||err));if(note)note.textContent='Firebase kayıt hatası: '+(err.message||err);}
        finally{hideLoading();}
    }
    window.commitPqDbPendingImports=commitPqDbPendingImports;

    function openPqDbMetadataEdit(editionKey,area){
        const edition=((icaoPqLibrary.editions||{})[editionKey])||{},rec=((edition.areas||{})[area])||null;if(!rec)return alert('PQ sürüm kaydı bulunamadı.');
        const active=pqDbActiveAreaRecord(area),isActive=!!(active&&active.editionKey===editionKey);
        const val=(id,v)=>{const el=document.getElementById(id);if(el)el.value=v??'';};
        val('pqDbMetadataSourceEdition',editionKey);val('pqDbMetadataSourceArea',area);val('pqDbMetadataArea',area);val('pqDbMetadataVersion',edition.year||rec.year||'');val('pqDbMetadataRevision',String(edition.revision??rec.revision??''));val('pqDbMetadataPublicationDate',/^\d{4}-\d{2}-\d{2}$/.test(rec.publicationDate||'')?rec.publicationDate:'');val('pqDbMetadataNote',rec.note||'');
        const ck=document.getElementById('pqDbMetadataActive');if(ck)ck.checked=isActive;const file=document.getElementById('pqDbMetadataEditFile');if(file)file.textContent=rec.sourceFile||'';const info=document.getElementById('pqDbMetadataEditInfo');if(info)info.innerHTML=`PQ: <b>${pqDbPqList(rec).length}</b> · Kaynak: <b>${escapeHtml(rec.sourceFile||'-')}</b><br>Sürüm veya alan değişirse kayıt PQ içerikleri korunarak Firebase'de yeni konuma taşınır.`;const modal=document.getElementById('pqDbMetadataEditModal');if(modal)modal.style.display='block';
    }
    window.openPqDbMetadataEdit=openPqDbMetadataEdit;
    function closePqDbMetadataEditModal(){const m=document.getElementById('pqDbMetadataEditModal');if(m)m.style.display='none';}
    window.closePqDbMetadataEditModal=closePqDbMetadataEditModal;
    async function savePqDbMetadataEdit(){
        if(!window.PQRepository||typeof window.PQRepository.updateMetadata!=='function')return alert('PQ repository metadata güncelleme servisi yüklenemedi.');
        const read=id=>((document.getElementById(id)||{}).value||'').trim(),sourceEditionKey=read('pqDbMetadataSourceEdition'),sourceArea=read('pqDbMetadataSourceArea'),area=read('pqDbMetadataArea').toUpperCase(),year=read('pqDbMetadataVersion'),revision=pqDbNormalizeRevision(read('pqDbMetadataRevision')),publicationDate=read('pqDbMetadataPublicationDate'),note=read('pqDbMetadataNote'),active=!!((document.getElementById('pqDbMetadataActive')||{}).checked);
        if(!PQDB_AREAS.includes(area))return alert('Denetim alanı LEG, ORG, PEL, OPS, AIR, AIG, ANS veya AGA olmalıdır.');if(!/^20\d{2}$/.test(year))return alert('Sürüm 4 haneli yıl olarak girilmelidir. Örn: 2024');
        try{showLoading('PQ sürüm/revizyon bilgileri güncelleniyor...',`${sourceArea} → ${area}`);await window.PQRepository.updateMetadata({sourceEditionKey,sourceArea,meta:{area,year,revision,publicationDate,note,active}});if(window.PQRepository.rebuildLinkageIndex)await window.PQRepository.rebuildLinkageIndex({onProgress:p=>{try{setLoadingMessage('PQ lineage indeksi güncelleniyor...',p.message||'');}catch(_){}}});closePqDbMetadataEditModal();pqDbLoaded=false;await loadIcaoPqLibrary(true);setPqDbView('versions');showAppRuntimeToast('PQ sürüm/revizyon bilgileri ve kalıcı bağlantılar Firebase’de güncellendi.','success');}catch(err){console.error(err);alert('PQ sürüm/revizyon bilgileri güncellenemedi: '+(err.message||err));}finally{hideLoading();}
    }
    window.savePqDbMetadataEdit=savePqDbMetadataEdit;
    async function setPqDbActiveAreaRecord(editionKey,area){
        if(!window.PQRepository||typeof window.PQRepository.setActiveAreaRecord!=='function')return alert('Aktif PQ sürümü servisi yüklenemedi.');
        try{showLoading('Aktif PQ referansı güncelleniyor...',`${area} · ${editionKey}`);await window.PQRepository.setActiveAreaRecord({editionKey,area});if(window.PQRepository.rebuildLinkageIndex)await window.PQRepository.rebuildLinkageIndex({onProgress:p=>{try{setLoadingMessage('Aktif PQ lineage indeksi güncelleniyor...',p.message||'');}catch(_){}}});pqDbLoaded=false;await loadIcaoPqLibrary(true);showAppRuntimeToast(`${area} için aktif PQ sürümü ve CAP↔PQ bağlantıları güncellendi.`,'success');}catch(err){console.error(err);alert('Aktif PQ sürümü güncellenemedi: '+(err.message||err));}finally{hideLoading();}
    }
    window.setPqDbActiveAreaRecord=setPqDbActiveAreaRecord;

    function pqDbUniqueCapPqs(){
        const map=new Map();for(const r of rawData||[]){if(!r||!r.pq)continue;const m=(pqMasterData||{})[r.pq]||{},area=normalizeAreaKey(m.alan||r.area||'')||'-';const key=`${area}|${r.pq}`;if(!map.has(key))map.set(key,{pq:r.pq,area,link:r.pqLink||m.pqLink||null,master:m});}return [...map.values()].sort((a,b)=>String(a.area).localeCompare(String(b.area))||String(a.pq).localeCompare(String(b.pq),undefined,{numeric:true}));
    }
    function renderPqDbLinkage(){
        const body=document.getElementById('pqDbLinkageBody');if(!body)return;const rows=pqDbUniqueCapPqs(),summary=window.PQLinkage?window.PQLinkage.linkageSummary(rawData||[]):{pqCount:rows.length,linked:0,unmatched:rows.length,ambiguous:0,renumbered:0};
        const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=String(v||0);};set('pqDbLinkPqCount',summary.pqCount);set('pqDbLinkLinked',summary.linked);set('pqDbLinkRenumbered',summary.renumbered);set('pqDbLinkUnmatched',summary.unmatched);set('pqDbLinkAmbiguous',summary.ambiguous);
        const meta=document.getElementById('pqDbLinkageMeta');if(meta){const lm=icaoPqLibrary.linkageMeta||{};meta.textContent=lm.generatedAt?`PQ lineage şeması v${lm.schemaVersion||1} · ${lm.conceptCount||Object.keys(icaoPqLibrary.concepts||{}).length} concept · ${lm.instanceCount||0} instance · Son üretim: ${new Date(lm.generatedAt).toLocaleString('tr-TR')}`:'PQ lineage indeksi henüz oluşturulmadı.';}
        body.innerHTML=rows.length?rows.map(x=>{const l=x.link||{},src=l.sourcePqRef||{},cur=l.currentPqRef||{},status=l.status||'unmatched',cls=status==='linked'?'ok':status==='ambiguous'?'warn':'danger';return `<tr><td><b>${escapeHtml(x.area)}</b></td><td><b>PQ ${escapeHtml(x.pq)}</b></td><td><span class="pqdb-link-status ${cls}">${escapeHtml(status)}</span></td><td>${src.pq?`${escapeHtml(src.year||'?')} / ${escapeHtml(src.revision||'0')} · PQ ${escapeHtml(src.pq)}`:'-'}</td><td>${cur.pq?`${escapeHtml(cur.year||'?')} / ${escapeHtml(cur.revision||'0')} · PQ ${escapeHtml(cur.pq)}${l.renumbered?' <b class="pqdb-renumbered">NUMARA DEĞİŞTİ</b>':''}`:'-'}</td><td class="pqdb-mono">${escapeHtml(l.pqConceptId||'-')}</td><td>${escapeHtml(l.reason||l.relation||'-')}</td></tr>`;}).join(''):'<tr><td colspan="7">CAP/PQ verisi yok veya henüz bağlantı kurulmadı.</td></tr>';
    }
    window.renderPqDbLinkage=renderPqDbLinkage;
    async function rebuildPqLinkageIndex(){
        if(!window.PQRepository||typeof window.PQRepository.rebuildLinkageIndex!=='function')return alert('PQ linkage repository servisi yüklenemedi.');
        try{showLoading('CAP ↔ PQ bağlantı indeksi oluşturuluyor...','Tüm PQ sürümleri ve amendment kayıtları işleniyor.');const result=await window.PQRepository.rebuildLinkageIndex({onProgress:p=>{try{setLoadingMessage('CAP ↔ PQ bağlantı indeksi oluşturuluyor...',p.message||'');}catch(_){}}});icaoPqLibrary=pqDbNormalizeLibrary(result.library);refreshCapPqLinkage({persist:true,silent:true});renderIcaoPqLibraryModule();showAppRuntimeToast(`${result.pqCount} PQ instance / ${result.conceptCount} concept bağlantısı güncellendi.`,'success');}catch(err){console.error(err);alert('PQ bağlantı indeksi oluşturulamadı: '+(err.message||err));}finally{hideLoading();}
    }
    window.rebuildPqLinkageIndex=rebuildPqLinkageIndex;

    function renderIcaoPqLibraryModule(){if(!pqDbLoaded){loadIcaoPqLibrary();return;}renderPqDbKpis();renderPqDbVersions();populatePqDbSelectors();if(pqDbView==='catalog')renderPqDbCatalog();if(pqDbView==='compare')renderPqDbComparison();if(pqDbView==='linkage')renderPqDbLinkage();}
    window.renderIcaoPqLibraryModule=renderIcaoPqLibraryModule;

    function pqDbFindInstanceById(instanceId){
        if(!instanceId)return null;for(const e of pqDbEditionEntries())for(const a of pqDbAreaEntries(e))for(const p of pqDbPqList(a))if(String(p.instanceId||'')===String(instanceId))return{edition:e,areaData:a,pq:p};return null;
    }
    function refreshCapPqLinkage(options={}){
        if(!window.PQLinkage||typeof window.PQLinkage.linkCapData!=='function'||!icaoPqLibrary)return null;
        const result=window.PQLinkage.linkCapData(rawData,pqMasterData,icaoPqLibrary);window.currentCapPqLinkageSummary=result;
        if(options.persist!==false){try{saveToLocalStorage();}catch(_){}}
        if(!options.silent&&typeof showAppRuntimeToast==='function')showAppRuntimeToast(`CAP↔PQ: ${result.linked} bağlı · ${result.unmatched} eşleşmeyen · ${result.renumbered} numarası değişen`,'success');
        renderPqDbLinkage();return result;
    }
    window.refreshCapPqLinkage=refreshCapPqLinkage;

    function findPqLibraryReference(pq,area){
        pq=normalizePQ(pq||'');area=normalizeAreaKey(area||'');if(!pq)return null;
        if(window.PQLinkage&&area){
            const master=(pqMasterData||{})[pq]||{},link=window.PQLinkage.resolveCapReference(icaoPqLibrary,pq,area,master.pqLink||null);
            if(link&&link.currentPqRef&&link.currentPqRef.instanceId){const hit=pqDbFindInstanceById(link.currentPqRef.instanceId);if(hit)return{...hit,linkage:link,sourceRef:link.sourcePqRef||null};}
        }
        const eds=pqDbEditionEntries();let ordered=eds;if(area){const active=pqDbActiveAreaRecord(area);if(active)ordered=[...eds.filter(e=>e.key===active.editionKey),...eds.filter(e=>e.key!==active.editionKey)];}else{const legacy=pqDbActiveEdition();if(legacy)ordered=[...eds.filter(e=>e.key===legacy),...eds.filter(e=>e.key!==legacy)];}for(const e of ordered){const areas=pqDbAreaEntries(e).filter(a=>!area||a.area===area);for(const a of areas){const rec=(a.pqs||{})[pqDbSafeKey(pq)]||pqDbPqList(a).find(x=>x.pq===pq);if(rec)return{edition:e,areaData:a,pq:rec};}}return null;
    }
    function renderVisitPqReferenceHtml(pq,area,contextFinding){const ref=findPqLibraryReference(pq,area);if(!ref)return `<div class="pqdb-empty">PQ ${escapeHtml(pq||'-')} için PQ Veri Tabanında eşleşen resmî ICAO sürümü bulunamadı.<br><br><button type="button" onclick="switchTab('pq-library');setPqDbView('versions')">📚 PQ Veri Tabanını Aç</button></div>`;const p=ref.pq,e=ref.edition,a=ref.areaData,m=pqMasterData[pq]||pqMasterData[p.pq]||{},link=ref.linkage||null,lineageBanner=link&&link.renumbered?`<div class="pqdb-lineage-banner">🔗 CAP PQ <b>${escapeHtml(pq)}</b> → aktif sürümde <b>PQ ${escapeHtml((link.currentPqRef||{}).pq||p.pq)}</b><span>${escapeHtml(link.pqConceptId||'')}</span></div>`:(link?`<div class="pqdb-lineage-banner neutral">🔗 Kalıcı PQ Concept: <b>${escapeHtml(link.pqConceptId||p.conceptId||'-')}</b></div>`:'');return `${lineageBanner}<div class="visit-pq-ref-head"><div><div class="visit-pq-ref-title">PQ ${escapeHtml(p.pq)} · ${escapeHtml(p.area||a.area||'-')}</div><div class="visit-pq-ref-chips"><span class="visit-pq-ref-chip">${escapeHtml(pqDbEditionLabel(e))}</span><span class="visit-pq-ref-chip">${escapeHtml(p.assessmentMode||'-')}</span><span class="visit-pq-ref-chip">${escapeHtml(pqDbControlValue(p)||'-')}</span><span class="visit-pq-ref-chip">PPQ: ${p.ppq?'Yes':'No'}</span>${p.changeType?`<span class="pqdb-badge ${pqDbChangeClass(p.changeType)}">${escapeHtml(p.changeType)}</span>`:''}</div></div><button type="button" class="btn-outline" onclick="openPqDbEdition('${escapeHtml(e.key)}');setTimeout(()=>{const a=document.getElementById('pqDbCatalogArea');if(a)a.value='${escapeHtml(a.area)}';pqDbSelectedPq='${escapeHtml(p.pq)}';renderPqDbCatalog();},0)">Veri tabanında aç</button></div><div class="visit-pq-ref-block"><h5>Protocol Question (ICAO)</h5><div class="body">${escapeHtml(p.question||'-')}</div>${m.soruTr?`<div class="body" style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border)"><b>TR:</b> ${escapeHtml(m.soruTr)}</div>`:''}</div><div class="visit-pq-ref-block"><h5>Guidance for Review of Evidence</h5><div class="body">${escapeHtml(p.guidance||'-')}</div></div>${p.auditorNote?`<div class="visit-pq-ref-block note"><h5>⚠️ Note(s) to the auditor</h5><div class="body">${escapeHtml(p.auditorNote)}</div></div>`:''}<div class="visit-pq-ref-block"><h5>ICAO References</h5><div class="body">${escapeHtml(p.references||'-')}</div></div>${p.changeType||p.changeDescription?`<div class="visit-pq-ref-block change"><h5>🔀 Sürüm Değişikliği</h5><div class="body">${escapeHtml([p.previousPq?`Önceki PQ: ${p.previousPq}`:'',p.changeType||'',p.changeDescription||''].filter(Boolean).join('\n'))}</div></div>`:''}${contextFinding||m.bulgu?`<div class="visit-pq-ref-block"><h5>Türkiye / mevcut CAP bulgusu</h5><div class="body">${escapeHtml(contextFinding||m.bulgu||'-')}</div>${m.bulguTr?`<div class="body" style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border)"><b>TR:</b> ${escapeHtml(m.bulguTr)}</div>`:''}</div>`:''}`;}
    function renderIcaoPqReferencePanel(){const el=document.getElementById('icaoPqReferencePanel');if(!el)return;const visit=getActiveIcaoOfficialVisitRecord?getActiveIcaoOfficialVisitRecord():null,pq=activeIcaoValidationPq;if(!pq){el.innerHTML='<div class="icao-visit-empty">PQ referansı için soldan bir PQ seçiniz.</div>';return;}const scope=visit?getIcaoVisitScopePqs(visit).find(x=>String(x.pq)===String(pq)):null,m=pqMasterData[pq]||{};el.innerHTML=renderVisitPqReferenceHtml(pq,(scope&&scope.area)||m.alan,(scope&&scope.finding)||m.bulgu||'');}
    window.renderIcaoPqReferencePanel=renderIcaoPqReferencePanel;
    function renderVisitWorkspacePqReference(){const el=document.getElementById('visitWorkspacePqReferencePanel');if(!el)return;const t=activeVisitWorkspaceTarget||{},pq=t.pq||(t.snapshot||{}).pq||'';if(!pq){el.innerHTML='<div class="visit-work-empty">PQ referansı için soldan bir PQ veya CAP adımı seçiniz. “Ziyaret geneli” hedefinde PQ referansı gösterilmez.</div>';return;}const m=pqMasterData[pq]||{},snap=t.snapshot||{};el.innerHTML=renderVisitPqReferenceHtml(pq,snap.area||m.alan,snap.finding||m.bulgu||'');}
    window.renderVisitWorkspacePqReference=renderVisitWorkspacePqReference;

    function exportIcaoPqLibraryExcel(){const eds=pqDbEditionEntries();if(!eds.length)return alert('Dışa aktarılacak PQ sürümü bulunmuyor.');const wb=XLSX.utils.book_new(),versionRows=[],pqRows=[],amRows=[];eds.forEach(e=>pqDbAreaEntries(e).forEach(a=>{versionRows.push({'Sürüm':pqDbEditionLabel(e),'Edition Key':e.key,'Yıl':e.year,'Revision':e.revision,'Alan':a.area,'Yayın':a.publicationDate||'','Kaynak Dosya':a.sourceFile||'','PQ Sayısı':pqDbPqList(a).length,'On-site':pqDbPqList(a).filter(p=>p.onSite).length,'Off-site':pqDbPqList(a).filter(p=>!p.onSite).length,'PPQ':pqDbPqList(a).filter(p=>p.ppq).length,'Auditor Note':pqDbPqList(a).filter(p=>p.auditorNote).length});pqDbPqList(a).forEach(p=>pqRows.push({'Sürüm':pqDbEditionLabel(e),'Alan':a.area,'PQ No':p.pq,'PQ Concept ID':p.conceptId||'','PQ Instance ID':p.instanceId||'','Lineage İlişkisi':(p.lineage||{}).relation||'','Önceki Instance':((p.lineage||{}).previousInstanceIds||[]).join(', '),'Parent Concept':((p.lineage||{}).parentConceptIds||[]).join(', '),'Protocol Question':p.question,'Guidance for Review of Evidence':p.guidance,'Note(s) to the auditor':p.auditorNote,'ICAO References':p.references,'PPQ':p.ppq?'Yes':'No','CE':p.ce||'','SSP Component':p.sspComponent||'','Değerlendirme Türü':p.assessmentMode,'Önceki PQ':p.previousPq||'','Değişiklik Türü':p.changeType||'','Değişiklik Açıklaması':p.changeDescription||''}));pqDbAmendments(a).forEach(x=>amRows.push({'Sürüm':pqDbEditionLabel(e),'Alan':a.area,'Önceki Sürüm':(a.amendmentMeta||{}).previousYear||'','Önceki PQ':x.oldPq||'','Yeni PQ':x.newPq||'','Değişiklik Türü':x.type||'','Açıklama':x.description||''}));}));XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(versionRows),'Sürümler');XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(pqRows),'PQ Kataloğu');XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(amRows),'Amendments');XLSX.writeFile(wb,'ICAO_PQ_Surum_Veritabani.xlsx');}
    window.exportIcaoPqLibraryExcel=exportIcaoPqLibraryExcel;

    // UI ilk durumları: eski ekran davranışını bozmadan yeni alt menüleri hazırla.
    document.addEventListener('DOMContentLoaded',()=>{setTimeout(()=>{setIcaoVisitWorkspaceMode('validation');setVisitWorkspaceMode('fieldwork');},0);});
