#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const read = p => fs.readFileSync(path.join(root,p),'utf8');
const exists = p => fs.existsSync(path.join(root,p));
const html = read('index.html');
const manifest = JSON.parse(read('app-manifest.json'));
const expectedCache = '20261115-v1.0-rc1.1';
const failures=[]; const warnings=[]; const passes=[];
const pass=(name,detail='')=>passes.push({name,detail});
const fail=(name,detail='')=>failures.push({name,detail});
const warn=(name,detail='')=>warnings.push({name,detail});

// 1. HTML IDs
const idMatches=[...html.matchAll(/\bid\s*=\s*["']([^"']+)["']/g)].map(m=>m[1]);
const idCounts=new Map(); idMatches.forEach(id=>idCounts.set(id,(idCounts.get(id)||0)+1));
const dupIds=[...idCounts.entries()].filter(([,n])=>n>1);
dupIds.length?fail('HTML duplicate IDs',dupIds.map(([id,n])=>`${id} x${n}`).join(', ')):pass('HTML duplicate IDs',`${idMatches.length}/${idCounts.size} benzersiz`);

// 2. Local refs
const refs=[];
for(const m of html.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/g)){
  const v=m[1]; if(/^(?:https?:|mailto:|javascript:|#|data:)/i.test(v))continue;
  const local=v.split(/[?#]/)[0]; if(local)refs.push(local);
}
const missingRefs=[...new Set(refs)].filter(p=>!exists(p));
missingRefs.length?fail('Yerel asset referansları',missingRefs.join(', ')):pass('Yerel asset referansları',`${new Set(refs).size} referans mevcut`);

// 3. Unified cache version
const assetTags=[...html.matchAll(/(?:src|href)=["']((?:js|css)\/[^"']+)["']/g)].map(m=>m[1]);
const badCache=assetTags.filter(v=>!new RegExp(`[?&]v=${expectedCache.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}(?:&|$)`).test(v));
badCache.length?fail('RC cache etiketi',badCache.join(', ')):pass('RC cache etiketi',`${assetTags.length} yerel asset ${expectedCache}`);

// 4. JS syntax
const jsFiles=[];
function walk(dir){for(const ent of fs.readdirSync(path.join(root,dir),{withFileTypes:true})){const rel=path.join(dir,ent.name); if(ent.isDirectory())walk(rel); else if(ent.isFile()&&rel.endsWith('.js'))jsFiles.push(rel);}}
walk('js');
const syntaxBad=[];
for(const f of jsFiles){const r=spawnSync(process.execPath,['--check',path.join(root,f)],{encoding:'utf8'}); if(r.status!==0)syntaxBad.push(`${f}: ${(r.stderr||r.stdout).trim().split('\n')[0]}`);}
syntaxBad.length?fail('JavaScript syntax',syntaxBad.join(' | ')):pass('JavaScript syntax',`${jsFiles.length} dosya`);

// 5. Inline handler -> function existence
const jsText=jsFiles.map(read).join('\n')+'\n'+html;
const functionNames=new Set();
for(const re of [/\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g,/window\.([A-Za-z_$][\w$]*)\s*=/g,/\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/g]){for(const m of jsText.matchAll(re))functionNames.add(m[1]);}
const builtins=new Set(['if','for','while','switch','catch','function','return','typeof','alert','confirm','prompt','setTimeout','clearTimeout','setInterval','clearInterval','parseInt','parseFloat','Number','String','Boolean','Date','Object','Array','Math','JSON']);
const handlerValues=[...html.matchAll(/\b(?:onclick|onsubmit|onchange|oninput|onblur|onfocus|onkeydown|onkeyup)\s*=\s*["']([^"']*)["']/g)].map(m=>m[1]);
const missingFns=new Set();
for(const h of handlerValues){for(const m of h.matchAll(/(?<![\w.$])([A-Za-z_$][\w$]*)\s*\(/g)){if(!builtins.has(m[1])&&!functionNames.has(m[1]))missingFns.add(m[1]);}}
missingFns.size?fail('Inline handler fonksiyonları',[...missingFns].sort().join(', ')):pass('Inline handler fonksiyonları',`${handlerValues.length} handler`);

// 6. Tabs / virtual hub routes
const tabs=new Set([...html.matchAll(/\bid=["']tab-([^"']+)["']/g)].map(m=>m[1]));
const btns=new Set([...html.matchAll(/\bid=["']btn-tab-([^"']+)["']/g)].map(m=>m[1]));
const virtual=new Set(['cap-hub','visit-hub']);
const tabsNoBtn=[...tabs].filter(x=>!btns.has(x));
const btnNoTab=[...btns].filter(x=>!tabs.has(x)&&!virtual.has(x));
(tabsNoBtn.length||btnNoTab.length)?fail('Tab / Hub rotaları',`tabsNoBtn=${tabsNoBtn.join(',')} btnNoTab=${btnNoTab.join(',')}`):pass('Tab / Hub rotaları',`${tabs.size} ekran + ${virtual.size} sanal Hub`);

// 7. Manifest / release
manifest.version==='1.0.0-rc1.1'?pass('Manifest sürümü',manifest.version):fail('Manifest sürümü',String(manifest.version));
manifest.releaseChannel==='release-candidate'?pass('Release channel','release-candidate'):fail('Release channel',String(manifest.releaseChannel));

// 8. Public OAuth pages
for(const f of ['about.html','privacy.html','terms.html']) exists(f)?pass(`Public page ${f}`):fail(`Public page ${f}`,'eksik');
const privacy=read('privacy.html');
/drive\.file/i.test(privacy)?pass('Privacy Drive scope açıklaması'):warn('Privacy Drive scope açıklaması','drive.file ifadesi bulunamadı');

// 9. Firebase Rules security assertions
const rules=JSON.parse(read('firebase/database.rules.rc1_1.json')).rules;
rules['.read']===false&&rules['.write']===false?pass('Firebase root deny'):fail('Firebase root deny','root read/write false değil');
const userWrite=rules.icao_access_control?.users?.['$uid']?.['.write']||'';
/user.*owner/i.test(userWrite)&&/manager/.test(userWrite)&&/!root\.child\('icao_access_control\/users'\)\.exists\(\)/.test(userWrite)?pass('Access bootstrap + yönetici sınırı'):fail('Access bootstrap + yönetici sınırı',userWrite.slice(0,240));
const reqWrite=rules.icao_access_control?.requests?.['$uid']?.['.write']||'';
/status'\)\.val\(\) === 'pending'/.test(reqWrite)&&/!root\.child\('icao_access_control\/users'\)\.child\(\$uid\)\.exists\(\)/.test(reqWrite)?pass('Erişim talebi self-write sınırı'):fail('Erişim talebi self-write sınırı',reqWrite.slice(0,240));
const docSettings=rules.icao_document_hub?.settings?.['.write']||'';
const docRecords=rules.icao_document_hub?.records?.['.write']||'';
!docSettings.includes("'specialist'")&&docRecords.includes("'specialist'")?pass('Drive settings/record rol ayrımı'):fail('Drive settings/record rol ayrımı');
const actionSettings=rules.icao_action_center?.settings?.['.write']||'';
const actionManual=rules.icao_action_center?.manual?.['.write']||'';
!actionSettings.includes("'specialist'")&&actionManual.includes("'specialist'")?pass('Aksiyon settings/task rol ayrımı'):fail('Aksiyon settings/task rol ayrımı');
const notif=rules.icao_notification_center?.users?.['$uid']?.['.write']||'';
/auth\.uid === \$uid/.test(notif)?pass('Bildirim kullanıcı izolasyonu'):fail('Bildirim kullanıcı izolasyonu',notif);

const stateRules=rules.icao_state_snapshots||{};
stateRules['.read']&&stateRules['.write']&&!String(stateRules['.write']).includes("'specialist'")?pass('State Snapshot rol sınırı'):fail('State Snapshot rol sınırı');
const respRules=rules.icao_responsibility_registry||{};
respRules['.read']&&respRules['.write']&&!String(respRules['.write']).includes("'specialist'")?pass('Sorumluluk registry rol sınırı'):fail('Sorumluluk registry rol sınırı');

// 10. Source-code regression guards
const pqLib=read('js/modules/pq-library.js');
const parser=read('js/parsers/pq-docx-parser.js');
const linkage=read('js/modules/pq-linkage.js');
const drive=read('js/modules/drive-documents.js');
/PQDB_AREAS=\[\.\.\.PQDB_AUDIT_AREAS,'SSP'\]/.test(pqLib)&&/SSP:\{[^}]*range:'9\.xxx'/.test(pqLib)?pass('SSP / 9.xxx PQ referansı'):fail('SSP / 9.xxx PQ referansı');
/pqDbAmendmentStats/.test(pqLib)&&/mergedCount/.test(pqLib)&&/noChangeCount/.test(pqLib)&&/deletedCount/.test(pqLib)?pass('PQ değişiklik dağılımı koruması'):fail('PQ değişiklik dağılımı koruması');
/summarizeAmendmentGroup/.test(parser)&&/oldPq===newPq&&!desc/.test(parser)?pass('PQ parser No change/Merged koruması'):fail('PQ parser No change/Merged koruması');
/replace\(\/\[\.#\$\\\[\\\]\\\/\]\/g,'_'\)/.test(linkage)?pass('Firebase-safe PQ alias key'):warn('Firebase-safe PQ alias key','regex imzası doğrulanamadı');
/https:\/\/www\.googleapis\.com\/auth\/drive\.file/.test(drive)?pass('Google Drive dar kapsam'):fail('Google Drive dar kapsam');

const stateCompliance=read('js/modules/state-compliance.js');
const officialMgmt=read('js/modules/official-ei-management.js');
const responsibility=read('js/modules/responsibility-registry.js');
/state_snapshots|icao_state_snapshots/.test(stateCompliance)&&/compareStateComplianceSnapshots/.test(stateCompliance)?pass('State Snapshot source-of-truth modülü'):fail('State Snapshot source-of-truth modülü');
/eventMetrics/.test(officialMgmt)&&/scopeApplicable/.test(officialMgmt)&&/stateSnapshotId/.test(officialMgmt)?pass('Assessment scope / Overall ayrımı'):fail('Assessment scope / Overall ayrımı');
/PQ Concept ID/.test(responsibility)&&/icao_responsibility_registry/.test(responsibility)?pass('Sorumluluk registry'):fail('Sorumluluk registry');
/parseCapProtocolRow/.test(read('js/app.js'))&&/capFindingSource/.test(read('js/app.js'))?pass('CAP Word PROTOCOL FINDING kaynağı'):fail('CAP Word PROTOCOL FINDING kaynağı');
/localStorage[^\n]*(?:accessToken|refreshToken)|sessionStorage[^\n]*(?:accessToken|refreshToken)/i.test(drive)?fail('Drive token kalıcılığı','token storage paterni bulundu'):pass('Drive token kalıcılığı','erişim tokenı yalnız bellek state içinde');

// 11. Module self-check exports exist in source
for(const fn of ['runStateComplianceSelfCheck','runResponsibilityRegistrySelfCheck','runOfficialEiSourceOfTruthSelfCheck','runPqLibrarySelfCheck','runDriveDocumentsSelfCheck','runVisitHubSelfCheck','runValidationReadinessSelfCheck','runAssessmentImpactSelfCheck','runSystemIntegritySelfCheck','runActionCenterSelfCheck','runNotificationCenterSelfCheck','runReportingCenterSelfCheck','runAccessControlSelfCheck']){
  jsText.includes(`window.${fn}`)?pass(`SelfCheck ${fn}`):fail(`SelfCheck ${fn}`,'export yok');
}

// 12. Performance heuristics (warnings only)
for(const f of ['index.html','css/app.css','js/app.js']){const kb=Math.round(fs.statSync(path.join(root,f)).size/1024); if((f==='js/app.js'&&kb>1000)||(f!=='js/app.js'&&kb>300))warn(`Boyut ${f}`,`${kb} KB`); else pass(`Boyut ${f}`,`${kb} KB`);}

const report={release:manifest.version,generatedAt:new Date().toISOString(),passed:failures.length===0,counts:{passes:passes.length,warnings:warnings.length,failures:failures.length},failures,warnings,passes};
fs.writeFileSync(path.join(root,'RC_STATIC_QA_REPORT.json'),JSON.stringify(report,null,2)+'\n');
console.log(`USOAP CMA CAP Takip ${manifest.version} RC static check`);
console.log(`PASS ${passes.length} | WARN ${warnings.length} | FAIL ${failures.length}`);
for(const x of failures)console.log(`FAIL  ${x.name}${x.detail?' :: '+x.detail:''}`);
for(const x of warnings)console.log(`WARN  ${x.name}${x.detail?' :: '+x.detail:''}`);
if(!failures.length)console.log('RESULT: PASS');
process.exit(failures.length?1:0);
