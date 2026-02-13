import { NaturalLanguageIntent, ParsedIntent } from '../utils/types';
import { resolveMint } from '../utils/connection';

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
    // Transfer token patterns
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
      pattern: /(?:write\s+memo|memo)\s+["\']([^"\']+)["\']|(?:write\s+memo|memo)\s+(.+)/i,
      protocol: 'memo',
      action: 'memo',
      extractor: (match) => ({
        message: match[1] || match[2]
      })
    },
    // Stake patterns
    {
      pattern: /stake\s+(\d+(?:\.\d+)?)\s+sol(?:\s+with\s+marinade)?/i,
      protocol: 'marinade',
      action: 'stake',
      extractor: (match) => ({
        amount: parseFloat(match[1])
      })
    },
    // Unstake patterns
    {
      pattern: /unstake\s+(\d+(?:\.\d+)?)\s+(?:msol|marinade)/i,
      protocol: 'marinade',
      action: 'unstake',
      extractor: (match) => ({
        amount: parseFloat(match[1])
      })
    },
    // Create account patterns
    {
      pattern: /create\s+(?:token\s+)?account(?:\s+for\s+(\w+))?/i,
      protocol: 'spl-token',
      action: 'create-account',
      extractor: (match) => ({
        token: match[1] ? match[1].toUpperCase() : null
      })
    },
    // Tip patterns
    {
      pattern: /(?:tip|jito\s+tip)\s+(\d+(?:\.\d+)?)\s*(?:sol|lamports)?/i,
      protocol: 'jito',
      action: 'tip',
      extractor: (match) => ({
        amount: parseFloat(match[1])
      })
    },
    // Pump.fun patterns
    // "buy 0.5 sol of BiRn5SWNvRnA43Rr3Zv24qPnzTQHHZBfoNBit1Gzpump" (auto-detect pump suffix)
    {
      pattern: /buy\s+(\d+(?:\.\d+)?)\s*sol\s+(?:of\s+)?(?:this\s+)?(?:token\s+)?([1-9A-HJ-NP-Za-km-z]{32,44}pump)\b/i,
      protocol: 'pumpfun',
      action: 'buy',
      extractor: (match) => ({
        amount: parseFloat(match[1]),
        token: match[2]
      })
    },
    // "buy 0.5 sol of TOKEN_ADDRESS" (any address)
    {
      pattern: /buy\s+(\d+(?:\.\d+)?)\s*sol\s+(?:of\s+)?(?:this\s+)?(?:token\s+)?([1-9A-HJ-NP-Za-km-z]{32,44})\b/i,
      protocol: 'pumpfun',
      action: 'buy',
      extractor: (match) => ({
        amount: parseFloat(match[1]),
        token: match[2]
      })
    },
    // "buy TOKEN_ADDRESS with 0.5 sol"
    {
      pattern: /buy\s+([1-9A-HJ-NP-Za-km-z]{32,44})\s+(?:with\s+)?(\d+(?:\.\d+)?)\s*sol/i,
      protocol: 'pumpfun',
      action: 'buy',
      extractor: (match) => ({
        amount: parseFloat(match[2]),
        token: match[1]
      })
    },
    // "buy 0.5 SOL on pump.fun" (no token specified)
    {
      pattern: /buy\s+(\d+(?:\.\d+)?)\s+(\w+)?\s*(?:on\s+)?(?:pump\.?fun|pump)/i,
      protocol: 'pumpfun',
      action: 'buy',
      extractor: (match) => ({
        amount: parseFloat(match[1]),
        token: match[2] || null
      })
    },
    // "sell 0.5 sol of TOKEN_ADDRESS"
    {
      pattern: /sell\s+(\d+(?:\.\d+)?)\s*(?:sol\s+)?(?:of\s+)?(?:this\s+)?(?:token\s+)?([1-9A-HJ-NP-Za-km-z]{32,44})\b/i,
      protocol: 'pumpfun',
      action: 'sell',
      extractor: (match) => ({
        amount: parseFloat(match[1]),
        token: match[2]
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
    {
      pattern: /unstake\s+(\d+(?:\.\d+)?)\s+(?:msol|marinade)/i,
      protocol: 'marinade',
      action: 'unstake',
      extractor: (match) => ({
        amount: parseFloat(match[1])
      })
    },
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
    const originalPrompt = intent.prompt.trim();
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
        if (params.token) params.token = resolveMint(params.token);
        
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
    throw new Error(`Could not parse intent: "${intent.prompt}". Supported actions: swap, transfer, stake, memo, tip, create account`);
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