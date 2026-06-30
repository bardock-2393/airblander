'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('child_process');
const { mkdtempSync, writeFileSync, readFileSync } = require('fs');
const { join } = require('path');
const { tmpdir } = require('os');

const PLUGIN_ROOT = join(__dirname, '..');
const HOOK = join(PLUGIN_ROOT, 'hooks', 'clear.js');

const BLANK_STATE = { enabled: true, cleared: {}, scoped: { pending: [], dynamicSDKs: [], clarifications: {} } };

function run(payload, state = BLANK_STATE) {
  const configDir = mkdtempSync(join(tmpdir(), 'ab-clear-'));
  const stateFile = join(configDir, 'airblander-state.json');
  writeFileSync(stateFile, JSON.stringify(state));

  const result = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_CONFIG_DIR: configDir, CLAUDE_PLUGIN_ROOT: PLUGIN_ROOT },
  });

  let newState = null;
  try { newState = JSON.parse(readFileSync(stateFile, 'utf8')); } catch {}
  return { result, newState };
}

test('clears twilio on matching WebFetch URL', () => {
  const { result, newState } = run({
    tool_name: 'WebFetch',
    tool_input: { url: 'https://www.twilio.com/docs/sms' },
  });
  assert.equal(result.status, 0);
  assert.ok(newState?.cleared?.twilio, 'twilio should be marked cleared');
});

test('does not clear on unrelated URL', () => {
  const { newState } = run({
    tool_name: 'WebFetch',
    tool_input: { url: 'https://example.com/unrelated-page' },
  });
  assert.equal(Object.keys(newState?.cleared || {}).length, 0);
});

test('clears twilio via context7 tool libraryName', () => {
  const { result, newState } = run({
    tool_name: 'mcp__context7__get-library-docs',
    tool_input: { libraryName: 'twilio', context7CompatibleLibraryID: '/twilio/twilio-node' },
  });
  assert.equal(result.status, 0);
  assert.ok(newState?.cleared?.twilio);
});

test('clears stripe on matching WebFetch URL', () => {
  const { newState } = run({
    tool_name: 'WebFetch',
    tool_input: { url: 'https://stripe.com/docs/api/payment_intents' },
  });
  assert.ok(newState?.cleared?.stripe);
});

test('clears dynamic SDK on domainHint URL match', () => {
  const { newState } = run(
    { tool_name: 'WebFetch', tool_input: { url: 'https://resend.com/docs/api-reference' } },
    {
      enabled: true,
      cleared: {},
      scoped: {
        pending: ['resend'],
        dynamicSDKs: [{ name: 'resend', domainHint: 'resend', displayName: 'Resend' }],
        clarifications: {},
      },
    },
  );
  assert.ok(newState?.cleared?.resend);
});

test('does not overwrite already-cleared timestamp', () => {
  const { newState } = run(
    { tool_name: 'WebFetch', tool_input: { url: 'https://www.twilio.com/docs' } },
    { enabled: true, cleared: { twilio: 1000 } },
  );
  // already cleared — skip condition means we don't touch it
  assert.equal(newState?.cleared?.twilio, 1000);
});

test('always exits 0', () => {
  const { result } = run({ tool_name: 'WebFetch', tool_input: { url: 'https://x.com' } });
  assert.equal(result.status, 0);
});

test('exits 0 on malformed stdin', () => {
  const configDir = mkdtempSync(join(tmpdir(), 'ab-clear-'));
  const r = spawnSync(process.execPath, [HOOK], {
    input: 'bad-json',
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_CONFIG_DIR: configDir, CLAUDE_PLUGIN_ROOT: PLUGIN_ROOT },
  });
  assert.equal(r.status, 0);
});
