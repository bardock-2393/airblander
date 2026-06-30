
<h1 align="center">Airblander</h1>
<p align="center">
  <em>It won't let you write SDK code until you've read the docs.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/github/stars/bardock-2393/airblander?style=flat-square&color=111111&label=stars" alt="Stars">
  <img src="https://img.shields.io/github/v/release/bardock-2393/airblander?style=flat-square&color=111111&label=release" alt="Release">
  <img src="https://img.shields.io/badge/works%20with-Claude%20Code-111111?style=flat-square" alt="Works with Claude Code">
  <img src="https://img.shields.io/badge/SDKs%20watched-9-111111?style=flat-square" alt="9 SDKs watched">
  <img src="https://img.shields.io/badge/license-MIT-111111?style=flat-square" alt="MIT license">
</p>

---

You've been there. You ask an AI agent to integrate Stripe. It writes two hundred lines against the v2 Charges API. You ship it. Six months later, that API is gone. The docs were right there.

Airblander closes the loop. Before your agent writes a single import, it fetches the current docs. No fetch, no write.

## Before / after

You ask the agent to add Twilio SMS. Without airblander it starts typing:

```python
from twilio.rest import Client
client = Client(account_sid, auth_token)
client.messages.create(body="Hello", from_="+1...", to="+1...")
```

With airblander:

```
airblander: BLOCKED — docs not yet fetched for: twilio

Fetch current docs before writing SDK code:
  • twilio: fetch https://www.twilio.com/docs
    or use Context7 query: "twilio"

After fetching, re-attempt the write.
```

Agent fetches the docs, finds the current API, writes correct code. Every time.

## How it works

Three hooks, one state file, one watchlist:

```
You type: "add stripe payments"
        ↓
  resolve.js  →  spots "stripe" in your message, marks it pending
        ↓
  Agent tries to write payment.ts  (import stripe)
        ↓
  detect.js   →  stripe not cleared  →  BLOCKED (exit 2)
        ↓
  Agent fetches stripe.com/docs
        ↓
  clear.js    →  stripe marked cleared ✓
        ↓
  Agent writes the file  →  allowed ✅
```

**Session-scoped.** State resets on every session start. Docs fetched yesterday don't count — the library may have changed.

**Dynamic detection.** SDKs not in the watchlist are still caught via tech-signal extraction. "integrate Resend for emails" is flagged even though Resend isn't a built-in entry — and you get a prompt to add it.

**Toggle.** `/airblander` pauses enforcement for the session. Run it again to re-enable.

## Install

### Claude Code

```
/plugin marketplace add bardock-2393/airblander
```
```
/plugin install airblander@airblander
```

Send as two separate prompts.

## Commands

| Command | What it does |
|---|---|
| `/airblander` | Toggle enforcement on/off for this session |
| `/airblander-add <sdk> <docs-url>` | Add a new SDK to the watchlist |
| `/airblander-status` | Show which SDKs are cleared and which are still blocked this session |
| `/airblander-watchlist` | List all tracked SDKs with keywords, import patterns, and doc URLs |
| `/airblander-review` | Scan the whole codebase for SDK imports and report coverage gaps |
| `/airblander-deprecated` | Detect deprecated API patterns across the codebase |
| `/airblander-update <sdk>` | Re-fetch docs for an SDK and refresh its cleared state |
| `/airblander-help` | Quick reference for the commands above |

## Watched SDKs (built-in)

| SDK | Keywords | Deprecated patterns tracked |
|---|---|---|
| **anthropic** | claude, anthropic, claude api | `completions.create`, `claude-instant-*`, `claude-2`, `claude-v1` |
| **openai** | openai, openai api | `ChatCompletion.create`, `Completion.create`, `text-davinci-003` |
| **stripe** | stripe, stripe api | `charges.create`, `sources.create`, `orders.create` |
| **twilio** | twilio, twilio sms, twilio voice | `Twilio.RestClient(` |
| **google-genai** | gemini, google genai | `chat-bison`, `text-bison`, `gemini-pro` (1.0), `generateText` |
| **aws-bedrock** | aws bedrock, bedrock, invoke model | `anthropic.claude-v2`, `claude-instant`, `titan-text-express` |
| **livekit** | livekit, livekit-agents | `RoomServiceClient(` |
| **pipecat** | pipecat, pipecat-ai | — |
| **azure-communication** | azure communication, acs sms | `@azure/communication-sms` (going multi-channel) |

Add more with `/airblander-add`. The watchlist lives at `config/watchlist.json`.

## Detecting deprecated patterns

`/airblander-deprecated` scans your codebase against the `deprecated` field in every watchlist entry and reports what to fix:

```
## Deprecated API Report

### anthropic
  src/llm.py:3  client.completions.create(model="claude-instant-1.2", ...)
    → Replace with: client.messages.create()
    → Reason: Text Completions API deprecated; Messages API is the current standard

  src/llm.py:3  "claude-instant-1.2"
    → Replace with: claude-haiku-4-5
    → Reason: claude-instant models retired Jan 2025

### stripe
  src/pay.js:2  stripe.charges.create({ amount: 2000 })
    → Replace with: stripe.paymentIntents.create
    → Reason: Charges API works but PaymentIntents required for 3DS/SCA

net: 3 deprecated patterns found across 2 files.
```

## Adding a new SDK

```
/airblander-add resend https://resend.com/docs
```

That's it. The new SDK is active immediately — no session restart needed. To add clarification questions (e.g. "which Resend feature?"), edit `config/clarifications.json`.

## FAQ

**Does it slow the agent down?**
One `node` process at prompt time, one at write time. Both finish in under 100ms. You won't notice.

**What if I'm working offline?**
Toggle it off with `/airblander`, work, toggle back on. The state file persists the toggle.

**What if the SDK isn't in the watchlist?**
Tech-signal extraction catches it anyway — "integrate Resend for email" gets flagged as an unknown service and the agent is told to resolve its docs before writing. Add it permanently with `/airblander-add`.

**Why does it reset every session?**
SDK docs change. A fetch from last week may already be stale. Per-session is the only guarantee that means something.

**Can I keep a SDK permanently cleared?**
Not by design. Fetch the docs; it takes five seconds. That's the contract.

## License

MIT. Read the docs first.
