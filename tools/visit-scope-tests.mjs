#!/usr/bin/env node
// Scope regressions with the real reference and synchronization modules; no RTDB access.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const read=name=>fs.readFileSync(root+name,'utf8');
const app=read('js/app.js');
let passed=0;
function check(name,fn){fn();passed++;console.log('PASS',name);}
// app.js is a classic browser script. Load its actual top-level functions without
// starting authentication, charts or network listeners in this Node test.
function functionSource(name){
  const start=app.indexOf('    function '+name+'(');
  assert.notEqual(start,-1,'Missing function '+name);
  const end=app.indexOf('\n    }',start)+6;
  return app.slice(start,end);
}
const visit={id:'test',visitName:'Test',areas:['LEG'],scope:{pqs:[{pq:'1.029',verificationType:'Old saved value'}],steps:[]}};
const controls={visitScopeVerificationFilter:{value:'all'},visitScopeDueDate:{value:''}};
const storage=new Map();
const ctx={console,setTimeout,clearTimeout,
  document:{getElementById:id=>controls[id]||null,addEventListener(){},querySelectorAll(){return[];}},
  localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v))},
  rawData:[{pq:'1.029',area:'LEG',step:'1',action:'Current CAP action',sourceFile:'CAP_20260101.docx'}],
  pqMasterData:{'1.029':{alan:'LEG',tur:'On-site',soru:'Stale question',ce:'CE-1',sorumlu:'Owner'},'1.030':{alan:'LEG'},'1.999':{alan:'LEG'}},
  loadedFiles:new Set(),window_loadedReportDate:null,
  normalizePQ:v=>String(v||'').trim(),normalizeAreaKey:v=>String(v||'').trim().toUpperCase(),
  sortAreas:(a,b)=>a.localeCompare(b),sortPQs:(a,b)=>a.localeCompare(b),
  visitArrayValue:v=>Array.isArray(v)?v:Object.values(v||{}),
  getVisitScopeRecord:()=>visit,getVisitScopeStoredPqs:v=>v?.scope?.pqs||[],getVisitScopeStoredSteps:v=>v?.scope?.steps||[],
  isIcaoOfficialVisit:()=>false,isUsableCapStep:row=>!!row.action,
  classifyCommonPQStatus:()=>({code:'open',label:'Open'}),
  classifyCommonActionStatus:()=>({code:'pending',label:'Pending'}),
  makeActionKey:(pq,step,action)=>[pq,step,action].join('|'),
  visitScopeStepKey:row=>[row.pq,row.step,row.action].join('|'),
  COMMON_ACTION_STATUS:{LATE:{code:'late'},DATE_RISK:{code:'date_risk'},COMPLETED:{code:'done'}},
  COMMON_PQ_STATUS:{OFFICIAL_CLOSED:{code:'closed'},CAP_COMPLETED:{code:'done'},NO_CAP:{code:'no_cap'}},
  loadVisitScopeSelection(){},renderVisitScopeCandidates(){},visitWorkspaceTargetStatusClass(){},
  renderVisitWorkspaceSelectedTarget(){},loadVisitWorkspaceSelection(){},renderVisitWorkspaceModule(){},renderVisitPreparationTargetOptions(){}
};
ctx.window=ctx;vm.createContext(ctx);
for(const name of ['normalizeCommonVerificationType','collectPqVerificationValues','firstCommonVerificationType','getCommonVerificationType',
  'normalizeIcaoPqReferenceKey','icaoPqObjectDirectlyMatches','looksLikeIcaoPqLibraryRecord','unwrapIcaoPqLibraryReference','getIcaoPqLibraryRecordForReference',
  'visitScopeMasterText','getVisitScopePqMetadata','buildVisitScopeCandidates','filterVisibleVisitScopeCandidates']){
  vm.runInContext(functionSource(name),ctx,{filename:name});
}
vm.runInContext(read('js/modules/pq-linkage.js'),ctx);
vm.runInContext(read('js/modules/pq-library.js'),ctx);
ctx.fixture={editions:{
  old:{year:'2020',revision:'0',areas:{LEG:{pqs:{old:{pq:'1.029',assessmentMode:'On-site'}}}}},
  current:{year:'2024',revision:'0',areas:{LEG:{pqs:{
    first:{pq:'1.029',assessmentMode:'Off-site',question:'Official question',guidance:'Official guidance',ce:'CE-3'},
    second:{pq:'1.030',assessmentMode:'On-site',question:'Second question'}
  }}}}
},activeByArea:{LEG:{editionKey:'current'}}};
vm.runInContext('icaoPqLibrary=fixture;pqDbLoaded=true;',ctx);

check('canonical reference is unwrapped to a scalar PQ number',()=>{
  const ref=ctx.getIcaoPqLibraryRecordForReference('1.029','LEG');assert.equal(ref.record.pq,'1.029');
});
check('active library mode overrides legacy master and historical edition',()=>assert.equal(ctx.getCommonVerificationType('1.029'),'offSite'));
check('the base scope builder also uses authoritative metadata',()=>{
  const item=ctx.buildVisitScopeCandidates().find(p=>p.pq==='1.029');assert.equal(item.verificationTypeCode,'offSite');assert.equal(item.question,'Official question');
});

vm.runInContext(read('js/modules/visit-sync.js'),ctx);
check('sync override keeps the canonical verification code and display value',()=>{
  const item=ctx.buildVisitScopeCandidates().find(p=>p.pq==='1.029');assert.equal(item.verificationTypeCode,'offSite');assert.equal(item.verificationType,'Off-site');
});
check('current-source candidates use library question, guidance and CE',()=>{
  const item=ctx.buildVisitScopeCandidates().find(p=>p.pq==='1.029');
  assert.equal(item.question,'Official question');assert.equal(item.reviewEvidence,'Official guidance');assert.equal(item.ce,'CE-3');assert.equal(item.responsible,'Owner');
});
check('Off-site filter includes exactly the matching question',()=>{
  controls.visitScopeVerificationFilter.value='offSite';const data=ctx.filterVisibleVisitScopeCandidates(ctx.buildVisitScopeCandidates(),visit);
  assert.equal(data.length,1);assert.equal(data[0].pq,'1.029');
});
check('On-site filter includes exactly the matching question',()=>{
  controls.visitScopeVerificationFilter.value='onSite';const data=ctx.filterVisibleVisitScopeCandidates(ctx.buildVisitScopeCandidates(),visit);
  assert.equal(data.length,1);assert.equal(data[0].pq,'1.030');
});
check('unclassified questions are separate from On-site and Off-site',()=>{
  controls.visitScopeVerificationFilter.value='other';const data=ctx.filterVisibleVisitScopeCandidates(ctx.buildVisitScopeCandidates(),visit);
  assert.equal(data.length,1);assert.equal(data[0].pq,'1.999');
});
check('legacy type is a fallback when no library record exists',()=>{
  ctx.pqMasterData['1.999'].onOffSite='Off-site';assert.equal(ctx.getCommonVerificationType('1.999'),'offSite');delete ctx.pqMasterData['1.999'].onOffSite;
});
check('a missing master area is recovered from official PQ metadata',()=>{
  delete ctx.pqMasterData['1.030'].alan;const item=ctx.buildVisitScopeCandidates().find(p=>p.pq==='1.030');assert.equal(item.area,'LEG');
});
check('known indexed schema does not recursively rescan unmatched questions',()=>{
  ctx.findIcaoPqRecordInSnapshot=()=>{throw new Error('Unexpected full-tree scan');};
  assert.equal(ctx.getIcaoPqLibraryRecordForReference('1.999','LEG').record,null);
});
check('latest CAP source selection stays intact',()=>{
  ctx.rawData.push({pq:'1.029',area:'LEG',step:'1',action:'Obsolete CAP action',sourceFile:'CAP_20250101.docx'});
  const rows=ctx.buildVisitScopeCandidates().find(p=>p.pq==='1.029').actionItems;assert.equal(rows.length,1);assert.equal(rows[0].action,'Current CAP action');
});
check('new scope snapshots carry the official verification mode',()=>{
  ctx.visitScopeSelectedPqs=new Set(['1.029']);ctx.visitScopeSelectedSteps=new Set();
  const before=JSON.stringify(visit.scope),snapshot=ctx.buildVisitScopeSnapshots();
  assert.equal(snapshot.pqs[0].verificationType,'Off-site');assert.equal(snapshot.pqs[0].question,'Official question');assert.equal(JSON.stringify(visit.scope),before);
});
console.log(`VISIT SCOPE TEST RESULT: ${passed} PASS / 0 FAIL`);
