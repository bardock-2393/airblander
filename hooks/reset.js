#!/usr/bin/env node
// airblander SessionStart — wipes cleared-SDK state so each session starts fresh
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const CONFIG_DIR = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const STATE_FILE = path.join(CONFIG_DIR, 'airblander-state.json');

try {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  let prev = {};
  try { prev = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch {}
  fs.writeFileSync(STATE_FILE, JSON.stringify({
    enabled: prev.enabled !== false, // preserve explicit off; default to true
    cleared: {},
    scoped: { pending: [], dynamicSDKs: [], clarifications: {} },
  }, null, 2));
} catch {}

process.exit(0);
