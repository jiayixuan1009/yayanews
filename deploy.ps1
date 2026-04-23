# 增量热补丁脚本：把若干 web/pipeline 源文件 scp 到生产 + 重新 build & reload。
# 先决条件：
#   $env:YAYA_DEPLOY_HOST = "root@<your-host>"        # e.g. root@1.2.3.4
#   $env:YAYA_DEPLOY_PATH = "/var/www/yayanews"        # 远端项目根目录
#   $env:YAYA_DEPLOY_KEY  = "$env:USERPROFILE\.ssh\xxx.pem"  # SSH 私钥路径
# 首次连接请先 `ssh-keyscan <host> >> $HOME/.ssh/known_hosts` 录入指纹。

$ErrorActionPreference = 'Stop'

if (-not $env:YAYA_DEPLOY_HOST) { throw 'YAYA_DEPLOY_HOST not set (e.g. root@1.2.3.4)' }
if (-not $env:YAYA_DEPLOY_KEY)  { throw 'YAYA_DEPLOY_KEY not set (path to SSH private key)' }
if (-not $env:YAYA_DEPLOY_PATH) { $env:YAYA_DEPLOY_PATH = '/var/www/yayanews' }

$key        = $env:YAYA_DEPLOY_KEY
$remoteHost = $env:YAYA_DEPLOY_HOST
$remoteRoot = $env:YAYA_DEPLOY_PATH
$server     = "${remoteHost}:${remoteRoot}"

# accept-new 只在 known_hosts 缺失时接受新指纹，避免 MITM
$sshOpts = @('-o', 'StrictHostKeyChecking=accept-new', '-i', $key)

function Copy-Remote {
    param([string]$LocalPath, [string]$RemoteSubPath)
    & scp @sshOpts $LocalPath "${server}/${RemoteSubPath}"
    if ($LASTEXITCODE -ne 0) { throw "scp failed: $LocalPath -> $RemoteSubPath" }
}

function Invoke-Remote {
    param([string]$Cmd)
    & ssh @sshOpts $remoteHost $Cmd
    if ($LASTEXITCODE -ne 0) { throw "ssh failed: $Cmd" }
}

Copy-Remote "apps/web/src/dictionaries/zh.json"                                  "apps/web/src/dictionaries/"
Copy-Remote "apps/web/src/components/editorial/BreakingStreamBlock.tsx"          "apps/web/src/components/editorial/"
Copy-Remote "apps/web/src/components/ArticleCard.tsx"                            "apps/web/src/components/"
Copy-Remote "apps/web/src/lib/article-image.ts"                                  "apps/web/src/lib/"
Copy-Remote "apps/web/src/lib/queries.ts"                                        "apps/web/src/lib/"
Copy-Remote "apps/web/public/images/article-placeholder-en.svg"                  "apps/web/public/images/"
Copy-Remote "apps/web/public/db1162aa32014bba89ab29ba04a5ddba.txt"               "apps/web/public/"

Invoke-Remote "mkdir -p ${remoteRoot}/apps/web/src/app/api/webhooks/indexing ${remoteRoot}/apps/web/src/app/feed-news.xml"

Copy-Remote "apps/web/src/app/api/webhooks/indexing/route.ts" "apps/web/src/app/api/webhooks/indexing/"
Copy-Remote "apps/web/src/app/sitemap-news.xml/route.ts"      "apps/web/src/app/sitemap-news.xml/"
Copy-Remote "apps/web/src/app/feed-news.xml/route.ts"         "apps/web/src/app/feed-news.xml/"
Copy-Remote "apps/web/src/app/robots.ts"                       "apps/web/src/app/"
Copy-Remote "apps/pipeline/pipeline/utils/indexer.py"          "apps/pipeline/pipeline/utils/"
Copy-Remote "apps/pipeline/pipeline/utils/database.py"         "apps/pipeline/pipeline/utils/"
Copy-Remote "infra/scripts/push-all-to-google.ts"              "infra/scripts/"

Invoke-Remote "cd ${remoteRoot} && npm ci && npm run build --workspace=@yayanews/web && node infra/scripts/copy-standalone.mjs && pm2 reload yayanews && pm2 restart yaya-pipeline-daemon yaya-worker-flash yaya-worker-articles"
