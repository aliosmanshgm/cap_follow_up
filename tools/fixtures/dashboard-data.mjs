export function dashboardFixture(){
  const areas=['LEG','ORG','PEL','OPS','AIR','AIG','ANS','AGA'];
  const rows=[['1.001','LEG','S'],['1.002','LEG','NS'],['1.003','LEG','NS'],['1.004','LEG','NS'],['1.005','LEG','NA'],['2.001','ORG','NS'],['2.002','ORG','S']];
  const pqStates=Object.fromEntries(rows.map(([pq,area,status])=>[pq.replace('.','_'),{pq,area,status,applicable:status!=='NA',conceptId:'C_'+pq.replace('.','_')} ]));
  const counts={areas:{}};
  for(const area of areas){const selected=Object.values(pqStates).filter(p=>p.area===area),s=selected.filter(p=>p.status==='S').length,ns=selected.filter(p=>p.status==='NS').length;counts.areas[area]={satisfactory:s,notSatisfactory:ns,applicable:s+ns,ei:s+ns?100*s/(s+ns):null};}
  counts.overall={satisfactory:2,notSatisfactory:4,applicable:6,ei:100/3};
  const state={id:'cmaa_state',name:'CMAA Full Status',effectiveAsOfDate:'2026-01-01',pqVersion:'2024',sourceType:'olf_full_status',linkedAssessmentEventId:'cmaa',pqStates,counts};
  const master=Object.fromEntries(rows.map(([pq,area])=>[pq,{alan:area,pqConceptId:'C_'+pq.replace('.','_')}]));
  const cap=(pq,step,progress,file)=>({pq,step:String(step),action:'Action '+pq+'/'+step,area:master[pq].alan,progress,office:'Test office',estDate:'01.01.2027',sourceFile:file});
  const capRows=[cap('1.002',1,'In progress','CAP_LEG_20260105.docx'),cap('1.002',2,'In progress','CAP_LEG_20260105.docx'),
    cap('1.003',1,'In progress','CAP_LEG_20260105.docx'),cap('1.003',2,'In progress','CAP_LEG_20260105.docx'),cap('1.003',3,'In progress','CAP_LEG_20260105.docx'),
    cap('2.001',1,'In progress','CAP_ORG_20260115.docx'),cap('2.002',1,'Completed','CAP_ORG_20260115.docx'),
    cap('1.002',1,'Completed','CAP_LEG_20260201.docx'),cap('1.002',2,'Completed','CAP_LEG_20260201.docx'),
    cap('1.003',1,'Completed','CAP_LEG_20260201.docx'),cap('1.003',2,'In progress','CAP_LEG_20260201.docx'),
    cap('1.001',1,'Completed','CAP_LEG_20260201.docx'),cap('1.005',1,'Completed','CAP_LEG_20260201.docx')];
  return{states:[state],events:[{id:'cmaa',type:'CMAA',name:'CMAA başlangıcı',assessmentDate:'2026-01-01',resultStatus:'official',scopeAreas:areas,pqVersion:'2024',stateSnapshotId:state.id,snapshot:{overall:counts.overall,areas:counts.areas}}],
    officialRecords:{},master,capRows,readiness:{},visits:[{id:'icvm',visitName:'ICAO ICVM',visitType:'icao_official',icaoVisitType:'ICVM',actualEnd:'2026-03-01',areas:['ORG'],
      scope:{pqs:[{pq:'2.001',area:'ORG'}]},icaoValidation:{records:{a:{pq:'2.001',draftResult:'not_satisfactory',finalResult:'satisfactory'}}}}]};
}
