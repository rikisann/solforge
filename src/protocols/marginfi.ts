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

interface MarginfiSupplyParams {
  amount: bigint;
}

interface MarginfiBorrowParams {
  amount: bigint;
}

interface MarginfiRepayParams {
  amount: bigint;
}

interface MarginfiWithdrawParams {
  amount: bigint;
}

export class MarginfiProtocol implements ProtocolHandler {
  name = 'marginfi';
  description = 'Marginfi v2 lending protocol for supply, borrow, repay, and withdraw operations';
  supportedIntents = [
    'supply', 
    'deposit', 
    'lend', 
    'borrow', 
    'repay', 
    'withdraw',
    'marginfi-supply',
    'marginfi-deposit',
    'marginfi-borrow',
    'marginfi-repay',
    'marginfi-withdraw'
  ];

  readonly PROGRAM_ID = new PublicKey('MFv2hWf31Z9kbCa1snEPYctwafyhdJnFETUbqwpY6wB');
  
  // Instruction discriminators (8-byte identifiers for each instruction)
  readonly DEPOSIT_DISCRIMINATOR = Buffer.from([242, 35, 198, 137, 82, 225, 242, 182]);
  readonly BORROW_DISCRIMINATOR = Buffer.from([50, 57, 127, 105, 174, 66, 40, 161]);
  readonly REPAY_DISCRIMINATOR = Buffer.from([234, 103, 67, 82, 208, 234, 219, 166]);
  readonly WITHDRAW_DISCRIMINATOR = Buffer.from([183, 18, 70, 156, 148, 109, 161, 34]);

  async build(intent: BuildIntent): Promise<TransactionInstruction[]> {
    const { params } = intent;
    const action = intent.intent;

    switch (action) {
      case 'supply':
      case 'deposit':
      case 'lend':
      case 'marginfi-supply':
      case 'marginfi-deposit':
        return this.buildSupply(params, intent);
        
      case 'borrow':
      case 'marginfi-borrow':
        return this.buildBorrow(params, intent);
        
      case 'repay':
      case 'marginfi-repay':
        return this.buildRepay(params, intent);
        
      case 'withdraw':
      case 'marginfi-withdraw':
        return this.buildWithdraw(params, intent);
        
      default:
        throw new Error(`Unsupported Marginfi action: ${action}`);
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

    // Generate PDAs for Marginfi lending pool
    const [marginfiGroup] = this.getMarginfiGroupAddress();
    const [bank] = this.getBankAddress(tokenMint, marginfiGroup);
    const [marginfiAccount] = this.getMarginfiAccountAddress(payer, marginfiGroup);

    // User's token account
    const userTokenAccount = await getAssociatedTokenAddress(tokenMint, payer);

    // Bank token account (vault where tokens are stored)
    const [bankTokenAccount] = this.getBankTokenAccountAddress(bank);

    const data = Buffer.concat([
      this.DEPOSIT_DISCRIMINATOR,
      this.encodeSupplyParams({ amount: adjustedAmount })
    ]);

    return [
      new TransactionInstruction({
        keys: [
          { pubkey: marginfiGroup, isSigner: false, isWritable: false },
          { pubkey: bank, isSigner: false, isWritable: true },
          { pubkey: marginfiAccount, isSigner: false, isWritable: true },
          { pubkey: userTokenAccount, isSigner: false, isWritable: true },
          { pubkey: bankTokenAccount, isSigner: false, isWritable: true },
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

    const [marginfiGroup] = this.getMarginfiGroupAddress();
    const [bank] = this.getBankAddress(tokenMint, marginfiGroup);
    const [marginfiAccount] = this.getMarginfiAccountAddress(payer, marginfiGroup);

    const userTokenAccount = await getAssociatedTokenAddress(tokenMint, payer);
    const [bankTokenAccount] = this.getBankTokenAccountAddress(bank);

    const data = Buffer.concat([
      this.BORROW_DISCRIMINATOR,
      this.encodeBorrowParams({ amount: adjustedAmount })
    ]);

    return [
      new TransactionInstruction({
        keys: [
          { pubkey: marginfiGroup, isSigner: false, isWritable: false },
          { pubkey: bank, isSigner: false, isWritable: true },
          { pubkey: marginfiAccount, isSigner: false, isWritable: true },
          { pubkey: userTokenAccount, isSigner: false, isWritable: true },
          { pubkey: bankTokenAccount, isSigner: false, isWritable: true },
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

    const [marginfiGroup] = this.getMarginfiGroupAddress();
    const [bank] = this.getBankAddress(tokenMint, marginfiGroup);
    const [marginfiAccount] = this.getMarginfiAccountAddress(payer, marginfiGroup);

    const userTokenAccount = await getAssociatedTokenAddress(tokenMint, payer);
    const [bankTokenAccount] = this.getBankTokenAccountAddress(bank);

    const data = Buffer.concat([
      this.REPAY_DISCRIMINATOR,
      this.encodeRepayParams({ amount: adjustedAmount })
    ]);

    return [
      new TransactionInstruction({
        keys: [
          { pubkey: marginfiGroup, isSigner: false, isWritable: false },
          { pubkey: bank, isSigner: false, isWritable: true },
          { pubkey: marginfiAccount, isSigner: false, isWritable: true },
          { pubkey: userTokenAccount, isSigner: false, isWritable: true },
          { pubkey: bankTokenAccount, isSigner: false, isWritable: true },
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

    const [marginfiGroup] = this.getMarginfiGroupAddress();
    const [bank] = this.getBankAddress(tokenMint, marginfiGroup);
    const [marginfiAccount] = this.getMarginfiAccountAddress(payer, marginfiGroup);

    const userTokenAccount = await getAssociatedTokenAddress(tokenMint, payer);
    const [bankTokenAccount] = this.getBankTokenAccountAddress(bank);

    const data = Buffer.concat([
      this.WITHDRAW_DISCRIMINATOR,
      this.encodeWithdrawParams({ amount: adjustedAmount })
    ]);

    return [
      new TransactionInstruction({
        keys: [
          { pubkey: marginfiGroup, isSigner: false, isWritable: false },
          { pubkey: bank, isSigner: false, isWritable: true },
          { pubkey: marginfiAccount, isSigner: false, isWritable: true },
          { pubkey: userTokenAccount, isSigner: false, isWritable: true },
          { pubkey: bankTokenAccount, isSigner: false, isWritable: true },
          { pubkey: payer, isSigner: true, isWritable: false },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        ],
        programId: this.PROGRAM_ID,
        data
      })
    ];
  }

  // Encoding methods for instruction data
  private encodeSupplyParams(params: MarginfiSupplyParams): Buffer {
    const buffer = Buffer.alloc(8);
    buffer.writeBigUInt64LE(params.amount, 0);
    return buffer;
  }

  private encodeBorrowParams(params: MarginfiBorrowParams): Buffer {
    const buffer = Buffer.alloc(8);
    buffer.writeBigUInt64LE(params.amount, 0);
    return buffer;
  }

  private encodeRepayParams(params: MarginfiRepayParams): Buffer {
    const buffer = Buffer.alloc(8);
    buffer.writeBigUInt64LE(params.amount, 0);
    return buffer;
  }

  private encodeWithdrawParams(params: MarginfiWithdrawParams): Buffer {
    const buffer = Buffer.alloc(8);
    buffer.writeBigUInt64LE(params.amount, 0);
    return buffer;
  }

  // PDA generation methods
  private getMarginfiGroupAddress(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('marginfi_group')],
      this.PROGRAM_ID
    );
  }

  private getBankAddress(tokenMint: PublicKey, marginfiGroup: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('bank'), tokenMint.toBuffer(), marginfiGroup.toBuffer()],
      this.PROGRAM_ID
    );
  }

  private getMarginfiAccountAddress(owner: PublicKey, marginfiGroup: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('marginfi_account'), owner.toBuffer(), marginfiGroup.toBuffer()],
      this.PROGRAM_ID
    );
  }

  private getBankTokenAccountAddress(bank: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('bank_vault'), bank.toBuffer()],
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
      
      const [marginfiGroup] = this.getMarginfiGroupAddress();
      accounts.push(marginfiGroup);
      
      const [bank] = this.getBankAddress(tokenMint, marginfiGroup);
      accounts.push(bank);
    }
    
    return accounts;
  }
}