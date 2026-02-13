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

**Swaps (use "swap X FROM for TO"):**
- `"Swap 5 SOL for BONK"` ← best format
- `"Swap 1 SOL for USDC with 0.5% slippage"`
- `"Convert 100 USDC to SOL"`
- `"Buy 5 BONK"` (shorthand — buys 5 SOL worth of BONK)
- `"Buy USDC"` (defaults to 1 SOL worth)

**With mint addresses (use "swap X SOL for MINT_ADDRESS"):**
- `"Swap 2 SOL for DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"`
- `"Ape 1 SOL into MINT_ADDRESS"`

**Staking:**
- `"Liquid stake 10 SOL with Marinade"`
- `"Unstake 5 mSOL from Marinade"`

**Transfers (use "send AMOUNT TOKEN to ADDRESS"):**
- `"Send 0.5 SOL to 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"`
- `"Send 100 USDC to ADDRESS"`

**Memos:**
- `"Write onchain memo: hello world"`

**Tips:**
- `"Tip 0.01 SOL to Jito"`

**Chained operations (use "and" between operations):**
- `"Swap 1 SOL for USDC and tip 0.01 SOL to Jito"`
- `"Send 0.5 SOL to ADDRESS and write memo gm"`

**⚠️ Patterns that WON'T work:**
- `"Buy 5 BONK with SOL"` — use `"Swap 5 SOL for BONK"` instead
- `"Purchase BONK tokens"` — use `"Buy BONK"` or `"Swap 1 SOL for BONK"`
- `"I want to exchange my SOL for USDC"` — use `"Swap 1 SOL for USDC"`

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

## Key Tips

1. **Don't resolve tokens separately.** Just put the token name in the prompt — SolForge resolves it automatically via DexScreener.
2. **Use `skipSimulation: true`** if the wallet doesn't have funds or you just want the transaction structure.
3. **Mint addresses work directly** in prompts — no need to look them up first.
4. **The response `transaction` is ready to sign** — deserialize with `@solana/web3.js` and sign with the wallet.

## Supported Protocols
Jupiter, Raydium, Orca, Meteora, Pump.fun, Marinade, System Program, SPL Token, Token-2022, Memo, Jito, Native Stake.
