<p align="center">
  <img src="logo.png" alt="Airblander Logo" width="350">
</p>

<h1 align="center">Airblander</h1>
<p align="center">
  <em>It won't let you write SDK code until you've read the docs.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/github/stars/bardock-2393/airblander?style=flat-square&color=111111&label=stars" alt="Stars">
  <img src="https://img.shields.io/github/v/release/bardock-2393/airblander?style=flat-square&color=111111&label=release" alt="Release">
  <img src="https://img.shields.io/badge/works%20with-Claude%20Code-111111?style=flat-square" alt="Works with Claude Code">
  <img src="https://img.shields.io/badge/license-MIT-111111?style=flat-square" alt="MIT license">
</p>

---

You've been there. You ask an AI agent to add Stripe. It writes two hundred lines against the v2 Charges API — confidently, quickly, correctly according to its training data from eighteen months ago. You ship it. Everything works until it doesn't.

Airblander is a Claude Code plugin that blocks the agent from writing SDK code until it has actually fetched the current docs this session. Not docs from yesterday. Not docs it vaguely remembers. Docs it fetched ten seconds ago.

## What it looks like

You say: "add Twilio SMS to this endpoint."

Without airblander, the agent starts writing immediately. Maybe it gets `RestClient` (removed in v4). Maybe it doesn't. Depends on the day.

With airblander:

```
airblander: BLOCKED -- docs not yet fetched for: twilio

Fetch current docs before writing SDK code:
  - twilio: fetch https://www.twilio.com/docs
    or use Context7 query: "twilio"

After fetching, re-attempt the write.
```

The agent fetches the docs, finds out what's current, and then writes the file. One extra step, consistently correct code.

## Per-project, built from your dependencies

Airblander doesn't ship a fixed list of SDKs to gate. You point it at a project and it builds the watchlist from what that project actually depends on:

```
/airblander-scan
-> airblander: watchlist built for this project (3): aws-bedrock, anthropic, stripe
   -> .airblander/watchlist.json -- writes importing these are gated until docs are fetched.
```

`scan` reads your `package.json`, `requirements.txt`, and `go.mod`, keeps only the dependencies that are recognized service SDKs (it ignores `react`, `lodash`, and friends), and writes `.airblander/watchlist.json`. Re-run it whenever you add a dependency.

**No scan, no gating.** A project you haven't scanned is left completely alone.

## How it works

```
You run: /airblander-scan
        |
  scan.js  ->  reads manifests, writes .airblander/watchlist.json
        |
  Agent tries to write payment.ts  (import stripe ...)
        |
  detect.js   ->  stripe in watchlist & not cleared  ->  BLOCKED (exit 2)
        |
  Agent fetches stripe.com/docs
        |
  clear.js    ->  stripe marked cleared
        |
  Agent writes the file  ->  allowed
```

State is **per session** (`airblander-state-<session_id>.json`) and resets every session. Two projects open at once don't interfere, and docs fetched yesterday don't count — the library may have changed overnight.

`/airblander` pauses enforcement for the session if you need to work fast. Run it again to re-enable.

## Install

```bash
claude plugin marketplace add bardock-2393/airblander
claude plugin install airblander@airblander
```

Then, in any project you want gated:

```
/airblander-scan
```

## Commands

| Command | What it does |
|---|---|
| `/airblander-scan` | Scan this project's dependencies and build its SDK watchlist |
| `/airblander` | Toggle enforcement on/off for this session |
| `/airblander-status` | Show which SDKs are cleared vs. blocked this session |
| `/airblander-help` | Quick reference |

## Recognized SDKs

`scan` only adds a dependency to your watchlist if it's one of these recognized service SDKs:

| SDK | Detected from packages like |
|---|---|
| **anthropic** | `anthropic`, `@anthropic-ai/sdk` |
| **openai** | `openai` |
| **stripe** | `stripe` |
| **twilio** | `twilio` |
| **google-genai** | `@google/generative-ai`, `google-generativeai` |
| **aws-bedrock** | `boto3`, `@aws-sdk/client-bedrock-runtime` |
| **livekit** | `livekit`, `livekit-server-sdk`, `livekit-agents` |
| **pipecat** | `pipecat-ai` |
| **azure-communication** | `@azure/communication-sms`, `@azure/communication-messages` |

The mapping lives in `hooks/scan.js` (the `ALIASES` map) and the registry in `config/watchlist.json`. Add a new SDK by adding it to both.

## Testing

Unit tests for the hooks, no API calls needed:

```bash
node --test tests/detect.test.js tests/clear.test.js tests/resolve.test.js tests/isolation.test.js
```

Covering: blocked/cleared/disabled states, Edit and MultiEdit tools, on-disk edit scanning, per-session isolation, toggle behavior, and malformed-input resilience.

## A few questions people ask

**Does it slow the agent down?**
One Node process before each write, finishing in well under 100ms. Scanning is a one-time manual step.

**What if I'm offline?**
Toggle off with `/airblander`, work, toggle back. The toggle persists across that session.

**Why reset every session?**
Because a fetch from last week is stale by now. Per-session is the only contract that actually means something.

**An SDK I use isn't getting gated.**
It's probably not in the recognized list, or your project doesn't declare it in a manifest. Add it to `config/watchlist.json` + the `ALIASES` map in `hooks/scan.js`, then re-run `/airblander-scan`.

**Can I permanently clear an SDK?**
No. Fetch the docs. It takes five seconds.

## License

MIT. Read the docs first.
