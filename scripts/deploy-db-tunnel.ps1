[CmdletBinding()]
param([ValidateRange(1024,65535)][int]$LocalPort = 55432)
$ErrorActionPreference = 'Stop'
$credentialDirectory = Join-Path $env:LOCALAPPDATA 'Codex\server-rumah-ssh'
$serverConfig = Get-Content -LiteralPath (Join-Path $credentialDirectory 'config.json') -Raw | ConvertFrom-Json
if ($serverConfig.hostname -ne '100.125.22.109') { throw 'Tunnel is restricted to the authorized home server.' }
$pythonSource = @'
import json, select, socketserver, sys
import paramiko
p = json.load(sys.stdin)
cfg = p['config']
client = paramiko.SSHClient()
client.load_host_keys(cfg['known_hosts'])
client.set_missing_host_key_policy(paramiko.RejectPolicy())
try:
    client.connect(cfg['hostname'], port=cfg['port'], username=cfg['username'], password=p['password'],
                   timeout=15, auth_timeout=15, banner_timeout=15, allow_agent=False, look_for_keys=False)
except Exception:
    print('SSH tunnel connection failed; host verification was not bypassed.', file=sys.stderr)
    sys.exit(1)
p['password'] = None
transport = client.get_transport()
transport.set_keepalive(30)
class Handler(socketserver.BaseRequestHandler):
    def handle(self):
        try:
            channel = transport.open_channel('direct-tcpip', ('127.0.0.1', 55432), self.request.getpeername())
        except Exception:
            print('Database tunnel destination is temporarily unavailable.', file=sys.stderr, flush=True)
            return
        try:
            while True:
                ready, _, _ = select.select([self.request, channel], [], [], 30)
                if not transport.is_active(): break
                for source in ready:
                    data = source.recv(65536)
                    if not data: return
                    (channel if source is self.request else self.request).sendall(data)
        finally:
            channel.close()
class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True
    request_queue_size = 128
try:
    with Server(('127.0.0.1', p['local_port']), Handler) as server:
        print('Ngraos database tunnel ready on 127.0.0.1:' + str(p['local_port']), flush=True)
        server.serve_forever()
finally:
    client.close()
'@
$serverSecure = $null
$serverPassword = $null
try {
    $serverSecure = ConvertTo-SecureString (Get-Content -LiteralPath (Join-Path $credentialDirectory 'password.dpapi') -Raw)
    $serverPassword = [Net.NetworkCredential]::new('', $serverSecure).Password
    @{config=$serverConfig; password=$serverPassword; local_port=$LocalPort} | ConvertTo-Json -Compress -Depth 5 | & $serverConfig.python -c $pythonSource
} finally {
    $serverSecure = $null
    $serverPassword = $null
}
