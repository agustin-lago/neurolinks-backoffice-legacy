[CmdletBinding()]
param(
    [string]$Email = "agustinlago098@gmail.com",
    [string]$KeyName = "github_signing_ed25519",
    [string]$OutputFile = (Join-Path ([Environment]::GetFolderPath('Desktop')) 'ssh key.txt')
)

$ErrorActionPreference = 'Stop'

function Assert-Command {
    param([string]$Name)

    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Required command not found: $Name"
    }
}

Assert-Command git
Assert-Command ssh-keygen

$sshDir = Join-Path $env:USERPROFILE '.ssh'
$keyPath = Join-Path $sshDir $KeyName
$publicKeyPath = "$keyPath.pub"
$allowedSignersPath = Join-Path $sshDir 'allowed_signers'

New-Item -ItemType Directory -Force -Path $sshDir | Out-Null

if (-not (Test-Path -LiteralPath $publicKeyPath)) {
    if (Test-Path -LiteralPath $keyPath) {
        throw "Private key exists but public key is missing: $publicKeyPath"
    }

    & ssh-keygen -t ed25519 -C $Email -f $keyPath
    if ($LASTEXITCODE -ne 0) {
        throw "ssh-keygen failed with exit code $LASTEXITCODE"
    }
}

$publicKey = (Get-Content -LiteralPath $publicKeyPath -Raw).Trim()

Set-Content -LiteralPath $OutputFile -Value $publicKey -Encoding ascii
Set-Content -LiteralPath $allowedSignersPath -Value "$Email $publicKey" -Encoding ascii

try {
    Set-Clipboard -Value $publicKey
    $clipboardMessage = 'The public key was copied to the clipboard.'
} catch {
    $clipboardMessage = 'The public key could not be copied to the clipboard.'
}

git config --global gpg.format ssh
git config --global user.signingkey $publicKeyPath
git config --global commit.gpgsign true
git config --global tag.gpgSign true
git config --global user.email $Email
git config --global gpg.ssh.allowedSignersFile $allowedSignersPath

Write-Host ''
Write-Host 'Git SSH commit signing was configured.'
Write-Host "Public key exported to: $OutputFile"
Write-Host $clipboardMessage
Write-Host ''
Write-Host 'Add this key in GitHub:'
Write-Host 'Settings > SSH and GPG keys > New SSH key > Key type: Signing Key'
