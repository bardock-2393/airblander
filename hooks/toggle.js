#!/usr/bin/env node
// airblander toggle — flip enforcement on/off for the current session
'use strict';

const fs = require('fs');
const path = require('path');
const { stateFile } = require('./state-path');

// session id passed by resolve.js as argv[2] so we hit the same per-session file
const STATE_FILE = stateFile(process.argv[2]);

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
