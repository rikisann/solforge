# System Program

The Solana System Program handles fundamental operations like SOL transfers and account creation.

## Supported Actions

- `transfer` - Transfer SOL between accounts
- `send` - Alias for transfer 
- `create-account` - Create new system accounts
- `sol-transfer` - Explicit SOL transfer

## Examples

### SOL Transfer
```json
{
  "intent": "transfer",
  "params": {
    "amount": 0.1,
    "to": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
  }
}
```

### Create Account
```json
{
  "intent": "create-account", 
  "params": {
    "space": 165,
    "owner": "11111111111111111111111111111111"
  }
}
```

## Natural Language

- "transfer 0.1 SOL to ADDRESS"
- "send 0.5 SOL to ADDRESS"

## Notes

- Automatically handles account creation if recipient doesn't exist
- Includes rent-exemption calculations
- Supports both lamports and SOL amounts