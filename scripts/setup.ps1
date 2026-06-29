param(
    [switch]$WithLinuxNsm
)

$ErrorActionPreference = "Stop"
$ProjectDir = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectDir

Write-Host "==========================================="
Write-Host "  SOC LAB - Windows Docker Setup"
Write-Host "==========================================="

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker was not found. Install Docker Desktop first."
}

docker compose version | Out-Host

New-Item -ItemType Directory -Force -Path "configs/nginx/ssl" | Out-Null

if (-not (Test-Path "configs/nginx/ssl/soc-lab.crt") -or -not (Test-Path "configs/nginx/ssl/soc-lab.key")) {
    Write-Host "[1/4] Generating nginx self-signed certificate..."
    @'
from datetime import datetime, timedelta, timezone
from pathlib import Path
from cryptography import x509
from cryptography.x509.oid import NameOID
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa

out = Path("configs/nginx/ssl")
out.mkdir(parents=True, exist_ok=True)
key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
subject = issuer = x509.Name([
    x509.NameAttribute(NameOID.COUNTRY_NAME, "US"),
    x509.NameAttribute(NameOID.STATE_OR_PROVINCE_NAME, "State"),
    x509.NameAttribute(NameOID.LOCALITY_NAME, "City"),
    x509.NameAttribute(NameOID.ORGANIZATION_NAME, "SOC-LAB"),
    x509.NameAttribute(NameOID.COMMON_NAME, "*.soc-lab.local"),
])
cert = (
    x509.CertificateBuilder()
    .subject_name(subject)
    .issuer_name(issuer)
    .public_key(key.public_key())
    .serial_number(x509.random_serial_number())
    .not_valid_before(datetime.now(timezone.utc) - timedelta(days=1))
    .not_valid_after(datetime.now(timezone.utc) + timedelta(days=3650))
    .add_extension(x509.SubjectAlternativeName([x509.DNSName("*.soc-lab.local"), x509.DNSName("localhost")]), critical=False)
    .sign(key, hashes.SHA256())
)
(out / "soc-lab.key").write_bytes(key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.TraditionalOpenSSL, serialization.NoEncryption()))
(out / "soc-lab.crt").write_bytes(cert.public_bytes(serialization.Encoding.PEM))
'@ | python -
}

Write-Host "[2/4] Initializing environment config..."
$EnvFilePath = Join-Path $ProjectDir ".env"
if (-not (Test-Path $EnvFilePath)) {
    Copy-Item (Join-Path $ProjectDir ".env.example") $EnvFilePath
}

# Update host path in .env
$EnvContent = Get-Content $EnvFilePath
$EnvContent = $EnvContent | Where-Object { $_ -notmatch "^SOC_LAB_HOST_PATH=" }
$EnvContent += "SOC_LAB_HOST_PATH=$ProjectDir"
$EnvContent | Set-Content $EnvFilePath

Write-Host "[3/4] Pulling Control Center image..."
docker compose pull control-center

Write-Host "[4/4] Starting Control Center..."
docker compose up -d control-center

Write-Host ""
Write-Host "==========================================="
Write-Host "  SOC-LAB Control Center is running!"
Write-Host "  URL:       http://localhost:8088"
Write-Host "==========================================="
