// ICAO PQ veri tabanı, DOCX parser ve sürüm yönetimi modülü
// ===== Ziyaret çalışma merkezi + ICAO PQ sürüm veri tabanı =====
    let icaoOfficialWorkspaceMode='validation';
    let visitWorkspaceMode='fieldwork';
    let icaoPqLibrary={editions:{}};
    let pqDbView='versions';
    let pqDbSelectedPq='';
    let pqDbLoaded=false;
    const PQDB_STORAGE_KEY='icao_pq_library_v1';
    const PQDB_ACTIVE_EDITION_KEY='icao_pq_library_active_edition';

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
        const lib=raw&&typeof raw==='object'?raw:{editions:{}};if(!lib.editions||typeof lib.editions!=='object')lib.editions={};return lib;
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
    function setPqDbActiveEdition(key){if(key)localStorage.setItem(PQDB_ACTIVE_EDITION_KEY,key);else localStorage.removeItem(PQDB_ACTIVE_EDITION_KEY);renderPqDbVersions();renderPqDbKpis();showAppRuntimeToast(key?`Aktif PQ referans sürümü: ${key}`:'Aktif PQ sürümü temizlendi.','success');}
    window.setPqDbActiveEdition=setPqDbActiveEdition;

    async function loadIcaoPqLibrary(force=false){
        if(pqDbLoaded&&!force){renderIcaoPqLibraryModule();return icaoPqLibrary;}
        const note=document.getElementById('pqDbSyncNote');if(note)note.textContent='PQ veri tabanı okunuyor...';
        try{
            if(!window.PQRepository)throw new Error('PQ repository servisi yüklenemedi.');
            const result=await window.PQRepository.load();
            icaoPqLibrary=pqDbNormalizeLibrary(result.library);
            if(pqDbRemoveLegacyEmbeddedSeed(icaoPqLibrary))pqDbSaveLocal();
            if(note)note.textContent=result.message||'PQ veri tabanı hazır.';
        }catch(err){
            console.warn('PQ DB load',err);
            let local=null;try{local=JSON.parse(localStorage.getItem(PQDB_STORAGE_KEY)||'null');}catch(e){}
            icaoPqLibrary=pqDbNormalizeLibrary(local||{editions:{}});
            if(note)note.textContent='PQ veri tabanı yüklenemedi; yerel cache kullanılıyor. '+(err.message||err);
        }
        pqDbLoaded=true;renderPqDbKpis();renderPqDbVersions();populatePqDbSelectors();renderPqDbCatalog();renderPqDbComparison();return icaoPqLibrary;
    }
    window.loadIcaoPqLibrary=loadIcaoPqLibrary;

    function pqDbEditionEntries(){
        return Object.entries((icaoPqLibrary&&icaoPqLibrary.editions)||{}).map(([key,v])=>({key,...(v||{})})).sort((a,b)=>{const ay=Number(a.year||0),by=Number(b.year||0);if(by!==ay)return by-ay;return Number(b.revision||0)-Number(a.revision||0);});
    }
    function pqDbAreaEntries(edition){return Object.entries((edition&&edition.areas)||{}).map(([area,v])=>({area,...(v||{})})).sort((a,b)=>a.area.localeCompare(b.area));}
    function pqDbPqList(areaData){return Object.values((areaData&&areaData.pqs)||{}).filter(Boolean).sort((a,b)=>String(a.pq||'').localeCompare(String(b.pq||''),undefined,{numeric:true}));}
    function pqDbAmendments(areaData){return Object.values((areaData&&areaData.amendments)||{}).filter(Boolean);}
    function pqDbEditionLabel(e){return e?`${e.year||'?'} Edition${String(e.revision||'').trim()?` · Revision ${e.revision}`:''}`:'-';}
    function pqDbChangeClass(v){const x=String(v||'').toLowerCase();if(x==='no change')return'no-change';return x.replace(/\s+/g,'-');}

    function renderPqDbKpis(){
        const eds=pqDbEditionEntries(),areas=eds.flatMap(e=>pqDbAreaEntries(e)),pqs=areas.flatMap(a=>pqDbPqList(a)),changes=areas.flatMap(a=>pqDbAmendments(a));
        const vals={pqDbKpiEditions:eds.length,pqDbKpiAreas:areas.length,pqDbKpiPqs:pqs.length,pqDbKpiOnsite:pqs.filter(p=>p.assessmentMode==='On-site').length,pqDbKpiPpq:pqs.filter(p=>p.ppq).length,pqDbKpiChanges:changes.length};Object.entries(vals).forEach(([id,v])=>{const e=document.getElementById(id);if(e)e.textContent=String(v);});
    }
    function renderPqDbVersions(){
        const grid=document.getElementById('pqDbVersionGrid');if(!grid)return;const eds=pqDbEditionEntries(),active=pqDbActiveEdition();
        if(!eds.length){grid.innerHTML='<div class="pqdb-empty">Henüz ICAO PQ sürümü yüklenmedi. “ICAO PQ DOCX Yükle” ile ilk dokümanı ekleyebilirsiniz.</div>';return;}
        grid.innerHTML=eds.map(e=>{
            const areas=pqDbAreaEntries(e),pqCount=areas.reduce((n,a)=>n+pqDbPqList(a).length,0),changeCount=areas.reduce((n,a)=>n+pqDbAmendments(a).length,0),sourceDates=[...new Set(areas.map(a=>a.publicationDate).filter(Boolean))];
            const areaChips=areas.map(a=>{const sd=a.sourceDocument||{},cloud=sd.status==='stored'?'☁️':sd.status&&sd.status!=='stored'?'⚠️':'🗄️';return `<span class="pqdb-area-chip" title="${escapeHtml(a.sourceFile||'Kaynak dosya bilgisi yok')}">${escapeHtml(a.area)} · ${pqDbPqList(a).length} PQ · ${cloud}</span>`;}).join('');
            return `<article class="pqdb-version-card ${active===e.key?'active-edition':''}"><div><h4>${escapeHtml(pqDbEditionLabel(e))}</h4><div class="pqdb-version-meta">${pqCount} PQ · ${areas.length} alan · ${changeCount} amendment satırı${sourceDates.length?` · ${escapeHtml(sourceDates.join(', '))}`:''}</div></div><div class="pqdb-area-chips">${areaChips}</div><div class="pqdb-version-actions"><button type="button" class="btn-outline" onclick="openPqDbEdition('${escapeHtml(e.key)}')">📋 Kataloğu Aç</button><button type="button" class="btn-outline" onclick="setPqDbActiveEdition('${escapeHtml(e.key)}')">${active===e.key?'✓ Aktif Referans':'Aktif Referans Yap'}</button></div></article>`;
        }).join('');
    }
    function openPqDbEdition(key){setPqDbView('catalog');const sel=document.getElementById('pqDbCatalogEdition');if(sel)sel.value=key;pqDbCatalogEditionChanged();}
    window.openPqDbEdition=openPqDbEdition;

    function setPqDbView(view){pqDbView=['versions','catalog','compare'].includes(view)?view:'versions';document.querySelectorAll('#pqDbModebar [data-pqdb-view]').forEach(b=>b.classList.toggle('active',b.dataset.pqdbView===pqDbView));['versions','catalog','compare'].forEach(v=>{const e=document.getElementById('pqDbView'+v.charAt(0).toUpperCase()+v.slice(1));if(e)e.classList.toggle('active',v===pqDbView);});if(view==='catalog')renderPqDbCatalog();if(view==='compare')renderPqDbComparison();}
    window.setPqDbView=setPqDbView;

    function populatePqDbSelectors(){
        const eds=pqDbEditionEntries();const fill=(id,opts,current)=>{const el=document.getElementById(id);if(!el)return;const prev=current||el.value;el.innerHTML=opts.map(o=>`<option value="${escapeHtml(o.value)}">${escapeHtml(o.label)}</option>`).join('');if(opts.some(o=>o.value===prev))el.value=prev;};
        fill('pqDbCatalogEdition',eds.map(e=>({value:e.key,label:pqDbEditionLabel(e)})));
        fill('pqDbCompareTarget',eds.map(e=>({value:e.key,label:pqDbEditionLabel(e)})));
        pqDbCatalogEditionChanged(false);pqDbCompareTargetChanged(false);
    }
    function pqDbCatalogEditionChanged(render=true){const eds=pqDbEditionEntries(),key=(document.getElementById('pqDbCatalogEdition')||{}).value||(eds[0]||{}).key||'',edition=((icaoPqLibrary.editions||{})[key])||{},areas=pqDbAreaEntries(edition);const a=document.getElementById('pqDbCatalogArea');if(a){const prev=a.value;a.innerHTML=areas.map(x=>`<option value="${escapeHtml(x.area)}">${escapeHtml(x.area)}</option>`).join('');if(areas.some(x=>x.area===prev))a.value=prev;}const ces=new Set(areas.flatMap(x=>pqDbPqList(x).map(p=>p.ce).filter(Boolean)));const ce=document.getElementById('pqDbCatalogCe');if(ce){const prev=ce.value;ce.innerHTML='<option value="all">Tüm CE\'ler</option>'+[...ces].sort().map(x=>`<option>${escapeHtml(x)}</option>`).join('');if([...ce.options].some(o=>o.value===prev))ce.value=prev;}if(render)renderPqDbCatalog();}
    window.pqDbCatalogEditionChanged=pqDbCatalogEditionChanged;

    function renderPqDbCatalog(){
        const body=document.getElementById('pqDbCatalogBody');if(!body)return;const edKey=(document.getElementById('pqDbCatalogEdition')||{}).value,area=(document.getElementById('pqDbCatalogArea')||{}).value,edition=((icaoPqLibrary.editions||{})[edKey])||{},areaData=((edition.areas||{})[area])||null;
        if(!areaData){body.innerHTML='<tr><td colspan="5">Sürüm/alan seçiniz.</td></tr>';document.getElementById('pqDbCatalogCount').textContent='0 PQ';renderPqDbDetail(null,edKey,area);return;}
        const mode=(document.getElementById('pqDbCatalogMode')||{}).value||'all',ce=(document.getElementById('pqDbCatalogCe')||{}).value||'all',ppq=(document.getElementById('pqDbCatalogPpq')||{}).value||'all',q=((document.getElementById('pqDbCatalogSearch')||{}).value||'').toLocaleLowerCase('tr');
        const rows=pqDbPqList(areaData).filter(p=>(mode==='all'||p.assessmentMode===mode)&&(ce==='all'||p.ce===ce)&&(ppq==='all'||(ppq==='yes'?p.ppq:!p.ppq))&&(!q||[p.pq,p.question,p.guidance,p.auditorNote,p.references,p.ce,p.changeDescription].join(' ').toLocaleLowerCase('tr').includes(q)));
        document.getElementById('pqDbCatalogCount').textContent=`${rows.length} PQ`;if(pqDbSelectedPq&&!rows.some(p=>p.pq===pqDbSelectedPq))pqDbSelectedPq='';
        body.innerHTML=rows.length?rows.map(p=>`<tr class="${pqDbSelectedPq===p.pq?'active':''}" onclick="selectPqDbPq('${escapeHtml(p.pq)}')"><td><b>${escapeHtml(p.pq)}</b></td><td>${escapeHtml(p.assessmentMode||'-')}</td><td>${escapeHtml(p.ce||'-')}</td><td>${p.ppq?'Yes':'-'}</td><td>${p.changeType?`<span class="pqdb-badge ${pqDbChangeClass(p.changeType)}">${escapeHtml(p.changeType)}</span>`:'-'}</td></tr>`).join(''):'<tr><td colspan="5">Filtreye uygun PQ bulunamadı.</td></tr>';
        const selected=rows.find(p=>p.pq===pqDbSelectedPq)||rows[0]||null;if(selected&&!pqDbSelectedPq)pqDbSelectedPq=selected.pq;renderPqDbDetail(selected,edKey,area);
    }
    function selectPqDbPq(pq){pqDbSelectedPq=String(pq||'');renderPqDbCatalog();}
    window.selectPqDbPq=selectPqDbPq;
    function renderPqDbDetail(p,edKey,area){
        const el=document.getElementById('pqDbDetail'),tag=document.getElementById('pqDbDetailEdition'),edition=((icaoPqLibrary.editions||{})[edKey])||{},areaData=((edition.areas||{})[area])||{};
        if(tag)tag.textContent=`${pqDbEditionLabel(edition)} · ${area||'-'}`;if(!el)return;if(!p){el.innerHTML='<div class="pqdb-empty">Ayrıntı için bir PQ seçiniz.</div>';return;}
        const sd=areaData.sourceDocument||{},sourceAction=sd.downloadURL?`<a class="btn-outline pqdb-source-link" href="${escapeHtml(sd.downloadURL)}" target="_blank" rel="noopener">☁️ Kaynak DOCX</a>`:`<span class="smart-scope">Kaynak: ${escapeHtml(areaData.sourceFile||'-')}</span>`;
        el.innerHTML=`<div class="pqdb-detail"><div class="pqdb-detail-head"><div><h4>PQ ${escapeHtml(p.pq)}</h4><div class="visit-pq-ref-chips"><span class="visit-pq-ref-chip">${escapeHtml(p.assessmentMode||'-')}</span><span class="visit-pq-ref-chip">${escapeHtml(p.ce||'-')}</span><span class="visit-pq-ref-chip">PPQ: ${p.ppq?'Yes':'No'}</span>${p.changeType?`<span class="pqdb-badge ${pqDbChangeClass(p.changeType)}">${escapeHtml(p.changeType)}</span>`:''}</div></div>${sourceAction}</div><div class="pqdb-detail-grid"><div class="pqdb-detail-item"><b>Alan</b><span>${escapeHtml(p.area||area||'-')}</span></div><div class="pqdb-detail-item"><b>On/Off-site</b><span>${escapeHtml(p.assessmentMode||'-')}</span></div><div class="pqdb-detail-item"><b>CE</b><span>${escapeHtml(p.ce||'-')}</span></div><div class="pqdb-detail-item"><b>PPQ</b><span>${p.ppq?'Yes':'No'}</span></div></div><div class="pqdb-text-block"><h5>Protocol Question</h5><div>${escapeHtml(p.question||'-')}</div></div><div class="pqdb-text-block"><h5>Guidance for Review of Evidence</h5><div>${escapeHtml(p.guidance||'-')}</div></div>${p.auditorNote?`<div class="pqdb-text-block auditor"><h5>⚠️ Note(s) to the auditor</h5><div>${escapeHtml(p.auditorNote)}</div></div>`:''}<div class="pqdb-text-block"><h5>ICAO References</h5><div>${escapeHtml(p.references||'-')}</div></div>${p.changeType||p.changeDescription?`<div class="pqdb-text-block amendment"><h5>🔀 Summary of Amendments</h5><div>${escapeHtml([p.previousPq?`Önceki PQ: ${p.previousPq}`:'',p.changeType||'',p.changeDescription||''].filter(Boolean).join('\n'))}</div></div>`:''}</div>`;
    }

    function pqDbCompareTargetChanged(render=true){
        const eds=pqDbEditionEntries(),targetKey=(document.getElementById('pqDbCompareTarget')||{}).value||(eds[0]||{}).key||'',target=((icaoPqLibrary.editions||{})[targetKey])||{},areas=pqDbAreaEntries(target),areaSel=document.getElementById('pqDbCompareArea');if(areaSel){const prev=areaSel.value;areaSel.innerHTML=areas.map(a=>`<option value="${escapeHtml(a.area)}">${escapeHtml(a.area)}</option>`).join('');if(areas.some(a=>a.area===prev))areaSel.value=prev;}
        const area=(areaSel||{}).value||(areas[0]||{}).area||'',areaData=((target.areas||{})[area])||{},prevYear=(areaData.amendmentMeta||{}).previousYear;const base=document.getElementById('pqDbCompareBase');if(base){const old=base.value;let opts=[];if(prevYear)opts.push({value:`summary:${prevYear}`,label:`ICAO Summary of Amendments (${prevYear} → ${target.year||'?'})`});opts.push(...eds.filter(e=>e.key!==targetKey).map(e=>({value:e.key,label:pqDbEditionLabel(e)})));base.innerHTML=opts.map(o=>`<option value="${escapeHtml(o.value)}">${escapeHtml(o.label)}</option>`).join('');if(opts.some(o=>o.value===old))base.value=old;}
        if(render)renderPqDbComparison();
    }
    window.pqDbCompareTargetChanged=pqDbCompareTargetChanged;
    function renderPqDbComparison(){
        const body=document.getElementById('pqDbCompareBody');if(!body)return;const targetKey=(document.getElementById('pqDbCompareTarget')||{}).value,baseKey=(document.getElementById('pqDbCompareBase')||{}).value,area=(document.getElementById('pqDbCompareArea')||{}).value,target=((icaoPqLibrary.editions||{})[targetKey])||{},targetArea=((target.areas||{})[area])||null;let rows=[];
        if(targetArea&&String(baseKey||'').startsWith('summary:')){rows=pqDbAmendments(targetArea).map(a=>({...a,mode:(pqDbPqList(targetArea).find(p=>p.pq===a.newPq)||{}).assessmentMode||'',ce:(pqDbPqList(targetArea).find(p=>p.pq===a.newPq)||{}).ce||''}));}
        else if(targetArea&&baseKey){const base=((icaoPqLibrary.editions||{})[baseKey])||{},baseArea=((base.areas||{})[area])||null;if(baseArea){const bmap=new Map(pqDbPqList(baseArea).map(p=>[p.pq,p])),tmap=new Map(pqDbPqList(targetArea).map(p=>[p.pq,p]));const keys=new Set([...bmap.keys(),...tmap.keys()]);for(const pq of [...keys].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}))){const b=bmap.get(pq),t=tmap.get(pq);if(!b){rows.push({oldPq:'',newPq:pq,type:'New',description:'PQ yeni sürümde eklendi.',mode:t.assessmentMode,ce:t.ce});continue;}if(!t){rows.push({oldPq:pq,newPq:'',type:'Deleted',description:'PQ yeni sürümde bulunmuyor.',mode:b.assessmentMode,ce:b.ce});continue;}const fields=[['Question','question'],['Guidance','guidance'],['Auditor note','auditorNote'],['References','references'],['PPQ','ppq'],['CE','ce'],['On/Off-site','assessmentMode']],changed=fields.filter(([,k])=>String(b[k]??'')!==String(t[k]??'')).map(([label])=>label);rows.push({oldPq:pq,newPq:pq,type:changed.length?'Revised':'No change',description:changed.length?`Değişen alanlar: ${changed.join(', ')}`:'İçerik değişikliği tespit edilmedi.',mode:t.assessmentMode,ce:t.ce});}}}
        const counts={'New':0,'Revised':0,'Deleted':0,'Merged':0,'No change':0};rows.forEach(r=>{if(Object.prototype.hasOwnProperty.call(counts,r.type))counts[r.type]++;});[['pqDbChangeNew','New'],['pqDbChangeRevised','Revised'],['pqDbChangeDeleted','Deleted'],['pqDbChangeMerged','Merged'],['pqDbChangeNoChange','No change']].forEach(([id,k])=>{const e=document.getElementById(id);if(e)e.textContent=String(counts[k]||0);});const sum=document.getElementById('pqDbCompareSummary');if(sum)sum.textContent=targetArea?`${area} · ${rows.length} satır`:'Sürüm/alan seçiniz';body.innerHTML=rows.length?rows.map(r=>`<tr><td>${escapeHtml(r.oldPq||'-')}</td><td>${escapeHtml(r.newPq||'-')}</td><td><span class="pqdb-badge ${pqDbChangeClass(r.type)}">${escapeHtml(r.type||'-')}</span></td><td>${escapeHtml(r.mode||'-')}</td><td>${escapeHtml(r.ce||'-')}</td><td>${escapeHtml(r.description||'-')}</td></tr>`).join(''):'<tr><td colspan="6">Kıyaslama için uygun veri bulunamadı.</td></tr>';
    }

    let pqDbPendingImports=[];

    function pqDbEditionKey(meta){return pqDbSafeKey(`${meta.year}_R${meta.revision||'0'}`);}
    function pqDbExistingArea(editionKey,area){return (((icaoPqLibrary.editions||{})[editionKey]||{}).areas||{})[area]||null;}
    function pqDbImportSelectedItems(){
        return pqDbPendingImports.filter((item,i)=>{const cb=document.getElementById(`pqDbImportSelect_${i}`);return item.validation.valid&&(!cb||cb.checked);});
    }
    function closePqDbImportPreview(){const m=document.getElementById('pqDbImportModal');if(m)m.style.display='none';pqDbPendingImports=[];}
    window.closePqDbImportPreview=closePqDbImportPreview;

    function renderPqDbImportPreview(){
        const modal=document.getElementById('pqDbImportModal'),body=document.getElementById('pqDbImportBody'),summary=document.getElementById('pqDbImportSummary'),save=document.getElementById('pqDbImportSaveBtn');
        if(!modal||!body)return;
        const valid=pqDbPendingImports.filter(x=>x.validation.valid).length,invalid=pqDbPendingImports.length-valid,replacements=pqDbPendingImports.filter(x=>x.existing).length,totalPqs=pqDbPendingImports.reduce((n,x)=>n+(x.validation.metrics.pqCount||0),0);
        if(summary)summary.innerHTML=`<div><strong>${pqDbPendingImports.length}</strong><span>DOCX</span></div><div><strong>${valid}</strong><span>Geçerli</span></div><div><strong>${invalid}</strong><span>Hatalı</span></div><div><strong>${replacements}</strong><span>Güncelleme</span></div><div><strong>${totalPqs}</strong><span>PQ</span></div>`;
        body.innerHTML=pqDbPendingImports.map((item,i)=>{
            const p=item.parsed||{},m=p.meta||{},v=item.validation||{errors:[],warnings:[],metrics:{}},x=v.metrics||{},sample=(p.pqs||[]).slice(0,5);
            return `<article class="pqdb-import-card ${v.valid?'valid':'invalid'}">
                <div class="pqdb-import-card-head">
                    <label class="pqdb-import-select"><input id="pqDbImportSelect_${i}" type="checkbox" ${v.valid?'checked':'disabled'} onchange="updatePqDbImportSaveState()"><span></span></label>
                    <div><h4>${escapeHtml(item.file.name)}</h4><div class="pqdb-import-meta">${escapeHtml(m.year||'?')} Edition · Revision ${escapeHtml(m.revision||'?')} · ${escapeHtml(m.area||'?')} ${item.existing?'<b class="pqdb-replace-tag">MEVCUT KAYIT GÜNCELLENECEK</b>':'<b class="pqdb-new-tag">YENİ KAYIT</b>'}</div></div>
                    <span class="${v.valid?'pqdb-valid-tag':'pqdb-error-tag'}">${v.valid?'✓ Doğrulandı':'✕ Hatalı'}</span>
                </div>
                <div class="pqdb-import-metrics"><span><b>${x.pqCount||0}</b> PQ</span><span><b>${x.onSite||0}</b> On-site</span><span><b>${x.offSite||0}</b> Off-site</span><span><b>${x.ppq||0}</b> PPQ</span><span><b>${x.auditorNotes||0}</b> Auditor note</span><span><b>${x.amendments||0}</b> Amendment</span></div>
                ${v.errors.length?`<div class="pqdb-import-messages error">${v.errors.map(e=>`<div>⛔ ${escapeHtml(e)}</div>`).join('')}</div>`:''}
                ${v.warnings.length?`<div class="pqdb-import-messages warn">${v.warnings.map(e=>`<div>⚠️ ${escapeHtml(e)}</div>`).join('')}</div>`:''}
                <details class="pqdb-import-sample"><summary>Örnek PQ kayıtlarını göster</summary><table><thead><tr><th>PQ</th><th>Tür</th><th>CE</th><th>PPQ</th><th>Protocol Question</th></tr></thead><tbody>${sample.map(q=>`<tr><td>${escapeHtml(q.pq)}</td><td>${escapeHtml(q.assessmentMode)}</td><td>${escapeHtml(q.ce||'-')}</td><td>${q.ppq?'Yes':'-'}</td><td>${escapeHtml(q.question||'-')}</td></tr>`).join('')}</tbody></table></details>
            </article>`;
        }).join('');
        modal.style.display='flex';updatePqDbImportSaveState();
    }
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
                    const parsed=await window.PQDocxParser.parseFile(file),validation=window.PQDocxParser.validate(parsed),editionKey=pqDbEditionKey(parsed.meta),existing=pqDbExistingArea(editionKey,parsed.meta.area);
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
                if(result.sourceDocument&&result.sourceDocument.status!=='stored')storageWarnings.push(`${item.file.name}: kaynak DOCX Storage'a alınamadı (${result.sourceDocument.status}${result.sourceDocument.error?` – ${result.sourceDocument.error}`:''}).`);
                if(!pqDbActiveEdition())localStorage.setItem(PQDB_ACTIVE_EDITION_KEY,item.editionKey);
            }
            closePqDbImportPreview();pqDbLoaded=false;await loadIcaoPqLibrary(true);setPqDbView('versions');
            if(note)note.textContent=storageWarnings.length?`${done} PQ dokümanı Firebase veritabanına kaydedildi. ${storageWarnings.length} kaynak DOCX için Storage uyarısı var.`:`${done} PQ dokümanı ve kaynak DOCX Firebase'e kaydedildi.`;
            if(storageWarnings.length)console.warn('PQ Storage uyarıları',storageWarnings);
            showAppRuntimeToast(`${done} ICAO PQ dokümanı Firebase'e kaydedildi.`,'success');
        }catch(err){console.error(err);alert('PQ verisi Firebase’e kaydedilemedi: '+(err.message||err));if(note)note.textContent='Firebase kayıt hatası: '+(err.message||err);}
        finally{hideLoading();}
    }
    window.commitPqDbPendingImports=commitPqDbPendingImports;

    function renderIcaoPqLibraryModule(){if(!pqDbLoaded){loadIcaoPqLibrary();return;}renderPqDbKpis();renderPqDbVersions();populatePqDbSelectors();if(pqDbView==='catalog')renderPqDbCatalog();if(pqDbView==='compare')renderPqDbComparison();}
    window.renderIcaoPqLibraryModule=renderIcaoPqLibraryModule;

    function findPqLibraryReference(pq,area){
        pq=normalizePQ(pq||'');area=normalizeAreaKey(area||'');if(!pq)return null;const active=pqDbActiveEdition(),eds=pqDbEditionEntries(),ordered=active?[...eds.filter(e=>e.key===active),...eds.filter(e=>e.key!==active)]:eds;for(const e of ordered){const areas=pqDbAreaEntries(e).filter(a=>!area||a.area===area);for(const a of areas){const rec=(a.pqs||{})[pqDbSafeKey(pq)]||pqDbPqList(a).find(x=>x.pq===pq);if(rec)return{edition:e,areaData:a,pq:rec};}}return null;
    }
    function renderVisitPqReferenceHtml(pq,area,contextFinding){const ref=findPqLibraryReference(pq,area);if(!ref)return `<div class="pqdb-empty">PQ ${escapeHtml(pq||'-')} için PQ Veri Tabanında eşleşen resmî ICAO sürümü bulunamadı.<br><br><button type="button" onclick="switchTab('pq-library');setPqDbView('versions')">📚 PQ Veri Tabanını Aç</button></div>`;const p=ref.pq,e=ref.edition,a=ref.areaData,m=pqMasterData[p.pq]||{};return `<div class="visit-pq-ref-head"><div><div class="visit-pq-ref-title">PQ ${escapeHtml(p.pq)} · ${escapeHtml(p.area||a.area||'-')}</div><div class="visit-pq-ref-chips"><span class="visit-pq-ref-chip">${escapeHtml(pqDbEditionLabel(e))}</span><span class="visit-pq-ref-chip">${escapeHtml(p.assessmentMode||'-')}</span><span class="visit-pq-ref-chip">${escapeHtml(p.ce||'-')}</span><span class="visit-pq-ref-chip">PPQ: ${p.ppq?'Yes':'No'}</span>${p.changeType?`<span class="pqdb-badge ${pqDbChangeClass(p.changeType)}">${escapeHtml(p.changeType)}</span>`:''}</div></div><button type="button" class="btn-outline" onclick="openPqDbEdition('${escapeHtml(e.key)}');setTimeout(()=>{const a=document.getElementById('pqDbCatalogArea');if(a)a.value='${escapeHtml(a.area)}';pqDbSelectedPq='${escapeHtml(p.pq)}';renderPqDbCatalog();},0)">Veri tabanında aç</button></div><div class="visit-pq-ref-block"><h5>Protocol Question (ICAO)</h5><div class="body">${escapeHtml(p.question||'-')}</div>${m.soruTr?`<div class="body" style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border)"><b>TR:</b> ${escapeHtml(m.soruTr)}</div>`:''}</div><div class="visit-pq-ref-block"><h5>Guidance for Review of Evidence</h5><div class="body">${escapeHtml(p.guidance||'-')}</div></div>${p.auditorNote?`<div class="visit-pq-ref-block note"><h5>⚠️ Note(s) to the auditor</h5><div class="body">${escapeHtml(p.auditorNote)}</div></div>`:''}<div class="visit-pq-ref-block"><h5>ICAO References</h5><div class="body">${escapeHtml(p.references||'-')}</div></div>${p.changeType||p.changeDescription?`<div class="visit-pq-ref-block change"><h5>🔀 Sürüm Değişikliği</h5><div class="body">${escapeHtml([p.previousPq?`Önceki PQ: ${p.previousPq}`:'',p.changeType||'',p.changeDescription||''].filter(Boolean).join('\n'))}</div></div>`:''}${contextFinding||m.bulgu?`<div class="visit-pq-ref-block"><h5>Türkiye / mevcut CAP bulgusu</h5><div class="body">${escapeHtml(contextFinding||m.bulgu||'-')}</div>${m.bulguTr?`<div class="body" style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border)"><b>TR:</b> ${escapeHtml(m.bulguTr)}</div>`:''}</div>`:''}`;}
    function renderIcaoPqReferencePanel(){const el=document.getElementById('icaoPqReferencePanel');if(!el)return;const visit=getActiveIcaoOfficialVisitRecord?getActiveIcaoOfficialVisitRecord():null,pq=activeIcaoValidationPq;if(!pq){el.innerHTML='<div class="icao-visit-empty">PQ referansı için soldan bir PQ seçiniz.</div>';return;}const scope=visit?getIcaoVisitScopePqs(visit).find(x=>String(x.pq)===String(pq)):null,m=pqMasterData[pq]||{};el.innerHTML=renderVisitPqReferenceHtml(pq,(scope&&scope.area)||m.alan,(scope&&scope.finding)||m.bulgu||'');}
    window.renderIcaoPqReferencePanel=renderIcaoPqReferencePanel;
    function renderVisitWorkspacePqReference(){const el=document.getElementById('visitWorkspacePqReferencePanel');if(!el)return;const t=activeVisitWorkspaceTarget||{},pq=t.pq||(t.snapshot||{}).pq||'';if(!pq){el.innerHTML='<div class="visit-work-empty">PQ referansı için soldan bir PQ veya CAP adımı seçiniz. “Ziyaret geneli” hedefinde PQ referansı gösterilmez.</div>';return;}const m=pqMasterData[pq]||{},snap=t.snapshot||{};el.innerHTML=renderVisitPqReferenceHtml(pq,snap.area||m.alan,snap.finding||m.bulgu||'');}
    window.renderVisitWorkspacePqReference=renderVisitWorkspacePqReference;

    function exportIcaoPqLibraryExcel(){const eds=pqDbEditionEntries();if(!eds.length)return alert('Dışa aktarılacak PQ sürümü bulunmuyor.');const wb=XLSX.utils.book_new(),versionRows=[],pqRows=[],amRows=[];eds.forEach(e=>pqDbAreaEntries(e).forEach(a=>{versionRows.push({'Sürüm':pqDbEditionLabel(e),'Edition Key':e.key,'Yıl':e.year,'Revision':e.revision,'Alan':a.area,'Yayın':a.publicationDate||'','Kaynak Dosya':a.sourceFile||'','PQ Sayısı':pqDbPqList(a).length,'On-site':pqDbPqList(a).filter(p=>p.onSite).length,'Off-site':pqDbPqList(a).filter(p=>!p.onSite).length,'PPQ':pqDbPqList(a).filter(p=>p.ppq).length,'Auditor Note':pqDbPqList(a).filter(p=>p.auditorNote).length});pqDbPqList(a).forEach(p=>pqRows.push({'Sürüm':pqDbEditionLabel(e),'Alan':a.area,'PQ No':p.pq,'Protocol Question':p.question,'Guidance for Review of Evidence':p.guidance,'Note(s) to the auditor':p.auditorNote,'ICAO References':p.references,'PPQ':p.ppq?'Yes':'No','CE':p.ce,'Değerlendirme Türü':p.assessmentMode,'Önceki PQ':p.previousPq||'','Değişiklik Türü':p.changeType||'','Değişiklik Açıklaması':p.changeDescription||''}));pqDbAmendments(a).forEach(x=>amRows.push({'Sürüm':pqDbEditionLabel(e),'Alan':a.area,'Önceki Sürüm':(a.amendmentMeta||{}).previousYear||'','Önceki PQ':x.oldPq||'','Yeni PQ':x.newPq||'','Değişiklik Türü':x.type||'','Açıklama':x.description||''}));}));XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(versionRows),'Sürümler');XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(pqRows),'PQ Kataloğu');XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(amRows),'Amendments');XLSX.writeFile(wb,'ICAO_PQ_Surum_Veritabani.xlsx');}
    window.exportIcaoPqLibraryExcel=exportIcaoPqLibraryExcel;

    // UI ilk durumları: eski ekran davranışını bozmadan yeni alt menüleri hazırla.
    document.addEventListener('DOMContentLoaded',()=>{setTimeout(()=>{setIcaoVisitWorkspaceMode('validation');setVisitWorkspaceMode('fieldwork');},0);});
