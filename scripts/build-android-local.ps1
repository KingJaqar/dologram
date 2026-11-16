[CmdletBinding()]
param(
  [Parameter(Mandatory)]
  [ValidateSet('Debug', 'Release')]
  [string]$Variant,
  [ValidatePattern('^(arm64-v8a|armeabi-v7a|x86|x86_64)(,(arm64-v8a|armeabi-v7a|x86|x86_64))*$')]
  [string]$Architectures = 'arm64-v8a,x86_64',
  [switch]$Offline
)

$ErrorActionPreference = 'Stop'
$repository = Split-Path $PSScriptRoot -Parent
$mobile = Join-Path $repository 'apps/mobile'
$android = Join-Path $mobile 'android'
$wrapper = Join-Path $android 'gradlew.bat'
$expoCli = Join-Path $repository 'node_modules/expo/bin/cli'
if (!(Test-Path -LiteralPath $expoCli)) { throw 'Install workspace dependencies before building Android.' }
if ($Variant -eq 'Release' -and !(Test-Path -LiteralPath (Join-Path $mobile 'credentials.json'))) {
  throw 'Release requires the existing local Android signing credentials in apps/mobile/credentials.json.'
}

$buildDirectory = Join-Path $repository '.tmp/local-android'
New-Item -ItemType Directory -Force $buildDirectory | Out-Null
$environmentNames = @('JAVA_HOME', 'ANDROID_HOME', 'NODE_ENV', 'TEMP', 'TMP', 'CI', 'EXPO_NO_TELEMETRY')
$previousEnvironment = @{}
foreach ($name in $environmentNames) {
  $previousEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
}

try {
  $studioJava = Join-Path $env:ProgramFiles 'Android/Android Studio/jbr'
  if (Test-Path -LiteralPath (Join-Path $studioJava 'bin/java.exe')) {
    $env:JAVA_HOME = $studioJava
  }
  if (!$env:ANDROID_HOME) {
    $env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android/Sdk'
  }
  if (!(Test-Path -LiteralPath $env:ANDROID_HOME)) {
    throw 'Set ANDROID_HOME to the installed Android SDK.'
  }
  $env:NODE_ENV = if ($Variant -eq 'Release') { 'production' } else { 'development' }
  $env:TEMP = $buildDirectory
  $env:TMP = $buildDirectory
  $env:CI = '1'
  $env:EXPO_NO_TELEMETRY = '1'
  # Gradle alone does not apply app.json config plugins (including SQLCipher).
  # Refresh the existing native project without deleting local build/signing files.
  Push-Location $mobile
  try {
    & node $expoCli prebuild --platform android --no-install --no-clean
    if ($LASTEXITCODE -ne 0) { throw "Expo Android prebuild failed with exit code $LASTEXITCODE." }
  } finally {
    Pop-Location
  }
  if (!(Test-Path -LiteralPath $wrapper)) { throw 'Expo prebuild did not generate the Android Gradle wrapper.' }
  $task = ':app:assemble' + $Variant
  $arguments = @($task, '--no-daemon', '--max-workers=2', "-PreactNativeArchitectures=$Architectures")
  if ($Offline) { $arguments += '--offline' }
  if ($Variant -eq 'Release') {
    $arguments += @('--init-script', (Join-Path $PSScriptRoot 'android-release.init.gradle'))
  }
  Push-Location $android
  try {
    & $wrapper @arguments
    if ($LASTEXITCODE -ne 0) { throw "Gradle $Variant failed with exit code $LASTEXITCODE." }
  } finally {
    Pop-Location
  }

  $variantDirectory = $Variant.ToLowerInvariant()
  $apk = Join-Path $android "app/build/outputs/apk/$variantDirectory/app-$variantDirectory.apk"
  if (!(Test-Path -LiteralPath $apk)) { throw 'Gradle completed without the expected APK.' }
  Write-Output $apk
  Write-Output "Bytes $((Get-Item -LiteralPath $apk).Length)"
  Write-Output "SHA256 $((Get-FileHash -LiteralPath $apk -Algorithm SHA256).Hash)"
} finally {
  foreach ($name in $environmentNames) {
    [Environment]::SetEnvironmentVariable($name, $previousEnvironment[$name], 'Process')
  }
}
