
(function(){
    const AREAS=['LEG','ORG','PEL','OPS','AIR','AIG','ANS','AGA'];
    let officialEiRef=null,officialEiCallback=null;
    window.icaoOfficialEiRecords=window.icaoOfficialEiRecords||{};
    window.icaoOfficialEiManagementLoaded=window.icaoOfficialEiManagementLoaded===true;
    const OFFICIAL_EI_CHART_PREFS_KEY='icao_official_ei_chart_preferences_v3';
    let officialEiChartSelectedIds=[];
    let officialEiChartReferenceId='';
    const OFFICIAL_EI_TREND_PREFS_KEY='icao_official_ei_trend_preferences_v1';
    let officialEiTrendMetric='Overall';
    let officialEiTrendIncludePassive=false;
    try{
        const trendSaved=JSON.parse(localStorage.getItem(OFFICIAL_EI_TREND_PREFS_KEY)||'{}');
        if(['Overall',...AREAS].includes(trendSaved.metric))officialEiTrendMetric=trendSaved.metric;
        officialEiTrendIncludePassive=trendSaved.includePassive===true;
    }catch(e){officialEiTrendMetric='Overall';officialEiTrendIncludePassive=false;}
    try{
        const saved=JSON.parse(localStorage.getItem(OFFICIAL_EI_CHART_PREFS_KEY)||'{}');
        if(Array.isArray(saved.selectedIds))officialEiChartSelectedIds=saved.selectedIds.map(String);
        if(saved.referenceId)officialEiChartReferenceId=String(saved.referenceId);
    }catch(e){officialEiChartSelectedIds=[];officialEiChartReferenceId='';}


    function actor(){const u=firebase.auth().currentUser;return u?{uid:u.uid||'',email:u.email||'',displayName:u.displayName||u.email||'Yetkili kullanıcı'}:{uid:'',email:'',displayName:'Oturum yok'};}
    function clean(value){if(value===undefined)return undefined;if(value===null)return null;if(typeof value==='number'&&!Number.isFinite(value))return null;if(Array.isArray(value))return value.map(clean).filter(v=>v!==undefined);if(value&&typeof value==='object'){const out={};Object.entries(value).forEach(([k,v])=>{const c=clean(v);if(c!==undefined)out[k]=c;});return out;}return value;}
    function num(v){if(v===null||v===undefined||v==='')return null;const n=Number(String(v).replace(',','.'));return Number.isFinite(n)?Math.round(n*100)/100:null;}
    function fmt(v){const n=Number(v);return Number.isFinite(n)?n.toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2})+'%':'-';}
    function fmtDate(v){if(!v)return'-';const d=new Date(String(v).length===10?v+'T00:00:00':v);return isNaN(d)?String(v):d.toLocaleDateString('tr-TR',{day:'2-digit',month:'long',year:'numeric'});}
    function activeRecords(){return Object.entries(window.icaoOfficialEiRecords||{}).map(([id,r])=>({id,...(r||{})})).filter(r=>!r.isDeleted&&r.active!==false).sort((a,b)=>String(a.assessmentDate||'').localeCompare(String(b.assessmentDate||''))||String(a.createdAt||'').localeCompare(String(b.createdAt||'')));}
    function allRecords(){return Object.entries(window.icaoOfficialEiRecords||{}).map(([id,r])=>({id,...(r||{})})).filter(r=>!r.isDeleted).sort((a,b)=>String(b.assessmentDate||'').localeCompare(String(a.assessmentDate||''))||String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));}
    function chartLabel(r){const date=r.assessmentDate?new Date(r.assessmentDate+'T00:00:00'):null;const dateLabel=date&&!isNaN(date)?date.toLocaleDateString('tr-TR',{month:'short',year:'numeric'}):'';return [r.name||r.type||'ICAO',dateLabel].filter(Boolean).join(' — ');}

    function saveChartPreferences(){
        try{localStorage.setItem(OFFICIAL_EI_CHART_PREFS_KEY,JSON.stringify({selectedIds:officialEiChartSelectedIds,referenceId:officialEiChartReferenceId}));}catch(e){}
    }
    function defaultChartSelection(records){
        if(records.length<=4)return records.map(r=>r.id);
        return [records[0].id,...records.slice(-3).map(r=>r.id)].filter((id,index,arr)=>arr.indexOf(id)===index);
    }
    function normalizeChartSelection(){
        const records=activeRecords(),validIds=new Set(records.map(r=>r.id));
        officialEiChartSelectedIds=officialEiChartSelectedIds.filter(id=>validIds.has(id));
        if(!officialEiChartSelectedIds.length&&records.length)officialEiChartSelectedIds=defaultChartSelection(records);
        if(officialEiChartSelectedIds.length>4)officialEiChartSelectedIds=officialEiChartSelectedIds.slice(0,4);
        officialEiChartSelectedIds.sort((a,b)=>records.findIndex(r=>r.id===a)-records.findIndex(r=>r.id===b));
        if(!officialEiChartReferenceId||!officialEiChartSelectedIds.includes(officialEiChartReferenceId))officialEiChartReferenceId=officialEiChartSelectedIds[0]||'';
        saveChartPreferences();
        return records;
    }
    function selectedChartRecords(){
        const records=normalizeChartSelection();
        return records.filter(r=>officialEiChartSelectedIds.includes(r.id));
    }
    function triggerChartRefresh(){
        renderIcaoOfficialPeriodControls();
        if(typeof renderIcaoOfficialChart==='function')renderIcaoOfficialChart();
    }
    window.toggleIcaoOfficialChartPeriod=function(id,checked){
        id=String(id||'');
        if(!id)return;
        if(checked){
            if(!officialEiChartSelectedIds.includes(id)&&officialEiChartSelectedIds.length>=4){
                alert('Karşılaştırma grafiğinde aynı anda en fazla 4 dönem gösterilebilir. Tüm geçmiş dönemler daha sonra trend grafiğinde birlikte gösterilecektir.');
                renderIcaoOfficialPeriodControls();
                return;
            }
            if(!officialEiChartSelectedIds.includes(id))officialEiChartSelectedIds.push(id);
        }else{
            if(officialEiChartSelectedIds.length<=1){
                alert('Grafikte en az bir dönem seçili kalmalıdır.');
                renderIcaoOfficialPeriodControls();
                return;
            }
            officialEiChartSelectedIds=officialEiChartSelectedIds.filter(x=>x!==id);
        }
        normalizeChartSelection();
        triggerChartRefresh();
    };
    window.changeIcaoOfficialReferencePeriod=function(id){
        if(id&&officialEiChartSelectedIds.includes(String(id)))officialEiChartReferenceId=String(id);
        normalizeChartSelection();
        triggerChartRefresh();
    };
    window.selectIcaoOfficialPeriodPreset=function(mode){
        const records=activeRecords();
        if(!records.length)return;
        if(mode==='latestTwo')officialEiChartSelectedIds=records.slice(-2).map(r=>r.id);
        else if(mode==='firstLast')officialEiChartSelectedIds=records.length===1?[records[0].id]:[records[0].id,records[records.length-1].id];
        else officialEiChartSelectedIds=defaultChartSelection(records);
        officialEiChartReferenceId=officialEiChartSelectedIds[0]||'';
        normalizeChartSelection();
        triggerChartRefresh();
    };
    window.renderIcaoOfficialPeriodControls=function(){
        const records=normalizeChartSelection();
        const selector=document.getElementById('icaoOfficialPeriodSelector');
        const referenceSelect=document.getElementById('icaoOfficialReferenceSelect');
        if(selector){
            if(!records.length)selector.innerHTML='<span>Aktif resmî EI dönemi bulunmuyor.</span>';
            else selector.innerHTML=records.map(r=>{
                const checked=officialEiChartSelectedIds.includes(r.id);
                return `<label style="display:inline-flex;align-items:center;gap:6px;padding:7px 9px;border:1px solid ${checked?'var(--primary)':'var(--border)'};border-radius:8px;background:${checked?'rgba(37,99,235,0.08)':'var(--card)'};cursor:pointer;font-size:11px;font-weight:${checked?'700':'500'};"><input type="checkbox" ${checked?'checked':''} onchange="toggleIcaoOfficialChartPeriod('${String(r.id).replace(/'/g,"\\'")}',this.checked)"> ${escapeHtml(chartLabel(r))}</label>`;
            }).join('');
        }
        if(referenceSelect){
            const selected=records.filter(r=>officialEiChartSelectedIds.includes(r.id));
            referenceSelect.innerHTML=selected.length?selected.map(r=>`<option value="${escapeHtml(r.id)}" ${r.id===officialEiChartReferenceId?'selected':''}>${escapeHtml(chartLabel(r))}</option>`).join(''):'<option value="">Dönem seçiniz</option>';
            referenceSelect.disabled=selected.length<1;
        }
    };

    window.getManagedIcaoOfficialEiChartConfig=function(){
        const records=selectedChartRecords();
        if(!records.length)return null;
        const normalizedRecords=records.map(r=>({id:r.id,label:chartLabel(r),name:r.name||r.type||'ICAO',assessmentDate:r.assessmentDate||'',overallEI:num(r.overallEI),areas:r.areas||{}}));
        return {
            records:normalizedRecords,
            referenceId:officialEiChartReferenceId||normalizedRecords[0].id,
            selectedIds:normalizedRecords.map(r=>r.id),
            areas:[
                {area:'Overall',values:Object.fromEntries(normalizedRecords.map(r=>[r.id,num(r.overallEI)]))},
                ...AREAS.map(area=>({area,values:Object.fromEntries(normalizedRecords.map(r=>[r.id,num((r.areas||{})[area])]))}))
            ]
        };
    };


    function saveTrendPreferences(){
        try{localStorage.setItem(OFFICIAL_EI_TREND_PREFS_KEY,JSON.stringify({metric:officialEiTrendMetric,includePassive:officialEiTrendIncludePassive}));}catch(e){}
    }
    function trendRecords(){
        const source=officialEiTrendIncludePassive?allRecords():activeRecords();
        return [...source].sort((a,b)=>String(a.assessmentDate||'').localeCompare(String(b.assessmentDate||''))||String(a.createdAt||'').localeCompare(String(b.createdAt||'')));
    }
    function trendValue(record,metric){
        return metric==='Overall'?num(record.overallEI):num((record.areas||{})[metric]);
    }
    function trendMetricLabel(metric){return metric==='Overall'?'Overall EI':metric+' EI';}
    function trendDateLabel(record){
        if(!record.assessmentDate)return record.name||record.type||'Tarihsiz dönem';
        const d=new Date(record.assessmentDate+'T00:00:00');
        const dateLabel=isNaN(d)?record.assessmentDate:d.toLocaleDateString('tr-TR',{month:'short',year:'numeric'});
        return [record.name||record.type||'ICAO',dateLabel].filter(Boolean).join(' — ');
    }
    function trendDelta(value){
        if(value===null||value===undefined||!Number.isFinite(Number(value)))return '-';
        const n=Math.round(Number(value)*100)/100;
        return (n>0?'+':'')+n.toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2})+' puan';
    }
    function renderIcaoOfficialTrend(){
        const metricSelect=document.getElementById('icaoOfficialTrendMetric');
        const passiveCheck=document.getElementById('icaoOfficialTrendIncludePassive');
        if(metricSelect)metricSelect.value=officialEiTrendMetric;
        if(passiveCheck)passiveCheck.checked=officialEiTrendIncludePassive;
        const empty=document.getElementById('icaoOfficialTrendEmptyState');
        const wrap=document.getElementById('icaoOfficialTrendCanvasWrap');
        const kpis=document.getElementById('icaoOfficialTrendKpis');
        const table=document.getElementById('icaoOfficialTrendTable');
        const canvas=document.getElementById('icaoOfficialTrendCanvas');
        if(!canvas)return;
        const records=trendRecords();
        const points=records.map(r=>({record:r,value:trendValue(r,officialEiTrendMetric)})).filter(x=>x.value!==null);
        if(points.length<1){
            if(charts.icaoOfficialTrend){charts.icaoOfficialTrend.destroy();charts.icaoOfficialTrend=null;}
            if(wrap)wrap.style.display='none';
            if(empty){empty.style.display='flex';empty.innerHTML=`<div><b>${escapeHtml(trendMetricLabel(officialEiTrendMetric))} için kullanılabilir resmî değerlendirme bulunmuyor.</b><br><span style="font-size:12px;">Veri Yönetimi bölümünden ilgili dönem değerlerini kaydet.</span></div>`;}
            if(kpis)kpis.innerHTML='';if(table)table.innerHTML='';
            return;
        }
        if(empty)empty.style.display='none';if(wrap)wrap.style.display='block';
        const first=points[0],latest=points[points.length-1];
        const net=Math.round((latest.value-first.value)*100)/100;
        let best=null,worst=null;
        points.forEach((p,index)=>{if(index===0)return;const d=Math.round((p.value-points[index-1].value)*100)/100;if(best===null||d>best.delta)best={delta:d,point:p};if(worst===null||d<worst.delta)worst={delta:d,point:p};});
        const card=(label,value,sub,color='var(--text)')=>`<div style="border:1px solid var(--border);border-radius:10px;padding:12px 14px;background:var(--card);"><div style="font-size:10px;color:var(--muted);font-weight:800;text-transform:uppercase;">${escapeHtml(label)}</div><div style="font-size:23px;font-weight:800;color:${color};margin-top:4px;">${escapeHtml(value)}</div><div style="font-size:10px;color:var(--muted);margin-top:5px;">${escapeHtml(sub||'')}</div></div>`;
        if(kpis)kpis.innerHTML=[
            card('İlk dönem',fmt(first.value),trendDateLabel(first.record)),
            card('Son dönem',fmt(latest.value),trendDateLabel(latest.record)),
            card('Net değişim',trendDelta(net),`${points.length} değerlendirme`,net>0?'var(--ok)':net<0?'var(--danger)':'var(--muted)'),
            card('En yüksek dönemsel artış',best?trendDelta(best.delta):'-',best?trendDateLabel(best.point.record):'Yeterli dönem yok',best&&best.delta>0?'var(--ok)':'var(--muted)')
        ].join('');
        const pointLabelPlugin={
            id:'icaoOfficialTrendPointLabels',
            afterDatasetsDraw(chart){
                if(points.length>12)return;
                const ctx=chart.ctx,meta=chart.getDatasetMeta(0);ctx.save();ctx.font='bold 10px Arial';ctx.fillStyle='#334155';ctx.textAlign='center';ctx.textBaseline='bottom';
                meta.data.forEach((element,index)=>{const v=points[index]&&points[index].value;if(v===null||v===undefined)return;const pos=element.tooltipPosition();ctx.fillText(v.toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2})+'%',pos.x,pos.y-8);});ctx.restore();
            }
        };
        if(charts.icaoOfficialTrend)charts.icaoOfficialTrend.destroy();
        charts.icaoOfficialTrend=new Chart(canvas.getContext('2d'),{
            type:'line',plugins:[pointLabelPlugin],
            data:{labels:points.map(p=>trendDateLabel(p.record)),datasets:[{label:trendMetricLabel(officialEiTrendMetric),data:points.map(p=>p.value),borderColor:'#284b9b',backgroundColor:'rgba(40,75,155,0.12)',pointBackgroundColor:'#284b9b',pointBorderColor:'#ffffff',pointBorderWidth:2,pointRadius:5,pointHoverRadius:7,tension:0.25,fill:true,spanGaps:false}]},
            options:{responsive:true,maintainAspectRatio:false,layout:{padding:{top:30,right:12,left:4}},plugins:{legend:{display:false},tooltip:{callbacks:{title:(items)=>items.length?points[items[0].dataIndex].record.name||items[0].label:'',label:(ctx)=>`${trendMetricLabel(officialEiTrendMetric)}: %${Number(ctx.raw).toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2})}`,afterLabel:(ctx)=>{if(ctx.dataIndex===0)return 'İlk kayıt';const d=Math.round((points[ctx.dataIndex].value-points[ctx.dataIndex-1].value)*100)/100;return 'Önceki döneme göre: '+trendDelta(d);}}}},scales:{x:{grid:{display:false},ticks:{maxRotation:35,minRotation:0,autoSkip:points.length>10,maxTicksLimit:12,color:'#475569'}},y:{min:0,max:100,ticks:{callback:v=>v+'%',color:'#475569'},title:{display:true,text:trendMetricLabel(officialEiTrendMetric)+' (%)',color:'#334155'},grid:{color:'rgba(148,163,184,0.25)'}}}}
        });
        if(table){
            const rows=points.map((p,index)=>{const previous=index?points[index-1].value:null;const delta=previous===null?null:Math.round((p.value-previous)*100)/100;const color=delta===null||delta===0?'var(--muted)':delta>0?'var(--ok)':'var(--danger)';return `<tr><td><b>${escapeHtml(p.record.name||p.record.type||'ICAO değerlendirmesi')}</b></td><td>${escapeHtml(fmtDate(p.record.assessmentDate))}</td><td style="text-align:center;font-weight:800;">${escapeHtml(fmt(p.value))}</td><td style="text-align:center;color:${color};font-weight:800;">${delta===null?'—':escapeHtml(trendDelta(delta))}</td><td>${p.record.active!==false?'<span class="icao-ei-badge active">Aktif</span>':'<span class="icao-ei-badge passive">Pasif</span>'}</td></tr>`;}).join('');
            table.innerHTML=`<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:8px;"><h4 style="margin:0;color:var(--text);">${escapeHtml(trendMetricLabel(officialEiTrendMetric))} Tarihçesi</h4><span style="font-size:11px;color:var(--muted);">${points.length} resmî değerlendirme</span></div><div style="border:1px solid var(--border);border-radius:9px;overflow:hidden;"><table style="width:100%;border-collapse:collapse;font-size:12px;"><thead><tr><th style="text-align:left;">Değerlendirme</th><th>Tarih</th><th>${escapeHtml(trendMetricLabel(officialEiTrendMetric))}</th><th>Önceki Döneme Göre</th><th>Durum</th></tr></thead><tbody>${rows}</tbody></table></div>`;
        }
    }
    window.changeIcaoOfficialTrendMetric=function(metric){if(['Overall',...AREAS].includes(metric))officialEiTrendMetric=metric;saveTrendPreferences();renderIcaoOfficialTrend();};
    window.changeIcaoOfficialTrendIncludePassive=function(checked){officialEiTrendIncludePassive=checked===true;saveTrendPreferences();renderIcaoOfficialTrend();};
    window.renderIcaoOfficialTrend=renderIcaoOfficialTrend;

    function updateStatus(){
        const records=allRecords(),active=activeRecords();
        const txt=document.getElementById('icaoOfficialEiStatusTxt');
        if(txt)txt.innerHTML=records.length?`<b>${records.length}</b> değerlendirme kaydı, <b>${active.length}</b> aktif dönem. Dashboard karşılaştırma grafiğinde kullanıcı tarafından seçilen en fazla dört aktif dönem gösterilir.`:'Henüz Firebase üzerinde resmî EI kaydı bulunmuyor. Dashboard veri girişi bekliyor.';
        const sum=document.getElementById('icaoOfficialEiListSummary');if(sum){
            const chronological=[...records].sort((a,b)=>String(a.assessmentDate||'').localeCompare(String(b.assessmentDate||'')));
            const first=chronological[0],last=chronological[chronological.length-1];
            const delta=first&&last&&num(first.overallEI)!==null&&num(last.overallEI)!==null?Math.round((num(last.overallEI)-num(first.overallEI))*100)/100:null;
            const deltaText=delta===null?'':` | Overall değişim: ${delta>0?'+':''}${delta.toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2})} puan`;
            sum.textContent=`${records.length} kayıt | ${active.length} aktif${deltaText}`;
        }
    }
    function renderList(){
        updateStatus();
        const el=document.getElementById('icaoOfficialEiRecordList');if(!el)return;
        const records=allRecords(),selected=(document.getElementById('icaoEiRecordId')||{}).value||'';
        if(!records.length){el.innerHTML='<div class="icao-ei-empty">Henüz kayıt bulunmuyor.<br>Yeni kayıt oluşturabilir veya mevcut CMAA / Virtual OSVA verilerini Firebase\'e aktarabilirsin.</div>';return;}
        const chronological=[...records].sort((a,b)=>String(a.assessmentDate||'').localeCompare(String(b.assessmentDate||''))||String(a.createdAt||'').localeCompare(String(b.createdAt||'')));
        const changeById={};
        chronological.forEach((r,index)=>{
            const prev=index>0?chronological[index-1]:null;
            const current=num(r.overallEI),previous=prev?num(prev.overallEI):null;
            changeById[r.id]=(current!==null&&previous!==null)?Math.round((current-previous)*100)/100:null;
        });
        const changeHtml=(value)=>{
            if(value===null||value===undefined||!Number.isFinite(Number(value)))return '<span class="icao-ei-change neutral">—</span>';
            const n=Number(value),cls=n>0?'positive':n<0?'negative':'neutral',prefix=n>0?'+':'';
            return `<span class="icao-ei-change ${cls}">${prefix}${n.toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2})} puan</span>`;
        };
        el.innerHTML=`<div class="icao-ei-table-wrap"><table class="icao-ei-table"><thead><tr><th>Değerlendirme</th><th>Tür / Statü</th><th>Tarih</th><th>Kapsam</th><th>PQ Seti</th><th>Overall EI</th><th>Değişim</th><th>Durum</th><th>Kaynak</th></tr></thead><tbody>${records.map(r=>`<tr class="${r.active!==false?'active-record':'passive-record'} ${selected===r.id?'selected':''}" data-icao-ei-id="${escapeHtml(r.id)}"><td><b>${escapeHtml(r.name||'Adsız değerlendirme')}</b></td><td>${escapeHtml(r.type||'OTHER')}<br><span class="icao-ei-badge ${resultStatusClass(r.resultStatus)}">${escapeHtml(resultStatusLabel(r.resultStatus))}</span></td><td>${escapeHtml(fmtDate(r.assessmentDate))}</td><td>${escapeHtml(scopeLabel(r))}</td><td>${escapeHtml(pqSetLabel(r))}</td><td><span class="icao-ei-overall">${escapeHtml(fmt(r.overallEI))}</span>${r.overallSatisfactory!==undefined&&r.overallApplicable?`<br><small>${escapeHtml(String(r.overallSatisfactory))}/${escapeHtml(String(r.overallApplicable))}</small>`:''}</td><td>${changeHtml(changeById[r.id])}</td><td><span class="icao-ei-badge ${r.active!==false?'active':'passive'}">${r.active!==false?'Aktif':'Pasif'}</span></td><td class="icao-ei-source-cell">${escapeHtml(r.source||'Kaynak belirtilmedi')}</td></tr>`).join('')}</tbody></table></div>`;
        el.querySelectorAll('[data-icao-ei-id]').forEach(row=>row.addEventListener('click',()=>editIcaoOfficialEiRecord(row.dataset.icaoEiId)));
    }
    function setMessage(msg,type){const el=document.getElementById('icaoEiFormMessage');if(!el)return;el.textContent=msg||'';el.style.color=type==='error'?'var(--danger)':type==='success'?'var(--ok)':type==='warn'?'var(--warn)':'var(--muted)';}
    function formValue(id){return((document.getElementById(id)||{}).value||'').trim();}
    function setValue(id,v){const el=document.getElementById(id);if(el)el.value=v===null||v===undefined?'':v;}
    function intOrNull(v){if(v===null||v===undefined||String(v).trim()==='')return null;const n=Number(v);return Number.isFinite(n)&&n>=0?Math.round(n):null;}
    function readScopeAreas(){return AREAS.filter(a=>{const el=document.querySelector(`.icao-ei-scope-area[value="${a}"]`);return !!(el&&el.checked);});}
    function writeScopeAreas(list){const set=new Set((Array.isArray(list)?list:[]).map(x=>String(x||'').toUpperCase()));AREAS.forEach(a=>{const el=document.querySelector(`.icao-ei-scope-area[value="${a}"]`);if(el)el.checked=set.has(a);});}
    window.setIcaoEiScopeAreas=function(mode){writeScopeAreas(mode==='all'?AREAS:[]);};
    function resultStatusLabel(value){return value==='draft'?'Taslak':value==='provisional'?'Geçici':'Resmî';}
    function resultStatusClass(value){return value==='draft'?'draft':value==='provisional'?'provisional':'official';}
    function scopeLabel(r){const list=Array.isArray(r.scopeAreas)?r.scopeAreas:[];if(!list.length)return 'Belirtilmedi';if(list.length===AREAS.length)return 'Tüm alanlar';return list.join(', ');}
    function pqSetLabel(r){return [r.pqVersion||'',r.pqRevision||''].filter(Boolean).join(' / ')||'-';}

    window.startIcaoOfficialEiListener=function(){
        stopIcaoOfficialEiListener();
        window.icaoOfficialEiManagementLoaded=false;
        if(!firebase.auth().currentUser)return;
        if(typeof renderIcaoOfficialChart==='function')renderIcaoOfficialChart();
        officialEiRef=db.ref('icao_official_ei');
        officialEiCallback=snap=>{
            window.icaoOfficialEiRecords=snap.val()||{};
            window.icaoOfficialEiManagementLoaded=true;
            renderList();
            renderIcaoOfficialPeriodControls();
            if(typeof renderIcaoOfficialChart==='function')renderIcaoOfficialChart();
            renderIcaoOfficialTrend();
            if(typeof window.syncAllOfficialEiRecordsToAssessmentModel==='function')window.syncAllOfficialEiRecordsToAssessmentModel({silent:true});
        };
        officialEiRef.on('value',officialEiCallback,err=>{
            window.icaoOfficialEiManagementLoaded=true;
            console.error('ICAO resmî EI verisi okunamadı',err);
            setMessage('Firebase verileri okunamadı: '+(err.message||err),'error');
            if(typeof renderIcaoOfficialChart==='function')renderIcaoOfficialChart();
            renderIcaoOfficialTrend();
        });
    };
    window.stopIcaoOfficialEiListener=function(){
        if(officialEiRef&&officialEiCallback)officialEiRef.off('value',officialEiCallback);
        officialEiRef=null;officialEiCallback=null;window.icaoOfficialEiRecords={};window.icaoOfficialEiManagementLoaded=false;updateStatus();renderIcaoOfficialPeriodControls();
        if(typeof renderIcaoOfficialChart==='function')renderIcaoOfficialChart();
        renderIcaoOfficialTrend();
    };
    window.openIcaoOfficialEiManager=function(){const m=document.getElementById('icaoOfficialEiModal');if(m)m.style.display='block';renderList();if(!(document.getElementById('icaoEiRecordId')||{}).value)resetIcaoOfficialEiForm();};
    window.closeIcaoOfficialEiManager=function(){const m=document.getElementById('icaoOfficialEiModal');if(m)m.style.display='none';};
    window.resetIcaoOfficialEiForm=function(){
        const form=document.getElementById('icaoOfficialEiForm');if(form)form.reset();
        setValue('icaoEiRecordId','');setValue('icaoEiType','CMAA');setValue('icaoEiResultStatus','official');setValue('icaoEiStartDate','');setValue('icaoEiEndDate','');setValue('icaoEiPqVersion','');setValue('icaoEiPqRevision','');setValue('icaoEiOverallSat','');setValue('icaoEiOverallApplicable','');writeScopeAreas(AREAS);const active=document.getElementById('icaoEiActive');if(active)active.checked=true;
        AREAS.forEach(a=>setValue('icaoEiArea'+a,''));const del=document.getElementById('icaoEiDeleteBtn');if(del)del.style.display='none';const audit=document.getElementById('icaoEiFormAudit');if(audit)audit.textContent='Yeni kayıt; resmî EI kaydı, Assessment Event ve EI Snapshot olarak birbirine bağlı biçimde Firebase’e yazılacaktır.';setMessage('',null);renderList();
    };
    window.editIcaoOfficialEiRecord=function(id){
        const r=(window.icaoOfficialEiRecords||{})[id];if(!r)return alert('Kayıt bulunamadı.');
        setValue('icaoEiRecordId',id);setValue('icaoEiName',r.name);setValue('icaoEiType',r.type||'OTHER');setValue('icaoEiResultStatus',r.resultStatus||'official');setValue('icaoEiStartDate',r.startDate||'');setValue('icaoEiEndDate',r.endDate||'');setValue('icaoEiAssessmentDate',r.assessmentDate);setValue('icaoEiReportDate',r.reportDate);setValue('icaoEiPqVersion',r.pqVersion||'');setValue('icaoEiPqRevision',r.pqRevision||'');setValue('icaoEiOverall',r.overallEI);setValue('icaoEiOverallSat',r.overallSatisfactory);setValue('icaoEiOverallApplicable',r.overallApplicable);setValue('icaoEiSource',r.source);setValue('icaoEiNotes',r.notes);writeScopeAreas(Array.isArray(r.scopeAreas)?r.scopeAreas:(r.type==='CMAA'?AREAS:[]));const active=document.getElementById('icaoEiActive');if(active)active.checked=r.active!==false;AREAS.forEach(a=>setValue('icaoEiArea'+a,(r.areas||{})[a]));const del=document.getElementById('icaoEiDeleteBtn');if(del)del.style.display='inline-flex';const audit=document.getElementById('icaoEiFormAudit');if(audit)audit.textContent=`Oluşturan: ${((r.createdBy||{}).displayName||(r.createdBy||{}).email||'-')} | Oluşturma: ${fmtDate(r.createdAt)} | Son güncelleme: ${fmtDate(r.updatedAt)} | Assessment Event: ${(r.assessmentEventId||'-')}`;setMessage('',null);renderList();
    };
    window.saveIcaoOfficialEiRecord=async function(event){
        if(event)event.preventDefault();
        if(!firebase.auth().currentUser)return setMessage('Kayıt için yetkili oturum gereklidir.','error');
        const name=formValue('icaoEiName'),assessmentDate=formValue('icaoEiAssessmentDate');if(!name||!assessmentDate)return setMessage('Değerlendirme adı ve tarihi zorunludur.','error');
        const areas={};let filled=0;for(const a of AREAS){const v=num(formValue('icaoEiArea'+a));if(v!==null&&(v<0||v>100))return setMessage(`${a} değeri 0–100 arasında olmalıdır.`,'error');areas[a]=v;if(v!==null)filled++;}if(!filled)return setMessage('En az bir alan EI değeri giriniz.','error');
        let overall=num(formValue('icaoEiOverall'));if(overall!==null&&(overall<0||overall>100))return setMessage('Overall EI değeri 0–100 arasında olmalıdır.','error');
        const overallSatisfactory=intOrNull(formValue('icaoEiOverallSat')),overallApplicable=intOrNull(formValue('icaoEiOverallApplicable'));
        if(overallApplicable!==null&&overallApplicable<=0)return setMessage('Overall uygulanabilir PQ sayısı 0’dan büyük olmalıdır.','error');
        if(overallSatisfactory!==null&&overallApplicable!==null){if(overallSatisfactory>overallApplicable)return setMessage('Satisfactory PQ sayısı uygulanabilir PQ sayısından büyük olamaz.','error');const calculated=Math.round((overallSatisfactory/overallApplicable)*10000)/100;if(overall===null){overall=calculated;setValue('icaoEiOverall',overall);}else if(Math.abs(overall-calculated)>0.03&&!confirm(`Girilen Overall EI (%${overall.toFixed(2)}) ile ${overallSatisfactory}/${overallApplicable} hesabı (%${calculated.toFixed(2)}) uyuşmuyor. Girilen EI değeri korunarak devam edilsin mi?`))return;}
        const id=formValue('icaoEiRecordId')||db.ref('icao_official_ei').push().key,existing=(window.icaoOfficialEiRecords||{})[id]||{},now=new Date().toISOString(),who=actor();
        const links=typeof window.getAssessmentEventIdsForOfficialEi==='function'?window.getAssessmentEventIdsForOfficialEi(id):{eventId:`official_${id}`,snapshotId:`official_after_${id}`};
        const payload=clean({name,type:formValue('icaoEiType')||'OTHER',resultStatus:formValue('icaoEiResultStatus')||'official',startDate:formValue('icaoEiStartDate')||'',endDate:formValue('icaoEiEndDate')||'',assessmentDate,reportDate:formValue('icaoEiReportDate')||'',pqVersion:formValue('icaoEiPqVersion'),pqRevision:formValue('icaoEiPqRevision'),scopeAreas:readScopeAreas(),overallEI:overall,overallSatisfactory,overallApplicable,areas,source:formValue('icaoEiSource'),notes:formValue('icaoEiNotes'),active:!!(document.getElementById('icaoEiActive')||{}).checked,isDeleted:false,assessmentEventId:links.eventId,eiSnapshotId:links.snapshotId,createdAt:existing.createdAt||now,createdBy:existing.createdBy||who,updatedAt:now,updatedBy:who,moduleVersion:'official-ei-management-v3-assessment'});
        setMessage('Firebase’e kaydediliyor...');
        try{await db.ref('icao_official_ei/'+id).set(payload);let syncWarning='';if(typeof window.syncOfficialEiRecordToAssessmentModel==='function'){try{await window.syncOfficialEiRecordToAssessmentModel(id,payload,{silent:true});}catch(syncErr){console.error(syncErr);syncWarning=' Olay/Snapshot senkronizasyonu ayrıca kontrol edilmelidir.';}}setValue('icaoEiRecordId',id);setMessage('Değerlendirme kaydı başarıyla kaydedildi.'+syncWarning,syncWarning?'warn':'success');if(typeof showAppRuntimeToast==='function')showAppRuntimeToast('Değerlendirme ve EI kaydı kaydedildi.',syncWarning?'warn':'success');}
        catch(err){console.error(err);setMessage('Kayıt başarısız: '+(err.message||err),'error');}
    };
    window.deleteIcaoOfficialEiRecord=async function(){
        const id=formValue('icaoEiRecordId'),r=(window.icaoOfficialEiRecords||{})[id];if(!id||!r)return;if(!confirm(`“${r.name||'Bu kayıt'}” pasife alınarak silinsin mi?`))return;
        try{await db.ref('icao_official_ei/'+id).update({isDeleted:true,active:false,deletedAt:new Date().toISOString(),deletedBy:actor(),updatedAt:new Date().toISOString(),updatedBy:actor()});resetIcaoOfficialEiForm();if(typeof showAppRuntimeToast==='function')showAppRuntimeToast('Resmî EI kaydı silindi.','success');}
        catch(err){setMessage('Silme işlemi başarısız: '+(err.message||err),'error');}
    };
    window.seedDefaultIcaoOfficialEiData=async function(){
        if(!firebase.auth().currentUser)return alert('Bu işlem için yetkili giriş gereklidir.');
        const records=allRecords();if(records.length&&!confirm('Firebase üzerinde mevcut resmî EI kayıtları var. Yerleşik CMAA ve Virtual OSVA dönemleri de eklensin mi?'))return;
        const now=new Date().toISOString(),who=actor(),root=db.ref('icao_official_ei'),updates={};
        const defaults=[
            {name:'CMAA',type:'CMAA',resultStatus:'official',assessmentDate:'2024-09-01',scopeAreas:[...AREAS],pqVersion:'2020',pqRevision:'',overallEI:50.69,areas:{LEG:86.36,ORG:50.00,PEL:70.73,OPS:68.03,AIR:54.84,AIG:25.30,ANS:20.69,AGA:53.91},source:'ICAO USOAP OLF resmî CMAA sonucu'},
            {name:'Virtual OSVA (ICAO Val.)',type:'OSVA',resultStatus:'official',startDate:'2026-05-04',endDate:'2026-05-08',assessmentDate:'2026-05-08',scopeAreas:['OPS','AIR'],pqVersion:'2024',pqRevision:'',overallEI:55.28,areas:{LEG:86.36,ORG:50.00,PEL:70.73,OPS:70.73,AIR:71.61,AIG:25.30,ANS:20.69,AGA:53.91},source:'ICAO USOAP OLF Virtual OSVA / ICAO validasyon sonucu'}
        ];
        const existingKeys=new Set(records.map(r=>`${String(r.name||'').toLocaleLowerCase('tr')}|${r.assessmentDate||''}`));
        defaults.forEach(r=>{const naturalKey=`${String(r.name||'').toLocaleLowerCase('tr')}|${r.assessmentDate||''}`;if(existingKeys.has(naturalKey))return;const id=root.push().key;const links=typeof window.getAssessmentEventIdsForOfficialEi==='function'?window.getAssessmentEventIdsForOfficialEi(id):{eventId:`official_${id}`,snapshotId:`official_after_${id}`};updates[id]=clean({...r,reportDate:'',notes:'Başlangıç veri seti',active:true,isDeleted:false,assessmentEventId:links.eventId,eiSnapshotId:links.snapshotId,createdAt:now,createdBy:who,updatedAt:now,updatedBy:who,moduleVersion:'official-ei-management-v3-assessment'});});
        if(!Object.keys(updates).length)return alert('CMAA ve Virtual OSVA başlangıç kayıtları zaten mevcut.');
        try{await root.update(updates);if(typeof showAppRuntimeToast==='function')showAppRuntimeToast('CMAA ve Virtual OSVA verileri Firebase’e aktarıldı.','success');}
        catch(err){alert('Başlangıç verileri yüklenemedi: '+(err.message||err));}
    };


    const ICAO_EI_EXCEL_HEADERS=['Kayıt ID','Değerlendirme Adı *','Değerlendirme Türü','Sonuç Statüsü','Ziyaret Başlangıç','Ziyaret Bitiş','Değerlendirme Tarihi *','Raporun Alındığı Tarih','PQ Sürümü','PQ Revizyonu','Kapsam Alanları','Overall Satisfactory PQ','Overall Uygulanabilir PQ','Overall EI (%)','LEG (%)','ORG (%)','PEL (%)','OPS (%)','AIR (%)','AIG (%)','ANS (%)','AGA (%)','Durum','Kaynak / Referans','Açıklama / Not'];
    const ICAO_EI_EXCEL_WIDTHS=[18,28,22,18,18,18,22,22,14,16,30,20,20,16,12,12,12,12,12,12,12,12,14,38,45];
    const ICAO_EI_TYPES=new Set(['CMAA','OSVA','ICVM','AUDIT','OTHER']);

    function setExcelStatus(message,type){
        const el=document.getElementById('icaoEiExcelStatus');if(!el)return;
        el.textContent=message||'';
        el.style.color=type==='error'?'var(--danger)':type==='success'?'var(--ok)':type==='warn'?'var(--warn)':'var(--muted)';
    }
    function excelWorkbookDownload(wb,fileName){
        if(typeof downloadReportWorkbook==='function')return downloadReportWorkbook(wb,fileName);
        XLSX.writeFile(wb,fileName);
    }
    function setIcaoEiSheetWidths(ws){ws['!cols']=ICAO_EI_EXCEL_WIDTHS.map(w=>({wch:w}));const lastCol=XLSX.utils.encode_col(ICAO_EI_EXCEL_HEADERS.length-1);ws['!autofilter']={ref:`A1:${lastCol}${Math.max(2,(ws['!ref']?XLSX.utils.decode_range(ws['!ref']).e.r+1:2))}`};}
    function appendIcaoEiUsageSheets(wb){
        const usage=[
            ['ICAO Resmî EI Excel Şablonu – Kullanım Açıklamaları',''],
            ['Kural','Açıklama'],
            ['Kayıt ID','Yeni kayıtlarda boş bırakılır. Sistemden dışa aktarılan dosyada bulunan ID korunursa ilgili Firebase kaydı güncellenir.'],
            ['Zorunlu alanlar','Değerlendirme Adı ve Değerlendirme Tarihi zorunludur. En az bir alan EI değeri girilmelidir.'],
            ['Tarih biçimi','Excel tarihi veya GG.AA.YYYY / YYYY-AA-GG biçimi kullanılabilir. Ziyaret başlangıç/bitiş tarihi isteğe bağlıdır.'],
            ['Oranlar','0 ile 100 arasında gerçek yüzde değeri girilir. Örnek: 68,03. Hücreye 0,6803 yazılmamalıdır.'],
            ['Değerlendirme Türü','CMAA, OSVA, ICVM, AUDIT veya OTHER.'],
            ['Sonuç Statüsü','OFFICIAL, DRAFT veya PROVISIONAL. Boş bırakılırsa OFFICIAL kabul edilir.'],
            ['Kapsam Alanları','Değerlendirilen alanlar virgülle yazılır. Örnek: OPS,AIR. Kapsam dışı alanların EI değeri tutulabilir fakat olay etkisinde değerlendirilmiş sayılmaz.'],
            ['PQ Sürümü / Revizyonu','Değerlendirmenin kullandığı ICAO PQ setini belirtmek için ayrı alanlardır.'],
            ['Overall Satisfactory / Uygulanabilir','İsteğe bağlıdır. İkisi birlikte verilirse Overall EI boş olduğunda otomatik hesaplanabilir.'],
            ['Durum','AKTİF veya PASİF. Boş bırakılırsa AKTİF kabul edilir.'],
            ['Güncelleme mantığı','Kayıt ID yoksa aynı Değerlendirme Adı + Değerlendirme Tarihi eşleşmesi aranır; bulunursa güncellenir, bulunmazsa yeni kayıt oluşturulur.'],
            ['Silme','Excel içe aktarma mevcut kayıtları silmez. Silme/pasife alma işlemi uygulamadaki yönetim ekranından yapılır.']
        ];
        const wsUsage=XLSX.utils.aoa_to_sheet(usage);wsUsage['!cols']=[{wch:26},{wch:95}];XLSX.utils.book_append_sheet(wb,wsUsage,'Kullanim');
        const examples=[ICAO_EI_EXCEL_HEADERS,
            ['', 'CMAA','CMAA','OFFICIAL','','','2024-09-01','','2020','','LEG,ORG,PEL,OPS,AIR,AIG,ANS,AGA','','',50.69,86.36,50.00,70.73,68.03,54.84,25.30,20.69,53.91,'AKTİF','ICAO USOAP OLF resmî CMAA sonucu','Örnek satır'],
            ['', 'Virtual OSVA (ICAO Val.)','OSVA','OFFICIAL','2026-05-04','2026-05-08','2026-05-08','','2024','','OPS,AIR','','',55.28,86.36,50.00,70.73,70.73,71.61,25.30,20.69,53.91,'AKTİF','ICAO USOAP OLF Virtual OSVA sonucu','Örnek satır']
        ];
        const wsExample=XLSX.utils.aoa_to_sheet(examples);setIcaoEiSheetWidths(wsExample);XLSX.utils.book_append_sheet(wb,wsExample,'Ornek');
    }
    window.downloadIcaoOfficialEiExcelTemplate=function(){
        if(typeof XLSX==='undefined')return alert('Excel kütüphanesi yüklenemedi.');
        const wb=XLSX.utils.book_new(),ws=XLSX.utils.aoa_to_sheet([ICAO_EI_EXCEL_HEADERS]);setIcaoEiSheetWidths(ws);XLSX.utils.book_append_sheet(wb,ws,'ICAO_Resmi_EI');appendIcaoEiUsageSheets(wb);excelWorkbookDownload(wb,'ICAO_Resmi_EI_Sablonu.xlsx');
        setExcelStatus('Excel şablonu indirildi. Yeni kayıtlar için Kayıt ID sütununu boş bırakabilirsin.','success');
    };
    function exportRow(r){
        const a=r.areas||{};
        return {'Kayıt ID':r.id||'','Değerlendirme Adı *':r.name||'','Değerlendirme Türü':r.type||'OTHER','Sonuç Statüsü':String(r.resultStatus||'official').toUpperCase(),'Ziyaret Başlangıç':r.startDate||'','Ziyaret Bitiş':r.endDate||'','Değerlendirme Tarihi *':r.assessmentDate||'','Raporun Alındığı Tarih':r.reportDate||'','PQ Sürümü':r.pqVersion||'','PQ Revizyonu':r.pqRevision||'','Kapsam Alanları':Array.isArray(r.scopeAreas)?r.scopeAreas.join(','):'','Overall Satisfactory PQ':intOrNull(r.overallSatisfactory),'Overall Uygulanabilir PQ':intOrNull(r.overallApplicable),'Overall EI (%)':num(r.overallEI),'LEG (%)':num(a.LEG),'ORG (%)':num(a.ORG),'PEL (%)':num(a.PEL),'OPS (%)':num(a.OPS),'AIR (%)':num(a.AIR),'AIG (%)':num(a.AIG),'ANS (%)':num(a.ANS),'AGA (%)':num(a.AGA),'Durum':r.active!==false?'AKTİF':'PASİF','Kaynak / Referans':r.source||'','Açıklama / Not':r.notes||''};
    }
    window.exportIcaoOfficialEiExcel=function(){
        if(typeof XLSX==='undefined')return alert('Excel kütüphanesi yüklenemedi.');
        const records=[...allRecords()].sort((a,b)=>String(a.assessmentDate||'').localeCompare(String(b.assessmentDate||''))||String(a.name||'').localeCompare(String(b.name||''),'tr'));
        if(!records.length)return setExcelStatus('Dışa aktarılacak resmî EI kaydı bulunmuyor.','warn');
        const wb=XLSX.utils.book_new(),ws=XLSX.utils.json_to_sheet(records.map(exportRow),{header:ICAO_EI_EXCEL_HEADERS});setIcaoEiSheetWidths(ws);XLSX.utils.book_append_sheet(wb,ws,'ICAO_Resmi_EI');appendIcaoEiUsageSheets(wb);excelWorkbookDownload(wb,'ICAO_Resmi_EI_Kayitlari.xlsx');
        setExcelStatus(`${records.length} resmî EI kaydı Excel'e aktarıldı.`,'success');
    };
    function normalizedHeader(value){return String(value||'').trim().toLocaleLowerCase('tr-TR').replace(/[()%*]/g,'').replace(/[ıİ]/g,'i').replace(/[şŞ]/g,'s').replace(/[ğĞ]/g,'g').replace(/[üÜ]/g,'u').replace(/[öÖ]/g,'o').replace(/[çÇ]/g,'c').replace(/[^a-z0-9]+/g,' ' ).trim();}
    function rowLookup(row,names){
        const normalized={};Object.entries(row||{}).forEach(([k,v])=>{normalized[normalizedHeader(k)]=v;});
        for(const name of names){const key=normalizedHeader(name);if(Object.prototype.hasOwnProperty.call(normalized,key))return normalized[key];}
        return '';
    }
    function excelDateIso(value){
        if(value===null||value===undefined||value==='')return '';
        if(value instanceof Date&&!isNaN(value)){const y=value.getFullYear(),m=String(value.getMonth()+1).padStart(2,'0'),d=String(value.getDate()).padStart(2,'0');return `${y}-${m}-${d}`;}
        if(typeof value==='number'&&XLSX.SSF&&typeof XLSX.SSF.parse_date_code==='function'){const p=XLSX.SSF.parse_date_code(value);if(p)return `${String(p.y).padStart(4,'0')}-${String(p.m).padStart(2,'0')}-${String(p.d).padStart(2,'0')}`;}
        const s=String(value).trim();let m=s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);if(m)return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
        m=s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);if(m)return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
        return '';
    }
    function excelActive(value){
        if(value===false||value===0)return false;if(value===true||value===1)return true;
        const s=String(value||'').trim().toLocaleUpperCase('tr-TR');if(!s)return true;
        return !['PASİF','PASIF','HAYIR','NO','FALSE','0','KAPALI'].includes(s);
    }
    function excelResultStatus(value){const s=String(value||'OFFICIAL').trim().toUpperCase();if(['DRAFT','TASLAK'].includes(s))return'draft';if(['PROVISIONAL','GEÇİCİ','GECICI'].includes(s))return'provisional';return'official';}
    function excelScopeAreas(value){const raw=String(value||'').toUpperCase().split(/[,;|\s]+/).filter(Boolean);const set=new Set(raw);return AREAS.filter(a=>set.has(a));}
    function excelInteger(value,label,errors){if(value===null||value===undefined||String(value).trim()==='')return null;const n=Number(value);if(!Number.isFinite(n)||n<0||Math.round(n)!==n){errors.push(`${label} negatif olmayan tam sayı olmalıdır`);return null;}return n;}
    function excelPercent(value,label,errors){
        if(value===null||value===undefined||String(value).trim()==='')return null;
        const n=num(String(value).replace('%','').trim());if(n===null||n<0||n>100){errors.push(`${label} 0–100 arasında olmalıdır`);return null;}return n;
    }
    function parseIcaoEiExcelRow(row,rowNumber){
        const errors=[];
        const recordId=String(rowLookup(row,['Kayıt ID','Kayit ID','ID'])||'').trim();
        const name=String(rowLookup(row,['Değerlendirme Adı *','Değerlendirme Adı','Degerlendirme Adi'])||'').trim();
        const assessmentRaw=rowLookup(row,['Değerlendirme Tarihi *','Değerlendirme Tarihi','Degerlendirme Tarihi']);
        const assessmentDate=excelDateIso(assessmentRaw);
        const startRaw=rowLookup(row,['Ziyaret Başlangıç','Ziyaret Baslangic','Başlangıç Tarihi']);
        const endRaw=rowLookup(row,['Ziyaret Bitiş','Ziyaret Bitis','Bitiş Tarihi']);
        const startDate=excelDateIso(startRaw),endDate=excelDateIso(endRaw);
        const reportRaw=rowLookup(row,['Raporun Alındığı Tarih','Rapor Tarihi']);
        const reportDate=excelDateIso(reportRaw);
        if(!name)errors.push('Değerlendirme Adı zorunludur');
        if(!assessmentDate)errors.push('Değerlendirme Tarihi geçerli olmalıdır');
        if(startRaw!==''&&startRaw!==null&&startRaw!==undefined&&!startDate)errors.push('Ziyaret Başlangıç tarihi geçersizdir');
        if(endRaw!==''&&endRaw!==null&&endRaw!==undefined&&!endDate)errors.push('Ziyaret Bitiş tarihi geçersizdir');
        if(startDate&&endDate&&startDate>endDate)errors.push('Ziyaret başlangıç tarihi bitiş tarihinden sonra olamaz');
        if(reportRaw!==''&&reportRaw!==null&&reportRaw!==undefined&&!reportDate)errors.push('Raporun Alındığı Tarih geçersizdir');
        let type=String(rowLookup(row,['Değerlendirme Türü','Degerlendirme Turu','Tür','Tur'])||'OTHER').trim().toLocaleUpperCase('tr-TR');if(!ICAO_EI_TYPES.has(type))type='OTHER';
        const resultStatus=excelResultStatus(rowLookup(row,['Sonuç Statüsü','Sonuc Statusu','Statü','Status']));
        const pqVersion=String(rowLookup(row,['PQ Sürümü','PQ Surumu','PQ Version'])||'').trim();
        const pqRevision=String(rowLookup(row,['PQ Revizyonu','PQ Revision'])||'').trim();
        const scopeAreas=excelScopeAreas(rowLookup(row,['Kapsam Alanları','Kapsam Alanlari','Scope Areas']));
        const overallSatisfactory=excelInteger(rowLookup(row,['Overall Satisfactory PQ','Overall Satisfactory','Satisfactory PQ']),'Overall Satisfactory PQ',errors);
        const overallApplicable=excelInteger(rowLookup(row,['Overall Uygulanabilir PQ','Overall Applicable PQ','Applicable PQ']),'Overall Uygulanabilir PQ',errors);
        if(overallSatisfactory!==null&&overallApplicable!==null&&overallSatisfactory>overallApplicable)errors.push('Overall Satisfactory PQ, uygulanabilir PQ sayısından büyük olamaz');
        let overallEI=excelPercent(rowLookup(row,['Overall EI (%)','Overall EI','Overall']), 'Overall EI', errors);
        if(overallEI===null&&overallSatisfactory!==null&&overallApplicable>0)overallEI=Math.round((overallSatisfactory/overallApplicable)*10000)/100;
        const areas={};let filled=0;for(const area of AREAS){const value=excelPercent(rowLookup(row,[`${area} (%)`,area]),area,errors);areas[area]=value;if(value!==null)filled++;}
        if(!filled)errors.push('En az bir alan EI değeri girilmelidir');
        const source=String(rowLookup(row,['Kaynak / Referans','Kaynak','Referans'])||'').trim();
        const notes=String(rowLookup(row,['Açıklama / Not','Açıklama','Not'])||'').trim();
        const active=excelActive(rowLookup(row,['Durum','Aktif']));
        return {rowNumber,recordId,name,type,resultStatus,startDate,endDate,assessmentDate,reportDate,pqVersion,pqRevision,scopeAreas,overallSatisfactory,overallApplicable,overallEI,areas,source,notes,active,errors,naturalKey:`${name.toLocaleLowerCase('tr-TR')}|${assessmentDate}`};
    }
    window.importIcaoOfficialEiExcel=async function(event){
        const input=event&&event.target;const file=input&&input.files&&input.files[0];if(!file)return;
        setExcelStatus('Excel dosyası okunuyor ve doğrulanıyor...');
        try{
            if(!firebase.auth().currentUser)throw new Error('İçe aktarma için yetkili oturum gereklidir.');
            if(typeof XLSX==='undefined')throw new Error('Excel kütüphanesi yüklenemedi.');
            const buffer=await file.arrayBuffer(),wb=XLSX.read(buffer,{type:'array',cellDates:true});
            const sheetName=wb.SheetNames.find(n=>normalizedHeader(n)==='icao resmi ei')||wb.SheetNames[0];if(!sheetName)throw new Error('Excel çalışma sayfası bulunamadı.');
            const rows=XLSX.utils.sheet_to_json(wb.Sheets[sheetName],{defval:'',raw:true});if(!rows.length)throw new Error('İçe aktarılacak veri satırı bulunamadı.');
            const parsed=rows.map((row,index)=>parseIcaoEiExcelRow(row,index+2));
            const seen=new Map();parsed.forEach(item=>{if(!item.naturalKey||item.errors.length)return;if(seen.has(item.naturalKey)){item.errors.push(`Aynı değerlendirme ve tarih ${seen.get(item.naturalKey)}. satırda da var`);}else seen.set(item.naturalKey,item.rowNumber);});
            const valid=parsed.filter(x=>!x.errors.length),invalid=parsed.filter(x=>x.errors.length);
            if(!valid.length)throw new Error('Geçerli kayıt bulunamadı. '+invalid.slice(0,4).map(x=>`${x.rowNumber}. satır: ${x.errors.join(', ')}`).join(' | '));
            const existingByNatural=new Map(allRecords().map(r=>[`${String(r.name||'').toLocaleLowerCase('tr-TR')}|${r.assessmentDate||''}`,r]));
            const store=window.icaoOfficialEiRecords||{},updates={},now=new Date().toISOString(),who=actor();let createCount=0,updateCount=0;
            valid.forEach(item=>{
                let id=item.recordId&&!/[.#$\[\]\/]/.test(item.recordId)?item.recordId:'';
                let existing=id?store[id]:null;
                if(!existing){const match=existingByNatural.get(item.naturalKey);if(match){id=match.id;existing=store[id]||match;}}
                if(!id)id=db.ref('icao_official_ei').push().key;
                if(existing)updateCount++;else createCount++;
                const links=typeof window.getAssessmentEventIdsForOfficialEi==='function'?window.getAssessmentEventIdsForOfficialEi(id):{eventId:`official_${id}`,snapshotId:`official_after_${id}`};
                updates[id]=clean({name:item.name,type:item.type,resultStatus:item.resultStatus,startDate:item.startDate,endDate:item.endDate,assessmentDate:item.assessmentDate,reportDate:item.reportDate,pqVersion:item.pqVersion,pqRevision:item.pqRevision,scopeAreas:item.scopeAreas,overallSatisfactory:item.overallSatisfactory,overallApplicable:item.overallApplicable,overallEI:item.overallEI,areas:item.areas,source:item.source,notes:item.notes,active:item.active,isDeleted:false,assessmentEventId:links.eventId,eiSnapshotId:links.snapshotId,createdAt:(existing&&existing.createdAt)||now,createdBy:(existing&&existing.createdBy)||who,updatedAt:now,updatedBy:who,moduleVersion:'official-ei-management-v3-assessment-excel'});
            });
            const errorPreview=invalid.length?'\n\nAtlanacak hatalı satırlar:\n'+invalid.slice(0,8).map(x=>`${x.rowNumber}. satır: ${x.errors.join(', ')}`).join('\n')+(invalid.length>8?`\n... ve ${invalid.length-8} satır daha`:''):'';
            const approved=confirm(`${valid.length} geçerli kayıt bulundu.\nYeni kayıt: ${createCount}\nGüncellenecek kayıt: ${updateCount}\nHatalı/atlanacak satır: ${invalid.length}${errorPreview}\n\nFirebase'e aktarılsın mı?`);if(!approved){setExcelStatus('Excel içe aktarma kullanıcı tarafından iptal edildi.','warn');return;}
            await db.ref('icao_official_ei').update(updates);
            if(typeof window.syncAllOfficialEiRecordsToAssessmentModel==='function')setTimeout(()=>window.syncAllOfficialEiRecordsToAssessmentModel({silent:true}),100);
            const summary=`Excel içe aktarma tamamlandı: ${createCount} yeni kayıt, ${updateCount} güncelleme${invalid.length?`, ${invalid.length} hatalı satır atlandı`:''}.`;
            setExcelStatus(summary,'success');if(typeof showAppRuntimeToast==='function')showAppRuntimeToast(summary,'success');
        }catch(err){console.error('ICAO resmî EI Excel içe aktarma hatası',err);setExcelStatus('Excel içe aktarma başarısız: '+(err.message||err),'error');}
        finally{if(input)input.value='';}
    };

    window.runIcaoOfficialEiManagementSelfCheck=function(){const records=allRecords(),active=activeRecords(),globalPlugin=typeof Chart!=='undefined'&&Chart.registry?Chart.registry.plugins.get('chartBarValuePlugin'):null,result={passed:!!document.getElementById('icaoOfficialEiModal')&&typeof startIcaoOfficialEiListener==='function'&&typeof saveIcaoOfficialEiRecord==='function'&&typeof importIcaoOfficialEiExcel==='function'&&typeof exportIcaoOfficialEiExcel==='function'&&typeof downloadIcaoOfficialEiExcelTemplate==='function'&&!globalPlugin,records:records.length,active:active.length,chartUsesManagedData:active.length>=1,globalValuePluginRegistered:!!globalPlugin,overallIncluded:!!(getManagedIcaoOfficialEiChartConfig()&&getManagedIcaoOfficialEiChartConfig().areas.some(r=>r.area==='Overall')),multiPeriodControls:!!document.getElementById('icaoOfficialPeriodSelector')&&!!document.getElementById('icaoOfficialReferenceSelect'),overallCards:!!document.getElementById('icaoOfficialOverallCards')&&typeof renderIcaoOfficialOverallCards==='function',trendChart:!!document.getElementById('icaoOfficialTrendCanvas')&&typeof renderIcaoOfficialTrend==='function',trendMetric:officialEiTrendMetric,trendRecords:trendRecords().length,selectedPeriods:(getManagedIcaoOfficialEiChartConfig()&&getManagedIcaoOfficialEiChartConfig().records||[]).length,excelInputPresent:!!document.getElementById('icaoEiExcelInput'),assessmentModel:typeof window.runAssessmentEventSelfCheck==='function'?window.runAssessmentEventSelfCheck():null,functions:{start:typeof startIcaoOfficialEiListener,save:typeof saveIcaoOfficialEiRecord,delete:typeof deleteIcaoOfficialEiRecord,importExcel:typeof importIcaoOfficialEiExcel,exportExcel:typeof exportIcaoOfficialEiExcel,template:typeof downloadIcaoOfficialEiExcelTemplate}};console.log('ICAO Resmî EI Veri Yönetimi kontrolü:',result);return result;};
    updateStatus();
})();
