#!/usr/bin/env node
// airblander add-sdk — append a new SDK entry to watchlist.json from CLI args
// Usage: node add-sdk.js <sdk-name> <docs-url> [import-name]
//   sdk-name   : identifier used in state (e.g. "stripe", "openai", "@twilio/voice-sdk")
//   docs-url   : canonical doc URL (e.g. "https://stripe.com/docs")
//   import-name: optional override for the import/require name if different from sdk-name
'use strict';

const fs = require('fs');
const path = require('path');

const PLUGIN_ROOT = process.env.CLAUDE_PLUGIN_ROOT || path.join(__dirname, '..');
const WATCHLIST_FILE = path.join(PLUGIN_ROOT, 'config', 'watchlist.json');

const [,, rawName, docsUrl, importOverride] = process.argv;

if (!rawName || !docsUrl) {
  console.error('Usage: add-sdk.js <sdk-name> <docs-url> [import-name]');
  process.exit(1);
}

// Validate URL
try { new URL(docsUrl); } catch {
  console.error(`Invalid docs URL: ${docsUrl}`);
  process.exit(1);
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Derive the slug used as the state key (safe identifier)
const slug = rawName.toLowerCase().replace(/^@[^/]+\//, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Derive the import/package name: strip leading @ scope if present
// e.g. "@stripe/stripe-js" → import name stays "@stripe/stripe-js" (full scoped)
// "stripe" → "stripe"
const importName = importOverride || rawName;

// For simple (non-scoped) imports the pattern key is the import name directly.
// For scoped (@scope/pkg), include the full scope in the pattern.
const eImport = escapeRegex(importName);

// Keywords: slug, sdk-name variations, common phrasing
const keywords = [
  slug,
  `${slug} api`,
  `${slug} sdk`,
];
if (rawName !== slug) keywords.unshift(rawName.toLowerCase()); // add original if different
const uniqueKeywords = [...new Set(keywords)];

// Import patterns cover Python-style and JS-style
const patterns = [
  `import\\s+[\"']?${eImport}`,
  `from\\s+[\"']?${eImport}`,
  `require\\s*\\([\"']${eImport}`,
];

// Doc domains: hostname (escaped) + slug as substring fallback
const hostname = new URL(docsUrl).hostname.replace(/^www\./, '');
const escapedHost = hostname.replace(/\./g, '\\.');
const docsDomains = [
  escapedHost,            // e.g. stripe\.com
  `\\/${slug}\\/`,        // e.g. /stripe/ (Context7 library path)
  slug,                   // substring fallback
];

const entry = {
  name: slug,
  keywords: uniqueKeywords,
  patterns,
  docsUrl,
  docsDomains,
  context7Query: slug,
};

// Load, check for duplicate, append, write
const watchlist = JSON.parse(fs.readFileSync(WATCHLIST_FILE, 'utf8'));

const existing = watchlist.sdks.find(s => s.name === slug);
if (existing) {
  console.log(`airblander: "${slug}" already exists in watchlist — no change.`);
  console.log('  To update it, edit config/watchlist.json directly.');
  process.exit(0);
}

watchlist.sdks.push(entry);
fs.writeFileSync(WATCHLIST_FILE, JSON.stringify(watchlist, null, 2) + '\n');

console.log(`airblander: added "${slug}" to watchlist`);
console.log(`  Keywords       : ${uniqueKeywords.join(', ')}`);
console.log(`  Import patterns: ${patterns.map(p => p.replace(/\\\\/g, '\\')).join(' | ')}`);
console.log(`  Doc URL        : ${docsUrl}`);
console.log(`  Doc domains    : ${docsDomains.join(', ')}`);
console.log(`  Context7 query : "${slug}"`);
console.log('');
console.log('  To add clarification questions, edit config/clarifications.json');
console.log(`  and add a "${slug}" key with a "questions" array.`);
