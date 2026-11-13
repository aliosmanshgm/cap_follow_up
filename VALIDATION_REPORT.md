# Validation Report — Phase 1 Assessment Event + EI Snapshot v4

Baseline: `USOAP_CMA_CAP_Takip_monolith_rebuild_v3`
Original functional reference: `index_visit_hub_pq_version_database(2).html`

## Scope
This phase adds the data backbone required for CMAA → OSVA → ICVM → future validation-candidate EI history without removing the legacy `icao_official_ei` model.

## Static integrity
- Main tab count: **25 / 25 preserved**.
- Duplicate HTML IDs: **none**.
- Inline event handler names checked: **175**.
- Unresolved handler names: **0**.
- Missing local `<script>` / `<link>` references: **0**.
- New `assessment-events.js` module is loaded before `official-ei-management.js`.
- `node --check`: **passed** for all local JavaScript files.

## Assessment model test
A stubbed Firebase test was executed with an OSVA example:
- Scope: `OPS, AIR`
- Overall Satisfactory / Applicable: `458 / 720`
- EI: `63.61`
- Generated event path: `icao_assessment_events/official_abc123`
- Generated snapshot path: `icao_ei_snapshots/official_after_abc123`
- `OPS.inScope = true`, `LEG.inScope = false`
- Result: **passed**.

## Backward compatibility
- Existing `icao_official_ei` data path remains in use.
- Existing records are synchronized to Assessment Event + EI Snapshot after login/listener load.
- Existing records without numerator/denominator are not assigned invented counts.
- CMAA legacy scope defaults to all eight audit areas.
- The existing built-in Virtual OSVA baseline uses `OPS + AIR` scope.

## New metadata supported
- Result status: official / draft / provisional
- Visit start / end date
- Assessment / result date
- Report date
- PQ version
- PQ revision
- Scope audit areas
- Overall Satisfactory PQ
- Overall Applicable PQ
- Overall EI

## Firebase prerequisite
Realtime Database rules must permit the authenticated role to read/write:
- `icao_assessment_events`
- `icao_ei_snapshots`

If those permissions are not added, the legacy official-EI record can still save but the UI will warn that Assessment Event / Snapshot synchronization must be checked.

## Not yet changed in Phase 1
Dashboard EI bars and area-layered EI charts still use the legacy calculation path. They are intentionally left unchanged in this phase. Phase 2 will read the new Assessment Event timeline so CMAA, OSVA, ICVM and validation-candidate projection are rendered as distinct layers.
