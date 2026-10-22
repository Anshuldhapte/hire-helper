# Asks for your Gemini API key (hidden while you paste it) and saves it into .env.local.
# Run with:  npm run set-key
$envFile = Join-Path $PSScriptRoot "..\.env.local"
$secure = Read-Host "Paste your Gemini API key (it will show as ****) then press Enter" -AsSecureString
$key = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)).Trim()

if ($key.Length -lt 20 -or $key -match '\s') {
  Write-Host "That doesn't look like a full API key. Nothing was saved. Copy it again from aistudio.google.com/apikey and re-run." -ForegroundColor Yellow
  exit 1
}

$lines = @(
  "# Gemini API key from https://aistudio.google.com/apikey - this file is never committed.",
  "GEMINI_API_KEY=$key"
)
[IO.File]::WriteAllLines($envFile, $lines)  # writes without a hidden BOM character
Write-Host "Saved. Key length: $($key.Length) characters." -ForegroundColor Green
