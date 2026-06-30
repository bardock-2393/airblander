#!/usr/bin/env node
// airblander toggle — flip enforcement on/off for the current session
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const CONFIG_DIR = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const STATE_FILE = path.join(CONFIG_DIR, 'airblander-state.json');

function readState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); }
  catch { return { cleared: {}, enabled: true }; }
}

function writeState(state) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

const state = readState();
// enabled defaults to true when absent
state.enabled = state.enabled === false ? true : false;
writeState(state);

if (state.enabled) {
  console.log('airblander: ON — enforcement active. Writes to SDK files will be blocked until docs are fetched.');
} else {
  console.log('airblander: OFF — enforcement paused for this session. All writes allowed.');
  console.log('Run /airblander again to re-enable.');
}
