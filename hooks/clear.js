#!/usr/bin/env node
// airblander PostToolUse — marks an SDK as docs-cleared when a matching fetch succeeds
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const PLUGIN_ROOT = process.env.CLAUDE_PLUGIN_ROOT || path.join(__dirname, '..');
const CONFIG_DIR = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const STATE_FILE = path.join(CONFIG_DIR, 'airblander-state.json');
const WATCHLIST_FILE = path.join(PLUGIN_ROOT, 'config', 'watchlist.json');

function readState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); }
  catch { return { cleared: {} }; }
}

function writeState(state) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

let raw;
try { raw = fs.readFileSync(0, 'utf8'); }
catch { process.exit(0); }

let input;
try { input = JSON.parse(raw); }
catch { process.exit(0); }

let watchlist;
try { watchlist = JSON.parse(fs.readFileSync(WATCHLIST_FILE, 'utf8')); }
catch { process.exit(0); }

const { tool_name, tool_input } = input;

// Build the target string: URL for WebFetch, all string values for context7 tools
let target = '';
if (tool_name === 'WebFetch') {
  target = tool_input.url || '';
} else {
  // mcp__context7__* — stringify all input values for pattern matching
  target = Object.values(tool_input || {})
    .filter(v => typeof v === 'string')
    .join(' ');
}

if (!target) process.exit(0);

const state = readState();
let updated = false;

// v1: check static watchlist docsDomains
for (const sdk of watchlist.sdks) {
  if (state.cleared?.[sdk.name]) continue;
  if (sdk.docsDomains.some(d => new RegExp(d, 'i').test(target))) {
    if (!state.cleared) state.cleared = {};
    state.cleared[sdk.name] = Date.now();
    updated = true;
  }
}

// v2: check dynamic SDKs from resolve.js prompt-time scan
const dynamicSDKs = state.scoped?.dynamicSDKs || [];
for (const dSdk of dynamicSDKs) {
  if (state.cleared?.[dSdk.name]) continue;
  // ponytail: simple substring match — the domainHint is the slug (e.g. "stripe")
  if (new RegExp(dSdk.domainHint, 'i').test(target)) {
    if (!state.cleared) state.cleared = {};
    state.cleared[dSdk.name] = Date.now();
    updated = true;
  }
}

if (updated) writeState(state);
process.exit(0);
