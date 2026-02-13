import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { EstimateRequest, EstimateResponse, TransactionEstimate, BuildIntent } from '../utils/types';
import { RPCConnection } from '../utils/connection';
import { ProtocolRegistry } from '../protocols';
import { AccountResolver } from './resolver';

export class TransactionEstimator {
  
  static async estimateTransaction(request: EstimateRequest): Promise<EstimateResponse> {
    try {
      const network = request.network || RPCConnection.getDefaultNetwork();
      const payer = AccountResolver.resolvePublicKey(request.payer);
      
      let totalComputeUnits = 0;
      let requiresAccountCreation = false;
      let intentsCount = 0;

      // Handle single intent
      if (request.intent && request.params) {
        const intent: BuildIntent = {
          intent: request.intent,
          params: request.params,
          payer: request.payer,
          network: request.network,
          priorityFee: request.priorityFee,
          computeBudget: request.computeBudget
        };

        const estimate = await this.estimateSingleIntent(intent, network);
        totalComputeUnits += estimate.computeUnits;
        requiresAccountCreation = requiresAccountCreation || estimate.requiresAccountCreation;
        intentsCount = 1;
      }
      
      // Handle multiple intents
      if (request.intents) {
        for (const intent of request.intents) {
          const estimate = await this.estimateSingleIntent(intent, network);
          totalComputeUnits += estimate.computeUnits;
          requiresAccountCreation = requiresAccountCreation || estimate.requiresAccountCreation;
          intentsCount++;
        }
      }

      // Add base transaction overhead
      totalComputeUnits += this.getBaseTransactionCost(intentsCount);

      // Calculate fees
      const priorityFee = request.priorityFee || await this.getEstimatedPriorityFee(network);
      const baseFee = 5000; // 5000 lamports base transaction fee
      const priorityFeeTotal = Math.ceil((totalComputeUnits * priorityFee) / 1_000_000);
      const rentCost = requiresAccountCreation ? await this.getMinimumRentExemption(network) : 0;
      
      const totalFeeInLamports = baseFee + priorityFeeTotal + rentCost;

      const estimate: TransactionEstimate = {
        baseFee: (baseFee / LAMPORTS_PER_SOL).toFixed(9),
        priorityFee: (priorityFeeTotal / LAMPORTS_PER_SOL).toFixed(9),
        totalFee: (totalFeeInLamports / LAMPORTS_PER_SOL).toFixed(9),
        computeUnits: totalComputeUnits,
        ...(rentCost > 0 && { rentCost: (rentCost / LAMPORTS_PER_SOL).toFixed(9) })
      };

      return {
        success: true,
        estimate
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to estimate transaction costs'
      };
    }
  }

  private static async estimateSingleIntent(
    intent: BuildIntent,
    network: 'mainnet' | 'devnet'
  ): Promise<{ computeUnits: number; requiresAccountCreation: boolean }> {
    
    const handler = ProtocolRegistry.getHandler(intent.intent);
    if (!handler) {
      throw new Error(`Unsupported intent: ${intent.intent}`);
    }

    // Get protocol-specific compute unit estimates
    const computeUnits = this.getProtocolComputeUnits(handler.name, intent);
    const requiresAccountCreation = this.checkAccountCreationRequirement(handler.name, intent);

    return {
      computeUnits,
      requiresAccountCreation
    };
  }

  private static getProtocolComputeUnits(protocolName: string, intent: BuildIntent): number {
    // Base estimates for different protocols (these could be refined with real data)
    const estimates: Record<string, number> = {
      'system': 450, // Simple transfer
      'spl-token': 2500, // Token transfer
      'jupiter': 400000, // Complex swap routing
      'memo': 450, // Simple memo
      'jito': 1000, // Jito tip
      'raydium': 150000, // AMM swap
      'orca': 120000, // Whirlpool swap
      'pumpfun': 200000, // Pump.fun operation
      'marinade': 50000, // Liquid staking
      'meteora': 100000, // Meteora operation
      'stake': 3000, // Stake operation
      'token2022': 3500 // Token 2022 operation
    };

    let baseEstimate = estimates[protocolName] || 10000; // Default fallback

    // Adjust based on specific intent parameters
    if (intent.intent === 'swap' && intent.params.amount) {
      // Larger swaps might require more compute for routing
      const amount = parseFloat(intent.params.amount.toString());
      if (amount > 1000) {
        baseEstimate *= 1.2;
      }
    }

    if (intent.intent === 'create-ata' || intent.intent.includes('create')) {
      baseEstimate += 2000; // Account creation overhead
    }

    return Math.ceil(baseEstimate);
  }

  private static checkAccountCreationRequirement(protocolName: string, intent: BuildIntent): boolean {
    // Check if the intent likely requires account creation
    const accountCreationIntents = [
      'create-ata',
      'create-account',
      'initialize',
      'create-pool',
      'create-position'
    ];

    return accountCreationIntents.some(createIntent => 
      intent.intent.includes(createIntent) || 
      intent.intent.includes('create')
    );
  }

  private static getBaseTransactionCost(instructionCount: number): number {
    // Base cost for transaction structure + signature verification
    const baseCost = 1500;
    
    // Additional cost per instruction
    const perInstructionCost = 200;
    
    return baseCost + (instructionCount * perInstructionCost);
  }

  private static async getEstimatedPriorityFee(network: 'mainnet' | 'devnet'): Promise<number> {
    try {
      const connection = RPCConnection.getConnection(network);
      
      // Try to get recent priority fees (this is a simplified approach)
      // In production, you'd want to use more sophisticated fee estimation
      const recentBlockhashes = await connection.getRecentBlockhash();
      
      // Default priority fees based on network conditions
      if (network === 'mainnet') {
        return 10000; // 0.01 SOL per million compute units
      } else {
        return 1000; // Lower fees on devnet
      }
    } catch {
      // Fallback to conservative estimates
      return network === 'mainnet' ? 10000 : 1000;
    }
  }

  private static async getMinimumRentExemption(network: 'mainnet' | 'devnet'): Promise<number> {
    try {
      const connection = RPCConnection.getConnection(network);
      
      // Estimate for typical token account (165 bytes)
      const rentExemption = await connection.getMinimumBalanceForRentExemption(165);
      return rentExemption;
    } catch {
      // Fallback rent exemption (approximate)
      return 2039280; // ~0.002 SOL
    }
  }
}