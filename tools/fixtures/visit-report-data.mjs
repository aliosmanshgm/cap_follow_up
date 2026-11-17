export function visitReportFixture(){
  const master={},pqStates={},scope=[],records={},areas=['LEG','ORG','OPS','AIR'],sizes=[22,6,27,30],prefix=[1,2,4,5];let n=0;
  for(let a=0;a<areas.length;a++)for(let i=1;i<=sizes[a];i++){
    const pq=prefix[a]+'.'+String(i).padStart(3,'0'),area=areas[a];n++;
    master[pq]={alan:area,pqConceptId:'C_'+pq.replace('.','_'),soru:'Question '+pq,soruTr:'PQ sorusu '+pq,tur:i%2?'On-site':'Off-site',ce:'CE-1'};
    pqStates[pq.replace('.','_')]={pq,area,status:n===1?'S':'NS',applicable:true,conceptId:master[pq].pqConceptId};scope.push({pq,area});
    const objection=[2,3,24,29,30,56,57,58].includes(n),long=n===29;
    const note=long?Array.from({length:20},(_,j)=>`Paragraph ${j+1}. Türkiye denetim kanıtları ve itiraz gerekçeleri. `+'The inspection records and supporting documentation demonstrate the scope of oversight activities. '.repeat(14)).join('\n\n')+'\nEND-LONG-OBJECTION-4.001':objection?'İtiraz açıklaması '+pq+' — END-OBJECTION-'+pq:'';
    records[pq.replace('.','_DOT_')]={pq,area,status:'not_evaluated',draftResult:n===1?'no_change':n<=60?'satisfactory':'not_satisfactory',finalResult:n===1?'no_change':'',objectionStatus:objection?'planned':'none',objectionDate:objection?'2026-11-06':'',objectionNotes:note};
  }
  const counts={areas:{}};for(const area of areas){const p=Object.values(pqStates).filter(p=>p.area===area),s=p.filter(p=>p.status==='S').length;counts.areas[area]={satisfactory:s,notSatisfactory:p.length-s,applicable:p.length,ei:100*s/p.length};}counts.overall={satisfactory:1,notSatisfactory:84,applicable:85,ei:100/85};
  const state={id:'baseline',name:'CMAA Full Status',effectiveAsOfDate:'2026-01-01',pqVersion:'2024',sourceType:'olf_full_status',linkedAssessmentEventId:'cmaa',pqStates,counts};
  const event={id:'cmaa',name:'CMAA',type:'CMAA',assessmentDate:'2026-01-01',resultStatus:'official',scopeAreas:areas,pqVersion:'2024',stateSnapshotId:state.id,snapshot:{overall:counts.overall,areas:counts.areas}};
  const visit={id:'icvm',visitName:'ICVM rapor kontrolü',visitType:'icao_official',icaoVisitType:'ICVM',status:'draft',actualStart:'2026-09-22',actualEnd:'2026-09-25',areas,scope:{pqs:scope},icaoValidation:{records}};
  return{master,states:[state],events:[event],visits:[visit],capRows:[],officialRecords:{},readiness:{}};
}
