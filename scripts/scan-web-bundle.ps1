[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [string]$Path = 'apps\web\.next'
)

$ErrorActionPreference = 'Stop'
if (-not (Test-Path -LiteralPath $Path -PathType Container)) {
  Write-Output 'Web bundle scan refused: input directory is missing.'
  exit 1
}
$resolved = (Resolve-Path -LiteralPath $Path).Path
$roots = @($resolved)
if ((Split-Path -Leaf $resolved) -eq '.next') {
  $roots = @((Join-Path $resolved 'static'), (Join-Path $resolved 'server'))
  foreach ($root in $roots) {
    if (-not (Test-Path -LiteralPath $root -PathType Container) -or
        @(Get-ChildItem -LiteralPath $root -File -Recurse | Where-Object { $_.Length -gt 0 }).Count -eq 0) {
      Write-Output 'Web bundle scan refused: production client/server output is missing or empty.'
      exit 1
    }
  }
}
$files = @($roots | ForEach-Object { Get-ChildItem -LiteralPath $_ -File -Recurse } | Where-Object { $_.Length -gt 0 })
if ($files.Count -eq 0) {
  Write-Output 'Web bundle scan refused: input has no nonempty files.'
  exit 1
}

$patterns = @{
  'forbidden-name' = '\b(?:SUPABASE_(?:SECRET_KEY|SERVICE_ROLE_KEY|DB_URL|ACCESS_TOKEN)|ADMIN_PASSCODE_HASH|LIVEKIT_API_(?:KEY|SECRET)|CALL_SCHEDULER_SECRET|TEST_USER_[A-Z0-9]+_(?:EMAIL|PASSWORD))\b'
  'secret-pattern' = '\b(?:sb_secret_[A-Za-z0-9_-]{20,}|secret_[A-Za-z0-9_-]{16,})\b|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|postgres(?:ql)?://[^\s"'']+'
}
$known = @(Get-ChildItem Env: | Where-Object {
  $_.Name -match '^(?:SUPABASE_(?:SECRET_KEY|SERVICE_ROLE_KEY|DB_URL|ACCESS_TOKEN)|ADMIN_PASSCODE_HASH|LIVEKIT_API_(?:KEY|SECRET)|CALL_SCHEDULER_SECRET|TEST_USER_[A-Z0-9]+_(?:EMAIL|PASSWORD))$' -and
  -not [string]::IsNullOrWhiteSpace($_.Value)
})
$failed = $false
foreach ($file in $files) {
  $content = [IO.File]::ReadAllText($file.FullName)
  $categories = @()
  foreach ($category in $patterns.Keys) {
    if ($content -match $patterns[$category]) { $categories += $category }
  }
  foreach ($entry in $known) {
    $variants = @($entry.Value, [Uri]::EscapeDataString($entry.Value), (ConvertTo-Json -InputObject $entry.Value -Compress).Trim('"'))
    if (@($variants | Where-Object { $content.Contains($_) }).Count -gt 0) { $categories += 'known-sensitive-value'; break }
  }
  foreach ($token in [regex]::Matches($content, '\beyJ[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+')) {
    try {
      $payload = $token.Groups[1].Value.Replace('-', '+').Replace('_', '/')
      $payload = $payload.PadRight($payload.Length + ((4 - $payload.Length % 4) % 4), '=')
      $claims = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($payload)) | ConvertFrom-Json
      if ($claims.role -in @('service_role', 'supabase_admin')) { $categories += 'privileged-jwt' }
    } catch { }
  }
  if ($categories.Count -gt 0) {
    $failed = $true
    # Print locations/categories only; never source lines, matches or environment values.
    Write-Output ("{0}: {1}" -f $file.FullName, (($categories | Select-Object -Unique) -join ', '))
  }
}
if ($failed) { Write-Output 'Web bundle secret scan failed.'; exit 1 }
Write-Output ("Web bundle secret scan passed: scanned {0} nonempty files." -f $files.Count)
