# Run from the repository root. All credentials/data below are disposable fixtures.
param([string[]]$TestFiles = @(), [switch]$SchemaOnly, [switch]$TerminalOnly, [string]$Grep = '')
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '../../../..')).Path
Set-Location -LiteralPath $repo
$identities = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'source-identities.json') -Raw | ConvertFrom-Json
foreach ($identity in $identities) {
  $actual = (Get-FileHash -LiteralPath (Join-Path $repo $identity.path) -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($actual -ne $identity.sha256) { throw "Fixture source changed; review and refresh isolated schema before testing: $($identity.path)" }
}
$owner = 'admin-phase-04-account-20261115'
$names = @('dologram-admin-p4-rest','dologram-admin-p4-auth','dologram-admin-p4-db')
$network = 'dologram-admin-p4-network'
$created = [System.Collections.Generic.List[string]]::new()
$gateway = $null
function Invoke-Docker {
  & docker @args
  if ($LASTEXITCODE -ne 0) { throw "Docker command failed: $($args[0])" }
}
# Refuse to adopt/replace anything already present, regardless of labels.
foreach ($name in $names) {
  $existing = docker ps -a --filter "name=^/$name$" --format '{{.Names}}'
  if ($LASTEXITCODE -ne 0 -or $existing) { throw "Container name unavailable: $name" }
}
$existingNetwork = docker network ls --filter "name=^$network$" --format '{{.Name}}'
if ($existingNetwork) { throw 'Test network name unavailable' }
foreach ($port in @(3114,3115,3116,3120,3121,3122,3123)) {
  if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) { throw "Test port unavailable: $port" }
}
try {
  Invoke-Docker network create --label "dologram.owner=$owner" $network | Out-Null
  Invoke-Docker run --detach --name $names[2] --label "dologram.owner=$owner" --network $network --network-alias db -e POSTGRES_PASSWORD=disposable-local-only -p 127.0.0.1:3122:5432 postgres:17.6 | Out-Null
  $created.Add($names[2])
  $ready = $false
  for ($attempt = 0; $attempt -lt 20; $attempt++) {
    # The official image's temporary initialization server accepts Unix sockets
    # before restarting. Require TCP so setup waits for the final server.
    docker exec $names[2] pg_isready -h 127.0.0.1 -U postgres *> $null
    if ($LASTEXITCODE -eq 0) { $ready = $true; break }
    Start-Sleep -Milliseconds 500
  }
  if (!$ready) { throw 'Disposable database startup timed out' }
  $initial = 'create schema auth; create schema private; create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls; alter role postgres in database postgres set search_path = auth, public;'
  Invoke-Docker exec $names[2] psql -U postgres -v ON_ERROR_STOP=1 -c $initial | Out-Null
  Invoke-Docker run --detach --name $names[1] --label "dologram.owner=$owner" --network $network -p 127.0.0.1:3121:9999 -e GOTRUE_API_HOST=0.0.0.0 -e GOTRUE_API_PORT=9999 -e API_EXTERNAL_URL=http://127.0.0.1:3121 -e GOTRUE_SITE_URL=http://127.0.0.1:3100 -e GOTRUE_DB_DRIVER=postgres -e GOTRUE_DB_DATABASE_URL=postgres://postgres:disposable-local-only@db:5432/postgres?sslmode=disable -e GOTRUE_JWT_SECRET=disposable-admin-phase-four-jwt-secret-only -e GOTRUE_JWT_EXP=86400 -e GOTRUE_JWT_ADMIN_ROLES=service_role -e GOTRUE_JWT_AUD=authenticated -e GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated -e GOTRUE_EXTERNAL_EMAIL_ENABLED=true -e GOTRUE_MAILER_AUTOCONFIRM=true -e GOTRUE_RATE_LIMIT_EMAIL_SENT=1000 -e GOTRUE_RATE_LIMIT_TOKEN_REFRESH=1000 public.ecr.aws/supabase/gotrue:v2.197.0 | Out-Null
  $created.Add($names[1])
  $ready = $false
  for ($attempt = 0; $attempt -lt 20; $attempt++) {
    try { $response = Invoke-WebRequest http://127.0.0.1:3121/health -UseBasicParsing -TimeoutSec 2; if ($response.StatusCode -eq 200) { $ready = $true; break } } catch { }
    Start-Sleep -Milliseconds 500
  }
  if (!$ready) { throw 'Disposable Auth startup timed out' }
  $schema = & node (Join-Path $PSScriptRoot 'backend-schema.mjs')
  if ($LASTEXITCODE -ne 0) { throw 'Disposable source schema generation failed' }
  $schema | docker exec -i $names[2] psql -U postgres -v ON_ERROR_STOP=1
  if ($LASTEXITCODE -ne 0) { throw 'Disposable profile schema failed' }
  Get-Content -LiteralPath (Join-Path $PSScriptRoot 'contract-diagnostics.sql') -Raw | docker exec -i $names[2] psql -U postgres -v ON_ERROR_STOP=1
  if ($LASTEXITCODE -ne 0) { throw 'Disposable contract diagnostics failed' }
  if ($SchemaOnly) { return }
  if ($TerminalOnly) {
    $fixture = & node --import tsx --input-type=module -e "import {source} from './apps/admin/tests/harness/fixture.mts'; process.stdout.write(JSON.stringify(source))" | ConvertFrom-Json
    foreach ($property in $fixture.PSObject.Properties) { Set-Item -LiteralPath ('Env:' + $property.Name) -Value $property.Value }
    $env:BACKUP_DIR = Join-Path $repo ('.tmp/admin-phase8-backups-' + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $env:BACKUP_DIR | Out-Null
    'Disposable backup boundary; no plaintext credentials.' | Set-Content (Join-Path $env:BACKUP_DIR 'boundary.txt')
    $gateway = Start-Process -FilePath (Get-Command node).Source -ArgumentList @('--import','tsx','apps/admin/tests/harness/backend.mjs') -WindowStyle Hidden -PassThru
    $ready = $false
    for ($attempt=0; $attempt -lt 20; $attempt++) {
      try { if ((Invoke-WebRequest http://127.0.0.1:3120/health -UseBasicParsing -TimeoutSec 2).StatusCode -eq 200) { $ready=$true; break } } catch { }
      Start-Sleep -Milliseconds 250
    }
    if (!$ready) { throw 'Terminal fixture gateway did not start' }
    $env:NODE_OPTIONS = '--conditions=react-server --import tsx --import ./apps/admin/tests/harness/terminal-capture.mjs'
    $suffix = [guid]::NewGuid().ToString('N').Substring(0,8)
    & npm.cmd run create-user -- --email "terminal-$suffix@fixture.invalid" --username "terminal_$suffix" --display-name 'Terminal fixture'
    if ($LASTEXITCODE -ne 0) { throw 'Actual terminal create-user failed' }
    & powershell.exe -NoProfile -File scripts/create-accounts.ps1 -Csv apps/admin/tests/fixtures/phase8-provisioning.csv
    if ($LASTEXITCODE -ne 0) { throw 'Actual terminal bulk wrapper failed' }
    return
  }
  # Preserve an existing user-web dev lock/server. Copy only reviewed source and
  # public assets into our own same-depth workspace; never copy env or credentials.
  $webCopy = Join-Path $repo ('.tmp/admin-phase8-web-' + [guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Path $webCopy | Out-Null
  foreach ($directory in @('src','public','assets')) {
    $sourceDirectory = Join-Path $repo "apps/web/$directory"
    if (Test-Path -LiteralPath $sourceDirectory) { Copy-Item -LiteralPath $sourceDirectory -Destination $webCopy -Recurse }
  }
  foreach ($file in @('package.json','next.config.ts','tsconfig.json','next-env.d.ts')) {
    Copy-Item -LiteralPath (Join-Path $repo "apps/web/$file") -Destination $webCopy
  }
  $env:ADMIN_PHASE8_WEB_DIR = $webCopy
  Invoke-Docker run --detach --name $names[0] --label "dologram.owner=$owner" --network $network -p 127.0.0.1:3123:3000 -e PGRST_DB_URI=postgres://postgres:disposable-local-only@db:5432/postgres -e PGRST_DB_SCHEMAS=public -e PGRST_DB_ANON_ROLE=anon -e PGRST_JWT_SECRET=disposable-admin-phase-four-jwt-secret-only public.ecr.aws/supabase/postgrest:v14.5 | Out-Null
  $created.Add($names[0])
  Write-Output 'Isolated backend: PostgreSQL 17.6 / Auth 2.197.0 / PostgREST 14.5; loopback 3121-3123; owned containers only'
  $selection = @($TestFiles)
  if ($Grep) { $selection += @('--grep',$Grep) }
  & npm.cmd run test:e2e --workspace apps/admin -- @selection
  if ($LASTEXITCODE -ne 0) { throw 'Admin browser acceptance failed; inspect the diagnostic output' }
} finally {
  if ($gateway -and !$gateway.HasExited) { Stop-Process -Id $gateway.Id }
  foreach ($name in @($names | Where-Object { $created.Contains($_) })) {
    $inspection = docker inspect $name | ConvertFrom-Json
    $label = $inspection[0].Config.Labels.'dologram.owner'
    if ($label -eq $owner) { docker rm --force --volumes $name | Out-Null }
  }
  $inspection = docker network inspect $network | ConvertFrom-Json
  $label = $inspection[0].Labels.'dologram.owner'
  if ($label -eq $owner) { docker network rm $network | Out-Null }
}
