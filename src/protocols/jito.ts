import { 
  SystemProgram, 
  TransactionInstruction, 
  PublicKey, 
  LAMPORTS_PER_SOL 
} from '@solana/web3.js';
import { BuildIntent, ProtocolHandler } from '../utils/types';
import { AccountResolver } from '../engine/resolver';

// Jito tip accounts (these are the official Jito tip accounts)
const JITO_TIP_ACCOUNTS = [
  'T1pyyaTNZsKv2WcRAQbZYRxhDYrYHwkiRSg6E2SWPp6',
  'DCHyHR13KpqAQK92kNvtxiAd52V5cxPQnqfJnRPUWjDi',
  'DdLhKC7q4AyfHqvmC8kDj5Ku5pzSefhV7KqNSh1LbHb8',
  'ADuUkR4vqLUMWXxW9gh6D6KVJL7h2U9UqbS9Zo23RGNW',
  'E1BuuKMSWDQ5Rc97iAQEZWLhcE9qPSzD5VqKmQ3rH8XP',
  'DTxqpZq4YGMeNLEjZhEm9v4QjbHxLvhKGWU1hfHfggVF',
  'BHx2sDQj6d4NCkVGXL9MnTH3LQMrKvY1xZT8WaDUcrTu',
  'Cw8CFyM9FkoMiYh9bN4uUHzkrCYF1A4qkmTCWFMAGmvL'
];

export class JitoProtocol implements ProtocolHandler {
  name = 'jito';
  description = 'Jito MEV protection through tips';
  supportedIntents = ['tip', 'jito-tip', 'mev-tip'];

  async build(intent: BuildIntent): Promise<TransactionInstruction[]> {
    const { params } = intent;
    const amount = params.amount;

    if (!amount || amount <= 0) {
      throw new Error('Tip amount must be positive');
    }

    return this.buildTip(amount, intent);
  }

  validateParams(params: Record<string, any>): boolean {
    return (
      typeof params.amount === 'number' &&
      params.amount > 0 &&
      params.amount <= 10 // Reasonable upper limit for tips in SOL
    );
  }

  private buildTip(amount: number, intent: BuildIntent): TransactionInstruction[] {
    const payer = AccountResolver.resolvePublicKey(intent.payer);
    
    // Convert SOL to lamports
    const lamports = Math.floor(amount * LAMPORTS_PER_SOL);

    if (lamports < 1000) { // Minimum tip of 1000 lamports (0.000001 SOL)
      throw new Error('Tip amount too small. Minimum 0.000001 SOL');
    }

    // Select a random Jito tip account for load balancing
    const tipAccountAddress = this.selectTipAccount();
    const tipAccount = new PublicKey(tipAccountAddress);

    // Create transfer instruction to tip account
    const instruction = SystemProgram.transfer({
      fromPubkey: payer,
      toPubkey: tipAccount,
      lamports
    });

    return [instruction];
  }

  private selectTipAccount(): string {
    // Select random tip account for load balancing
    const randomIndex = Math.floor(Math.random() * JITO_TIP_ACCOUNTS.length);
    return JITO_TIP_ACCOUNTS[randomIndex];
  }

  // Method to build tip with specific tip account
  buildTipToAccount(
    amount: number,
    tipAccountAddress: string,
    payer: PublicKey
  ): TransactionInstruction {
    const lamports = Math.floor(amount * LAMPORTS_PER_SOL);
    
    if (!JITO_TIP_ACCOUNTS.includes(tipAccountAddress)) {
      throw new Error('Invalid Jito tip account address');
    }

    const tipAccount = new PublicKey(tipAccountAddress);

    return SystemProgram.transfer({
      fromPubkey: payer,
      toPubkey: tipAccount,
      lamports
    });
  }

  // Get all available tip accounts
  static getTipAccounts(): string[] {
    return [...JITO_TIP_ACCOUNTS];
  }

  // Get recommended tip amounts for different priorities
  static getRecommendedTips(): Record<string, number> {
    return {
      low: 0.0001,      // 0.0001 SOL - Basic MEV protection
      medium: 0.0005,   // 0.0005 SOL - Standard protection  
      high: 0.001,      // 0.001 SOL - High priority
      urgent: 0.005     // 0.005 SOL - Maximum priority
    };
  }

  // Calculate recommended tip based on transaction value
  static calculateRecommendedTip(transactionValueSol: number): number {
    if (transactionValueSol < 1) {
      return 0.0001; // Low tip for small transactions
    } else if (transactionValueSol < 10) {
      return 0.0005; // Medium tip for medium transactions
    } else if (transactionValueSol < 100) {
      return 0.001;  // High tip for large transactions
    } else {
      return 0.005;  // Max tip for very large transactions
    }
  }

  getRequiredAccounts(params: Record<string, any>): PublicKey[] {
    // Jito tips don't require any additional accounts beyond payer and tip account
    return [];
  }

  // Verify tip account is valid
  static isValidTipAccount(address: string): boolean {
    return JITO_TIP_ACCOUNTS.includes(address);
  }
}