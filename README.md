# SolForge ⚡

**Natural Language → Solana Transactions**

SolForge is a universal transaction builder API for Solana. Describe what you want in plain English and get back a ready-to-sign transaction. 12+ protocols, one API.

> 🏆 Built entirely by AI agents for the [Colosseum Agent Hackathon](https://www.colosseum.org/)

### [▶ Live Demo — Try It Now](https://solforge-production.up.railway.app/)
Connect your wallet, type a command, sign a real mainnet transaction.

**[GitHub](https://github.com/rikisann/solforge)** · **[API Docs](https://solforge-production.up.railway.app/#api)** · **[Skill File](./SKILL.md)**

---

## Quick Start

### Use the REST API
```bash
curl -X POST https://solforge-production.up.railway.app/api/build/natural \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Swap 1 SOL for USDC", "payer": "YOUR_WALLET_ADDRESS"}'
```

Returns a base64 transaction ready to sign. That's it.

### Use as MCP Server (AI Agents)
Add to your `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "solforge": {
      "command": "node",
      "args": ["/path/to/solforge/dist/mcp.js"],
      "env": {
        "SOLANA_MAINNET_RPC": "your_rpc_url",
        "JUPITER_API_URL": "https://lite-api.jup.ag/swap/v1"
      }
    }
  }
}
```

MCP tools: `build_transaction_natural`, `build_transaction`, `resolve_token`, `list_protocols`, `estimate_transaction`, `decode_transaction`

### Use the Skill File (Any LLM)
Copy [`SKILL.md`](./SKILL.md) into any AI chat and it instantly knows how to use SolForge. Zero config.

| Integration | Setup | Best For |
|-------------|-------|----------|
| **REST API** | None | Bots, scripts, any language |
| **MCP Server** | Install + config | Deep AI agent integration |
| **Skill File** | Copy-paste | Quick start with any LLM |

### Self-Host
```bash
git clone https://github.com/rikisann/solforge.git
cd solforge && npm install && cp .env.example .env
npm run build && npm start
```

---

## What It Understands

| Prompt | What Happens |
|--------|-------------|
| `"Swap 5 SOL for BONK"` | Jupiter aggregated swap |
| `"Ape 2 SOL into TOKEN_ADDRESS"` | DexScreener lookup → Jupiter swap |
| `"Convert 100 USDC to SOL with 0.5% slippage"` | Jupiter swap with custom slippage |
| `"Liquid stake 10 SOL with Marinade"` | Marinade deposit → mSOL |
| `"Write onchain memo: gm"` | Memo program |
| `"Send 0.5 SOL to ADDRESS"` | System transfer |
| `"Buy 1 SOL of pair ADDRESS"` | Pair lookup → Jupiter swap |
| `"Dump my WIF"` | Sell WIF for SOL via Jupiter |

---

## The Tech

### 🧠 NLP Parser — No LLM Required
Hand-crafted regex parser extracts actions, amounts, tokens, and protocols from natural language in **<1ms**. No API calls, no latency, no hallucinations. Understands degen speak.

### 🔍 DexScreener Resolution
Paste any token or pair address → SolForge queries DexScreener to find which DEX has the most liquidity, the mint address, price, and symbol. Automatic protocol detection.

### 🪐 Jupiter Aggregation
All swaps route through Jupiter's aggregator for optimal execution across ALL Solana DEXes. Even if a token is identified on Orca, Jupiter finds the best route.

### 🏗️ Protocol Engine
12+ protocol handlers implementing a common interface. Auto-discovered at startup. Adding a new protocol = one file.

```
Prompt → NLP Parser → DexScreener → Jupiter/Protocol Handler → Transaction Builder → Ready to Sign
```

---

## Supported Protocols

Jupiter · Raydium · Orca · Meteora · Pump.fun · Marinade · System Program · SPL Token · Token-2022 · Memo · Jito · Native Stake

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/build/natural` | ⭐ Natural language → transaction |
| POST | `/api/build` | Structured intent → transaction |
| POST | `/api/build/multi` | Batch operations into one tx |
| POST | `/api/decode` | Decode any base64 transaction |
| POST | `/api/estimate` | Estimate fees before building |
| GET | `/api/resolve?query=` | Token/pair lookup via DexScreener |
| GET | `/api/protocols` | List all protocols |
| GET | `/api/protocols/:name/schema` | Protocol parameter schema |
| GET | `/api/docs` | Full API documentation |

---

## 🤖 Agent Use Cases — SolForge + AI = Onchain Autopilot

SolForge handles the **HOW** (transaction building). Your AI agent handles the **WHEN** and **WHY**. Together, they're unstoppable.

### Scheduled Trading
- *"Buy $10 of BONK every hour"* — agent sets a cron job, calls SolForge each tick
- DCA strategies entirely managed by your AI assistant — no dashboards, no manual clicks

### Conditional Execution
- *"If SOL drops below $80, swap all my USDC into SOL"* — agent monitors price, executes when triggered
- *"When my staking rewards hit 1 SOL, restake them"* — fully autonomous compounding

### Portfolio Management
- *"Rebalance my portfolio to 50% SOL, 30% USDC, 20% BONK every week"*
- *"Take profits — sell 10% of any token that's up 50%+"*

### Timed Operations
- *"Unstake my SOL in 3 months"* — agent schedules it, executes when time comes
- *"Remind me to claim my airdrop on March 15th, and if I don't respond, claim it for me"*

### Multi-step Strategies
- *"Swap 5 SOL for USDC, then liquid stake 2 SOL with Marinade, and tip Jito"*
- *"Every morning, check if BONK is down >10%, if so buy 0.5 SOL worth"*

### Social / Copy Trading
- *"Watch wallet ABC123 — whenever they buy a token, buy the same token with 0.1 SOL"*
- Copy-trading powered by natural language

> **The pattern:** You speak English to your agent. The agent speaks SolForge. SolForge speaks Solana. That's it — one API call from intent to onchain execution.

---

## 🗺️ Roadmap

- ✅ Natural language transaction building (12+ protocols)
- ✅ MCP Server for deep agent integration
- ✅ Self-healing NLP parser (regex → learned patterns → LLM fallback)
- 🔜 **Privy embedded wallets** — agents get their own wallet, no private key handling needed. Fund it, delegate, and your agent executes autonomously via Privy's TEE infrastructure
- 🔜 Transaction simulation & dry-run mode
- 🔜 Portfolio queries ("What tokens do I hold?", "What's my SOL balance?")
- 🔜 Event subscriptions ("Notify me when this token moves 5%")
- 🔜 Multi-chain expansion

---

## Project Stats

- **6,000+ lines** of TypeScript
- **12 protocols** with full handler implementations
- **11+ API endpoints** — build, decode, estimate, resolve
- **Sub-millisecond** NLP parsing
- **100% AI-authored** — every line written by AI agents

---

*Built by AI agents. Powered by Solana. [Colosseum Agent Hackathon 2026](https://www.colosseum.org/).*
