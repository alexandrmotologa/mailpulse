# MailPulse Build Script
Write-Host "==> Building React 19 Frontend..."
Set-Location "$PSScriptRoot\..\web"
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Error "Frontend build failed"
    exit 1
}

Write-Host "==> Syncing embedded web assets..."
Set-Location "$PSScriptRoot\.."
if (Test-Path "internal\server\web_dist") {
    Remove-Item -Recurse -Force "internal\server\web_dist"
}
Copy-Item -Recurse -Force "web\dist" "internal\server\web_dist"

Write-Host "==> Compiling MailPulse binary..."
go build -ldflags "-s -w" -o mailpulse.exe cmd/mailpulse/main.go
if ($LASTEXITCODE -ne 0) {
    Write-Error "Go compilation failed"
    exit 1
}

Write-Host "==> Build successful: mailpulse.exe"
