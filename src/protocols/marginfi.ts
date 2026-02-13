import { 
  TransactionInstruction, 
  PublicKey, 
} from '@solana/web3.js';
import { BuildIntent, ProtocolHandler } from '../utils/types';
import { resolveMint, RPCConnection } from '../utils/connection';

export class MarginfiProtocol implements ProtocolHandler {
  name = 'marginfi';
  description = 'Marginfi lending protocol for supply, borrow, repay, and withdraw operations';
  supportedIntents = [
    'supply', 'deposit', 'lend', 'borrow', 'repay', 'withdraw',
    'marginfi-supply', 'marginfi-deposit', 'marginfi-borrow', 'marginfi-repay', 'marginfi-withdraw'
  ];

  private static clientCache: any = null;
  private static clientCacheTime = 0;
  private static readonly CACHE_TTL = 60000; // 1 min

  async build(intent: BuildIntent): Promise<TransactionInstruction[]> {
    const action = intent.intent;
    switch (action) {
      case 'supply': case 'deposit': case 'lend': case 'marginfi-supply': case 'marginfi-deposit':
        return this.buildWithSDK(intent, 'deposit');
      case 'borrow': case 'marginfi-borrow':
        return this.buildWithSDK(intent, 'borrow');
      case 'repay': case 'marginfi-repay':
        return this.buildWithSDK(intent, 'repay');
      case 'withdraw': case 'marginfi-withdraw':
        return this.buildWithSDK(intent, 'withdraw');
      default:
        throw new Error(`Unsupported Marginfi action: ${action}`);
    }
  }

  validateParams(params: Record<string, any>): boolean {
    if (typeof params.amount !== 'number' || params.amount <= 0) return false;
    if (!params.token || typeof params.token !== 'string') return false;
    return true;
  }

  private async getClient() {
    const now = Date.now();
    if (MarginfiProtocol.clientCache && (now - MarginfiProtocol.clientCacheTime) < MarginfiProtocol.CACHE_TTL) {
      return MarginfiProtocol.clientCache;
    }
    
    // For now, throw an error indicating Marginfi integration needs account setup
    throw new Error('Marginfi integration requires manual account setup. Please create a Marginfi account first using their app, then this integration will work.');
  }

  private async buildWithSDK(intent: BuildIntent, action: 'deposit' | 'borrow' | 'repay' | 'withdraw'): Promise<TransactionInstruction[]> {
    const { address, createNoopSigner } = require('@solana/kit');
    const BN = require('bn.js');

    const { client, connection } = await this.getClient();
    
    const tokenMint = address(resolveMint(intent.params.token));
    const payerAddr = address(intent.payer);
    const owner = createNoopSigner(payerAddr);

    // Find the bank for this token
    const banks = Array.from(client.banks.values());
    const bank = banks.find((b: any) => b.mint?.toString() === tokenMint.toString());
    
    if (!bank) {
      throw new Error(`No Marginfi bank found for token ${intent.params.token}`);
    }

    // Get token decimals
    const decimals = (bank as any).mintDecimals || 6;
    const amountBN = new BN(Math.floor(intent.params.amount * Math.pow(10, decimals)));

    // Get or create marginfi account for the user
    let marginfiAccount;
    try {
      // Try to fetch existing account
      const marginfiAccounts = await client.getMarginfiAccountsForAuthority(payerAddr);
      if (marginfiAccounts.length > 0) {
        marginfiAccount = marginfiAccounts[0]; // Use first account
      } else {
        // Create new marginfi account instruction
        const createAccountIx = await client.makeCreateMarginfiAccountIx(owner);
        // We'll need to handle account creation separately in a real implementation
        // For now, throw an error requiring manual account creation
        throw new Error('Marginfi account not found. Please create a Marginfi account first.');
      }
    } catch (error) {
      throw new Error(`Failed to get Marginfi account: ${error}`);
    }

    let instructions: any[] = [];

    switch (action) {
      case 'deposit':
        instructions = await marginfiAccount.makeDepositIx(amountBN, (bank as any).address);
        break;
      case 'borrow':
        instructions = await marginfiAccount.makeBorrowIx(amountBN, (bank as any).address);
        break;
      case 'repay':
        instructions = await marginfiAccount.makeRepayIx(amountBN, (bank as any).address, true);
        break;
      case 'withdraw':
        instructions = await marginfiAccount.makeWithdrawIx(amountBN, (bank as any).address);
        break;
    }

    // Convert @solana/kit instructions to @solana/web3.js TransactionInstructions
    const convertIx = (ix: any): TransactionInstruction => {
      return new TransactionInstruction({
        programId: new PublicKey(ix.programAddress?.toString() || ix.programId?.toString()),
        keys: (ix.accounts || ix.keys || []).map((acc: any) => ({
          pubkey: new PublicKey(acc.address?.toString() || acc.pubkey?.toString()),
          isSigner: acc.role === 2 || acc.role === 3 || acc.isSigner === true,
          isWritable: acc.role === 1 || acc.role === 3 || acc.isWritable === true,
        })),
        data: Buffer.from(ix.data || []),
      });
    };

    const allIxs: TransactionInstruction[] = [];
    
    // Handle different instruction formats
    if (Array.isArray(instructions)) {
      allIxs.push(...instructions.map(convertIx));
    } else if (instructions && typeof instructions === 'object') {
      // Handle structured instruction object
      const structuredIx = instructions as any;
      if (structuredIx.setupIxs) allIxs.push(...structuredIx.setupIxs.map(convertIx));
      if (structuredIx.lendingIxs) allIxs.push(...structuredIx.lendingIxs.map(convertIx));
      if (structuredIx.cleanupIxs) allIxs.push(...structuredIx.cleanupIxs.map(convertIx));
      
      // If none of the structured props exist, treat as single instruction
      if (!structuredIx.setupIxs && !structuredIx.lendingIxs && !structuredIx.cleanupIxs) {
        allIxs.push(convertIx(instructions));
      }
    } else {
      throw new Error('Invalid instruction format from Marginfi SDK');
    }

    if (allIxs.length === 0) {
      throw new Error('Marginfi SDK returned no instructions');
    }

    return allIxs;
  }

  getRequiredAccounts(params: Record<string, any>): PublicKey[] {
    return [];
  }
}