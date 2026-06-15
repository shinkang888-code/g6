# Railway + Vercel 프로덕션 연동 (PowerShell)
# 사용법 (bot/ 디렉터리):
#   1) railway login          # 또는 railway login --browserless
#   2) .\scripts\deploy-railway.ps1
#
# Railway 프로젝트 생성 → 워커 배포 → Vercel env 설정 → Vercel 재배포

$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
Set-Location $Root

# bot/.env → 환경변수 (RAILWAY_TOKEN, BOT_API_TOKEN 등)
$envFile = Join-Path $Root ".env"
if (Test-Path $envFile) {
  Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*#' -or $_ -match '^\s*$') { return }
    if ($_ -match '^\s*([^=]+)=(.*)$') {
      $name = $matches[1].Trim()
      $val = $matches[2].Trim()
      if ($name -and $val) { Set-Item -Path "env:$name" -Value $val }
    }
  }
}

if (-not $env:RAILWAY_TOKEN -and -not $env:RAILWAY_API_TOKEN) {
  Write-Host "Railway 토큰이 없습니다."
  Write-Host "  Account token (권장, railway init/up): bot/.env → RAILWAY_API_TOKEN=<Account Settings > Tokens>"
  Write-Host "  Project token (프로젝트 연결 후):      bot/.env → RAILWAY_TOKEN=<Project Settings > Tokens>"
  exit 1
}

# Account token 우선 (신규 프로젝트 생성·배포). Project token 만 있으면 RAILWAY_TOKEN 사용.
if ($env:RAILWAY_API_TOKEN) {
  Remove-Item Env:RAILWAY_TOKEN -ErrorAction SilentlyContinue
} elseif ($env:RAILWAY_TOKEN -and -not $env:RAILWAY_API_TOKEN) {
  Remove-Item Env:RAILWAY_API_TOKEN -ErrorAction SilentlyContinue
}

$BotToken = if ($env:BOT_API_TOKEN) { $env:BOT_API_TOKEN } else {
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
}
Write-Host "BOT_API_TOKEN (Vercel SCOURT_BOT_TOKEN 과 동일): $BotToken"

# Railway 토큰 인증 확인
$who = railway whoami 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Host "Railway 인증 실패: $who"
  Write-Host "RAILWAY_TOKEN 값을 확인하세요."
  exit 1
}
Write-Host "Railway: $who"

# 프로젝트 연결 (없으면 생성)
if (-not (Test-Path ".railway")) {
  railway init --name lawygo-bot
}

# Railway 환경변수
$vars = @{
  BOT_API_TOKEN = $BotToken
  HEADLESS = "true"
  OCR_PROVIDER = "ddddocr"
  DDDDOCR_URL = "http://127.0.0.1:8000"
  DDDDOCR_CHARSETS = "0123456789"
  BOT_CONCURRENCY = "1"
  CAPTCHA_MAX_RETRY = "6"
}
foreach ($k in $vars.Keys) {
  $v = $vars[$k]
  railway variables set "$k=$v" 2>&1 | Out-Null
  Write-Host "  railway set $k"
}

Write-Host "Deploying to Railway..."
railway up --detach

Write-Host "Generating public domain..."
railway domain 2>&1
$domain = (railway domain 2>&1 | Select-String -Pattern 'https?://[^\s]+' | Select-Object -First 1)
if (-not $domain) {
  Write-Host "도메인 생성: railway domain"
  Write-Host "생성 후 SCOURT_BOT_URL=https://<your>.up.railway.app 를 Vercel에 설정하세요."
  exit 0
}

$BotUrl = $domain.Matches[0].Value.TrimEnd('/')
Write-Host "Bot URL: $BotUrl"

# Vercel env (루트에서)
Set-Location (Split-Path $Root -Parent)
npx vercel env add SCOURT_BOT_URL production --value $BotUrl --force --yes 2>&1
npx vercel env add SCOURT_BOT_TOKEN production --value $BotToken --force --yes --sensitive 2>&1
Write-Host "Vercel env 설정 완료. 재배포 중..."
npx vercel deploy --prod --yes

Write-Host "`n완료!"
Write-Host "  SCOURT_BOT_URL=$BotUrl"
Write-Host "  SCOURT_BOT_TOKEN=$BotToken"
Write-Host "  https://lawygo.vercel.app/cases/scourt-search"
