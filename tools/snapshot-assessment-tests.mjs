#!/usr/bin/env node
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const clone=x=>JSON.parse(JSON.stringify(x));
const AREAS=['LEG','ORG','PEL','OPS','AIR','AIG','ANS','AGA'];
function fixture(){
  const pqStates={a:{area:'LEG',pq:'1.001',status:'S'},b:{area:'LEG',pq:'1.002',status:'NS'}};
  const areas=Object.fromEntries(AREAS.map(a=>[a,{satisfactory:a==='LEG'?1:0,notSatisfactory:a==='LEG'?1:0,notApplicable:0,unknown:0,applicable:a==='LEG'?2:0,total:a==='LEG'?2:0,ei:a==='LEG'?50:null}]));
  return{ok:true,states:pqStates,counts:{areas,overall:{satisfactory:1,notSatisfactory:1,notApplicable:0,unknown:0,applicable:2,total:2,ei:50}},sheet:'Status'};
}
function visits(){return Object.fromEntries(['CMAA','OSVA','ICVM'].map((type,i)=>[type.toLowerCase(),{visitName:type+' ziyareti',visitType:'icao_official',icaoVisitType:type,actualEnd:`2026-0${i+1}-10`,areas:i?['OPS','AIR']:AREAS,status:i===2?'planned':'completed'}]));}
function setup(){
  let key=0,reject=false,allowed=true;
  const nodes=new Map(),writes=[],listeners=new Map(),alerts=[];
  const user={uid:'tester',email:'tester@example.invalid'};
  const ctx={console:{log(){},error(){},warn(){}},setTimeout:()=>0,clearTimeout(){},localStorage:{getItem(){return null;}},
    document:{getElementById:id=>nodes.get(id)||null,addEventListener(){}},
    firebase:{auth:()=>({currentUser:ctx.user})},user,hasAccessPermission:()=>allowed,
    alert:m=>alerts.push(m),confirm:()=>true,ICAO_GLOBAL_ORDER:AREAS,baseEIData:{},
    refreshAllFilters(){},renderFileList(){},render(){},showAppRuntimeToast(){},
    db:{ref:(path='')=>({push:()=>({key:'new_'+(++key)}),on:(_,cb)=>listeners.set(path,cb),off(){},update:async value=>{if(reject)throw new Error('Write denied');writes.push(clone(value));}})}};
  ctx.window=ctx;vm.createContext(ctx);
  const app=fs.readFileSync(root+'js/app.js','utf8'),a=app.indexOf('    window.setBaseEiDataFromStateSnapshot ='),b=app.indexOf('    // RC1.3:',a);
  vm.runInContext(app.slice(a,b),ctx);
  for(const file of ['state-compliance','assessment-events','official-ei-management'])vm.runInContext(fs.readFileSync(root+`js/modules/${file}.js`,'utf8'),ctx,{filename:file});
  ctx.icaoVisits=visits();
  const element=(id,value='')=>{const node={value,innerHTML:'',hidden:true,focus(){this.focused=true;}};nodes.set(id,node);return node;};
  const select=element('stateSnapshotAssessmentEvent'),status=element('stateSnapshotAssessmentStatus');element('stateSnapshotAssessmentStatusField');
  const meta=(target='visit:cmaa',result='official',more={})=>({id:'snapshot',name:'Full Status',effectiveAsOfDate:'2026-04-01',sourceFile:{name:'Full_Status.xlsx'},linkedAssessmentEventId:target,assessmentResultStatus:result,pqVersion:'2024',...more});
  return{ctx,nodes,writes,alerts,element,select,status,meta,setReject:v=>reject=v,setAllowed:v=>allowed=v,emit:(p,v)=>listeners.get(p)?.({val:()=>clone(v)})};
}
let passed=0;async function check(name,fn){await fn();passed++;console.log('PASS',name);}
await check('visit-only CMAA OSVA ICVM records populate the previously empty list',()=>{
  const t=setup(),rows=t.ctx.getStateSnapshotAssessmentOptions();assert.equal(rows.length,3);assert.equal(rows.map(x=>x.type).join(','),'CMAA,OSVA,ICVM');
  t.ctx.openStateSnapshotCenter();for(const type of ['CMAA','OSVA','ICVM'])assert.match(t.select.innerHTML,new RegExp(type));assert.equal(t.writes.length,0);
});
await check('internal deleted inactive and cancelled visits are excluded',()=>{
  const t=setup();t.ctx.icaoVisits={...visits(),internal:{visitType:'internal'},deleted:{...visits().cmaa,isDeleted:true},inactive:{...visits().cmaa,active:false},cancelled:{...visits().cmaa,status:'cancelled'}};assert.equal(t.ctx.getStateSnapshotAssessmentOptions().length,3);
});
await check('a stored id property cannot replace the real visit database key',()=>{
  const t=setup();t.ctx.icaoVisits.cmaa.id='wrong';assert.equal(t.ctx.getStateSnapshotAssessmentOptions()[0].id,'visit:cmaa');
});
await check('official EI records appear before their generated assessment events load',()=>{
  const t=setup();t.ctx.icaoVisits={};t.ctx.icaoOfficialEiRecords.cmaa={name:'CMAA stored',type:'CMAA',assessmentDate:'2026-01-01'};
  assert.equal(t.ctx.getStateSnapshotAssessmentOptions()[0].id,'official_cmaa');
});
await check('an explicit visit relation merges record and event without duplicate options',()=>{
  const t=setup();t.ctx.icaoOfficialEiRecords.r={name:'CMAA stored',type:'CMAA',linkedVisitId:'cmaa'};t.ctx.icaoAssessmentEvents.official_r={name:'CMAA generated',sourceRecordId:'r',linkedVisitId:'cmaa'};
  assert.equal(t.ctx.getStateSnapshotAssessmentOptions().length,3);assert.equal(t.ctx.getStateSnapshotAssessmentOptions().filter(x=>x.linkedVisitId==='cmaa').length,1);
});
await check('matching names or dates do not merge unrelated visits and assessments',()=>{
  const t=setup();t.ctx.icaoOfficialEiRecords.r={name:'CMAA ziyareti',type:'CMAA',assessmentDate:'2026-01-10'};assert.equal(t.ctx.getStateSnapshotAssessmentOptions().length,4);
});
await check('deleted official records cannot reappear through a delayed cached event',()=>{
  const t=setup();t.ctx.icaoOfficialEiRecords.r={isDeleted:true};t.ctx.icaoAssessmentEvents.official_r={sourceRecordId:'r',name:'Removed'};assert.ok(!t.ctx.getStateSnapshotAssessmentOptions().some(x=>x.id==='official_r'));
});
await check('late refresh preserves the selected visit and unsaved metadata',()=>{
  const t=setup();t.ctx.openStateSnapshotCenter();t.select.value='visit:icvm';t.element('stateSnapshotName','Unsaved title');t.element('stateSnapshotDate','2026-06-01');t.status.value='draft';t.ctx.refreshStateSnapshotAssessmentOptions();
  assert.equal(t.select.value,'visit:icvm');assert.equal(t.nodes.get('stateSnapshotName').value,'Unsaved title');assert.equal(t.nodes.get('stateSnapshotDate').value,'2026-06-01');assert.equal(t.status.value,'draft');assert.equal(t.nodes.get('stateSnapshotAssessmentStatusField').hidden,false);
});
await check('a temporarily missing selected event is retained instead of silently unlinked',()=>{
  const t=setup();t.select.value='loading_event';t.ctx.refreshStateSnapshotAssessmentOptions();assert.equal(t.select.value,'loading_event');assert.match(t.select.innerHTML,/yükleniyor/);
});
await check('late assessment listener refreshes the open selector',()=>{
  const t=setup();t.ctx.startAssessmentEventListener();t.emit('icao_assessment_events',{event:{name:'Late event',type:'CMAA',assessmentDate:'2025-01-01'}});assert.match(t.select.innerHTML,/Late event/);
});
await check('late official-record listener refreshes the open selector',()=>{
  const t=setup();t.ctx.startIcaoOfficialEiListener();t.emit('icao_official_ei',{record:{name:'Late raw record',type:'OSVA'}});assert.match(t.select.innerHTML,/Late raw record/);
});
await check('read-only source previews create no assessments or database writes',()=>{
  const t=setup();t.element('stateSnapshotSources');t.ctx.openStateSnapshotCenter();t.ctx.selectStateSnapshotAssessment('visit:cmaa');assert.equal(Object.keys(t.ctx.icaoOfficialEiRecords).length,0);assert.equal(t.writes.length,0);
});
await check('visit selection requires an explicit final draft or provisional result status',async()=>{
  const t=setup();await assert.rejects(t.ctx.saveParsedStateComplianceSnapshot(fixture(),t.meta('visit:cmaa','')),/sonucunu/);assert.equal(t.writes.length,0);
});
await check('completed visit status alone never implies an official EI result',()=>{
  const t=setup();assert.equal(t.ctx.getStateSnapshotAssessmentOptions()[0].resultStatus,undefined);
});
await check('an explicit final visit binding saves source record event and EI atomically',async()=>{
  const t=setup();const saved=await t.ctx.saveParsedStateComplianceSnapshot(fixture(),t.meta());const u=t.writes[0],r=Object.values(t.ctx.icaoOfficialEiRecords)[0];
  assert.equal(t.writes.length,1);assert.equal(Object.keys(u).length,4);assert.equal(saved.payload.linkedVisitId,'cmaa');assert.equal(saved.payload.linkedAssessmentEventId,r.assessmentEventId);assert.equal(r.resultStatus,'official');assert.equal(r.type,'CMAA');assert.equal(r.overallEI,50);
  assert.equal(t.ctx.icaoEiSnapshots[r.eiSnapshotId].overall.ei,50);assert.equal(t.ctx.getLatestStateComplianceSnapshot().id,'snapshot');
});
await check('assessment dates come from the selected visit rather than Excel import dates',async()=>{
  const t=setup();await t.ctx.saveParsedStateComplianceSnapshot(fixture(),t.meta());const r=Object.values(t.ctx.icaoOfficialEiRecords)[0];assert.equal(r.assessmentDate,'2026-01-10');assert.equal(t.ctx.icaoStateSnapshots.snapshot.effectiveAsOfDate,'2026-04-01');
});
await check('OSVA binding retains its actual scope and never marks other areas validated',async()=>{
  const t=setup();await t.ctx.saveParsedStateComplianceSnapshot(fixture(),t.meta('visit:osva'));const r=Object.values(t.ctx.icaoOfficialEiRecords)[0];assert.equal(r.scopeAreas.join(','),'OPS,AIR');assert.equal(t.ctx.icaoEiSnapshots[r.eiSnapshotId].areas.LEG.inScope,false);
});
await check('draft Full Status creates a draft assessment while leaving official EI empty',async()=>{
  const t=setup();await t.ctx.saveParsedStateComplianceSnapshot(fixture(),t.meta('visit:icvm','draft'));const r=Object.values(t.ctx.icaoOfficialEiRecords)[0];assert.equal(r.resultStatus,'draft');assert.equal(t.ctx.icaoAssessmentEvents[r.assessmentEventId].resultStatus,'draft');assert.equal(t.ctx.getLatestStateComplianceSnapshot(),null);assert.equal(Object.keys(t.ctx.getCurrentEiBaseData()).length,0);assert.equal(t.ctx.getCurrentPqState('1.001','LEG'),null);
});
await check('provisional Full Status also stays outside official working EI',async()=>{
  const t=setup();await t.ctx.saveParsedStateComplianceSnapshot(fixture(),t.meta('visit:cmaa','provisional'));assert.equal(t.ctx.getLatestStateComplianceSnapshot(),null);
});
await check('draft imports preserve the previous final PQ baseline',async()=>{
  const t=setup();await t.ctx.saveParsedStateComplianceSnapshot(fixture(),t.meta());await t.ctx.saveParsedStateComplianceSnapshot(fixture(),t.meta('visit:icvm','draft',{id:'draft',importKey:'draft_file'}));assert.equal(t.ctx.getLatestStateComplianceSnapshot().id,'snapshot');assert.equal(t.ctx.getCurrentEiBaseData().LEG.snapshotId,'snapshot');
});
await check('an imported id property cannot prevent saving the correctly selected visit',async()=>{
  const t=setup();t.ctx.icaoVisits.cmaa.id='wrong';await t.ctx.saveParsedStateComplianceSnapshot(fixture(),t.meta());assert.equal(Object.values(t.ctx.icaoOfficialEiRecords)[0].linkedVisitId,'cmaa');
});
await check('later draft classification removes a source from the official working baseline',async()=>{
  const t=setup();await t.ctx.saveParsedStateComplianceSnapshot(fixture(),t.meta());const r=Object.values(t.ctx.icaoOfficialEiRecords)[0];r.resultStatus='draft';t.ctx.refreshStateSnapshotAssessmentOptions();assert.equal(t.ctx.getLatestStateComplianceSnapshot(),null);assert.equal(Object.keys(t.ctx.getCurrentEiBaseData()).length,0);
});
await check('unrelated visit refreshes do not repeatedly rebuild the current EI cache',()=>{
  const t=setup();let calls=0;const real=t.ctx.setBaseEiDataFromStateSnapshot;t.ctx.setBaseEiDataFromStateSnapshot=s=>{calls++;return real(s);};
  t.ctx.refreshStateSnapshotAssessmentOptions();t.ctx.refreshStateSnapshotAssessmentOptions();t.ctx.refreshStateSnapshotAssessmentOptions();assert.equal(calls,1);
});
await check('an existing raw EI assessment can be bound without creating another record',async()=>{
  const t=setup();t.ctx.icaoOfficialEiRecords.cmaa={name:'CMAA',type:'CMAA',resultStatus:'official',assessmentDate:'2026-01-01',published:{override:true,overallEI:51}};
  await t.ctx.saveParsedStateComplianceSnapshot(fixture(),t.meta('official_cmaa'));assert.equal(Object.keys(t.ctx.icaoOfficialEiRecords).length,1);assert.equal(t.ctx.icaoOfficialEiRecords.cmaa.overallEI,51);assert.equal(t.ctx.icaoOfficialEiRecords.cmaa.overallApplicable,2);
});
await check('saving metadata repeatedly keeps the same linked assessment identity',async()=>{
  const t=setup();const first=await t.ctx.saveParsedStateComplianceSnapshot(fixture(),t.meta());await t.ctx.saveParsedStateComplianceSnapshot(fixture(),t.meta(first.payload.linkedAssessmentEventId));assert.equal(Object.keys(t.ctx.icaoOfficialEiRecords).length,1);
});
await check('new source metrics override stale loaded counts when editing the same snapshot',async()=>{
  const t=setup();const first=await t.ctx.saveParsedStateComplianceSnapshot(fixture(),t.meta());const next=fixture();next.states.b.status='S';next.counts.areas.LEG={...next.counts.areas.LEG,satisfactory:2,notSatisfactory:0,ei:100};next.counts.overall={...next.counts.overall,satisfactory:2,notSatisfactory:0,ei:100};
  await t.ctx.saveParsedStateComplianceSnapshot(next,t.meta(first.payload.linkedAssessmentEventId));assert.equal(Object.values(t.ctx.icaoEiSnapshots)[0].overall.ei,100);assert.equal(Object.values(t.ctx.icaoEiSnapshots)[0].areas.LEG.ei,100);
});
await check('metadata relinking clears orphan derived EI from the previous assessment atomically',async()=>{
  const t=setup();const first=await t.ctx.saveParsedStateComplianceSnapshot(fixture(),t.meta());await t.ctx.saveParsedStateComplianceSnapshot(fixture(),t.meta('visit:osva'));
  const old=t.ctx.icaoOfficialEiRecords[first.payload.linkedAssessmentEventId.replace('official_','')];assert.equal(old.stateSnapshotId,undefined);assert.equal(old.overallEI,undefined);assert.equal(t.ctx.icaoStateSnapshots.snapshot.linkedVisitId,'osva');
});
await check('removing a visit before save fails without losing the previous link',async()=>{
  const t=setup();delete t.ctx.icaoVisits.cmaa;await assert.rejects(t.ctx.saveParsedStateComplianceSnapshot(fixture(),t.meta()),/yüklenemedi/);assert.equal(t.writes.length,0);
});
await check('missing visit dates are reported instead of inferred from file dates',async()=>{
  const t=setup();delete t.ctx.icaoVisits.cmaa.actualEnd;await assert.rejects(t.ctx.saveParsedStateComplianceSnapshot(fixture(),t.meta()),/tarihini/);assert.equal(t.writes.length,0);
});
await check('a failed atomic save leaves visits sources and assessments unchanged',async()=>{
  const t=setup();const before=JSON.stringify([t.ctx.icaoVisits,t.ctx.icaoStateSnapshots,t.ctx.icaoOfficialEiRecords]);t.setReject(true);await assert.rejects(t.ctx.saveParsedStateComplianceSnapshot(fixture(),t.meta()),/denied/);assert.equal(JSON.stringify([t.ctx.icaoVisits,t.ctx.icaoStateSnapshots,t.ctx.icaoOfficialEiRecords]),before);
});
await check('unauthenticated users cannot bind snapshots or create assessment records',async()=>{
  const t=setup();t.ctx.user=null;await assert.rejects(t.ctx.saveParsedStateComplianceSnapshot(fixture(),t.meta()),/oturum/);assert.equal(t.writes.length,0);
});
await check('roles without EI write access cannot create bindings',async()=>{
  const t=setup();t.setAllowed(false);await assert.rejects(t.ctx.saveParsedStateComplianceSnapshot(fixture(),t.meta()),/yetkisi/);assert.equal(t.writes.length,0);
});
await check('CAP history and visit records stay intact during explicit source binding',async()=>{
  const t=setup();t.ctx.rawData=[{sourceFile:'CAP.docx',progress:'Completed'}];const before=JSON.stringify([t.ctx.icaoVisits,t.ctx.rawData]);await t.ctx.saveParsedStateComplianceSnapshot(fixture(),t.meta());assert.equal(JSON.stringify([t.ctx.icaoVisits,t.ctx.rawData]),before);assert.ok(Object.keys(t.writes[0]).every(p=>!p.startsWith('icao_visits')&&!p.startsWith('icao_system')));
});
await check('source table includes visit-only entries with a direct snapshot binding action',()=>{
  const t=setup();const el=t.element('stateSnapshotSources');t.ctx.renderStateSnapshotSources();for(const type of ['CMAA','OSVA','ICVM'])assert.match(el.innerHTML,new RegExp(type));assert.match(el.innerHTML,/selectStateSnapshotAssessment/);assert.match(el.innerHTML,/Sonuç kaydı yok/);
});
await check('normal unlinked Full Status imports remain supported',async()=>{
  const t=setup();const saved=await t.ctx.saveParsedStateComplianceSnapshot(fixture(),t.meta(''));assert.equal(saved.payload.linkedAssessmentEventId,'');assert.equal(Object.keys(t.ctx.icaoOfficialEiRecords).length,0);assert.equal(t.writes.length,1);
});
console.log(`SNAPSHOT ASSESSMENT TEST RESULT: ${passed} PASS / 0 FAIL`);
