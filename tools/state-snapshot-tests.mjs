#!/usr/bin/env node
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const clone=x=>JSON.parse(JSON.stringify(x));
const areas=['LEG','ORG','PEL','OPS','AIR','AIG','ANS','AGA'];
function state(name='Source',date='2026-11-14'){
  return {name,effectiveAsOfDate:date,snapshotDate:date,sourceType:'olf_full_status',active:true,isDeleted:false,
    sourceFile:{name:name+'.xlsx'},pqStates:{a:{area:'LEG',pq:'1.001',status:'S'},b:{area:'LEG',pq:'1.002',status:'NS'}},
    counts:{areas:{LEG:{satisfactory:1,notSatisfactory:1,applicable:2,ei:50}},overall:{satisfactory:1,notSatisfactory:1,applicable:2,ei:50}}};
}
function setup(){
  const nodes=new Map(),writes=[],messages=[],confirmations=[];
  let reject=false,pause=null,allowed=true;
  const user={uid:'tester',email:'tester@example.invalid'};
  const ctx={console:{log(){},warn(){},error(){}},setTimeout:()=>0,clearTimeout(){},localStorage:{getItem(){return null;}},
    document:{getElementById:id=>nodes.get(id)||null,addEventListener(){}},firebase:{auth:()=>({currentUser:ctx.user})},
    alert:msg=>messages.push(msg),confirm:msg=>{confirmations.push(msg);return ctx.confirmed;},
    db:{ref:()=>({update:async updates=>{writes.push(clone(updates));if(pause)await pause;if(reject)throw new Error('permission denied');}})},
    hasAccessPermission:()=>allowed,user,confirmed:true,ICAO_GLOBAL_ORDER:areas,baseEIData:{},
    refreshAllFilters(){},renderFileList(){},render(){},showAppRuntimeToast(){}};
  ctx.window=ctx;vm.createContext(ctx);
  const app=fs.readFileSync(root+'js/app.js','utf8');
  const from=app.indexOf('    window.setBaseEiDataFromStateSnapshot ='),to=app.indexOf('    // RC1.3:',from);
  vm.runInContext(app.slice(from,to),ctx);
  for(const file of ['js/modules/state-compliance.js','js/modules/assessment-events.js','js/modules/official-ei-management.js'])vm.runInContext(fs.readFileSync(root+file,'utf8'),ctx,{filename:file});
  const original=ctx.setBaseEiDataFromStateSnapshot;
  ctx.setBaseEiDataFromStateSnapshot({...state(),id:'target'});
  ctx.icaoStateSnapshots={target:state()};
  function link(record={}){
    const r={name:'CMAA',type:'CMAA',assessmentDate:'2026-11-14',resultStatus:'official',active:true,
      stateSnapshotId:'target',overallEI:50,overallSatisfactory:1,overallApplicable:2,areas:{LEG:50},areaCounts:{LEG:{satisfactory:1,applicable:2,notSatisfactory:1}},
      calculated:{overallEI:50},sourceOfTruth:{stateSnapshotId:'target'},published:{override:false},eventMetrics:{scopeApplicable:2},...record};
    ctx.icaoStateSnapshots.target.linkedAssessmentEventId='official_record';ctx.icaoOfficialEiRecords.record=r;
    const n=ctx.normalizeOfficialEiToAssessmentModel('record',r);
    ctx.icaoAssessmentEvents[n.eventId]=n.eventCore;ctx.icaoEiSnapshots[n.snapshotId]=n.snapshotCore;
  }
  return {ctx,writes,nodes,messages,confirmations,link,setReject:x=>reject=x,setPermission:x=>allowed=x,setPause:x=>pause=x};
}
let passed=0;
async function check(name,fn){await fn();passed++;console.log('PASS',name);}
await check('the named record has a delete action in the State Snapshot list',()=>{
  const t=setup();t.nodes.set('stateSnapshotList',{innerHTML:''});t.ctx.openStateSnapshotCenter();
  assert.match(t.nodes.get('stateSnapshotList').innerHTML,/deleteStateComplianceSnapshot/);
  assert.match(t.nodes.get('stateSnapshotList').innerHTML,/officialEi.write/);
});
await check('source actions always use the database key instead of an imported id property',()=>{
  const t=setup();t.ctx.icaoStateSnapshots.target.id='wrong_imported_id';assert.equal(t.ctx.getStateComplianceSnapshots()[0].id,'target');
});
await check('deleting the last state clears the actual legacy EI working cache',async()=>{
  const t=setup();assert.equal(t.ctx.getCurrentEiBaseData().LEG.sat,1);assert.equal(await t.ctx.deleteStateComplianceSnapshot('target'),true);
  assert.equal(Object.keys(t.ctx.getCurrentEiBaseData()).length,0);assert.equal(t.ctx.currentEiSourceKind,'none');
  assert.equal(t.ctx.getLatestStateComplianceSnapshot(),null);assert.equal(t.ctx.getStateComplianceSnapshotById('target'),null);
});
await check('deletion keeps source data and actor audit but excludes it from selectors',async()=>{
  const t=setup();await t.ctx.deleteStateComplianceSnapshot('target');const s=t.ctx.icaoStateSnapshots.target;
  assert.equal(s.isDeleted,true);assert.equal(s.active,false);assert.equal(s.deletedBy.uid,'tester');assert.ok(s.deletedAt);assert.equal(s.pqStates.b.status,'NS');assert.equal(t.ctx.getStateComplianceSnapshots().length,0);
});
await check('deleting the newest snapshot falls back to the remaining older source',async()=>{
  const t=setup();t.ctx.icaoStateSnapshots.old=state('Older','2026-01-01');await t.ctx.deleteStateComplianceSnapshot('target');assert.equal(t.ctx.getCurrentEiBaseData().LEG.snapshotId,'old');
});
await check('deleting an old snapshot preserves the newer current source',async()=>{
  const t=setup();t.ctx.icaoStateSnapshots.new=state('Newer','2026-12-01');await t.ctx.deleteStateComplianceSnapshot('target');assert.equal(t.ctx.getCurrentEiBaseData().LEG.snapshotId,'new');
});
await check('official records and derived EI change with the source in one atomic write',async()=>{
  const t=setup();t.link();await t.ctx.deleteStateComplianceSnapshot('target');assert.equal(t.writes.length,1);const u=t.writes[0];
  assert.equal(u['icao_state_snapshots/target/isDeleted'],true);assert.ok(u['icao_official_ei/record']);assert.ok(u['icao_assessment_events/official_record']);assert.ok(u['icao_ei_snapshots/official_after_record']);
});
await check('source-only calculated EI is removed instead of persisting as a fallback',async()=>{
  const t=setup();t.link();await t.ctx.deleteStateComplianceSnapshot('target');const r=t.ctx.icaoOfficialEiRecords.record;
  assert.equal(r.overallEI,undefined);assert.equal(r.overallApplicable,undefined);assert.equal(r.calculated,undefined);assert.equal(r.areaCounts,undefined);assert.equal(Object.keys(r.areas).length,0);
  assert.equal(t.ctx.icaoEiSnapshots.official_after_record.overall.ei,null);assert.equal(t.ctx.icaoEiSnapshots.official_after_record.areas.LEG.ei,null);
  assert.equal(r.reconciliation.status,'awaiting_state_snapshot');
});
await check('published official percentages survive with unknown counts and no projection denominator',async()=>{
  const t=setup();t.link({published:{override:true,overallEI:61.5,areas:{LEG:70}}});await t.ctx.deleteStateComplianceSnapshot('target');
  const r=t.ctx.icaoOfficialEiRecords.record,e=t.ctx.icaoEiSnapshots.official_after_record;assert.equal(r.overallEI,61.5);assert.equal(r.areas.LEG,70);assert.equal(e.overall.ei,61.5);assert.equal(e.overall.applicable,null);assert.equal(e.areas.LEG.applicable,null);
});
await check('pre-link independent legacy percentages are restored without stale snapshot counts',async()=>{
  const t=setup();t.link({legacyBeforeStateLink:{overallEI:40,areas:{LEG:60}}});await t.ctx.deleteStateComplianceSnapshot('target');
  assert.equal(t.ctx.icaoOfficialEiRecords.record.overallEI,40);assert.equal(t.ctx.icaoOfficialEiRecords.record.areas.LEG,60);assert.equal(t.ctx.icaoOfficialEiRecords.record.overallApplicable,undefined);
});
await check('remaining source explicitly bound to the same assessment replaces the removed source',async()=>{
  const t=setup();t.link();t.ctx.icaoStateSnapshots.old={...state('Older','2026-01-01'),linkedAssessmentEventId:'official_record'};
  await t.ctx.deleteStateComplianceSnapshot('target');assert.equal(t.ctx.icaoOfficialEiRecords.record.stateSnapshotId,'old');assert.equal(t.ctx.icaoEiSnapshots.official_after_record.stateSnapshotId,'old');assert.equal(t.ctx.icaoEiSnapshots.official_after_record.overall.ei,50);
});
await check('date proximity never links an unrelated snapshot to the assessment',async()=>{
  const t=setup();t.link();t.ctx.icaoStateSnapshots.other=state('Other','2026-11-13');await t.ctx.deleteStateComplianceSnapshot('target');assert.equal(t.ctx.icaoOfficialEiRecords.record.stateSnapshotId,undefined);assert.equal(t.ctx.icaoOfficialEiRecords.record.overallEI,undefined);
});
await check('draft published results remain draft after removing their status source',async()=>{
  const t=setup();t.link({resultStatus:'draft',published:{override:true,status:'draft',overallEI:65}});await t.ctx.deleteStateComplianceSnapshot('target');assert.equal(t.ctx.icaoAssessmentEvents.official_record.resultStatus,'draft');
});
await check('a legacy draft report cannot become official when its linked source is removed',async()=>{
  const t=setup();t.link({source:'ICAO Draft Report',legacyBeforeStateLink:{overallEI:45,source:'ICAO Draft Report',areas:{LEG:40}}});
  await t.ctx.deleteStateComplianceSnapshot('target');assert.equal(t.ctx.icaoAssessmentEvents.official_record.resultStatus,'draft');assert.equal(t.ctx.icaoOfficialEiRecords.record.published.status,'draft');
});
await check('CAP history, visits and assessment scope metrics are unchanged',async()=>{
  const t=setup();t.link();t.ctx.rawData=[{sourceFile:'CAP.docx',progress:'Completed'}];t.ctx.icaoVisits={visit:{name:'ICVM'}};
  const before=JSON.stringify([t.ctx.rawData,t.ctx.icaoVisits]);await t.ctx.deleteStateComplianceSnapshot('target');assert.equal(JSON.stringify([t.ctx.rawData,t.ctx.icaoVisits]),before);assert.equal(t.ctx.icaoOfficialEiRecords.record.eventMetrics.scopeApplicable,2);
  assert.ok(Object.keys(t.writes[0]).every(p=>!p.startsWith('icao_system')&&!p.startsWith('icao_visits')));
});
await check('standalone derived snapshots cannot keep deleted source percentages',async()=>{
  const t=setup();t.ctx.icaoEiSnapshots.extra={stateSnapshotId:'target',overall:{ei:99},areas:{LEG:{ei:99}}};t.ctx.icaoAssessmentEvents.extra={stateSnapshotId:'target',name:'Visit'};
  await t.ctx.deleteStateComplianceSnapshot('target');assert.equal(Object.keys(t.ctx.icaoEiSnapshots.extra.overall).length,0);assert.equal(t.ctx.icaoAssessmentEvents.extra.stateSnapshotId,'');assert.equal(t.ctx.icaoAssessmentEvents.extra.name,'Visit');
});
await check('canceling confirmation makes no write and keeps source active',async()=>{
  const t=setup();t.ctx.confirmed=false;assert.equal(await t.ctx.deleteStateComplianceSnapshot('target'),false);assert.equal(t.writes.length,0);assert.equal(t.ctx.icaoStateSnapshots.target.active,true);
});
await check('unauthenticated deletion is blocked before confirmation or writes',async()=>{
  const t=setup();t.ctx.user=null;await t.ctx.deleteStateComplianceSnapshot('target');assert.equal(t.writes.length,0);assert.equal(t.confirmations.length,0);
});
await check('a role without official EI permission cannot delete the source',async()=>{
  const t=setup();t.setPermission(false);await t.ctx.deleteStateComplianceSnapshot('target');assert.equal(t.writes.length,0);assert.equal(t.confirmations.length,0);
});
await check('failed atomic writes leave local source, official EI and caches intact',async()=>{
  const t=setup();t.link();t.setReject(true);const before=JSON.stringify([t.ctx.icaoStateSnapshots,t.ctx.icaoOfficialEiRecords,t.ctx.icaoEiSnapshots]);
  assert.equal(await t.ctx.deleteStateComplianceSnapshot('target'),false);assert.equal(JSON.stringify([t.ctx.icaoStateSnapshots,t.ctx.icaoOfficialEiRecords,t.ctx.icaoEiSnapshots]),before);assert.equal(t.ctx.getCurrentEiBaseData().LEG.sat,1);
});
await check('repeated clicks cannot submit overlapping deletion writes',async()=>{
  const t=setup();let resume;t.setPause(new Promise(resolve=>resume=resolve));const first=t.ctx.deleteStateComplianceSnapshot('target');assert.equal(await t.ctx.deleteStateComplianceSnapshot('target'),false);resume();assert.equal(await first,true);assert.equal(t.writes.length,1);
});
await check('inactive sources can also be deleted from the saved list',async()=>{
  const t=setup();t.ctx.icaoStateSnapshots.target.active=false;assert.equal(await t.ctx.deleteStateComplianceSnapshot('target'),true);assert.equal(t.ctx.icaoStateSnapshots.target.isDeleted,true);
});
await check('a deleted or nonexistent source cannot be deleted again',async()=>{
  const t=setup();assert.equal(await t.ctx.deleteStateComplianceSnapshot('missing'),false);await t.ctx.deleteStateComplianceSnapshot('target');assert.equal(await t.ctx.deleteStateComplianceSnapshot('target'),false);assert.equal(t.writes.length,1);
});
await check('EI source map shows the actual named file and official versus draft status',()=>{
  const t=setup();t.link();t.nodes.set('stateSnapshotSources',{innerHTML:''});t.ctx.icaoOfficialEiRecords.osva={name:'OSVA',type:'OSVA',assessmentDate:'2026-01-01',resultStatus:'draft',published:{overallEI:55}};
  t.ctx.renderStateSnapshotSources();const html=t.nodes.get('stateSnapshotSources').innerHTML;assert.match(html,/Source.xlsx/);assert.match(html,/CMAA/);assert.match(html,/Taslak/);assert.match(html,/Yalnız kayıtlı/);
});
await check('deletion resets an open editor so saving cannot accidentally restore its source',async()=>{
  const t=setup();const el={value:'target'};t.nodes.set('stateSnapshotEditId',el);await t.ctx.deleteStateComplianceSnapshot('target');assert.equal(el.value,'');
});
console.log(`STATE SNAPSHOT TEST RESULT: ${passed} PASS / 0 FAIL`);
