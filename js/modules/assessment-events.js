(function(){
    'use strict';

    const AREAS=['LEG','ORG','PEL','OPS','AIR','AIG','ANS','AGA'];
    const EVENT_PATH='icao_assessment_events';
    const SNAPSHOT_PATH='icao_ei_snapshots';
    const MODULE_VERSION='assessment-events-v2-ei-timeline';
    let eventRef=null,eventCallback=null,snapshotRef=null,snapshotCallback=null;
    let syncInFlight=false,syncQueued=false;

    window.icaoAssessmentEvents=window.icaoAssessmentEvents||{};
    window.icaoEiSnapshots=window.icaoEiSnapshots||{};
    window.icaoAssessmentModelLoaded=window.icaoAssessmentModelLoaded===true;

    function actor(){
        try{
            const u=firebase.auth().currentUser;
            return u?{uid:u.uid||'',email:u.email||'',displayName:u.displayName||u.email||'Yetkili kullanıcı'}:{uid:'',email:'',displayName:'Oturum yok'};
        }catch(e){return{uid:'',email:'',displayName:'Oturum yok'};}
    }
    function clean(value){
        if(value===undefined)return undefined;
        if(value===null)return null;
        if(typeof value==='number'&&!Number.isFinite(value))return null;
        if(Array.isArray(value))return value.map(clean).filter(v=>v!==undefined);
        if(value&&typeof value==='object'){
            const out={};
            Object.entries(value).forEach(([k,v])=>{const c=clean(v);if(c!==undefined)out[k]=c;});
            return out;
        }
        return value;
    }
    function num(v){
        if(v===null||v===undefined||String(v).trim()==='')return null;
        const n=Number(String(v).replace(',','.'));
        return Number.isFinite(n)?Math.round(n*100)/100:null;
    }
    function intOrNull(v){
        if(v===null||v===undefined||String(v).trim()==='')return null;
        const n=Number(v);
        return Number.isFinite(n)&&n>=0?Math.round(n):null;
    }
    function normalizeAreas(list){
        const raw=Array.isArray(list)?list:String(list||'').split(/[,;|\s]+/);
        const set=new Set(raw.map(x=>String(x||'').trim().toUpperCase()).filter(x=>AREAS.includes(x)));
        return AREAS.filter(x=>set.has(x));
    }
    function calcEi(satisfactory,applicable){
        const s=intOrNull(satisfactory),a=intOrNull(applicable);
        if(s===null||a===null||a<=0)return null;
        return Math.round((s/a)*10000)/100;
    }
    function stableStringify(value){
        if(value===null||typeof value!=='object')return JSON.stringify(value);
        if(Array.isArray(value))return '['+value.map(stableStringify).join(',')+']';
        return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stableStringify(value[k])).join(',')+'}';
    }
    function fingerprint(value){
        const str=stableStringify(value);let hash=2166136261;
        for(let i=0;i<str.length;i++){hash^=str.charCodeAt(i);hash=Math.imul(hash,16777619);}
        return (hash>>>0).toString(16).padStart(8,'0');
    }
    function eventIdForOfficial(recordId){return `official_${String(recordId||'').replace(/[.#$\[\]\/]/g,'_')}`;}
    function snapshotIdForOfficial(recordId){return `official_after_${String(recordId||'').replace(/[.#$\[\]\/]/g,'_')}`;}
    function statusOf(record){
        const s=String(record&&record.resultStatus||'official').toLowerCase();
        return ['official','draft','provisional'].includes(s)?s:'official';
    }
    function defaultScopeForLegacy(record){
        if(Array.isArray(record&&record.scopeAreas)&&record.scopeAreas.length)return normalizeAreas(record.scopeAreas);
        const type=String(record&&record.type||'').toUpperCase();
        const name=String(record&&record.name||'').toLocaleLowerCase('tr-TR');
        if(type==='CMAA')return [...AREAS];
        if(type==='OSVA'&&/virtual\s*osva|mayıs\s*2026|may\s*2026/i.test(name))return ['OPS','AIR'];
        const explicitAreas=AREAS.filter(area=>num(record&&record.areas&&record.areas[area])!==null);
        if(explicitAreas.length)return explicitAreas;
        return [];
    }
    function areaSnapshot(record,scopeAreas){
        const source=record&&record.areas||{};
        const counts=record&&record.areaCounts||{};
        const out={};
        AREAS.forEach(area=>{
            const c=counts[area]||{};
            const satisfactory=intOrNull(c.satisfactory),applicable=intOrNull(c.applicable);
            const explicitEi=num(source[area]);
            out[area]=clean({
                ei: explicitEi!==null?explicitEi:calcEi(satisfactory,applicable),
                satisfactory,
                applicable,
                inScope:scopeAreas.includes(area)
            });
        });
        return out;
    }
    function normalizeOfficialRecord(recordId,record){
        const eventId=eventIdForOfficial(recordId),snapshotId=snapshotIdForOfficial(recordId);
        const scopeAreas=defaultScopeForLegacy(record);
        const overallSatisfactory=intOrNull(record.overallSatisfactory);
        const overallApplicable=intOrNull(record.overallApplicable);
        const explicitOverall=num(record.overallEI);
        const overallEi=explicitOverall!==null?explicitOverall:calcEi(overallSatisfactory,overallApplicable);
        const status=statusOf(record);
        const startDate=record.startDate||record.assessmentDate||'';
        const endDate=record.endDate||record.assessmentDate||'';
        const pqVersion=String(record.pqVersion||'').trim();
        const pqRevision=String(record.pqRevision||'').trim();
        const commonSource={system:'icao_official_ei',recordId:String(recordId),path:`icao_official_ei/${recordId}`};
        const eventCore=clean({
            schemaVersion:1,
            sourceSystem:'icao_official_ei',
            sourceRecordId:String(recordId),
            name:record.name||record.type||'ICAO değerlendirmesi',
            type:String(record.type||'OTHER').toUpperCase(),
            startDate,
            endDate,
            assessmentDate:record.assessmentDate||endDate||startDate||'',
            reportDate:record.reportDate||'',
            resultStatus:status,
            scopeAreas,
            pqVersion,
            pqRevision,
            source:record.source||'',
            notes:record.notes||'',
            active:record.active!==false,
            isDeleted:record.isDeleted===true,
            linkedSnapshotId:snapshotId,
            linkedOfficialEiRecordId:String(recordId),
            sourceLink:commonSource
        });
        const snapshotCore=clean({
            schemaVersion:1,
            eventId,
            phase:'after',
            kind:'official',
            resultStatus:status,
            sourceSystem:'icao_official_ei',
            sourceRecordId:String(recordId),
            assessmentDate:record.assessmentDate||endDate||startDate||'',
            reportDate:record.reportDate||'',
            scopeAreas,
            pqVersion,
            pqRevision,
            overall:{ei:overallEi,satisfactory:overallSatisfactory,applicable:overallApplicable},
            areas:areaSnapshot(record,scopeAreas),
            source:record.source||'',
            notes:record.notes||'',
            active:record.active!==false,
            isDeleted:record.isDeleted===true,
            sourceLink:commonSource
        });
        const fp=fingerprint({event:eventCore,snapshot:snapshotCore});
        return {eventId,snapshotId,fingerprint:fp,eventCore,snapshotCore};
    }
    function withAudit(core,existing,fp){
        const now=new Date().toISOString(),who=actor();
        return clean({
            ...core,
            syncFingerprint:fp,
            createdAt:(existing&&existing.createdAt)||now,
            createdBy:(existing&&existing.createdBy)||who,
            updatedAt:now,
            updatedBy:who,
            moduleVersion:MODULE_VERSION
        });
    }
    function updateStatus(){
        const el=document.getElementById('assessmentModelStatusTxt');
        if(!el)return;
        const events=Object.values(window.icaoAssessmentEvents||{}).filter(x=>x&&!x.isDeleted);
        const snapshots=Object.values(window.icaoEiSnapshots||{}).filter(x=>x&&!x.isDeleted);
        const official=events.filter(x=>x.resultStatus==='official').length;
        const draft=events.filter(x=>x.resultStatus==='draft'||x.resultStatus==='provisional').length;
        el.innerHTML=window.icaoAssessmentModelLoaded
            ?`Olay/Snapshot modeli: <b>${events.length}</b> değerlendirme, <b>${snapshots.length}</b> EI snapshot · ${official} resmî${draft?`, ${draft} taslak/geçici`:''}.`
            :'Olay/Snapshot modeli yükleniyor...';
    }

    window.getAssessmentEventIdsForOfficialEi=function(recordId){return{eventId:eventIdForOfficial(recordId),snapshotId:snapshotIdForOfficial(recordId)};};
    window.normalizeOfficialEiToAssessmentModel=function(recordId,record){return normalizeOfficialRecord(recordId,record||{});};

    window.syncOfficialEiRecordToAssessmentModel=async function(recordId,record,options={}){
        if(!recordId||!record||typeof db==='undefined')return{changed:false,reason:'missing-input'};
        const normalized=normalizeOfficialRecord(recordId,record);
        const currentEvent=(window.icaoAssessmentEvents||{})[normalized.eventId]||{};
        const currentSnapshot=(window.icaoEiSnapshots||{})[normalized.snapshotId]||{};
        const unchanged=currentEvent.syncFingerprint===normalized.fingerprint&&currentSnapshot.syncFingerprint===normalized.fingerprint;
        if(unchanged)return{changed:false,eventId:normalized.eventId,snapshotId:normalized.snapshotId};
        const updates={};
        updates[`${EVENT_PATH}/${normalized.eventId}`]=withAudit(normalized.eventCore,currentEvent,normalized.fingerprint);
        updates[`${SNAPSHOT_PATH}/${normalized.snapshotId}`]=withAudit(normalized.snapshotCore,currentSnapshot,normalized.fingerprint);
        await db.ref().update(updates);
        if(!options.silent&&typeof showAppRuntimeToast==='function')showAppRuntimeToast('Değerlendirme olayı ve EI snapshot güncellendi.','success');
        return{changed:true,eventId:normalized.eventId,snapshotId:normalized.snapshotId};
    };

    window.syncAllOfficialEiRecordsToAssessmentModel=async function(options={}){
        if(syncInFlight){syncQueued=true;return{queued:true};}
        if(!firebase.auth().currentUser)return{changed:0,skipped:0,reason:'unauthenticated'};
        syncInFlight=true;let changed=0,skipped=0,failed=0;
        try{
            const records=window.icaoOfficialEiRecords||{};
            for(const [id,record] of Object.entries(records)){
                try{
                    const result=await window.syncOfficialEiRecordToAssessmentModel(id,record,{silent:true});
                    result&&result.changed?changed++:skipped++;
                }catch(err){failed++;console.error('Assessment Event senkronizasyonu başarısız:',id,err);}
            }
            if(!options.silent&&typeof showAppRuntimeToast==='function'){
                const msg=`Assessment Event senkronizasyonu: ${changed} güncellendi, ${skipped} zaten güncel${failed?`, ${failed} hata`:''}.`;
                showAppRuntimeToast(msg,failed?'warn':'success');
            }
            return{changed,skipped,failed};
        }finally{
            syncInFlight=false;
            if(syncQueued){syncQueued=false;setTimeout(()=>window.syncAllOfficialEiRecordsToAssessmentModel({silent:true}),50);}
        }
    };

    window.startAssessmentEventListener=function(){
        window.stopAssessmentEventListener();
        window.icaoAssessmentModelLoaded=false;updateStatus();
        if(!firebase.auth().currentUser)return;
        eventRef=db.ref(EVENT_PATH);snapshotRef=db.ref(SNAPSHOT_PATH);
        eventCallback=snap=>{window.icaoAssessmentEvents=snap.val()||{};window.icaoAssessmentModelLoaded=true;updateStatus();scheduleAssessmentUiRefresh();};
        snapshotCallback=snap=>{window.icaoEiSnapshots=snap.val()||{};window.icaoAssessmentModelLoaded=true;updateStatus();scheduleAssessmentUiRefresh();};
        eventRef.on('value',eventCallback,err=>{console.error('Assessment Event verisi okunamadı',err);window.icaoAssessmentModelLoaded=true;updateStatus();});
        snapshotRef.on('value',snapshotCallback,err=>{console.error('EI Snapshot verisi okunamadı',err);window.icaoAssessmentModelLoaded=true;updateStatus();});
    };
    window.stopAssessmentEventListener=function(){
        if(eventRef&&eventCallback)eventRef.off('value',eventCallback);
        if(snapshotRef&&snapshotCallback)snapshotRef.off('value',snapshotCallback);
        eventRef=null;eventCallback=null;snapshotRef=null;snapshotCallback=null;
        window.icaoAssessmentEvents={};window.icaoEiSnapshots={};window.icaoAssessmentModelLoaded=false;updateStatus();
    };

    window.getAssessmentTimeline=function(options={}){
        const includeDeleted=options.includeDeleted===true,includePassive=options.includePassive===true;
        return Object.entries(window.icaoAssessmentEvents||{}).map(([id,event])=>({id,...(event||{})}))
            .filter(x=>includeDeleted||!x.isDeleted)
            .filter(x=>includePassive||x.active!==false)
            .sort((a,b)=>String(a.assessmentDate||a.endDate||a.startDate||'').localeCompare(String(b.assessmentDate||b.endDate||b.startDate||''))||String(a.createdAt||'').localeCompare(String(b.createdAt||'')));
    };
    window.getAssessmentSnapshotForEvent=function(eventId){
        const event=(window.icaoAssessmentEvents||{})[eventId]||{};
        if(event.linkedSnapshotId&&(window.icaoEiSnapshots||{})[event.linkedSnapshotId])return{id:event.linkedSnapshotId,...window.icaoEiSnapshots[event.linkedSnapshotId]};
        const found=Object.entries(window.icaoEiSnapshots||{}).find(([,x])=>x&&x.eventId===eventId&&!x.isDeleted);
        return found?{id:found[0],...found[1]}:null;
    };
    window.getAssessmentTimelineWithSnapshots=function(options={}){
        return window.getAssessmentTimeline(options).map(event=>({...event,snapshot:window.getAssessmentSnapshotForEvent(event.id)}));
    };
    window.getLatestOfficialAssessmentSnapshot=function(){
        const rows=window.getAssessmentTimelineWithSnapshots().filter(x=>x.resultStatus==='official'&&x.snapshot&&x.snapshot.resultStatus==='official');
        return rows.length?rows[rows.length-1]:null;
    };

    window.getOfficialAssessmentTimelineWithSnapshots=function(options={}){
        const includePassive=options.includePassive===true;
        return window.getAssessmentTimelineWithSnapshots({includePassive})
            .filter(x=>x&&x.resultStatus==='official'&&x.snapshot&&x.snapshot.resultStatus==='official'&&!x.snapshot.isDeleted)
            .filter(x=>includePassive||x.active!==false)
            .sort((a,b)=>String(a.assessmentDate||a.endDate||a.startDate||'').localeCompare(String(b.assessmentDate||b.endDate||b.startDate||''))||String(a.createdAt||'').localeCompare(String(b.createdAt||'')));
    };
    window.getAssessmentMetricValue=function(row,metric='Overall'){
        if(!row||!row.snapshot)return null;
        if(metric==='Overall'){
            const n=num(row.snapshot.overall&&row.snapshot.overall.ei);
            return n;
        }
        const area=String(metric||'').toUpperCase();
        if(!AREAS.includes(area))return null;
        return num(row.snapshot.areas&&row.snapshot.areas[area]&&row.snapshot.areas[area].ei);
    };
    window.isAreaInAssessmentScope=function(row,area){
        area=String(area||'').toUpperCase();
        if(!AREAS.includes(area)||!row)return false;
        const scope=normalizeAreas(row.scopeAreas||row.snapshot&&row.snapshot.scopeAreas||[]);
        if(scope.includes(area))return true;
        if(String(row.type||'').toUpperCase()==='CMAA')return true;
        return !!(row.snapshot&&row.snapshot.areas&&row.snapshot.areas[area]&&row.snapshot.areas[area].inScope===true);
    };
    window.getAssessmentChartRecords=function(options={}){
        return window.getOfficialAssessmentTimelineWithSnapshots(options).map(row=>{
            const areas={};
            AREAS.forEach(area=>{areas[area]=window.getAssessmentMetricValue(row,area);});
            return {
                id:row.id,
                name:row.name||row.type||'ICAO değerlendirmesi',
                label:row.name||row.type||'ICAO değerlendirmesi',
                type:row.type||'OTHER',
                resultStatus:row.resultStatus||'official',
                assessmentDate:row.assessmentDate||row.endDate||row.startDate||'',
                startDate:row.startDate||'',
                endDate:row.endDate||'',
                reportDate:row.reportDate||'',
                pqVersion:row.pqVersion||'',
                pqRevision:row.pqRevision||'',
                scopeAreas:normalizeAreas(row.scopeAreas||row.snapshot&&row.snapshot.scopeAreas||[]),
                overallEI:window.getAssessmentMetricValue(row,'Overall'),
                overallSatisfactory:intOrNull(row.snapshot&&row.snapshot.overall&&row.snapshot.overall.satisfactory),
                overallApplicable:intOrNull(row.snapshot&&row.snapshot.overall&&row.snapshot.overall.applicable),
                areas,
                source:row.source||row.snapshot&&row.snapshot.source||'',
                notes:row.notes||row.snapshot&&row.snapshot.notes||'',
                active:row.active!==false,
                snapshotId:row.snapshot&&row.snapshot.id||row.linkedSnapshotId||''
            };
        });
    };
    window.getAssessmentEffectiveAreaTimeline=function(area,options={}){
        area=String(area||'').toUpperCase();
        const rows=window.getOfficialAssessmentTimelineWithSnapshots(options);
        let effective=null;
        return rows.map((row,index)=>{
            const value=window.getAssessmentMetricValue(row,area);
            const inScope=window.isAreaInAssessmentScope(row,area);
            const baseline=index===0;
            if(value!==null&&(inScope||baseline))effective=value;
            return {eventId:row.id,name:row.name||row.type||'ICAO',type:row.type||'OTHER',assessmentDate:row.assessmentDate||'',inScope,value,effective,hasValue:value!==null};
        });
    };

    let assessmentUiRefreshTimer=null;
    function scheduleAssessmentUiRefresh(){
        clearTimeout(assessmentUiRefreshTimer);
        assessmentUiRefreshTimer=setTimeout(()=>{
            try{if(typeof renderIcaoOfficialPeriodControls==='function')renderIcaoOfficialPeriodControls();}catch(e){}
            try{if(typeof renderIcaoOfficialChart==='function')renderIcaoOfficialChart();}catch(e){}
            try{if(typeof renderIcaoOfficialTrend==='function')renderIcaoOfficialTrend();}catch(e){}
            try{if(typeof render==='function')render();}catch(e){}
        },80);
    }

    window.runAssessmentEventSelfCheck=function(){
        const events=window.getAssessmentTimeline({includePassive:true});
        const linked=events.filter(e=>e.linkedOfficialEiRecordId).length;
        const withSnapshot=events.filter(e=>window.getAssessmentSnapshotForEvent(e.id)).length;
        const result={
            passed:typeof window.syncAllOfficialEiRecordsToAssessmentModel==='function'&&typeof window.getAssessmentTimelineWithSnapshots==='function',
            moduleVersion:MODULE_VERSION,
            loaded:window.icaoAssessmentModelLoaded,
            events:events.length,
            snapshots:Object.values(window.icaoEiSnapshots||{}).filter(x=>x&&!x.isDeleted).length,
            linkedOfficialEi:linked,
            eventsWithSnapshot:withSnapshot,
            officialEiRecords:Object.values(window.icaoOfficialEiRecords||{}).filter(x=>x&&!x.isDeleted).length
        };
        console.log('Assessment Event / EI Snapshot öz denetimi:',result);return result;
    };

    updateStatus();
})();
