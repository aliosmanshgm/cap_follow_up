#!/usr/bin/env node
// No live Firebase access. Run with: node tools/pq-performance-tests.mjs
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {performance} from 'node:perf_hooks';

const root=fileURLToPath(new URL('../',import.meta.url));
const read=name=>fs.readFileSync(root+name,'utf8');
let passed=0;
function check(name,fn){fn();passed++;console.log('PASS',name);}
function realm(extra={}){
  const storage=new Map();
  const ctx={console,setTimeout,clearTimeout,navigator:{onLine:true},
    document:{addEventListener(){},getElementById(){return null;},querySelectorAll(){return[];}},
    localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)},
    ...extra};
  ctx.window=ctx;vm.createContext(ctx);return ctx;
}
const run=(ctx,code)=>vm.runInContext(code,ctx);
function linkage(){const ctx=realm();run(ctx,read('js/modules/pq-linkage.js'));return ctx.PQLinkage;}
const plain=x=>JSON.parse(JSON.stringify(x));
function fixture(){return{editions:{
  old:{year:'2020',revision:'0',areas:{LEG:{pqs:{a:{pq:'1.001'},b:{pq:'1.002'}}}}},
  current:{year:'2024',revision:'1',areas:{LEG:{pqs:{a:{pq:'1.101',previousPq:'1.001',changeType:'Revised'},b:{pq:'1.002'}},amendments:{a:{oldPq:'1.001',newPq:'1.101',type:'Revised'}}}}}
},activeByArea:{LEG:{editionKey:'current'}}};}

{
  const L=linkage(),lib=fixture();const index=L.buildIndex(lib);
  check('repeated lookups reuse one index and preserve lineage objects',()=>{
    const lineage=lib.editions.current.areas.LEG.pqs.a.lineage;
    for(let i=0;i<100;i++)assert.equal(L.resolveCapReference(lib,'1.001','LEG').currentPqRef.pq,'1.101');
    assert.equal(L.buildIndex(lib),index);
    assert.equal(lib.editions.current.areas.LEG.pqs.a.lineage,lineage);
  });
  check('renumbered PQ preserves the historical source',()=>{
    const hit=L.resolveCapReference(lib,'1.001','LEG');
    assert.equal(hit.sourcePqRef.editionKey,'old');assert.equal(hit.currentPqRef.editionKey,'current');assert.equal(hit.renumbered,true);
    assert.equal(hit.pqConceptId,lib.editions.old.areas.LEG.pqs.a.conceptId);
    const repeat=L.resolveCapReference(lib,'1.001','LEG',hit);
    assert.deepEqual(plain(repeat.sourcePqRef),plain(hit.sourcePqRef));assert.equal(repeat.linkedAt,hit.linkedAt);
  });
  check('active pointer changes affect cached reads immediately',()=>{
    lib.activeByArea.LEG={editionKey:'old'};
    assert.equal(L.resolveCapReference(lib,'1.002','LEG').currentPqRef.editionKey,'old');
    lib.activeByArea.LEG={editionKey:'current'};
    assert.equal(L.resolveCapReference(lib,'1.002','LEG').currentPqRef.editionKey,'current');
  });
  check('explicit enrichment invalidates the previous generation',()=>{
    lib.editions.current.areas.LEG.pqs.c={pq:'1.003'};L.enrichLibrary(lib);
    assert.notEqual(L.buildIndex(lib),index);assert.equal(L.resolveCapReference(lib,'1.003','LEG').status,'linked');
  });
  check('explicit invalidation handles an in-place import/delete',()=>{
    delete lib.editions.current.areas.LEG.pqs.c;L.invalidateIndex(lib);
    assert.equal(L.resolveCapReference(lib,'1.003','LEG').status,'unmatched');
  });
  check('replacing editions rebuilds the cached generation',()=>{
    lib.editions={};assert.equal(L.resolveCapReference(lib,'1.001','LEG').status,'unmatched');
  });
  check('separate libraries never share indexes',()=>{
    assert.equal(L.resolveCapReference(fixture(),'1.001','LEG').status,'linked');
    assert.equal(L.resolveCapReference({editions:{}},'1.001','LEG').status,'unmatched');
  });
  check('an empty library is normalized on its first indexed read',()=>{
    const empty={};assert.equal(L.buildIndex(empty).instances.size,0);
    assert.ok(empty.editions);assert.ok(empty.activeByArea);assert.equal(empty.linkageMeta.instanceCount,0);
  });
}
{
  const L=linkage(),lib=fixture();
  lib.editions.current.areas.LEG.pqs={merged:{pq:'1.201',changeType:'Merged'}};
  lib.editions.current.areas.LEG.amendments={a:{oldPq:'1.001',newPq:'1.201',type:'Merged'},b:{oldPq:'1.002',newPq:'1.201',type:'Merged'}};
  check('merged PQ resolves both parent concepts to its successor',()=>{
    for(const pq of ['1.001','1.002']){const hit=L.resolveCapReference(lib,pq,'LEG');assert.equal(hit.currentPqRef.pq,'1.201');assert.equal(hit.relation,'successor');}
    assert.equal(lib.editions.current.areas.LEG.pqs.merged.lineage.parentConceptIds.length,2);
  });
  check('multiple successors remain ambiguous',()=>{
    lib.editions.current.areas.LEG.pqs.other={pq:'1.202',changeType:'Merged',previousPq:'1.001'};
    L.invalidateIndex(lib);
    const hit=L.resolveCapReference(lib,'1.001','LEG');assert.equal(hit.status,'ambiguous');assert.equal(hit.candidateCurrentRefs.length,2);
  });
  check('no active pointer preserves historical resolution',()=>{
    delete lib.activeByArea.LEG;const hit=L.resolveCapReference(lib,'1.002','LEG');
    assert.equal(hit.relation,'historical-only');assert.equal(hit.currentPqRef.editionKey,'old');
  });
}

// Real module load lifecycle, with only UI rendering replaced by counters.
{
  let reads=0,finishRead;const counts={versions:0,catalog:0,compare:0,linkage:0,selectors:0,enrich:0};
  let active=false;
  const ctx=realm({rawData:[],pqMasterData:{},normalizePQ:v=>v,normalizeAreaKey:v=>v,
    saveToLocalStorage(){},PQRepository:{load(){reads++;return new Promise(r=>{finishRead=r;});}},
    document:{addEventListener(){},getElementById(id){return id==='tab-pq-library'?{classList:{contains:()=>active}}:null;},querySelectorAll(){return[];}}});
  run(ctx,read('js/modules/pq-linkage.js'));run(ctx,read('js/modules/pq-library.js'));
  ctx.counts=counts;
  run(ctx,`renderPqDbKpis=()=>{};renderPqDbVersions=()=>counts.versions++;
    renderPqDbCatalog=()=>counts.catalog++;renderPqDbComparison=()=>counts.compare++;
    renderPqDbLinkage=()=>counts.linkage++;populatePqDbSelectors=()=>counts.selectors++;
    window.enrichPqMasterFromPqLibrary=()=>counts.enrich++;`);
  const p1=ctx.loadIcaoPqLibrary(),p2=ctx.loadIcaoPqLibrary();
  check('concurrent ordinary loads share one request',()=>{assert.equal(p1,p2);assert.equal(reads,1);});
  const forced=ctx.loadIcaoPqLibrary(true),forced2=ctx.loadIcaoPqLibrary(true);
  check('concurrent forced refreshes share a single follow-up',()=>assert.equal(forced,forced2));
  finishRead({library:fixture()});await p1;await Promise.resolve();
  check('a forced refresh waits for the older read then reads again',()=>assert.equal(reads,2));
  finishRead({library:fixture()});await forced;
  check('loading while another tab is open does not render hidden PQ views',()=>{
    for(const name of ['versions','catalog','compare','linkage'])assert.equal(counts[name],0);
  });
  active=true;ctx.renderIcaoPqLibraryModule();
  check('opening versions renders only versions',()=>{
    assert.equal(counts.versions,1);assert.equal(counts.catalog+counts.compare+counts.linkage,0);assert.equal(counts.selectors,1);
  });
  run(ctx,"pqDbView='catalog'");ctx.renderIcaoPqLibraryModule();ctx.renderIcaoPqLibraryModule();
  check('catalog filters retain their selectors and skip hidden views',()=>{
    assert.equal(counts.catalog,2);assert.equal(counts.versions,1);assert.equal(counts.selectors,1);
  });
  const before=counts.enrich;await ctx.loadIcaoPqLibrary();
  check('cached loads do not enrich masters or render again',()=>{assert.equal(reads,2);assert.equal(counts.enrich,before);assert.equal(counts.catalog,2);});
  const next=ctx.loadIcaoPqLibrary(true);finishRead({library:fixture()});await next;
  check('refresh invalidates selectors and exposes the replacement library',()=>{assert.equal(counts.selectors,2);assert.equal(counts.catalog,3);});
}

// Repository tests use an in-memory RTDB adapter, including real import verification.
{
  let localReads=0,networkReads=0,rejectRead=false;
  const ctx=realm({localStorage:{getItem(){localReads++;return JSON.stringify(fixture());},setItem(){}},
    db:{ref(){return{once(){networkReads++;return rejectRead?Promise.reject(new Error('offline')):Promise.resolve({exists:()=>true,val:()=>fixture()});}}}}});
  run(ctx,read('js/services/pq-repository.js'));
  await ctx.PQRepository.load();
  check('successful remote loads skip parsing the offline cache',()=>{assert.equal(localReads,0);assert.equal(networkReads,1);});
  rejectRead=true;const fallback=await ctx.PQRepository.load();
  check('failed remote reads retain offline cache fallback',()=>{assert.equal(localReads,1);assert.equal(fallback.source,'local-fallback');assert.ok(fallback.library.editions.old);});
  ctx.navigator.onLine=false;const offline=await ctx.PQRepository.load();
  check('offline load never contacts RTDB',()=>{assert.equal(networkReads,2);assert.equal(offline.source,'local');});
}
{
  const store={icao_pq_library:fixture()},reads=[],writes=[];let detached=0;
  const get=path=>path.split('/').filter(Boolean).reduce((v,k)=>v?.[k],store);
  const snap=path=>({exists:()=>get(path)!=null,val:()=>plain(get(path)??null),child:p=>snap(path+'/'+p)});
  const db={ref(path=''){return{
    once(){reads.push(path);return Promise.resolve(snap(path));},
    on(_,handler){handler({val:()=>true});},off(){detached++;},
    update(updates){writes.push(updates);for(const [path,value] of Object.entries(updates)){const keys=path.split('/');const last=keys.pop();let cur=store;for(const k of keys)cur=cur[k]||(cur[k]={});if(value===null)delete cur[last];else cur[last]=plain(value);}return Promise.resolve();}
  };}};
  const ctx=realm({db,firebase:{auth:()=>({currentUser:{uid:'test'}})}});
  run(ctx,read('js/modules/pq-linkage.js'));run(ctx,read('js/services/pq-repository.js'));
  const parsed={meta:{area:'LEG',year:'2025',revision:'0',active:true},pqs:[{pq:'1.010',question:'Imported question'}],amendments:[]};
  const result=await ctx.PQRepository.saveParsedDocument({editionKey:'2025_R0',file:{name:'test.docx',size:10},parsed});
  check('import checks use one root snapshot plus the verification read',()=>{
    assert.deepEqual(reads,['icao_pq_library','icao_pq_library/editions/2025_R0/areas/LEG']);assert.equal(detached,1);
  });
  check('import writes and verifies the new area and active pointer',()=>{
    assert.equal(result.areaData.pqs['1_010'].question,'Imported question');assert.equal(get('icao_pq_library/activeByArea/LEG').editionKey,'2025_R0');
    assert.equal(get('icao_pq_library/editions/current/areas/LEG/active'),false);assert.equal(writes.length,2);
  });
  check('import preserves unrelated historical records',()=>assert.equal(get('icao_pq_library/editions/old/areas/LEG/pqs/a').pq,'1.001'));
  await assert.rejects(ctx.PQRepository.saveParsedDocument({editionKey:'2025_R0',file:{name:'test.docx'},parsed}),/zaten kayıtlı/);
  check('duplicate import still requires overwrite consent',()=>assert.equal(writes.length,2));
}

// Reproducible workload; timings are informational, identity assertions guard regressions.
{
  const L=linkage(),lib={editions:{},activeByArea:{}},areas=L.AREAS;
  for(const year of ['2020','2024']){
    const edition={year,revision:'0',areas:{}};
    areas.forEach((area,a)=>{const pqs={};for(let i=1;i<=80;i++){const pq=`${a+1}.${String(i).padStart(3,'0')}`;pqs[pq.replace('.','_')]={pq,question:'Question '+pq,guidance:'Guidance',assessmentMode:'On-site',ce:'CE-1'};}edition.areas[area]={area,pqs,amendments:{}};lib.activeByArea[area]={editionKey:year};});
    lib.editions[year]=edition;
  }
  const start=performance.now();let linked=0;
  for(let i=1;i<=100;i++){const a=i%9,pq=`${a+1}.${String(i%80+1).padStart(3,'0')}`;if(L.resolveCapReference(lib,pq,areas[a]).status==='linked')linked++;}
  check('1,440 instances / 100 lookups all resolve',()=>assert.equal(linked,100));
  console.log(JSON.stringify({instances:1440,lookups:100,linked,elapsedMs:+(performance.now()-start).toFixed(1)}));
}
console.log(`PQ PERFORMANCE TEST RESULT: ${passed} PASS / 0 FAIL`);
