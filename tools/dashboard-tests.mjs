#!/usr/bin/env node
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {dashboardFixture} from './fixtures/dashboard-data.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const ctx={console,document:{addEventListener(){}},setTimeout};ctx.window=ctx;vm.createContext(ctx);
for(const file of ['js/services/cap-current-source.js','js/services/visit-outcomes.js','js/modules/dashboard-overview.js'])vm.runInContext(fs.readFileSync(root+file,'utf8'),ctx,{filename:file});
const build=x=>ctx.DashboardOverview.build(x),clone=x=>JSON.parse(JSON.stringify(x));
const close=(a,b)=>assert.ok(Math.abs(a-b)<0.00001,`${a} != ${b}`);
let passed=0;function check(name,fn){fn();passed++;console.log('PASS',name);}
const base=dashboardFixture(),initial=build(base);
check('Overall EI uses S/applicable rather than mean of area percentages',()=>{close(initial.baseline.metrics.Overall.ei,100/3);assert.notEqual(initial.baseline.metrics.Overall.ei,37.5);});
check('CMAA NS findings are separate from CAP step counts',()=>{assert.equal(initial.baseByArea.Overall.findings,4);assert.equal(initial.baseByArea.Overall.capSteps,5);});
check('CMAA findings and CAP steps are available per audit area',()=>{assert.equal(initial.baseByArea.LEG.findings,3);assert.equal(initial.baseByArea.LEG.capSteps,4);assert.equal(initial.baseByArea.ORG.capSteps,1);});
check('newest CAP date is selected independently for each area',()=>{assert.equal(initial.cap.sources.find(x=>x.area==='LEG').date,'2026-02-01');assert.equal(initial.cap.sources.find(x=>x.area==='ORG').date,'2026-01-15');});
check('removed steps and earlier copies are not counted again',()=>{assert.equal(initial.cap.rows.filter(r=>r.pq==='1.003').length,2);assert.equal(initial.cap.rows.filter(r=>r.pq==='1.002').length,2);});
check('candidate projection requires all current CAP steps completed',()=>{assert.equal(initial.referenceProjection.Overall.candidateCount,1);close(initial.referenceProjection.Overall.candidateEI,50);});
check('theoretical projection counts unique NS PQs with CAP, including candidates',()=>{assert.equal(initial.referenceProjection.Overall.theoreticalCount,3);close(initial.referenceProjection.Overall.theoreticalEI,500/6);});
check('S and N/A PQs produce no new EI gain',()=>assert.equal(initial.referenceProjection.Overall.theoreticalCount,3));
check('CAP-less NS findings remain outside the theoretical bound',()=>assert.equal(initial.baseByArea.LEG.findings,3)&&assert.equal(initial.referenceProjection.LEG.theoreticalCount,2));
check('held candidates are excluded from candidate projection but stay in theoretical bound',()=>{const x=clone(base);x.readiness.C_LEG={};x.readiness.C_1_002={planningStatus:'hold'};const m=build(x);assert.equal(m.referenceProjection.Overall.candidateCount,0);assert.equal(m.referenceProjection.Overall.theoreticalCount,3);});
check('CAP date comparison leaves CMAA EI and findings unchanged',()=>{const x=clone(base);x.capAsOf='2026-01-20';const m=build(x);close(m.baseline.metrics.Overall.ei,100/3);assert.equal(m.baseByArea.Overall.findings,4);assert.equal(m.baseByArea.Overall.capSteps,6);assert.equal(m.referenceProjection.Overall.candidateCount,0);});
check('final PQ results supersede the draft row of the same visit',()=>assert.deepEqual(initial.visits.map(v=>v.phase).join(','),'final'));
check('visit excludes unrelated areas without changing their EI',()=>{for(const row of initial.visits){assert.equal(row.cells.LEG.inScope,false);close(row.cells.LEG.ei,25);assert.equal(row.cells.LEG.delta,null);}});
check('draft-only visit outcome never alters current official EI',()=>{const x=clone(base);delete x.visits[0].icaoValidation.records.a.finalResult;const m=build(x);close(m.current.metrics.Overall.ei,100/3);close(m.visits.find(v=>v.phase==='draft').cells.Overall.ei,100/3);});
check('final PQ outcome shows working impact without pretending to be a published EI',()=>{const row=initial.visits.find(v=>v.phase==='final');close(row.cells.Overall.ei,50);assert.equal(row.official,false);close(initial.current.metrics.Overall.ei,100/3);});
check('a visit with an already satisfactory PQ gains no extra EI',()=>{const x=clone(base);x.visits[0].scope.pqs=[{pq:'2.002',area:'ORG'}];x.visits[0].icaoValidation.records.a.pq='2.002';const row=build(x).visits.find(v=>v.phase==='final');close(row.cells.Overall.ei,100/3);});
check('explicitly bound final Full Status updates official EI but never the CMAA baseline',()=>{
  const x=clone(base),post=clone(x.states[0]);post.id='after_icvm';post.effectiveAsOfDate='2026-03-02';post.linkedAssessmentEventId='icvm_final';post.pqStates['2_001'].status='S';post.counts.ORG={};
  post.counts.areas.ORG={satisfactory:2,notSatisfactory:0,applicable:2,ei:100};post.counts.overall={satisfactory:3,notSatisfactory:3,applicable:6,ei:50};x.states.push(post);
  x.events.push({id:'icvm_final',type:'ICVM',assessmentDate:'2026-03-02',linkedVisitId:'icvm',resultStatus:'official',scopeAreas:['ORG'],stateSnapshotId:post.id,pqVersion:'2024',snapshot:{overall:post.counts.overall,areas:post.counts.areas}});
  const m=build(x);close(m.current.metrics.Overall.ei,50);close(m.baseline.metrics.Overall.ei,100/3);assert.equal(m.visits.length,1);assert.equal(m.referenceProjection.Overall.theoreticalCount,2);
});
check('a Full Status explicitly linked to a draft event cannot become current official EI',()=>{const x=clone(base),s=clone(x.states[0]);s.id='draft_state';s.linkedAssessmentEventId='draft';s.effectiveAsOfDate='2026-04-01';s.counts.overall.ei=99;x.states.push(s);x.events.push({id:'draft',type:'ICVM',assessmentDate:'2026-04-01',resultStatus:'draft',stateSnapshotId:s.id,scopeAreas:['ORG']});close(build(x).current.metrics.Overall.ei,100/3);});
check('a draft-only state reference cannot become official before reverse-link reconciliation',()=>{const x=clone(base),s=clone(x.states[0]);s.id='draft_ref';s.linkedAssessmentEventId='';s.effectiveAsOfDate='2026-04-01';s.counts.overall.ei=99;x.states.push(s);x.events.push({id:'draft',type:'ICVM',assessmentDate:'2026-04-01',resultStatus:'draft',stateSnapshotId:s.id,scopeAreas:['ORG']});close(build(x).current.metrics.Overall.ei,100/3);});
check('a later selected CMAA cannot supply a future baseline to an earlier visit',()=>{const x=clone(base);x.states[0].effectiveAsOfDate='2027-01-01';x.events[0].assessmentDate='2027-01-01';const m=build(x);assert.equal(m.visits.find(v=>v.phase==='final').cells.Overall.ei,null);});
check('percentage-only CMAA records never fabricate findings, denominators or CAP links',()=>{const x=clone(base);x.states=[];x.events[0].snapshot={overall:{ei:50.69},areas:{LEG:{ei:86.36}}};const m=build(x);assert.equal(m.baseByArea.Overall.findings,null);assert.equal(m.baseByArea.Overall.capSteps,null);assert.equal(m.referenceProjection.Overall.candidateEI,null);close(m.baseline.metrics.Overall.ei,50.69);});
check('a generic unlinked state snapshot is not silently assigned to CMAA',()=>{const x=clone(base);x.states[0].linkedAssessmentEventId='';x.events[0].stateSnapshotId='';x.events[0].snapshot={overall:{ei:40}};const m=build(x);assert.equal(m.baseline.data.pqStates,undefined);assert.equal(m.baseByArea.Overall.capSteps,null);});
check('zero percent with a positive denominator remains a real zero',()=>{const x=ctx.DashboardOverview.metrics({overall:{satisfactory:0,applicable:10,ei:0}});assert.equal(x.Overall.ei,0);});
check('zero applicability never displays a fabricated 0% EI',()=>assert.equal(ctx.DashboardOverview.metrics({overall:{satisfactory:0,applicable:0,ei:0}}).Overall.ei,null));
check('published/count inconsistency disables numerical projection',()=>{const x=clone(base);x.events[0].snapshot.overall.ei=90;assert.equal(build(x).referenceProjection.Overall.candidateEI,null);});
check('inactive and deleted assessment/state records are excluded',()=>{const x=clone(base);x.events.push({...clone(x.events[0]),id:'deleted',isDeleted:true,assessmentDate:'2030-01-01'});x.states.push({...clone(x.states[0]),id:'inactive',active:false,effectiveAsOfDate:'2031-01-01'});assert.equal(build(x).cmaaEvents.length,1);close(build(x).current.metrics.Overall.ei,100/3);});
check('CAP filenames resembling CMAA or ICVM do not create assessments or visits',()=>{const x=clone(base);x.capRows.push({...x.capRows.at(-1),sourceFile:'CMAA_ICVM_20300101_LEG.docx',progress:'Completed'});const m=build(x);assert.equal(m.cmaaEvents.length,1);assert.equal(m.visits.length,1);close(m.current.metrics.Overall.ei,100/3);});
check('invalid CAP dates cannot replace a dated area source',()=>{const x=clone(base);x.capRows.push({...x.capRows[0],sourceFile:'LEG_20260231.docx'});assert.equal(build(x).cap.sources.find(s=>s.area==='LEG').date,'2026-02-01');});
check('distinct concepts that reuse a PQ number are not matched by number alone',()=>{const index=ctx.DashboardOverview.indexStates(base.states[0]);assert.equal(ctx.DashboardOverview.findState(index,{pq:'1.002',area:'LEG',conceptId:'unrelated'},{}),null);});
check('renumbered CAP rows can match official PQs through their persistent concept',()=>{const x=clone(base);for(const row of x.capRows.filter(r=>r.pq==='1.002')){row.pq='1.102';row.pqConceptId='C_1_002';}x.master['1.102']={alan:'LEG',pqConceptId:'C_1_002'};assert.equal(build(x).referenceProjection.Overall.candidateCount,1);});
check('duplicate visit scope PQs do not double count S outcomes or EI gains',()=>{const x=clone(base);x.visits[0].scope.pqs.push(clone(x.visits[0].scope.pqs[0]));const row=build(x).visits.find(v=>v.phase==='final');assert.equal(row.counts.total,1);assert.equal(row.counts.satisfactory,1);close(row.cells.Overall.ei,50);});
check('PQ results outside the visit area cannot alter the visit Overall',()=>{const x=clone(base);x.visits[0].scope.pqs.push({pq:'1.002',area:'LEG'});x.visits[0].icaoValidation.records.b={pq:'1.002',finalResult:'satisfactory'};close(build(x).visits.find(v=>v.phase==='final').cells.Overall.ei,50);});
check('model computation is read-only and leaves official and CAP inputs intact',()=>{const x=clone(base),before=JSON.stringify(x);build(x);assert.equal(JSON.stringify(x),before);});
check('missing sources render a usable model with unknown values',()=>{const m=build({});assert.equal(m.baseline.event,null);assert.equal(m.current.metrics.Overall.ei,null);assert.equal(m.referenceProjection.Overall.candidateEI,null);});
check('export rows use the same official and projected values as the dashboard',()=>{const rows=ctx.DashboardOverview.exportRows(initial);close(rows.areas[0]['Güncel Resmî EI (%)'],100/3);assert.equal(rows.areas[0]['CMAA Bulgu (NS PQ)'],4);assert.equal(rows.visits.filter(r=>r['Alan Durumu']==='Valide edilmedi').length,7);});
// Load the real CAP insertion functions without starting authentication or UI.
const app=fs.readFileSync(root+'js/app.js','utf8').replace(/\r\n/g,'\n');
for(const name of ['makeActionKey','makeCapSourceActionKey','makeCapDuplicateIndexes','mergeEvidenceReferenceText','pushParsedCapSection']){
  const start=app.indexOf('    function '+name+'('),end=app.indexOf('\n    }',start)+6;assert.ok(start>=0);vm.runInContext(app.slice(start,end),ctx);
}
ctx.rawData=[];ctx.pqMasterData={};ctx.mergeCapProtocolIntoMaster=()=>{};
const section=progress=>({pq:'1.002',hasProtocolMarker:true,tempSteps:[{step:'1',action:'Same CAP action',progress,office:'Test',estDate:'2027-01-01',evidenceReference:''}]});
check('real CAP insertion retains dated versions of an unchanged action text',()=>{ctx.pushParsedCapSection(section('In progress'),'LEG_20260101.docx');ctx.pushParsedCapSection(section('Completed'),'LEG_20260201.docx');assert.equal(ctx.rawData.length,2);assert.equal(ctx.rawData[0].progress,'In progress');assert.equal(ctx.rawData[1].progress,'Completed');});
check('duplicates inside the same document are still suppressed',()=>{ctx.pushParsedCapSection(section('Completed'),'LEG_20260201.docx');assert.equal(ctx.rawData.length,2);});
check('an empty CAP in a newer source is retained instead of resurrecting older steps',()=>{ctx.pushParsedCapSection({pq:'1.002',hasProtocolMarker:true,tempSteps:[]},'LEG_20260301.docx');const current=ctx.CapCurrentSource.select(ctx.rawData,{});assert.equal(current.rows.length,1);assert.equal(current.rows[0].isEmptyCap,true);assert.equal(current.rows.filter(ctx.CapCurrentSource.usable).length,0);});
check('new evidence is merged only into its own source document',()=>{ctx.rawData[0].evidenceReference='Historical evidence';const next=section('Completed');next.tempSteps[0].evidenceReference='New evidence';ctx.pushParsedCapSection(next,'LEG_20260201.docx');assert.equal(ctx.rawData[0].evidenceReference,'Historical evidence');assert.equal(ctx.rawData[1].evidenceReference,'New evidence');});
console.log(`DASHBOARD TEST RESULT: ${passed} PASS / 0 FAIL`);
