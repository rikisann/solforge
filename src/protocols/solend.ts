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

interface SolendDepositParams {
  amount: bigint;
}

interface SolendBorrowParams {
  amount: bigint;
}

interface SolendRepayParams {
  amount: bigint;
}

interface SolendWithdrawParams {
  amount: bigint;
}

export class SolendProtocol implements ProtocolHandler {
  name = 'solend';
  description = 'Solend lending protocol for supply, borrow, repay, and withdraw operations';
  supportedIntents = [
    'supply', 
    'deposit', 
    'lend', 
    'borrow', 
    'repay', 
    'withdraw',
    'solend-supply',
    'solend-deposit',
    'solend-borrow',
    'solend-repay',
    'solend-withdraw'
  ];

  readonly PROGRAM_ID = new PublicKey('ALLegCXWQTf5Jj5k2hJVVkFGSpw8KfxV1xHYQGUMg2n');
  
  // Instruction discriminators (8-byte identifiers for each instruction)
  readonly DEPOSIT_RESERVE_LIQUIDITY_DISCRIMINATOR = Buffer.from([95, 178, 25, 24, 206, 132, 111, 119]);
  readonly BORROW_OBLIGATION_LIQUIDITY_DISCRIMINATOR = Buffer.from([115, 169, 131, 109, 237, 98, 78, 175]);
  readonly REPAY_OBLIGATION_LIQUIDITY_DISCRIMINATOR = Buffer.from([123, 64, 198, 202, 76, 64, 44, 213]);
  readonly REDEEM_RESERVE_COLLATERAL_DISCRIMINATOR = Buffer.from([51, 57, 237, 111, 48, 7, 12, 43]);

  async build(intent: BuildIntent): Promise<TransactionInstruction[]> {
    const { params } = intent;
    const action = intent.intent;

    switch (action) {
      case 'supply':
      case 'deposit':
      case 'lend':
      case 'solend-supply':
      case 'solend-deposit':
        return this.buildSupply(params, intent);
        
      case 'borrow':
      case 'solend-borrow':
        return this.buildBorrow(params, intent);
        
      case 'repay':
      case 'solend-repay':
        return this.buildRepay(params, intent);
        
      case 'withdraw':
      case 'solend-withdraw':
        return this.buildWithdraw(params, intent);
        
      default:
        throw new Error(`Unsupported Solend action: ${action}`);
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

    // Generate PDAs for Solend lending pool
    const [lendingMarket] = this.getLendingMarketAddress();
    const [reserve] = this.getReserveAddress(tokenMint, lendingMarket);
    const [collateralMint] = this.getCollateralMintAddress(reserve);

    // User's token account and collateral account
    const userTokenAccount = await getAssociatedTokenAddress(tokenMint, payer);
    const userCollateralAccount = await getAssociatedTokenAddress(collateralMint, payer);

    // Reserve liquidity supply (where the actual tokens go)
    const [reserveLiquiditySupply] = this.getReserveLiquiditySupplyAddress(reserve);
    const [lendingMarketAuthority] = this.getLendingMarketAuthorityAddress(lendingMarket);

    const data = Buffer.concat([
      this.DEPOSIT_RESERVE_LIQUIDITY_DISCRIMINATOR,
      this.encodeDepositParams({ amount: adjustedAmount })
    ]);

    return [
      new TransactionInstruction({
        keys: [
          { pubkey: userTokenAccount, isSigner: false, isWritable: true },
          { pubkey: userCollateralAccount, isSigner: false, isWritable: true },
          { pubkey: reserve, isSigner: false, isWritable: true },
          { pubkey: reserveLiquiditySupply, isSigner: false, isWritable: true },
          { pubkey: collateralMint, isSigner: false, isWritable: true },
          { pubkey: lendingMarket, isSigner: false, isWritable: false },
          { pubkey: lendingMarketAuthority, isSigner: false, isWritable: false },
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
    const [obligation] = this.getObligationAddress(payer, lendingMarket);

    const userTokenAccount = await getAssociatedTokenAddress(tokenMint, payer);
    const [reserveLiquiditySupply] = this.getReserveLiquiditySupplyAddress(reserve);
    const [lendingMarketAuthority] = this.getLendingMarketAuthorityAddress(lendingMarket);

    const data = Buffer.concat([
      this.BORROW_OBLIGATION_LIQUIDITY_DISCRIMINATOR,
      this.encodeBorrowParams({ amount: adjustedAmount })
    ]);

    return [
      new TransactionInstruction({
        keys: [
          { pubkey: userTokenAccount, isSigner: false, isWritable: true },
          { pubkey: obligation, isSigner: false, isWritable: true },
          { pubkey: reserve, isSigner: false, isWritable: true },
          { pubkey: reserveLiquiditySupply, isSigner: false, isWritable: true },
          { pubkey: lendingMarket, isSigner: false, isWritable: false },
          { pubkey: lendingMarketAuthority, isSigner: false, isWritable: false },
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
    const [obligation] = this.getObligationAddress(payer, lendingMarket);

    const userTokenAccount = await getAssociatedTokenAddress(tokenMint, payer);
    const [reserveLiquiditySupply] = this.getReserveLiquiditySupplyAddress(reserve);

    const data = Buffer.concat([
      this.REPAY_OBLIGATION_LIQUIDITY_DISCRIMINATOR,
      this.encodeRepayParams({ amount: adjustedAmount })
    ]);

    return [
      new TransactionInstruction({
        keys: [
          { pubkey: userTokenAccount, isSigner: false, isWritable: true },
          { pubkey: obligation, isSigner: false, isWritable: true },
          { pubkey: reserve, isSigner: false, isWritable: true },
          { pubkey: reserveLiquiditySupply, isSigner: false, isWritable: true },
          { pubkey: lendingMarket, isSigner: false, isWritable: false },
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
    const [reserveLiquiditySupply] = this.getReserveLiquiditySupplyAddress(reserve);
    const [lendingMarketAuthority] = this.getLendingMarketAuthorityAddress(lendingMarket);

    const data = Buffer.concat([
      this.REDEEM_RESERVE_COLLATERAL_DISCRIMINATOR,
      this.encodeWithdrawParams({ amount: adjustedAmount })
    ]);

    return [
      new TransactionInstruction({
        keys: [
          { pubkey: userTokenAccount, isSigner: false, isWritable: true },
          { pubkey: userCollateralAccount, isSigner: false, isWritable: true },
          { pubkey: reserve, isSigner: false, isWritable: true },
          { pubkey: reserveLiquiditySupply, isSigner: false, isWritable: true },
          { pubkey: collateralMint, isSigner: false, isWritable: true },
          { pubkey: lendingMarket, isSigner: false, isWritable: false },
          { pubkey: lendingMarketAuthority, isSigner: false, isWritable: false },
          { pubkey: payer, isSigner: true, isWritable: false },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        ],
        programId: this.PROGRAM_ID,
        data
      })
    ];
  }

  // Encoding methods for instruction data
  private encodeDepositParams(params: SolendDepositParams): Buffer {
    const buffer = Buffer.alloc(8);
    buffer.writeBigUInt64LE(params.amount, 0);
    return buffer;
  }

  private encodeBorrowParams(params: SolendBorrowParams): Buffer {
    const buffer = Buffer.alloc(8);
    buffer.writeBigUInt64LE(params.amount, 0);
    return buffer;
  }

  private encodeRepayParams(params: SolendRepayParams): Buffer {
    const buffer = Buffer.alloc(8);
    buffer.writeBigUInt64LE(params.amount, 0);
    return buffer;
  }

  private encodeWithdrawParams(params: SolendWithdrawParams): Buffer {
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

  private getReserveLiquiditySupplyAddress(reserve: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('LiquiditySupply'), reserve.toBuffer()],
      this.PROGRAM_ID
    );
  }

  private getObligationAddress(owner: PublicKey, lendingMarket: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('Obligation'), owner.toBuffer(), lendingMarket.toBuffer()],
      this.PROGRAM_ID
    );
  }

  private getLendingMarketAuthorityAddress(lendingMarket: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [lendingMarket.toBuffer()],
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