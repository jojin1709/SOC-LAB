# SOC Lab

> Complete Docker-based Security Operations Center lab for blue-team learning, detection engineering, threat intelligence, and attack simulation.

**Developed by Jojin John**

[![LinkedIn](https://img.shields.io/badge/LinkedIn-Jojin%20John-blue?style=flat&logo=linkedin)](https://www.linkedin.com/in/jojin-john/)
[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-jojin1709-yellow?style=flat&logo=buy-me-a-coffee)](https://www.buymeacoffee.com/jojin1709)

<a href="https://www.buymeacoffee.com/jojin1709" target="_blank">
  <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" height="50" width="210">
</a>

---

## Installation & Setup

To deploy the lab, clone the repository and navigate into the project directory:

```bash
git clone https://github.com/jojin1709/SOC-LAB.git
cd SOC-LAB
```

---

## Stack

| Service         | Purpose                     | URL / Port                                        |
| --------------- | --------------------------- | ------------------------------------------------- |
| Control Center  | Web-based lab manager       | `http://localhost:8088` (Main Portal)             |
| Nginx           | Reverse proxy               | `http://localhost`, `https://localhost`           |
| Kibana          | Elastic dashboards          | `http://localhost:5601`                           |
| Elasticsearch   | Search / indexing           | `http://localhost:9200`                           |
| Wazuh Manager   | SIEM / XDR manager          | `1514`, `1515`, `1516`, `55000`                   |
| Wazuh Dashboard | Wazuh UI                    | `https://localhost:4431`                          |
| TheHive         | Case management             | `http://localhost:9000`                           |
| Cortex          | Observable analysis         | `http://localhost:9001`                           |
| MISP            | Threat intelligence         | `https://localhost:8443`, `http://localhost:8081` |
| Shuffle (Backend) | SOAR automation backend  | `http://localhost:5001` (direct) or `https://shuffle.soc-lab.local` (via nginx) |
| Shuffle (Frontend)  | SOAR UI                | `http://localhost:3001` (direct)                    |
| Grafana         | Metrics dashboards          | `http://localhost:3000`                           |
| Prometheus      | Metrics collection          | `http://localhost:9090`                           |
| MinIO           | S3-compatible storage       | `http://localhost:9002` (console: `9003`)         |
| DVWA            | Vulnerable target           | `http://localhost:8080`                           |
| Juice Shop      | Vulnerable target           | `http://localhost:3002`                           |
| Docs site       | Project documentation       | `http://localhost:8090`                           |
| Suricata        | IDS / IPS                   | Linux profile only                                |
| Zeek            | Network security monitoring | Linux profile only                                |

> Suricata and Zeek use host networking and packet capture — not supported on Windows Docker Desktop.

---

## SOC-LAB Control Center

SOC-LAB includes a web-based Control Center for managing lab modules individually. This enables a lightweight start, allowing you to deploy only the Control Center and spin up individual labs on demand via a web interface.

### Architecture

```mermaid
graph TD
    User([Security Practitioner]) -->|Web Browser: 8088| FE
    
    subgraph Host ["Host System (Windows / Linux)"]
        Docker_Sock["/var/run/docker.sock (Docker Socket)"]
        Env_File[".env (SOC_LAB_HOST_PATH)"]
        Compose_File["docker-compose.yml"]
    end

    subgraph CC_Container ["Control Center Container"]
        FE["React + TS Frontend (Tailwind UI)"]
        BE["NodeJS Express Backend"]
        D_CLI["Docker CLI & Compose Plugin"]
        
        FE -->|REST API / WebSockets| BE
        BE -->|Dockerode (Stats / Info)| Docker_Sock
        BE -->|exec (Compose Profiles)| D_CLI
        D_CLI -->|Manages Container lifecycle| Docker_Sock
    end
    
    subgraph Lab_Containers ["Containerized Lab Profiles"]
        Core["Core SOC Profile (Wazuh, Elastic, DVWA...)"]
        Intel["Threat Intel Profile (MISP)"]
        IR["Incident Response Profile (TheHive, Cortex)"]
        SOAR["SOAR Profile (Shuffle)"]
        Mon["Monitoring Profile (Grafana, Prometheus)"]
        NSM["NSM Profile (Suricata, Zeek)"]
    end
    
    Docker_Sock -->|Spawns & Monitors| Lab_Containers
    CC_Container -.->|Reads config & env| Compose_File
    CC_Container -.->|Reads config & env| Env_File
```

### Quick Start with Control Center

Ensure Docker is running, then run:

```bash
# Windows
powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1

# Linux
chmod +x scripts/*.sh
./scripts/setup.sh
```


Open the Control Center in your browser:

```
http://localhost:8088
```

### Lab Modules

The Control Center manages these lab profiles:

| Lab | Description | RAM | Profile |
|-----|-------------|-----|---------|
| Core SOC | Wazuh SIEM, Elasticsearch, Kibana, vulnerable targets | 4-6 GB | `core` |
| Threat Intel | MISP threat intelligence platform | 2-4 GB | `intel` |
| Incident Response | TheHive case management, Cortex analyzers | 2-4 GB | `ir` |
| SOAR Automation | Shuffle SOAR workflows | 1-2 GB | `soar` |
| Monitoring | Grafana dashboards, Prometheus, MinIO | 1-2 GB | `monitoring` |
| NSM | Suricata IDS, Zeek network monitor | 2-4 GB | `nsm` |
| Full Enterprise SOC | All services combined | 16-32 GB | `full` |

### Command Line Alternative

Start individual labs:

```bash
docker compose --profile core up -d
docker compose --profile intel up -d
docker compose --profile soar up -d
```

Stop individual labs:

```bash
docker compose --profile core down
docker compose --profile intel down
```

---

## Requirements

**Minimum:**

- 4 CPU cores
- 16 GB RAM
- 80 GB free disk
- Docker Engine or Docker Desktop + Compose plugin

**Recommended:**

- 8+ CPU cores
- 32 GB RAM
- 200 GB SSD

**Linux / Kali — required before starting:**

```bash
sudo sysctl -w vm.max_map_count=262144
echo "vm.max_map_count=262144" | sudo tee -a /etc/sysctl.conf
```

**Windows — required:**

- Docker Desktop with WSL2 backend and Linux containers enabled

---

## Quick Start

### Windows (Docker Desktop)

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1
docker compose ps
```

Docs: `http://localhost:8090`

### Linux / Kali

```bash
chmod +x scripts/*.sh
sudo sysctl -w vm.max_map_count=262144
./scripts/setup.sh
docker compose ps
```

### Linux / Kali + Suricata + Zeek

```bash
chmod +x scripts/*.sh
sudo sysctl -w vm.max_map_count=262144
WITH_LINUX_NSM=1 ./scripts/setup.sh

# Or manually:
docker compose --profile linux-nsm up -d
```

---

## Common Commands

```bash
# Start default stack
docker compose up -d

# Start with Linux packet monitoring
docker compose --profile linux-nsm up -d

# Stop services (keep volumes)
docker compose stop

# Remove containers (keep volumes)
docker compose down

# Remove containers + delete all data
docker compose down -v

# View service status
docker compose ps

# Follow all logs
docker compose logs -f

# Follow a specific service
docker compose logs -f wazuh-manager

# Restart a service
docker compose restart wazuh-manager

# Validate compose syntax
docker compose config --quiet
```

---

## Inject Test Data

After the stack is healthy:

```bash
chmod +x scripts/ingest_test_data.sh
./scripts/ingest_test_data.sh
```

Sends test traffic to DVWA and injects sample Wazuh-style alerts.

---

## Integrations

### Wazuh → TheHive

- Script: `integrations/wazuh_thehive.py`
- Wazuh integration name: `custom-w2thive.py`
- Forwards alerts with level `>= 10`
- Supports alert-file argv mode and stdin mode

### Wazuh → MISP

- Script: `integrations/wazuh_misp.py`
- Wazuh integration name: `custom-w2misp.py`
- Forwards alerts with level `>= 7`
- Stores source IP as `ip-src`, destination IP as `ip-dst`

Set API keys before use:

```bash
# Edit .env and/or configs/wazuh/ossec.conf
THEHIVE_API_KEY=your_thehive_key
MISP_ADMIN_PASSKEY=your_misp_key
SHUFFLE_API_KEY=your_shuffle_key

docker compose restart wazuh-manager
```

---

## Platform Notes

**Windows Docker Desktop:**

- Use `docker compose up -d` (default stack only)
- Do not enable `linux-nsm` profile
- Copy `.env.example` to `.env` on a fresh clone

**Linux / Kali:**

- Default stack: `docker compose up -d`
- Full packet capture: `docker compose --profile linux-nsm up -d`
- Set correct interface in `.env` — e.g. `SURICATA_INTERFACE=eth0`
- Copy `.env.example` to `.env` on a fresh clone

---

## Troubleshooting

**Docker daemon not running:**

```bash
docker info
```

**Port conflict:**

```bash
docker compose ps
netstat -ano | findstr :443   # Windows
ss -tulpn | grep :443         # Linux
```

**Elasticsearch vm.max_map_count error (Linux):**

```bash
sudo sysctl -w vm.max_map_count=262144
```

**Check logs:**

```bash
docker compose logs --tail=100 elasticsearch
docker compose logs --tail=100 wazuh-manager
docker compose logs --tail=100 thehive
docker compose logs --tail=100 misp-core
```

**Clean rebuild:**

```bash
docker compose down -v
docker compose pull
docker compose up -d
```

---

## Security Warning

This is a lab environment. **Change every default password and API key** before connecting it to any network. Do not expose SOC services to the public internet without a VPN, firewall rules, and valid TLS certificates.

---

## Support

Created and maintained by **Jojin John**.

- 🔗 LinkedIn: [linkedin.com/in/jojin-john](https://www.linkedin.com/in/jojin-john/)
- ☕ Buy Me a Coffee: [buymeacoffee.com/jojin1709](https://www.buymeacoffee.com/jojin1709)

If this project helped you, consider leaving a ⭐ on the repo or buying me a coffee!

<a href="https://www.buymeacoffee.com/jojin1709" target="_blank">
  <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" height="50" width="210">
</a>
