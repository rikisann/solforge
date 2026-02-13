import { 
  TransactionInstruction, 
  PublicKey, 
  SystemProgram 
} from '@solana/web3.js';
import { 
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import { BuildIntent, ProtocolHandler } from '../utils/types';
import { AccountResolver } from '../engine/resolver';
import { resolveMint } from '../utils/connection';
import { Buffer } from 'buffer';

interface KaminoSupplyParams {
  amount: bigint;
}

interface KaminoBorrowParams {
  amount: bigint;
}

interface KaminoRepayParams {
  amount: bigint;
}

interface KaminoWithdrawParams {
  amount: bigint;
}

export class KaminoProtocol implements ProtocolHandler {
  name = 'kamino';
  description = 'Kamino lending protocol for supply, borrow, repay, and withdraw operations';
  supportedIntents = [
    'supply', 
    'deposit', 
    'lend', 
    'borrow', 
    'repay', 
    'withdraw',
    'kamino-supply',
    'kamino-deposit',
    'kamino-borrow',
    'kamino-repay',
    'kamino-withdraw'
  ];

  readonly PROGRAM_ID = new PublicKey('KLend2g3cP87ber8TAJASBTig4PDior61Ccqb6XK6X1');
  
  // Instruction discriminators (8-byte identifiers for each instruction)
  readonly SUPPLY_DISCRIMINATOR = Buffer.from([0, 0, 0, 0, 0, 0, 0, 1]);
  readonly BORROW_DISCRIMINATOR = Buffer.from([0, 0, 0, 0, 0, 0, 0, 2]);
  readonly REPAY_DISCRIMINATOR = Buffer.from([0, 0, 0, 0, 0, 0, 0, 3]);
  readonly WITHDRAW_DISCRIMINATOR = Buffer.from([0, 0, 0, 0, 0, 0, 0, 4]);

  async build(intent: BuildIntent): Promise<TransactionInstruction[]> {
    const { params } = intent;
    const action = intent.intent;

    switch (action) {
      case 'supply':
      case 'deposit':
      case 'lend':
      case 'kamino-supply':
      case 'kamino-deposit':
        return this.buildSupply(params, intent);
        
      case 'borrow':
      case 'kamino-borrow':
        return this.buildBorrow(params, intent);
        
      case 'repay':
      case 'kamino-repay':
        return this.buildRepay(params, intent);
        
      case 'withdraw':
      case 'kamino-withdraw':
        return this.buildWithdraw(params, intent);
        
      default:
        throw new Error(`Unsupported Kamino action: ${action}`);
    }
  }

  validateParams(params: Record<string, any>): boolean {
    // All actions require an amount and token
    if (typeof params.amount !== 'number' || params.amount <= 0) {
      return false;
    }
    
    if (!params.token || typeof params.token !== 'string') {
      return false;
    }

    return true;
  }

  private async buildSupply(
    params: Record<string, any>,
    intent: BuildIntent
  ): Promise<TransactionInstruction[]> {
    const payer = AccountResolver.resolvePublicKey(intent.payer);
    const amount = params.amount;
    const tokenMint = AccountResolver.resolvePublicKey(resolveMint(params.token));

    // Get decimals for the token to convert amount properly
    const decimals = await this.getTokenDecimals(tokenMint, intent.network || 'devnet');
    const adjustedAmount = BigInt(Math.floor(amount * Math.pow(10, decimals)));

    if (adjustedAmount <= 0n) {
      throw new Error('Supply amount must be positive');
    }

    // Generate PDAs for Kamino lending pool
    const [lendingMarket] = this.getLendingMarketAddress();
    const [reserve] = this.getReserveAddress(tokenMint, lendingMarket);
    const [collateralMint] = this.getCollateralMintAddress(reserve);

    // User's token account and collateral account
    const userTokenAccount = await getAssociatedTokenAddress(tokenMint, payer);
    const userCollateralAccount = await getAssociatedTokenAddress(collateralMint, payer);

    // Reserve token account (where the actual tokens go)
    const [reserveTokenAccount] = this.getReserveTokenAccountAddress(reserve);

    const data = Buffer.concat([
      this.SUPPLY_DISCRIMINATOR,
      this.encodeSupplyParams({ amount: adjustedAmount })
    ]);

    return [
      new TransactionInstruction({
        keys: [
          { pubkey: lendingMarket, isSigner: false, isWritable: false },
          { pubkey: reserve, isSigner: false, isWritable: true },
          { pubkey: userTokenAccount, isSigner: false, isWritable: true },
          { pubkey: userCollateralAccount, isSigner: false, isWritable: true },
          { pubkey: reserveTokenAccount, isSigner: false, isWritable: true },
          { pubkey: collateralMint, isSigner: false, isWritable: true },
          { pubkey: payer, isSigner: true, isWritable: false },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        ],
        programId: this.PROGRAM_ID,
        data
      })
    ];
  }

  private async buildBorrow(
    params: Record<string, any>,
    intent: BuildIntent
  ): Promise<TransactionInstruction[]> {
    const payer = AccountResolver.resolvePublicKey(intent.payer);
    const amount = params.amount;
    const tokenMint = AccountResolver.resolvePublicKey(resolveMint(params.token));

    const decimals = await this.getTokenDecimals(tokenMint, intent.network || 'devnet');
    const adjustedAmount = BigInt(Math.floor(amount * Math.pow(10, decimals)));

    if (adjustedAmount <= 0n) {
      throw new Error('Borrow amount must be positive');
    }

    const [lendingMarket] = this.getLendingMarketAddress();
    const [reserve] = this.getReserveAddress(tokenMint, lendingMarket);
    const [obligationAccount] = this.getObligationAddress(payer, lendingMarket);

    const userTokenAccount = await getAssociatedTokenAddress(tokenMint, payer);
    const [reserveTokenAccount] = this.getReserveTokenAccountAddress(reserve);

    const data = Buffer.concat([
      this.BORROW_DISCRIMINATOR,
      this.encodeBorrowParams({ amount: adjustedAmount })
    ]);

    return [
      new TransactionInstruction({
        keys: [
          { pubkey: lendingMarket, isSigner: false, isWritable: false },
          { pubkey: reserve, isSigner: false, isWritable: true },
          { pubkey: obligationAccount, isSigner: false, isWritable: true },
          { pubkey: userTokenAccount, isSigner: false, isWritable: true },
          { pubkey: reserveTokenAccount, isSigner: false, isWritable: true },
          { pubkey: payer, isSigner: true, isWritable: false },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        ],
        programId: this.PROGRAM_ID,
        data
      })
    ];
  }

  private async buildRepay(
    params: Record<string, any>,
    intent: BuildIntent
  ): Promise<TransactionInstruction[]> {
    const payer = AccountResolver.resolvePublicKey(intent.payer);
    const amount = params.amount;
    const tokenMint = AccountResolver.resolvePublicKey(resolveMint(params.token));

    const decimals = await this.getTokenDecimals(tokenMint, intent.network || 'devnet');
    const adjustedAmount = BigInt(Math.floor(amount * Math.pow(10, decimals)));

    if (adjustedAmount <= 0n) {
      throw new Error('Repay amount must be positive');
    }

    const [lendingMarket] = this.getLendingMarketAddress();
    const [reserve] = this.getReserveAddress(tokenMint, lendingMarket);
    const [obligationAccount] = this.getObligationAddress(payer, lendingMarket);

    const userTokenAccount = await getAssociatedTokenAddress(tokenMint, payer);
    const [reserveTokenAccount] = this.getReserveTokenAccountAddress(reserve);

    const data = Buffer.concat([
      this.REPAY_DISCRIMINATOR,
      this.encodeRepayParams({ amount: adjustedAmount })
    ]);

    return [
      new TransactionInstruction({
        keys: [
          { pubkey: lendingMarket, isSigner: false, isWritable: false },
          { pubkey: reserve, isSigner: false, isWritable: true },
          { pubkey: obligationAccount, isSigner: false, isWritable: true },
          { pubkey: userTokenAccount, isSigner: false, isWritable: true },
          { pubkey: reserveTokenAccount, isSigner: false, isWritable: true },
          { pubkey: payer, isSigner: true, isWritable: false },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        ],
        programId: this.PROGRAM_ID,
        data
      })
    ];
  }

  private async buildWithdraw(
    params: Record<string, any>,
    intent: BuildIntent
  ): Promise<TransactionInstruction[]> {
    const payer = AccountResolver.resolvePublicKey(intent.payer);
    const amount = params.amount;
    const tokenMint = AccountResolver.resolvePublicKey(resolveMint(params.token));

    const decimals = await this.getTokenDecimals(tokenMint, intent.network || 'devnet');
    const adjustedAmount = BigInt(Math.floor(amount * Math.pow(10, decimals)));

    if (adjustedAmount <= 0n) {
      throw new Error('Withdraw amount must be positive');
    }

    const [lendingMarket] = this.getLendingMarketAddress();
    const [reserve] = this.getReserveAddress(tokenMint, lendingMarket);
    const [collateralMint] = this.getCollateralMintAddress(reserve);

    const userTokenAccount = await getAssociatedTokenAddress(tokenMint, payer);
    const userCollateralAccount = await getAssociatedTokenAddress(collateralMint, payer);
    const [reserveTokenAccount] = this.getReserveTokenAccountAddress(reserve);

    const data = Buffer.concat([
      this.WITHDRAW_DISCRIMINATOR,
      this.encodeWithdrawParams({ amount: adjustedAmount })
    ]);

    return [
      new TransactionInstruction({
        keys: [
          { pubkey: lendingMarket, isSigner: false, isWritable: false },
          { pubkey: reserve, isSigner: false, isWritable: true },
          { pubkey: userTokenAccount, isSigner: false, isWritable: true },
          { pubkey: userCollateralAccount, isSigner: false, isWritable: true },
          { pubkey: reserveTokenAccount, isSigner: false, isWritable: true },
          { pubkey: collateralMint, isSigner: false, isWritable: true },
          { pubkey: payer, isSigner: true, isWritable: false },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        ],
        programId: this.PROGRAM_ID,
        data
      })
    ];
  }

  // Encoding methods for instruction data
  private encodeSupplyParams(params: KaminoSupplyParams): Buffer {
    const buffer = Buffer.alloc(8);
    buffer.writeBigUInt64LE(params.amount, 0);
    return buffer;
  }

  private encodeBorrowParams(params: KaminoBorrowParams): Buffer {
    const buffer = Buffer.alloc(8);
    buffer.writeBigUInt64LE(params.amount, 0);
    return buffer;
  }

  private encodeRepayParams(params: KaminoRepayParams): Buffer {
    const buffer = Buffer.alloc(8);
    buffer.writeBigUInt64LE(params.amount, 0);
    return buffer;
  }

  private encodeWithdrawParams(params: KaminoWithdrawParams): Buffer {
    const buffer = Buffer.alloc(8);
    buffer.writeBigUInt64LE(params.amount, 0);
    return buffer;
  }

  // PDA generation methods
  private getLendingMarketAddress(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('LendingMarket')],
      this.PROGRAM_ID
    );
  }

  private getReserveAddress(tokenMint: PublicKey, lendingMarket: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('Reserve'), tokenMint.toBuffer(), lendingMarket.toBuffer()],
      this.PROGRAM_ID
    );
  }

  private getCollateralMintAddress(reserve: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('CollateralMint'), reserve.toBuffer()],
      this.PROGRAM_ID
    );
  }

  private getReserveTokenAccountAddress(reserve: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('ReserveTokenAccount'), reserve.toBuffer()],
      this.PROGRAM_ID
    );
  }

  private getObligationAddress(owner: PublicKey, lendingMarket: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('Obligation'), owner.toBuffer(), lendingMarket.toBuffer()],
      this.PROGRAM_ID
    );
  }

  // Helper method to get token decimals
  private async getTokenDecimals(mint: PublicKey, network: 'mainnet' | 'devnet'): Promise<number> {
    try {
      const connection = require('../utils/connection').RPCConnection.getConnection(network);
      const mintInfo = await connection.getParsedAccountInfo(mint);
      
      if (mintInfo.value?.data && 'parsed' in mintInfo.value.data) {
        return mintInfo.value.data.parsed.info.decimals;
      }
    } catch (error) {
      console.warn(`Could not get decimals for mint ${mint.toString()}, defaulting to 6`);
    }
    
    // Default to 6 decimals for most tokens
    return 6;
  }

  getRequiredAccounts(params: Record<string, any>): PublicKey[] {
    const accounts: PublicKey[] = [];
    
    if (params.token) {
      const tokenMint = AccountResolver.resolvePublicKey(resolveMint(params.token));
      accounts.push(tokenMint);
      
      const [lendingMarket] = this.getLendingMarketAddress();
      accounts.push(lendingMarket);
      
      const [reserve] = this.getReserveAddress(tokenMint, lendingMarket);
      accounts.push(reserve);
    }
    
    return accounts;
  }
}