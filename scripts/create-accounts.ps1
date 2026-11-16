# DoloGram account creation wrapper.
# Delegates to scripts/create-accounts.ts and @dologram/admin-core. Backend
# credentials come from apps/admin/.env.local and are never stored in this file.
param(
  [Parameter(Mandatory = $true)][string]$Csv
)

$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if (-not (Test-Path -LiteralPath $Csv)) { throw 'CSV file not found.' }

npm run create-accounts -- --csv $Csv
exit $LASTEXITCODE
