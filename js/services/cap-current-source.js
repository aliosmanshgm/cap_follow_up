// CAP document dates select CAP working data only. They never identify assessments.
(function(){
  'use strict';
  const AREAS=['LEG','ORG','PEL','OPS','AIR','AIG','ANS','AGA'];
  const text=v=>String(v??'').trim();
  function validDate(year,month,day){
    const d=new Date(Date.UTC(+year,+month-1,+day));
    return d.getUTCFullYear()===+year&&d.getUTCMonth()===+month-1&&d.getUTCDate()===+day?`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`:'';
  }
  function sourceDate(row){
    const explicit=text(row.sourceReportDate||row.sourceDate);
    let m=explicit.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if(m)return validDate(m[1],m[2],m[3]);
    m=text(row.sourceFile).match(/(20\d{2})[._-]?(\d{2})[._-]?(\d{2})/);
    return m?validDate(m[1],m[2],m[3]):'';
  }
  function areaOf(row,master={}){
    const m=master[row.pq]||{},area=text(m.alan||row.area||row.alan).toUpperCase();
    if(AREAS.includes(area))return area;
    return AREAS[Number(text(row.pq).split('.')[0])-1]||'';
  }
  function usable(row){
    return !!row&&!row.isEmptyCap&&text(row.action)!==''&&!/^(?:no cap|cap yok|n\/a|-)$/i.test(text(row.action));
  }
  function completed(row){
    const v=text(row.progress).toLocaleLowerCase('tr-TR');
    if(/not\s+completed|incomplete|tamamlanmad|tamamlanmam/.test(v))return false;
    return /completed|tamamlandı|tamamlandi/.test(v)||/^(?:100\s*%?|%\s*100)$/.test(v);
  }
  function select(rows=[],master={},asOf=''){
    const dates=new Set(),latest={},files={};let undated=0;
    const normalized=rows.filter(r=>r&&r.pq).map((row,index)=>{
      const area=areaOf(row,master),date=sourceDate(row);if(date)dates.add(date);else undated++;
      if(area&&date&&(!asOf||date<=asOf)&&(!latest[area]||date>latest[area]))latest[area]=date;
      return{row,index,area,date};
    });
    const byStep=new Map();
    for(const item of normalized){
      const {row,area,date}=item;
      if(asOf&&(!date||date>asOf))continue;
      if(latest[area]&&date!==latest[area])continue;
      if(!files[area])files[area]=new Set();if(row.sourceFile)files[area].add(row.sourceFile);
      const m=master[row.pq]||{},link=row.pqLink||m.pqLink||{};
      const identity=text(row.pqConceptId||m.pqConceptId||link.pqConceptId||row.pq);
      const step=text(row.step),key=`${area}|${identity}|${step?'step:'+step:'action:'+text(row.action).toLocaleLowerCase('tr-TR')}`;
      byStep.set(key,item);
    }
    return{rows:[...byStep.values()].sort((a,b)=>a.index-b.index).map(x=>x.row),dates:[...dates].sort(),
      sources:AREAS.map(area=>({area,date:latest[area]||'',files:[...(files[area]||[])]})).filter(s=>s.files.length||s.date),undated,asOf};
  }
  let cached=null;
  function current(asOf=''){
    const rows=typeof rawData!=='undefined'?rawData:[],master=typeof pqMasterData!=='undefined'?pqMasterData:{};
    if(!cached||cached.input!==rows||cached.length!==rows.length||cached.master!==master||cached.asOf!==asOf){cached={input:rows,length:rows.length,master,asOf,value:select(rows,master,asOf)};}
    return cached.value;
  }
  window.CapCurrentSource={select,sourceDate,areaOf,usable,completed,current,invalidate(){cached=null;}};
})();
