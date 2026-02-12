import { Transaction, PublicKey, TransactionMessage, VersionedTransaction } from '@solana/web3.js';
import { RPCConnection } from '../utils/connection';
import { SimulationResult } from '../utils/types';

export class TransactionSimulator {
  
  static async simulateTransaction(
    transaction: Transaction | VersionedTransaction,
    payer: PublicKey,
    network: 'mainnet' | 'devnet' = 'devnet'
  ): Promise<SimulationResult> {
    try {
      const connection = RPCConnection.getConnection(network);
      
      let simulationResult;
      
      if (transaction instanceof VersionedTransaction) {
        simulationResult = await connection.simulateTransaction(transaction);
      } else {
        // For legacy transactions
        simulationResult = await connection.simulateTransaction(transaction);
      }

      if (simulationResult.value.err) {
        return {
          success: false,
          logs: simulationResult.value.logs || [],
          unitsConsumed: simulationResult.value.unitsConsumed || 0,
          error: `Simulation failed: ${JSON.stringify(simulationResult.value.err)}`
        };
      }

      return {
        success: true,
        logs: simulationResult.value.logs || [],
        unitsConsumed: simulationResult.value.unitsConsumed || 0
      };

    } catch (error) {
      return {
        success: false,
        logs: [],
        unitsConsumed: 0,
        error: `Simulation error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  static async estimateComputeUnits(
    transaction: Transaction | VersionedTransaction,
    payer: PublicKey,
    network: 'mainnet' | 'devnet' = 'devnet'
  ): Promise<number> {
    const result = await this.simulateTransaction(transaction, payer, network);
    return result.success ? result.unitsConsumed : 200000; // fallback estimate
  }

  static async estimatePriorityFee(
    network: 'mainnet' | 'devnet' = 'devnet'
  ): Promise<number> {
    try {
      const connection = RPCConnection.getConnection(network);
      
      // Get recent prioritization fees
      const recentFees = await connection.getRecentPrioritizationFees();
      
      if (recentFees.length === 0) {
        return network === 'mainnet' ? 1000 : 0; // microlamports per compute unit
      }

      // Take the median of recent fees
      const fees = recentFees
        .map(fee => fee.prioritizationFee)
        .sort((a, b) => a - b);
      
      const medianIndex = Math.floor(fees.length / 2);
      const medianFee = fees[medianIndex];
      
      // Add small buffer for reliability
      return Math.max(medianFee * 1.1, network === 'mainnet' ? 1000 : 0);
      
    } catch (error) {
      console.warn('Failed to estimate priority fee:', error);
      return network === 'mainnet' ? 1000 : 0;
    }
  }
}