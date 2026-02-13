import { 
  Transaction, 
  TransactionInstruction, 
  PublicKey, 
  ComputeBudgetProgram,
  SystemProgram,
  LAMPORTS_PER_SOL
} from '@solana/web3.js';
import { BuildIntent, BuildResponse, ProtocolHandler, MultiBuildIntent, MultiBuildResponse } from '../utils/types';
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
        const suggestion = this.suggestSimilarProtocol(intent.intent);
        throw new Error(`Unsupported intent: "${intent.intent}". ${suggestion}`);
      }

      // Validate parameters
      if (!handler.validateParams(intent.params)) {
        const expectedParams = this.getExpectedParameters(handler.name, intent.intent);
        const receivedParams = Object.keys(intent.params);
        throw new Error(
          `Invalid parameters for "${intent.intent}". ` +
          `Expected: ${expectedParams.join(', ')}. ` +
          `Received: ${receivedParams.join(', ')}`
        );
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

      // Serialize transaction
      const serializedTransaction = transaction.serialize({ 
        requireAllSignatures: false,
        verifySignatures: false
      }).toString('base64');

      // Simulate transaction (unless skipped)
      let simulation: any = null;
      if (!intent.skipSimulation) {
        simulation = await TransactionSimulator.simulateTransaction(
          transaction,
          payer,
          network
        );

        if (!simulation.success) {
          const humanReadableError = this.parseSimulationError(simulation.error || 'Simulation failed');
          return {
            success: false,
            error: humanReadableError,
            simulation
          };
        }
      }

      // Gather transaction details
      const details = {
        protocol: handler.name,
        instructions: transaction.instructions.length,
        accounts: this.getUniqueAccounts(transaction.instructions),
        estimatedFee: simulation ? `${(simulation.unitsConsumed * (priorityFee / 1000000) / LAMPORTS_PER_SOL).toFixed(6)} SOL` : 'N/A (simulation skipped)',
        computeUnits: simulation?.unitsConsumed ?? 0,
        priorityFee: priorityFee
      };

      return {
        success: true,
        transaction: serializedTransaction,
        ...(simulation && { simulation }),
        details
      };

    } catch (error) {
      // Enhanced error context
      const enhancedError = this.enhanceErrorMessage(error, intent);
      return {
        success: false,
        error: enhancedError
      };
    }
  }

  static async buildMultiTransaction(multiIntent: MultiBuildIntent): Promise<MultiBuildResponse> {
    try {
      const network = multiIntent.network || RPCConnection.getDefaultNetwork();
      const payer = AccountResolver.resolvePublicKey(multiIntent.payer);
      
      // Track details for each intent
      const breakdown: Array<{
        intent: string;
        protocol: string;
        instructions: number;
      }> = [];
      
      const allInstructions: TransactionInstruction[] = [];
      const protocolsUsed = new Set<string>();
      
      // Process each intent and collect instructions
      for (const intent of multiIntent.intents) {
        try {
          // Get protocol handler
          const handler = ProtocolRegistry.getHandler(intent.intent);
          if (!handler) {
            const suggestion = this.suggestSimilarProtocol(intent.intent);
            throw new Error(`Unsupported intent: "${intent.intent}". ${suggestion}`);
          }

          // Validate parameters
          if (!handler.validateParams(intent.params)) {
            const expectedParams = this.getExpectedParameters(handler.name, intent.intent);
            const receivedParams = Object.keys(intent.params);
            throw new Error(
              `Invalid parameters for "${intent.intent}". ` +
              `Expected: ${expectedParams.join(', ')}. ` +
              `Received: ${receivedParams.join(', ')}`
            );
          }

          // Build instructions for this intent
          const instructions = await handler.build(intent);
          allInstructions.push(...instructions);
          
          protocolsUsed.add(handler.name);
          breakdown.push({
            intent: intent.intent,
            protocol: handler.name,
            instructions: instructions.length
          });

        } catch (error) {
          throw new Error(`Failed to process intent "${intent.intent}": ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
      
      // Create transaction with all instructions
      const transaction = new Transaction();
      
      // Add compute budget instruction if specified
      const computeBudget = multiIntent.computeBudget || 300000; // Higher default for multi-intent
      transaction.add(
        ComputeBudgetProgram.setComputeUnitLimit({
          units: computeBudget
        })
      );

      // Add priority fee if specified or estimated
      let priorityFee = multiIntent.priorityFee;
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

      // Add all protocol instructions
      transaction.add(...allInstructions);

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
        const humanReadableError = this.parseSimulationError(simulation.error || 'Simulation failed');
        return {
          success: false,
          error: humanReadableError,
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
        protocols: Array.from(protocolsUsed),
        totalInstructions: transaction.instructions.length,
        accounts: this.getUniqueAccounts(transaction.instructions),
        estimatedFee: `${(simulation.unitsConsumed * (priorityFee / 1000000) / LAMPORTS_PER_SOL).toFixed(6)} SOL`,
        intentsProcessed: multiIntent.intents.length,
        breakdown
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

  // Helper method to suggest similar protocols when intent is not found
  private static suggestSimilarProtocol(intent: string): string {
    const protocols = ProtocolRegistry.getAllProtocols();
    const allIntents = protocols.flatMap(p => p.supportedIntents);
    
    // Simple string similarity check
    const similar = allIntents.find(supportedIntent => 
      supportedIntent.includes(intent) || intent.includes(supportedIntent)
    );
    
    if (similar) {
      return `Did you mean "${similar}"?`;
    }
    
    return `Available intents: ${allIntents.slice(0, 5).join(', ')}${allIntents.length > 5 ? '...' : ''}`;
  }

  // Helper method to get expected parameters for a protocol intent
  private static getExpectedParameters(protocolName: string, intent: string): string[] {
    // This is a simplified version - in a real implementation, you'd want 
    // protocol handlers to expose their parameter schemas
    const commonParams: Record<string, string[]> = {
      'transfer': ['amount', 'to'],
      'swap': ['from', 'to', 'amount'],
      'stake': ['amount'],
      'memo': ['message'],
      'tip': ['amount'],
      'token-transfer': ['amount', 'token', 'to'],
      'create-ata': ['token']
    };
    
    return commonParams[intent] || ['amount'];
  }

  // Helper method to parse simulation errors into human-readable messages
  private static parseSimulationError(error: string): string {
    if (error.includes('insufficient funds')) {
      return 'Insufficient funds in the payer account';
    }
    if (error.includes('invalid account')) {
      return 'One or more accounts in the transaction are invalid';
    }
    if (error.includes('custom program error: 0x1')) {
      return 'Insufficient lamports for rent exemption';
    }
    if (error.includes('already in use')) {
      return 'Account is already in use';
    }
    if (error.includes('not rent exempt')) {
      return 'Account does not meet rent exemption requirements';
    }
    
    return `Transaction simulation failed: ${error}`;
  }

  // Helper method to enhance error messages with context
  private static enhanceErrorMessage(error: unknown, intent: BuildIntent): string {
    const baseError = error instanceof Error ? error.message : 'Unknown error occurred';
    
    // Add context about the intent that failed
    let context = `Failed to build transaction for intent "${intent.intent}"`;
    
    if (intent.params && Object.keys(intent.params).length > 0) {
      const paramSummary = Object.keys(intent.params).join(', ');
      context += ` with parameters: ${paramSummary}`;
    }
    
    if (intent.network) {
      context += ` on ${intent.network}`;
    }
    
    return `${context}. Error: ${baseError}`;
  }
}