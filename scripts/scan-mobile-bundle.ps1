[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [string]$Path = 'apps\mobile\dist'
)

$resolvedPath = Resolve-Path -LiteralPath $Path -ErrorAction Stop
$files = @(Get-ChildItem -LiteralPath $resolvedPath -File -Recurse)
$patterns = @(
  '\bSUPABASE_SECRET_KEY\b',
  '\bSUPABASE_DB_URL\b',
  '\bSUPABASE_ACCESS_TOKEN\b',
  '\bADMIN_PASSCODE_HASH\b',
  '\bsb_secret_[A-Za-z0-9_-]{20,}\b',
  '\bLIVEKIT_API_KEY\b',
  '\bLIVEKIT_API_SECRET\b',
  '\bCALL_SCHEDULER_SECRET\b',
  '\bsecret_[A-Za-z0-9_-]{16,}\b'
)
$hits = @()

foreach ($file in $files) {
  $hits += @(Select-String -LiteralPath $file.FullName -Pattern $patterns -AllMatches)
}

if ($hits.Count -gt 0) {
  $locations = $hits | ForEach-Object { "{0}:{1}" -f $_.Path, $_.LineNumber }
  throw "Forbidden secret material found in mobile bundle: $($locations -join ', ')"
}

Write-Output "Mobile bundle secret scan passed: scanned $($files.Count) files."
