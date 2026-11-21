using System;
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;
public static class BluetoothRadio {
 [DllImport("bthprops.cpl")] static extern IntPtr BluetoothFindFirstRadio(ref int parameters, out SafeFileHandle radio);
 [DllImport("bthprops.cpl")] static extern bool BluetoothFindNextRadio(IntPtr search, out SafeFileHandle radio);
 [DllImport("bthprops.cpl")] static extern bool BluetoothFindRadioClose(IntPtr search);
 [DllImport("kernel32.dll")] static extern bool DeviceIoControl(SafeFileHandle radio, uint code, IntPtr input, int inputSize, [Out] byte[] output, int size, out int returned, IntPtr overlapped);
 public static int SingleRadioVersion() {
  int parameters=4, returned;
  SafeFileHandle radio;
  IntPtr search=BluetoothFindFirstRadio(ref parameters,out radio);
  if(search==IntPtr.Zero)return -1;
  try {
   using(radio){
    // Windows BTH_LOCAL_RADIO_INFO ends with BTH_RADIO_INFO.lmpVersion.
    byte[] info=new byte[292];
    if(!DeviceIoControl(radio,0x410000,IntPtr.Zero,0,info,info.Length,out returned,IntPtr.Zero)||returned!=info.Length)return -1;
    SafeFileHandle next;
    if(BluetoothFindNextRadio(search,out next)){next.Dispose();return -1;}
    return info[info.Length-1];
   }
  } finally {BluetoothFindRadioClose(search);}
 }
}
