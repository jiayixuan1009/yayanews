$ErrorActionPreference = 'Stop'

# Compatibility wrapper for Windows operators.
# Set these env vars when not using the defaults:
#   YAYA_DEPLOY_HOST=root@8.216.43.113
#   YAYA_DEPLOY_KEY=C:\Users\admin\.ssh\cryptooptiontool.pem
#   YAYA_DEPLOY_PATH=/var/www/yayanews

if (-not $env:YAYA_DEPLOY_HOST) { $env:YAYA_DEPLOY_HOST = 'root@8.216.43.113' }
if (-not $env:YAYA_DEPLOY_PATH) { $env:YAYA_DEPLOY_PATH = '/var/www/yayanews' }

$sshArgs = @('-o', 'StrictHostKeyChecking=accept-new')
if ($env:YAYA_DEPLOY_KEY) {
    $sshArgs += @('-i', $env:YAYA_DEPLOY_KEY)
}

$remoteCommand = "cd '$($env:YAYA_DEPLOY_PATH)' && bash infra/deploy/publish-yayanews.sh"
& ssh @sshArgs $env:YAYA_DEPLOY_HOST $remoteCommand
if ($LASTEXITCODE -ne 0) {
    throw "Remote deploy failed with exit code $LASTEXITCODE"
}
