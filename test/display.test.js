import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getPortTableLayout,
  printBanner,
  printPortTable,
} from '../src/display.js';

const samplePorts = [
  {
    port: 54764,
    pid: 36373,
    process: 'language_server_with_a_long_name',
    user: 'jaseempaloth',
    localAddress: '127.0.0.1',
    protocol: 'TCP',
  },
  {
    port: 64314,
    pid: 916,
    process: 'rapportd',
    user: 'jaseempaloth',
    localAddress: '0.0.0.0',
    protocol: 'TCP',
  },
];

test('getPortTableLayout switches to compact mode for narrow terminals', () => {
  assert.equal(getPortTableLayout(69).mode, 'compact');
  assert.equal(getPortTableLayout(96).mode, 'table');
  assert.deepEqual(getPortTableLayout(96).colWidths, [5, 9, 9, 18, 13, 16, 7, 9]);
  assert.deepEqual(getPortTableLayout(120).colWidths, [6, 10, 10, 22, 14, 20, 8, 10]);
});

test('printPortTable uses compact rows below the minimum table width', () => {
  const output = captureLogs(() => printPortTable(samplePorts, { columns: 60 }));

  assert.match(output, /Compact view/);
  assert.doesNotMatch(output, /ADDRESS/);
  assert.match(output, /language_serv…/);
});

test('printPortTable truncates table content instead of wrapping on resized terminals', () => {
  const output = captureLogs(() => printPortTable(samplePorts, { columns: 96 }));

  assert.match(output, /PROCESS/);
  assert.match(output, /language_server…/);
  assert.doesNotMatch(output, /long_name/);
});

test('printBanner uses matching top, body, and bottom widths', () => {
  const [top, body, bottom] = captureLogs(() => printBanner())
    .split('\n')
    .filter((line) => line.includes('╔') || line.includes('║') || line.includes('╚'));

  assert.equal(terminalWidth(top), terminalWidth(body));
  assert.equal(terminalWidth(body), terminalWidth(bottom));
  assert.equal(terminalWidth(top), 44);
});

function captureLogs(fn) {
  const originalLog = console.log;
  const lines = [];

  console.log = (...args) => {
    lines.push(args.join(' '));
  };

  try {
    fn();
  } finally {
    console.log = originalLog;
  }

  return lines.join('\n');
}

function terminalWidth(value) {
  return [...value].reduce((width, character) => {
    const codePoint = character.codePointAt(0);
    return width + (codePoint === 0x2693 || (codePoint >= 0x1F300 && codePoint <= 0x1FAFF) ? 2 : 1);
  }, 0);
}
