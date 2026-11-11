# DoloGram Account Creation Script
# This script creates 5 public test accounts in the DoloGram Supabase project

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "DoloGram Account Creation Script" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Check if SUPABASE_SERVICE_ROLE_KEY is set
if (-not $env:SUPABASE_SERVICE_ROLE_KEY) {
    Write-Host "ERROR: SUPABASE_SERVICE_ROLE_KEY environment variable is not set." -ForegroundColor Red
    Write-Host ""
    Write-Host "To get your service role key:" -ForegroundColor Yellow
    Write-Host "1. Open: https://supabase.com/dashboard/project/jsyqtfsidtfahytcwutp/settings/api" -ForegroundColor Yellow
    Write-Host "2. Copy the 'service_role' key (this is a secret - do not share it!)" -ForegroundColor Yellow
    Write-Host "3. Set it in PowerShell:" -ForegroundColor Yellow
    Write-Host '   $env:SUPABASE_SERVICE_ROLE_KEY="your-service-role-key-here"' -ForegroundColor Green
    Write-Host ""
    Write-Host "Then run this script again." -ForegroundColor Yellow
    exit 1
}

Write-Host "Supabase URL: https://jsyqtfsidtfahytcwutp.supabase.co" -ForegroundColor Gray
Write-Host "Service role key: [SET]" -ForegroundColor Gray
Write-Host ""

# Run the TypeScript account creation script
Write-Host "Running account creation script..." -ForegroundColor Cyan
npx tsx scripts/create-accounts.ts

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host "✓ Account creation completed successfully!" -ForegroundColor Green
    Write-Host "============================================================" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Red
    Write-Host "✗ Account creation failed. Check the errors above." -ForegroundColor Red
    Write-Host "============================================================" -ForegroundColor Red
    exit 1
}
