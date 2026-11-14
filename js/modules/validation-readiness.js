(function(){
    'use strict';

    const PATH='icao_validation_readiness';
    const MODULE_VERSION='validation-readiness-v1-phase4';
    const AREAS=['LEG','ORG','PEL','OPS','AIR','AIG','ANS','AGA'];
    let readinessRef=null,readinessCallback=null;
    let activeCandidateKey='';

    window.icaoValidationReadiness=window.icaoValidationReadiness||{};
    window.icaoValidationReadinessLoaded=window.icaoValidationReadinessLoaded===true;

    function actor(){
        try{const u=firebase.auth().currentUser;return u?{uid:u.uid||'',email:u.email||'',displayName:u.displayName||u.email||'Yetkili kullanıcı'}:{uid:'',email:'',displayName:'Oturum yok'};}catch(e){return{uid:'',email:'',displayName:'Oturum yok'};}
    }
    function safeKey(v){return String(v||'').trim().replace(/[.#$\[\]\/]/g,'_').replace(/\s+/g,'_');}
    function areaOf(pq){return String(((pqMasterData||{})[pq]||{}).alan||'').trim().toUpperCase();}
    function usableRows(pq){return (rawData||[]).filter(r=>r&&String(r.pq||'')===String(pq)&&typeof isUsableCapStep==='function'&&isUsableCapStep(r));}
    function evidenceText(row){return String((row&&row.evidenceReference)||'').trim();}
    function latestOfficial(){return typeof window.getLatestOfficialAssessmentSnapshot==='function'?window.getLatestOfficialAssessmentSnapshot():null;}
    function baseTotal(area){return Number((((baseEIData||{})[area]||{}).total)||0)||0;}
    function pct(n){return Number.isFinite(n)?n:0;}
    function normalizedStatus(v){v=String(v||'candidate').toLowerCase();return ['candidate','ready','hold'].includes(v)?v:'candidate';}
    function normalizedEvidence(v){v=String(v||'not_reviewed').toLowerCase();return ['not_reviewed','partial','ready'].includes(v)?v:'not_reviewed';}
    function normalizedReview(v){v=String(v||'pending').toLowerCase();return ['pending','ready','not_required'].includes(v)?v:'pending';}
    function normalizedPriority(v){v=String(v||'normal').toLowerCase();return ['high','normal','low'].includes(v)?v:'normal';}

    function officialMetric(area){
        const latest=latestOfficial();
        const snap=latest&&latest.snapshot;
        if(area==='Overall'){
            const applicable=Number(snap&&snap.overall&&snap.overall.applicable);
            const satisfactory=Number(snap&&snap.overall&&snap.overall.satisfactory);
            const ei=Number(snap&&snap.overall&&snap.overall.ei);
            const fallbackApplicable=Object.values(baseEIData||{}).reduce((s,x)=>s+(Number((x||{}).total)||0),0);
            return {applicable:Number.isFinite(applicable)&&applicable>0?applicable:fallbackApplicable,satisfactory:Number.isFinite(satisfactory)?satisfactory:null,ei:Number.isFinite(ei)?ei:null};
        }
        const a=snap&&snap.areas&&snap.areas[area];
        const applicable=Number(a&&a.applicable),satisfactory=Number(a&&a.satisfactory),ei=Number(a&&a.ei);
        return {applicable:Number.isFinite(applicable)&&applicable>0?applicable:baseTotal(area),satisfactory:Number.isFinite(satisfactory)?satisfactory:null,ei:Number.isFinite(ei)?ei:null};
    }

    function candidateKeyFor(pq,master,link){
        const area=String(master.alan||'').trim().toUpperCase();
        const cid=String((link&&link.pqConceptId)||master.pqConceptId||'').trim();
        return safeKey(cid||`${area}__${pq}`);
    }

    function autoCandidateRows(){
        const pqs=new Set((rawData||[]).map(r=>r&&r.pq).filter(Boolean));
        const out=[];
        for(const pq of pqs){
            const master=(pqMasterData||{})[pq]||{};
            if(master.isIcaoClosed)continue;
            const area=areaOf(pq);if(!AREAS.includes(area))continue;
            const rows=usableRows(pq);if(!rows.length)continue;
            const statuses=rows.map(r=>typeof classifyCommonActionStatus==='function'?classifyCommonActionStatus(r):{code:''});
            const completedCode=((window.COMMON_ACTION_STATUS||{}).COMPLETED||{}).code||'completed';
            const allDone=statuses.length>0&&statuses.every(s=>s&&s.code===completedCode);
            // Eski durum çözümleyicisi geriye dönük emniyet ağıdır.
            const verifiedAllDone=allDone||rows.every(r=>{try{return getStatus(r).type==='done';}catch(e){return false;}});
            if(!verifiedAllDone)continue;
            const link=master.pqLink||rows.find(r=>r&&r.pqLink)?.pqLink||{};
            const key=candidateKeyFor(pq,master,link);
            const stored=(window.icaoValidationReadiness||{})[key]||{};
            const currentRef=link.currentPqRef||master.currentPqRef||null;
            const sourceRef=link.sourcePqRef||null;
            const currentPq=String((currentRef&&currentRef.pq)||pq);
            const evidenceComplete=rows.every(r=>!!evidenceText(r));
            const evidenceCount=rows.filter(r=>!!evidenceText(r)).length;
            let closureDate='';
            try{const info=getPQClosureInfo(pq,rows);if(info&&info.closureDate)closureDate=info.closureDate.toISOString().slice(0,10);}catch(e){}
            const areaMetric=officialMetric(area),overallMetric=officialMetric('Overall');
            const areaDelta=areaMetric.applicable>0?100/areaMetric.applicable:0;
            const overallDelta=overallMetric.applicable>0?100/overallMetric.applicable:0;
            const targetVisitId=String(stored.targetVisitId||'');
            const targetVisit=(typeof getVisitRecords==='function'?getVisitRecords(true):[]).find(v=>String(v.id)===targetVisitId)||null;
            const planningStatus=normalizedStatus(stored.planningStatus);
            const evidencePackageStatus=normalizedEvidence(stored.evidencePackageStatus);
            const internalReviewStatus=normalizedReview(stored.internalReviewStatus);
            const priority=normalizedPriority(stored.priority);
            let effectiveStatus='candidate';
            if(planningStatus==='hold')effectiveStatus='hold';
            else if(targetVisitId)effectiveStatus='assigned';
            else if(planningStatus==='ready')effectiveStatus='ready';
            const technicalReady=(link.status==='linked'||!window.PQLinkage)&&evidenceComplete;
            out.push({
                key,pq,currentPq,area,master,link,sourcePqRef:sourceRef,currentPqRef:currentRef,pqConceptId:link.pqConceptId||master.pqConceptId||'',
                capSteps:rows.length,evidenceCount,evidenceComplete,technicalReady,closureDate,
                planningStatus,evidencePackageStatus,internalReviewStatus,priority,effectiveStatus,
                targetVisitId,targetVisitName:targetVisit?targetVisit.visitName:(stored.targetVisitName||''),targetVisitType:targetVisit?targetVisit.icaoVisitType:(stored.targetVisitType||''),
                notes:String(stored.notes||''),areaDelta,overallDelta,stored
            });
        }
        // Aynı PQ Concept birden fazla tarihsel CAP/PQ numarasıyla görünürse EI'yi iki kez sayma.
        const byKey=new Map();
        for(const row of out){
            const prev=byKey.get(row.key);
            if(!prev){byKey.set(row.key,row);continue;}
            const score=x=>(x.pq===x.currentPq?10000:0)+(x.evidenceComplete?1000:0)+(x.capSteps||0);
            if(score(row)>score(prev))byKey.set(row.key,row);
        }
        return [...byKey.values()].sort((a,b)=>AREAS.indexOf(a.area)-AREAS.indexOf(b.area)||String(a.pq).localeCompare(String(b.pq),undefined,{numeric:true}));
    }

    function statusLabel(s){return({candidate:'Aday',ready:'Hazır',assigned:'Ziyarete Atandı',hold:'Bekletiliyor'})[s]||s;}
    function statusClass(s){return({candidate:'candidate',ready:'ready',assigned:'assigned',hold:'hold'})[s]||'candidate';}
    function evidenceLabel(s){return({not_reviewed:'İncelenmedi',partial:'Kısmi',ready:'Hazır'})[s]||s;}
    function reviewLabel(s){return({pending:'Bekliyor',ready:'Tamam',not_required:'Gerekli değil'})[s]||s;}
    function priorityLabel(s){return({high:'Yüksek',normal:'Normal',low:'Düşük'})[s]||s;}

    function officialVisits(){
        const records=typeof getVisitRecords==='function'?getVisitRecords():[];
        return records.filter(v=>typeof isIcaoOfficialVisit==='function'&&isIcaoOfficialVisit(v)&&!['completed','cancelled'].includes(String(v.status||'')))
            .sort((a,b)=>String(a.plannedStart||'9999').localeCompare(String(b.plannedStart||'9999'))||String(a.visitName||'').localeCompare(String(b.visitName||''),'tr'));
    }

    function targetOptionHtml(selected,area){
        const opts=officialVisits();
        return '<option value="">Atanmadı / Daha sonra</option>'+opts.map(v=>{
            const areas=Array.isArray(v.areas)?v.areas:[];const mismatch=area&&!areas.includes(area);
            const date=v.plannedStart?` · ${v.plannedStart}`:'';const suffix=mismatch?' · alan kapsamda değil':'';
            return `<option value="${escapeHtml(v.id)}" ${String(selected||'')===String(v.id)?'selected':''}>${escapeHtml(v.visitName||'ICAO Ziyareti')}${escapeHtml(date+suffix)}</option>`;
        }).join('');
    }

    function filteredRows(){
        const rows=autoCandidateRows();
        const area=(document.getElementById('validationReadyAreaFilter')||{}).value||'all';
        const status=(document.getElementById('validationReadyStatusFilter')||{}).value||'all';
        const target=(document.getElementById('validationReadyTargetFilter')||{}).value||'all';
        const q=String((document.getElementById('validationReadySearch')||{}).value||'').trim().toLocaleLowerCase('tr');
        return rows.filter(r=>{
            if(area!=='all'&&r.area!==area)return false;
            if(status!=='all'&&r.effectiveStatus!==status)return false;
            if(target==='unassigned'&&r.targetVisitId)return false;
            if(target!=='all'&&target!=='unassigned'&&r.targetVisitId!==target)return false;
            if(q){const hay=[r.pq,r.currentPq,r.area,r.pqConceptId,r.targetVisitName,r.notes,r.master&&r.master.bulgu,r.master&&r.master.soru].join(' ').toLocaleLowerCase('tr');if(!hay.includes(q))return false;}
            return true;
        });
    }

    function areaSummary(rows){
        const map={};
        for(const r of rows){const a=map[r.area]||(map[r.area]={area:r.area,count:0,ready:0,assigned:0,hold:0,overallDelta:0,areaDelta:0});a.count++;if(r.effectiveStatus==='ready')a.ready++;if(r.effectiveStatus==='assigned')a.assigned++;if(r.effectiveStatus==='hold')a.hold++;if(r.effectiveStatus!=='hold'){a.overallDelta+=r.overallDelta;a.areaDelta+=r.areaDelta;}}
        return AREAS.filter(a=>map[a]).map(a=>map[a]);
    }

    function visitPlans(rows){
        const map=new Map(),visits=typeof getVisitRecords==='function'?getVisitRecords(true):[];
        for(const r of rows.filter(x=>x.targetVisitId&&x.effectiveStatus!=='hold')){
            const visit=visits.find(v=>String(v.id)===String(r.targetVisitId))||{};
            if(!map.has(r.targetVisitId))map.set(r.targetVisitId,{id:r.targetVisitId,name:r.targetVisitName||visit.visitName||'ICAO Ziyareti',type:r.targetVisitType||visit.icaoVisitType||'',plannedStart:visit.plannedStart||'',rows:[],delta:0});
            const x=map.get(r.targetVisitId);x.rows.push(r);x.delta+=r.overallDelta;
        }
        let cumulative=0;
        return [...map.values()].sort((a,b)=>String(a.plannedStart||'9999').localeCompare(String(b.plannedStart||'9999'))||String(a.name).localeCompare(String(b.name),'tr')).map(p=>{cumulative+=p.delta;return{...p,cumulativeDelta:cumulative,expectedEi:Math.min(100,latestOfficialEi()+cumulative)};});
    }

    function latestOfficialEi(){const m=officialMetric('Overall');return Number.isFinite(m.ei)?m.ei:0;}

    function populateFilters(rows){
        const area=document.getElementById('validationReadyAreaFilter'),target=document.getElementById('validationReadyTargetFilter');
        if(area){const cur=area.value||'all';area.innerHTML='<option value="all">Tüm alanlar</option>'+AREAS.map(a=>`<option value="${a}">${a}</option>`).join('');if([...area.options].some(o=>o.value===cur))area.value=cur;}
        if(target){const cur=target.value||'all';target.innerHTML='<option value="all">Tüm hedef ziyaretler</option><option value="unassigned">Atanmamış</option>'+officialVisits().map(v=>`<option value="${escapeHtml(v.id)}">${escapeHtml(v.visitName||'ICAO Ziyareti')}</option>`).join('');if([...target.options].some(o=>o.value===cur))target.value=cur;}
    }

    function renderKpis(rows){
        const all=autoCandidateRows(),set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
        const ready=all.filter(r=>r.effectiveStatus==='ready').length,assigned=all.filter(r=>r.effectiveStatus==='assigned').length,hold=all.filter(r=>r.effectiveStatus==='hold').length,evidence=all.filter(r=>r.evidenceComplete).length;
        const projected=all.filter(r=>r.effectiveStatus!=='hold').reduce((s,r)=>s+r.overallDelta,0);
        set('validationReadyKpiTotal',all.length);set('validationReadyKpiReady',ready);set('validationReadyKpiAssigned',assigned);set('validationReadyKpiEvidence',evidence);set('validationReadyKpiHold',hold);set('validationReadyKpiDelta',`+${projected.toFixed(2)}`);
        const context=document.getElementById('validationReadyContext');if(context)context.innerHTML=`Aktif görünüm: <b>${rows.length}</b> aday · Güncel resmî Overall EI <b>%${latestOfficialEi().toFixed(2)}</b> · Bekletilmeyen tüm adayların teorik ilave etkisi <b>+${projected.toFixed(2)} puan</b>.`;
    }

    function renderAreaSummary(rows){
        const el=document.getElementById('validationReadyAreaSummary');if(!el)return;const data=areaSummary(rows);
        el.innerHTML=data.length?data.map(a=>`<div class="validation-area-card"><div class="validation-area-card-head"><b>${a.area}</b><span>${a.count} aday</span></div><div class="validation-area-card-main">+${a.areaDelta.toFixed(2)} <small>alan EI puanı</small></div><div class="validation-area-card-foot"><span>${a.ready} hazır</span><span>${a.assigned} atanmış</span>${a.hold?`<span>${a.hold} bekletiliyor</span>`:''}</div></div>`).join(''):'<div class="validation-empty">Filtreye uygun alan bulunamadı.</div>';
    }

    function renderPlanSummary(rows){
        const el=document.getElementById('validationReadyVisitPlans');if(!el)return;const plans=visitPlans(rows);const current=latestOfficialEi();
        el.innerHTML=plans.length?plans.map(p=>`<div class="validation-plan-card"><div><b>${escapeHtml(p.name)}</b><small>${escapeHtml(p.type||'ICAO')} · ${p.rows.length} PQ</small></div><div class="validation-plan-impact"><strong>+${p.delta.toFixed(2)}</strong><span>Overall EI puanı</span><small>${p.plannedStart?escapeHtml(p.plannedStart)+' · ':''}Kümülatif beklenen EI %${p.expectedEi.toFixed(2)}</small></div><button type="button" class="btn-outline" onclick="openValidationTargetVisit('${escapeHtml(p.id)}')">Ziyareti Aç</button></div>`).join(''):'<div class="validation-empty">Henüz bir ICAO ziyaretine atanmış validasyon adayı bulunmuyor.</div>';
    }

    function readinessFlags(r){
        const flags=[];
        flags.push(`<span class="validation-flag ${r.link.status==='linked'?'ok':'warn'}">PQ bağlantısı: ${escapeHtml(r.link.status||'yok')}</span>`);
        flags.push(`<span class="validation-flag ${r.evidenceComplete?'ok':'warn'}">Kanıt ref.: ${r.evidenceCount}/${r.capSteps}</span>`);
        flags.push(`<span class="validation-flag ${r.evidencePackageStatus==='ready'?'ok':r.evidencePackageStatus==='partial'?'warn':''}">Kanıt paketi: ${escapeHtml(evidenceLabel(r.evidencePackageStatus))}</span>`);
        flags.push(`<span class="validation-flag ${['ready','not_required'].includes(r.internalReviewStatus)?'ok':'warn'}">İç inceleme: ${escapeHtml(reviewLabel(r.internalReviewStatus))}</span>`);
        return flags.join('');
    }

    function renderTable(rows){
        const body=document.getElementById('validationReadyTableBody');if(!body)return;
        if(!rows.length){body.innerHTML='<tr><td colspan="8" class="validation-empty">Filtreye uygun validasyon adayı bulunamadı.</td></tr>';return;}
        body.innerHTML=rows.map(r=>{
            const renumbered=r.currentPq&&r.currentPq!==r.pq;
            return `<tr>
                <td><b>PQ ${escapeHtml(r.pq)}</b>${renumbered?`<br><span class="validation-renumber">→ Aktif PQ ${escapeHtml(r.currentPq)}</span>`:''}<br><small>${escapeHtml(r.pqConceptId||'Concept yok')}</small></td>
                <td><span class="visit-area-chip">${escapeHtml(r.area)}</span><br><small>CAP tamamlanma: ${escapeHtml(r.closureDate||'-')}</small></td>
                <td><span class="validation-status ${statusClass(r.effectiveStatus)}">${escapeHtml(statusLabel(r.effectiveStatus))}</span><br><span class="validation-priority ${r.priority}">${escapeHtml(priorityLabel(r.priority))} öncelik</span></td>
                <td><div class="validation-flags">${readinessFlags(r)}</div></td>
                <td>${r.targetVisitId?`<b>${escapeHtml(r.targetVisitName||'ICAO Ziyareti')}</b><br><small>${escapeHtml(r.targetVisitType||'')}</small>`:'<span style="color:var(--muted)">Atanmadı</span>'}</td>
                <td><b>+${r.overallDelta.toFixed(2)}</b><br><small>Overall</small></td>
                <td><b>+${r.areaDelta.toFixed(2)}</b><br><small>${escapeHtml(r.area)}</small></td>
                <td><div class="validation-row-actions"><button type="button" onclick="openValidationReadinessEditor('${escapeHtml(r.key)}')">✏️ Hazırlık</button><button type="button" class="btn-outline" onclick="openValidationCandidatePq('${escapeHtml(r.pq)}')">PQ/CAP</button><button type="button" class="btn-outline" onclick="openDriveDocumentsContext({pq:'${escapeHtml(r.pq)}',area:'${escapeHtml(r.area)}'})">📎 Kanıtlar${window.ICADriveDocuments&&typeof window.ICADriveDocuments.countForPq==='function'?` (${window.ICADriveDocuments.countForPq(r.pq)})`:''}</button></div></td>
            </tr>`;
        }).join('');
    }

    window.renderValidationReadiness=function(){
        const all=autoCandidateRows();populateFilters(all);const rows=filteredRows();renderKpis(rows);renderAreaSummary(rows);renderPlanSummary(rows);renderTable(rows);window.renderValidationReadinessDashboardSummary();
    };

    window.renderValidationReadinessDashboardSummary=function(){
        const el=document.getElementById('validationReadinessDashboardSummary');if(!el)return;const rows=autoCandidateRows(),assigned=rows.filter(r=>r.effectiveStatus==='assigned'),ready=rows.filter(r=>r.effectiveStatus==='ready'),unassigned=rows.filter(r=>!r.targetVisitId&&r.effectiveStatus!=='hold'),plans=visitPlans(rows);const current=latestOfficialEi();
        if(!rows.length){el.innerHTML='<div class="validation-dashboard-empty">Tüm CAP adımları tamamlanmış ve ICAO validasyonu bekleyen PQ bulunmuyor.</div>';return;}
        const assignedDelta=assigned.reduce((s,r)=>s+r.overallDelta,0),poolDelta=rows.filter(r=>r.effectiveStatus!=='hold').reduce((s,r)=>s+r.overallDelta,0);
        el.innerHTML=`<div class="validation-dashboard-head"><div><b>🎯 Validasyon Hazırlığı</b><span>${rows.length} aday PQ · ${assigned.length} ziyarete atanmış · ${unassigned.length} atanmamış</span></div><button type="button" class="btn-outline" onclick="switchTab('validation-readiness')">Hazırlık Merkezini Aç</button></div><div class="validation-dashboard-grid"><div><strong>${ready.length}</strong><span>Hazır</span></div><div><strong>${assigned.length}</strong><span>Atanmış</span></div><div><strong>+${assignedDelta.toFixed(2)}</strong><span>Atanmış beklenen EI etkisi</span></div><div><strong>%${Math.min(100,current+assignedDelta).toFixed(2)}</strong><span>Atanmışlar başarılı olursa</span></div><div><strong>+${poolDelta.toFixed(2)}</strong><span>Tüm aday havuzu potansiyeli</span></div></div>${plans.length?`<div class="validation-dashboard-plans">${plans.slice(0,4).map(p=>`<span><b>${escapeHtml(p.name)}</b> · ${p.rows.length} PQ · +${p.delta.toFixed(2)}</span>`).join('')}</div>`:''}`;
    };

    window.getValidationCandidateRows=function(){return autoCandidateRows();};
    window.getValidationReadinessSummary=function(){const rows=autoCandidateRows();return{total:rows.length,ready:rows.filter(r=>r.effectiveStatus==='ready').length,assigned:rows.filter(r=>r.effectiveStatus==='assigned').length,hold:rows.filter(r=>r.effectiveStatus==='hold').length,unassigned:rows.filter(r=>!r.targetVisitId&&r.effectiveStatus!=='hold').length,overallPotential:rows.filter(r=>r.effectiveStatus!=='hold').reduce((s,r)=>s+r.overallDelta,0)};};

    window.openValidationReadinessEditor=function(key){
        const row=autoCandidateRows().find(r=>r.key===key);if(!row)return;activeCandidateKey=key;
        const set=(id,v)=>{const e=document.getElementById(id);if(e)e.value=v??'';};
        set('validationReadyEditKey',key);set('validationReadyEditPq',`PQ ${row.pq}${row.currentPq!==row.pq?` → ${row.currentPq}`:''}`);set('validationReadyEditArea',row.area);
        set('validationReadyPlanningStatus',row.planningStatus);set('validationReadyEvidenceStatus',row.evidencePackageStatus);set('validationReadyReviewStatus',row.internalReviewStatus);set('validationReadyPriority',row.priority);set('validationReadyTargetVisit',row.targetVisitId);set('validationReadyNotes',row.notes);
        const target=document.getElementById('validationReadyTargetVisit');if(target)target.innerHTML=targetOptionHtml(row.targetVisitId,row.area);
        const auto=document.getElementById('validationReadyAutoInfo');if(auto)auto.innerHTML=`<b>Otomatik kontrol:</b> ${row.capSteps}/${row.capSteps} CAP adımı tamamlandı · Kanıt referansı ${row.evidenceCount}/${row.capSteps} · PQ bağlantısı ${escapeHtml(row.link.status||'yok')} · Teorik etki Overall +${row.overallDelta.toFixed(2)} / ${row.area} +${row.areaDelta.toFixed(2)} puan.`;
        const modal=document.getElementById('validationReadinessModal');if(modal)modal.style.display='block';
    };
    window.closeValidationReadinessEditor=function(){const m=document.getElementById('validationReadinessModal');if(m)m.style.display='none';activeCandidateKey='';};

    function candidateScopeSnapshot(row){
        const master=row.master||{};const now=new Date().toISOString();
        return {pq:row.pq,area:row.area,ce:master.ce||'',responsible:master.sorumlu||'',verificationType:master.tur||'',question:master.soru||master.question||'',questionTr:master.soruTr||master.questionTr||'',finding:master.bulgu||master.finding||'',findingTr:master.bulguTr||master.findingTr||'',reviewEvidence:master.reviewEvidence||'',statusCode:'cap_completed',statusLabel:'CAP Tamamlandı / Validasyon Adayı',pqConceptId:row.pqConceptId||'',pqLinkStatus:row.link.status||'',sourcePqRef:row.sourcePqRef||null,currentPqRef:row.currentPqRef||null,validationCandidateKey:row.key,snapshotAt:now};
    }
    function candidateStepSnapshots(row){
        const now=new Date().toISOString();return usableRows(row.pq).map(a=>({key:typeof makeActionKey==='function'?makeActionKey(a.pq||row.pq,a.step||'',a.action||''):`${row.pq}|${a.step||''}`,pq:row.pq,step:a.step||'',action:a.action||'',office:a.office||'',evidenceReference:a.evidenceReference||'',estDate:a.estDate||'',progress:a.progress||'',statusCode:'completed',statusLabel:'Tamamlandı',sourceFile:a.sourceFile||'',snapshotAt:now,validationCandidateKey:row.key}));
    }

    async function syncAssignmentToVisit(row,oldVisitId,newVisitId,updates){
        const now=new Date().toISOString(),who=actor();
        if(oldVisitId&&oldVisitId!==newVisitId)updates[`icao_visits/${oldVisitId}/validationCandidateAssignments/${row.key}`]=null;
        if(!newVisitId)return;
        const visit=(typeof getVisitRecords==='function'?getVisitRecords(true):[]).find(v=>String(v.id)===String(newVisitId));if(!visit)throw new Error('Hedef ICAO ziyareti bulunamadı.');
        const areas=Array.isArray(visit.areas)?[...visit.areas]:[];
        if(!areas.includes(row.area)){
            if(!confirm(`${row.area} denetim alanı hedef ziyaret kapsamında değil. Bu alan ziyaret kapsamına eklensin mi?`))throw new Error('Atama iptal edildi: ziyaret alan kapsamı güncellenmedi.');
            areas.push(row.area);updates[`icao_visits/${newVisitId}/areas`]=areas;
        }
        updates[`icao_visits/${newVisitId}/validationCandidateAssignments/${row.key}`]={candidateKey:row.key,pq:row.pq,currentPq:row.currentPq,area:row.area,pqConceptId:row.pqConceptId||'',assignedAt:now,assignedBy:who,moduleVersion:MODULE_VERSION};
        const scope=visit.scope||{},pqs=Array.isArray(scope.pqs)?[...scope.pqs]:[],steps=Array.isArray(scope.steps)?[...scope.steps]:[];
        if(!pqs.some(p=>p&&String(p.validationCandidateKey||'')===row.key||String(p.pq||'')===row.pq))pqs.push(candidateScopeSnapshot(row));
        const existingStepKeys=new Set(steps.map(s=>String((s||{}).key||'')));
        for(const step of candidateStepSnapshots(row))if(!existingStepKeys.has(String(step.key)))steps.push(step);
        updates[`icao_visits/${newVisitId}/scope/pqs`]=pqs;updates[`icao_visits/${newVisitId}/scope/steps`]=steps;updates[`icao_visits/${newVisitId}/scope/updatedAt`]=now;updates[`icao_visits/${newVisitId}/scope/updatedBy`]=who;updates[`icao_visits/${newVisitId}/scope/moduleVersion`]='visit-package-2+validation-readiness';
    }

    window.saveValidationReadinessEditor=async function(event){
        if(event)event.preventDefault();if(!firebase.auth().currentUser)return alert('Kayıt için yetkili giriş gereklidir.');
        const row=autoCandidateRows().find(r=>r.key===activeCandidateKey);if(!row)return alert('Validasyon adayı artık mevcut değil.');
        const old=(window.icaoValidationReadiness||{})[row.key]||{},targetVisitId=String((document.getElementById('validationReadyTargetVisit')||{}).value||'');
        const requestedStatus=normalizedStatus((document.getElementById('validationReadyPlanningStatus')||{}).value),requestedEvidence=normalizedEvidence((document.getElementById('validationReadyEvidenceStatus')||{}).value),requestedReview=normalizedReview((document.getElementById('validationReadyReviewStatus')||{}).value);
        if(requestedStatus==='ready'&&(row.link.status!=='linked'||requestedEvidence!=='ready'||!['ready','not_required'].includes(requestedReview))){
            if(!confirm('Bu PQ “Validasyona Hazır” olarak işaretleniyor; ancak PQ bağlantısı, kanıt paketi veya iç inceleme kontrollerinden en az biri tam değil. Yine de kaydedilsin mi?'))return;
        }
        const now=new Date().toISOString(),who=actor(),targetVisit=(typeof getVisitRecords==='function'?getVisitRecords(true):[]).find(v=>String(v.id)===targetVisitId)||null;
        const payload={schemaVersion:1,candidateKey:row.key,pqConceptId:row.pqConceptId||'',sourcePq:row.pq,currentPq:row.currentPq,area:row.area,planningStatus:requestedStatus,evidencePackageStatus:requestedEvidence,internalReviewStatus:requestedReview,priority:normalizedPriority((document.getElementById('validationReadyPriority')||{}).value),targetVisitId,targetVisitName:targetVisit?targetVisit.visitName:'',targetVisitType:targetVisit?targetVisit.icaoVisitType:'',notes:String((document.getElementById('validationReadyNotes')||{}).value||'').trim(),sourcePqRef:row.sourcePqRef||null,currentPqRef:row.currentPqRef||null,updatedAt:now,updatedBy:who,createdAt:old.createdAt||now,createdBy:old.createdBy||who,moduleVersion:MODULE_VERSION};
        const updates={};updates[`${PATH}/${row.key}`]=payload;
        try{await syncAssignmentToVisit(row,String(old.targetVisitId||''),targetVisitId,updates);await db.ref().update(updates);window.closeValidationReadinessEditor();if(typeof showAppRuntimeToast==='function')showAppRuntimeToast('Validasyon hazırlığı kaydedildi.','success');}
        catch(err){console.error(err);alert('Validasyon hazırlığı kaydedilemedi: '+(err.message||err));}
    };

    window.openValidationTargetVisit=function(id){switchTab('icao-visit-validation');setTimeout(()=>{if(typeof openIcaoOfficialVisitValidation==='function')openIcaoOfficialVisitValidation(id);else{const s=document.getElementById('icaoOfficialVisitSelect');if(s){s.value=id;renderIcaoOfficialVisitModule();}}},60);};
    window.openValidationCandidatePq=function(pq){switchTab('list');setTimeout(()=>{try{window.togglePQ(String(pq||'').replace(/\./g,'-'));}catch(e){}},50);};
    window.createValidationTargetVisit=function(){switchTab('visits');setTimeout(()=>{if(typeof openVisitForm==='function'){openVisitForm();const t=document.getElementById('visitType');if(t){t.value='icao_official';if(typeof toggleVisitTypeFields==='function')toggleVisitTypeFields();}}},40);};

    window.exportValidationReadinessExcel=function(){
        if(typeof XLSX==='undefined')return alert('Excel kitaplığı yüklenemedi.');const rows=filteredRows();const wb=XLSX.utils.book_new();
        const detail=rows.map(r=>({'PQ':r.pq,'Aktif PQ':r.currentPq,'Alan':r.area,'PQ Concept':r.pqConceptId,'Durum':statusLabel(r.effectiveStatus),'Öncelik':priorityLabel(r.priority),'CAP Adımı':r.capSteps,'Kanıt Referansı':`${r.evidenceCount}/${r.capSteps}`,'Kanıt Paketi':evidenceLabel(r.evidencePackageStatus),'İç İnceleme':reviewLabel(r.internalReviewStatus),'Hedef Ziyaret':r.targetVisitName||'','Overall EI Etkisi':Number(r.overallDelta.toFixed(4)),'Alan EI Etkisi':Number(r.areaDelta.toFixed(4)),'Not':r.notes}));
        XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(detail),'Validasyon_Adaylari');
        XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(areaSummary(rows).map(a=>({'Alan':a.area,'Aday':a.count,'Hazır':a.ready,'Atanmış':a.assigned,'Bekletilen':a.hold,'Overall EI Etkisi':Number(a.overallDelta.toFixed(4)),'Alan EI Etkisi':Number(a.areaDelta.toFixed(4))}))),'Alan_Ozeti');
        XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(visitPlans(rows).map(p=>({'Hedef Ziyaret':p.name,'Tür':p.type,'PQ Sayısı':p.rows.length,'Overall EI Etkisi':Number(p.delta.toFixed(4)),'Planlanan Başlangıç':p.plannedStart||'','Bu Ziyaret EI Etkisi':Number(p.delta.toFixed(4)),'Kümülatif EI Etkisi':Number(p.cumulativeDelta.toFixed(4)),'Kümülatif Beklenen EI':Number(p.expectedEi.toFixed(2))}))),'Ziyaret_Planlari');
        XLSX.writeFile(wb,`Validasyon_Hazirligi_${new Date().toISOString().slice(0,10)}.xlsx`);
    };

    window.exportValidationReadinessPDF=function(){
        if(typeof pdfMake==='undefined')return alert('PDF kitaplığı yüklenemedi.');
        const rows=filteredRows();if(!rows.length)return alert('PDF için validasyon adayı bulunamadı.');
        const plans=visitPlans(rows),summary=window.getValidationReadinessSummary();
        const body=[[{text:'PQ',bold:true},{text:'Alan',bold:true},{text:'Hazırlık',bold:true},{text:'Kanıt / İnceleme',bold:true},{text:'Hedef Ziyaret',bold:true},{text:'Overall EI',bold:true},{text:'Alan EI',bold:true}]];
        rows.forEach(r=>body.push([`PQ ${r.pq}${r.currentPq!==r.pq?` → ${r.currentPq}`:''}`,r.area,statusLabel(r.effectiveStatus),`Kanıt ref. ${r.evidenceCount}/${r.capSteps}\nPaket: ${evidenceLabel(r.evidencePackageStatus)}\nİç: ${reviewLabel(r.internalReviewStatus)}`,r.targetVisitName||'Atanmadı',`+${r.overallDelta.toFixed(2)}`,`+${r.areaDelta.toFixed(2)}`]));
        const content=[{text:'Validasyon Hazırlığı Merkezi',fontSize:17,bold:true,color:'#2563eb',margin:[0,0,0,4]},{text:`Rapor tarihi: ${new Date().toLocaleDateString('tr-TR')} | ${summary.total} aday | ${summary.assigned} atanmış | Teorik Overall etki +${summary.overallPotential.toFixed(2)} puan`,fontSize:9,color:'#64748b',margin:[0,0,0,12]}];
        if(plans.length){content.push({text:'Hedef Ziyaret Planları',fontSize:12,bold:true,margin:[0,6,0,5]});plans.forEach(p=>content.push({text:`${p.name} · ${p.rows.length} PQ · bu ziyaret +${p.delta.toFixed(2)} · kümülatif beklenen EI %${p.expectedEi.toFixed(2)}`,fontSize:9,margin:[0,2,0,2]}));}
        content.push({text:'Validasyon Adayları',fontSize:12,bold:true,margin:[0,10,0,6]},{table:{headerRows:1,widths:['auto','auto','auto','*','*','auto','auto'],body},layout:'lightHorizontalLines'});
        const doc={pageOrientation:'landscape',pageSize:'A4',content,defaultStyle:{font:'Roboto',fontSize:8},footer:(c,n)=>({text:`${c} / ${n}`,alignment:'right',margin:[0,0,25,0],fontSize:8,color:'#64748b'})};
        if(typeof safeDownloadPdf==='function')safeDownloadPdf(doc,'Validasyon_Hazirligi.pdf');else pdfMake.createPdf(doc).download('Validasyon_Hazirligi.pdf');
    };

    window.startValidationReadinessListener=function(){
        window.stopValidationReadinessListener();window.icaoValidationReadinessLoaded=false;
        if(!firebase.auth().currentUser){window.renderValidationReadinessDashboardSummary();return;}
        readinessRef=db.ref(PATH);readinessCallback=snap=>{window.icaoValidationReadiness=snap.val()||{};window.icaoValidationReadinessLoaded=true;window.renderValidationReadiness();if(typeof window.renderManagementFlow==='function')window.renderManagementFlow();if(typeof window.refreshCapHubSummary==='function')window.refreshCapHubSummary();if(document.getElementById('tab-assessment-impact')?.classList.contains('active')&&typeof window.renderAssessmentImpactCenter==='function')setTimeout(()=>window.renderAssessmentImpactCenter(),0);if(typeof window.renderSystemIntegrityCenter==='function'&&document.getElementById('tab-quality')?.classList.contains('active'))setTimeout(()=>window.renderSystemIntegrityCenter(true),0);};
        readinessRef.on('value',readinessCallback,err=>{console.error('Validasyon hazırlığı okunamadı:',err);window.icaoValidationReadinessLoaded=true;window.renderValidationReadiness();if(typeof window.renderManagementFlow==='function')window.renderManagementFlow();});
    };
    window.stopValidationReadinessListener=function(){if(readinessRef&&readinessCallback)readinessRef.off('value',readinessCallback);readinessRef=null;readinessCallback=null;window.icaoValidationReadiness={};window.icaoValidationReadinessLoaded=false;};

    window.runValidationReadinessSelfCheck=function(){const rows=autoCandidateRows(),result={passed:!!document.getElementById('tab-validation-readiness')&&typeof window.renderValidationReadiness==='function'&&typeof window.saveValidationReadinessEditor==='function',candidates:rows.length,ready:rows.filter(r=>r.effectiveStatus==='ready').length,assigned:rows.filter(r=>r.effectiveStatus==='assigned').length,path:PATH,moduleVersion:MODULE_VERSION};console.log('Validasyon Hazırlığı öz denetimi:',result);return result;};

    document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{window.renderValidationReadinessDashboardSummary();},0));
})();
