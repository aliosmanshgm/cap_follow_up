#!/usr/bin/env node
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';

const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
let pass=0,fail=0;
function assert(name,cond,detail=''){if(cond){pass++;console.log('PASS',name,detail);}else{fail++;console.error('FAIL',name,detail);}}

// PQ linkage pure service
{
  const ctx={window:{},console};vm.createContext(ctx);vm.runInContext(read('js/modules/pq-linkage.js'),ctx,{filename:'pq-linkage.js'});
  const L=ctx.window.PQLinkage;
  assert('Firebase-safe PQ key',L.safeKey('9.001')==='9_001',L.safeKey('9.001'));
  assert('SSP area supported',L.AREAS.includes('SSP'),L.AREAS.join(','));
  assert('SSP instance ID safe',L.instanceId({area:'SSP',year:'2024',revision:'1',pq:'9.001'}).includes('_9_001'),L.instanceId({area:'SSP',year:'2024',revision:'1',pq:'9.001'}));
}

// PQ library change distribution: exact PEL reference case
{
  const localStore=new Map();
  const ctx={window:{},console,document:{addEventListener(){},getElementById(){return null;},querySelectorAll(){return[];}},localStorage:{getItem:k=>localStore.get(k)||null,setItem:(k,v)=>localStore.set(k,String(v)),removeItem:k=>localStore.delete(k)},setTimeout(){},clearTimeout(){}};
  vm.createContext(ctx);vm.runInContext(read('js/modules/pq-library.js'),ctx,{filename:'pq-library.js'});
  const statsFn=ctx.window.getPqDbAmendmentStatsForDiagnostics;
  const pqs={}; const amendments={}; let ai=0;
  const pq=n=>`3.${String(n).padStart(3,'0')}`;
  for(let i=1;i<=100;i++)pqs[`k${i}`]={pq:pq(i)};
  for(let i=1;i<=35;i++)amendments[`a${++ai}`]={oldPq:pq(i),newPq:pq(i),type:'Revised',description:'Updated'};
  for(let i=36;i<=37;i++){
    for(let j=1;j<=3;j++)amendments[`a${++ai}`]={oldPq:`3.${String(700+i*3+j).padStart(3,'0')}`,newPq:pq(i),type:'Merged',description:'Merged'};
  }
  for(let i=38;i<=48;i++)amendments[`a${++ai}`]={oldPq:'',newPq:pq(i),type:'New',description:'New PQ'};
  for(let i=49;i<=100;i++)amendments[`a${++ai}`]={oldPq:pq(i),newPq:pq(i),type:'No change',description:''};
  const stats=statsFn({pqs,amendments});
  assert('PEL raw amendment rows',stats.rawRows===104,String(stats.rawRows));
  assert('PEL revised=35',stats.revisedCount===35,String(stats.revisedCount));
  assert('PEL merged=2',stats.mergedCount===2,String(stats.mergedCount));
  assert('PEL new=11',stats.newCount===11,String(stats.newCount));
  assert('PEL no change=52',stats.noChangeCount===52,String(stats.noChangeCount));
  assert('PEL current changes=48',stats.currentChanges===48,String(stats.currentChanges));
  assert('PEL distribution total=100',stats.revisedCount+stats.mergedCount+stats.newCount+stats.noChangeCount+stats.unknownCount===100,JSON.stringify(stats));
  const orgPqs={};const orgA={};for(let i=1;i<=13;i++){const q=`2.${String(i).padStart(3,'0')}`;orgPqs[`q${i}`]={pq:q};orgA[`a${i}`]={oldPq:q,newPq:q,type:'Revised',description:''};}
  const org=statsFn({pqs:orgPqs,amendments:orgA});
  assert('ORG legacy unchanged revised fallback -> 0 changes',org.currentChanges===0,JSON.stringify(org));
  assert('ORG legacy unchanged -> 13 no change',org.noChangeCount===13,JSON.stringify(org));
}

// Parser validation metrics use current PQ classes, not raw merged row count
{
  const ctx={window:{},console};vm.createContext(ctx);vm.runInContext(read('js/parsers/pq-docx-parser.js'),ctx,{filename:'pq-docx-parser.js'});
  const V=ctx.window.PQDocxParser;
  const pqs=[]; const mk=(i,type)=>({pq:`3.${String(i).padStart(3,'0')}`,question:'Q',guidance:'G',references:'R',ce:'CE-3',sspComponent:'',onSite:true,ppq:false,auditorNote:'',changeType:type});
  for(let i=1;i<=35;i++)pqs.push(mk(i,'Revised'));
  for(let i=36;i<=37;i++)pqs.push(mk(i,'Merged'));
  for(let i=38;i<=48;i++)pqs.push(mk(i,'New'));
  for(let i=49;i<=100;i++)pqs.push(mk(i,'No change'));
  const amendments=Array.from({length:104},(_,i)=>({oldPq:`x${i}`,newPq:`y${i}`,type:i===0?'Deleted':'Revised'}));
  const result=V.validate({meta:{year:'2024',area:'PEL',revision:'1'},pqs,amendments});
  const t=result.metrics.amendmentTypes;
  assert('Parser metric revised=35',t.revisedCount===35,String(t.revisedCount));
  assert('Parser metric merged=2',t.mergedCount===2,String(t.mergedCount));
  assert('Parser metric new=11',t.newCount===11,String(t.newCount));
  assert('Parser metric nochange=52',t.noChangeCount===52,String(t.noChangeCount));
}

console.log(`DOMAIN TEST RESULT: ${pass} PASS / ${fail} FAIL`);
process.exit(fail?1:0);
