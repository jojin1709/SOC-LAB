# SOC Lab

Complete Docker-based Security Operations Center lab with Wazuh, Elastic/Kibana, TheHive, Cortex, MISP, Shuffle, Grafana, Prometheus, MinIO, DVWA, Juice Shop, and optional Linux packet monitoring with Suricata and Zeek.

Developed by **JOJIN JOHN**  
LinkedIn: <https://www.linkedin.com/in/jojin-john/>

<script type="text/javascript" src="https://cdnjs.buymeacoffee.com/1.0.0/button.prod.min.js" data-name="bmc-button" data-slug="jojin1709" data-color="#FFDD00" data-emoji="🙂" data-font="Cookie" data-text="Buy me a thanks" data-outline-color="#000000" data-font-color="#000000" data-coffee-color="#ffffff"></script>

<script data-name="BMC-Widget" data-cfasync="false" src="https://cdnjs.buymeacoffee.com/1.0.0/widget.prod.min.js" data-id="jojin1709" data-description="Support me on Buy me a coffee!" data-message="" data-color="#5F7FFF" data-position="Right" data-x_margin="18" data-y_margin="18"></script>

## What This Is

This project creates a local SOC lab for blue-team learning, alert triage, threat intelligence, incident response, detection engineering, and attack simulation. It is designed to run on:

- Windows with Docker Desktop
- Linux Docker hosts
- Kali Linux with Docker

The default stack is cross-platform. Suricata and Zeek are optional Linux/Kali services because they use host networking and packet capture capabilities that are not reliable on Windows Docker Desktop.

## Services

| Service | Purpose | URL / Port |
|---|---|---|
| Documentation site | Project docs website | http://localhost:8090 |
| Nginx | Reverse proxy | http://localhost, https://localhost |
| Kibana | Elastic dashboards | http://localhost:5601 |
| Elasticsearch | Search/indexing | http://localhost:9200 |
| Wazuh Manager | SIEM/XDR manager and API | 1514, 1515, 1516, 55000 |
| Wazuh Dashboard | Wazuh UI | https://localhost:4431 |
| TheHive | Case management | http://localhost:9000 |
| Cortex | Observable analysis | http://localhost:9001 |
| MISP | Threat intelligence | https://localhost:8443, http://localhost:8081 |
| Shuffle | SOAR automation | http://localhost:3443 |
| Grafana | Metrics dashboards | http://localhost:3000 |
| Prometheus | Metrics collection | http://localhost:9090 |
| MinIO | S3-compatible storage | http://localhost:9002, console http://localhost:9003 |
| DVWA | Vulnerable target | http://localhost:8080 |
| Juice Shop | Vulnerable target | http://localhost:3001 |
| Suricata | IDS/IPS | Linux profile only |
| Zeek | Network security monitoring | Linux profile only |

## Requirements

Minimum:

- 4 CPU cores
- 16 GB RAM
- 80 GB free disk
- Docker Engine or Docker Desktop
- Docker Compose plugin

Recommended:

- 8+ CPU cores
- 32 GB RAM
- 200 GB SSD

Linux/Kali requirement:

```bash
sudo sysctl -w vm.max_map_count=262144
echo "vm.max_map_count=262144" | sudo tee /etc/sysctl.conf
```

Windows requirement:

- Docker Desktop with Linux containers enabled
- WSL2 backend recommended

## Quick Start

### Windows Docker Desktop

Run PowerShell from the project folder:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1
docker compose ps
```

Open the docs site:

```text
http://localhost:8090
```

### Linux / Kali Docker

```bash
chmod +x scripts/*.sh
sudo sysctl -w vm.max_map_count=262144
./scripts/setup.sh
docker compose ps
```

### Linux / Kali With Suricata and Zeek

```bash
chmod +x scripts/*.sh
sudo sysctl -w vm.max_map_count=262144
WITH_LINUX_NSM=1 ./scripts/setup.sh
```

Or manually:

```bash
docker compose --profile linux-nsm up -d
```

## Daily Commands

```bash
# Start the cross-platform stack
docker compose up -d

# Start Linux packet monitoring too
docker compose --profile linux-nsm up -d

# Stop services
docker compose stop

# Stop and remove containers, keep volumes
docker compose down

# Stop and delete volumes/data
docker compose down -v

# View service status
docker compose ps

# Follow all logs
docker compose logs -f

# Follow one service
docker compose logs -f wazuh-manager

# Restart one service
docker compose restart wazuh-manager

# Validate compose syntax
docker compose config --quiet
```

## Test Data

After the stack is healthy:

```bash
chmod +x scripts/ingest_test_data.sh
./scripts/ingest_test_data.sh
```

The script sends test traffic to DVWA and injects sample Wazuh-style alerts for validation.

## Integrations

Wazuh to TheHive:

- File: `integrations/wazuh_thehive.py`
- Wazuh integration name: `custom-w2thive.py`
- Sends alerts with level `>= 10`
- Supports Wazuh alert-file argv mode and stdin mode

Wazuh to MISP:

- File: `integrations/wazuh_misp.py`
- Wazuh integration name: `custom-w2misp.py`
- Sends alerts with level `>= 7`
- Stores source IP as `ip-src` and destination IP as `ip-dst`

Set real API keys before serious use:

```bash
# edit .env and/or configs/wazuh/ossec.conf
THEHIVE_API_KEY=your_thehive_key
MISP_ADMIN_PASSKEY=your_misp_key

docker compose restart wazuh-manager
```

## Platform Notes

Windows Docker Desktop:

- Use the default command: `docker compose up -d`
- Do not enable `linux-nsm` unless you are running a real Linux Docker engine
- Suricata and Zeek packet capture are not expected to work fully on Windows Docker Desktop
- Copy `.env.example` to `.env` if you are starting from a fresh clone

Linux/Kali:

- The default stack works with `docker compose up -d`
- Full packet capture requires `docker compose --profile linux-nsm up -d`
- Set the correct interface in `.env`, for example `SURICATA_INTERFACE=eth0`
- Copy `.env.example` to `.env` if you are starting from a fresh clone

## Troubleshooting

Docker daemon not running:

```bash
docker info
```

Port already in use:

```bash
docker compose ps
netstat -ano | findstr :443
```

Linux Elasticsearch error for `vm.max_map_count`:

```bash
sudo sysctl -w vm.max_map_count=262144
```

Check logs:

```bash
docker compose logs --tail=100 elasticsearch
docker compose logs --tail=100 wazuh-manager
docker compose logs --tail=100 thehive
docker compose logs --tail=100 misp-core
```

Clean rebuild:

```bash
docker compose down -v
docker compose pull
docker compose up -d
```

## Security Warning

This is a lab. Change every default password and API key before exposing it to any network. Do not expose SOC management services directly to the public internet. Use VPN, firewall rules, and proper TLS certificates for real deployments.

## Documentation Website

The static documentation website is in `docs/`.

Run it through Docker:

```bash
docker compose up -d docs-site
```

Then open:

```text
http://localhost:8090
```

## Support

Created and maintained by **JOJIN JOHN**.  
LinkedIn: <https://www.linkedin.com/in/jojin-john/>

Support the project:

```html
<script type="text/javascript" src="https://cdnjs.buymeacoffee.com/1.0.0/button.prod.min.js" data-name="bmc-button" data-slug="jojin1709" data-color="#FFDD00" data-emoji="🙂" data-font="Cookie" data-text="Buy me a thanks" data-outline-color="#000000" data-font-color="#000000" data-coffee-color="#ffffff"></script>

<script data-name="BMC-Widget" data-cfasync="false" src="https://cdnjs.buymeacoffee.com/1.0.0/widget.prod.min.js" data-id="jojin1709" data-description="Support me on Buy me a coffee!" data-message="" data-color="#5F7FFF" data-position="Right" data-x_margin="18" data-y_margin="18"></script>
```
