'use strict';
// airblander shared state path — one state file PER SESSION so concurrent
// projects/sessions don't stomp each other's cleared-SDK + toggle state.
// No session id (e.g. unit tests) → the legacy single file, for back-compat.
const fs = require('fs');
const path = require('path');
const os = require('os');

const CONFIG_DIR = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');

function stateFile(sessionId) {
  if (!sessionId) return path.join(CONFIG_DIR, 'airblander-state.json');
  const safe = String(sessionId).replace(/[^A-Za-z0-9_-]/g, '');
  return path.join(CONFIG_DIR, `airblander-state-${safe || 'global'}.json`);
}

// Best-effort sweep of stale per-session files. Called at SessionStart.
// ponytail: 1-day TTL; sessions rarely outlive that. Bump if long sessions lose state.
function cleanupOldStates(maxAgeMs = 24 * 60 * 60 * 1000) {
  try {
    const now = Date.now();
    for (const f of fs.readdirSync(CONFIG_DIR)) {
      if (!/^airblander-state-.+\.json$/.test(f)) continue;
      const fp = path.join(CONFIG_DIR, f);
      try { if (now - fs.statSync(fp).mtimeMs > maxAgeMs) fs.unlinkSync(fp); } catch {}
    }
  } catch {}
}

module.exports = { CONFIG_DIR, stateFile, cleanupOldStates };
