// USOAP CMA Action & Task Center
// Phase 13 v16: derived operational actions + manual tasks + workflow overlays
(function(){
  'use strict';
  const MODULE_VERSION='action-center-v16';
  const PATH='icao_action_center';
  const DEFAULT_SETTINGS={capLeadDays:15,visitLeadDays:14};
  const STATUS={
    new:{label:'Yeni',css:'new'},
    in_progress:{label:'Devam ediyor',css:'progress'},
    waiting:{label:'Beklemede',css:'waiting'},
    external_wait:{label:'Dış cevaba bağlı',css:'external'},
    verification:{label:'Doğrulama bekliyor',css:'verification'},
    completed:{label:'Tamamlandı',css:'completed'}
  };
  const PRIORITY={critical:{label:'Kritik',rank:4},high:{label:'Yüksek',rank:3},medium:{label:'Orta',rank:2},low:{label:'Düşük',rank:1}};
  const SOURCE_LABELS={cap:'CAP',validation:'Validasyon',visit:'Ziyaret',followup:'Ziyaret Takibi',consultation:'Danışma',integrity:'Veri Bütünlüğü',ei:'EI / OLF',manual:'Manuel'};
  const state={manual:{},overrides:{},settings:{...DEFAULT_SETTINGS},loaded:false,ref:null,callback:null,activeKey:'',quickView:'open'};

  const db=()=>typeof firebase!=='undefined'&&firebase.database?firebase.database():null;
  const text=v=>String(v===undefined||v===null?'':v).trim();
  const esc=v=>typeof window.escapeHtml==='function'?window.escapeHtml(String(v??'')):String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const arr=v=>Array.isArray(v)?v:[];
  const obj=v=>v&&typeof v==='object'?v:{};
  const safeKey=v=>String(v||'').replace(/[^A-Za-z0-9_-]+/g,'_').slice(0,220);
  const today=()=>{const d=new Date();d.setHours(0,0,0,0);return d;};
  const isoDate=d=>{if(!d)return'';const x=d instanceof Date?new Date(d):new Date(d);if(Number.isNaN(x.getTime()))return'';return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`;};
  const parseDate=v=>{if(!v)return null;if(v instanceof Date){const d=new Date(v);d.setHours(0,0,0,0);return d;}const s=String(v).trim();let m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);let y,mo,da;if(m){y=+m[1];mo=+m[2]-1;da=+m[3];}else{m=s.match(/(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})/);if(!m)return null;da=+m[1];mo=+m[2]-1;y=+m[3];if(y<100)y+=2000;}const d=new Date(y,mo,da);if(d.getFullYear()!==y||d.getMonth()!==mo||d.getDate()!==da)return null;d.setHours(0,0,0,0);return d;};
  const dayDiff=(a,b)=>Math.round((a-b)/86400000);
  const actor=()=>{const u=firebase&&firebase.auth?firebase.auth().currentUser:null;return u?{uid:u.uid||'',email:u.email||'',displayName:u.displayName||''}:{uid:'',email:'',displayName:''};};
  const sourceSnapshot=()=>typeof window.getSystemIntegritySourceSnapshot==='function'?window.getSystemIntegritySourceSnapshot():{rawData:[],pqMasterData:{},visits:[]};
  const validationRows=()=>typeof window.getValidationCandidateRows==='function'?window.getValidationCandidateRows():[];
  const visitRows=()=>typeof window.getVisitRecords==='function'?window.getVisitRecords(false):[];
  const followRows=()=>typeof window.getAllVisitFollowUpItems==='function'?window.getAllVisitFollowUpItems():[];
  const consultationRows=()=>typeof window.getAllVisitConsultationItems==='function'?window.getAllVisitConsultationItems():[];
  const priorityOf=v=>PRIORITY[v]?v:'medium';

  function endOfWeek(){const d=today(),day=d.getDay()||7;d.setDate(d.getDate()+(7-day));return d;}
  function endOfMonth(){const d=today();return new Date(d.getFullYear(),d.getMonth()+1,0);}
  function dueDateOf(t){return parseDate(t.followUpDate||t.targetDate||'');}
  function timing(t){const d=dueDateOf(t),now=today();if(!d)return{code:'no_date',days:null};const diff=dayDiff(d,now);if(diff<0)return{code:'overdue',days:Math.abs(diff)};if(diff===0)return{code:'today',days:0};return{code:'future',days:diff};}
  function autoTask(base){
    const key=`auto::${base.sourceType}::${safeKey(base.sourceId)}`;
    const overlay=obj(state.overrides[safeKey(key)]||state.overrides[key]);
    let status=overlay.status||base.defaultStatus||'new';
    // Kaynak hâlâ otomatik görev üretiyorsa kullanıcı tarafından "tamamlandı" işaretlenmesi kaynağı kapatmış sayılmaz.
    if(status==='completed')status='verification';
    return {...base,key,isAuto:true,status,priority:priorityOf(overlay.priority||base.priority),owner:text(overlay.owner||base.owner),unit:text(overlay.unit||base.unit),targetDate:text(overlay.targetDate||base.targetDate),followUpDate:text(overlay.followUpDate||base.followUpDate),notes:text(overlay.notes||base.notes),updatedAt:overlay.updatedAt||base.updatedAt||'',overlay};
  }

  function buildCapTasks(){
    const source=sourceSnapshot(), raw=arr(source.rawData), master=obj(source.pqMasterData), tasks=[];
    if(typeof window.buildCommonTaskTrackingModel!=='function')return tasks;
    let model;try{model=window.buildCommonTaskTrackingModel(raw,{upcomingDays:Number(state.settings.capLeadDays)||15});}catch(_){return tasks;}
    arr(model&&model.actionItems).forEach(a=>{
      if(!a||!a.row||a.code==='completed')return;
      if(!['late','upcoming','date_risk'].includes(a.code))return;
      const r=a.row,m=master[a.pq]||a.master||{},step=text(r.step)||'-',area=text(a.area||m.alan).toUpperCase();
      const title=a.code==='late'?`Gecikmiş CAP adımı: PQ ${a.pq} / Adım ${step}`:a.code==='date_risk'?`CAP hedef tarihi eksik: PQ ${a.pq} / Adım ${step}`:`Yaklaşan CAP termini: PQ ${a.pq} / Adım ${step}`;
      const priority=a.code==='late'?(Number(a.delayDays||0)>=30?'critical':'high'):(a.code==='date_risk'?'high':(Number(a.daysRemaining||99)<=7?'high':'medium'));
      tasks.push(autoTask({sourceType:'cap',sourceId:`${a.pq}::${step}`,title,description:text(r.action),area,pq:a.pq,step,priority,owner:text(m.sorumlu),unit:text(r.office),targetDate:a.targetDate?isoDate(a.targetDate):text(r.estDate),defaultStatus:'new',route:{tab:'list',pq:a.pq},meta:{classification:a.code,delayDays:a.delayDays||0,daysRemaining:a.daysRemaining}}));
    });
    return tasks;
  }

  function buildValidationTasks(){
    const tasks=[];validationRows().forEach(r=>{
      if(!r||r.effectiveStatus==='hold')return;
      const base={sourceType:'validation',area:r.area||'',pq:r.pq||'',owner:'',unit:'',route:{tab:'validation-readiness',candidateKey:r.key},meta:{candidateKey:r.key,targetVisitId:r.targetVisitId||''}};
      if(r.effectiveStatus==='ready'&&!r.targetVisitId){tasks.push(autoTask({...base,sourceId:`assign::${r.key}`,title:`Validasyon adayı ziyarete atanmalı: ${r.area||''} PQ ${r.pq||''}`,description:'CAP tamamlandı; aday henüz hedef ICAO/OSVA/ICVM ziyaretine atanmadı.',priority:'high',defaultStatus:'new'}));}
      if(['ready','assigned'].includes(r.effectiveStatus)&&!r.evidenceComplete){tasks.push(autoTask({...base,sourceId:`evidence::${r.key}`,title:`Validasyon kanıt paketi eksik: ${r.area||''} PQ ${r.pq||''}`,description:`Kanıt referansı ${r.evidenceCount||0}/${r.capSteps||0}.`,priority:'high',defaultStatus:'in_progress'}));}
      if(['ready','assigned'].includes(r.effectiveStatus)&&!['ready','not_required'].includes(r.internalReviewStatus)){tasks.push(autoTask({...base,sourceId:`review::${r.key}`,title:`Validasyon iç incelemesi tamamlanmalı: ${r.area||''} PQ ${r.pq||''}`,description:`İç inceleme durumu: ${r.internalReviewStatus||'belirsiz'}.`,priority:'medium',defaultStatus:'in_progress'}));}
    });return tasks;
  }

  function buildVisitTasks(){
    const tasks=[],now=today(),lead=Number(state.settings.visitLeadDays)||14;
    visitRows().forEach(v=>{
      if(!v||v.isDeleted||['completed','cancelled'].includes(v.status))return;
      const start=parseDate(v.plannedStart);if(!start)return;
      const diff=dayDiff(start,now);if(diff>lead)return;
      const overdue=diff<0, priority=overdue?'critical':diff<=7?'high':'medium';
      tasks.push(autoTask({sourceType:'visit',sourceId:`prepare::${v.id}`,title:`${overdue?'Ziyaret tarihi geçti':'Yaklaşan ziyaret hazırlığı'}: ${v.visitName||'Adsız ziyaret'}`,description:`${arr(v.areas).join(', ')||'-'} · ${v.location||'-'} · Durum: ${v.status||'-'}`,priority,owner:'',unit:'',targetDate:isoDate(start),defaultStatus:'in_progress',route:{tab:'visits',visitId:v.id},meta:{visitId:v.id,daysRemaining:diff}}));
    });
    // Tamamlanan ICAO ziyaretinde resmî sonuç kaydı yoksa ayrıca aksiyon üret.
    visitRows().filter(v=>v&&v.visitType==='icao_official'&&v.status==='completed').forEach(v=>{
      const records=Object.values(obj(v.icaoValidation&&v.icaoValidation.records)).filter(r=>r&&!r.isDeleted);
      if(!records.length)tasks.push(autoTask({sourceType:'visit',sourceId:`result::${v.id}`,title:`ICAO ziyaret sonuçları sisteme girilmeli: ${v.visitName||'ICAO Ziyareti'}`,description:'Ziyaret tamamlandı ancak PQ bazlı ICAO validasyon sonucu bulunmuyor.',priority:'high',defaultStatus:'verification',route:{tab:'icao-visit-validation',visitId:v.id},meta:{visitId:v.id}}));
    });
    return tasks;
  }

  function buildFollowTasks(){
    return followRows().filter(i=>i&&!['completed','cancelled'].includes(i.status)&&['overdue','today','next7','date_risk'].includes(i.timing)).map(i=>autoTask({sourceType:'followup',sourceId:i.key,title:`Ziyaret takip aksiyonu: ${i.visitName}`,description:`${i.source&&i.source.targetLabel||'Ziyaret geneli'}${i.source&&i.source.pq?` · PQ ${i.source.pq}`:''}`,area:(i.visitAreas||[]).join(', '),pq:i.source&&i.source.pq||'',step:i.source&&i.source.step||'',priority:i.timing==='overdue'?'high':priorityOf(i.priority),owner:i.owner||'',unit:(i.visitUnits||[]).join(' · '),targetDate:i.followUpDate||'',defaultStatus:'in_progress',route:{tab:'visit-followup',visitId:i.visitId,sourceId:i.sourceRecordId},meta:{visitId:i.visitId,timing:i.timing,daysLate:i.daysLate||0}}));
  }

  function buildConsultationTasks(){
    return consultationRows().filter(i=>i&&!['completed','cancelled'].includes(i.status)&&(i.timing==='overdue'||i.timing==='today'||i.timing==='next7'||i.timing==='date_risk'||i.status==='decision_required')).map(i=>{
      const decision=i.status==='decision_required';
      return autoTask({sourceType:'consultation',sourceId:i.key,title:decision?`Danışma cevabı için karar gerekli: ${i.visitName}`:`Dış cevap bekleniyor: ${i.authority||i.visitName}`,description:`${i.topic||i.question||'Danışma kaydı'}${i.source&&i.source.pq?` · PQ ${i.source.pq}`:''}`,area:(i.visitAreas||[]).join(', '),pq:i.source&&i.source.pq||'',step:i.source&&i.source.step||'',priority:i.timing==='overdue'?'high':priorityOf(i.priority),owner:i.responsible||'',unit:(i.visitUnits||[]).join(' · '),targetDate:i.expectedResponseDate||i.nextActionDate||'',defaultStatus:decision?'verification':'external_wait',route:{tab:'visit-consultation',visitId:i.visitId,sourceId:i.sourceRecordId},meta:{visitId:i.visitId,timing:i.timing,authority:i.authority||''}});
    });
  }

  function buildIntegrityTasks(){
    if(typeof window.buildSystemIntegrityModel!=='function')return[];
    let model;try{model=window.buildSystemIntegrityModel({silent:true});}catch(_){return[];}
    return arr(model&&model.issues).filter(i=>['critical','high'].includes(i.severity)).map(i=>autoTask({sourceType:'integrity',sourceId:i.id,title:`${i.severity==='critical'?'Kritik':'Yüksek'} veri bütünlüğü sorunu: ${i.record}`,description:i.problem,priority:i.severity==='critical'?'critical':'high',defaultStatus:'verification',route:{integrityIssueId:i.id,integrityAction:i.action||{}},meta:{domain:i.domain,code:i.code,recommendation:i.recommendation||''}}));
  }

  function manualTasks(){return Object.entries(obj(state.manual)).filter(([,r])=>r&&!r.isDeleted).map(([id,r])=>({key:`manual::${id}`,id,isAuto:false,sourceType:r.sourceType||'manual',sourceId:r.sourceId||'',title:r.title||'Adsız görev',description:r.description||'',area:r.area||'',pq:r.pq||'',step:r.step||'',status:r.status||'new',priority:priorityOf(r.priority),owner:r.owner||'',unit:r.unit||'',targetDate:r.targetDate||'',followUpDate:r.followUpDate||'',notes:r.notes||'',route:r.route||{},meta:r.meta||{},createdAt:r.createdAt||'',updatedAt:r.updatedAt||''}));}

  function allTasks(){
    const map=new Map();[...buildCapTasks(),...buildValidationTasks(),...buildVisitTasks(),...buildFollowTasks(),...buildConsultationTasks(),...buildIntegrityTasks(),...manualTasks()].forEach(t=>map.set(t.key,t));
    return [...map.values()].map(t=>({...t,timing:timing(t)})).sort((a,b)=>{
      const sr={overdue:0,today:1,future:2,no_date:3},sa=sr[a.timing.code]??9,sb=sr[b.timing.code]??9;if(sa!==sb)return sa-sb;
      if((PRIORITY[b.priority]?.rank||0)!==(PRIORITY[a.priority]?.rank||0))return(PRIORITY[b.priority]?.rank||0)-(PRIORITY[a.priority]?.rank||0);
      const da=dueDateOf(a),dbb=dueDateOf(b);if(da&&dbb&&da.getTime()!==dbb.getTime())return da-dbb;if(da&&!dbb)return-1;if(!da&&dbb)return 1;return String(a.title).localeCompare(String(b.title),'tr');
    });
  }

  function isOpenStatus(s){return s!=='completed';}
  function matchesQuick(t,view){
    const d=dueDateOf(t),now=today();
    if(view==='all')return true;if(view==='open')return isOpenStatus(t.status);if(view==='today')return isOpenStatus(t.status)&&d&&d.getTime()===now.getTime();
    if(view==='week')return isOpenStatus(t.status)&&d&&d>=now&&d<=endOfWeek();if(view==='month')return isOpenStatus(t.status)&&d&&d>=now&&d<=endOfMonth();
    if(view==='overdue')return isOpenStatus(t.status)&&t.timing.code==='overdue';if(view==='external')return isOpenStatus(t.status)&&t.status==='external_wait';if(view==='verification')return isOpenStatus(t.status)&&t.status==='verification';if(view==='completed')return t.status==='completed';return true;
  }
  function filteredTasks(baseTasks){
    const source=(document.getElementById('actionSourceFilter')||{}).value||'all',status=(document.getElementById('actionStatusFilter')||{}).value||'all',priority=(document.getElementById('actionPriorityFilter')||{}).value||'all',q=text((document.getElementById('actionSearchInput')||{}).value).toLocaleLowerCase('tr');
    return (baseTasks||allTasks()).filter(t=>matchesQuick(t,state.quickView)).filter(t=>source==='all'||t.sourceType===source).filter(t=>status==='all'||t.status===status).filter(t=>priority==='all'||t.priority===priority).filter(t=>!q||[t.title,t.description,t.owner,t.unit,t.area,t.pq,t.step,t.notes,SOURCE_LABELS[t.sourceType]].join(' ').toLocaleLowerCase('tr').includes(q));
  }

  function setText(id,v){const e=document.getElementById(id);if(e)e.textContent=String(v);}
  function statusBadge(t){return `<span class="action-status ${STATUS[t.status]?.css||''}">${esc(STATUS[t.status]?.label||t.status)}</span>${t.timing.code==='overdue'&&t.status!=='completed'?` <span class="action-overdue">${t.timing.days} gün gecikmiş</span>`:''}`;}
  function dateLabel(t){const d=t.followUpDate||t.targetDate;return d?esc(d):'<span class="action-date-missing">Tarih yok</span>';}
  function sourceLabel(t){return SOURCE_LABELS[t.sourceType]||t.sourceType||'-';}

  function renderKpis(tasks){
    const open=tasks.filter(t=>isOpenStatus(t.status)),now=today(),week=endOfWeek();
    setText('actionKpiOpen',open.length);setText('actionKpiToday',open.filter(t=>dueDateOf(t)?.getTime()===now.getTime()).length);setText('actionKpiWeek',open.filter(t=>{const d=dueDateOf(t);return d&&d>=now&&d<=week;}).length);setText('actionKpiOverdue',open.filter(t=>t.timing.code==='overdue').length);setText('actionKpiExternal',open.filter(t=>t.status==='external_wait').length);setText('actionKpiVerification',open.filter(t=>t.status==='verification').length);
  }
  function renderQuick(){document.querySelectorAll('[data-action-view]').forEach(b=>b.classList.toggle('active',b.dataset.actionView===state.quickView));}
  function renderTable(rows){
    const body=document.getElementById('actionCenterTableBody');if(!body)return;
    if(!rows.length){body.innerHTML='<tr><td colspan="9" class="action-empty">Seçili görünümde aksiyon bulunmuyor.</td></tr>';return;}
    body.innerHTML=rows.map(t=>`<tr class="${t.timing.code==='overdue'&&t.status!=='completed'?'action-row-overdue':''}"><td><b>${esc(t.title)}</b><br><small>${esc(t.description||'-')}</small></td><td><span class="action-source">${esc(sourceLabel(t))}</span>${t.isAuto?'<br><small>Otomatik</small>':'<br><small>Manuel</small>'}</td><td>${esc(t.area||'-')}${t.pq?`<br><b>PQ ${esc(t.pq)}</b>`:''}${t.step?` / ${esc(t.step)}`:''}</td><td>${statusBadge(t)}</td><td><span class="action-priority ${t.priority}">${esc(PRIORITY[t.priority]?.label||t.priority)}</span></td><td>${esc(t.owner||'-')}<br><small>${esc(t.unit||'')}</small></td><td>${dateLabel(t)}</td><td>${esc(t.followUpDate||'-')}</td><td><div class="action-row-actions"><button type="button" onclick="openActionEditor('${esc(t.key)}')">✏️ Yönet</button><button type="button" class="btn-outline" onclick="openActionSource('${esc(t.key)}')">↗ Kaynak</button></div></td></tr>`).join('');
  }
  function renderDashboardSummary(baseTasks){
    const el=document.getElementById('actionCenterDashboardSummary');if(!el)return;const tasks=baseTasks||allTasks(),open=tasks.filter(t=>isOpenStatus(t.status)),over=open.filter(t=>t.timing.code==='overdue').length,todayCount=open.filter(t=>dueDateOf(t)?.getTime()===today().getTime()).length,external=open.filter(t=>t.status==='external_wait').length,verify=open.filter(t=>t.status==='verification').length;
    el.innerHTML=`<div class="action-dashboard-head"><div><b>✅ Aksiyon Merkezi</b><small>CAP, validasyon, ziyaret, danışma ve veri bütünlüğünden otomatik görevler</small></div><button type="button" class="btn-outline" onclick="switchTab('actions')">Aksiyonları Aç</button></div><div class="action-dashboard-kpis"><span><b>${open.length}</b> açık</span><span class="danger"><b>${over}</b> gecikmiş</span><span><b>${todayCount}</b> bugün</span><span><b>${external}</b> dış cevap</span><span><b>${verify}</b> doğrulama</span></div>`;
  }

  function render(){
    if(!document.getElementById('tab-actions'))return;const tasks=allTasks(),rows=filteredTasks(tasks);renderKpis(tasks);renderQuick();renderTable(rows);renderDashboardSummary(tasks);
    const info=document.getElementById('actionCenterContext');if(info)info.innerHTML=`<b>${rows.length}</b> görev gösteriliyor · toplam <b>${tasks.length}</b> görev · otomatik görevler kaynak veriden anlık türetilir, Firebase yalnız iş akışı tercihlerini ve manuel görevleri saklar.`;
    const cap=document.getElementById('actionCapLeadDays');if(cap&&!cap.matches(':focus'))cap.value=Number(state.settings.capLeadDays)||15;const visit=document.getElementById('actionVisitLeadDays');if(visit&&!visit.matches(':focus'))visit.value=Number(state.settings.visitLeadDays)||14;
  }

  function setQuickView(view){state.quickView=view||'open';render();}
  function clearFilters(){['actionSourceFilter','actionStatusFilter','actionPriorityFilter'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='all';});const q=document.getElementById('actionSearchInput');if(q)q.value='';state.quickView='open';render();}
  function findTask(key){return allTasks().find(t=>t.key===key)||null;}

  function populateEditor(t){
    const m=document.getElementById('actionCenterModal');if(!m)return;state.activeKey=t?t.key:'';
    document.getElementById('actionEditKey').value=t?t.key:'';document.getElementById('actionEditAuto').value=t&&t.isAuto?'1':'0';
    document.getElementById('actionEditTitle').value=t?t.title:'';document.getElementById('actionEditDescription').value=t?t.description:'';document.getElementById('actionEditStatus').value=t?t.status:'new';document.getElementById('actionEditPriority').value=t?t.priority:'medium';document.getElementById('actionEditOwner').value=t?t.owner:'';document.getElementById('actionEditUnit').value=t?t.unit:'';document.getElementById('actionEditTargetDate').value=t?t.targetDate:'';document.getElementById('actionEditFollowDate').value=t?t.followUpDate:'';document.getElementById('actionEditSourceType').value=t?t.sourceType:'manual';document.getElementById('actionEditSourceId').value=t?t.sourceId:'';document.getElementById('actionEditArea').value=t?t.area:'';document.getElementById('actionEditPq').value=t?t.pq:'';document.getElementById('actionEditStep').value=t?t.step:'';document.getElementById('actionEditNotes').value=t?t.notes:'';
    ['actionEditTitle','actionEditDescription','actionEditSourceType','actionEditSourceId','actionEditArea','actionEditPq','actionEditStep'].forEach(id=>{const e=document.getElementById(id);if(e)e.disabled=!!(t&&t.isAuto);});
    const badge=document.getElementById('actionEditSourceBadge');if(badge)badge.textContent=t&&t.isAuto?'Otomatik kaynak görevi — kaynak kapanmadan “Tamamlandı” seçimi Doğrulama Bekliyor durumuna döner.':'Manuel görev';
    const del=document.getElementById('actionDeleteBtn');if(del)del.style.display=t&&!t.isAuto?'inline-flex':'none';m.style.display='flex';
  }
  function openEditor(key){const t=findTask(key);if(!t)return;populateEditor(t);}
  function newManual(){populateEditor(null);}
  function closeEditor(){const m=document.getElementById('actionCenterModal');if(m)m.style.display='none';state.activeKey='';}

  async function saveEditor(e){
    if(e)e.preventDefault();const d=db();if(!d||!firebase.auth().currentUser)return alert('Görev kaydetmek için yetkili giriş gereklidir.');
    const key=document.getElementById('actionEditKey').value,isAuto=document.getElementById('actionEditAuto').value==='1',now=new Date().toISOString(),who=actor();
    const common={status:document.getElementById('actionEditStatus').value||'new',priority:document.getElementById('actionEditPriority').value||'medium',owner:text(document.getElementById('actionEditOwner').value),unit:text(document.getElementById('actionEditUnit').value),targetDate:text(document.getElementById('actionEditTargetDate').value),followUpDate:text(document.getElementById('actionEditFollowDate').value),notes:text(document.getElementById('actionEditNotes').value),updatedAt:now,updatedBy:who};
    try{
      if(isAuto){await d.ref(`${PATH}/overrides/${safeKey(key)}`).update(common);}else{
        const id=key&&key.startsWith('manual::')?key.slice(8):d.ref(`${PATH}/manual`).push().key;const existing=obj(state.manual[id]);const rec={...existing,...common,title:text(document.getElementById('actionEditTitle').value),description:text(document.getElementById('actionEditDescription').value),sourceType:document.getElementById('actionEditSourceType').value||'manual',sourceId:text(document.getElementById('actionEditSourceId').value),area:text(document.getElementById('actionEditArea').value).toUpperCase(),pq:text(document.getElementById('actionEditPq').value),step:text(document.getElementById('actionEditStep').value),createdAt:existing.createdAt||now,createdBy:existing.createdBy||who,isDeleted:false};if(!rec.title)return alert('Görev başlığı girilmelidir.');await d.ref(`${PATH}/manual/${id}`).set(rec);
      }
      closeEditor();if(typeof window.showAppRuntimeToast==='function')window.showAppRuntimeToast('Aksiyon kaydı güncellendi.','success');
    }catch(err){console.error(err);alert('Aksiyon kaydedilemedi: '+(err.message||err));}
  }
  async function deleteManual(){const key=document.getElementById('actionEditKey').value;if(!key.startsWith('manual::'))return;const id=key.slice(8);if(!confirm('Manuel görev silinsin mi?'))return;try{await db().ref(`${PATH}/manual/${id}`).update({isDeleted:true,deletedAt:new Date().toISOString(),deletedBy:actor()});closeEditor();}catch(err){alert('Görev silinemedi: '+(err.message||err));}}
  async function saveSettings(){const d=db();if(!d||!firebase.auth().currentUser)return alert('Ayar kaydetmek için giriş gereklidir.');const settings={capLeadDays:Math.max(1,Number((document.getElementById('actionCapLeadDays')||{}).value)||15),visitLeadDays:Math.max(1,Number((document.getElementById('actionVisitLeadDays')||{}).value)||14),updatedAt:new Date().toISOString(),updatedBy:actor()};try{await d.ref(`${PATH}/settings`).update(settings);if(typeof window.showAppRuntimeToast==='function')window.showAppRuntimeToast('Aksiyon eşik ayarları kaydedildi.','success');}catch(err){alert('Ayarlar kaydedilemedi: '+(err.message||err));}}

  function openSource(key){const t=findTask(key);if(!t)return;const r=t.route||{};
    if(r.integrityIssueId&&typeof window.navigateSystemIntegrityIssue==='function'){window.switchTab&&window.switchTab('quality');setTimeout(()=>window.navigateSystemIntegrityIssue(r.integrityIssueId),80);return;}
    if(r.tab==='list'){window.switchTab&&window.switchTab('list');setTimeout(()=>{try{if(typeof window.togglePQ==='function')window.togglePQ(String(r.pq||t.pq).replace(/\./g,'-'));}catch(_){}},80);return;}
    if(r.tab==='validation-readiness'){window.switchTab&&window.switchTab('validation-readiness');return;}
    if(r.tab==='visits'){window.switchTab&&window.switchTab('visits');setTimeout(()=>{if(r.visitId&&typeof window.viewVisitDetail==='function')window.viewVisitDetail(r.visitId);},80);return;}
    if(r.tab==='icao-visit-validation'){if(r.visitId&&typeof window.openIcaoOfficialVisitValidation==='function')window.openIcaoOfficialVisitValidation(r.visitId);else window.switchTab&&window.switchTab('icao-visit-validation');return;}
    if(r.tab==='visit-followup'){window.switchTab&&window.switchTab('visit-followup');return;}
    if(r.tab==='visit-consultation'){window.switchTab&&window.switchTab('visit-consultation');return;}
    if(r.tab&&window.switchTab)window.switchTab(r.tab);
  }

  function exportRows(){return filteredTasks().map(t=>({'Görev':t.title,'Kaynak':sourceLabel(t),'Otomatik/Manuel':t.isAuto?'Otomatik':'Manuel','Alan':t.area||'','PQ':t.pq||'','Adım':t.step||'','Durum':STATUS[t.status]?.label||t.status,'Öncelik':PRIORITY[t.priority]?.label||t.priority,'Sorumlu':t.owner||'','Birim':t.unit||'','Hedef Tarih':t.targetDate||'','Takip Tarihi':t.followUpDate||'','Zaman Durumu':t.timing.code==='overdue'?`${t.timing.days} gün gecikmiş`:t.timing.code==='today'?'Bugün':t.timing.code==='future'?`${t.timing.days} gün kaldı`:'Tarih yok','Açıklama':t.description||'','Notlar':t.notes||''}));}
  function exportExcel(){const rows=exportRows();if(!rows.length)return alert('Dışa aktarılacak aksiyon bulunamadı.');if(typeof createReportWorkbook!=='function'||typeof addJsonSheet!=='function')return alert('Excel rapor altyapısı bulunamadı.');const wb=createReportWorkbook({title:'Aksiyon ve Görev Merkezi',subject:'USOAP CMA aksiyon yönetimi'});addJsonSheet(wb,'Aksiyonlar',rows);addJsonSheet(wb,'Gecikenler',rows.filter(r=>String(r['Zaman Durumu']).includes('gecikmiş')));addJsonSheet(wb,'Dis_Cevap',rows.filter(r=>r['Durum']==='Dış cevaba bağlı'));addJsonSheet(wb,'Dogrulama',rows.filter(r=>r['Durum']==='Doğrulama bekliyor'));downloadReportWorkbook(wb,'USOAP_Aksiyon_Gorev_Merkezi.xlsx');}
  function exportPDF(){const rows=exportRows();if(!rows.length)return alert('Dışa aktarılacak aksiyon bulunamadı.');const body=[[{text:'Görev',bold:true},{text:'Kaynak',bold:true},{text:'Durum',bold:true},{text:'Öncelik',bold:true},{text:'Sorumlu',bold:true},{text:'Tarih',bold:true}]].concat(rows.map(r=>[r['Görev'],r['Kaynak'],r['Durum'],r['Öncelik'],r['Sorumlu']||'-',r['Takip Tarihi']||r['Hedef Tarih']||'-']));const content=[{text:'Aksiyon & Görev Merkezi',style:'header'},{text:`Rapor tarihi: ${new Date().toLocaleDateString('tr-TR')} · Görev: ${rows.length}`,style:'subheader'},{table:{headerRows:1,widths:['*','auto','auto','auto','auto','auto'],body},layout:'lightHorizontalLines'}];const def={pageOrientation:'landscape',pageSize:'A4',content,styles:{header:{fontSize:17,bold:true,color:'#2563eb',margin:[0,0,0,4]},subheader:{fontSize:9,color:'#64748b',margin:[0,0,0,10]}},defaultStyle:{font:'Roboto',fontSize:8}};if(typeof window.safeDownloadPdf==='function')return window.safeDownloadPdf(def,'USOAP_Aksiyon_Gorev_Merkezi.pdf');if(typeof pdfMake!=='undefined')return pdfMake.createPdf(def).download('USOAP_Aksiyon_Gorev_Merkezi.pdf');}

  function attach(){detach();const d=db();if(!d||!firebase.auth().currentUser){state.loaded=true;render();return;}state.ref=d.ref(PATH);state.callback=s=>{const v=s.val()||{};state.manual=obj(v.manual);state.overrides=obj(v.overrides);state.settings={...DEFAULT_SETTINGS,...obj(v.settings)};state.loaded=true;render();};state.ref.on('value',state.callback,err=>{console.error('Aksiyon merkezi okunamadı:',err);state.loaded=true;render();});}
  function detach(){if(state.ref&&state.callback)state.ref.off('value',state.callback);state.ref=null;state.callback=null;state.manual={};state.overrides={};state.settings={...DEFAULT_SETTINGS};state.loaded=false;renderDashboardSummary();}
  function selfCheck(){const tasks=allTasks();const result={passed:!!document.getElementById('tab-actions')&&typeof window.getSystemIntegritySourceSnapshot==='function'&&typeof window.buildCommonTaskTrackingModel==='function',moduleVersion:MODULE_VERSION,path:PATH,total:tasks.length,automatic:tasks.filter(t=>t.isAuto).length,manual:tasks.filter(t=>!t.isAuto).length,overdue:tasks.filter(t=>isOpenStatus(t.status)&&t.timing.code==='overdue').length};console.log('Aksiyon Merkezi öz denetimi:',result);return result;}

  window.renderActionCenter=render;window.setActionQuickView=setQuickView;window.clearActionFilters=clearFilters;window.openActionEditor=openEditor;window.openNewManualAction=newManual;window.closeActionEditor=closeEditor;window.saveActionEditor=saveEditor;window.deleteManualAction=deleteManual;window.saveActionCenterSettings=saveSettings;window.openActionSource=openSource;window.exportActionCenterExcel=exportExcel;window.exportActionCenterPDF=exportPDF;window.getActionCenterTasks=allTasks;window.getActionCenterSummary=()=>{const tasks=allTasks(),open=tasks.filter(t=>isOpenStatus(t.status));return{total:tasks.length,open:open.length,overdue:open.filter(t=>t.timing.code==='overdue').length,today:open.filter(t=>dueDateOf(t)?.getTime()===today().getTime()).length,external:open.filter(t=>t.status==='external_wait').length,verification:open.filter(t=>t.status==='verification').length};};window.renderActionCenterDashboardSummary=renderDashboardSummary;window.startActionCenterListener=attach;window.stopActionCenterListener=detach;window.runActionCenterSelfCheck=selfCheck;
  document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{renderDashboardSummary();if(typeof firebase!=='undefined'&&firebase.auth)firebase.auth().onAuthStateChanged(u=>u?attach():detach());},0));
})();
