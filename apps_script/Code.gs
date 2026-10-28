/**
 * Heads-up call list refresher (Google Apps Script).
 * Runs Adit's query (unchanged except start_date) through the Metabase API and keeps two sheets
 * up to date WITHOUT ever moving a row:
 *   caller sheet : CALL-arm tickets only (what agents see)
 *   DS register  : both arms (permanent record for the analysis)
 * New tickets are appended at the bottom; existing rows are matched by ticket_id and only their live
 * columns are overwritten. Agent-typed columns are never touched. Nothing is sorted or deleted.
 *
 * Setup: see README.md. Needs the script property MB_KEY (Metabase API key).
 */
const CFG = {
  START_DATE: '2026-10-20',
  MB_URL: 'https://metabase.wiom.in',
  DB_ID: 113,
  CALLER: { id: '1BkM2RdVOJ9ZGTXMNbFvRsuc1SnnZligtJy1S8_k2dqQ', tab: 'Call log' },
  REGISTER: { id: '1EJrWWorTV66Rw8Ttx6ES_vYPrTn6W8m7blKmyXLwU5c', tab: 'Register' },
  LOG_TAB: 'Run log',
  TZ: 'Asia/Kolkata',
  WINDOW_MIN: [10 * 60, 19 * 60 + 30],   // act only 10:00-19:30 IST (minutes since midnight)
};
const MODEL = '9f70571979';
const CALLER_FIXED = ['TICKET_ID', 'KAPTURE_TICKET_ID', 'CSP_ID', 'CSP_NAME', 'FLAGGED_AT_IST', 'SCORE_BAND'];
const CALLER_LIVE_HDR = ['status_now', 'issue', 'last_refreshed'];
const CALLER_LIVE_COL = 17; // Q
const CALLER_ADDED_COL = 20; // T: added_at, written once when the ticket is first added to the sheet
const REG_HDR = ['ticket_id', 'kapture_ticket_id', 'csp_id', 'csp_name', 'arm', 'score_band', 'delay_score',
  'model', 'created_at_ist', 'flagged_at_ist', 'enrolled_at', 'status_now', 'status_updated_at', 'issue'];
const REG_LIVE_COL = 12; // L

const SQL_TEMPLATE = `-- HEADS-UP CALLS: call list. Run every 30 minutes between 11:00 and 21:00 IST.
-- Only edit start_date (go-live day). Ask Adit before changing anything else.
WITH params AS (
  SELECT '2026-10-20'::date AS start_date,   -- go-live day
         0.6               AS score_line     -- fixed for the whole test
),
excluded AS (   -- 144 CSPs in other pilots: risk funnel (53), its control (32), verification pilot + control (59)
  SELECT column1 AS csp_id FROM VALUES
    ('a0b6h3'),
    ('a0b7i3'),
    ('a0b9f6'),
    ('a0b5s8'),
    ('a0c0h2'),
    ('a0b8u5'),
    ('a0b6a7'),
    ('a0b5y5'),
    ('a0b9l3'),
    ('a0b9y1'),
    ('a0b9n8'),
    ('a0b7j3'),
    ('a0b9v2'),
    ('a0c0d3'),
    ('a0b6o8'),
    ('a0b5s5'),
    ('a0b6z6'),
    ('a0b9h5'),
    ('a0b9a6'),
    ('a0b9p7'),
    ('a0b6z9'),
    ('a0b9t6'),
    ('a0b9o2'),
    ('a0b9w0'),
    ('a0b5y1'),
    ('a0c0f0'),
    ('a0b9b3'),
    ('a0b8q9'),
    ('a0c0h0'),
    ('a0b9q5'),
    ('a0b6s0'),
    ('a0b5r2'),
    ('a0b6g0'),
    ('a0a7f4'),
    ('a0b9d1'),
    ('a0b8q8'),
    ('a0b6n3'),
    ('a0b9f5'),
    ('a0b6y8'),
    ('a0b7e9'),
    ('a0b9u3'),
    ('a0c0h9'),
    ('a0a7a1'),
    ('a0b5s3'),
    ('a0b9t5'),
    ('a0b8s9'),
    ('a0b9b4'),
    ('a0b8y5'),
    ('a0b9g0'),
    ('a0b6a0'),
    ('a0b5x7'),
    ('a0b9f1'),
    ('a0c0d9'),
    ('a0a7c6'),
    ('a0b8s6'),
    ('a0b9d0'),
    ('a0b6f7'),
    ('a0b6t3'),
    ('a0b9s4'),
    ('a0b8x5'),
    ('a0c0i6'),
    ('a0b9r5'),
    ('a0b9x0'),
    ('a0b7g3'),
    ('a0b6h6'),
    ('a0b5p0'),
    ('a0b7h6'),
    ('a0b6n5'),
    ('a0c0j1'),
    ('a0b8t0'),
    ('a0b6a5'),
    ('a0b5o5'),
    ('a0b6u6'),
    ('a0b9j9'),
    ('a0b9m2'),
    ('a0b5x4'),
    ('a0b6u3'),
    ('a0b9a0'),
    ('a0b6m0'),
    ('a0a6y4'),
    ('a0c0h3'),
    ('a0b8q1'),
    ('a0b6h2'),
    ('a0c0a5'),
    ('a0b6l5'),
    ('a0b8q3'),
    ('a0a7e6'),
    ('a0a7d9'),
    ('a0b9v4'),
    ('a0b8p0'),
    ('a0b5v7'),
    ('a0b9t8'),
    ('a0a7c5'),
    ('a0a7b0'),
    ('a0a7e4'),
    ('a0a7b9'),
    ('a0b5x0'),
    ('a0b5t9'),
    ('a0b6o1'),
    ('a0b6o2'),
    ('a0b6y3'),
    ('a0b6z2'),
    ('a0b7g7'),
    ('a0b7h8'),
    ('a0b8o6'),
    ('a0b8w2'),
    ('a0b8w7'),
    ('a0b9j1'),
    ('a0b9k1'),
    ('a0b9k9'),
    ('a0b9m4'),
    ('a0b9t7'),
    ('a0b9w6'),
    ('a0b9z4'),
    ('a0b9r8'),
    ('a0b6z7'),
    ('a0b6y7'),
    ('a0c0a0'),
    ('a0b8v9'),
    ('a0b7a3'),
    ('a0b9k4'),
    ('a0b6f5'),
    ('a0a7a8'),
    ('a0b7c6'),
    ('a0b7a1'),
    ('a0b5z0'),
    ('a0b6t1'),
    ('a0b6k3'),
    ('a0b5r5'),
    ('a0b6r5'),
    ('a0b7a7'),
    ('a0b9l1'),
    ('a0b6e0'),
    ('a0b5s4'),
    ('a0b9n5'),
    ('a0b6c5'),
    ('a0b9b9'),
    ('a0b6d8'),
    ('a0b6c9'),
    ('a0b9n2'),
    ('a0b8w6'),
    ('a0b7b7'),
    ('a0b6p8'),
    ('a0b8w8')
),
flags AS (
  SELECT p.ticket_id, p.csp_id, p.created_at_ist, p.scored_at_ist, p.delay_score
  FROM prod_db.ds_tables.service_ticket_delay_predictions p, params
  WHERE left(p.model_sha256, 10) = '9f70571979'          -- current model; if no rows, ask Adit (model may have changed)
    AND p.unscored_reason IS NULL
    AND p.delay_score >= params.score_line
    AND p.created_at_ist::date >= params.start_date
    AND p.csp_id NOT IN (SELECT csp_id FROM excluded)
  QUALIFY ROW_NUMBER() OVER (PARTITION BY p.ticket_id ORDER BY p.scored_at_ist) = 1
),
capped AS (     -- max 2 test tickets per CSP per day (earliest first); the rest are left out of the test
  SELECT f.*, ROW_NUMBER() OVER (PARTITION BY f.csp_id, f.created_at_ist::date ORDER BY f.created_at_ist, f.ticket_id) AS n_for_csp_today
  FROM flags f
),
status AS (
  SELECT ticket_id::text AS ticket_id, kapture_ticket_id, is_resolved, last_title
  FROM prod_db.public.service_ticket_model
  QUALIFY ROW_NUMBER() OVER (PARTITION BY ticket_id ORDER BY ticket_added_time DESC) = 1
)
SELECT
  c.ticket_id,
  s.kapture_ticket_id,
  c.csp_id,
  a.name                              AS csp_name,
  c.created_at_ist,
  c.scored_at_ist                     AS flagged_at_ist,
  ROUND(c.delay_score, 3)             AS delay_score,
  IFF(c.delay_score >= 0.698, 'A (0.70+)', 'B (0.60-0.70)') AS score_band,
  s.last_title                        AS issue,
  IFF(s.is_resolved = 1, 'CLOSED - skip', 'OPEN - call') AS status_now,
  IFF(MOD(ABS(HASH(c.ticket_id)), 2) = 0, 'CALL', 'NO CALL') AS arm
FROM capped c
LEFT JOIN status s ON s.ticket_id = c.ticket_id
LEFT JOIN (SELECT csp_id, name FROM prod_db.csp_gateway_service_csp_gateway_service.csp_account
           WHERE _fivetran_active QUALIFY ROW_NUMBER() OVER (PARTITION BY csp_id ORDER BY csp_id) = 1) a
       ON a.csp_id = c.csp_id
WHERE c.n_for_csp_today <= 2
ORDER BY c.scored_at_ist;`;

// ---------- entry points ----------
function refresh() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) { logRun_('skipped: previous run still going'); return; }
  try {
    run_();
  } catch (e) {
    logRun_('ERROR: ' + e.message);
    notify_('Heads-up refresh FAILED', e.message + '\n\nThe call sheet may be stale. Check the "Run log" tab in the DS register.');
    throw e;
  } finally {
    lock.releaseLock();
  }
}

/** Run once after install: shows Metabase speed and row counts, writes nothing. */
function dryRun() {
  const t0 = Date.now();
  const rows = fetchRows_();
  Logger.log('OK: ' + rows.length + ' flagged, ' + rows.filter(r => r.ARM === 'CALL').length + ' CALL, in ' +
    Math.round((Date.now() - t0) / 1000) + 's');
  Logger.log('caller tab rows: ' + readAll_(openTab_(CFG.CALLER)).length + ', register tab rows: ' + readAll_(openTab_(CFG.REGISTER)).length);
}

function installTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => { if (t.getHandlerFunction() === 'refresh') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('refresh').timeBased().everyMinutes(30).create();
  Logger.log('Trigger installed: refresh() every 30 minutes (it only acts 10:00-19:30 IST).');
}

// ---------- main ----------
function run_() {
  const mins = Number(Utilities.formatDate(new Date(), CFG.TZ, 'H')) * 60 + Number(Utilities.formatDate(new Date(), CFG.TZ, 'm'));
  if (mins < CFG.WINDOW_MIN[0] || mins > CFG.WINDOW_MIN[1]) return;
  const now = Utilities.formatDate(new Date(), CFG.TZ, 'yyyy-MM-dd HH:mm');
  const rows = fetchRows_();
  if (!rows.length) {
    logRun_('WARNING: query returned 0 rows - model may have changed, tell Adit. Sheets not touched.');
    notify_('Heads-up refresh: 0 rows', 'The query returned no rows during calling hours. The model may have changed - tell Adit.');
    return;
  }
  const calls = rows.filter(r => r.ARM === 'CALL');
  const n1 = sync_(openTab_(CFG.CALLER), calls,
    r => CALLER_FIXED.map(k => r[k]),
    (r, old) => [r.STATUS_NOW, r.ISSUE, now], CALLER_LIVE_COL, CALLER_LIVE_HDR,
    { col: CALLER_ADDED_COL, hdr: 'added_at', val: now });
  const regFixed = r => [r.TICKET_ID, r.KAPTURE_TICKET_ID, r.CSP_ID, r.CSP_NAME, r.ARM, r.SCORE_BAND,
    String(r.DELAY_SCORE), MODEL, r.CREATED_AT_IST, r.FLAGGED_AT_IST, now];
  const regLive = (r, old) => {
    const changed = old[0] !== r.STATUS_NOW;
    return [r.STATUS_NOW, (changed || !old[1]) ? now : old[1], r.ISSUE];
  };
  const n2 = sync_(openTab_(CFG.REGISTER), rows, regFixed, regLive, REG_LIVE_COL, REG_HDR.slice(REG_LIVE_COL - 1));
  logRun_('ok: ' + rows.length + ' flagged, ' + calls.length + ' CALL; appended ' + n1 + ' to caller sheet, ' + n2 + ' to register');
}

// ---------- Metabase ----------
function mbQuery_(sql) {
  const key = PropertiesService.getScriptProperties().getProperty('MB_KEY');
  if (!key) throw new Error('Script property MB_KEY is missing (Project Settings > Script properties).');
  let last;
  for (let a = 0; a < 3; a++) {
    try {
      const res = UrlFetchApp.fetch(CFG.MB_URL + '/api/dataset', {
        method: 'post', contentType: 'application/json', headers: { 'x-api-key': key },
        payload: JSON.stringify({ database: CFG.DB_ID, type: 'native', native: { query: sql } }),
        muteHttpExceptions: true,
      });
      const code = res.getResponseCode();   // Metabase answers 202 with the full result
      if (code < 200 || code >= 300) throw new Error('HTTP ' + code + ' ' + res.getContentText().slice(0, 200));
      const d = JSON.parse(res.getContentText());
      if (d.error || d.status === 'failed') throw new Error('Metabase: ' + String(d.error).slice(0, 300));
      return d;
    } catch (e) {
      last = e;
      if (a < 2) Utilities.sleep(3000);
    }
  }
  throw last;
}

function fmtTs_(v) {
  if (!v) return '';
  return String(v).replace('T', ' ').replace(/(\.\d+)?(Z|[+-]\d\d:\d\d)?$/, '').slice(0, 16);
}

function fetchRows_() {
  const sql = SQL_TEMPLATE.replace(/'\d{4}-\d{2}-\d{2}'::date AS start_date/, "'" + CFG.START_DATE + "'::date AS start_date");
  const d = mbQuery_(sql);
  const cols = d.data.cols.map(c => c.name);
  const rows = d.data.rows.map(r => {
    const o = {};
    cols.forEach((c, i) => o[c] = r[i]);
    o.TICKET_ID = String(o.TICKET_ID);
    o.CREATED_AT_IST = fmtTs_(o.CREATED_AT_IST);
    o.FLAGGED_AT_IST = fmtTs_(o.FLAGGED_AT_IST);
    o.KAPTURE_TICKET_ID = o.KAPTURE_TICKET_ID == null ? '' : String(o.KAPTURE_TICKET_ID);
    o.CSP_NAME = o.CSP_NAME || '';
    o.ISSUE = o.ISSUE || '';
    return o;
  });
  fillMissingKapture_(rows);
  rows.sort((a, b) => a.FLAGGED_AT_IST < b.FLAGGED_AT_IST ? -1 : a.FLAGGED_AT_IST > b.FLAGGED_AT_IST ? 1 :
    a.TICKET_ID < b.TICKET_ID ? -1 : a.TICKET_ID > b.TICKET_ID ? 1 : 0);
  return rows;
}

/** service_ticket_model lags upstream: look blank Kapture IDs up in the raw tickets table. Non-fatal. */
function fillMissingKapture_(rows) {
  const miss = rows.filter(r => !r.KAPTURE_TICKET_ID && /^\d+$/.test(r.TICKET_ID));
  if (!miss.length) return;
  const ids = miss.map(r => "'" + r.TICKET_ID + "'").join(',');
  try {
    const d = mbQuery_("select ticket_id::text, max(kapture_ticket_id)::text from prod_db.dynamodb_read.tickets where ticket_id::text in (" +
      ids + ") and kapture_ticket_id is not null group by 1");
    const found = {};
    d.data.rows.forEach(r => found[String(r[0])] = String(r[1]));
    miss.forEach(r => r.KAPTURE_TICKET_ID = found[r.TICKET_ID] || '');
  } catch (e) {
    logRun_('kapture lookup failed (non-fatal): ' + e.message);
  }
}

// ---------- sheets ----------
function openTab_(c) {
  const sh = SpreadsheetApp.openById(c.id).getSheetByName(c.tab);
  if (!sh) throw new Error('Tab not found: ' + c.tab);
  return sh;
}

function readAll_(sh) {
  const lr = sh.getLastRow(), lc = sh.getLastColumn();
  return lr && lc ? sh.getRange(1, 1, lr, lc).getDisplayValues() : [];
}

function updateBlock_(sh, row, col, values) {
  if (!values.length) return;
  const need = row + values.length - 1;
  if (need > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), need - sh.getMaxRows() + 50);
  const rng = sh.getRange(row, col, values.length, values[0].length);
  rng.setNumberFormat('@');            // keep ids, timestamps, scores as text
  rng.setValues(values.map(r => r.map(v => v == null ? '' : String(v))));
}

/** ids pasted by hand may carry commas/spaces ('1,792,727,978,487,000'): compare digits only */
function nid_(v) { return String(v == null ? '' : v).replace(/\D/g, ''); }

function nextRow_(rows) {
  let n = 1;
  rows.forEach((r, i) => { if (r && String(r[0]).trim()) n = i + 1; });
  return n + 1;
}

function sync_(sh, fresh, fixedVals, liveVals, liveCol, liveHdr, extra) {   // extra = {col, hdr, val}: write-once column
  const rows = readAll_(sh);
  if (!rows.length || !String(rows[0][0]).trim()) throw new Error('header row missing in tab ' + sh.getName());
  if (rows[0].length < liveCol || !String(rows[0][liveCol - 1] || '').trim()) updateBlock_(sh, 1, liveCol, [liveHdr]);
  if (extra && (rows[0].length < extra.col || !String(rows[0][extra.col - 1] || '').trim())) updateBlock_(sh, 1, extra.col, [[extra.hdr]]);
  const pos = {};
  for (let i = 1; i < rows.length; i++) { const id = nid_(rows[i][0]); if (id && !(id in pos)) pos[id] = i + 1; }   // first occurrence wins
  const byId = {};
  fresh.forEach(r => byId[r.TICKET_ID] = r);
  const nr = nextRow_(rows);

  // 1) refresh live columns of rows already on the sheet (in place)
  if (nr > 2) {
    const block = [];
    for (let i = 2; i < nr; i++) {
      const row = rows[i - 1] || [];
      const id = nid_(row[0]);
      const old = [];
      for (let k = 0; k < liveHdr.length; k++) old.push(row[liveCol - 1 + k] === undefined ? '' : String(row[liveCol - 1 + k]));
      block.push(byId[id] ? liveVals(byId[id], old) : old);
    }
    updateBlock_(sh, 2, liveCol, block);
  }

  // 1b) self-heal: fill any blank fixed cell (kapture id learned later, or a half-written row)
  Object.keys(pos).forEach(t => {
    if (!byId[t]) return;
    const i = pos[t], want = fixedVals(byId[t]).map(String), row = rows[i - 1] || [];
    want.forEach((w, j) => {
      const cur = row[j] ? String(row[j]).trim() : '';
      if (!cur && w.trim()) updateBlock_(sh, i, j + 1, [[w]]);
    });
  });

  // 2) append brand-new tickets at the bottom
  const fresh2 = fresh.filter(r => !(r.TICKET_ID in pos));
  if (fresh2.length) {
    updateBlock_(sh, nr, 1, fresh2.map(fixedVals));
    updateBlock_(sh, nr, liveCol, fresh2.map(r => liveVals(r, liveHdr.map(() => ''))));
    if (extra) updateBlock_(sh, nr, extra.col, fresh2.map(() => [extra.val]));
  }
  SpreadsheetApp.flush();   // surface any write error (e.g. validation) inside this run
  return fresh2.length;
}

// ---------- logging / alerts ----------
function logRun_(msg) {
  Logger.log(msg);
  try {
    const ss = SpreadsheetApp.openById(CFG.REGISTER.id);
    const sh = ss.getSheetByName(CFG.LOG_TAB) || ss.insertSheet(CFG.LOG_TAB);
    sh.appendRow([Utilities.formatDate(new Date(), CFG.TZ, 'yyyy-MM-dd HH:mm:ss'), msg]);
  } catch (e) { /* logging must never break a run */ }
}

function notify_(subject, body) {
  const props = PropertiesService.getScriptProperties();
  const last = Number(props.getProperty('lastMail') || 0);
  if (Date.now() - last < 3600 * 1000) return;   // at most one alert email an hour
  props.setProperty('lastMail', String(Date.now()));
  try { MailApp.sendEmail(Session.getEffectiveUser().getEmail(), subject, body); } catch (e) { /* ignore */ }
}
