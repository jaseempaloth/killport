import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseLsofOutput,
  parseNetstatOutput,
  parseSsOutput,
} from '../src/ports.js';

test('parseLsofOutput parses and de-duplicates listening ports', () => {
  const output = `
COMMAND   PID USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
node    12345 dev   22u  IPv4 0xabc123        0t0  TCP *:3000 (LISTEN)
node    12345 dev   23u  IPv6 0xabc456        0t0  TCP *:3000 (LISTEN)
postgres 999 dev    7u  IPv4 0xabc789        0t0  TCP 127.0.0.1:5432 (LISTEN)
`;

  assert.deepEqual(parseLsofOutput(output), [
    {
      protocol: 'TCP',
      localAddress: '0.0.0.0',
      port: 3000,
      pid: 12345,
      process: 'node',
      user: 'dev',
      state: 'LISTEN',
    },
    {
      protocol: 'TCP',
      localAddress: '127.0.0.1',
      port: 5432,
      pid: 999,
      process: 'postgres',
      user: 'dev',
      state: 'LISTEN',
    },
  ]);
});

test('parseNetstatOutput parses linux netstat output', () => {
  const output = `
Proto Recv-Q Send-Q Local Address           Foreign Address         State       PID/Program name
tcp        0      0 0.0.0.0:3000            0.0.0.0:*               LISTEN      12345/node
tcp6       0      0 :::8080                 :::*                    LISTEN      23456/java
`;

  assert.deepEqual(parseNetstatOutput(output), [
    {
      protocol: 'TCP',
      localAddress: '0.0.0.0',
      port: 3000,
      pid: 12345,
      process: 'node',
      user: '-',
      state: 'LISTEN',
    },
    {
      protocol: 'TCP6',
      localAddress: '0.0.0.0',
      port: 8080,
      pid: 23456,
      process: 'java',
      user: '-',
      state: 'LISTEN',
    },
  ]);
});

test('parseSsOutput parses linux ss output', () => {
  const output = `
LISTEN 0      511      0.0.0.0:3000      0.0.0.0:*    users:(("node",pid=12345,fd=22))
LISTEN 0      128         [::1]:5432         [::]:*    users:(("postgres",pid=999,fd=7))
`;

  assert.deepEqual(parseSsOutput(output), [
    {
      protocol: 'TCP',
      localAddress: '0.0.0.0',
      port: 3000,
      pid: 12345,
      process: 'node',
      user: '-',
      state: 'LISTEN',
    },
    {
      protocol: 'TCP6',
      localAddress: '::1',
      port: 5432,
      pid: 999,
      process: 'postgres',
      user: '-',
      state: 'LISTEN',
    },
  ]);
});
