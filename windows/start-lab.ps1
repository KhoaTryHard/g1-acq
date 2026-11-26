param([int]$Port = 18080, [string]$ListenHost = '127.0.0.1')
$ErrorActionPreference = 'Stop'
if ($Port -lt 1024 -or $Port -gt 65535) { throw 'Port must be between 1024 and 65535.' }
$taskListenIp = $null
if (-not [Net.IPAddress]::TryParse($ListenHost, [ref]$taskListenIp)) { throw 'ListenHost must be an IP address.' }
$taskRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $taskRoot
$taskCertificateDir = Join-Path $taskRoot '.git\g1-windows-certificates'
New-Item -ItemType Directory -Path $taskCertificateDir -Force | Out-Null
Write-Output "G1 Windows proxy: ${ListenHost}:$Port"
Write-Output 'iPhone setup: open http://mitm.it after configuring the Wi-Fi proxy.'
& uvx --from 'mitmproxy==12.2.3' mitmdump --listen-host $ListenHost --listen-port $Port `
    --set "confdir=$taskCertificateDir" --set 'allow_hosts=^one\.google\.com(:443)?$' `
    --set 'flow_detail=0' --set 'termlog_verbosity=warn' -s (Join-Path $PSScriptRoot 'mitmproxy_addon.py')
exit $LASTEXITCODE
