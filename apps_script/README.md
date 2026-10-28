# Heads-up refresh on Google Apps Script (runs on Google, laptop not needed)

Files: `Code.gs` (paste into the editor), `appsscript.json` (manifest). `Code.template.gs` + `build.py` are
only for regenerating Code.gs if Adit's SQL ever changes. Do not share Code.gs outside the team (it holds Adit's SQL).

## One-time install (about 10 minutes, as the owner of both sheets)
1. Go to https://script.google.com -> **New project**. Rename it `Heads-up refresh`.
   Make it a STANDALONE project (do not open it from inside the sheet), so agents with sheet access cannot see the key.
2. **Project Settings (gear) -> tick "Show appsscript.json manifest file in editor"**. Open `appsscript.json` in the
   editor and replace its contents with `apps_script/appsscript.json`.
3. Open `Code.gs` in the editor, select all, replace with the contents of `apps_script/Code.gs`. Save.
4. **Project Settings -> Script properties -> Add script property**: name `MB_KEY`, value = the Metabase API key
   (the part after `key:` in metabase.env). Save.
5. In the editor choose function **dryRun** -> Run. Approve the permissions (Google shows an "unverified app"
   screen: Advanced -> Go to Heads-up refresh). Then open **Execution log**: expect
   `OK: N flagged, M CALL, in Xs`. If X is over ~50, tell Claude (Google limits a web request to about 60s).
6. Choose function **refresh** -> Run once. Check the caller sheet fills in and `last_refreshed` is current.
7. Choose function **installTrigger** -> Run. This makes `refresh()` run every 30 minutes, acting only 10:00-19:30 IST.
8. Tell Claude. The laptop task and the GitHub schedule are then switched off so only one runner writes.

## Day to day
- Every run writes one line to the `Run log` tab of the DS register sheet. A failed run or a 0-row run also emails the owner (max 1/hour).
- If the Metabase key is rotated, update the `MB_KEY` script property.
- The project's Triggers page (clock icon) shows the schedule and any failed executions.
