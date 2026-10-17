using System.Globalization;
using System.Text.RegularExpressions;
using Windows.Devices.Bluetooth;
using Windows.Devices.Bluetooth.Rfcomm;
using Windows.Devices.Enumeration;
using Windows.Networking.Sockets;

// Same CLI/stdio boundary as macos/bt-bridge/main.swift. The existing JVM owns iAP2.
// Native API reference: https://learn.microsoft.com/en-us/windows/apps/develop/devices-sensors/send-or-receive-files-with-rfcomm
try
{
    using var startup = new CancellationTokenSource(TimeSpan.FromSeconds(40));
    if (args.Length == 1 && args[0] == "--print-address")
    {
        var adapter = await BluetoothAdapter.GetDefaultAsync().AsTask(startup.Token)
            ?? throw new IOException("No Bluetooth adapter is available");
        Console.WriteLine(FormatAddress(adapter.BluetoothAddress));
    }
    else if (args.Length == 1 && args[0] == "--list")
    {
        var paired = await DeviceInformation.FindAllAsync(
            BluetoothDevice.GetDeviceSelectorFromPairingState(true)).AsTask(startup.Token);
        foreach (var info in paired)
        {
            using var device = await BluetoothDevice.FromIdAsync(info.Id).AsTask(startup.Token);
            if (device is not null)
                Console.WriteLine($"{FormatAddress(device.BluetoothAddress)} {info.Name.Replace('\r', ' ').Replace('\n', ' ')}");
        }
    }
    else if (args.Length == 2 && args[0] == "--address")
    {
        if (!Regex.IsMatch(args[1], "^(?:[0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$"))
            throw new ArgumentException("Expected Bluetooth address AA:BB:CC:DD:EE:FF");
        ulong address = ulong.Parse(args[1].Replace(":", ""), NumberStyles.HexNumber);
        using var device = await BluetoothDevice.FromBluetoothAddressAsync(address).AsTask(startup.Token)
            ?? throw new IOException("The paired Bluetooth device is unavailable");
        if (!device.DeviceInformation.Pairing.IsPaired)
            throw new IOException("Pair the iPhone in Windows Bluetooth settings first");
        var id = RfcommServiceId.FromUuid(new Guid("00000000-deca-fade-deca-deafdecacafe"));
        var services = await device.GetRfcommServicesForIdAsync(id, BluetoothCacheMode.Uncached).AsTask(startup.Token);
        try
        {
            if (services.Error != BluetoothError.Success || services.Services.Count != 1)
                throw new IOException($"iAP2 service discovery failed: {services.Error}, count={services.Services.Count}");
            var service = services.Services[0];
            using var socket = new StreamSocket();
            await socket.ConnectAsync(service.ConnectionHostName, service.ConnectionServiceName,
                SocketProtectionLevel.BluetoothEncryptionAllowNullAuthentication).AsTask(startup.Token);
            Console.Error.WriteLine("bt-bridge: RFCOMM connected");
            await Relay(socket);
        }
        finally
        {
            foreach (var service in services.Services) service.Dispose();
        }
    }
    else
    {
        Console.Error.WriteLine("usage: bt-bridge --print-address | --list | --address AA:BB:CC:DD:EE:FF");
        return 2;
    }
    return 0;
}
catch (Exception error)
{
    // Never send diagnostics to stdout: in --address mode it is the binary iAP2 stream.
    Console.Error.WriteLine($"bt-bridge: {error.GetType().Name}: {error.Message}");
    return 1;
}

static string FormatAddress(ulong address)
{
    var hex = address.ToString("X12");
    return string.Join(":", Enumerable.Range(0, 6).Select(i => hex.Substring(i * 2, 2)));
}

static async Task Relay(StreamSocket socket)
{
    using var stop = new CancellationTokenSource();
    var input = socket.InputStream.AsStreamForRead();
    var output = socket.OutputStream.AsStreamForWrite();
    var incoming = Copy(input, Console.OpenStandardOutput(), stop.Token);
    var outgoing = Copy(Console.OpenStandardInput(), output, stop.Token);
    try
    {
        var first = await Task.WhenAny(incoming, outgoing);
        await first; // Report failures in the active stream, not expected shutdown cancellation.
    }
    finally
    {
        stop.Cancel();
        socket.Dispose(); // Unblock the Bluetooth read even if stdin is still open.
        try { await Task.WhenAll(incoming, outgoing).WaitAsync(TimeSpan.FromSeconds(2)); }
        catch (Exception) { /* Owned streams are closing; a pipe read may remain pending until exit. */ }
        try { output.Dispose(); } catch (ObjectDisposedException) { }
        try { input.Dispose(); } catch (ObjectDisposedException) { }
        Console.Error.WriteLine("bt-bridge: RFCOMM closed");
    }
}

static async Task Copy(Stream input, Stream output, CancellationToken token)
{
    var buffer = new byte[8192];
    int length;
    while ((length = await input.ReadAsync(buffer, token)) > 0)
    {
        await output.WriteAsync(buffer.AsMemory(0, length), token);
        await output.FlushAsync(token);
    }
}
