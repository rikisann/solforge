/**
 * TokenResolver - Uses DexScreener API to identify which protocol/DEX a token trades on.
 * This allows natural language prompts with raw token addresses to be routed to the correct protocol.
 */

interface DexScreenerPair {
  chainId: string;
  dexId: string;
  pairAddress: string;
  baseToken: { address: string; symbol: string; name: string };
  quoteToken: { address: string; symbol: string; name: string };
  priceUsd?: string;
  liquidity?: { usd: number };
  volume?: { h24: number };
}

export interface TokenInfo {
  mint: string;
  symbol: string;
  name: string;
  primaryDex: string;        // e.g. 'raydium', 'meteora', 'orca', 'pumpfun'
  primaryPool: string;       // pool/pair address for the best liquidity
  allDexes: string[];        // all DEXes this token trades on
  priceUsd?: string;
  liquidity?: number;
}

// Map DexScreener dexId values to our protocol names
const DEX_ID_MAP: Record<string, string> = {
  'raydium': 'raydium',
  'raydium-clmm': 'raydium',
  'raydium-cp': 'raydium',
  'meteora': 'meteora',
  'meteoradbc': 'meteora',
  'meteora-dlmm': 'meteora',
  'orca': 'orca',
  'whirlpool': 'orca',
  'pumpfun': 'pumpfun',
  'pump-fun': 'pumpfun',
  'jupiter': 'jupiter',
};

export class TokenResolver {
  private static cache = new Map<string, { info: TokenInfo | null; timestamp: number }>();
  private static CACHE_TTL = 60_000; // 1 minute cache

  /**
   * Look up a token by mint address using DexScreener.
   * Returns the best DEX to trade on (by liquidity) and token metadata.
   */
  static async resolve(mint: string): Promise<TokenInfo | null> {
    // Check cache
    const cached = this.cache.get(mint);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.info;
    }

    try {
      const response = await fetch(
        `https://api.dexscreener.com/latest/dex/tokens/${mint}`,
        { signal: AbortSignal.timeout(5000) }
      );

      if (!response.ok) {
        this.cache.set(mint, { info: null, timestamp: Date.now() });
        return null;
      }

      const data = await response.json() as { pairs?: DexScreenerPair[] };
      const pairs = (data.pairs || []).filter(p => p.chainId === 'solana');

      if (pairs.length === 0) {
        this.cache.set(mint, { info: null, timestamp: Date.now() });
        return null;
      }

      // Sort by liquidity (highest first)
      pairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));

      const bestPair = pairs[0];
      const allDexIds = [...new Set(pairs.map(p => p.dexId))];
      const allProtocols = [...new Set(allDexIds.map(id => DEX_ID_MAP[id] || id))];

      const info: TokenInfo = {
        mint,
        symbol: bestPair.baseToken.symbol,
        name: bestPair.baseToken.name,
        primaryDex: DEX_ID_MAP[bestPair.dexId] || bestPair.dexId,
        primaryPool: bestPair.pairAddress,
        allDexes: allProtocols,
        priceUsd: bestPair.priceUsd,
        liquidity: bestPair.liquidity?.usd,
      };

      this.cache.set(mint, { info, timestamp: Date.now() });
      return info;
    } catch (error) {
      console.warn(`TokenResolver: Failed to resolve ${mint}:`, error);
      this.cache.set(mint, { info: null, timestamp: Date.now() });
      return null;
    }
  }

  /**
   * Determine the best protocol to use for buying/selling a token.
   * Falls back to 'jupiter' if we can't determine the DEX (Jupiter aggregates all).
   */
  static async resolveProtocol(mint: string): Promise<{ protocol: string; pool?: string; tokenInfo?: TokenInfo }> {
    const info = await this.resolve(mint);

    if (!info) {
      // Unknown token — default to Jupiter (it aggregates all DEXes)
      return { protocol: 'jupiter' };
    }

    return {
      protocol: info.primaryDex,
      pool: info.primaryPool,
      tokenInfo: info,
    };
  }
}
