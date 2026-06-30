#!/usr/bin/env node
// airblander SessionStart — wipes cleared-SDK state so each session starts fresh
'use strict';

const fs = require('fs');
const path = require('path');
const { stateFile, cleanupOldStates } = require('./state-path');

// SessionStart gets session_id on stdin; key state to it so projects/sessions don't collide
let sessionId;
try { sessionId = JSON.parse(fs.readFileSync(0, 'utf8')).session_id; } catch {}
const STATE_FILE = stateFile(sessionId);

cleanupOldStates();

try {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  let prev = {};
  try { prev = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch {}
  fs.writeFileSync(STATE_FILE, JSON.stringify({
    enabled: prev.enabled !== false, // preserve explicit off; default to true
    cleared: {},
  }, null, 2));
} catch {}

process.exit(0);
