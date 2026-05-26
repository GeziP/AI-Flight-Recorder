# AIFR Install Script (Windows)
# Run: irm https://raw.githubusercontent.com/GeziP/aifr/main/scripts/install.ps1 | iex

$ErrorActionPreference = "Stop"

Write-Host "AIFR - AI Flight Recorder Installer" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan

# Check Node.js
$nodeVersion = $null
try {
    $nodeVersion = (node --version 2>$null)
} catch {}

if (-not $nodeVersion) {
    Write-Host "Error: Node.js is required but not installed." -ForegroundColor Red
    Write-Host "Install from https://nodejs.org/ (v20 or later)" -ForegroundColor Yellow
    exit 1
}

$majorVersion = [int]($nodeVersion -replace 'v(\d+).*', '$1')
if ($majorVersion -lt 20) {
    Write-Host "Error: Node.js v20+ required, found $nodeVersion" -ForegroundColor Red
    exit 1
}

Write-Host "[OK] Node.js $nodeVersion" -ForegroundColor Green

# Check pnpm
$pnpmVersion = $null
try {
    $pnpmVersion = (pnpm --version 2>$null)
} catch {}

if (-not $pnpmVersion) {
    Write-Host "Installing pnpm..." -ForegroundColor Yellow
    npm install -g pnpm
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error: Failed to install pnpm" -ForegroundColor Red
        exit 1
    }
    $pnpmVersion = (pnpm --version)
}

Write-Host "[OK] pnpm $pnpmVersion" -ForegroundColor Green

# Clone if not already in repo
if (-not (Test-Path "package.json")) {
    Write-Host "Cloning AIFR repository..." -ForegroundColor Yellow
    git clone https://github.com/GeziP/aifr.git
    Set-Location aifr
}

# Install dependencies
Write-Host "Installing dependencies..." -ForegroundColor Yellow
pnpm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Failed to install dependencies" -ForegroundColor Red
    exit 1
}

# Build
Write-Host "Building packages..." -ForegroundColor Yellow
pnpm build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Build failed" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "AIFR installed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Quick start:" -ForegroundColor Cyan
Write-Host "  pnpm aifr init          # Initialize in a project" -ForegroundColor White
Write-Host "  pnpm aifr start         # Start recording" -ForegroundColor White
Write-Host "  pnpm aifr import claude # Import Claude sessions" -ForegroundColor White
Write-Host "  cd apps/web && pnpm dev # Start web UI" -ForegroundColor White
