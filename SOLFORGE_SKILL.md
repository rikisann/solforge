# SolForge Skill — Solana Transaction Builder

Add this to your Claude's context to give it the ability to build and execute Solana transactions using natural language.

## Setup

### Option 1: MCP Server (Recommended)
Add to your Claude Desktop `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "solforge": {
      "command": "node",
      "args": ["/path/to/solforge/dist/mcp.js"],
      "env": {
        "SOLANA_MAINNET_RPC": "https://mainnet.helius-rpc.com/?api-key=YOUR_KEY",
        "JUPITER_API_URL": "https://lite-api.jup.ag/swap/v1"
      }
    }
  }
}
```

### Option 2: REST API
If SolForge is running as a server, use these endpoints:

**Base URL:** `https://your-solforge-instance.com`

## Available Tools

### Build Transaction from Natural Language
The primary tool. Describe what you want in plain English.

```bash
POST /api/build/natural
Content-Type: application/json

{
  "prompt": "Swap 1 SOL for USDC",
  "payer": "WALLET_PUBLIC_KEY",
  "skipSimulation": false
}
```

**Response:** Returns a base64-encoded transaction ready to sign and send.

**Supported prompts:**
- Swaps: "Swap 5 SOL for BONK", "Convert 100 USDC to SOL", "Ape into TOKEN_ADDRESS"
- Staking: "Liquid stake 10 SOL with Marinade"
- Transfers: "Send 0.5 SOL to ADDRESS"
- Memos: "Write onchain memo: hello world"
- Pair trading: "Buy 1 SOL of pair PAIR_ADDRESS"
- Sells: "Dump my WIF", "Sell TOKEN for SOL"
- Slippage: "Swap 1 SOL for USDC with 0.5% slippage"

### Resolve Token Info
Look up any token or trading pair before building a transaction.

```bash
GET /api/resolve?query=BONK
GET /api/resolve?query=DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263
```

Returns: symbol, name, mint address, primary DEX, price, liquidity.

### Build Structured Transaction
For precise control over parameters:

```bash
POST /api/build
{
  "intent": "swap",
  "params": { "from": "SOL", "to": "USDC", "amount": 1.0, "slippage": 0.5 },
  "payer": "WALLET_PUBLIC_KEY"
}
```

**Available intents:** `transfer`, `token-transfer`, `swap`, `memo`, `tip`, `marinade-stake`, `marinade-unstake`, `raydium-swap`, `orca-swap`, `meteora-swap`, `pumpfun-buy`, `pumpfun-sell`, `stake`, `delegate`

### Batch Multiple Operations
Combine multiple operations into one atomic transaction:

```bash
POST /api/build/multi
{
  "intents": [
    { "intent": "memo", "params": { "message": "batch tx" } },
    { "intent": "transfer", "params": { "to": "ADDRESS", "amount": 0.01 } }
  ],
  "payer": "WALLET_PUBLIC_KEY"
}
```

### Decode Transaction
Understand what a transaction does:

```bash
POST /api/decode
{ "transaction": "AQAAAA...base64..." }
```

### Estimate Fees
Check costs before building:

```bash
POST /api/estimate
{ "intent": "transfer", "params": { "to": "ADDRESS", "amount": 1.0 }, "payer": "WALLET" }
```

### List Protocols
See all 12+ supported protocols:

```bash
GET /api/protocols
```

## Tips for AI Agents

1. **Always use `/api/build/natural`** unless you need precise parameter control — it handles protocol detection, token resolution, and optimal routing automatically.
2. **Use `skipSimulation: true`** if the wallet doesn't have funds yet or you just want to show the transaction structure.
3. **Token addresses work directly** — paste any Solana mint address and SolForge will resolve it via DexScreener.
4. **Pair addresses work too** — "Buy 1 SOL of pair ADDRESS" looks up the pair, identifies the token, and routes through Jupiter.
5. **The response `transaction` field** is a base64-encoded Solana transaction ready for wallet signing.
6. **Check `details.protocol`** in the response to see which protocol was used.
7. **Check `details.confidence`** to see how confident the NLP parser was in its interpretation.

## Supported Protocols
Jupiter, Raydium, Orca, Meteora, Pump.fun, Marinade, System Program, SPL Token, Token-2022, Memo, Jito, Native Stake — all through one unified API.
