// ZIYARET MODULU - GUNCEL WORD/CAP KAYNAK SENKRONIZASYONU
(function(){
    const VISIT_SYNC_PQ_FIELDS=['area','ce','responsible','verificationType','question','finding','reviewEvidence','statusCode','statusLabel'];
    const VISIT_SYNC_STEP_FIELDS=['action','office','evidenceReference','estDate','progress','statusCode','statusLabel','delayDays','sourceFile'];
    const VISIT_SYNC_FIELD_LABELS={area:'Denetim alanı',ce:'CE',responsible:'PQ sorumlusu',verificationType:'Doğrulama türü',question:'PQ sorusu',finding:'ICAO bulgusu',reviewEvidence:'İncelenecek kanıtlar',statusCode:'Durum kodu',statusLabel:'Durum',action:'CAP metni',office:'Sorumlu ofis',evidenceReference:'EVIDENCE REFERENCE',estDate:'Hedef tarih',progress:'İlerleme',delayDays:'Gecikme günü',sourceFile:'Kaynak dosya'};

    function visitSyncNorm(v){return String(v===undefined||v===null?'':v).replace(/\s+/g,' ').trim();}
    function visitSyncStepNo(v){return visitSyncNorm(v).replace(/^step\s*/i,'').replace(/^adım\s*/i,'');}
    function visitSourceFileDateValue(name){const m=String(name||'').match(/(20\d{2})(\d{2})(\d{2})/);if(!m)return 0;const d=new Date(Number(m[1]),Number(m[2])-1,Number(m[3]));return isNaN(d)?0:d.getTime();}
    function getVisitCurrentSourceReportDate(){let max=0;visitArrayValue(Array.from(loadedFiles||[])).forEach(f=>{max=Math.max(max,visitSourceFileDateValue(f));});rawData.forEach(r=>{max=Math.max(max,visitSourceFileDateValue((r||{}).sourceFile));});return max?new Date(max):(window_loadedReportDate instanceof Date?window_loadedReportDate:null);}
    function visitScopeStableStepKeyFromParts(pq,step,action){const p=visitSyncNorm(pq),s=visitSyncStepNo(step);return s?`${p}||STEP||${s}`:`${p}||ACTION||${visitSyncNorm(action).toLocaleLowerCase('tr').slice(0,180)}`;}
    window.visitScopeStableStepKey=function(row){row=row||{};return visitScopeStableStepKeyFromParts(row.pq,row.step,row.action||row.capText||row.actionText||'');};
    window.visitScopeStepKey=function(row){return visitScopeStableStepKey(row);};
    function visitScopeLegacyKey(row){row=row||{};return makeActionKey(row.pq||'',row.step||'',row.action||row.capText||row.actionText||'');}
    function visitScopeSourceDateIso(){const d=getVisitCurrentSourceReportDate();return d?d.toISOString():null;}

    function selectLatestVisitRows(){
        const dated=rawData.map((row,index)=>({row,index,date:visitSourceFileDateValue((row||{}).sourceFile)})).filter(x=>x.row&&x.row.pq);
        const maxDate=dated.reduce((m,x)=>Math.max(m,x.date||0),0);
        // Tarihli ICAO raporlarında yalnızca en güncel rapor tarihindeki satırlar çalışma kaynağıdır.
        // Böylece yeni raporda kaldırılan/kapanan bir Step eski dosyadan yanlışlıkla taşınmaz.
        const source=maxDate?dated.filter(x=>x.date===maxDate):dated;
        const map=new Map();
        source.forEach(({row,index})=>{const key=visitScopeStableStepKey(row);const prev=map.get(key);if(!prev||index>=prev.index)map.set(key,{row,index});});
        return Array.from(map.values()).map(x=>x.row);
    }

    window.buildVisitCurrentSourceCandidates=function(visit,projectionDate){
        if(!visit)return[];
        const areas=new Set(visitArrayValue(visit.areas).map(a=>visitSyncNorm(a).toUpperCase()));
        const latestRows=selectLatestVisitRows();
        const allPqs=new Set([...Object.keys(pqMasterData||{}),...latestRows.map(r=>r&&r.pq).filter(Boolean)]);
        const candidates=[];
        allPqs.forEach(pq=>{
            const master=pqMasterData[pq]||{},area=visitSyncNorm(master.alan||'DİĞER').toUpperCase();
            if(areas.size&&!areas.has(area))return;
            const sourceRows=latestRows.filter(r=>r&&String(r.pq)===String(pq));
            const pqStatus=classifyCommonPQStatus(pq,sourceRows,{projectionDate:projectionDate||null});
            const actionItems=sourceRows.filter(isUsableCapStep).map(row=>{
                const cls=classifyCommonActionStatus(row,{projectionDate:projectionDate||null});
                return {...row,statusCode:cls.code,statusLabel:cls.label,delayDays:cls.delayDays||0,daysLeft:cls.daysLeft,dueByProjection:!!cls.dueByProjection,parsedDate:cls.parsedDate||null,key:visitScopeStableStepKey(row),stableKey:visitScopeStableStepKey(row),legacyKey:visitScopeLegacyKey(row)};
            }).sort((a,b)=>String(a.step||'').localeCompare(String(b.step||''),'tr',{numeric:true}));
            candidates.push({pq,master,area,statusCode:pqStatus.code,statusLabel:pqStatus.label,question:visitScopeMasterText(master,['soru','question','pqQuestion']),questionTr:visitScopeMasterText(master,['soruTr','questionTr','pqQuestionTr']),finding:visitScopeMasterText(master,['bulgu','finding','description']),findingTr:visitScopeMasterText(master,['bulguTr','findingTr','descriptionTr']),reviewEvidence:visitScopeMasterText(master,['reviewEvidence','incelenecekKanitlar','evidence']),ce:master.ce||'',responsible:master.sorumlu||'',verificationType:master.tur||'',actionItems,lateSteps:actionItems.filter(a=>a.statusCode===COMMON_ACTION_STATUS.LATE.code).length,dateRiskSteps:actionItems.filter(a=>a.statusCode===COMMON_ACTION_STATUS.DATE_RISK.code).length,openSteps:actionItems.filter(a=>a.statusCode!==COMMON_ACTION_STATUS.COMPLETED.code).length});
        });
        return candidates.sort((a,b)=>sortAreas(a.area,b.area)||sortPQs(a.pq,b.pq));
    };

    window.buildVisitScopeCandidates=function(){
        const visit=getVisitScopeRecord();
        const projectionDate=((document.getElementById('visitScopeDueDate')||{}).value)||null;
        return buildVisitCurrentSourceCandidates(visit,projectionDate);
    };

    function visitCurrentIndex(visit){
        const candidates=buildVisitCurrentSourceCandidates(visit,((visit||{}).scope||{}).projectionDate||null),pqMap=new Map(),stepMap=new Map();
        candidates.forEach(c=>{pqMap.set(String(c.pq),c);c.actionItems.forEach(a=>{const key=visitScopeStableStepKey(a);if(!stepMap.has(key))stepMap.set(key,[]);stepMap.get(key).push({candidate:c,action:a});});});
        return {candidates,pqMap,stepMap};
    }
    function findCurrentVisitStep(stored,index){const key=visitScopeStableStepKey(stored),list=index.stepMap.get(key)||[];if(!list.length)return null;const exact=list.find(x=>visitSyncNorm(x.action.action)===visitSyncNorm(stored.action||stored.capText||stored.actionText));return exact||list[0];}
    function currentPqSnapshot(item,now){return {pq:item.pq,area:item.area,ce:item.ce,responsible:item.responsible,verificationType:item.verificationType,question:item.question,finding:item.finding,reviewEvidence:item.reviewEvidence,statusCode:item.statusCode,statusLabel:item.statusLabel,sourceReportDate:visitScopeSourceDateIso(),snapshotAt:now};}
    function currentStepSnapshot(item,action,now){return {key:visitScopeStableStepKey(action),stableKey:visitScopeStableStepKey(action),legacyKey:visitScopeLegacyKey(action),pq:item.pq,step:action.step,action:action.action,office:action.office,evidenceReference:action.evidenceReference||'',estDate:action.estDate,progress:action.progress,statusCode:action.statusCode,statusLabel:action.statusLabel,delayDays:action.delayDays||0,sourceFile:action.sourceFile||'',sourceReportDate:visitScopeSourceDateIso(),snapshotAt:now};}
    function visitSnapshotChanges(oldObj,newObj,fields){return fields.filter(k=>visitSyncNorm((oldObj||{})[k])!==visitSyncNorm((newObj||{})[k])).map(k=>({field:k,label:VISIT_SYNC_FIELD_LABELS[k]||k,before:(oldObj||{})[k],after:(newObj||{})[k]}));}
    function compactVisitSnapshot(obj,fields){const out={};['pq','step','key','stableKey','sourceReportDate','snapshotAt'].concat(fields).forEach(k=>{if(obj&&obj[k]!==undefined)out[k]=obj[k];});return out;}
    window.visitFirebaseSafeValue = function visitFirebaseSafeValue(value){
        if(value===undefined)return undefined;
        if(value===null)return null;
        if(typeof value==='number'&&!Number.isFinite(value))return null;
        if(Array.isArray(value))return value.map(visitFirebaseSafeValue).filter(v=>v!==undefined);
        if(value&&typeof value==='object'){
            const out={};
            Object.entries(value).forEach(([key,item])=>{const clean=visitFirebaseSafeValue(item);if(clean!==undefined)out[key]=clean;});
            return out;
        }
        return value;
    };
    function visitStoredSnapshotForReference(stored){
        const clean=visitFirebaseSafeValue(stored||{});
        if(clean&&typeof clean==='object'){
            delete clean.revisions;
            delete clean.storedSnapshot;
            delete clean.sourceChanges;
        }
        return clean;
    }
    function mergeVisitSourceSnapshot(existing,current,fields,now){
        const changes=visitSnapshotChanges(existing,current,fields),revisions=visitArrayValue((existing||{}).revisions).slice(-19);
        if(changes.length)revisions.push({capturedAt:now,sourceReportDate:(existing||{}).sourceReportDate||null,snapshot:compactVisitSnapshot(existing,fields),changes:changes.map(c=>c.field)});
        return {...existing,...current,revisions,lastSyncedAt:now,sourceState:'current'};
    }
    function resolveVisitPqCurrent(stored,index){
        const current=index.pqMap.get(String((stored||{}).pq||''));
        if(!rawData.length)return {...stored,sourceState:'unavailable',sourceChanges:[]};
        if(!current)return {...stored,sourceState:'removed',sourceChanges:[],sourceStateLabel:'Güncel kaynakta bulunamadı'};
        const snap=currentPqSnapshot(current,new Date().toISOString()),changes=visitSnapshotChanges(stored,snap,VISIT_SYNC_PQ_FIELDS);
        return {...stored,...snap,storedSnapshot:visitStoredSnapshotForReference(stored),sourceState:changes.length?'changed':'current',sourceChanges:changes,sourceStateLabel:changes.length?'Güncel Word verisi farklı':'Güncel kaynakla uyumlu'};
    }
    function resolveVisitStepCurrent(stored,index){
        if(!rawData.length)return {...stored,key:visitScopeStableStepKey(stored),stableKey:visitScopeStableStepKey(stored),sourceState:'unavailable',sourceChanges:[]};
        const found=findCurrentVisitStep(stored,index);
        if(!found)return {...stored,key:visitScopeStableStepKey(stored),stableKey:visitScopeStableStepKey(stored),sourceState:'removed',sourceChanges:[],sourceStateLabel:'Güncel kaynakta bulunamadı'};
        const snap=currentStepSnapshot(found.candidate,found.action,new Date().toISOString()),changes=visitSnapshotChanges(stored,snap,VISIT_SYNC_STEP_FIELDS);
        return {...stored,...snap,storedSnapshot:visitStoredSnapshotForReference(stored),sourceState:changes.length?'changed':'current',sourceChanges:changes,sourceStateLabel:changes.length?'Güncel Word verisi farklı':'Güncel kaynakla uyumlu'};
    }
    window.getVisitScopeWorkingPqs=function(visit){const index=visitCurrentIndex(visit);return getVisitScopeStoredPqs(visit).map(p=>resolveVisitPqCurrent(p,index));};
    window.getVisitScopeWorkingSteps=function(visit){const index=visitCurrentIndex(visit);return getVisitScopeStoredSteps(visit).map(s=>resolveVisitStepCurrent(s,index));};

    window.buildVisitScopeSourceSyncAnalysis=function(visit){
        if(!visit)return null;const index=visitCurrentIndex(visit),pqs=getVisitScopeStoredPqs(visit).map(p=>resolveVisitPqCurrent(p,index)),steps=getVisitScopeStoredSteps(visit).map(s=>resolveVisitStepCurrent(s,index));
        const selectedPqs=new Set(pqs.map(p=>String(p.pq||''))),storedStepKeys=new Set(steps.map(s=>visitScopeStableStepKey(s)));
        const newSteps=index.candidates.filter(c=>selectedPqs.has(String(c.pq))).flatMap(c=>c.actionItems.map(a=>({pq:c.pq,step:a.step,action:a.action,key:visitScopeStableStepKey(a)}))).filter(s=>!storedStepKeys.has(s.key));
        return {visit,pqs,steps,newSteps,changedPqs:pqs.filter(x=>x.sourceState==='changed'),changedSteps:steps.filter(x=>x.sourceState==='changed'),removedPqs:pqs.filter(x=>x.sourceState==='removed'),removedSteps:steps.filter(x=>x.sourceState==='removed'),currentPqs:pqs.filter(x=>x.sourceState==='current'),currentSteps:steps.filter(x=>x.sourceState==='current'),sourceAvailable:rawData.length>0,sourceReportDate:visitScopeSourceDateIso()};
    };

    function visitSyncAnalysisHtml(analysis,compact){
        if(!analysis)return'';
        if(!analysis.sourceAvailable)return '<div class="visit-source-sync-title">Güncel Word/CAP kaynağı bulunamadı.</div><div class="visit-source-sync-meta">Önce güncel Word belgesini yükleyiniz. Mevcut ziyaret kayıtları ve önceki anlık görüntüler korunmaktadır.</div>';
        const changed=analysis.changedPqs.length+analysis.changedSteps.length,removed=analysis.removedPqs.length+analysis.removedSteps.length,newCount=analysis.newSteps.length,current=analysis.currentPqs.length+analysis.currentSteps.length;
        const issues=[...analysis.changedPqs.map(x=>`PQ ${x.pq}: ${x.sourceChanges.map(c=>c.label).join(', ')}`),...analysis.changedSteps.map(x=>`PQ ${x.pq} / Step ${x.step}: ${x.sourceChanges.map(c=>c.label).join(', ')}`),...analysis.removedPqs.map(x=>`PQ ${x.pq}: güncel kaynakta bulunamadı`),...analysis.removedSteps.map(x=>`PQ ${x.pq} / Step ${x.step}: güncel kaynakta bulunamadı`),...analysis.newSteps.map(x=>`PQ ${x.pq} / Step ${x.step}: kapsamda olmayan yeni adım`)];
        return `<div class="visit-source-sync-head"><div><div class="visit-source-sync-title">Güncel Word/CAP kaynak kontrolü</div><div class="visit-source-sync-meta">Kaynak tarihi: ${escapeHtml(analysis.sourceReportDate?formatVisitDate(analysis.sourceReportDate):'-')} · Çalışma ekranı güncel veriyi otomatik kullanır. “Senkronize Et” işlemi yeni görüntüyü Firebase'e kaydeder, önceki görüntüyü geçmişte korur.</div></div><div class="visit-source-sync-badges"><span class="visit-source-sync-badge current">${current} uyumlu</span><span class="visit-source-sync-badge changed">${changed} değişti</span><span class="visit-source-sync-badge removed">${removed} kaynakta yok</span><span class="visit-source-sync-badge new">${newCount} yeni adım</span></div></div>${!compact&&issues.length?`<details class="visit-source-sync-detail"><summary>Değişiklik ayrıntıları (${issues.length})</summary><ul class="visit-source-sync-list">${issues.slice(0,60).map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul></details>`:''}`;
    }
    window.renderVisitScopeSourceSyncStatus=function(visit){const el=document.getElementById('visitScopeSourceSyncPanel');if(!el)return;if(!visit){el.style.display='none';return;}const a=buildVisitScopeSourceSyncAnalysis(visit);el.style.display='block';const changed=a.changedPqs.length+a.changedSteps.length,removed=a.removedPqs.length+a.removedSteps.length;el.className=`visit-source-sync-panel ${removed?'danger':changed||a.newSteps.length?'warn':'ok'}`;el.innerHTML=visitSyncAnalysisHtml(a,false);};
    window.renderVisitWorkspaceSourceSyncStatus=function(visit){const el=document.getElementById('visitWorkspaceSourceSyncPanel');if(!el)return;if(!visit){el.style.display='none';return;}const a=buildVisitScopeSourceSyncAnalysis(visit);el.style.display='block';const changed=a.changedPqs.length+a.changedSteps.length,removed=a.removedPqs.length+a.removedSteps.length;el.className=`visit-source-sync-panel ${removed?'danger':changed||a.newSteps.length?'warn':'ok'}`;el.innerHTML=visitSyncAnalysisHtml(a,true);};

    window.syncVisitScopeWithCurrentSource=async function(visitId){
        const id=visitId||activeVisitScopeId||((document.getElementById('visitScopeVisitSelect')||{}).value||'');const raw=id&&icaoVisits[id];if(!raw)return alert('Önce bir ziyaret seçiniz.');if(!rawData.length)return alert('Güncel Word/CAP verisi bulunamadı. Önce güncel Word belgesini yükleyiniz.');if(!firebase.auth().currentUser)return alert('Senkronizasyon için yetkili giriş gereklidir.');
        const visit={id,...raw},analysis=buildVisitScopeSourceSyncAnalysis(visit),changed=analysis.changedPqs.length+analysis.changedSteps.length,removed=analysis.removedPqs.length+analysis.removedSteps.length;
        if(!getVisitScopeStoredPqs(visit).length&&!getVisitScopeStoredSteps(visit).length)return alert('Bu ziyaret için kaydedilmiş PQ/CAP kapsamı bulunmuyor. Önce kapsam oluşturunuz.');
        if((changed||removed||analysis.newSteps.length)&&!confirm(`Güncel kaynakla senkronizasyon özeti:\n${changed} değişen kayıt\n${removed} güncel kaynakta bulunamayan kayıt\n${analysis.newSteps.length} kapsamda olmayan yeni adım\n\nMevcut notlar, takipler ve danışmalar korunacaktır. Devam edilsin mi?`))return;
        const actor=getCurrentVisitUser(),now=new Date().toISOString(),index=visitCurrentIndex(visit);
        const pqs=getVisitScopeStoredPqs(visit).map(old=>{const cur=index.pqMap.get(String(old.pq||''));if(!cur)return {...old,sourceState:'removed',lastSyncedAt:now};return mergeVisitSourceSnapshot(old,currentPqSnapshot(cur,now),VISIT_SYNC_PQ_FIELDS,now);});
        const steps=getVisitScopeStoredSteps(visit).map(old=>{const found=findCurrentVisitStep(old,index);if(!found)return {...old,key:visitScopeStableStepKey(old),stableKey:visitScopeStableStepKey(old),sourceState:'removed',lastSyncedAt:now};return mergeVisitSourceSnapshot(old,currentStepSnapshot(found.candidate,found.action,now),VISIT_SYNC_STEP_FIELDS,now);});
        const history=visitArrayValue(((visit.scope||{}).sourceHistory)).slice(-29);history.push({timestamp:now,actor,sourceReportDate:visitScopeSourceDateIso(),changed,removed,newSteps:analysis.newSteps.length,summary:`${changed} değişen, ${removed} kaynakta bulunamayan, ${analysis.newSteps.length} yeni adım`});
        const scope={...(visit.scope||{}),pqs,steps,sourceSync:{lastSyncedAt:now,lastSyncedBy:actor,sourceReportDate:visitScopeSourceDateIso(),changed,removed,newSteps:analysis.newSteps.length,moduleVersion:'visit-current-source-sync-1'},sourceHistory:history,updatedAt:now,updatedBy:actor,moduleVersion:'visit-current-source-sync-1'};
        const updates={};updates[`icao_visits/${id}/scope`]=scope;updates[`icao_visits/${id}/updatedAt`]=now;updates[`icao_visits/${id}/updatedBy`]=actor;
        const auditBefore={sourceReportDate:(((visit.scope||{}).sourceSync||{}).sourceReportDate)||null,changed:(((visit.scope||{}).sourceSync||{}).changed)||0,removed:(((visit.scope||{}).sourceSync||{}).removed)||0,newSteps:(((visit.scope||{}).sourceSync||{}).newSteps)||0};
        const auditAfter={sourceReportDate:scope.sourceSync.sourceReportDate,changed,removed,newSteps:analysis.newSteps.length};
        addVisitAuditToUpdates(updates,id,'scope','source_sync','update',auditBefore,auditAfter,'Ziyaret kapsamı güncel Word/CAP kaynağıyla senkronize edildi.',now,actor,{});
        const btn=document.getElementById('visitScopeSyncButton');if(btn){btn.disabled=true;btn.textContent='Senkronize ediliyor...';}
        try{showLoading();await db.ref().update(updates);alert('Ziyaret kapsamı güncel kaynakla senkronize edildi. Önceki kaynak görüntüleri geçmişte korunmuştur.');}
        catch(e){console.error(e);alert('Güncel kaynak senkronizasyonu başarısız: '+(e.message||e));}
        finally{hideLoading();if(btn){btn.disabled=false;btn.textContent='🔁 Güncel Kaynakla Senkronize Et';}}
    };
    window.syncActiveVisitWorkspaceSource=function(){const id=activeVisitWorkspaceId||((document.getElementById('visitWorkspaceVisitSelect')||{}).value||'');return syncVisitScopeWithCurrentSource(id);};

    const originalLoadScope=window.loadVisitScopeSelection;
    window.loadVisitScopeSelection=function(id,silent){const result=originalLoadScope.call(this,id,silent);const visit=getVisitScopeRecord();visitScopeSelectedSteps=new Set(getVisitScopeStoredSteps(visit).map(x=>visitScopeStableStepKey(x)).filter(Boolean));renderVisitScopeCandidates();renderVisitPreparationPanel();renderVisitScopeSourceSyncStatus(visit);return result;};
    const originalRenderScopeCandidates=window.renderVisitScopeCandidates;
    window.renderVisitScopeCandidates=function(){const r=originalRenderScopeCandidates.apply(this,arguments);renderVisitScopeSourceSyncStatus(getVisitScopeRecord());return r;};

    window.buildVisitScopeSnapshots=function(){
        const visit=getVisitScopeRecord(),candidates=buildVisitScopeCandidates(),now=new Date().toISOString(),index=visitCurrentIndex(visit),oldPqMap=new Map(getVisitScopeStoredPqs(visit).map(x=>[String(x.pq||''),x])),oldStepMap=new Map(getVisitScopeStoredSteps(visit).map(x=>[visitScopeStableStepKey(x),x]));
        const pqs=[];visitScopeSelectedPqs.forEach(pq=>{const cur=index.pqMap.get(String(pq)),old=oldPqMap.get(String(pq));if(cur){const snap=currentPqSnapshot(cur,now);pqs.push(old?mergeVisitSourceSnapshot(old,snap,VISIT_SYNC_PQ_FIELDS,now):snap);}else if(old)pqs.push({...old,sourceState:'removed',lastSyncedAt:now});});
        const steps=[];visitScopeSelectedSteps.forEach(key=>{const old=oldStepMap.get(key),list=index.stepMap.get(key)||[],found=old?findCurrentVisitStep(old,index):(list[0]||null);if(found){const snap=currentStepSnapshot(found.candidate,found.action,now);steps.push(old?mergeVisitSourceSnapshot(old,snap,VISIT_SYNC_STEP_FIELDS,now):snap);}else if(old)steps.push({...old,key,stableKey:key,sourceState:'removed',lastSyncedAt:now});});
        return {pqs,steps};
    };

    window.getVisitWorkspaceTargets=function(visit){
        if(!visit)return[];const targets=[{type:'visit',key:'visit',label:'Ziyaret geneli',pq:'',step:'',snapshot:{visitName:visit.visitName||'',areas:visitArrayValue(visit.areas),units:getVisitUnits(visit),sourceState:'current'}}];
        getVisitScopeWorkingPqs(visit).forEach(p=>targets.push({type:'pq',key:String(p.pq||''),label:`PQ ${p.pq||'-'} — ${p.area||'-'}${p.sourceState==='removed'?' [KAYNAKTA YOK]':''}`,pq:String(p.pq||''),step:'',snapshot:{...p}}));
        getVisitScopeWorkingSteps(visit).forEach(s=>targets.push({type:'step',key:visitScopeStableStepKey(s),label:`PQ ${s.pq||'-'} / Step ${s.step||'-'}${s.sourceState==='removed'?' [KAYNAKTA YOK]':''}`,pq:String(s.pq||''),step:String(s.step||''),snapshot:{...s}}));
        return targets;
    };
    const originalTargetStatus=window.visitWorkspaceTargetStatusClass;
    window.visitWorkspaceTargetStatusClass=function(target){if(((target||{}).snapshot||{}).sourceState==='removed')return 'source-removed';return originalTargetStatus(target);};

    function sourceContextHtml(target){
        if(!target||target.type==='visit')return'';const s=target.snapshot||{},changes=visitArrayValue(s.sourceChanges),cls=s.sourceState==='removed'?'removed':s.sourceState==='changed'?'changed':'current';
        let msg=s.sourceState==='removed'?'Bu PQ/CAP adımı güncel Word kaynağında bulunamadı. Eski ziyaret kaydı, notlar ve takipler korunmuştur.':s.sourceState==='changed'?'Ekranda güncel Word/CAP bilgisi kullanılmaktadır. Önceki kapsam görüntüsünden farklı alanlar aşağıdadır.':'Bu hedef güncel Word/CAP kaynağıyla uyumludur.';
        const rows=changes.map(c=>`<tr><th>${escapeHtml(c.label)}</th><td>${escapeHtml(visitSyncNorm(c.before)||'-')}</td><td>${escapeHtml(visitSyncNorm(c.after)||'-')}</td></tr>`).join('');
        return `<b>Güncel kaynak durumu:</b> ${escapeHtml(s.sourceStateLabel||msg)}<br>${escapeHtml(msg)}${rows?`<table><thead><tr><th>Alan</th><th>Önceki görüntü</th><th>Güncel Word</th></tr></thead><tbody>${rows}</tbody></table>`:''}`;
    }
    const originalRenderSelected=window.renderVisitWorkspaceSelectedTarget;
    window.renderVisitWorkspaceSelectedTarget=function(){
        const el=document.getElementById('visitWorkspaceSelectedTarget');if(el)el.innerHTML=`<b>Seçili hedef:</b> ${escapeHtml((activeVisitWorkspaceTarget||{}).label||'Ziyaret geneli')}`;
        const sourceEl=document.getElementById('visitWorkspaceCurrentSourceContext');if(sourceEl){const h=sourceContextHtml(activeVisitWorkspaceTarget);sourceEl.style.display=h?'block':'none';sourceEl.className=`visit-current-source-context ${((activeVisitWorkspaceTarget||{}).snapshot||{}).sourceState||'current'}`;sourceEl.innerHTML=h;}
        const prepEl=document.getElementById('visitWorkspacePrepContext');if(!prepEl)return;const visit=getVisitWorkspaceVisit(),t=activeVisitWorkspaceTarget||{};const prep=getVisitPreparationRecords(visit).filter(r=>{if(t.type==='visit')return r.targetType==='visit';if(t.type==='pq')return r.targetType==='pq'&&String(r.pq||'')===String(t.pq||'');return r.targetType==='step'&&((String(r.pq||'')===String(t.pq||'')&&String(r.step||'')===String(t.step||''))||String(r.stepKey||r.targetKey||'')===String(t.key||''));});if(!prep.length){prepEl.style.display='none';prepEl.textContent='';return;}prepEl.style.display='block';prepEl.textContent='Hazırlık kaydı:\n'+prep.map((r,i)=>`${i+1}. ${(r.questions||r.evidenceRequests||r.verificationPoints||r.notes||'').trim()}`).join('\n');
    };
    const originalLoadWorkspace=window.loadVisitWorkspaceSelection;
    window.loadVisitWorkspaceSelection=function(id,silent){const r=originalLoadWorkspace.call(this,id,silent);renderVisitWorkspaceSourceSyncStatus(getVisitWorkspaceVisit());return r;};
    const originalRenderWorkspace=window.renderVisitWorkspaceModule;
    window.renderVisitWorkspaceModule=function(){const r=originalRenderWorkspace.apply(this,arguments);renderVisitWorkspaceSourceSyncStatus(getVisitWorkspaceVisit());return r;};

    window.editVisitWorkspaceRecord=function(id){const visit=getVisitWorkspaceVisit(),rec=getVisitFieldworkRecords(visit,true).find(r=>r.id===id);if(!rec)return alert('Kayıt bulunamadı.');const target=getVisitWorkspaceTargets(visit).find(t=>t.type===rec.targetType&&(t.key===rec.targetKey||(rec.targetType==='step'&&String(t.pq||'')===String(rec.pq||'')&&String(t.step||'')===String(rec.step||''))));if(target)activeVisitWorkspaceTarget=target;const el=document.getElementById('visitWorkspaceRecordId');if(el)el.value=id;setVisitWorkspaceFormData(rec);renderVisitWorkspaceTargets();renderVisitWorkspaceSelectedTarget();document.getElementById('visitWorkspaceForm').scrollIntoView({behavior:'smooth',block:'start'});};

    const originalPrepOptions=window.renderVisitPreparationTargetOptions;
    window.renderVisitPreparationTargetOptions=function(){
        const result=originalPrepOptions.apply(this,arguments),select=document.getElementById('visitPrepTarget'),visit=getVisitScopeRecord();if(!select||!visit)return result;
        const existing=new Set(Array.from(select.options).map(o=>o.value));
        getVisitScopeStoredSteps(visit).filter(s=>visitScopeSelectedSteps.has(visitScopeStableStepKey(s))).forEach(s=>{const value='step::'+encodeURIComponent(visitScopeStableStepKey(s));if(existing.has(value))return;const opt=document.createElement('option');opt.value=value;opt.textContent=`PQ ${s.pq||'-'} / Step ${s.step||'-'} — [Güncel kaynakta bulunamadı]`;select.appendChild(opt);existing.add(value);});
        return result;
    };
    window.parseVisitPrepTarget=function(value){
        const visit=getVisitScopeRecord(),candidates=buildVisitScopeCandidates();if(!value||value==='visit')return {targetType:'visit',targetLabel:(visit&&visit.visitName)||'Ziyaret geneli',pq:'',step:'',stepKey:''};
        if(value.startsWith('pq::')){const pq=value.slice(4);return {targetType:'pq',targetLabel:`PQ ${pq}`,pq,step:'',stepKey:''};}
        if(value.startsWith('step::')){const key=decodeURIComponent(value.slice(6));const found=candidates.flatMap(x=>x.actionItems.map(a=>({x,a}))).find(z=>z.a.key===key);if(found)return {targetType:'step',targetLabel:`PQ ${found.x.pq} / Step ${found.a.step}`,pq:found.x.pq,step:found.a.step,stepKey:key};const stored=getVisitScopeStoredSteps(visit).find(s=>visitScopeStableStepKey(s)===key);return stored?{targetType:'step',targetLabel:`PQ ${stored.pq} / Step ${stored.step}`,pq:stored.pq||'',step:stored.step||'',stepKey:key}:{targetType:'step',targetLabel:'CAP adımı',pq:'',step:'',stepKey:key};}
        return {targetType:'visit',targetLabel:'Ziyaret geneli',pq:'',step:'',stepKey:''};
    };
    window.editVisitPreparationRecord=function(id){const record=getVisitPreparationRecords(getVisitScopeRecord()).find(r=>r.id===id);if(!record)return;const set=(field,val)=>{const el=document.getElementById(field);if(el)el.value=val||'';};set('visitPrepRecordId',record.id);set('visitPrepQuestions',record.questions);set('visitPrepEvidence',record.evidenceRequests);set('visitPrepAuthorities',record.personsAuthorities);set('visitPrepVerification',record.verificationPoints);set('visitPrepAssessment',record.preliminaryAssessment);set('visitPrepRisks',record.risks);set('visitPrepNotes',record.notes);renderVisitPreparationTargetOptions();const target=document.getElementById('visitPrepTarget');if(target){if(record.targetType==='pq')target.value='pq::'+record.pq;else if(record.targetType==='step')target.value='step::'+encodeURIComponent(visitScopeStableStepKey(record));else target.value='visit';}};

    window.buildVisitScopeExportBundle=function(){const visit=getVisitScopeRecord();if(!visit)return null;return {visit,scope:{...(visit.scope||{}),pqs:getVisitScopeWorkingPqs(visit),steps:getVisitScopeWorkingSteps(visit)},historicalScope:visit.scope||{},general:((visit.preparation||{}).general)||{},records:getVisitPreparationRecords(visit)};};
    window.buildVisitScopePqExportRows=function(bundle){return visitArrayValue((bundle.scope||{}).pqs).map(x=>({'PQ':x.pq||'','Denetim Alanı':x.area||'','CE':x.ce||'','PQ Sorumlusu':x.responsible||'','Doğrulama Türü':x.verificationType||'','Standart Durum':x.statusLabel||'','Kaynak Eşleşme Durumu':x.sourceStateLabel||x.sourceState||'','Değişen Alanlar':visitArrayValue(x.sourceChanges).map(c=>c.label).join(', '),'PQ Sorusu (ENG)':fullTextForExcel(x.question||''),'PQ Sorusu (TR)':fullTextForExcel(x.questionTr||(pqMasterData[x.pq]||{}).soruTr||''),'ICAO Bulgusu (ENG)':fullTextForExcel(x.finding||''),'ICAO Bulgusu (TR)':fullTextForExcel(x.findingTr||(pqMasterData[x.pq]||{}).bulguTr||''),'İncelenecek Kanıtlar':fullTextForExcel(x.reviewEvidence||''),'Kaynak Rapor Tarihi':x.sourceReportDate||'','Anlık Görüntü Tarihi':x.snapshotAt||''}));};
    window.buildVisitScopeStepExportRows=function(bundle){return visitArrayValue((bundle.scope||{}).steps).map(x=>({'PQ':x.pq||'','Step':x.step||'','CAP Eylemi':fullTextForExcel(x.action||''),'Sorumlu Ofis':x.office||'','EVIDENCE REFERENCE':fullTextForExcel(x.evidenceReference||''),'Hedef Tarih':x.estDate||'','İlerleme':x.progress||'','Standart Durum':x.statusLabel||'','Kaynak Eşleşme Durumu':x.sourceStateLabel||x.sourceState||'','Değişen Alanlar':visitArrayValue(x.sourceChanges).map(c=>c.label).join(', '),'Önceki CAP Metni':fullTextForExcel((((x.storedSnapshot||{}).action)||'')),'Önceki Hedef Tarih':((x.storedSnapshot||{}).estDate)||'','Gecikme Günü':x.delayDays||0,'Kaynak Dosya':x.sourceFile||'','Kaynak Rapor Tarihi':x.sourceReportDate||'','Anlık Görüntü Tarihi':x.snapshotAt||''}));};
    window.visitReportGetScopePqs=function(visits){return (visits||[]).flatMap(v=>getVisitScopeWorkingPqs(v).map(p=>({...p,visitId:v.id,visitName:v.visitName||'Adsız ziyaret',visitAreas:visitArrayValue(v.areas),visitUnits:getVisitUnits(v)})));};
    window.visitReportGetScopeSteps=function(visits){return (visits||[]).flatMap(v=>getVisitScopeWorkingSteps(v).map(s=>({...s,visitId:v.id,visitName:v.visitName||'Adsız ziyaret',visitAreas:visitArrayValue(v.areas),visitUnits:getVisitUnits(v)})));};

    window.runVisitCurrentSourceSyncSelfCheck=function(){const visit=getVisitScopeRecord()||getVisitWorkspaceVisit()||getVisitRecords()[0]||null,a=visit?buildVisitScopeSourceSyncAnalysis(visit):null;const result={passed:typeof syncVisitScopeWithCurrentSource==='function'&&typeof getVisitScopeWorkingSteps==='function'&&!!document.getElementById('visitScopeSourceSyncPanel')&&!!document.getElementById('visitWorkspaceCurrentSourceContext'),visit:visit&&visit.visitName||null,sourceAvailable:!!(a&&a.sourceAvailable),changed:a?(a.changedPqs.length+a.changedSteps.length):0,removed:a?(a.removedPqs.length+a.removedSteps.length):0,newSteps:a?a.newSteps.length:0};console.log('Ziyaret güncel kaynak senkronizasyon kontrolü:',result);return result;};
})();
