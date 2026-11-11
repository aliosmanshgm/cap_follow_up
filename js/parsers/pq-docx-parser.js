// ICAO PQ DOCX parser. Saf kaynak belgeyi yapilandirilmis PQ verisine donusturur.
// Faz 2.4: namespace bagimsiz tablo okuma + sdt ile sarilmis hucre destegi + baslik adina gore kolon esleme.
(function(){
  'use strict';

  const AREAS=['LEG','ORG','PEL','OPS','AIR','AIG','ANS','AGA','SSP'];

  function localNameOf(node){
    return String((node&&node.localName)||((node&&node.nodeName)||'').split(':').pop()||'').toLowerCase();
  }
  function directChildrenByLocalName(node,name){
    name=String(name||'').toLowerCase();
    if(!node)return[];
    const src=node.children?Array.from(node.children):Array.from(node.childNodes||[]).filter(n=>n&&n.nodeType===1);
    return src.filter(n=>localNameOf(n)===name);
  }
  function descendantsByLocalName(node,name){
    name=String(name||'').toLowerCase();
    if(!node)return[];
    const out=[];
    const all=node.getElementsByTagName?Array.from(node.getElementsByTagName('*')):[];
    for(const el of all)if(localNameOf(el)===name)out.push(el);
    return out;
  }
  function firstDescendantByLocalName(node,name){
    const a=descendantsByLocalName(node,name);return a.length?a[0]:null;
  }
  function attrByLocalName(node,name){
    if(!node||!node.attributes)return'';
    name=String(name||'').toLowerCase();
    for(const a of Array.from(node.attributes||[])){
      const n=String(a.localName||a.name||'').split(':').pop().toLowerCase();
      if(n===name)return String(a.value||'');
    }
    return'';
  }
  function normalizeSpace(v){return String(v||'').replace(/\u00a0/g,' ').replace(/[ \t]+/g,' ').replace(/\s*\n\s*/g,'\n').trim();}
  function normalizeHeader(v){
    return String(v||'').replace(/\u00a0/g,' ').replace(/[\r\n]+/g,' ').replace(/\s+/g,' ').trim().toLowerCase();
  }
  function normalizePQ(v){
    const s=String(v||'').trim().replace(/,/g,'.');
    const m=s.match(/\b(\d{1,2}\.\d{3})\b/);
    return m?m[1]:'';
  }
  function paragraphTextFromNode(p){
    // Metin akisini belge sirasinda oku; Word'ün w:br / w:tab elemanlarini kaybetme.
    const parts=[];
    function walk(node){
      const children=node&&node.childNodes?Array.from(node.childNodes):[];
      for(const child of children){
        if(!child)continue;
        if(child.nodeType===3){continue;}
        if(child.nodeType!==1)continue;
        const ln=localNameOf(child);
        if(ln==='t'){parts.push(child.textContent||'');continue;}
        if(ln==='br'||ln==='cr'){parts.push('\n');continue;}
        if(ln==='tab'){parts.push('\t');continue;}
        walk(child);
      }
    }
    walk(p);
    return parts.join('').replace(/[ \t]+\n/g,'\n').replace(/\n[ \t]+/g,'\n').trim();
  }
  function cellParagraphText(cell){
    if(!cell)return'';
    const ps=descendantsByLocalName(cell,'p');
    if(!ps.length)return normalizeSpace(cell.textContent||'');
    return ps.map(paragraphTextFromNode).filter(Boolean).join('\n').trim();
  }
  // Word bazı ICAO PQ dokümanlarında (örn. AGA) tablo hücrelerini doğrudan
  // <w:tc> yerine <w:sdt><w:sdtContent><w:tc>...</w:tc></w:sdtContent></w:sdt>
  // biçiminde saklar. Satırın mantıksal hücre sırasını koruyarak her iki yapıyı da oku.
  function rowCells(tr){
    const out=[];
    function walk(node){
      const children=node&&node.childNodes?Array.from(node.childNodes).filter(n=>n&&n.nodeType===1):[];
      for(const child of children){
        const ln=localNameOf(child);
        if(ln==='tc'){out.push(child);continue;}
        // İç içe tablo/satırların hücrelerini mevcut satıra karıştırma.
        if(ln==='tbl'||ln==='tr')continue;
        // sdt/customXml/ins/del vb. Word sarmalayıcılarının içinden hücreyi bul.
        walk(child);
      }
    }
    walk(tr);
    return out;
  }
  function tableRows(table){return descendantsByLocalName(table,'tr').filter(tr=>{
    // nested table varsa yalnizca en yakin ust tbl bu tablo olsun
    let p=tr.parentNode;
    while(p&&p!==table&&localNameOf(p)!=='tbl')p=p.parentNode;
    return p===table;
  });}
  function rowTexts(tr){return rowCells(tr).map(cellParagraphText);}
  function cellFill(cell){
    if(!cell)return'';
    const shd=firstDescendantByLocalName(cell,'shd');
    return String(attrByLocalName(shd,'fill')||'').toUpperCase();
  }
  function rowIsOnsite(tr){
    const neutral=new Set(['FFFFFF','AUTO','000000','']);
    return rowCells(tr).some(c=>{const f=cellFill(c);return !!f&&!neutral.has(f);});
  }
  function splitGuidance(raw){
    const text=String(raw||'').trim();
    const m=text.match(/\bNotes?\s+to\s+the\s+auditor\s*:\s*/i);
    if(!m)return{guidance:text,auditorNote:''};
    const i=m.index||0;
    return{guidance:text.slice(0,i).trim(),auditorNote:text.slice(i+m[0].length).trim()};
  }
  function paragraphText(xmlDoc){
    return descendantsByLocalName(xmlDoc,'p').map(paragraphTextFromNode).filter(Boolean);
  }
  function detectMetadata(xmlDoc,fileName){
    const paras=paragraphText(xmlDoc),text=paras.join('\n');
    let year='',area='',revision='',publicationDate='';
    let m=text.match(/USOAP\s+CMA\s+(20\d{2})\s+Protocol\s+Questions\s*[—–-]\s*([A-Z]{3})/i);
    if(m){year=m[1];area=m[2].toUpperCase();}
    if(!area){m=String(fileName||'').match(/(?:^|[_+\-\s])(LEG|ORG|PEL|OPS|AIR|AIG|ANS|AGA|SSP)(?:[_+\-\s]|$)/i);if(m)area=m[1].toUpperCase();}
    m=text.match(/\(([^()]*20\d{2}[^()]*)\)\s*[—–-]\s*Revision\s*([A-Za-z0-9.]+)/i);
    if(m){publicationDate=m[1].trim();revision=m[2].trim();}
    if(!revision){m=text.match(/Revision\s*([A-Za-z0-9.]+)/i);if(m)revision=m[1].trim();}
    if(!year){m=String(fileName||'').match(/(20\d{2})/);if(m)year=m[1];}
    return{year:year||'',area:AREAS.includes(area)?area:'',revision:revision||'',publicationDate,sourceFile:fileName||'',title:`USOAP CMA ${year||''} Protocol Questions — ${area||''}`.trim()};
  }

  function findHeaderRow(rows,requiredGroups,maxScan){
    const limit=Math.min(rows.length,maxScan||8);
    for(let i=0;i<limit;i++){
      const norm=rows[i].map(normalizeHeader);
      const ok=requiredGroups.every(group=>group.some(token=>norm.some(h=>h.includes(token))));
      if(ok)return i;
    }
    return-1;
  }
  function findColumn(row,aliases){
    const norm=row.map(normalizeHeader),aNorm=aliases.map(normalizeHeader);
    // Once tam eslesme: ozellikle CE gibi kisa basliklar Guidance kelimesinin icinden yanlis eslesmesin.
    for(let i=0;i<norm.length;i++)if(aNorm.some(a=>norm[i]===a))return i;
    // Sonra yalnizca yeterince uzun alias'larda kontrollu icerme eslesmesi.
    for(let i=0;i<norm.length;i++)if(aNorm.some(a=>a.length>=4&&norm[i].includes(a)))return i;
    return-1;
  }
  function amendmentTypeFromColumns(row,cols,description){
    const tests=[['New',cols.new],['Revised',cols.revised],['Deleted',cols.deleted],['Merged',cols.merged],['No change',cols.noChange]];
    for(const [name,idx] of tests){if(idx>=0&&/[✔✓xX]/.test(String(row[idx]||'')))return name;}
    const desc=String(description||'');
    if(/\bno change\b/i.test(desc))return'No change';
    if(/deleted and merged/i.test(desc))return'Deleted';
    if(/\bnew pq\b/i.test(desc))return'New';
    if(/merged with/i.test(desc))return'Merged';
    if(/deleted/i.test(desc))return'Deleted';
    return'Revised';
  }
  function parseAmendmentTable(table,meta){
    const trs=tableRows(table),rows=trs.map(rowTexts);
    if(!rows.length)return null;
    const flatHead=rows.slice(0,4).flat().map(normalizeHeader).join(' | ');
    if(!flatHead.includes('type of amendment')||!flatHead.includes('description of amendments'))return null;

    const typeRow=findHeaderRow(rows,[[ 'new' ],[ 'revised' ],[ 'deleted' ],[ 'merged' ]],6);
    if(typeRow<0)return{records:[],meta:{previousYear:'',currentYear:String(meta.year||'')}};
    const typeHeaders=rows[typeRow];
    const cols={
      new:findColumn(typeHeaders,['new']),revised:findColumn(typeHeaders,['revised']),deleted:findColumn(typeHeaders,['deleted']),merged:findColumn(typeHeaders,['merged']),noChange:findColumn(typeHeaders,['no change'])
    };
    // Veri satirlarinda ilk iki kolon eski/yeni PQ; son kolon aciklamadir. Bu, ICAO matbu tablosunun stabil yapisidir.
    const headerText=rows.slice(0,typeRow+1).flat().join(' ');
    const years=[...headerText.matchAll(/(20\d{2})/g)].map(m=>m[1]);
    const ameta={previousYear:years[0]||'',currentYear:years[1]||String(meta.year||'')};
    const records=[];
    for(let i=typeRow+1;i<rows.length;i++){
      const r=rows[i];
      if(r.length<3)continue;
      const oldPq=normalizePQ(r[0]||''),newPq=normalizePQ(r[1]||'');
      if(!oldPq&&!newPq)continue;
      const descIndex=r.length-1,description=String(r[descIndex]||'').trim();
      records.push({id:String(records.length+1),oldPq,newPq,type:amendmentTypeFromColumns(r,cols,description),description});
    }
    return{records,meta:ameta};
  }
  function parsePqTable(table,meta){
    const trs=tableRows(table),rows=trs.map(rowTexts);
    if(!rows.length)return null;
    const hi=findHeaderRow(rows,[['pq no','pq no.'],['protocol question'],['guidance for review of evidence'],['icao references'],['ppq'],['ce']],10);
    if(hi<0)return null;
    const h=rows[hi];
    const cols={
      pq:findColumn(h,['pq no.','pq no']),
      question:findColumn(h,['protocol question']),
      guidance:findColumn(h,['guidance for review of evidence']),
      refs:findColumn(h,['icao references']),
      ppq:findColumn(h,['ppq']),
      ce:findColumn(h,['ce'])
    };
    if(Object.values(cols).some(v=>v<0))return null;
    const out=[];
    for(let i=hi+1;i<rows.length;i++){
      const r=rows[i],tr=trs[i];
      const pq=normalizePQ(r[cols.pq]||'');
      if(!pq)continue;
      const split=splitGuidance(r[cols.guidance]||''),onSite=rowIsOnsite(tr);
      const ceRaw=String(r[cols.ce]||'').trim();
      const ceMatch=ceRaw.match(/\bCE\s*-?\s*([1-8])\b/i);
      out.push({
        pq,area:meta.area,
        question:String(r[cols.question]||'').trim(),
        guidance:split.guidance,auditorNote:split.auditorNote,
        references:String(r[cols.refs]||'').trim(),
        ppq:/\byes\b/i.test(String(r[cols.ppq]||'')),
        ce:ceMatch?`CE-${ceMatch[1]}`:ceRaw.split('\n')[0].trim(),
        assessmentMode:onSite?'On-site':'Off-site',onSite
      });
    }
    return{records:out,headerIndex:hi,columns:cols};
  }

  function parseXml(xmlDoc,fileName){
    const meta=detectMetadata(xmlDoc,fileName),tables=descendantsByLocalName(xmlDoc,'tbl');
    let amendments=[],pqs=[];
    let amendmentMeta={previousYear:'',currentYear:String(meta.year||'')};
    const diagnostics={tableCount:tables.length,pqTableCandidates:0,amendmentTableCandidates:0,headers:[]};

    for(const table of tables){
      const rows=tableRows(table).map(rowTexts);
      diagnostics.headers.push(rows.slice(0,2).flat().join(' | ').slice(0,500));
      const a=parseAmendmentTable(table,meta);
      if(a){diagnostics.amendmentTableCandidates++;amendments.push(...a.records);if(a.meta.previousYear||a.meta.currentYear)amendmentMeta=a.meta;}
      const q=parsePqTable(table,meta);
      if(q){diagnostics.pqTableCandidates++;pqs.push(...q.records);}
    }

    // Ayni PQ birden fazla tablo/parca icinde gorunurse ilk dolu kaydi koru, eksik alanlari sonraki kayittan tamamla.
    const dedup=new Map();
    for(const p of pqs){
      if(!dedup.has(p.pq)){dedup.set(p.pq,p);continue;}
      const old=dedup.get(p.pq),merged={...old};
      for(const k of ['question','guidance','auditorNote','references','ce'])if(!merged[k]&&p[k])merged[k]=p[k];
      merged.ppq=!!(old.ppq||p.ppq);merged.onSite=!!(old.onSite||p.onSite);merged.assessmentMode=merged.onSite?'On-site':'Off-site';
      dedup.set(p.pq,merged);
    }
    pqs=[...dedup.values()];

    const byNew=new Map(amendments.filter(a=>a.newPq).map(a=>[a.newPq,a]));
    pqs=pqs.map(p=>{const a=byNew.get(p.pq);return a?{...p,previousPq:a.oldPq||'',changeType:a.type||'',changeDescription:a.description||''}:p;});

    if(!pqs.length){
      const headers=diagnostics.headers.filter(Boolean);
      const seen=headers.slice(0,4).join(' || ');
      const joined=headers.join(' | ').toLowerCase();
      const looksLikeCap=joined.includes('protocol finding') && joined.includes('status') && joined.includes('icao ref');
      const suffix=` Tanılama: ${diagnostics.tableCount} tablo bulundu${seen?`; ilk başlıklar: ${seen}`:''}.`;
      if(looksLikeCap){
        throw new Error(`Seçilen dosya bir ICAO PQ Edition dokümanı değil; CAP / Findings export dokümanı olarak algılandı (${fileName||'DOCX'}). Bu menüde 2024 AIR örneğindeki gibi “PQ No. / Protocol Question / Guidance for Review of Evidence / ICAO References / PPQ / CE” tablosunu içeren ICAO PQ Word dosyasını seçin.`+suffix);
      }
      throw new Error(`ICAO PQ tablosu bulunamadı (${fileName||'DOCX'}). “Protocol Question / Guidance for Review of Evidence / ICAO References / PPQ / CE” sütunları bekleniyor.`+suffix);
    }
    return{meta,amendmentMeta,pqs,amendments,diagnostics};
  }

  async function parseFile(file){
    if(!file)throw new Error('DOCX dosyası seçilmedi.');
    if(!/\.docx$/i.test(file.name||''))throw new Error(`${file.name||'Dosya'}: yalnız .docx destekleniyor.`);
    if(typeof JSZip==='undefined')throw new Error('JSZip yüklenemedi; DOCX okunamıyor. Sayfayı yenileyip tekrar deneyin.');
    const zip=await JSZip.loadAsync(file),docFile=zip.file('word/document.xml');
    if(!docFile)throw new Error(`${file.name}: word/document.xml bulunamadı.`);
    const xml=await docFile.async('string'),xmlDoc=new DOMParser().parseFromString(xml,'application/xml');
    const parserError=Array.from(xmlDoc.getElementsByTagName('*')).find(n=>localNameOf(n)==='parsererror');
    if(parserError)throw new Error(`${file.name}: document.xml ayrıştırılamadı.`);
    return parseXml(xmlDoc,file.name);
  }
  function validate(parsed){
    const errors=[],warnings=[];
    if(!parsed||!parsed.meta){errors.push('Doküman metadatası okunamadı.');return{valid:false,errors,warnings,metrics:{}};}
    const {meta,pqs=[],amendments=[]}=parsed;
    if(!/^20\d{2}$/.test(String(meta.year||'')))errors.push('PQ edition yılı tespit edilemedi.');
    if(!AREAS.includes(String(meta.area||'').toUpperCase()))errors.push('Denetim alanı (LEG/ORG/PEL/OPS/AIR/AIG/ANS/AGA/SSP) tespit edilemedi.');
    if(!String(meta.revision||'').trim())warnings.push('Revision bilgisi tespit edilemedi.');
    if(!pqs.length)errors.push('PQ kaydı bulunamadı.');
    const ids=pqs.map(p=>p.pq),dup=[...new Set(ids.filter((x,i)=>ids.indexOf(x)!==i))];
    if(dup.length)errors.push(`Mükerrer PQ numarası: ${dup.slice(0,8).join(', ')}${dup.length>8?'…':''}`);
    const missingQuestion=pqs.filter(p=>!p.question).length,missingGuidance=pqs.filter(p=>!p.guidance).length,missingRefs=pqs.filter(p=>!p.references).length,missingCe=pqs.filter(p=>!/^CE-\d$/i.test(String(p.ce||''))).length;
    if(missingQuestion)warnings.push(`${missingQuestion} PQ'da Protocol Question boş.`);
    if(missingGuidance)warnings.push(`${missingGuidance} PQ'da Guidance boş.`);
    if(missingRefs)warnings.push(`${missingRefs} PQ'da ICAO References boş.`);
    if(missingCe)warnings.push(`${missingCe} PQ'da CE boş veya beklenen CE-1…CE-8 formatında değil.`);
    if(!amendments.length)warnings.push('Summary of Amendments tablosu bulunmadı veya boş.');
    const metrics={pqCount:pqs.length,onSite:pqs.filter(p=>p.onSite).length,offSite:pqs.filter(p=>!p.onSite).length,ppq:pqs.filter(p=>p.ppq).length,auditorNotes:pqs.filter(p=>p.auditorNote).length,amendments:amendments.length,missingQuestion,missingGuidance,missingRefs,missingCe};
    return{valid:errors.length===0,errors,warnings,metrics};
  }
  window.PQDocxParser={parseFile,parseXml,validate,normalizePQ};
})();
