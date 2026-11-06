# TradeX AI — DuckDNS Configuration for Windows PowerShell
$Region = "ap-south-1"

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "TradeX AI — DuckDNS Configuration (AWS SSM SecureString)" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "Secrets typed here are hidden and stored directly in AWS SSM Parameter Store.`n"

$Subdomain = Read-Host "Enter DuckDNS Subdomain (e.g., mytradex for mytradex.duckdns.org)"
$Subdomain = $Subdomain -replace "\.duckdns\.org$", ""

$TokenSecure = Read-Host "Enter DuckDNS Token (hidden)" -AsSecureString
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($TokenSecure)
$Token = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)

if ([string]::IsNullOrWhiteSpace($Subdomain) -or [string]::IsNullOrWhiteSpace($Token)) {
    Write-Host "ERROR: Subdomain and token cannot be empty." -ForegroundColor Red
    exit 1
}

Write-Host "Storing parameters in AWS SSM via WSL AWS CLI..." -ForegroundColor Yellow
$CmdSub = "wsl -e /home/devcontainers/.local/bin/aws ssm put-parameter --name '/tradex/prod/duckdns_subdomain' --value '$Subdomain' --type 'String' --overwrite --region '$Region' --no-cli-pager"
$CmdTok = "wsl -e /home/devcontainers/.local/bin/aws ssm put-parameter --name '/tradex/prod/duckdns_token' --value '$Token' --type 'SecureString' --overwrite --region '$Region' --no-cli-pager"

Invoke-Expression $CmdSub
Invoke-Expression $CmdTok

Write-Host "`n==> DuckDNS configuration successfully stored in AWS SSM!" -ForegroundColor Green
Write-Host "    Domain: https://$Subdomain.duckdns.org`n" -ForegroundColor Green
