import { Transaction, VersionedTransaction, PublicKey } from '@solana/web3.js';
import { DecodeResponse, DecodedTransaction, DecodedInstruction } from '../utils/types';
import { ProtocolRegistry } from '../protocols';

// Known program IDs and their descriptions
const KNOWN_PROGRAMS: Record<string, { name: string; description: string }> = {
  '11111111111111111111111111111112': {
    name: 'System Program',
    description: 'Native Solana operations'
  },
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA': {
    name: 'SPL Token Program',
    description: 'Token operations'
  },
  'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4': {
    name: 'Jupiter Aggregator',
    description: 'Token swaps'
  },
  'ComputeBudget111111111111111111111111111111': {
    name: 'Compute Budget Program',
    description: 'Compute unit and priority fee management'
  },
  'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr': {
    name: 'Memo Program',
    description: 'On-chain memos'
  },
  'Jito4APyf642JPZPx3hGc6WWJ8zPKtRbRs4P815Awbb': {
    name: 'Jito Tips',
    description: 'MEV tips'
  },
  'StakeConfig11111111111111111111111111111111': {
    name: 'Stake Program',
    description: 'Staking operations'
  },
  'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb': {
    name: 'Token 2022 Program',
    description: 'Enhanced token operations'
  }
};

export class TransactionDecoder {
  static async decodeTransaction(transactionData: string): Promise<DecodeResponse> {
    try {
      // Try to parse as both legacy and versioned transaction
      let transaction: Transaction | VersionedTransaction;
      let decodedInstructions: DecodedInstruction[] = [];
      let accounts: string[] = [];
      let feePayer: string | undefined;
      let recentBlockhash: string | undefined;

      const buffer = Buffer.from(transactionData, 'base64');

      try {
        // First try as a legacy transaction
        transaction = Transaction.from(buffer);
        
        // Extract transaction details
        feePayer = transaction.feePayer?.toString();
        recentBlockhash = transaction.recentBlockhash || undefined;
        
        // Decode instructions
        for (let i = 0; i < transaction.instructions.length; i++) {
          const instruction = transaction.instructions[i];
          const decodedInstruction = await this.decodeInstruction(instruction, i);
          decodedInstructions.push(decodedInstruction);
        }

        // Get unique accounts
        accounts = this.extractAccounts(transaction.instructions);

      } catch {
        try {
          // Try as a versioned transaction
          transaction = VersionedTransaction.deserialize(buffer);
          
          const message = transaction.message;
          feePayer = message.staticAccountKeys[0]?.toString();
          
          // Decode versioned transaction instructions
          for (let i = 0; i < message.compiledInstructions.length; i++) {
            const compiledIx = message.compiledInstructions[i];
            
            // Reconstruct instruction from compiled data
            const programId = message.staticAccountKeys[compiledIx.programIdIndex];
            const instructionAccounts = compiledIx.accountKeyIndexes.map(index => ({
              pubkey: message.staticAccountKeys[index].toString(),
              isSigner: false, // Would need to check against signers
              isWritable: false // Would need more complex logic
            }));

            const decodedInstruction: DecodedInstruction = {
              programId: programId.toString(),
              accounts: instructionAccounts,
              data: Buffer.from(compiledIx.data).toString('hex'),
              ...this.identifyProtocol(programId.toString())
            };

            decodedInstructions.push(decodedInstruction);
          }

          // Get unique accounts from static keys
          accounts = message.staticAccountKeys.map(key => key.toString());

        } catch {
          throw new Error('Unable to parse transaction data as either legacy or versioned transaction');
        }
      }

      return {
        success: true,
        decoded: {
          instructions: decodedInstructions,
          accounts,
          feePayer,
          recentBlockhash
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to decode transaction'
      };
    }
  }

  private static async decodeInstruction(
    instruction: any,
    index: number
  ): Promise<DecodedInstruction> {
    const programId = instruction.programId.toString();
    
    return {
      programId,
      accounts: instruction.keys.map((key: any) => ({
        pubkey: key.pubkey.toString(),
        isSigner: key.isSigner,
        isWritable: key.isWritable
      })),
      data: instruction.data ? Buffer.from(instruction.data).toString('hex') : '',
      ...this.identifyProtocol(programId)
    };
  }

  private static identifyProtocol(programId: string): { 
    protocol?: string; 
    protocolName?: string; 
    description?: string; 
  } {
    // Check known programs first
    const knownProgram = KNOWN_PROGRAMS[programId];
    if (knownProgram) {
      return {
        protocol: programId,
        protocolName: knownProgram.name,
        description: knownProgram.description
      };
    }

    // Try to find in registered protocols
    const allProtocols = ProtocolRegistry.getAllProtocols();
    for (const protocol of allProtocols) {
      // This would need to be enhanced based on how protocols store their program IDs
      // For now, we'll use basic matching
      if (protocol.name.toLowerCase().includes('jupiter') && this.isJupiterProgram(programId)) {
        return {
          protocol: 'jupiter',
          protocolName: 'Jupiter Aggregator',
          description: 'Token swap via Jupiter'
        };
      }
      
      if (protocol.name.toLowerCase().includes('raydium') && this.isRaydiumProgram(programId)) {
        return {
          protocol: 'raydium',
          protocolName: 'Raydium',
          description: 'Raydium AMM operation'
        };
      }
      
      // Add more protocol-specific checks as needed
    }

    return {
      protocolName: 'Unknown Program',
      description: `Program: ${programId}`
    };
  }

  private static extractAccounts(instructions: any[]): string[] {
    const accountSet = new Set<string>();
    
    for (const instruction of instructions) {
      accountSet.add(instruction.programId.toString());
      
      for (const key of instruction.keys) {
        accountSet.add(key.pubkey.toString());
      }
    }
    
    return Array.from(accountSet);
  }

  // Helper methods to identify specific protocols
  private static isJupiterProgram(programId: string): boolean {
    const jupiterPrograms = [
      'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',
      'JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB'
    ];
    return jupiterPrograms.includes(programId);
  }

  private static isRaydiumProgram(programId: string): boolean {
    const raydiumPrograms = [
      '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
      '5quBtoiQqxF9Jv6KYKctB59NT3gtJD2Y65kdnB1Uev3h'
    ];
    return raydiumPrograms.includes(programId);
  }
}