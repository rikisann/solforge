import { TransactionInstruction, PublicKey } from '@solana/web3.js';
import { BuildIntent, ProtocolHandler, SwapQuote } from '../utils/types';
import { AccountResolver } from '../engine/resolver';
import { resolveMint } from '../utils/connection';

export class JupiterProtocol implements ProtocolHandler {
  name = 'jupiter';
  description = 'Jupiter aggregator for optimal token swaps across all Solana DEXes';
  supportedIntents = ['swap', 'exchange', 'trade'];

  private readonly apiBaseUrl: string;

  constructor() {
    this.apiBaseUrl = process.env.JUPITER_API_URL || 'https://lite-api.jup.ag/swap/v1';
  }

  async build(intent: BuildIntent): Promise<TransactionInstruction[]> {
    throw new Error('Jupiter returns complete transactions. Use buildSwapTransaction() instead.');
  }

  validateParams(params: Record<string, any>): boolean {
    return (
      typeof params.amount === 'number' &&
      params.amount > 0 &&
      typeof params.from === 'string' &&
      typeof params.to === 'string'
    );
  }

  /**
   * Build a complete swap transaction using Jupiter's lite API (free, no auth required).
   * Two-step flow: GET /quote → POST /swap
   */
  async buildSwapTransaction(intent: BuildIntent): Promise<string> {
    const { params } = intent;
    const payer = AccountResolver.resolvePublicKey(intent.payer);

    const inputMint = resolveMint(params.from);
    const outputMint = resolveMint(params.to);
    const slippageBps = Math.floor((params.slippage || 1.0) * 100);
    const decimals = this.getTokenDecimals(inputMint);
    const adjustedAmount = Math.floor(params.amount * Math.pow(10, decimals));

    // Step 1: Get quote
    const quoteUrl = `${this.apiBaseUrl}/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${adjustedAmount}&slippageBps=${slippageBps}`;
    
    const quoteResponse = await fetch(quoteUrl, {
      signal: AbortSignal.timeout(10000),
    });

    if (!quoteResponse.ok) {
      const err = await quoteResponse.text();
      throw new Error(`Jupiter quote failed (${quoteResponse.status}): ${err}`);
    }

    const quote = await quoteResponse.json();

    // Step 2: Get swap transaction
    const swapResponse = await fetch(`${this.apiBaseUrl}/swap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quoteResponse: quote,
        userPublicKey: payer.toString(),
        wrapAndUnwrapSol: true,
        useSharedAccounts: false,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!swapResponse.ok) {
      const err = await swapResponse.text();
      throw new Error(`Jupiter swap failed (${swapResponse.status}): ${err}`);
    }

    const swapData = await swapResponse.json() as { swapTransaction?: string; error?: string };

    if (!swapData.swapTransaction) {
      throw new Error(`Jupiter returned no transaction: ${swapData.error || 'unknown error'}`);
    }

    return swapData.swapTransaction;
  }

  /**
   * Get a swap quote without building a transaction.
   */
  async getSwapQuote(params: Record<string, any>): Promise<SwapQuote> {
    const inputMint = resolveMint(params.from);
    const outputMint = resolveMint(params.to);
    const slippageBps = Math.floor((params.slippage || 0.5) * 100);
    const decimals = this.getTokenDecimals(inputMint);
    const adjustedAmount = Math.floor(params.amount * Math.pow(10, decimals));

    const quoteUrl = `${this.apiBaseUrl}/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${adjustedAmount}&slippageBps=${slippageBps}`;
    
    const response = await fetch(quoteUrl, {
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`Jupiter quote failed: ${await response.text()}`);
    }

    const quote = await response.json() as any;

    return {
      inputAmount: quote.inAmount,
      outputAmount: quote.outAmount,
      priceImpactPct: quote.priceImpactPct || '0',
      route: quote.routePlan || [],
    };
  }

  private getTokenDecimals(mint: string): number {
    const knownDecimals: Record<string, number> = {
      'So11111111111111111111111111111111111111112': 9,
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 6,
      'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 6,
      '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R': 6,
      'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': 9,
      'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': 5,
      'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN': 6,
      'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm': 6,
      'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3': 6,
      'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL': 9,
    };
    return knownDecimals[mint] || 6;
  }

  getRequiredAccounts(params: Record<string, any>): PublicKey[] {
    const accounts: PublicKey[] = [];
    if (params.from) accounts.push(AccountResolver.resolvePublicKey(resolveMint(params.from)));
    if (params.to) accounts.push(AccountResolver.resolvePublicKey(resolveMint(params.to)));
    return accounts;
  }
}
