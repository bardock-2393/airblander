#!/usr/bin/env node
// airblander PreToolUse -- blocks Write/Edit/MultiEdit if a watched SDK is imported
// but its docs haven't been fetched this session. Watchlist is per-project (run
// /airblander-scan); no watchlist => nothing gated.
'use strict';

const fs = require('fs');
const { stateFile } = require('./state-path');
const { loadWatchlist } = require('./watchlist');

let STATE_FILE = stateFile(null);

function readState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); }
  catch { return { cleared: {} }; }
}

function getNewContent(input) {
  const { tool_name, tool_input } = input;
  if (tool_name === 'Write') return tool_input.content || '';
  if (tool_name === 'Edit') return tool_input.new_string || '';
  if (tool_name === 'MultiEdit') {
    return (tool_input.edits || []).map(e => e.new_string || '').join('\n');
  }
  return '';
}

// Scan the diff fragment PLUS the on-disk file for edits, so an Edit to a function
// body in a file that already imports the SDK is still caught.
function getScanContent(input) {
  const { tool_name, tool_input } = input;
  let content = getNewContent(input);
  if ((tool_name === 'Edit' || tool_name === 'MultiEdit') && tool_input.file_path) {
    try { content += '\n' + fs.readFileSync(tool_input.file_path, 'utf8'); } catch {}
  }
  return content;
}

let input;
try { input = JSON.parse(fs.readFileSync(0, 'utf8')); }
catch { process.exit(0); }

STATE_FILE = stateFile(input.session_id);
const watchlist = loadWatchlist(input.cwd);
if (watchlist.sdks.length === 0) process.exit(0); // not initialized for this project

const content = getScanContent(input);
if (!content) process.exit(0);

const state = readState();
if (state.enabled === false) process.exit(0); // paused via /airblander
const cleared = state.cleared || {};

const blocked = watchlist.sdks.filter(sdk => {
  if (cleared[sdk.name]) return false;
  return sdk.patterns.some(p => new RegExp(p, 'i').test(content));
});

if (blocked.length === 0) process.exit(0);

const hints = blocked.map(sdk =>
  `  - ${sdk.name}: fetch ${sdk.docsUrl}\n    or use Context7 query: "${sdk.context7Query}"`
).join('\n');

process.stdout.write(
  `airblander: BLOCKED -- docs not yet fetched for: ${blocked.map(s => s.name).join(', ')}\n\n` +
  `Fetch current docs before writing SDK code:\n${hints}\n\n` +
  `After fetching, re-attempt the write.`
);
process.exit(2);
