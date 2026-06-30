---
description: Quick reference for all airblander commands and how the doc-gate enforcement works
---

Show the airblander quick reference card. One-shot, change nothing.

Display:

## What airblander does
Blocks file writes that import fast-moving SDKs until their current docs have been
fetched this session. Prevents code written against stale API knowledge.

## Commands
| Command | What it does |
|---|---|
| /airblander-scan | Scan this project's dependencies and build its SDK watchlist |
| /airblander | Toggle enforcement on/off for this session |
| /airblander-status | Show cleared vs blocked SDKs this session |
| /airblander-help | This card |

## How it works
1. `/airblander-scan` scans package.json / requirements.txt / go.mod, keeps the
   recognized service SDKs, and writes `.airblander/watchlist.json`. No init = no gating.
2. Write-time (detect.js): blocks Write/Edit/MultiEdit if the file imports a watched,
   not-yet-cleared SDK.
3. Cleared (clear.js): a successful WebFetch or Context7 docs fetch marks that SDK safe
   for the rest of the session.

State resets every session and is per-session, so projects don't interfere.
/airblander-status shows the current snapshot.
