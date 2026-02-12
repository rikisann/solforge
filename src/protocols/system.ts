import { 
  SystemProgram, 
  TransactionInstruction, 
  PublicKey, 
  LAMPORTS_PER_SOL 
} from '@solana/web3.js';
import { BuildIntent, ProtocolHandler } from '../utils/types';
import { AccountResolver } from '../engine/resolver';

export class SystemProtocol implements ProtocolHandler {
  name = 'system';
  description = 'Solana System Program for SOL transfers and account creation';
  supportedIntents = ['transfer', 'send', 'create-account', 'sol-transfer'];

  async build(intent: BuildIntent): Promise<TransactionInstruction[]> {
    const { params } = intent;
    const action = intent.intent;

    switch (action) {
      case 'transfer':
      case 'send':
      case 'sol-transfer':
        return this.buildTransfer(params, intent);
      
      case 'create-account':
        return this.buildCreateAccount(params, intent);
      
      default:
        throw new Error(`Unsupported system action: ${action}`);
    }
  }

  validateParams(params: Record<string, any>): boolean {
    if (params.action === 'transfer' || params.action === 'send') {
      return (
        typeof params.amount === 'number' &&
        params.amount > 0 &&
        typeof params.to === 'string' &&
        (params.token === 'SOL' || !params.token)
      );
    }

    if (params.action === 'create-account') {
      return (
        typeof params.space === 'number' &&
        params.space >= 0 &&
        typeof params.owner === 'string'
      );
    }

    // For direct intent calls without action param
    if (typeof params.amount === 'number' && typeof params.to === 'string') {
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
    const amount = params.amount;

    // Convert SOL to lamports
    const lamports = Math.floor(amount * LAMPORTS_PER_SOL);

    if (lamports <= 0) {
      throw new Error('Transfer amount must be positive');
    }

    // Check if recipient account exists, create if not
    const network = intent.network || 'devnet';
    const recipientExists = await AccountResolver.accountExists(recipient, network);
    
    const instructions: TransactionInstruction[] = [];

    if (!recipientExists) {
      // Create recipient account with minimum rent-exempt balance
      const rentExemption = await AccountResolver.getMinimumRentExemption(0, network);
      const transferAmount = Math.max(lamports, rentExemption);
      
      instructions.push(
        SystemProgram.createAccount({
          fromPubkey: payer,
          newAccountPubkey: recipient,
          lamports: transferAmount,
          space: 0,
          programId: SystemProgram.programId
        })
      );
    } else {
      // Simple transfer to existing account
      instructions.push(
        SystemProgram.transfer({
          fromPubkey: payer,
          toPubkey: recipient,
          lamports
        })
      );
    }

    return instructions;
  }

  private async buildCreateAccount(
    params: Record<string, any>,
    intent: BuildIntent
  ): Promise<TransactionInstruction[]> {
    const payer = AccountResolver.resolvePublicKey(intent.payer);
    const owner = AccountResolver.resolvePublicKey(params.owner);
    const space = params.space || 0;
    
    const network = intent.network || 'devnet';
    const rentExemption = await AccountResolver.getMinimumRentExemption(space, network);

    // Generate a new account keypair - in a real app, this would be provided
    // For now, we'll create a derived account
    const [newAccount] = AccountResolver.findProgramAddress(
      [payer.toBuffer(), Buffer.from('account'), Buffer.from(Date.now().toString())],
      owner
    );

    return [
      SystemProgram.createAccount({
        fromPubkey: payer,
        newAccountPubkey: newAccount,
        lamports: rentExemption,
        space,
        programId: owner
      })
    ];
  }

  getRequiredAccounts(params: Record<string, any>): PublicKey[] {
    const accounts: PublicKey[] = [];
    
    if (params.to) {
      accounts.push(AccountResolver.resolvePublicKey(params.to));
    }
    
    if (params.owner) {
      accounts.push(AccountResolver.resolvePublicKey(params.owner));
    }

    return accounts;
  }
}