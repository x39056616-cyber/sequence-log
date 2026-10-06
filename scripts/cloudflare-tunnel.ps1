param(
  [int]$Port = 3000,
  [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = 'Stop'
$cf = Get-Command cloudflared -ErrorAction SilentlyContinue
if (-not $cf) {
  Write-Host 'cloudflared was not found.' -ForegroundColor Red
  Write-Host 'Install it from: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/' -ForegroundColor Yellow
  exit 1
}

$urlFile = Join-Path $ProjectRoot 'cloudflare-url.txt'
Write-Host "Starting Cloudflare quick tunnel for http://127.0.0.1:$Port ..." -ForegroundColor Yellow
& $cf.Source tunnel --url ("http://127.0.0.1:" + $Port) --no-autoupdate --protocol http2 2>&1 | Tee-Object -FilePath $urlFile