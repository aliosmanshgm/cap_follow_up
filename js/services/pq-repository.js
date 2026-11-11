// ICAO PQ Library repository. Firebase RTDB asil kayit, localStorage cevrimdisi cache'tir.
(function(){
  'use strict';
  const LOCAL_KEY='icao_pq_library_v1';
  const DB_TIMEOUT_MS=15000;
  const DB_CONNECT_TIMEOUT_MS=8000;
  const STORAGE_TIMEOUT_MS=12000;

  function safeKey(v){return String(v||'').trim().replace(/[.#$\[\]\/]/g,'_').replace(/\s+/g,'_');}
  function cleanFileName(v){return String(v||'document.docx').replace(/[^A-Za-z0-9._-]+/g,'_').slice(0,140);}
  function normalize(raw){const lib=raw&&typeof raw==='object'?raw:{editions:{}};if(!lib.editions||typeof lib.editions!=='object')lib.editions={};return lib;}
  function readLocal(){try{return normalize(JSON.parse(localStorage.getItem(LOCAL_KEY)||'null'));}catch(_){return{editions:{}};}}
  function writeLocal(lib){try{localStorage.setItem(LOCAL_KEY,JSON.stringify(normalize(lib)));}catch(e){console.warn('PQ local cache yazılamadı',e);}}
  function authUser(){try{return firebase.auth().currentUser||null;}catch(_){return null;}}
  function isOnline(){return typeof navigator==='undefined'||navigator.onLine!==false;}
  function firebaseValue(v){return window.visitFirebaseSafeValue?window.visitFirebaseSafeValue(v):v;}
  function emit(cb,stage,message,detail){try{if(typeof cb==='function')cb({stage,message,detail:detail||''});}catch(_){}}

  function timeoutError(label,ms){const e=new Error(`${label} ${Math.round(ms/1000)} saniye içinde tamamlanmadı.`);e.code='PQ_TIMEOUT';return e;}
  function withTimeout(promise,ms,label){
    let timer;
    return Promise.race([
      Promise.resolve(promise).finally(()=>clearTimeout(timer)),
      new Promise((_,reject)=>{timer=setTimeout(()=>reject(timeoutError(label,ms)),ms);})
    ]);
  }
  function friendlyDbError(err){
    const code=String(err&&err.code||'').toUpperCase(),msg=String(err&&err.message||err||'');
    if(code.includes('PERMISSION_DENIED')||/permission.?denied/i.test(msg))return new Error('Firebase Realtime Database yazma/okuma izni reddedildi. Rules içinde icao_pq_library yolu için oturum açmış kullanıcıya gerekli yetkiyi kontrol edin.');
    if(code==='PQ_TIMEOUT')return err;
    return err instanceof Error?err:new Error(msg||'Firebase işlemi başarısız.');
  }
  async function sha256(file){
    try{if(!crypto||!crypto.subtle||!file||!file.arrayBuffer)return'';const hash=await crypto.subtle.digest('SHA-256',await file.arrayBuffer());return[...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('');}catch(_){return'';}
  }
  async function waitForDbConnection(timeoutMs=DB_CONNECT_TIMEOUT_MS){
    if(typeof db==='undefined'||!db)return false;
    return new Promise(resolve=>{
      let settled=false,timer=null,ref=null,handler=null;
      const finish=v=>{if(settled)return;settled=true;if(timer)clearTimeout(timer);try{if(ref&&handler)ref.off('value',handler);}catch(_){}resolve(!!v);};
      try{
        ref=db.ref('.info/connected');
        handler=s=>{if(s&&s.val()===true)finish(true);};
        ref.on('value',handler,()=>finish(false));
        timer=setTimeout(()=>finish(false),timeoutMs);
      }catch(_){finish(false);}
    });
  }

  async function load(){
    const local=readLocal();
    if(typeof db==='undefined'||!db||!isOnline())return{library:local,source:'local',message:'Çevrimdışı mod: yerel PQ cache kullanılıyor.'};
    try{
      const snap=await withTimeout(db.ref('icao_pq_library/editions').once('value'),DB_TIMEOUT_MS,'Firebase PQ veri tabanı okuması');
      const library=normalize({editions:snap.exists()?snap.val():{}});
      writeLocal(library);
      return{library,source:'firebase',message:snap.exists()?'PQ veri tabanı Firebase üzerinden güncellendi.':'Firebase PQ veri tabanı henüz boş.'};
    }catch(err){
      return{library:local,source:'local-fallback',message:`Firebase PQ veri tabanı okunamadı; yerel cache kullanılıyor. ${err.message||err}`,error:err};
    }
  }

  function uploadTaskWithTimeout(task,ms,onProgress){
    return new Promise((resolve,reject)=>{
      let settled=false;
      const finish=(fn,val)=>{if(settled)return;settled=true;clearTimeout(timer);fn(val);};
      const timer=setTimeout(()=>{
        try{task.cancel();}catch(_){}
        const e=timeoutError('Firebase Storage DOCX yüklemesi',ms);e.code='STORAGE_TIMEOUT';finish(reject,e);
      },ms);
      task.on('state_changed',snap=>{
        try{const pct=snap.totalBytes?Math.round((snap.bytesTransferred/snap.totalBytes)*100):0;if(typeof onProgress==='function')onProgress(pct);}catch(_){}
      },err=>finish(reject,err),()=>finish(resolve,task.snapshot));
    });
  }

  async function uploadOriginal(file,meta,editionKey,onProgress){
    const result={status:'not-configured',name:file&&file.name||'',size:file&&file.size||0,type:file&&file.type||'',sha256:await sha256(file),storagePath:'',downloadURL:''};
    if(!file)return result;
    if(typeof storage==='undefined'||!storage){result.status='sdk-unavailable';return result;}
    if(!authUser()){result.status='auth-required';return result;}
    const path=`icao-pq-documents/${safeKey(meta.year)}/R${safeKey(meta.revision||'0')}/${safeKey(meta.area)}/${Date.now()}_${cleanFileName(file.name)}`;
    try{
      const ref=storage.ref(path);
      const task=ref.put(file,{contentType:file.type||'application/vnd.openxmlformats-officedocument.wordprocessingml.document',customMetadata:{editionKey,area:String(meta.area||''),year:String(meta.year||''),revision:String(meta.revision||'')}});
      await uploadTaskWithTimeout(task,STORAGE_TIMEOUT_MS,onProgress);
      let url='';try{url=await withTimeout(ref.getDownloadURL(),5000,'Storage indirme bağlantısı alma');}catch(_){}
      return{...result,status:'stored',storagePath:path,downloadURL:url};
    }catch(err){
      const code=String(err&&err.code||'');
      const status=code==='STORAGE_TIMEOUT'?'timeout':code==='storage/unauthorized'?'unauthorized':code==='storage/unauthenticated'?'auth-required':code==='storage/quota-exceeded'?'quota-exceeded':'failed';
      return{...result,status,error:String(err&&err.message||err),errorCode:code};
    }
  }

  function buildAreaData(parsed,file,sourceDocument,user){
    const pqsObj={};parsed.pqs.forEach(p=>pqsObj[safeKey(p.pq)]=p);
    const amendmentsObj={};parsed.amendments.forEach((a,i)=>amendmentsObj[String(i+1).padStart(4,'0')]=a);
    const m=window.PQDocxParser?window.PQDocxParser.validate(parsed).metrics:{};
    return{area:parsed.meta.area,year:parsed.meta.year,revision:parsed.meta.revision,publicationDate:parsed.meta.publicationDate||'',sourceFile:file.name,sourceDocument,importedAt:new Date().toISOString(),importedBy:user&&((user.displayName||user.email||user.uid))||'',amendmentMeta:parsed.amendmentMeta||{},pqs:pqsObj,amendments:amendmentsObj,stats:{pqCount:m.pqCount||parsed.pqs.length,onSite:m.onSite||0,offSite:m.offSite||0,ppq:m.ppq||0,auditorNotes:m.auditorNotes||0,amendments:m.amendments||parsed.amendments.length}};
  }

  async function saveParsedDocument({file,parsed,editionKey,overwrite=false,onProgress}){
    if(typeof db==='undefined'||!db)throw new Error('Firebase Realtime Database bağlantısı bulunamadı.');
    if(!isOnline())throw new Error('Firebase kaydı için çevrim içi bağlantı gerekir.');
    const user=authUser();if(!user)throw new Error('Firebase kaydı için yetkili kullanıcı girişi gerekir.');
    emit(onProgress,'connect','Firebase Realtime Database bağlantısı kontrol ediliyor…');
    const connected=await waitForDbConnection();
    if(!connected)throw new Error('Firebase Realtime Database bağlantısı kurulamadı. İnternet bağlantısını, databaseURL ayarını ve Firebase erişimini kontrol edin.');

    const area=parsed.meta.area,editionPath=`icao_pq_library/editions/${editionKey}`,areaPath=`${editionPath}/areas/${safeKey(area)}`;
    let editionExisting,existing;
    emit(onProgress,'check','Mevcut sürüm/alan kaydı kontrol ediliyor…');
    try{
      [editionExisting,existing]=await Promise.all([
        withTimeout(db.ref(editionPath).once('value'),DB_TIMEOUT_MS,'Firebase sürüm kontrolü'),
        withTimeout(db.ref(areaPath).once('value'),DB_TIMEOUT_MS,'Firebase alan kontrolü')
      ]);
    }catch(err){throw friendlyDbError(err);}
    if(existing.exists()&&!overwrite)throw new Error(`${editionKey} / ${area} zaten kayıtlı. Güncelleme onayı gerekir.`);

    // Storage, ana veritabanı kaydını artık bloke etmez. Önce yapılandırılmış PQ verisi yazılır.
    const baseSourceDocument={status:'pending',name:file&&file.name||'',size:file&&file.size||0,type:file&&file.type||'',sha256:await sha256(file),storagePath:'',downloadURL:''};
    const areaData=buildAreaData(parsed,file,baseSourceDocument,user),now=new Date().toISOString(),importId=`imp_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    const editionMeta={year:parsed.meta.year,revision:parsed.meta.revision,label:`${parsed.meta.year} Edition${parsed.meta.revision?` · Revision ${parsed.meta.revision}`:''}`,updatedAt:now};
    if(!editionExisting.exists())editionMeta.createdAt=now;
    const importData={importId,editionKey,area,fileName:file.name,fileSize:file.size||0,sha256:baseSourceDocument.sha256||'',sourceDocument:baseSourceDocument,stats:areaData.stats,importedAt:now,importedBy:areaData.importedBy,mode:existing.exists()?'replace':'create'};
    const updates={};
    updates[`icao_pq_library/editions/${editionKey}/year`]=editionMeta.year;
    updates[`icao_pq_library/editions/${editionKey}/revision`]=editionMeta.revision;
    updates[`icao_pq_library/editions/${editionKey}/label`]=editionMeta.label;
    updates[`icao_pq_library/editions/${editionKey}/updatedAt`]=editionMeta.updatedAt;
    if(editionMeta.createdAt)updates[`icao_pq_library/editions/${editionKey}/createdAt`]=editionMeta.createdAt;
    updates[areaPath]=areaData;
    updates[`icao_pq_library/imports/${importId}`]=importData;

    emit(onProgress,'database-write','PQ verileri Firebase Realtime Database’e yazılıyor…');
    try{await withTimeout(db.ref().update(firebaseValue(updates)),DB_TIMEOUT_MS,'Firebase PQ veri yazımı');}catch(err){throw friendlyDbError(err);}

    emit(onProgress,'verify','Firebase yazımı doğrulanıyor…');
    let verify;
    try{verify=await withTimeout(db.ref(areaPath).once('value'),DB_TIMEOUT_MS,'Firebase yazma doğrulaması');}catch(err){throw friendlyDbError(err);}
    if(!verify.exists())throw new Error('Firebase yazma doğrulaması başarısız: alan kaydı okunamadı.');

    // DB kaydı başarılı olduktan sonra kaynak DOCX best-effort olarak Storage'a alınır.
    emit(onProgress,'storage','PQ verisi kaydedildi. Kaynak DOCX Storage’a yükleniyor…');
    const sourceDocument=await uploadOriginal(file,parsed.meta,editionKey,pct=>emit(onProgress,'storage-progress',`Kaynak DOCX Storage’a yükleniyor… %${pct}`,String(pct)));
    areaData.sourceDocument=sourceDocument;
    importData.sourceDocument=sourceDocument;
    importData.sha256=sourceDocument.sha256||baseSourceDocument.sha256||'';

    // Storage sonucu veritabanına işlenir. Bu patch başarısız olsa dahi ana PQ kaydı kaybolmaz.
    try{
      await withTimeout(db.ref().update(firebaseValue({
        [`${areaPath}/sourceDocument`]:sourceDocument,
        [`icao_pq_library/imports/${importId}/sourceDocument`]:sourceDocument,
        [`icao_pq_library/imports/${importId}/sha256`]:importData.sha256
      })),8000,'Kaynak DOCX durum güncellemesi');
    }catch(err){console.warn('PQ kaynak DOCX durumu Firebase’e işlenemedi; ana PQ kaydı korunuyor.',err);}

    const local=readLocal();
    local.editions[editionKey]=local.editions[editionKey]||{year:parsed.meta.year,revision:parsed.meta.revision,label:editionMeta.label,areas:{}};
    local.editions[editionKey].areas=local.editions[editionKey].areas||{};
    local.editions[editionKey].areas[area]=areaData;
    local.editions[editionKey].updatedAt=now;
    writeLocal(local);
    emit(onProgress,'done','PQ verisi Firebase’e kaydedildi.',sourceDocument.status);
    return{editionKey,area,areaData,sourceDocument,replaced:existing.exists(),importId};
  }

  window.PQRepository={load,saveParsedDocument,readLocal,writeLocal,safeKey,waitForDbConnection};
})();
