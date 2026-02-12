import { TransactionInstruction, PublicKey } from '@solana/web3.js';
import { BuildIntent, ProtocolHandler, SwapQuote } from '../utils/types';
import { AccountResolver } from '../engine/resolver';
import { resolveMint } from '../utils/connection';
import axios from 'axios';

interface JupiterQuoteResponse {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  platformFee?: any;
  priceImpactPct: string;
  routePlan: any[];
}

interface JupiterSwapResponse {
  swapTransaction: string;
}

export class JupiterProtocol implements ProtocolHandler {
  name = 'jupiter';
  description = 'Jupiter aggregator for optimal token swaps';
  supportedIntents = ['swap', 'exchange', 'trade'];

  private readonly jupiterApiUrl: string;

  constructor() {
    this.jupiterApiUrl = process.env.JUPITER_API_URL || 'https://quote-api.jup.ag/v6';
  }

  async build(intent: BuildIntent): Promise<TransactionInstruction[]> {
    const { params } = intent;
    const payer = AccountResolver.resolvePublicKey(intent.payer);

    // Get quote from Jupiter API
    const quote = await this.getQuote(params);
    
    // Get swap transaction from Jupiter API  
    const swapTransaction = await this.getSwapTransaction(quote, payer.toString());
    
    // Parse the transaction to extract instructions
    return this.parseJupiterTransaction(swapTransaction);
  }

  validateParams(params: Record<string, any>): boolean {
    return (
      typeof params.amount === 'number' &&
      params.amount > 0 &&
      typeof params.from === 'string' &&
      typeof params.to === 'string' &&
      (!params.slippage || (typeof params.slippage === 'number' && params.slippage >= 0 && params.slippage <= 100))
    );
  }

  private async getQuote(params: Record<string, any>): Promise<JupiterQuoteResponse> {
    const inputMint = resolveMint(params.from);
    const outputMint = resolveMint(params.to);
    const amount = params.amount;
    const slippageBps = Math.floor((params.slippage || 0.5) * 100); // Convert % to basis points

    // Get token decimals to calculate proper amount
    const decimals = await this.getTokenDecimals(inputMint);
    const adjustedAmount = Math.floor(amount * Math.pow(10, decimals));

    try {
      const response = await axios.get(`${this.jupiterApiUrl}/quote`, {
        params: {
          inputMint,
          outputMint,
          amount: adjustedAmount.toString(),
          slippageBps,
          onlyDirectRoutes: false,
          asLegacyTransaction: false
        },
        timeout: 10000
      });

      if (!response.data) {
        throw new Error('No quote received from Jupiter API');
      }

      return response.data;

    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Jupiter quote failed: ${error.response?.data?.error || error.message}`);
      }
      throw new Error(`Failed to get Jupiter quote: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async getSwapTransaction(quote: JupiterQuoteResponse, userPublicKey: string): Promise<string> {
    try {
      const response = await axios.post(`${this.jupiterApiUrl}/swap`, {
        quoteResponse: quote,
        userPublicKey,
        wrapAndUnwrapSol: true,
        useSharedAccounts: true,
        feeAccount: undefined, // No fee account for now
        computeUnitPriceMicroLamports: undefined // Let Jupiter decide
      }, {
        timeout: 10000
      });

      if (!response.data?.swapTransaction) {
        throw new Error('No swap transaction received from Jupiter API');
      }

      return response.data.swapTransaction;

    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Jupiter swap failed: ${error.response?.data?.error || error.message}`);
      }
      throw new Error(`Failed to get Jupiter swap: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private parseJupiterTransaction(swapTransactionBase64: string): TransactionInstruction[] {
    try {
      // Decode the base64 transaction
      const transactionBuffer = Buffer.from(swapTransactionBase64, 'base64');
      
      // Parse the transaction - Jupiter returns a versioned transaction
      // For now, we'll return empty array and let the API handle the full transaction
      // In a production system, you'd properly parse and extract instructions
      
      // This is a placeholder - Jupiter transactions need special handling
      // since they return complete transactions, not just instructions
      throw new Error('Jupiter transactions should be handled as complete transactions, not individual instructions');
      
    } catch (error) {
      throw new Error(`Failed to parse Jupiter transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async getTokenDecimals(mint: string): Promise<number> {
    // Known decimals for common tokens
    const knownDecimals: Record<string, number> = {
      'So11111111111111111111111111111111111111112': 9, // SOL
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 6, // USDC
      'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 6, // USDT
      '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R': 6, // RAY
      'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': 9  // mSOL
    };

    return knownDecimals[mint] || 6; // Default to 6 decimals
  }

  // Special method for Jupiter since it returns complete transactions
  async buildSwapTransaction(intent: BuildIntent): Promise<string> {
    const { params } = intent;
    const payer = AccountResolver.resolvePublicKey(intent.payer);

    // Get quote and swap transaction
    const quote = await this.getQuote(params);
    const swapTransaction = await this.getSwapTransaction(quote, payer.toString());

    return swapTransaction;
  }

  async getSwapQuote(params: Record<string, any>): Promise<SwapQuote> {
    const quote = await this.getQuote(params);
    
    return {
      inputAmount: quote.inAmount,
      outputAmount: quote.outAmount,
      priceImpactPct: quote.priceImpactPct,
      route: quote.routePlan
    };
  }

  getRequiredAccounts(params: Record<string, any>): PublicKey[] {
    const accounts: PublicKey[] = [];
    
    if (params.from) {
      accounts.push(AccountResolver.resolvePublicKey(resolveMint(params.from)));
    }
    
    if (params.to) {
      accounts.push(AccountResolver.resolvePublicKey(resolveMint(params.to)));
    }

    return accounts;
  }
}