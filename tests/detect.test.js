'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('child_process');
const { mkdtempSync, writeFileSync, mkdirSync } = require('fs');
const { join } = require('path');
const { tmpdir } = require('os');

const PLUGIN_ROOT = join(__dirname, '..');
const HOOK = join(PLUGIN_ROOT, 'hooks', 'detect.js');

function run(payload, state) {
  const configDir = mkdtempSync(join(tmpdir(), 'ab-detect-'));
  if (state !== undefined) {
    writeFileSync(join(configDir, 'airblander-state.json'), JSON.stringify(state));
  }
  return spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_CONFIG_DIR: configDir, CLAUDE_PLUGIN_ROOT: PLUGIN_ROOT },
  });
}

test('blocks twilio import when not cleared', () => {
  const r = run({
    tool_name: 'Write',
    tool_input: { file_path: 'index.js', content: "import twilio from 'twilio'\nconst client = twilio(sid, auth)" },
  });
  assert.equal(r.status, 2);
  assert.match(r.stdout, /BLOCKED/);
  assert.match(r.stdout, /twilio/i);
});

test('passes when twilio is cleared', () => {
  const r = run(
    { tool_name: 'Write', tool_input: { file_path: 'index.js', content: "import twilio from 'twilio'" } },
    { enabled: true, cleared: { twilio: Date.now() } },
  );
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
});

test('passes when enforcement disabled', () => {
  const r = run(
    { tool_name: 'Write', tool_input: { file_path: 'index.js', content: "import twilio from 'twilio'" } },
    { enabled: false, cleared: {} },
  );
  assert.equal(r.status, 0);
});

test('passes non-SDK content', () => {
  const r = run({ tool_name: 'Write', tool_input: { file_path: 'index.js', content: "console.log('hello world')" } });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
});

test('ignores Bash tool (bypass path)', () => {
  const r = run({
    tool_name: 'Bash',
    tool_input: { command: "echo \"import twilio from 'twilio'\" > index.js" },
  });
  // ponytail: this is a known gap — Bash writes bypass the hook
  assert.equal(r.status, 0);
});

test('checks Edit tool new_string', () => {
  const r = run({
    tool_name: 'Edit',
    tool_input: { file_path: 'index.js', old_string: '', new_string: "from 'twilio'" },
  });
  assert.equal(r.status, 2);
  assert.match(r.stdout, /BLOCKED/);
});

test('checks MultiEdit tool edits array', () => {
  const r = run({
    tool_name: 'MultiEdit',
    tool_input: {
      file_path: 'index.js',
      edits: [{ old_string: '', new_string: "import Stripe from 'stripe'" }],
    },
  });
  assert.equal(r.status, 2);
  assert.match(r.stdout, /stripe/i);
});

test('blocks dynamic SDK from state', () => {
  const r = run(
    { tool_name: 'Write', tool_input: { file_path: 'index.js', content: "import resend from 'resend'" } },
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
  assert.equal(r.status, 2);
  assert.match(r.stdout, /Resend/i);
});

test('blocks multiple SDKs in one write', () => {
  const r = run({
    tool_name: 'Write',
    tool_input: { file_path: 'index.js', content: "import twilio from 'twilio'\nimport Stripe from 'stripe'" },
  });
  assert.equal(r.status, 2);
  assert.match(r.stdout, /twilio/i);
  assert.match(r.stdout, /stripe/i);
});

test('passes empty content', () => {
  const r = run({ tool_name: 'Write', tool_input: { file_path: 'index.js', content: '' } });
  assert.equal(r.status, 0);
});

test('blocks an edit whose diff has no import but the file on disk imports the SDK (#3)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ab-edit-'));
  const file = join(dir, 'app.js');
  writeFileSync(file, "import twilio from 'twilio'\n\nfunction send(to) {\n  return to.trim()\n}\n");
  // The diff fragment itself is innocent — no import line — but the file uses twilio.
  const r = run({
    tool_name: 'Edit',
    tool_input: { file_path: file, old_string: 'return to.trim()', new_string: 'return to.trim().toLowerCase()' },
  });
  assert.equal(r.status, 2, 'editing a file that imports an uncleared SDK should be gated');
  assert.match(r.stdout, /twilio/i);
});

test('still passes an edit to a non-SDK file (#3 regression)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ab-edit-'));
  const file = join(dir, 'util.js');
  writeFileSync(file, "export function add(a, b) {\n  return a + b\n}\n");
  const r = run({
    tool_name: 'Edit',
    tool_input: { file_path: file, old_string: 'a + b', new_string: 'a + b + 0' },
  });
  assert.equal(r.status, 0);
});

test('passes malformed stdin gracefully', () => {
  const configDir = mkdtempSync(join(tmpdir(), 'ab-detect-'));
  const r = spawnSync(process.execPath, [HOOK], {
    input: 'not-json',
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_CONFIG_DIR: configDir, CLAUDE_PLUGIN_ROOT: PLUGIN_ROOT },
  });
  assert.equal(r.status, 0); // fail-open on parse error
});
