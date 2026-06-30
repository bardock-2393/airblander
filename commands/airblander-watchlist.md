---
description: List all SDKs tracked by airblander: their prompt keywords, import patterns, and doc domains
---

Read the file at ${CLAUDE_PLUGIN_ROOT}/config/watchlist.json and display a clean reference table for every SDK entry. For each SDK show:

**<sdk name>**
- Keywords (prompt detection): <comma-separated list>
- Import patterns (write-time detection): <list>
- Doc URL: <url>
- Doc domains (fetch-clearing patterns): <list>
- Context7 query: "<query>"

Group: watchlist SDKs first (in order), then note that unknown services are handled dynamically at prompt time via tech-signal extraction. One-shot display only — change nothing.
