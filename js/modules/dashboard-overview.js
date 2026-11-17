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
  const date=v=>str(v&&(v.date||v.effectiveAsOfDate||v.snapshotDate||v.assessmentDate||v.endDate||v.actualEnd||v.plannedEnd||v.actualStart||v.plannedStart));
  const sortDate=(a,b)=>date(a).localeCompare(date(b))||str(a.id).localeCompare(str(b.id));
  let buildIndexCache=null,buildGroupCache=null;
  const safe=v=>str(v).replace(/[.#$\[\]\/]/g,'_').replace(/\s+/g,'_');
  const areaOf=(row,master={})=>window.CapCurrentSource.areaOf(row,master);
  function aliases(row,master={}){
    const m=master[row.pq]||{},link=row.pqLink||m.pqLink||{};
    return [...new Set([row.pq,row.activePq,row.currentPq,row.currentPqRef?.pq,row.sourcePqRef?.pq,
      m.currentPqRef?.pq,link.currentPqRef?.pq,link.sourcePqRef?.pq].map(str).filter(Boolean))];
  }
  function concept(row,master={}){const m=master[row.pq]||{};return str(row.conceptId||row.pqConceptId||m.pqConceptId||row.pqLink?.pqConceptId||m.pqLink?.pqConceptId);}
  function indexStates(data){
    if(buildIndexCache&&data&&buildIndexCache.has(data))return buildIndexCache.get(data);
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
    const index={rows,byConcept,byPq};if(buildIndexCache&&data)buildIndexCache.set(data,index);return index;
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
    return{satisfactory,applicable,notSatisfactory,notApplicable:integer(raw.notApplicable),reliable:raw.sourceReliable!==false,ei:raw.sourceReliable===false||applicable===0?null:(explicit??calculated),
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
    if(buildGroupCache?.has(index))return buildGroupCache.get(index);
    const groups=new Map();
    for(const row of cap.rows){
      if(!window.CapCurrentSource.usable(row))continue;
      const id=findState(index,row,master);if(!id)continue;
      if(!groups.has(id))groups.set(id,[]);groups.get(id).push(row);
    }
    if(buildGroupCache)buildGroupCache.set(index,groups);return groups;
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
      const countsKnown=m.reliable!==false&&m.satisfactory!==null&&m.applicable!==null&&m.applicable>0&&m.consistent;
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
  function resultCode(value){return window.IcaoVisitOutcomes.code(value);}
  function visitScope(visit,master,scopeAreas){
    return [...new Map(values(visit?.scope?.pqs).filter(p=>p&&!p.isDeleted&&p.active!==false&&(!scopeAreas.size||scopeAreas.has(areaOf(p,master))))
      .map(p=>[`${areaOf(p,master)}|${concept(p,master)||p.pq}`,p])).values()];
  }
  function visitRecords(visit){return new Map(values(visit?.icaoValidation?.records).filter(r=>r&&!r.isDeleted).map(r=>[str(r.pq),r]));}
  function rawMetric(m){return {satisfactory:m.satisfactory,notSatisfactory:m.notSatisfactory,notApplicable:m.notApplicable,applicable:m.applicable,ei:m.ei,sourceReliable:m.reliable!==false};}
  function dataWithMetrics(data,m){return {...data,counts:{areas:Object.fromEntries(AREAS.map(a=>[a,rawMetric(m[a])])),overall:rawMetric(m.Overall)}};}
  function simulateVisit(visit,before,master,scopeAreas,finalOnly=false){
    const scope=visitScope(visit,master,scopeAreas),records=visitRecords(visit),idx=indexStates(before.data),changes={},seen=new Set();
    const counts={satisfactory:0,notSatisfactory:0,notApplicable:0,pending:0,unknown:0,total:scope.length,finalized:0,draft:0,working:0,unchanged:0};
    const deltas=Object.fromEntries(AREAS.map(a=>[a,{sat:0,ns:0,na:0,app:0,unresolved:0,evaluated:0}]));
    for(const p of scope){
      const record=records.get(str(p.pq))||{},area=areaOf(p,master),identity=findState(idx,p,master),old=identity&&idx.rows.get(identity);
      const outcome=window.IcaoVisitOutcomes.resolve(record,old?.status,finalOnly);
      if(window.IcaoVisitOutcomes.final(record))counts.finalized++;
      if(outcome.phase==='draft')counts.draft++;if(outcome.phase==='working')counts.working++;
      if(!outcome.raw){counts.pending++;continue;}
      if(outcome.unchanged)counts.unchanged++;
      if(outcome.code==='S')counts.satisfactory++;else if(outcome.code==='NS')counts.notSatisfactory++;else if(outcome.code==='NA')counts.notApplicable++;else counts.unknown++;
      const d=deltas[area];if(!d)continue;
      if(!old||!['S','NS','NA'].includes(old.status)||!outcome.code){d.unresolved++;continue;}
      if(seen.has(identity))continue;seen.add(identity);d.evaluated++;
      d.sat+=(outcome.code==='S'?1:0)-(old.status==='S'?1:0);
      d.ns+=(outcome.code==='NS'?1:0)-(old.status==='NS'?1:0);
      d.na+=(outcome.code==='NA'?1:0)-(old.status==='NA'?1:0);
      d.app+=(outcome.code==='NA'?0:1)-(old.status==='NA'||old.applicable===false?0:1);
      changes[identity]={...old,status:outcome.code,applicable:outcome.code!=='NA'};
    }
    const out={};
    for(const a of KEYS){
      const d=a==='Overall'?Object.values(deltas).reduce((x,y)=>Object.fromEntries(Object.keys(x).map(k=>[k,x[k]+y[k]])),{sat:0,ns:0,na:0,app:0,unresolved:0,evaluated:0}):deltas[a];
      const m=before.metrics[a];let next={...m};
      if(d.unresolved){next={...next,satisfactory:null,notSatisfactory:null,notApplicable:null,applicable:null,ei:null,reliable:false,consistent:false};}
      else if(d.evaluated){
        const sat=m.satisfactory===null?null:m.satisfactory+d.sat,app=m.applicable===null?null:m.applicable+d.app;
        next=metric({satisfactory:sat,applicable:app,notSatisfactory:m.notSatisfactory===null?null:m.notSatisfactory+d.ns,
          notApplicable:m.notApplicable===null?null:m.notApplicable+d.na,ei:m.consistent?percent(sat,app):null,sourceReliable:m.consistent&&m.reliable!==false});
      }
      out[a]={...next,evaluated:d.evaluated,unresolved:d.unresolved};
    }
    const pqStates={};for(const [identity,row] of idx.rows)pqStates[safe(identity)]=changes[identity]||{...row};
    const data=dataWithMetrics({...before.data,sourceType:'visit_derived_state',pqStates},out);
    return{metrics:out,data,counts,hasResults:counts.finalized+counts.draft+counts.working>0};
  }
  function mergeReportedMetric(computed,reported){
    const sat=reported.satisfactory??computed.satisfactory,app=reported.applicable??computed.applicable;
    return metric({satisfactory:sat,applicable:app,notSatisfactory:reported.notSatisfactory??computed.notSatisfactory,
      notApplicable:reported.notApplicable??computed.notApplicable,ei:reported.ei??computed.ei,sourceReliable:reported.ei!==null||computed.reliable!==false});
  }
  function buildVisitRows(input,events,states,baseline,officialStates){
    const visits=(input.visits||[]).filter(v=>active(v)&&(v.visitType==='icao_official'||v.type==='icao_official')).map(v=>({...v}));
    const eventGroups=new Map();
    for(const e of events){
      if(str(e.type).toUpperCase()==='CMAA'&&!e.linkedVisitId)continue;
      if(e.linkedVisitId&&visits.some(v=>v.id===e.linkedVisitId))continue;
      const key=e.linkedVisitId?'visit:'+e.linkedVisitId:'event:'+e.id;
      if(!eventGroups.has(key))eventGroups.set(key,[]);eventGroups.get(key).push(e);
    }
    for(const [id,group] of eventGroups){
      const e=group.filter(e=>(e.resultStatus||'official')==='official').at(-1)||group.at(-1);
      visits.push({id,visitName:e.name||e.type,areas:e.scopeAreas||[],actualEnd:date(e),eventOnly:e,relatedEvents:group});
    }
    visits.sort(sortDate);const rows=[];let previous=null;
    for(const visit of visits){
      const related=visit.relatedEvents||(visit.eventOnly?[visit.eventOnly]:events.filter(e=>e.linkedVisitId===visit.id));
      const official=related.filter(e=>(e.resultStatus||'official')==='official').sort(sortDate).at(-1);
      const draft=related.filter(e=>['draft','provisional'].includes(e.resultStatus)).sort(sortDate).at(-1),e=official||draft;
      const day=date(visit)||date(e),excluded=new Set(related.map(e=>stateForEvent(e,states)?.id).filter(Boolean));
      const priorStates=officialStates.filter(s=>date(s)&&date(s)<day&&!excluded.has(s.id));
      const priorEvents=events.filter(e=>(e.resultStatus||'official')==='official'&&date(e)<day&&!related.includes(e));
      const priorState=priorStates.at(-1),priorEvent=priorEvents.at(-1);
      let before=day&&date(baseline.event)&&date(baseline.event)>day?{data:null,metrics:metrics(null),version:'',date:''}:{...baseline,date:date(baseline.event)};
      if(priorState&&(!priorEvent||date(priorState)>=date(priorEvent)))before={data:priorState,metrics:metrics(priorState),version:priorState.pqVersion,date:date(priorState)};
      else if(priorEvent)before={data:eventData(priorEvent,states),metrics:eventMetrics(priorEvent,states),version:priorEvent.pqVersion,date:date(priorEvent)};
      if(previous&&day&&previous.date<=day&&(!before.date||previous.date>=before.date))before={data:previous.data,metrics:previous.metrics,version:previous.version,date:previous.date};
      const scope=new Set((e?.scopeAreas?.length?e.scopeAreas:visit.areas||[]).map(a=>str(a).toUpperCase()));
      if(!scope.size)values(visit.scope?.pqs).forEach(p=>{const a=areaOf(p,input.master);if(a)scope.add(a);});
      const visitDerived=['draft','provisional'].includes(e?.resultStatus)&&(e?.sourceOfTruth?.calculationSource||e?.snapshot?.sourceOfTruth?.calculationSource)==='linked_icao_visit_pq_results';
      const simulated=simulateVisit(visit,before,input.master,scope,!!official),reported=e&&!visitDerived?eventMetrics(e,states):null,recordData=e&&!visitDerived?eventData(e,states):null;
      const complete=simulated.counts.total>0&&simulated.counts.finalized===simulated.counts.total;
      const phase=official||complete?'final':draft||simulated.counts.finalized||simulated.counts.draft?'draft':simulated.counts.working?'working':'pending';
      const version=e?.pqVersion||recordData?.pqVersion||before.version,versionChanged=!!(before.version&&version&&before.version!==version);
      const cells={},stageMetrics={};let useFullRecord=!!(recordData?.pqStates&&(official||!simulated.hasResults));
      for(const a of KEYS){
        const inScope=a==='Overall'||scope.has(a),published=reported?.[a];let m=simulated.metrics[a],source='visit_pq_results';
        if(!inScope){m=before.metrics[a];source='previous_stage';}
        else if(published?.ei!==null&&published?.ei!==undefined&&(official||!simulated.hasResults||m.ei===null&&phase!=='final')){
          m=mergeReportedMetric(m,published);source='registered_assessment';
        }
        stageMetrics[a]=m;
        cells[a]={ei:m.ei,inScope,delta:inScope&&m.ei!==null&&before.metrics[a].ei!==null?m.ei-before.metrics[a].ei:null,
          evaluated:simulated.metrics[a].evaluated,source};
      }
      let data=simulated.data;
      if(useFullRecord){
        const pqStates={};for(const row of values(before.data?.pqStates))if(!scope.has(row.area))pqStates[safe(concept(row)||row.area+'_'+row.pq)]={...row};
        for(const row of values(recordData.pqStates))if(scope.has(row.area))pqStates[safe(concept(row)||row.area+'_'+row.pq)]={...row};
        data={...recordData,pqStates};
      }
      data=dataWithMetrics(data,stageMetrics);
      const stageId=visit.eventOnly?'assessment:'+visit.id:'visit:'+visit.id;
      const row={id:visit.id+':'+phase,stageId,visitId:visit.eventOnly?'':visit.id,type:visit.icaoVisitType||e?.type||'ICAO',
        name:visit.visitName||visit.icaoVisitType||'ICAO ziyareti',date:day||date(e),phase,scope:[...scope],cells,metrics:stageMetrics,data,counts:simulated.counts,
        version,versionChanged,before,relatedIds:related.map(r=>r.id),official:!!official,partial:!official&&!complete,
        source:official?'Kayıtlı nihai değerlendirme':simulated.hasResults?'Resmî ziyaretin PQ sonuçları':e?'Kayıtlı taslak değerlendirme':'Sonuç bekleniyor'};
      rows.push(row);
      if(row.phase==='final'&&row.date&&(!date(baseline.event)||row.date>=date(baseline.event)))previous=row;
    }
    return rows;
  }
  function build(input={}){
    buildIndexCache=new WeakMap();buildGroupCache=new WeakMap();
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
    const visits=buildVisitRows(input,events,states,baseline,officialStates);
    const baselineVisit=visits.find(v=>v.relatedIds.includes(chosen?.id));
    const baselineStage=chosen?{id:'baseline:'+chosen.id,stageId:'baseline:'+chosen.id,name:chosen.name||'CMAA',type:'CMAA',date:date(chosen),phase:'final',official:true,metrics:baseline.metrics,data:baseline.data,version:baseline.version,counts:{total:0,finalized:0}}:null;
    const stages=[...(!baselineVisit&&baselineStage?[baselineStage]:[]),...visits.filter(v=>!baselineStage||!v.date||v.date>=baselineStage.date)].sort(sortDate);
    const latestStage=stages.filter(v=>v.phase!=='pending').at(-1)||stages.at(-1)||null;
    const selectedStage=stages.find(v=>v.stageId===input.stageId)||latestStage;
    const selected=selectedStage||{name:current.name,date:current.date,phase:'pending',data:current.data,metrics:current.metrics,counts:{total:0,finalized:0}};
    const selectedIndex=indexStates(selected.data),selectedGroups=groupsFor(cap,selectedIndex,input.master),selectedByArea={};
    for(const a of KEYS){
      const ns=[...selectedIndex.rows.entries()].filter(([,r])=>(a==='Overall'||r.area===a)&&r.status==='NS'&&r.applicable!==false);
      const known=selected.metrics[a].notSatisfactory,hasSource=cap.sources.some(s=>a==='Overall'||s.area===a);
      selectedByArea[a]={findings:known,capSteps:known===0?0:known!==null&&ns.length===known&&hasSource?ns.reduce((n,[id])=>n+(selectedGroups.get(id)?.length||0),0):null};
    }
    const projection=projections(selected,cap,input.master,input.readiness),referenceProjection=projections(current,cap,input.master,input.readiness);
    const model={baseline,current,cmaaEvents,cap,baseByArea,projection,referenceProjection,visits,stages,selectedStage:selected,latestStage,selectedByArea,
      issues:[!chosen?'Nihai CMAA değerlendirmesi bulunamadı.':null,
        chosen&&!baseline.data?.pqStates&&baseline.metrics.Overall.notSatisfactory!==0?'CMAA bulguları ile CAP adımlarını eşleştirmek için bu değerlendirmeye ait Full PQ Status kaydını bağlayın.':null,
        !selected.data?.pqStates?'Seçili aşamanın projeksiyonu için PQ durumları gereklidir; yalnız EI yüzdesinden bulgu veya payda türetilmez.':null,
        visits.some(v=>v.counts.unknown||v.metrics.Overall.reliable===false)?'Bazı ziyaret sonuçları önceki PQ durumuyla eşleştirilemedi; bu aşamalarda bilinmeyen EI veya sayımlar hesaplanmaz.':null,
        cap.undated?'Tarihi belirlenemeyen CAP kayıtları var; tarihli alan kaynağı mevcutsa güncel sayımda o kaynak kullanılır.':null].filter(Boolean)};
    buildIndexCache=null;buildGroupCache=null;return model;
  }

  const esc=v=>str(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=v=>v===null||v===undefined?'—':Number(v).toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2})+'%';
  const count=v=>v===null||v===undefined?'—':Number(v).toLocaleString('tr-TR');
  const phaseLabel=v=>v.phase==='final'?(v.official?'Nihai':'Nihai PQ sonucu'):v.phase==='draft'?(v.counts?.finalized?'Taslak · kısmen nihai':'Taslak'):v.phase==='working'?'Ziyaret çalışma etkisi':'Sonuç bekleniyor';
  const delta=v=>v===null||v===undefined?'':`${v>0?'+':''}${Number(v).toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2})} puan`;
  let baselineId='',capAsOf='',stageId='',queued=false;
  function collect(){
    const events=typeof window.getAssessmentTimelineWithSnapshots==='function'?window.getAssessmentTimelineWithSnapshots():[];
    return{events,officialRecords:window.icaoOfficialEiRecords||{},states:Object.entries(window.icaoStateSnapshots||{}).map(([id,s])=>({id,...s})),
      visits:typeof getVisitRecords==='function'?getVisitRecords():[],capRows:typeof rawData!=='undefined'?rawData:[],master:typeof pqMasterData!=='undefined'?pqMasterData:{},
      readiness:window.icaoValidationReadiness||{},baselineId,capAsOf,stageId};
  }
  let runtimeCache=null;
  function runtimeModel(){
    const refs=[window.icaoStateSnapshots,window.icaoAssessmentEvents,window.icaoEiSnapshots,window.icaoOfficialEiRecords,
      typeof icaoVisits!=='undefined'?icaoVisits:window.icaoVisits,typeof rawData!=='undefined'?rawData:null,
      typeof pqMasterData!=='undefined'?pqMasterData:null,window.icaoValidationReadiness,baselineId,capAsOf,stageId];
    if(runtimeCache&&runtimeCache.refs.every((r,i)=>r===refs[i]))return runtimeCache.model;
    const item={refs,model:build(collect())};runtimeCache=item;
    Promise.resolve().then(()=>{if(runtimeCache===item)runtimeCache=null;});
    return item.model;
  }
  function render(){
    const root=document.getElementById('dashboardOverview');if(!root)return;
    const model=runtimeModel();window.currentDashboardOverview=model;
    const selected=model.selectedStage,base=model.baseline.metrics.Overall,now=model.current.metrics.Overall,p=model.projection.Overall;
    const progress=selected.counts||{},note=phaseLabel(selected)+' · '+(selected.date||'tarih yok');
    const card=(title,value,note,kind='')=>`<article class="dash-metric ${kind}"><span>${title}</span><strong>${value}</strong><small>${esc(note)}</small></article>`;
    const referenceCards=[card('CMAA Overall EI',fmt(base.ei),model.baseline.event?date(model.baseline.event):'Nihai CMAA kaydı gerekli'),
      card('CMAA bulguları',count(model.baseByArea.Overall.findings),'Başlangıç dönemindeki NS PQ'),
      card('CMAA bulgularına bağlı CAP adımı',count(model.baseByArea.Overall.capSteps),'Seçili CAP kaynak tarihinde'),
      card('Kayıtlı resmî EI referansı',fmt(now.ei),`${model.current.name} · ${model.current.date||'tarih yok'}`,'official')].join('');
    const selectedCards=[card('Seçili aşama sonrası EI',fmt(selected.metrics.Overall.ei),`${selected.name} · ${note}`,'scenario'),
      card('Nihai PQ sonuçları',progress.total?`${progress.finalized}/${progress.total}`:'—',progress.total?`${progress.unchanged||0} No Change · ${progress.draft||0} taslak · ${progress.pending||0} sonuç bekleyen`:'Bu aşamada ziyaret PQ kapsamı bulunmuyor','scenario'),
      card('Validasyon adayları dahil EI',fmt(p.candidateEI),p.candidateEI===null?p.reason:`Seçili aşamaya göre ${p.candidateCount} aday PQ`,'candidate'),
      card('Tüm açık CAP’ler valide edilirse EI',fmt(p.theoreticalEI),p.theoreticalEI===null?p.reason:`Seçili aşamaya göre ${p.theoreticalCount} CAP’lı NS PQ`,'theoretical')].join('');
    const flow=model.stages.map((s,i)=>`${i?'<span class="dash-stage-arrow" aria-hidden="true">→</span>':''}<button type="button" class="dash-stage-button ${s.stageId===selected.stageId?'selected':''}" data-dashboard-stage="${esc(s.stageId)}" aria-pressed="${s.stageId===selected.stageId}"><b>${esc(s.type||s.name)}</b><span>${esc(s.date||'Tarih yok')} · ${esc(phaseLabel(s))}</span><strong>${fmt(s.metrics.Overall.ei)}</strong>${s.counts?.total?`<small>${s.counts.finalized}/${s.counts.total} PQ nihai</small>`:''}</button>`).join('');
    const areaRows=['Overall',...AREAS].map(a=>{
      const m=selected.metrics[a],b=model.selectedByArea[a],pr=model.projection[a];
      return `<tr ${a==='Overall'?'class="dash-overall"':''}><th scope="row">${a==='Overall'?'Overall':a}</th><td class="dash-scenario-value">${fmt(m.ei)}</td><td>${count(m.satisfactory)}</td><td>${count(b.findings)}</td><td>${count(b.capSteps)}</td><td title="${esc(pr.reason)}">${fmt(pr.candidateEI)}<small>${pr.candidateCount} aday</small></td><td title="${esc(pr.reason)}">${fmt(pr.theoreticalEI)}<small>${pr.theoreticalCount} CAP’lı NS PQ</small></td></tr>`;
    }).join('');
    const visitRows=model.stages.map(v=>{
      const cells=['Overall',...AREAS].map(a=>{
        const c=v.cells?.[a]||{ei:v.metrics[a].ei,inScope:true,delta:null};
        return `<td class="${c.inScope?'':'dash-unvalidated'}">${fmt(c.ei)}<small>${!c.inScope?'Valide edilmedi':v.phase==='pending'?'Sonuç bekleniyor':c.delta!==null?delta(c.delta):'Başlangıç / kayıtlı kaynak'}</small></td>`;
      }).join('');
      const n=v.counts||{},summary=n.total?`${n.satisfactory} S · ${n.notSatisfactory} NS · ${n.notApplicable} N/A · ${n.pending} bekleyen`:'Başlangıç / kayıtlı değerlendirme';
      return `<tr data-dashboard-visit="${esc(v.id)}"><th scope="row">${esc(v.name)}<small>${esc(v.date||'Tarih belirtilmedi')}</small><span class="dash-stage ${v.phase}">${esc(phaseLabel(v))}${v.official?' · kayıtlı sonuç':''}</span><small>${esc(summary)}</small>${n.total?`<small><b>${n.finalized}/${n.total} PQ nihai</b> · ${n.unchanged||0} No Change</small>`:''}${v.versionChanged?'<small class="dash-warning">PQ seti değişti; fark yalnız validasyon etkisi değildir.</small>':''}<small>${esc(v.source||'CMAA başlangıç kaynağı')}</small></th>${cells}</tr>`;
    }).join('');
    root.innerHTML=`<header class="dash-heading"><div><span class="dash-eyebrow">GENEL DURUM</span><h2>CMAA, validasyon ve CAP görünümü</h2><p>Resmî ziyaretlerin taslak ve nihai PQ sonuçları aşama istatistiklerine dahil edilir.</p></div><button type="button" class="btn-outline" onclick="openIcaoOfficialEiManager()">Değerlendirme kaynakları</button><button type="button" class="btn-outline" onclick="openStateSnapshotCenter()">PQ durum kaynakları / Sil</button></header>
      <div class="dash-controls"><label>CMAA başlangıcı<select id="dashboardCmaaSelect" onchange="setDashboardCmaa(this.value)">${model.cmaaEvents.length?model.cmaaEvents.map(e=>`<option value="${esc(e.id)}" ${e.id===model.baseline.event?.id?'selected':''}>${esc(e.name||'CMAA')} · ${esc(date(e))}</option>`).join(''):'<option value="">CMAA kaydı yok</option>'}</select></label><label>CAP kaynak tarihi<select id="dashboardCapDate" onchange="setDashboardCapDate(this.value)"><option value="">Her alanın en güncel kaynağı</option>${model.cap.dates.map(d=>`<option value="${d}" ${d===capAsOf?'selected':''}>${d} ve öncesi</option>`).join('')}</select></label><span class="dash-cap-contract">CAP Word yalnız CAP ilerlemesini günceller; ziyaret sonucu oluşturmaz.</span></div>
      <section class="dash-reference-section"><h3>CMAA başlangıcı ve kayıtlı resmî referans</h3><p class="dash-note">Bu kartlar aşama seçiminden bağımsızdır.</p><div class="dash-metrics" data-dashboard-reference>${referenceCards}</div></section>
      <section class="dash-stage-section"><h3>Değerlendirme aşamaları</h3><nav class="dash-stage-flow" aria-label="Değerlendirme aşamaları">${flow||'<p>Aşama için değerlendirme / ziyaret kaydı bekleniyor.</p>'}</nav><p class="dash-note">İncelemek istediğiniz aşamayı seçin. Başlangıçta son sonuç bulunan aşama gösterilir; taslak ziyaretler de dahildir.</p><h3 class="dash-selected-heading" aria-live="polite">Seçili aşama: ${esc(selected.name)} · ${esc(phaseLabel(selected))}</h3><div class="dash-metrics" data-dashboard-selected>${selectedCards}</div></section>
      ${model.issues.length?`<div class="dash-data-note" role="status">${model.issues.map(esc).join('<br>')}</div>`:''}
      <section class="dash-section"><h3>${esc(selected.name)} sonrası alan durumu <span class="dash-stage ${selected.phase}">${esc(phaseLabel(selected))}</span></h3><div class="dash-table-wrap"><table class="dash-table" id="dashboardAreaTable"><thead><tr><th>Alan</th><th>Aşama sonrası EI</th><th>S PQ</th><th>Bulgu / NS PQ</th><th>NS bulgularına CAP adımı</th><th>Adaylar dahil EI</th><th>Teorik EI</th></tr></thead><tbody>${areaRows}</tbody></table></div><p class="dash-note">Bu tablo ve projeksiyonlar seçili aşamanın sonuçlarını kullanır. No Change, ziyaret öncesindeki S/NS/N-A durumunu korur. Overall EI = toplam S / toplam uygulanabilir PQ. Taslak sonuçların hesaba katıldığı aşama açıkça etiketlenir.</p></section>
      <section class="dash-section"><div class="dash-section-heading"><div><h3>ICAO resmî ziyaretleri ve aşama değişimleri</h3><p>Her ziyaret tek satırdır. PQ bazında nihai sonuç taslağın önüne geçer; tüm kapsam PQ’ları nihai olduğunda ziyaret nihai görünür.</p></div><button type="button" class="btn-outline" onclick="switchTab('icao-visit-validation')">Ziyaret sonuçları</button></div><div class="dash-table-wrap"><table class="dash-table dash-visit-table" id="dashboardVisitTable"><thead><tr><th>Ziyaret / sonuç aşaması</th>${['Overall',...AREAS].map(a=>`<th>${a}</th>`).join('')}</tr></thead><tbody>${visitRows||'<tr><td colspan="10">Değerlendirme / ziyaret kaydı bekleniyor.</td></tr>'}</tbody></table></div><p class="dash-note">Aşamalar tarih sırasıyla gösterilir; her ziyaret önceki kesinleşmiş durumu temel alır. Kapsam dışı alanlar önceki durumunu korur ve Valide edilmedi olarak gösterilir. Kayıtlı resmî EI referansı, ziyaret PQ sonuçlarından hesaplanan taslak/nihai EI’den ayrı korunur.</p></section>
      <details class="dash-definitions"><summary>Hesap kuralları ve CAP kaynakları</summary><p>Her PQ’da önce Satisfactory / Not Satisfactory / No Change olarak girilmiş nihai sonuç; yoksa taslak sonuç kullanılır. No Change yeni S artışı oluşturmaz. Sonucu girilmemiş PQ’nun önceki durumu korunur; eksik sonuç sayısı gösterilir. Önceki PQ durumu bilinmiyorsa güvenilir EI veya projeksiyon uydurulmaz.</p><p>Aday ve teorik EI seçili aşamada halen NS olan PQ’lardan hesaplanır; ziyaretle S olmuş PQ ikinci kez ek artış üretmez. CAP kaynağı her denetim alanında ayrı seçilir. Dashboard geçici CAP arama/ofis filtrelerinden bağımsızdır.</p><ul>${model.cap.sources.map(s=>`<li><b>${s.area}</b> · ${esc(s.date||'Tarih bilinmiyor')} · ${s.files.map(esc).join(', ')}</li>`).join('')||'<li>CAP kaynağı bekleniyor.</li>'}</ul></details>`;
    root.querySelectorAll('[data-dashboard-stage]').forEach(button=>button.addEventListener('click',()=>window.setDashboardStage(button.dataset.dashboardStage)));
    return model;
  }
  window.DashboardOverview={build,indexStates,findState,metrics,collect};
  window.getIcaoDashboardVisitStage=id=>runtimeModel().visits.find(v=>v.visitId===id)||null;
  window.getIcaoDashboardVisitImpact=function(visit,scopeOverride=null){
    const input=collect(),stage=runtimeModel().visits.find(v=>v.visitId===visit?.id);if(!stage)return null;
    const actual=Array.isArray(scopeOverride)?{...visit,scope:{...visit.scope,pqs:scopeOverride}}:visit;
    const scope=new Set((Array.isArray(scopeOverride)?scopeOverride.map(p=>areaOf(p,input.master)):stage.scope).filter(Boolean));
    const result=Array.isArray(scopeOverride)?simulateVisit(actual,stage.before,input.master,scope,false):stage;
    const out={};for(const a of AREAS){const before=stage.before.metrics[a],after=result.metrics[a];out[a]={area:a,total:after.applicable,baselineSat:before.satisfactory,validatedNew:after.satisfactory!==null&&before.satisfactory!==null?after.satisfactory-before.satisfactory:null,newSat:after.satisfactory,baselinePct:before.ei,newPct:after.ei,delta:after.ei!==null&&before.ei!==null?after.ei-before.ei:null};}
    const before=stage.before.metrics.Overall,after=result.metrics.Overall;
    return{scopePqs:scopeOverride||visitScope(visit,input.master,new Set(stage.scope)),records:values(visit.icaoValidation?.records),areas:out,total:after.applicable,baselineSat:before.satisfactory,validatedNew:after.satisfactory!==null&&before.satisfactory!==null?after.satisfactory-before.satisfactory:null,newSat:after.satisfactory,baselinePct:before.ei,newPct:after.ei,delta:after.ei!==null&&before.ei!==null?after.ei-before.ei:null,counts:result.counts,phase:stage.phase,baselineSource:'Önceki ziyaret aşaması'};
  };

  function exportRows(model){
    const selected=model.selectedStage;
    const areas=['Overall',...AREAS].map(a=>({'Alan':a,'Seçili Aşama':selected.name,'Sonuç Statüsü':phaseLabel(selected),
      'Aşama Sonrası EI (%)':selected.metrics[a].ei,'Aşama S PQ':selected.metrics[a].satisfactory,'Aşama NS PQ':selected.metrics[a].notSatisfactory,
      'Aşama NS CAP Adımı':model.selectedByArea[a].capSteps,'CMAA EI (%)':model.baseline.metrics[a].ei,'CMAA Bulgu (NS PQ)':model.baseByArea[a].findings,
      'CMAA Bulgularına Bağlı CAP Adımı':model.baseByArea[a].capSteps,'Güncel Resmî EI (%)':model.current.metrics[a].ei,
      'Validasyon Adayları Dahil EI (%)':model.projection[a].candidateEI,'Aday PQ':model.projection[a].candidateCount,
      'Tüm CAP Başarılı Teorik EI (%)':model.projection[a].theoreticalEI,'CAP Bulunan NS PQ':model.projection[a].theoreticalCount}));
    const visits=model.stages.flatMap(v=>['Overall',...AREAS].map(a=>({'Ziyaret':v.name,'Tarih':v.date,'Aşama':phaseLabel(v),
      'Alan':a,'EI (%)':v.metrics[a].ei,'S PQ':v.metrics[a].satisfactory,'NS PQ':v.metrics[a].notSatisfactory,
      'Değişim (puan)':v.cells?.[a]?.delta??null,'Alan Durumu':v.cells?.[a]?.inScope===false?'Valide edilmedi':'Kapsamda',
      'Nihai PQ':v.counts?.finalized??0,'Kapsam PQ':v.counts?.total??0,'No Change':v.counts?.unchanged??0,
      'Kaynak':v.source||'CMAA başlangıcı','PQ Seti Değişti':v.versionChanged?'Evet':'Hayır'})));
    return{areas,visits};
  }
  window.DashboardOverview.exportRows=exportRows;
  window.exportDashboardOverviewExcel=function(){
    const model=build(collect()),data=exportRows(model),wb=XLSX.utils.book_new();
    for(const [name,rows] of [['Alan_ve_Overall',data.areas],['Ziyaret_Asamalari',data.visits],['CAP_Kaynaklari',model.cap.sources.map(s=>({'Alan':s.area,'CAP Kaynak Tarihi':s.date,'Dosyalar':s.files.join(', ')}))]]){
      XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows),name);
    }
    XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet([
      {Kural:'Seçili aşama',Açıklama:model.selectedStage.name+' · '+phaseLabel(model.selectedStage)},
      {Kural:'Kayıtlı resmî EI referansı',Açıklama:model.current.name},
      {Kural:'PQ sonuç önceliği',Açıklama:'Nihai sonuç, yoksa taslak sonuç. No Change önceki aşamanın S/NS/N-A durumunu korur.'},
      {Kural:'Ziyaret tamamlanması',Açıklama:'Tüm kapsam PQ’larında Satisfactory, Not Satisfactory veya No Change nihai sonucu girildiğinde nihai aşama.'},
      {Kural:'Projeksiyon',Açıklama:'Seçili aşamada halen NS olan PQ’lar; her PQ bir kez. Taslak sonuçlar dahilse aşama etiketinde belirtilir.'},
      {Kural:'CAP kaynağı',Açıklama:capAsOf||'Her alanın en güncel kaynağı'},
      ...model.issues.map(x=>({Kural:'Veri kontrolü',Açıklama:x}))]),'Hesap_ve_Kaynak');
    XLSX.writeFile(wb,'Dashboard_CMAA_Validasyon_CAP.xlsx');
  };
  window.exportDashboardOverviewPDF=function(){
    const model=build(collect()),selected=model.selectedStage;
    const areaBody=[['Alan','Aşama EI','S','NS','CAP adımı','Aday EI','Teorik EI'],...['Overall',...AREAS].map(a=>[a,fmt(selected.metrics[a].ei),count(selected.metrics[a].satisfactory),count(selected.metrics[a].notSatisfactory),count(model.selectedByArea[a].capSteps),fmt(model.projection[a].candidateEI),fmt(model.projection[a].theoreticalEI)])];
    const visitBody=[['Aşama / ziyaret','Overall',...AREAS],...model.stages.map(v=>[`${v.name}\n${v.date} · ${phaseLabel(v)}${v.counts?.total?`\n${v.counts.finalized}/${v.counts.total} PQ nihai · ${v.counts.unchanged||0} No Change`:''}`,...['Overall',...AREAS].map(a=>fmt(v.metrics[a].ei)+'\n'+(v.cells?.[a]?.inScope===false?'Valide edilmedi':delta(v.cells?.[a]?.delta??null)))])];
    const content=[{text:'CMAA, OSVA, ICVM ve Ziyaret Aşamaları',fontSize:17,bold:true,margin:[0,0,0,8]},
      {text:`Seçili aşama: ${selected.name} · ${phaseLabel(selected)} · ${selected.date||'-'}\nKayıtlı resmî EI referansı: ${model.current.name} · ${fmt(model.current.metrics.Overall.ei)}`,fontSize:9,margin:[0,0,0,10]},
      {table:{headerRows:1,widths:['*','*','*','*','*','*','*'],body:areaBody},layout:'lightHorizontalLines'},
      {text:'CMAA → OSVA → ICVM ve sonraki ziyaretler',bold:true,margin:[0,18,0,8]},
      {table:{headerRows:1,widths:[125,...Array(9).fill('*')],body:visitBody},layout:'lightHorizontalLines'},
      {text:'Resmî ziyaretlerin taslak ve nihai PQ sonuçları seçili aşama istatistiklerine dahildir. No Change önceki durumu korur. Kayıtlı rapor/Full PQ Status referansı ayrı saklanır. Aday ve teorik EI seçili aşamadan hesaplanan senaryolardır. CAP Word resmî ziyaret sonucu oluşturmaz.',fontSize:8,margin:[0,12,0,0]},
      ...model.issues.map(text=>({text,fontSize:8,margin:[0,5,0,0]}))];
    return safeDownloadPdf(createStandardPdfDefinition(content,{pageOrientation:'landscape',pageSize:'A4',defaultStyle:{font:'Roboto',fontSize:8}}),'Dashboard_CMAA_Validasyon_CAP.pdf');
  };
  window.renderDashboardOverview=render;
  window.setDashboardCmaa=id=>{baselineId=id;stageId='';render();};
  window.setDashboardStage=id=>{stageId=id;render();};
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
