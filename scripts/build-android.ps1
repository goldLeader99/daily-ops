$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$previousLocation = Get-Location
try {
    Set-Location -LiteralPath $projectRoot
    $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
    $nodePath = if ($nodeCommand) { $nodeCommand.Source } else {
        Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
    }
    if (!(Test-Path -LiteralPath $nodePath)) { throw 'Install Node.js 22.12+ and install the project dependencies first.' }
    $env:PATH = (Split-Path -Parent $nodePath) + ';' + $env:PATH
    $localJdk = Get-ChildItem -LiteralPath (Join-Path $projectRoot '.tools') -Directory -Filter 'jdk-21*' -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($localJdk) { $env:JAVA_HOME = $localJdk.FullName }
    if (!$env:JAVA_HOME -or !(Test-Path -LiteralPath (Join-Path $env:JAVA_HOME 'bin\java.exe'))) {
        throw 'Set JAVA_HOME to JDK 21. See docs/ANDROID.md.'
    }
    if (!$env:ANDROID_HOME) { $env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
    if (!(Test-Path -LiteralPath $env:ANDROID_HOME)) { throw 'Set ANDROID_HOME to your Android SDK directory.' }
    & $nodePath node_modules/typescript/bin/tsc --noEmit
    if ($LASTEXITCODE -ne 0) { throw 'TypeScript check failed.' }
    & $nodePath node_modules/vite/bin/vite.js build
    if ($LASTEXITCODE -ne 0) { throw 'Vite build failed.' }
    & $nodePath scripts/build-sw.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Offline browser build failed.' }
    & $nodePath node_modules/@capacitor/cli/bin/capacitor sync android
    if ($LASTEXITCODE -ne 0) { throw 'Capacitor sync failed.' }
    & ./android/gradlew.bat -p android assembleDebug --console=plain
    if ($LASTEXITCODE -ne 0) { throw 'Android build failed.' }
    New-Item -ItemType Directory -Force artifacts | Out-Null
    Copy-Item -LiteralPath android/app/build/outputs/apk/debug/app-debug.apk -Destination artifacts/app-debug.apk -Force
    Write-Output "APK: $projectRoot\artifacts\app-debug.apk"
} finally {
    Set-Location -LiteralPath $previousLocation
}
