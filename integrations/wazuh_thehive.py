#!/usr/bin/env python3
"""
Wazuh to TheHive Integration Script
Sends high-severity Wazuh alerts to TheHive for case management.
"""

import json
import logging
import os
import sys
import time
from datetime import datetime

import requests


THEHIVE_URL = os.environ.get("THEHIVE_URL", "http://thehive:9000")
THEHIVE_API_KEY = os.environ.get("THEHIVE_API_KEY", "")
THEHIVE_ALERT_SOURCE = "Wazuh SOC"
THEHIVE_ALERT_TYPE = "wazuh_alert"
MIN_ALERT_LEVEL = int(os.environ.get("MIN_ALERT_LEVEL", "10"))

SEVERITY_MAP = {
    "0": 1,
    "1": 1,
    "2": 1,
    "3": 1,
    "4": 2,
    "5": 2,
    "6": 2,
    "7": 3,
    "8": 3,
    "9": 3,
    "10": 4,
    "11": 4,
    "12": 4,
    "13": 4,
    "14": 4,
    "15": 4,
}

TLP_MAP = {0: 2, 1: 2, 2: 1, 3: 1, 4: 1}
PAP_MAP = {0: 2, 1: 2, 2: 1, 3: 1, 4: 1}

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("wazuh-thehive")


def load_alert_input():
    """Load alert JSON from Wazuh argv style or stdin."""
    global THEHIVE_API_KEY, THEHIVE_URL

    if len(sys.argv) > 2 and sys.argv[2]:
        THEHIVE_API_KEY = sys.argv[2]
    if len(sys.argv) > 3 and sys.argv[3]:
        THEHIVE_URL = sys.argv[3]

    if len(sys.argv) > 1 and os.path.isfile(sys.argv[1]):
        with open(sys.argv[1], encoding="utf-8") as alert_file:
            return alert_file.read()

    return sys.stdin.read()


def create_alert(alert_data):
    """Send an alert to TheHive."""
    headers = {
        "Authorization": f"Bearer {THEHIVE_API_KEY}",
        "Content-Type": "application/json",
    }

    wazuh_level = alert_data.get("rule", {}).get("level", 0)
    rule_description = alert_data.get("rule", {}).get("description", "No description")
    rule_id = alert_data.get("rule", {}).get("id", "0")
    agent_name = alert_data.get("agent", {}).get("name", "unknown")
    agent_id = alert_data.get("agent", {}).get("id", "unknown")
    timestamp = alert_data.get("timestamp", datetime.utcnow().isoformat())
    src_ip = alert_data.get("data", {}).get("srcip", alert_data.get("src_ip", ""))
    dst_ip = alert_data.get("data", {}).get("dstip", alert_data.get("dst_ip", ""))
    location = alert_data.get("location", "unknown")
    full_log = alert_data.get("full_log", "")

    severity = SEVERITY_MAP.get(str(wazuh_level), 2)
    tlp = TLP_MAP.get(severity, 2)
    pap = PAP_MAP.get(severity, 2)

    artifacts = []
    if src_ip:
        artifacts.append(
            {
                "dataType": "ip",
                "data": src_ip,
                "message": f"Source IP from Wazuh alert {rule_id}",
                "tags": ["src_ip", "wazuh"],
            }
        )
    if dst_ip:
        artifacts.append(
            {
                "dataType": "ip",
                "data": dst_ip,
                "message": f"Destination IP from Wazuh alert {rule_id}",
                "tags": ["dst_ip", "wazuh"],
            }
        )
    if agent_name:
        artifacts.append(
            {
                "dataType": "hostname",
                "data": agent_name,
                "message": f"Affected host from Wazuh alert {rule_id}",
                "tags": ["hostname", "wazuh", "affected"],
            }
        )
    if alert_data.get("syscheck", {}).get("md5"):
        artifacts.append(
            {
                "dataType": "hash",
                "data": alert_data["syscheck"]["md5"],
                "message": "File hash from Wazuh FIM alert",
                "tags": ["file_hash", "wazuh", "fim"],
            }
        )

    thehive_alert = {
        "title": f"[{wazuh_level}] {rule_description}",
        "description": (
            "## Wazuh Alert Details\n\n"
            f"- **Rule ID:** {rule_id}\n"
            f"- **Rule Description:** {rule_description}\n"
            f"- **Agent:** {agent_name} (ID: {agent_id})\n"
            f"- **Location:** {location}\n"
            f"- **Timestamp:** {timestamp}\n"
            f"- **Source IP:** {src_ip}\n"
            f"- **Destination IP:** {dst_ip}\n\n"
            f"### Full Log\n```\n{full_log[:2000]}\n```\n\n"
            f"### Raw Alert\n```json\n{json.dumps(alert_data, indent=2)[:5000]}\n```"
        ),
        "severity": severity,
        "date": int(time.time() * 1000),
        "tags": [
            f"wazuh_rule_{rule_id}",
            f"level_{wazuh_level}",
            f"agent_{agent_id}",
            "wazuh_soc",
        ],
        "tlp": tlp,
        "pap": pap,
        "type": THEHIVE_ALERT_TYPE,
        "source": THEHIVE_ALERT_SOURCE,
        "sourceRef": f"wazuh_{agent_id}_{rule_id}_{int(time.time())}",
        "artifacts": artifacts,
    }

    try:
        response = requests.post(
            f"{THEHIVE_URL}/api/alert",
            headers=headers,
            json=thehive_alert,
            timeout=10,
        )
        if response.status_code in (200, 201):
            alert_id = response.json().get("id", "unknown")
            logger.info("Alert sent to TheHive: %s - %s", alert_id, rule_description)
            return True

        logger.error(
            "Failed to send alert: %s - %s",
            response.status_code,
            response.text[:500],
        )
        return False
    except requests.exceptions.RequestException as exc:
        logger.error("Connection error to TheHive: %s", exc)
        return False


def main():
    """Read a Wazuh JSON alert from stdin."""
    try:
        input_str = load_alert_input()
        if not input_str:
            logger.warning("No input received")
            sys.exit(1)

        alert_data = json.loads(input_str)
        alert_level = alert_data.get("rule", {}).get("level", 0)
        logger.info(
            "Processing alert: level=%s, rule=%s",
            alert_level,
            alert_data.get("rule", {}).get("id"),
        )

        if alert_level < MIN_ALERT_LEVEL:
            logger.info(
                "Alert level %s below threshold %s, skipping",
                alert_level,
                MIN_ALERT_LEVEL,
            )
            sys.exit(0)

        sys.exit(0 if create_alert(alert_data) else 1)
    except json.JSONDecodeError as exc:
        logger.error("Invalid JSON input: %s", exc)
        sys.exit(1)
    except Exception as exc:
        logger.error("Unexpected error: %s", exc)
        sys.exit(1)


if __name__ == "__main__":
    main()
