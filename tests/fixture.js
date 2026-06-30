'use strict';
// Test helper: build a throwaway project dir with .airblander/watchlist.json
// containing the given registry SDKs, so hooks have a per-project watchlist to load.
const { mkdtempSync, mkdirSync, writeFileSync, readFileSync } = require('fs');
const { join } = require('path');
const { tmpdir } = require('os');

const REGISTRY = JSON.parse(readFileSync(join(__dirname, '..', 'config', 'watchlist.json'), 'utf8'));

function makeProject(sdkNames) {
  const dir = mkdtempSync(join(tmpdir(), 'ab-proj-'));
  const sdks = REGISTRY.sdks.filter(s => sdkNames.includes(s.name));
  mkdirSync(join(dir, '.airblander'), { recursive: true });
  writeFileSync(join(dir, '.airblander', 'watchlist.json'), JSON.stringify({ sdks }));
  return dir;
}

module.exports = { makeProject };
