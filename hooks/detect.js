#!/usr/bin/env node
// airblander PreToolUse — blocks Write/Edit/MultiEdit if an SDK is detected but docs aren't cleared
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

function getNewContent(input) {
  const { tool_name, tool_input } = input;
  if (tool_name === 'Write') return tool_input.content || '';
  if (tool_name === 'Edit') return tool_input.new_string || '';
  if (tool_name === 'MultiEdit') {
    return (tool_input.edits || []).map(e => e.new_string || '').join('\n');
  }
  return '';
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

let raw;
try {
  raw = fs.readFileSync(0, 'utf8');
} catch {
  process.exit(0);
}

let input;
try {
  input = JSON.parse(raw);
} catch {
  process.exit(0);
}

let watchlist;
try {
  watchlist = JSON.parse(fs.readFileSync(WATCHLIST_FILE, 'utf8'));
} catch {
  process.exit(0);
}

const content = getNewContent(input);
if (!content) process.exit(0);

const state = readState();
if (state.enabled === false) process.exit(0); // enforcement paused via /airblander toggle
const cleared = state.cleared || {};

// v1: check static watchlist SDKs
const blocked = watchlist.sdks.filter(sdk => {
  if (cleared[sdk.name]) return false;
  return sdk.patterns.some(p => new RegExp(p, 'i').test(content));
}).map(sdk => ({
  name: sdk.name,
  docsUrl: sdk.docsUrl,
  context7Query: sdk.context7Query,
}));

// v2: check dynamic SDKs from resolve.js prompt-time scan
// ponytail: use domainHint (first significant word, e.g. "stripe") for the import pattern,
// not the full slug — the import uses the package name, not our internal slug
const dynamicSDKs = state.scoped?.dynamicSDKs || [];
for (const dSdk of dynamicSDKs) {
  if (cleared[dSdk.name]) continue;
  const eHint = escapeRegex(dSdk.domainHint);
  const pat = new RegExp(
    `import\\s+[\"']?${eHint}|from\\s+[\"']?${eHint}|require\\s*\\([\"']${eHint}`,
    'i'
  );
  if (pat.test(content)) {
    blocked.push({
      name: dSdk.displayName || dSdk.name,
      docsUrl: `docs for ${dSdk.displayName || dSdk.name} (resolve with Context7 or WebSearch)`,
      context7Query: dSdk.domainHint,
    });
  }
}

if (blocked.length === 0) process.exit(0);

const hints = blocked.map(sdk =>
  `  • ${sdk.name}: fetch ${sdk.docsUrl}\n    or use Context7 query: "${sdk.context7Query}"`
).join('\n');

process.stdout.write(
  `airblander: BLOCKED — docs not yet fetched for: ${blocked.map(s => s.name).join(', ')}\n\n` +
  `Fetch current docs before writing SDK code:\n${hints}\n\n` +
  `After fetching, re-attempt the write.`
);
process.exit(2);
