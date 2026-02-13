# CLAUDE.md — SolForge AI Context

## What is SolForge?
SolForge is a universal Solana transaction builder API. It transforms natural language or structured intents into ready-to-sign Solana transactions across 12+ protocols. It also ships as an MCP server for direct AI agent integration.

## Architecture
```
src/
├── index.ts              # Express server entry point
├── mcp.ts                # MCP server (stdio transport, run via `npm run mcp`)
├── api/
│   ├── routes.ts         # All API endpoints + Jupiter routing logic
│   └── middleware.ts     # Validation, rate limiting, logging
├── engine/
│   ├── builder.ts        # TransactionBuilder — orchestrates instruction building
│   ├── intent-parser.ts  # NLP regex parser (<1ms, no LLM)
│   ├── token-resolver.ts # DexScreener integration for token/pair lookup
│   ├── resolver.ts       # Account resolution utilities
│   ├── decoder.ts        # Transaction decoder
│   └── estimator.ts      # Fee estimator
├── protocols/            # One handler per protocol (12+)
│   ├── jupiter.ts        # Jupiter swap via lite-api.jup.ag (free, no auth)
│   ├── raydium.ts        # Raydium AMM
│   ├── orca.ts           # Orca Whirlpool
│   ├── meteora.ts        # Meteora DLMM
│   ├── pumpfun.ts        # Pump.fun bonding curves
│   ├── marinade.ts       # Liquid staking
│   ├── system.ts         # SOL transfers
│   ├── spl-token.ts      # SPL token operations
│   ├── memo.ts           # On-chain memos
│   ├── jito.ts           # MEV tips
│   ├── stake.ts          # Native staking
│   └── token2022.ts      # Token-2022 standard
├── utils/
│   ├── types.ts          # All TypeScript interfaces (BuildIntent, ProtocolHandler, etc.)
│   └── connection.ts     # RPC connection + token mint resolution
public/
└── index.html            # Landing page with wallet integration (Tailwind CSS)
```

## Key Patterns

### How swaps work
ALL swap/buy/sell operations route through Jupiter for real executable transactions:
1. IntentParser extracts action, token, amount from natural language
2. DexScreener resolves token → identifies which DEX has most liquidity  
3. Buy/sell params are transformed to swap params (from/to mint addresses)
4. Jupiter lite API (`lite-api.jup.ag/swap/v1`) builds the actual transaction (quote → swap)
5. Individual DEX handlers exist but produce placeholder instructions — Jupiter is the real path

### Adding a new protocol
1. Create `src/protocols/your-protocol.ts` implementing `ProtocolHandler` interface
2. Export the class — it's auto-discovered by `ProtocolRegistry` in `src/protocols/index.ts`
3. Add NLP patterns in `src/engine/intent-parser.ts` if you want natural language support
4. Add to `mapToBuilderIntent()` in `src/api/routes.ts` for action mapping

### Important: Jupiter `useSharedAccounts`
Must be `false` — pump.fun tokens use "simple AMMs" which fail with shared accounts.

### Important: Token decimals
`jupiter.ts` has a hardcoded `getTokenDecimals()` map. When adding new tokens, add their decimals here or amounts will be wrong.

## Commands
```bash
npm run build          # Compile TypeScript
npm start              # Run API server (production)
npm run dev            # Run with ts-node (development)
npm run mcp            # Run MCP server (stdio transport)
```

## Environment Variables
```bash
PORT=3001                                          # Server port
DEFAULT_NETWORK=mainnet                            # mainnet or devnet
SOLANA_MAINNET_RPC=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
JUPITER_API_URL=https://lite-api.jup.ag/swap/v1   # Free, no auth required
```

## API Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/build/natural` | Natural language → transaction (⭐ main endpoint) |
| POST | `/api/build` | Structured intent → transaction |
| POST | `/api/build/multi` | Batch multiple intents into one tx |
| POST | `/api/decode` | Decode base64 transaction |
| POST | `/api/estimate` | Estimate fees before building |
| GET | `/api/resolve?query=` | Token/pair lookup via DexScreener |
| GET | `/api/protocols` | List all supported protocols |
| GET | `/api/protocols/:name/schema` | Get protocol parameter schema |
| GET | `/api/docs` | Full API documentation |
| POST | `/api/rpc` | RPC proxy (keeps API keys server-side) |

## MCP Tools
When running as MCP server (`npm run mcp`), exposes:
- `build_transaction_natural` — NLP → transaction
- `build_transaction` — structured intent → transaction  
- `resolve_token` — token/pair lookup
- `list_protocols` — list all protocols
- `estimate_transaction` — fee estimation
- `decode_transaction` — decode base64 tx

## Testing
```bash
# Build a swap transaction
curl -X POST http://localhost:3001/api/build/natural \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Swap 1 SOL for USDC", "payer": "YOUR_WALLET", "skipSimulation": true}'

# Write a memo (cheapest test)
curl -X POST http://localhost:3001/api/build/natural \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Write onchain memo: gm", "payer": "YOUR_WALLET"}'

# Resolve a token
curl "http://localhost:3001/api/resolve?query=BONK"
```

## Common Issues
- **Jupiter 401**: You're hitting `api.jup.ag` (needs paid key). Use `lite-api.jup.ag/swap/v1` (free).
- **Simulation fails on swaps**: Wallet needs funds. Use `skipSimulation: true` for demos.
- **"Simple AMMs not supported"**: `useSharedAccounts` must be `false` in Jupiter swap POST.
- **Blockhash expired**: The landing page refreshes blockhash before signing. If using the API directly, get a fresh blockhash before submitting.
