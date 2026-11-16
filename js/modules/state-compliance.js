(function(){
  'use strict';
  const PATH='icao_state_snapshots';
  const AREAS=['LEG','ORG','PEL','OPS','AIR','AIG','ANS','AGA'];
  const AREA_BY_PREFIX={'1':'LEG','2':'ORG','3':'PEL','4':'OPS','5':'AIR','6':'AIG','7':'ANS','8':'AGA'};
  const VERSION='state-compliance-v1.0-rc1.4.19';
  let savingSnapshot=false,appliedSourceSignature=null;
  const deleting=new Set();
  let ref=null, cb=null, preview=null;
  window.icaoStateSnapshots=window.icaoStateSnapshots||{};
  window.icaoStateComplianceLoaded=window.icaoStateComplianceLoaded===true;

  function actor(){try{const u=firebase.auth().currentUser;return u?{uid:u.uid||'',email:u.email||'',displayName:u.displayName||u.email||'Yetkili kullanıcı'}:{uid:'',email:'',displayName:'Oturum yok'};}catch(_){return{uid:'',email:'',displayName:'Oturum yok'};}}
  function esc(v){if(typeof escapeHtml==='function')return escapeHtml(String(v??''));return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
  function clean(v){if(v===undefined)return undefined;if(v===null)return null;if(typeof v==='number'&&!Number.isFinite(v))return null;if(Array.isArray(v))return v.map(clean).filter(x=>x!==undefined);if(v&&typeof v==='object'){const o={};Object.entries(v).forEach(([k,x])=>{const c=clean(x);if(c!==undefined)o[k]=c;});return o;}return v;}
  function norm(v){return String(v??'').trim().toLocaleUpperCase('tr-TR').replace(/[İIı]/g,'I').replace(/[Şş]/g,'S').replace(/[Ğğ]/g,'G').replace(/[Üü]/g,'U').replace(/[Öö]/g,'O').replace(/[Çç]/g,'C').replace(/[_\-\/]+/g,' ').replace(/\s+/g,' ');}
  function num(v){if(v===null||v===undefined||String(v).trim()==='')return null;const n=Number(String(v).replace(/\s/g,'').replace(',','.').replace('%',''));return Number.isFinite(n)?n:null;}
  function int(v){const n=num(v);return Number.isFinite(n)?Math.round(n):null;}
  function pct(s,a){return Number(a)>0?Math.round((Number(s||0)/Number(a))*10000)/100:null;}
  function pqNumber(v){const s=String(v??'').trim();const m=s.match(/(?:PQ\s*)?(\d)\s*[.\-]\s*(\d{3})/i);return m?`${m[1]}.${m[2]}`:'';}
  function safeKey(v){return String(v||'').replace(/[.#$\[\]\/]/g,'_').replace(/\s+/g,'_');}
  function areaFromValue(v,pq){const n=norm(v);const d=AREAS.find(a=>n===a||n.startsWith(a+' ')||n.endsWith(' '+a));if(d)return d;const p=pqNumber(pq);return p&&AREA_BY_PREFIX[p[0]]||'';}
  function findKey(row,cands){const map=new Map(Object.keys(row||{}).map(k=>[norm(k),k]));for(const c of cands){if(map.has(norm(c)))return map.get(norm(c));}for(const [nk,k] of map){if(cands.some(c=>nk.includes(norm(c))))return k;}return'';}
  function get(row,cands){const k=findKey(row,cands);return k?row[k]:'';}
  function statusClass(v){const n=norm(v).replace(/\s/g,'');if(!n)return'UNKNOWN';if(['S','SAT','SATISFACTORY','YES','EVET','COMPLIANT'].includes(n)||n==='SATISFACTOR')return'S';if(['NS','N/S','NOTSATISFACTORY','UNSATISFACTORY','NONSATISFACTORY','NO','HAYIR','NONCOMPLIANT'].includes(n)||n.includes('NOTSATIS')||n.includes('UNSATIS')||n.includes('NONSATIS'))return'NS';if(['NA','N/A','NOTAPPLICABLE','NOTAPPL','APPLICABLEDEGIL','UYGULANABILIRDEGIL'].includes(n)||n.includes('NOTAPPLIC'))return'NA';if(n.includes('SATISFACTORY'))return'S';return'UNKNOWN';}
  function yesNo(v){const n=norm(v).replace(/\s/g,'');if(['Y','YES','EVET','TRUE','1','APPLICABLE','UYGULANABILIR'].includes(n))return true;if(['N','NO','HAYIR','FALSE','0','NOTAPPLICABLE','N/A','NA','UYGULANABILIRDEGIL'].includes(n))return false;return null;}
  function blankCounts(){return Object.fromEntries(AREAS.map(a=>[a,{satisfactory:0,notSatisfactory:0,notApplicable:0,unknown:0,applicable:0,total:0}]));}
  function summarize(states){const areas=blankCounts();Object.values(states||{}).forEach(s=>{const a=s.area;if(!areas[a])return;areas[a].total++;if(s.status==='NA'||s.applicable===false){areas[a].notApplicable++;return;}if(s.status==='S'){areas[a].satisfactory++;areas[a].applicable++;return;}if(s.status==='NS'){areas[a].notSatisfactory++;areas[a].applicable++;return;}areas[a].unknown++;if(s.applicable===true)areas[a].applicable++;});const overall={satisfactory:0,notSatisfactory:0,notApplicable:0,unknown:0,applicable:0,total:0,ei:null};const areaEi={};AREAS.forEach(a=>{const c=areas[a];c.ei=pct(c.satisfactory,c.applicable);areaEi[a]=c.ei;['satisfactory','notSatisfactory','notApplicable','unknown','applicable','total'].forEach(k=>overall[k]+=c[k]||0);});overall.ei=pct(overall.satisfactory,overall.applicable);return{areas,areaEi,overall};}
  function rowSheets(wb){return wb.SheetNames.map(name=>({name,rows:XLSX.utils.sheet_to_json(wb.Sheets[name],{defval:'',raw:true})})).filter(x=>x.rows.length);}
  function detectSheet(wb,fileName){let best=null;for(const s of rowSheets(wb)){const row=s.rows[0]||{},heads=Object.keys(row).map(norm),blob=norm([s.name,fileName,...heads].join(' '));const hasPq=heads.some(h=>/(^| )PQ($| )|PROTOCOL QUESTION|PROTOCOL Q/.test(h));const hasStatus=heads.some(h=>/STATUS|SATISFACTORY|RESULT|SONUC/.test(h));const hasArea=heads.some(h=>/AREA|DENETIM ALANI|AUDIT AREA/.test(h));const findings=/FINDING|BULGU|STATE LIVE PQ FINDING/.test(blob);let kind='unknown',score=0;if(hasPq&&hasStatus){kind='full_status';score=100+(hasArea?5:0);}else if(hasPq&&findings){kind='findings_only';score=65;}else if(hasPq){kind='unknown';score=20;}if(!best||score>best.score)best={...s,kind,score,headers:heads};}return best;}
  function resolvePqLink(area,pq){try{if(typeof window.findPqLibraryReference==='function'){const r=window.findPqLibraryReference(pq,area);if(r&&r.pq)return{conceptId:r.pq.conceptId||'',instanceId:r.pq.instanceId||'',activePq:r.pq.pq||pq};}if(window.PQLinkage&&typeof window.PQLinkage.resolveCapReference==='function'&&typeof icaoPqLibrary!=='undefined'){const link=window.PQLinkage.resolveCapReference(icaoPqLibrary,pq,area,null);return{conceptId:link&&link.pqConceptId||'',instanceId:link&&link.currentPqRef&&link.currentPqRef.instanceId||'',activePq:link&&link.currentPqRef&&link.currentPqRef.pq||pq};}}catch(_){ }return{conceptId:'',instanceId:'',activePq:pq};}
  function parseFullStatusSheet(sheet){const states={},warnings=[];let duplicate=0,skipped=0,unknown=0;for(const row of sheet.rows){const rawPq=get(row,['PQ','PQ No','PQ Number','Protocol Question Number','Protocol Question','Protocol']);const pq=pqNumber(rawPq);const area=areaFromValue(get(row,['Area','Audit Area','Denetim Alanı','USOAP Area']),pq);if(!pq||!area){skipped++;continue;}const statusRaw=get(row,['Status','PQ Status','Satisfactory Status','Compliance Status','Result','Sonuç','Sonuc']);let status=statusClass(statusRaw);const app=yesNo(get(row,['Applicable','Applicability','Uygulanabilir','Uygulanabilirlik']));if(app===false)status='NA';if(status==='UNKNOWN')unknown++;const link=resolvePqLink(area,pq);const id=safeKey(link.instanceId||`${area}_${pq}`);if(states[id])duplicate++;states[id]=clean({pq,area,status,applicable:status==='NA'?false:(app===null?(status==='S'||status==='NS'?true:null):app),conceptId:link.conceptId||'',instanceId:link.instanceId||'',activePq:link.activePq||pq,sourceStatus:String(statusRaw??''),sourceApplicable:get(row,['Applicable','Applicability','Uygulanabilir','Uygulanabilirlik'])});}
    const counts=summarize(states);if(skipped)warnings.push(`${skipped} satır PQ/alan tanınamadığı için atlandı.`);if(duplicate)warnings.push(`${duplicate} yinelenen PQ/instance satırında son kayıt esas alındı.`);if(unknown)warnings.push(`${unknown} PQ statüsü tanınamadı; EI numerator/denominator hesabına güvenilir statü olarak eklenmedi.`);return{states,counts,warnings,parsed:Object.keys(states).length};}
  function inferDate(name){const s=String(name||'');let m=s.match(/(20\d{2})[._-]?(\d{2})[._-]?(\d{2})/);if(m)return `${m[1]}-${m[2]}-${m[3]}`;m=s.match(/(\d{2})[._-](\d{2})[._-](20\d{2})/);if(m)return `${m[3]}-${m[2]}-${m[1]}`;return '';}
  function effectiveDate(x){return String(x&&x.effectiveAsOfDate||x&&x.snapshotDate||'');}
  function list(){return Object.entries(window.icaoStateSnapshots||{}).map(([id,x])=>({...(x||{}),id})).filter(x=>!x.isDeleted).sort((a,b)=>effectiveDate(a).localeCompare(effectiveDate(b))||String(a.createdAt||'').localeCompare(String(b.createdAt||'')));}
  function officialState(x){const event=x.linkedAssessmentEventId?assessmentById(x.linkedAssessmentEventId):null;return x.active!==false&&x.sourceType==='olf_full_status'&&!['draft','provisional'].includes(x.resultStatus)&&!['draft','provisional'].includes(event?.resultStatus);}
  function latest(){const rows=list().filter(officialState);return rows.length?rows[rows.length-1]:null;}
  function stateIdentity(row){
    if(!row)return'';
    const concept=String(row.conceptId||'').trim();if(concept)return`concept:${concept}`;
    const instance=String(row.instanceId||'').trim();if(instance)return`instance:${instance}`;
    const area=String(row.area||'').trim().toUpperCase(),pq=pqNumber(row.activePq||row.pq||'');
    return area&&pq?`pq:${area}:${pq}`:'';
  }
  function stateMap(snapshot){const map=new Map();Object.values((snapshot&&snapshot.pqStates)||{}).forEach(row=>{const id=stateIdentity(row);if(id)map.set(id,row);});return map;}
  function transitionCode(from,to){return`${from||'NONE'}_to_${to||'NONE'}`;}
  function compareSnapshots(previous,current){
    if(!previous||!current)return{previousId:previous&&previous.id||'',currentId:current&&current.id||'',rows:[],summary:{totalChanged:0,nsToS:0,sToNs:0,naToS:0,sToNa:0,newPq:0,removedPq:0,other:0}};
    const a=stateMap(previous),b=stateMap(current),ids=new Set([...a.keys(),...b.keys()]),rows=[],summary={totalChanged:0,nsToS:0,sToNs:0,naToS:0,sToNa:0,newPq:0,removedPq:0,other:0};
    ids.forEach(id=>{const before=a.get(id)||null,after=b.get(id)||null,from=before?before.status:'NONE',to=after?after.status:'NONE';if(from===to)return;const code=transitionCode(from,to);const row={identity:id,code,from,to,pq:(after&&after.pq)||(before&&before.pq)||'',activePq:(after&&after.activePq)||(before&&before.activePq)||'',area:(after&&after.area)||(before&&before.area)||'',conceptId:(after&&after.conceptId)||(before&&before.conceptId)||'',instanceId:(after&&after.instanceId)||(before&&before.instanceId)||''};rows.push(row);summary.totalChanged++;if(code==='NS_to_S')summary.nsToS++;else if(code==='S_to_NS')summary.sToNs++;else if(code==='NA_to_S')summary.naToS++;else if(code==='S_to_NA')summary.sToNa++;else if(from==='NONE')summary.newPq++;else if(to==='NONE')summary.removedPq++;else summary.other++;});
    rows.sort((x,y)=>AREAS.indexOf(x.area)-AREAS.indexOf(y.area)||String(x.activePq||x.pq).localeCompare(String(y.activePq||y.pq),undefined,{numeric:true}));
    return{previousId:previous.id||'',currentId:current.id||'',previousDate:effectiveDate(previous),currentDate:effectiveDate(current),rows,summary};
  }
  function findState(snapshot,pq,area,master){
    if(!snapshot)return null;const states=Object.values(snapshot.pqStates||{}),m=master||((typeof pqMasterData!=='undefined'&&pqMasterData)||{})[pq]||{};
    const concept=String(m.pqConceptId||(m.pqLink&&m.pqLink.pqConceptId)||'').trim();if(concept){const hit=states.find(x=>String(x.conceptId||'')===concept);if(hit)return hit;}
    const refs=[pq,m.currentPqRef&&m.currentPqRef.pq,m.sourcePqRef&&m.sourcePqRef.pq,m.pqLink&&m.pqLink.currentPqRef&&m.pqLink.currentPqRef.pq,m.pqLink&&m.pqLink.sourcePqRef&&m.pqLink.sourcePqRef.pq].map(pqNumber).filter(Boolean);const areaKey=String(area||m.alan||'').trim().toUpperCase();
    return states.find(x=>refs.includes(pqNumber(x.activePq||x.pq))&&(!areaKey||String(x.area||'').toUpperCase()===areaKey))||null;
  }
  window.compareStateComplianceSnapshots=compareSnapshots;
  window.getCurrentPqState=function(pq,area,master){return findState(latest(),pq,area,master);};
  window.isPqOfficiallySatisfactory=function(pq,area,master){const s=findState(latest(),pq,area,master);return !!(s&&s.status==='S'&&s.applicable!==false);};
  window.isPqOfficiallyNotSatisfactory=function(pq,area,master){const s=findState(latest(),pq,area,master);return !!(s&&s.status==='NS'&&s.applicable!==false);};
  window.getLatestStateTransition=function(){const rows=list().filter(officialState);if(rows.length<2)return null;return compareSnapshots(rows[rows.length-2],rows[rows.length-1]);};
  window.getStateComplianceSnapshots=list;
  window.getLatestStateComplianceSnapshot=latest;
  window.getStateComplianceSnapshotById=id=>{const x=id&&window.icaoStateSnapshots?.[id];return x&&!x.isDeleted&&x.active!==false?x:null;};
  window.parseFullStatusWorkbook=function(wb,fileName=''){const sheet=detectSheet(wb,fileName);if(!sheet||sheet.kind!=='full_status')return{ok:false,kind:sheet&&sheet.kind||'unknown',sheet:sheet&&sheet.name||'',message:sheet&&sheet.kind==='findings_only'?'Bu dosya yalnız bulgu listesidir; State Snapshot için tüm PQ statülerini içeren export gereklidir.':'Tam PQ statü sütunları algılanamadı.'};const parsed=parseFullStatusSheet(sheet);return{ok:true,kind:'full_status',sheet:sheet.name,...parsed};};

  function officialVisitRows(){
    const src=(typeof icaoVisits!=='undefined'&&icaoVisits)||window.icaoVisits||{};
    return Object.entries(src).map(([id,v])=>({...v,id})).filter(v=>v&&!v.isDeleted&&v.active!==false&&v.status!=='cancelled'&&String(v.visitType||v.type||'').toLowerCase()==='icao_official');
  }
  function assessmentRows(){
    const rows=[];
    try{for(const event of window.getAssessmentTimeline?.({includePassive:false})||[]){if(event&&!event.isDeleted&&event.active!==false)rows.push({...event,selectionKind:'assessment'});}}catch(_){}
    for(const [id,r] of Object.entries(window.icaoOfficialEiRecords||{})){
      if(!r||r.isDeleted||r.active===false){for(let i=rows.length-1;i>=0;i--)if(rows[i].sourceRecordId===id||rows[i].linkedOfficialEiRecordId===id)rows.splice(i,1);continue;}
      const existing=rows.find(e=>e.sourceRecordId===id||e.linkedOfficialEiRecordId===id||e.id===r.assessmentEventId||e.id===`official_${id}`);
      const eventId=existing?.id||r.assessmentEventId||window.getAssessmentEventIdsForOfficialEi?.(id)?.eventId||`official_${id}`;
      const row={...existing,...r,id:eventId,linkedVisitId:r.linkedVisitId||existing?.linkedVisitId||'',officialRecordId:id,selectionKind:'assessment'};
      if(existing)rows[rows.indexOf(existing)]=row;else rows.push(row);
    }
    for(const visit of officialVisitRows()){
      if(rows.some(e=>e.linkedVisitId===visit.id))continue;
      rows.push({id:`visit:${visit.id}`,selectionKind:'visit',linkedVisitId:visit.id,name:visit.visitName||visit.icaoVisitType||'ICAO ziyareti',type:visit.icaoVisitType||'OTHER',assessmentDate:visit.actualEnd||visit.actualStart||visit.plannedEnd||visit.plannedStart||''});
    }
    return rows.sort((a,b)=>String(a.assessmentDate||'').localeCompare(String(b.assessmentDate||''))||String(a.name||'').localeCompare(String(b.name||''),'tr'));
  }
  window.getStateSnapshotAssessmentOptions=assessmentRows;
  function assessmentLabel(event){if(!event)return'';const status=String(event.resultStatus||'official');const stat=event.selectionKind==='visit'?'Ziyaret · EI değerlendirmesi henüz yok':status==='draft'?'Taslak':status==='provisional'?'Geçici':'Nihai / Resmî';const date=event.assessmentDate||event.endDate||event.startDate||'';return `${event.name||event.type||'ICAO değerlendirmesi'} · ${event.type||'ICAO'} · ${date||'tarih yok'} · ${stat}`;}
  function assessmentById(id){return assessmentRows().find(x=>String(x.id)===String(id))||null;}
  function populateAssessmentSelect(selected=''){
    const sel=document.getElementById('stateSnapshotAssessmentEvent');if(!sel)return;
    const rows=assessmentRows();
    const group=(kind,label)=>{const items=rows.filter(x=>x.selectionKind===kind);return items.length?`<optgroup label="${label}">${items.map(x=>`<option value="${esc(x.id)}">${esc(assessmentLabel(x))}</option>`).join('')}</optgroup>`:'';};
    sel.innerHTML='<option value="">Bağımsız / mevcut genel durum</option>'+group('assessment','Kayıtlı EI değerlendirmeleri')+group('visit','ICAO ziyaretleri');
    if(selected&&!rows.some(x=>x.id===selected))sel.innerHTML+=`<option value="${esc(selected)}">Bağlı kayıt yükleniyor / erişilemiyor</option>`;
    sel.value=selected;
    const field=document.getElementById('stateSnapshotAssessmentStatusField');if(field)field.hidden=assessmentById(selected)?.selectionKind!=='visit';
  }
  window.onStateSnapshotAssessmentChange=function(){const status=document.getElementById('stateSnapshotAssessmentStatus');if(status)status.value='';populateAssessmentSelect(document.getElementById('stateSnapshotAssessmentEvent')?.value||'');};
  window.refreshStateSnapshotAssessmentOptions=function(){applyLatest(true);renderList();};
  window.selectStateSnapshotAssessment=function(id){const sel=document.getElementById('stateSnapshotAssessmentEvent');if(!sel)return;populateAssessmentSelect(id);window.onStateSnapshotAssessmentChange();sel.focus();};
  function applyLatest(onlyChanged=false){const s=latest(),signature=JSON.stringify([s?.id||'',s?.updatedAt||'',s?.counts||null]);if((!onlyChanged||signature!==appliedSourceSignature)&&typeof window.setBaseEiDataFromStateSnapshot==='function')window.setBaseEiDataFromStateSnapshot(s);appliedSourceSignature=signature;renderStatus();}
  function renderStatus(){const s=latest(),tr=window.getLatestStateTransition();const trText=tr&&tr.summary&&tr.summary.totalChanged?` · Son fark: <b>${tr.summary.nsToS} NS→S</b>, ${tr.summary.sToNs} S→NS, ${tr.summary.totalChanged} statü değişimi`:'';const link=s&&s.linkedAssessmentEventId?assessmentById(s.linkedAssessmentEventId):null;const linkText=link?` · Bağlı: <b>${esc(link.name||link.type||'Assessment')}</b>`:'';const html=s?`Aktif State Snapshot: <b>${esc(s.name||s.sourceFile&&s.sourceFile.name||effectiveDate(s)||s.id)}</b> · geçerlilik ${esc(effectiveDate(s)||'-')} · Overall <b>${s.counts&&s.counts.overall&&s.counts.overall.ei!=null?Number(s.counts.overall.ei).toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2})+'%':'-'}</b>${linkText}${trText}`:'Henüz OLF Full PQ Status State Snapshot yüklenmedi.';['stateSnapshotStatus','stateSnapshotStatusDataPanel'].forEach(id=>{const el=document.getElementById(id);if(el)el.innerHTML=html;});const sel=document.getElementById('icaoEiStateSnapshot');if(sel){const cur=sel.value;const rows=list();sel.innerHTML='<option value="">State Snapshot seçiniz...</option>'+rows.map(x=>`<option value="${esc(x.id)}">${esc(effectiveDate(x)||'-')} · ${esc(x.name||x.sourceFile&&x.sourceFile.name||x.id)} · ${x.counts&&x.counts.overall&&x.counts.overall.ei!=null?Number(x.counts.overall.ei).toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2})+'%':'EI -'}</option>`).join('');if(rows.some(x=>x.id===cur))sel.value=cur;}populateAssessmentSelect(document.getElementById('stateSnapshotAssessmentEvent')?.value||'');}
  function renderList(){window.renderStateSnapshotSources();const el=document.getElementById('stateSnapshotList');if(!el)return;const rows=[...list()].reverse();if(!rows.length){el.innerHTML='<div class="icao-ei-auto-empty">Henüz State Compliance Snapshot yok.</div>';return;}el.innerHTML=rows.map(x=>{const o=x.counts&&x.counts.overall||{};const ts=x.transitionSummary||{},delta=x.transitionFromSnapshotId?` · ${ts.nsToS||0} NS→S · ${ts.sToNs||0} S→NS · ${ts.totalChanged||0} değişim`:'';const ev=x.linkedAssessmentEventId?assessmentById(x.linkedAssessmentEventId):null;const linked=ev?` · <b>${esc(ev.name||ev.type||'Assessment')}</b>`:' · Bağımsız';return `<div class="state-snapshot-row"><div><b>${esc(x.name||x.sourceFile&&x.sourceFile.name||'State Snapshot')}</b><span>Geçerlilik: ${esc(effectiveDate(x)||'-')} · import: ${esc((x.importedAt||x.createdAt||'').slice(0,10)||'-')} · ${esc(x.pqVersion||'-')}${x.pqRevision?'/'+esc(x.pqRevision):''}${linked}${delta}</span></div><div><strong>${o.ei==null?'-':Number(o.ei).toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2})+'%'}</strong><span>${o.satisfactory??'-'}/${o.applicable??'-'} S/Applicable</span></div><div style="display:flex;gap:5px;flex-wrap:wrap"><button type="button" class="btn-outline" onclick="editStateSnapshotMetadata('${esc(x.id)}')">Bağlantı / Metadata</button><button type="button" class="btn-outline" onclick="useStateSnapshotForOfficialEi('${esc(x.id)}')">EI Kaydına Bağla</button><button type="button" class="btn-outline state-snapshot-delete" data-permission="officialEi.write" onclick="deleteStateComplianceSnapshot('${esc(x.id)}')">Sil</button></div></div>`;}).join('');}
  window.renderStateSnapshotSources=function(){
    const el=document.getElementById('stateSnapshotSources');if(!el)return;
    const body=assessmentRows().map(r=>{
      const explicitId=r.stateSnapshotId||r.sourceOfTruth?.stateSnapshotId;
      const snapshot=window.getStateComplianceSnapshotById(explicitId)||list().filter(s=>s.active!==false&&s.linkedAssessmentEventId===r.id).at(-1);
      const published=r.published?.overallEI??r.legacyBeforeStateLink?.overallEI;
      const hasPercentage=published!=null||(!explicitId&&r.overallEI!=null);
      const source=snapshot?`${snapshot.name||snapshot.sourceFile?.name||snapshot.id} · ${effectiveDate(snapshot)||'tarih yok'}`:
        hasPercentage?'Yalnız kayıtlı / yayımlanan EI; PQ ayrıntıları yok':r.selectionKind==='visit'?'Ziyaret kayıtlı; EI değerlendirmesi ve tam PQ durum kaynağı henüz bağlanmadı':'Tam PQ durum kaynağı bekleniyor';
      const detail=snapshot&&snapshot.sourceFile?.name?`<small>${esc(snapshot.sourceFile.name)}</small>`:'';
      const status=r.selectionKind==='visit'?'Sonuç kaydı yok':r.resultStatus==='draft'?'Taslak':r.resultStatus==='provisional'?'Geçici':'Nihai / Resmî';
      const action=r.officialRecordId?`onclick="openStateSnapshotAssessment('${esc(r.officialRecordId)}')">Düzenle`:`onclick="selectStateSnapshotAssessment('${esc(r.id)}')">Snapshot'a bağla`;
      return `<tr><td><b>${esc(r.name||r.type||'Değerlendirme')}</b><small>${esc(r.type||'')} · ${esc(r.assessmentDate||'-')} · ${status}</small></td><td>${esc(source)}${detail}</td><td><button type="button" class="btn-outline" ${action}</button></td></tr>`;
    }).join('');
    el.innerHTML=body?`<div style="overflow-x:auto"><table class="icao-ei-auto-table"><thead><tr><th>Değerlendirme / ziyaret</th><th>EI ve bulgu kaynağı</th><th>İşlem</th></tr></thead><tbody>${body}</tbody></table></div>`:'<div class="icao-ei-auto-empty">Henüz ICAO değerlendirmesi veya resmî ziyaret kaydı yok. Kayıtlar yüklendiğinde bu liste yenilenir.</div>';
  };
  window.openStateSnapshotAssessment=function(id){window.closeStateSnapshotCenter();window.openIcaoOfficialEiManager?.();window.editIcaoOfficialEiRecord?.(id);};
  function applyRemovalUpdates(updates){
    const stores={icao_state_snapshots:'icaoStateSnapshots',icao_official_ei:'icaoOfficialEiRecords',icao_assessment_events:'icaoAssessmentEvents',icao_ei_snapshots:'icaoEiSnapshots'};
    for(const [path,value] of Object.entries(updates)){
      const [root,id,...rest]=path.split('/'),key=stores[root];if(!key||!id)continue;
      const store=window[key]||(window[key]={});
      if(!rest.length){if(value===null)delete store[id];else store[id]=value;}
      else{const row=store[id]||(store[id]={});if(value===null)delete row[rest[0]];else row[rest[0]]=value;}
    }
  }
  window.deleteStateComplianceSnapshot=async function(id){
    if(deleting.has(id))return false;
    const snapshot=window.icaoStateSnapshots?.[id];if(!snapshot||snapshot.isDeleted)return false;
    if(!firebase.auth().currentUser){alert('Silmek için yetkili oturum gereklidir.');return false;}
    if(typeof window.hasAccessPermission==='function'&&!window.hasAccessPermission('officialEi.write')){alert('Bu kaydı silmek için EI düzenleme yetkisi gereklidir.');return false;}
    try{
      const now=new Date().toISOString(),who=actor();
      const plan=window.buildOfficialEiStateSnapshotRemovalUpdates(id,now,who);
      const sourceName=snapshot.name||snapshot.sourceFile?.name||id;
      const affected=plan.affected.length?`\nBağlı değerlendirmeler: ${plan.affected.map(r=>r.name).join(', ')}. Kalan açık bağlantı veya yayımlanan EI korunur; kaynaksız hesaplar kaldırılır.`:'';
      if(!confirm(`“${sourceName}” kaydı silinsin mi?${affected}\nKayıt listelerden ve hesaplardan çıkarılır; CAP Word kayıtları ve ziyaretler korunur. Silme bilgisi denetim geçmişinde saklanır.`))return false;
      deleting.add(id);
      const updates={...plan.updates};
      for(const [key,value] of Object.entries({isDeleted:true,active:false,deletedAt:now,deletedBy:who,updatedAt:now,updatedBy:who}))updates[`${PATH}/${id}/${key}`]=value;
      // Clear any standalone derived event/snapshot that also refers to this source.
      for(const [key,event] of Object.entries(window.icaoAssessmentEvents||{})){
        const path=`icao_assessment_events/${key}`;
        if(event?.stateSnapshotId===id&&!updates[path])updates[path]={...event,stateSnapshotId:'',reconciliation:{status:'awaiting_state_snapshot'},updatedAt:now,updatedBy:who};
      }
      for(const [key,ei] of Object.entries(window.icaoEiSnapshots||{})){
        const path=`icao_ei_snapshots/${key}`;
        if(ei?.stateSnapshotId===id&&!updates[path])updates[path]={...ei,stateSnapshotId:'',overall:{},areas:{},sourceOfTruth:{calculationSource:'removed_state_snapshot'},reconciliation:{status:'awaiting_state_snapshot'},updatedAt:now,updatedBy:who};
      }
      await db.ref().update(updates);
      applyRemovalUpdates(updates);
      if(document.getElementById('stateSnapshotEditId')?.value===id)window.resetStateSnapshotMetadataForm();
      applyLatest();renderList();window.scheduleDashboardOverview?.();
      if(typeof showAppRuntimeToast==='function')showAppRuntimeToast('PQ durum kaydı silindi; EI kaynakları güncellendi.','success');
      return true;
    }catch(e){console.error(e);alert('Kayıt silinemedi: '+(e.message||e));return false;}
    finally{deleting.delete(id);}
  };
  function renderPreview(){const el=document.getElementById('stateSnapshotPreview');if(!el)return;if(!preview){el.innerHTML='<div class="icao-ei-auto-empty">Tüm PQ statülerini içeren OLF Excel dosyasını seçiniz veya mevcut snapshot metadata kaydını düzenleyiniz.</div>';return;}if(!preview.ok){el.innerHTML=`<div class="icao-ei-auto-warnings"><div>⚠️ ${esc(preview.message||'Dosya uygun değil.')}</div></div>`;return;}const c=preview.counts,o=c.overall;el.innerHTML=`<div class="icao-ei-auto-preview-head"><div><b>${esc(preview.fileName||preview.name||'Mevcut State Snapshot')}</b><span>${esc(preview.sheet||'kayıtlı PQ state')}</span></div><div class="icao-ei-auto-kpi"><strong>${o.ei==null?'-':Number(o.ei).toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2})+'%'}</strong><small>Hesaplanan Overall EI</small></div></div><div class="icao-ei-auto-meta">PQ: <b>${preview.parsed??Object.keys(preview.states||{}).length}</b> · Satisfactory: <b>${o.satisfactory}</b> · NS: <b>${o.notSatisfactory}</b> · N/A: <b>${o.notApplicable}</b> · Applicable: <b>${o.applicable}</b></div>${preview.warnings&&preview.warnings.length?`<div class="icao-ei-auto-warnings">${preview.warnings.map(w=>`<div>⚠️ ${esc(w)}</div>`).join('')}</div>`:''}<div style="overflow-x:auto"><table class="icao-ei-auto-table"><thead><tr><th>Alan</th><th>S</th><th>NS</th><th>N/A</th><th>Applicable</th><th>EI</th></tr></thead><tbody>${AREAS.map(a=>{const x=c.areas[a];return `<tr><td><b>${a}</b></td><td>${x.satisfactory}</td><td>${x.notSatisfactory}</td><td>${x.notApplicable}</td><td>${x.applicable}</td><td>${x.ei==null?'-':Number(x.ei).toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2})+'%'}</td></tr>`;}).join('')}</tbody></table></div>`;}

  window.openStateSnapshotCenter=function(){const m=document.getElementById('stateSnapshotModal');if(m)m.style.display='block';window.resetStateSnapshotMetadataForm();renderList();renderStatus();};
  window.closeStateSnapshotCenter=function(){const m=document.getElementById('stateSnapshotModal');if(m)m.style.display='none';};
  window.triggerStateSnapshotFile=function(){document.getElementById('stateSnapshotFileInput')?.click();};
  window.handleStateSnapshotFile=async function(event){const file=event&&event.target&&event.target.files&&event.target.files[0];if(!file)return;try{if(typeof XLSX==='undefined')throw new Error('XLSX kütüphanesi yüklenemedi.');const wb=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:true});const result=window.parseFullStatusWorkbook(wb,file.name);preview={...result,fileName:file.name,fileSize:file.size,fileLastModified:file.lastModified,effectiveAsOfDate:inferDate(file.name)};const edit=document.getElementById('stateSnapshotEditId');if(edit)edit.value='';const date=document.getElementById('stateSnapshotDate');if(date&&!date.value&&preview.effectiveAsOfDate)date.value=preview.effectiveAsOfDate;const name=document.getElementById('stateSnapshotName');if(name&&!name.value)name.value=file.name.replace(/\.(xlsx?|xls)$/i,'');populateAssessmentSelect('');renderPreview();}catch(e){preview={ok:false,message:e.message||String(e),fileName:file.name};renderPreview();}finally{event.target.value='';}};
  function transitionMetaForPayload(effectiveAsOfDate,states){const rows=list().filter(x=>effectiveDate(x)<String(effectiveAsOfDate||''));const previous=rows.length?rows[rows.length-1]:null;if(!previous)return{transitionFromSnapshotId:'',transitionSummary:null};const current={id:'__preview__',effectiveAsOfDate,snapshotDate:effectiveAsOfDate,pqStates:states};const c=compareSnapshots(previous,current);return{transitionFromSnapshotId:previous.id||'',transitionSummary:c.summary};}
  window.saveParsedStateComplianceSnapshot=async function(parsed,meta={}){
    if(!parsed||!parsed.ok||!parsed.states||!parsed.counts)throw new Error('Geçerli Full PQ Status parse sonucu yok.');
    if(!firebase.auth().currentUser)throw new Error('Kayıt için yetkili oturum gereklidir.');
    if(typeof window.hasAccessPermission==='function'&&!window.hasAccessPermission('officialEi.write'))throw new Error('Bu işlem için EI düzenleme yetkisi gereklidir.');
    const now=new Date().toISOString(),who=actor(),sourceFile=meta.sourceFile||{};
    const effectiveAsOfDate=meta.effectiveAsOfDate||meta.snapshotDate||inferDate(sourceFile.name||'');
    if(!effectiveAsOfDate)throw new Error('Snapshot effectiveAsOfDate zorunludur; import tarihi otomatik kullanılmaz.');
    const name=meta.name||sourceFile.name||`State Snapshot ${effectiveAsOfDate}`;
    const importKey=meta.importKey||`${sourceFile.name||name}|${sourceFile.size||0}|${sourceFile.lastModified||0}|${parsed.sheet||''}`;
    const existing=Object.entries(window.icaoStateSnapshots||{}).find(([,x])=>x&&!x.isDeleted&&x.importKey===importKey);
    const id=meta.id||existing?.[0]||db.ref(PATH).push().key,old=window.icaoStateSnapshots[id]||{};
    if(old.isDeleted)throw new Error('Silinmiş snapshot düzenlenemez; dosyayı yeni kayıt olarak yükleyin.');
    const selected=meta.linkedAssessmentEventId!==undefined?meta.linkedAssessmentEventId:(old.linkedAssessmentEventId||'');
    const target=selected?assessmentById(selected):null;
    if(selected&&!target)throw new Error('Seçili değerlendirme / ziyaret yüklenemedi veya silinmiş. Listeyi yenileyin; mevcut bağlantı değiştirilmedi.');
    let payload=clean({schemaVersion:4,name,effectiveAsOfDate,snapshotDate:effectiveAsOfDate,linkedAssessmentEventId:selected,linkedVisitId:target?.linkedVisitId||'',
      resultStatus:target?.resultStatus||old.resultStatus||'',linkMode:selected?'explicit_assessment':'unlinked',pqVersion:meta.pqVersion||'',pqRevision:meta.pqRevision||'',
      sourceType:'olf_full_status',sourceAuthority:'state_status',granularity:'pq',sourceFile:{...sourceFile,sheet:parsed.sheet||sourceFile.sheet||''},importKey:meta.importKey||old.importKey||importKey,
      pqStates:parsed.states,counts:parsed.counts,warnings:parsed.warnings||[],...transitionMetaForPayload(effectiveAsOfDate,parsed.states),active:true,isDeleted:false,
      importedAt:old.importedAt||now,createdAt:old.createdAt||now,createdBy:old.createdBy||who,updatedAt:now,updatedBy:who,moduleVersion:VERSION});
    const bound=window.buildStateSnapshotAssessmentBinding(id,payload,target,meta.assessmentResultStatus);
    payload=clean(bound.snapshot);delete payload.id;
    const previousLink=old.linkedAssessmentEventId||'',updates={};
    if(previousLink!==payload.linkedAssessmentEventId)Object.assign(updates,window.buildOfficialEiStateSnapshotRemovalUpdates(id,now,who).updates);
    Object.assign(updates,bound.updates,{[`${PATH}/${id}`]:payload});
    await db.ref().update(updates);
    applyRemovalUpdates(updates);applyLatest();renderList();window.scheduleDashboardOverview?.();
    return{id,payload,updated:!!old.createdAt};
  };

  window.resetStateSnapshotMetadataForm=function(){preview=null;['stateSnapshotEditId','stateSnapshotName','stateSnapshotDate','stateSnapshotPqVersion','stateSnapshotPqRevision','stateSnapshotAssessmentStatus'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});populateAssessmentSelect('');renderPreview();};
  window.editStateSnapshotMetadata=function(id){const x=window.getStateComplianceSnapshotById(id);if(!x)return;preview={ok:true,states:x.pqStates||{},counts:x.counts||summarize(x.pqStates||{}),warnings:x.warnings||[],parsed:Object.keys(x.pqStates||{}).length,fileName:x.sourceFile&&x.sourceFile.name||x.name||'State Snapshot',sheet:x.sourceFile&&x.sourceFile.sheet||'',fileSize:x.sourceFile&&x.sourceFile.size||0,fileLastModified:x.sourceFile&&x.sourceFile.lastModified||0,effectiveAsOfDate:effectiveDate(x)};const set=(id,v)=>{const e=document.getElementById(id);if(e)e.value=v||''};set('stateSnapshotEditId',id);set('stateSnapshotName',x.name||'');set('stateSnapshotDate',effectiveDate(x));set('stateSnapshotPqVersion',x.pqVersion||'');set('stateSnapshotPqRevision',x.pqRevision||'');populateAssessmentSelect(x.linkedAssessmentEventId||'');renderPreview();};
  window.saveStateSnapshot=async function(){
    if(savingSnapshot)return;
    if(!preview||!preview.ok)return alert('Önce geçerli bir Full PQ Status Excel dosyası analiz edin veya mevcut snapshot metadata kaydını açın.');
    const form=id=>(document.getElementById(id)?.value||'').trim();
    savingSnapshot=true;
    try{
      const saved=await window.saveParsedStateComplianceSnapshot(preview,{
        id:form('stateSnapshotEditId')||undefined,name:form('stateSnapshotName')||preview.fileName,
        effectiveAsOfDate:form('stateSnapshotDate')||preview.effectiveAsOfDate||'',
        linkedAssessmentEventId:form('stateSnapshotAssessmentEvent'),assessmentResultStatus:form('stateSnapshotAssessmentStatus'),
        pqVersion:form('stateSnapshotPqVersion'),pqRevision:form('stateSnapshotPqRevision'),
        sourceFile:{name:preview.fileName||'',size:preview.fileSize||0,lastModified:preview.fileLastModified||0,sheet:preview.sheet||''}});
      window.resetStateSnapshotMetadataForm();renderList();renderStatus();
      if(typeof showAppRuntimeToast==='function')showAppRuntimeToast(`State Snapshot kaydedildi${saved.payload.linkedAssessmentEventId?' ve seçili değerlendirme / ziyaret ile bağlandı':' (assessment bağımsız)'}.`,'success');
    }catch(e){console.error(e);alert('State Snapshot kaydedilemedi: '+(e.message||e));}
    finally{savingSnapshot=false;}
  };

  window.useStateSnapshotForOfficialEi=function(id){const s=window.getStateComplianceSnapshotById(id);if(!s)return;const modal=document.getElementById('stateSnapshotModal');if(modal)modal.style.display='none';const main=document.getElementById('icaoOfficialEiModal');if(main)main.style.display='block';const sel=document.getElementById('icaoEiStateSnapshot');if(sel)sel.value=id;if(typeof window.applyStateSnapshotToOfficialEiForm==='function')window.applyStateSnapshotToOfficialEiForm(id);};

  window.startStateComplianceListener=function(){if(ref&&cb)ref.off('value',cb);window.icaoStateComplianceLoaded=false;if(!firebase.auth().currentUser)return;ref=db.ref(PATH);cb=snap=>{window.icaoStateSnapshots=snap.val()||{};window.icaoStateComplianceLoaded=true;applyLatest();renderList();if(typeof window.syncAllOfficialEiRecordsToAssessmentModel==='function')setTimeout(()=>window.syncAllOfficialEiRecordsToAssessmentModel({silent:true}),80);if(typeof window.reconcileExplicitStateSnapshotLinks==='function')setTimeout(()=>window.reconcileExplicitStateSnapshotLinks({silent:true}).catch(()=>{}),160);if(typeof window.renderValidationReadiness==='function'&&document.getElementById('tab-validation-readiness')?.classList.contains('active'))setTimeout(()=>window.renderValidationReadiness(),0);if(typeof window.renderSystemIntegrityCenter==='function'&&document.getElementById('tab-quality')?.classList.contains('active'))setTimeout(()=>window.renderSystemIntegrityCenter(true),0);};ref.on('value',cb,e=>{console.error('State Snapshot okunamadı',e);window.icaoStateComplianceLoaded=true;});};
  window.stopStateComplianceListener=function(){if(ref&&cb)ref.off('value',cb);ref=null;cb=null;window.icaoStateSnapshots={};window.icaoStateComplianceLoaded=false;applyLatest();};
  window.runStateComplianceSelfCheck=function(){const synthetic=parseFullStatusSheet({rows:[{'PQ':'1.001','Area':'LEG','Status':'Satisfactory'},{'PQ':'1.002','Area':'LEG','Status':'Not Satisfactory'},{'PQ':'4.001','Area':'OPS','Status':'Satisfactory'},{'PQ':'4.002','Area':'OPS','Status':'N/A'}]});const ok=synthetic.counts.overall.satisfactory===2&&synthetic.counts.overall.applicable===3&&synthetic.counts.overall.notApplicable===1&&Math.abs(synthetic.counts.overall.ei-66.67)<0.01;const prev={id:'a',effectiveAsOfDate:'2026-01-01',snapshotDate:'2026-01-01',pqStates:{a:{pq:'1.001',area:'LEG',status:'NS'},b:{pq:'1.002',area:'LEG',status:'S'}}},cur={id:'b',effectiveAsOfDate:'2026-02-01',snapshotDate:'2026-02-01',pqStates:{a:{pq:'1.001',area:'LEG',status:'S'},b:{pq:'1.002',area:'LEG',status:'S'}}},tr=compareSnapshots(prev,cur),transitionOk=tr.summary.nsToS===1&&tr.summary.totalChanged===1;const r={passed:ok&&transitionOk&&typeof window.parseFullStatusWorkbook==='function'&&typeof window.isPqOfficiallySatisfactory==='function'&&typeof window.editStateSnapshotMetadata==='function',version:VERSION,loaded:window.icaoStateComplianceLoaded,snapshots:list().length,synthetic:ok,transition:transitionOk,latest:latest()&&latest().id||''};console.log('State Compliance öz denetimi:',r);return r;};
  document.addEventListener('DOMContentLoaded',()=>{renderStatus();renderPreview();});
})();
