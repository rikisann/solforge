import { NaturalLanguageIntent, ParsedIntent } from '../utils/types';
import { resolveMint } from '../utils/connection';
import { TokenResolver } from './token-resolver';
import * as fs from 'fs';
import * as path from 'path';

interface ParsePattern {
  pattern: RegExp;
  protocol: string;
  action: string;
  extractor: (match: RegExpMatchArray) => Record<string, any>;
}

export class IntentParser {
  private static patterns: ParsePattern[] = [
    // Enhanced Lending patterns - Kamino with comprehensive variations
    // Supply patterns for Kamino
    {
      pattern: /(?:supply|deposit|lend|put|add|provide|invest|stake|lock(?:\s+up)?)\s+(\d+(?:\.\d+)?)\s+(\w+)\s+(?:to|on|into|in)\s+(?:kamino|klend)(?:\s+(?:finance|lending))?/i,
      protocol: 'kamino',
      action: 'supply',
      extractor: (match) => ({
        amount: parseFloat(match[1]),
        token: match[2].toUpperCase()
      })
    },
    // Kamino with "my" variations
    {
      pattern: /(?:deposit|put|add|provide|invest|stake|lock(?:\s+up)?)\s+(?:my\s+)?(\d+(?:\.\d+)?)\s+(\w+)\s+(?:to|on|into|in)\s+(?:kamino|klend)/i,
      protocol: 'kamino',
      action: 'supply',
      extractor: (match) => ({
        amount: parseFloat(match[1]),
        token: match[2].toUpperCase()
      })
    },
    // Borrow patterns for Kamino
    {
      pattern: /(?:borrow|take\s+a\s+loan\s+of|loan\s+me|get\s+a\s+loan\s+of|take\s+out)\s+(\d+(?:\.\d+)?)\s+(\w+)\s+(?:on|from)\s+(?:kamino|klend)/i,
      protocol: 'kamino',
      action: 'borrow',
      extractor: (match) => ({
        amount: parseFloat(match[1]),
        token: match[2].toUpperCase()
      })
    },
    // Generic borrow against collateral for Kamino
    {
      pattern: /borrow\s+against\s+(?:my\s+)?collateral\s+(?:on|from)\s+(?:kamino|klend)/i,
      protocol: 'kamino',
      action: 'borrow',
      extractor: () => ({})
    },
    // Original basic borrow pattern for Kamino
    {
      pattern: /borrow\s+(\d+(?:\.\d+)?)\s+(\w+)\s+(?:on|from)\s+(?:kamino|klend)/i,
      protocol: 'kamino',
      action: 'borrow',
      extractor: (match) => ({
        amount: parseFloat(match[1]),
        token: match[2].toUpperCase()
      })
    },
    // Repay patterns for Kamino
    {
      pattern: /(?:repay|pay\s+back|pay\s+off|settle|return)\s+(\d+(?:\.\d+)?)\s+(\w+)(?:\s+debt)?\s+(?:on|to)\s+(?:kamino|klend)/i,
      protocol: 'kamino',
      action: 'repay',
      extractor: (match) => ({
        amount: parseFloat(match[1]),
        token: match[2].toUpperCase()
      })
    },
    // Loan-specific repay patterns for Kamino
    {
      pattern: /(?:repay|pay\s+back)\s+(?:my\s+)?(?:kamino|klend)\s+loan/i,
      protocol: 'kamino',
      action: 'repay',
      extractor: () => ({})
    },
    {
      pattern: /(?:repay|pay\s+back)\s+my\s+loan\s+(?:on|from)\s+(?:kamino|klend)/i,
      protocol: 'kamino',
      action: 'repay',
      extractor: () => ({})
    },
    // Withdraw patterns for Kamino
    {
      pattern: /(?:withdraw|pull\s+out|remove|take\s+out|pull)\s+(\d+(?:\.\d+)?)\s+(\w+)\s+from\s+(?:kamino|klend)/i,
      protocol: 'kamino',
      action: 'withdraw',
      extractor: (match) => ({
        amount: parseFloat(match[1]),
        token: match[2].toUpperCase()
      })
    },
    // Withdraw with "my" patterns for Kamino
    {
      pattern: /(?:withdraw|take\s+out|get)\s+my\s+(\w+)(?:\s+back)?\s+from\s+(?:kamino|klend)/i,
      protocol: 'kamino',
      action: 'withdraw',
      extractor: (match) => ({
        token: match[1].toUpperCase()
      })
    },
    {
      pattern: /(?:withdraw|take\s+out|get\s+(?:my\s+)?\w+\s+back)\s+(?:my\s+)?collateral\s+from\s+(?:kamino|klend)/i,
      protocol: 'kamino',
      action: 'withdraw',
      extractor: () => ({})
    },

    // Enhanced Lending patterns - Marginfi with comprehensive variations
    // Supply patterns for Marginfi
    {
      pattern: /(?:supply|deposit|lend|put|add|provide|invest|lock(?:\s+up)?)\s+(\d+(?:\.\d+)?)\s+(\w+)\s+(?:to|on|into|in)\s+(?:marginfi|margin\s+fi|mrgnlend)/i,
      protocol: 'marginfi',
      action: 'supply',
      extractor: (match) => ({
        amount: parseFloat(match[1]),
        token: match[2].toUpperCase()
      })
    },
    // Marginfi with "my" variations
    {
      pattern: /(?:deposit|put|add|provide|invest|lock(?:\s+up)?)\s+(?:my\s+)?(\d+(?:\.\d+)?)\s+(\w+)\s+(?:to|on|into|in)\s+(?:marginfi|margin\s+fi|mrgnlend)/i,
      protocol: 'marginfi',
      action: 'supply',
      extractor: (match) => ({
        amount: parseFloat(match[1]),
        token: match[2].toUpperCase()
      })
    },
    // Borrow patterns for Marginfi
    {
      pattern: /(?:borrow|take\s+a\s+loan\s+of|loan\s+me|get\s+a\s+loan\s+of|take\s+out)\s+(\d+(?:\.\d+)?)\s+(\w+)\s+(?:on|from)\s+(?:marginfi|margin\s+fi|mrgnlend)/i,
      protocol: 'marginfi',
      action: 'borrow',
      extractor: (match) => ({
        amount: parseFloat(match[1]),
        token: match[2].toUpperCase()
      })
    },
    // Generic borrow against collateral for Marginfi
    {
      pattern: /borrow\s+against\s+(?:my\s+)?collateral\s+(?:on|from)\s+(?:marginfi|margin\s+fi|mrgnlend)/i,
      protocol: 'marginfi',
      action: 'borrow',
      extractor: () => ({})
    },
    // Original basic borrow pattern for Marginfi
    {
      pattern: /borrow\s+(\d+(?:\.\d+)?)\s+(\w+)\s+(?:on|from)\s+(?:marginfi|margin\s+fi|mrgnlend)/i,
      protocol: 'marginfi',
      action: 'borrow',
      extractor: (match) => ({
        amount: parseFloat(match[1]),
        token: match[2].toUpperCase()
      })
    },
    // Repay patterns for Marginfi
    {
      pattern: /(?:repay|pay\s+back|pay\s+off|settle|return)\s+(\d+(?:\.\d+)?)\s+(\w+)(?:\s+debt)?\s+(?:on|to)\s+(?:marginfi|margin\s+fi|mrgnlend)/i,
      protocol: 'marginfi',
      action: 'repay',
      extractor: (match) => ({
        amount: parseFloat(match[1]),
        token: match[2].toUpperCase()
      })
    },
    // Loan-specific repay patterns for Marginfi
    {
      pattern: /(?:repay|pay\s+back)\s+(?:my\s+)?(?:marginfi|margin\s+fi|mrgnlend)\s+loan/i,
      protocol: 'marginfi',
      action: 'repay',
      extractor: () => ({})
    },
    {
      pattern: /(?:repay|pay\s+back)\s+my\s+loan\s+(?:on|from)\s+(?:marginfi|margin\s+fi|mrgnlend)/i,
      protocol: 'marginfi',
      action: 'repay',
      extractor: () => ({})
    },
    // Withdraw patterns for Marginfi
    {
      pattern: /(?:withdraw|pull\s+out|remove|take\s+out|pull)\s+(\d+(?:\.\d+)?)\s+(\w+)\s+from\s+(?:marginfi|margin\s+fi|mrgnlend)/i,
      protocol: 'marginfi',
      action: 'withdraw',
      extractor: (match) => ({
        amount: parseFloat(match[1]),
        token: match[2].toUpperCase()
      })
    },
    // Withdraw with "my" patterns for Marginfi
    {
      pattern: /(?:withdraw|take\s+out|get)\s+my\s+(\w+)(?:\s+back)?\s+from\s+(?:marginfi|margin\s+fi|mrgnlend)/i,
      protocol: 'marginfi',
      action: 'withdraw',
      extractor: (match) => ({
        token: match[1].toUpperCase()
      })
    },
    {
      pattern: /(?:withdraw|take\s+out|get\s+(?:my\s+)?\w+\s+back)\s+(?:my\s+)?collateral\s+from\s+(?:marginfi|margin\s+fi|mrgnlend)/i,
      protocol: 'marginfi',
      action: 'withdraw',
      extractor: () => ({})
    },

    // Enhanced Lending patterns - Solend with comprehensive variations
    // Supply patterns for Solend (case-insensitive with alternatives)
    {
      pattern: /(?:supply|deposit|lend|put|add|provide|invest)\s+(\d+(?:\.\d+)?)\s+(\w+)\s+(?:to|on|into|in)\s+(?:solend|SOLEND)(?:\s+lending)?/i,
      protocol: 'solend',
      action: 'supply',
      extractor: (match) => ({
        amount: parseFloat(match[1]),
        token: match[2].toUpperCase()
      })
    },
    // Solend with "my" variations
    {
      pattern: /(?:deposit|put|add|provide|invest)\s+(?:my\s+)?(\d+(?:\.\d+)?)\s+(\w+)\s+(?:to|on|into|in)\s+(?:solend|SOLEND)/i,
      protocol: 'solend',
      action: 'supply',
      extractor: (match) => ({
        amount: parseFloat(match[1]),
        token: match[2].toUpperCase()
      })
    },
    // Borrow patterns for Solend
    {
      pattern: /(?:borrow|take\s+a\s+loan\s+of|loan\s+me|get\s+a\s+loan\s+of|take\s+out)\s+(\d+(?:\.\d+)?)\s+(\w+)\s+(?:on|from)\s+solend/i,
      protocol: 'solend',
      action: 'borrow',
      extractor: (match) => ({
        amount: parseFloat(match[1]),
        token: match[2].toUpperCase()
      })
    },
    // Original basic borrow pattern for Solend
    {
      pattern: /borrow\s+(\d+(?:\.\d+)?)\s+(\w+)\s+(?:on|from)\s+solend/i,
      protocol: 'solend',
      action: 'borrow',
      extractor: (match) => ({
        amount: parseFloat(match[1]),
        token: match[2].toUpperCase()
      })
    },
    // Repay patterns for Solend
    {
      pattern: /(?:repay|pay\s+back|pay\s+off|settle|return)\s+(\d+(?:\.\d+)?)\s+(\w+)(?:\s+debt)?\s+(?:on|to)\s+solend/i,
      protocol: 'solend',
      action: 'repay',
      extractor: (match) => ({
        amount: parseFloat(match[1]),
        token: match[2].toUpperCase()
      })
    },
    // Loan-specific repay patterns for Solend
    {
      pattern: /(?:repay|pay\s+back)\s+(?:my\s+)?solend\s+loan/i,
      protocol: 'solend',
      action: 'repay',
      extractor: () => ({})
    },
    {
      pattern: /(?:repay|pay\s+back)\s+my\s+loan\s+(?:on|from)\s+solend/i,
      protocol: 'solend',
      action: 'repay',
      extractor: () => ({})
    },
    // Withdraw patterns for Solend
    {
      pattern: /(?:withdraw|pull\s+out|remove|take\s+out|pull)\s+(\d+(?:\.\d+)?)\s+(\w+)\s+from\s+solend/i,
      protocol: 'solend',
      action: 'withdraw',
      extractor: (match) => ({
        amount: parseFloat(match[1]),
        token: match[2].toUpperCase()
      })
    },
    // Withdraw with "my" patterns for Solend
    {
      pattern: /(?:withdraw|take\s+out|get)\s+my\s+(\w+)(?:\s+back)?\s+from\s+solend/i,
      protocol: 'solend',
      action: 'withdraw',
      extractor: (match) => ({
        token: match[1].toUpperCase()
      })
    },
    {
      pattern: /(?:withdraw|take\s+out|get\s+(?:my\s+)?\w+\s+back)\s+(?:my\s+)?collateral\s+from\s+solend/i,
      protocol: 'solend',
      action: 'withdraw',
      extractor: () => ({})
    },
    // Generic lending patterns (default to Kamino when no protocol specified)
    {
      pattern: /(?:supply|deposit|lend)\s+(\d+(?:\.\d+)?)\s+(\w+)$/i,
      protocol: 'kamino',
      action: 'supply',
      extractor: (match) => ({
        amount: parseFloat(match[1]),
        token: match[2].toUpperCase()
      })
    },
    {
      pattern: /borrow\s+(\d+(?:\.\d+)?)\s+(\w+)$/i,
      protocol: 'kamino',
      action: 'borrow',
      extractor: (match) => ({
        amount: parseFloat(match[1]),
        token: match[2].toUpperCase()
      })
    },
    {
      pattern: /(?:repay|pay\s+back)\s+(\d+(?:\.\d+)?)\s+(\w+)$/i,
      protocol: 'kamino',
      action: 'repay',
      extractor: (match) => ({
        amount: parseFloat(match[1]),
        token: match[2].toUpperCase()
      })
    },
    {
      pattern: /withdraw\s+(\d+(?:\.\d+)?)\s+(\w+)$/i,
      protocol: 'kamino',
      action: 'withdraw',
      extractor: (match) => ({
        amount: parseFloat(match[1]),
        token: match[2].toUpperCase()
      })
    },
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
    // "exchange 5 SOL into BONK"
    {
      pattern: /exchange\s+(\d+(?:\.\d+)?)\s+(\w+)\s+into\s+(\w+)(?:\s+with\s+(\d+(?:\.\d+)?)\s*%?\s*slippage)?/i,
      protocol: 'jupiter',
      action: 'swap',
      extractor: (match) => ({
        amount: parseFloat(match[1]),
        from: match[2].toUpperCase(),
        to: match[3].toUpperCase(),
        slippage: match[4] ? parseFloat(match[4]) : 0.5
      })
    },
    // "buy some BONK" / "purchase BONK" / "get me BONK"
    {
      pattern: /(?:buy\s+some|purchase|get\s+me)\s+(\w+)/i,
      protocol: '__resolve__',
      action: 'buy',
      extractor: (match) => ({
        amount: 1,
        token: match[1].toUpperCase(),
        slippage: undefined
      })
    },
    // "buy BONK with 5 SOL"
    {
      pattern: /buy\s+(\w+)\s+with\s+(\d+(?:\.\d+)?)\s+sol(?:\s+with\s+(\d+(?:\.\d+)?)\s*%?\s*slippage)?/i,
      protocol: '__resolve__',
      action: 'buy',
      extractor: (match) => ({
        amount: parseFloat(match[2]),
        token: match[1].toUpperCase(),
        slippage: match[3] ? parseFloat(match[3]) : undefined
      })
    },
    // "get me 2 SOL of USDC"
    {
      pattern: /get\s+me\s+(\d+(?:\.\d+)?)\s+sol\s+of\s+(\w+)/i,
      protocol: '__resolve__',
      action: 'buy',
      extractor: (match) => ({
        amount: parseFloat(match[1]),
        token: match[2].toUpperCase(),
        slippage: undefined
      })
    },
    // "sell my BONK" (without "for sol")
    {
      pattern: /sell\s+my\s+(\w+)/i,
      protocol: '__resolve__',
      action: 'sell',
      extractor: (match) => ({
        amount: -1,
        token: match[1].toUpperCase(),
        slippage: undefined
      })
    },
    // "ape into BONK" (no amount)
    {
      pattern: /ape\s+into\s+([1-9A-HJ-NP-Za-km-z]{32,44}|[\w]{2,10})/i,
      protocol: '__resolve__',
      action: 'buy',
      extractor: (match) => ({
        amount: 1,
        token: match[1],
        slippage: undefined
      })
    },
    // "yolo X SOL into TOKEN"
    {
      pattern: /yolo\s+(\d+(?:\.\d+)?)\s+sol\s+into\s+([1-9A-HJ-NP-Za-km-z]{32,44}|[\w]{2,10})(?:\s+with\s+(\d+(?:\.\d+)?)\s*%?\s*slippage)?/i,
      protocol: '__resolve__',
      action: 'buy',
      extractor: (match) => ({
        amount: parseFloat(match[1]),
        token: match[2],
        slippage: match[3] ? parseFloat(match[3]) : undefined
      })
    },
    // "long BONK with 2 SOL" (buy)
    {
      pattern: /long\s+(\w+)\s+with\s+(\d+(?:\.\d+)?)\s+sol/i,
      protocol: '__resolve__',
      action: 'buy',
      extractor: (match) => ({
        amount: parseFloat(match[2]),
        token: match[1].toUpperCase(),
        slippage: undefined
      })
    },
    // "short BONK" (sell)
    {
      pattern: /short\s+(\w+)/i,
      protocol: '__resolve__',
      action: 'sell',
      extractor: (match) => ({
        amount: -1,
        token: match[1].toUpperCase(),
        slippage: undefined
      })
    },
    // "pay ADDRESS X SOL/TOKEN"
    {
      pattern: /pay\s+([1-9A-HJ-NP-Za-km-z]{32,44})\s+(\d+(?:\.\d+)?)\s+(\w+)/i,
      protocol: 'spl-token',
      action: 'transfer',
      extractor: (match) => ({
        amount: parseFloat(match[2]),
        to: match[1],
        token: match[3].toUpperCase()
      })
    },
    // "send ADDRESS X TOKEN" (address before amount)
    {
      pattern: /(?:send|transfer)\s+([1-9A-HJ-NP-Za-km-z]{32,44})\s+(\d+(?:\.\d+)?)\s+(\w+)/i,
      protocol: 'spl-token',
      action: 'transfer',
      extractor: (match) => ({
        amount: parseFloat(match[2]),
        to: match[1],
        token: match[3].toUpperCase()
      })
    },
    // "withdraw stake" (generic unstake)
    {
      pattern: /withdraw\s+stake/i,
      protocol: 'marinade',
      action: 'unstake',
      extractor: () => ({
        token: 'MSOL'
      })
    },
    // "tip jito 0.01 SOL"
    {
      pattern: /tip\s+jito\s+(\d+(?:\.\d+)?)\s*(?:sol)?/i,
      protocol: 'jito',
      action: 'tip',
      extractor: (match) => ({
        amount: parseFloat(match[1])
      })
    },
    // "send jito tip" (default small tip)
    {
      pattern: /send\s+jito\s+tip/i,
      protocol: 'jito',
      action: 'tip',
      extractor: () => ({
        amount: 0.001
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
      // Regex failed — try learned patterns first, then LLM fallback
      const learnedResult = IntentParser.tryLearnedPatterns(intent.prompt);
      if (learnedResult) {
        console.log(`[intent-parser] Matched learned pattern for: "${intent.prompt}"`);
        return learnedResult;
      }
      
      const llmResult = await IntentParser.tryLLMFallback(intent.prompt);
      if (llmResult) {
        // Learn from this success — save for future regex-free matching
        IntentParser.saveLearnedPattern(intent.prompt, llmResult);
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
      /\s+and\s+(swap|send|transfer|tip|stake|buy|sell|ape|memo|write|create|close|dump|convert|trade|exchange|liquid\s+stake|unstake|provide|add|remove|open|native\s+stake|deactivate|withdraw|supply|deposit|lend|borrow|repay|put|invest|lock|take\s+a\s+loan|loan\s+me|get\s+a\s+loan|take\s+out|pay\s+back|pay\s+off|settle|return|pull\s+out|remove)\s+/gi,
      // " then " followed by a verb (enhanced to capture the verb properly)
      /\s+then\s+(swap|send|transfer|tip|stake|buy|sell|ape|memo|write|create|close|dump|convert|trade|exchange|liquid\s+stake|unstake|provide|add|remove|open|native\s+stake|deactivate|withdraw|supply|deposit|lend|borrow|repay|put|invest|lock|take\s+a\s+loan|loan\s+me|get\s+a\s+loan|take\s+out|pay\s+back|pay\s+off|settle|return|pull\s+out|remove)\s+/gi,
      // " also " followed by a verb
      /\s+also\s+(swap|send|transfer|tip|stake|buy|sell|ape|memo|write|create|close|dump|convert|trade|exchange|liquid\s+stake|unstake|provide|add|remove|open|native\s+stake|deactivate|withdraw|supply|deposit|lend|borrow|repay|put|invest|lock|take\s+a\s+loan|loan\s+me|get\s+a\s+loan|take\s+out|pay\s+back|pay\s+off|settle|return|pull\s+out|remove)\s+/gi,
      // " + "
      /\s+\+\s+/gi,
      // ", " followed by a verb (comma + space + verb)
      /,\s+(swap|send|transfer|tip|stake|buy|sell|ape|memo|write|create|close|dump|convert|trade|exchange|liquid\s+stake|unstake|provide|add|remove|open|native\s+stake|deactivate|withdraw|supply|deposit|lend|borrow|repay|put|invest|lock|take\s+a\s+loan|loan\s+me|get\s+a\s+loan|take\s+out|pay\s+back|pay\s+off|settle|return|pull\s+out|remove)\s+/gi
    ];

    let segments = [prompt];

    // Apply each separator pattern
    for (const separator of separators) {
      const newSegments: string[] = [];
      
      for (const segment of segments) {
        // Use a more careful splitting approach
        const matches = [...segment.matchAll(separator)];
        if (matches.length > 0) {
          let lastIndex = 0;
          
          // Add the first segment (before first match)
          if (matches[0].index! > 0) {
            newSegments.push(segment.slice(0, matches[0].index).trim());
          }
          
          // Process each match
          for (let i = 0; i < matches.length; i++) {
            const match = matches[i];
            const matchStart = match.index!;
            const matchEnd = matchStart + match[0].length;
            
            // Extract the verb from the match
            const verb = match[1] || match[0].trim().replace(/^(and|then|also|\+|,)\s+/i, '');
            
            // Start of next segment
            let segmentStart = matchEnd;
            let segmentEnd = (i < matches.length - 1) ? matches[i + 1].index! : segment.length;
            
            // Create the new segment with the verb
            if (segmentEnd > segmentStart) {
              const nextSegmentText = segment.slice(segmentStart, segmentEnd).trim();
              newSegments.push((verb + ' ' + nextSegmentText).trim());
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

  // --- Learned Patterns (self-healing parser) ---
  
  private static learnedPatternsPath = path.join(process.cwd(), 'data', 'learned-intents.json');
  private static learnedPatterns: Array<{ prompt: string; normalized: string; result: ParsedIntent }> = [];
  private static learnedLoaded = false;

  /**
   * Load learned patterns from disk (lazy, once).
   */
  private static loadLearnedPatterns(): void {
    if (this.learnedLoaded) return;
    this.learnedLoaded = true;
    try {
      if (fs.existsSync(this.learnedPatternsPath)) {
        const data = JSON.parse(fs.readFileSync(this.learnedPatternsPath, 'utf-8'));
        this.learnedPatterns = Array.isArray(data) ? data : [];
        console.log(`[intent-parser] Loaded ${this.learnedPatterns.length} learned patterns`);
      }
    } catch (e) {
      console.warn('[intent-parser] Failed to load learned patterns:', e);
    }
  }

  /**
   * Normalize a prompt for fuzzy matching: lowercase, collapse whitespace, strip punctuation.
   */
  private static normalize(prompt: string): string {
    return prompt.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
  }

  /**
   * Try to match against previously learned patterns.
   * Uses normalized string matching — extracts numbers/tokens and maps them.
   */
  private static tryLearnedPatterns(prompt: string): ParsedIntent | null {
    this.loadLearnedPatterns();
    if (this.learnedPatterns.length === 0) return null;

    const norm = this.normalize(prompt);
    
    for (const learned of this.learnedPatterns) {
      // Exact normalized match
      if (learned.normalized === norm) {
        return { ...learned.result, confidence: 0.8 };
      }
      
      // Template match: replace numbers and known tokens with placeholders, compare structure
      const templateNorm = norm.replace(/\d+(?:\.\d+)?/g, '__NUM__').replace(/\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g, '__ADDR__');
      const templateLearned = learned.normalized.replace(/\d+(?:\.\d+)?/g, '__NUM__').replace(/\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g, '__ADDR__');
      
      if (templateNorm === templateLearned) {
        // Same structure, different values — extract new values and map them
        const nums = norm.match(/\d+(?:\.\d+)?/g) || [];
        const result = { ...learned.result, params: { ...learned.result.params }, confidence: 0.75 };
        
        // Replace amount with new number if present
        if (nums.length > 0 && result.params.amount !== undefined && nums[0]) {
          result.params.amount = parseFloat(nums[0]);
        }
        
        // Extract token names from prompt for swaps
        if (result.params.from && result.params.to) {
          const words = prompt.match(/\b[A-Za-z]{2,10}\b/g) || [];
          const tokens = words.filter(w => !['swap', 'for', 'to', 'into', 'from', 'with', 'and', 'the', 'sol', 'buy', 'sell', 'trade', 'exchange', 'convert', 'slippage'].includes(w.toLowerCase()));
          // Don't remap — too risky. Just use amount replacement.
        }
        
        return result;
      }
    }
    
    return null;
  }

  /**
   * Save a successfully LLM-parsed pattern for future use.
   */
  private static saveLearnedPattern(prompt: string, result: ParsedIntent): void {
    try {
      this.loadLearnedPatterns();
      
      const normalized = this.normalize(prompt);
      
      // Don't save duplicates
      if (this.learnedPatterns.some(p => p.normalized === normalized)) return;
      
      this.learnedPatterns.push({ prompt, normalized, result });
      
      // Ensure data directory exists
      const dir = path.dirname(this.learnedPatternsPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(this.learnedPatternsPath, JSON.stringify(this.learnedPatterns, null, 2));
      console.log(`[intent-parser] Learned new pattern: "${prompt}" → ${result.action} (${this.learnedPatterns.length} total)`);
    } catch (e) {
      console.warn('[intent-parser] Failed to save learned pattern:', e);
    }
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
      'create token account',
      'supply/deposit X TOKEN to kamino/marginfi/solend',
      'borrow X TOKEN from kamino/marginfi/solend',
      'repay X TOKEN on kamino/marginfi/solend',
      'withdraw X TOKEN from kamino/marginfi/solend'
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
      tip: 'tip 0.0001 SOL',
      kamino_supply: 'supply 100 USDC to Kamino',
      kamino_borrow: 'borrow 1 SOL on Kamino',
      marginfi_supply: 'deposit 500 USDC into Marginfi',
      marginfi_borrow: 'borrow 0.5 SOL from Marginfi',
      solend_repay: 'repay 25 USDC on Solend',
      solend_withdraw: 'withdraw 100 USDC from Solend'
    };
  }
}