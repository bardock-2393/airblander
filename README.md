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
  <img src="https://img.shields.io/badge/SDKs%20watched-9-111111?style=flat-square" alt="9 SDKs watched">
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
airblander: BLOCKED — docs not yet fetched for: twilio

Fetch current docs before writing SDK code:
  • twilio: fetch https://www.twilio.com/docs
    or use Context7 query: "twilio"

After fetching, re-attempt the write.
```

The agent fetches the docs, finds out what's current, and then writes the file. One extra step, consistently correct code.

## How it works

Three hooks, one state file:

```
You type: "add stripe payments"
        ↓
  resolve.js  →  sees "stripe" in your message, marks it pending
        ↓
  Agent tries to write payment.ts  (import stripe ...)
        ↓
  detect.js   →  stripe not cleared  →  BLOCKED (exit 2)
        ↓
  Agent fetches stripe.com/docs
        ↓
  clear.js    →  stripe marked cleared ✓
        ↓
  Agent writes the file  →  allowed
```

State resets every session. Docs fetched yesterday don't count — the library may have changed overnight.

SDKs not in the watchlist are still caught. "Integrate Resend for email" gets flagged as an unknown service and the agent is told to resolve its docs before writing. You can add it permanently with `/airblander-add`.

`/airblander` pauses enforcement for the session if you need to work fast. Run it again to re-enable.

## Install

```bash
claude plugin install bardock-2393/airblander
```

Run that once in your terminal. Done.

## Commands

| Command | What it does |
|---|---|
| `/airblander` | Toggle enforcement on/off for this session |
| `/airblander-add <sdk> <docs-url>` | Add a new SDK to the watchlist |
| `/airblander-status` | Show which SDKs are cleared this session |
| `/airblander-watchlist` | List all tracked SDKs |
| `/airblander-review` | Scan your codebase for SDK imports and report coverage gaps |
| `/airblander-deprecated` | Detect deprecated API patterns across the codebase |
| `/airblander-update <sdk>` | Re-fetch docs for an SDK mid-session |
| `/airblander-help` | Quick reference |

## Watched SDKs

| SDK | Keywords | Deprecated patterns caught |
|---|---|---|
| **anthropic** | claude, anthropic, claude api | `completions.create`, `claude-instant-*`, `claude-2`, `claude-v1` |
| **openai** | openai, openai api | `ChatCompletion.create`, `Completion.create`, `text-davinci-003` |
| **stripe** | stripe, stripe api | `charges.create`, `sources.create`, `orders.create` |
| **twilio** | twilio, twilio sms, twilio voice | `Twilio.RestClient(` |
| **google-genai** | gemini, google genai | `chat-bison`, `text-bison`, `gemini-pro` (1.0), `generateText` |
| **aws-bedrock** | aws bedrock, bedrock | `anthropic.claude-v2`, `claude-instant`, `titan-text-express` |
| **livekit** | livekit, livekit-agents | `RoomServiceClient(` |
| **pipecat** | pipecat, pipecat-ai | — |
| **azure-communication** | azure communication, acs sms | `@azure/communication-sms` (going multi-channel) |

`/airblander-deprecated` scans your whole codebase against these patterns and tells you what to fix:

```
### anthropic
  src/llm.py:3  client.completions.create(model="claude-instant-1.2", ...)
    → Replace with: client.messages.create()
    → Reason: Text Completions API deprecated; Messages API is the current standard

### stripe
  src/pay.js:2  stripe.charges.create({ amount: 2000 })
    → Replace with: stripe.paymentIntents.create
    → Reason: Charges API works but PaymentIntents required for 3DS/SCA

net: 3 deprecated patterns found across 2 files.
```

## Adding an SDK

```
/airblander-add resend https://resend.com/docs
```

That's it. Active immediately, no restart. To add clarification questions (e.g. "which Resend product?"), edit `config/clarifications.json`.

## Testing

Unit tests for all three hooks, no API calls needed:

```bash
node --test tests/detect.test.js tests/clear.test.js tests/resolve.test.js
```

28 tests covering: blocked/cleared/disabled states, Edit and MultiEdit tools, dynamic SDK detection, toggle behavior, and malformed-input resilience.

## Benchmarks

The benchmark script measures whether airblander actually reduces deprecated-API usage, not just whether it blocks writes. It runs each task twice — once without hooks (baseline arm) and once with airblander active — and checks the output files for known deprecated patterns from the watchlist.

```bash
# dry run — shows what would run, no API calls
node benchmarks/run.js --dry-run

# full benchmark, n=4 runs per task
node benchmarks/run.js --runs=4 --model=claude-sonnet-4-6

# single task
node benchmarks/run.js --tasks=twilio-sms --runs=2
```

Results land in `benchmarks/results/<date>-results.md`.

**Known limitation**: The benchmark (and the plugin) only covers `Write`, `Edit`, and `MultiEdit` tool calls. If the agent writes code via `Bash` (e.g. `cat > file.js`), the hook doesn't fire. That's a real gap and it's documented in the results.

## A few questions people ask

**Does it slow the agent down?**
One Node process at prompt time, one before each write. Both finish in under 100ms.

**What if I'm offline?**
Toggle off with `/airblander`, work, toggle back. The toggle persists across that session.

**Why reset every session?**
Because a fetch from last week is stale by now. Per-session is the only contract that actually means something.

**Can I permanently clear an SDK?**
No. Fetch the docs. It takes five seconds.

## License

MIT. Read the docs first.
