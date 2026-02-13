import { TransactionInstruction, PublicKey } from '@solana/web3.js';
import { BuildIntent, ProtocolHandler } from '../utils/types';
import { AccountResolver } from '../engine/resolver';
import { resolveMint } from '../utils/connection';
import { Buffer } from 'buffer';

interface OrcaSwapParams {
  amount: bigint;
  otherAmountThreshold: bigint;
  sqrtPriceLimit: bigint;
  amountSpecifiedIsInput: boolean;
  aToB: boolean;
}

interface OrcaPositionParams {
  tickLowerIndex: number;
  tickUpperIndex: number;
  liquidity: bigint;
}

export class OrcaProtocol implements ProtocolHandler {
  name = 'orca';
  description = 'Orca Whirlpool concentrated liquidity DEX';
  supportedIntents = ['swap', 'open-position', 'close-position', 'add-liquidity', 'remove-liquidity', 'orca-swap'];

  readonly PROGRAM_ID = new PublicKey('whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc');
  readonly SWAP_DISCRIMINATOR = Buffer.from([248, 198, 158, 145, 225, 117, 135, 200]);
  readonly OPEN_POSITION_DISCRIMINATOR = Buffer.from([135, 128, 47, 77, 15, 152, 240, 49]);
  readonly CLOSE_POSITION_DISCRIMINATOR = Buffer.from([123, 134, 81, 0, 49, 68, 98, 98]);

  async build(intent: BuildIntent): Promise<TransactionInstruction[]> {
    const { params } = intent;
    const action = intent.intent;

    switch (action) {
      case 'swap':
      case 'orca-swap':
        return this.buildSwap(params, intent);
        
      case 'open-position':
        return this.buildOpenPosition(params, intent);
        
      case 'close-position':
        return this.buildClosePosition(params, intent);
        
      case 'add-liquidity':
        return this.buildAddLiquidity(params, intent);
        
      case 'remove-liquidity':
        return this.buildRemoveLiquidity(params, intent);
        
      default:
        throw new Error(`Unsupported Orca action: ${action}`);
    }
  }

  validateParams(params: Record<string, any>): boolean {
    if (params.action === 'swap') {
      return (
        typeof params.amount === 'number' &&
        params.amount > 0 &&
        typeof params.from === 'string' &&
        typeof params.to === 'string'
      );
    }

    if (params.action === 'open-position') {
      return (
        typeof params.tokenA === 'string' &&
        typeof params.tokenB === 'string' &&
        typeof params.tickLower === 'number' &&
        typeof params.tickUpper === 'number'
      );
    }

    if (params.action === 'close-position') {
      return typeof params.position === 'string';
    }

    // Direct intent validation for swap
    if (typeof params.amount === 'number' && params.from && params.to) {
      return true;
    }

    return false;
  }

  private async buildSwap(
    params: Record<string, any>,
    intent: BuildIntent
  ): Promise<TransactionInstruction[]> {
    const payer = AccountResolver.resolvePublicKey(intent.payer);
    const inputMint = AccountResolver.resolvePublicKey(resolveMint(params.from));
    const outputMint = AccountResolver.resolvePublicKey(resolveMint(params.to));
    
    const amount = params.amount;
    const slippage = params.slippage || 0.5; // Default 0.5%
    
    // Calculate amounts with decimals
    const inputDecimals = await this.getTokenDecimals(inputMint.toString());
    const swapAmount = BigInt(Math.floor(amount * Math.pow(10, inputDecimals)));
    const slippageTolerance = BigInt(Math.floor(Number(swapAmount) * slippage / 100));
    const otherAmountThreshold = swapAmount - slippageTolerance;
    
    // Determine swap direction (A to B or B to A)
    // This would be determined by the actual pool configuration
    const aToB = true; // Simplified - would need pool data
    
    // Sqrt price limit (128-bit value) - would be calculated from pool data
    const sqrtPriceLimit = BigInt('79228162514264337593543950336'); // Example value

    const data = Buffer.concat([
      this.SWAP_DISCRIMINATOR,
      this.encodeSwapParams({
        amount: swapAmount,
        otherAmountThreshold,
        sqrtPriceLimit,
        amountSpecifiedIsInput: true,
        aToB
      })
    ]);

    return [
      new TransactionInstruction({
        keys: [
          // Required accounts for Orca Whirlpool swap:
          // { pubkey: tokenProgram, isSigner: false, isWritable: false },
          // { pubkey: tokenAuthority, isSigner: true, isWritable: false },
          // { pubkey: whirlpool, isSigner: false, isWritable: true },
          // { pubkey: tokenOwnerAccountA, isSigner: false, isWritable: true },
          // { pubkey: tokenVaultA, isSigner: false, isWritable: true },
          // { pubkey: tokenOwnerAccountB, isSigner: false, isWritable: true },
          // { pubkey: tokenVaultB, isSigner: false, isWritable: true },
          // { pubkey: tickArray0, isSigner: false, isWritable: true },
          // { pubkey: tickArray1, isSigner: false, isWritable: true },
          // { pubkey: tickArray2, isSigner: false, isWritable: true },
          // { pubkey: oracle, isSigner: false, isWritable: false }
          
          // Placeholder - real implementation needs whirlpool accounts
          { pubkey: payer, isSigner: true, isWritable: false },
          { pubkey: inputMint, isSigner: false, isWritable: false },
          { pubkey: outputMint, isSigner: false, isWritable: false }
        ],
        programId: this.PROGRAM_ID,
        data
      })
    ];
  }

  private async buildOpenPosition(
    params: Record<string, any>,
    intent: BuildIntent
  ): Promise<TransactionInstruction[]> {
    const payer = AccountResolver.resolvePublicKey(intent.payer);
    const tokenA = AccountResolver.resolvePublicKey(resolveMint(params.tokenA));
    const tokenB = AccountResolver.resolvePublicKey(resolveMint(params.tokenB));
    
    const tickLower = params.tickLower || -443636;
    const tickUpper = params.tickUpper || 443636;
    
    const data = Buffer.concat([
      this.OPEN_POSITION_DISCRIMINATOR,
      this.encodePositionParams({
        tickLowerIndex: tickLower,
        tickUpperIndex: tickUpper,
        liquidity: BigInt(0) // Would be calculated based on deposit amounts
      })
    ]);

    return [
      new TransactionInstruction({
        keys: [
          // Required accounts for opening position:
          // { pubkey: funder, isSigner: true, isWritable: true },
          // { pubkey: owner, isSigner: false, isWritable: false },
          // { pubkey: position, isSigner: false, isWritable: true },
          // { pubkey: positionMint, isSigner: true, isWritable: true },
          // { pubkey: positionTokenAccount, isSigner: false, isWritable: true },
          // { pubkey: whirlpool, isSigner: false, isWritable: false },
          // { pubkey: tokenProgram, isSigner: false, isWritable: false },
          // { pubkey: systemProgram, isSigner: false, isWritable: false },
          // { pubkey: rent, isSigner: false, isWritable: false },
          // { pubkey: associatedTokenProgram, isSigner: false, isWritable: false }
          
          { pubkey: payer, isSigner: true, isWritable: true },
          { pubkey: tokenA, isSigner: false, isWritable: false },
          { pubkey: tokenB, isSigner: false, isWritable: false }
        ],
        programId: this.PROGRAM_ID,
        data
      })
    ];
  }

  private async buildClosePosition(
    params: Record<string, any>,
    intent: BuildIntent
  ): Promise<TransactionInstruction[]> {
    const payer = AccountResolver.resolvePublicKey(intent.payer);
    const position = AccountResolver.resolvePublicKey(params.position);

    const data = this.CLOSE_POSITION_DISCRIMINATOR;

    return [
      new TransactionInstruction({
        keys: [
          // Required accounts for closing position:
          // { pubkey: positionAuthority, isSigner: true, isWritable: false },
          // { pubkey: receiver, isSigner: false, isWritable: true },
          // { pubkey: position, isSigner: false, isWritable: true },
          // { pubkey: positionMint, isSigner: false, isWritable: true },
          // { pubkey: positionTokenAccount, isSigner: false, isWritable: true },
          // { pubkey: tokenProgram, isSigner: false, isWritable: false }
          
          { pubkey: payer, isSigner: true, isWritable: false },
          { pubkey: position, isSigner: false, isWritable: true }
        ],
        programId: this.PROGRAM_ID,
        data
      })
    ];
  }

  private async buildAddLiquidity(
    params: Record<string, any>,
    intent: BuildIntent
  ): Promise<TransactionInstruction[]> {
    // Add liquidity is typically done through increaseLiquidity instruction
    // This would require position management and liquidity calculations
    throw new Error('Add liquidity not yet implemented - use Orca SDK for complex liquidity operations');
  }

  private async buildRemoveLiquidity(
    params: Record<string, any>,
    intent: BuildIntent
  ): Promise<TransactionInstruction[]> {
    // Remove liquidity is typically done through decreaseLiquidity instruction
    // This would require position management and liquidity calculations
    throw new Error('Remove liquidity not yet implemented - use Orca SDK for complex liquidity operations');
  }

  private encodeSwapParams(params: OrcaSwapParams): Buffer {
    const buffer = Buffer.alloc(34); // 8 + 8 + 16 + 1 + 1
    let offset = 0;
    
    // amount (8 bytes)
    buffer.writeBigUInt64LE(params.amount, offset);
    offset += 8;
    
    // otherAmountThreshold (8 bytes)
    buffer.writeBigUInt64LE(params.otherAmountThreshold, offset);
    offset += 8;
    
    // sqrtPriceLimit (16 bytes) - simplified, real implementation needs proper 128-bit encoding
    buffer.writeBigUInt64LE(params.sqrtPriceLimit & BigInt('0xFFFFFFFFFFFFFFFF'), offset);
    offset += 8;
    buffer.writeBigUInt64LE(params.sqrtPriceLimit >> BigInt(64), offset);
    offset += 8;
    
    // amountSpecifiedIsInput (1 byte)
    buffer.writeUInt8(params.amountSpecifiedIsInput ? 1 : 0, offset);
    offset += 1;
    
    // aToB (1 byte)
    buffer.writeUInt8(params.aToB ? 1 : 0, offset);
    
    return buffer;
  }

  private encodePositionParams(params: OrcaPositionParams): Buffer {
    const buffer = Buffer.alloc(16); // 4 + 4 + 8
    let offset = 0;
    
    // tickLowerIndex (4 bytes, signed)
    buffer.writeInt32LE(params.tickLowerIndex, offset);
    offset += 4;
    
    // tickUpperIndex (4 bytes, signed)
    buffer.writeInt32LE(params.tickUpperIndex, offset);
    offset += 4;
    
    // liquidity (8 bytes)
    buffer.writeBigUInt64LE(params.liquidity, offset);
    
    return buffer;
  }

  private async getTokenDecimals(mint: string): Promise<number> {
    // Known decimals for common tokens
    const knownDecimals: Record<string, number> = {
      'So11111111111111111111111111111111111111112': 9, // SOL
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 6, // USDC
      'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 6, // USDT
      'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE': 6, // ORCA
    };

    return knownDecimals[mint] || 6; // Default to 6 decimals
  }

  getRequiredAccounts(params: Record<string, any>): PublicKey[] {
    const accounts: PublicKey[] = [];
    
    if (params.from) {
      accounts.push(AccountResolver.resolvePublicKey(resolveMint(params.from)));
    }
    
    if (params.to) {
      accounts.push(AccountResolver.resolvePublicKey(resolveMint(params.to)));
    }

    if (params.tokenA) {
      accounts.push(AccountResolver.resolvePublicKey(resolveMint(params.tokenA)));
    }

    if (params.tokenB) {
      accounts.push(AccountResolver.resolvePublicKey(resolveMint(params.tokenB)));
    }

    if (params.position) {
      accounts.push(AccountResolver.resolvePublicKey(params.position));
    }

    return accounts;
  }

  // Note: For production use, you would typically use Orca's SDK to:
  // 1. Get whirlpool and pool data
  // 2. Calculate proper tick arrays and account addresses
  // 3. Handle complex liquidity math for positions
  // 4. Manage position NFTs and liquidity tokens
}