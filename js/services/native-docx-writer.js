(function(){
  'use strict';
  const W=15638;
  const clean=v=>String(v??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'');
  const xml=v=>clean(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  function run(value,options={}){
    const properties=(options.bold?'<w:b/>':'')+(options.size?`<w:sz w:val="${options.size}"/>`:'')+(options.color?`<w:color w:val="${options.color}"/>`:'');
    return `<w:r>${properties?`<w:rPr>${properties}</w:rPr>`:''}${clean(value).split('\n').map((line,i)=>(i?'<w:br/>':'')+`<w:t xml:space="preserve">${xml(line)}</w:t>`).join('')}</w:r>`;
  }
  function paragraph(text,options={}){
    const style=options.style?`<w:pStyle w:val="${options.style}"/>`:'';
    return `<w:p><w:pPr>${style}${options.pageBreak?'<w:pageBreakBefore/>':''}${options.keep?'<w:keepNext/>':''}${options.align?`<w:jc w:val="${options.align}"/>`:''}<w:widowControl/>${options.compact?'<w:spacing w:before="0" w:after="20"/>':''}</w:pPr>${options.runs||run(text,options)}</w:p>`;
  }
  function table(block){
    const weights=block.weights||block.headers.map(()=>1),sum=weights.reduce((a,b)=>a+b,0);let used=0;
    const widths=weights.map((v,i)=>{const n=i===weights.length-1?W-used:Math.round(W*v/sum);used+=n;return n;});
    const rows=[...(block.headers.length?[block.headers]:[]),...block.rows];
    const body=rows.map((row,i)=>`<w:tr><w:trPr>${block.headers.length&&i===0?'<w:tblHeader/>':''}</w:trPr>${row.map((cell,j)=>{
      const head=block.headers.length&&i===0,fill=head?'E2E8F0':i%2?'F8FAFC':null;
      return `<w:tc><w:tcPr><w:tcW w:w="${widths[j]}" w:type="dxa"/>${fill?`<w:shd w:fill="${fill}"/>`:''}<w:vAlign w:val="center"/></w:tcPr>${paragraph(cell,{bold:head,compact:true,align:block.key==='ei'?'center':'left'})}</w:tc>`;
    }).join('')}</w:tr>`).join('');
    return `<w:tbl><w:tblPr><w:tblW w:w="${W}" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="CBD5E1"/><w:bottom w:val="single" w:sz="4" w:color="CBD5E1"/><w:insideH w:val="single" w:sz="3" w:color="CBD5E1"/></w:tblBorders><w:tblCellMar><w:top w:w="120" w:type="dxa"/><w:left w:w="140" w:type="dxa"/><w:bottom w:w="120" w:type="dxa"/><w:right w:w="140" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${widths.map(n=>`<w:gridCol w:w="${n}"/>`).join('')}</w:tblGrid>${body}</w:tbl>${paragraph('',{compact:true})}`;
  }
  function kpis(block){
    const width=Math.floor(W/block.cards.length);
    return `<w:tbl><w:tblPr><w:tblW w:w="${W}" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="150" w:type="dxa"/><w:bottom w:w="150" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${block.cards.map(()=>`<w:gridCol w:w="${width}"/>`).join('')}</w:tblGrid><w:tr>${block.cards.map(c=>`<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/><w:shd w:fill="${c.fill.replace('#','')}"/></w:tcPr>${paragraph('',{align:'center',compact:true,runs:run(c.label+'\n',{size:22})+run(c.value,{size:36,bold:true})})}</w:tc>`).join('')}</w:tr></w:tbl>${paragraph('',{compact:true})}`;
  }
  async function png(svg,width,height){
    const image=new Image(),url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml;charset=utf-8'}));
    try{await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('Word raporu grafiği hazırlanamadı.'));image.src=url;});
      const canvas=document.createElement('canvas');canvas.width=Math.round(width*2);canvas.height=Math.round(height*2);const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);return canvas.toDataURL('image/png').split(',')[1];
    }finally{URL.revokeObjectURL(url);}
  }
  function drawing(id,width,height,title){
    const cx=Math.round(width*12700),cy=Math.round(height*12700);
    return `<w:p><w:pPr><w:spacing w:after="140"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${id}" name="EI Chart ${id}" descr="${xml(title)}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="0" name="chart${id}.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdImage${id}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
  }
  async function create(model){
    if(typeof JSZip==='undefined')throw new Error('Word dışa aktarma için JSZip yüklenemedi.');
    const zip=new JSZip(),relations=[['rIdStyles','styles','styles.xml'],['rIdSettings','settings','settings.xml'],['rIdFooter','footer','footer1.xml']];
    let body=paragraph(model.title,{style:'Title'})+paragraph(model.subtitle,{style:'Subtitle'}),imageId=0;
    for(const b of model.blocks){
      if(b.kind==='heading')body+=paragraph(b.text,{style:b.level===3?'Heading2':b.level===4?'Heading3':'Heading1',pageBreak:b.pageBreak,keep:true});
      else if(b.kind==='kpis')body+=kpis(b);
      else if(b.kind==='table')body+=table(b);
      else if(b.kind==='paragraph')for(const p of b.text.split(/\n\s*\n/))body+=paragraph(p);
      else if(b.kind==='chart'){const id=++imageId;zip.file(`word/media/chart${id}.png`,await png(b.svg,b.width,b.height),{base64:true});relations.push([`rIdImage${id}`,'image',`media/chart${id}.png`]);body+=drawing(id,b.width,b.height,b.title);}
    }
    body+='<w:sectPr><w:footerReference w:type="default" r:id="rIdFooter"/><w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/><w:pgMar w:top="560" w:right="600" w:bottom="600" w:left="600" w:header="240" w:footer="240"/></w:sectPr>';
    const declaration='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
    zip.file('word/document.xml',declaration+`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><w:body>${body}</w:body></w:document>`);
    const styles=[['Normal','Normal',22,'0F172A',false],['Title','Title',34,'1D4ED8',true],['Subtitle','Subtitle',20,'475569',false],['Heading1','heading 1',26,'0F172A',true],['Heading2','heading 2',24,'1E3A8A',true],['Heading3','heading 3',22,'0F172A',true]];
    zip.file('word/styles.xml',declaration+`<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="22"/><w:lang w:val="tr-TR"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="140" w:line="278" w:lineRule="auto"/><w:widowControl/></w:pPr></w:pPrDefault></w:docDefaults>${styles.map(([id,name,size,color,bold])=>`<w:style w:type="paragraph" w:styleId="${id}"${id==='Normal'?' w:default="1"':''}><w:name w:val="${name}"/>${id!=='Normal'?'<w:basedOn w:val="Normal"/>':''}<w:pPr>${id.startsWith('Heading')?'<w:keepNext/>':''}<w:spacing w:before="${id.startsWith('Heading')?160:0}" w:after="100"/></w:pPr><w:rPr><w:sz w:val="${size}"/><w:color w:val="${color}"/>${bold?'<w:b/>':''}</w:rPr></w:style>`).join('')}</w:styles>`);
    zip.file('word/settings.xml',declaration+'<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:updateFields w:val="true"/></w:settings>');
    zip.file('word/footer1.xml',declaration+'<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:fldSimple w:instr="PAGE"><w:r><w:t>1</w:t></w:r></w:fldSimple><w:r><w:t> / </w:t></w:r><w:fldSimple w:instr="NUMPAGES"><w:r><w:t>1</w:t></w:r></w:fldSimple></w:p></w:ftr>');
    zip.file('word/_rels/document.xml.rels',declaration+`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relations.map(([id,type,target])=>`<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${target}"/>`).join('')}</Relationships>`);
    zip.file('_rels/.rels',declaration+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>');
    zip.file('docProps/core.xml',declaration+`<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${xml(model.title)}</dc:title><dc:creator>CAP Follow Up</dc:creator></cp:coreProperties>`);
    zip.file('[Content_Types].xml',declaration+'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>');
    return zip.generateAsync({type:'uint8array',compression:'DEFLATE'});
  }
  window.NativeDocxWriter={create};
})();
