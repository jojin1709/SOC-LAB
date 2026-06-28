#!/usr/bin/env python3
"""
Wazuh to MISP Integration Script
Creates MISP events from high-severity Wazuh alerts for threat intelligence sharing
"""

import json
import sys
import os
import logging
import requests
import uuid
from datetime import datetime

# Configuration
MISP_URL = os.environ.get('MISP_URL', 'https://misp-core')
MISP_API_KEY = os.environ.get('MISP_API_KEY', '')
MISP_ORG = os.environ.get('MISP_ORG', 'SOC-LAB')
MISP_VERIFY_TLS = os.environ.get('MISP_VERIFY_TLS', 'False').lower() == 'true'
MIN_ALERT_LEVEL = int(os.environ.get('MIN_ALERT_LEVEL_MISP', '7'))
EVENT_DISTRIBUTION = 1  # 0=Your Org, 1=Community, 2=Connected, 3=All
EVENT_THREAT_LEVEL = 2  # 1=High, 2=Medium, 3=Low
EVENT_ANALYSIS = 1  # 0=Initial, 1=Ongoing, 2=Complete

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('wazuh-misp')


def load_alert_input():
    """Load alert JSON from Wazuh argv style or stdin."""
    global MISP_API_KEY, MISP_URL

    if len(sys.argv) > 2 and sys.argv[2]:
        MISP_API_KEY = sys.argv[2]
    if len(sys.argv) > 3 and sys.argv[3]:
        MISP_URL = sys.argv[3]

    if len(sys.argv) > 1 and os.path.isfile(sys.argv[1]):
        with open(sys.argv[1], encoding='utf-8') as alert_file:
            return alert_file.read()

    return sys.stdin.read()


def create_misp_event(alert_data):
    """Create a MISP event from a Wazuh alert"""
    headers = {
        'Authorization': MISP_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }

    rule_description = alert_data.get('rule', {}).get('description', 'No description')
    rule_id = alert_data.get('rule', {}).get('id', '0')
    agent_name = alert_data.get('agent', {}).get('name', 'unknown')
    src_ip = alert_data.get('data', {}).get('srcip', '')
    dst_ip = alert_data.get('data', {}).get('dstip', '')
    full_log = alert_data.get('full_log', '')

    event_uuid = str(uuid.uuid4())
    timestamp = int(datetime.utcnow().timestamp())

    event = {
        'Event': {
            'uuid': event_uuid,
            'info': f"Wazuh Alert: {rule_description} (Rule {rule_id})",
            'date': datetime.utcnow().strftime('%Y-%m-%d'),
            'timestamp': timestamp,
            'analysis': EVENT_ANALYSIS,
            'threat_level_id': EVENT_THREAT_LEVEL,
            'distribution': EVENT_DISTRIBUTION,
            'orgc_id': MISP_ORG,
            'org_id': MISP_ORG,
            'Attribute': []
        }
    }

    # Add attributes from the alert
    if src_ip:
        event['Event']['Attribute'].append({
            'category': 'Network activity',
            'type': 'ip-src',
            'value': src_ip,
            'to_ids': True,
            'comment': f'Source IP from Wazuh alert {rule_id}',
            'distribution': EVENT_DISTRIBUTION
        })

    if dst_ip:
        event['Event']['Attribute'].append({
            'category': 'Network activity',
            'type': 'ip-dst',
            'value': dst_ip,
            'to_ids': True,
            'comment': f'Destination IP from Wazuh alert {rule_id}',
            'distribution': EVENT_DISTRIBUTION
        })

    event['Event']['Attribute'].append({
        'category': 'Other',
        'type': 'text',
        'value': f'Wazuh Rule ID: {rule_id} - {rule_description}',
        'to_ids': False,
        'comment': f'Affected agent: {agent_name}',
        'distribution': EVENT_DISTRIBUTION
    })

    if full_log:
        event['Event']['Attribute'].append({
            'category': 'Other',
            'type': 'comment',
            'value': full_log[:1000],
            'to_ids': False,
            'comment': 'Full log from Wazuh alert',
            'distribution': EVENT_DISTRIBUTION
        })

    try:
        response = requests.post(
            f'{MISP_URL}/events',
            headers=headers,
            json=event,
            verify=MISP_VERIFY_TLS,
            timeout=15
        )
        if response.status_code in (200, 201):
            event_id = response.json().get('Event', {}).get('id', 'unknown')
            logger.info(f'MISP event created: {event_id} - {rule_description}')
            return event_id
        else:
            logger.error(f'Failed to create MISP event: {response.status_code} - {response.text[:500]}')
            return None
    except requests.exceptions.RequestException as e:
        logger.error(f'Connection error to MISP: {e}')
        return None


def main():
    try:
        input_str = load_alert_input()
        if not input_str:
            sys.exit(0)
        alert_data = json.loads(input_str)
        alert_level = alert_data.get('rule', {}).get('level', 0)
        if alert_level >= MIN_ALERT_LEVEL:
            create_misp_event(alert_data)
        sys.exit(0)
    except Exception as e:
        logger.error(f'Error: {e}')
        sys.exit(1)


if __name__ == '__main__':
    main()
