#!/usr/bin/env python3
from pathlib import Path
import argparse, re, shutil, sys

NEW_DOWNLOAD_TEMPLATE = r'''    function downloadTemplate() {
        try {
            if (typeof XLSX === 'undefined') throw new Error('Excel kütüphanesi yüklenemedi.');

            const headers = ['PQ No', 'Denetim Alanı', 'Sorumlu', 'PQ Sorusu (TR)', 'Bulgu (TR)'];
            const pqKeys = Object.keys(pqMasterData || {}).sort((a, b) => {
                if (typeof sortPQs === 'function') return sortPQs(a, b);
                return String(a).localeCompare(String(b), 'tr', { numeric: true, sensitivity: 'base' });
            });

            const excelRows = [headers];
            pqKeys.forEach(pq => {
                const m = pqMasterData[pq] || {};
                excelRows.push([
                    pq,
                    m.alan || '',
                    m.sorumlu || '',
                    m.soruTr || '',
                    m.bulguTr || ''
                ]);
            });

            const wb = XLSX.utils.book_new();
            const wsMaster = XLSX.utils.aoa_to_sheet(excelRows);
            wsMaster['!cols'] = [{wch:12},{wch:18},{wch:34},{wch:70},{wch:80}];
            wsMaster['!freeze'] = { xSplit: 0, ySplit: 1 };
            if (excelRows.length > 1) wsMaster['!autofilter'] = { ref: `A1:E${excelRows.length}` };
            XLSX.utils.book_append_sheet(wb, wsMaster, 'PQ_Ek_Bilgi');

            const infoRows = [
                ['PQ Ek Bilgi / TR-Fallback Şablonu'],
                ['Amaç', 'Bu dosya yalnız PQ bazında ek/fallback bilgi taşır. Güncel ICAO durumu, EI ve ziyaret sonucu bu dosyadan üretilmez.'],
                ['Sorumlu', 'Legacy/fallback bilgidir. Responsibility Registry varsa Registry değeri önceliklidir.'],
                ['TR alanları', 'PQ Sorusu (TR) ve Bulgu (TR) isteğe bağlı Türkçe karşılıklardır.'],
                ['Resmî durum / EI', 'Full PQ Status State Snapshot kaynağından gelir.'],
                ['Ziyaret / validasyon', 'Assessment Event / ICAO Visit kaydında yönetilir.'],
                ['Kaldırılan legacy alanlar', 'ICAO KAPATTI MI, VALIDASYON GÖREVİ, EI_Referans ve günlük rapor alanları artık bu dosyada tutulmaz.']
            ];
            const wsInfo = XLSX.utils.aoa_to_sheet(infoRows);
            wsInfo['!cols'] = [{wch:28},{wch:110}];
            XLSX.utils.book_append_sheet(wb, wsInfo, 'Kullanim');

            XLSX.writeFile(wb, 'PQ_Excel_Master_Sablonu_TR_Ekli.xlsx');
            if (typeof showAppRuntimeToast === 'function') {
                showAppRuntimeToast(pqKeys.length ? `PQ ek bilgi şablonu dışa aktarıldı: ${pqKeys.length} PQ.` : 'Boş PQ ek bilgi şablonu indirildi.', 'success');
            }
        } catch (err) {
            console.error('PQ ek bilgi şablonu dışa aktarma hatası:', err);
            alert('PQ ek bilgi şablonu oluşturulamadı: ' + (err.message || err));
        }
    }
    window.downloadTemplate = downloadTemplate;'''

NEW_EXCEL_IMPORT = r'''    // PQ EK BİLGİ / TR-FALLBACK EXCEL OKUMASI
    document.getElementById('excelInput').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        showLoading('PQ ek bilgi dosyası okunuyor...', file.name);
        await yieldToBrowser();
        try {
            const data = await file.arrayBuffer();
            const wb = XLSX.read(data);
            const masterSheetName = wb.SheetNames.includes('PQ_Ek_Bilgi')
                ? 'PQ_Ek_Bilgi'
                : (typeof findExcelMasterSheetName === 'function' ? findExcelMasterSheetName(wb) : wb.SheetNames[0]);
            const wsMaster = wb.Sheets[masterSheetName];
            const jsonData = XLSX.utils.sheet_to_json(wsMaster, { defval: '' });

            // Legacy closure / validation alanları artık global PQ durumu değildir.
            Object.values(pqMasterData || {}).forEach(m => {
                if (!m || typeof m !== 'object') return;
                delete m.isIcaoClosed;
                delete m.validasyonGorevi;
            });

            let trQuestionImported = 0, trFindingImported = 0, ownerFallbackImported = 0;
            for (let i = 0; i < jsonData.length; i++) {
                const row = jsonData[i];
                const pqKey = findPQColumn(row);
                if (!pqKey || !row[pqKey]) continue;
                const pqStr = normalizePQ(row[pqKey]);
                if (!pqStr) continue;

                const excelArea = getCol(row, ['ALAN', 'AREA', 'DENETİM ALANI']) || '';
                const legacyOwner = getCol(row, ['SORUMLU', 'PERSONEL']) || '';
                const soruTr = getColExactLoose(row, ['PQ Sorusu (TR)', 'PQ Sorusu TR', 'SORU (TR)', 'SORU TR', 'PQ QUESTION (TR)', 'PQ QUESTION TR']) || '';
                const bulguTr = getColExactLoose(row, ['Bulgu (TR)', 'Bulgu TR', 'FINDING (TR)', 'FINDING TR', 'AÇIKLAMA (TR)', 'AÇIKLAMA TR']) || '';

                const existing = pqMasterData[pqStr] || {};
                if (!pqMasterData[pqStr]) pqMasterData[pqStr] = existing;
                if (!existing.alan && excelArea) existing.alan = String(excelArea).trim().toUpperCase();
                // Sorumlu yalnız fallback'tir; mevcut/Registry kaynaklı değer asla Excel ile ezilmez.
                if (!existing.sorumlu && String(legacyOwner).trim()) {
                    existing.sorumlu = String(legacyOwner).trim();
                    ownerFallbackImported++;
                }
                if (String(soruTr).trim()) { existing.soruTr = String(soruTr).trim(); trQuestionImported++; }
                if (String(bulguTr).trim()) { existing.bulguTr = String(bulguTr).trim(); trFindingImported++; }
                delete existing.isIcaoClosed;
                delete existing.validasyonGorevi;

                if (i % 100 === 0) await yieldToBrowser();
            }

            loadedExcelFile = file.name;
            window.lastPqTranslationImportDiagnostic = {
                fileName: file.name,
                sheetName: masterSheetName,
                rowCount: jsonData.length,
                questionTrCount: trQuestionImported,
                findingTrCount: trFindingImported,
                ownerFallbackCount: ownerFallbackImported,
                legacyClosureIgnored: true,
                legacyEiReferenceIgnored: true
            };

            renderFileList();
            await yieldToBrowser();
            refreshAllFilters();
            await yieldToBrowser();
            saveToLocalStorage();
            await yieldToBrowser();
            render();
            if (typeof showAppRuntimeToast === 'function') {
                showAppRuntimeToast(`PQ ek bilgi yüklendi: ${jsonData.length} satır. Legacy kapanış/validasyon alanları dikkate alınmadı.`, 'success');
            }
        } catch (err) {
            console.error(err);
            alert('PQ ek bilgi Excel dosyası okunurken hata oluştu: ' + (err.message || err));
        } finally {
            hideLoading();
            e.target.value = '';
        }
    });

'''

def replace_between(text, start_token, end_token, replacement, label):
    s = text.find(start_token)
    if s < 0:
        raise RuntimeError(f'{label}: başlangıç işareti bulunamadı: {start_token!r}')
    e = text.find(end_token, s)
    if e < 0:
        raise RuntimeError(f'{label}: bitiş işareti bulunamadı: {end_token!r}')
    return text[:s] + replacement + '\n\n' + text[e:]


def patch_app(path: Path):
    original = path.read_text(encoding='utf-8')
    text = original
    changes = []

    # 1) Download/export template
    start = '    function downloadTemplate() {'
    end = '    function clearAllData()'
    if start in text and end in text:
        text = replace_between(text, start, end, NEW_DOWNLOAD_TEMPLATE, 'downloadTemplate')
        changes.append('downloadTemplate -> 5 kolon / 2 sayfa')
    else:
        raise RuntimeError('downloadTemplate bloğu güvenli biçimde bulunamadı.')

    # 2) Excel import block: replace from Excel read comment/handler to legacy ICAO closed screen marker.
    handler_start = "    // EXCEL OKUMASI"
    if handler_start not in text:
        handler_start = "    document.getElementById('excelInput').addEventListener('change'"
    marker_candidates = [
        '    // EKRAN 2: ICAO KAPATTI MI',
        '    window.renderIcaoClosedList = function()'
    ]
    marker = next((m for m in marker_candidates if m in text[text.find(handler_start):]), None)
    if handler_start in text and marker:
        text = replace_between(text, handler_start, marker, NEW_EXCEL_IMPORT, 'Excel import')
        changes.append('Excel import -> supplemental overlay; closure/EI ignored')
    else:
        raise RuntimeError('Excel import bloğu güvenli biçimde bulunamadı.')

    # 2b) Supplemental Excel removal must not wipe authoritative PQ/Snapshot state.
    remove_pattern = re.compile(r"    function removeExcelFile\(\) \{[^\n]*\}")
    if remove_pattern.search(text):
        text = remove_pattern.sub("    function removeExcelFile() { loadedExcelFile = null; renderFileList(); saveToLocalStorage(); render(); }", text, count=1)
        changes.append('removeExcelFile -> authoritative state korunur')

    # Legacy 'ICAO closed from Excel' screen is no longer authoritative.
    legacy_screen_start = "    window.renderIcaoClosedList = function() {"
    if legacy_screen_start in text and "legacyKapanisEkraniDevreDisi" not in text:
        text = text.replace(legacy_screen_start, legacy_screen_start + "\n        const legacyKapanisEkraniDevreDisi = true;\n        if (legacyKapanisEkraniDevreDisi) { const c=document.getElementById('icaoClosedListContainer'); if(c) c.innerHTML='<div style=\"padding:14px;border:1px solid var(--border);border-radius:8px;color:var(--muted);\"><b>Legacy Excel kapanış listesi devre dışıdır.</b><br>Resmî S/NS/N-A durumu State Snapshot / Full PQ Status kaynağından; ziyaret sonucu ise ilgili ICAO Visit / Assessment kaydından izlenir.</div>'; return; }", 1)
        changes.append('legacy ICAO closed screen -> bilgi mesajı')

    # 3) Never exclude a PQ from a visit because of legacy master closure.
    replacements = [
        ("            if (isIcaoOfficialVisit(visit) && master.isIcaoClosed) return;\n", "", 'visit candidate legacy exclusion'),
        ("        if (master.isIcaoClosed) return false;\n        // Güncel CAP verisi", "        // Legacy Excel kapanış bayrağı ziyaret kapsamını engellemez.\n        // Güncel CAP verisi", 'open CAP legacy exclusion'),
        ("            if(!pq || master.isIcaoClosed) return false;", "            if(!pq) return false;", 'stored visit PQ legacy exclusion'),
    ]
    for old, new, label in replacements:
        if old in text:
            text = text.replace(old, new)
            changes.append(label)

    # 4) Visit-bound 'nonvalidated' semantics.
    old = "            if(pool==='nonvalidated') return !master.isIcaoClosed;"
    new = "            if(pool==='nonvalidated') { const rec=(typeof getIcaoValidationForPq==='function'?getIcaoValidationForPq(visit,item.pq):null); return !(rec && String(rec.finalResult||'').trim()); }"
    if old in text:
        text = text.replace(old, new)
        changes.append('nonvalidated filter -> visit finalResult')

    # 5) Sync note counts final result within selected visit, not legacy global closure.
    sync_pattern = re.compile(r"(?m)^(\s*)const allNonValidated=buildVisitScopeCandidates\(\)\.filter\(x=>!\(x\.master\|\|\{\}\)\.isIcaoClosed\)\.length;\s*$")
    if sync_pattern.search(text):
        text = sync_pattern.sub(lambda m: m.group(1) + "const allNonValidated=buildVisitScopeCandidates().filter(x=>{ const rec=(typeof getIcaoValidationForPq==='function'?getIcaoValidationForPq(visit,x.pq):null); return !(rec && String(rec.finalResult||'').trim()); }).length;", text, count=1)
        changes.append('visit sync count -> visit finalResult')
    text = text.replace('ICAO valide edilmemiş PQ: ${allNonValidated}', 'Nihai sonucu girilmemiş PQ: ${allNonValidated}')

    # 6) Existing legacy filtering pass must be disabled if variant survived outside handler.
    legacy_filter = "                if (m.isIcaoClosed) rawData = rawData.filter(d => d.pq !== pqStr);"
    if legacy_filter in text:
        text = text.replace(legacy_filter, "                // Legacy Excel kapanış bayrağı rawData/PQ kapsamını filtrelemez.")
        changes.append('rawData legacy closure filter disabled')

    if text == original:
        raise RuntimeError('Hiçbir değişiklik uygulanmadı.')

    backup = path.with_suffix(path.suffix + '.RC1_2_backup')
    if not backup.exists():
        shutil.copy2(path, backup)
    path.write_text(text, encoding='utf-8')
    return changes, backup


def patch_index(path: Path):
    original = path.read_text(encoding='utf-8')
    text = original
    reps = [
        ('Excel Master Veri (.xlsx)', 'PQ Ek Bilgi / TR-Fallback (.xlsx)'),
        ('Excel Master Veri', 'PQ Ek Bilgi / TR-Fallback'),
        ('Orijinal Word Dosyaları (.docx)', 'Orijinal CAP Word Dosyaları (.docx)'),
    ]
    count=0
    for old,new in reps:
        if old in text:
            text=text.replace(old,new); count+=1
    if text != original:
        backup = path.with_suffix(path.suffix + '.RC1_2_backup')
        if not backup.exists(): shutil.copy2(path, backup)
        path.write_text(text, encoding='utf-8')
        return count, backup
    return 0, None


def main():
    ap=argparse.ArgumentParser(description='RC1.3 PQ Master sadeleştirme ve ziyaret-kapsam patchi')
    ap.add_argument('app_js', help='Güncel RC1.2 app.js yolu')
    ap.add_argument('--index', help='İsteğe bağlı güncel index.html yolu')
    args=ap.parse_args()
    app=Path(args.app_js)
    if not app.exists(): sys.exit(f'app.js bulunamadı: {app}')
    try:
        changes, backup = patch_app(app)
        print('OK app.js')
        print('Backup:', backup)
        for c in changes: print(' -', c)
        if args.index:
            idx=Path(args.index)
            if not idx.exists(): raise RuntimeError(f'index.html bulunamadı: {idx}')
            count, ib = patch_index(idx)
            print(f'OK index.html: {count} metin güncellemesi' + (f' | Backup: {ib}' if ib else ''))
    except Exception as e:
        print('PATCH FAILED:', e, file=sys.stderr)
        sys.exit(2)

if __name__=='__main__': main()
