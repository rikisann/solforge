# SolForge ⚡

**Natural Language → Solana Transactions**

SolForge is a universal transaction builder API for Solana. Describe what you want in plain English — or use structured intents — and get back a fully constructed, ready-to-sign transaction. No SDKs, no protocol-specific code, no headaches.

> 🏆 Built entirely by AI agents for the [Colosseum Agent Hackathon](https://www.colosseum.org/)

**[Live Demo](https://started-acquisition-liz-department.trycloudflare.com)** · **[API Docs](#api-reference)** · **[GitHub](https://github.com/rikisann/solforge)**

---

## 🔌 MCP Server — Plug Into Any AI Agent

SolForge ships as an **MCP (Model Context Protocol) server**, meaning any AI agent (Claude, GPT, etc.) can use it as a tool out of the box.

```json
// claude_desktop_config.json
{
  "mcpServers": {
    "solforge": {
      "command": "node",
      "args": ["/path/to/solforge/dist/mcp.js"],
      "env": {
        "SOLANA_MAINNET_RPC": "your_rpc_url"
      }
    }
  }
}
```

Your AI agent instantly gets these tools:
- **`build_transaction_natural`** — "Swap 5 SOL for BONK" → ready-to-sign transaction
- **`build_transaction`** — Structured intent builder
- **`resolve_token`** — Token/pair lookup via DexScreener
- **`list_protocols`** — See all 12+ supported protocols
- **`estimate_transaction`** — Check fees before building
- **`decode_transaction`** — Decode any Solana transaction

No REST API calls, no HTTP overhead — direct tool integration via stdio.

---

## Why SolForge?

Every Solana app rebuilds the same integrations. Jupiter swap? Different SDK. Marinade stake? Different pattern. Pump.fun buy? Different everything. Each protocol has its own quirks, its own transaction format, its own error codes.

**SolForge eliminates this entirely.**

One API call. Any protocol. Any operation. You describe what you want, SolForge figures out the rest.

### For AI Agents
AI agents shouldn't need to know the difference between Orca and Raydium. They should say *"swap 5 SOL for BONK"* and get a transaction back. SolForge is the **knowledge layer** between AI agents and the Solana blockchain — it knows 12+ protocol IDLs so your agent doesn't have to. Plug in via **MCP** or **REST API** — your choice.

### For Developers
Stop importing 15 different SDKs. SolForge gives you one consistent API with structured intents, natural language support, and real-time protocol resolution. Build your app, not your infrastructure.

### For Traders
Connect your wallet, type what you want, click send. The demo page lets you execute real mainnet transactions from plain English commands.

---

## The Tech Behind It

### 🧠 Intelligent NLP Parser
SolForge doesn't use an LLM to parse your prompts — it uses a hand-crafted regex-based intent parser that extracts actions, amounts, tokens, protocols, and parameters from natural language in **under 1ms**. No API calls, no latency, no hallucinations.

Understands degen speak:
- *"ape 2 SOL into BONK"* → swap via Jupiter
- *"dump my WIF"* → sell via Jupiter  
- *"liquid stake 10 SOL"* → Marinade deposit

### 🔍 DexScreener Token Resolution
When you mention a token by address or name, SolForge queries DexScreener to identify:
- Which DEX has the most liquidity for that token
- The token's mint address, symbol, and price
- Whether it's a pair address or token address

This means you can paste a random pump.fun token address and SolForge automatically knows it trades on Raydium, Meteora, or wherever it has the most liquidity.

### 🪐 Jupiter Aggregation
All swap operations route through Jupiter's aggregator API for optimal execution. Even if DexScreener identifies a token on Orca, the actual transaction is built by Jupiter — which finds the best route across ALL DEXes, splits orders, and returns a fully constructed transaction ready to sign.

### 🏗️ Protocol Engine Architecture
Under the hood, SolForge uses a **decoder registry pattern**:
- Each of the 12+ protocols is a self-contained handler implementing a common interface
- The `ProtocolRegistry` discovers and loads handlers at startup
- The `TransactionBuilder` orchestrates handler selection, instruction building, compute budget, priority fees, and simulation
- The `IntentParser` maps natural language to structured intents with protocol/action/params

```
User Prompt → IntentParser → DexScreener Resolution → Jupiter/Protocol Handler → Transaction Builder → Signed Transaction
```

### 🔐 Wallet Integration
The demo page includes full Phantom/Solflare wallet integration:
1. Build transaction from natural language
2. Fresh blockhash injected right before signing (no expiration issues)
3. Sign with your wallet
4. Send to mainnet via RPC proxy (API keys stay server-side)
5. View on Solscan

---

## Supported Protocols

| Protocol | Operations | What It Does |
|----------|-----------|--------------|
| **Jupiter** | swap | Optimal swap routing across all DEXes |
| **Raydium** | swap | AMM swaps with specific pools |
| **Orca** | swap | Concentrated liquidity swaps |
| **Meteora** | swap | Dynamic liquidity market making |
| **Pump.fun** | buy, sell, create | Bonding curve token trading |
| **Marinade** | stake, unstake | Liquid staking (SOL → mSOL) |
| **System** | transfer | Native SOL transfers |
| **SPL Token** | transfer, create-ata, close | Token operations |
| **Token-2022** | transfer | Next-gen token standard |
| **Memo** | memo | On-chain messages |
| **Jito** | tip | MEV protection tips |
| **Stake** | stake, delegate, deactivate, withdraw | Native SOL staking |

---

## Quick Start

### Installation

```bash
git clone https://github.com/rikisann/solforge.git
cd solforge
npm install
cp .env.example .env
```

### Configuration

```bash
# .env
PORT=3001
DEFAULT_NETWORK=mainnet
SOLANA_MAINNET_RPC=https://api.mainnet-beta.solana.com  # or your Helius/QuickNode URL
JUPITER_API_URL=https://lite-api.jup.ag/swap/v1
```

### Run

```bash
npm run build
npm start
```

Server starts at `http://localhost:3001`. Visit in your browser for the interactive demo, or call the API directly.

---

## API Reference

### `POST /api/build/natural` — The Star Endpoint ⭐

Transform natural language into a Solana transaction. This is what makes SolForge special.

```bash
curl -X POST http://localhost:3001/api/build/natural \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Swap 1 SOL for USDC",
    "payer": "YOUR_WALLET_ADDRESS"
  }'
```

**Response:**
```json
{
  "success": true,
  "transaction": "AQAAAA...(base64 encoded, ready to sign)...",
  "details": {
    "protocol": "jupiter",
    "parsedIntent": {
      "protocol": "jupiter",
      "action": "swap",
      "params": { "from": "SOL", "to": "USDC", "amount": 1 },
      "confidence": 0.95
    },
    "note": "Routed through Jupiter for optimal execution."
  }
}
```

**What it understands:**
| Prompt | What Happens |
|--------|-------------|
| `"Ape 2 SOL into BONK"` | Swap via Jupiter, BONK resolved via DexScreener |
| `"Convert 100 USDC to SOL with 0.5% slippage"` | Jupiter swap with custom slippage |
| `"Liquid stake 10 SOL with Marinade"` | Marinade deposit |
| `"Write onchain memo: gm from SolForge"` | Memo program |
| `"Buy 1 SOL of pair ABC123..."` | DexScreener pair lookup → Jupiter swap |
| `"Send 0.5 SOL to ADDRESS"` | System transfer |
| `"Dump my WIF"` | Sell WIF for SOL via Jupiter |

**Options:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `prompt` | string | Natural language description (required) |
| `payer` | string | Wallet public key (required) |
| `skipSimulation` | boolean | Skip RPC simulation (useful for demos without funded wallets) |
| `network` | string | `"mainnet"` or `"devnet"` (default: mainnet) |
| `priorityFee` | number | Priority fee in microlamports |
| `computeBudget` | number | Compute unit limit |

---

### `POST /api/build` — Structured Intent Builder

For programmatic use when you know exactly what you want.

```bash
curl -X POST http://localhost:3001/api/build \
  -H "Content-Type: application/json" \
  -d '{
    "intent": "swap",
    "params": {
      "from": "SOL",
      "to": "USDC",
      "amount": 1.0,
      "slippage": 0.5
    },
    "payer": "YOUR_WALLET_ADDRESS"
  }'
```

**Available intents:** `transfer`, `token-transfer`, `swap`, `memo`, `tip`, `marinade-stake`, `marinade-unstake`, `raydium-swap`, `orca-swap`, `meteora-swap`, `pumpfun-buy`, `pumpfun-sell`, `stake`, `delegate`, `deactivate`, `withdraw`

---

### `POST /api/build/multi` — Batch Builder

Combine multiple operations into one atomic transaction.

```bash
curl -X POST http://localhost:3001/api/build/multi \
  -H "Content-Type: application/json" \
  -d '{
    "intents": [
      { "intent": "memo", "params": { "message": "batch tx" } },
      { "intent": "transfer", "params": { "to": "ADDRESS", "amount": 0.01 } }
    ],
    "payer": "YOUR_WALLET_ADDRESS"
  }'
```

---

### `POST /api/decode` — Transaction Decoder

Decode any base64 Solana transaction into human-readable format.

```bash
curl -X POST http://localhost:3001/api/decode \
  -H "Content-Type: application/json" \
  -d '{ "transaction": "AQAAAA..." }'
```

---

### `POST /api/estimate` — Fee Estimator

Estimate transaction costs before building.

```bash
curl -X POST http://localhost:3001/api/estimate \
  -H "Content-Type: application/json" \
  -d '{
    "intent": "transfer",
    "params": { "to": "ADDRESS", "amount": 1.0 },
    "payer": "YOUR_WALLET_ADDRESS"
  }'
```

---

### `GET /api/resolve?query=TOKEN` — Token/Pair Resolver

Look up any token or pair address via DexScreener.

```bash
curl "http://localhost:3001/api/resolve?query=DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"
```

**Response:**
```json
{
  "token": {
    "symbol": "Bonk",
    "name": "Bonk",
    "mint": "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    "primaryDex": "orca",
    "priceUsd": "0.000006031",
    "liquidity": 862016.39
  }
}
```

---

### `GET /api/protocols` — List Protocols

```bash
curl "http://localhost:3001/api/protocols"
```

### `GET /api/protocols/:name/schema` — Protocol Schema

```bash
curl "http://localhost:3001/api/protocols/jupiter/schema"
```

### `GET /api/docs` — Full API Documentation

Returns comprehensive JSON documentation for all endpoints.

---

## Use Cases

### 🤖 AI Agent Integration (MCP)
```json
// Any MCP-compatible agent (Claude, GPT, etc.) can call SolForge tools directly:
// Tool: build_transaction_natural
// Input: { "prompt": "swap 5 SOL for USDC", "payer": "WALLET_ADDRESS" }
// Output: { "transaction": "base64...", "protocol": "jupiter", "confidence": 0.95 }
```

### 🤖 AI Agent Integration (REST)
```python
# Or use the REST API from any language
response = requests.post("https://your-solforge-url/api/build/natural", json={
    "prompt": agent_decision,  # "swap 5 SOL for USDC"
    "payer": wallet_address
})
transaction = response.json()["transaction"]
# Sign and send with your agent's wallet
```

### 🔄 Trading Bots
```javascript
// Build any swap with one consistent API
const tx = await fetch('/api/build/natural', {
  method: 'POST',
  body: JSON.stringify({
    prompt: `Buy ${amount} SOL of ${tokenMint}`,
    payer: botWallet.publicKey.toString()
  })
});
```

### 📱 Wallet Apps
Embed SolForge as the transaction engine. Users type what they want, your app handles signing. No need to integrate individual protocol SDKs.

### 🎓 Education
Decode any transaction to understand what it does. Build transactions from natural language to learn how Solana works without writing Rust or understanding program accounts.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     SolForge API                         │
├──────────────┬──────────────┬──────────────┬────────────┤
│  NLP Parser  │  DexScreener │   Jupiter    │  Protocol  │
│  (regex,     │  Resolver    │  Aggregator  │  Registry  │
│   <1ms)      │  (token →    │  (optimal    │  (12+      │
│              │   DEX info)  │   routing)   │  handlers) │
├──────────────┴──────────────┴──────────────┴────────────┤
│              Transaction Builder Engine                   │
│  ┌─────────┬──────────┬────────────┬──────────────────┐  │
│  │ Compute │ Priority │ Simulation │ Blockhash Mgmt   │  │
│  │ Budget  │ Fees     │ Engine     │                  │  │
│  └─────────┴──────────┴────────────┴──────────────────┘  │
├──────────────────────────────────────────────────────────┤
│                   Solana RPC Layer                        │
└──────────────────────────────────────────────────────────┘
```

---

## Project Stats

- **6,000+ lines** of TypeScript
- **12 protocols** with full handler implementations  
- **11+ API endpoints** covering build, decode, estimate, resolve
- **Sub-millisecond** NLP parsing (no LLM dependency)
- **100% AI-authored** — every line written by AI agents

---

## Built With

- **TypeScript** — Type-safe from top to bottom
- **Express** — Lightweight API server
- **@solana/web3.js** — Solana transaction construction
- **Jupiter Lite API** — Swap aggregation (free, no auth required)
- **DexScreener API** — Real-time token/pair resolution
- **Tailwind CSS** — Modern landing page UI

---

## License

MIT

---

*Built by AI agents. Powered by Solana. Submitted to the Colosseum Agent Hackathon 2026.*
