import { createRequire } from 'node:module';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import { getListeningPorts, killProcess, isProcessRunning } from './ports.js';
import { classifyPort, isProtectedPort } from './safety.js';
import {
  printBanner,
  printPortTable,
  printKillSuccess,
  printKillError,
  printForceKillPrompt,
  theme,
} from './display.js';

// ── Helpers ────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parsePort(value, flag) {
  const port = Number.parseInt(value, 10);
  if (!/^\d+$/.test(value) || port < 1 || port > 65535) {
    throw new Error(`${flag} must be a port number between 1 and 65535`);
  }
  return port;
}

export function parseArgs(args) {
  const flags = {
    help: false,
    version: false,
    port: null,   // --port <num> to filter
    kill: null,   // --kill <port> for non-interactive kill
    force: false, // --force with --kill
    json: false,  // --json for machine-readable output
    process: null, // --process <name> to filter by command name
    allowProtected: false, // allow direct kill of system/privileged ports
    errors: [],
  };

  try {
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg === '--help' || arg === '-h') flags.help = true;
      else if (arg === '--version' || arg === '-v') flags.version = true;
      else if (arg === '--json') flags.json = true;
      else if (arg === '--force' || arg === '-f') flags.force = true;
      else if (arg === '--allow-protected') flags.allowProtected = true;
      else if (arg === '--process' || arg === '--proc') {
        if (!args[i + 1]) throw new Error(`${arg} requires a process name`);
        flags.process = args[i + 1];
        i++;
      } else if (arg === '--port' || arg === '-p') {
        if (!args[i + 1]) throw new Error(`${arg} requires a port number`);
        flags.port = parsePort(args[i + 1], arg);
        i++;
      } else if (arg === '--kill' || arg === '-k') {
        if (!args[i + 1]) throw new Error(`${arg} requires a port number`);
        flags.kill = parsePort(args[i + 1], arg);
        i++;
      } else {
        throw new Error(`Unknown option: ${arg}`);
      }
    }
  } catch (err) {
    flags.errors.push(err.message);
  }

  if (flags.force && flags.kill === null) {
    flags.errors.push('--force can only be used with --kill');
  }

  if (flags.port !== null && flags.kill !== null && flags.port !== flags.kill) {
    flags.errors.push('--port and --kill must refer to the same port when used together');
  }

  return flags;
}

export function applyFilters(ports, flags) {
  let results = ports;
  if (flags.port !== null) {
    results = results.filter((p) => p.port === flags.port);
  }
  if (flags.process) {
    const needle = flags.process.toLowerCase();
    results = results.filter((p) => p.process.toLowerCase().includes(needle));
  }
  return results;
}

function printHelp() {
  console.log(`
  ${chalk.hex('#A78BFA').bold('killport')} — see every port in use, kill what you don't need.

    ${chalk.bold('USAGE')}
    ${chalk.hex('#6B7280')('$')} killport                ${chalk.hex('#6B7280')('# interactive mode')}
    ${chalk.hex('#6B7280')('$')} killport --port 3000    ${chalk.hex('#6B7280')('# filter by port')}
    ${chalk.hex('#6B7280')('$')} killport --process node ${chalk.hex('#6B7280')('# filter by process name')}
    ${chalk.hex('#6B7280')('$')} killport --kill 3000    ${chalk.hex('#6B7280')('# kill port directly')}
    ${chalk.hex('#6B7280')('$')} killport --json         ${chalk.hex('#6B7280')('# machine-readable output')}

  ${chalk.bold('OPTIONS')}
    -p, --port <num>    Filter results to a specific port
        --process <str> Filter results by process name (alias: --proc)
    -k, --kill <num>    Kill the process on a port (non-interactive)
    -f, --force         Force kill (SIGKILL) — use with --kill
        --allow-protected
                         Permit direct kill for protected system/privileged ports
        --json          Output as JSON
    -h, --help          Show this help
    -v, --version       Show version
  `);
}

// ── Interactive Kill Flow ──────────────────────────────────

export function resolveSelectedPort(selection, ports) {
  if (selection === -1) return null;
  const choiceNumber = typeof selection === 'string'
    ? Number.parseInt(selection, 10)
    : selection;

  if (!Number.isInteger(choiceNumber) || String(choiceNumber) !== String(selection).trim()) {
    return null;
  }

  return ports[choiceNumber - 1] ?? null;
}

export function parseMenuAction(value) {
  if (value === 'kill') return { type: 'killPrompt' };
  if (value === 'rescan') return { type: 'rescan' };
  return { type: 'exit' };
}

export function parseKillRowAction(value, ports) {
  const input = String(value ?? '').trim();
  if (!/^\d+$/.test(input)) {
    return { type: 'invalid', message: `Enter a row number from 1 to ${ports.length}.` };
  }

  const target = resolveSelectedPort(input, ports);
  if (!target) {
    return { type: 'invalid', message: `No row ${input}. Enter a number from 1 to ${ports.length}.` };
  }

  return { type: 'kill', target };
}

async function promptForAction(ports) {
  const { action } = await inquirer.prompt([{
    type: 'select',
    name: 'action',
    message: theme.brand('Choose an action'),
    choices: [
      { name: 'Kill a port', value: 'kill' },
      { name: 'Rescan', value: 'rescan' },
      { name: 'Exit', value: 'exit' },
    ],
    default: 'exit',
    loop: false,
  }]);

  const parsedAction = parseMenuAction(action);
  if (parsedAction.type !== 'killPrompt') return parsedAction;

  const { row } = await inquirer.prompt([{
    type: 'input',
    name: 'row',
    message: theme.brand('Enter row number to kill:'),
    validate(value) {
      const parsed = parseKillRowAction(value, ports);
      return parsed.type === 'invalid' ? parsed.message : true;
    },
  }]);

  return parseKillRowAction(row, ports);
}

async function interactiveKill(ports) {
  const action = await promptForAction(ports);

  if (action.type === 'exit') {
    console.log(`\n  ${theme.muted('👋 Bye!')}\n`);
    return 'exit';
  }

  if (action.type === 'rescan') {
    return 'rescan';
  }

  const target = action.target;

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `Kill ${theme.process(target.process)} (PID ${theme.pid(target.pid)}) on port ${theme.port(`:${target.port}`)}?`,
      default: false,
    },
  ]);

  if (!confirm) {
    console.log(`\n  ${theme.muted('Cancelled.')}\n`);
    return 'exit';
  }

  if (!(await confirmSafetyRisk(target))) {
    console.log(`\n  ${theme.muted('Left process running.')}\n`);
    return 'exit';
  }

  await performKill(target, false);
  return 'exit';
}

function formatSafetyBadge(portEntry) {
  const safety = classifyPort(portEntry);
  if (safety.level === 'normal') return '';

  const color = safety.level === 'protected' ? theme.danger : theme.warn;
  return color(`[${safety.label}]`);
}

async function confirmSafetyRisk(target) {
  const safety = classifyPort(target);
  if (safety.level === 'normal') return true;

  const { continueAnyway } = await inquirer.prompt([{
    type: 'confirm',
    name: 'continueAnyway',
    message: `${safety.reason} Continue anyway?`,
    default: false,
  }]);

  return continueAnyway;
}

async function performKill(target, force, { allowPrompt = true } = {}) {
  const spinner = ora({
    text: `Sending ${force ? 'SIGKILL' : 'SIGTERM'} to PID ${target.pid}...`,
    color: 'magenta',
  }).start();

  try {
    killProcess(target.pid, force);
    // Wait a moment for the process to exit
    await sleep(500);

    if (isProcessRunning(target.pid)) {
      spinner.warn('Process is still running...');

      if (!force) {
        if (!allowPrompt) {
          printKillError(
            target.port,
            target.pid,
            target.process,
            'Process is still running. Re-run with --force to send SIGKILL.'
          );
          return false;
        }

        const { forceKill } = await inquirer.prompt([{
          type: 'confirm',
          name: 'forceKill',
          message: printForceKillPrompt(),
          default: false,
        }]);

        if (forceKill) {
          return performKill(target, true);
        } else {
          console.log(`\n  ${theme.muted('Left process running.')}\n`);
          return false;
        }
      }

      printKillError(target.port, target.pid, target.process, 'Process is still running.');
      return false;
    }

    spinner.stop();
    printKillSuccess(target.port, target.pid, target.process);
    return true;
  } catch (err) {
    spinner.stop();
    const msg = err.message.includes('Operation not permitted')
      ? 'Permission denied. Try running with sudo.'
      : err.message;
    printKillError(target.port, target.pid, target.process, msg);
    return false;
  }
}

// ── Non-interactive Kill ───────────────────────────────────

async function directKill(ports, portNum, force, allowProtected) {
  const target = ports.find((p) => p.port === portNum);
  if (!target) {
    console.log(
      `\n  ${theme.danger('✗')} No process found listening on port ${theme.port(`:${portNum}`)}\n`
    );
    process.exit(1);
  }

  if (isProtectedPort(target) && !allowProtected) {
    const safety = classifyPort(target);
    console.log(
      `\n  ${theme.danger('✗')} Refusing to kill protected ${safety.label} process ` +
      `${theme.process(target.process)} (PID ${theme.pid(target.pid)}) on ${theme.port(`:${target.port}`)}`
    );
    console.log(`    ${theme.muted(`${safety.reason} Re-run with --allow-protected if you are sure.`)}\n`);
    process.exit(1);
  }

  const killed = await performKill(target, force, { allowPrompt: process.stdin.isTTY });
  if (!killed) process.exit(1);
}

// ── Main ───────────────────────────────────────────────────

export async function run() {
  const args = process.argv.slice(2);
  const flags = parseArgs(args);

  if (flags.errors.length > 0) {
    for (const error of flags.errors) {
      console.error(`  ${theme.danger('✗')} ${error}`);
    }
    console.error(`\n  Run ${theme.brand('killport --help')} for usage.\n`);
    process.exit(1);
  }

  // Version
  if (flags.version) {
    const require = createRequire(import.meta.url);
    const pkg = require('../package.json');
    console.log(`killport v${pkg.version}`);
    return;
  }

  // Help
  if (flags.help) {
    printHelp();
    return;
  }

  while (true) {
    // Scan ports
    const spinner = flags.json
      ? null
      : ora({
          text: 'Scanning ports...',
          color: 'magenta',
        }).start();

    let ports;
    try {
      ports = getListeningPorts();
    } catch (err) {
      if (spinner) spinner.fail(err.message);
      else console.error(err.message);
      process.exit(1);
    }

    if (spinner) spinner.stop();

    // Filter
    ports = applyFilters(ports, flags);

    // JSON mode
    if (flags.json) {
      console.log(JSON.stringify(ports, null, 2));
      return;
    }

    // Non-interactive kill
    if (flags.kill !== null) {
      await directKill(ports, flags.kill, flags.force, flags.allowProtected);
      return;
    }

    // Display
    printBanner();
    printPortTable(ports);

    // Interactive mode
    if (ports.length > 0 && process.stdin.isTTY) {
      const result = await interactiveKill(ports);
      if (result === 'rescan') {
        console.clear();
        continue;
      }
    }

    return;
  }
}
