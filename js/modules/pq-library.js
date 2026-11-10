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
    const PQDB_WNS='http://schemas.openxmlformats.org/wordprocessingml/2006/main';

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
        let local=null;try{local=JSON.parse(localStorage.getItem(PQDB_STORAGE_KEY)||'null');}catch(e){}
        if(local){icaoPqLibrary=pqDbNormalizeLibrary(local);if(pqDbRemoveLegacyEmbeddedSeed(icaoPqLibrary))pqDbSaveLocal();}
        try{
            if(typeof db!=='undefined'&&db&&navigator.onLine){const snap=await db.ref('icao_pq_library').once('value');if(snap.exists()){icaoPqLibrary=pqDbNormalizeLibrary(snap.val());pqDbRemoveLegacyEmbeddedSeed(icaoPqLibrary);pqDbSaveLocal();if(note)note.textContent='PQ veri tabanı Firebase üzerinden güncellendi.';}else if(note)note.textContent='Firebase PQ veri tabanı henüz boş. ICAO PQ DOCX Yükle ile ilk sürümü oluşturabilirsiniz.';}
            else if(note)note.textContent='Çevrimdışı mod: yerel PQ veri tabanı kullanılıyor.';
        }catch(err){console.warn('PQ DB Firebase read',err);if(note)note.textContent='Firebase PQ veri tabanı okunamadı; yerel kayıt kullanılıyor. '+(err.message||err);}
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
        grid.innerHTML=eds.map(e=>{const areas=pqDbAreaEntries(e),pqCount=areas.reduce((n,a)=>n+pqDbPqList(a).length,0),changeCount=areas.reduce((n,a)=>n+pqDbAmendments(a).length,0),sourceDates=[...new Set(areas.map(a=>a.publicationDate).filter(Boolean))];return `<article class="pqdb-version-card ${active===e.key?'active-edition':''}"><div><h4>${escapeHtml(pqDbEditionLabel(e))}</h4><div class="pqdb-version-meta">${pqCount} PQ · ${areas.length} alan · ${changeCount} amendment satırı${sourceDates.length?` · ${escapeHtml(sourceDates.join(', '))}`:''}</div></div><div class="pqdb-area-chips">${areas.map(a=>`<span class="pqdb-area-chip">${escapeHtml(a.area)} · ${pqDbPqList(a).length} PQ</span>`).join('')}</div><div class="pqdb-version-actions"><button type="button" class="btn-outline" onclick="openPqDbEdition('${escapeHtml(e.key)}')">📋 Kataloğu Aç</button><button type="button" class="btn-outline" onclick="setPqDbActiveEdition('${escapeHtml(e.key)}')">${active===e.key?'✓ Aktif Referans':'Aktif Referans Yap'}</button></div></article>`;}).join('');
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
    function renderPqDbDetail(p,edKey,area){const el=document.getElementById('pqDbDetail'),tag=document.getElementById('pqDbDetailEdition');if(tag){const e=((icaoPqLibrary.editions||{})[edKey])||{};tag.textContent=`${pqDbEditionLabel(e)} · ${area||'-'}`;}if(!el)return;if(!p){el.innerHTML='<div class="pqdb-empty">Ayrıntı için bir PQ seçiniz.</div>';return;}el.innerHTML=`<div class="pqdb-detail"><div class="pqdb-detail-head"><div><h4>PQ ${escapeHtml(p.pq)}</h4><div class="visit-pq-ref-chips"><span class="visit-pq-ref-chip">${escapeHtml(p.assessmentMode||'-')}</span><span class="visit-pq-ref-chip">${escapeHtml(p.ce||'-')}</span><span class="visit-pq-ref-chip">PPQ: ${p.ppq?'Yes':'No'}</span>${p.changeType?`<span class="pqdb-badge ${pqDbChangeClass(p.changeType)}">${escapeHtml(p.changeType)}</span>`:''}</div></div></div><div class="pqdb-detail-grid"><div class="pqdb-detail-item"><b>Alan</b><span>${escapeHtml(p.area||area||'-')}</span></div><div class="pqdb-detail-item"><b>On/Off-site</b><span>${escapeHtml(p.assessmentMode||'-')}</span></div><div class="pqdb-detail-item"><b>CE</b><span>${escapeHtml(p.ce||'-')}</span></div><div class="pqdb-detail-item"><b>PPQ</b><span>${p.ppq?'Yes':'No'}</span></div></div><div class="pqdb-text-block"><h5>Protocol Question</h5><div>${escapeHtml(p.question||'-')}</div></div><div class="pqdb-text-block"><h5>Guidance for Review of Evidence</h5><div>${escapeHtml(p.guidance||'-')}</div></div>${p.auditorNote?`<div class="pqdb-text-block auditor"><h5>⚠️ Note(s) to the auditor</h5><div>${escapeHtml(p.auditorNote)}</div></div>`:''}<div class="pqdb-text-block"><h5>ICAO References</h5><div>${escapeHtml(p.references||'-')}</div></div>${p.changeType||p.changeDescription?`<div class="pqdb-text-block amendment"><h5>🔀 Summary of Amendments</h5><div>${escapeHtml([p.previousPq?`2020 PQ: ${p.previousPq}`:'',p.changeType||'',p.changeDescription||''].filter(Boolean).join('\n'))}</div></div>`:''}</div>`;}

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

    function pqDbCellParagraphText(cell){if(!cell)return'';const ps=[...cell.getElementsByTagNameNS(PQDB_WNS,'p')];return ps.map(p=>[...p.getElementsByTagNameNS(PQDB_WNS,'t')].map(t=>t.textContent||'').join('').trim()).filter(Boolean).join('\n').trim();}
    function pqDbTableRows(table){return [...table.getElementsByTagNameNS(PQDB_WNS,'tr')].map(tr=>[...tr.children].filter(n=>n.localName==='tc').map(pqDbCellParagraphText));}
    function pqDbCellFill(cell){if(!cell)return'';const shd=cell.getElementsByTagNameNS(PQDB_WNS,'shd')[0];if(!shd)return'';return String(shd.getAttributeNS(PQDB_WNS,'fill')||shd.getAttribute('w:fill')||shd.getAttribute('fill')||'').toUpperCase();}
    function pqDbRowIsOnsite(tr){const cells=[...tr.children].filter(n=>n.localName==='tc');return cells.some(c=>{const f=pqDbCellFill(c);return f&& !['FFFFFF','AUTO','000000'].includes(f);});}
    function pqDbSplitGuidance(raw){const text=String(raw||'').trim(),m=text.match(/\bNotes? to the auditor\s*:\s*/i);if(!m)return{guidance:text,auditorNote:''};const i=m.index||0;return{guidance:text.slice(0,i).trim(),auditorNote:text.slice(i+m[0].length).trim()};}
    function pqDbDetectMetadata(xmlDoc,fileName){const paras=[...xmlDoc.getElementsByTagNameNS(PQDB_WNS,'p')].map(p=>[...p.getElementsByTagNameNS(PQDB_WNS,'t')].map(t=>t.textContent||'').join('').trim()).filter(Boolean),text=paras.join('\n');let year='',area='',revision='',publicationDate='';let m=text.match(/USOAP\s+CMA\s+(20\d{2})\s+Protocol Questions\s*[—–-]\s*([A-Z]{3})/i);if(m){year=m[1];area=m[2].toUpperCase();}if(!area){m=String(fileName||'').match(/(?:^|[_-])(LEG|ORG|PEL|OPS|AIR|AIG|ANS|AGA|SSP)(?:[_-]|$)/i);if(m)area=m[1].toUpperCase();}m=text.match(/\(([^()]*20\d{2}[^()]*)\)\s*[—–-]\s*Revision\s*([A-Za-z0-9.]+)/i);if(m){publicationDate=m[1].trim();revision=m[2].trim();}if(!year){m=String(fileName||'').match(/(20\d{2})/);if(m)year=m[1];}return{year:year||'Unknown',area:area||'OTHER',revision:revision||'0',publicationDate,sourceFile:fileName||'',title:`USOAP CMA ${year||''} Protocol Questions — ${area||''}`.trim()};}
    function parseIcaoPqDocxXml(xmlDoc,fileName){
        const meta=pqDbDetectMetadata(xmlDoc,fileName),tables=[...xmlDoc.getElementsByTagNameNS(PQDB_WNS,'tbl')];let amendments=[],pqs=[];let amendmentMeta={previousYear:'',currentYear:String(meta.year||'')};
        for(const table of tables){const trs=[...table.getElementsByTagNameNS(PQDB_WNS,'tr')],rows=trs.map(tr=>[...tr.children].filter(n=>n.localName==='tc').map(pqDbCellParagraphText)),head=rows.slice(0,3).flat().join(' | ');
            if(/Type of Amendment/i.test(head)&&/Description of Amendments/i.test(head)){
                let hi=rows.findIndex(r=>r.join(' ').includes('New')&&r.join(' ').includes('Revised')&&r.join(' ').includes('Deleted')&&r.join(' ').includes('Merged'));if(hi<0)hi=1;const h=rows[hi]||[];let ym=(h[0]||'').match(/(20\d{2})/);if(ym)amendmentMeta.previousYear=ym[1];ym=(h[1]||'').match(/(20\d{2})/);if(ym)amendmentMeta.currentYear=ym[1];
                rows.slice(hi+1).forEach((r,i)=>{if(r.length<8)return;const oldPq=normalizePQ(r[0]||''),newPq=normalizePQ(r[1]||'');if(!oldPq&&!newPq)return;const names=['New','Revised','Deleted','Merged','No change'];let type='';for(let j=0;j<5;j++){if(/[✔✓x]/i.test(r[2+j]||'')){type=names[j];break;}}if(!type&&/No change/i.test(r[7]||''))type='No change';if(!type&&/deleted and merged/i.test(r[7]||''))type='Deleted';if(!type&&/new pq/i.test(r[7]||''))type='New';amendments.push({id:String(i+1),oldPq,newPq,type:type||'Revised',description:String(r[7]||'').trim()});});
            }
            if(/Protocol Question/i.test(head)&&/Guidance for Review of Evidence/i.test(head)&&/ICAO References/i.test(head)){
                let hi=rows.findIndex(r=>r.some(x=>/Protocol Question/i.test(x))&&r.some(x=>/Guidance for Review of Evidence/i.test(x)));if(hi<0)hi=0;for(let i=hi+1;i<rows.length;i++){const r=rows[i],tr=trs[i];if(r.length<6)continue;const pq=normalizePQ(r[0]||'');if(!pq)continue;const split=pqDbSplitGuidance(r[2]||''),onSite=pqDbRowIsOnsite(tr);pqs.push({pq,area:meta.area,question:String(r[1]||'').trim(),guidance:split.guidance,auditorNote:split.auditorNote,references:String(r[3]||'').trim(),ppq:/\byes\b/i.test(r[4]||''),ce:String(r[5]||'').split('\n')[0].trim(),assessmentMode:onSite?'On-site':'Off-site',onSite});}
            }
        }
        const byNew=new Map(amendments.filter(a=>a.newPq).map(a=>[a.newPq,a]));pqs=pqs.map(p=>{const a=byNew.get(p.pq);return a?{...p,previousPq:a.oldPq||'',changeType:a.type||'',changeDescription:a.description||''}:p;});
        if(!pqs.length)throw new Error('ICAO PQ tablosu bulunamadı. “Protocol Question / Guidance for Review of Evidence / ICAO References / PPQ / CE” sütunları bekleniyor.');
        return{meta,amendmentMeta,pqs,amendments};
    }

    async function importIcaoPqDocuments(event){
        const files=Array.from((event&&event.target&&event.target.files)||[]);if(!files.length)return;const note=document.getElementById('pqDbSyncNote');showLoading('ICAO PQ dokümanları okunuyor...',`${files.length} dosya seçildi.`);try{for(const file of files){if(note)note.textContent=`Okunuyor: ${file.name}`;const zip=await JSZip.loadAsync(file),docFile=zip.file('word/document.xml');if(!docFile)throw new Error(`${file.name}: word/document.xml bulunamadı.`);const xml=await docFile.async('string'),xmlDoc=new DOMParser().parseFromString(xml,'text/xml'),parsed=parseIcaoPqDocxXml(xmlDoc,file.name),{meta}=parsed,editionKey=pqDbSafeKey(`${meta.year}_R${meta.revision}`),area=meta.area;if(!icaoPqLibrary.editions[editionKey])icaoPqLibrary.editions[editionKey]={year:meta.year,revision:meta.revision,label:pqDbEditionLabel(meta),areas:{},createdAt:new Date().toISOString()};const existing=((icaoPqLibrary.editions[editionKey].areas||{})[area]);if(existing&&!confirm(`${editionKey} / ${area} zaten kayıtlı. Bu alan dokümanını yeni dosya ile güncellemek istiyor musunuz?`))continue;const pqsObj={};parsed.pqs.forEach(p=>pqsObj[pqDbSafeKey(p.pq)]=p);const amendmentsObj={};parsed.amendments.forEach((a,i)=>amendmentsObj[String(i+1).padStart(4,'0')]=a);const areaData={area,year:meta.year,revision:meta.revision,publicationDate:meta.publicationDate,sourceFile:file.name,importedAt:new Date().toISOString(),importedBy:(typeof getCurrentVisitUser==='function'?getCurrentVisitUser():'')||'',amendmentMeta:parsed.amendmentMeta,pqs:pqsObj,amendments:amendmentsObj,stats:{pqCount:parsed.pqs.length,onSite:parsed.pqs.filter(p=>p.onSite).length,offSite:parsed.pqs.filter(p=>!p.onSite).length,ppq:parsed.pqs.filter(p=>p.ppq).length,auditorNotes:parsed.pqs.filter(p=>p.auditorNote).length,amendments:parsed.amendments.length}};icaoPqLibrary.editions[editionKey].areas=icaoPqLibrary.editions[editionKey].areas||{};icaoPqLibrary.editions[editionKey].areas[area]=areaData;icaoPqLibrary.editions[editionKey].updatedAt=new Date().toISOString();pqDbSaveLocal();try{if(typeof db!=='undefined'&&db&&firebase.auth().currentUser&&navigator.onLine){await db.ref(`icao_pq_library/editions/${editionKey}`).set(window.visitFirebaseSafeValue?window.visitFirebaseSafeValue(icaoPqLibrary.editions[editionKey]):icaoPqLibrary.editions[editionKey]);if(note)note.textContent=`${file.name}: ${parsed.pqs.length} PQ ve ${parsed.amendments.length} amendment satırı Firebase'e kaydedildi.`;}else if(note)note.textContent=`${file.name}: yerel PQ veri tabanına kaydedildi. Firebase için yetkili çevrim içi giriş gerekir.`;}catch(err){console.warn(err);if(note)note.textContent=`${file.name}: yerel kayıt tamamlandı; Firebase yazılamadı: ${err.message||err}`;}if(!pqDbActiveEdition())localStorage.setItem(PQDB_ACTIVE_EDITION_KEY,editionKey);}pqDbLoaded=true;renderIcaoPqLibraryModule();setPqDbView('versions');showAppRuntimeToast('ICAO PQ dokümanı işlendi.','success');}catch(err){console.error(err);alert('ICAO PQ dokümanı içe aktarılamadı: '+(err.message||err));}finally{hideLoading();if(event&&event.target)event.target.value='';}}
    window.importIcaoPqDocuments=importIcaoPqDocuments;

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
