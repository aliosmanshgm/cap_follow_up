// Faz 11 - Google Drive Dokuman & Kanit Merkezi
// Dosyanin kendisi Google Drive'da; Firebase RTDB yalniz metadata/iliski kaydini tutar.
(function(){
  'use strict';

  const DB_ROOT='icao_document_hub';
  const SETTINGS_PATH=DB_ROOT+'/settings';
  const RECORDS_PATH=DB_ROOT+'/records';
  const DRIVE_SCOPE='https://www.googleapis.com/auth/drive.file';
  const GIS_SRC='https://accounts.google.com/gsi/client';
  const DRIVE_API='https://www.googleapis.com/drive/v3';
  const DRIVE_UPLOAD_API='https://www.googleapis.com/upload/drive/v3/files';
  const ROOT_FOLDER_DEFAULT='USOAP CMA CAP Takip';
  const AREAS=['LEG','ORG','PEL','OPS','AIR','AIG','ANS','AGA'];
  const TYPE_LABELS={
    'pq-source':'PQ Kaynak Belgesi',
    'cap-evidence':'CAP Kaniti',
    'visit-evidence':'Ziyaret Kaniti',
    'icao-report':'ICAO Raporu / Resmi Belge',
    'ei-source':'EI / OLF Kaynak Dosyasi',
    'other':'Diger'
  };

  const state={
    settings:{clientId:'',rootFolderId:'',rootFolderName:ROOT_FOLDER_DEFAULT,autoArchivePq:false},
    records:{},
    connected:false,
    accessToken:'',
    tokenExpiresAt:0,
    tokenClient:null,
    accountLabel:'',
    loading:false,
    loaded:false,
    gisPromise:null,
    folderCache:new Map(),
    liveAttached:false
  };

  function nowIso(){return new Date().toISOString();}
  function currentUser(){try{return firebase.auth().currentUser||null;}catch(_){return null;}}
  function userLabel(){const u=currentUser();return u?(u.displayName||u.email||u.uid||''):'';}
  function escapeHtml(v){return String(v==null?'':v).replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));}
  function normalizePq(v){v=String(v||'').trim().replace(',','.');const m=v.match(/\b(\d{1,2}\.\d{3})\b/);return m?m[1]:v;}
  function safeDbKey(v){return String(v||'').replace(/[.#$\[\]\/]/g,'_');}
  function makeId(prefix='doc'){return prefix+'_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,9);}
  function toArray(value){if(!value)return[];if(Array.isArray(value))return value;return Object.keys(value).sort().map(k=>value[k]).filter(Boolean);}
  function firebaseSafe(v){return window.visitFirebaseSafeValue?window.visitFirebaseSafeValue(v):v;}
  function toast(msg,type='info'){if(typeof window.showAppRuntimeToast==='function')window.showAppRuntimeToast(msg,type);else console.log(msg);}
  function isConfigured(){return !!String(state.settings.clientId||'').trim();}
  function tokenUsable(){return !!state.accessToken && Date.now()<state.tokenExpiresAt-60000;}

  function normalizeSettings(raw){raw=raw&&typeof raw==='object'?raw:{};return{
    clientId:String(raw.clientId||''),
    rootFolderId:String(raw.rootFolderId||''),
    rootFolderName:String(raw.rootFolderName||ROOT_FOLDER_DEFAULT)||ROOT_FOLDER_DEFAULT,
    autoArchivePq:raw.autoArchivePq===true,
    updatedAt:String(raw.updatedAt||''),
    updatedBy:String(raw.updatedBy||'')
  };}
  function normalizeRecord(id,raw){raw=raw&&typeof raw==='object'?raw:{};return{
    id:String(raw.id||id||''), provider:String(raw.provider||'google-drive'), source:String(raw.source||'link'),
    driveFileId:String(raw.driveFileId||''), name:String(raw.name||raw.fileName||''), mimeType:String(raw.mimeType||''), size:Number(raw.size||0)||0,
    sha256:String(raw.sha256||''), webViewLink:String(raw.webViewLink||raw.url||''), webContentLink:String(raw.webContentLink||''), folderId:String(raw.folderId||''),
    documentType:String(raw.documentType||'other'), area:String(raw.area||'').toUpperCase(), pq:normalizePq(raw.pq||''), step:String(raw.step||''), pqConceptId:String(raw.pqConceptId||''),
    pqEditionKey:String(raw.pqEditionKey||''), pqDocumentId:String(raw.pqDocumentId||''), visitId:String(raw.visitId||''), visitName:String(raw.visitName||''),
    assessmentEventId:String(raw.assessmentEventId||''), officialEiRecordId:String(raw.officialEiRecordId||''),
    description:String(raw.description||''), tags:Array.isArray(raw.tags)?raw.tags:toArray(raw.tags), status:String(raw.status||'active'),
    createdAt:String(raw.createdAt||''), createdBy:String(raw.createdBy||''), updatedAt:String(raw.updatedAt||''), updatedBy:String(raw.updatedBy||''),
    driveCreatedTime:String(raw.driveCreatedTime||''), driveModifiedTime:String(raw.driveModifiedTime||'')
  };}

  async function loadHub(force=false){
    if(state.loading)return state;
    if(state.loaded&&!force)return state;
    if(typeof db==='undefined'||!db)return state;
    state.loading=true;
    try{
      const snap=await db.ref(DB_ROOT).once('value');
      const raw=snap.exists()?snap.val():{};
      state.settings=normalizeSettings(raw&&raw.settings);
      const recordsRaw=raw&&raw.records&&typeof raw.records==='object'?raw.records:{};
      state.records={};Object.keys(recordsRaw).forEach(id=>state.records[id]=normalizeRecord(id,recordsRaw[id]));
      state.loaded=true;
    }catch(err){console.warn('Dokuman merkezi okunamadi:',err);toast('Dokuman merkezi Firebase uzerinden okunamadi.','error');}
    finally{state.loading=false;}
    return state;
  }

  async function saveSettings(partial){
    if(typeof db==='undefined'||!db)throw new Error('Firebase Realtime Database baglantisi bulunamadi.');
    if(!currentUser())throw new Error('Ayar kaydi icin yetkili kullanici girisi gerekir.');
    state.settings=normalizeSettings({...state.settings,...partial,updatedAt:nowIso(),updatedBy:userLabel()});
    await db.ref(SETTINGS_PATH).set(firebaseSafe(state.settings));
    render();
    return state.settings;
  }

  function loadGis(){
    if(window.google&&google.accounts&&google.accounts.oauth2)return Promise.resolve(true);
    if(state.gisPromise)return state.gisPromise;
    state.gisPromise=new Promise((resolve,reject)=>{
      const existing=document.querySelector(`script[src="${GIS_SRC}"]`);
      if(existing){const poll=setInterval(()=>{if(window.google&&google.accounts&&google.accounts.oauth2){clearInterval(poll);resolve(true);}},100);setTimeout(()=>{clearInterval(poll);reject(new Error('Google Identity Services yuklenemedi.'));},10000);return;}
      const s=document.createElement('script');s.src=GIS_SRC;s.async=true;s.defer=true;s.onload=()=>resolve(true);s.onerror=()=>reject(new Error('Google Identity Services kutuphanesi yuklenemedi.'));document.head.appendChild(s);
    });
    return state.gisPromise;
  }

  async function initTokenClient(){
    if(!isConfigured())throw new Error('Once Google OAuth Web Client ID ayarini kaydedin.');
    await loadGis();
    state.tokenClient=google.accounts.oauth2.initTokenClient({
      client_id:state.settings.clientId,
      scope:DRIVE_SCOPE,
      callback:()=>{}
    });
    return state.tokenClient;
  }

  function requestToken(promptMode='consent'){
    return new Promise(async(resolve,reject)=>{
      try{
        const client=state.tokenClient||await initTokenClient();
        client.callback=(resp)=>{
          if(resp&&resp.error){state.connected=false;reject(new Error(resp.error_description||resp.error));return;}
          state.accessToken=String(resp&&resp.access_token||'');
          state.tokenExpiresAt=Date.now()+((Number(resp&&resp.expires_in)||3500)*1000);
          state.connected=!!state.accessToken;
          if(!state.connected){reject(new Error('Google Drive erisim tokeni alinamadi.'));return;}
          resolve(state.accessToken);
        };
        client.requestAccessToken({prompt:promptMode});
      }catch(err){reject(err);}
    });
  }

  async function ensureToken(interactive=false){
    if(tokenUsable())return state.accessToken;
    if(!interactive)throw Object.assign(new Error('Google Drive oturumu bagli degil.'),{code:'DRIVE_NOT_CONNECTED'});
    return requestToken(state.accessToken?'':'consent');
  }

  async function driveFetch(url,options={},interactive=false){
    const token=await ensureToken(interactive);
    const headers=new Headers(options.headers||{});headers.set('Authorization','Bearer '+token);
    const res=await fetch(url,{...options,headers});
    if(res.status===401&&interactive){state.accessToken='';state.connected=false;await ensureToken(true);return driveFetch(url,options,false);}
    if(!res.ok){let detail='';try{detail=await res.text();}catch(_){}throw new Error(`Google Drive API hatasi (${res.status}). ${detail.slice(0,260)}`);}
    if(res.status===204)return null;
    const ct=res.headers.get('content-type')||'';return ct.includes('json')?res.json():res.text();
  }

  async function loadDriveAccount(){
    try{const info=await driveFetch(`${DRIVE_API}/about?fields=user(displayName,emailAddress)`,{},false);state.accountLabel=[info&&info.user&&info.user.displayName,info&&info.user&&info.user.emailAddress].filter(Boolean).join(' · ');}catch(_){state.accountLabel='Google Drive bagli';}
  }

  async function connectDrive(){
    try{
      await loadHub();await ensureToken(true);await loadDriveAccount();state.connected=true;toast('Google Drive baglantisi kuruldu.','ok');render();
      if(!state.settings.rootFolderId)await ensureRootFolder(true);
    }catch(err){state.connected=false;render();alert('Google Drive baglantisi kurulamadi: '+(err.message||err));}
  }

  async function disconnectDrive(){
    const token=state.accessToken;state.accessToken='';state.tokenExpiresAt=0;state.connected=false;state.accountLabel='';
    try{if(token&&window.google&&google.accounts&&google.accounts.oauth2)google.accounts.oauth2.revoke(token,()=>{});}catch(_){}
    render();toast('Google Drive oturum baglantisi kapatildi.','info');
  }

  async function createFolder(name,parentId=''){
    const metadata={name,mimeType:'application/vnd.google-apps.folder',appProperties:{usoapApp:'usoap-cma-cap-takip'}};
    if(parentId)metadata.parents=[parentId];
    return driveFetch(`${DRIVE_API}/files?fields=id,name,mimeType,webViewLink,createdTime,modifiedTime`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(metadata)},false);
  }

  async function ensureRootFolder(interactive=false){
    if(state.settings.rootFolderId)return state.settings.rootFolderId;
    if(!tokenUsable())await ensureToken(interactive);
    const folder=await createFolder(state.settings.rootFolderName||ROOT_FOLDER_DEFAULT);
    if(!folder||!folder.id)throw new Error('Drive kok klasoru olusturulamadi.');
    await saveSettings({rootFolderId:folder.id});
    state.folderCache.set('root',folder.id);toast(`Drive kok klasoru olusturuldu: ${folder.name||state.settings.rootFolderName}`,'ok');return folder.id;
  }

  function typeFolderName(type){return ({'pq-source':'01_PQ_Kaynaklari','cap-evidence':'02_CAP_Kanitlari','visit-evidence':'03_Ziyaret_Kanitlari','icao-report':'04_ICAO_Raporlari','ei-source':'05_EI_OLF_Kaynaklari','other':'99_Diger'})[type]||'99_Diger';}

  async function ensureTypeFolder(type){
    const root=await ensureRootFolder(false),cacheKey=`type:${type}`;
    if(state.folderCache.has(cacheKey))return state.folderCache.get(cacheKey);
    const q=`name='${typeFolderName(type).replace(/'/g,"\\'")}' and '${root}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    try{
      const res=await driveFetch(`${DRIVE_API}/files?q=${encodeURIComponent(q)}&spaces=drive&fields=files(id,name)&pageSize=10`,{},false);
      if(res&&res.files&&res.files[0]){state.folderCache.set(cacheKey,res.files[0].id);return res.files[0].id;}
    }catch(_){/* drive.file ile arama kisitli olabilir; yeni klasor olusturulur */}
    const folder=await createFolder(typeFolderName(type),root);state.folderCache.set(cacheKey,folder.id);return folder.id;
  }

  async function sha256(file){try{if(!crypto||!crypto.subtle||!file||!file.arrayBuffer)return'';const hash=await crypto.subtle.digest('SHA-256',await file.arrayBuffer());return[...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('');}catch(_){return'';}}

  async function uploadFile(file,meta={}){
    if(!file)throw new Error('Yuklenecek dosya secilmedi.');
    await ensureToken(false);
    const folderId=await ensureTypeFolder(meta.documentType||'other');
    const metadata={name:file.name,parents:[folderId],appProperties:{usoapApp:'usoap-cma-cap-takip',documentType:String(meta.documentType||'other'),area:String(meta.area||''),pq:String(meta.pq||'')}};
    const boundary='usoap_'+Math.random().toString(36).slice(2)+Date.now().toString(36);
    const body=new Blob([
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,JSON.stringify(metadata),
      `\r\n--${boundary}\r\nContent-Type: ${file.type||'application/octet-stream'}\r\n\r\n`,file,
      `\r\n--${boundary}--`
    ]);
    const fields='id,name,mimeType,size,webViewLink,webContentLink,createdTime,modifiedTime,parents';
    const result=await driveFetch(`${DRIVE_UPLOAD_API}?uploadType=multipart&fields=${encodeURIComponent(fields)}`,{method:'POST',headers:{'Content-Type':`multipart/related; boundary=${boundary}`},body},false);
    return {...result,sha256:await sha256(file),folderId};
  }

  async function saveRecord(raw){
    if(typeof db==='undefined'||!db)throw new Error('Firebase Realtime Database baglantisi bulunamadi.');
    if(!currentUser())throw new Error('Dokuman kaydi icin yetkili kullanici girisi gerekir.');
    const id=raw.id||makeId(),existing=state.records[id]||{},ts=nowIso();
    const rec=normalizeRecord(id,{...existing,...raw,id,createdAt:existing.createdAt||ts,createdBy:existing.createdBy||userLabel(),updatedAt:ts,updatedBy:userLabel()});
    await db.ref(`${RECORDS_PATH}/${safeDbKey(id)}`).set(firebaseSafe(rec));state.records[id]=rec;render();return rec;
  }

  async function removeRecord(id){
    const rec=state.records[id];if(!rec)return;
    if(!confirm(`Dokuman merkezi kaydi silinsin mi?\n\n${rec.name}\n\nDrive dosyasinin kendisi SILINMEYECEK.`))return;
    await db.ref(`${RECORDS_PATH}/${safeDbKey(id)}`).remove();delete state.records[id];render();toast('Metadata kaydi silindi; Drive dosyasi korunuyor.','ok');
  }

  function extractDriveId(url){
    const s=String(url||'').trim();if(!s)return'';
    const pats=[/\/d\/([A-Za-z0-9_-]{15,})/,/[?&]id=([A-Za-z0-9_-]{15,})/,/\/folders\/([A-Za-z0-9_-]{15,})/];
    for(const p of pats){const m=s.match(p);if(m)return m[1];}return'';
  }

  function readForm(prefix){
    const val=id=>String((document.getElementById(prefix+id)||{}).value||'').trim();
    const visitId=val('Visit'),visit=visitOptions().find(v=>String(v.id||v.visitId||'')===visitId)||{};
    return{documentType:val('Type')||'other',area:val('Area').toUpperCase(),pq:normalizePq(val('Pq')),step:val('Step'),visitId,visitName:String(visit.visitName||visit.name||''),description:val('Description'),tags:val('Tags').split(',').map(x=>x.trim()).filter(Boolean)};
  }

  async function uploadFromUi(){
    const input=document.getElementById('driveDocFile'),file=input&&input.files&&input.files[0];if(!file)return alert('Once bir dosya secin.');
    const meta=readForm('driveDoc');
    try{
      setBusy(true,'Drive dosya yuklemesi yapiliyor...');
      const d=await uploadFile(file,meta);
      await saveRecord({...meta,provider:'google-drive',source:'upload',driveFileId:d.id,name:d.name||file.name,mimeType:d.mimeType||file.type,size:Number(d.size||file.size)||0,sha256:d.sha256||'',webViewLink:d.webViewLink||`https://drive.google.com/open?id=${d.id}`,webContentLink:d.webContentLink||'',folderId:d.folderId||'',driveCreatedTime:d.createdTime||'',driveModifiedTime:d.modifiedTime||''});
      if(input)input.value='';toast('Dosya Google Drive\'a yuklendi ve dokuman merkezine kaydedildi.','ok');
    }catch(err){alert('Dosya yuklenemedi: '+(err.message||err));}
    finally{setBusy(false);}
  }

  async function registerLinkFromUi(){
    const meta=readForm('driveLink'),url=String((document.getElementById('driveLinkUrl')||{}).value||'').trim(),name=String((document.getElementById('driveLinkName')||{}).value||'').trim();
    if(!url)return alert('Google Drive baglantisini girin.');
    const fileId=extractDriveId(url);
    if(!fileId&&!/drive\.google\.com/i.test(url))return alert('Gecerli bir Google Drive baglantisi girin.');
    try{
      await saveRecord({...meta,provider:'google-drive',source:'link',driveFileId:fileId,name:name||'Drive belgesi',webViewLink:url,mimeType:'',size:0});
      document.getElementById('driveLinkUrl').value='';document.getElementById('driveLinkName').value='';toast('Mevcut Drive baglantisi kaydedildi.','ok');
    }catch(err){alert('Drive baglantisi kaydedilemedi: '+(err.message||err));}
  }

  async function saveSettingsFromUi(){
    const clientId=String((document.getElementById('driveClientId')||{}).value||'').trim();
    const rootFolderName=String((document.getElementById('driveRootFolderName')||{}).value||ROOT_FOLDER_DEFAULT).trim()||ROOT_FOLDER_DEFAULT;
    const autoArchivePq=!!((document.getElementById('driveAutoArchivePq')||{}).checked);
    try{await saveSettings({clientId,rootFolderName,autoArchivePq});state.tokenClient=null;state.accessToken='';state.connected=false;state.accountLabel='';toast('Google Drive ayarlari kaydedildi.','ok');}
    catch(err){alert('Drive ayarlari kaydedilemedi: '+(err.message||err));}
  }

  async function resetRootFolder(){
    if(!confirm('Kayitli Drive kok klasor kimligi temizlensin mi? Dosyalar silinmez. Sonraki baglantida yeni bir uygulama klasoru olusturulabilir.'))return;
    state.folderCache.clear();await saveSettings({rootFolderId:''});toast('Kok klasor kimligi temizlendi.','ok');
  }

  function visitOptions(){try{return typeof window.getVisitRecords==='function'?window.getVisitRecords(false):(typeof getVisitRecords==='function'?getVisitRecords(false):[]);}catch(_){return[];}}
  function pqOptions(){try{return Object.keys(window.pqMasterData||pqMasterData||{}).sort((a,b)=>String(a).localeCompare(String(b),'tr',{numeric:true}));}catch(_){return[];}}
  function allRecords(){return Object.values(state.records||{}).filter(r=>r&&r.status!=='deleted').sort((a,b)=>String(b.updatedAt||b.createdAt).localeCompare(String(a.updatedAt||a.createdAt)));}

  function associationText(r){const parts=[];if(r.area)parts.push(r.area);if(r.pq)parts.push('PQ '+r.pq);if(r.step)parts.push('Step '+r.step);if(r.visitName)parts.push(r.visitName);else if(r.visitId)parts.push('Ziyaret '+r.visitId);return parts.join(' · ')||'Genel';}
  function typeLabel(t){return TYPE_LABELS[t]||t||'Diger';}
  function formatDate(v){if(!v)return'-';const d=new Date(v);return isNaN(d)?'-':d.toLocaleString('tr-TR',{dateStyle:'short',timeStyle:'short'});}
  function bytes(v){const n=Number(v||0);if(!n)return'-';if(n<1024)return n+' B';if(n<1024*1024)return(n/1024).toFixed(1)+' KB';return(n/1024/1024).toFixed(1)+' MB';}

  function filteredRecords(){
    const q=String((document.getElementById('driveDocSearch')||{}).value||'').trim().toLocaleLowerCase('tr');
    const type=String((document.getElementById('driveDocFilterType')||{}).value||'all');
    const area=String((document.getElementById('driveDocFilterArea')||{}).value||'all');
    return allRecords().filter(r=>{
      if(type!=='all'&&r.documentType!==type)return false;if(area!=='all'&&r.area!==area)return false;
      if(q){const hay=[r.name,r.description,r.area,r.pq,r.step,r.visitName,(r.tags||[]).join(' ')].join(' ').toLocaleLowerCase('tr');if(!hay.includes(q))return false;}
      return true;
    });
  }

  function renderSelects(){
    const areaOptions='<option value="">Alan yok / Genel</option>'+AREAS.map(a=>`<option value="${a}">${a}</option>`).join('');
    ['driveDocArea','driveLinkArea'].forEach(id=>{const el=document.getElementById(id);if(el&&el.dataset.ready!=='1'){el.innerHTML=areaOptions;el.dataset.ready='1';}});
    const filter=document.getElementById('driveDocFilterArea');if(filter&&filter.dataset.ready!=='1'){filter.innerHTML='<option value="all">Tum alanlar</option>'+AREAS.map(a=>`<option value="${a}">${a}</option>`).join('');filter.dataset.ready='1';}
    const visits=visitOptions();const visitHtml='<option value="">Ziyaret yok / Genel</option>'+visits.map(v=>`<option value="${escapeHtml(v.id||v.visitId||'')}">${escapeHtml(v.visitName||v.name||v.id||'Ziyaret')}</option>`).join('');
    ['driveDocVisit','driveLinkVisit'].forEach(id=>{const el=document.getElementById(id),old=el&&el.value;if(el){el.innerHTML=visitHtml;if(old)el.value=old;}});
  }

  function renderSettings(){
    const client=document.getElementById('driveClientId'),root=document.getElementById('driveRootFolderName'),auto=document.getElementById('driveAutoArchivePq');
    if(client&&document.activeElement!==client)client.value=state.settings.clientId||'';
    if(root&&document.activeElement!==root)root.value=state.settings.rootFolderName||ROOT_FOLDER_DEFAULT;
    if(auto)auto.checked=!!state.settings.autoArchivePq;
    const origin=document.getElementById('driveAuthorizedOrigin');if(origin)origin.textContent=location.origin;
    const rootId=document.getElementById('driveRootFolderIdView');if(rootId)rootId.textContent=state.settings.rootFolderId||'Henuz olusturulmadi';
  }

  function renderStatus(){
    const badge=document.getElementById('driveConnectionBadge'),detail=document.getElementById('driveConnectionDetail'),btn=document.getElementById('driveConnectBtn');
    if(badge){badge.className='drive-status-badge '+(state.connected?'connected':isConfigured()?'configured':'not-configured');badge.textContent=state.connected?'Drive bagli':isConfigured()?'OAuth ayarli / Bagli degil':'OAuth ayari gerekli';}
    if(detail)detail.textContent=state.connected?(state.accountLabel||'Google Drive erisimi etkin'):(isConfigured()?'Baglan dugmesi ile Google hesabi yetkilendirilebilir.':'Google Cloud OAuth Web Client ID girilmeden dogrudan yukleme yapilamaz. Mevcut Drive linkleri yine kaydedilebilir.');
    if(btn)btn.disabled=!isConfigured();
  }

  function renderKpis(records){
    const set=(id,val)=>{const el=document.getElementById(id);if(el)el.textContent=val;};
    set('driveKpiTotal',records.length);set('driveKpiPq',records.filter(r=>r.documentType==='pq-source').length);set('driveKpiCap',records.filter(r=>r.documentType==='cap-evidence').length);set('driveKpiVisit',records.filter(r=>r.documentType==='visit-evidence').length);set('driveKpiUnlinked',records.filter(r=>!r.area&&!r.pq&&!r.visitId).length);
  }

  function renderTable(){
    const tbody=document.getElementById('driveDocumentTableBody');if(!tbody)return;const rows=filteredRecords();
    if(!rows.length){tbody.innerHTML='<tr><td colspan="8" class="drive-empty">Filtreye uyan dokuman kaydi bulunamadi.</td></tr>';return;}
    tbody.innerHTML=rows.map(r=>`<tr>
      <td><div class="drive-doc-name">${escapeHtml(r.name||'Adsiz belge')}</div><div class="drive-doc-sub">${escapeHtml(r.mimeType||'Drive kaydi')} · ${escapeHtml(bytes(r.size))}</div></td>
      <td><span class="drive-type-pill">${escapeHtml(typeLabel(r.documentType))}</span></td>
      <td>${escapeHtml(associationText(r))}</td>
      <td>${escapeHtml((r.tags||[]).join(', ')||'-')}</td>
      <td>${escapeHtml(r.source==='upload'?'Uygulamadan yuklendi':'Mevcut link')}</td>
      <td>${escapeHtml(formatDate(r.updatedAt||r.createdAt))}</td>
      <td>${r.webViewLink?`<a class="btn-outline drive-open-link" href="${escapeHtml(r.webViewLink)}" target="_blank" rel="noopener">Drive'da Ac</a>`:'-'}</td>
      <td><button class="btn-outline btn-sm" onclick="ICADriveDocuments.copyLink('${escapeHtml(r.id)}')">Baglantiyi Kopyala</button> <button class="btn-outline btn-sm danger-text" onclick="ICADriveDocuments.removeRecord('${escapeHtml(r.id)}')">Kaydi Sil</button></td>
    </tr>`).join('');
  }

  function render(){
    if(!document.getElementById('tab-drive-documents'))return;
    renderSelects();renderSettings();renderStatus();const records=allRecords();renderKpis(records);renderTable();
  }

  function setBusy(on,text=''){const el=document.getElementById('driveBusy');if(el){el.style.display=on?'flex':'none';el.textContent=text||'Islem yapiliyor...';}}

  async function copyLink(id){const r=state.records[id];if(!r||!r.webViewLink)return;try{await navigator.clipboard.writeText(r.webViewLink);toast('Drive baglantisi panoya kopyalandi.','ok');}catch(_){prompt('Baglantiyi kopyalayin:',r.webViewLink);}}

  function countForPq(pq){const key=normalizePq(pq);return allRecords().filter(r=>normalizePq(r.pq)===key).length;}
  function countForVisit(visitId){const id=String(visitId||'');return allRecords().filter(r=>String(r.visitId||'')===id).length;}
  function openContext(context={}){
    if(typeof window.switchTab==='function')window.switchTab('drive-documents');
    setTimeout(async()=>{
      await loadHub();render();
      const pq=normalizePq(context.pq||''),area=String(context.area||'').toUpperCase(),visitId=String(context.visitId||'');
      const search=document.getElementById('driveDocSearch');if(search)search.value=pq?`PQ ${pq}`:(context.search||'');
      const areaFilter=document.getElementById('driveDocFilterArea');if(areaFilter&&area)areaFilter.value=area;
      ['driveDocPq','driveLinkPq'].forEach(id=>{const e=document.getElementById(id);if(e&&pq)e.value=pq;});
      ['driveDocArea','driveLinkArea'].forEach(id=>{const e=document.getElementById(id);if(e&&area)e.value=area;});
      ['driveDocVisit','driveLinkVisit'].forEach(id=>{const e=document.getElementById(id);if(e&&visitId)e.value=visitId;});
      renderTable();
    },30);
    return false;
  }
  function refresh(){loadHub(true).then(render);}

  async function archivePqSourceDocument(file,context={}){
    await loadHub();
    if(!state.settings.autoArchivePq||!tokenUsable())return null;
    const meta={documentType:'pq-source',area:String(context.area||context.meta&&context.meta.area||'').toUpperCase(),pqEditionKey:String(context.editionKey||''),pqDocumentId:String(context.documentId||''),description:`ICAO PQ kaynak DOCX · ${String(context.editionKey||'')}`};
    const d=await uploadFile(file,meta);
    const rec=await saveRecord({...meta,provider:'google-drive',source:'upload',driveFileId:d.id,name:d.name||file.name,mimeType:d.mimeType||file.type,size:Number(d.size||file.size)||0,sha256:d.sha256||'',webViewLink:d.webViewLink||`https://drive.google.com/open?id=${d.id}`,webContentLink:d.webContentLink||'',folderId:d.folderId||'',driveCreatedTime:d.createdTime||'',driveModifiedTime:d.modifiedTime||''});
    return{status:'stored',provider:'google-drive',name:rec.name,size:rec.size,type:rec.mimeType,sha256:rec.sha256,fileId:rec.driveFileId,downloadURL:'',webViewLink:rec.webViewLink,documentRegistryId:rec.id,storagePath:''};
  }

  function attachLiveListener(){
    if(state.liveAttached||typeof db==='undefined'||!db||!currentUser())return;
    state.liveAttached=true;
    try{db.ref(DB_ROOT).on('value',snap=>{const raw=snap.exists()?snap.val():{};state.settings=normalizeSettings(raw&&raw.settings);state.records={};const records=raw&&raw.records||{};Object.keys(records).forEach(id=>state.records[id]=normalizeRecord(id,records[id]));state.loaded=true;render();},err=>{console.warn('Dokuman merkezi canli dinleyici hatasi',err);state.liveAttached=false;});}catch(err){state.liveAttached=false;console.warn('Dokuman merkezi canli dinleyici kurulamadi',err);}
  }
  function setupLiveListener(){
    try{
      if(currentUser())attachLiveListener();
      else if(typeof firebase!=='undefined'&&firebase.auth)firebase.auth().onAuthStateChanged(user=>{if(user)attachLiveListener();});
    }catch(err){console.warn('Dokuman merkezi auth dinleyicisi kurulamadi',err);}
  }

  window.ICADriveDocuments={state,loadHub,render,refresh,connectDrive,disconnectDrive,saveSettingsFromUi,resetRootFolder,ensureRootFolder,uploadFromUi,registerLinkFromUi,removeRecord,copyLink,archivePqSourceDocument,extractDriveId,allRecords,isConfigured,tokenUsable,countForPq,countForVisit,openContext};
  window.renderDriveDocumentsCenter=async function(){await loadHub();render();};
  window.connectGoogleDrive=connectDrive;
  window.disconnectGoogleDrive=disconnectDrive;
  window.saveGoogleDriveSettings=saveSettingsFromUi;
  window.resetGoogleDriveRootFolder=resetRootFolder;
  window.uploadDriveDocument=uploadFromUi;
  window.registerDriveDocumentLink=registerLinkFromUi;
  window.refreshDriveDocuments=refresh;
  window.openDriveDocumentsContext=openContext;

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setupLiveListener,{once:true});else setupLiveListener();
})();
