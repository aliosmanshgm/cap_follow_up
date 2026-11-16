#!/usr/bin/env node
import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),clone=x=>x==null?null:JSON.parse(JSON.stringify(x));
function setup(shared={}){
  const store=shared,reads=[],writes=[],alerts=[],confirmations=[];let counter=0,readFailure=false,race=false;
  const ctx={console,setTimeout:()=>0,clearTimeout(){},document:{getElementById(){return null;},addEventListener(){}},localStorage:{getItem(){return null;}},
    user:{uid:'owner',email:'owner@example.invalid'},allowed:true,confirmed:true,
    firebase:{auth:()=>({currentUser:ctx.user})},hasAccessPermission:()=>ctx.allowed,
    alert:m=>alerts.push(m),confirm:m=>{confirmations.push(m);return ctx.confirmed;},showAppRuntimeToast(){}};
  ctx.window=ctx;let transactionCalls=0;
  ctx.db={ref(path=''){
    const ref={push:()=>({key:ctx.user.uid+'_'+(++counter)}),limitToFirst(){return ref;},
      async once(){reads.push(path);if(readFailure)throw new Error('Read failed');const value=clone(store[path]);return{val:()=>value,exists:()=>value!=null&&Object.keys(value).length>0};},
      async transaction(update){transactionCalls++;if(race)store[path]={concurrent:{name:'Concurrent actual assessment'}};
        const next=update(clone(store[path]));if(next===undefined)return{committed:false};store[path]=clone(next);writes.push({path,value:clone(next)});return{committed:true};}};
    return ref;
  }};
  vm.createContext(ctx);for(const f of ['js/modules/assessment-events.js','js/modules/official-ei-management.js'])vm.runInContext(fs.readFileSync(root+f,'utf8'),ctx,{filename:f});
  return{ctx,store,reads,writes,alerts,confirmations,get transactionCalls(){return transactionCalls;},setReadFailure:v=>readFailure=v,setRace:v=>race=v};
}
let passed=0;async function check(name,fn){await fn();passed++;console.log('PASS',name);}
await check('existing official EI records block initial periods without asking to append',async()=>{
  const t=setup({'icao_official_ei':{actual:{name:'CMAA (Eylül 2024)',assessmentDate:'2024-09-16'}}});await t.ctx.seedDefaultIcaoOfficialEiData();assert.equal(t.writes.length,0);assert.equal(t.confirmations.length,0);assert.match(t.alerts[0],/eklenmedi/);
});
await check('a different saved name or date cannot bypass the existing-record check',async()=>{
  const t=setup({'icao_official_ei':{actual:{name:'My OSVA',assessmentDate:'2026-05-09'}}});await t.ctx.seedDefaultIcaoOfficialEiData();assert.equal(t.transactionCalls,0);
});
await check('the server is checked even when the local official-record cache is empty',async()=>{
  const t=setup({'icao_official_ei':{actual:{name:'Already stored'}}});assert.equal(Object.keys(t.ctx.icaoOfficialEiRecords).length,0);await t.ctx.seedDefaultIcaoOfficialEiData();assert.ok(t.reads.includes('icao_official_ei'));assert.equal(t.writes.length,0);
});
for(const path of ['icao_assessment_events','icao_ei_snapshots','icao_state_snapshots'])await check('existing '+path+' data also blocks unrelated initial periods',async()=>{
  const t=setup({[path]:{actual:{name:'Existing source'}}});await t.ctx.seedDefaultIcaoOfficialEiData();assert.equal(t.writes.length,0);assert.equal(t.confirmations.length,0);
});
await check('the three existing ICAO visit records block bootstrap even without EI records',async()=>{
  const t=setup({'icao_visits':Object.fromEntries(['CMAA','OSVA','ICVM'].map(type=>[type,{visitType:'icao_official',icaoVisitType:type}]))});await t.ctx.seedDefaultIcaoOfficialEiData();assert.equal(t.writes.length,0);assert.equal(t.transactionCalls,0);
});
await check('an internal visit does not masquerade as an ICAO result',async()=>{
  const t=setup({'icao_visits':{internal:{visitType:'internal'}}});await t.ctx.seedDefaultIcaoOfficialEiData();assert.equal(t.writes.length,1);
});
await check('deleted historical EI records still prevent restoring defaults on top of a used system',async()=>{
  const t=setup({'icao_official_ei':{old:{isDeleted:true,active:false}}});await t.ctx.seedDefaultIcaoOfficialEiData();assert.equal(t.writes.length,0);
});
await check('empty-system confirmation identifies the actual coded values and their source',async()=>{
  const t=setup();await t.ctx.seedDefaultIcaoOfficialEiData();assert.match(t.confirmations[0],/%50,69/);assert.match(t.confirmations[0],/%55,28/);assert.match(t.confirmations[0],/Excel veya ICAO raporu okumaz/);assert.equal(Object.keys(t.store.icao_official_ei).length,2);
});
await check('created initial percentages carry explicit built-in provenance and no fabricated counts',async()=>{
  const t=setup();await t.ctx.seedDefaultIcaoOfficialEiData();for(const r of Object.values(t.store.icao_official_ei)){assert.equal(r.seedOrigin,'built_in_initial_periods');assert.match(r.source,/Kodda tanımlı/);assert.equal(r.overallApplicable,undefined);assert.equal(r.stateSnapshotId,undefined);}
});
await check('a second invocation cannot append another pair of initial periods',async()=>{
  const t=setup();await t.ctx.seedDefaultIcaoOfficialEiData();await t.ctx.seedDefaultIcaoOfficialEiData();assert.equal(t.writes.length,1);assert.equal(Object.keys(t.store.icao_official_ei).length,2);
});
await check('canceling empty-system confirmation performs no write',async()=>{
  const t=setup();t.ctx.confirmed=false;await t.ctx.seedDefaultIcaoOfficialEiData();assert.equal(t.writes.length,0);assert.equal(t.transactionCalls,0);
});
await check('an EI record appearing after preflight aborts the transaction',async()=>{
  const t=setup();t.setRace(true);await t.ctx.seedDefaultIcaoOfficialEiData();assert.equal(t.writes.length,0);assert.equal(Object.keys(t.store.icao_official_ei).join(','),'concurrent');assert.match(t.alerts[0],/İşlem sırasında/);
});
await check('two clients cannot both create initial period sets',async()=>{
  const shared={},a=setup(shared),b=setup(shared);b.ctx.user.uid='second';await Promise.all([a.ctx.seedDefaultIcaoOfficialEiData(),b.ctx.seedDefaultIcaoOfficialEiData()]);assert.equal(a.writes.length+b.writes.length,1);assert.equal(Object.keys(shared.icao_official_ei).length,2);
});
await check('repeated clicks during preflight perform only one initialization',async()=>{
  const t=setup();await Promise.all([t.ctx.seedDefaultIcaoOfficialEiData(),t.ctx.seedDefaultIcaoOfficialEiData()]);assert.equal(t.transactionCalls,1);
});
await check('read failures do not treat the database as empty',async()=>{
  const t=setup();t.setReadFailure(true);await t.ctx.seedDefaultIcaoOfficialEiData();assert.equal(t.writes.length,0);assert.equal(t.transactionCalls,0);assert.match(t.alerts[0],/Read failed/);
});
await check('unauthenticated bootstrap is blocked before database access',async()=>{
  const t=setup();t.ctx.user=null;await t.ctx.seedDefaultIcaoOfficialEiData();assert.equal(t.reads.length,0);assert.equal(t.writes.length,0);
});
await check('roles without EI write permission cannot initialize records',async()=>{
  const t=setup();t.ctx.allowed=false;await t.ctx.seedDefaultIcaoOfficialEiData();assert.equal(t.reads.length,0);assert.equal(t.writes.length,0);
});
await check('bootstrap never mutates CAP or existing visit contents',async()=>{
  const t=setup({'icao_system':{rawData:[{progress:'Completed'}]},'icao_visits':{internal:{visitType:'internal'}}});const before=JSON.stringify([t.store.icao_system,t.store.icao_visits]);await t.ctx.seedDefaultIcaoOfficialEiData();assert.equal(JSON.stringify([t.store.icao_system,t.store.icao_visits]),before);assert.equal(t.writes[0].path,'icao_official_ei');
});
await check('older built-in seed records can be identified by their exact provenance',()=>{
  const t=setup();assert.equal(t.ctx.isBuiltInInitialEiRecord({moduleVersion:'official-ei-management-v3-assessment',notes:'Başlangıç veri seti'}),true);
});
await check('a manually entered CMAA name and matching EI are not enough to mark an actual record as a seed',()=>{
  const t=setup();assert.equal(t.ctx.isBuiltInInitialEiRecord({name:'CMAA',overallEI:50.69,moduleVersion:'current'}),false);
});
console.log(`INITIAL PERIOD TEST RESULT: ${passed} PASS / 0 FAIL`);
