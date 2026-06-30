'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('child_process');
const { mkdtempSync, writeFileSync, readFileSync } = require('fs');
const { join } = require('path');
const { tmpdir } = require('os');
const { makeProject } = require('./fixture');

const PLUGIN_ROOT = join(__dirname, '..');
const HOOK = join(PLUGIN_ROOT, 'hooks', 'clear.js');
const PROJECT = makeProject(['twilio', 'stripe']);

const BLANK_STATE = { enabled: true, cleared: {} };

function run(payload, state = BLANK_STATE) {
  const configDir = mkdtempSync(join(tmpdir(), 'ab-clear-'));
  const stateFile = join(configDir, 'airblander-state.json');
  writeFileSync(stateFile, JSON.stringify(state));

  const result = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ cwd: PROJECT, ...payload }),
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

test('does not clear an SDK not in this project watchlist', () => {
  // openai isn't in PROJECT (only twilio+stripe) -> fetching its docs clears nothing
  const { newState } = run({
    tool_name: 'WebFetch',
    tool_input: { url: 'https://platform.openai.com/docs' },
  });
  assert.ok(!newState?.cleared?.openai);
});

test('does not overwrite already-cleared timestamp', () => {
  const { newState } = run(
    { tool_name: 'WebFetch', tool_input: { url: 'https://www.twilio.com/docs' } },
    { enabled: true, cleared: { twilio: 1000 } },
  );
  assert.equal(newState?.cleared?.twilio, 1000);
});

test('does NOT clear when SDK name is only in the URL path, not the domain (#6)', () => {
  const { newState } = run({
    tool_name: 'WebFetch',
    tool_input: { url: 'https://someblog.com/2024/twilio-tutorial-best-practices' },
  });
  assert.ok(!newState?.cleared?.twilio, 'a blog with twilio in the path must not clear twilio');
});

test('does NOT clear when the fetch failed, even on the canonical domain (#1)', () => {
  const { newState } = run({
    tool_name: 'WebFetch',
    tool_input: { url: 'https://stripe.com/docs/api/payment_intents' },
    tool_response: 'Failed to fetch the page: 404 Not Found',
  });
  assert.ok(!newState?.cleared?.stripe, 'a failed fetch must not clear stripe');
});

test('still clears on canonical domain when fetch succeeded (#1 regression)', () => {
  const { newState } = run({
    tool_name: 'WebFetch',
    tool_input: { url: 'https://stripe.com/docs/api/payment_intents' },
    tool_response: '# Stripe API Reference\nThe PaymentIntents API lets you ...(real docs body)...',
  });
  assert.ok(newState?.cleared?.stripe);
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
