param([Parameter(Mandatory=$true)][string]$ConfigPath,[switch]$NoErrorDialog)
$ErrorActionPreference='Stop'
$job=Split-Path -Parent $ConfigPath
$config=Get-Content -LiteralPath $ConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
$backup=$config.target+'.previous-'+$config.id
$replaced=$false
$launched=$null
function Get-Sha256([string]$file) {
 $stream=[IO.File]::OpenRead($file);$hash=[Security.Cryptography.SHA256]::Create()
 try{([BitConverter]::ToString($hash.ComputeHash($stream))).Replace('-','').ToLower()}finally{$stream.Dispose();$hash.Dispose()}
}
function Save-Result($status,$message) {
 @{status=$status;message=$message;time=[DateTime]::UtcNow.ToString('o')} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $job 'result.json') -Encoding UTF8
}
function Write-Stage([string]$message) {
 Add-Content -LiteralPath (Join-Path $job 'stages.log') -Value (([DateTime]::UtcNow.ToString('o'))+' '+$message) -Encoding UTF8
}
function Launch-App($updated) {
 # These are data arguments, never interpolated into executable shell code.
 $arguments='--user-data-dir="'+$config.userData.TrimEnd('\')+'"'
 if($updated){$arguments+=' --locallink-update-id='+$config.id}
 Start-Process -FilePath $config.target -ArgumentList $arguments -WorkingDirectory (Split-Path -Parent $config.target) -PassThru
}
try {
 if($config.id -notmatch '^[a-f0-9-]{36}$' -or $config.sha256 -notmatch '^[a-f0-9]{64}$'){throw 'Invalid update configuration'}
 if((Get-Sha256 $config.source) -ne $config.sha256){throw 'Update checksum mismatch'}
 Write-Stage 'Verified package; waiting for the running app to exit'
 Set-Content -LiteralPath (Join-Path $job 'helper-ready') -Value '1'
 $deadline=[DateTime]::UtcNow.AddSeconds(120)
 while(Get-Process -Id $config.pid -ErrorAction SilentlyContinue){
  if((Test-Path -LiteralPath (Join-Path $job 'cancel')) -or [DateTime]::UtcNow -gt $deadline){throw 'Original application did not exit'}
  Start-Sleep -Milliseconds 200
 }
 if(Test-Path -LiteralPath (Join-Path $job 'cancel')){throw 'Update cancelled'}
 if((Get-Sha256 $config.source) -ne $config.sha256){throw 'Update checksum mismatch'}
 if($config.portable){
  if((Get-Sha256 $config.target) -ne $config.oldHash){throw 'Original executable changed'}
  $deadline=[DateTime]::UtcNow.AddSeconds(30)
  do {
   try{[IO.File]::Replace($config.source,$config.target,$backup,$true);$replaced=$true;break}
   catch{if([DateTime]::UtcNow -gt $deadline){throw};Start-Sleep -Milliseconds 300}
  }while($true)
 }else{
  # NSIS /D must be last and unquoted, including paths with spaces.
  Write-Stage ('Starting installer for '+$config.target)
  $installer=Start-Process -FilePath $config.source -ArgumentList ('/S /D='+(Split-Path -Parent $config.target)) -WindowStyle Hidden -PassThru -Wait
  Write-Stage ('Installer exit code '+$installer.ExitCode)
  if($installer.ExitCode -ne 0){throw ('Installer exit code '+$installer.ExitCode)}
  $actual=[Diagnostics.FileVersionInfo]::GetVersionInfo($config.target).ProductVersion
  Write-Stage ('Installed product version: '+$actual+'; expected '+$config.version)
  if($config.version -match '^\d+\.\d+\.\d+$' -and $actual -ne $config.version -and $actual -ne ($config.version+'.0')){
   throw ('Expected LocalLink '+$config.version+' but found '+$actual+'. Run the downloaded Setup to finish the update.')
  }
 }
 Write-Stage 'Starting application and waiting for version confirmation'
 $launched=Launch-App $true
 $deadline=[DateTime]::UtcNow.AddSeconds($config.readyTimeout)
 while(!(Test-Path -LiteralPath (Join-Path $job 'app-ready'))){
  if([DateTime]::UtcNow -gt $deadline){throw 'Updated application did not become ready'}
  Start-Sleep -Milliseconds 250
 }
 Save-Result 'updated' 'Application restarted successfully'
 # Keep the previous portable binary for manual recovery, even after success.
 if(!$config.portable){Remove-Item -LiteralPath $config.source -Force}
}catch{
 $failure=$_.Exception.Message
 if($launched){try{& taskkill.exe /PID $launched.Id /T /F 2>$null | Out-Null}catch{}}
 if($replaced -and (Test-Path -LiteralPath $backup)){
  try{
   $deadline=[DateTime]::UtcNow.AddSeconds(30)
   do{try{[IO.File]::Replace($backup,$config.target,($config.target+'.failed-'+$config.id),$true);break}catch{if([DateTime]::UtcNow -gt $deadline){throw};Start-Sleep -Milliseconds 300}}while($true)
   Launch-App $false | Out-Null
   Save-Result 'rolled-back' $failure
  }catch{Save-Result 'failed' ($failure+'; rollback: '+$_.Exception.Message)}
 }else{Save-Result 'failed' $failure}
 if(!$NoErrorDialog){try{Add-Type -AssemblyName PresentationFramework;[System.Windows.MessageBox]::Show(('LocalLink update failed. '+$failure+"`n"+$job),'LocalLink') | Out-Null}catch{}}
}
