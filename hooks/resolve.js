#!/usr/bin/env node
// airblander UserPromptSubmit — detects SDK/service intent at prompt time, gates writes early
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const PLUGIN_ROOT = process.env.CLAUDE_PLUGIN_ROOT || path.join(__dirname, '..');
const CONFIG_DIR = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const STATE_FILE = path.join(CONFIG_DIR, 'airblander-state.json');
const WATCHLIST_FILE = path.join(PLUGIN_ROOT, 'config', 'watchlist.json');
const CLARIFICATIONS_FILE = path.join(PLUGIN_ROOT, 'config', 'clarifications.json');

// Common English words to exclude from tech-term extraction
const STOP_WORDS = new Set([
  'the','a','an','i','me','my','we','our','you','your','it','its','this','that',
  'is','are','was','were','be','been','has','have','had','do','does','did',
  'will','would','can','could','should','may','might','must',
  'and','or','but','not','no','if','then','so','as','at','by','for','in',
  'of','on','to','up','with','from','into','over','after','before',
  'new','old','all','any','some','more','very','just','also','here','there',
  'build','make','create','write','use','get','set','send','call','run','add',
  'code','file','app','api','sdk','service','library','function','class','module',
  'what','how','when','where','why','which','who','need','want','like','help',
  'please','using','based','simple','quick','basic','full','real','live',
  // common English nouns that precede "SDK/API" in natural speech but are never package names
  'improvement','suggestion','list','result','update','example','version','feature',
  'support','method','option','approach','type','test','check','error','fix','issue',
  'problem','change','difference','format','output','input','response','request',
  'data','value','key','name','note','point','item','step','way','time','part',
  'case','show','find','know','think','say','see','go','look','try','work',
  'available','current','latest','best','right','used','made','first','last',
  'next','each','between','under','through','during','without','against','different',
]);

function readState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); }
  catch { return { cleared: {}, scoped: { pending: [], dynamicSDKs: [], clarifications: {} } }; }
}

function writeState(state) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function ensureScoped(state) {
  if (!state.scoped) state.scoped = {};
  if (!state.scoped.pending) state.scoped.pending = [];
  if (!state.scoped.dynamicSDKs) state.scoped.dynamicSDKs = [];
  if (!state.scoped.clarifications) state.scoped.clarifications = {};
}

// Stage 2: extract tech-signal noun phrases from free-text prompt
function extractTechTerms(prompt) {
  const found = new Set();

  // Words/phrases after tech signal verbs
  const signalRe = /\b(?:use|using|integrate|connect|implement|call|consume|access|talk\s+to|interact\s+with)\s+([A-Za-z][a-zA-Z0-9 .-]{2,30})/gi;
  let m;
  while ((m = signalRe.exec(prompt)) !== null) {
    const t = m[1].trim().split(/\s+/).slice(0, 3).join(' '); // max 3 words
    if (t.length >= 2) found.add(t);
  }

  // Quoted names (e.g. "Stripe", "AWS Bedrock", 'OpenAI')
  const quotedRe = /["']([A-Za-z][a-zA-Z0-9 .-]{2,40})["']/g;
  while ((m = quotedRe.exec(prompt)) !== null) {
    found.add(m[1].trim());
  }

  // "X [Y] API/SDK/integration" — capture up to 2 words before the suffix so
  // "stripe payment integration" → "stripe payment" (domainHint will pick "stripe")
  const suffixRe = /\b((?:[A-Za-z][a-zA-Z0-9.-]+\s){0,2}[A-Za-z][a-zA-Z0-9.-]+)\s+(?:API|SDK|service|library|client|integration|gateway|billing|payment)\b/gi;
  while ((m = suffixRe.exec(prompt)) !== null) {
    const phrase = m[1].trim().split(/\s+/).slice(0, 3).join(' ');
    if (phrase.length >= 2) found.add(phrase);
  }

  // Filter: drop pure stop words and single-word all-lowercase common terms
  return [...found].filter(t => {
    const words = t.toLowerCase().split(/\s+/);
    if (words.every(w => STOP_WORDS.has(w))) return false;
    if (words.length === 1 && STOP_WORDS.has(words[0])) return false;
    return true;
  });
}

// Read hook stdin
let raw;
try { raw = fs.readFileSync(0, 'utf8'); }
catch { process.exit(0); }

let hookInput;
try { hookInput = JSON.parse(raw); }
catch { process.exit(0); }

const prompt = (hookInput.prompt || '').trim();
if (!prompt) process.exit(0);

// Toggle: /airblander in the prompt flips enforcement — delegate to toggle.js to avoid duplication
if (/^\/airblander\s*$/i.test(prompt)) {
  const { spawnSync } = require('child_process');
  const r = spawnSync(process.execPath, [path.join(PLUGIN_ROOT, 'hooks', 'toggle.js')], { encoding: 'utf8' });
  process.stdout.write(r.stdout || '');
  process.exit(0);
}

// Load config
let watchlist, clarifications;
try { watchlist = JSON.parse(fs.readFileSync(WATCHLIST_FILE, 'utf8')); }
catch { process.exit(0); }
try { clarifications = JSON.parse(fs.readFileSync(CLARIFICATIONS_FILE, 'utf8')); }
catch { clarifications = {}; }

const promptLower = prompt.toLowerCase();

// Stage 1: watchlist keyword match
const knownMatches = watchlist.sdks.filter(sdk =>
  (sdk.keywords || []).some(kw => promptLower.includes(kw.toLowerCase()))
);

// Stage 2: tech-signal extraction — filter out already-known SDKs
const allKnownKeywords = new Set(watchlist.sdks.flatMap(s => (s.keywords || []).map(k => k.toLowerCase())));
// Build a flat set of individual words from all known keywords (e.g. "twilio sms" → ["twilio", "sms"])
const allKnownWords = new Set(
  [...allKnownKeywords].flatMap(kw => kw.split(/\s+/))
);
const extractedTerms = extractTechTerms(prompt).filter(t => {
  const tl = t.toLowerCase();
  // Exact keyword match
  if (allKnownKeywords.has(tl)) return false;
  // Any known keyword is a substring of this term (e.g. "twilio rest" contains "twilio")
  if ([...allKnownKeywords].some(kw => tl.includes(kw))) return false;
  // All words in this term are word-parts of known keywords (e.g. "SMS" is a word in "twilio sms")
  const termWords = tl.split(/\s+/);
  if (termWords.every(w => allKnownWords.has(w))) return false;
  return true;
});

// Nothing relevant in this prompt
if (knownMatches.length === 0 && extractedTerms.length === 0) process.exit(0);

// Update state
const state = readState();
ensureScoped(state);

for (const sdk of knownMatches) {
  if (!state.cleared?.[sdk.name] && !state.scoped.pending.includes(sdk.name)) {
    state.scoped.pending.push(sdk.name);
  }
}

for (const term of extractedTerms) {
  const slug = term.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  // domainHint uses first non-stop word so it can match against a URL (e.g. "stripe" matches stripe.com)
  const firstSignificantWord = term.toLowerCase().split(/\s+/).find(w => !STOP_WORDS.has(w)) || slug;
  const alreadyTracked = state.scoped.dynamicSDKs.some(d => d.name === slug);
  if (!alreadyTracked && !state.cleared?.[slug]) {
    state.scoped.dynamicSDKs.push({ name: slug, domainHint: firstSignificantWord, displayName: term });
    if (!state.scoped.pending.includes(slug)) state.scoped.pending.push(slug);
  }
}

writeState(state);

// Build context output for Claude
const lines = ['airblander: Prompt-time scan results'];

if (knownMatches.length > 0) {
  lines.push('\nKnown SDKs detected:');
  for (const sdk of knownMatches) {
    const alreadyCleared = !!state.cleared?.[sdk.name];
    const tag = alreadyCleared ? '✓ docs already fetched this session' : 'docs needed';
    lines.push(`  • ${sdk.name} [${tag}]`);
    if (!alreadyCleared) {
      lines.push(`    Doc URL: ${sdk.docsUrl}`);
      lines.push(`    Context7: "${sdk.context7Query}"`);
    }
  }
}

if (extractedTerms.length > 0) {
  lines.push('\nUnknown services detected (not in watchlist — need resolution):');
  for (const t of extractedTerms) {
    const slug = t.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const alreadyCleared = !!state.cleared?.[slug];
    if (!alreadyCleared) {
      lines.push(`  • "${t}"`);
      lines.push(`    → Run: mcp__context7__resolve-library-id libraryName="${t}"`);
      lines.push(`    → Or: WebSearch "${t} official API documentation"`);
    }
  }
}

const needsDocs = [
  ...knownMatches.filter(s => !state.cleared?.[s.name]),
  ...extractedTerms.map(t => ({ name: t.toLowerCase().replace(/[^a-z0-9]+/g, '-'), _display: t }))
    .filter(d => !state.cleared?.[d.name]),
];

if (needsDocs.length > 0) {
  lines.push('\nREQUIRED before writing any file:');
  lines.push('1. Use the AskUserQuestion tool to ask for approval. Question: "Before I write code, I need to fetch fresh docs for: [list]. Proceed?" Options: ["Yes, fetch docs", "No, skip"] (the tool adds an Other option for free-text input automatically)');
  lines.push('2. Wait for explicit user approval — do not assume yes, do not ask via plain text');
  lines.push('3. For unknown services: resolve docs first (Context7 or WebSearch), then confirm the URL with the user');
  lines.push('4. Fetch all approved docs (WebFetch or Context7 get-library-docs)');

  // Clarification questions for known SDKs
  const clarifySDKs = knownMatches.filter(s => !state.cleared?.[s.name] && clarifications[s.name]);
  if (clarifySDKs.length > 0) {
    lines.push('5. Ask these disambiguating questions (single-select, one at a time):');
    for (const sdk of clarifySDKs) {
      for (const q of (clarifications[sdk.name].questions || [])) {
        lines.push(`   [${sdk.name}] ${q.q}`);
        lines.push(`   Options: ${q.options.join(' | ')}`);
      }
    }
    lines.push('6. Only after approval + fetch + answers → write code');
  } else {
    lines.push('5. Only after approval + fetch → write code');
  }
} else {
  lines.push('\nAll detected SDKs are already cleared — no gate needed.');
}

process.stdout.write(lines.join('\n'));
process.exit(0);
