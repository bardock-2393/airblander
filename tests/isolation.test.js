'use strict';
// Proves concurrent sessions get separate state files: clearing an SDK in session A
// must NOT unblock the same write in session B.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('child_process');
const { mkdtempSync } = require('fs');
const { join } = require('path');
const { tmpdir } = require('os');
const { makeProject } = require('./fixture');

const PLUGIN_ROOT = join(__dirname, '..');
const DETECT = join(PLUGIN_ROOT, 'hooks', 'detect.js');
const CLEAR = join(PLUGIN_ROOT, 'hooks', 'clear.js');
const PROJECT = makeProject(['stripe']);

function runHook(hook, payload, configDir) {
  return spawnSync(process.execPath, [hook], {
    input: JSON.stringify({ cwd: PROJECT, ...payload }),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_CONFIG_DIR: configDir, CLAUDE_PLUGIN_ROOT: PLUGIN_ROOT },
  });
}

test('clearing stripe in session A does not unblock session B', () => {
  const configDir = mkdtempSync(join(tmpdir(), 'ab-iso-'));
  const write = { tool_name: 'Write', tool_input: { file_path: 'pay.js', content: "import stripe from 'stripe'" } };

  runHook(CLEAR, {
    session_id: 'A',
    tool_name: 'WebFetch',
    tool_input: { url: 'https://stripe.com/docs' },
    tool_response: 'Stripe API reference ...',
  }, configDir);

  assert.equal(runHook(DETECT, { ...write, session_id: 'A' }, configDir).status, 0);
  assert.equal(runHook(DETECT, { ...write, session_id: 'B' }, configDir).status, 2);
});
