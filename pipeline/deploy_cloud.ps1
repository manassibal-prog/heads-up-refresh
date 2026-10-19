# One-time deploy of the refresh job to Google Cloud (Cloud Run job + Cloud Scheduler).
# Prereqs: gcloud CLI installed + `gcloud auth login` done, billing enabled on the project.
# Run from D:\Adit project:   powershell -ExecutionPolicy Bypass -File pipeline\deploy_cloud.ps1
$ErrorActionPreference = "Stop"
$P = "heads-up-calls"; $R = "asia-south1"; $JOB = "heads-up-refresh"

gcloud config set project $P
gcloud services enable run.googleapis.com cloudscheduler.googleapis.com cloudbuild.googleapis.com secretmanager.googleapis.com artifactregistry.googleapis.com

# --- secrets (values never printed) ---
$lines = Get-Content metabase.env
$url = $lines[0].Trim().TrimEnd('/')
$key = ($lines | Where-Object { $_ -like 'key:*' }) -replace '^key:\s*', ''
$tmp = New-TemporaryFile
[IO.File]::WriteAllText($tmp, $url);        gcloud secrets create mb-url --data-file=$tmp 2>$null; if ($LASTEXITCODE) { gcloud secrets versions add mb-url --data-file=$tmp }
[IO.File]::WriteAllText($tmp, $key.Trim()); gcloud secrets create mb-key --data-file=$tmp 2>$null; if ($LASTEXITCODE) { gcloud secrets versions add mb-key --data-file=$tmp }
Remove-Item $tmp
gcloud secrets create google-sa --data-file=pipeline\google_service_account.json 2>$null; if ($LASTEXITCODE) { gcloud secrets versions add google-sa --data-file=pipeline\google_service_account.json }

$num = gcloud projects describe $P --format="value(projectNumber)"
$SA = "$num-compute@developer.gserviceaccount.com"
foreach ($s in "mb-url","mb-key","google-sa") {
  gcloud secrets add-iam-policy-binding $s --member="serviceAccount:$SA" --role="roles/secretmanager.secretAccessor" | Out-Null
}

# --- job (built from source by Cloud Build, no Docker needed) ---
gcloud run jobs deploy $JOB --source pipeline --region $R --max-retries 1 --task-timeout 900s `
  --set-secrets "MB_URL=mb-url:latest,MB_KEY=mb-key:latest,GOOGLE_SA_JSON=google-sa:latest"
gcloud run jobs add-iam-policy-binding $JOB --region $R --member="serviceAccount:$SA" --role="roles/run.invoker" | Out-Null

# --- schedule: every 30 min 11:00-20:30 IST, plus 21:00 ---
$uri = "https://run.googleapis.com/v2/projects/$P/locations/$R/jobs/${JOB}:run"
foreach ($j in @(@("heads-up-refresh-main","0,30 11-20 * * *"), @("heads-up-refresh-2100","0 21 * * *"))) {
  gcloud scheduler jobs create http $j[0] --location $R --schedule $j[1] --time-zone "Asia/Kolkata" `
    --uri $uri --http-method POST --oauth-service-account-email $SA 2>$null
  if ($LASTEXITCODE) { gcloud scheduler jobs update http $j[0] --location $R --schedule $j[1] --time-zone "Asia/Kolkata" --uri $uri --http-method POST --oauth-service-account-email $SA }
}
Write-Host "Done. Test now with:  gcloud run jobs execute $JOB --region $R --wait"
