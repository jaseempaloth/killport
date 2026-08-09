import { execFileSync } from 'node:child_process';
import { platform } from 'node:os';

function parseEndpoint(endpoint) {
  const colonIdx = endpoint.lastIndexOf(':');
  if (colonIdx === -1) return null;

  let address = endpoint.substring(0, colonIdx) || '*';
  const port = Number.parseInt(endpoint.substring(colonIdx + 1), 10);
  if (!Number.isInteger(port)) return null;

  if (address.startsWith('[') && address.endsWith(']')) {
    address = address.slice(1, -1);
  }

  return {
    address: address === '*' || address === '::' ? '0.0.0.0' : address,
    port,
  };
}

function sortEntries(entries) {
  return entries.sort((a, b) => a.port - b.port || a.pid - b.pid);
}

/**
 * Parse lsof output on macOS/Linux to find all listening TCP ports.
 * Returns an array of { protocol, localAddress, port, pid, process, user, state }
 */
export function parseLsofOutput(output) {
  const lines = output.trim().split('\n');
  if (lines.length <= 1) return [];

  // Skip header line
  const entries = [];
  const seen = new Set();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    // lsof columns: COMMAND PID USER FD TYPE DEVICE SIZE/OFF NODE NAME
    const parts = line.trim().split(/\s+/);
    if (parts.length < 9) continue;

    const command = parts[0];
    const pid = Number.parseInt(parts[1], 10);
    const user = parts[2];
    const type = parts[4]; // IPv4 or IPv6
    if (!Number.isInteger(pid)) continue;

    // NAME is second-to-last when state like (LISTEN) is the last token.
    const lastPart = parts[parts.length - 1];
    const name = lastPart.startsWith('(') ? parts[parts.length - 2] : lastPart;
    const endpoint = parseEndpoint(name);
    if (!endpoint) continue;

    // De-duplicate by pid+port.
    const key = `${pid}:${endpoint.port}`;
    if (seen.has(key)) continue;
    seen.add(key);

    entries.push({
      protocol: type === 'IPv6' ? 'TCP6' : 'TCP',
      localAddress: endpoint.address,
      port: endpoint.port,
      pid,
      process: command,
      user,
      state: 'LISTEN',
    });
  }

  return sortEntries(entries);
}

function parseLsof() {
  try {
    // -iTCP: only TCP sockets
    // -sTCP:LISTEN: only LISTEN state
    // -P: don't resolve port names
    // -n: don't resolve hostnames
    const output = execFileSync('lsof', ['-iTCP', '-sTCP:LISTEN', '-P', '-n'], {
      encoding: 'utf-8',
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    return parseLsofOutput(output);
  } catch (err) {
    // lsof exits 1 when no matching sockets are found.
    if (err.status === 1) {
      return [];
    }
    throw err;
  }
}

/**
 * Parse netstat output on Linux as fallback.
 */
export function parseNetstatOutput(output) {
  const lines = output.trim().split('\n');
  const entries = [];
  const seen = new Set();

  for (const line of lines) {
    const match = line.match(
      /^(tcp6?)\s+\d+\s+\d+\s+(\S+)\s+\S+\s+LISTEN\s+(\d+)\/(\S+)/
    );
    if (!match) continue;

    const [, proto, localEndpoint, pidValue, process] = match;
    const endpoint = parseEndpoint(localEndpoint);
    const pid = Number.parseInt(pidValue, 10);
    if (!endpoint || !Number.isInteger(pid)) continue;

    const key = `${pid}:${endpoint.port}`;
    if (seen.has(key)) continue;
    seen.add(key);

    entries.push({
      protocol: proto === 'tcp6' ? 'TCP6' : 'TCP',
      localAddress: endpoint.address,
      port: endpoint.port,
      pid,
      process,
      user: '-',
      state: 'LISTEN',
    });
  }

  return sortEntries(entries);
}

export function parseSsOutput(output) {
  const lines = output.trim().split('\n');
  const entries = [];
  const seen = new Set();

  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts[0] !== 'LISTEN' || parts.length < 4) continue;

    const endpoint = parseEndpoint(parts[3]);
    const processInfo = parts.slice(5).join(' ');
    const processMatch = processInfo.match(/"([^"]+)",pid=(\d+)/);
    if (!endpoint || !processMatch) continue;

    const [, process, pidValue] = processMatch;
    const pid = Number.parseInt(pidValue, 10);
    if (!Number.isInteger(pid)) continue;

    const key = `${pid}:${endpoint.port}`;
    if (seen.has(key)) continue;
    seen.add(key);

    entries.push({
      protocol: parts[3].includes('[') || parts[3].includes('::') ? 'TCP6' : 'TCP',
      localAddress: endpoint.address,
      port: endpoint.port,
      pid,
      process,
      user: '-',
      state: 'LISTEN',
    });
  }

  return sortEntries(entries);
}

function parseNetstat() {
  try {
    const output = execFileSync('netstat', ['-tlnp'], {
      encoding: 'utf-8',
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return parseNetstatOutput(output);
  } catch {
    const output = execFileSync('ss', ['-Htlnp'], {
      encoding: 'utf-8',
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return parseSsOutput(output);
  }
}

/**
 * Get all listening ports on the machine.
 */
export function getListeningPorts() {
  const os = platform();

  if (os === 'darwin' || os === 'linux') {
    try {
      const ports = parseLsof();
      if (ports.length > 0) return ports;
      if (os === 'linux') return parseNetstat();
      return ports;
    } catch (err) {
      if (os === 'linux') return parseNetstat();
      throw new Error(`Failed to scan ports with lsof: ${err.message}`);
    }
  }

  throw new Error(`Unsupported platform: ${os}. killport supports macOS and Linux.`);
}

function assertPositiveInteger(value, label) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new TypeError(`${label} must be a positive integer`);
  }
}

/**
 * Kill a process by PID.
 * @param {number} pid
 * @param {boolean} force - Use SIGKILL instead of SIGTERM
 */
export function killProcess(pid, force = false) {
  assertPositiveInteger(pid, 'pid');
  process.kill(pid, force ? 'SIGKILL' : 'SIGTERM');
}

/**
 * Check if a PID is still running.
 */
export function isProcessRunning(pid) {
  assertPositiveInteger(pid, 'pid');
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    if (err.code === 'EPERM') return true;
    return false;
  }
}
