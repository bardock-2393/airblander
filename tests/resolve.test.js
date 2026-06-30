'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('child_process');
const { mkdtempSync, writeFileSync, readFileSync } = require('fs');
const { join } = require('path');
const { tmpdir } = require('os');

const PLUGIN_ROOT = join(__dirname, '..');
const HOOK = join(PLUGIN_ROOT, 'hooks', 'resolve.js');

function run(prompt, state) {
  const configDir = mkdtempSync(join(tmpdir(), 'ab-resolve-'));
  const stateFile = join(configDir, 'airblander-state.json');
  if (state !== undefined) writeFileSync(stateFile, JSON.stringify(state));

  const result = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ prompt }),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_CONFIG_DIR: configDir, CLAUDE_PLUGIN_ROOT: PLUGIN_ROOT },
  });

  let newState = null;
  try { newState = JSON.parse(readFileSync(stateFile, 'utf8')); } catch {}
  return { result, newState };
}

test('detects known SDK (stripe) and adds to pending', () => {
  const { result, newState } = run('I need to build a Stripe payment form');
  assert.equal(result.status, 0);
  assert.match(result.stdout, /stripe/i);
  assert.ok(newState?.scoped?.pending?.includes('stripe'));
});

test('detects known SDK (twilio) in prompt', () => {
  const { result, newState } = run('send an SMS via Twilio to +15005550006');
  assert.equal(result.status, 0);
  assert.match(result.stdout, /twilio/i);
  assert.ok(newState?.scoped?.pending?.includes('twilio'));
});

test('detects unknown service and creates dynamic SDK entry', () => {
  const { result, newState } = run('use Resend to send transactional emails from my app');
  assert.equal(result.status, 0);
  assert.match(result.stdout, /unknown/i);
  const dynSDKs = newState?.scoped?.dynamicSDKs || [];
  assert.ok(dynSDKs.some(d => d.domainHint === 'resend' || (d.name || '').includes('resend')));
});

test('exits 0 with no output for generic prompt', () => {
  const { result } = run('write a hello world function in Python');
  assert.equal(result.status, 0);
  assert.equal(result.stdout, '');
});

test('/airblander toggles enforcement off', () => {
  const { result, newState } = run('/airblander', { enabled: true, cleared: {} });
  assert.equal(result.status, 0);
  assert.equal(newState?.enabled, false);
  assert.match(result.stdout, /OFF/i);
});

test('/airblander toggles enforcement back on', () => {
  const { result, newState } = run('/airblander', { enabled: false, cleared: {} });
  assert.equal(result.status, 0);
  assert.equal(newState?.enabled, true);
  assert.match(result.stdout, /ON/i);
});

test('marks known SDK already cleared in output', () => {
  const { result } = run('integrate Stripe payments', {
    enabled: true,
    cleared: { stripe: Date.now() },
    scoped: { pending: [], dynamicSDKs: [], clarifications: {} },
  });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /already (cleared|fetched)/i);
});

test('detects multiple SDKs in one prompt', () => {
  const { result, newState } = run('send SMS via Twilio and charge customers with Stripe');
  assert.equal(result.status, 0);
  assert.match(result.stdout, /twilio/i);
  assert.match(result.stdout, /stripe/i);
  const pending = newState?.scoped?.pending || [];
  assert.ok(pending.includes('twilio'));
  assert.ok(pending.includes('stripe'));
});

test('exits 0 on malformed stdin', () => {
  const configDir = mkdtempSync(join(tmpdir(), 'ab-resolve-'));
  const r = spawnSync(process.execPath, [HOOK], {
    input: 'not-json',
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_CONFIG_DIR: configDir, CLAUDE_PLUGIN_ROOT: PLUGIN_ROOT },
  });
  assert.equal(r.status, 0);
});
