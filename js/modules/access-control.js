(function(){
  'use strict';
  const ROOT='icao_access_control';
  const MODULE_VERSION='access-control-v18';
  const AREAS=['LEG','ORG','PEL','OPS','AIR','AIG','ANS','AGA'];
  const ROLES={
    owner:{label:'Sistem Sahibi',icon:'👑',rank:50,description:'Tam yetki; kullanıcı/rol yönetimi ve tüm veri işlemleri.'},
    manager:{label:'Yönetici',icon:'🛡️',rank:40,description:'Tüm operasyon ve referans verilerini yönetir; kullanıcı yetkilerini yönetebilir.'},
    coordinator:{label:'Koordinatör',icon:'🧭',rank:30,description:'USOAP operasyonlarını, PQ/EI, validasyon ve ziyaret süreçlerini yönetir.'},
    specialist:{label:'Uzman',icon:'🧑‍💼',rank:20,description:'CAP, validasyon, ziyaret, doküman ve görev süreçlerinde çalışır.'},
    viewer:{label:'Görüntüleyici',icon:'👁️',rank:10,description:'Verileri görüntüler ve rapor dışa aktarır; kayıt değiştiremez.'}
  };
  const PERMISSIONS={
    'system.write':['owner','manager','coordinator','specialist'],
    'archive.write':['owner','manager','coordinator'],
    'officialEi.write':['owner','manager','coordinator'],
    'pqLibrary.write':['owner','manager','coordinator'],
    'validation.write':['owner','manager','coordinator','specialist'],
    'visits.write':['owner','manager','coordinator','specialist'],
    'visitSettings.write':['owner','manager','coordinator'],
    'documents.write':['owner','manager','coordinator','specialist'],
    'documents.settings.write':['owner','manager','coordinator'],
    'actions.write':['owner','manager','coordinator','specialist'],
    'actions.settings.write':['owner','manager','coordinator'],
    'notifications.write':['owner','manager','coordinator','specialist','viewer'],
    'reports.export':['owner','manager','coordinator','specialist','viewer'],
    'access.manage':['owner','manager'],
    'system.admin':['owner']
  };
  const state={user:null,profile:null,config:{},users:{},requests:{},audit:{},ready:false,accessGranted:false,bootstrap:false,lastError:'',listeners:[],selfRef:null,selfCallback:null,writeGuardInstalled:false};
  const text=v=>String(v==null?'':v).trim();
  const esc=v=>text(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const db=()=>typeof firebase!=='undefined'&&firebase.database?firebase.database():null;
  const auth=()=>typeof firebase!=='undefined'&&firebase.auth?firebase.auth():null;
  const now=()=>new Date().toISOString();
  const roleOf=()=>text(state.profile&&state.profile.role)||'';
  const roleDef=r=>ROLES[r]||{label:r||'Yetkisiz',icon:'⛔',rank:0,description:''};
  const isActive=()=>!!(state.profile&&state.profile.active===true);
  const can=perm=>isActive()&&(PERMISSIONS[perm]||[]).includes(roleOf());
  const safeKey=v=>text(v).replace(/[.#$\[\]\/]/g,'_').slice(0,180)||'item';
  const actor=()=>state.user?{uid:state.user.uid||'',email:state.user.email||'',displayName:state.profile&&state.profile.displayName||state.user.displayName||state.user.email||''}:{uid:'',email:'',displayName:''};
  const profileAreas=()=>{const a=state.profile&&state.profile.areas;if(!a)return AREAS.slice();if(Array.isArray(a))return a.filter(x=>AREAS.includes(x));return Object.keys(a).filter(k=>a[k]&&AREAS.includes(k));};

  function resetState(){detachAdminListeners();detachSelfListener();state.user=null;state.profile=null;state.config={};state.users={};state.requests={};state.audit={};state.ready=false;state.accessGranted=false;state.bootstrap=false;state.lastError='';applyUi();}

  function auditPayload(action,targetUid,before,after,note){return{action,targetUid:targetUid||'',before:before||null,after:after||null,note:note||'',at:now(),actor:actor(),moduleVersion:MODULE_VERSION};}
  async function appendAudit(action,targetUid,before,after,note){const d=db();if(!d||!can('access.manage'))return;try{const ref=d.ref(`${ROOT}/audit`).push();await ref.set(auditPayload(action,targetUid,before,after,note));}catch(e){console.warn('Yetki audit kaydı yazılamadı:',e);}}

  async function ensureCurrentUserAccess(user){
    state.user=user;state.ready=false;state.accessGranted=false;state.lastError='';state.bootstrap=false;
    const d=db();if(!d)throw new Error('Firebase Database hazır değil.');
    let snap;
    try{snap=await d.ref(`${ROOT}/users/${user.uid}`).once('value');}catch(e){state.lastError=e.message||String(e);throw e;}
    let profile=snap.val();
    if(!profile){
      const bootstrap={uid:user.uid,email:user.email||'',displayName:user.displayName||user.email||'Sistem Sahibi',role:'owner',active:true,unit:'',title:'',areas:Object.fromEntries(AREAS.map(a=>[a,true])),createdAt:now(),createdBy:{uid:user.uid,email:user.email||''},updatedAt:now(),updatedBy:{uid:user.uid,email:user.email||''},moduleVersion:MODULE_VERSION};
      try{
        await d.ref(`${ROOT}/users/${user.uid}`).set(bootstrap);
        profile=bootstrap;state.bootstrap=true;
        try{await d.ref(`${ROOT}/config`).update({schemaVersion:1,initializedAt:now(),initializedBy:{uid:user.uid,email:user.email||''},moduleVersion:MODULE_VERSION});}catch(_){}
      }catch(e){
        const request={uid:user.uid,email:user.email||'',displayName:user.displayName||user.email||'',requestedAt:now(),lastSeenAt:now(),status:'pending',moduleVersion:MODULE_VERSION};
        try{await d.ref(`${ROOT}/requests/${user.uid}`).update(request);}catch(reqErr){state.lastError=`Yetki profili oluşturulamadı ve erişim talebi yazılamadı: ${reqErr.message||reqErr}`;state.ready=true;applyUi();return{allowed:false,reason:'rules-or-access',error:state.lastError};}
        state.profile=null;state.ready=true;state.accessGranted=false;state.lastError='Bu kullanıcı için erişim rolü henüz atanmadı.';applyUi();return{allowed:false,reason:'pending'};
      }
    }
    state.profile=profile;state.accessGranted=profile.active===true;state.ready=true;
    try{const cs=await d.ref(`${ROOT}/config`).once('value');state.config=cs.val()||{};}catch(_){}
    if(state.accessGranted){try{await d.ref(`${ROOT}/users/${user.uid}/lastLoginAt`).set(now());}catch(_){} installWriteGuard();attachSelfListener();}
    applyUi();
    if(can('access.manage'))attachAdminListeners();
    return{allowed:state.accessGranted,reason:state.accessGranted?'ok':'inactive',profile:state.profile,bootstrap:state.bootstrap};
  }

  function showGate(result){
    const gate=document.getElementById('accessDeniedOverlay');if(!gate)return;
    const title=document.getElementById('accessDeniedTitle'),msg=document.getElementById('accessDeniedMessage'),meta=document.getElementById('accessDeniedMeta');
    if(title)title.textContent=result&&result.reason==='inactive'?'Erişim Pasif':'Erişim Onayı Gerekli';
    if(msg)msg.textContent=result&&result.reason==='rules-or-access'?'Yetki kaydı okunamadı. Faz 15 Realtime Database Rules dosyasının uygulanmış olduğunu kontrol edin.':'Hesabınız Firebase Authentication ile doğrulandı ancak uygulama rolü henüz etkin değil. Sistem Sahibi / Yönetici onayı gereklidir.';
    if(meta)meta.textContent=state.user?`${state.user.email||state.user.uid} · ${result&&result.reason==='pending'?'Erişim talebi kaydedildi.':'Yetki profili bekleniyor.'}`:'';
    gate.style.display='flex';
  }
  function hideGate(){const gate=document.getElementById('accessDeniedOverlay');if(gate)gate.style.display='none';}
  async function retryGate(){const u=auth()&&auth().currentUser;if(!u)return;const res=await ensureCurrentUserAccess(u);if(res.allowed){hideGate();location.reload();}else showGate(res);}

  function applyUi(){
    const role=roleDef(roleOf());
    const badge=document.getElementById('sidebarAccessIdentity');
    if(badge){badge.innerHTML=state.accessGranted?`<span class="access-role-icon">${role.icon}</span><span><b>${esc(state.profile.displayName||state.user?.email||'-')}</b><small>${esc(role.label)}${state.profile.unit?' · '+esc(state.profile.unit):''}</small></span>`:'<span class="access-role-icon">🔒</span><span><b>Yetki bekleniyor</b><small>Rol atanmadı</small></span>';}
    const nav=document.getElementById('navGroupAccessControl');if(nav)nav.style.display=state.accessGranted?'':'none';
    const manage=document.getElementById('accessAdminPanel');if(manage)manage.style.display=can('access.manage')?'':'none';
    document.body.classList.toggle('access-readonly',state.accessGranted&&!can('system.write'));
    document.body.dataset.accessRole=roleOf()||'none';
    updateWriteControls();
  }

  function classifyControl(el){
    const own=text(el.getAttribute&&el.getAttribute('onclick'));
    const form=el.closest&&el.closest('form');
    const submit=(el.tagName==='BUTTON'&&String(el.type||'').toLowerCase()==='submit')?text(form&&form.getAttribute('onsubmit')):'';
    const oc=(own||submit).toLowerCase();
    if(!oc&&el.tagName==='INPUT'&&String(el.type||'').toLowerCase()==='file'){const id=text(el.id).toLowerCase();if(id.includes('drive')||id.includes('document'))return'documents.write';if(id.includes('pqdb')||id.includes('pq')||id.includes('responsibility'))return'pqLibrary.write';return'system.write';}
    if(!oc)return'';
    if(/notification/.test(oc))return'notifications.write';
    if(/savegoogledrivesettings|resetgoogledriverootfolder/.test(oc))return'documents.settings.write';
    if(/saveactioncentersettings/.test(oc))return'actions.settings.write';
    if(/officialei|ei.*save|save.*ei|assessment.*save|automation.*ei/.test(oc))return'officialEi.write';
    if(/pqdb|pq.*import|pq.*metadata|pq.*active|lineage/.test(oc))return'pqLibrary.write';
    if(/validationreadiness|validation.*save|assign.*validation/.test(oc))return'validation.write';
    if(/visit|consultation|followup|fieldwork/.test(oc)&&/(save|delete|create|update|sync|assign|edit|open.*editor|import)/.test(oc))return'visits.write';
    if(/drive|document/.test(oc)&&/(save|delete|upload|register|edit|open.*editor)/.test(oc))return'documents.write';
    if(/action/.test(oc)&&/(save|delete|create|edit|open.*editor|setting)/.test(oc))return'actions.write';
    if(/archive/.test(oc)&&/(save|delete|restore|create)/.test(oc))return'archive.write';
    if(/save|delete|remove|commit|upload|import|restore|sync/.test(oc))return'system.write';
    return'';
  }
  function updateWriteControls(){
    if(!state.accessGranted)return;
    document.querySelectorAll('button[onclick],input[type=file]').forEach(el=>{
      const perm=el.dataset&&el.dataset.permission||classifyControl(el);
      if(!perm)return;
      const allowed=can(perm);
      if(!allowed){el.disabled=true;el.classList.add('access-disabled');el.title=(el.title?el.title+' · ':'')+`Rolünüz bu işlem için yetkili değil (${roleDef(roleOf()).label}).`;}
      else if(el.classList.contains('access-disabled')){el.disabled=false;el.classList.remove('access-disabled');}
    });
  }

  function pathFromRef(ref){try{const s=String(ref.toString());const marker='.app/';let i=s.indexOf(marker);if(i>=0)return decodeURIComponent(s.slice(i+marker.length)).replace(/^\/+|\/+$/g,'');const u=new URL(s);return decodeURIComponent(u.pathname).replace(/^\/+|\/+$/g,'');}catch(_){return'';}}
  function permissionForPath(path){const p=text(path).replace(/^\/+|\/+$/g,'');if(!p)return'';if(p.startsWith(`${ROOT}/`))return'access.manage';if(p.startsWith('icao_notification_center/'))return'notifications.write';if(p.startsWith('icao_official_ei/')||p==='icao_official_ei'||p.startsWith('icao_assessment_events/')||p.startsWith('icao_ei_snapshots/')||p==='icao_state_snapshots'||p.startsWith('icao_state_snapshots/'))return'officialEi.write';if(p.startsWith('icao_pq_library/')||p==='icao_pq_library'||p==='icao_responsibility_registry'||p.startsWith('icao_responsibility_registry/'))return'pqLibrary.write';if(p.startsWith('icao_validation_readiness/')||p==='icao_validation_readiness')return'validation.write';if(p.startsWith('icao_visits/')||p==='icao_visits')return'visits.write';if(p.startsWith('icao_visit_settings/')||p==='icao_visit_settings')return'visitSettings.write';if(p==='icao_document_hub/settings'||p.startsWith('icao_document_hub/settings/'))return'documents.settings.write';if(p.startsWith('icao_document_hub/')||p==='icao_document_hub')return'documents.write';if(p==='icao_action_center/settings'||p.startsWith('icao_action_center/settings/'))return'actions.settings.write';if(p.startsWith('icao_action_center/')||p==='icao_action_center')return'actions.write';if(p.startsWith('icao_archive/')||p==='icao_archive')return'archive.write';if(p.startsWith('icao_system/')||p==='icao_system')return'system.write';return'system.admin';}
  function pathAllowed(path){
    const p=text(path).replace(/^\/+|\/+$/g,'');
    if(p===`${ROOT}/users/${state.user?.uid||'__'}/lastLoginAt`)return isActive();
    if(p.startsWith(`${ROOT}/requests/${state.user?.uid||'__'}`))return true;
    if(p.startsWith(`icao_notification_center/users/${state.user?.uid||'__'}`))return isActive();
    return can(permissionForPath(p));
  }
  function installWriteGuard(){
    if(state.writeGuardInstalled||typeof firebase==='undefined'||!firebase.database||!firebase.database.Reference)return;
    const proto=firebase.database.Reference.prototype;if(!proto||proto.__usoapAclGuard)return;
    const originalSet=proto.set,originalUpdate=proto.update,originalRemove=proto.remove;
    function deny(path){const perm=permissionForPath(path),e=new Error(`Yetki reddedildi: ${perm||path}`);e.code='permission-denied-client';if(typeof window.showAppRuntimeToast==='function')window.showAppRuntimeToast(`Bu işlem için yetkiniz yok (${roleDef(roleOf()).label}).`,'error');return Promise.reject(e);}
    proto.set=function(value,onComplete){const path=pathFromRef(this);if(!pathAllowed(path))return deny(path);return originalSet.call(this,value,onComplete);};
    proto.remove=function(onComplete){const path=pathFromRef(this);if(!pathAllowed(path))return deny(path);return originalRemove.call(this,onComplete);};
    proto.update=function(values,onComplete){const base=pathFromRef(this);const keys=values&&typeof values==='object'?Object.keys(values):[];const paths=keys.length?keys.map(k=>[base,k].filter(Boolean).join('/')):[base];const blocked=paths.find(p=>!pathAllowed(p));if(blocked)return deny(blocked);return originalUpdate.call(this,values,onComplete);};
    proto.__usoapAclGuard=true;state.writeGuardInstalled=true;
  }

  function attachSelfListener(){
    detachSelfListener();const d=db();if(!d||!state.user)return;
    state.selfRef=d.ref(`${ROOT}/users/${state.user.uid}`);
    state.selfCallback=s=>{const next=s.val();if(!next){state.profile=null;state.accessGranted=false;detachAdminListeners();applyUi();showGate({reason:'pending'});return;}const prevRole=roleOf();state.profile=next;state.accessGranted=next.active===true;if(can('access.manage'))attachAdminListeners();else detachAdminListeners();applyUi();if(!state.accessGranted){try{if(typeof window.stopVisitFirebaseListener==='function')window.stopVisitFirebaseListener();if(typeof window.stopVisitUnitSettingsListener==='function')window.stopVisitUnitSettingsListener();if(typeof window.stopIcaoOfficialEiListener==='function')window.stopIcaoOfficialEiListener();if(typeof window.stopAssessmentEventListener==='function')window.stopAssessmentEventListener();if(typeof window.stopValidationReadinessListener==='function')window.stopValidationReadinessListener();}catch(_){}showGate({reason:'inactive'});const app=document.getElementById('mainAppContainer');if(app)app.style.display='none';}else{hideGate();if(prevRole!==roleOf()&&typeof window.showAppRuntimeToast==='function')window.showAppRuntimeToast(`Rolünüz güncellendi: ${roleDef(roleOf()).label}`,'info');}};
    state.selfRef.on('value',state.selfCallback,e=>console.warn('Kullanıcı yetki profili dinlenemedi:',e));
  }
  function detachSelfListener(){if(state.selfRef&&state.selfCallback){try{state.selfRef.off('value',state.selfCallback);}catch(_){}}state.selfRef=null;state.selfCallback=null;}

  function attachAdminListeners(){
    detachAdminListeners();const d=db();if(!d||!can('access.manage'))return;
    [['users','users'],['requests','requests'],['audit','audit']].forEach(([path,key])=>{const ref=d.ref(`${ROOT}/${path}`);const cb=s=>{state[key]=s.val()||{};render();};ref.on('value',cb,e=>console.warn(`Access ${path} okunamadı:`,e));state.listeners.push({ref,cb});});
  }
  function detachAdminListeners(){state.listeners.forEach(x=>{try{x.ref.off('value',x.cb);}catch(_){}});state.listeners=[];}

  function renderRoleCards(){return Object.entries(ROLES).map(([k,r])=>`<div class="access-role-card ${k===roleOf()?'current':''}"><div class="access-role-card-head"><span>${r.icon}</span><b>${esc(r.label)}</b></div><p>${esc(r.description)}</p><small>${k==='owner'?'Tam yetki':k==='manager'?'Kullanıcı yönetimi + tam operasyon':k==='coordinator'?'PQ/EI + operasyon':k==='specialist'?'Operasyonel çalışma': 'Salt okunur'}</small></div>`).join('');}
  function userRows(){
    const rows=Object.values(state.users||{}).sort((a,b)=>roleDef(b.role).rank-roleDef(a.role).rank||text(a.displayName).localeCompare(text(b.displayName),'tr'));
    if(!rows.length)return'<tr><td colspan="8" class="access-empty">Kullanıcı kaydı yok.</td></tr>';
    return rows.map(u=>{const r=roleDef(u.role);const areas=u.areas?Object.keys(u.areas).filter(a=>u.areas[a]).join(', '):'Tümü';const disabled=u.active===false;return`<tr class="${disabled?'access-user-inactive':''}"><td><div class="access-user-name"><b>${esc(u.displayName||u.email||u.uid)}</b><small>${esc(u.email||'')}</small></div></td><td><span class="access-role-pill role-${esc(u.role)}">${r.icon} ${esc(r.label)}</span></td><td>${esc(u.unit||'-')}</td><td>${esc(u.title||'-')}</td><td>${esc(areas||'Tümü')}</td><td>${u.active===false?'<span class="access-state off">Pasif</span>':'<span class="access-state on">Aktif</span>'}</td><td>${u.lastLoginAt?new Date(u.lastLoginAt).toLocaleString('tr-TR'):'-'}</td><td>${can('access.manage')?`<button type="button" class="btn-outline" onclick="openAccessUserEditor('${esc(u.uid)}')">✏️ Düzenle</button>`:'-'}</td></tr>`;}).join('');
  }
  function requestRows(){
    const users=state.users||{};const rows=Object.values(state.requests||{}).filter(r=>!users[r.uid]||users[r.uid].active===false).sort((a,b)=>text(b.lastSeenAt||b.requestedAt).localeCompare(text(a.lastSeenAt||a.requestedAt)));
    if(!rows.length)return'<tr><td colspan="5" class="access-empty">Bekleyen erişim talebi yok.</td></tr>';
    return rows.map(r=>`<tr><td><b>${esc(r.displayName||r.email||r.uid)}</b><br><small>${esc(r.email||'')}</small></td><td>${r.requestedAt?new Date(r.requestedAt).toLocaleString('tr-TR'):'-'}</td><td>${r.lastSeenAt?new Date(r.lastSeenAt).toLocaleString('tr-TR'):'-'}</td><td><span class="access-state pending">Onay bekliyor</span></td><td><button type="button" onclick="approveAccessRequest('${esc(r.uid)}')">✅ Onayla</button></td></tr>`).join('');
  }
  function auditRows(){
    const rows=Object.entries(state.audit||{}).map(([id,x])=>({id,...x})).sort((a,b)=>text(b.at).localeCompare(text(a.at))).slice(0,30);
    if(!rows.length)return'<tr><td colspan="5" class="access-empty">Yetki değişiklik kaydı yok.</td></tr>';
    return rows.map(x=>`<tr><td>${x.at?new Date(x.at).toLocaleString('tr-TR'):'-'}</td><td>${esc(x.actor&& (x.actor.displayName||x.actor.email)||'-')}</td><td>${esc(x.action||'-')}</td><td>${esc(x.after&&x.after.displayName||x.targetUid||'-')}</td><td>${esc(x.note||'-')}</td></tr>`).join('');
  }
  function render(){
    const root=document.getElementById('accessControlRoot');if(!root)return;
    const role=roleDef(roleOf()),areas=profileAreas();
    root.innerHTML=`
      <div class="access-head"><div><div class="access-eyebrow">FAZ 15 · ÇOK KULLANICILI YAPI</div><h2>🔐 Kullanıcı, Rol &amp; Yetki Yönetimi</h2><p>Firebase Authentication kimliğini uygulama rolüyle eşleştirir. Sunucu tarafındaki Realtime Database Rules gerçek yazma yetkisini uygular.</p></div><div class="access-current"><span>${role.icon}</span><div><b>${esc(state.profile&&state.profile.displayName||state.user&&state.user.email||'-')}</b><small>${esc(role.label)} · ${esc(state.user&&state.user.email||'')}</small></div></div></div>
      <div class="access-kpis"><div><span>Rolüm</span><b>${esc(role.label)}</b><small>${can('access.manage')?'Kullanıcı yönetimi açık':'Kullanıcı yönetimi kapalı'}</small></div><div><span>Çalışma alanı</span><b>${areas.length}</b><small>${esc(areas.join(', ')||'Belirlenmedi')}</small></div><div><span>Aktif kullanıcı</span><b>${can('access.manage')?Object.values(state.users||{}).filter(u=>u.active!==false).length:'—'}</b><small>${can('access.manage')?'Yetki kayıtları':'Yönetici görünümü'}</small></div><div><span>Bekleyen talep</span><b>${can('access.manage')?Object.keys(state.requests||{}).filter(uid=>!state.users[uid]).length:'—'}</b><small>Erişim onayı</small></div></div>
      <div class="access-role-grid">${renderRoleCards()}</div>
      <div class="access-security-note"><b>Güvenlik sınırı:</b> Roller Realtime Database Rules ile uygulanır. “Alan kapsamı” görev/filtre yönlendirmesi içindir; mevcut düz veri modeli nedeniyle alan bazlı gizlilik sınırı değildir.</div>
      <div id="accessAdminPanel" style="${can('access.manage')?'':'display:none'}">
        <div class="access-section"><div class="access-section-head"><div><h3>👥 Kullanıcılar</h3><p>Firebase Authentication hesabı oluşturulduktan sonra kullanıcı ilk girişinde burada erişim talebi olarak görünür.</p></div><button type="button" class="btn-outline" onclick="renderAccessControlCenter()">🔄 Yenile</button></div><div class="access-table-wrap"><table class="access-table"><thead><tr><th>Kullanıcı</th><th>Rol</th><th>Birim</th><th>Unvan</th><th>Alan kapsamı</th><th>Durum</th><th>Son giriş</th><th>İşlem</th></tr></thead><tbody>${userRows()}</tbody></table></div></div>
        <div class="access-section"><div class="access-section-head"><div><h3>🕓 Bekleyen Erişim Talepleri</h3><p>Firebase Auth ile doğrulanan fakat henüz uygulama rolü olmayan hesaplar.</p></div></div><div class="access-table-wrap"><table class="access-table"><thead><tr><th>Kullanıcı</th><th>İlk talep</th><th>Son deneme</th><th>Durum</th><th>İşlem</th></tr></thead><tbody>${requestRows()}</tbody></table></div></div>
        <div class="access-section"><div class="access-section-head"><div><h3>🧾 Yetki Değişiklik Geçmişi</h3><p>Son 30 rol/erişim yönetimi işlemi.</p></div></div><div class="access-table-wrap"><table class="access-table"><thead><tr><th>Tarih</th><th>İşlemi yapan</th><th>İşlem</th><th>Hedef</th><th>Not</th></tr></thead><tbody>${auditRows()}</tbody></table></div></div>
      </div>`;
    applyUi();
  }

  function openEditor(uid){
    if(!can('access.manage'))return alert('Kullanıcı yönetimi için yetkiniz yok.');const u=state.users[uid]||state.requests[uid];if(!u)return;
    document.getElementById('accessEditUid').value=uid;document.getElementById('accessEditName').value=u.displayName||u.email||'';document.getElementById('accessEditEmail').value=u.email||'';document.getElementById('accessEditUnit').value=u.unit||'';document.getElementById('accessEditTitle').value=u.title||'';document.getElementById('accessEditRole').value=u.role||'specialist';document.getElementById('accessEditActive').checked=u.active!==false;
    AREAS.forEach(a=>{const el=document.getElementById(`accessArea${a}`);if(el)el.checked=!u.areas||u.areas[a]!==false;});
    const roleSel=document.getElementById('accessEditRole');if(roleSel){[...roleSel.options].forEach(o=>{o.disabled=roleOf()==='manager'&&o.value==='owner';});}
    document.getElementById('accessUserEditorModal').style.display='flex';
  }
  function closeEditor(){const m=document.getElementById('accessUserEditorModal');if(m)m.style.display='none';}
  async function saveEditor(e){if(e)e.preventDefault();if(!can('access.manage'))return alert('Yetkiniz yok.');const uid=text(document.getElementById('accessEditUid').value),before=state.users[uid]||null;if(!uid)return;const role=document.getElementById('accessEditRole').value;if(roleOf()==='manager'&&role==='owner')return alert('Yönetici rolü Sistem Sahibi atayamaz.');if(before&&before.role==='owner'&&roleOf()==='manager')return alert('Yönetici rolü Sistem Sahibi kaydını değiştiremez.');
    if(before&&before.role==='owner'&&role!=='owner'){const owners=Object.values(state.users).filter(x=>x.active!==false&&x.role==='owner');if(owners.length<=1)return alert('Sistemde en az bir aktif Sistem Sahibi kalmalıdır.');}
    const areas={};AREAS.forEach(a=>areas[a]=!!document.getElementById(`accessArea${a}`)?.checked);
    const after={...(before||{}),uid,email:text(document.getElementById('accessEditEmail').value)||(state.requests[uid]||{}).email||'',displayName:text(document.getElementById('accessEditName').value),unit:text(document.getElementById('accessEditUnit').value),title:text(document.getElementById('accessEditTitle').value),role,active:!!document.getElementById('accessEditActive').checked,areas,updatedAt:now(),updatedBy:actor(),createdAt:before&&before.createdAt||now(),createdBy:before&&before.createdBy||actor(),moduleVersion:MODULE_VERSION};
    const d=db();try{await d.ref(`${ROOT}/users/${uid}`).set(after);await d.ref(`${ROOT}/requests/${uid}`).update({status:after.active?'approved':'inactive',processedAt:now(),processedBy:actor()});await appendAudit(before?'user-update':'user-approve',uid,before,after,after.active?'Rol/erişim güncellendi.':'Kullanıcı pasif yapıldı.');closeEditor();if(typeof window.showAppRuntimeToast==='function')window.showAppRuntimeToast('Kullanıcı yetkisi kaydedildi.','success');}catch(err){alert('Yetki kaydı yapılamadı: '+(err.message||err));}
  }
  async function approveRequest(uid){if(!can('access.manage'))return;const r=state.requests[uid];if(!r)return;openEditor(uid);}

  function exportRows(){return Object.values(state.users||{}).map(u=>({Kullanıcı:u.displayName||'',Email:u.email||'',Rol:roleDef(u.role).label,Birim:u.unit||'',Unvan:u.title||'',Alanlar:(u.areas?Object.keys(u.areas).filter(a=>u.areas[a]).join(', '):'Tümü'),Durum:u.active===false?'Pasif':'Aktif','Son Giriş':u.lastLoginAt||''}));}
  function exportExcel(){if(!can('reports.export'))return;const rows=can('access.manage')?exportRows():[{Kullanıcı:state.profile?.displayName||'',Email:state.user?.email||'',Rol:roleDef(roleOf()).label,Birim:state.profile?.unit||'',Unvan:state.profile?.title||'',Alanlar:profileAreas().join(', '),Durum:isActive()?'Aktif':'Pasif'}];if(typeof XLSX==='undefined')return alert('Excel kütüphanesi hazır değil.');const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows),'Kullanicilar');XLSX.writeFile(wb,'USOAP_Kullanici_Yetki_Matrisi.xlsx');}
  function exportPdf(){if(!can('reports.export'))return;const rows=can('access.manage')?exportRows():[{Kullanıcı:state.profile?.displayName||'',Email:state.user?.email||'',Rol:roleDef(roleOf()).label,Birim:state.profile?.unit||'',Unvan:state.profile?.title||'',Alanlar:profileAreas().join(', '),Durum:isActive()?'Aktif':'Pasif'}];if(typeof pdfMake==='undefined')return alert('PDF kütüphanesi hazır değil.');const body=[['Kullanıcı','E-posta','Rol','Birim','Alanlar','Durum'],...rows.map(r=>[r.Kullanıcı,r.Email,r.Rol,r.Birim,r.Alanlar,r.Durum])];pdfMake.createPdf({pageOrientation:'landscape',content:[{text:'USOAP CMA Kullanıcı & Yetki Matrisi',fontSize:17,bold:true,margin:[0,0,0,10]},{table:{headerRows:1,widths:['*','*','auto','*','*','auto'],body},layout:'lightHorizontalLines'}],defaultStyle:{font:'Roboto',fontSize:9}}).download('USOAP_Kullanici_Yetki_Matrisi.pdf');}

  function selfCheck(){return{passed:!!document.getElementById('tab-access-control')&&state.ready,moduleVersion:MODULE_VERSION,uid:state.user?.uid||'',role:roleOf(),active:isActive(),canManageUsers:can('access.manage'),writeGuard:state.writeGuardInstalled};}

  window.accessControlReadyForUser=ensureCurrentUserAccess;
  window.accessControlReset=resetState;
  window.showAccessDeniedGate=showGate;window.hideAccessDeniedGate=hideGate;window.retryAccessControl=retryGate;
  window.hasAppAccess=()=>state.accessGranted;window.getCurrentAccessProfile=()=>state.profile;window.getCurrentAccessRole=()=>roleOf();window.getCurrentAccessRoleLabel=()=>roleDef(roleOf()).label;window.hasAccessPermission=can;window.requireAccessPermission=(perm,msg)=>{if(can(perm))return true;alert(msg||`Bu işlem için ${roleDef(roleOf()).label} rolünün yetkisi bulunmuyor.`);return false;};window.getAccessAreaScope=profileAreas;window.canWriteDatabasePath=pathAllowed;
  window.renderAccessControlCenter=render;window.openAccessUserEditor=openEditor;window.closeAccessUserEditor=closeEditor;window.saveAccessUserEditor=saveEditor;window.approveAccessRequest=approveRequest;window.exportAccessControlExcel=exportExcel;window.exportAccessControlPDF=exportPdf;window.runAccessControlSelfCheck=selfCheck;window.applyAccessControlUi=applyUi;window.getAccessControlRoles=()=>JSON.parse(JSON.stringify(ROLES));window.getAccessControlPermissions=()=>JSON.parse(JSON.stringify(PERMISSIONS));
})();
