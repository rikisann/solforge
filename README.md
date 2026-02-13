# SolForge 🔥

**Any protocol. Any instruction. One API.**

*The universal Solana transaction builder that transforms natural language and structured intents into perfectly constructed, simulated transactions across 12+ protocols.*

---

## 🎯 The Problem

AI agents and developers constantly reinvent the wheel when integrating with Solana protocols. Each protocol has different SDKs, patterns, and quirks. A Jupiter swap looks nothing like a Pump.fun trade or a Marinade stake. This creates:

- **Fragmented codebases** - Every agent rebuilds protocol integrations from scratch
- **Inconsistent UX** - Different APIs mean different error handling and response formats  
- **Maintenance hell** - Protocol updates break agent integrations across the ecosystem
- **Wasted developer time** - Why should every agent rebuild Jupiter integration?

**SolForge solves this.** One API. Any protocol. Perfect transactions.

---

## ✅ Supported Protocols (12 Complete)

| Protocol | Operations | Program ID |
|----------|------------|------------|
| ✅ **System Program** | SOL transfers, account creation | `11111111111111111111111111111112` |
| ✅ **SPL Token** | Token transfers, ATA management, account closing | `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA` |
| ✅ **Jupiter** | Optimal swap routing via Jupiter API | `JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4` |
| ✅ **Memo** | On-chain messages | `MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr` |
| ✅ **Jito** | MEV protection tips | `Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY` |
| ✅ **Raydium AMM** | Swaps with specific pools | `675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8` |
| ✅ **Pump.fun** | Token bonding curves (buy/sell/create) | `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P` |
| ✅ **Orca Whirlpool** | Concentrated liquidity positions | `whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc` |
| ✅ **Marinade** | Liquid staking (mSOL) | `8szGkuLTAux9XMgZ2vtY39jVSowEcpBfFfD8hXSEqdGC` |
| ✅ **Meteora DLMM** | Dynamic liquidity market making | `LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo` |
| ✅ **Token-2022** | Next-gen token standard | `TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb` |
| ✅ **Stake Program** | Native SOL staking operations | `Stake11111111111111111111111111111111111111` |

---

## 🚀 Quick Start

### Installation

```bash
git clone https://github.com/your-org/solforge.git
cd solforge
npm install
cp .env.example .env
```

### Environment Setup

```bash
# .env
PORT=3000
NODE_ENV=development
SOLANA_DEVNET_RPC=https://api.devnet.solana.com
SOLANA_MAINNET_RPC=https://api.mainnet-beta.solana.com
HELIUS_API_KEY=your_helius_key_here
DEFAULT_NETWORK=devnet
JUPITER_API_URL=https://quote-api.jup.ag/v6
```

### Start Development Server

```bash
npm run dev
```

API available at `http://localhost:3000`

---

## 📚 API Reference

### Core Endpoints

#### Health Check
```bash
GET /health
```

#### Build Transaction (Structured Intent)
```bash
POST /api/build

{
  "intent": "transfer",
  "params": {
    "amount": 0.1,
    "to": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
  },
  "payer": "your_wallet_address",
  "network": "devnet"
}
```

#### Build Transaction (Natural Language)
```bash
POST /api/build/natural

{
  "prompt": "swap 1 SOL for USDC with 0.5% slippage",
  "payer": "your_wallet_address"
}
```

#### Get All Protocols
```bash
GET /api/protocols
```

#### Get Protocol Details
```bash
GET /api/protocols/jupiter
```

#### Get Protocol Schema (NEW!)
```bash
GET /api/protocols/jupiter/schema
```

#### Get Comprehensive Documentation (NEW!)
```bash
GET /api/docs
```

#### Get Natural Language Examples
```bash
GET /api/examples
```

#### Get Jupiter Quote
```bash
POST /api/quote

{
  "from": "SOL",
  "to": "USDC", 
  "amount": 1.0,
  "slippage": 0.5
}
```

---

## 🔧 Protocol Reference

### System Program
**Program ID:** `11111111111111111111111111111112`

#### transfer
- **Required:** `amount` (number, SOL), `to` (string, pubkey)
- **Optional:** None

```bash
curl -X POST http://localhost:3000/api/build \
  -H "Content-Type: application/json" \
  -d '{
    "intent": "transfer",
    "params": { "amount": 0.1, "to": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU" },
    "payer": "your_wallet_address"
  }'
```

#### create-account
- **Required:** `space` (number), `lamports` (number), `programId` (string)
- **Optional:** None

```bash
curl -X POST http://localhost:3000/api/build \
  -H "Content-Type: application/json" \
  -d '{
    "intent": "create-account",
    "params": { "space": 165, "lamports": 2039280, "programId": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
    "payer": "your_wallet_address"
  }'
```

---

### SPL Token
**Program ID:** `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA`

#### token-transfer
- **Required:** `amount` (number), `token` (string, symbol or mint), `to` (string, pubkey)
- **Optional:** None

```bash
curl -X POST http://localhost:3000/api/build \
  -H "Content-Type: application/json" \
  -d '{
    "intent": "token-transfer",
    "params": { "amount": 100, "token": "USDC", "to": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU" },
    "payer": "your_wallet_address"
  }'
```

#### create-ata
- **Required:** `token` (string, symbol or mint)
- **Optional:** `owner` (string, pubkey, defaults to payer)

```bash
curl -X POST http://localhost:3000/api/build \
  -H "Content-Type: application/json" \
  -d '{
    "intent": "create-ata",
    "params": { "token": "USDC" },
    "payer": "your_wallet_address"
  }'
```

#### close-account
- **Required:** `token` (string, symbol or mint)
- **Optional:** None

---

### Jupiter
**Program ID:** `JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4`

#### swap
- **Required:** `from` (string, symbol), `to` (string, symbol), `amount` (number)
- **Optional:** `slippage` (number, default 0.5%)

```bash
curl -X POST http://localhost:3000/api/build \
  -H "Content-Type: application/json" \
  -d '{
    "intent": "swap",
    "params": { "from": "SOL", "to": "USDC", "amount": 1.0, "slippage": 0.5 },
    "payer": "your_wallet_address"
  }'
```

---

### Memo
**Program ID:** `MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr`

#### memo
- **Required:** `message` (string)
- **Optional:** None

```bash
curl -X POST http://localhost:3000/api/build \
  -H "Content-Type: application/json" \
  -d '{
    "intent": "memo",
    "params": { "message": "Hello Solana!" },
    "payer": "your_wallet_address"
  }'
```

---

### Jito
**Program ID:** `Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY`

#### tip
- **Required:** None
- **Optional:** `amount` (number, SOL, default 0.001)

```bash
curl -X POST http://localhost:3000/api/build \
  -H "Content-Type: application/json" \
  -d '{
    "intent": "tip",
    "params": { "amount": 0.001 },
    "payer": "your_wallet_address"
  }'
```

---

### Raydium AMM
**Program ID:** `675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8`

#### raydium-swap
- **Required:** `from` (string), `to` (string), `amount` (number)
- **Optional:** `pool` (string, pool address), `slippage` (number)

---

### Pump.fun
**Program ID:** `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P`

#### pumpfun-buy
- **Required:** `token` (string, mint), `amount` (number, SOL)
- **Optional:** `slippage` (number)

#### pumpfun-sell
- **Required:** `token` (string, mint), `amount` (number, tokens)
- **Optional:** `slippage` (number)

#### pumpfun-create
- **Required:** `name` (string), `symbol` (string), `uri` (string)
- **Optional:** None

---

### Orca Whirlpool
**Program ID:** `whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc`

#### orca-swap
- **Required:** `from` (string), `to` (string), `amount` (number)
- **Optional:** `pool` (string), `slippage` (number)

#### orca-open-position
- **Required:** `pool` (string), `lowerPrice` (number), `upperPrice` (number), `liquidity` (number)
- **Optional:** None

#### orca-close-position
- **Required:** `position` (string, position address)
- **Optional:** None

---

### Marinade
**Program ID:** `8szGkuLTAux9XMgZ2vtY39jVSowEcpBfFfD8hXSEqdGC`

#### marinade-stake
- **Required:** `amount` (number, SOL)
- **Optional:** None

#### marinade-unstake
- **Required:** `amount` (number, mSOL)
- **Optional:** None

---

### Meteora DLMM
**Program ID:** `LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo`

#### meteora-swap
- **Required:** `from` (string), `to` (string), `amount` (number)
- **Optional:** `pool` (string), `slippage` (number)

#### meteora-add-liquidity
- **Required:** `pool` (string), `amount` (number)
- **Optional:** None

#### meteora-remove-liquidity
- **Required:** `pool` (string), `amount` (number)
- **Optional:** None

---

### Token-2022
**Program ID:** `TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb`

#### token2022-transfer
- **Required:** `amount` (number), `token` (string, mint), `to` (string, pubkey)
- **Optional:** None

#### token2022-create-ata
- **Required:** `token` (string, mint)
- **Optional:** None

---

### Stake Program
**Program ID:** `Stake11111111111111111111111111111111111111`

#### stake
- **Required:** `amount` (number, SOL)
- **Optional:** `validator` (string, vote account pubkey)

#### delegate
- **Required:** `stakeAccount` (string), `validator` (string)
- **Optional:** None

#### deactivate
- **Required:** `stakeAccount` (string)
- **Optional:** None

#### withdraw
- **Required:** `stakeAccount` (string), `amount` (number)
- **Optional:** `destination` (string, pubkey)

---

## 💬 Natural Language Examples

SolForge understands natural language and converts it to structured transactions:

1. **"transfer 0.1 SOL to 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"**
   → System Program transfer

2. **"swap 1 SOL for USDC with 0.5% slippage"**
   → Jupiter swap with slippage control

3. **"send 100 USDC to 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"**
   → SPL Token transfer

4. **"memo \"Payment for services rendered\""**
   → On-chain memo instruction

5. **"stake 2 SOL with validator ValidatorVoteAccount123"**
   → Native staking with specific validator

6. **"tip 0.005 SOL for MEV protection"**
   → Jito tip for transaction priority

7. **"buy 1 SOL worth of BONK on pump.fun"**
   → Pump.fun token purchase

8. **"create ATA for USDC token"**
   → Associated Token Account creation

9. **"unstake 1.5 mSOL from marinade"**
   → Marinade liquid unstaking

10. **"add 1000 USDC liquidity to meteora pool PoolAddress123"**
    → Meteora DLMM liquidity provision

11. **"close my USDT token account"**
    → SPL Token account closing

12. **"open orca position from 95 to 105 with 500 liquidity"**
    → Orca Whirlpool concentrated liquidity

13. **"delegate stake account StakeAccount123 to ValidatorVote456"**
    → Stake program delegation

14. **"swap SOL to USDC on raydium with 1% slippage"**
    → Raydium AMM-specific swap

15. **"withdraw 0.5 SOL from stake account StakeAccount789"**
    → Stake withdrawal operation

16. **"create pump.fun token called 'MyCoin' symbol 'COIN' with metadata https://meta.uri"**
    → Token creation on bonding curve

17. **"transfer 50 tokens of mint TokenMint123 using token2022"**
    → Token-2022 program transfer

18. **"get quote for swapping 5 SOL to USDC"**
    → Jupiter quote request (no transaction)

---

## 🏗️ Architecture

```
src/
├── engine/
│   ├── builder.ts       # Core transaction builder
│   ├── simulator.ts     # RPC simulation engine
│   ├── resolver.ts      # Account/PDA resolution
│   └── intent-parser.ts # Natural language → structured intent
├── protocols/           # Protocol implementations (12 protocols)
│   ├── system.ts        # SOL transfers & account creation
│   ├── spl-token.ts     # Token operations & ATA management
│   ├── jupiter.ts       # Swap routing via Jupiter API
│   ├── memo.ts          # On-chain memos
│   ├── jito.ts          # MEV tips
│   ├── raydium.ts       # Raydium AMM swaps
│   ├── pumpfun.ts       # Pump.fun bonding curves
│   ├── orca.ts          # Orca Whirlpool concentrated liquidity
│   ├── marinade.ts      # Liquid staking (mSOL)
│   ├── meteora.ts       # Dynamic liquidity market making
│   ├── token2022.ts     # Next-gen token standard
│   └── stake.ts         # Native SOL staking
├── api/
│   ├── routes.ts        # HTTP endpoints & comprehensive documentation
│   └── middleware.ts    # Error handling, validation, rate limiting
└── utils/
    ├── connection.ts    # Multi-network RPC connections
    └── types.ts         # Shared interfaces & protocol handler
```

### Core Components

- **TransactionBuilder**: Orchestrates protocol handlers and builds final transactions
- **IntentParser**: Converts natural language to structured intents using pattern matching
- **ProtocolRegistry**: Dynamic protocol handler registry with conflict resolution
- **Simulator**: Pre-validates all transactions via RPC simulation
- **AccountResolver**: Resolves addresses, PDAs, and validates account existence

---

## 🔧 Extending SolForge

Adding a new protocol is straightforward. Implement the `ProtocolHandler` interface:

```typescript
import { ProtocolHandler } from '../utils/types';

export class YourProtocol implements ProtocolHandler {
  name = 'your-protocol';
  description = 'Description of your protocol';
  supportedIntents = ['your-action', 'another-action'];

  async build(intent: BuildIntent): Promise<TransactionInstruction[]> {
    // Build transaction instructions
  }

  validateParams(params: Record<string, any>): boolean {
    // Validate input parameters
  }

  getRequiredAccounts(params: Record<string, any>): PublicKey[] {
    // Return required accounts for transaction
  }
}
```

Then register it in `src/protocols/index.ts`:

```typescript
import { YourProtocol } from './your-protocol';

// In ProtocolRegistry static block
this.register(new YourProtocol());
```

That's it! Your protocol is now available via:
- Structured API: `POST /api/build`
- Natural language: `POST /api/build/natural`  
- Documentation: `GET /api/protocols/your-protocol`
- Schema discovery: `GET /api/protocols/your-protocol/schema`

---

## 🔐 Security & Reliability

- **No Private Keys** - SolForge never handles private keys, only builds unsigned transactions
- **Simulation First** - Every transaction is simulated before returning to catch errors early
- **Input Validation** - Comprehensive parameter validation with type checking
- **Rate Limiting** - Configurable rate limiting on all endpoints
- **Error Handling** - Graceful error handling with detailed error messages
- **CORS & Headers** - Security headers and CORS configured for production use

---

## 🚀 Production Deployment

### Build & Run
```bash
npm run build
npm start
```

### Docker Deployment
```bash
docker build -t solforge .
docker run -p 3000:3000 --env-file .env solforge
```

### Environment Variables (Production)
```bash
NODE_ENV=production
SOLANA_MAINNET_RPC=https://your-premium-rpc-endpoint
HELIUS_API_KEY=your_production_helius_key
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=1000
```

---

## 📊 Response Format

```json
{
  "success": true,
  "transaction": "base64_serialized_transaction_ready_to_sign",
  "simulation": {
    "success": true,
    "logs": [
      "Program 11111111111111111111111111111112 invoke [1]",
      "Program 11111111111111111111111111111112 success"
    ],
    "unitsConsumed": 150
  },
  "details": {
    "protocol": "system",
    "instructions": 1,
    "accounts": ["7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"],
    "estimatedFee": "0.000005 SOL",
    "computeUnits": 150,
    "priorityFee": 0,
    "parsedIntent": {
      "action": "transfer", 
      "protocol": "system",
      "confidence": 0.95
    }
  }
}
```

---

## ⚡ Performance & Scale

- **Sub-100ms Response Times** - Optimized protocol handlers and connection pooling
- **Multi-Network Support** - Devnet, testnet, and mainnet with automatic RPC routing
- **Concurrent Request Handling** - Express.js with proper async/await patterns
- **Memory Efficient** - Stateless design with minimal memory footprint
- **Horizontal Scaling** - Deploy multiple instances behind a load balancer

---

## 🤖 Built for the Colosseum Agent Hackathon

SolForge was specifically designed for the **Colosseum Agent Hackathon** to solve the protocol integration nightmare that every agent developer faces.

### Why Agents Need SolForge

1. **Consistent Interface** - Same API for all protocols
2. **Natural Language** - Agents can send human-like commands
3. **Error Prevention** - Simulation catches issues before signing
4. **Schema Discovery** - Agents can auto-discover parameter requirements
5. **Comprehensive Coverage** - 12 protocols, 30+ operations ready to use

### Integration Examples

```javascript
// Agent integrating with SolForge
const response = await fetch('http://solforge.api/api/build/natural', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: userMessage, // "swap 1 SOL for USDC"
    payer: userWallet
  })
});

const { transaction, simulation, details } = await response.json();

// Transaction is ready to sign and send!
```

---

**Built with ❤️ for the Solana ecosystem and AI agent developers**

*SolForge - Where natural language meets blockchain transactions*