import {dashboardFixture} from './dashboard-data.mjs';
export function visitStagesFixture(){
  const x=dashboardFixture(),base=x.states[0];x.visits=[];
  x.events[0].linkedVisitId='cmaa_visit';
  const cmaa={id:'cmaa_visit',visitName:'CMAA',visitType:'icao_official',icaoVisitType:'CMAA',actualEnd:'2026-01-01',areas:['LEG','ORG'],scope:{pqs:Object.values(base.pqStates).map(r=>({pq:r.pq,area:r.area}))},icaoValidation:{records:Object.fromEntries(Object.values(base.pqStates).map(r=>[r.pq.replace('.','_'),{pq:r.pq,finalResult:'no_change'}]))}};
  const after=JSON.parse(JSON.stringify(base));after.id='osva_state';after.name='OSVA Full Status';after.effectiveAsOfDate='2026-02-01';after.linkedAssessmentEventId='osva_final';after.pqStates['2_001'].status='S';after.counts.areas.ORG={satisfactory:2,notSatisfactory:0,applicable:2,ei:100};after.counts.overall={satisfactory:3,notSatisfactory:3,applicable:6,ei:50};x.states.push(after);
  x.events.push({id:'osva_final',name:'OSVA',type:'OSVA',assessmentDate:'2026-02-01',resultStatus:'official',linkedVisitId:'osva',stateSnapshotId:after.id,pqVersion:'2024',scopeAreas:['ORG'],snapshot:{overall:after.counts.overall,areas:after.counts.areas}});
  const osva={id:'osva',visitName:'OSVA',visitType:'icao_official',icaoVisitType:'OSVA',actualEnd:'2026-02-01',areas:['ORG'],scope:{pqs:[{pq:'2.001',area:'ORG'}]},icaoValidation:{records:{a:{pq:'2.001',finalResult:'satisfactory'}}}};
  const icvm={id:'icvm',visitName:'ICVM',visitType:'icao_official',icaoVisitType:'ICVM',status:'draft',actualEnd:'2026-03-01',areas:['LEG'],scope:{pqs:[{pq:'1.001',area:'LEG'},{pq:'1.002',area:'LEG'},{pq:'1.003',area:'LEG'}]},icaoValidation:{records:{a:{pq:'1.001',finalResult:'no_change'},b:{pq:'1.002',draftResult:'satisfactory'},c:{pq:'1.003',draftResult:'not_satisfactory'}}}};
  x.visits.push(cmaa,osva,icvm);return x;
}
