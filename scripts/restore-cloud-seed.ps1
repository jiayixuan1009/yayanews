# 使用仓库内「日期最新」的全量种子：始终与当前分支 HEAD 的 data/cloud_seed.sql 一致（比 packages/database 的 seed-data.mjs 全量、且 blob 更新于 2026-04-07）。
# 导入到 DATABASE_URL 指向的库（语句多为 ON CONFLICT DO NOTHING，可重复执行）。
# 用法（PowerShell）:
#   cd d:\news\yayanews-production
#   $env:DATABASE_URL = "postgresql://用户:密码@主机:5432/yayanews"
#   .\scripts\restore-cloud-seed.ps1
#
# 需本机已安装 psql 并在 PATH 中；数据库须已启动。

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
Push-Location $root
try {
  Write-Host "正在从 Git HEAD 检出 data/cloud_seed.sql（保证为已提交最新版）..."
  git checkout HEAD -- data/cloud_seed.sql
} finally {
  Pop-Location
}

if (-not $env:DATABASE_URL) { throw "请设置环境变量 DATABASE_URL" }

& psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f "$root\data\cloud_seed.sql"
if ($LASTEXITCODE -ne 0) { throw "psql 退出码 $LASTEXITCODE" }
Write-Host "完成: cloud_seed.sql 已导入。"
