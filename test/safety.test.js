import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyPort, isProtectedPort } from '../src/safety.js';

test('classifyPort protects privileged ports', () => {
  const safety = classifyPort({ port: 80, process: 'node' });

  assert.equal(safety.level, 'protected');
  assert.equal(safety.label, 'priv');
});

test('classifyPort protects known macOS system services', () => {
  const entry = { port: 5000, process: 'ControlCe' };

  assert.equal(classifyPort(entry).level, 'protected');
  assert.equal(classifyPort(entry).label, 'system');
  assert.equal(isProtectedPort(entry), true);
});

test('classifyPort marks app support processes as caution', () => {
  const safety = classifyPort({ port: 9222, process: 'Google' });

  assert.equal(safety.level, 'caution');
  assert.equal(safety.label, 'app');
});

test('classifyPort marks common dev servers as normal', () => {
  const safety = classifyPort({ port: 3000, process: 'node' });

  assert.equal(safety.level, 'normal');
  assert.equal(safety.label, 'dev');
});
