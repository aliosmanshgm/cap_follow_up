// CAP <-> ICAO PQ kalici baglanti ve surumler arasi lineage servisi.
(function(){
  'use strict';

  const AREAS=['LEG','ORG','PEL','OPS','AIR','AIG','ANS','AGA','SSP'];

  function normalizeArea(v){return String(v||'').trim().toUpperCase();}
  function normalizeRevision(v){v=String(v??'').trim();return(!v||/^(0|ilk\s*yay[ıi]n|initial\s*(issue|release)|original)$/i.test(v))?'0':v.replace(/^(?:rev(?:ision)?\.?|revizyon)\s*(?:no\.?|#)?\s*[:\-]?\s*/i,'').trim()||'0';}
  function normalizePq(v){const m=String(v||'').replace(',', '.').match(/\b(\d{1,2}\.\d{3})\b/);return m?m[1]:'';}
  function safeKey(v){return String(v||'').trim().replace(/[.#$\[\]\/]/g,'_').replace(/\s+/g,'_');}
  function fnv1a(str){let h=0x811c9dc5;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,0x01000193)>>>0;}return h.toString(36).toUpperCase();}
  function conceptId(area,seed){return `PQC_${safeKey(normalizeArea(area)||'GEN')}_${fnv1a(`${normalizeArea(area)}|${String(seed||'')}`)}`;}
  function instanceId({area,year,revision,pq}){return `PQI_${safeKey(normalizeArea(area))}_${safeKey(String(year||'?'))}_R${safeKey(normalizeRevision(revision))}_${safeKey(normalizePq(pq)||pq||'?')}`;}
  function parseEditionRank(edition){const y=parseInt(edition&&edition.year,10)||0;const r=normalizeRevision(edition&&edition.revision);const rn=parseFloat(String(r).replace(/[^0-9.]/g,''));return y*1000+(Number.isFinite(rn)?rn:0);}
  function editionEntries(library){return Object.entries((library&&library.editions)||{}).map(([key,v])=>({key,...(v||{})})).sort((a,b)=>parseEditionRank(a)-parseEditionRank(b)||String(a.key).localeCompare(String(b.key)));}
  function pqEntries(areaData){return Object.values((areaData&&areaData.pqs)||{}).filter(Boolean).sort((a,b)=>String(a.pq||'').localeCompare(String(b.pq||''),undefined,{numeric:true}));}
  function amendmentEntries(areaData){return Object.values((areaData&&areaData.amendments)||{}).filter(Boolean);}
  function uniq(values){return [...new Set((values||[]).filter(Boolean))];}

  function latestBefore(history,area,pq,rank){const arr=history.filter(x=>x.area===area&&x.pq===pq&&x.rank<rank).sort((a,b)=>b.rank-a.rank);return arr[0]||null;}
  function latestByConcept(history,concept,rank){return history.filter(x=>x.conceptId===concept&&x.rank<rank).sort((a,b)=>b.rank-a.rank)[0]||null;}

  function enrichLibrary(input){
    const library=input&&typeof input==='object'?input:{};
    library.editions=library.editions&&typeof library.editions==='object'?library.editions:{};
    library.activeByArea=library.activeByArea&&typeof library.activeByArea==='object'?library.activeByArea:{};
    const history=[];
    const conceptRecords={};

    for(const edition of editionEntries(library)){
      const rank=parseEditionRank(edition),areas=edition.areas||{};
      for(const [rawArea,areaData0] of Object.entries(areas)){
        const area=normalizeArea(rawArea),areaData=areaData0||{};
        const amendments=amendmentEntries(areaData);
        const byNew=new Map();
        for(const a of amendments){
          const np=normalizePq(a.newPq),op=normalizePq(a.oldPq);
          if(np){if(!byNew.has(np))byNew.set(np,[]);byNew.get(np).push({...a,oldPq:op,newPq:np});}
        }

        for(const p0 of pqEntries(areaData)){
          const p=p0||{},pq=normalizePq(p.pq);if(!pq)continue;
          p.pq=pq;p.area=area;
          p.instanceId=p.instanceId||instanceId({area,year:edition.year,revision:edition.revision,pq});
          const amendmentRows=byNew.get(pq)||[];
          const previousPqs=uniq([normalizePq(p.previousPq),...amendmentRows.map(a=>normalizePq(a.oldPq))]);
          const predecessorInstances=uniq(previousPqs.map(old=>latestBefore(history,area,old,rank)).filter(Boolean).map(x=>x.instanceId));
          const predecessorConcepts=uniq(previousPqs.map(old=>latestBefore(history,area,old,rank)).filter(Boolean).map(x=>x.conceptId));
          const sameNumberPrevious=latestBefore(history,area,pq,rank);
          const declaredType=String(p.changeType||((amendmentRows[0]||{}).type)||'').trim();
          const merged=declaredType.toLowerCase()==='merged'||predecessorConcepts.length>1;

          let cid=String(p.conceptId||'').trim();
          if(!cid){
            if(!merged&&predecessorConcepts.length===1)cid=predecessorConcepts[0];
            else if(!previousPqs.length&&sameNumberPrevious)cid=sameNumberPrevious.conceptId;
            else cid=conceptId(area,`${edition.year}|${pq}|${previousPqs.join('+')||'new'}`);
          }
          p.conceptId=cid;
          p.lineage={
            relation:declaredType||(!previousPqs.length&&sameNumberPrevious?'Same number':'New'),
            previousPqs,
            previousInstanceIds:predecessorInstances,
            parentConceptIds:merged?predecessorConcepts:[],
            inheritedFromConceptId:(!merged&&predecessorConcepts.length===1)?predecessorConcepts[0]:'',
            editionKey:edition.key,
            editionYear:String(edition.year||''),
            revision:String(edition.revision||'')
          };
          history.push({instanceId:p.instanceId,conceptId:cid,area,pq,editionKey:edition.key,year:String(edition.year||''),revision:String(edition.revision||''),rank,record:p});

          const c=conceptRecords[cid]||(conceptRecords[cid]={conceptId:cid,area,firstSeen:null,lastSeen:null,instances:{},aliases:{},parentConceptIds:{},successorConceptIds:{},status:'historical'});
          const inst={instanceId:p.instanceId,editionKey:edition.key,year:String(edition.year||''),revision:String(edition.revision||''),pq,changeType:declaredType||'',assessmentMode:p.assessmentMode||'',ce:p.ce||'',sspComponent:p.sspComponent||''};
          c.instances[p.instanceId]=inst;c.aliases[pq]=true;
          if(!c.firstSeen||rank<parseEditionRank(c.firstSeen))c.firstSeen={editionKey:edition.key,year:String(edition.year||''),revision:String(edition.revision||''),pq};
          if(!c.lastSeen||rank>=parseEditionRank(c.lastSeen))c.lastSeen={editionKey:edition.key,year:String(edition.year||''),revision:String(edition.revision||''),pq};
          for(const pc of p.lineage.parentConceptIds)c.parentConceptIds[pc]=true;
        }
      }
    }

    // Successor concept baglantilarini iki yonlu tamamla.
    for(const c of Object.values(conceptRecords))for(const parent of Object.keys(c.parentConceptIds||{})){if(conceptRecords[parent])conceptRecords[parent].successorConceptIds[c.conceptId]=true;}

    // Aktif instance'lari alan bazli isaretle.
    for(const area of AREAS){
      const active=(library.activeByArea||{})[area];if(!active||!active.editionKey)continue;
      const edition=(library.editions||{})[active.editionKey]||{};const areaData=((edition.areas||{})[area])||{};
      for(const p of pqEntries(areaData)){
        const c=conceptRecords[p.conceptId];if(!c)continue;c.currentInstanceId=p.instanceId;c.currentEditionKey=active.editionKey;c.currentPq=p.pq;c.status='active';
      }
    }

    // Aktif pointer yoksa en son gorulen instance'i current kabul etme; status historical kalsin.
    const now=new Date().toISOString();
    library.concepts=conceptRecords;
    library.linkageMeta={schemaVersion:2,generatedAt:now,instanceCount:history.length,conceptCount:Object.keys(conceptRecords).length};
    return library;
  }

  function buildIndex(library){
    enrichLibrary(library);
    const instances=new Map(),byAreaPq=new Map(),byConcept=new Map();
    for(const edition of editionEntries(library)){
      for(const [rawArea,areaData] of Object.entries(edition.areas||{})){
        const area=normalizeArea(rawArea);
        for(const p of pqEntries(areaData)){
          const item={instanceId:p.instanceId,conceptId:p.conceptId,area,pq:p.pq,editionKey:edition.key,year:String(edition.year||''),revision:String(edition.revision||''),rank:parseEditionRank(edition),record:p,areaData,edition};
          instances.set(p.instanceId,item);
          const k=`${area}|${p.pq}`;if(!byAreaPq.has(k))byAreaPq.set(k,[]);byAreaPq.get(k).push(item);
          if(!byConcept.has(p.conceptId))byConcept.set(p.conceptId,[]);byConcept.get(p.conceptId).push(item);
        }
      }
    }
    for(const arr of byAreaPq.values())arr.sort((a,b)=>b.rank-a.rank);
    for(const arr of byConcept.values())arr.sort((a,b)=>b.rank-a.rank);
    return{instances,byAreaPq,byConcept,concepts:library.concepts||{}};
  }

  function activeAreaEdition(library,area){const p=(library.activeByArea||{})[normalizeArea(area)];return p&&p.editionKey?String(p.editionKey):'';}
  function activeInstancesForArea(library,index,area){const key=activeAreaEdition(library,area);if(!key)return[];const ed=(library.editions||{})[key]||{},ad=((ed.areas||{})[normalizeArea(area)])||{};return pqEntries(ad).map(p=>index.instances.get(p.instanceId)).filter(Boolean);}

  function resolveCapReference(library,pq,area,existingLink){
    area=normalizeArea(area);pq=normalizePq(pq);const index=buildIndex(library),existing=existingLink&&typeof existingLink==='object'?existingLink:{};
    if(!pq||!area)return{status:'unmatched',reason:'PQ numarasi veya denetim alani eksik',pq,area};
    let source=null;
    const oldSourceId=(existing.sourcePqRef||{}).instanceId||existing.sourceInstanceId||'';
    if(oldSourceId&&index.instances.has(oldSourceId))source=index.instances.get(oldSourceId);
    if(!source){
      const exact=(index.byAreaPq.get(`${area}|${pq}`)||[]);
      const activeKey=activeAreaEdition(library,area);
      source=exact.find(x=>x.editionKey===activeKey)||exact[0]||null;
    }
    if(!source)return{status:'unmatched',reason:'PQ veri tabaninda tarihsel eslesme bulunamadi',pq,area};

    const cid=String(existing.pqConceptId||source.conceptId||'');
    const active=activeInstancesForArea(library,index,area);
    let current=active.find(x=>x.conceptId===cid)||null;
    let relation='same-concept';
    if(!current){
      const successors=active.filter(x=>{
        const lin=(x.record&&x.record.lineage)||{};
        return (lin.parentConceptIds||[]).includes(cid)||(lin.previousPqs||[]).includes(pq);
      });
      if(successors.length===1){current=successors[0];relation='successor';}
      else if(successors.length>1)return{status:'ambiguous',reason:'Birden fazla aktif ardil PQ bulundu',pq,area,pqConceptId:cid,sourcePqRef:ref(source),candidateCurrentRefs:successors.map(ref)};
    }
    if(!current){
      const hist=(index.byConcept.get(cid)||[]);current=hist[0]||source;relation=current.instanceId===source.instanceId?'historical-only':'same-concept-history';
    }
    const changed=current.pq!==source.pq||current.editionKey!==source.editionKey;
    return{status:current?'linked':'unmatched',relation,pq,area,pqConceptId:cid,sourcePqRef:ref(source),currentPqRef:current?ref(current):null,renumbered:!!(current&&current.pq!==pq),versionChanged:changed,linkedAt:existing.linkedAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
  }

  function ref(item){if(!item)return null;return{instanceId:item.instanceId,conceptId:item.conceptId,area:item.area,pq:item.pq,editionKey:item.editionKey,year:item.year,revision:item.revision};}

  function linkCapData(rawData,pqMasterData,library){
    if(!Array.isArray(rawData)||!library)return{linked:0,unmatched:0,ambiguous:0,renumbered:0,total:0};
    const cache=new Map(),summary={linked:0,unmatched:0,ambiguous:0,renumbered:0,total:0};
    for(const row of rawData){
      if(!row||!row.pq)continue;summary.total++;
      const master=(pqMasterData&&pqMasterData[row.pq])||{};const area=normalizeArea(master.alan||row.area||'');const key=`${area}|${row.pq}`;
      let link=cache.get(key);if(!link){link=resolveCapReference(library,row.pq,area,row.pqLink);cache.set(key,link);}else if(row.pqLink&&row.pqLink.sourcePqRef&&row.pqLink.sourcePqRef.instanceId!==((link.sourcePqRef||{}).instanceId)){link=resolveCapReference(library,row.pq,area,row.pqLink);cache.set(key,link);}
      row.pqLink=link;row.pqConceptId=link.pqConceptId||'';row.sourcePqRef=link.sourcePqRef||null;row.currentPqRef=link.currentPqRef||null;row.pqLinkStatus=link.status||'unmatched';
      if(master){master.pqLink=link;master.pqConceptId=link.pqConceptId||'';master.currentPqRef=link.currentPqRef||null;}
      if(link.status==='linked')summary.linked++;else if(link.status==='ambiguous')summary.ambiguous++;else summary.unmatched++;if(link.renumbered)summary.renumbered++;
    }
    return summary;
  }

  function linkageSummary(rawData){
    const byPq=new Map();for(const r of rawData||[]){if(!r||!r.pq)continue;if(!byPq.has(r.pq))byPq.set(r.pq,r.pqLink||{status:'unmatched'});}
    const out={pqCount:byPq.size,linked:0,unmatched:0,ambiguous:0,renumbered:0};for(const l of byPq.values()){if(l.status==='linked')out.linked++;else if(l.status==='ambiguous')out.ambiguous++;else out.unmatched++;if(l.renumbered)out.renumbered++;}return out;
  }

  window.PQLinkage={AREAS,normalizeArea,normalizePq,normalizeRevision,safeKey,conceptId,instanceId,enrichLibrary,buildIndex,resolveCapReference,linkCapData,linkageSummary};
})();
