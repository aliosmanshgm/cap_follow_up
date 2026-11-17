(function(){
  'use strict';
  function code(value){
    const key=String(value??'').trim().toLowerCase().replace(/[\s-]+/g,'_');
    return ({satisfactory:'S',s:'S',not_satisfactory:'NS',notsatisfactory:'NS',ns:'NS',not_applicable:'NA',na:'NA',no_change:'NC',nochange:'NC',nc:'NC'})[key]||null;
  }
  function final(record){return !!code(record?.finalResult);}
  function resolve(record={},previous=null,finalOnly=false){
    const f=code(record.finalResult),d=code(record.draftResult);
    let raw=f,phase=f?'final':'pending';
    if(!raw&&!finalOnly&&d){raw=d;phase='draft';}
    if(!raw&&!finalOnly&&!record.draftResult&&['validated','not_validated','open'].includes(record.status)){
      raw=record.status==='validated'?'S':'NS';phase='working';
    }
    const unchanged=raw==='NC';
    return{raw,code:unchanged?(['S','NS','NA'].includes(previous)?previous:null):raw,phase,unchanged,finalized:!!f};
  }
  function label(value){return ({S:'S',NS:'NS',NA:'N/A',NC:'No Change'})[code(value)]||'Bekliyor';}
  window.IcaoVisitOutcomes={code,final,resolve,label};
})();
