[CmdletBinding()]
param([string]$Release = (Get-Date -Format 'yyyyMMdd-HHmmss'), [switch]$UploadOnly)
$ErrorActionPreference = 'Stop'
if ($Release -notmatch '^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$') { throw 'Invalid release tag.' }
$projectDirectory = Split-Path -Parent $PSScriptRoot
$sshHelper = 'C:\Users\Lenovo\.codex\skills\server-rumah-ssh\scripts\ssh.ps1'
$workDirectory = Join-Path $projectDirectory 'work'
New-Item -ItemType Directory -Path $workDirectory -Force | Out-Null
$archive = Join-Path $workDirectory "ngraos-$Release.tar.gz"
Push-Location $projectDirectory
try {
    # Include explicit source inputs. Never archive .env, recordings, node_modules or Git history.
    $inputs = @('Dockerfile','compose.yaml','package.json','package-lock.json','next.config.ts','next-env.d.ts','tsconfig.json','postcss.config.mjs','src','scripts','.dockerignore','.env.example')
    if (Test-Path -LiteralPath 'public') { $inputs += 'public' }
    if (Test-Path -LiteralPath 'docs') { $inputs += 'docs' }
    & tar -czf $archive @inputs
    if ($LASTEXITCODE -ne 0) { throw 'Source archive failed.' }
    & $sshHelper -Upload $archive -RemotePath "/home/kelana/ngraos-$Release.tar.gz"
    if ($LASTEXITCODE -ne 0) { throw 'Source upload failed.' }
    & $sshHelper -Sudo -Command "install -d -m 750 /opt/ngraos /opt/ngraos/releases; tar -xzf '/home/kelana/ngraos-$Release.tar.gz' -C /opt/ngraos; mv '/home/kelana/ngraos-$Release.tar.gz' '/opt/ngraos/releases/ngraos-$Release.tar.gz'; chmod 600 '/opt/ngraos/releases/ngraos-$Release.tar.gz'"
    if ($LASTEXITCODE -ne 0) { throw 'Source extraction failed.' }
    if (-not $UploadOnly) {
        & $sshHelper -Sudo -Command "cd /opt/ngraos && bash scripts/deploy.sh '$Release'" -TimeoutSeconds 1800
        if ($LASTEXITCODE -ne 0) { throw 'Deployment failed. Inspect dedicated Ngraos stack; prior database backups are retained.' }
    }
} finally { Pop-Location }
