# Jupiter Protocol

Jupiter provides optimal swap routing across all Solana AMMs for the best prices.

## Supported Actions

- `swap` - Execute token swaps
- `exchange` - Alias for swap
- `trade` - Alias for swap

## Examples

### Basic Swap
```json
{
  "intent": "swap",
  "params": {
    "from": "SOL",
    "to": "USDC",
    "amount": 1.0,
    "slippage": 0.5
  }
}
```

### Advanced Swap
```json
{
  "intent": "swap",
  "params": {
    "from": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "to": "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    "amount": 100,
    "slippage": 1.0
  }
}
```

## Natural Language

- "swap 1 SOL for USDC"
- "swap 1 SOL for USDC with 0.5% slippage"
- "exchange 100 USDC for USDT"

## Parameters

- `from` - Input token symbol or mint address
- `to` - Output token symbol or mint address  
- `amount` - Amount to swap
- `slippage` - Maximum slippage percentage (default: 0.5%)

## Token Symbols

Supported symbols: SOL, USDC, USDT, RAY, SRM, FTT, MNGO, MSOL, ORCA, GMT

## Quote API

Get price quotes without building transactions:

```bash
POST /api/quote
{
  "from": "SOL",
  "to": "USDC",
  "amount": 1.0
}
```

## Notes

- Uses Jupiter API v6 for optimal routing
- Automatically handles wrapped SOL
- Returns complete transactions (not just instructions)
- Includes price impact and route information