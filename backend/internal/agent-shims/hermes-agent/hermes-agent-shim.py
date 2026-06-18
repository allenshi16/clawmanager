#!/usr/bin/env python3
"""
Hermes Agent Shim for ClawManager Integration

Bridges NousResearch/hermes-agent with ClawManager Agent Control Plane.
Handles registration, heartbeat, command polling, and state reporting.

Environment Variables (injected by ClawManager):
  CLAWMANAGER_AGENT_ENABLED         - Set to "true" to enable shim
  CLAWMANAGER_AGENT_BASE_URL        - ClawManager API base URL
  CLAWMANAGER_AGENT_BOOTSTRAP_TOKEN - One-time token for initial registration
  CLAWMANAGER_AGENT_INSTANCE_ID     - Instance ID
  CLAWMANAGER_AGENT_PROTOCOL_VERSION - Protocol version (v1)
  CLAWMANAGER_AGENT_PERSISTENT_DIR  - Persistent directory for shim state
  CLAWMANAGER_AGENT_DISK_LIMIT_BYTES - Disk quota in bytes
"""

import os
import sys
import time
import json
import logging
import signal
import threading
from pathlib import Path
from typing import Optional, Dict, Any
import urllib.request
import urllib.error

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] hermes-shim: %(message)s',
    datefmt='%Y-%m-%dT%H:%M:%SZ'
)
logger = logging.getLogger(__name__)

should_exit = threading.Event()


def handle_signal(signum, frame):
    logger.info(f"Received signal {signum}, shutting down...")
    should_exit.set()


signal.signal(signal.SIGTERM, handle_signal)
signal.signal(signal.SIGINT, handle_signal)


class ClawManagerShim:
    def __init__(self):
        self.base_url = os.environ.get('CLAWMANAGER_AGENT_BASE_URL', '').rstrip('/')
        self.bootstrap_token = os.environ.get('CLAWMANAGER_AGENT_BOOTSTRAP_TOKEN', '')
        self.instance_id = int(os.environ.get('CLAWMANAGER_AGENT_INSTANCE_ID', '0'))
        self.protocol_version = os.environ.get('CLAWMANAGER_AGENT_PROTOCOL_VERSION', 'v1')
        self.persistent_dir = os.environ.get('CLAWMANAGER_AGENT_PERSISTENT_DIR', '/opt/data/.clawmanager-shim')
        self.disk_limit_bytes = int(os.environ.get('CLAWMANAGER_AGENT_DISK_LIMIT_BYTES', '10737418240'))

        self.agent_id = f"hermes-agent-{self.instance_id}-main"
        self.session_token: Optional[str] = None
        self.session_expires_at: Optional[float] = None
        self.heartbeat_interval = 15
        self.command_poll_interval = 5
        self.registered = False
        self.hermes_pid: Optional[int] = None

        Path(self.persistent_dir).mkdir(parents=True, exist_ok=True)
        self.state_file = Path(self.persistent_dir) / 'shim_state.json'
        self._load_state()

    def _load_state(self):
        if self.state_file.exists():
            try:
                with open(self.state_file, 'r') as f:
                    state = json.load(f)
                    self.session_token = state.get('session_token')
                    expires_at = state.get('session_expires_at')
                    if expires_at:
                        self.session_expires_at = expires_at
                    self.registered = bool(self.session_token)
            except Exception as e:
                logger.warning(f"Failed to load state: {e}")

    def _save_state(self):
        try:
            with open(self.state_file, 'w') as f:
                json.dump({
                    'session_token': self.session_token,
                    'session_expires_at': self.session_expires_at,
                    'registered_at': time.time(),
                }, f)
        except Exception as e:
            logger.warning(f"Failed to save state: {e}")

    def _make_request(self, method: str, path: str, token: Optional[str] = None,
                     data: Optional[Dict] = None) -> Optional[Dict]:
        url = f"{self.base_url}{path}"
        headers = {'Content-Type': 'application/json'}

        if token:
            headers['Authorization'] = f'Bearer {token}'

        body = None
        if data:
            body = json.dumps(data).encode('utf-8')

        try:
            req = urllib.request.Request(url, data=body, headers=headers, method=method)
            with urllib.request.urlopen(req, timeout=10) as resp:
                result = json.loads(resp.read().decode('utf-8'))
                return result.get('data') if result.get('success') else None
        except urllib.error.HTTPError as e:
            if e.code == 401:
                logger.warning("Authentication failed (401), will re-register")
                self.session_token = None
                self.registered = False
                self._save_state()
            else:
                logger.error(f"HTTP error {e.code}: {e.reason}")
        except urllib.error.URLError as e:
            logger.error(f"URL error: {e.reason}")
        except Exception as e:
            logger.error(f"Request failed: {e}")
        return None

    def _get_hermes_pid(self) -> Optional[int]:
        try:
            import subprocess
            result = subprocess.run(['pgrep', '-f', 'hermes.*gateway'], capture_output=True, text=True)
            if result.returncode == 0 and result.stdout.strip():
                return int(result.stdout.strip().split()[0])
        except Exception:
            pass
        return None

    def register(self) -> bool:
        if not self.bootstrap_token:
            logger.error("No bootstrap token available")
            return False

        logger.info(f"Registering agent {self.agent_id} with ClawManager...")

        payload = {
            'instance_id': self.instance_id,
            'agent_id': self.agent_id,
            'agent_version': self._get_hermes_version(),
            'protocol_version': self.protocol_version,
            'capabilities': [
                'runtime.status',
                'runtime.health',
                'metrics.report',
                'commands.poll',
                'llm.gateway',
            ],
            'host_info': {
                'runtime_type': 'hermes-agent',
                'runtime_name': 'Hermes Agent',
                'image': 'nousresearch/hermes-agent:latest',
                'desktop_base': 'hermes',
                'persistent_dir': '/opt/data',
                'port': 8642,
                'arch': self._get_arch(),
            }
        }

        result = self._make_request('POST', '/api/v1/agent/register',
                                 token=self.bootstrap_token, data=payload)

        if result and 'session_token' in result:
            self.session_token = result['session_token']
            self.session_expires_at = result.get('session_expires_at')
            self.heartbeat_interval = result.get('heartbeat_interval_seconds', 15)
            self.command_poll_interval = result.get('command_poll_interval_seconds', 5)
            self.registered = True
            self._save_state()
            logger.info(f"Registration successful, session expires at {self.session_expires_at}")
            return True
        else:
            logger.error("Registration failed")
            return False

    def heartbeat(self) -> bool:
        if not self.session_token:
            return False

        self.hermes_pid = self._get_hermes_pid()

        payload = {
            'agent_id': self.agent_id,
            'timestamp': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
            'openclaw_status': self._get_hermes_status(),
            'summary': {
                'runtime_type': 'hermes-agent',
                'runtime_status': self._get_hermes_status(),
                'runtime_pid': self.hermes_pid or 0,
                'runtime_version': self._get_hermes_version(),
                'openclaw_pid': self.hermes_pid or 0,
                'skill_count': self._get_skill_count(),
                'disk_used_bytes': self._get_disk_used(),
                'disk_limit_bytes': self.disk_limit_bytes,
            }
        }

        result = self._make_request('POST', '/api/v1/agent/heartbeat',
                                 token=self.session_token, data=payload)

        if result:
            logger.debug("Heartbeat accepted")
            return True
        return False

    def get_next_command(self) -> Optional[Dict]:
        if not self.session_token:
            return None

        result = self._make_request('GET', '/api/v1/agent/commands/next',
                                 token=self.session_token)

        return result.get('command') if result else None

    def start_command(self, command_id: int) -> bool:
        result = self._make_request('POST', f'/api/v1/agent/commands/{command_id}/start',
                                 token=self.session_token)
        return result is not None

    def finish_command(self, command_id: int, success: bool, result_data: Optional[Dict] = None):
        payload = {
            'success': success,
            'result': result_data or {},
            'completed_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        }
        self._make_request('POST', f'/api/v1/agent/commands/{command_id}/finish',
                         token=self.session_token, data=payload)

    def execute_command(self, command: Dict) -> Dict:
        cmd_type = command.get('type', '')
        params = command.get('params', {})
        command_id = command.get('id')

        logger.info(f"Executing command: {cmd_type}")

        if command_id:
            self.start_command(command_id)

        result = {'success': False, 'message': f'Unknown command: {cmd_type}'}

        if cmd_type == 'start':
            result = {'success': True, 'message': 'Hermes-agent runs continuously'}
        elif cmd_type == 'stop':
            result = {'success': True, 'message': 'Hermes-agent stop not supported via shim'}
        elif cmd_type == 'restart':
            result = {'success': True, 'message': 'Hermes-agent restart not supported via shim'}
        elif cmd_type == 'health_check':
            result = {'success': True, 'status': self._get_hermes_status()}
        elif cmd_type == 'install_skill':
            result = {'success': False, 'message': 'Skill install not yet implemented for hermes-agent'}

        if command_id:
            self.finish_command(command_id, result.get('success', False), result)

        return result

    def _get_hermes_status(self) -> str:
        pid = self._get_hermes_pid()
        return 'running' if pid else 'stopped'

    def _get_hermes_version(self) -> str:
        try:
            import subprocess
            result = subprocess.run(['hermes', '--version'], capture_output=True, text=True, timeout=5)
            if result.returncode == 0:
                return result.stdout.strip()
        except Exception:
            pass
        return 'unknown'

    def _get_skill_count(self) -> int:
        return 0

    def _get_disk_used(self) -> int:
        try:
            import shutil
            usage = shutil.disk_usage('/opt/data')
            return usage.used
        except Exception:
            return 0

    def _get_arch(self) -> str:
        try:
            import platform
            return platform.machine()
        except Exception:
            return 'unknown'

    def run(self):
        logger.info("Hermes Agent Shim starting...")

        if not self.base_url:
            logger.error("CLAWMANAGER_AGENT_BASE_URL not set, exiting")
            return

        if not self.registered:
            while not should_exit.is_set():
                if self.register():
                    break
                logger.warning("Registration failed, retrying in 10 seconds...")
                should_exit.wait(10)

        if should_exit.is_set():
            return

        logger.info("Entering main loop...")

        last_heartbeat = 0
        last_command_check = 0

        while not should_exit.is_set():
            now = time.time()

            if now - last_heartbeat >= self.heartbeat_interval:
                self.heartbeat()
                last_heartbeat = now

            if now - last_command_check >= self.command_poll_interval:
                cmd = self.get_next_command()
                if cmd:
                    self.execute_command(cmd)
                last_command_check = now

            should_exit.wait(1)

        logger.info("Shim exited gracefully")


def main():
    enabled = os.environ.get('CLAWMANAGER_AGENT_ENABLED', '').lower() == 'true'
    if not enabled:
        logger.info("ClawManager agent integration disabled (CLAWMANAGER_AGENT_ENABLED != true)")
        sys.exit(0)

    shim = ClawManagerShim()
    shim.run()


if __name__ == '__main__':
    main()
