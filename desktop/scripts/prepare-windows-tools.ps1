$ErrorActionPreference = 'Stop'
$toolRoot = Join-Path $PSScriptRoot '../dist/build-tools'
New-Item -ItemType Directory -Force $toolRoot | Out-Null
$artifacts = @(
    @{ Release='nsis@1.2.1'; File='nsis-bundle-3.12.tar.gz'; Hash='56997fdefe25e7928a1a68b4583d08b240b66cf660234053b20131a74cc082f4' },
    @{ Release='7zip@1.0.0'; File='7zip-win-x64.tar.gz'; Hash='be071f15bd6da2f78fe81c6ddef2009b0c4d8a51f36b780cb806c7e6df95e1b3' }
)
foreach ($artifact in $artifacts) {
    $archive = Join-Path $toolRoot $artifact.File
    Invoke-WebRequest -Uri ('https://github.com/electron-userland/electron-builder-binaries/releases/download/' + $artifact.Release + '/' + $artifact.File) -OutFile $archive -TimeoutSec 60
    if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash -ne $artifact.Hash) { throw "Checksum mismatch: $archive" }
    tar -xf $archive -C $toolRoot
    if ($LASTEXITCODE -ne 0) { throw "Extraction failed: $archive" }
}
Write-Host 'Verified Windows x64 installer tools are ready.'
