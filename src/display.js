import chalk from 'chalk';
import Table from 'cli-table3';
import { classifyPort } from './safety.js';

// ── Theme ──────────────────────────────────────────────────
const theme = {
  brand:     chalk.hex('#A78BFA'),       // soft violet
  accent:    chalk.hex('#34D399'),       // emerald
  warn:      chalk.hex('#FBBF24'),       // amber
  danger:    chalk.hex('#F87171'),       // red
  muted:     chalk.hex('#6B7280'),       // gray-500
  dim:       chalk.dim,
  bold:      chalk.bold,
  port:      chalk.hex('#60A5FA').bold,  // sky-blue bold
  pid:       chalk.hex('#C084FC'),       // purple
  process:   chalk.hex('#F9A8D4'),       // pink
  user:      chalk.hex('#67E8F9'),       // cyan
  header:    chalk.hex('#A78BFA').bold.underline,
};

// ── Banner ─────────────────────────────────────────────────
export function printBanner() {
  const content = '  ⚓ killport  — port manager for devs  ';
  const border = '═'.repeat(displayWidth(content));
  const logo = `
  ${chalk.hex('#A78BFA')(`╔${border}╗`)}
  ${chalk.hex('#A78BFA')('║')}  ${chalk.hex('#C084FC').bold('⚓ killport')}  ${chalk.hex('#6B7280')('— port manager for devs')}  ${chalk.hex('#A78BFA')('║')}
  ${chalk.hex('#A78BFA')(`╚${border}╝`)}`;

  console.log(logo);
  console.log();
}

// ── Port Table ─────────────────────────────────────────────
const COMPACT_TABLE_COLUMNS = 70;

const tableLayouts = {
  compact: {
    mode: 'compact',
  },
  medium: {
    mode: 'table',
    colWidths: [5, 9, 9, 18, 13, 16, 7, 9],
    processWidth: 16,
    userWidth: 11,
    addressWidth: 14,
  },
  full: {
    mode: 'table',
    colWidths: [6, 10, 10, 22, 14, 20, 8, 10],
    processWidth: 20,
    userWidth: 12,
    addressWidth: 18,
  },
};

export function getPortTableLayout(columns = process.stdout.columns || 100) {
  if (columns < COMPACT_TABLE_COLUMNS) return tableLayouts.compact;
  if (columns < 110) return tableLayouts.medium;
  return tableLayouts.full;
}

export function printPortTable(ports, { columns } = {}) {
  if (ports.length === 0) {
    console.log(
      `  ${theme.accent('✓')} ${theme.bold('No listening ports found.')} Your machine is quiet.\n`
    );
    return;
  }

  const layout = getPortTableLayout(columns);
  if (layout.mode === 'compact') {
    printCompactPortTable(ports);
    return;
  }

  const table = new Table({
    head: [
      theme.header('#'),
      theme.header('PORT'),
      theme.header('PID'),
      theme.header('PROCESS'),
      theme.header('USER'),
      theme.header('ADDRESS'),
      theme.header('PROTO'),
      theme.header('TYPE'),
    ],
    chars: {
      'top':    '─', 'top-mid':    '┬', 'top-left':    '┌', 'top-right':    '┐',
      'bottom': '─', 'bottom-mid': '┴', 'bottom-left': '└', 'bottom-right': '┘',
      'left':   '│', 'left-mid':   '├', 'mid':         '─', 'mid-mid':      '┼',
      'right':  '│', 'right-mid':  '┤', 'middle':      '│',
    },
    style: {
      head: [],
      border: ['gray'],
      compact: false,
    },
    colWidths: layout.colWidths,
    truncate: '…',
    wordWrap: false,
  });

  ports.forEach((p, i) => {
    const portColor = p.port < 1024 ? theme.warn : theme.port;
    const safety = classifyPort(p);
    const safetyColor = safety.level === 'protected'
      ? theme.danger
      : safety.level === 'caution'
        ? theme.warn
        : theme.accent;

    table.push([
      theme.muted(`${i + 1}`),
      portColor(`:${p.port}`),
      theme.pid(`${p.pid}`),
      theme.process(truncate(p.process, layout.processWidth)),
      theme.user(truncate(p.user, layout.userWidth)),
      theme.dim(truncate(p.localAddress, layout.addressWidth)),
      theme.muted(p.protocol),
      safetyColor(safety.label),
    ]);
  });

  console.log(table.toString());
  console.log();

  // Legend
  console.log(
    `  ${theme.muted('ℹ')} ${theme.danger('system/priv')} are protected · ` +
    `${theme.warn('app/check')} means review before killing · ` +
    `${theme.muted(`${ports.length} port${ports.length === 1 ? '' : 's'} listening`)}`
  );
  console.log();
}

function printCompactPortTable(ports) {
  const lines = ports.map((p, i) => {
    const safety = classifyPort(p);
    const portColor = p.port < 1024 ? theme.warn : theme.port;
    const safetyColor = safety.level === 'protected'
      ? theme.danger
      : safety.level === 'caution'
        ? theme.warn
        : theme.accent;

    return [
      theme.muted(`${i + 1}`.padStart(2)),
      portColor(`:${p.port}`.padEnd(7)),
      theme.pid(`${p.pid}`.padEnd(7)),
      theme.process(truncate(p.process, 14).padEnd(14)),
      theme.user(truncate(p.user, 10).padEnd(10)),
      safetyColor(safety.label),
    ].join('  ');
  });

  console.log(lines.join('\n'));
  console.log();
  console.log(
    `  ${theme.muted('ℹ')} Compact view · ${theme.danger('system/priv')} protected · ` +
    `${theme.warn('app/check')} review first · ` +
    `${theme.muted(`${ports.length} port${ports.length === 1 ? '' : 's'} listening`)}`
  );
  console.log();
}

// ── Kill Result ────────────────────────────────────────────
export function printKillSuccess(port, pid, processName) {
  console.log(
    `\n  ${theme.accent('✓')} Killed ${theme.process(processName)} ` +
    `(PID ${theme.pid(pid)}) on port ${theme.port(`:${port}`)}\n`
  );
}

export function printKillError(port, pid, processName, error) {
  console.log(
    `\n  ${theme.danger('✗')} Failed to kill ${theme.process(processName)} ` +
    `(PID ${theme.pid(pid)}) on port ${theme.port(`:${port}`)}`
  );
  console.log(`    ${theme.muted(error)}\n`);
}

export function printForceKillPrompt() {
  return `  ${theme.warn('⚠')}  Process didn't exit. Force kill (SIGKILL)?`;
}

// ── Helpers ────────────────────────────────────────────────
function truncate(str, len) {
  if (str.length <= len) return str;
  return str.slice(0, len - 1) + '…';
}

function displayWidth(value) {
  return [...value].reduce((width, character) => width + (isWideCharacter(character) ? 2 : 1), 0);
}

function isWideCharacter(character) {
  const codePoint = character.codePointAt(0);
  return codePoint === 0x2693 || (codePoint >= 0x1F300 && codePoint <= 0x1FAFF);
}

export { theme };
