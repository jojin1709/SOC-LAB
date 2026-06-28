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

Write-Host "[2/4] Validating compose file..."
docker compose config --quiet

Write-Host "[3/4] Pulling images..."
docker compose pull

Write-Host "[4/4] Starting stack..."
if ($WithLinuxNsm) {
    docker compose --profile linux-nsm up -d
} else {
    docker compose up -d
}

Write-Host ""
Write-Host "SOC Lab is starting."
Write-Host "Docs:      http://localhost:8090"
Write-Host "Kibana:    http://localhost:5601"
Write-Host "Wazuh:     https://localhost:4431"
Write-Host "TheHive:   http://localhost:9000"
Write-Host "MISP:      https://localhost:8443"
Write-Host "Grafana:   http://localhost:3000"
