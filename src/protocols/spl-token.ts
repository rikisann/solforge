import { 
  TransactionInstruction, 
  PublicKey, 
  SystemProgram 
} from '@solana/web3.js';
import { 
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
  createCloseAccountInstruction,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import { BuildIntent, ProtocolHandler } from '../utils/types';
import { AccountResolver } from '../engine/resolver';
import { resolveMint } from '../utils/connection';

export class SPLTokenProtocol implements ProtocolHandler {
  name = 'spl-token';
  description = 'SPL Token Program for token transfers and account management';
  supportedIntents = [
    'token-transfer', 
    'create-token-account', 
    'create-ata',
    'close-account',
    'transfer-token'
  ];

  async build(intent: BuildIntent): Promise<TransactionInstruction[]> {
    const { params } = intent;
    const action = intent.intent;

    switch (action) {
      case 'token-transfer':
      case 'transfer-token':
        return this.buildTokenTransfer(params, intent);
      
      case 'create-token-account':
      case 'create-ata':
        return this.buildCreateTokenAccount(params, intent);
      
      case 'close-account':
        return this.buildCloseAccount(params, intent);
      
      default:
        throw new Error(`Unsupported SPL Token action: ${action}`);
    }
  }

  validateParams(params: Record<string, any>): boolean {
    if (params.action === 'token-transfer' || params.action === 'transfer-token') {
      return (
        typeof params.amount === 'number' &&
        params.amount > 0 &&
        typeof params.token === 'string' &&
        typeof params.to === 'string' &&
        params.token !== 'SOL' // SOL transfers go through system program
      );
    }

    if (params.action === 'create-token-account' || params.action === 'create-ata') {
      return typeof params.token === 'string';
    }

    if (params.action === 'close-account') {
      return typeof params.account === 'string';
    }

    // For direct intent calls
    if (params.token && params.token !== 'SOL') {
      return true;
    }

    return false;
  }

  private async buildTokenTransfer(
    params: Record<string, any>,
    intent: BuildIntent
  ): Promise<TransactionInstruction[]> {
    const payer = AccountResolver.resolvePublicKey(intent.payer);
    const recipient = AccountResolver.resolvePublicKey(params.to);
    const mintAddress = AccountResolver.resolvePublicKey(resolveMint(params.token));
    const amount = params.amount;

    const network = intent.network || 'devnet';
    const instructions: TransactionInstruction[] = [];

    // Get source and destination token accounts
    const sourceAccount = await AccountResolver.getAssociatedTokenAccount(mintAddress, payer);
    const destAccount = await AccountResolver.getAssociatedTokenAccount(mintAddress, recipient);

    // Check if source account exists and has sufficient balance
    const sourceExists = await AccountResolver.accountExists(sourceAccount, network);
    if (!sourceExists) {
      throw new Error(`Source token account does not exist for ${params.token}`);
    }

    // Check if destination account exists, create if not
    const destExists = await AccountResolver.accountExists(destAccount, network);
    if (!destExists) {
      instructions.push(
        createAssociatedTokenAccountInstruction(
          payer,      // payer
          destAccount, // associated token account
          recipient,   // owner
          mintAddress  // mint
        )
      );
    }

    // Get token info to determine decimals (assuming 6 for most tokens, 9 for SOL-like)
    const decimals = await this.getTokenDecimals(mintAddress, network);
    const adjustedAmount = Math.floor(amount * Math.pow(10, decimals));

    // Create transfer instruction
    instructions.push(
      createTransferInstruction(
        sourceAccount,  // source
        destAccount,    // dest  
        payer,          // owner of source account
        adjustedAmount  // amount
      )
    );

    return instructions;
  }

  private async buildCreateTokenAccount(
    params: Record<string, any>,
    intent: BuildIntent
  ): Promise<TransactionInstruction[]> {
    const payer = AccountResolver.resolvePublicKey(intent.payer);
    const mintAddress = AccountResolver.resolvePublicKey(resolveMint(params.token));
    const owner = params.owner ? AccountResolver.resolvePublicKey(params.owner) : payer;

    const associatedAccount = await AccountResolver.getAssociatedTokenAccount(mintAddress, owner);
    const network = intent.network || 'devnet';

    // Check if account already exists
    const accountExists = await AccountResolver.accountExists(associatedAccount, network);
    if (accountExists) {
      throw new Error(`Token account already exists for ${params.token}`);
    }

    return [
      createAssociatedTokenAccountInstruction(
        payer,            // payer
        associatedAccount, // associated token account
        owner,            // owner
        mintAddress       // mint
      )
    ];
  }

  private async buildCloseAccount(
    params: Record<string, any>,
    intent: BuildIntent
  ): Promise<TransactionInstruction[]> {
    const payer = AccountResolver.resolvePublicKey(intent.payer);
    const account = AccountResolver.resolvePublicKey(params.account);
    const destination = params.destination ? 
      AccountResolver.resolvePublicKey(params.destination) : payer;

    return [
      createCloseAccountInstruction(
        account,     // account to close
        destination, // destination for remaining balance
        payer        // owner of account
      )
    ];
  }

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
    
    // Default to 6 decimals (common for USDC, USDT, etc.)
    return 6;
  }

  getRequiredAccounts(params: Record<string, any>): PublicKey[] {
    const accounts: PublicKey[] = [];
    
    if (params.token) {
      accounts.push(AccountResolver.resolvePublicKey(resolveMint(params.token)));
    }
    
    if (params.to) {
      accounts.push(AccountResolver.resolvePublicKey(params.to));
    }

    if (params.account) {
      accounts.push(AccountResolver.resolvePublicKey(params.account));
    }

    return accounts;
  }
}