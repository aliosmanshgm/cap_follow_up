// Read-only dashboard. Assessments, visit outcomes and CAP working dates stay separate.
(function(){
  'use strict';
  const AREAS=['LEG','ORG','PEL','OPS','AIR','AIG','ANS','AGA'],KEYS=[...AREAS,'Overall'];
  const values=v=>Array.isArray(v)?v:Object.values(v||{});
  const str=v=>String(v??'').trim();
  const num=v=>v===null||v===undefined||str(v)===''?null:(Number.isFinite(Number(v))?Number(v):null);
  const integer=v=>{const n=num(v);return n!==null&&n>=0&&Number.isInteger(n)?n:null;};
  const percent=(s,n)=>s!==null&&n!==null&&n>0&&s>=0&&s<=n?100*s/n:null;
  const pctValue=v=>{const n=num(v);return n!==null&&n>=0&&n<=100?n:null;};
  const active=v=>v&&!v.isDeleted&&v.active!==false;
  const date=v=>str(v&&(v.effectiveAsOfDate||v.snapshotDate||v.assessmentDate||v.endDate||v.actualEnd||v.plannedEnd||v.actualStart||v.plannedStart));
  const sortDate=(a,b)=>date(a).localeCompare(date(b))||str(a.id).localeCompare(str(b.id));
  const safe=v=>str(v).replace(/[.#$\[\]\/]/g,'_').replace(/\s+/g,'_');
  const areaOf=(row,master={})=>window.CapCurrentSource.areaOf(row,master);
  function aliases(row,master={}){
    const m=master[row.pq]||{},link=row.pqLink||m.pqLink||{};
    return [...new Set([row.pq,row.activePq,row.currentPq,row.currentPqRef?.pq,row.sourcePqRef?.pq,
      m.currentPqRef?.pq,link.currentPqRef?.pq,link.sourcePqRef?.pq].map(str).filter(Boolean))];
  }
  function concept(row,master={}){const m=master[row.pq]||{};return str(row.conceptId||row.pqConceptId||m.pqConceptId||row.pqLink?.pqConceptId||m.pqLink?.pqConceptId);}
  function indexStates(data){
    const rows=new Map(),byConcept=new Map(),byPq=new Map();
    for(const row of values(data?.pqStates)){
      if(!row||!AREAS.includes(row.area))continue;
      const id=concept(row)?'concept:'+concept(row):(row.instanceId?'instance:'+row.instanceId:`pq:${row.area}:${row.pq}`);
      rows.set(id,row);
    }
    for(const [id,row] of rows){
      if(concept(row))byConcept.set(concept(row),id);
      for(const pq of aliases(row))byPq.set(`${row.area}|${pq}`,id);
    }
    return{rows,byConcept,byPq};
  }
  function findState(index,row,master={}){
    const m=master[row.pq]||{},link=row.pqLink||m.pqLink||{};
    const concepts=[concept(row,master),row.currentPqRef?.conceptId,row.sourcePqRef?.conceptId,m.currentPqRef?.conceptId,link.currentPqRef?.conceptId,link.sourcePqRef?.conceptId].filter(Boolean);
    for(const cid of concepts)if(index.byConcept.has(cid))return index.byConcept.get(cid);
    const area=areaOf(row,master);
    for(const pq of aliases(row,master)){const id=index.byPq.get(`${area}|${pq}`);if(id&&(!concepts.length||!concept(index.rows.get(id))))return id;}
    return null;
  }
  function metric(raw={}){
    const satisfactory=integer(raw.satisfactory),applicable=integer(raw.applicable);
    let notSatisfactory=integer(raw.notSatisfactory);
    if(notSatisfactory===null&&satisfactory!==null&&applicable!==null&&applicable>=satisfactory)notSatisfactory=applicable-satisfactory;
    const calculated=percent(satisfactory,applicable),explicit=pctValue(raw.ei);
    return{satisfactory,applicable,notSatisfactory,ei:applicable===0?null:(explicit??calculated),
      consistent:!(satisfactory!==null&&applicable!==null&&satisfactory>applicable)&&!(notSatisfactory!==null&&applicable!==null&&notSatisfactory>applicable)&&
        (calculated===null||explicit===null||Math.abs(calculated-explicit)<0.06)};
  }
  function metrics(data){
    const counts=data?.counts||data||{},out={};
    for(const area of AREAS)out[area]=metric(counts.areas?.[area]||{});
    const raw=counts.overall||{};
    if(Object.keys(raw).length)out.Overall=metric(raw);
    else if(AREAS.every(a=>out[a].satisfactory!==null&&out[a].applicable!==null)){
      out.Overall=metric({satisfactory:AREAS.reduce((n,a)=>n+out[a].satisfactory,0),applicable:AREAS.reduce((n,a)=>n+out[a].applicable,0),
        notSatisfactory:AREAS.every(a=>out[a].notSatisfactory!==null)?AREAS.reduce((n,a)=>n+out[a].notSatisfactory,0):null});
    }else out.Overall=metric();
    return out;
  }
  function recordEvent(id,r){
    const areas={};for(const a of AREAS)areas[a]={...(r.areaCounts?.[a]||{}),ei:r.areas?.[a]};
    return{...r,id:'official_'+id,sourceRecordId:id,stateSnapshotId:r.stateSnapshotId||'',linkedVisitId:r.linkedVisitId||'',snapshot:{stateSnapshotId:r.stateSnapshotId||'',areas,overall:{satisfactory:r.overallSatisfactory,applicable:r.overallApplicable,ei:r.overallEI}}};
  }
  function eventsFor(input){
    const out=(input.events||[]).filter(active).map(e=>({...e}));
    for(const [id,r] of Object.entries(input.officialRecords||{})){
      const matches=e=>e.sourceRecordId===id||e.linkedOfficialEiRecordId===id||e.id===r?.assessmentEventId||e.id==='official_'+id;
      const previous=out.find(matches);
      for(let i=out.length-1;i>=0;i--)if(matches(out[i]))out.splice(i,1);
      if(active(r)){
        const fresh=recordEvent(id,r);
        out.push({...previous,...fresh,id:r.assessmentEventId||previous?.id||fresh.id,
          snapshot:{...previous?.snapshot,...fresh.snapshot,resultStatus:r.resultStatus||'official',active:r.active!==false,isDeleted:false}});
      }
    }
    return out.filter(e=>!e.snapshot?.isDeleted&&e.snapshot?.active!==false).sort(sortDate);
  }
  function stateForEvent(event,states){
    if(!event)return null;
    const id=event.stateSnapshotId||event.snapshot?.stateSnapshotId;
    return states.find(s=>s.id===id)||states.find(s=>s.linkedAssessmentEventId===event.id)||null;
  }
  function eventData(event,states){return stateForEvent(event,states)||event?.snapshot||null;}
  function eventMetrics(event,states){
    const m=metrics(eventData(event,states));
    if(event?.snapshot){
      const published=metrics(event.snapshot);
      for(const a of KEYS)if(published[a].ei!==null){m[a]={...m[a],ei:published[a].ei};const computed=percent(m[a].satisfactory,m[a].applicable);m[a].consistent=computed===null||Math.abs(computed-m[a].ei)<0.06;}
    }
    return m;
  }
  function groupsFor(cap,index,master){
    const groups=new Map();
    for(const row of cap.rows){
      if(!window.CapCurrentSource.usable(row))continue;
      const id=findState(index,row,master);if(!id)continue;
      if(!groups.has(id))groups.set(id,[]);groups.get(id).push(row);
    }
    return groups;
  }
  function projections(current,cap,master,readiness={}){
    const idx=indexStates(current.data),groups=groupsFor(cap,idx,master),out={};
    for(const a of KEYS){
      const m=current.metrics[a],ns=[...idx.rows.entries()].filter(([,r])=>(a==='Overall'||r.area===a)&&r.status==='NS'&&r.applicable!==false);
      let candidate=0,theoretical=0;
      for(const [id,row] of ns){
        const actions=groups.get(id)||[];if(!actions.length)continue;
        theoretical++;
        const key=safe(concept(row)||`${row.area}__${row.pq}`),stored=readiness[key]||{};
        if(actions.every(window.CapCurrentSource.completed)&&stored.planningStatus!=='hold')candidate++;
      }
      const countsKnown=m.satisfactory!==null&&m.applicable!==null&&m.applicable>0&&m.consistent;
      const identityComplete=m.notSatisfactory!==null&&ns.length===m.notSatisfactory;
      const sourcePresent=cap.sources.some(s=>a==='Overall'||s.area===a)||m.notSatisfactory===0;
      const available=countsKnown&&identityComplete&&sourcePresent;
      out[a]={candidateCount:candidate,theoreticalCount:theoretical,openCount:theoretical-candidate,
        candidateEI:available?percent(Math.min(m.applicable,m.satisfactory+candidate),m.applicable):null,
        theoreticalEI:available?percent(Math.min(m.applicable,m.satisfactory+theoretical),m.applicable):null,
        reason:!countsKnown?'S/uygulanabilir PQ sayıları eksik veya EI ile uyumsuz':!identityComplete?'PQ düzeyindeki NS durumları eksik':!sourcePresent?'CAP kaynağı yüklenmedi':''};
    }
    return out;
  }
  function resultCode(value){
    const v=str(value).toLowerCase();
    return({satisfactory:'S',not_satisfactory:'NS',not_applicable:'NA',s:'S',ns:'NS',na:'NA'})[v]||null;
  }
  function phaseResults(visit,phase){
    const map=new Map();
    for(const r of values(visit?.icaoValidation?.records).filter(r=>!r.isDeleted)){
      let value=phase==='final'?r.finalResult:phase==='draft'?r.draftResult:'';
      if(phase==='working')value=r.finalResult||r.draftResult||(r.status==='validated'?'satisfactory':r.status==='not_validated'?'not_satisfactory':'');
      map.set(str(r.pq),{...r,result:resultCode(value)});
    }
    return map;
  }
  function simulateVisit(visit,phase,before,master,scopeAreas){
    const scope=[...new Map(values(visit?.scope?.pqs).filter(p=>!scopeAreas.size||scopeAreas.has(areaOf(p,master))).map(p=>[`${areaOf(p,master)}|${concept(p,master)||p.pq}`,p])).values()];
    const results=phaseResults(visit,phase),idx=indexStates(before.data),seen=new Set(),deltas={};
    const counts={satisfactory:0,notSatisfactory:0,notApplicable:0,pending:0,total:scope.length};
    AREAS.forEach(a=>deltas[a]={sat:0,app:0,unresolved:0,evaluated:0});
    for(const p of scope){
      const r=results.get(str(p.pq)),area=areaOf(p,master),code=r?.result;
      if(!code){counts.pending++;continue;}
      if(code==='S')counts.satisfactory++;else if(code==='NS')counts.notSatisfactory++;else counts.notApplicable++;
      if(!deltas[area])continue;
      const id=findState(idx,p,master),old=id&&idx.rows.get(id);
      if(!old||!['S','NS','NA'].includes(old.status)){deltas[area].unresolved++;continue;}
      if(seen.has(id))continue;seen.add(id);
      deltas[area].evaluated++;
      deltas[area].sat+=(code==='S'?1:0)-(old.status==='S'?1:0);
      deltas[area].app+=(code==='NA'?0:1)-(old.status==='NA'||old.applicable===false?0:1);
    }
    const out={};
    for(const a of KEYS){
      const d=a==='Overall'?Object.values(deltas).reduce((x,y)=>({sat:x.sat+y.sat,app:x.app+y.app,unresolved:x.unresolved+y.unresolved,evaluated:x.evaluated+y.evaluated}),{sat:0,app:0,unresolved:0,evaluated:0}):deltas[a];
      const m=before.metrics[a];let ei=m.ei;
      if(d.unresolved)ei=null;
      else if(d.evaluated)ei=m.consistent&&m.satisfactory!==null&&m.applicable!==null?percent(m.satisfactory+d.sat,m.applicable+d.app):null;
      out[a]={ei,evaluated:d.evaluated,unresolved:d.unresolved};
    }
    return{metrics:out,counts};
  }
  function buildVisitRows(input,events,states,baseline,officialStates){
    const visits=(input.visits||[]).filter(v=>active(v)&&(v.visitType==='icao_official'||v.type==='icao_official')).map(v=>({...v}));
    const eventGroups=new Map();
    for(const e of events){
      if(str(e.type).toUpperCase()==='CMAA'&&!e.linkedVisitId)continue;
      if(e.linkedVisitId&&visits.some(v=>v.id===e.linkedVisitId))continue;
      // Missing visit rows can still be grouped by their explicit shared visit ID.
      const key=e.linkedVisitId?'visit:'+e.linkedVisitId:'event:'+e.id;
      if(!eventGroups.has(key))eventGroups.set(key,[]);
      eventGroups.get(key).push(e);
    }
    for(const [id,group] of eventGroups){
      const e=group.filter(e=>(e.resultStatus||'official')==='official').at(-1)||group.at(-1);
      visits.push({id,visitName:e.name||e.type,areas:e.scopeAreas||[],actualEnd:date(e),eventOnly:e,relatedEvents:group});
    }
    visits.sort(sortDate);
    const rows=[];
    for(const visit of visits){
      const related=visit.relatedEvents||(visit.eventOnly?[visit.eventOnly]:events.filter(e=>e.linkedVisitId===visit.id));
      const resultRows=values(visit.icaoValidation?.records).filter(r=>!r.isDeleted);
      const hasFinal=related.some(e=>(e.resultStatus||'official')==='official')||resultRows.some(r=>resultCode(r.finalResult));
      const hasDraft=related.some(e=>['draft','provisional'].includes(e.resultStatus))||resultRows.some(r=>resultCode(r.draftResult));
      const hasWorking=resultRows.some(r=>['validated','not_validated'].includes(r.status));
      // One visible result per visit. Final results supersede all draft and working rows.
      const phases=[hasFinal?'final':hasDraft?'draft':hasWorking?'working':'pending'];
      const day=date(visit),excluded=new Set(related.map(e=>stateForEvent(e,states)?.id).filter(Boolean));
      const priorStates=officialStates.filter(s=>date(s)&&date(s)<day&&!excluded.has(s.id));
      const priorEvents=events.filter(e=>(e.resultStatus||'official')==='official'&&date(e)<day&&!related.includes(e));
      const priorState=priorStates.at(-1),priorEvent=priorEvents.at(-1);
      let before=day&&date(baseline.event)&&date(baseline.event)>day?{data:null,metrics:metrics(null),version:''}:baseline;
      if(priorState&&(!priorEvent||date(priorState)>=date(priorEvent)))before={data:priorState,metrics:metrics(priorState),version:priorState.pqVersion};
      else if(priorEvent)before={data:eventData(priorEvent,states),metrics:eventMetrics(priorEvent,states),version:priorEvent.pqVersion};
      for(const phase of phases){
        const e=related.filter(e=>phase==='final'?(e.resultStatus||'official')==='official':phase==='draft'&&['draft','provisional'].includes(e.resultStatus)).sort(sortDate).at(-1);
        const scope=new Set((e?.scopeAreas?.length?e.scopeAreas:visit.areas||[]).map(a=>str(a).toUpperCase()));
        if(!scope.size)values(visit.scope?.pqs).forEach(p=>{const a=areaOf(p,input.master);if(a)scope.add(a);});
        const simulated=simulateVisit(visit,phase,before,input.master,scope),published=e?eventMetrics(e,states):null,cells={};
        const data=e?eventData(e,states):null;
        const version=e?.pqVersion||data?.pqVersion||before.version;
        const versionChanged=!!(before.version&&version&&before.version!==version);
        for(const a of KEYS){
          const inScope=a==='Overall'||scope.has(a),hasPublished=published&&published[a].ei!==null;
          const value=inScope?(hasPublished?published[a].ei:simulated.metrics[a].ei):before.metrics[a].ei;
          cells[a]={ei:value,inScope,delta:inScope&&value!==null&&before.metrics[a].ei!==null?value-before.metrics[a].ei:null,
            evaluated:simulated.metrics[a].evaluated,source:hasPublished?'published':'pq_results'};
        }
        rows.push({id:visit.id+':'+phase,visitId:visit.eventOnly?'':visit.id,name:visit.visitName||visit.icaoVisitType||'ICAO ziyareti',date:date(e)||day,
          phase,scope:[...scope],cells,counts:simulated.counts,versionChanged,
          source:e?'Kayıtlı değerlendirme':'Ziyaret PQ sonuçlarından hesaplanan çalışma etkisi',
          official:phase==='final'&&!!e,partial:simulated.counts.pending>0});
      }
    }
    return rows;
  }
  function build(input={}){
    input={master:{},capRows:[],states:[],events:[],visits:[],readiness:{},...input};
    const states=input.states.filter(active).sort(sortDate),events=eventsFor(input);
    const cmaaEvents=events.filter(e=>str(e.type).toUpperCase()==='CMAA'&&(e.resultStatus||'official')==='official');
    const chosen=cmaaEvents.find(e=>e.id===input.baselineId)||cmaaEvents.at(-1)||null;
    const baseline={event:chosen,data:eventData(chosen,states),metrics:eventMetrics(chosen,states),version:chosen?.pqVersion||''};
    const officialStates=states.filter(s=>{
      if(s.sourceType!=='olf_full_status'||['draft','provisional'].includes(s.resultStatus))return false;
      const bound=events.filter(e=>e.id===s.linkedAssessmentEventId||e.stateSnapshotId===s.id||e.snapshot?.stateSnapshotId===s.id);
      if(bound.some(e=>e.id===s.linkedAssessmentEventId&&['draft','provisional'].includes(e.resultStatus)))return false;
      return !bound.some(e=>['draft','provisional'].includes(e.resultStatus))||bound.some(e=>(e.resultStatus||'official')==='official');
    });
    const lastState=officialStates.at(-1),lastEvent=events.filter(e=>(e.resultStatus||'official')==='official').at(-1);
    let current={data:null,metrics:metrics(null),name:'Resmî veri bekleniyor',date:'',version:''};
    const sameExplicitSource=lastState&&lastEvent&&stateForEvent(lastEvent,states)?.id===lastState.id;
    if(sameExplicitSource)current={data:eventData(lastEvent,states),metrics:eventMetrics(lastEvent,states),name:lastEvent.name||lastEvent.type,date:date(lastState)||date(lastEvent),version:lastEvent.pqVersion||lastState.pqVersion||''};
    else if(lastState&&(!lastEvent||date(lastState)>=date(lastEvent)))current={data:lastState,metrics:metrics(lastState),name:lastState.name||'Full PQ Status',date:date(lastState),version:lastState.pqVersion||''};
    else if(lastEvent)current={data:eventData(lastEvent,states),metrics:eventMetrics(lastEvent,states),name:lastEvent.name||lastEvent.type,date:date(lastEvent),version:lastEvent.pqVersion||''};
    const cap=window.CapCurrentSource.select(input.capRows,input.master,input.capAsOf||'');
    const baseIndex=indexStates(baseline.data),baseGroups=groupsFor(cap,baseIndex,input.master),baseByArea={};
    for(const a of KEYS){
      const ns=[...baseIndex.rows.entries()].filter(([,r])=>(a==='Overall'||r.area===a)&&r.status==='NS'&&r.applicable!==false);
      const source=cap.sources.some(s=>a==='Overall'||s.area===a);
      const count=baseline.metrics[a].notSatisfactory;
      baseByArea[a]={findings:count,identifiedFindings:ns.length,capSteps:count===0?0:(ns.length&&source?ns.reduce((n,[id])=>n+(baseGroups.get(id)?.length||0),0):null),
        withCap:ns.filter(([id])=>baseGroups.has(id)).length};
    }
    const projection=projections(current,cap,input.master,input.readiness);
    return{baseline,current,cmaaEvents,cap,baseByArea,projection,visits:buildVisitRows(input,events,states,baseline,officialStates),
      issues:[!chosen?'Nihai CMAA değerlendirmesi bulunamadı.':null,
        chosen&&!baseline.data?.pqStates&&baseline.metrics.Overall.notSatisfactory!==0?'CMAA bulguları ile CAP adımlarını eşleştirmek için bu değerlendirmeye ait Full PQ Status kaydını bağlayın.':null,
        !current.data?.pqStates?'Projeksiyon için güncel resmî PQ durumları gereklidir; yalnız EI yüzdesinden bulgu veya payda türetilmez.':null,
        cap.undated?'Tarihi belirlenemeyen CAP kayıtları var; tarihli alan kaynağı mevcutsa güncel sayımda o kaynak kullanılır.':null].filter(Boolean)};
  }

  const esc=v=>str(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=v=>v===null||v===undefined?'—':Number(v).toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2})+'%';
  const count=v=>v===null||v===undefined?'—':Number(v).toLocaleString('tr-TR');
  const phaseLabel=v=>v.phase==='final'?(v.official?'Nihai':'Nihai PQ sonucu'):v.phase==='draft'?'Taslak':v.phase==='working'?'Ziyaret çalışma etkisi':'Sonuç bekleniyor';
  const delta=v=>v===null||v===undefined?'':`${v>0?'+':''}${Number(v).toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2})} puan`;
  let baselineId='',capAsOf='',queued=false;
  function collect(){
    const events=typeof window.getAssessmentTimelineWithSnapshots==='function'?window.getAssessmentTimelineWithSnapshots():[];
    return{events,officialRecords:window.icaoOfficialEiRecords||{},states:Object.entries(window.icaoStateSnapshots||{}).map(([id,s])=>({id,...s})),
      visits:typeof getVisitRecords==='function'?getVisitRecords():[],capRows:typeof rawData!=='undefined'?rawData:[],master:typeof pqMasterData!=='undefined'?pqMasterData:{},
      readiness:window.icaoValidationReadiness||{},baselineId,capAsOf};
  }
  function render(){
    const root=document.getElementById('dashboardOverview');if(!root)return;
    const model=build(collect());window.currentDashboardOverview=model;
    const base=model.baseline.metrics.Overall,now=model.current.metrics.Overall,p=model.projection.Overall;
    const card=(title,value,note,kind='')=>`<article class="dash-metric ${kind}"><span>${title}</span><strong>${value}</strong><small>${esc(note)}</small></article>`;
    const cards=[card('CMAA Overall EI',fmt(base.ei),model.baseline.event?date(model.baseline.event):'Nihai CMAA kaydı gerekli'),
      card('CMAA bulguları',count(model.baseByArea.Overall.findings),'NS durumundaki benzersiz PQ'),
      card('CMAA bulgularına bağlı CAP adımı',count(model.baseByArea.Overall.capSteps),'Seçili CAP kaynak tarihinde · tekrarlar hariç'),
      card('Güncel resmî Overall EI',fmt(now.ei),`${model.current.name} · ${model.current.date||'tarih yok'}`,'official'),
      card('Validasyon adayları dahil EI',fmt(p.candidateEI),p.candidateEI===null?p.reason:`${p.candidateCount} aday PQ · henüz resmî sonuç değildir`,'candidate'),
      card('Tüm açık CAP’ler valide edilirse EI',fmt(p.theoreticalEI),p.theoreticalEI===null?p.reason:`${p.theoreticalCount} NS PQ · adaylar dahil teorik sınır`,'theoretical')].join('');
    const areaRows=['Overall',...AREAS].map(a=>{
      const b=model.baseByArea[a],pr=model.projection[a];
      return `<tr ${a==='Overall'?'class="dash-overall"':''}><th scope="row">${a==='Overall'?'Overall':a}</th><td>${fmt(model.baseline.metrics[a].ei)}</td><td>${count(b.findings)}</td><td title="${b.identifiedFindings} PQ düzeyinde eşleştirilen bulgu">${count(b.capSteps)}${b.withCap?`<small>${b.withCap} bulguya bağlı</small>`:''}</td><td class="dash-official">${fmt(model.current.metrics[a].ei)}</td><td title="${esc(pr.reason)}">${fmt(pr.candidateEI)}<small>${pr.candidateCount} aday</small></td><td title="${esc(pr.reason)}">${fmt(pr.theoreticalEI)}<small>${pr.theoreticalCount} CAP’lı NS PQ</small></td></tr>`;
    }).join('');
    const visitRows=model.visits.map(v=>{
      const label=phaseLabel(v);
      const cells=['Overall',...AREAS].map(a=>{
        const c=v.cells[a];
        return `<td class="${c.inScope?'':'dash-unvalidated'}">${fmt(c.ei)}<small>${!c.inScope?'Valide edilmedi':v.phase==='pending'?'Sonuç bekleniyor':c.delta!==null?delta(c.delta):'EI için veri eksik'}</small></td>`;
      }).join('');
      const summary=v.counts.total?`${v.counts.satisfactory} S · ${v.counts.notSatisfactory} NS · ${v.counts.notApplicable} N/A · ${v.counts.pending} bekleyen`:'PQ sonuçları bağlı değil';
      return `<tr data-dashboard-visit="${esc(v.id)}"><th scope="row">${esc(v.name)}<small>${esc(v.date||'Tarih belirtilmedi')}</small><span class="dash-stage ${v.phase}">${label}${v.official?' · kayıtlı sonuç':''}</span><small>${esc(summary)}</small>${v.versionChanged?'<small class="dash-warning">PQ seti değişti; fark yalnız validasyon etkisi değildir.</small>':''}${!v.official&&v.phase==='final'?'<small>Nihai PQ sonucu · resmî EI kaydı değildir</small>':''}</th>${cells}</tr>`;
    }).join('');
    root.innerHTML=`<header class="dash-heading"><div><span class="dash-eyebrow">GENEL DURUM</span><h2>CMAA, validasyon ve CAP görünümü</h2><p>Resmî durum, ziyaret sonuçları ve olası EI artışı ayrı gösterilir.</p></div><button type="button" class="btn-outline" onclick="openIcaoOfficialEiManager()">Değerlendirme kaynakları</button><button type="button" class="btn-outline" onclick="openStateSnapshotCenter()">PQ durum kaynakları / Sil</button></header>
      <div class="dash-controls"><label>CMAA başlangıcı<select id="dashboardCmaaSelect" onchange="setDashboardCmaa(this.value)">${model.cmaaEvents.length?model.cmaaEvents.map(e=>`<option value="${esc(e.id)}" ${e.id===model.baseline.event?.id?'selected':''}>${esc(e.name||'CMAA')} · ${esc(date(e))}</option>`).join(''):'<option value="">CMAA kaydı yok</option>'}</select></label><label>CAP kaynak tarihi<select id="dashboardCapDate" onchange="setDashboardCapDate(this.value)"><option value="">Her alanın en güncel kaynağı</option>${model.cap.dates.map(d=>`<option value="${d}" ${d===capAsOf?'selected':''}>${d} ve öncesi</option>`).join('')}</select></label><span class="dash-cap-contract">CAP Word yüklemesi yalnız CAP ilerlemesini ve projeksiyonları günceller.</span></div>
      <div class="dash-metrics">${cards}</div>
      ${model.issues.length?`<div class="dash-data-note" role="status">${model.issues.map(esc).join('<br>')}</div>`:''}
      <section class="dash-section"><h3>Denetim alanı bazında durum</h3><div class="dash-table-wrap"><table class="dash-table" id="dashboardAreaTable"><thead><tr><th>Alan</th><th>CMAA EI</th><th>CMAA bulgu</th><th>CAP adımı</th><th>Güncel resmî EI</th><th>Adaylar dahil EI</th><th>Teorik EI</th></tr></thead><tbody>${areaRows}</tbody></table></div><p class="dash-note">Bulgu = NS PQ. Overall EI = toplam S / toplam uygulanabilir PQ; alan yüzdelerinin ortalaması değildir. CAP adımları CMAA bulgularıyla PQ kimliği üzerinden eşleştirilir.</p></section>
      <section class="dash-section"><div class="dash-section-heading"><div><h3>ICAO resmî validasyon ziyaretleri</h3><p>Her ziyaret tek satırdır. Nihai sonuç varsa taslak ve çalışma satırları gösterilmez; kapsam dışındaki alanların önceki EI değeri korunur.</p></div><button type="button" class="btn-outline" onclick="switchTab('icao-visit-validation')">Ziyaret sonuçları</button></div><div class="dash-table-wrap"><table class="dash-table dash-visit-table" id="dashboardVisitTable"><thead><tr><th>Ziyaret / sonuç aşaması</th>${['Overall',...AREAS].map(a=>`<th>${a}</th>`).join('')}</tr></thead><tbody>${visitRows||'<tr><td colspan="10">Kayıtlı resmî validasyon ziyareti bulunmuyor.</td></tr>'}</tbody></table></div><p class="dash-note">Taslak sonuçlar ve PQ bazındaki çalışma etkileri güncel resmî EI’yi değiştirmez. Yeni resmî durum yalnız değerlendirme / Full PQ Status kaynağından alınır.</p></section>
      <details class="dash-definitions"><summary>Hesap kuralları ve CAP kaynakları</summary><p>Aday projeksiyonu: güncel resmî durumda NS olan, güncel CAP adımlarının tamamı tamamlanmış ve bekletilmeyen PQ’lar başarılı valide edilirse. Teorik EI: bekletilenler dahil CAP’ı bulunan tüm NS PQ’lar başarılı valide edilirse; her PQ bir kez sayılır. N/A ve zaten S olan PQ’lar ek artış üretmez. CAP’ı olmayan NS PQ’lar teorik sınıra eklenmez.</p><p>CAP kaynağı her denetim alanında ayrı seçilir; aynı adım eski ve yeni Word dosyalarından tekrar sayılmaz. Bu seçim değerlendirme veya ziyaret tarihi oluşturmaz. Dashboard, CAP ekranındaki geçici arama/ofis filtrelerinden bağımsız ulusal durumu gösterir.</p><ul>${model.cap.sources.map(s=>`<li><b>${s.area}</b> · ${esc(s.date||'Tarih bilinmiyor')} · ${s.files.map(esc).join(', ')}</li>`).join('')||'<li>CAP kaynağı bekleniyor.</li>'}</ul></details>`;
    return model;
  }
  window.DashboardOverview={build,indexStates,findState,metrics,collect};
  function exportRows(model){
    const areas=['Overall',...AREAS].map(a=>({'Alan':a,'CMAA EI (%)':model.baseline.metrics[a].ei,'CMAA Bulgu (NS PQ)':model.baseByArea[a].findings,
      'CMAA Bulgularına Bağlı CAP Adımı':model.baseByArea[a].capSteps,'Güncel Resmî EI (%)':model.current.metrics[a].ei,
      'Validasyon Adayları Dahil EI (%)':model.projection[a].candidateEI,'Aday PQ':model.projection[a].candidateCount,
      'Tüm CAP Başarılı Teorik EI (%)':model.projection[a].theoreticalEI,'CAP Bulunan NS PQ':model.projection[a].theoreticalCount}));
    const visits=model.visits.flatMap(v=>['Overall',...AREAS].map(a=>({'Ziyaret':v.name,'Tarih':v.date,'Aşama':phaseLabel(v),
      'Alan':a,'EI (%)':v.cells[a].ei,'Değişim (puan)':v.cells[a].delta,'Alan Durumu':v.cells[a].inScope?'Kapsamda':'Valide edilmedi',
      'Kaynak':v.source,'PQ Seti Değişti':v.versionChanged?'Evet':'Hayır'})));
    return{areas,visits};
  }
  window.DashboardOverview.exportRows=exportRows;
  window.exportDashboardOverviewExcel=function(){
    const model=build(collect()),data=exportRows(model),wb=XLSX.utils.book_new();
    for(const [name,rows] of [['Alan_ve_Overall',data.areas],['Ziyaret_Asamalari',data.visits],['CAP_Kaynaklari',model.cap.sources.map(s=>({'Alan':s.area,'CAP Kaynak Tarihi':s.date,'Dosyalar':s.files.join(', ')}))]]){
      XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows),name);
    }
    XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet([{Kural:'CMAA kaynağı',Açıklama:model.baseline.event?.name||'Eksik'},
      {Kural:'Güncel resmî kaynak',Açıklama:model.current.name},{Kural:'CAP kaynak seçimi',Açıklama:capAsOf||'Her alanın en güncel kaynağı'},
      {Kural:'Ziyaret görünümü',Açıklama:'Her ziyaret tek satır: nihai sonuç, yoksa taslak, yoksa çalışma etkisi veya bekleyen. Geçmiş sonuçlar silinmez.'},
      {Kural:'Projeksiyon',Açıklama:'Resmî EI değildir. S ve N/A için ek artış sayılmaz; her NS PQ bir kez sayılır.'},
      ...model.issues.map(x=>({Kural:'Veri kontrolü',Açıklama:x}))]),'Hesap_ve_Kaynak');
    XLSX.writeFile(wb,'Dashboard_CMAA_Validasyon_CAP.xlsx');
  };
  window.exportDashboardOverviewPDF=function(){
    const model=build(collect());
    const areaHeader=['Alan','CMAA EI','Bulgu','CAP adımı','Resmî EI','Aday EI','Teorik EI'];
    const areaBody=[areaHeader,...['Overall',...AREAS].map(a=>[a,fmt(model.baseline.metrics[a].ei),count(model.baseByArea[a].findings),count(model.baseByArea[a].capSteps),fmt(model.current.metrics[a].ei),fmt(model.projection[a].candidateEI),fmt(model.projection[a].theoreticalEI)])];
    const visitBody=[['Ziyaret / aşama','Overall',...AREAS],...model.visits.map(v=>[`${v.name}\n${v.date} · ${phaseLabel(v)}${v.phase==='final'&&!v.official?'\nPQ sonuçlarından çalışma etkisi':''}`,...['Overall',...AREAS].map(a=>fmt(v.cells[a].ei)+'\n'+(v.cells[a].inScope?delta(v.cells[a].delta):'Valide edilmedi'))])];
    const content=[{text:'CMAA, Validasyon ve CAP Dashboard',fontSize:17,bold:true,margin:[0,0,0,8]},
      {text:`CMAA: ${model.baseline.event?.name||'Eksik'} · Resmî kaynak: ${model.current.name} · CAP: ${capAsOf||'Her alanın en güncel kaynağı'}`,fontSize:8,margin:[0,0,0,10]},
      {table:{headerRows:1,widths:['*','*','*','*','*','*','*'],body:areaBody},layout:'lightHorizontalLines'},
      {text:'ICAO ziyaret sonuçları',bold:true,margin:[0,18,0,8]},
      {table:{headerRows:1,widths:[120,...Array(9).fill('*')],body:visitBody},layout:'lightHorizontalLines'},
      {text:'Taslaklar ve yalnız PQ sonuçlarından hesaplanan çalışma etkileri resmî EI değildir. CAP ilerlemesi resmî sonucu değiştirmez. Overall toplam S/uygulanabilir PQ üzerinden hesaplanır; aday ve teorik EI ayrı senaryolardır.',fontSize:8,margin:[0,12,0,0]},
      ...model.issues.map(text=>({text,fontSize:8,margin:[0,5,0,0]}))];
    return safeDownloadPdf(createStandardPdfDefinition(content,{pageOrientation:'landscape',pageSize:'A4',defaultStyle:{font:'Roboto',fontSize:8}}),'Dashboard_CMAA_Validasyon_CAP.pdf');
  };
  window.renderDashboardOverview=render;
  window.setDashboardCmaa=id=>{baselineId=id;render();};
  window.setDashboardCapDate=day=>{capAsOf=day;render();};
  window.scheduleDashboardOverview=function(){
    if(queued)return;queued=true;
    const schedule=typeof requestAnimationFrame==='function'?requestAnimationFrame:cb=>setTimeout(cb,0);
    schedule(()=>{queued=false;if(document.getElementById('tab-dashboard')?.classList.contains('active'))render();});
  };
  document.addEventListener('DOMContentLoaded',()=>{
    document.getElementById('dashboardOperations')?.addEventListener('toggle',event=>{if(event.target.open&&typeof window.render==='function')window.render();});
    window.scheduleDashboardOverview();
  });
})();
