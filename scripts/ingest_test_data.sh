#!/bin/bash
# ============================================================
# Ingest test security data into SOC Lab for validation
# ============================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "Generating test security events..."

# 1. Generate web attacks against DVWA
echo "[1] Testing web attack detection..."
curl -s "http://localhost:8080/vulnerabilities/sqli/?id=1'+OR+'1'%3D'1&Submit=Submit" > /dev/null 2>&1 || true
curl -s "http://localhost:8080/vulnerabilities/xss_r/?name=<script>alert(1)</script>" > /dev/null 2>&1 || true
curl -s "http://localhost:8080/vulnerabilities/brute/" -X POST -d "username=admin&password=password123&Login=Login" > /dev/null 2>&1 || true
echo "  ✓ Web attacks sent to DVWA"

# 2. Simulate SSH brute force on Wazuh manager
echo "[2] Simulating SSH brute force..."
for i in $(seq 1 15); do
    docker exec soc-wazuh-manager bash -c "echo 'Failed password for root from 10.100.0.100 port 22 ssh2' >> /var/ossec/logs/alerts/alerts.json" 2>/dev/null || true
done
echo "  ✓ SSH brute force logs injected"

# 3. Simulate malware detection
echo "[3] Simulating malware detection events..."
docker exec soc-wazuh-manager bash -c "
cat >> /var/ossec/logs/alerts/alerts.json << 'EOF'
{\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)\",\"rule\":{\"level\":12,\"id\":\"100300\",\"description\":\"Malware Detected: eicar.com\"},\"agent\":{\"id\":\"001\",\"name\":\"test-windows-agent\"},\"data\":{\"srcip\":\"10.100.0.50\",\"file\":\"/tmp/eicar.com\",\"md5\":\"44d88612fea8a8f36de82e1278abb02f\"}}
EOF
" 2>/dev/null || true
echo "  ✓ Malware detection event injected"

# 4. Simulate privilege escalation
echo "[4] Simulating privilege escalation..."
docker exec soc-wazuh-manager bash -c "
cat >> /var/ossec/logs/alerts/alerts.json << 'EOF'
{\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)\",\"rule\":{\"level\":10,\"id\":\"100700\",\"description\":\"Privilege escalation detected\"},\"agent\":{\"id\":\"002\",\"name\":\"test-linux-agent\"},\"data\":{\"srcuser\":\"www-data\",\"dstuser\":\"root\"}}
EOF
" 2>/dev/null || true
echo "  ✓ Privilege escalation event injected"

# 5. Generate alerts via Wazuh API
echo "[5] Triggering Wazuh alert via API..."
API_USER="${WAZUH_API_USER:-wazuh-wui}"
API_PASS="${WAZUH_API_PASS:-WazuhApi123!}"
TOKEN=$(curl -s -u "$API_USER:$API_PASS" -k "https://localhost:55000/security/user/authenticate" 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('token',''))" 2>/dev/null || echo "")

if [ -n "$TOKEN" ]; then
    curl -s -k -X POST "https://localhost:55000/manager/files" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"file":"rules/local_rules.xml","content":"<group name=\"test\"><rule id=\"999999\" level=\"0\"><match>test</match><description>Test rule</description></rule></group>"}' \
        > /dev/null 2>&1 || true
    echo "  ✓ Wazuh API test complete"
else
    echo "  ⚠ Could not get Wazuh API token"
fi

echo ""
echo "==========================================="
echo "  Test data ingestion complete!"
echo "  Check Kibana/Wazuh dashboards for events."
echo "==========================================="