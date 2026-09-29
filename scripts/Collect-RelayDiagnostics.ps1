<#
.SYNOPSIS
Read-only Windows diagnostics for the Relay portfolio demo.
.DESCRIPTION
Writes a local JSON report for manual import. Does not upload, change settings,
install software, collect credentials, or include user/device names or IP addresses.
Optional TargetHost performs a TCP connectivity check, not a remote login.
.EXAMPLE
.\Collect-RelayDiagnostics.ps1 -OutputPath .\relay-diagnostics.json
.EXAMPLE
.\Collect-RelayDiagnostics.ps1 -TargetHost desktop.example.com -Port 3389
#>
[CmdletBinding()]
param(
    [string]$OutputPath = (Join-Path (Get-Location) 'relay-diagnostics.json'),
    [ValidatePattern('^[A-Za-z0-9.-]+$')][string]$DnsName = 'example.com',
    [ValidatePattern('^[A-Za-z0-9.-]*$')][string]$TargetHost = '',
    [ValidateRange(1,65535)][int]$Port = 3389
)
$ErrorActionPreference = 'Stop'
if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) { throw 'This collector supports Windows only.' }
$relayChecks = [System.Collections.Generic.List[object]]::new()
function Add-RelayCheck([string]$Name, [string]$Status, [string]$Value, [string]$Detail) {
    $relayChecks.Add([ordered]@{ name = $Name; status = $Status; value = $Value; detail = $Detail })
}
try {
    $relayOs = Get-CimInstance Win32_OperatingSystem -OperationTimeoutSec 5
    Add-RelayCheck 'Operating system' 'pass' $relayOs.Caption ('Build ' + $relayOs.BuildNumber + '. Version observed; patch compliance was not assessed.')
    $relayFreeMemory = [math]::Round(100 * $relayOs.FreePhysicalMemory / $relayOs.TotalVisibleMemorySize, 1)
    $relayMemoryStatus = if ($relayFreeMemory -lt 10) { 'warn' } else { 'pass' }
    Add-RelayCheck 'Available memory' $relayMemoryStatus ($relayFreeMemory.ToString() + '% free') 'A point-in-time reading. Low memory may contribute to slowness; it does not establish a root cause.'
} catch { Add-RelayCheck 'Operating system and memory' 'unknown' 'Unavailable' 'The operating-system query failed or was not permitted.' }
try {
    $relayDisk = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='$env:SystemDrive'" -OperationTimeoutSec 5
    if (!$relayDisk -or !$relayDisk.Size) { throw 'Unavailable disk.' }
    $relayDiskPercent = [math]::Round(100 * $relayDisk.FreeSpace / $relayDisk.Size, 1)
    $relayDiskStatus = if ($relayDiskPercent -lt 10) { 'warn' } else { 'pass' }
    Add-RelayCheck 'System disk space' $relayDiskStatus ($relayDiskPercent.ToString() + '% free') 'Less than 10% free is flagged for review. No files were read or removed.'
} catch { Add-RelayCheck 'System disk space' 'unknown' 'Unavailable' 'The disk query failed or was not permitted.' }
try {
    $relayActiveAdapters = @(Get-NetAdapter -ErrorAction Stop | Where-Object Status -eq 'Up')
    $relayAdapterStatus = if ($relayActiveAdapters.Count -gt 0) { 'pass' } else { 'warn' }
    Add-RelayCheck 'Network adapter' $relayAdapterStatus ($relayActiveAdapters.Count.ToString() + ' active') 'Active adapters do not prove internet or VPN connectivity. Names, MAC addresses and IP addresses are omitted.'
} catch { Add-RelayCheck 'Network adapter' 'unknown' 'Unavailable' 'The adapter query failed or was not permitted.' }
try {
    $relayDnsTask = [System.Net.Dns]::GetHostAddressesAsync($DnsName)
    if (!$relayDnsTask.Wait(4000)) { throw 'DNS timeout.' }
    if ($relayDnsTask.Result.Count -eq 0) { throw 'No answer.' }
    Add-RelayCheck 'DNS resolution' 'pass' 'Resolved' ('A lookup for ' + $DnsName + ' returned an address. Returned addresses are omitted.')
} catch { Add-RelayCheck 'DNS resolution' 'warn' 'Lookup did not complete' 'The lookup failed or exceeded four seconds. This could reflect connectivity, DNS policy, or the test name.' }
if ($TargetHost) {
    $relayTcp = [System.Net.Sockets.TcpClient]::new()
    try {
        $relayConnect = $relayTcp.ConnectAsync($TargetHost,$Port)
        if (!$relayConnect.Wait(4000) -or !$relayTcp.Connected) { throw 'TCP connection did not complete.' }
        Add-RelayCheck 'Configured endpoint' 'pass' ('TCP port ' + $Port + ' reachable') 'A TCP connection succeeded. Authentication and application health were not tested. Target name is omitted.'
    } catch { Add-RelayCheck 'Configured endpoint' 'warn' ('TCP port ' + $Port + ' unreachable') 'Connection failed or timed out. Check endpoint availability, routing and firewall policy before inferring a cause.' }
    finally { $relayTcp.Dispose() }
} else { Add-RelayCheck 'Configured endpoint' 'unknown' 'Not requested' 'Supply -TargetHost and optionally -Port to test a specific remote endpoint.' }
$relayWarnings = @($relayChecks | Where-Object { $_.status -in @('warn','fail') }).Count
$relayReport = [ordered]@{
    schemaVersion = 1
    collectedAt = [DateTime]::UtcNow.ToString('o')
    platform = 'Windows'
    checks = @($relayChecks.ToArray())
    summary = "$relayWarnings check(s) need review. Read-only observations; no remediation was performed."
}
$relayFullPath = [System.IO.Path]::GetFullPath($OutputPath)
$relayParent = [System.IO.Path]::GetDirectoryName($relayFullPath)
if (!(Test-Path -LiteralPath $relayParent -PathType Container)) { throw 'Output directory does not exist. Create it or choose an existing directory.' }
$relayReport | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $relayFullPath -Encoding UTF8
Write-Output "Saved local diagnostic report: $relayFullPath"
Write-Output 'Review the JSON, then import it in Relay. Nothing was uploaded.'
