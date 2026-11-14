(function(){
    'use strict';

    const AREAS=['LEG','ORG','PEL','OPS','AIR','AIG','ANS','AGA'];
    const MODULE_VERSION='assessment-impact-v1-phase10';
    let selectedPeriodId='';

    function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
    function num(v){if(v===null||v===undefined||String(v).trim()==='')return null;const n=Number(String(v).replace(',','.'));return Number.isFinite(n)?Math.round(n*100)/100:null;}
    function int(v){const n=Number(v);return Number.isFinite(n)?Math.round(n):null;}
    function dateLabel(v){if(!v)return'-';const d=new Date(String(v).length===10?v+'T00:00:00':v);return isNaN(d)?String(v):d.toLocaleDateString('tr-TR',{day:'2-digit',month:'short',year:'numeric'});}
    function pct(v){const n=num(v);return n===null?'-':`%${n.toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2})}`;}
    function delta(v){const n=num(v);return n===null?'-':`${n>0?'+':''}${n.toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2})} puan`;}
    function eventDate(r){return r&&String(r.assessmentDate||r.endDate||r.startDate||'')||'';}
    function eventName(r){return String(r&&r.name||r&&r.type||'ICAO Değerlendirmesi');}
    function scopeOf(r){const raw=(r&&r.scopeAreas)||(r&&r.snapshot&&r.snapshot.scopeAreas)||[];const list=Array.isArray(raw)?raw:[];return AREAS.filter(a=>list.map(x=>String(x).toUpperCase()).includes(a));}
    function metric(r,area){try{return typeof window.getAssessmentMetricValue==='function'?window.getAssessmentMetricValue(r,area):null;}catch(e){return null;}}
    function inScope(r,area){try{return typeof window.isAreaInAssessmentScope==='function'?window.isAreaInAssessmentScope(r,area):scopeOf(r).includes(area);}catch(e){return scopeOf(r).includes(area);}}
    function officialRows(){try{return typeof window.getOfficialAssessmentTimelineWithSnapshots==='function'?(window.getOfficialAssessmentTimelineWithSnapshots()||[]):[];}catch(e){return[];}}
    function allRows(){try{return typeof window.getAssessmentTimelineWithSnapshots==='function'?(window.getAssessmentTimelineWithSnapshots()||[]):[];}catch(e){return[];}}
    function snapshotCount(r,area,key){
        const s=r&&r.snapshot;if(!s)return null;
        const obj=area==='Overall'?s.overall:(s.areas||{})[area];
        return obj?int(obj[key]):null;
    }
    function versionKey(r){return [String(r&&r.pqVersion||'').trim(),String(r&&r.pqRevision||'').trim()].filter(Boolean).join(' / ');}
    function versionChanged(a,b){const av=String(a&&a.pqVersion||'').trim(),bv=String(b&&b.pqVersion||'').trim(),ar=String(a&&a.pqRevision||'').trim(),br=String(b&&b.pqRevision||'').trim();if(!av&&!bv&&!ar&&!br)return false;return av!==bv||ar!==br;}
    function effectiveAreaAt(rows,index,area){
        let value=null,last=null;
        for(let i=0;i<=index;i++){
            const r=rows[i],v=metric(r,area),allowed=i===0||inScope(r,area);
            if(v!==null&&allowed){value=v;last=r;}
        }
        return {value,last};
    }
    function lastAreaAssessment(rows,index,area){
        for(let i=index;i>=0;i--){const r=rows[i];if((i===0||inScope(r,area))&&metric(r,area)!==null)return r;}return null;
    }
    function visitForEvent(row){
        const id=String(row&&row.linkedOfficialEiRecordId||row&&row.sourceRecordId||'');
        const rec=(window.icaoOfficialEiRecords||{})[id]||{};
        const visitId=String(rec&&rec.automation&&rec.automation.visitId||'');
        let visit=null;
        try{if(visitId&&typeof icaoVisits!=='undefined'&&icaoVisits[visitId])visit={id:visitId,...icaoVisits[visitId]};}catch(e){}
        return {record:rec,visitId,visit};
    }
    function changedPqsForEvent(row){
        const link=visitForEvent(row),visit=link.visit;if(!visit)return[];
        const records=Object.values((((visit||{}).icaoValidation||{}).records)||{}).filter(x=>x&&!x.isDeleted&&x.status==='validated');
        return records.map(r=>({pq:String(r.pq||''),area:String(r.area||'').toUpperCase(),status:r.status,resultDate:r.resultDate||'',comment:r.icaoComment||'',visitId:link.visitId,visitName:visit.visitName||visit.title||visit.name||''})).filter(x=>x.pq);
    }
    function methodology(prev,curr){
        if(!prev)return{code:'baseline',label:'Başlangıç / baseline',detail:'İlk resmî değerlendirme; değişim ayrıştırması uygulanmaz.',className:'baseline'};
        const pv=versionChanged(prev,curr),pa=snapshotCount(prev,'Overall','applicable'),ca=snapshotCount(curr,'Overall','applicable');
        const denomChanged=pa!==null&&ca!==null&&pa!==ca;
        if(pv||denomChanged){
            const reasons=[];if(pv)reasons.push(`PQ sürüm/revizyonu ${versionKey(prev)||'belirsiz'} → ${versionKey(curr)||'belirsiz'}`);if(denomChanged)reasons.push(`Applicable denominator ${pa} → ${ca}`);
            return{code:'mixed',label:'Karma etki / metodoloji değişimi',detail:`${reasons.join(' · ')}. Snapshot verisi tek başına EI farkını performans ve metodoloji etkisi olarak sayısal biçimde ayıramaz.`,className:'mixed'};
        }
        if(pa===null||ca===null)return{code:'uncertain',label:'Karşılaştırma zemini eksik',detail:'Applicable denominator eksik olduğu için farkın yalnız performanstan kaynaklandığı doğrulanamaz.',className:'uncertain'};
        return{code:'performance',label:'Karşılaştırılabilir performans değişimi',detail:'PQ sürüm/revizyonu ve applicable denominator aynı görünüyor; EI farkı aynı karşılaştırma zemini üzerinde değerlendirilir.',className:'performance'};
    }
    function buildPeriods(rows){
        return rows.map((curr,index)=>{
            const prev=index?rows[index-1]:null;
            const before=prev?metric(prev,'Overall'):null,after=metric(curr,'Overall');
            const overallDelta=prev&&before!==null&&after!==null?Math.round((after-before)*100)/100:null;
            const areaRows=AREAS.map(area=>{
                const beforeState=index?effectiveAreaAt(rows,index-1,area):{value:null,last:null};
                const afterState=effectiveAreaAt(rows,index,area);
                const currentScope=index===0||inScope(curr,area);
                const currentDirect=metric(curr,area);
                const d=beforeState.value!==null&&afterState.value!==null?Math.round((afterState.value-beforeState.value)*100)/100:null;
                const currentLast=lastAreaAssessment(rows,index,area);
                const beforeLast=index?lastAreaAssessment(rows,index-1,area):null;
                return{area,before:beforeState.value,after:afterState.value,delta:d,inScope:currentScope,directValue:currentDirect,lastAssessment:currentLast,beforeLastAssessment:beforeLast,reassessed:currentScope&&currentDirect!==null,applicable:snapshotCount(curr,area,'applicable'),satisfactory:snapshotCount(curr,area,'satisfactory')};
            });
            const meth=methodology(prev,curr),pqChanges=changedPqsForEvent(curr);
            return{id:curr.id,index,prev,curr,before,after,delta:overallDelta,scope:scopeOf(curr),methodology:meth,pqChanges,areaRows,overallApplicable:snapshotCount(curr,'Overall','applicable'),overallSatisfactory:snapshotCount(curr,'Overall','satisfactory'),previousApplicable:prev?snapshotCount(prev,'Overall','applicable'):null,previousSatisfactory:prev?snapshotCount(prev,'Overall','satisfactory'):null};
        });
    }
    function pendingRows(){return allRows().filter(r=>r&&r.snapshot&&!r.isDeleted&&String(r.resultStatus||r.snapshot.resultStatus||'').toLowerCase()!=='official').sort((a,b)=>eventDate(a).localeCompare(eventDate(b)));}
    function candidateModel(latest){
        let rows=[];try{rows=typeof window.getValidationCandidateRows==='function'?(window.getValidationCandidateRows()||[]):[];}catch(e){}
        const lastDate=eventDate(latest);
        const since=rows.filter(r=>{const d=String(r.closureDate||r.stored&&r.stored.updatedAt||'');return !lastDate||!d||d.slice(0,10)>=lastDate.slice(0,10);});
        const active=rows.filter(r=>r.effectiveStatus!=='hold'),assigned=rows.filter(r=>r.effectiveStatus==='assigned'),ready=rows.filter(r=>r.effectiveStatus==='ready');
        return{rows,since,active,assigned,ready,potential:active.reduce((s,r)=>s+(Number(r.overallDelta)||0),0),assignedPotential:assigned.reduce((s,r)=>s+(Number(r.overallDelta)||0),0)};
    }
    function buildModel(){
        const rows=officialRows(),periods=buildPeriods(rows),latest=rows.length?rows[rows.length-1]:null,first=rows.length?rows[0]:null;
        const latestEi=latest?metric(latest,'Overall'):null,firstEi=first?metric(first,'Overall'):null;
        const totalDelta=latestEi!==null&&firstEi!==null?Math.round((latestEi-firstEi)*100)/100:null;
        const candidates=candidateModel(latest),pending=pendingRows();
        const areaCurrent=AREAS.map(area=>{const state=rows.length?effectiveAreaAt(rows,rows.length-1,area):{value:null,last:null};return{area,value:state.value,last:state.last};});
        return{rows,periods,latest,first,latestEi,firstEi,totalDelta,candidates,pending,areaCurrent,moduleVersion:MODULE_VERSION};
    }
    window.getAssessmentImpactModel=buildModel;

    function choosePeriod(model){
        const valid=new Set(model.periods.map(p=>p.id));if(!selectedPeriodId||!valid.has(selectedPeriodId))selectedPeriodId=model.periods.length?model.periods[model.periods.length-1].id:'';
        return model.periods.find(p=>p.id===selectedPeriodId)||null;
    }
    function methodologyHtml(m){return `<div class="assessment-impact-method ${esc(m.className)}"><b>${esc(m.label)}</b><span>${esc(m.detail)}</span></div>`;}
    function timelineHtml(model){
        if(!model.rows.length)return'<div class="assessment-impact-empty">Henüz resmî Assessment Event / EI Snapshot kaydı bulunmuyor.</div>';
        return model.rows.map((r,i)=>{const v=metric(r,'Overall'),p=i?model.periods[i]:null;return `<button type="button" class="assessment-impact-event ${selectedPeriodId===r.id?'active':''}" onclick="changeAssessmentImpactPeriod('${esc(r.id)}')"><span class="assessment-impact-event-order">${i+1}</span><b>${esc(eventName(r))}</b><strong>${pct(v)}</strong><small>${esc(dateLabel(eventDate(r)))}</small>${p&&p.delta!==null?`<em class="${p.delta>0?'pos':p.delta<0?'neg':''}">${delta(p.delta)}</em>`:'<em>Baseline</em>'}</button>`;}).join('');
    }
    function periodOverviewHtml(p){
        if(!p)return'<div class="assessment-impact-empty">Karşılaştırılacak resmî değerlendirme dönemi bulunmuyor.</div>';
        const from=p.prev?`${eventName(p.prev)} · ${dateLabel(eventDate(p.prev))}`:'Başlangıç';
        return `<div class="assessment-impact-period-head"><div><span>Seçili dönem</span><h3>${esc(from)} → ${esc(eventName(p.curr))}</h3><p>${esc(dateLabel(eventDate(p.curr)))} · Kapsam: ${p.scope.length?p.scope.join(', '):'Tanımlı değil'}</p></div><div class="assessment-impact-period-kpis"><div><span>Önceki EI</span><b>${pct(p.before)}</b></div><div><span>Sonuç EI</span><b>${pct(p.after)}</b></div><div><span>Net değişim</span><b class="${(p.delta||0)>0?'pos':(p.delta||0)<0?'neg':''}">${delta(p.delta)}</b></div><div><span>Applicable</span><b>${p.previousApplicable??'-'} → ${p.overallApplicable??'-'}</b></div></div></div>${methodologyHtml(p.methodology)}`;
    }
    function areaTableHtml(p){
        if(!p)return'';
        const rows=p.areaRows.map(a=>`<tr><td><b>${a.area}</b></td><td>${pct(a.before)}</td><td>${pct(a.after)}</td><td class="${(a.delta||0)>0?'pos':(a.delta||0)<0?'neg':''}">${a.reassessed?delta(a.delta):'<span class="muted">Yeniden değerlendirilmedi</span>'}</td><td>${a.reassessed?'<span class="assessment-impact-pill ok">Kapsamda</span>':'<span class="assessment-impact-pill muted">Kapsam dışı</span>'}</td><td>${a.satisfactory??'-'} / ${a.applicable??'-'}</td><td>${a.lastAssessment?`${esc(eventName(a.lastAssessment))}<br><small>${esc(dateLabel(eventDate(a.lastAssessment)))}</small>`:'-'}</td></tr>`).join('');
        return `<div class="assessment-impact-table-wrap"><table class="assessment-impact-table"><thead><tr><th>Alan</th><th>Dönem Öncesi Etkin EI</th><th>Dönem Sonrası Etkin EI</th><th>Değişim</th><th>${esc(p.curr.type||'ICAO')} kapsamı</th><th>S / Applicable</th><th>Son Resmî Değerlendirme</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    }
    function pqChangeHtml(p){
        if(!p)return'';
        if(!p.pqChanges.length)return `<div class="assessment-impact-note"><b>PQ bazlı değişim:</b> Bu değerlendirme için izlenebilir ziyaret-validasyon kaydı bulunmadığından değişen PQ listesi tahmin edilmedi. Alan/Overall EI değişimleri snapshot verisinden gösterilmeye devam eder.</div>`;
        return `<div class="assessment-impact-pq-list"><div class="assessment-impact-section-title"><h3>Bu değerlendirmede izlenebilir şekilde valide edilen PQ'lar</h3><span>${p.pqChanges.length} PQ</span></div>${p.pqChanges.map(x=>`<div class="assessment-impact-pq"><span class="visit-area-chip">${esc(x.area||'-')}</span><b>PQ ${esc(x.pq)}</b><small>${esc(x.resultDate||'')} ${x.comment?'· '+esc(x.comment):''}</small></div>`).join('')}</div>`;
    }
    function sinceLastHtml(model){
        const c=model.candidates,latest=model.latest;
        const current=model.latestEi===null?0:model.latestEi,projected=Math.min(100,current+c.active.reduce((s,r)=>s+(Number(r.overallDelta)||0),0));
        const areas=AREAS.map(area=>{const rows=c.active.filter(r=>r.area===area),last=model.areaCurrent.find(x=>x.area===area)?.last;return{area,count:rows.length,delta:rows.reduce((s,r)=>s+(Number(r.overallDelta)||0),0),last};}).filter(x=>x.count||x.last);
        return `<div class="assessment-impact-since-head"><div><span>Son resmî değerlendirmeden bu yana</span><h3>${latest?esc(eventName(latest)):'Resmî değerlendirme yok'} sonrası durum</h3><p>${latest?esc(dateLabel(eventDate(latest))):'-'} · Projeksiyon resmî EI değildir.</p></div><div class="assessment-impact-since-kpis"><div><b>${c.rows.length}</b><span>Validasyon adayı</span></div><div><b>${c.ready.length}</b><span>Hazır</span></div><div><b>${c.assigned.length}</b><span>Ziyarete atanmış</span></div><div><b>+${c.potential.toFixed(2)}</b><span>Aday havuzu potansiyeli</span></div><div><b>%${projected.toFixed(2)}</b><span>Tümü valide edilirse</span></div></div></div><div class="assessment-impact-area-cards">${areas.map(x=>`<div><b>${x.area}</b><strong>${x.count?`${x.count} aday · +${x.delta.toFixed(2)} Overall puan`:'Yeni aday yok'}</strong><small>Son resmî değerlendirme: ${x.last?`${esc(eventName(x.last))} · ${esc(dateLabel(eventDate(x.last)))}`:'-'}</small></div>`).join('')}</div>`;
    }
    function pendingHtml(model){
        if(!model.pending.length)return'<div class="assessment-impact-empty compact">Taslak / geçici değerlendirme snapshot’ı bulunmuyor.</div>';
        return model.pending.map(r=>`<div class="assessment-impact-pending"><span>${esc(String(r.resultStatus||r.snapshot&&r.snapshot.resultStatus||'draft').toUpperCase())}</span><b>${esc(eventName(r))}</b><strong>${pct(metric(r,'Overall'))}</strong><small>${esc(dateLabel(eventDate(r)))}</small></div>`).join('');
    }

    window.changeAssessmentImpactPeriod=function(id){selectedPeriodId=String(id||'');window.renderAssessmentImpactCenter();};
    window.renderAssessmentImpactCenter=function(){
        const root=document.getElementById('assessmentImpactRoot');if(!root)return;
        const model=buildModel(),period=choosePeriod(model);
        const kpi=id=>document.getElementById(id);
        if(kpi('assessmentImpactKpiFirst'))kpi('assessmentImpactKpiFirst').textContent=pct(model.firstEi);
        if(kpi('assessmentImpactKpiCurrent'))kpi('assessmentImpactKpiCurrent').textContent=pct(model.latestEi);
        if(kpi('assessmentImpactKpiDelta'))kpi('assessmentImpactKpiDelta').textContent=delta(model.totalDelta);
        if(kpi('assessmentImpactKpiEvents'))kpi('assessmentImpactKpiEvents').textContent=String(model.rows.length);
        const tl=document.getElementById('assessmentImpactTimeline');if(tl)tl.innerHTML=timelineHtml(model);
        const ov=document.getElementById('assessmentImpactPeriodOverview');if(ov)ov.innerHTML=periodOverviewHtml(period);
        const at=document.getElementById('assessmentImpactAreaTable');if(at)at.innerHTML=areaTableHtml(period);
        const pq=document.getElementById('assessmentImpactPqChanges');if(pq)pq.innerHTML=pqChangeHtml(period);
        const since=document.getElementById('assessmentImpactSinceLast');if(since)since.innerHTML=sinceLastHtml(model);
        const pending=document.getElementById('assessmentImpactPending');if(pending)pending.innerHTML=pendingHtml(model);
        const src=document.getElementById('assessmentImpactSourceInfo');if(src)src.innerHTML=`Kaynak: <b>Assessment Event + EI Snapshot</b> · ${model.rows.length} resmî değerlendirme · ${model.pending.length} taslak/geçici değerlendirme. PQ bazlı etki yalnız kaynak ziyaret-validasyon kaydı varsa gösterilir.`;
    };

    function periodExportRows(model){return model.periods.map(p=>({'Dönem':p.index+1,'Önceki Değerlendirme':p.prev?eventName(p.prev):'Baseline','Sonraki Değerlendirme':eventName(p.curr),'Tarih':eventDate(p.curr),'Tür':p.curr.type||'','Kapsam':p.scope.join(', '),'Önceki Overall EI':p.before,'Sonraki Overall EI':p.after,'Değişim (puan)':p.delta,'Önceki Applicable':p.previousApplicable,'Sonraki Applicable':p.overallApplicable,'PQ Sürüm/Revisyon':versionKey(p.curr),'Metodoloji Sınıfı':p.methodology.label,'Metodoloji Notu':p.methodology.detail,'İzlenebilir Valide PQ':p.pqChanges.length}));}
    function areaExportRows(model){const out=[];model.periods.forEach(p=>p.areaRows.forEach(a=>out.push({'Dönem Sonu':eventName(p.curr),'Tarih':eventDate(p.curr),'Alan':a.area,'Dönem Öncesi Etkin EI':a.before,'Dönem Sonrası Etkin EI':a.after,'Değişim (puan)':a.reassessed?a.delta:null,'Bu Değerlendirmede Kapsamda mı':a.reassessed?'Evet':'Hayır','Satisfactory':a.satisfactory,'Applicable':a.applicable,'Son Resmî Değerlendirme':a.lastAssessment?eventName(a.lastAssessment):'','Son Resmî Değerlendirme Tarihi':a.lastAssessment?eventDate(a.lastAssessment):''})));return out;}
    function pqExportRows(model){const out=[];model.periods.forEach(p=>p.pqChanges.forEach(x=>out.push({'Değerlendirme':eventName(p.curr),'Değerlendirme Tarihi':eventDate(p.curr),'Alan':x.area,'PQ':x.pq,'Sonuç':'Validated','Sonuç Tarihi':x.resultDate,'Ziyaret':x.visitName,'ICAO Yorumu':x.comment})));return out;}
    function candidateExportRows(model){return model.candidates.rows.map(r=>({'PQ':r.pq,'Aktif PQ':r.currentPq,'Alan':r.area,'Durum':r.effectiveStatus,'CAP Tamamlanma':r.closureDate,'Hedef Ziyaret':r.targetVisitName,'Overall EI Potansiyeli':r.overallDelta,'Alan EI Potansiyeli':r.areaDelta,'Kanıt Tam mı':r.evidenceComplete?'Evet':'Hayır','PQ Concept':r.pqConceptId}));}
    window.exportAssessmentImpactExcel=function(){
        if(typeof XLSX==='undefined')return alert('Excel kütüphanesi yüklenemedi.');const m=buildModel(),wb=XLSX.utils.book_new();
        const add=(name,rows)=>XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows.length?rows:[{'Bilgi':'Kayıt bulunamadı.'}]),name.slice(0,31));
        add('Degerlendirme_Donemleri',periodExportRows(m));add('Alan_EI_Tarihcesi',areaExportRows(m));add('Valide_PQlar',pqExportRows(m));add('Validasyon_Adaylari',candidateExportRows(m));
        add('Taslak_Gecici',m.pending.map(r=>({'Değerlendirme':eventName(r),'Tür':r.type||'','Statü':r.resultStatus||r.snapshot&&r.snapshot.resultStatus||'','Tarih':eventDate(r),'Overall EI':metric(r,'Overall'),'Kapsam':scopeOf(r).join(', '),'PQ Sürüm/Revisyon':versionKey(r)})));
        XLSX.writeFile(wb,'ICAO_Degerlendirme_Donemleri_EI_Etki_Analizi.xlsx');
    };
    window.exportAssessmentImpactPDF=function(){
        if(typeof pdfMake==='undefined')return alert('PDF kütüphanesi yüklenemedi.');const m=buildModel(),p=choosePeriod(m),body=[['Dönem','Tarih','Overall EI','Değişim','Kapsam']];m.periods.forEach(x=>body.push([eventName(x.curr),dateLabel(eventDate(x.curr)),pct(x.after),delta(x.delta),x.scope.join(', ')||'-']));
        const areaBody=[['Alan','Önceki EI','Sonraki EI','Değişim','Kapsam']];if(p)p.areaRows.forEach(a=>areaBody.push([a.area,pct(a.before),pct(a.after),a.reassessed?delta(a.delta):'Yeniden değerlendirilmedi',a.reassessed?'Evet':'Hayır']));
        const content=[{text:'ICAO Değerlendirme Dönemleri & EI Etki Analizi',style:'header'},{text:`Rapor tarihi: ${new Date().toLocaleDateString('tr-TR')} | Resmî değerlendirme: ${m.rows.length}`,style:'subheader'},{text:'Resmî EI Zaman Çizgisi',style:'sectionHeader'},{table:{headerRows:1,widths:['*','auto','auto','auto','*'],body},layout:'lightHorizontalLines'}];
        if(p){content.push({text:'Seçili Dönem Metodolojisi',style:'sectionHeader'},{text:`${p.methodology.label}: ${p.methodology.detail}`,fontSize:9,margin:[0,0,0,8]},{table:{headerRows:1,widths:['auto','auto','auto','*','auto'],body:areaBody},layout:'lightHorizontalLines'});}
        content.push({text:'Not',style:'sectionHeader'},{text:'Resmî EI yalnız official Assessment Event / EI Snapshot kayıtlarından alınır. Validasyon adayları ve taslak/geçici değerlendirmeler resmî EI olarak değerlendirilmez. PQ sürümü/revizyonu veya applicable denominator değiştiğinde EI farkı performans ve metodoloji etkisi olarak otomatik sayısal ayrıştırılmaz.',fontSize:9});
        const def={pageOrientation:'landscape',pageSize:'A4',content,styles:{header:{fontSize:17,bold:true,color:'#2563eb',margin:[0,0,0,4]},subheader:{fontSize:9,color:'#64748b',margin:[0,0,0,12]},sectionHeader:{fontSize:12,bold:true,color:'#0f172a',margin:[0,10,0,6]}},defaultStyle:{font:'Roboto',fontSize:8}};pdfMake.createPdf(def).download('ICAO_Degerlendirme_Donemleri_EI_Etki_Analizi.pdf');
    };
    window.runAssessmentImpactSelfCheck=function(){
        const synthetic=[{id:'a',type:'CMAA',pqVersion:'2020',scopeAreas:AREAS,snapshot:{overall:{ei:50,satisfactory:50,applicable:100},areas:{LEG:{ei:50,inScope:true}}}},{id:'b',type:'ICVM',pqVersion:'2020',scopeAreas:['LEG'],snapshot:{overall:{ei:55,satisfactory:55,applicable:100},areas:{LEG:{ei:60,inScope:true}}}}];
        const periods=buildPeriods(synthetic);const perfOk=periods.length===2&&periods[1].delta===5&&periods[1].methodology.code==='performance'&&periods[1].areaRows.find(x=>x.area==='LEG').delta===10;
        const mixed=buildPeriods([synthetic[0],{...synthetic[1],pqVersion:'2024',snapshot:{...synthetic[1].snapshot,overall:{ei:55,satisfactory:55,applicable:110}}}]);
        const mixedOk=mixed[1].methodology.code==='mixed';
        const ok=perfOk&&mixedOk;
        const result={passed:ok&&!!document.getElementById('tab-assessment-impact')&&typeof window.renderAssessmentImpactCenter==='function',version:MODULE_VERSION,syntheticPerformance:perfOk,syntheticMixedGuard:mixedOk,tab:!!document.getElementById('tab-assessment-impact')};console.log('Assessment impact self-check:',result);return result;
    };
})();
