import { TransactionInstruction, PublicKey } from '@solana/web3.js';
import { BuildIntent, ProtocolHandler } from '../utils/types';
import { AccountResolver } from '../engine/resolver';
import { resolveMint } from '../utils/connection';
import { Buffer } from 'buffer';

interface Token2022TransferParams {
  amount: bigint;
}

interface Token2022AccountParams {
  mint: PublicKey;
  owner: PublicKey;
}

export class Token2022Protocol implements ProtocolHandler {
  name = 'token2022';
  description = 'Token-2022 program for enhanced token operations';
  supportedIntents = ['transfer', 'send', 'create-account', 'close-account', 'token2022-transfer'];

  readonly PROGRAM_ID = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');
  
  // Instruction discriminators (same as SPL Token but with different program ID)
  readonly TRANSFER_DISCRIMINATOR = Buffer.from([3]); // TransferInstruction = 3
  readonly CREATE_ACCOUNT_DISCRIMINATOR = Buffer.from([1]); // InitializeAccountInstruction = 1
  readonly CLOSE_ACCOUNT_DISCRIMINATOR = Buffer.from([9]); // CloseAccountInstruction = 9

  async build(intent: BuildIntent): Promise<TransactionInstruction[]> {
    const { params } = intent;
    const action = intent.intent;

    switch (action) {
      case 'transfer':
      case 'send':
      case 'token2022-transfer':
        return this.buildTransfer(params, intent);
        
      case 'create-account':
        return this.buildCreateAccount(params, intent);
        
      case 'close-account':
        return this.buildCloseAccount(params, intent);
        
      default:
        throw new Error(`Unsupported Token-2022 action: ${action}`);
    }
  }

  validateParams(params: Record<string, any>): boolean {
    if (params.action === 'transfer' || params.action === 'send') {
      return (
        typeof params.amount === 'number' &&
        params.amount > 0 &&
        typeof params.to === 'string' &&
        typeof params.token === 'string'
      );
    }

    if (params.action === 'create-account') {
      return typeof params.token === 'string';
    }

    if (params.action === 'close-account') {
      return typeof params.account === 'string';
    }

    // Direct intent validation
    if (typeof params.amount === 'number' && params.to && params.token) {
      return true;
    }

    return false;
  }

  private async buildTransfer(
    params: Record<string, any>,
    intent: BuildIntent
  ): Promise<TransactionInstruction[]> {
    const payer = AccountResolver.resolvePublicKey(intent.payer);
    const recipient = AccountResolver.resolvePublicKey(params.to);
    const mintAddress = AccountResolver.resolvePublicKey(resolveMint(params.token));
    
    const amount = params.amount;
    
    // Get token decimals
    const decimals = await this.getTokenDecimals(mintAddress.toString());
    const adjustedAmount = BigInt(Math.floor(amount * Math.pow(10, decimals)));

    if (adjustedAmount <= 0n) {
      throw new Error('Transfer amount must be positive');
    }

    // Find source and destination token accounts
    const [sourceAccount] = AccountResolver.findProgramAddress(
      [payer.toBuffer(), this.PROGRAM_ID.toBuffer(), mintAddress.toBuffer()],
      AccountResolver.resolvePublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL') // Associated Token Program
    );

    const [destinationAccount] = AccountResolver.findProgramAddress(
      [recipient.toBuffer(), this.PROGRAM_ID.toBuffer(), mintAddress.toBuffer()],
      AccountResolver.resolvePublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL')
    );

    const instructions: TransactionInstruction[] = [];

    // Check if destination account exists, create if not
    const network = intent.network || 'devnet';
    const destinationExists = await AccountResolver.accountExists(destinationAccount, network);

    if (!destinationExists) {
      // Create associated token account for recipient
      instructions.push(
        new TransactionInstruction({
          keys: [
            { pubkey: payer, isSigner: true, isWritable: true },
            { pubkey: destinationAccount, isSigner: false, isWritable: true },
            { pubkey: recipient, isSigner: false, isWritable: false },
            { pubkey: mintAddress, isSigner: false, isWritable: false },
            { pubkey: AccountResolver.resolvePublicKey('11111111111111111111111111111112'), isSigner: false, isWritable: false }, // System Program
            { pubkey: this.PROGRAM_ID, isSigner: false, isWritable: false },
          ],
          programId: AccountResolver.resolvePublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'),
          data: Buffer.alloc(0)
        })
      );
    }

    // Build transfer instruction
    const data = Buffer.concat([
      this.TRANSFER_DISCRIMINATOR,
      this.encodeTransferParams({ amount: adjustedAmount })
    ]);

    instructions.push(
      new TransactionInstruction({
        keys: [
          { pubkey: sourceAccount, isSigner: false, isWritable: true },
          { pubkey: destinationAccount, isSigner: false, isWritable: true },
          { pubkey: payer, isSigner: true, isWritable: false }
        ],
        programId: this.PROGRAM_ID,
        data
      })
    );

    return instructions;
  }

  private async buildCreateAccount(
    params: Record<string, any>,
    intent: BuildIntent
  ): Promise<TransactionInstruction[]> {
    const payer = AccountResolver.resolvePublicKey(intent.payer);
    const mintAddress = AccountResolver.resolvePublicKey(resolveMint(params.token));
    const owner = params.owner ? AccountResolver.resolvePublicKey(params.owner) : payer;

    // Generate associated token account address
    const [associatedTokenAccount] = AccountResolver.findProgramAddress(
      [owner.toBuffer(), this.PROGRAM_ID.toBuffer(), mintAddress.toBuffer()],
      AccountResolver.resolvePublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL')
    );

    // Create associated token account
    return [
      new TransactionInstruction({
        keys: [
          { pubkey: payer, isSigner: true, isWritable: true },
          { pubkey: associatedTokenAccount, isSigner: false, isWritable: true },
          { pubkey: owner, isSigner: false, isWritable: false },
          { pubkey: mintAddress, isSigner: false, isWritable: false },
          { pubkey: AccountResolver.resolvePublicKey('11111111111111111111111111111112'), isSigner: false, isWritable: false },
          { pubkey: this.PROGRAM_ID, isSigner: false, isWritable: false },
        ],
        programId: AccountResolver.resolvePublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'),
        data: Buffer.alloc(0)
      })
    ];
  }

  private async buildCloseAccount(
    params: Record<string, any>,
    intent: BuildIntent
  ): Promise<TransactionInstruction[]> {
    const payer = AccountResolver.resolvePublicKey(intent.payer);
    const accountToClose = AccountResolver.resolvePublicKey(params.account);
    const destination = params.destination ? AccountResolver.resolvePublicKey(params.destination) : payer;

    const data = this.CLOSE_ACCOUNT_DISCRIMINATOR;

    return [
      new TransactionInstruction({
        keys: [
          { pubkey: accountToClose, isSigner: false, isWritable: true },
          { pubkey: destination, isSigner: false, isWritable: true },
          { pubkey: payer, isSigner: true, isWritable: false }
        ],
        programId: this.PROGRAM_ID,
        data
      })
    ];
  }

  private encodeTransferParams(params: Token2022TransferParams): Buffer {
    const buffer = Buffer.alloc(8);
    
    // Encode amount (8 bytes, little endian)
    buffer.writeBigUInt64LE(params.amount, 0);
    
    return buffer;
  }

  private async getTokenDecimals(mint: string): Promise<number> {
    // Known decimals for common Token-2022 tokens
    const knownDecimals: Record<string, number> = {
      // Add known Token-2022 mints here
    };

    return knownDecimals[mint] || 6; // Default to 6 decimals
  }

  getRequiredAccounts(params: Record<string, any>): PublicKey[] {
    const accounts: PublicKey[] = [];
    
    if (params.to) {
      accounts.push(AccountResolver.resolvePublicKey(params.to));
    }
    
    if (params.token) {
      accounts.push(AccountResolver.resolvePublicKey(resolveMint(params.token)));
    }

    if (params.account) {
      accounts.push(AccountResolver.resolvePublicKey(params.account));
    }

    if (params.owner) {
      accounts.push(AccountResolver.resolvePublicKey(params.owner));
    }

    return accounts;
  }

  // Enhanced features specific to Token-2022
  async buildTransferWithHook(
    params: Record<string, any>,
    intent: BuildIntent
  ): Promise<TransactionInstruction[]> {
    // Transfer with transfer hook - enhanced feature of Token-2022
    // This would handle tokens with transfer hooks enabled
    throw new Error('Transfer with hook not yet implemented');
  }

  async buildMintToWithMetadata(
    params: Record<string, any>,
    intent: BuildIntent
  ): Promise<TransactionInstruction[]> {
    // Mint tokens with metadata - enhanced feature of Token-2022
    // This would handle minting tokens with embedded metadata
    throw new Error('Mint with metadata not yet implemented');
  }

  async buildCreateMintWithExtensions(
    params: Record<string, any>,
    intent: BuildIntent
  ): Promise<TransactionInstruction[]> {
    // Create mint with extensions - enhanced feature of Token-2022
    // This would handle creating mints with various extensions like:
    // - Transfer fees
    // - Interest bearing tokens
    // - Non-transferable tokens
    // - etc.
    throw new Error('Create mint with extensions not yet implemented');
  }

  // Note: Token-2022 provides many enhanced features over SPL Token:
  // 1. Transfer hooks
  // 2. Confidential transfers
  // 3. Transfer fees
  // 4. Interest bearing tokens
  // 5. Non-transferable tokens
  // 6. Permanent delegate
  // 7. Reallocate
  // 8. Metadata pointer
  // 9. Group pointer and member
  // 10. Default account state
}