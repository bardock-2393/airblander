'use strict';
// resolve.js is now toggle-only: it reacts to "/airblander" and is silent otherwise.
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
  // toggle.js keys state by session id (argv); use a fixed id so we can read it back
  const sessionId = 'sess1';
  const stateFile = join(configDir, `airblander-state-${sessionId}.json`);
  if (state !== undefined) writeFileSync(stateFile, JSON.stringify(state));

  const result = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ prompt, session_id: sessionId }),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_CONFIG_DIR: configDir, CLAUDE_PLUGIN_ROOT: PLUGIN_ROOT },
  });

  let newState = null;
  try { newState = JSON.parse(readFileSync(stateFile, 'utf8')); } catch {}
  return { result, newState };
}

test('stays silent on a normal prompt', () => {
  const { result } = run('I need to build a Stripe payment form');
  assert.equal(result.status, 0);
  assert.equal(result.stdout, '');
});

test('/airblander toggles enforcement off', () => {
  const { result, newState } = run('/airblander', { enabled: true, cleared: {} });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /OFF/);
  assert.equal(newState?.enabled, false);
});

test('/airblander toggles enforcement back on', () => {
  const { result, newState } = run('/airblander', { enabled: false, cleared: {} });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /ON/);
  assert.equal(newState?.enabled, true);
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
