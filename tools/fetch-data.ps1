# Stella Sora - fetch ss-data (character / disc / potential)
$ErrorActionPreference = "SilentlyContinue"
$ProgressPreference = "SilentlyContinue"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$out = Join-Path $scriptDir "ss-data"
$base = "https://raw.githubusercontent.com/AutumnVN/ss-data/refs/heads/main"

$files = @(
  "character.json",
  "disc.json",
  "CN/bin/CharPotential.json",
  "CN/bin/Potential.json",
  "CN/language/zh_CN/Character.json",
  "CN/language/zh_CN/Potential.json"
)

foreach ($f in $files) {
  $dst = Join-Path $out ($f -replace "/", "\")
  $dir = Split-Path $dst -Parent
  if (!(Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  Write-Host ("  " + $f)
  Invoke-WebRequest -Uri ($base + "/" + $f) -OutFile $dst -TimeoutSec 60 -UseBasicParsing
}
Write-Host ""
$n = (Get-ChildItem -Path $out -Recurse -File).Count
Write-Host ("DONE. " + $n + " files -> " + $out)
