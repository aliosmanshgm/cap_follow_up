// ICAO PQ DOCX parser. Saf kaynak belgeyi yapilandirilmis PQ verisine donusturur.
(function(){
  'use strict';
  const WNS='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const AREAS=['LEG','ORG','PEL','OPS','AIR','AIG','ANS','AGA','SSP'];

  function normalizePQ(v){
    const s=String(v||'').trim().replace(/,/g,'.');
    const m=s.match(/\b(\d{1,2}\.\d{3})\b/);
    return m?m[1]:'';
  }
  function cellParagraphText(cell){
    if(!cell)return'';
    const ps=[...cell.getElementsByTagNameNS(WNS,'p')];
    return ps.map(p=>[...p.getElementsByTagNameNS(WNS,'t')].map(t=>t.textContent||'').join('').trim()).filter(Boolean).join('\n').trim();
  }
  function cellFill(cell){
    if(!cell)return'';
    const shd=cell.getElementsByTagNameNS(WNS,'shd')[0];
    if(!shd)return'';
    return String(shd.getAttributeNS(WNS,'fill')||shd.getAttribute('w:fill')||shd.getAttribute('fill')||'').toUpperCase();
  }
  function rowIsOnsite(tr){
    const cells=[...tr.children].filter(n=>n.localName==='tc');
    return cells.some(c=>{const f=cellFill(c);return f&&!['FFFFFF','AUTO','000000',''].includes(f);});
  }
  function splitGuidance(raw){
    const text=String(raw||'').trim();
    const m=text.match(/\bNotes? to the auditor\s*:\s*/i);
    if(!m)return{guidance:text,auditorNote:''};
    const i=m.index||0;
    return{guidance:text.slice(0,i).trim(),auditorNote:text.slice(i+m[0].length).trim()};
  }
  function paragraphText(xmlDoc){
    return [...xmlDoc.getElementsByTagNameNS(WNS,'p')].map(p=>[...p.getElementsByTagNameNS(WNS,'t')].map(t=>t.textContent||'').join('').trim()).filter(Boolean);
  }
  function detectMetadata(xmlDoc,fileName){
    const paras=paragraphText(xmlDoc),text=paras.join('\n');
    let year='',area='',revision='',publicationDate='';
    let m=text.match(/USOAP\s+CMA\s+(20\d{2})\s+Protocol Questions\s*[—–-]\s*([A-Z]{3})/i);
    if(m){year=m[1];area=m[2].toUpperCase();}
    if(!area){m=String(fileName||'').match(/(?:^|[_+\-\s])(LEG|ORG|PEL|OPS|AIR|AIG|ANS|AGA|SSP)(?:[_+\-\s]|$)/i);if(m)area=m[1].toUpperCase();}
    m=text.match(/\(([^()]*20\d{2}[^()]*)\)\s*[—–-]\s*Revision\s*([A-Za-z0-9.]+)/i);
    if(m){publicationDate=m[1].trim();revision=m[2].trim();}
    if(!revision){m=text.match(/Revision\s*([A-Za-z0-9.]+)/i);if(m)revision=m[1].trim();}
    if(!year){m=String(fileName||'').match(/(20\d{2})/);if(m)year=m[1];}
    return{year:year||'',area:AREAS.includes(area)?area:'',revision:revision||'',publicationDate,sourceFile:fileName||'',title:`USOAP CMA ${year||''} Protocol Questions — ${area||''}`.trim()};
  }
  function amendmentType(row){
    const names=['New','Revised','Deleted','Merged','No change'];
    for(let j=0;j<5;j++){if(/[✔✓x]/i.test(row[2+j]||''))return names[j];}
    const desc=String(row[7]||'');
    if(/no change/i.test(desc))return'No change';
    if(/deleted and merged/i.test(desc))return'Deleted';
    if(/new pq/i.test(desc))return'New';
    if(/merged with/i.test(desc))return'Merged';
    return'Revised';
  }
  function parseXml(xmlDoc,fileName){
    const meta=detectMetadata(xmlDoc,fileName),tables=[...xmlDoc.getElementsByTagNameNS(WNS,'tbl')];
    let amendments=[],pqs=[];
    const amendmentMeta={previousYear:'',currentYear:String(meta.year||'')};
    for(const table of tables){
      const trs=[...table.getElementsByTagNameNS(WNS,'tr')];
      const rows=trs.map(tr=>[...tr.children].filter(n=>n.localName==='tc').map(cellParagraphText));
      const head=rows.slice(0,3).flat().join(' | ');
      if(/Type of Amendment/i.test(head)&&/Description of Amendments/i.test(head)){
        let hi=rows.findIndex(r=>r.join(' ').includes('New')&&r.join(' ').includes('Revised')&&r.join(' ').includes('Deleted')&&r.join(' ').includes('Merged'));
        if(hi<0)hi=1;
        const versionHeader=rows.slice(0,Math.max(hi+1,2)).flat();
        const years=versionHeader.flatMap(x=>[...String(x||'').matchAll(/(20\d{2})/g)].map(m=>m[1]));
        if(years[0])amendmentMeta.previousYear=years[0];
        if(years[1])amendmentMeta.currentYear=years[1];
        rows.slice(hi+1).forEach((r,i)=>{
          if(r.length<8)return;
          const oldPq=normalizePQ(r[0]||''),newPq=normalizePQ(r[1]||'');
          if(!oldPq&&!newPq)return;
          amendments.push({id:String(i+1),oldPq,newPq,type:amendmentType(r),description:String(r[7]||'').trim()});
        });
      }
      if(/Protocol Question/i.test(head)&&/Guidance for Review of Evidence/i.test(head)&&/ICAO References/i.test(head)){
        let hi=rows.findIndex(r=>r.some(x=>/Protocol Question/i.test(x))&&r.some(x=>/Guidance for Review of Evidence/i.test(x)));
        if(hi<0)hi=0;
        for(let i=hi+1;i<rows.length;i++){
          const r=rows[i],tr=trs[i];
          if(r.length<6)continue;
          const pq=normalizePQ(r[0]||'');
          if(!pq)continue;
          const split=splitGuidance(r[2]||''),onSite=rowIsOnsite(tr);
          pqs.push({pq,area:meta.area,question:String(r[1]||'').trim(),guidance:split.guidance,auditorNote:split.auditorNote,references:String(r[3]||'').trim(),ppq:/\byes\b/i.test(r[4]||''),ce:String(r[5]||'').split('\n')[0].trim(),assessmentMode:onSite?'On-site':'Off-site',onSite});
        }
      }
    }
    const byNew=new Map(amendments.filter(a=>a.newPq).map(a=>[a.newPq,a]));
    pqs=pqs.map(p=>{const a=byNew.get(p.pq);return a?{...p,previousPq:a.oldPq||'',changeType:a.type||'',changeDescription:a.description||''}:p;});
    if(!pqs.length)throw new Error('ICAO PQ tablosu bulunamadı. “Protocol Question / Guidance for Review of Evidence / ICAO References / PPQ / CE” sütunları bekleniyor.');
    return{meta,amendmentMeta,pqs,amendments};
  }
  async function parseFile(file){
    if(!file)throw new Error('DOCX dosyası seçilmedi.');
    if(!/\.docx$/i.test(file.name||''))throw new Error(`${file.name||'Dosya'}: yalnız .docx destekleniyor.`);
    if(typeof JSZip==='undefined')throw new Error('JSZip yüklenemedi; DOCX okunamıyor.');
    const zip=await JSZip.loadAsync(file),docFile=zip.file('word/document.xml');
    if(!docFile)throw new Error(`${file.name}: word/document.xml bulunamadı.`);
    const xml=await docFile.async('string'),xmlDoc=new DOMParser().parseFromString(xml,'text/xml');
    const parserError=xmlDoc.getElementsByTagName('parsererror')[0];
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
