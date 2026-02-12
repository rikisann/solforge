import { 
  Transaction, 
  TransactionInstruction, 
  PublicKey, 
  ComputeBudgetProgram,
  SystemProgram,
  LAMPORTS_PER_SOL
} from '@solana/web3.js';
import { BuildIntent, BuildResponse, ProtocolHandler } from '../utils/types';
import { RPCConnection } from '../utils/connection';
import { TransactionSimulator } from './simulator';
import { AccountResolver } from './resolver';
import { ProtocolRegistry } from '../protocols';

export class TransactionBuilder {
  
  static async buildTransaction(intent: BuildIntent): Promise<BuildResponse> {
    try {
      const network = intent.network || RPCConnection.getDefaultNetwork();
      const payer = AccountResolver.resolvePublicKey(intent.payer);
      
      // Get protocol handler
      const handler = ProtocolRegistry.getHandler(intent.intent);
      if (!handler) {
        throw new Error(`Unsupported intent: ${intent.intent}`);
      }

      // Validate parameters
      if (!handler.validateParams(intent.params)) {
        throw new Error(`Invalid parameters for ${intent.intent}`);
      }

      // Build instructions from protocol handler
      const instructions = await handler.build(intent);
      
      // Create transaction
      const transaction = new Transaction();
      
      // Add compute budget instruction if specified
      const computeBudget = intent.computeBudget || 200000;
      transaction.add(
        ComputeBudgetProgram.setComputeUnitLimit({
          units: computeBudget
        })
      );

      // Add priority fee if specified or estimated
      let priorityFee = intent.priorityFee;
      if (priorityFee === undefined) {
        priorityFee = await TransactionSimulator.estimatePriorityFee(network);
      }
      
      if (priorityFee > 0) {
        transaction.add(
          ComputeBudgetProgram.setComputeUnitPrice({
            microLamports: priorityFee
          })
        );
      }

      // Add protocol instructions
      transaction.add(...instructions);

      // Set recent blockhash
      const connection = RPCConnection.getConnection(network);
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = payer;

      // Simulate transaction
      const simulation = await TransactionSimulator.simulateTransaction(
        transaction,
        payer,
        network
      );

      if (!simulation.success) {
        return {
          success: false,
          error: simulation.error,
          simulation
        };
      }

      // Serialize transaction
      const serializedTransaction = transaction.serialize({ 
        requireAllSignatures: false,
        verifySignatures: false
      }).toString('base64');

      // Gather transaction details
      const details = {
        protocol: handler.name,
        instructions: transaction.instructions.length,
        accounts: this.getUniqueAccounts(transaction.instructions),
        estimatedFee: `${(simulation.unitsConsumed * (priorityFee / 1000000) / LAMPORTS_PER_SOL).toFixed(6)} SOL`,
        computeUnits: simulation.unitsConsumed,
        priorityFee: priorityFee
      };

      return {
        success: true,
        transaction: serializedTransaction,
        simulation,
        details
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  private static getUniqueAccounts(instructions: TransactionInstruction[]): string[] {
    const accounts = new Set<string>();
    
    for (const instruction of instructions) {
      for (const key of instruction.keys) {
        accounts.add(key.pubkey.toString());
      }
    }
    
    return Array.from(accounts);
  }

  static async estimateTransactionFee(
    instructions: TransactionInstruction[],
    payer: PublicKey,
    network: 'mainnet' | 'devnet' = 'devnet'
  ): Promise<number> {
    try {
      const transaction = new Transaction();
      transaction.add(...instructions);
      
      const connection = RPCConnection.getConnection(network);
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = payer;

      const fee = await connection.getFeeForMessage(transaction.compileMessage());
      return fee?.value || 5000; // fallback to 5000 lamports
    } catch {
      return 5000; // fallback fee
    }
  }
}