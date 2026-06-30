---
name: airblander-review
description: >
  Scan the whole codebase for SDK imports, check coverage against the airblander
  watchlist, and report gaps (SDKs in code but not watched). One-shot report.
  Trigger: /airblander-review, "review airblander coverage", "scan for sdk imports",
  "what sdks are we using", "airblander scan".
---

Scan the current working directory for SDK imports and cross-reference with the
airblander watchlist. One-shot report — do NOT modify any files or state.

## Steps

1. Read `${CLAUDE_PLUGIN_ROOT}/config/watchlist.json` to get all watched SDKs and their import patterns.
2. Read `~/.claude/airblander-state.json` (or `$CLAUDE_CONFIG_DIR/airblander-state.json`) for current session cleared state.
3. Use Bash to grep the codebase for import statements:
   ```
   grep -rE "^(import|from|require)" . --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --include="*.py" --include="*.mjs" -l 2>/dev/null
   ```
   Then read the actual import lines from those files.
4. For each import found, check if it matches a watched SDK pattern.
5. Identify **gap SDKs**: packages imported in code that are NOT in the watchlist.

## Output format

```
## Airblander Coverage Report

### Watched & detected in codebase
  ✓ twilio — cleared this session
  ⚠ stripe — NOT cleared (docs needed)

### Watched but NOT in codebase
  • pipecat
  • livekit

### GAP: imported but NOT watched (add these)
  • @supabase/supabase-js → /airblander-add supabase https://supabase.com/docs
  • resend → /airblander-add resend https://resend.com/docs

net: N watched SDKs, N in use, N gaps
```

If no gaps and all in-use SDKs are cleared: `All SDK imports covered and cleared. Ship it.`

One-shot. Change nothing.
