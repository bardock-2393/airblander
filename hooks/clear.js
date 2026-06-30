#!/usr/bin/env node
// airblander PostToolUse -- marks a watched SDK as docs-cleared when a matching
// docs fetch (WebFetch or Context7) succeeds. Watchlist is per-project.
'use strict';

const fs = require('fs');
const path = require('path');
const { stateFile } = require('./state-path');
const { loadWatchlist } = require('./watchlist');

let STATE_FILE = stateFile(null);

function readState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); }
  catch { return { cleared: {} }; }
}

function writeState(state) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

let input;
try { input = JSON.parse(fs.readFileSync(0, 'utf8')); }
catch { process.exit(0); }

STATE_FILE = stateFile(input.session_id);
const watchlist = loadWatchlist(input.cwd);
if (watchlist.sdks.length === 0) process.exit(0);

const { tool_name, tool_input, tool_response } = input;
const isWebFetch = tool_name === 'WebFetch';

// A fetch only clears docs if it actually succeeded. A 404/DNS-fail/empty body
// must NOT unblock writes. No tool_response (e.g. context7) -> can't judge, don't veto.
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
    process.stdout.write('airblander: fetch looked unsuccessful -- not clearing. Re-fetch the canonical docs URL.');
    process.exit(0);
  }
} else {
  slugTarget = Object.values(tool_input || {}).filter(v => typeof v === 'string').join(' ');
  if (!slugTarget) process.exit(0);
}

// WebFetch: only canonical domain patterns (with a dot) count. context7: name/slug match.
function matches(sdk) {
  if (isWebFetch) {
    return sdk.docsDomains.filter(d => d.includes('.')).some(d => new RegExp(d, 'i').test(url));
  }
  return sdk.docsDomains.some(d => new RegExp(d, 'i').test(slugTarget));
}

const state = readState();
const newlyCleared = [];
for (const sdk of watchlist.sdks) {
  if (state.cleared?.[sdk.name]) continue;
  if (matches(sdk)) {
    if (!state.cleared) state.cleared = {};
    state.cleared[sdk.name] = Date.now();
    newlyCleared.push(sdk.name);
  }
}

if (newlyCleared.length > 0) {
  writeState(state);
  process.stdout.write(`airblander: ${newlyCleared.join(', ')} cleared -- writes unblocked`);
}
process.exit(0);
