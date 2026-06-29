#!/bin/bash
# ============================================================
# SOC Lab - Complete Setup Script
# ============================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

echo "==========================================="
echo "  SOC LAB - Complete Setup"
echo "==========================================="

echo ""
echo "[1/8] Checking prerequisites..."

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "ERROR: Docker not found. Install it first."
    echo "  curl -fsSL https://get.docker.com | bash"
    exit 1
fi
echo "  ✓ Docker: $(docker --version)"

# Check Docker Compose
if ! docker compose version &> /dev/null; then
    echo "ERROR: Docker Compose not found."
    exit 1
fi
echo "  ✓ Docker Compose: $(docker compose version)"

# Check .env
if [ ! -f .env ]; then
    echo "  - Creating .env from template..."
    cp .env.example .env 2>/dev/null || echo "  WARNING: No .env.example found, using existing .env"
fi

echo ""
echo "[2/8] Creating directory structure..."
mkdir -p {configs/{wazuh,elastic,thehive,cortex,misp,shuffle,suricata,zeek,nginx,logstash/pipeline,prometheus},data,logs/{wazuh,suricata,zeek,nginx},scripts,agents/{windows,linux,docker},targets,dashboards/{wazuh,kibana,grafana},integrations/shuffle_workflows}

echo ""
echo "[3/8] Creating self-signed SSL certificate..."
mkdir -p configs/nginx/ssl
openssl req -x509 -nodes -days 3650 -newkey rsa:4096 \
    -keyout configs/nginx/ssl/soc-lab.key \
    -out configs/nginx/ssl/soc-lab.crt \
    -subj "/C=US/ST=State/L=City/O=SOC-LAB/CN=*.soc-lab.local" \
    2>/dev/null
echo "  ✓ SSL certificate created"

echo ""
echo "[4/8] Setting up sysctl for Elasticsearch..."
# Set vm.max_map_count for Elasticsearch
CURRENT_VAL=$(sysctl -n vm.max_map_count 2>/dev/null || echo 0)
if [ "$CURRENT_VAL" -lt 262144 ]; then
    sudo sysctl -w vm.max_map_count=262144 2>/dev/null || true
    echo "  ✓ vm.max_map_count set to 262144"
else
    echo "  ✓ vm.max_map_count already sufficient: $CURRENT_VAL"
fi

echo ""
echo "[5/8] Configuring environment..."
# Remove any existing SOC_LAB_HOST_PATH lines
if [ -f .env ]; then
    # Cross-platform sed delete to avoid issues
    grep -v '^SOC_LAB_HOST_PATH=' .env > .env.tmp && mv .env.tmp .env
fi
echo "SOC_LAB_HOST_PATH=$PROJECT_DIR" >> .env
echo "  ✓ Environment configured"

echo ""
echo "[6/8] Pulling Control Center image..."
docker compose pull control-center
echo "  ✓ Control Center image pulled"

echo ""
echo "[7/8] Starting Control Center..."
docker compose up -d control-center
echo "  ✓ Control Center started"

echo ""
echo "[8/8] Setup complete!"
echo ""
echo "==========================================="
echo "  SOC-LAB Control Center is running!"
echo "  URL:       http://localhost:8088"
echo "==========================================="
