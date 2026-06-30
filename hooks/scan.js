#!/usr/bin/env node
// airblander scan -- scan this project's dependency manifests, intersect with the
// internal recognized-SDK registry, and write a per-project watchlist.
// Run via /airblander-scan. Empty until you run it; only real service SDKs land here.
'use strict';

const fs = require('fs');
const path = require('path');

const PLUGIN_ROOT = process.env.CLAUDE_PLUGIN_ROOT || path.join(__dirname, '..');
const REGISTRY_FILE = path.join(PLUGIN_ROOT, 'config', 'watchlist.json');
const PROJECT_ROOT = process.cwd();
const OUT_DIR = path.join(PROJECT_ROOT, '.airblander');
const OUT_FILE = path.join(OUT_DIR, 'watchlist.json');

// npm/pip/go package names -> registry SDK name, for cases where the package name
// isn't the registry name. ponytail: hand-maintained for the ~12 registry SDKs;
// extend here when you add an SDK whose package name differs from its registry name.
const ALIASES = {
  anthropic: ['anthropic', '@anthropic-ai/sdk', '@anthropic-ai/bedrock-sdk', '@anthropic-ai/vertex-sdk'],
  openai: ['openai'],
  stripe: ['stripe'],
  twilio: ['twilio'],
  'google-genai': ['@google/generative-ai', '@google/genai', 'google-generativeai', 'google-genai'],
  'aws-bedrock': ['boto3', '@aws-sdk/client-bedrock-runtime', '@aws-sdk/client-bedrock'],
  livekit: ['livekit', 'livekit-server-sdk', 'livekit-agents', '@livekit/rtc-node'],
  pipecat: ['pipecat-ai', 'pipecat'],
  'azure-communication': ['@azure/communication-sms', '@azure/communication-messages', 'azure-communication-sms'],
  deepgram: ['@deepgram/sdk', 'deepgram', 'deepgram-sdk'],
  sarvam: ['sarvam', 'sarvamai', 'sarvam-ai'],
  exotel: ['exotel'],
};

// ---- manifest parsers: each returns an array of raw dependency names ----
function fromPackageJson(root) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    return Object.keys({
      ...pkg.dependencies, ...pkg.devDependencies,
      ...pkg.peerDependencies, ...pkg.optionalDependencies,
    });
  } catch { return []; }
}

function fromRequirementsTxt(root) {
  try {
    return fs.readFileSync(path.join(root, 'requirements.txt'), 'utf8')
      .split('\n')
      .map(l => l.split('#')[0].trim())
      .filter(Boolean)
      .map(l => l.split(/[<>=!~ \[;]/)[0].trim())
      .filter(Boolean);
  } catch { return []; }
}

function fromGoMod(root) {
  try {
    return fs.readFileSync(path.join(root, 'go.mod'), 'utf8')
      .split('\n')
      .map(l => l.trim())
      .filter(l => /^[\w.\-\/]+\s+v\d/.test(l))
      .map(l => l.split(/\s+/)[0]);
  } catch { return []; }
}

function collectDeps(root) {
  return [...new Set([
    ...fromPackageJson(root),
    ...fromRequirementsTxt(root),
    ...fromGoMod(root),
  ])].map(d => d.toLowerCase());
}

// A dep matches an alias when equal, contained either way, or sharing the path tail
// (covers "@deepgram/sdk" ~ "deepgram", "boto3" ~ "boto3").
function depMatchesAlias(dep, alias) {
  if (dep === alias) return true;
  if (dep.includes(alias) || alias.includes(dep)) return true;
  return dep.split('/').pop() === alias;
}

function main() {
  let registry;
  try { registry = JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf8')); }
  catch { console.log('airblander: internal registry missing -- cannot init.'); process.exit(1); }

  const deps = collectDeps(PROJECT_ROOT);
  if (deps.length === 0) {
    console.log('airblander: no package.json / requirements.txt / go.mod found here -- nothing to init.');
    process.exit(0);
  }

  const matched = registry.sdks.filter(sdk => {
    const aliases = (ALIASES[sdk.name] || [sdk.name]).map(a => a.toLowerCase());
    return deps.some(dep => aliases.some(a => depMatchesAlias(dep, a)));
  }).map(sdk => ({
    name: sdk.name,
    patterns: sdk.patterns,
    docsUrl: sdk.docsUrl,
    docsDomains: sdk.docsDomains,
    context7Query: sdk.context7Query,
    keywords: sdk.keywords,
  }));

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify({ sdks: matched }, null, 2));

  if (matched.length === 0) {
    console.log(`airblander: scanned ${deps.length} deps -- no recognized service SDKs. Watchlist is empty (no gating).`);
  } else {
    console.log(`airblander: watchlist built for this project (${matched.length}): ${matched.map(s => s.name).join(', ')}`);
    console.log(`  -> ${path.relative(PROJECT_ROOT, OUT_FILE)} -- writes importing these are gated until docs are fetched.`);
  }
}

main();
