// USOAP CMA cross-module system integrity center
// Phase 8 v11: PQ -> CAP -> Validation -> Visit -> Assessment/EI consistency checks
(function(){
  'use strict';
  const MODULE_VERSION='system-integrity-v11';
  const AREAS=['LEG','ORG','PEL','OPS','AIR','AIG','ANS','AGA'];
  const SEVERITIES={
    critical:{label:'Kritik',weight:4},
    high:{label:'Yüksek',weight:3},
    medium:{label:'Orta',weight:2},
    low:{label:'Düşük / Kontrol',weight:1}
  };
  const DOMAINS={
    pq:{label:'PQ Master',icon:'📚'},
    cap:{label:'CAP ↔ PQ',icon:'🔗'},
    validation:{label:'Validasyon',icon:'🎯'},
    visit:{label:'Ziyaret',icon:'🧭'},
    ei:{label:'Assessment / EI',icon:'📈'}
  };
  let lastModel=null;
  let pqLoadRequested=false;

  const text=v=>String(v===undefined||v===null?'':v).trim();
  const esc=v=>typeof window.escapeHtml==='function'?window.escapeHtml(String(v??'')):String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const arr=v=>Array.isArray(v)?v:[];
  const obj=v=>v&&typeof v==='object'?v:{};
  const uniq=v=>Array.from(new Set(v));
  const isOfficialVisit=v=>typeof window.isIcaoOfficialVisit==='function'?window.isIcaoOfficialVisit(v):String(v&&v.visitType||'')==='icao_official';
  const getSource=()=>typeof window.getSystemIntegritySourceSnapshot==='function'?window.getSystemIntegritySourceSnapshot():{rawData:[],pqMasterData:{},visits:[]};
  const getLibrary=()=>typeof window.getIcaoPqLibrarySnapshot==='function'?window.getIcaoPqLibrarySnapshot():{editions:{},activeByArea:{}};
  const getCandidates=()=>typeof window.getValidationCandidateRows==='function'?window.getValidationCandidateRows():[];
  const getAssessmentRows=()=>typeof window.getAssessmentTimelineWithSnapshots==='function'?window.getAssessmentTimelineWithSnapshots({includePassive:true}):[];

  function issueId(domain,code,record){return [domain,code,text(record)].join('::').replace(/[^A-Za-z0-9_:.\-]/g,'_');}
  function buildSystemIntegrityModel(options={}){
    const source=getSource(), raw=arr(source.rawData), master=obj(source.pqMasterData), visits=arr(source.visits).filter(v=>v&&!v.isDeleted), library=obj(getLibrary());
    const editions=obj(library.editions), activeByArea=obj(library.activeByArea), candidates=arr(getCandidates()), assessments=arr(getAssessmentRows());
    const officialRecords=Object.entries(obj(window.icaoOfficialEiRecords)).map(([id,r])=>({id,...obj(r)})).filter(r=>!r.isDeleted);
    const eventStore=obj(window.icaoAssessmentEvents), snapshotStore=obj(window.icaoEiSnapshots);
    const issues=[], checks=[];
    const seen=new Set();
    function addIssue(domain,severity,code,record,problem,current,recommendation,action={}){
      const id=issueId(domain,code,record); if(seen.has(id))return; seen.add(id);
      issues.push({id,domain,severity,code,record:text(record)||'-',problem:text(problem),current:text(current),recommendation:text(recommendation),action});
    }
    function addCheck(domain,code,label,ok,detail){checks.push({domain,code,label,ok:!!ok,detail:text(detail)});}

    // PQ master / version integrity
    const areaRecords={}; AREAS.forEach(a=>areaRecords[a]=[]);
    Object.entries(editions).forEach(([editionKey,edition])=>{
      Object.entries(obj(edition&&edition.areas)).forEach(([area,areaData])=>{
        const a=text(area).toUpperCase(); if(areaRecords[a])areaRecords[a].push({editionKey,edition:obj(edition),areaData:obj(areaData)});
      });
    });
    const pqLoaded=typeof window.isIcaoPqLibraryLoaded==='function'?window.isIcaoPqLibraryLoaded():Object.keys(editions).length>0;
    const libraryLoaded=Object.keys(editions).length>0;
    addCheck('pq','library-loaded','PQ veri tabanı yüklü',pqLoaded&&libraryLoaded,pqLoaded?(libraryLoaded?`${Object.keys(editions).length} sürüm/revizyon kaydı`:'PQ veri tabanı yüklendi ancak kayıt bulunmuyor.'):'PQ veri tabanı henüz Firebase/cache üzerinden okunmadı.');
    if(!pqLoaded){
      addIssue('pq','medium','library-not-loaded','PQ Veri Tabanı','PQ veri tabanı henüz bu oturumda yüklenmedi.','Bekleniyor','Veri Kalitesi ekranı PQ veri tabanını otomatik yükleyecek; bağlantı tamamlandıktan sonra kontrolü yenileyin.',{route:'pq-versions',label:'PQ Veri Tabanını Aç'});
    }
    if(pqLoaded)AREAS.forEach(area=>{
      const records=areaRecords[area]||[];
      if(!records.length){
        addIssue('pq','high','area-missing',area,`${area} için PQ sürüm kaydı bulunmuyor.`,'Kayıt yok','İlgili alanın güncel ICAO PQ Word belgesini PQ Veri Tabanına yükleyin.',{route:'pq-versions',label:'PQ Veri Tabanı'});
        addCheck('pq',`area-${area}`,`${area} PQ kaydı`,false,'Sürüm kaydı yok'); return;
      }
      const active=obj(activeByArea[area]);
      if(!active.editionKey){
        addIssue('pq','critical','active-missing',area,`${area} için aktif PQ sürümü/revizyonu seçilmemiş.`,`${records.length} sürüm kaydı mevcut`,'PQ Veri Tabanında uygun sürümü “Aktif Yap” ile işaretleyin.',{route:'pq-versions',label:'Aktif Sürümü Seç'});
        addCheck('pq',`active-${area}`,`${area} aktif sürüm`,false,'Aktif kayıt yok'); return;
      }
      const edition=obj(editions[active.editionKey]), activeArea=obj(obj(edition.areas)[area]);
      if(!Object.keys(activeArea).length){
        addIssue('pq','critical','active-stale',area,`${area} aktif sürüm referansı artık mevcut olmayan bir kayda işaret ediyor.`,active.editionKey,'Aktif sürüm bilgisini mevcut bir sürüme yeniden bağlayın.',{route:'pq-versions',label:'Aktif Referansı Düzelt'});
        addCheck('pq',`active-${area}`,`${area} aktif sürüm`,false,`Geçersiz referans: ${active.editionKey}`); return;
      }
      const pqs=Object.values(obj(activeArea.pqs)).filter(Boolean);
      if(!pqs.length)addIssue('pq','high','active-empty',area,`${area} aktif PQ kaydı boş.`,active.editionKey,'Kaynak Word belgesini yeniden içe aktarın veya doğru sürümü aktif yapın.',{route:'pq-versions',label:'PQ Veri Tabanı'});
      const missingLineage=pqs.filter(p=>!text(p.instanceId)||!text(p.conceptId)).length;
      if(missingLineage)addIssue('pq','high','lineage-missing',area,`${area} aktif sürümünde ${missingLineage} PQ için Instance/Concept kimliği eksik.`,`${pqs.length} PQ içinde ${missingLineage} eksik`,'CAP ↔ PQ Bağlantıları ekranından Firebase Lineage İndeksini Yeniden Kur işlemini çalıştırın.',{route:'pq-linkage',label:'Lineage İndeksini Aç'});
      addCheck('pq',`active-${area}`,`${area} aktif sürüm`,pqs.length>0&&!missingLineage,`Aktif: ${active.editionKey} · ${pqs.length} PQ${missingLineage?` · ${missingLineage} lineage eksik`:''}`);
    });

    // CAP -> PQ linkage integrity
    const uniquePqs=uniq(raw.map(r=>text(r&&r.pq)).filter(Boolean));
    const rawByPq=new Map(); raw.forEach(r=>{const pq=text(r&&r.pq);if(pq&&!rawByPq.has(pq))rawByPq.set(pq,r);});
    let linked=0,unmatched=0,ambiguous=0;
    if(pqLoaded) uniquePqs.forEach(pq=>{
      const m=obj(master[pq]), row=obj(rawByPq.get(pq)), link=obj(m.pqLink||row.pqLink);
      const status=text(link.status||m.pqLinkStatus||row.pqLinkStatus||'unmatched');
      const area=text(m.alan||row.area).toUpperCase();
      if(status==='linked')linked++; else if(status==='ambiguous')ambiguous++; else unmatched++;
      if(status==='unmatched'||!status){
        addIssue('cap','critical','cap-unmatched',`${area||'?'} PQ ${pq}`,`CAP kaydının aktif PQ veri tabanında kalıcı karşılığı bulunamadı.`,link.reason||'Eşleşme yok','PQ alanını/numarasını ve sürüm lineage kaydını kontrol edin; ardından bağlantı indeksini yeniden kurun.',{route:'pq-linkage',label:'CAP ↔ PQ Bağlantıları'});
      }else if(status==='ambiguous'){
        addIssue('cap','high','cap-ambiguous',`${area||'?'} PQ ${pq}`,`CAP için birden fazla aktif ardıl PQ bulundu.`,link.reason||'Belirsiz ardıl','2020→2024 amendment ilişkisini manuel doğrulayın ve PQ Concept lineage kaydını netleştirin.',{route:'pq-linkage',label:'Belirsiz Bağlantıyı İncele'});
      }else if(status==='linked'&&(!obj(link.sourcePqRef).instanceId||!obj(link.currentPqRef).instanceId)){
        addIssue('cap','high','cap-ref-incomplete',`${area||'?'} PQ ${pq}`,'Kalıcı bağlantı “linked” görünüyor ancak kaynak/aktif PQ Instance referansı eksik.',`Concept: ${text(link.pqConceptId)||'-'}`,'Lineage indeksini yeniden kurun ve bağlantının kaynak/aktif Instance kimliklerini doğrulayın.',{route:'pq-linkage',label:'Bağlantıyı Yenile'});
      }
    });
    addCheck('cap','cap-linkage','CAP ↔ PQ kalıcı bağlantıları',pqLoaded&&(uniquePqs.length===0||(!unmatched&&!ambiguous)),pqLoaded?`${uniquePqs.length} CAP PQ · ${linked} bağlı · ${unmatched} eşleşmeyen · ${ambiguous} belirsiz`:'PQ veri tabanı yüklenmeden kalıcı bağlantılar doğrulanmadı.');

    // Validation readiness / assignment integrity
    const visitById=new Map(visits.map(v=>[String(v.id),v]));
    candidates.forEach(c=>{
      const label=`${c.area||'?'} PQ ${c.pq||'?'}`;
      const link=obj(c.link);
      if(['ready','assigned'].includes(c.effectiveStatus)&&link.status!=='linked'){
        addIssue('validation','high','ready-link',label,`Aday ${c.effectiveStatus==='assigned'?'ziyarete atanmış':'hazır'} ancak PQ kalıcı bağlantısı sağlıklı değil.`,link.status||'Bağlantı yok','Önce CAP ↔ PQ bağlantısını düzeltin; daha sonra validasyon hazırlık durumunu yeniden doğrulayın.',{route:'validation',label:'Validasyon Adayını Aç'});
      }
      if(['ready','assigned'].includes(c.effectiveStatus)&&!c.evidenceComplete){
        addIssue('validation','high','ready-evidence',label,'Validasyon adayı hazır/atanmış görünmesine rağmen tüm CAP adımlarında kanıt referansı yok.',`${c.evidenceCount||0}/${c.capSteps||0} kanıt referansı`,'Eksik CAP adımlarına kanıt referanslarını ekleyin ve kanıt paketini yeniden inceleyin.',{route:'validation',label:'Hazırlığı İncele'});
      }
      if(['ready','assigned'].includes(c.effectiveStatus)&&!['ready','not_required'].includes(c.internalReviewStatus)){
        addIssue('validation','medium','ready-review',label,'Validasyon adayı hazır/atanmış ancak iç inceleme tamamlanmamış.',c.internalReviewStatus||'Bekliyor','İç uygunluk incelemesini tamamlayın veya gerekmediğini gerekçesiyle işaretleyin.',{route:'validation',label:'İç İncelemeyi Aç'});
      }
      if(c.targetVisitId){
        const v=visitById.get(String(c.targetVisitId));
        if(!v){
          addIssue('validation','critical','orphan-target',label,'Validasyon adayı artık mevcut olmayan bir hedef ziyarete bağlı.',c.targetVisitId,'Adayı geçerli bir ICAO ziyaretine yeniden atayın veya hedef atamasını kaldırın.',{route:'validation',label:'Hedef Ziyareti Düzelt'});
        }else{
          if(!isOfficialVisit(v))addIssue('validation','high','target-not-official',label,'Validasyon adayı ICAO resmî ziyareti olmayan bir kayda atanmış.',v.visitName||v.id,'Hedef ziyareti ICAO Resmî Ziyareti olarak düzeltin veya adayı uygun ICAO ziyaretine taşıyın.',{route:'visit',visitId:v.id,label:'Ziyareti Aç'});
          const vAreas=arr(v.areas).map(x=>text(x).toUpperCase());
          if(c.area&&!vAreas.includes(c.area))addIssue('validation','high','target-area-mismatch',label,'Validasyon adayının denetim alanı hedef ziyaret kapsamına dahil değil.',`${v.visitName||v.id} · kapsam: ${vAreas.join(', ')||'-'}`,'Ziyaret kapsamına ilgili alanı ekleyin veya adayı başka ziyarete atayın.',{route:'visit',visitId:v.id,label:'Ziyareti Aç'});
          const scopePqs=arr(obj(v.scope).pqs);
          const inScope=scopePqs.some(p=>text(p.validationCandidateKey)===text(c.key)||text(p.pq)===text(c.pq)||text(p.pqConceptId)===text(c.pqConceptId));
          if(!inScope)addIssue('validation','high','assignment-scope-missing',label,'Aday hedef ziyarete atanmış ancak ziyaret PQ scope snapshot’ında bulunmuyor.',v.visitName||v.id,'Adayı yeniden kaydedip ziyaret scope senkronizasyonunu çalıştırın.',{route:'visit',visitId:v.id,label:'Ziyaret Kapsamını Aç'});
        }
      }
    });
    addCheck('validation','validation-readiness','Validasyon hazırlığı ilişkileri',!issues.some(i=>i.domain==='validation'&&['critical','high'].includes(i.severity)),`${candidates.length} otomatik validasyon adayı kontrol edildi.`);

    // Visit scope and lineage integrity
    visits.forEach(v=>{
      const scopePqs=arr(obj(v.scope).pqs), assignmentMap=obj(v.validationCandidateAssignments);
      if(scopePqs.length){
        const missingConcept=scopePqs.filter(p=>!text(p.pqConceptId)).length;
        const missingInstance=scopePqs.filter(p=>!obj(p.sourcePqRef).instanceId||!obj(p.currentPqRef).instanceId).length;
        if(missingConcept||missingInstance)addIssue('visit','medium','scope-lineage',v.visitName||v.id,'Ziyaret scope snapshot’ındaki bazı PQ kayıtlarında sürümler arası lineage bilgisi eksik.',`${scopePqs.length} PQ · ${missingConcept} Concept eksik · ${missingInstance} Instance ref. eksik`,'Ziyaret kapsamını güncel aktif PQ bağlantılarıyla yeniden kaydedin. Geçmiş ziyaretlerde yalnızca gerekiyorsa düzeltme yapın.',{route:'visit',visitId:v.id,label:'Ziyareti Aç'});
        const concepts=scopePqs.map(p=>text(p.pqConceptId)).filter(Boolean), dup=concepts.filter((x,i)=>concepts.indexOf(x)!==i);
        if(dup.length)addIssue('visit','medium','scope-duplicate-concept',v.visitName||v.id,'Aynı PQ Concept ziyaret kapsamına birden fazla kez eklenmiş.',uniq(dup).join(', '),'Tarihsel/eski PQ numaralarının aynı concept altında yinelenip yinelenmediğini kontrol edin.',{route:'visit',visitId:v.id,label:'Kapsamı İncele'});
      }
      Object.entries(assignmentMap).forEach(([key,a])=>{
        const candidateExists=candidates.some(c=>text(c.key)===text(key));
        if(!candidateExists)addIssue('visit','medium','orphan-assignment',v.visitName||v.id,'Ziyaret üzerinde artık otomatik aday havuzunda bulunmayan validasyon ataması var.',`${obj(a).area||''} PQ ${obj(a).pq||''} · ${key}`,'CAP kapanış/ICAO kapanış durumunu doğrulayın; artık gerekli değilse atama kaydını temizleyin.',{route:'visit',visitId:v.id,label:'Ziyareti Aç'});
      });
      if(isOfficialVisit(v)&&scopePqs.length&&['completed','closed'].includes(text(v.status).toLowerCase())){
        const vals=Object.values(obj(obj(v.icaoValidation).records)).filter(r=>r&&!r.isDeleted);
        if(!vals.length)addIssue('visit','high','official-completed-no-result',v.visitName||v.id,'Tamamlanmış ICAO resmî ziyaretinde scope PQ’ları var ancak validasyon sonucu kaydı yok.',`${scopePqs.length} scope PQ`,'ICAO Resmî Ziyareti ekranından PQ/CAP validasyon sonuçlarını kaydedin veya ziyaret durumunu düzeltin.',{route:'icao-visit',visitId:v.id,label:'ICAO Sonuçlarını Aç'});
      }
    });
    addCheck('visit','visit-lineage','Ziyaret scope / atama bütünlüğü',!issues.some(i=>i.domain==='visit'&&['critical','high'].includes(i.severity)),`${visits.length} ziyaret kaydı kontrol edildi.`);

    // Assessment / EI sync integrity
    officialRecords.forEach(r=>{
      if(r.active===false)return;
      const eventId=text(r.assessmentEventId)||`official_${String(r.id).replace(/[.#$\[\]\/]/g,'_')}`;
      const snapId=text(r.eiSnapshotId)||`official_after_${String(r.id).replace(/[.#$\[\]\/]/g,'_')}`;
      if(!eventStore[eventId])addIssue('ei','high','official-event-missing',r.name||r.id,'Aktif ICAO resmî EI kaydının Assessment Event karşılığı yok.',eventId,'Resmî EI kaydını yeniden kaydedin veya tüm resmî EI kayıtlarını Assessment modeline senkronlayın.',{route:'official-ei',label:'Resmî EI Kayıtları'});
      if(!snapshotStore[snapId])addIssue('ei','high','official-snapshot-missing',r.name||r.id,'Aktif ICAO resmî EI kaydının EI Snapshot karşılığı yok.',snapId,'Resmî EI kaydını yeniden kaydedin veya Assessment senkronizasyonunu çalıştırın.',{route:'official-ei',label:'Resmî EI Kayıtları'});
    });
    assessments.forEach(row=>{
      const name=row.name||row.id||'Assessment'; const snap=obj(row.snapshot);
      if(!Object.keys(snap).length){
        addIssue('ei','critical','event-no-snapshot',name,'Assessment Event için bağlı EI Snapshot bulunamadı.',row.id||'-','Assessment Event ile EI Snapshot eşleşmesini düzeltin veya resmî EI kaydını yeniden senkronlayın.',{route:'official-ei',label:'Assessment / EI Kayıtları'}); return;
      }
      const type=text(row.type).toUpperCase(), status=text(row.resultStatus).toLowerCase();
      const scope=arr(row.scopeAreas||snap.scopeAreas);
      if(status==='official'&&type!=='CMAA'&&!scope.length)addIssue('ei','high','official-scope-empty',name,'Resmî validasyon/değerlendirme kaydında kapsam denetim alanları tanımlı değil.',type||'OTHER','OSVA/ICVM vb. değerlendirmede gerçekten incelenen alanları işaretleyin.',{route:'official-ei',label:'Kapsamı Düzenle'});
      const overall=obj(snap.overall), sat=Number(overall.satisfactory), app=Number(overall.applicable), ei=Number(overall.ei);
      if(Number.isFinite(app)&&app>0&&Number.isFinite(sat)&&Number.isFinite(ei)){
        const calc=Math.round((sat/app)*10000)/100;
        if(Math.abs(calc-ei)>0.05)addIssue('ei','medium','ei-math-mismatch',name,'EI yüzdesi ile Satisfactory / Applicable PQ oranı arasında matematiksel fark var.',`${sat}/${app} = %${calc.toFixed(2)}; kayıt %${ei.toFixed(2)}`,'Kaynağın resmî ICAO raporu olduğunu doğrulayın; manuel override varsa gerekçesini not alanına ekleyin.',{route:'official-ei',label:'EI Kaydını İncele'});
      }
    });
    let latest=null; try{latest=typeof window.getLatestOfficialAssessmentSnapshot==='function'?window.getLatestOfficialAssessmentSnapshot():null;}catch(_){ }
    const latestOverall=obj(latest&&latest.snapshot&&latest.snapshot.overall);
    if(latest&&!(Number(latestOverall.applicable)>0))addIssue('ei','high','latest-denominator-missing',latest.name||latest.id||'Son resmî EI','Son resmî EI snapshot’ında Applicable PQ denominator bilgisi yok. Validasyon adayı EI projeksiyonları güvenilir hesaplanamaz.',`EI: ${latestOverall.ei??'-'} · Applicable: ${latestOverall.applicable??'-'}`,'Son resmî ICAO sonucunun Satisfactory / Applicable PQ sayılarını girin.',{route:'official-ei',label:'Resmî EI Kaydını Tamamla'});
    addCheck('ei','assessment-sync','Assessment Event / EI Snapshot senkronu',!issues.some(i=>i.domain==='ei'&&['critical','high'].includes(i.severity)),`${officialRecords.length} resmî EI kaydı · ${assessments.length} assessment event kontrol edildi.`);

    const severityCounts={critical:0,high:0,medium:0,low:0}; issues.forEach(i=>severityCounts[i.severity]=(severityCounts[i.severity]||0)+1);
    const domainCounts={}; Object.keys(DOMAINS).forEach(d=>domainCounts[d]={issues:0,critical:0,high:0,medium:0,low:0,checks:0,healthy:0});
    issues.forEach(i=>{const d=domainCounts[i.domain]||(domainCounts[i.domain]={issues:0,critical:0,high:0,medium:0,low:0,checks:0,healthy:0});d.issues++;d[i.severity]++;});
    checks.forEach(c=>{const d=domainCounts[c.domain]||(domainCounts[c.domain]={issues:0,critical:0,high:0,medium:0,low:0,checks:0,healthy:0});d.checks++;if(c.ok)d.healthy++;});
    issues.sort((a,b)=>SEVERITIES[b.severity].weight-SEVERITIES[a.severity].weight||Object.keys(DOMAINS).indexOf(a.domain)-Object.keys(DOMAINS).indexOf(b.domain)||a.record.localeCompare(b.record,'tr'));
    const weighted=severityCounts.critical*10+severityCounts.high*6+severityCounts.medium*3+severityCounts.low;
    const base=Math.max(40,checks.length*10+issues.length*4); const score=Math.max(0,Math.min(100,100-(weighted/base)*100));
    const model={moduleVersion:MODULE_VERSION,generatedAt:new Date().toISOString(),issues,checks,severityCounts,domainCounts,healthyChecks:checks.filter(c=>c.ok).length,score,counts:{capPq:uniquePqs.length,candidates:candidates.length,visits:visits.length,officialEi:officialRecords.length,assessments:assessments.length},libraryLoaded};
    if(!options.silent)lastModel=model;
    return model;
  }

  function fillDomainSelect(model){
    const el=document.getElementById('integrityDomainFilter'); if(!el)return;
    const current=el.value||'all';
    el.innerHTML='<option value="all">Tüm modüller</option>'+Object.entries(DOMAINS).map(([k,d])=>`<option value="${k}">${d.icon} ${d.label} (${(model.domainCounts[k]||{}).issues||0})</option>`).join('');
    if([...el.options].some(o=>o.value===current))el.value=current;
  }
  function visibleIssues(model){
    const sev=(document.getElementById('integritySeverityFilter')||{}).value||'all', domain=(document.getElementById('integrityDomainFilter')||{}).value||'all', q=text((document.getElementById('integritySearchInput')||{}).value).toLocaleLowerCase('tr-TR');
    return model.issues.filter(i=>{
      if(sev!=='all'&&i.severity!==sev)return false; if(domain!=='all'&&i.domain!==domain)return false; if(!q)return true;
      return [DOMAINS[i.domain]?.label,i.record,i.problem,i.current,i.recommendation].join(' ').toLocaleLowerCase('tr-TR').includes(q);
    });
  }
  function setText(id,v){const e=document.getElementById(id);if(e)e.textContent=String(v);}
  function renderSystemIntegrityCenter(force=false){
    if(!document.getElementById('systemIntegrityCenter'))return null;
    if(typeof window.isIcaoPqLibraryLoaded==='function'&&!window.isIcaoPqLibraryLoaded()&&typeof window.loadIcaoPqLibrary==='function'&&!pqLoadRequested){
      pqLoadRequested=true;
      Promise.resolve(window.loadIcaoPqLibrary(false)).catch(()=>null).finally(()=>{pqLoadRequested=false;setTimeout(()=>renderSystemIntegrityCenter(true),0);});
    }
    const model=buildSystemIntegrityModel(); lastModel=model; window.currentSystemIntegrityModel=model; fillDomainSelect(model);
    const rows=visibleIssues(model);
    setText('integrityHealthyChecks',model.healthyChecks); setText('integrityCriticalIssues',model.severityCounts.critical); setText('integrityHighIssues',model.severityCounts.high); setText('integrityMediumIssues',model.severityCounts.medium+model.severityCounts.low); setText('integrityScore','%'+model.score.toFixed(1));
    const ctx=document.getElementById('integrityContext'); if(ctx)ctx.innerHTML=`Son kontrol: <b>${new Date(model.generatedAt).toLocaleString('tr-TR')}</b> · <b>${model.counts.capPq} CAP PQ</b> · <b>${model.counts.candidates} validasyon adayı</b> · <b>${model.counts.visits} ziyaret</b> · <b>${model.counts.officialEi} resmî EI kaydı</b> · <b>${model.counts.assessments} assessment event</b>`;
    const grid=document.getElementById('integrityDomainGrid'); if(grid)grid.innerHTML=Object.entries(DOMAINS).map(([k,d])=>{const c=model.domainCounts[k]||{};const blocking=(c.critical||0)+(c.high||0);return `<button type="button" class="integrity-domain-card ${blocking?'warn':'ok'} ${((document.getElementById('integrityDomainFilter')||{}).value===k)?'active':''}" onclick="setSystemIntegrityDomain('${k}')"><span class="integrity-domain-icon">${d.icon}</span><div><b>${esc(d.label)}</b><small>${c.issues||0} sorun · ${c.healthy||0}/${c.checks||0} sağlıklı kontrol</small></div><strong>${blocking||'✓'}</strong></button>`;}).join('');
    const body=document.getElementById('integrityIssueTableBody');
    if(body)body.innerHTML=rows.length?rows.map(i=>`<tr><td><span class="integrity-severity ${i.severity}">${esc(SEVERITIES[i.severity].label)}</span></td><td><b>${DOMAINS[i.domain].icon} ${esc(DOMAINS[i.domain].label)}</b></td><td><b>${esc(i.record)}</b></td><td>${esc(i.problem)}</td><td><span class="integrity-current">${esc(i.current||'-')}</span></td><td>${esc(i.recommendation)}</td><td>${i.action&&i.action.route?`<button type="button" class="btn-outline integrity-action" onclick="navigateSystemIntegrityIssue('${esc(i.id)}')">${esc(i.action.label||'Aç')}</button>`:''}</td></tr>`).join(''):'<tr><td colspan="7" class="integrity-empty">Seçili filtrelerde bütünlük sorunu bulunmadı.</td></tr>';
    const note=document.getElementById('integrityTableNote');if(note)note.textContent=`${rows.length} sorun gösteriliyor · toplam ${model.issues.length} sorun · bütünlük skoru %${model.score.toFixed(1)}. Kontroller otomatik veri düzeltmez.`;
    return model;
  }
  function setSystemIntegrityDomain(domain){const e=document.getElementById('integrityDomainFilter');if(e)e.value=domain||'all';renderSystemIntegrityCenter();}
  function clearSystemIntegrityFilters(){['integritySeverityFilter','integrityDomainFilter'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='all';});const q=document.getElementById('integritySearchInput');if(q)q.value='';renderSystemIntegrityCenter();}
  function navigateSystemIntegrityIssue(id){
    const m=lastModel||buildSystemIntegrityModel(), issue=m.issues.find(x=>x.id===id); if(!issue||!issue.action)return;
    const a=issue.action;
    if(a.route==='pq-versions'){window.switchTab?window.switchTab('pq-library'):null;setTimeout(()=>window.setPqDbView&&window.setPqDbView('versions'),40);return;}
    if(a.route==='pq-linkage'){window.switchTab?window.switchTab('pq-library'):null;setTimeout(()=>window.setPqDbView&&window.setPqDbView('linkage'),40);return;}
    if(a.route==='validation'){window.switchTab&&window.switchTab('validation-readiness');return;}
    if(a.route==='visit'){window.switchTab&&window.switchTab('visits');setTimeout(()=>{if(a.visitId&&typeof window.viewVisitDetail==='function')window.viewVisitDetail(a.visitId);},60);return;}
    if(a.route==='icao-visit'){if(a.visitId&&typeof window.openIcaoOfficialVisitValidation==='function')window.openIcaoOfficialVisitValidation(a.visitId);else window.switchTab&&window.switchTab('icao-visit-validation');return;}
    if(a.route==='official-ei'){if(typeof window.openIcaoOfficialEiManager==='function')window.openIcaoOfficialEiManager();return;}
  }
  function downloadSystemIntegrityReport(){
    const model=buildSystemIntegrityModel({silent:true});
    const payload={...model,issues:model.issues.map(i=>({...i,action:i.action||{}}))};
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`USOAP_Surec_Butunlugu_${new Date().toISOString().replace(/[:.]/g,'-')}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function runSystemIntegritySelfCheck(){const model=buildSystemIntegrityModel({silent:true});const result={passed:!!document.getElementById('systemIntegrityCenter')&&typeof window.getSystemIntegritySourceSnapshot==='function',moduleVersion:MODULE_VERSION,score:model.score,issues:model.issues.length,severityCounts:model.severityCounts,domains:Object.keys(model.domainCounts)};console.log('Sistem bütünlüğü öz denetimi:',result);return result;}

  window.buildSystemIntegrityModel=buildSystemIntegrityModel;
  window.renderSystemIntegrityCenter=renderSystemIntegrityCenter;
  window.setSystemIntegrityDomain=setSystemIntegrityDomain;
  window.clearSystemIntegrityFilters=clearSystemIntegrityFilters;
  window.navigateSystemIntegrityIssue=navigateSystemIntegrityIssue;
  window.downloadSystemIntegrityReport=downloadSystemIntegrityReport;
  window.runSystemIntegritySelfCheck=runSystemIntegritySelfCheck;
  document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{if(document.getElementById('tab-quality')?.classList.contains('active'))renderSystemIntegrityCenter(true);},0));
})();
