// ICAO PQ Library repository. Firebase RTDB asil kayit, localStorage cevrimdisi cache'tir.
(function(){
  'use strict';
  const LOCAL_KEY='icao_pq_library_v1';
  function safeKey(v){return String(v||'').trim().replace(/[.#$\[\]\/]/g,'_').replace(/\s+/g,'_');}
  function cleanFileName(v){return String(v||'document.docx').replace(/[^A-Za-z0-9._-]+/g,'_').slice(0,140);}
  function normalize(raw){const lib=raw&&typeof raw==='object'?raw:{editions:{}};if(!lib.editions||typeof lib.editions!=='object')lib.editions={};return lib;}
  function readLocal(){try{return normalize(JSON.parse(localStorage.getItem(LOCAL_KEY)||'null'));}catch(_){return{editions:{}};}}
  function writeLocal(lib){try{localStorage.setItem(LOCAL_KEY,JSON.stringify(normalize(lib)));}catch(e){console.warn('PQ local cache yazılamadı',e);}}
  function authUser(){try{return firebase.auth().currentUser||null;}catch(_){return null;}}
  function isOnline(){return typeof navigator==='undefined'||navigator.onLine!==false;}
  function firebaseValue(v){return window.visitFirebaseSafeValue?window.visitFirebaseSafeValue(v):v;}
  async function sha256(file){
    try{if(!crypto||!crypto.subtle||!file||!file.arrayBuffer)return'';const hash=await crypto.subtle.digest('SHA-256',await file.arrayBuffer());return[...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('');}catch(_){return'';}
  }
  async function load(){
    const local=readLocal();
    if(typeof db==='undefined'||!db||!isOnline())return{library:local,source:'local',message:'Çevrimdışı mod: yerel PQ cache kullanılıyor.'};
    try{
      const snap=await db.ref('icao_pq_library/editions').once('value');
      const library=normalize({editions:snap.exists()?snap.val():{}});
      writeLocal(library);
      return{library,source:'firebase',message:snap.exists()?'PQ veri tabanı Firebase üzerinden güncellendi.':'Firebase PQ veri tabanı henüz boş.'};
    }catch(err){
      return{library:local,source:'local-fallback',message:`Firebase PQ veri tabanı okunamadı; yerel cache kullanılıyor. ${err.message||err}`,error:err};
    }
  }
  async function uploadOriginal(file,meta,editionKey){
    const result={status:'not-configured',name:file&&file.name||'',size:file&&file.size||0,type:file&&file.type||'',sha256:await sha256(file),storagePath:'',downloadURL:''};
    if(!file)return result;
    if(typeof storage==='undefined'||!storage){result.status='sdk-unavailable';return result;}
    if(!authUser()){result.status='auth-required';return result;}
    const path=`icao-pq-documents/${safeKey(meta.year)}/R${safeKey(meta.revision||'0')}/${safeKey(meta.area)}/${Date.now()}_${cleanFileName(file.name)}`;
    try{
      const ref=storage.ref(path);
      await ref.put(file,{contentType:file.type||'application/vnd.openxmlformats-officedocument.wordprocessingml.document',customMetadata:{editionKey,area:String(meta.area||''),year:String(meta.year||''),revision:String(meta.revision||'')}});
      let url='';try{url=await ref.getDownloadURL();}catch(_){}
      return{...result,status:'stored',storagePath:path,downloadURL:url};
    }catch(err){return{...result,status:'failed',error:String(err&&err.message||err)};}
  }
  function buildAreaData(parsed,file,sourceDocument,user){
    const pqsObj={};parsed.pqs.forEach(p=>pqsObj[safeKey(p.pq)]=p);
    const amendmentsObj={};parsed.amendments.forEach((a,i)=>amendmentsObj[String(i+1).padStart(4,'0')]=a);
    const m=window.PQDocxParser?window.PQDocxParser.validate(parsed).metrics:{};
    return{area:parsed.meta.area,year:parsed.meta.year,revision:parsed.meta.revision,publicationDate:parsed.meta.publicationDate||'',sourceFile:file.name,sourceDocument,importedAt:new Date().toISOString(),importedBy:user&&((user.displayName||user.email||user.uid))||'',amendmentMeta:parsed.amendmentMeta||{},pqs:pqsObj,amendments:amendmentsObj,stats:{pqCount:m.pqCount||parsed.pqs.length,onSite:m.onSite||0,offSite:m.offSite||0,ppq:m.ppq||0,auditorNotes:m.auditorNotes||0,amendments:m.amendments||parsed.amendments.length}};
  }
  async function saveParsedDocument({file,parsed,editionKey,overwrite=false}){
    if(typeof db==='undefined'||!db)throw new Error('Firebase Realtime Database bağlantısı bulunamadı.');
    if(!isOnline())throw new Error('Firebase kaydı için çevrim içi bağlantı gerekir.');
    const user=authUser();if(!user)throw new Error('Firebase kaydı için yetkili kullanıcı girişi gerekir.');
    const area=parsed.meta.area,editionPath=`icao_pq_library/editions/${editionKey}`,areaPath=`${editionPath}/areas/${safeKey(area)}`;
    const [editionExisting,existing]=await Promise.all([db.ref(editionPath).once('value'),db.ref(areaPath).once('value')]);
    if(existing.exists()&&!overwrite)throw new Error(`${editionKey} / ${area} zaten kayıtlı. Güncelleme onayı gerekir.`);
    const sourceDocument=await uploadOriginal(file,parsed.meta,editionKey);
    const areaData=buildAreaData(parsed,file,sourceDocument,user),now=new Date().toISOString(),importId=`imp_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    const editionMeta={year:parsed.meta.year,revision:parsed.meta.revision,label:`${parsed.meta.year} Edition${parsed.meta.revision?` · Revision ${parsed.meta.revision}`:''}`,updatedAt:now};
    if(!editionExisting.exists())editionMeta.createdAt=now;
    const updates={};
    updates[`icao_pq_library/editions/${editionKey}/year`]=editionMeta.year;
    updates[`icao_pq_library/editions/${editionKey}/revision`]=editionMeta.revision;
    updates[`icao_pq_library/editions/${editionKey}/label`]=editionMeta.label;
    updates[`icao_pq_library/editions/${editionKey}/updatedAt`]=editionMeta.updatedAt;
    if(editionMeta.createdAt)updates[`icao_pq_library/editions/${editionKey}/createdAt`]=editionMeta.createdAt;
    updates[areaPath]=areaData;
    updates[`icao_pq_library/imports/${importId}`]={importId,editionKey,area,fileName:file.name,fileSize:file.size||0,sha256:sourceDocument.sha256||'',sourceDocument,stats:areaData.stats,importedAt:now,importedBy:areaData.importedBy,mode:existing.exists()?'replace':'create'};
    await db.ref().update(firebaseValue(updates));
    const verify=await db.ref(areaPath).once('value');
    if(!verify.exists())throw new Error('Firebase yazma doğrulaması başarısız: alan kaydı okunamadı.');
    const local=readLocal();local.editions[editionKey]=local.editions[editionKey]||{year:parsed.meta.year,revision:parsed.meta.revision,label:editionMeta.label,areas:{}};local.editions[editionKey].areas=local.editions[editionKey].areas||{};local.editions[editionKey].areas[area]=areaData;local.editions[editionKey].updatedAt=now;writeLocal(local);
    return{editionKey,area,areaData,sourceDocument,replaced:existing.exists(),importId};
  }
  window.PQRepository={load,saveParsedDocument,readLocal,writeLocal,safeKey};
})();
