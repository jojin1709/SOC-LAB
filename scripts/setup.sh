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
echo "[5/8] Pulling Docker images..."
docker compose pull --quiet 2>/dev/null || docker compose pull
echo "  ✓ Images pulled"

echo ""
echo "[6/8] Starting SOC Lab stack..."
if [ "${WITH_LINUX_NSM:-0}" = "1" ]; then
    docker compose --profile linux-nsm up -d
else
    docker compose up -d
fi
echo "  ✓ Stack deployed"

echo ""
echo "[7/8] Waiting for services to become healthy..."
echo "  (This may take 2-5 minutes depending on your system)"
sleep 10

SERVICES=("elasticsearch" "kibana" "wazuh-indexer" "wazuh-manager" "thehive" "cassandra" "redis")
for svc in "${SERVICES[@]}"; do
    echo -n "  Waiting for $svc..."
    for i in $(seq 1 60); do
        STATUS=$(docker inspect --format='{{.State.Health.Status}}' "soc-$svc" 2>/dev/null || echo "starting")
        if [ "$STATUS" = "healthy" ]; then
            echo " ✓"
            break
        fi
        if [ "$i" -eq 60 ]; then
            echo " timeout (status: $STATUS)"
        fi
        sleep 5
    done
done

echo ""
echo "[8/8] Setup complete!"
echo ""
echo "==========================================="
echo "  SOC LAB - Access URLs"
echo "==========================================="
echo ""
echo "  Kibana:       http://localhost:5601"
echo "  Wazuh:        https://localhost:4431 (user: admin / pass: see .env)"
echo "  TheHive:      http://localhost:9000"
echo "  Cortex:       http://localhost:9001"
echo "  MISP:         https://localhost:8443 (user: admin@admin.test / pass: admin)"
echo "  Grafana:      http://localhost:3000 (user: admin / pass: GrafanaAdmin123!)"
echo "  Prometheus:   http://localhost:9090"
echo "  Shuffle:      http://localhost:3443"
echo "  MinIO:        http://localhost:9002 (console: localhost:9003)"
echo "  DVWA:         http://localhost:8080 (user: admin / pass: password)"
echo "  Juice Shop:   http://localhost:3001"
echo "  Docs:         http://localhost:8090"
echo ""
echo "  Linux/Kali packet monitoring: WITH_LINUX_NSM=1 ./scripts/setup.sh"
echo "  Default credentials in .env - CHANGE BEFORE PRODUCTION USE!"
echo "==========================================="
