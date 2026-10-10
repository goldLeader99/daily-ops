param([Parameter(Mandatory=$true)][string]$DeviceSerial)
$ErrorActionPreference = 'Stop'
$adbTool = Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe'
$oldStayAwake = (& $adbTool -s $DeviceSerial shell settings get global stay_on_while_plugged_in).Trim()
$oldTimeout = (& $adbTool -s $DeviceSerial shell settings get system screen_off_timeout).Trim()
try {
    & $adbTool -s $DeviceSerial shell am start -W -n com.dailyops.dashboard/.MainActivity | Out-Null
    & $adbTool -s $DeviceSerial shell settings put global stay_on_while_plugged_in 0
    & $adbTool -s $DeviceSerial shell settings put system screen_off_timeout 15000
    if ($LASTEXITCODE -ne 0) { throw 'Could not configure the temporary timeout.' }
    Start-Sleep -Seconds 25
    $power = (& $adbTool -s $DeviceSerial shell dumpsys power) -join "`n"
    $window = (& $adbTool -s $DeviceSerial shell dumpsys window -a com.dailyops.dashboard) -join "`n"
    if ($power -notmatch 'mWakefulness=Awake') { throw 'Tablet slept while dashboard was visible.' }
    if ($power -notmatch 'mStayOn=false') { throw 'Charging keep-awake setting invalidates this test.' }
    if ($power -notmatch 'mScreenOffTimeoutSetting=15000') { throw 'Temporary screen timeout was not applied.' }
    if ($window -notmatch 'mHoldScreenWindow=.*com.dailyops.dashboard') { throw 'Dashboard is not the screen-awake window.' }
    New-Item -ItemType Directory -Force artifacts/device | Out-Null
    [IO.File]::WriteAllText((Join-Path (Get-Location) 'artifacts/device/awake-check.txt'), "PASS: Awake after 25 seconds with 15-second timeout and charging stay-awake disabled.`n" + $power + "`n" + $window)
    Write-Output 'PASS: Native dashboard keeps the screen awake beyond timeout, independently of USB charging settings.'
} finally {
    & $adbTool -s $DeviceSerial shell settings put global stay_on_while_plugged_in $oldStayAwake
    & $adbTool -s $DeviceSerial shell settings put system screen_off_timeout $oldTimeout
    Write-Output "Restored stay-on=$oldStayAwake, screen-off-timeout=$oldTimeout."
}
