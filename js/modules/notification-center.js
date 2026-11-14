// USOAP CMA Notification & Automation Center
// Phase 14 v17: in-app notifications, browser notifications, snooze/read state, weekly digest
(function(){
  'use strict';

  const MODULE_VERSION='notification-center-v17';
  const ROOT='icao_notification_center';
  const LEVELS={critical:{label:'Kritik',rank:4,icon:'🔴'},high:{label:'Yüksek',rank:3,icon:'🟠'},medium:{label:'Orta',rank:2,icon:'🟡'},info:{label:'Bilgi',rank:1,icon:'🔵'}};
  const SOURCE_LABELS={cap:'CAP',validation:'Validasyon',visit:'Ziyaret',followup:'Ziyaret Takibi',consultation:'Danışma',integrity:'Veri Bütünlüğü',ei:'EI / OLF',manual:'Manuel',digest:'Haftalık Özet'};
  const DEFAULT_SETTINGS={
    notificationsEnabled:true,
    includeCritical:true,
    includeHigh:true,
    includeMedium:true,
    includeInfo:false,
    upcomingDays:7,
    browserEnabled:false,
    browserMinLevel:'high',
    weeklyDigestEnabled:false,
    weeklyDigestDay:1,
    weeklyDigestHour:'09:00',
    weeklyDigestEmail:''
  };
  const state={settings:{...DEFAULT_SETTINGS},states:{},loaded:false,uid:'',ref:null,callback:null,quickView:'active',browserShown:new Set(),lastRenderSig:'',digestVisible:false};

  const db=()=>typeof firebase!=='undefined'&&firebase.database?firebase.database():null;
  const auth=()=>typeof firebase!=='undefined'&&firebase.auth?firebase.auth():null;
  const text=v=>String(v===undefined||v===null?'':v).trim();
  const esc=v=>typeof window.escapeHtml==='function'?window.escapeHtml(String(v??'')):String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const obj=v=>v&&typeof v==='object'?v:{};
  const safeKey=v=>String(v||'').replace(/[^A-Za-z0-9_-]+/g,'_').slice(0,220);
  const nowIso=()=>new Date().toISOString();
  const actor=()=>{const a=auth(),u=a&&a.currentUser;return u?{uid:u.uid||'',email:u.email||'',displayName:u.displayName||''}:{uid:'',email:'',displayName:''};};
  const tasks=()=>typeof window.getActionCenterTasks==='function'?window.getActionCenterTasks():[];
  const levelRank=l=>LEVELS[l]?.rank||0;
  const isOpen=t=>t&&t.status!=='completed';
  const taskDue=t=>text(t.followUpDate||t.targetDate||'');

  function dayStart(d=new Date()){const x=new Date(d);x.setHours(0,0,0,0);return x;}
  function parseTime(s){const m=String(s||'09:00').match(/^(\d{1,2}):(\d{2})$/);return m?{h:Math.min(23,+m[1]),m:Math.min(59,+m[2])}:{h:9,m:0};}
  function weekStart(d=new Date()){const x=dayStart(d),day=x.getDay()||7;x.setDate(x.getDate()-(day-1));return x;}
  function weekKey(d=new Date()){const w=weekStart(d);return `${w.getFullYear()}-${String(w.getMonth()+1).padStart(2,'0')}-${String(w.getDate()).padStart(2,'0')}`;}
  function fmtDate(v){if(!v)return'-';const d=new Date(v);if(Number.isNaN(d.getTime()))return text(v)||'-';return d.toLocaleDateString('tr-TR');}
  function fmtDateTime(v){if(!v)return'-';const d=new Date(v);if(Number.isNaN(d.getTime()))return text(v)||'-';return d.toLocaleString('tr-TR',{dateStyle:'short',timeStyle:'short'});}

  function severityForTask(t){
    const timing=t&&t.timing||{};
    if(t.priority==='critical')return'critical';
    if(timing.code==='overdue'&&Number(timing.days||0)>=30)return'critical';
    if(timing.code==='overdue'||t.priority==='high'||timing.code==='today')return'high';
    if(t.status==='verification'||t.status==='external_wait')return'medium';
    if(timing.code==='future'&&Number(timing.days||999)<=Number(state.settings.upcomingDays||7))return'medium';
    if(timing.code==='no_date'&&['high','critical'].includes(t.priority))return'medium';
    return'info';
  }
  function levelAllowed(level){
    if(level==='critical')return !!state.settings.includeCritical;
    if(level==='high')return !!state.settings.includeHigh;
    if(level==='medium')return !!state.settings.includeMedium;
    return !!state.settings.includeInfo;
  }
  function taskRelevant(t){
    if(!isOpen(t))return false;
    const timing=t.timing||{};
    if(['overdue','today'].includes(timing.code))return true;
    if(timing.code==='future'&&Number(timing.days||999)<=Number(state.settings.upcomingDays||7))return true;
    if(['external_wait','verification'].includes(t.status))return true;
    if(t.priority==='critical'||t.priority==='high')return true;
    return false;
  }
  function taskFingerprint(t,level){return [t.status,t.priority,taskDue(t),t.timing&&t.timing.code,t.timing&&t.timing.days,level,t.owner,t.unit].map(text).join('|');}
  function timingText(t){const z=t.timing||{};if(z.code==='overdue')return `${z.days||0} gün gecikmiş`;if(z.code==='today')return'Bugün';if(z.code==='future')return `${z.days||0} gün kaldı`;return'Tarih yok';}
  function messageForTask(t){const bits=[SOURCE_LABELS[t.sourceType]||t.sourceType||'Görev'];if(t.area)bits.push(t.area);if(t.pq)bits.push(`PQ ${t.pq}`);bits.push(timingText(t));return bits.filter(Boolean).join(' · ');}

  function derivedTaskNotifications(){
    if(!state.settings.notificationsEnabled)return[];
    return tasks().filter(taskRelevant).map(t=>{
      const level=severityForTask(t);if(!levelAllowed(level))return null;
      const key=`action::${safeKey(t.key)}`;
      return {key,taskKey:t.key,kind:'action',level,title:t.title||'USOAP CMA görevi',message:messageForTask(t),description:t.description||'',sourceType:t.sourceType||'manual',area:t.area||'',pq:t.pq||'',targetDate:taskDue(t),timing:t.timing||{},status:t.status||'',fingerprint:taskFingerprint(t,level)};
    }).filter(Boolean);
  }

  function digestDue(){
    if(!state.settings.weeklyDigestEnabled)return false;
    const now=new Date(),start=weekStart(now),day=Math.min(7,Math.max(1,Number(state.settings.weeklyDigestDay)||1)),tm=parseTime(state.settings.weeklyDigestHour);
    const target=new Date(start);target.setDate(start.getDate()+(day-1));target.setHours(tm.h,tm.m,0,0);
    return now>=target;
  }
  function digestNotification(){
    if(!digestDue())return null;
    const wk=weekKey(),sum=actionSummary();
    return {key:`digest::${wk}`,taskKey:'',kind:'digest',level:sum.overdue||sum.critical?'high':'medium',title:'Haftalık USOAP CMA iş özeti hazır',message:`${sum.open} açık · ${sum.overdue} gecikmiş · ${sum.today} bugün · ${sum.external} dış cevap`,description:'Haftalık aksiyon özetini kopyalayabilir veya e-posta taslağı olarak açabilirsiniz.',sourceType:'digest',area:'',pq:'',targetDate:'',timing:{code:'today',days:0},status:'new',fingerprint:`${wk}|${sum.open}|${sum.overdue}|${sum.today}|${sum.external}|${sum.verification}`};
  }

  function rawNotifications(){const rows=derivedTaskNotifications(),d=digestNotification();if(d)rows.push(d);return rows;}
  function entryState(n){const s=obj(state.states[safeKey(n.key)]||state.states[n.key]);const sameDismiss=s.dismissedFingerprint===n.fingerprint;const sameRead=s.readFingerprint===n.fingerprint;const sameSnooze=s.snoozeFingerprint===n.fingerprint;const snoozeUntil=s.snoozeUntil?new Date(s.snoozeUntil):null;const snoozed=!!(sameSnooze&&snoozeUntil&&!Number.isNaN(snoozeUntil.getTime())&&snoozeUntil>new Date());return{...s,dismissed:sameDismiss,read:sameRead,snoozed};}
  function enrichedNotifications(){return rawNotifications().map(n=>({...n,uiState:entryState(n)})).sort((a,b)=>{
    const ad=a.uiState.dismissed?3:a.uiState.snoozed?2:a.uiState.read?1:0,bd=b.uiState.dismissed?3:b.uiState.snoozed?2:b.uiState.read?1:0;if(ad!==bd)return ad-bd;
    const lr=levelRank(b.level)-levelRank(a.level);if(lr)return lr;
    const ao=a.timing&&a.timing.code==='overdue'?0:a.timing&&a.timing.code==='today'?1:2,bo=b.timing&&b.timing.code==='overdue'?0:b.timing&&b.timing.code==='today'?1:2;if(ao!==bo)return ao-bo;
    return String(a.title).localeCompare(String(b.title),'tr');
  });}

  function actionSummary(){const rows=tasks().filter(isOpen);return{open:rows.length,overdue:rows.filter(t=>t.timing&&t.timing.code==='overdue').length,today:rows.filter(t=>t.timing&&t.timing.code==='today').length,external:rows.filter(t=>t.status==='external_wait').length,verification:rows.filter(t=>t.status==='verification').length,critical:rows.filter(t=>t.priority==='critical').length};}
  function summary(){const rows=enrichedNotifications(),active=rows.filter(n=>!n.uiState.dismissed&&!n.uiState.snoozed),unread=active.filter(n=>!n.uiState.read);return{total:rows.length,active:active.length,unread:unread.length,critical:active.filter(n=>n.level==='critical').length,high:active.filter(n=>n.level==='high').length,today:active.filter(n=>n.timing&&n.timing.code==='today').length,snoozed:rows.filter(n=>n.uiState.snoozed).length,dismissed:rows.filter(n=>n.uiState.dismissed).length};}

  function quickMatch(n){const s=n.uiState;if(state.quickView==='all')return !s.dismissed&&!s.snoozed;if(state.quickView==='unread')return !s.dismissed&&!s.snoozed&&!s.read;if(state.quickView==='critical')return !s.dismissed&&!s.snoozed&&['critical','high'].includes(n.level);if(state.quickView==='today')return !s.dismissed&&!s.snoozed&&n.timing&&n.timing.code==='today';if(state.quickView==='snoozed')return s.snoozed;if(state.quickView==='dismissed')return s.dismissed;return !s.dismissed&&!s.snoozed;}
  function filterRows(rows){const level=(document.getElementById('notificationLevelFilter')||{}).value||'all',source=(document.getElementById('notificationSourceFilter')||{}).value||'all',q=text((document.getElementById('notificationSearch')||{}).value).toLocaleLowerCase('tr');return rows.filter(quickMatch).filter(n=>level==='all'||n.level===level).filter(n=>source==='all'||n.sourceType===source).filter(n=>!q||[n.title,n.message,n.description,n.area,n.pq,SOURCE_LABELS[n.sourceType]].join(' ').toLocaleLowerCase('tr').includes(q));}

  function setText(id,v){const e=document.getElementById(id);if(e)e.textContent=String(v);}
  function renderNavBadge(sum){const badge=document.getElementById('notificationNavBadge');if(!badge)return;badge.textContent=sum.unread>99?'99+':String(sum.unread);badge.style.display=sum.unread?'inline-flex':'none';}
  function renderDashboard(sum){const el=document.getElementById('notificationCenterDashboardSummary');if(!el)return;el.innerHTML=`<div class="notification-dashboard-head"><div><b>🔔 Bildirim Merkezi</b><small>Kritik ve zaman duyarlı aksiyonlar · haftalık özet</small></div><button type="button" class="btn-outline" onclick="switchTab('notifications')">Bildirimleri Aç</button></div><div class="notification-dashboard-kpis"><span><b>${sum.unread}</b> okunmamış</span><span class="danger"><b>${sum.critical}</b> kritik</span><span><b>${sum.today}</b> bugün</span><span><b>${sum.snoozed}</b> ertelenmiş</span></div>`;}
  function renderKpis(sum){setText('notificationKpiUnread',sum.unread);setText('notificationKpiCritical',sum.critical);setText('notificationKpiHigh',sum.high);setText('notificationKpiToday',sum.today);setText('notificationKpiSnoozed',sum.snoozed);setText('notificationKpiActive',sum.active);}
  function renderQuick(){document.querySelectorAll('[data-notification-view]').forEach(b=>b.classList.toggle('active',b.dataset.notificationView===state.quickView));}
  function stateBadge(n){if(n.uiState.dismissed)return'<span class="notification-state dismissed">Kapatıldı</span>';if(n.uiState.snoozed)return`<span class="notification-state snoozed">${esc(fmtDateTime(n.uiState.snoozeUntil))} kadar ertelendi</span>`;if(n.uiState.read)return'<span class="notification-state read">Okundu</span>';return'<span class="notification-state unread">Yeni</span>';}
  function renderRows(rows){const body=document.getElementById('notificationTableBody');if(!body)return;if(!rows.length){body.innerHTML='<tr><td colspan="7" class="notification-empty">Seçili görünümde bildirim bulunmuyor.</td></tr>';return;}body.innerHTML=rows.map(n=>`<tr class="notification-row level-${n.level} ${n.uiState.read?'is-read':'is-unread'}"><td><span class="notification-level ${n.level}">${LEVELS[n.level]?.icon||'•'} ${esc(LEVELS[n.level]?.label||n.level)}</span><br>${stateBadge(n)}</td><td><b>${esc(n.title)}</b><br><small>${esc(n.description||n.message)}</small></td><td><span class="notification-source">${esc(SOURCE_LABELS[n.sourceType]||n.sourceType)}</span>${n.area?`<br><small>${esc(n.area)}${n.pq?` · PQ ${esc(n.pq)}`:''}</small>`:''}</td><td>${esc(n.message)}</td><td>${n.targetDate?esc(n.targetDate):'-'}</td><td>${n.uiState.snoozed?esc(fmtDateTime(n.uiState.snoozeUntil)):'-'}</td><td><div class="notification-row-actions">${!n.uiState.read&&!n.uiState.dismissed?`<button type="button" class="btn-outline" onclick="markNotificationRead('${esc(n.key)}')">✓ Oku</button>`:''}${!n.uiState.dismissed?`<button type="button" class="btn-outline" onclick="snoozeNotification('${esc(n.key)}',1)">⏰ 1 gün</button><button type="button" class="btn-outline" onclick="dismissNotification('${esc(n.key)}')">✕ Kapat</button>`:`<button type="button" class="btn-outline" onclick="restoreNotification('${esc(n.key)}')">↩ Geri getir</button>`}<button type="button" onclick="openNotificationSource('${esc(n.key)}')">↗ Kaynak</button></div></td></tr>`).join('');}

  function settingsToUi(){const s=state.settings;[['notificationEnabled','notificationsEnabled'],['notificationIncludeCritical','includeCritical'],['notificationIncludeHigh','includeHigh'],['notificationIncludeMedium','includeMedium'],['notificationIncludeInfo','includeInfo'],['notificationBrowserEnabled','browserEnabled'],['notificationWeeklyEnabled','weeklyDigestEnabled']].forEach(([id,k])=>{const e=document.getElementById(id);if(e&&!e.matches(':focus'))e.checked=!!s[k];});const map={notificationUpcomingDays:'upcomingDays',notificationBrowserMin:'browserMinLevel',notificationWeeklyDay:'weeklyDigestDay',notificationWeeklyHour:'weeklyDigestHour',notificationWeeklyEmail:'weeklyDigestEmail'};Object.entries(map).forEach(([id,k])=>{const e=document.getElementById(id);if(e&&!e.matches(':focus'))e.value=s[k]??'';});const p=document.getElementById('notificationBrowserPermission');if(p)p.textContent=typeof Notification==='undefined'?'Desteklenmiyor':Notification.permission==='granted'?'İzin verildi':Notification.permission==='denied'?'Engellendi':'İzin bekliyor';}
  function renderDigest(){const wrap=document.getElementById('notificationDigestPanel'),ta=document.getElementById('notificationDigestText');if(!wrap||!ta)return;wrap.style.display=state.digestVisible?'block':'none';if(state.digestVisible)ta.value=buildWeeklyDigestText();}
  function render(){const rows=enrichedNotifications(),sum=summary();renderNavBadge(sum);renderDashboard(sum);if(!document.getElementById('tab-notifications'))return;renderKpis(sum);renderQuick();renderRows(filterRows(rows));settingsToUi();renderDigest();const info=document.getElementById('notificationContext');if(info)info.innerHTML=`<b>${sum.active}</b> aktif bildirim · <b>${sum.unread}</b> okunmamış · bildirimler Aksiyon Merkezi verisinden anlık türetilir; yalnız okundu/ertele/kapat tercihleri Firebase'e kaydedilir.`;maybeBrowserNotify(rows);}

  async function userUpdate(path,payload){const d=db(),u=auth()&&auth().currentUser;if(!d||!u)throw new Error('Yetkili giriş gereklidir.');return d.ref(`${ROOT}/users/${u.uid}/${path}`).update(payload);}
  function findNotification(key){return enrichedNotifications().find(n=>n.key===key)||null;}
  async function markRead(key){const n=findNotification(key);if(!n)return;try{await userUpdate(`states/${safeKey(key)}`,{readFingerprint:n.fingerprint,readAt:nowIso(),updatedAt:nowIso(),updatedBy:actor()});}catch(e){alert('Bildirim güncellenemedi: '+(e.message||e));}}
  async function snooze(key,days){const n=findNotification(key);if(!n)return;const until=new Date();until.setDate(until.getDate()+Math.max(1,Number(days)||1));try{await userUpdate(`states/${safeKey(key)}`,{snoozeFingerprint:n.fingerprint,snoozeUntil:until.toISOString(),readFingerprint:n.fingerprint,readAt:nowIso(),updatedAt:nowIso(),updatedBy:actor()});}catch(e){alert('Bildirim ertelenemedi: '+(e.message||e));}}
  async function dismiss(key){const n=findNotification(key);if(!n)return;try{await userUpdate(`states/${safeKey(key)}`,{dismissedFingerprint:n.fingerprint,dismissedAt:nowIso(),readFingerprint:n.fingerprint,readAt:nowIso(),snoozeFingerprint:null,snoozeUntil:null,updatedAt:nowIso(),updatedBy:actor()});}catch(e){alert('Bildirim kapatılamadı: '+(e.message||e));}}
  async function restore(key){try{await userUpdate(`states/${safeKey(key)}`,{dismissedFingerprint:null,dismissedAt:null,snoozeFingerprint:null,snoozeUntil:null,updatedAt:nowIso(),updatedBy:actor()});}catch(e){alert('Bildirim geri getirilemedi: '+(e.message||e));}}
  async function markAllRead(){const rows=enrichedNotifications().filter(n=>!n.uiState.dismissed&&!n.uiState.snoozed&&!n.uiState.read);if(!rows.length)return;const updates={},ts=nowIso(),who=actor();rows.forEach(n=>{const k=`states/${safeKey(n.key)}`;updates[`${k}/readFingerprint`]=n.fingerprint;updates[`${k}/readAt`]=ts;updates[`${k}/updatedAt`]=ts;updates[`${k}/updatedBy`]=who;});const d=db(),u=auth()&&auth().currentUser;if(!d||!u)return alert('Yetkili giriş gereklidir.');try{await d.ref(`${ROOT}/users/${u.uid}`).update(updates);}catch(e){alert('Bildirimler güncellenemedi: '+(e.message||e));}}

  function setQuickView(view){state.quickView=view||'active';render();}
  function clearFilters(){['notificationLevelFilter','notificationSourceFilter'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='all';});const q=document.getElementById('notificationSearch');if(q)q.value='';state.quickView='active';render();}
  async function saveSettings(){const d=db(),u=auth()&&auth().currentUser;if(!d||!u)return alert('Ayarları kaydetmek için giriş gereklidir.');const s={notificationsEnabled:!!document.getElementById('notificationEnabled')?.checked,includeCritical:!!document.getElementById('notificationIncludeCritical')?.checked,includeHigh:!!document.getElementById('notificationIncludeHigh')?.checked,includeMedium:!!document.getElementById('notificationIncludeMedium')?.checked,includeInfo:!!document.getElementById('notificationIncludeInfo')?.checked,upcomingDays:Math.max(1,Math.min(60,Number(document.getElementById('notificationUpcomingDays')?.value)||7)),browserEnabled:!!document.getElementById('notificationBrowserEnabled')?.checked,browserMinLevel:document.getElementById('notificationBrowserMin')?.value||'high',weeklyDigestEnabled:!!document.getElementById('notificationWeeklyEnabled')?.checked,weeklyDigestDay:Number(document.getElementById('notificationWeeklyDay')?.value)||1,weeklyDigestHour:document.getElementById('notificationWeeklyHour')?.value||'09:00',weeklyDigestEmail:text(document.getElementById('notificationWeeklyEmail')?.value),updatedAt:nowIso(),updatedBy:actor()};try{await d.ref(`${ROOT}/users/${u.uid}/settings`).set(s);if(typeof window.showAppRuntimeToast==='function')window.showAppRuntimeToast('Bildirim ayarları kaydedildi.','success');}catch(e){alert('Bildirim ayarları kaydedilemedi: '+(e.message||e));}}

  async function requestBrowserPermission(){if(typeof Notification==='undefined')return alert('Bu tarayıcı sistem bildirimi özelliğini desteklemiyor.');try{const permission=await Notification.requestPermission();const box=document.getElementById('notificationBrowserEnabled');if(box)box.checked=permission==='granted';if(permission==='granted'){new Notification('USOAP CMA Bildirim Merkezi',{body:'Tarayıcı bildirimleri etkinleştirildi.',tag:'usoap-notification-test'});if(typeof window.showAppRuntimeToast==='function')window.showAppRuntimeToast('Tarayıcı bildirim izni verildi.','success');}else alert('Tarayıcı bildirim izni verilmedi. Tarayıcı site ayarlarından daha sonra değiştirebilirsiniz.');render();}catch(e){alert('Bildirim izni alınamadı: '+(e.message||e));}}
  function browserLevelAllowed(level){return levelRank(level)>=levelRank(state.settings.browserMinLevel||'high');}
  async function maybeBrowserNotify(rows){if(!state.settings.browserEnabled||typeof Notification==='undefined'||Notification.permission!=='granted')return;const candidates=rows.filter(n=>!n.uiState.dismissed&&!n.uiState.snoozed&&!n.uiState.read&&browserLevelAllowed(n.level)).filter(n=>{const s=n.uiState;return s.lastBrowserFingerprint!==n.fingerprint&&!state.browserShown.has(`${n.key}|${n.fingerprint}`);}).slice(0,3);if(!candidates.length)return;const d=db(),u=auth()&&auth().currentUser,updates={};candidates.forEach(n=>{try{const nt=new Notification(`USOAP CMA · ${LEVELS[n.level]?.label||'Bildirim'}`,{body:n.title,tag:`usoap-${safeKey(n.key)}`,renotify:false});nt.onclick=()=>{window.focus();openSource(n.key);};}catch(_){}state.browserShown.add(`${n.key}|${n.fingerprint}`);if(u){const base=`states/${safeKey(n.key)}`;updates[`${base}/lastBrowserFingerprint`]=n.fingerprint;updates[`${base}/lastBrowserAt`]=nowIso();}});if(d&&u&&Object.keys(updates).length){try{await d.ref(`${ROOT}/users/${u.uid}`).update(updates);}catch(_){}}}

  async function openSource(key){const n=findNotification(key);if(!n)return;if(!n.uiState.read)markRead(key);if(n.kind==='digest'){state.digestVisible=true;switchTabSafe('notifications');renderDigest();return;}if(n.taskKey&&typeof window.openActionSource==='function')window.openActionSource(n.taskKey);else switchTabSafe('actions');}
  function switchTabSafe(tab){if(typeof window.switchTab==='function')window.switchTab(tab);}

  function buildWeeklyDigestText(){const a=actionSummary(),rows=tasks().filter(isOpen),over=rows.filter(t=>t.timing&&t.timing.code==='overdue'),week=rows.filter(t=>t.timing&&t.timing.code==='future'&&Number(t.timing.days||999)<=7),external=rows.filter(t=>t.status==='external_wait'),verify=rows.filter(t=>t.status==='verification'),critical=rows.filter(t=>['critical','high'].includes(t.priority)).slice(0,10);const lines=[];lines.push('USOAP CMA - Haftalık Aksiyon Özeti');lines.push(`Tarih: ${new Date().toLocaleDateString('tr-TR')}`);lines.push('');lines.push(`Açık görev: ${a.open}`);lines.push(`Gecikmiş: ${a.overdue}`);lines.push(`Bugün: ${a.today}`);lines.push(`Dış cevap bekleyen: ${a.external}`);lines.push(`Doğrulama bekleyen: ${a.verification}`);lines.push('');const add=(title,list)=>{lines.push(title);if(!list.length)lines.push('- Kayıt yok');else list.slice(0,10).forEach(t=>lines.push(`- ${t.title}${taskDue(t)?` (${taskDue(t)})`:''}`));lines.push('');};add('GECİKMİŞ',over);add('ÖNÜMÜZDEKİ 7 GÜN',week);add('DIŞ CEVAP BEKLEYEN',external);add('DOĞRULAMA BEKLEYEN',verify);add('YÜKSEK ÖNCELİKLİ',critical);lines.push('Not: Bu özet uygulamadaki güncel Aksiyon Merkezi verilerinden oluşturulmuştur.');return lines.join('\n');}
  function showDigest(){state.digestVisible=true;renderDigest();const p=document.getElementById('notificationDigestPanel');if(p)p.scrollIntoView({behavior:'smooth',block:'start'});}
  async function copyDigest(){const s=buildWeeklyDigestText();try{await navigator.clipboard.writeText(s);if(typeof window.showAppRuntimeToast==='function')window.showAppRuntimeToast('Haftalık özet panoya kopyalandı.','success');}catch(_){const ta=document.getElementById('notificationDigestText');if(ta){ta.value=s;ta.select();document.execCommand('copy');}}}
  function openEmailDraft(){const recipient=text(state.settings.weeklyDigestEmail||document.getElementById('notificationWeeklyEmail')?.value),subject=`USOAP CMA Haftalık Aksiyon Özeti - ${new Date().toLocaleDateString('tr-TR')}`,body=buildWeeklyDigestText().slice(0,12000);window.location.href=`mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;}

  function exportRows(){return filterRows(enrichedNotifications()).map(n=>({'Seviye':LEVELS[n.level]?.label||n.level,'Başlık':n.title,'Kaynak':SOURCE_LABELS[n.sourceType]||n.sourceType,'Alan':n.area,'PQ':n.pq,'Durum':n.uiState.dismissed?'Kapatıldı':n.uiState.snoozed?'Ertelendi':n.uiState.read?'Okundu':'Okunmamış','Zaman':n.message,'Hedef Tarih':n.targetDate,'Erteleme':n.uiState.snoozeUntil||'','Açıklama':n.description||''}));}
  function exportExcel(){const rows=exportRows();if(!rows.length)return alert('Dışa aktarılacak bildirim bulunamadı.');if(typeof createReportWorkbook!=='function'||typeof addJsonSheet!=='function')return alert('Excel rapor altyapısı bulunamadı.');const wb=createReportWorkbook({title:'USOAP CMA Bildirim Merkezi',subject:'Bildirim ve otomasyon'});addJsonSheet(wb,'Bildirimler',rows);addJsonSheet(wb,'Kritik_Yuksek',rows.filter(r=>['Kritik','Yüksek'].includes(r.Seviye)));downloadReportWorkbook(wb,'USOAP_Bildirim_Merkezi.xlsx');}
  function exportPDF(){const rows=exportRows();if(!rows.length)return alert('Dışa aktarılacak bildirim bulunamadı.');const body=[[{text:'Seviye',bold:true},{text:'Başlık',bold:true},{text:'Kaynak',bold:true},{text:'Durum',bold:true},{text:'Hedef',bold:true}]].concat(rows.map(r=>[r.Seviye,r.Başlık,r.Kaynak,r.Durum,r['Hedef Tarih']||'-']));const def={pageOrientation:'landscape',pageSize:'A4',content:[{text:'USOAP CMA Bildirim Merkezi',style:'header'},{text:`Rapor tarihi: ${new Date().toLocaleDateString('tr-TR')} · Bildirim: ${rows.length}`,style:'subheader'},{table:{headerRows:1,widths:['auto','*','auto','auto','auto'],body},layout:'lightHorizontalLines'}],styles:{header:{fontSize:17,bold:true,color:'#2563eb',margin:[0,0,0,4]},subheader:{fontSize:9,color:'#64748b',margin:[0,0,0,10]}},defaultStyle:{font:'Roboto',fontSize:8}};if(typeof window.safeDownloadPdf==='function')return window.safeDownloadPdf(def,'USOAP_Bildirim_Merkezi.pdf');if(typeof pdfMake!=='undefined')return pdfMake.createPdf(def).download('USOAP_Bildirim_Merkezi.pdf');}

  function attach(){detach();const a=auth(),u=a&&a.currentUser;if(!u){state.loaded=true;render();return;}const d=db();if(!d)return;state.uid=u.uid;state.ref=d.ref(`${ROOT}/users/${u.uid}`);state.callback=s=>{const v=s.val()||{};state.settings={...DEFAULT_SETTINGS,...obj(v.settings)};state.states=obj(v.states);state.loaded=true;render();};state.ref.on('value',state.callback,e=>{console.error('Bildirim merkezi okunamadı:',e);state.loaded=true;render();});}
  function detach(){if(state.ref&&state.callback)state.ref.off('value',state.callback);state.ref=null;state.callback=null;state.uid='';state.settings={...DEFAULT_SETTINGS};state.states={};state.loaded=false;state.browserShown.clear();render();}
  function selfCheck(){const sum=summary(),result={passed:!!document.getElementById('tab-notifications')&&typeof window.getActionCenterTasks==='function',moduleVersion:MODULE_VERSION,path:`${ROOT}/users/{uid}`,notifications:sum.total,active:sum.active,unread:sum.unread,browserSupport:typeof Notification!=='undefined',permission:typeof Notification!=='undefined'?Notification.permission:'unsupported'};console.log('Bildirim Merkezi öz denetimi:',result);return result;}

  window.renderNotificationCenter=render;
  window.refreshNotificationCenterFromActions=render;
  window.setNotificationQuickView=setQuickView;
  window.clearNotificationFilters=clearFilters;
  window.markNotificationRead=markRead;
  window.markAllNotificationsRead=markAllRead;
  window.snoozeNotification=snooze;
  window.dismissNotification=dismiss;
  window.restoreNotification=restore;
  window.openNotificationSource=openSource;
  window.saveNotificationSettings=saveSettings;
  window.requestNotificationPermission=requestBrowserPermission;
  window.showWeeklyNotificationDigest=showDigest;
  window.copyWeeklyNotificationDigest=copyDigest;
  window.openWeeklyNotificationEmailDraft=openEmailDraft;
  window.buildWeeklyNotificationDigestText=buildWeeklyDigestText;
  window.exportNotificationCenterExcel=exportExcel;
  window.exportNotificationCenterPDF=exportPDF;
  window.getNotificationCenterSummary=summary;
  window.getNotificationCenterRows=enrichedNotifications;
  window.runNotificationCenterSelfCheck=selfCheck;

  document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{render();const a=auth();if(a)a.onAuthStateChanged(u=>u?attach():detach());setInterval(()=>{if(document.visibilityState==='visible')render();},60000);},0));
})();
