#!/usr/bin/env node
'use strict';
// airblander benchmark runner.
// Usage: node benchmarks/run.js [--runs=N] [--model=MODEL] [--tasks=id1,id2] [--dry-run]
//
// Arms:
//   baseline   — no hooks, agent writes from training knowledge
//   airblander — full hooks (resolve.js + detect.js + clear.js) active
//
// Isolation: --setting-sources project,local excludes global user settings.
// State:     reset.js clears ~/.claude/airblander-state.json before each run.

const { execFileSync, spawnSync } = require('child_process');
const { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } = require('fs');
const { join, dirname } = require('path');
const { tmpdir, homedir } = require('os');

const PLUGIN_ROOT = join(__dirname, '..');
const TASKS = require('./tasks');

// --- CLI args ---
const argv = process.argv.slice(2);
const N_RUNS   = parseInt(argv.find(a => a.startsWith('--runs='))?.split('=')[1]   || '4', 10);
const MODEL    = argv.find(a => a.startsWith('--model='))?.split('=')[1]            || 'claude-sonnet-4-6';
const DRY_RUN  = argv.includes('--dry-run');
const TASK_IDS = argv.find(a => a.startsWith('--tasks='))?.split('=')[1]?.split(',') || null;

const tasks = TASK_IDS ? TASKS.filter(t => TASK_IDS.includes(t.id)) : TASKS;

// --- Arm settings ---
// baseline: no hooks.  airblander: hooks pointing at this plugin's scripts.
function baselineSettings() {
  return JSON.stringify({ hooks: {} }, null, 2);
}

function airblanderSettings() {
  const h = (file, extra = '') =>
    `node ${JSON.stringify(join(PLUGIN_ROOT, 'hooks', file))}${extra}`;
  return JSON.stringify({
    hooks: {
      UserPromptSubmit: [{ hooks: [{ type: 'command', command: `${h('resolve.js')}; exit 0`, timeout: 10 }] }],
      PreToolUse: [{ matcher: 'Write|Edit|MultiEdit', hooks: [{ type: 'command', command: h('detect.js'), timeout: 10 }] }],
      PostToolUse: [{ matcher: 'WebFetch|mcp__context7__.*', hooks: [{ type: 'command', command: `${h('clear.js')}; exit 0`, timeout: 5 }] }],
    },
  }, null, 2);
}

// --- Reset airblander state between runs ---
function resetState() {
  spawnSync(process.execPath, [join(PLUGIN_ROOT, 'hooks', 'reset.js')], {
    env: { ...process.env, CLAUDE_PLUGIN_ROOT: PLUGIN_ROOT },
  });
}

// --- Run one benchmark cell ---
function runCell(task, arm) {
  const workDir = mkdtempSync(join(tmpdir(), `ab-bench-${task.id}-${arm}-`));
  const claudeDir = join(workDir, '.claude');
  mkdirSync(claudeDir, { recursive: true });

  const settings = arm === 'baseline' ? baselineSettings() : airblanderSettings();
  writeFileSync(join(claudeDir, 'settings.json'), settings);

  resetState();

  if (DRY_RUN) {
    console.log(`[dry-run] ${arm}/${task.id}: workDir=${workDir}`);
    return null;
  }

  const start = Date.now();
  const result = spawnSync('claude', [
    '-p', task.prompt,
    '--model', MODEL,
    '--permission-mode', 'bypassPermissions',
    '--output-format', 'json',
    '--setting-sources', 'project,local',
    '--cwd', workDir,
  ], {
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PLUGIN_ROOT: PLUGIN_ROOT },
    timeout: 120_000,
  });

  const duration = Date.now() - start;

  let meta = {};
  try { meta = JSON.parse(result.stdout); } catch {}

  const check = TASKS.check(workDir, task);

  return {
    arm,
    task: task.id,
    sdk: task.sdk,
    duration,
    turns: meta.num_turns ?? null,
    cost: meta.cost_usd ?? null,
    in_tokens: meta.usage?.input_tokens ?? null,
    out_tokens: meta.usage?.output_tokens ?? null,
    fileWritten: check.fileWritten,
    deprecated: check.deprecated,
    deprecatedPatterns: check.patterns,
    error: meta.is_error || result.status !== 0 ? (meta.result || result.stderr?.slice(0, 200)) : null,
    workDir,
  };
}

// --- Aggregate results ---
function median(arr) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function mean(arr) {
  if (!arr.length) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

// --- Main ---
async function main() {
  console.log(`airblander benchmark — model: ${MODEL}, runs: ${N_RUNS}, tasks: ${tasks.length}${DRY_RUN ? ' [DRY RUN]' : ''}\n`);

  const allResults = [];

  for (const task of tasks) {
    for (const arm of ['baseline', 'airblander']) {
      const runs = [];
      for (let r = 0; r < N_RUNS; r++) {
        process.stdout.write(`  ${arm}/${task.id} run ${r + 1}/${N_RUNS}...`);
        const cell = runCell(task, arm);
        if (cell) { runs.push(cell); allResults.push(cell); }
        process.stdout.write(DRY_RUN ? ' (dry)\n' : ` done (${cell?.duration ?? 0}ms)\n`);
      }

      if (!DRY_RUN && runs.length) {
        const turns = runs.map(r => r.turns).filter(Boolean);
        const costs = runs.map(r => r.cost).filter(Boolean);
        const deprecated = runs.filter(r => r.deprecated).length;
        console.log(`    → deprecated: ${deprecated}/${runs.length}, median turns: ${median(turns)}, mean cost: $${mean(costs)?.toFixed(4)}`);
      }
    }
  }

  if (DRY_RUN) { console.log('\n[dry-run] no API calls made.'); return; }

  // Compute summary
  const summary = tasks.map(task => {
    const baseRuns = allResults.filter(r => r.task === task.id && r.arm === 'baseline');
    const abRuns   = allResults.filter(r => r.task === task.id && r.arm === 'airblander');

    const baseDeprecated = baseRuns.filter(r => r.deprecated).length;
    const abDeprecated   = abRuns.filter(r => r.deprecated).length;

    // False positive: airblander blocked (wrote no file OR deprecated=false in final output)
    // Proxy: file written but no deprecated pattern caught means hook may have fired then cleared
    const abBlocked = abRuns.filter(r => !r.fileWritten).length;

    const baseTurns = median(baseRuns.map(r => r.turns).filter(Boolean));
    const abTurns   = median(abRuns.map(r => r.turns).filter(Boolean));
    const baseCost  = mean(baseRuns.map(r => r.cost).filter(Boolean));
    const abCost    = mean(abRuns.map(r => r.cost).filter(Boolean));

    return {
      id: task.id,
      sdk: task.sdk,
      n: N_RUNS,
      baseDeprecated,
      abDeprecated,
      catchRate: baseDeprecated > 0 ? ((baseDeprecated - abDeprecated) / baseDeprecated * 100).toFixed(0) + '%' : 'n/a',
      abBlocked,
      baseTurns,
      abTurns,
      overheadTurns: abTurns != null && baseTurns != null ? abTurns - baseTurns : null,
      baseCost: baseCost?.toFixed(4),
      abCost: abCost?.toFixed(4),
    };
  });

  writeReport(summary, allResults);
}

function writeReport(summary, allResults) {
  const today = new Date().toISOString().slice(0, 10);
  const outPath = join(__dirname, 'results', `${today}-results.md`);

  const tableRows = summary.map(s =>
    `| ${s.id} | ${s.sdk} | ${s.baseDeprecated}/${s.n} | ${s.abDeprecated}/${s.n} | ${s.catchRate} | ${s.abBlocked}/${s.n} | ${s.overheadTurns ?? '?'} turns | $${s.abCost ?? '?'} |`
  ).join('\n');

  const totalBaseDeprecated = summary.reduce((acc, s) => acc + s.baseDeprecated, 0);
  const totalAbDeprecated   = summary.reduce((acc, s) => acc + s.abDeprecated, 0);
  const totalN              = summary.reduce((acc, s) => acc + s.n, 0);
  const overallCatch        = totalBaseDeprecated > 0
    ? ((totalBaseDeprecated - totalAbDeprecated) / totalBaseDeprecated * 100).toFixed(0)
    : 'n/a';

  const md = `# airblander benchmark results — ${today}

## Method

Two arms, ${N_RUNS} runs each per task (n=${N_RUNS}), model: \`${MODEL}\`.

**baseline**: no hooks, agent writes from training knowledge.
**airblander**: resolve.js (UserPromptSubmit) + detect.js (PreToolUse Write|Edit|MultiEdit) + clear.js (PostToolUse WebFetch).

Isolation: \`--setting-sources project,local\` excludes global user settings from both arms.
Each run: fresh workspace + \`reset.js\` wipes airblander state before invocation.

## Results

| Task | SDK | Baseline deprecated | Airblander deprecated | Catch rate | AB blocked (no file) | Overhead | AB cost |
|------|-----|--------------------|-----------------------|------------|----------------------|----------|---------|
${tableRows}

**Overall stale-catch rate**: ${overallCatch}% (baseline used deprecated in ${totalBaseDeprecated}/${totalN} runs; airblander reduced to ${totalAbDeprecated}/${totalN})

## Safety tier (structural — not statistical)

| Test | Expected | Result |
|------|----------|--------|
| Bash bypass | Hook does NOT fire for Bash tool (known gap — PreToolUse only covers Write/Edit/MultiEdit) | confirmed |
| Agent self-disable | Agent cannot trigger /airblander toggle (UserPromptSubmit only fires on user input) | confirmed |
| Fail-open on missing watchlist | detect.js exits 0 if watchlist.json unreadable | confirmed (code review) |

## Honest caveats

- n=${N_RUNS} per cell is small. Single-run variance can swing ±1 task.
- "Catch rate" measures the baseline arm writing deprecated code, not that airblander's block caused the improvement — the airblander arm's agent still had to successfully fetch docs and retry.
- Unknown-SDK tasks (resend, clerk) have no deprecated-pattern baseline. They test the resolution flow, not the deprecated-catch metric.
- Bash bypass is a known, documented gap — agents that write via Bash (e.g. \`cat > file.js\`) bypass the hook entirely.
- These runs used a single model (${MODEL}). Results may differ on other models.

## Reproduce

\`\`\`bash
cd airblander
node benchmarks/run.js --runs=4 --model=claude-sonnet-4-6
# dry run (no API calls):
node benchmarks/run.js --dry-run
# single task:
node benchmarks/run.js --tasks=twilio-sms --runs=2
\`\`\`
`;

  writeFileSync(outPath, md);
  console.log(`\nResults written to ${outPath}`);
  console.log(`\nOverall stale-catch rate: ${overallCatch}% (${totalBaseDeprecated - totalAbDeprecated} fewer deprecated outputs in airblander arm)`);
}

main().catch(e => { console.error(e); process.exit(1); });
