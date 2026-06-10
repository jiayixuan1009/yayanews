param(
    [switch]$NoSelfElevate
)

$ErrorActionPreference = "Continue"

$LogFile = "C:\tmp\postgresql-16-service-repair.log"
$ServiceName = "postgresql-16"
$PgData = "C:\Program Files\PostgreSQL\16\data"
$PgCtl = "C:\Program Files\PostgreSQL\16\bin\pg_ctl.exe"
$PgReady = "C:\Program Files\PostgreSQL\16\bin\pg_isready.exe"
$PgLog = "C:\Users\admin\.pm2\logs\postgresql-16-watchdog.log"

function Write-RepairLog {
    param([string]$Message)
    $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $Message"
    $line | Tee-Object -FilePath $LogFile -Append | Out-Null
}

function Test-IsAdmin {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Invoke-Logged {
    param(
        [string]$FilePath,
        [string[]]$Arguments
    )
    Write-RepairLog "RUN $FilePath $($Arguments -join ' ')"
    $output = & $FilePath @Arguments 2>&1
    $exitCode = $LASTEXITCODE
    $output | Tee-Object -FilePath $LogFile -Append
    return $exitCode
}

if (-not $NoSelfElevate -and -not (Test-IsAdmin)) {
    Write-RepairLog "Current shell is not elevated; requesting UAC elevation."
    $args = @(
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        "`"$PSCommandPath`"",
        "-NoSelfElevate"
    )
    $proc = Start-Process -FilePath "powershell.exe" -ArgumentList $args -Verb RunAs -Wait -PassThru
    Write-RepairLog "Elevated repair process exited with code $($proc.ExitCode)."
    exit $proc.ExitCode
}

if (-not (Test-IsAdmin)) {
    Write-RepairLog "ERROR still not elevated; cannot modify Windows service ACL."
    exit 10
}

Write-RepairLog "Running elevated PostgreSQL service repair."

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupPath = "C:\tmp\postgresql-16-service-acl-before-$timestamp.txt"
$currentSddl = (& sc.exe sdshow $ServiceName) -join "`r`n"
$currentConfig = (& sc.exe qc $ServiceName) -join "`r`n"
"SDDL:`r`n$currentSddl`r`n`r`nCONFIG:`r`n$currentConfig" | Set-Content -Path $backupPath -Encoding ascii
Write-RepairLog "Backed up current service ACL/config to $backupPath."

# Grant INTERACTIVE users the minimum extra rights needed to start and stop this service.
# Existing IU rights: query config/status, enumerate dependents, interrogate, user control, read control.
# Added rights: RP (SERVICE_START), WP (SERVICE_STOP).
$newSddl = "D:(A;;CCLCSWRPWPDTLOCRRC;;;SY)(A;;CCDCLCSWRPWPDTLOCRSDRCWDWO;;;BA)(A;;CCLCSWRPWPLOCRRC;;;IU)(A;;CCLCSWLOCRRC;;;SU)"
$sdExit = Invoke-Logged "sc.exe" @("sdset", $ServiceName, $newSddl)
if ($sdExit -ne 0) {
    Write-RepairLog "ERROR sc sdset failed with exit code $sdExit."
    exit 11
}

Invoke-Logged "sc.exe" @("sdshow", $ServiceName) | Out-Null

$readyBefore = Invoke-Logged $PgReady @("-h", "127.0.0.1", "-p", "5433", "-d", "yayanews")
if ($readyBefore -eq 0) {
    Write-RepairLog "Stopping manually-started PostgreSQL before service handoff."
    Invoke-Logged $PgCtl @("stop", "-D", $PgData, "-m", "fast", "-w") | Out-Null
}

Write-RepairLog "Starting Windows service $ServiceName."
Invoke-Logged "sc.exe" @("start", $ServiceName) | Out-Null
Start-Sleep -Seconds 8
Invoke-Logged "sc.exe" @("queryex", $ServiceName) | Out-Null
$readyAfter = Invoke-Logged $PgReady @("-h", "127.0.0.1", "-p", "5433", "-d", "yayanews")

$serviceText = (& sc.exe queryex $ServiceName) -join "`n"
if ($readyAfter -eq 0 -and $serviceText -match "RUNNING") {
    Write-RepairLog "SUCCESS PostgreSQL is running under Windows service control."
    exit 0
}

Write-RepairLog "Service handoff failed; restoring database availability with pg_ctl fallback."
$fallbackExit = Invoke-Logged $PgCtl @("start", "-D", $PgData, "-l", $PgLog, "-w")
Start-Sleep -Seconds 3
$fallbackReady = Invoke-Logged $PgReady @("-h", "127.0.0.1", "-p", "5433", "-d", "yayanews")
if ($fallbackReady -eq 0) {
    Write-RepairLog "Fallback restored PostgreSQL availability, but Windows service is still not running."
    exit 20
}

Write-RepairLog "ERROR PostgreSQL service handoff failed and fallback did not restore readiness."
exit 21
