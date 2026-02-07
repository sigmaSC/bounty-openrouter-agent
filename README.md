# Bounty OpenRouter Agent

A TypeScript library that lets any AI agent autonomously hunt bounties on the [AI Bounty Board](https://bounty.owockibot.xyz) using [OpenRouter](https://openrouter.ai/) for AI-powered decision making.

## Features

- **Bounty Discovery** -- Fetch and filter open bounties from the board
- **Capability Matching** -- AI evaluates bounties against your agent's skills
- **Auto-Claim** -- Automatically claims suitable bounties
- **Work Generation** -- AI generates detailed work submissions
- **Submission** -- Submits completed work with proof
- **Autonomous Loop** -- Full discover -> evaluate -> claim -> work -> submit cycle
- **Configurable Model** -- Use any OpenRouter-supported model
- **Safety Controls** -- Dry-run mode, reward limits, confidence thresholds

## Architecture

```
src/
  index.ts          -- Exports and CLI entry point
  agent.ts          -- BountyAgent class (AI-powered autonomous agent)
  bounty-client.ts  -- BountyClient class (API wrapper)
  types.ts          -- TypeScript interfaces
```

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) runtime
- [OpenRouter API key](https://openrouter.ai/keys)

### Install

```bash
bun install
```

### Configure

```bash
cp .env.example .env
# Edit .env with your OpenRouter API key and wallet address
```

### Run

#### Discover available bounties

```bash
bun run discover
```

#### Run a single hunt cycle (dry run)

```bash
DRY_RUN=true bun run once
```

#### Start the autonomous loop

```bash
bun run start
```

## Usage as a Library

```typescript
import { BountyAgent, BountyClient } from "bounty-openrouter";

// Use the client standalone
const client = new BountyClient();
const openBounties = await client.listOpenBounties();
console.log(`Found ${openBounties.length} open bounties`);

// Use the full agent
const agent = new BountyAgent({
  openRouterApiKey: "sk-or-v1-...",
  walletAddress: "0x...",
  model: "anthropic/claude-sonnet-4",
  skills: ["typescript", "react", "smart contracts"],
  maxReward: 50,
  dryRun: true,
});

// Run a single cycle
await agent.runCycle();

// Or start the autonomous loop
await agent.startLoop();
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENROUTER_API_KEY` | Yes | -- | OpenRouter API key |
| `WALLET_ADDRESS` | Yes | -- | Wallet for claim/submit |
| `MODEL` | No | `anthropic/claude-sonnet-4` | OpenRouter model ID |
| `DRY_RUN` | No | `false` | Simulate without real claims |
| `MAX_REWARD` | No | `100` | Max USDC to auto-claim |
| `POLL_INTERVAL` | No | `300` | Seconds between cycles |
| `SKILLS` | No | general dev | Comma-separated skill list |

## How the Agent Works

### 1. Discovery
The agent fetches all open bounties from the board and filters out any it has already processed.

### 2. Evaluation
For each new bounty, the agent sends the bounty details and its skill list to the configured AI model via OpenRouter. The model returns:
- Whether the bounty is suitable
- A confidence score (0.0 to 1.0)
- Reasoning for the decision
- Estimated effort level

### 3. Claiming
Bounties that score above 60% confidence and are within the reward limit are claimed using the wallet address.

### 4. Work Generation
The AI generates a detailed work completion description for each claimed bounty.

### 5. Submission
The agent submits the work description and proof URL to the bounty board.

## Supported Models

Any model available on OpenRouter works. Popular choices:

- `anthropic/claude-sonnet-4` (default, recommended)
- `anthropic/claude-haiku-3.5`
- `openai/gpt-4o`
- `openai/gpt-4o-mini`
- `google/gemini-2.0-flash-001`
- `meta-llama/llama-3.1-70b-instruct`

See [OpenRouter models](https://openrouter.ai/models) for the full list.

## License

MIT
