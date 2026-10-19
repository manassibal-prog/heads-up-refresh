# Heads-up call list refresher

`refresh.py` runs `heads_up_call_list.sql` (only start_date is edited, via config.json) through the
Metabase API and updates two Google Sheets without moving any row.

## One-time setup
1. Google Cloud console -> create a project -> enable "Google Sheets API" -> create a Service Account ->
   Keys -> add JSON key. Save it as `pipeline/google_service_account.json`.
2. Caller sheet: upload `heads_up_call_log.xlsx` to Drive, open as Google Sheet. Share it (Editor) with the
   service account's email (client_email in the JSON). Paste its ID (from the URL) into config.json -> caller.sheet_id.
3. DS register: a SEPARATE spreadsheet (callers must not see NO CALL rows). Tab named `Register`, header row:
   ticket_id, kapture_ticket_id, csp_id, csp_name, arm, score_band, delay_score, model, created_at_ist,
   flagged_at_ist, enrolled_at, status_now, status_updated_at, issue
   Share with the service account too. Paste ID into config.json -> register.sheet_id.
4. `pip install gspread google-auth`

## Run
    python pipeline/refresh.py          # exit code 2 = query returned 0 rows (tell Adit)

Scheduling: every 30 min, 11:00-21:00 IST (see Windows Task Scheduler task "HeadsUpRefresh").
Log: pipeline/refresh.log
