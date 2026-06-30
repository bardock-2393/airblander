---
name: airblander-help
description: >
  Quick-reference card for all airblander commands, what they do, and how the
  doc-gate enforcement works. One-shot display. Trigger: /airblander-help,
  "airblander help", "what airblander commands", "how does airblander work".
---

# Airblander Help

Display this reference card when invoked. One-shot -- do NOT modify state, watchlist,
or any files.

## What airblander does

Blocks file writes that import fast-moving SDKs until their current docs have been
fetched this session. Prevents code written against stale API knowledge.

## Commands

| Command | What it does |
|---|---|
| `/airblander-scan` | Scan this project's dependencies and build its SDK watchlist |
| `/airblander` | Toggle enforcement on/off for this session |
| `/airblander-status` | Show cleared vs blocked SDKs this session |
| `/airblander-help` | This card |

## How it works

1. **Scan** (`scan.js`): `/airblander-scan` scans package.json / requirements.txt /
   go.mod, keeps recognized service SDKs, writes `.airblander/watchlist.json`. No init = no gating.
2. **Write-time** (`detect.js`): blocks Write/Edit/MultiEdit if the file imports a
   watched, not-yet-cleared SDK.
3. **Cleared** (`clear.js`): a successful WebFetch or Context7 docs fetch marks that SDK
   safe for the rest of the session.

## Session state

State is per-session (keyed by session id) and resets on every session start, so
concurrent projects don't interfere. `/airblander-status` shows the current snapshot.
