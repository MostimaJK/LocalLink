# Build a LocalLink debug APK with the Android SDK and JDK 21 installed.
$ErrorActionPreference = 'Stop'
Push-Location -LiteralPath $PSScriptRoot
try {
    if (-not $env:JAVA_HOME -and -not (Get-Command java -ErrorAction SilentlyContinue)) {
        throw 'Android builds require JDK 21. Set JAVA_HOME or add java to PATH.'
    }

    npm.cmd run cap:sync
    if ($LASTEXITCODE -ne 0) { throw "Capacitor sync failed ($LASTEXITCODE)." }

    & .\android\gradlew.bat -p android assembleDebug
    if ($LASTEXITCODE -ne 0) { throw "Gradle assembleDebug failed ($LASTEXITCODE)." }

    $apk = Get-Item -LiteralPath 'android/app/build/outputs/apk/debug/app-debug.apk'
    Write-Host "APK ready: $($apk.FullName)"
} finally {
    Pop-Location
}
