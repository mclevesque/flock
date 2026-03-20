# Kill any running Flock instances
Get-Process | Where-Object { $_.Name -like "*flock*" -or $_.Name -like "*electron*" } | Stop-Process -Force -ErrorAction SilentlyContinue

Start-Sleep -Seconds 2

# Force remove dist folder
$distPath = "C:\Users\Thehu\flock\electron\dist"
if (Test-Path $distPath) {
    try {
        Remove-Item -Recurse -Force $distPath -ErrorAction Stop
        Write-Host "Dist folder deleted successfully"
    } catch {
        Write-Host "Could not delete dist folder: $_"
        Write-Host "Trying robocopy empty folder trick..."
        $emptyDir = "C:\Users\Thehu\flock\electron\dist_empty_tmp"
        New-Item -ItemType Directory -Path $emptyDir -Force | Out-Null
        robocopy $emptyDir $distPath /MIR /NFL /NDL /NJH /NJS | Out-Null
        Remove-Item $emptyDir -Force -ErrorAction SilentlyContinue
        Remove-Item $distPath -Force -ErrorAction SilentlyContinue
        Write-Host "Cleanup attempt complete"
    }
} else {
    Write-Host "No dist folder found, proceeding to build"
}

# Now build
Set-Location "C:\Users\Thehu\flock\electron"
Write-Host "Starting npm run dist:win..."
npm run dist:win
