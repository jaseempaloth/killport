const SYSTEM_PROCESSES = new Set([
  'airplayxpchelper',
  'apsd',
  'bluetoothd',
  'configd',
  'controlce',
  'coreaudiod',
  'distnoted',
  'identityservicesd',
  'launchd',
  'mdnsresponder',
  'rapportd',
  'sharingd',
  'syslogd',
  'usereventagent',
]);

const APP_SUPPORT_PATTERNS = [
  'antigravi',
  'code helper',
  'electron',
  'firefox',
  'google',
  'language_',
  'safari',
];

const DEV_PROCESS_PATTERNS = [
  'bun',
  'cargo',
  'deno',
  'go',
  'java',
  'node',
  'php',
  'python',
  'rails',
  'ruby',
  'vite',
];

function processName(portEntry) {
  return String(portEntry.process || '').toLowerCase();
}

export function classifyPort(portEntry) {
  const name = processName(portEntry);

  if (portEntry.port < 1024) {
    return {
      level: 'protected',
      label: 'priv',
      reason: 'Privileged ports usually belong to system services.',
    };
  }

  if (SYSTEM_PROCESSES.has(name)) {
    return {
      level: 'protected',
      label: 'system',
      reason: `${portEntry.process} looks like a macOS system service.`,
    };
  }

  if (APP_SUPPORT_PATTERNS.some((pattern) => name.includes(pattern))) {
    return {
      level: 'caution',
      label: 'app',
      reason: `${portEntry.process} looks like an app support process, not a dev server.`,
    };
  }

  if (DEV_PROCESS_PATTERNS.some((pattern) => name.includes(pattern))) {
    return {
      level: 'normal',
      label: 'dev',
      reason: 'Common development server process.',
    };
  }

  return {
    level: 'caution',
    label: 'check',
    reason: 'Unknown process. Check the PID before killing it.',
  };
}

export function isProtectedPort(portEntry) {
  return classifyPort(portEntry).level === 'protected';
}
