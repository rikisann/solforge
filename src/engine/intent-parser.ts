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
    // Swap patterns
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
    }
  ];

  static parseNaturalLanguage(intent: NaturalLanguageIntent): ParsedIntent {
    const prompt = intent.prompt.trim().toLowerCase();
    
    for (const pattern of this.patterns) {
      const match = prompt.match(pattern.pattern);
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
      'swap X TOKEN for Y TOKEN',
      'transfer/send X SOL to ADDRESS',
      'transfer/send X TOKEN to ADDRESS', 
      'stake X SOL',
      'unstake X MSOL',
      'memo "message"',
      'tip X SOL',
      'create token account'
    ];
  }

  static getExamples(): Record<string, string> {
    return {
      swap: 'swap 1 SOL for USDC with 0.5% slippage',
      transfer_sol: 'send 0.1 SOL to 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
      transfer_token: 'transfer 100 USDC to 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
      memo: 'memo "Hello Solana!"',
      stake: 'stake 1 SOL with marinade',
      unstake: 'unstake 0.9 MSOL',
      tip: 'tip 0.0001 SOL'
    };
  }
}