import { NaturalLanguageIntent, ParsedIntent } from '../utils/types';
import { resolveMint } from '../utils/connection';
import { TokenResolver } from './token-resolver';

interface ParsePattern {
  pattern: RegExp;
  protocol: string;
  action: string;
  extractor: (match: RegExpMatchArray) => Record<string, any>;
}

export class IntentParser {
  private static patterns: ParsePattern[] = [
    // Swap patterns - specific DEX mentions
    {
      pattern: /swap\s+(\d+(?:\.\d+)?)\s+(\w+)\s+(?:for|to)\s+(\w+)\s+on\s+raydium(?:\s+with(?:\s+less\s+than)?\s+(\d+(?:\.\d+)?)\s*%?\s+slippage)?/i,
      protocol: 'raydium',
      action: 'swap',
      extractor: (match) => ({
        amount: parseFloat(match[1]),
        from: match[2].toUpperCase(),
        to: match[3].toUpperCase(),
        slippage: match[4] ? parseFloat(match[4]) : 0.5
      })
    },
    {
      pattern: /swap\s+(\d+(?:\.\d+)?)\s+(\w+)\s+(?:for|to)\s+(\w+)\s+on\s+orca(?:\s+with(?:\s+less\s+than)?\s+(\d+(?:\.\d+)?)\s*%?\s+slippage)?/i,
      protocol: 'orca',
      action: 'swap',
      extractor: (match) => ({
        amount: parseFloat(match[1]),
        from: match[2].toUpperCase(),
        to: match[3].toUpperCase(),
        slippage: match[4] ? parseFloat(match[4]) : 0.5
      })
    },
    {
      pattern: /swap\s+(\d+(?:\.\d+)?)\s+(\w+)\s+(?:for|to)\s+(\w+)\s+on\s+meteora(?:\s+with(?:\s+less\s+than)?\s+(\d+(?:\.\d+)?)\s*%?\s+slippage)?/i,
      protocol: 'meteora',
      action: 'swap',
      extractor: (match) => ({
        amount: parseFloat(match[1]),
        from: match[2].toUpperCase(),
        to: match[3].toUpperCase(),
        slippage: match[4] ? parseFloat(match[4]) : 0.5
      })
    },
    // Generic swap patterns
    {
      pattern: /swap\s+(\d+(?:\.\d+)?)\s+(\w+)\s+(?:for|to)\s+(\w+)(?:\s+with(?:\s+less\s+than)?\s+(\d+(?:\.\d+)?)\s*%?\s+slippage)?/i,
      protocol: 'jupiter',
      action: 'swap',
      extractor: (match) => ({
        amount: parseFloat(match[1]),
        from: match[2].toUpperCase(),
        to: match[3].toUpperCase(),
        slippage: match[4] ? parseFloat(match[4]) : 0.5
      })
    },
    // Transfer SOL patterns
    {
      pattern: /(?:send|transfer)\s+(\d+(?:\.\d+)?)\s+sol\s+to\s+([1-9A-HJ-NP-Za-km-z]{32,44})/i,
      protocol: 'system',
      action: 'transfer',
      extractor: (match) => ({
        amount: parseFloat(match[1]),
        to: match[2],
        token: 'SOL'
      })
    },
    // Transfer token patterns - with full addresses (longer addresses first)
    {
      pattern: /(?:send|transfer)\s+(\d+(?:\.\d+)?)\s+([1-9A-HJ-NP-Za-km-z]{32,44})\s+to\s+([1-9A-HJ-NP-Za-km-z]{32,44})/i,
      protocol: 'spl-token',
      action: 'transfer',
      extractor: (match) => ({
        amount: parseFloat(match[1]),
        token: match[2],
        to: match[3]
      })
    },
    // Transfer token patterns - with token symbols
    {
      pattern: /(?:send|transfer)\s+(\d+(?:\.\d+)?)\s+(\w+)\s+to\s+([1-9A-HJ-NP-Za-km-z]{32,44})/i,
      protocol: 'spl-token',
      action: 'transfer',
      extractor: (match) => ({
        amount: parseFloat(match[1]),
        token: match[2].toUpperCase(),
        to: match[3]
      })
    },
    // Memo patterns
    {
      pattern: /(?:write\s+(?:onchain\s+)?memo|memo)[:\s]+["\']([^"\']+)["\']|(?:write\s+(?:onchain\s+)?memo|memo)[:\s]+(.+)/i,
      protocol: 'memo',
      action: 'memo',
      extractor: (match) => ({
        message: match[1] || match[2]
      })
    },
    // Unstake patterns - must come before stake patterns to avoid conflicts
    // "unstake 5 mSOL from marinade" - specific amount with 'from marinade'
    {
      pattern: /unstake\s+(\d+(?:\.\d+)?)\s+(m?sol)\s+from\s+marinade/i,
      protocol: 'marinade',
      action: 'unstake',
      extractor: (match) => ({
        amount: parseFloat(match[1]),
        token: match[2].toUpperCase()
      })
    },
    // "unstake my SOL from marinade"  
    {
      pattern: /unstake\s+(?:my\s+)?(\w+)\s+from\s+marinade/i,
      protocol: 'marinade',
      action: 'unstake',
      extractor: (match) => ({
        token: match[1].toUpperCase()
      })
    },
    // "unstake my SOL" - generic unstake
    {
      pattern: /unstake\s+my\s+(\w+)/i,
      protocol: 'marinade',
      action: 'unstake',
      extractor: (match) => ({
        token: match[1].toUpperCase()
      })
    },
    // "unstake X MSOL" - generic pattern without 'from marinade'
    {
      pattern: /unstake\s+(\d+(?:\.\d+)?)\s+(?:msol|marinade)/i,
      protocol: 'marinade',
      action: 'unstake',
      extractor: (match) => ({
        amount: parseFloat(match[1])
      })
    },
    // Stake patterns - avoid matching "unstake" by using word boundary
    {
      pattern: /\bstake\s+(\d+(?:\.\d+)?)\s+sol(?:\s+with\s+marinade)?/i,
      protocol: 'marinade',
      action: 'stake',
      extractor: (match) => ({
        amount: parseFloat(match[1])
      })
    },
    // Close token account patterns
    {
      pattern: /close\s+(?:my\s+)?(\w+)\s+(?:token\s+)?account/i,
      protocol: 'spl-token',
      action: 'close',
      extractor: (match) => ({
        token: match[1].toUpperCase()
      })
    },
    // Create ATA patterns - must come before generic create account pattern
    {
      pattern: /create\s+(?:token\s+account|ata)\s+for\s+([1-9A-HJ-NP-Za-km-z]{32,44})/i,
      protocol: 'spl-token',
      action: 'create-ata',
      extractor: (match) => ({
        token: match[1]
      })
    },
    {
      pattern: /create\s+(?:token\s+account|ata)\s+for\s+(\w+)/i,
      protocol: 'spl-token',
      action: 'create-ata',
      extractor: (match) => ({
        token: match[1].toUpperCase()
      })
    },
    // Generic create account pattern - made more specific to avoid matching "create token account"
    {
      pattern: /create\s+account(?:\s+for\s+(\w+))?/i,
      protocol: 'spl-token',
      action: 'create-account',
      extractor: (match) => ({
        token: match[1] ? match[1].toUpperCase() : null
      })
    },
    // Jito tip patterns - "tip X SOL to Jito"
    {
      pattern: /tip\s+(\d+(?:\.\d+)?)\s+sol\s+to\s+jito/i,
      protocol: 'jito',
      action: 'tip',
      extractor: (match) => ({
        amount: parseFloat(match[1])
      })
    },
    // Tip patterns - existing and enhanced
    {
      pattern: /(?:tip|jito\s+tip)\s+(\d+(?:\.\d+)?)\s*(?:sol|lamports)?/i,
      protocol: 'jito',
      action: 'tip',
      extractor: (match) => ({
        amount: parseFloat(match[1])
      })
    },
    // Token address buy/sell patterns — protocol resolved dynamically via DexScreener
    // "buy 0.5 sol of TOKEN_ADDRESS" / "buy 0.5sol of this token TOKEN_ADDRESS"
    {
      pattern: /buy\s+(\d+(?:\.\d+)?)\s*sol\s+(?:of\s+)?(?:this\s+)?(?:token\s+)?([1-9A-HJ-NP-Za-km-z]{32,44})\b(?:\s+with\s+(\d+(?:\.\d+)?)\s*%?\s*slippage)?/i,
      protocol: '__resolve__',
      action: 'buy',
      extractor: (match) => ({
        amount: parseFloat(match[1]),
        token: match[2],
        slippage: match[3] ? parseFloat(match[3]) : undefined
      })
    },
    // "buy TOKEN_ADDRESS with 0.5 sol"
    {
      pattern: /buy\s+([1-9A-HJ-NP-Za-km-z]{32,44})\s+(?:with\s+)?(\d+(?:\.\d+)?)\s*sol(?:\s+with\s+(\d+(?:\.\d+)?)\s*%?\s*slippage)?/i,
      protocol: '__resolve__',
      action: 'buy',
      extractor: (match) => ({
        amount: parseFloat(match[2]),
        token: match[1],
        slippage: match[3] ? parseFloat(match[3]) : undefined
      })
    },
    // "sell 0.5 sol of TOKEN_ADDRESS" / "sell 100 TOKEN_ADDRESS"
    {
      pattern: /sell\s+(\d+(?:\.\d+)?)\s*(?:sol\s+)?(?:of\s+)?(?:this\s+)?(?:token\s+)?([1-9A-HJ-NP-Za-km-z]{32,44})\b(?:\s+with\s+(\d+(?:\.\d+)?)\s*%?\s*slippage)?/i,
      protocol: '__resolve__',
      action: 'sell',
      extractor: (match) => ({
        amount: parseFloat(match[1]),
        token: match[2],
        slippage: match[3] ? parseFloat(match[3]) : undefined
      })
    },
    // Pair address patterns - "buy 5 sol of pair ADDRESS" / "sell from pair ADDRESS"
    {
      pattern: /buy\s+(\d+(?:\.\d+)?)\s*sol\s+of\s+(?:this\s+)?pair\s+([1-9A-HJ-NP-Za-km-z]{32,44})\b(?:\s+with\s+(\d+(?:\.\d+)?)\s*%?\s*slippage)?/i,
      protocol: '__resolve_pair__',
      action: 'buy',
      extractor: (match) => ({
        amount: parseFloat(match[1]),
        pair: match[2],
        slippage: match[3] ? parseFloat(match[3]) : undefined
      })
    },
    {
      pattern: /sell\s+(?:from\s+)?pair\s+([1-9A-HJ-NP-Za-km-z]{32,44})\b(?:\s+with\s+(\d+(?:\.\d+)?)\s*%?\s*slippage)?/i,
      protocol: '__resolve_pair__',
      action: 'sell',
      extractor: (match) => ({
        pair: match[1],
        slippage: match[2] ? parseFloat(match[2]) : undefined
      })
    },
    // Amount variations: "buy 0.5 SOL worth of TOKEN"
    {
      pattern: /buy\s+(\d+(?:\.\d+)?)\s+sol\s+worth\s+of\s+(\w+)(?:\s+with\s+(\d+(?:\.\d+)?)\s*%?\s*slippage)?/i,
      protocol: '__resolve__',
      action: 'buy',
      extractor: (match) => ({
        amount: parseFloat(match[1]),
        token: match[2].toUpperCase(),
        slippage: match[3] ? parseFloat(match[3]) : undefined
      })
    },
    // "buy 5 BONK" / "buy USDC" — interpreted as "buy X SOL worth of TOKEN" (default 1 SOL if no amount)
    {
      pattern: /^buy\s+(?:(\d+(?:\.\d+)?)\s+)?(\w+)$/i,
      protocol: '__resolve__',
      action: 'buy',
      extractor: (match) => ({
        amount: match[1] ? parseFloat(match[1]) : 1,
        token: match[2].toUpperCase(),
        slippage: undefined
      })
    },
    // "sell 5 BONK" / "sell USDC" — sell token for SOL
    {
      pattern: /^sell\s+(?:(\d+(?:\.\d+)?)\s+)?(\w+)$/i,
      protocol: '__resolve__',
      action: 'sell',
      extractor: (match) => ({
        amount: match[1] ? parseFloat(match[1]) : 1,
        token: match[2].toUpperCase(),
        slippage: undefined
      })
    },
    // "spend 2 sol on TOKEN"
    {
      pattern: /spend\s+(\d+(?:\.\d+)?)\s+sol\s+on\s+(\w+)(?:\s+with\s+(\d+(?:\.\d+)?)\s*%?\s*slippage)?/i,
      protocol: '__resolve__',
      action: 'buy',
      extractor: (match) => ({
        amount: parseFloat(match[1]),
        token: match[2].toUpperCase(),
        slippage: match[3] ? parseFloat(match[3]) : undefined
      })
    },
    // "put 1 sol into TOKEN"
    {
      pattern: /put\s+(\d+(?:\.\d+)?)\s+sol\s+into\s+(\w+)(?:\s+with\s+(\d+(?:\.\d+)?)\s*%?\s*slippage)?/i,
      protocol: '__resolve__',
      action: 'buy',
      extractor: (match) => ({
        amount: parseFloat(match[1]),
        token: match[2].toUpperCase(),
        slippage: match[3] ? parseFloat(match[3]) : undefined
      })
    },
    // "ape 5 sol into TOKEN_ADDRESS" (degen slang)
    {
      pattern: /ape\s+(\d+(?:\.\d+)?)\s+sol\s+into\s+([1-9A-HJ-NP-Za-km-z]{32,44}|[\w]{2,10})(?:\s+with\s+(\d+(?:\.\d+)?)\s*%?\s*slippage)?/i,
      protocol: '__resolve__',
      action: 'buy',
      extractor: (match) => ({
        amount: parseFloat(match[1]),
        token: match[2],
        slippage: match[3] ? parseFloat(match[3]) : undefined
      })
    },
    // "ape into TOKEN_ADDRESS with 2 sol"
    {
      pattern: /ape\s+into\s+([1-9A-HJ-NP-Za-km-z]{32,44}|[\w]{2,10})\s+with\s+(\d+(?:\.\d+)?)\s+sol(?:\s+with\s+(\d+(?:\.\d+)?)\s*%?\s*slippage)?/i,
      protocol: '__resolve__',
      action: 'buy',
      extractor: (match) => ({
        amount: parseFloat(match[2]),
        token: match[1],
        slippage: match[3] ? parseFloat(match[3]) : undefined
      })
    },
    // Sell variations: "sell all TOKEN" / "sell everything"
    {
      pattern: /sell\s+(?:all|everything)(?:\s+(\w+))?(?:\s+with\s+(\d+(?:\.\d+)?)\s*%?\s*slippage)?/i,
      protocol: '__resolve__',
      action: 'sell',
      extractor: (match) => ({
        amount: -1, // Special flag for "all"
        token: match[1] ? match[1].toUpperCase() : null,
        slippage: match[2] ? parseFloat(match[2]) : undefined
      })
    },
    // "dump TOKEN_ADDRESS"
    {
      pattern: /dump\s+([1-9A-HJ-NP-Za-km-z]{32,44}|[\w]{2,10})(?:\s+with\s+(\d+(?:\.\d+)?)\s*%?\s*slippage)?/i,
      protocol: '__resolve__',
      action: 'sell',
      extractor: (match) => ({
        amount: -1, // Special flag for "all"
        token: match[1],
        slippage: match[2] ? parseFloat(match[2]) : undefined
      })
    },
    // "exit TOKEN_ADDRESS"
    {
      pattern: /exit\s+([1-9A-HJ-NP-Za-km-z]{32,44}|[\w]{2,10})(?:\s+with\s+(\d+(?:\.\d+)?)\s*%?\s*slippage)?/i,
      protocol: '__resolve__',
      action: 'sell',
      extractor: (match) => ({
        amount: -1, // Special flag for "all"
        token: match[1],
        slippage: match[2] ? parseFloat(match[2]) : undefined
      })
    },
    // "sell my TOKEN for sol"
    {
      pattern: /sell\s+my\s+(\w+)\s+for\s+sol(?:\s+with\s+(\d+(?:\.\d+)?)\s*%?\s*slippage)?/i,
      protocol: '__resolve__',
      action: 'sell',
      extractor: (match) => ({
        amount: -1, // Special flag for "all"
        token: match[1].toUpperCase(),
        slippage: match[2] ? parseFloat(match[2]) : undefined
      })
    },
    // Swap variations: "convert 100 USDC to SOL"
    {
      pattern: /convert\s+(\d+(?:\.\d+)?)\s+(\w+)\s+to\s+(\w+)(?:\s+with\s+(\d+(?:\.\d+)?)\s*%?\s*slippage)?/i,
      protocol: 'jupiter',
      action: 'swap',
      extractor: (match) => ({
        amount: parseFloat(match[1]),
        from: match[2].toUpperCase(),
        to: match[3].toUpperCase(),
        slippage: match[4] ? parseFloat(match[4]) : 0.5
      })
    },
    // "change 50 USDT to USDC"
    {
      pattern: /change\s+(\d+(?:\.\d+)?)\s+(\w+)\s+to\s+(\w+)(?:\s+with\s+(\d+(?:\.\d+)?)\s*%?\s*slippage)?/i,
      protocol: 'jupiter',
      action: 'swap',
      extractor: (match) => ({
        amount: parseFloat(match[1]),
        from: match[2].toUpperCase(),
        to: match[3].toUpperCase(),
        slippage: match[4] ? parseFloat(match[4]) : 0.5
      })
    },
    // "change all SOL to USDC"
    {
      pattern: /change\s+all\s+(\w+)\s+to\s+(\w+)(?:\s+with\s+(\d+(?:\.\d+)?)\s*%?\s*slippage)?/i,
      protocol: 'jupiter',
      action: 'swap',
      extractor: (match) => ({
        amount: -1, // Special flag for "all"
        from: match[1].toUpperCase(),
        to: match[2].toUpperCase(),
        slippage: match[3] ? parseFloat(match[3]) : 0.5
      })
    },
    // "convert all SOL to USDC"
    {
      pattern: /convert\s+all\s+(\w+)\s+to\s+(\w+)(?:\s+with\s+(\d+(?:\.\d+)?)\s*%?\s*slippage)?/i,
      protocol: 'jupiter',
      action: 'swap',
      extractor: (match) => ({
        amount: -1, // Special flag for "all"
        from: match[1].toUpperCase(),
        to: match[2].toUpperCase(),
        slippage: match[3] ? parseFloat(match[3]) : 0.5
      })
    },
    // "trade 1 SOL for USDC"
    {
      pattern: /trade\s+(\d+(?:\.\d+)?)\s+(\w+)\s+for\s+(\w+)(?:\s+with\s+(\d+(?:\.\d+)?)\s*%?\s*slippage)?/i,
      protocol: 'jupiter',
      action: 'swap',
      extractor: (match) => ({
        amount: parseFloat(match[1]),
        from: match[2].toUpperCase(),
        to: match[3].toUpperCase(),
        slippage: match[4] ? parseFloat(match[4]) : 0.5
      })
    },
    // "exchange 10 SOL for USDC"
    {
      pattern: /exchange\s+(\d+(?:\.\d+)?)\s+(\w+)\s+for\s+(\w+)(?:\s+with\s+(\d+(?:\.\d+)?)\s*%?\s*slippage)?/i,
      protocol: 'jupiter',
      action: 'swap',
      extractor: (match) => ({
        amount: parseFloat(match[1]),
        from: match[2].toUpperCase(),
        to: match[3].toUpperCase(),
        slippage: match[4] ? parseFloat(match[4]) : 0.5
      })
    },
    // Buy/sell tokens by symbol: "buy 1 sol of BONK"
    {
      pattern: /buy\s+(\d+(?:\.\d+)?)\s+sol\s+of\s+(\w+)(?:\s+with\s+(\d+(?:\.\d+)?)\s*%?\s*slippage)?/i,
      protocol: '__resolve__',
      action: 'buy',
      extractor: (match) => ({
        amount: parseFloat(match[1]),
        token: match[2].toUpperCase(),
        slippage: match[3] ? parseFloat(match[3]) : undefined
      })
    },
    // "swap SOL to JUP"
    {
      pattern: /swap\s+(\w+)\s+to\s+(\w+)(?:\s+with\s+(\d+(?:\.\d+)?)\s*%?\s*slippage)?/i,
      protocol: 'jupiter',
      action: 'swap',
      extractor: (match) => ({
        amount: 1.0, // Default amount
        from: match[1].toUpperCase(),
        to: match[2].toUpperCase(),
        slippage: match[3] ? parseFloat(match[3]) : 0.5
      })
    },
    // DeFi operations: "provide 5 SOL liquidity on orca"
    {
      pattern: /provide\s+(\d+(?:\.\d+)?)\s+(\w+)\s+liquidity\s+on\s+orca/i,
      protocol: 'orca',
      action: 'add-liquidity',
      extractor: (match) => ({
        amount: parseFloat(match[1]),
        token: match[2].toUpperCase()
      })
    },
    // "add liquidity to POOL_ADDRESS"
    {
      pattern: /add\s+liquidity\s+to\s+([1-9A-HJ-NP-Za-km-z]{32,44})/i,
      protocol: 'orca', // Default to Orca, could be made dynamic
      action: 'add-liquidity',
      extractor: (match) => ({
        pool: match[1]
      })
    },
    // "remove my liquidity from POOL_ADDRESS"
    {
      pattern: /remove\s+(?:my\s+)?liquidity\s+from\s+([1-9A-HJ-NP-Za-km-z]{32,44})/i,
      protocol: 'orca', // Default to Orca, could be made dynamic
      action: 'remove-liquidity',
      extractor: (match) => ({
        pool: match[1]
      })
    },
    // Removed duplicate patterns - moved to earlier position
    // "liquid stake 10 SOL" (should route to marinade)
    {
      pattern: /liquid\s+stake\s+(\d+(?:\.\d+)?)\s+sol/i,
      protocol: 'marinade',
      action: 'stake',
      extractor: (match) => ({
        amount: parseFloat(match[1])
      })
    },
    // Priority fees: "swap 1 SOL for USDC with high priority"
    {
      pattern: /(.+)\s+with\s+(?:high\s+)?priority/i,
      protocol: '__reparse__', // Special flag to reparse without the priority part
      action: '__reparse__',
      extractor: (match) => ({
        originalPrompt: match[1],
        priorityFee: 'high' // Will be handled by the routes
      })
    },
    // "transfer 1 SOL to ADDRESS urgently"
    {
      pattern: /(.+)\s+urgently/i,
      protocol: '__reparse__',
      action: '__reparse__',
      extractor: (match) => ({
        originalPrompt: match[1],
        priorityFee: 'high'
      })
    },
    // Explicit pump.fun patterns (when user specifies the DEX)
    // "buy 0.5 SOL on pump.fun"
    {
      pattern: /buy\s+(\d+(?:\.\d+)?)\s+(\w+)?\s*(?:on\s+)?(?:pump\.?fun|pump)/i,
      protocol: 'pumpfun',
      action: 'buy',
      extractor: (match) => ({
        amount: parseFloat(match[1]),
        token: match[2] || null
      })
    },
    {
      pattern: /sell\s+(\d+(?:\.\d+)?)\s+(\w+)?\s*(?:on\s+)?(?:pump\.?fun|pump)/i,
      protocol: 'pumpfun',
      action: 'sell',
      extractor: (match) => ({
        amount: parseFloat(match[1]),
        token: match[2] || null
      })
    },
    {
      pattern: /create\s+token\s+(?:on\s+)?(?:pump\.?fun|pump)(?:\s+(?:called|named)\s+["\']([^"\']+)["\'])?(?:\s+symbol\s+(\w+))?/i,
      protocol: 'pumpfun',
      action: 'create-token',
      extractor: (match) => ({
        name: match[1] || 'New Token',
        symbol: match[2] || 'TOKEN'
      })
    },
    // Marinade staking patterns
    {
      pattern: /stake\s+(\d+(?:\.\d+)?)\s+sol\s+(?:with\s+)?(?:marinade|msol)/i,
      protocol: 'marinade',
      action: 'stake',
      extractor: (match) => ({
        amount: parseFloat(match[1])
      })
    },
    // Removed duplicate unstake pattern - now handled earlier with better token extraction
    // Native staking patterns
    {
      pattern: /stake\s+(\d+(?:\.\d+)?)\s+sol(?:\s+with(?:\s+validator)?\s+([1-9A-HJ-NP-Za-km-z]{32,44}))?/i,
      protocol: 'stake',
      action: 'stake',
      extractor: (match) => ({
        amount: parseFloat(match[1]),
        validator: match[2] || null
      })
    },
    {
      pattern: /(?:native\s+)?stake\s+(\d+(?:\.\d+)?)\s+sol/i,
      protocol: 'stake',
      action: 'stake',
      extractor: (match) => ({
        amount: parseFloat(match[1])
      })
    },
    {
      pattern: /(?:deactivate|unstake)\s+stake\s+account\s+([1-9A-HJ-NP-Za-km-z]{32,44})/i,
      protocol: 'stake',
      action: 'deactivate',
      extractor: (match) => ({
        stakeAccount: match[1]
      })
    },
    {
      pattern: /withdraw\s+(\d+(?:\.\d+)?)\s+sol\s+from\s+stake\s+account\s+([1-9A-HJ-NP-Za-km-z]{32,44})/i,
      protocol: 'stake',
      action: 'withdraw',
      extractor: (match) => ({
        amount: parseFloat(match[1]),
        stakeAccount: match[2]
      })
    },
    // Token-2022 patterns
    {
      pattern: /(?:transfer|send)\s+(\d+(?:\.\d+)?)\s+(\w+)\s+to\s+([1-9A-HJ-NP-Za-km-z]{32,44})\s+(?:using\s+)?(?:token-?2022|token2022)/i,
      protocol: 'token2022',
      action: 'transfer',
      extractor: (match) => ({
        amount: parseFloat(match[1]),
        token: match[2].toUpperCase(),
        to: match[3]
      })
    },
    // Orca position management
    {
      pattern: /open\s+(?:orca\s+)?position\s+(\w+)\s*\/\s*(\w+)(?:\s+from\s+(\d+)\s+to\s+(\d+))?/i,
      protocol: 'orca',
      action: 'open-position',
      extractor: (match) => ({
        tokenA: match[1].toUpperCase(),
        tokenB: match[2].toUpperCase(),
        tickLower: match[3] ? parseInt(match[3]) : -443636,
        tickUpper: match[4] ? parseInt(match[4]) : 443636
      })
    },
    {
      pattern: /close\s+(?:orca\s+)?position\s+([1-9A-HJ-NP-Za-km-z]{32,44})/i,
      protocol: 'orca',
      action: 'close-position',
      extractor: (match) => ({
        position: match[1]
      })
    },
    // Meteora liquidity management
    {
      pattern: /add\s+liquidity\s+(\d+(?:\.\d+)?)\s+(\w+)\s+and\s+(\d+(?:\.\d+)?)\s+(\w+)\s+(?:to\s+)?meteora/i,
      protocol: 'meteora',
      action: 'add-liquidity',
      extractor: (match) => ({
        amountA: parseFloat(match[1]),
        tokenA: match[2].toUpperCase(),
        amountB: parseFloat(match[3]),
        tokenB: match[4].toUpperCase()
      })
    },
    {
      pattern: /remove\s+(\d+(?:\.\d+)?)\s*%?\s+liquidity\s+from\s+meteora\s+position\s+([1-9A-HJ-NP-Za-km-z]{32,44})/i,
      protocol: 'meteora',
      action: 'remove-liquidity',
      extractor: (match) => ({
        amount: parseFloat(match[1]),
        position: match[2]
      })
    }
  ];

  static parseNaturalLanguage(intent: NaturalLanguageIntent): ParsedIntent {
    return this._parseSync(intent);
  }

  /**
   * Async version that resolves token addresses via DexScreener API.
   * Use this when you need dynamic protocol resolution.
   */
  static parseMultipleIntents(prompt: string): ParsedIntent[] {
    // Split the prompt on common conjunctions/separators
    const segments = this._splitPrompt(prompt);
    
    if (segments.length === 1) {
      // No splitting occurred, return single intent
      const intent: NaturalLanguageIntent = {
        prompt: prompt.trim(),
        payer: '', // Will be filled in by caller
        network: 'mainnet'
      };
      try {
        return [this._parseSync(intent)];
      } catch (error) {
        // If parsing fails, return empty array
        console.warn(`Failed to parse single intent "${prompt}": ${error instanceof Error ? error.message : 'Unknown error'}`);
        return [];
      }
    }
    
    // Parse each segment
    const intents: ParsedIntent[] = [];
    for (const segment of segments) {
      const intent: NaturalLanguageIntent = {
        prompt: segment.trim(),
        payer: '', // Will be filled in by caller
        network: 'mainnet'
      };
      try {
        const parsed = this._parseSync(intent);
        intents.push(parsed);
      } catch (error) {
        // If one segment fails to parse, continue with others
        console.warn(`Failed to parse segment "${segment}": ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    return intents;
  }

  static async parseMultipleIntentsAsync(prompt: string, payer: string): Promise<ParsedIntent[]> {
    const segments = this._splitPrompt(prompt);
    
    if (segments.length === 1) {
      // No splitting occurred, return single intent
      const intent: NaturalLanguageIntent = {
        prompt: prompt.trim(),
        payer,
        network: 'mainnet'
      };
      return [await this.parseNaturalLanguageAsync(intent)];
    }
    
    // Parse each segment asynchronously
    const intents: ParsedIntent[] = [];
    for (const segment of segments) {
      const intent: NaturalLanguageIntent = {
        prompt: segment.trim(),
        payer,
        network: 'mainnet'
      };
      try {
        const parsed = await this.parseNaturalLanguageAsync(intent);
        intents.push(parsed);
      } catch (error) {
        // If one segment fails to parse, continue with others
        console.warn(`Failed to parse segment "${segment}": ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    return intents;
  }

  static async parseNaturalLanguageAsync(intent: NaturalLanguageIntent): Promise<ParsedIntent> {
    let result: ParsedIntent;
    try {
      result = this._parseSync(intent);
    } catch (parseError) {
      // Regex failed — try LLM fallback before giving up
      const llmResult = await IntentParser.tryLLMFallback(intent.prompt);
      if (llmResult) {
        return llmResult;
      }
      throw parseError;
    }

    // Handle priority fee reparsing
    if (result.protocol === '__reparse__' && result.params.originalPrompt) {
      const reparsedIntent: NaturalLanguageIntent = {
        ...intent,
        prompt: result.params.originalPrompt,
        priorityFee: result.params.priorityFee || intent.priorityFee
      };
      const reparsedResult = await this.parseNaturalLanguageAsync(reparsedIntent);
      reparsedResult.params.priorityFee = result.params.priorityFee;
      return reparsedResult;
    }

    // If protocol is __resolve_pair__, look up the pair on DexScreener
    if (result.protocol === '__resolve_pair__' && result.params.pair) {
      const pairInfo = await TokenResolver.resolveByPair(result.params.pair);
      if (pairInfo) {
        result.protocol = pairInfo.protocol;
        result.params.pool = pairInfo.pool;
        result.params.token = pairInfo.baseToken; // Buy the base token of the pair
        result.params._pairInfo = pairInfo.tokenInfo;
        result.confidence = 0.95;
      } else {
        result.protocol = 'jupiter'; // Fallback
        result.confidence = 0.5;
      }
    }

    // If protocol is __resolve__, look up the token on DexScreener
    if (result.protocol === '__resolve__' && result.params.token) {
      const { protocol, pool, tokenInfo } = await TokenResolver.resolveProtocol(result.params.token);
      result.protocol = protocol;
      if (pool) result.params.pool = pool;
      if (tokenInfo) {
        result.params._tokenInfo = {
          symbol: tokenInfo.symbol,
          name: tokenInfo.name,
          primaryDex: tokenInfo.primaryDex,
          allDexes: tokenInfo.allDexes,
          priceUsd: tokenInfo.priceUsd,
          liquidity: tokenInfo.liquidity,
        };
      }
      result.confidence = tokenInfo ? 0.95 : 0.7;
    }

    return result;
  }

  private static _splitPrompt(prompt: string): string[] {
    // Define conjunctions and separators that indicate multiple intents
    const separators = [
      // " and " followed by a verb
      /\s+and\s+(swap|send|transfer|tip|stake|buy|sell|ape|memo|write|create|close|dump|convert|trade|exchange|liquid\s+stake|unstake|provide|add|remove|open|native\s+stake|deactivate|withdraw)\s+/gi,
      // " then "
      /\s+then\s+/gi,
      // " also "
      /\s+also\s+/gi,
      // " + "
      /\s+\+\s+/gi,
      // ", " followed by a verb (comma + space + verb)
      /,\s+(swap|send|transfer|tip|stake|buy|sell|ape|memo|write|create|close|dump|convert|trade|exchange|liquid\s+stake|unstake|provide|add|remove|open|native\s+stake|deactivate|withdraw)\s+/gi
    ];

    let segments = [prompt];

    // Apply each separator pattern
    for (const separator of separators) {
      const newSegments: string[] = [];
      
      for (const segment of segments) {
        const parts = segment.split(separator);
        if (parts.length > 1) {
          // Found a separator, split this segment
          for (let i = 0; i < parts.length; i++) {
            if (i === 0) {
              newSegments.push(parts[i].trim());
            } else {
              // Re-add the verb that was consumed by the regex split
              const match = segment.match(separator);
              if (match) {
                const verb = match[0].trim().replace(/^(and|then|also|\+|,)\s+/i, '');
                newSegments.push((verb + ' ' + parts[i]).trim());
              } else {
                newSegments.push(parts[i].trim());
              }
            }
          }
        } else {
          newSegments.push(segment);
        }
      }
      
      segments = newSegments;
    }

    // Filter out empty segments
    return segments.filter(segment => segment.trim().length > 0);
  }

  private static _parseSync(intent: NaturalLanguageIntent): ParsedIntent {
    // Strip emojis and extra whitespace from input
    const originalPrompt = intent.prompt.trim().replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu, '').trim();
    const prompt = originalPrompt.toLowerCase();
    
    for (const pattern of this.patterns) {
      // Match against lowercase for keyword matching, but extract from original to preserve case (addresses are case-sensitive)
      const match = originalPrompt.match(pattern.pattern) || prompt.match(pattern.pattern);
      if (match) {
        const params = pattern.extractor(match);
        
        // Resolve token mints if present
        if (params.from) params.from = resolveMint(params.from);
        if (params.to && typeof params.to === 'string' && params.to.length <= 10) {
          // If 'to' looks like a token symbol rather than an address
          params.to = resolveMint(params.to);
        }
        if (params.token && params.token.length <= 10 && 
            pattern.action !== 'unstake' && pattern.action !== 'close') {
          // Don't resolve tokens for unstake/close actions to preserve raw token symbols
          params.token = resolveMint(params.token);
        }
        
        return {
          protocol: pattern.protocol,
          action: pattern.action,
          params,
          confidence: 0.9 // High confidence for direct pattern matches
        };
      }
    }

    // Fallback: try to extract basic swap information
    const swapFallback = prompt.match(/(\w+)\s+(?:for|to)\s+(\w+)/i);
    if (swapFallback) {
      return {
        protocol: 'jupiter',
        action: 'swap',
        params: {
          from: resolveMint(swapFallback[1]),
          to: resolveMint(swapFallback[2]),
          amount: 1.0,
          slippage: 0.5
        },
        confidence: 0.5 // Lower confidence for fallback
      };
    }

    // No pattern matched
    throw new Error(`Could not parse intent: "${intent.prompt}". Try: "Swap [amount] [token] for [token]", "Send [amount] SOL to [address]", "Write onchain memo: [message]", "Tip [amount] SOL to Jito", "Liquid stake [amount] SOL with Marinade"`);
  }

  /**
   * LLM fallback: when regex patterns fail, use a lightweight LLM call to extract intent.
   * Requires ANTHROPIC_API_KEY or OPENAI_API_KEY in environment.
   */
  private static async tryLLMFallback(prompt: string): Promise<ParsedIntent | null> {
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    
    if (!anthropicKey && !openaiKey) return null;

    try {
      const systemPrompt = `You are a Solana transaction intent parser. Extract the user's intent from their message and return ONLY valid JSON (no markdown, no backticks).

Return format:
{"action":"swap|transfer|memo|stake|unstake|tip|buy|sell","params":{"amount":NUMBER,"from":"TOKEN","to":"TOKEN_OR_ADDRESS","message":"TEXT","slippage":NUMBER},"protocol":"jupiter|marinade|system|spl-token|memo|jito|__resolve__"}

Rules:
- For swaps/buys/sells: action="swap", params.from=source token, params.to=destination token, params.amount=number
- If buying a token with SOL: from="SOL", to=token name/address
- If selling a token: from=token, to="SOL"
- For transfers: action="transfer", params.to=address, params.amount=number, params.token=token name
- For memos: action="memo", params.message=the memo text
- For staking: action="stake", params.amount=SOL amount, protocol="marinade"
- For tips: action="tip", params.amount=SOL amount, protocol="jito"
- Use token symbols (SOL, USDC, BONK) not full names
- If no amount specified, default to 1
- Return ONLY the JSON object, nothing else`;

      let result: string | null = null;

      if (anthropicKey) {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': anthropicKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-20250414',
            max_tokens: 200,
            messages: [{ role: 'user', content: prompt }],
            system: systemPrompt,
          }),
          signal: AbortSignal.timeout(5000),
        });
        if (response.ok) {
          const data = await response.json() as any;
          result = data.content?.[0]?.text;
        }
      } else if (openaiKey) {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            max_tokens: 200,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: prompt },
            ],
          }),
          signal: AbortSignal.timeout(5000),
        });
        if (response.ok) {
          const data = await response.json() as any;
          result = data.choices?.[0]?.message?.content;
        }
      }

      if (!result) return null;

      // Parse the LLM response
      const parsed = JSON.parse(result.trim());
      
      // Map to our ParsedIntent format
      const action = parsed.action;
      const protocol = parsed.protocol || '__resolve__';
      let params: Record<string, any> = {};

      if (action === 'swap' || action === 'buy' || action === 'sell') {
        params = {
          from: resolveMint(parsed.params.from || 'SOL'),
          to: resolveMint(parsed.params.to || 'SOL'),
          amount: parsed.params.amount || 1,
          slippage: parsed.params.slippage,
        };
        return { protocol: protocol === '__resolve__' ? 'jupiter' : protocol, action: 'swap', params, confidence: 0.7 };
      } else if (action === 'transfer') {
        params = {
          amount: parsed.params.amount || 1,
          to: parsed.params.to,
          token: parsed.params.token,
        };
        return { protocol: parsed.params.token?.toUpperCase() === 'SOL' ? 'system' : 'spl-token', action: 'transfer', params, confidence: 0.7 };
      } else if (action === 'memo') {
        return { protocol: 'memo', action: 'memo', params: { message: parsed.params.message || prompt }, confidence: 0.7 };
      } else if (action === 'stake') {
        return { protocol: 'marinade', action: 'stake', params: { amount: parsed.params.amount || 1 }, confidence: 0.7 };
      } else if (action === 'unstake') {
        return { protocol: 'marinade', action: 'unstake', params: { amount: parsed.params.amount || 1 }, confidence: 0.7 };
      } else if (action === 'tip') {
        return { protocol: 'jito', action: 'tip', params: { amount: parsed.params.amount || 0.001 }, confidence: 0.7 };
      }

      return null;
    } catch (error) {
      console.warn('LLM fallback failed:', error instanceof Error ? error.message : error);
      return null;
    }
  }

  static getSupportedActions(): string[] {
    return [
      'swap X TOKEN for Y TOKEN (on raydium/orca/meteora)',
      'transfer/send X SOL to ADDRESS',
      'transfer/send X TOKEN to ADDRESS', 
      'stake X SOL (with marinade or native)',
      'unstake X MSOL',
      'buy/sell tokens on pump.fun',
      'create token on pump.fun',
      'native stake X SOL with validator',
      'open/close orca positions',
      'add/remove meteora liquidity',
      'token-2022 operations',
      'memo "message"',
      'tip X SOL',
      'create token account'
    ];
  }

  static getExamples(): Record<string, string> {
    return {
      swap_jupiter: 'swap 1 SOL for USDC with 0.5% slippage',
      swap_raydium: 'swap 1 SOL for USDC on raydium',
      swap_orca: 'swap 1 SOL for USDC on orca',
      swap_meteora: 'swap 1 SOL for USDC on meteora',
      transfer_sol: 'send 0.1 SOL to 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
      transfer_token: 'transfer 100 USDC to 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
      transfer_token2022: 'send 100 USDC to 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU using token-2022',
      memo: 'memo "Hello Solana!"',
      stake_marinade: 'stake 1 SOL with marinade',
      unstake_marinade: 'unstake 0.9 MSOL',
      stake_native: 'stake 10 SOL with validator J1to3PQfXidUUhprQWgdKkQAMWPJAEqSJ7amkBDE9qhF',
      deactivate_stake: 'deactivate stake account StakeAccount123...',
      withdraw_stake: 'withdraw 5 SOL from stake account StakeAccount123...',
      pump_buy: 'buy 1000 BONK on pump.fun',
      pump_sell: 'sell 500 BONK on pump.fun',
      pump_create: 'create token on pump.fun called "My Token" symbol MYTKN',
      orca_position: 'open orca position SOL/USDC from -1000 to 1000',
      orca_close: 'close orca position PositionNFT123...',
      meteora_add: 'add liquidity 1 SOL and 100 USDC to meteora',
      meteora_remove: 'remove 50% liquidity from meteora position Position123...',
      tip: 'tip 0.0001 SOL'
    };
  }
}