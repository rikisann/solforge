import { TransactionInstruction, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { BuildIntent, ProtocolHandler } from '../utils/types';
import { AccountResolver } from '../engine/resolver';
import { Buffer } from 'buffer';

interface MarinadeDepositParams {
  lamports: bigint;
}

interface MarinadeUnstakeParams {
  msolAmount: bigint;
}

export class MarinadeProtocol implements ProtocolHandler {
  name = 'marinade';
  description = 'Marinade Finance liquid staking protocol';
  supportedIntents = ['stake', 'deposit', 'unstake', 'liquid-unstake', 'marinade-stake', 'marinade-unstake'];

  readonly PROGRAM_ID = new PublicKey('MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD');
  readonly MSOL_MINT = new PublicKey('mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So');
  
  // Instruction discriminators
  readonly DEPOSIT_DISCRIMINATOR = Buffer.from([242, 35, 198, 137, 82, 225, 242, 182]);
  readonly LIQUID_UNSTAKE_DISCRIMINATOR = Buffer.from([119, 191, 254, 152, 65, 132, 154, 207]);

  // Known marinade accounts (these would be fetched dynamically in production)
  readonly STATE = new PublicKey('8szGkuLTAux9XMgZ2vtY39jVSowEcpBfFfD8hXSEqdGC');
  readonly MSOL_MINT_AUTHORITY = new PublicKey('3JLPCS1qM2zRw3Dp6V4hZnYHd4toMNPkNesXdX9tg6KM');

  async build(intent: BuildIntent): Promise<TransactionInstruction[]> {
    const { params } = intent;
    const action = intent.intent;

    switch (action) {
      case 'stake':
      case 'deposit':
      case 'marinade-stake':
        return this.buildDeposit(params, intent);
        
      case 'unstake':
      case 'liquid-unstake':
      case 'marinade-unstake':
        return this.buildLiquidUnstake(params, intent);
        
      default:
        throw new Error(`Unsupported Marinade action: ${action}`);
    }
  }

  validateParams(params: Record<string, any>): boolean {
    if (params.action === 'stake' || params.action === 'deposit') {
      return (
        typeof params.amount === 'number' &&
        params.amount > 0
      );
    }

    if (params.action === 'unstake' || params.action === 'liquid-unstake') {
      return (
        typeof params.amount === 'number' &&
        params.amount > 0
      );
    }

    // Direct intent validation
    if (typeof params.amount === 'number' && params.amount > 0) {
      return true;
    }

    return false;
  }

  private async buildDeposit(
    params: Record<string, any>,
    intent: BuildIntent
  ): Promise<TransactionInstruction[]> {
    const payer = AccountResolver.resolvePublicKey(intent.payer);
    const amount = params.amount;
    
    // Convert SOL to lamports
    const lamports = BigInt(Math.floor(amount * LAMPORTS_PER_SOL));

    if (lamports <= 0) {
      throw new Error('Deposit amount must be positive');
    }

    const data = Buffer.concat([
      this.DEPOSIT_DISCRIMINATOR,
      this.encodeDepositParams({ lamports })
    ]);

    return [
      new TransactionInstruction({
        keys: [
          // Required accounts for Marinade deposit:
          // { pubkey: state, isSigner: false, isWritable: false },
          // { pubkey: msolMint, isSigner: false, isWritable: true },
          // { pubkey: liqPoolSolLegPda, isSigner: false, isWritable: true },
          // { pubkey: liqPoolMsolLeg, isSigner: false, isWritable: true },
          // { pubkey: liqPoolMsolLegAuthority, isSigner: false, isWritable: false },
          // { pubkey: reservePda, isSigner: false, isWritable: true },
          // { pubkey: transferFrom, isSigner: true, isWritable: true },
          // { pubkey: mintTo, isSigner: false, isWritable: true },
          // { pubkey: msolMintAuthority, isSigner: false, isWritable: false },
          // { pubkey: systemProgram, isSigner: false, isWritable: false },
          // { pubkey: tokenProgram, isSigner: false, isWritable: false }
          
          { pubkey: this.STATE, isSigner: false, isWritable: false },
          { pubkey: this.MSOL_MINT, isSigner: false, isWritable: true },
          { pubkey: payer, isSigner: true, isWritable: true },
          { pubkey: this.MSOL_MINT_AUTHORITY, isSigner: false, isWritable: false }
        ],
        programId: this.PROGRAM_ID,
        data
      })
    ];
  }

  private async buildLiquidUnstake(
    params: Record<string, any>,
    intent: BuildIntent
  ): Promise<TransactionInstruction[]> {
    const payer = AccountResolver.resolvePublicKey(intent.payer);
    const amount = params.amount;
    
    // Convert mSOL amount to proper units (9 decimals)
    const msolAmount = BigInt(Math.floor(amount * Math.pow(10, 9)));

    if (msolAmount <= 0) {
      throw new Error('Unstake amount must be positive');
    }

    const data = Buffer.concat([
      this.LIQUID_UNSTAKE_DISCRIMINATOR,
      this.encodeUnstakeParams({ msolAmount })
    ]);

    return [
      new TransactionInstruction({
        keys: [
          // Required accounts for Marinade liquid unstake:
          // { pubkey: state, isSigner: false, isWritable: false },
          // { pubkey: msolMint, isSigner: false, isWritable: true },
          // { pubkey: liqPoolSolLegPda, isSigner: false, isWritable: true },
          // { pubkey: liqPoolMsolLeg, isSigner: false, isWritable: true },
          // { pubkey: treasuryMsolAccount, isSigner: false, isWritable: true },
          // { pubkey: getBurnFrom, isSigner: false, isWritable: true },
          // { pubkey: transferSolTo, isSigner: false, isWritable: true },
          // { pubkey: systemProgram, isSigner: false, isWritable: false },
          // { pubkey: tokenProgram, isSigner: false, isWritable: false }
          
          { pubkey: this.STATE, isSigner: false, isWritable: false },
          { pubkey: this.MSOL_MINT, isSigner: false, isWritable: true },
          { pubkey: payer, isSigner: true, isWritable: true }
        ],
        programId: this.PROGRAM_ID,
        data
      })
    ];
  }

  private encodeDepositParams(params: MarinadeDepositParams): Buffer {
    const buffer = Buffer.alloc(8);
    
    // Encode lamports (8 bytes, little endian)
    buffer.writeBigUInt64LE(params.lamports, 0);
    
    return buffer;
  }

  private encodeUnstakeParams(params: MarinadeUnstakeParams): Buffer {
    const buffer = Buffer.alloc(8);
    
    // Encode mSOL amount (8 bytes, little endian)
    buffer.writeBigUInt64LE(params.msolAmount, 0);
    
    return buffer;
  }

  getRequiredAccounts(params: Record<string, any>): PublicKey[] {
    const accounts: PublicKey[] = [
      this.STATE,
      this.MSOL_MINT
    ];

    return accounts;
  }

  // Helper method to get current exchange rate
  async getExchangeRate(): Promise<{ msolPrice: number; solValue: number }> {
    // In a real implementation, this would fetch from Marinade's state account
    // For now, return approximate values
    return {
      msolPrice: 1.05, // 1 mSOL ≈ 1.05 SOL (example)
      solValue: 0.95   // 1 SOL ≈ 0.95 mSOL (example)
    };
  }

  // Helper method to calculate expected mSOL from SOL deposit
  async calculateDepositReturn(solAmount: number): Promise<number> {
    const rate = await this.getExchangeRate();
    return solAmount * rate.solValue;
  }

  // Helper method to calculate expected SOL from mSOL unstake
  async calculateUnstakeReturn(msolAmount: number): Promise<number> {
    const rate = await this.getExchangeRate();
    return msolAmount * rate.msolPrice;
  }

  // Note: For production use, you would typically:
  // 1. Fetch current Marinade state to get accurate exchange rates
  // 2. Get all required account addresses from the state
  // 3. Handle liquidity pool interactions properly
  // 4. Consider delayed unstake vs liquid unstake trade-offs
}