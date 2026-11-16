(function(){
  'use strict';

  const MODULE_VERSION='reporting-center-v15-phase12';
  const AREAS=['LEG','ORG','PEL','OPS','AIR','AIG','ANS','AGA'];
  const STORAGE_KEY='usoap_reporting_center_v15';
  const PROFILES={
    executive:{icon:'🏛️',label:'Yönetici / Bakanlık Brifingi',short:'Yönetici',description:'Resmî EI, dönemsel değişim, alan durumu, validasyon potansiyeli ve öncelikli yönetim konuları.'},
    icao:{icon:'🌐',label:'ICAO Teknik Durum Paketi',short:'ICAO Teknik',description:'Assessment Event, EI Snapshot, PQ sürümü, denominator, valide PQ izi, CAP/validasyon ve kaynak-provenance.'},
    validation:{icon:'🎯',label:'Validasyon / Ziyaret Hazırlık Paketi',short:'Validasyon',description:'Hedef ziyaret kapsamı, aday PQ’lar, kanıt hazırlığı, CAP adımları, açık takipler ve belge indeksi.'},
    weekly:{icon:'📋',label:'İç Yönetim / Haftalık Takip',short:'Haftalık',description:'Geciken ve yaklaşan işler, sorumlu birimler, validasyon hazırlığı, ziyaretler, veri bütünlüğü ve son belgeler.'}
  };

  let state={profile:'executive',area:'ALL',visitId:'',includeDraft:false,includeProjection:true,includeIntegrity:true,includeDocuments:true,reportDate:new Date().toISOString().slice(0,10),title:'',notes:''};
  let lastModel=null;

  function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
  function text(v){return String(v??'').replace(/\s+/g,' ').trim();}
  function num(v){const n=Number(v);return Number.isFinite(n)?n:null;}
  function pct(v){const n=num(v);return n===null?'–':`%${n.toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2})}`;}
  function delta(v){const n=num(v);return n===null?'–':`${n>0?'+':''}${n.toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2})} puan`;}
  function arr(v){return Array.isArray(v)?v:[];}
  function dateValue(v){if(!v)return null;const d=new Date(String(v).length===10?String(v)+'T00:00:00':v);return isNaN(d)?null:d;}
  function dateLabel(v){const d=dateValue(v);return d?d.toLocaleDateString('tr-TR',{day:'2-digit',month:'short',year:'numeric'}):(v||'–');}
  function dateTimeLabel(v){const d=dateValue(v);return d?d.toLocaleString('tr-TR'):(v||'–');}
  function eventDate(r){return String(r&&r.assessmentDate||r&&r.endDate||r&&r.startDate||'');}
  function eventName(r){return text(r&&r.name||r&&r.type||'ICAO Değerlendirmesi');}
  function profile(){return PROFILES[state.profile]||PROFILES.executive;}
  function isOfficialVisit(v){return String(v&&v.visitType||'')==='icao_official'||String(v&&v.icaoVisitType||'').trim()!=='';}
  function visitName(v){return text(v&&v.visitName||v&&v.title||v&&v.name||'Adsız ziyaret');}
  function visitStatus(v){const s=String(v&&v.status||'planned');return ({planned:'Planlandı',active:'Devam ediyor',in_progress:'Devam ediyor',follow_up:'Takipte',completed:'Tamamlandı',cancelled:'İptal'})[s]||s;}
  function areaPass(area){return state.area==='ALL'||String(area||'').toUpperCase()===state.area;}
  function usableCapStep(r){if(!r)return false;try{if(typeof window.isUsableCapStep==='function')return !!window.isUsableCapStep(r);}catch(_){}return !!text(r.step||r.action);}
  function stepStatus(r){try{if(typeof window.getStatus==='function')return window.getStatus(r)||{};}catch(_){}const p=text(r&&r.progress).toLowerCase();if(/100|complete|tamam/.test(p))return{type:'done',label:'Tamamlandı'};const d=dateValue(r&&r.estDate);if(d&&d<new Date())return{type:'late',label:'Gecikmiş'};return{type:'pending',label:'Bekliyor'};}

  function loadState(){try{const raw=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');state={...state,...raw};}catch(_){}}
  function saveState(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}catch(_){}}

  function source(){try{return typeof window.getSystemIntegritySourceSnapshot==='function'?window.getSystemIntegritySourceSnapshot():{};}catch(_){return{};}}
  function assessment(){try{return typeof window.getAssessmentImpactModel==='function'?window.getAssessmentImpactModel():{rows:[],periods:[],candidates:{rows:[]},pending:[],areaCurrent:[]};}catch(_){return{rows:[],periods:[],candidates:{rows:[]},pending:[],areaCurrent:[]};}}
  function integrity(){if(!state.includeIntegrity)return null;try{return typeof window.buildSystemIntegrityModel==='function'?window.buildSystemIntegrityModel({silent:true}):null;}catch(_){return null;}}
  function documents(){if(!state.includeDocuments)return[];try{return window.ICADriveDocuments&&typeof window.ICADriveDocuments.allRecords==='function'?window.ICADriveDocuments.allRecords():[];}catch(_){return[];}}
  function managerBundle(){try{return typeof window.buildManagerReportBundle==='function'?window.buildManagerReportBundle():null;}catch(_){return null;}}

  function buildCapModel(src){
    const raw=arr(src.rawData).filter(r=>areaPass(((src.pqMasterData||{})[r.pq]||{}).alan));
    const master=src.pqMasterData||{};
    const groups={};raw.filter(usableCapStep).forEach(r=>{const pq=String(r.pq||'');if(!pq)return;(groups[pq]||(groups[pq]=[])).push(r);});
    const pqRows=Object.entries(groups).map(([pq,steps])=>{
      const m=master[pq]||{},statuses=steps.map(stepStatus),done=statuses.filter(s=>s.type==='done').length,late=statuses.filter(s=>s.type==='late').length;
      const dates=steps.map(x=>dateValue(x.estDate)).filter(Boolean).sort((a,b)=>a-b);
      return{pq,area:String(m.alan||'').toUpperCase(),ce:m.ce||'',owner:m.sorumlu||'',steps:steps.length,done,late,complete:steps.length>0&&done===steps.length,nextDate:dates[0]||null,master:m};
    }).sort((a,b)=>a.area.localeCompare(b.area,'tr')||a.pq.localeCompare(b.pq,'tr',{numeric:true}));
    return{
      raw,groups,pqRows,totalPq:pqRows.length,completedPq:pqRows.filter(x=>x.complete).length,openPq:pqRows.filter(x=>!x.complete).length,
      totalSteps:pqRows.reduce((s,x)=>s+x.steps,0),doneSteps:pqRows.reduce((s,x)=>s+x.done,0),lateSteps:pqRows.reduce((s,x)=>s+x.late,0),
      officialClosed:Object.entries(master).filter(([pq,m])=>m&&(typeof window.isPqEffectivelyOfficiallyClosed==='function'?window.isPqEffectivelyOfficiallyClosed(pq,m):m.isIcaoClosed)&&areaPass(m.alan)).length,
      overdue:pqRows.filter(x=>x.late>0).sort((a,b)=>b.late-a.late||a.pq.localeCompare(b.pq,'tr',{numeric:true})),
      completed:pqRows.filter(x=>x.complete)
    };
  }

  function filteredCandidates(rows){return arr(rows).filter(r=>areaPass(r.area)).filter(r=>!state.visitId||String(r.targetVisitId||'')===state.visitId);}
  function filteredVisits(visits){return arr(visits).filter(v=>!v.isDeleted).filter(v=>state.area==='ALL'||arr(v.areas).includes(state.area)).filter(v=>!state.visitId||String(v.id)===state.visitId);}
  function filteredDocs(rows){return arr(rows).filter(r=>state.area==='ALL'||String(r.area||'').toUpperCase()===state.area).filter(r=>!state.visitId||String(r.visitId||'')===state.visitId);}

  function buildModel(){
    const src=source(),a=assessment(),cap=buildCapModel(src),allCandidates=typeof window.getValidationCandidateRows==='function'?window.getValidationCandidateRows():arr(a.candidates&&a.candidates.rows);
    const candidates=filteredCandidates(allCandidates),visits=filteredVisits(src.visits||[]),docs=filteredDocs(documents()),integ=integrity(),bundle=managerBundle();
    const officialRows=arr(a.rows),latest=a.latest||officialRows[officialRows.length-1]||null,first=a.first||officialRows[0]||null;
    const latestEi=num(a.latestEi),firstEi=num(a.firstEi),overallDelta=num(a.totalDelta);
    const candidateActive=candidates.filter(r=>r.effectiveStatus!=='hold'),candidateReady=candidates.filter(r=>r.effectiveStatus==='ready'),candidateAssigned=candidates.filter(r=>r.effectiveStatus==='assigned'),candidatePotential=candidateActive.reduce((s,r)=>s+(Number(r.overallDelta)||0),0);
    const areaRows=AREAS.filter(areaPass).map(area=>{
      const cur=arr(a.areaCurrent).find(x=>x.area===area)||{},last=cur.last||null;
      const cands=candidates.filter(r=>r.area===area),capPqs=cap.pqRows.filter(r=>r.area===area);
      return{area,ei:num(cur.value),last,lastName:last?eventName(last):'',lastDate:last?eventDate(last):'',candidateCount:cands.length,candidatePotential:cands.filter(r=>r.effectiveStatus!=='hold').reduce((s,r)=>s+(Number(r.areaDelta)||0),0),capPq:capPqs.length,capComplete:capPqs.filter(r=>r.complete).length,lateSteps:capPqs.reduce((s,r)=>s+r.late,0)};
    });
    const today=new Date();today.setHours(0,0,0,0);
    const upcomingVisits=visits.filter(v=>{const d=dateValue(v.plannedStart);return d&&d>=today&&!['completed','cancelled'].includes(String(v.status||''));}).sort((x,y)=>(dateValue(x.plannedStart)||Infinity)-(dateValue(y.plannedStart)||Infinity));
    const selectedVisit=state.visitId?visits.find(v=>String(v.id)===state.visitId)||null:null;
    const validatedPqs=arr(a.periods).flatMap(p=>arr(p.pqChanges).map(x=>({...x,assessment:eventName(p.curr),assessmentDate:eventDate(p.curr)}))).filter(x=>areaPass(x.area));
    let phases=[];try{if(bundle&&typeof window.getManagerEiPhaseRows==='function')phases=window.getManagerEiPhaseRows(bundle)||[];}catch(_){}
    return{
      generatedAt:new Date().toISOString(),src,a,cap,candidates,allCandidates,visits,docs,integ,bundle,phases,latest,first,latestEi,firstEi,overallDelta,officialRows,areaRows,
      candidateActive,candidateReady,candidateAssigned,candidatePotential,projectedEi:latestEi===null?null:Math.min(100,latestEi+candidatePotential),upcomingVisits,selectedVisit,validatedPqs,
      pendingAssessments:state.includeDraft?arr(a.pending):[]
    };
  }

  function metricCard(label,value,sub,cls=''){return `<div class="report-center-kpi ${cls}"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(sub||'')}</small></div>`;}
  function section(title,html,sub=''){return `<section class="report-center-section"><div class="report-center-section-head"><div><h3>${title}</h3>${sub?`<p>${esc(sub)}</p>`:''}</div></div>${html}</section>`;}
  function table(headers,rows,empty='Kayıt bulunamadı.'){if(!rows.length)return `<div class="report-center-empty">${esc(empty)}</div>`;return `<div class="report-center-table-wrap"><table class="report-center-table"><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;}
  function methodologyNote(){return `<div class="report-center-method-note"><b>Metodoloji:</b> Resmî EI yalnız <b>official Assessment Event + EI Snapshot</b> kayıtlarından alınır. Validasyon adayları, taslak/geçici değerlendirmeler ve tüm CAP potansiyeli resmî EI değildir. PQ sürümü/revizyonu veya applicable denominator değiştiğinde EI farkı otomatik olarak yalnız performans artışı kabul edilmez.</div>`;}

  function timelineHtml(m){
    const rows=m.officialRows.filter(r=>state.area==='ALL'||arr(r.scopeAreas||r.snapshot&&r.snapshot.scopeAreas).includes(state.area)||r===m.first);
    return table(['Değerlendirme','Tarih','Tür','Kapsam','Overall EI','PQ Sürümü / Revizyonu'],rows.map(r=>`<tr><td><b>${esc(eventName(r))}</b></td><td>${esc(dateLabel(eventDate(r)))}</td><td>${esc(r.type||'')}</td><td>${esc(arr(r.scopeAreas||r.snapshot&&r.snapshot.scopeAreas).join(', ')||'–')}</td><td><b>${esc(pct(typeof window.getAssessmentMetricValue==='function'?window.getAssessmentMetricValue(r,'Overall'):null))}</b></td><td>${esc([r.pqVersion,r.pqRevision].filter(Boolean).join(' / ')||'–')}</td></tr>`),'Henüz resmî Assessment Event / EI Snapshot kaydı yok.');
  }

  function areaStatusHtml(m){
    return table(['Alan','Etkin resmî EI','Son resmî değerlendirme','CAP PQ','Tamamlanan CAP/PQ','Gecikmiş adım','Validasyon adayı','Aday potansiyeli'],m.areaRows.map(r=>`<tr><td><b>${r.area}</b></td><td>${esc(pct(r.ei))}</td><td>${esc(r.lastName||'–')}<br><small>${esc(dateLabel(r.lastDate))}</small></td><td>${r.capPq}</td><td>${r.capComplete}</td><td class="${r.lateSteps?'danger':''}">${r.lateSteps}</td><td>${r.candidateCount}</td><td>${r.candidatePotential?`+${r.candidatePotential.toFixed(2)} puan`:'–'}</td></tr>`));
  }

  function candidateHtml(m,limit=40){
    const rows=m.candidates.slice().sort((a,b)=>(a.area||'').localeCompare(b.area||'','tr')||String(a.pq||'').localeCompare(String(b.pq||''),'tr',{numeric:true})).slice(0,limit);
    return table(['PQ','Alan','Durum','Kanıt / İç inceleme','Hedef ziyaret','Overall etki','Belge'],rows.map(r=>{const dc=m.docs.filter(d=>String(d.pq||'')===String(r.pq||'')).length;return `<tr><td><b>PQ ${esc(r.pq)}</b>${r.currentPq&&r.currentPq!==r.pq?`<br><small>Aktif: ${esc(r.currentPq)}</small>`:''}</td><td>${esc(r.area)}</td><td>${esc(r.effectiveStatus||'candidate')}</td><td>${r.evidenceComplete?'✅':'⚠️'} ${esc(r.evidencePackageStatus||'')}<br><small>${esc(r.internalReviewStatus||'')}</small></td><td>${esc(r.targetVisitName||'Atanmadı')}</td><td>+${Number(r.overallDelta||0).toFixed(2)}</td><td>${dc}</td></tr>`; }),'Seçili kapsamda validasyon adayı yok.');
  }

  function visitHtml(m,limit=20){
    return table(['Ziyaret','Tür','Alanlar','Planlanan tarih','Durum','Atanmış aday','Belgeler'],m.visits.slice(0,limit).map(v=>{const assigned=m.candidates.filter(r=>String(r.targetVisitId||'')===String(v.id)).length,dc=m.docs.filter(d=>String(d.visitId||'')===String(v.id)).length;return `<tr><td><b>${esc(visitName(v))}</b></td><td>${esc(v.icaoVisitType||v.visitType||'')}</td><td>${esc(arr(v.areas).join(', ')||'–')}</td><td>${esc(dateLabel(v.plannedStart))}${v.plannedEnd?` – ${esc(dateLabel(v.plannedEnd))}`:''}</td><td>${esc(visitStatus(v))}</td><td>${assigned}</td><td>${dc}</td></tr>`;}),'Seçili kapsamda ziyaret yok.');
  }

  function integrityHtml(m){if(!m.integ)return'<div class="report-center-empty">Bütünlük bölümü rapor ayarlarında kapalı.</div>';const issues=arr(m.integ.issues).filter(i=>['critical','high'].includes(i.severity)).slice(0,20);return `<div class="report-center-inline-kpis">${metricCard('Bütünlük skoru',`%${Number(m.integ.score||0).toFixed(1)}`,`${m.integ.issues.length} sorun`)}${metricCard('Kritik',m.integ.severityCounts&&m.integ.severityCounts.critical||0,'bloklayıcı')}${metricCard('Yüksek',m.integ.severityCounts&&m.integ.severityCounts.high||0,'öncelikli')}</div>`+table(['Seviye','Alan','Kayıt','Sorun','Öneri'],issues.map(i=>`<tr><td><b>${esc(String(i.severity||'').toUpperCase())}</b></td><td>${esc(i.domain||'')}</td><td>${esc(i.record||'')}</td><td>${esc(i.problem||'')}</td><td>${esc(i.recommendation||'')}</td></tr>`),'Kritik/yüksek bütünlük sorunu yok.');}

  function documentHtml(m,limit=30){const rows=m.docs.slice(0,limit);return table(['Belge','Tür','Alan','PQ','Ziyaret','Güncelleme'],rows.map(d=>`<tr><td><b>${esc(d.name||d.fileName||'Belge')}</b></td><td>${esc(d.documentType||'')}</td><td>${esc(d.area||'–')}</td><td>${esc(d.pq||'–')}</td><td>${esc(d.visitName||'–')}</td><td>${esc(dateTimeLabel(d.updatedAt||d.createdAt))}</td></tr>`),'Seçili kapsamda Drive doküman metadata kaydı yok.');}

  function validatedPqHtml(m){return table(['Değerlendirme','Tarih','Alan','PQ','Ziyaret','ICAO yorumu'],m.validatedPqs.slice(0,80).map(x=>`<tr><td>${esc(x.assessment)}</td><td>${esc(dateLabel(x.assessmentDate))}</td><td>${esc(x.area)}</td><td><b>${esc(x.pq)}</b></td><td>${esc(x.visitName||'–')}</td><td>${esc(x.comment||'–')}</td></tr>`),'PQ bazlı validasyon izi bulunmuyor; sistem izlenebilir kaynak yoksa PQ değişimi tahmin etmez.');}

  function visitPreparationHtml(m){
    const v=m.selectedVisit||m.visits[0]||null;if(!v)return'<div class="report-center-empty">Hazırlık paketi için hedef ziyaret seçiniz.</div>';
    const c=m.candidates.filter(r=>String(r.targetVisitId||'')===String(v.id));
    const pqs=arr(v.scope&&v.scope.pqs),steps=arr(v.scope&&v.scope.steps),follow=typeof window.getAllVisitFollowUpItems==='function'?window.getAllVisitFollowUpItems().filter(x=>String(x.visitId)===String(v.id)):[],consult=typeof window.getAllVisitConsultationItems==='function'?window.getAllVisitConsultationItems().filter(x=>String(x.visitId)===String(v.id)):[];
    return `<div class="report-center-visit-card"><h3>${esc(visitName(v))}</h3><div><b>Tür:</b> ${esc(v.icaoVisitType||v.visitType||'–')} · <b>Alan:</b> ${esc(arr(v.areas).join(', ')||'–')} · <b>Tarih:</b> ${esc(dateLabel(v.plannedStart))}${v.plannedEnd?` – ${esc(dateLabel(v.plannedEnd))}`:''}</div><div><b>Birim:</b> ${esc(arr(v.units).join(' | ')||'–')}</div><div><b>Amaç:</b> ${esc(v.objective||'–')}</div></div>`+
      `<div class="report-center-inline-kpis">${metricCard('Atanmış aday',c.length,'PQ')}${metricCard('Scope PQ',pqs.length,'snapshot')}${metricCard('CAP adımı',steps.length,'scope snapshot')}${metricCard('Açık takip',follow.filter(x=>x.status!=='completed').length,'kayıt')}${metricCard('Açık danışma',consult.filter(x=>x.status!=='completed').length,'kayıt')}${metricCard('Belge',m.docs.filter(d=>String(d.visitId||'')===String(v.id)).length,'Drive metadata')}</div>`+
      candidateHtml({...m,candidates:c},100)+
      section('Ziyaret Scope PQ / CAP Adımları',table(['PQ','Alan','Durum','Concept','Kaynak'],pqs.map(p=>`<tr><td><b>${esc(p.pq||'')}</b></td><td>${esc(p.area||'')}</td><td>${esc(p.statusLabel||'')}</td><td>${esc(p.pqConceptId||'–')}</td><td>${esc(p.sourceStateLabel||p.sourceState||'–')}</td></tr>`))+table(['PQ','Step','Sorumlu','Hedef','Durum','Kanıt referansı'],steps.slice(0,120).map(s=>`<tr><td>${esc(s.pq||'')}</td><td><b>${esc(s.step||'')}</b></td><td>${esc(s.office||'–')}</td><td>${esc(s.estDate||'–')}</td><td>${esc(s.statusLabel||'')}</td><td>${esc(s.evidenceReference||'–')}</td></tr>`)));
  }

  function executivePreview(m){
    const latest=m.latest,projected=state.includeProjection&&m.projectedEi!==null?pct(m.projectedEi):'Hariç';
    let html=`<div class="report-center-cover"><span>${esc(profile().label)}</span><h2>${esc(state.title||'USOAP CMA Güncel Durum ve Yönetim Brifingi')}</h2><p>Rapor tarihi: ${esc(dateLabel(state.reportDate))} · Kapsam: ${state.area==='ALL'?'Türkiye / 8 Denetim Alanı':esc(state.area)}</p></div>`;
    html+=`<div class="report-center-kpis">${metricCard('İlk resmî EI',pct(m.firstEi),m.first?eventName(m.first):'–')}${metricCard('Güncel resmî EI',pct(m.latestEi),m.latest?`${eventName(m.latest)} · ${dateLabel(eventDate(m.latest))}`:'–','primary')}${metricCard('Toplam değişim',delta(m.overallDelta),'ilk resmî değerlendirmeden beri',m.overallDelta>0?'ok':'')}${metricCard('Validasyon adayı',m.candidates.length,`${m.candidateAssigned.length} atanmış`)}${metricCard('Aday havuzu EI',projected,state.includeProjection?`+${m.candidatePotential.toFixed(2)} puan · resmî değildir`:'projeksiyon hariç','warn')}${metricCard('Gecikmiş CAP adımı',m.cap.lateSteps,`${m.cap.openPq} açık CAP/PQ`,m.cap.lateSteps?'danger':'ok')}</div>`;
    html+=section('Resmî Değerlendirme Zaman Çizgisi',timelineHtml(m));
    html+=section('Alan Bazlı Güncel Durum',areaStatusHtml(m),'Kapsam dışı validasyonlarda alan EI’si yeni değerlendirilmiş sayılmaz; son geçerli resmî değer korunur.');
    if(state.includeProjection)html+=section('Resmî Olmayan Validasyon Projeksiyonu',candidateHtml(m,30),'Bu bölüm resmî EI değildir; CAP tamamlanmış ve ICAO validasyonu bekleyen PQ’ları gösterir.');
    html+=section('Yaklaşan / Açık Ziyaretler',visitHtml({...m,visits:m.upcomingVisits.length?m.upcomingVisits:m.visits},12));
    if(state.includeIntegrity)html+=section('Yönetim İçin Veri Bütünlüğü Uyarıları',integrityHtml(m));
    if(state.notes)html+=section('Yönetici Notu',`<div class="report-center-note">${esc(state.notes).replace(/\n/g,'<br>')}</div>`);
    html+=methodologyNote();return html;
  }

  function icaoPreview(m){
    let html=`<div class="report-center-cover technical"><span>${esc(profile().label)}</span><h2>${esc(state.title||'Türkiye – USOAP CMA Technical Status Package')}</h2><p>Generated: ${esc(dateLabel(state.reportDate))} · Scope: ${state.area==='ALL'?'LEG, ORG, PEL, OPS, AIR, AIG, ANS, AGA':esc(state.area)}</p></div>`;
    html+=`<div class="report-center-kpis">${metricCard('Official Overall EI',pct(m.latestEi),m.latest?eventName(m.latest):'No official snapshot','primary')}${metricCard('Official events',m.officialRows.length,'Assessment Event + Snapshot')}${metricCard('Traceable validated PQ',m.validatedPqs.length,'visit validation records')}${metricCard('Validation candidates',m.candidates.length,`${m.candidateReady.length} ready / ${m.candidateAssigned.length} assigned`)}${metricCard('Drive documents',m.docs.length,'metadata index')}${metricCard('Integrity score',m.integ?`%${Number(m.integ.score||0).toFixed(1)}`:'–',m.integ?`${m.integ.issues.length} issues`:'excluded')}</div>`;
    html+=section('Official Assessment Events & EI Snapshots',timelineHtml(m),'Official records only. Draft/provisional snapshots are listed separately when enabled.');
    html+=section('Effective Area EI & Last Official Assessment',areaStatusHtml(m));
    html+=section('Traceable Validated PQ Changes',validatedPqHtml(m),'Only PQs supported by linked ICAO visit validation records are listed.');
    html+=section('CAP → Validation Readiness',candidateHtml(m,80),'Candidate status and EI impact are non-official until ICAO validation.');
    if(state.includeDraft&&m.pendingAssessments.length)html+=section('Draft / Provisional Assessment Snapshots',table(['Assessment','Date','Status','Scope'],m.pendingAssessments.map(r=>`<tr><td>${esc(eventName(r))}</td><td>${esc(dateLabel(eventDate(r)))}</td><td>${esc(r.resultStatus||r.snapshot&&r.snapshot.resultStatus||'draft')}</td><td>${esc(arr(r.scopeAreas||r.snapshot&&r.snapshot.scopeAreas).join(', ')||'–')}</td></tr>`)));
    if(state.includeDocuments)html+=section('Source / Evidence Document Index',documentHtml(m,60));
    if(state.includeIntegrity)html+=section('Data Integrity & Traceability Checks',integrityHtml(m));
    html+=methodologyNote();return html;
  }

  function validationPreview(m){
    let html=`<div class="report-center-cover validation"><span>${esc(profile().label)}</span><h2>${esc(state.title||'ICAO Validasyon / Ziyaret Hazırlık Paketi')}</h2><p>Rapor tarihi: ${esc(dateLabel(state.reportDate))} · ${m.selectedVisit?`Hedef ziyaret: ${esc(visitName(m.selectedVisit))}`:'Hedef ziyaret seçilmedi'}</p></div>`;
    html+=visitPreparationHtml(m);
    if(state.includeDocuments)html+=section('Kanıt ve Belge İndeksi',documentHtml(m,100),'Drive’daki dosyanın kendisi değil, uygulamadaki metadata ve ilişki indeksi gösterilir.');
    if(state.includeIntegrity)html+=section('Hazırlık Öncesi Bütünlük Kontrolü',integrityHtml(m));
    if(state.notes)html+=section('Hazırlık Notu',`<div class="report-center-note">${esc(state.notes).replace(/\n/g,'<br>')}</div>`);
    html+=methodologyNote();return html;
  }

  function weeklyPreview(m){
    const next=m.upcomingVisits.slice(0,6),over=m.cap.overdue.slice(0,30),recentDocs=m.docs.slice().sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||''))).slice(0,15);
    let html=`<div class="report-center-cover weekly"><span>${esc(profile().label)}</span><h2>${esc(state.title||'USOAP CMA Haftalık İç Yönetim Takibi')}</h2><p>Rapor tarihi: ${esc(dateLabel(state.reportDate))} · Kapsam: ${state.area==='ALL'?'Tüm alanlar':esc(state.area)}</p></div>`;
    html+=`<div class="report-center-kpis">${metricCard('Açık CAP/PQ',m.cap.openPq,`${m.cap.completedPq} tamamlandı`)}${metricCard('Gecikmiş adım',m.cap.lateSteps,`${over.length} riskli PQ`,m.cap.lateSteps?'danger':'ok')}${metricCard('Validasyon adayı',m.candidates.length,`${m.candidateReady.length} hazır`)}${metricCard('Atanmış aday',m.candidateAssigned.length,'hedef ziyaret')}${metricCard('Yaklaşan ziyaret',next.length,'planlı')}${metricCard('Bütünlük',m.integ?`%${Number(m.integ.score||0).toFixed(1)}`:'–',m.integ?`${m.integ.issues.length} sorun`:'hariç')}</div>`;
    html+=section('Gecikme / Kritik CAP Listesi',table(['PQ','Alan','CE','Sorumlu','Gecikmiş adım','Tamamlanma'],over.map(x=>`<tr><td><b>${esc(x.pq)}</b></td><td>${esc(x.area||'')}</td><td>${esc(x.ce||'')}</td><td>${esc(x.owner||'–')}</td><td class="danger">${x.late}</td><td>${x.done}/${x.steps}</td></tr>`),'Gecikmiş CAP adımı yok.'));
    html+=section('Validasyon Hazırlığı',candidateHtml(m,40));
    html+=section('Yaklaşan Ziyaretler',visitHtml({...m,visits:next},20));
    if(state.includeIntegrity)html+=section('Veri Kalitesi / Bütünlük',integrityHtml(m));
    if(state.includeDocuments)html+=section('Son Güncellenen Belgeler',documentHtml({...m,docs:recentDocs},15));
    if(state.notes)html+=section('Haftalık Yönetim Notu',`<div class="report-center-note">${esc(state.notes).replace(/\n/g,'<br>')}</div>`);
    return html;
  }

  function previewHtml(m){if(state.profile==='icao')return icaoPreview(m);if(state.profile==='validation')return validationPreview(m);if(state.profile==='weekly')return weeklyPreview(m);return executivePreview(m);}

  function syncControls(m){
    const set=(id,val)=>{const e=document.getElementById(id);if(e&&document.activeElement!==e)e.value=val??'';};
    set('reportCenterDate',state.reportDate);set('reportCenterTitle',state.title);set('managementNotes',state.notes);set('reportCenterArea',state.area);
    ['reportCenterIncludeDraft','reportCenterIncludeProjection','reportCenterIncludeIntegrity','reportCenterIncludeDocuments'].forEach(id=>{const e=document.getElementById(id);if(e)e.checked=!!state[({reportCenterIncludeDraft:'includeDraft',reportCenterIncludeProjection:'includeProjection',reportCenterIncludeIntegrity:'includeIntegrity',reportCenterIncludeDocuments:'includeDocuments'})[id]];});
    const visit=document.getElementById('reportCenterVisit');if(visit){const current=state.visitId;const opts=(source().visits||[]).filter(v=>!v.isDeleted).filter(v=>state.area==='ALL'||arr(v.areas).includes(state.area)).sort((a,b)=>String(a.plannedStart||'').localeCompare(String(b.plannedStart||'')));visit.innerHTML='<option value="">Ziyaret seçilmedi / tümü</option>'+opts.map(v=>`<option value="${esc(v.id)}">${esc(visitName(v))} · ${esc(dateLabel(v.plannedStart))}</option>`).join('');visit.value=opts.some(v=>String(v.id)===state.visitId)?state.visitId:'';if(!visit.value&&state.visitId){state.visitId='';saveState();}}
    document.querySelectorAll('[data-report-profile]').forEach(b=>b.classList.toggle('active',b.dataset.reportProfile===state.profile));
    const desc=document.getElementById('reportCenterProfileDescription');if(desc)desc.textContent=profile().description;
  }

  function render(){
    const root=document.getElementById('reportCenterRoot');if(!root)return;
    lastModel=buildModel();syncControls(lastModel);
    const preview=document.getElementById('reportPreview');if(preview)preview.innerHTML=previewHtml(lastModel);
    const generated=document.getElementById('reportCenterGeneratedAt');if(generated)generated.textContent=`Son üretim: ${new Date(lastModel.generatedAt).toLocaleString('tr-TR')} · ${profile().short}`;
  }

  function readControls(){
    const v=id=>((document.getElementById(id)||{}).value||'');
    const c=id=>!!((document.getElementById(id)||{}).checked);
    state.reportDate=v('reportCenterDate')||new Date().toISOString().slice(0,10);state.title=v('reportCenterTitle');state.notes=v('managementNotes');state.area=v('reportCenterArea')||'ALL';state.visitId=v('reportCenterVisit');state.includeDraft=c('reportCenterIncludeDraft');state.includeProjection=c('reportCenterIncludeProjection');state.includeIntegrity=c('reportCenterIncludeIntegrity');state.includeDocuments=c('reportCenterIncludeDocuments');saveState();render();
  }

  function setProfile(key){if(!PROFILES[key])return;state.profile=key;if(key==='icao')state.includeDraft=true;if(key==='validation')state.includeDocuments=true;saveState();render();}
  function clearSettings(){state={profile:'executive',area:'ALL',visitId:'',includeDraft:false,includeProjection:true,includeIntegrity:true,includeDocuments:true,reportDate:new Date().toISOString().slice(0,10),title:'',notes:''};saveState();render();}

  function stripHtml(html){const d=document.createElement('div');d.innerHTML=html;return (d.innerText||d.textContent||'').replace(/\n{3,}/g,'\n\n').trim();}
  async function copyText(){const m=lastModel||buildModel(),txt=stripHtml(previewHtml(m));try{await navigator.clipboard.writeText(txt);alert('Rapor metni panoya kopyalandı.');}catch(_){const ta=document.createElement('textarea');ta.value=txt;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();alert('Rapor metni panoya kopyalandı.');}}

  function sheetAdd(wb,name,rows){const safe=(rows&&rows.length)?rows:[{'Bilgi':'Kayıt bulunamadı.'}];XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(safe),name.slice(0,31));}
  function contextRows(m){return [
    {'Alan':'Rapor Profili','Değer':profile().label},{'Alan':'Rapor Tarihi','Değer':state.reportDate},{'Alan':'Kapsam','Değer':state.area==='ALL'?'Tüm alanlar':state.area},{'Alan':'Hedef Ziyaret','Değer':m.selectedVisit?visitName(m.selectedVisit):'–'},
    {'Alan':'Güncel Resmî EI','Değer':m.latestEi},{'Alan':'Son Resmî Değerlendirme','Değer':m.latest?eventName(m.latest):'–'},{'Alan':'Son Resmî Değerlendirme Tarihi','Değer':m.latest?eventDate(m.latest):'–'},
    {'Alan':'Validasyon Adayı','Değer':m.candidates.length},{'Alan':'Aday EI Potansiyeli','Değer':m.candidatePotential},{'Alan':'Projeksiyon Resmî mi?','Değer':'Hayır'},
    {'Alan':'Modül Sürümü','Değer':MODULE_VERSION},{'Alan':'Üretim Zamanı','Değer':m.generatedAt}
  ];}
  function timelineRows(m){return m.officialRows.map(r=>({'Değerlendirme':eventName(r),'Tarih':eventDate(r),'Tür':r.type||'','Statü':r.resultStatus||'official','Kapsam':arr(r.scopeAreas||r.snapshot&&r.snapshot.scopeAreas).join(', '),'Overall EI':typeof window.getAssessmentMetricValue==='function'?window.getAssessmentMetricValue(r,'Overall'):null,'Satisfactory':r.snapshot&&r.snapshot.overall&&r.snapshot.overall.satisfactory,'Applicable':r.snapshot&&r.snapshot.overall&&r.snapshot.overall.applicable,'PQ Sürümü':r.pqVersion||'','PQ Revizyonu':r.pqRevision||''}));}
  function areaRowsExport(m){return m.areaRows.map(r=>({'Alan':r.area,'Etkin Resmî EI':r.ei,'Son Resmî Değerlendirme':r.lastName,'Son Resmî Tarih':r.lastDate,'CAP PQ':r.capPq,'Tamamlanan CAP/PQ':r.capComplete,'Gecikmiş Adım':r.lateSteps,'Validasyon Adayı':r.candidateCount,'Aday Alan EI Potansiyeli':r.candidatePotential}));}
  function candidateRowsExport(m){return m.candidates.map(r=>({'PQ':r.pq,'Aktif PQ':r.currentPq||r.pq,'Alan':r.area,'PQ Concept':r.pqConceptId||'','Durum':r.effectiveStatus||'candidate','Kanıt Tam':r.evidenceComplete?'Evet':'Hayır','Kanıt Paketi':r.evidencePackageStatus||'','İç İnceleme':r.internalReviewStatus||'','Hedef Ziyaret':r.targetVisitName||'','Overall EI Etkisi':r.overallDelta||0,'Alan EI Etkisi':r.areaDelta||0,'Not':r.notes||''}));}
  function visitRowsExport(m){return m.visits.map(v=>({'Ziyaret':visitName(v),'Tür':v.icaoVisitType||v.visitType||'','Alanlar':arr(v.areas).join(', '),'Birimler':arr(v.units).join(' | '),'Planlanan Başlangıç':v.plannedStart||'','Planlanan Bitiş':v.plannedEnd||'','Durum':visitStatus(v),'Amaç':v.objective||'','Atanmış Aday':m.candidates.filter(r=>String(r.targetVisitId||'')===String(v.id)).length,'Belge':m.docs.filter(d=>String(d.visitId||'')===String(v.id)).length}));}
  function docRowsExport(m){return m.docs.map(d=>({'Belge':d.name||d.fileName||'','Tür':d.documentType||'','Alan':d.area||'','PQ':d.pq||'','CAP Step':d.capStep||'','Ziyaret':d.visitName||'','Drive File ID':d.driveFileId||d.fileId||'','Drive Bağlantısı':d.webViewLink||'','Güncelleme':d.updatedAt||d.createdAt||''}));}
  function integrityRowsExport(m){return m.integ?arr(m.integ.issues).map(i=>({'Seviye':i.severity,'Alan':i.domain,'Kayıt':i.record,'Sorun':i.problem,'Mevcut':i.current||'','Öneri':i.recommendation||''})):[];}
  function capRowsExport(m){return m.cap.pqRows.map(x=>({'PQ':x.pq,'Alan':x.area,'CE':x.ce,'Sorumlu':x.owner,'CAP Adımı':x.steps,'Tamamlanan Adım':x.done,'Gecikmiş Adım':x.late,'PQ CAP Tamamlandı mı':x.complete?'Evet':'Hayır'}));}
  function validatedRowsExport(m){return m.validatedPqs.map(x=>({'Değerlendirme':x.assessment,'Değerlendirme Tarihi':x.assessmentDate,'Alan':x.area,'PQ':x.pq,'Ziyaret':x.visitName||'','Sonuç Tarihi':x.resultDate||'','ICAO Yorumu':x.comment||''}));}

  function exportExcel(){if(typeof XLSX==='undefined')return alert('Excel kütüphanesi yüklenemedi.');const m=buildModel(),wb=XLSX.utils.book_new();sheetAdd(wb,'Rapor_Baglamı',contextRows(m));sheetAdd(wb,'Resmi_EI_Tarihcesi',timelineRows(m));sheetAdd(wb,'Alan_Durumu',areaRowsExport(m));
    if(state.profile==='executive'){sheetAdd(wb,'CAP_Ozeti',capRowsExport(m));sheetAdd(wb,'Validasyon_Adaylari',candidateRowsExport(m));sheetAdd(wb,'Ziyaretler',visitRowsExport(m));}
    if(state.profile==='icao'){sheetAdd(wb,'Valide_PQ_Izi',validatedRowsExport(m));sheetAdd(wb,'CAP_Ozeti',capRowsExport(m));sheetAdd(wb,'Validasyon_Adaylari',candidateRowsExport(m));sheetAdd(wb,'Ziyaretler',visitRowsExport(m));if(state.includeDocuments)sheetAdd(wb,'Dokuman_Indeksi',docRowsExport(m));if(state.includeIntegrity)sheetAdd(wb,'Butunluk_Sorunlari',integrityRowsExport(m));if(state.includeDraft)sheetAdd(wb,'Taslak_Gecici',m.pendingAssessments.map(r=>({'Değerlendirme':eventName(r),'Tarih':eventDate(r),'Statü':r.resultStatus||r.snapshot&&r.snapshot.resultStatus||'draft'})));}
    if(state.profile==='validation'){sheetAdd(wb,'Validasyon_Adaylari',candidateRowsExport(m));sheetAdd(wb,'Hedef_Ziyaret',visitRowsExport({...m,visits:m.selectedVisit?[m.selectedVisit]:m.visits}));if(m.selectedVisit){sheetAdd(wb,'Ziyaret_Scope_PQ',arr(m.selectedVisit.scope&&m.selectedVisit.scope.pqs));sheetAdd(wb,'Ziyaret_CAP_Adimlari',arr(m.selectedVisit.scope&&m.selectedVisit.scope.steps));}if(state.includeDocuments)sheetAdd(wb,'Dokuman_Indeksi',docRowsExport(m));if(state.includeIntegrity)sheetAdd(wb,'Butunluk_Sorunlari',integrityRowsExport(m));}
    if(state.profile==='weekly'){sheetAdd(wb,'CAP_Takip',capRowsExport(m));sheetAdd(wb,'Validasyon_Adaylari',candidateRowsExport(m));sheetAdd(wb,'Ziyaretler',visitRowsExport(m));if(state.includeIntegrity)sheetAdd(wb,'Butunluk_Sorunlari',integrityRowsExport(m));if(state.includeDocuments)sheetAdd(wb,'Son_Dokumanlar',docRowsExport(m).slice(0,50));}
    const name=`USOAP_${state.profile}_${state.reportDate||new Date().toISOString().slice(0,10)}.xlsx`;XLSX.writeFile(wb,name);}

  function pdfTable(headers,rows,widths){const body=[headers.map(h=>({text:h,bold:true,fillColor:'#f1f5f9'}))].concat(rows);return{table:{headerRows:1,widths:widths||headers.map(()=>'*'),body},layout:'lightHorizontalLines',margin:[0,0,0,10]};}
  function pdfModel(m){
    const content=[{text:state.title||profile().label,style:'header'},{text:`Rapor tarihi: ${dateLabel(state.reportDate)} | Kapsam: ${state.area==='ALL'?'Tüm alanlar':state.area}${m.selectedVisit?' | Hedef ziyaret: '+visitName(m.selectedVisit):''}`,style:'subheader'}];
    const kpis=[['Güncel resmî EI',pct(m.latestEi)],['Toplam değişim',delta(m.overallDelta)],['Validasyon adayı',String(m.candidates.length)],['Atanmış aday',String(m.candidateAssigned.length)],['Gecikmiş CAP adımı',String(m.cap.lateSteps)],['Bütünlük',m.integ?`%${Number(m.integ.score||0).toFixed(1)}`:'–']];
    content.push({table:{widths:['*','*','*'],body:[kpis.slice(0,3).map(x=>({text:[{text:x[0]+'\n',fontSize:8,color:'#64748b'},{text:x[1],bold:true,fontSize:13}]})),kpis.slice(3,6).map(x=>({text:[{text:x[0]+'\n',fontSize:8,color:'#64748b'},{text:x[1],bold:true,fontSize:13}]}))]},layout:'lightHorizontalLines',margin:[0,0,0,10]});
    content.push({text:'Resmî EI Zaman Çizgisi',style:'sectionHeader'},pdfTable(['Değerlendirme','Tarih','Kapsam','Overall EI'],m.officialRows.map(r=>[eventName(r),dateLabel(eventDate(r)),arr(r.scopeAreas||r.snapshot&&r.snapshot.scopeAreas).join(', ')||'–',pct(typeof window.getAssessmentMetricValue==='function'?window.getAssessmentMetricValue(r,'Overall'):null)]),['*','auto','*','auto']));
    if(state.profile==='executive'||state.profile==='icao')content.push({text:'Alan Bazlı Durum',style:'sectionHeader'},pdfTable(['Alan','Resmî EI','Son Değerlendirme','CAP','Gecikmiş','Aday'],m.areaRows.map(r=>[r.area,pct(r.ei),`${r.lastName||'–'}\n${dateLabel(r.lastDate)}`,`${r.capComplete}/${r.capPq}`,String(r.lateSteps),String(r.candidateCount)]),['auto','auto','*','auto','auto','auto']));
    if(state.profile==='validation'){const v=m.selectedVisit||m.visits[0]||null;content.push({text:'Hedef Ziyaret',style:'sectionHeader'},{text:v?`${visitName(v)} | ${arr(v.areas).join(', ')} | ${dateLabel(v.plannedStart)}${v.plannedEnd?' – '+dateLabel(v.plannedEnd):''}`:'Hedef ziyaret seçilmedi.',margin:[0,0,0,6]});}
    if(state.profile!=='weekly'||m.candidates.length)content.push({text:'Validasyon Adayları',style:'sectionHeader'},pdfTable(['PQ','Alan','Durum','Hedef Ziyaret','Overall Etki'],m.candidates.slice(0,80).map(r=>[`PQ ${r.pq}`,r.area,r.effectiveStatus||'candidate',r.targetVisitName||'Atanmadı',`+${Number(r.overallDelta||0).toFixed(2)}`]),['auto','auto','auto','*','auto']));
    if(state.profile==='weekly')content.push({text:'Gecikmiş CAP/PQ',style:'sectionHeader'},pdfTable(['PQ','Alan','Sorumlu','Gecikmiş','Tamamlanma'],m.cap.overdue.slice(0,50).map(x=>[x.pq,x.area,x.owner||'–',String(x.late),`${x.done}/${x.steps}`]),['auto','auto','*','auto','auto']));
    if(state.profile==='icao')content.push({text:'İzlenebilir Valide PQ',style:'sectionHeader'},pdfTable(['Değerlendirme','Alan','PQ','Ziyaret'],m.validatedPqs.slice(0,80).map(x=>[x.assessment,x.area,x.pq,x.visitName||'–']),['*','auto','auto','*']));
    if(state.includeIntegrity&&m.integ){const issues=arr(m.integ.issues).filter(i=>['critical','high'].includes(i.severity)).slice(0,30);content.push({text:'Veri Bütünlüğü',style:'sectionHeader'},pdfTable(['Seviye','Alan','Kayıt','Sorun'],issues.map(i=>[String(i.severity).toUpperCase(),i.domain,i.record,i.problem]),['auto','auto','*','2*']));}
    if(state.includeDocuments&&['icao','validation'].includes(state.profile))content.push({text:'Doküman / Kanıt İndeksi',style:'sectionHeader'},pdfTable(['Belge','Tür','Alan','PQ','Ziyaret'],m.docs.slice(0,60).map(d=>[d.name||d.fileName||'Belge',d.documentType||'',d.area||'–',d.pq||'–',d.visitName||'–']),['2*','*','auto','auto','*']));
    if(state.notes)content.push({text:'Rapor Notu',style:'sectionHeader'},{text:state.notes,margin:[0,0,0,8]});
    content.push({text:'Metodoloji Notu',style:'sectionHeader'},{text:'Resmî EI yalnız official Assessment Event + EI Snapshot kayıtlarından alınır. Validasyon adayları, taslak/geçici değerlendirmeler ve tüm CAP potansiyeli resmî EI değildir. PQ sürümü/revizyonu veya applicable denominator değiştiğinde EI farkı otomatik olarak yalnız performans artışı kabul edilmez.',fontSize:8,color:'#475569'});
    return{pageOrientation:'landscape',pageSize:'A4',content,footer:(c,n)=>({text:`${c} / ${n}`,alignment:'right',margin:[0,0,24,0],fontSize:8,color:'#64748b'}),styles:{header:{fontSize:17,bold:true,color:'#1d4ed8',margin:[0,0,0,4]},subheader:{fontSize:9,color:'#64748b',margin:[0,0,0,10]},sectionHeader:{fontSize:11,bold:true,color:'#0f172a',margin:[0,9,0,5]}},defaultStyle:{font:'Roboto',fontSize:8}};
  }
  function exportPDF(){if(typeof pdfMake==='undefined')return alert('PDF kütüphanesi yüklenemedi.');const m=buildModel(),def=pdfModel(m),name=`USOAP_${state.profile}_${state.reportDate||new Date().toISOString().slice(0,10)}.pdf`;try{if(typeof window.safeDownloadPdf==='function')window.safeDownloadPdf(def,name);else pdfMake.createPdf(def).download(name);}catch(e){console.error(e);alert('Rapor PDF oluşturulamadı: '+(e.message||e));}}

  function runSelfCheck(){const m=buildModel();const result={passed:!!document.getElementById('reportCenterRoot')&&typeof window.getAssessmentImpactModel==='function'&&typeof window.getValidationCandidateRows==='function',moduleVersion:MODULE_VERSION,profile:state.profile,officialEvents:m.officialRows.length,candidates:m.candidates.length,visits:m.visits.length,documents:m.docs.length,integrityScore:m.integ?m.integ.score:null};console.log('Reporting center self-check:',result);return result;}

  window.renderReportingCenter=render;
  window.setReportingProfile=setProfile;
  window.refreshReportingCenter=readControls;
  window.resetReportingCenter=clearSettings;
  window.copyReportingCenterText=copyText;
  window.exportReportingCenterExcel=exportExcel;
  window.exportReportingCenterPDF=exportPDF;
  window.runReportingCenterSelfCheck=runSelfCheck;
  window.getReportingCenterModel=()=>lastModel||buildModel();

  loadState();
  document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{if(document.getElementById('tab-report')&&document.getElementById('tab-report').classList.contains('active'))render();},0));
})();
