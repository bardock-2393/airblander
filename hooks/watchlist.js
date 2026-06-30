'use strict';
// airblander per-project watchlist loader. Built by /airblander-scan into
// <project>/.airblander/watchlist.json. No file => empty => no gating (the
// project hasn't been initialized yet).
const fs = require('fs');
const path = require('path');

function watchlistFile(cwd) {
  return path.join(cwd || process.cwd(), '.airblander', 'watchlist.json');
}

function loadWatchlist(cwd) {
  try {
    const wl = JSON.parse(fs.readFileSync(watchlistFile(cwd), 'utf8'));
    return Array.isArray(wl.sdks) ? wl : { sdks: [] };
  } catch { return { sdks: [] }; }
}

module.exports = { watchlistFile, loadWatchlist };
