(function(){
  'use strict';
  const AREA_ORDER=['LEG','ORG','PEL','OPS','AIR','AIG','ANS','AGA','SSP'];
  const areaRank=a=>AREA_ORDER.includes(a)?AREA_ORDER.indexOf(a):99;
  const TEXT={none:'Yok',planned:'Hazırlanıyor',submitted:"ICAO’ya iletildi",under_review:'ICAO değerlendirmesinde',accepted:'Kabul edildi',rejected:'Kabul edilmedi',withdrawn:'Geri çekildi'};
  const str=v=>String(v??'').replace(/\r\n?/g,'\n').trim();
  const esc=v=>str(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  const pct=v=>{if(v==null||str(v)==='')return null;const n=typeof v==='number'?v:Number(str(v).replace(/[%\s]/g,'').replace(',','.'));return Number.isFinite(n)&&n>=0&&n<=100?n:null;};
  const fmt=v=>v==null?'—':Number(v).toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2})+'%';
  const result=v=>({satisfactory:'Satisfactory',not_satisfactory:'Not Satisfactory',no_change:'No Change',pending:'Değerlendirmede'})[str(v)]||str(v)||'—';
  const objection=r=>str(r['İtiraz / Yorum Durumu'])&&!['none','Yok'].includes(str(r['İtiraz / Yorum Durumu']))||!!str(r['İtiraz / Yorum Tarihi'])||!!str(r['İtiraz / Yorum Notu']);
  function state(r){
    if(r.effectiveStatus==='S')return'closed';if(r.effectiveStatus==='NA')return'na';if(r.effectiveStatus==='NS')return'open';
    if(r.hasExplicitResult)return'open';
    return /^(CAP Kapatıldı \/ Validated|validated)$/i.test(str(r['ICAO / ICVM Sonucu']))?'closed':'open';
  }
  function eiChart(rows,opts={}){
    const data=(rows||[]).map(r=>({area:str(r.area||r.Alan),before:pct(r.baselinePct??r['Mevcut Resmî EI']),after:pct(r.newPct??r['Taslak/Çalışma EI'])})).filter(r=>r.area);
    if(!data.length)return'';
    const W=opts.width||760,H=opts.height||300,left=48,right=16,top=76,bottom=56,plotW=W-left-right,plotH=H-top-bottom;
    const group=plotW/data.length,gap=Math.min(10,group*.12),bar=Math.min(30,(group-gap*2)/2),baseY=H-bottom;
    let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#fff"/>`;
    svg+=`<g data-region="legend"><rect x="${left}" y="15" width="12" height="12" rx="2" fill="#5b9bd5"/><text x="${left+20}" y="25" font-family="Arial" font-size="11" fill="#334155">Önceki aşama EI</text><rect x="${left+215}" y="15" width="12" height="12" rx="2" fill="#2f5597"/><text x="${left+235}" y="25" font-family="Arial" font-size="11" fill="#334155">Ziyaret sonrası EI</text></g>`;
    for(let n=0;n<=100;n+=20){const y=baseY-n*plotH/100;svg+=`<line x1="${left}" y1="${y}" x2="${W-right}" y2="${y}" stroke="#dbe3ef"/><text x="${left-8}" y="${y+4}" text-anchor="end" font-family="Arial" font-size="10" fill="#475569">${n}%</text>`;}
    data.forEach((r,i)=>{
      const center=left+(i+.5)*group,y1=r.before==null?baseY:baseY-r.before*plotH/100,y2=r.after==null?baseY:baseY-r.after*plotH/100;
      const ys=[y1-7,y2-7];if(r.before!=null&&r.after!=null&&Math.abs(ys[0]-ys[1])<17)ys[1]-=18;
      [r.before,r.after].forEach((v,j)=>{const x=center+(j?gap/2:-gap/2-bar),h=v==null?0:v*plotH/100;
        if(v!=null)svg+=`<rect x="${x.toFixed(2)}" y="${(baseY-h).toFixed(2)}" width="${bar.toFixed(2)}" height="${h.toFixed(2)}" rx="2" fill="${j?'#2f5597':'#5b9bd5'}"/>`;
        svg+=`<text data-role="value" x="${(x+bar/2).toFixed(2)}" y="${Math.max(42,ys[j]).toFixed(2)}" text-anchor="middle" font-family="Arial" font-size="9.5" font-weight="bold" fill="#334155">${esc(fmt(v))}</text>`;
      });
      svg+=`<text x="${center}" y="${baseY+21}" text-anchor="middle" font-family="Arial" font-size="11" font-weight="bold" fill="#334155">${esc(r.area)}</text>`;
      if(r.before!=null&&r.after!=null){const d=Math.round((r.after-r.before)*100)/100;svg+=`<text x="${center}" y="${baseY+39}" text-anchor="middle" font-family="Arial" font-size="10" fill="${d>0?'#166534':'#475569'}">${d>0?'+':''}${(d||0).toFixed(2).replace('.',',')} puan</text>`;}
    });
    return svg+'</svg>';
  }
  function build(input={}){
    const rows=[...new Map((input.rows||[]).map(r=>[str(r.Alan)+'|'+str(r.PQ),{...r}])).values()].sort((a,b)=>areaRank(str(a.Alan))-areaRank(str(b.Alan))||str(a.Alan).localeCompare(str(b.Alan),'tr')||str(a.PQ).localeCompare(str(b.PQ),'tr',{numeric:true}));
    const summary={total:rows.length,closed:0,open:0,na:0,objections:0},areas=new Map();
    for(const r of rows){const key=str(r.Alan)||'DİĞER';if(!areas.has(key))areas.set(key,{area:key,total:0,closed:0,open:0,na:0,objections:0,pqs:[]});
      const area=areas.get(key),status=state(r);summary[status]++;area[status]++;area.total++;
      if(objection(r)){summary.objections++;area.objections++;area.pqs.push(str(r.PQ));}
    }
    const order=['LEG','ORG','PEL','OPS','AIR','AIG','ANS','AGA','SSP'];
    const areaRows=[...areas.values()].sort((a,b)=>(order.indexOf(a.area)<0?99:order.indexOf(a.area))-(order.indexOf(b.area)<0?99:order.indexOf(b.area)));
    const kpis=[{label:'Toplam PQ',value:summary.total,fill:'#f1f5f9'},{label:'Kapalı PQ',value:summary.closed,fill:'#dcfce7'},{label:'Açık PQ',value:summary.open,fill:'#fee2e2'},{label:'İtirazlı PQ',value:summary.objections,fill:'#ede9fe'}];
    if(summary.na)kpis.push({label:'N/A PQ',value:summary.na,fill:'#e2e8f0'});
    const blocks=[{kind:'heading',text:'Durum dağılımı'},{kind:'kpis',cards:kpis},
      {kind:'heading',text:'Denetim alanlarına göre PQ ve itiraz sayıları'},
      {kind:'table',key:'areas',headers:['Alan','Toplam PQ','Kapalı','Açık','İtirazlı PQ','İtiraz edilen PQ’lar'],weights:[.65,.9,.85,.85,1,3.75],rows:[...areaRows.map(a=>[a.area,a.total,a.closed,a.open,a.objections,a.pqs.join(', ')||'—']),['Toplam',summary.total,summary.closed,summary.open,summary.objections,'']]}];
    if(summary.na){const table=blocks.find(b=>b.key==='areas');table.headers.splice(4,0,'N/A');table.weights.splice(4,0,.7);table.rows.forEach((r,i)=>r.splice(4,0,i<areaRows.length?areaRows[i].na:summary.na));}
    const eiRows=input.eiRows||[];
    if(eiRows.length){blocks.push({kind:'heading',text:'Ziyaret EI etki özeti',pageBreak:true},{kind:'table',key:'ei',headers:['Alan','Uygulanabilir PQ','Önceki S','S değişimi','Önceki EI','Ziyaret sonrası EI','Değişim'],weights:[.75,1,1,1,1.1,1.2,1.15],rows:eiRows.map(r=>[r.Alan,r['Uygulanabilir PQ']??'—',r['Mevcut Resmî SAT']??'—',r['Taslak/Çalışma Satisfactory PQ']??'—',r['Mevcut Resmî EI']??'—',r['Taslak/Çalışma EI']??'—',r['Değişim']??'—'])});
      if(eiRows.length>6)blocks.push({kind:'heading',text:'EI karşılaştırması',pageBreak:true});
      const height=eiRows.length>6?340:300;blocks.push({kind:'chart',svg:eiChart(eiRows,{width:760,height}),width:760,height,title:'Önceki aşama ve ziyaret sonrası EI'});
    }
    blocks.push({kind:'heading',text:'Kapsamdaki PQ durumları',pageBreak:true},{kind:'table',key:'pqs',headers:['PQ','Alan','CE','Doğrulama türü','PQ sonucu','İtiraz'],weights:[.8,.6,.7,1.4,2.2,1.4],rows:rows.map(r=>[r.PQ,r.Alan,r.CE||'—',r['Doğrulama Türü']||'—',r['ICAO Nihai PQ Sonucu']?result(r['ICAO Nihai PQ Sonucu']):r['ICAO Taslak PQ Sonucu']?result(r['ICAO Taslak PQ Sonucu']):r['ICAO / ICVM Sonucu']||'—',objection(r)?TEXT[str(r['İtiraz / Yorum Durumu'])]||'İtiraz / yorum':'—'])});
    const objections=rows.filter(objection);
    if(objections.length){blocks.push({kind:'heading',text:`İtiraz edilen PQ’lar (${objections.length})`,pageBreak:true});
      objections.forEach(r=>{
        blocks.push({kind:'heading',level:3,text:`PQ ${r.PQ} — ${r.Alan}`});
        blocks.push({kind:'table',key:'objectionMeta',headers:[],weights:[1,1.2,1,1],rows:[[`Taslak sonuç: ${result(r['ICAO Taslak PQ Sonucu'])}`,`İtiraz durumu: ${TEXT[str(r['İtiraz / Yorum Durumu'])]||str(r['İtiraz / Yorum Durumu'])||'—'}`,`İtiraz tarihi: ${str(r['İtiraz / Yorum Tarihi'])||'—'}`,`Nihai sonuç: ${result(r['ICAO Nihai PQ Sonucu'])}`]]});
        blocks.push({kind:'paragraph',text:str(r['İtiraz / Yorum Notu'])||'—',role:'objectionNote',pq:str(r.PQ)});
      });
    }
    if(input.mode==='screen'&&rows.length){blocks.push({kind:'heading',text:'PQ / CAP validasyon sonuçları',pageBreak:true});
      rows.forEach(r=>{blocks.push({kind:'heading',level:3,text:`PQ ${r.PQ} — ${r.Alan}`});
        const fields=[['PQ Question (ENG)','PQ Sorusu (ENG)'],['PQ Sorusu (TR)','PQ Sorusu (TR)'],['Finding (ENG)','Bulgu (ENG)'],['Bulgu (TR)','Bulgu (TR)'],['Kanıt','ICAO’ya Sunulan Kanıt / Uygulama Kanıtı'],['ICAO görüşü','ICAO Görüşü / Ziyaret Notu'],['Ek kanıt talebi','Ek Kanıt / Açıklama Talebi'],['İç not','İç Not'],['CAP adımları','CAP Step’leri (Bilgi Amaçlı)']];
        for(const [label,key] of fields)if(str(r[key])){blocks.push({kind:'heading',level:4,text:label});blocks.push({kind:'paragraph',text:str(r[key])});}
      });
    }
    return{title:input.mode==='screen'?'ICAO Resmî Ziyareti / ICVM':'ICAO Resmî Ziyareti / ICVM — Detaylı Rapor',subtitle:input.subtitle||str(input.visit?.visitName),mode:input.mode||'detailed',summary,areas:areaRows,rows,objections,blocks};
  }
  const tableLayout={hLineWidth:(i,node)=>(i===0||i===node.table.body.length)?0.7:0.35,vLineWidth:()=>0,hLineColor:()=> '#cbd5e1',paddingLeft:()=>7,paddingRight:()=>7,paddingTop:()=>6,paddingBottom:()=>6};
  function pdfDefinition(model){
    const content=[{text:model.title,style:'title'},{text:model.subtitle,style:'subtitle'}];
    for(const b of model.blocks){
      if(b.kind==='heading')content.push({text:b.text,style:b.level===3?'objectionHeading':b.level===4?'fieldHeading':'section',pageBreak:b.pageBreak?'before':undefined,headlineLevel:b.level===3?2:1});
      else if(b.kind==='kpis')content.push({table:{widths:b.cards.map(()=>'*'),body:[b.cards.map(c=>({text:[{text:c.label+'\n',fontSize:11},{text:String(c.value),fontSize:18,bold:true}],fillColor:c.fill,alignment:'center',margin:[0,5,0,5]}))]},layout:'noBorders',margin:[0,0,0,14]});
      else if(b.kind==='table'){
        const total=b.weights.reduce((n,x)=>n+x,0),width=781.89-b.weights.length*14;
        const rows=b.rows.map((r,i)=>r.map((c,j)=>({text:String(c??'—'),alignment:j>0&&b.key==='areas'&&j<b.weights.length-1?'center':b.key==='ei'?'center':'left',fillColor:i%2?'#f8fafc':undefined})));
        if(b.headers.length)rows.unshift(b.headers.map(t=>({text:t,bold:true,fillColor:'#e2e8f0'})));
        content.push({table:{headerRows:b.headers.length?1:0,dontBreakRows:false,widths:b.weights.map(w=>width*w/total),body:rows},fontSize:11,layout:tableLayout,margin:[0,0,0,12]});
      }else if(b.kind==='chart')content.push({svg:b.svg,width:b.width,margin:[0,10,0,8]});
      else if(b.kind==='paragraph')for(const p of b.text.split(/\n\s*\n/))content.push({text:p,fontSize:11,lineHeight:1.16,margin:[0,2,0,9]});
    }
    return{pageSize:'A4',pageOrientation:'landscape',pageMargins:[30,28,30,30],defaultStyle:{font:'Roboto',fontSize:11},content,
      footer:(page,total)=>({text:page+' / '+total,alignment:'right',fontSize:8,color:'#64748b',margin:[0,5,30,0]}),
      styles:{title:{fontSize:17,bold:true,color:'#1d4ed8',margin:[0,0,0,5]},subtitle:{fontSize:10,color:'#475569',margin:[0,0,0,12]},section:{fontSize:13,bold:true,color:'#0f172a',margin:[0,6,0,9]},objectionHeading:{fontSize:12,bold:true,color:'#1e3a8a',margin:[0,12,0,6]},fieldHeading:{fontSize:11,bold:true,margin:[0,4,0,3]}},
      pageBreakBefore:(node,following)=>!!node.headlineLevel&&(following||[]).length===0};
  }
  async function downloadWord(model,fileName){const data=await window.NativeDocxWriter.create(model);const url=URL.createObjectURL(new Blob([data],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}));const a=document.createElement('a');a.href=url;a.download=fileName;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  window.IcaoVisitReport={build,eiChart,pdfDefinition,downloadWord,resultLabel:result};
})();
