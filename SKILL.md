# SolForge Skill — Solana Transaction Builder

Use SolForge to build Solana transactions from natural language. One API call does everything.

**Base URL:** `https://solforge-production.up.railway.app`

## The Only Endpoint You Need

```bash
POST /api/build/natural
Content-Type: application/json

{
  "prompt": "Swap 2 SOL for USDC",
  "payer": "WALLET_PUBLIC_KEY"
}
```

**That's it.** SolForge handles token resolution, protocol detection, and optimal routing automatically. You do NOT need to resolve tokens first — just put the token name or mint address directly in the prompt.

### Response
```json
{
  "success": true,
  "transaction": "base64_encoded_transaction_ready_to_sign",
  "details": {
    "protocol": "jupiter",
    "parsedIntent": { "action": "swap", "params": { "from": "SOL", "to": "USDC", "amount": 2 } },
    "confidence": 0.95
  }
}
```

The `transaction` field is a base64-encoded Solana transaction ready for wallet signing.

### Prompt Format Guide

**IMPORTANT:** Use these exact phrasings for best results. The parser uses regex patterns, not an LLM, so structure matters.

**Swaps (many verbs supported):**
- `"Swap 5 SOL for BONK"` ← best format
- `"Swap 1 SOL for USDC with 0.5% slippage"`
- `"Swap SOL to USDC"` (defaults to 1 SOL)
- `"Exchange 5 SOL for BONK"` / `"Exchange 5 SOL into BONK"`
- `"Convert 100 USDC to SOL"`
- `"Trade 3 SOL for USDC"` / `"Trade 3 SOL for USDC with 1% slippage"`
- `"Change 50 USDT to USDC"`
- `"Flip SOL to USDC"`
- Prefixed with natural language: `"I want to swap 2 SOL for USDC"`, `"please swap 1 SOL to USDC"`

**Buy variations:**
- `"Buy 5 BONK"` / `"Buy BONK"` (defaults to 1 SOL worth)
- `"Buy some BONK"` / `"Purchase BONK"` / `"Get me BONK"`
- `"Buy 5 SOL worth of BONK"` / `"Buy 5 SOL of BONK"`
- `"Buy BONK with 5 SOL"` / `"Get me 2 SOL of USDC"`

**Sell variations:**
- `"Sell BONK"` / `"Sell 100 BONK"` / `"Sell 100 BONK for SOL"`
- `"Sell my BONK"` / `"Sell my BONK for SOL"` / `"Sell all BONK"`
- `"Dump BONK"` / `"Short BONK"`

**Degen slang:**
- `"Ape 5 SOL into BONK"` / `"Ape into BONK"` (defaults to 1 SOL)
- `"Yolo 1 SOL into BONK"`
- `"Long BONK with 2 SOL"` (buy) / `"Short BONK"` (sell)

**With mint addresses:**
- `"Swap 2 SOL for DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"`
- `"Ape 5 SOL into MINT_ADDRESS"`

**DEX-specific swaps:**
- `"Swap 1 SOL for USDC on raydium"` / `on orca` / `on meteora`

**Transfers:**
- `"Send 0.5 SOL to ADDRESS"` / `"Transfer 100 USDC to ADDRESS"`
- `"Pay ADDRESS 1 SOL"` / `"Send ADDRESS 2 USDC"` (address-first format)

**Staking:**
- `"Stake 5 SOL"` / `"Liquid stake 5 SOL"` / `"Stake 5 SOL with Marinade"`
- `"Unstake 5 mSOL"` / `"Unstake 5 mSOL from Marinade"` / `"Withdraw stake"`

**Memos:**
- `"Memo hello world"` / `"Write memo gm"` / `"Onchain memo: test"` / `"Post memo: hello"`

**Tips:**
- `"Tip 0.01 SOL to Jito"` / `"Tip jito 0.01 SOL"` / `"Jito tip 0.01"`
- `"Tip 0.01 to jito"` / `"Send jito tip"` (default 0.001 SOL)

**Chained operations (use "and" or "then" between operations):**
- `"Swap 1 SOL for USDC and tip 0.01 SOL to Jito"`
- `"Send 0.5 SOL to ADDRESS then write memo gm"`
- `"Buy BONK and tip jito 0.01"`

When in doubt, use the format: **"Swap [AMOUNT] [FROM_TOKEN] for [TO_TOKEN]"**

### Options
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `prompt` | string | ✅ | Natural language description |
| `payer` | string | ✅ | Wallet public key |
| `skipSimulation` | boolean | No | Skip RPC simulation (use for demos/unfunded wallets) |
| `network` | string | No | `"mainnet"` (default) or `"devnet"` |

## Other Endpoints (Optional)

Most agents only need `/api/build/natural`. These are available if you need them:

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/build` | Structured intent builder (for programmatic use) |
| POST | `/api/build/multi` | Batch multiple structured intents |
| POST | `/api/decode` | Decode a base64 transaction |
| POST | `/api/estimate` | Estimate fees before building |
| GET | `/api/resolve?query=BONK` | Look up token/pair info |
| GET | `/api/protocols` | List all 12+ supported protocols |

## Execute Mode — One API Call from English to Onchain

Skip wallet signing entirely. Pass `execute: true` and a `privateKey` to go from natural language straight to an onchain transaction.

### One-call execute

```json
POST /api/build/natural
{
  "prompt": "Swap 0.1 SOL for USDC",
  "payer": "YOUR_PUBLIC_KEY",
  "privateKey": "base58_private_key",
  "execute": true
}
```

Response:
```json
{
  "success": true,
  "executed": true,
  "signature": "5UfDu...",
  "explorerUrl": "https://solscan.io/tx/5UfDu...",
  "transaction": "base64...",
  "details": { ... }
}
```

### Two-step build-then-execute

1. Build (inspect the transaction first):
```json
POST /api/build/natural
{ "prompt": "Transfer 1 SOL to 9aE2...", "payer": "YOUR_PUBLIC_KEY" }
```

2. Execute:
```json
POST /api/execute
{ "transaction": "base64_from_step_1", "privateKey": "base58_private_key" }
```

### Multi-transaction execute

When `execute: true` is used with multi-intent prompts, ALL transactions are signed and sent. The response includes `signatures` and `explorerUrls` arrays.

`/api/execute` also accepts an array of transactions:
```json
{ "transaction": ["base64_tx1", "base64_tx2"], "privateKey": "..." }
```

### Security notes

- **HTTPS only** — never send private keys over unencrypted connections
- Keys are used in-memory only, never logged or written to disk
- Response includes `X-Solforge-Warning: private-key-provided` header when a key is used
- If `execute` is false or `privateKey` is missing, SolForge behaves exactly as before (returns unsigned tx)

## Key Tips

1. **Don't resolve tokens separately.** Just put the token name in the prompt — SolForge resolves it automatically via DexScreener.
2. **Use `skipSimulation: true`** if the wallet doesn't have funds or you just want the transaction structure.
3. **Mint addresses work directly** in prompts — no need to look them up first.
4. **The response `transaction` is ready to sign** — deserialize with `@solana/web3.js` and sign with the wallet.

## Supported Protocols
Jupiter, Raydium, Orca, Meteora, Pump.fun, Marinade, System Program, SPL Token, Token-2022, Memo, Jito, Native Stake.
