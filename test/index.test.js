import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import {
  applyFilters,
  parseArgs,
  parseKillRowAction,
  parseMenuAction,
  resolveSelectedPort,
} from '../src/index.js';

test('parseArgs accepts port, process, and json flags', () => {
  const flags = parseArgs(['--port', '3000', '--process', 'node', '--json', '--allow-protected']);

  assert.equal(flags.port, 3000);
  assert.equal(flags.process, 'node');
  assert.equal(flags.json, true);
  assert.equal(flags.allowProtected, true);
  assert.deepEqual(flags.errors, []);
});

test('parseArgs rejects invalid ports', () => {
  const flags = parseArgs(['--kill', 'not-a-port']);

  assert.equal(flags.kill, null);
  assert.match(flags.errors[0], /--kill must be a port number/);
});

test('parseArgs rejects conflicting port and kill values', () => {
  const flags = parseArgs(['--port', '3000', '--kill', '8080']);

  assert.deepEqual(flags.errors, [
    '--port and --kill must refer to the same port when used together',
  ]);
});

test('applyFilters filters by port and process name', () => {
  const ports = [
    { port: 3000, process: 'node' },
    { port: 3000, process: 'postgres' },
    { port: 8080, process: 'node' },
  ];

  assert.deepEqual(
    applyFilters(ports, { port: 3000, process: 'NODE' }),
    [{ port: 3000, process: 'node' }]
  );
});

test('resolveSelectedPort maps one-based prompt choices to ports', () => {
  const ports = [
    { port: 3000, process: 'node' },
    { port: 5000, process: 'ControlCe' },
  ];

  assert.deepEqual(resolveSelectedPort(1, ports), ports[0]);
  assert.deepEqual(resolveSelectedPort('1', ports), ports[0]);
  assert.deepEqual(resolveSelectedPort(2, ports), ports[1]);
  assert.equal(resolveSelectedPort(-1, ports), null);
  assert.equal(resolveSelectedPort(99, ports), null);
  assert.equal(resolveSelectedPort('1abc', ports), null);
});

test('parseMenuAction supports guided menu actions', () => {
  assert.deepEqual(parseMenuAction('kill'), { type: 'killPrompt' });
  assert.deepEqual(parseMenuAction('rescan'), { type: 'rescan' });
  assert.deepEqual(parseMenuAction('exit'), { type: 'exit' });
});

test('parseKillRowAction maps row numbers to kill actions', () => {
  const ports = [
    { port: 3000, process: 'node' },
    { port: 5000, process: 'ControlCe' },
  ];

  assert.deepEqual(parseKillRowAction('1', ports), { type: 'kill', target: ports[0] });
  assert.equal(parseKillRowAction('', ports).type, 'invalid');
  assert.equal(parseKillRowAction('99', ports).type, 'invalid');
  assert.equal(parseKillRowAction('wat', ports).type, 'invalid');
});

test('json mode writes parseable JSON without spinner text', () => {
  const result = spawnSync(process.execPath, ['bin/killport.js', '--json'], {
    cwd: process.cwd(),
    encoding: 'utf-8',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout, /Scanning ports/);
  assert.ok(Array.isArray(JSON.parse(result.stdout)));
});

test('table mode does not prompt when stdin is not interactive', () => {
  const result = spawnSync(process.execPath, ['bin/killport.js', '--process', 'node'], {
    cwd: process.cwd(),
    encoding: 'utf-8',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stderr, /ExitPromptError/);
});
