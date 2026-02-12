# SolForge 🔥

**Universal Solana Transaction Builder API**

Built for the Colosseum Agent Hackathon - transforms natural language and structured intents into perfectly constructed, simulated Solana transactions.

## 🚀 Features

- **Natural Language Processing**: Convert human language to Solana transactions
- **Structured Intents**: Build transactions from predefined schemas  
- **Transaction Simulation**: Every transaction is simulated before returning
- **Multi-Protocol Support**: 20+ Solana protocol integrations
- **Comprehensive Testing**: All transactions validated on devnet/mainnet

## 📋 Supported Protocols

✅ **System Program** - SOL transfers, account creation  
✅ **SPL Token** - Token transfers, ATA management  
✅ **Jupiter** - Optimal swap routing via Jupiter API  
✅ **Memo** - On-chain messages  
✅ **Jito** - MEV protection tips  

🚧 **Coming Soon**: Raydium, Orca, Pump.fun, Marinade, Meteora

## 🔧 Quick Start

### Installation

```bash
git clone <repo>
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

API will be available at `http://localhost:3000`

## 📖 API Documentation

### Health Check
```bash
GET /health
```

### Build Transaction (Structured)
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

### Build Transaction (Natural Language)
```bash
POST /api/build/natural

{
  "prompt": "transfer 0.1 SOL to 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  "payer": "your_wallet_address"
}
```

### Get Supported Protocols
```bash
GET /api/protocols
```

### Get Protocol Details
```bash
GET /api/protocols/jupiter
```

### Get Examples
```bash
GET /api/examples
```

### Get Swap Quote (Jupiter)
```bash
POST /api/quote

{
  "from": "SOL",
  "to": "USDC", 
  "amount": 1.0,
  "slippage": 0.5
}
```

## 💡 Natural Language Examples

### Transfers
- `"transfer 0.1 SOL to 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"`
- `"send 100 USDC to 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"`

### Swaps
- `"swap 1 SOL for USDC"`
- `"swap 1 SOL for USDC with 0.5% slippage"`

### Memos
- `"memo \"Hello Solana!\""`
- `"write memo \"Payment for services\""`

### Tips
- `"tip 0.001 SOL"`
- `"jito tip 0.0005"`

### Staking
- `"stake 1 SOL"`
- `"unstake 0.9 MSOL"`

## 🔬 Response Format

```json
{
  "success": true,
  "transaction": "base64_serialized_transaction",
  "simulation": {
    "success": true,
    "logs": ["Program logs..."],
    "unitsConsumed": 24787
  },
  "details": {
    "protocol": "system",
    "instructions": 2,
    "accounts": ["7xKX..."],
    "estimatedFee": "0.000005 SOL",
    "computeUnits": 24787,
    "priorityFee": 0
  }
}
```

## 🏗️ Architecture

```
src/
├── engine/
│   ├── builder.ts       # Core transaction builder
│   ├── simulator.ts     # RPC simulation
│   ├── resolver.ts      # Account/PDA resolution
│   └── intent-parser.ts # Natural language parsing
├── protocols/           # Protocol implementations
│   ├── system.ts        # SOL transfers
│   ├── spl-token.ts     # Token operations
│   ├── jupiter.ts       # Swap routing
│   ├── memo.ts          # On-chain memos
│   └── jito.ts          # MEV tips
├── api/
│   ├── routes.ts        # HTTP endpoints
│   └── middleware.ts    # Error handling, rate limiting
└── utils/
    ├── connection.ts    # RPC connections
    └── types.ts         # Shared interfaces
```

## 🧪 Testing

### Manual Testing

```bash
# Test health
curl http://localhost:3000/health

# Test natural language
curl -X POST http://localhost:3000/api/build/natural \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "memo \"Hello from SolForge!\"",
    "payer": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
  }'

# Test structured intent
curl -X POST http://localhost:3000/api/build \
  -H "Content-Type: application/json" \
  -d '{
    "intent": "tip",
    "params": {"amount": 0.001},
    "payer": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
  }'
```

### Unit Tests
```bash
npm test
```

## 🔐 Security

- No private keys stored or handled
- All transactions simulated before returning
- Rate limiting on all endpoints  
- Input validation and sanitization
- CORS and security headers configured

## 🚀 Production Deployment

### Build
```bash
npm run build
npm start
```

### Docker
```bash
docker build -t solforge .
docker run -p 3000:3000 --env-file .env solforge
```

### Environment Variables (Production)
- Set `NODE_ENV=production`
- Use Helius RPC for better reliability
- Configure rate limiting appropriately
- Set up monitoring and logging

## 📊 Protocol Coverage

| Protocol | Status | Features |
|----------|--------|----------|
| System Program | ✅ Complete | SOL transfers, account creation |
| SPL Token | ✅ Complete | Token transfers, ATA management |
| Jupiter | ✅ Complete | Swap routing, quote API |
| Memo | ✅ Complete | On-chain messages |
| Jito | ✅ Complete | MEV protection tips |
| Raydium AMM | 🚧 Planned | Liquidity provision, swaps |
| Orca Whirlpool | 🚧 Planned | Concentrated liquidity |
| Pump.fun | 🚧 Planned | Token bonding curves |
| Marinade | 🚧 Planned | Liquid staking |
| Meteora | 🚧 Planned | Dynamic liquidity |

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📝 License

MIT License - see LICENSE file for details

## 🔗 Links

- **Demo**: [Live Demo URL]
- **Documentation**: [API Docs URL]
- **Colosseum Hackathon**: [Submission URL]

---

**Built with ❤️ for the Solana ecosystem**

*SolForge - Where natural language meets blockchain transactions*