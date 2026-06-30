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

const { tool_name, tool_input, tool_response } = input;
const isWebFetch = tool_name === 'WebFetch';

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// A fetch only clears docs if it actually succeeded. A 404/DNS-fail/empty body
// must NOT unblock writes (the old "WebFetch a 404 clears it" hole).
// ponytail: no tool_response (e.g. context7) → can't judge, don't veto.
function fetchFailed(resp) {
  if (resp == null) return false;
  const s = typeof resp === 'string' ? resp : JSON.stringify(resp);
  if (s.trim().length === 0) return true;
  return /failed to fetch|could not (?:fetch|retrieve|resolve|load)|unable to (?:fetch|retrieve|access|load)|request failed|fetch failed|page not found|no results found|err_name_not_resolved|enotfound|getaddrinfo/i.test(s);
}

// WebFetch evidence is the URL; context7 evidence is the resolved library id/name.
let url = '';
let slugTarget = '';
if (isWebFetch) {
  url = tool_input.url || '';
  if (!url) process.exit(0);
  if (fetchFailed(tool_response)) {
    process.stdout.write('airblander: fetch looked unsuccessful — not clearing. Re-fetch the canonical docs URL.');
    process.exit(0);
  }
} else {
  // mcp__context7__* — stringify all input values for pattern matching
  slugTarget = Object.values(tool_input || {})
    .filter(v => typeof v === 'string')
    .join(' ');
  if (!slugTarget) process.exit(0);
}

// For WebFetch, only canonical domain patterns count (entries with a dot, e.g.
// "twilio\.com") — a blog/SO page with "twilio" in the path no longer clears.
// For context7, a name/slug match is legitimate: you resolved that library by id.
function matchesStatic(sdk) {
  if (isWebFetch) {
    return sdk.docsDomains.filter(d => d.includes('.')).some(d => new RegExp(d, 'i').test(url));
  }
  return sdk.docsDomains.some(d => new RegExp(d, 'i').test(slugTarget));
}

function matchesDynamic(dSdk) {
  const hint = escapeRegex(dSdk.domainHint);
  // WebFetch: hint must be a domain label (resend.com), not any path substring.
  if (isWebFetch) return new RegExp(hint + '\\.', 'i').test(url);
  return new RegExp(hint, 'i').test(slugTarget);
}

const state = readState();
const newlyCleared = [];

// v1: check static watchlist SDKs
for (const sdk of watchlist.sdks) {
  if (state.cleared?.[sdk.name]) continue;
  if (matchesStatic(sdk)) {
    if (!state.cleared) state.cleared = {};
    state.cleared[sdk.name] = Date.now();
    newlyCleared.push(sdk.name);
  }
}

// v2: check dynamic SDKs from resolve.js prompt-time scan
const dynamicSDKs = state.scoped?.dynamicSDKs || [];
for (const dSdk of dynamicSDKs) {
  if (state.cleared?.[dSdk.name]) continue;
  if (matchesDynamic(dSdk)) {
    if (!state.cleared) state.cleared = {};
    state.cleared[dSdk.name] = Date.now();
    newlyCleared.push(dSdk.displayName || dSdk.name);
  }
}

if (newlyCleared.length > 0) {
  writeState(state);
  process.stdout.write(`airblander: ✓ ${newlyCleared.join(', ')} cleared — writes unblocked`);
}
process.exit(0);
