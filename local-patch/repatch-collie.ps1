# repatch-collie.ps1 — rebuild official Collie with the local wav-16k patch and deploy it.
#
# Run this AFTER every official `collie update` (the update replaces the binary with the
# stock one, which drops the `input: wav-16k` feature and breaks phone dictation to
# whisper-cli). From any PowerShell:
#
#   powershell -ExecutionPolicy Bypass -File E:\herdr\collie-src\local-patch\repatch-collie.ps1
#   powershell -File ... -Tag v1.27.0        # pin a version; default = latest release
#
# What it does: fetch the tag -> branch `local-<ver>` -> git am the two patch files ->
# bun build -> swap versions\<ver>\bin\collie.exe (official kept as .stock) -> restart task ->
# verify with `collie stt test`. If `git am` fails, upstream changed the stt code: stop,
# re-make the patches against the new tag (cherry-pick the commits from branch `local-wav-16k`
# on the fork https://github.com/iamnsd/collie), commit new patch files here, re-run.

param([string]$Tag)
$ErrorActionPreference = 'Stop'
$repo    = 'E:\herdr\collie-src'
$install = Join-Path $env:LOCALAPPDATA 'collie'
$task    = 'herdr.collie'
$env:Path = "C:\Program Files\Git\bin;C:\Program Files\GitHub CLI;$env:USERPROFILE\.bun\bin;$install\current\bin;C:\Program Files\Tailscale;$env:Path"

Set-Location $repo

if (-not $Tag) {
  $Tag = (gh api repos/AltanS/collie/releases/latest | ConvertFrom-Json).tag_name
}
$ver = $Tag.TrimStart('v')
"target release: $Tag (version $ver)"

# 1. official version must already be installed (run `collie update` first)
$officialBin = Join-Path $install "versions\$ver\bin\collie.exe"
if (-not (Test-Path $officialBin)) {
  throw "official $ver is not installed under $install\versions. Run 'collie update' first, then re-run this script."
}

# 2. branch for this version: create + apply patches, or reuse an existing one
git fetch --depth 1 origin "refs/tags/$Tag"
git checkout -B "local-$ver" FETCH_HEAD
$patches = @((Get-ChildItem (Join-Path $repo 'local-patch\*.patch')).FullName)
git am --abort 2>$null | Out-Null
git am $patches
"patches applied: $($patches.Count)"

# 3. build
bun install
bun run build
if ($LASTEXITCODE -ne 0) { throw 'build failed' }

# 4. swap the binary (keep the official one as .stock for rollback)
if (-not (Test-Path "$officialBin.stock")) { Copy-Item $officialBin "$officialBin.stock" }
Get-Process collie -ErrorAction SilentlyContinue | Stop-Process -Force
schtasks /End /TN $task 2>$null | Out-Null
Start-Sleep -Seconds 3
Copy-Item (Join-Path $repo 'bin\collie.exe') $officialBin -Force
schtasks /Run /TN $task | Out-Null
Start-Sleep -Seconds 15

# 5. verify the feature is back
collie version
$out = collie stt test 2>&1 | Out-String
if ($out -match 'webm and mp4 are skipped') {
  'REPATCH-OK: phones convert to WAV — dictation feature is live'
} else {
  throw 'stt test did not report the wav-16k note — check collie stt status / .env'
}
