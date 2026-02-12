import { TransactionInstruction, PublicKey } from '@solana/web3.js';
import { BuildIntent, ProtocolHandler } from '../utils/types';
import { AccountResolver } from '../engine/resolver';

// Memo program ID
const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

export class MemoProtocol implements ProtocolHandler {
  name = 'memo';
  description = 'Memo Program for writing messages on-chain';
  supportedIntents = ['memo', 'write-memo', 'message'];

  async build(intent: BuildIntent): Promise<TransactionInstruction[]> {
    const { params } = intent;
    const message = params.message || params.memo || params.text;

    if (!message || typeof message !== 'string') {
      throw new Error('Message is required for memo instruction');
    }

    if (message.length > 566) {
      throw new Error('Memo message too long. Maximum 566 bytes allowed.');
    }

    return this.buildMemo(message, intent);
  }

  validateParams(params: Record<string, any>): boolean {
    const message = params.message || params.memo || params.text;
    return (
      typeof message === 'string' &&
      message.length > 0 &&
      message.length <= 566
    );
  }

  private buildMemo(message: string, intent: BuildIntent): TransactionInstruction[] {
    const payer = AccountResolver.resolvePublicKey(intent.payer);

    // Create memo instruction
    const instruction = new TransactionInstruction({
      keys: [
        {
          pubkey: payer,
          isSigner: true,
          isWritable: false
        }
      ],
      programId: MEMO_PROGRAM_ID,
      data: Buffer.from(message, 'utf8')
    });

    return [instruction];
  }

  // Helper method to create memo with multiple signers
  buildMemoWithSigners(message: string, signers: PublicKey[]): TransactionInstruction {
    if (message.length > 566) {
      throw new Error('Memo message too long. Maximum 566 bytes allowed.');
    }

    const keys = signers.map(signer => ({
      pubkey: signer,
      isSigner: true,
      isWritable: false
    }));

    return new TransactionInstruction({
      keys,
      programId: MEMO_PROGRAM_ID,
      data: Buffer.from(message, 'utf8')
    });
  }

  getRequiredAccounts(params: Record<string, any>): PublicKey[] {
    // Memo only requires the signer (payer), no additional accounts
    return [];
  }

  // Utility method to validate UTF-8 encoding
  static isValidUTF8(message: string): boolean {
    try {
      Buffer.from(message, 'utf8');
      return true;
    } catch {
      return false;
    }
  }

  // Get memo examples
  static getExamples(): Record<string, string> {
    return {
      simple: 'Hello Solana!',
      transaction: 'Payment for services rendered',
      structured: JSON.stringify({ 
        type: 'payment', 
        invoice: 'INV-001', 
        amount: 1.5 
      }),
      emoji: '🚀 To the moon! 🌙',
      multilang: 'Hello 世界 مرحبا Здравствуй'
    };
  }
}