#!/usr/bin/env node
// airblander UserPromptSubmit -- only handles the /airblander toggle. All gating is
// now done at write-time by detect.js against the per-project watchlist, so there is
// no noisy prompt-time scan output anymore.
'use strict';

const fs = require('fs');
const path = require('path');

const PLUGIN_ROOT = process.env.CLAUDE_PLUGIN_ROOT || path.join(__dirname, '..');

let hookInput;
try { hookInput = JSON.parse(fs.readFileSync(0, 'utf8')); }
catch { process.exit(0); }

const prompt = (hookInput.prompt || '').trim();

// /airblander flips enforcement -- delegate to toggle.js, pass session id so it
// writes the same per-session state file.
if (/^\/airblander\s*$/i.test(prompt)) {
  const { spawnSync } = require('child_process');
  const r = spawnSync(process.execPath,
    [path.join(PLUGIN_ROOT, 'hooks', 'toggle.js'), hookInput.session_id || ''],
    { encoding: 'utf8' });
  process.stdout.write(r.stdout || '');
}

process.exit(0);
