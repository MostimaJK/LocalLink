'use strict';
const path=require('node:path');
const {execFile}=require('node:child_process');

// Publish both a standard Windows bitmap and a lossless PNG for paste targets.
const script=`
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Windows.Forms
$stream=New-Object IO.MemoryStream
[Console]::OpenStandardInput().CopyTo($stream)
$stream.Position=0
$bitmap=[Drawing.Bitmap]::FromStream($stream)
try {
  $sha=[Security.Cryptography.SHA256]::Create()
  try {
    $expected=[Convert]::ToBase64String($sha.ComputeHash($stream.ToArray()))
    foreach($delay in 80,160,320){
      $data=New-Object Windows.Forms.DataObject
      $data.SetImage($bitmap)
      $stream.Position=0
      $data.SetData('PNG',$false,$stream)
      [Windows.Forms.Clipboard]::SetDataObject($data,$true,6,60)
      Start-Sleep -Milliseconds $delay
      $copy=[Windows.Forms.Clipboard]::GetDataObject().GetData('PNG',$false)
      if($null -ne $copy -and [Convert]::ToBase64String($sha.ComputeHash($copy.ToArray())) -eq $expected){return}
    }
    throw 'Clipboard readback mismatch'
  } finally { $sha.Dispose() }
} finally { $bitmap.Dispose(); $stream.Dispose() }
`;

module.exports=function writeWindowsImage(png){
  return new Promise((resolve,reject)=>{
    const exe=path.join(process.env.SystemRoot,'System32','WindowsPowerShell','v1.0','powershell.exe');
    const child=execFile(exe,['-NoProfile','-NonInteractive','-STA','-Command',script],{windowsHide:true,timeout:15000},error=>error?reject(error):resolve());
    child.stdin.on('error',reject);
    child.stdin.end(png);
  });
};
