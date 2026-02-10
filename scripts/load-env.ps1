# Load azd environment variables for local development
# Usage: ./scripts/load-env.ps1

Write-Host "Loading azd environment variables..." -ForegroundColor Cyan

$envValues = azd env get-values 2>$null
if (-not $envValues) {
    Write-Warning "No azd environment found. Run 'azd env new <name>' first."
    exit 1
}

foreach ($line in $envValues -split "`n") {
    $line = $line.Trim()
    if ($line -and -not $line.StartsWith('#')) {
        # Parse KEY="VALUE" or KEY=VALUE
        if ($line -match '^([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
            $key = $matches[1]
            $value = $matches[2].Trim('"')
            [Environment]::SetEnvironmentVariable($key, $value, 'Process')
            Write-Host "  $key = $($value.Substring(0, [Math]::Min(40, $value.Length)))$(if ($value.Length -gt 40) { '...' })"
        }
    }
}

Write-Host ""
Write-Host "Environment loaded. You can now run the API locally with SESSION_STRATEGY=azure." -ForegroundColor Green
